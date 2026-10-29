/**
 * Build state, budgets and build validation.
 *
 * A "build" is the per-actor choice set stored in actor flags:
 *   { version, nodes[], evolutions{classId: {path}}, weaponPaths[], weaves[], loadout[{technique, modifiers[]}] }
 *
 * Everything here is pure: it takes the registry, a context snapshot and the state,
 * and returns derived data or validation results.
 */
import { LIMITS, RESPEC_MODES } from "../constants.js";
import { evaluate } from "./conditions.js";
import { aggregatePassives } from "./effects.js";
import { undirectedAdjacency } from "./registry.js";

export const BUILD_VERSION = 1;
export const MAX_KEYSTONES = 2;

export function emptyBuild() {
  return { version: BUILD_VERSION, nodes: [], evolutions: {}, weaponPaths: [], weaves: [], loadout: [] };
}

/** Normalize anything read from flags into a well-formed build. */
export function normalizeBuild(raw) {
  const b = emptyBuild();
  if ( !raw || typeof raw !== "object" ) return b;
  const ids = v => (Array.isArray(v) ? [...new Set(v.filter(x => typeof x === "string"))] : []);
  b.nodes = ids(raw.nodes);
  b.weaponPaths = ids(raw.weaponPaths);
  b.weaves = ids(raw.weaves);
  for ( const [cls, evo] of Object.entries(raw.evolutions ?? {}) ) if ( typeof evo?.path === "string" ) b.evolutions[cls] = { path: evo.path };
  b.loadout = (Array.isArray(raw.loadout) ? raw.loadout : [])
    .filter(e => typeof e?.technique === "string")
    .map(e => ({ technique: e.technique, modifiers: ids(e.modifiers) }));
  return b;
}

/* ------------------------------------------------------------------ */
/*  Budgets                                                            */
/* ------------------------------------------------------------------ */

export function budgets(ctx, passives = null) {
  const level = Math.max(1, ctx.level ?? 1);
  return {
    points: level + (ctx.bonusPoints ?? 0),
    keystones: MAX_KEYSTONES,
    techniqueSlots: Math.min(LIMITS.techniqueSlotsMax, 2 + Math.floor((level - 1) / 4) + (passives?.techniqueSlots ?? 0)),
    modifierSlots: Math.min(LIMITS.modifierSlotsMax, 1 + (level >= 7 ? 1 : 0) + (passives?.modifierSlots ?? 0)),
    weaponPaths: level >= 11 ? 2 : 1,
    weaves: ctx.spellcaster ? (level >= 12 ? 3 : level >= 6 ? 2 : level >= 2 ? 1 : 0) : 0,
    momentumMax: Math.min(LIMITS.momentumHardMax, (ctx.pb ?? 2) + (passives?.resourceMax ?? 0))
  };
}

/** Evolution tier reached for a class = number of tiers whose classLevel is met. */
export function evolutionTier(def, classLevels) {
  return def.tiers.filter(t => classLevels >= t.classLevel).length;
}

/* ------------------------------------------------------------------ */
/*  Derivation                                                         */
/* ------------------------------------------------------------------ */

/**
 * Produce the derived view of a build: owned sets, active effects with sources,
 * passive totals, budgets and known techniques.
 */
export function deriveBuild(registry, ctx, rawState) {
  const state = normalizeBuild(rawState);
  const sources = []; // { effect, source, sourceType }
  const push = (effects, source, sourceType) => (effects ?? []).forEach(effect => sources.push({ effect, source, sourceType }));

  for ( const id of state.nodes ) push(registry.get("node", id)?.effects, id, "node");

  const evolutions = {};
  for ( const [cls, { path }] of Object.entries(state.evolutions) ) {
    const def = registry.get("evolution", path);
    if ( !def || def.class !== cls ) continue;
    const tier = evolutionTier(def, ctx.classes?.[cls]?.levels ?? 0);
    evolutions[cls] = { path, tier };
    def.tiers.slice(0, tier).forEach(t => push(t.effects, `${path}#${t.tier}`, "evolution"));
  }

  const weaponPathRanks = {};
  for ( const id of state.weaponPaths ) {
    const def = registry.get("weaponPath", id);
    if ( !def ) continue;
    const ranks = def.ranks.filter(r => (ctx.level ?? 0) >= r.level);
    weaponPathRanks[id] = ranks.length;
    ranks.forEach(r => push(r.effects, `${id}#${r.rank}`, "weaponPath"));
  }

  const passives = aggregatePassives(sources.filter(s => !s.effect.when), ctx.pb ?? 2);
  const known = new Set(passives.granted);
  // Techniques with no grant requirement are learnable directly if their learn condition passes.
  const buildView = {
    nodes: new Set(state.nodes), techniques: known, weaponPaths: new Set(state.weaponPaths),
    weaves: new Set(state.weaves), evolutions
  };
  const fullCtx = { ...ctx, build: buildView };
  for ( const t of registry.all("technique") ) {
    if ( t.learn && !t.grantOnly && evaluate(t.learn, fullCtx).ok ) known.add(t.id);
  }

  return {
    state, sources, passives, evolutions, weaponPathRanks,
    known, ctx: fullCtx,
    budgets: budgets(ctx, passives),
    pointsSpent: state.nodes.reduce((sum, id) => sum + (registry.get("node", id)?.cost ?? 0), 0)
  };
}

/* ------------------------------------------------------------------ */
/*  Node allocation & respec                                           */
/* ------------------------------------------------------------------ */

const err = (code, data = {}, message = code) => ({ code, data, message });

/**
 * Can this node be allocated onto the current build?
 * @returns {{ok: boolean, errors: object[]}}
 */
export function canAllocateNode(registry, ctx, rawState, id) {
  const node = registry.get("node", id);
  if ( !node ) return { ok: false, errors: [err("unknownNode", { id }, `Unknown node ${id}`)] };
  const d = deriveBuild(registry, ctx, rawState);
  const owned = new Set(d.state.nodes);
  const errors = [];
  if ( owned.has(id) ) errors.push(err("alreadyOwned", { id }, "Already allocated"));
  if ( d.pointsSpent + node.cost > d.budgets.points ) {
    errors.push(err("notEnoughPoints", { need: node.cost, left: d.budgets.points - d.pointsSpent }, "Not enough Constellation points"));
  }
  const adj = undirectedAdjacency(registry.all("node"));
  if ( !node.rules.root && ![...(adj.get(id) ?? [])].some(n => owned.has(n)) ) {
    errors.push(err("notAdjacent", { id }, "Must connect to an allocated node or a root"));
  }
  const pre = evaluate(node.prerequisites, d.ctx);
  if ( !pre.ok ) errors.push(err("prerequisites", { failed: pre.failed }, "Prerequisites not met"));
  const elig = evaluate(node.eligibility, d.ctx);
  if ( !elig.ok ) errors.push(err("eligibility", { failed: elig.failed }, "Character is not eligible"));
  const compat = evaluate(node.compatibility, d.ctx);
  if ( !compat.ok ) errors.push(err("compatibility", { failed: compat.failed }, "Incompatible with current build"));
  const conflicts = node.conflicts.filter(c => owned.has(c));
  if ( conflicts.length ) errors.push(err("conflicts", { ids: conflicts }, `Conflicts with ${conflicts.join(", ")}`));
  if ( node.rules.exclusiveGroup ) {
    const clash = d.state.nodes.find(n => registry.get("node", n)?.rules?.exclusiveGroup === node.rules.exclusiveGroup);
    if ( clash ) errors.push(err("exclusiveGroup", { group: node.rules.exclusiveGroup, id: clash }, `Only one node from group ${node.rules.exclusiveGroup}`));
  }
  if ( node.category === "keystone" ) {
    const count = d.state.nodes.filter(n => registry.get("node", n)?.category === "keystone").length;
    if ( count >= d.budgets.keystones ) errors.push(err("keystoneLimit", { max: d.budgets.keystones }, "Keystone limit reached"));
  }
  if ( node.rules.minLevel && (ctx.level ?? 0) < node.rules.minLevel ) {
    errors.push(err("minLevel", { level: node.rules.minLevel }, `Requires character level ${node.rules.minLevel}`));
  }
  return { ok: !errors.length, errors };
}

/**
 * Can this node be refunded?
 * @param {object} opts
 * @param {boolean} [opts.resting]   During a long rest.
 * @param {boolean} [opts.inCombat]
 * @param {boolean} [opts.gm]        GM override (permits "locked").
 */
export function canRefundNode(registry, ctx, rawState, id, { resting = false, inCombat = false, gm = false } = {}) {
  const node = registry.get("node", id);
  const state = normalizeBuild(rawState);
  const errors = [];
  if ( !state.nodes.includes(id) ) return { ok: false, errors: [err("notOwned", { id }, "Not allocated")] };
  if ( inCombat && !gm ) errors.push(err("inCombat", {}, "Cannot respec during combat"));
  if ( node ) {
    if ( node.respec === RESPEC_MODES.rest && !resting && !gm ) errors.push(err("respecRest", {}, "Can only be refunded during a long rest"));
    if ( node.respec === RESPEC_MODES.locked && !gm ) errors.push(err("respecLocked", {}, "Locked: requires a GM rebuild"));
  }
  const remaining = state.nodes.filter(n => n !== id);
  // Connectivity: every remaining node must still reach a root.
  const orphans = findOrphans(registry, remaining);
  if ( orphans.length ) errors.push(err("orphans", { ids: orphans }, `Would disconnect ${orphans.join(", ")}`));
  // Dependents: remaining nodes whose prerequisites need this node.
  const after = deriveBuild(registry, ctx, { ...state, nodes: remaining });
  const dependents = remaining.filter(n => {
    const def = registry.get("node", n);
    return def && !evaluate(def.prerequisites, after.ctx).ok;
  });
  if ( dependents.length ) errors.push(err("dependents", { ids: dependents }, `Required by ${dependents.join(", ")}`));
  return { ok: !errors.length, errors };
}

export function findOrphans(registry, ownedIds) {
  const owned = new Set(ownedIds);
  const adj = undirectedAdjacency(registry.all("node"));
  const roots = ownedIds.filter(id => registry.get("node", id)?.rules?.root);
  const seen = new Set(roots);
  const queue = [...roots];
  while ( queue.length ) {
    for ( const next of adj.get(queue.shift()) ?? [] ) if ( owned.has(next) && !seen.has(next) ) { seen.add(next); queue.push(next); }
  }
  return ownedIds.filter(id => !seen.has(id));
}

/* ------------------------------------------------------------------ */
/*  Techniques & modifiers                                             */
/* ------------------------------------------------------------------ */

/** Is a modifier compatible with a technique (tags, kinds, actions)? */
export function modifierCompatible(mod, tech) {
  const tags = new Set(tech.tags);
  const c = mod.compat;
  if ( !c.anyTags.some(t => tags.has(t)) ) return { ok: false, reason: "tags" };
  if ( (c.allTags ?? []).some(t => !tags.has(t)) ) return { ok: false, reason: "tags" };
  if ( (c.excludeTags ?? []).some(t => tags.has(t)) ) return { ok: false, reason: "excluded" };
  if ( c.kinds && !c.kinds.includes(tech.kind) ) return { ok: false, reason: "kind" };
  if ( c.actions && !c.actions.includes(tech.action) ) return { ok: false, reason: "action" };
  if ( c.deliveries && !c.deliveries.includes(tech.delivery) ) return { ok: false, reason: "delivery" };
  return { ok: true };
}

/**
 * Compute a technique's effective profile after modifiers: cost, trigger, effects.
 * Applies the anti-loop and anti-stacking rules.
 */
export function effectiveTechnique(registry, entry) {
  const tech = registry.get("technique", entry.technique);
  if ( !tech ) return null;
  const mods = entry.modifiers.map(id => registry.get("modifier", id)).filter(Boolean);
  const baseMomentum = tech.cost.momentum ?? 0;
  let momentum = baseMomentum + mods.reduce((s, m) => s + (m.cost.momentum ?? 0), 0);
  const costDeltas = mods.flatMap(m => m.effects.filter(e => e.kind === "costDelta"));
  momentum += costDeltas.reduce((s, e) => s + e.value, 0);
  // A technique that cost something can never be made free by modifiers.
  momentum = Math.max(baseMomentum > 0 ? 1 : 0, momentum);
  const overrides = mods.flatMap(m => m.effects.filter(e => e.kind === "triggerOverride"));
  const trigger = overrides.length ? overrides[0].to : tech.trigger ?? null;
  const effects = [
    ...tech.effects.map(e => ({ effect: e, source: tech.id, sourceType: "technique" })),
    ...mods.flatMap(m => m.effects.filter(e => !["costDelta", "triggerOverride"].includes(e.kind))
      .map(e => ({ effect: e, source: m.id, sourceType: "modifier" })))
  ];
  const usesFrom = [tech.cost.uses, ...mods.map(m => m.cost.uses)].filter(Boolean);
  return {
    technique: tech, modifiers: mods, momentum, trigger, effects,
    uses: usesFrom.length ? usesFrom.reduce((a, b) => (a.max <= b.max ? a : b)) : null,
    tags: new Set([...tech.tags, ...mods.flatMap(m => m.addTags ?? [])])
  };
}

/** Validate one loadout entry against the derived build. */
export function validateLoadoutEntry(registry, derived, entry, index = 0) {
  const errors = [];
  const tech = registry.get("technique", entry.technique);
  if ( !tech ) return [err("unknownTechnique", { id: entry.technique }, `Unknown technique ${entry.technique}`)];
  if ( !derived.known.has(tech.id) ) errors.push(err("techniqueUnknown", { id: tech.id }, `${tech.id} is not learned`));
  let slots = 0;
  const groups = new Map();
  const overrides = [];
  for ( const id of entry.modifiers ) {
    const mod = registry.get("modifier", id);
    if ( !mod ) { errors.push(err("unknownModifier", { id }, `Unknown modifier ${id}`)); continue; }
    slots += mod.slotCost;
    const compat = modifierCompatible(mod, tech);
    if ( !compat.ok ) errors.push(err("modifierIncompatible", { id, technique: tech.id, reason: compat.reason }, `${id} cannot attach to ${tech.id}`));
    if ( groups.has(mod.exclusiveGroup) ) errors.push(err("modifierGroup", { id, other: groups.get(mod.exclusiveGroup) }, `${id} shares a group with ${groups.get(mod.exclusiveGroup)}`));
    groups.set(mod.exclusiveGroup, id);
    if ( mod.learn && !evaluate(mod.learn, derived.ctx).ok ) errors.push(err("modifierLocked", { id }, `${id} requirements not met`));
    overrides.push(...mod.effects.filter(e => e.kind === "triggerOverride"));
  }
  if ( slots > derived.budgets.modifierSlots ) errors.push(err("modifierSlots", { used: slots, max: derived.budgets.modifierSlots }, "Too many modifier slots used"));
  if ( overrides.length > 1 ) errors.push(err("multipleTriggerOverrides", {}, "Only one trigger override per technique"));
  if ( overrides.length && tech.kind !== "reaction" ) errors.push(err("overrideNonReaction", {}, "Trigger overrides only apply to reactions"));
  const eff = effectiveTechnique(registry, entry);
  if ( eff ) {
    // Loop guard: a technique can never pay for itself. Momentum generated by its modifiers
    // must be strictly less than what the technique costs to use.
    const gains = eff.effects.filter(e => e.effect.kind === "resourceGain").length;
    if ( gains && gains >= eff.momentum ) errors.push(err("momentumLoop", { gain: gains, cost: eff.momentum }, "Modifiers would make this technique generate as much Momentum as it costs"));
    const riders = eff.effects.filter(e => e.effect.kind === "riderDie").length;
    if ( riders > 1 ) errors.push(err("riderStack", { count: riders }, "Only one rider die may be attached to a technique"));
    const secondaries = eff.effects.filter(e => e.effect.kind === "secondary").length;
    if ( secondaries > 2 ) errors.push(err("secondaryStack", { count: secondaries }, "At most two secondary effects per technique (one applies per hit)"));
  }
  return errors.map(e => ({ ...e, data: { ...e.data, index } }));
}

/* ------------------------------------------------------------------ */
/*  Whole-build validation                                             */
/* ------------------------------------------------------------------ */

export function validateBuild(registry, ctx, rawState) {
  const d = deriveBuild(registry, ctx, rawState);
  const errors = [];
  const warnings = [...d.passives.clipped.map(c => err("clipped", { key: c }, `${c} exceeded its cap and was clipped`))];
  const s = d.state;

  // Constellation
  if ( d.pointsSpent > d.budgets.points ) errors.push(err("overspent", { spent: d.pointsSpent, max: d.budgets.points }, "Constellation points overspent"));
  for ( const id of s.nodes ) {
    const node = registry.get("node", id);
    if ( !node ) { errors.push(err("unknownNode", { id }, `Unknown node ${id}`)); continue; }
    const conflicts = node.conflicts.filter(c => s.nodes.includes(c));
    if ( conflicts.length ) errors.push(err("conflicts", { id, ids: conflicts }, `${id} conflicts with ${conflicts.join(", ")}`));
    for ( const key of ["prerequisites", "eligibility", "compatibility"] ) {
      const r = evaluate(node[key], d.ctx);
      if ( !r.ok ) errors.push(err(key, { id, failed: r.failed }, `${id}: ${key} not met`));
    }
  }
  const orphans = findOrphans(registry, s.nodes.filter(id => registry.has("node", id)));
  if ( orphans.length ) errors.push(err("orphans", { ids: orphans }, `Disconnected nodes: ${orphans.join(", ")}`));
  const keystones = s.nodes.filter(id => registry.get("node", id)?.category === "keystone");
  if ( keystones.length > d.budgets.keystones ) errors.push(err("keystoneLimit", { max: d.budgets.keystones }, "Too many keystones"));

  // Evolutions
  for ( const [cls, { path }] of Object.entries(s.evolutions) ) {
    const def = registry.get("evolution", path);
    if ( !def ) { errors.push(err("unknownEvolution", { id: path }, `Unknown evolution ${path}`)); continue; }
    if ( def.class !== cls ) errors.push(err("evolutionClass", { id: path, cls }, `${path} is not a ${cls} path`));
    if ( !d.ctx.classes?.[cls] ) errors.push(err("evolutionNoClass", { cls }, `No levels in ${cls}`));
    const learn = evaluate(def.learn, d.ctx);
    if ( !learn.ok ) errors.push(err("evolutionLocked", { id: path, failed: learn.failed }, `${path} requirements not met`));
  }

  // Weapon paths
  if ( s.weaponPaths.length > d.budgets.weaponPaths ) errors.push(err("weaponPathLimit", { max: d.budgets.weaponPaths }, "Too many weapon paths"));
  for ( const id of s.weaponPaths ) {
    const def = registry.get("weaponPath", id);
    if ( !def ) { errors.push(err("unknownWeaponPath", { id }, `Unknown weapon path ${id}`)); continue; }
    const r = evaluate(def.learn, d.ctx);
    if ( !r.ok ) errors.push(err("weaponPathLocked", { id, failed: r.failed }, `${id} requirements not met`));
  }

  // Weaves
  if ( s.weaves.length > d.budgets.weaves ) errors.push(err("weaveLimit", { max: d.budgets.weaves }, "Too many weaves"));
  for ( const id of s.weaves ) {
    const def = registry.get("weave", id);
    if ( !def ) { errors.push(err("unknownWeave", { id }, `Unknown weave ${id}`)); continue; }
    const r = evaluate(def.learn, d.ctx);
    if ( !r.ok ) errors.push(err("weaveLocked", { id, failed: r.failed }, `${id} requirements not met`));
  }

  // Loadout
  if ( s.loadout.length > d.budgets.techniqueSlots ) errors.push(err("techniqueSlots", { max: d.budgets.techniqueSlots }, "Too many techniques equipped"));
  const seen = new Set();
  s.loadout.forEach((entry, i) => {
    if ( seen.has(entry.technique) ) errors.push(err("duplicateTechnique", { id: entry.technique }, `${entry.technique} equipped twice`));
    seen.add(entry.technique);
    errors.push(...validateLoadoutEntry(registry, d, entry, i));
  });
  const perLoadout = new Map();
  for ( const entry of s.loadout ) for ( const m of entry.modifiers ) perLoadout.set(m, (perLoadout.get(m) ?? 0) + 1);
  for ( const [id, count] of perLoadout ) {
    const max = registry.get("modifier", id)?.limits?.maxPerLoadout;
    if ( max && count > max ) errors.push(err("modifierPerLoadout", { id, max }, `${id} may be used ${max}× per loadout`));
  }

  return { ok: !errors.length, errors, warnings, derived: d };
}

/* ------------------------------------------------------------------ */
/*  Synergies                                                          */
/* ------------------------------------------------------------------ */

/** Synergies whose requirements the build satisfies, ordered by priority (high first). */
export function activeSynergies(registry, derived) {
  const s = derived.state;
  const equippedTech = new Set(s.loadout.map(e => e.technique));
  const equippedMods = new Set(s.loadout.flatMap(e => e.modifiers));
  const active = new Set();
  const satisfies = syn => {
    const r = syn.requires;
    return (r.nodes ?? []).every(id => s.nodes.includes(id))
      && (r.techniques ?? []).every(id => equippedTech.has(id))
      && (r.modifiers ?? []).every(id => equippedMods.has(id))
      && (r.weaponPaths ?? []).every(id => s.weaponPaths.includes(id))
      && (r.weaves ?? []).every(id => s.weaves.includes(id))
      && (r.evolutions ?? []).every(e => derived.evolutions[e.class]?.path === e.path && derived.evolutions[e.class].tier >= (e.tier ?? 1))
      && (r.synergies ?? []).every(id => active.has(id));
  };
  // Iterate to a fixed point in dependency order; cycles were rejected by the registry.
  let changed = true;
  while ( changed ) {
    changed = false;
    for ( const syn of registry.all("synergy") ) {
      if ( !active.has(syn.id) && satisfies(syn) ) { active.add(syn.id); changed = true; }
    }
  }
  return [...active].map(id => registry.get("synergy", id)).sort((a, b) => b.priority - a.priority);
}
