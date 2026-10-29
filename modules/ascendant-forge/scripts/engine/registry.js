/**
 * Content registry and content validation.
 *
 * Seven content types share one registry. Each definition is linted on registration
 * (shape, effect vocabulary, balance rules) and the whole registry is cross-checked
 * afterwards (dangling references, dependency cycles, unreachable graph nodes).
 * Invalid content is never usable: it is kept out of the registry and reported.
 */
import { ACTION_TYPES, NODE_CATEGORIES, RESPEC_MODES, THEMES, TRIGGER_EVENTS, LIMITS } from "../constants.js";
import { lintCondition, referencedIds } from "./conditions.js";
import { lintEffect } from "./effects.js";

export const CONTENT_TYPES = Object.freeze(["node", "technique", "modifier", "evolution", "weaponPath", "weave", "synergy"]);
const ID_RE = /^[a-z][a-z0-9-]{2,63}$/;
const WEAVE_CATEGORIES = ["shaping", "elemental", "area", "precision", "efficiency", "defensive", "support", "conditional"];
const USE_PERIODS = ["sr", "lr", "turn", "round"];

/* ------------------------------------------------------------------ */
/*  Per-type linters                                                   */
/* ------------------------------------------------------------------ */

function lintText(def, p) {
  for ( const field of ["name", "description"] ) {
    const v = def[field];
    if ( !v || typeof v !== "object" || !v.en ) p.push(`${field}.en is required`);
    else if ( !v.th ) p.push(`${field}.th is required (Thai text)`);
  }
}

function lintEffects(list, path, p) {
  if ( !Array.isArray(list) ) { p.push(`${path} must be an array`); return; }
  list.forEach((e, i) => p.push(...lintEffect(e, `${path}[${i}]`)));
}

function lintCost(cost, path, p) {
  if ( !cost || typeof cost !== "object" ) { p.push(`${path} is required (use {} for no cost)`); return; }
  if ( cost.momentum != null && !(Number.isInteger(cost.momentum) && cost.momentum >= 0 && cost.momentum <= 4) ) p.push(`${path}.momentum must be 0..4`);
  if ( cost.uses ) {
    if ( !Number.isInteger(cost.uses.max) || cost.uses.max < 1 ) p.push(`${path}.uses.max must be ≥1`);
    if ( !USE_PERIODS.includes(cost.uses.per) ) p.push(`${path}.uses.per must be one of ${USE_PERIODS.join(", ")}`);
  }
  if ( cost.slotLevel != null && !(cost.slotLevel === 0 || cost.slotLevel === 1) ) p.push(`${path}.slotLevel must be 0 or 1`);
}

const kindsIn = list => new Set((list ?? []).map(e => e.kind));
const isPaid = cost => (cost?.momentum ?? 0) > 0 || !!cost?.uses || (cost?.slotLevel ?? 0) > 0;

const LINTERS = {
  node(def, p) {
    if ( !NODE_CATEGORIES.includes(def.category) ) p.push(`category must be one of ${NODE_CATEGORIES.join(", ")}`);
    if ( !(Number.isInteger(def.cost) && def.cost >= 1 && def.cost <= 3) ) p.push("cost must be 1..3 points");
    if ( !(def.respec in RESPEC_MODES) ) p.push(`respec must be one of ${Object.keys(RESPEC_MODES).join(", ")}`);
    if ( !Array.isArray(def.links) ) p.push("links (graph edges) must be an array");
    if ( !Array.isArray(def.conflicts) ) p.push("conflicts must be an array");
    p.push(...lintCondition(def.prerequisites, "prerequisites"));
    p.push(...lintCondition(def.eligibility, "eligibility"));
    p.push(...lintCondition(def.compatibility, "compatibility"));
    lintEffects(def.effects, "effects", p);
    if ( !def.rules || typeof def.rules !== "object" ) p.push("rules (validation rules) object is required");
    if ( def.category === "keystone" ) {
      // Keystones must be a real trade: at least one drawback effect or an explicit conflict list.
      const drawback = (def.effects ?? []).some(e => ["attackPenalty", "damagePenalty", "costDelta"].includes(e.kind) && (e.kind !== "costDelta" || e.value > 0))
        || def.rules?.drawback;
      if ( !drawback ) p.push("keystones must declare a drawback (penalty effect or rules.drawback)");
      if ( def.respec !== "rest" && def.respec !== "locked" ) p.push("keystones must respec on 'rest' or 'locked'");
    }
    if ( def.category === "attribute" && (def.effects ?? []).some(e => !["stat", "resourceMax", "note"].includes(e.kind)) ) {
      p.push("attribute nodes may only grant stat / resourceMax effects");
    }
    if ( typeof def.position?.x !== "number" || typeof def.position?.y !== "number" ) p.push("position {x,y} is required for the graph");
  },

  technique(def, p) {
    if ( !THEMES.includes(def.theme) ) p.push(`theme must be one of ${THEMES.join(", ")}`);
    if ( !["action", "modifyFeature", "reaction"].includes(def.kind) ) p.push("kind must be action | modifyFeature | reaction");
    if ( !ACTION_TYPES.includes(def.action) ) p.push(`action must be one of ${ACTION_TYPES.join(", ")}`);
    if ( !["weaponAttack", "spell", "self", "ally", "area"].includes(def.delivery) ) p.push("delivery must be weaponAttack | spell | self | ally | area");
    if ( def.kind === "reaction" && def.action !== "reaction" ) p.push("reaction techniques must use the reaction action");
    if ( def.kind === "reaction" && !TRIGGER_EVENTS.includes(def.trigger) ) p.push("reaction techniques need a trigger event");
    if ( def.trigger === "techniqueUsed" ) p.push("techniques cannot trigger from other techniques");
    if ( def.kind === "modifyFeature" && !def.modifiesFeature?.feature ) p.push("modifyFeature techniques need modifiesFeature.feature");
    if ( !Array.isArray(def.tags) || !def.tags.length ) p.push("tags are required (modifier compatibility uses them)");
    p.push(...lintCondition(def.learn, "learn"));
    p.push(...lintCondition(def.requires, "requires"));
    lintCost(def.cost, "cost", p);
    lintEffects(def.effects, "effects", p);
    const kinds = kindsIn(def.effects);
    // Trade rule: control / defence / mobility / support riders must be paid for.
    if ( kinds.has("secondary") && !kinds.has("damagePenalty") && !kinds.has("attackPenalty") && !isPaid(def.cost) ) {
      p.push("techniques with a secondary effect must trade damage/accuracy or cost Momentum/uses");
    }
    if ( kinds.has("resourceGain") ) p.push("techniques may not generate Momentum directly (loop guard)");
    if ( !isPaid(def.cost) && !def.limits?.oncePer && def.kind !== "modifyFeature" ) {
      p.push("free techniques must have limits.oncePer");
    }
  },

  modifier(def, p) {
    const c = def.compat;
    if ( !c || typeof c !== "object" ) p.push("compat (compatibility rules) is required");
    else {
      if ( !Array.isArray(c.anyTags) || !c.anyTags.length ) p.push("compat.anyTags must list at least one tag");
      if ( c.excludeTags && !Array.isArray(c.excludeTags) ) p.push("compat.excludeTags must be an array");
    }
    if ( !(Number.isInteger(def.slotCost) && def.slotCost >= 1 && def.slotCost <= 2) ) p.push("slotCost must be 1..2");
    lintCost(def.cost, "cost", p);
    lintEffects(def.effects, "effects", p);
    if ( !def.exclusiveGroup ) p.push("exclusiveGroup is required (one modifier per group per technique)");
    if ( !def.interaction ) p.push("interaction (how it combines with the technique) is required");
    const kinds = kindsIn(def.effects);
    if ( kinds.has("triggerOverride") && kinds.has("resourceGain") ) p.push("a modifier cannot both retarget a trigger and generate Momentum");
    if ( kinds.has("grantTechnique") ) p.push("modifiers cannot grant techniques");
  },

  evolution(def, p) {
    if ( typeof def.class !== "string" ) p.push("class identifier is required");
    if ( !THEMES.includes(def.theme) ) p.push(`theme must be one of ${THEMES.join(", ")}`);
    if ( !Array.isArray(def.tiers) || !def.tiers.length ) p.push("tiers are required");
    else {
      let lastLevel = 0;
      def.tiers.forEach((t, i) => {
        if ( t.tier !== i + 1 ) p.push(`tiers[${i}].tier must be ${i + 1}`);
        if ( !(t.classLevel > lastLevel) ) p.push(`tiers[${i}].classLevel must increase`);
        lastLevel = t.classLevel;
        if ( !t.name?.en || !t.name?.th ) p.push(`tiers[${i}].name needs en and th`);
        lintEffects(t.effects, `tiers[${i}].effects`, p);
        const riders = (t.effects ?? []).filter(e => e.kind === "riderDie").length;
        if ( riders > 1 ) p.push(`tiers[${i}] grants more than one rider die`);
      });
    }
    if ( !def.interactions || !Array.isArray(def.interactions.features) ) p.push("interactions.features (how it meets native class features) is required");
    if ( !def.balance?.note ) p.push("balance.note (balance review) is required");
    p.push(...lintCondition(def.learn, "learn"));
  },

  weaponPath(def, p) {
    if ( !["augment"].includes(def.masteryPolicy) ) p.push('masteryPolicy must be "augment" (paths extend native mastery, never replace it)');
    p.push(...lintCondition(def.learn, "learn"));
    p.push(...lintCondition(def.requires, "requires"));
    if ( !Array.isArray(def.ranks) || !def.ranks.length ) p.push("ranks are required");
    else def.ranks.forEach((r, i) => {
      if ( r.rank !== i + 1 ) p.push(`ranks[${i}].rank must be ${i + 1}`);
      if ( !Number.isInteger(r.level) ) p.push(`ranks[${i}].level required`);
      lintEffects(r.effects, `ranks[${i}].effects`, p);
    });
    if ( !def.style ) p.push("style is required");
  },

  weave(def, p) {
    if ( !WEAVE_CATEGORIES.includes(def.category) ) p.push(`category must be one of ${WEAVE_CATEGORIES.join(", ")}`);
    p.push(...lintCondition(def.learn, "learn"));
    if ( !def.appliesTo ) p.push("appliesTo (which spells can be woven) is required");
    p.push(...lintCondition(def.appliesTo, "appliesTo"));
    lintCost(def.cost, "cost", p);
    if ( !isPaid(def.cost) ) p.push("weaves must cost Momentum, limited uses, or a higher slot");
    lintEffects(def.effects, "effects", p);
    const kinds = kindsIn(def.effects);
    if ( kinds.has("resourceGain") ) p.push("weaves cannot generate Momentum");
    if ( !def.metamagic || !["exclusive", "compatible"].includes(def.metamagic.policy) ) p.push('metamagic.policy must be "exclusive" or "compatible"');
    if ( !def.preserves ) p.push("preserves (what of the original spell stays unchanged) is required");
  },

  synergy(def, p) {
    const r = def.requires;
    if ( !r || typeof r !== "object" ) { p.push("requires is required"); return; }
    const systems = ["nodes", "techniques", "modifiers", "evolutions", "weaponPaths", "weaves"].filter(k => r[k]?.length);
    if ( systems.length < 2 ) p.push("synergies must connect at least two different subsystems");
    if ( !Number.isInteger(def.priority) ) p.push("priority (resolution order) must be an integer");
    if ( !["turn", "round"].includes(def.oncePer) ) p.push('oncePer must be "turn" or "round"');
    if ( def.trigger && !TRIGGER_EVENTS.includes(def.trigger) ) p.push("unknown trigger");
    if ( def.trigger === "techniqueUsed" && kindsIn(def.effects).has("grantTechnique") ) p.push("recursive synergy");
    lintCost(def.cost, "cost", p);
    lintEffects(def.effects, "effects", p);
    const kinds = kindsIn(def.effects);
    if ( kinds.has("resourceGain") ) p.push("synergies may not generate Momentum (loop guard)");
    if ( !def.tactic?.en ) p.push("tactic.en (the decision this synergy creates) is required");
  }
};

/* ------------------------------------------------------------------ */
/*  Registry                                                           */
/* ------------------------------------------------------------------ */

export class ContentRegistry {
  constructor() {
    /** @type {Record<string, Map<string, object>>} */
    this.content = Object.fromEntries(CONTENT_TYPES.map(t => [t, new Map()]));
    /** @type {Array<{type: string, id: string, problems: string[]}>} */
    this.rejected = [];
  }

  /**
   * Lint and register a definition.
   * @returns {string[]} problems; empty means registered.
   */
  register(type, def) {
    const problems = ContentRegistry.lint(type, def);
    if ( !problems.length && this.content[type].has(def.id) ) problems.push(`duplicate id "${def.id}"`);
    if ( problems.length ) {
      this.rejected.push({ type, id: def?.id ?? "?", problems });
      return problems;
    }
    this.content[type].set(def.id, Object.freeze(structuredClone(def)));
    return [];
  }

  registerMany(type, defs) {
    return defs.flatMap(d => this.register(type, d).map(msg => `${type}:${d.id}: ${msg}`));
  }

  static lint(type, def) {
    if ( !CONTENT_TYPES.includes(type) ) return [`unknown content type "${type}"`];
    if ( !def || typeof def !== "object" ) return ["definition must be an object"];
    const p = [];
    if ( !ID_RE.test(def.id ?? "") ) p.push("id must be kebab-case, 3-64 chars, starting with a letter");
    lintText(def, p);
    LINTERS[type](def, p);
    return p;
  }

  get(type, id) { return this.content[type]?.get(id) ?? null; }
  all(type) { return [...(this.content[type]?.values() ?? [])]; }
  has(type, id) { return this.content[type]?.has(id) ?? false; }

  /** Remove a definition and anything that later fails cross validation. */
  unregister(type, id) { return this.content[type]?.delete(id) ?? false; }

  /**
   * Cross-reference validation over the whole registry.
   * Removes broken definitions so they can't be used, and returns the problems.
   * @returns {string[]}
   */
  validateAll() {
    const problems = [];
    const check = (type, id, refType, refId, where) => {
      if ( !this.has(refType, refId) ) problems.push(`${type}:${id}: ${where} references missing ${refType} "${refId}"`);
    };
    const checkCond = (type, id, cond, where) => {
      const refs = referencedIds(cond);
      refs.node.forEach(r => check(type, id, "node", r, where));
      refs.technique.forEach(r => check(type, id, "technique", r, where));
      refs.weaponPath.forEach(r => check(type, id, "weaponPath", r, where));
      refs.weave.forEach(r => check(type, id, "weave", r, where));
    };
    const checkGrants = (type, id, effects, where) => (effects ?? [])
      .filter(e => e.kind === "grantTechnique").forEach(e => check(type, id, "technique", e.id, where));

    for ( const n of this.all("node") ) {
      n.links.forEach(l => check("node", n.id, "node", l, "links"));
      n.conflicts.forEach(c => check("node", n.id, "node", c, "conflicts"));
      checkCond("node", n.id, n.prerequisites, "prerequisites");
      checkCond("node", n.id, n.compatibility, "compatibility");
      checkGrants("node", n.id, n.effects, "effects");
      if ( n.conflicts.includes(n.id) ) problems.push(`node:${n.id}: conflicts with itself`);
      for ( const c of n.conflicts ) {
        const other = this.get("node", c);
        if ( other && !other.conflicts.includes(n.id) ) problems.push(`node:${n.id}: conflict with "${c}" is not symmetric`);
      }
    }
    for ( const t of this.all("technique") ) { checkCond("technique", t.id, t.learn, "learn"); checkCond("technique", t.id, t.requires, "requires"); }
    for ( const e of this.all("evolution") ) e.tiers.forEach((t, i) => checkGrants("evolution", e.id, t.effects, `tiers[${i}]`));
    for ( const w of this.all("weaponPath") ) w.ranks.forEach((r, i) => checkGrants("weaponPath", w.id, r.effects, `ranks[${i}]`));
    for ( const s of this.all("synergy") ) {
      const r = s.requires;
      (r.nodes ?? []).forEach(x => check("synergy", s.id, "node", x, "requires.nodes"));
      (r.techniques ?? []).forEach(x => check("synergy", s.id, "technique", x, "requires.techniques"));
      (r.modifiers ?? []).forEach(x => check("synergy", s.id, "modifier", x, "requires.modifiers"));
      (r.weaponPaths ?? []).forEach(x => check("synergy", s.id, "weaponPath", x, "requires.weaponPaths"));
      (r.weaves ?? []).forEach(x => check("synergy", s.id, "weave", x, "requires.weaves"));
      (r.evolutions ?? []).forEach(x => check("synergy", s.id, "evolution", x.path, "requires.evolutions"));
      (r.synergies ?? []).forEach(x => check("synergy", s.id, "synergy", x, "requires.synergies"));
    }

    problems.push(...this.#findCycles("node", n => [...referencedIds(n.prerequisites).node]));
    problems.push(...this.#findCycles("synergy", s => s.requires.synergies ?? []));
    problems.push(...this.#checkGraphReachability());
    problems.push(...this.#checkKeystoneSpread());
    return problems;
  }

  /** Detect cycles in a dependency relation with DFS (white/grey/black). */
  #findCycles(type, depsOf) {
    const state = new Map();
    const problems = [];
    const visit = (id, stack) => {
      state.set(id, 1);
      const def = this.get(type, id);
      for ( const dep of def ? depsOf(def) : [] ) {
        if ( state.get(dep) === 1 ) problems.push(`${type}: circular dependency ${[...stack, id, dep].join(" → ")}`);
        else if ( !state.get(dep) && this.has(type, dep) ) visit(dep, [...stack, id]);
      }
      state.set(id, 2);
    };
    for ( const def of this.all(type) ) if ( !state.get(def.id) ) visit(def.id, []);
    return problems;
  }

  /** Every node must be reachable from a root through links. */
  #checkGraphReachability() {
    const nodes = this.all("node");
    if ( !nodes.length ) return [];
    const roots = nodes.filter(n => n.rules?.root);
    if ( !roots.length ) return ["node: graph has no root nodes (rules.root)"];
    const adj = undirectedAdjacency(nodes);
    const seen = new Set(roots.map(r => r.id));
    const queue = [...seen];
    while ( queue.length ) for ( const next of adj.get(queue.shift()) ?? [] ) if ( !seen.has(next) ) { seen.add(next); queue.push(next); }
    return nodes.filter(n => !seen.has(n.id)).map(n => `node:${n.id}: unreachable from any root`);
  }

  /** Multiple viable paths: no single keystone may be the only one, and each root must reach ≥1 keystone. */
  #checkKeystoneSpread() {
    const keystones = this.all("node").filter(n => n.category === "keystone");
    if ( this.all("node").length && keystones.length < 2 ) return ["node: graph should offer at least two keystones (multiple viable paths)"];
    return [];
  }
}

/** Links are declared one way but traversed both ways. */
export function undirectedAdjacency(nodes) {
  const adj = new Map(nodes.map(n => [n.id, new Set()]));
  for ( const n of nodes ) for ( const l of n.links ) {
    adj.get(n.id)?.add(l);
    adj.get(l)?.add(n.id);
  }
  return adj;
}

export { LIMITS };
