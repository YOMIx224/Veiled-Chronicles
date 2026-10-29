/**
 * Condition DSL.
 *
 * Content (nodes, techniques, modifiers, evolutions, weaves, synergies) declares its
 * prerequisites and eligibility as plain objects. Every key in a condition object is
 * AND-ed; `any`, `all` and `not` compose. The evaluator works on a plain "build context"
 * snapshot (see build-context.js) so it runs identically in Foundry and in tests.
 *
 * Unknown keys are a validation error (see KNOWN_KEYS) rather than silently passing.
 */

const asArray = v => (Array.isArray(v) ? v : [v]);
const inRange = (n, { min = -Infinity, max = Infinity } = {}) => n >= min && n <= max;
const has = (set, v) => (set instanceof Set ? set.has(v) : Array.isArray(set) ? set.includes(v) : false);

/** Each tester returns true/false. `fail` lists a reason code with arguments for the UI. */
const TESTERS = {
  all: (v, ctx) => v.every(c => evaluate(c, ctx).ok),
  any: (v, ctx) => v.some(c => evaluate(c, ctx).ok),
  not: (v, ctx) => !evaluate(v, ctx).ok,

  level: (v, ctx) => inRange(ctx.level ?? 0, v),
  classLevel: (v, ctx) => inRange(ctx.classes?.[v.class]?.levels ?? 0, { min: v.min ?? 1, max: v.max }),
  subclass: (v, ctx) => ctx.classes?.[v.class]?.subclass === v.id,
  noSubclass: (v, ctx) => asArray(v.ids).every(id => ctx.classes?.[v.class]?.subclass !== id),
  ability: (v, ctx) => (ctx.abilities?.[v.key] ?? 0) >= v.min,
  feature: (v, ctx) => asArray(v).some(f => has(ctx.features, f)),
  spellcaster: (v, ctx) => !!ctx.spellcaster === !!v,

  node: (v, ctx) => asArray(v).every(id => has(ctx.build?.nodes, id)),
  anyNode: (v, ctx) => asArray(v).some(id => has(ctx.build?.nodes, id)),
  technique: (v, ctx) => asArray(v).every(id => has(ctx.build?.techniques, id)),
  weaponPath: (v, ctx) => asArray(v).some(id => has(ctx.build?.weaponPaths, id)),
  weave: (v, ctx) => asArray(v).some(id => has(ctx.build?.weaves, id)),
  evolution: (v, ctx) => {
    const evo = ctx.build?.evolutions?.[v.class];
    return !!evo && (!v.path || evo.path === v.path) && (evo.tier ?? 0) >= (v.tier ?? 1);
  },

  weaponProficiency: (v, ctx) => asArray(v).some(p => has(ctx.proficiencies?.weapons, p)),
  armorProficiency: (v, ctx) => asArray(v).some(p => has(ctx.proficiencies?.armor, p)),
  hasMastery: (v, ctx) => asArray(v).some(m => has(ctx.proficiencies?.masteryProperties, m)),

  // ---- use-time conditions (need a weapon / spell / state in context) ----
  weapon: (v, ctx) => !!ctx.weapon === !!v,
  weaponProperty: (v, ctx) => asArray(v).some(p => has(ctx.weapon?.properties, p)),
  weaponAllProperties: (v, ctx) => asArray(v).every(p => has(ctx.weapon?.properties, p)),
  weaponCategory: (v, ctx) => asArray(v).includes(ctx.weapon?.category),
  weaponRange: (v, ctx) => ctx.weapon?.range === v,
  weaponMastery: (v, ctx) => (v === true ? !!ctx.weapon?.masteryAvailable : asArray(v).includes(ctx.weapon?.mastery)),
  shield: (v, ctx) => !!ctx.state?.shield === !!v,
  armor: (v, ctx) => asArray(v).includes(ctx.state?.armor ?? "none"),

  spell: (v, ctx) => !!ctx.spell === !!v,
  spellLevel: (v, ctx) => !!ctx.spell && inRange(ctx.spell.level, v),
  spellSchool: (v, ctx) => !!ctx.spell && asArray(v).includes(ctx.spell.school),
  spellDamageType: (v, ctx) => !!ctx.spell && asArray(v).some(t => has(ctx.spell.damageTypes, t)),
  spellConcentration: (v, ctx) => !!ctx.spell && !!ctx.spell.concentration === !!v,
  spellActivity: (v, ctx) => !!ctx.spell && asArray(v).includes(ctx.spell.activityType),
  spellTarget: (v, ctx) => !!ctx.spell && asArray(v).includes(ctx.spell.targetShape),

  inCombat: (v, ctx) => !!ctx.state?.inCombat === !!v,
  bloodied: (v, ctx) => !!ctx.state?.bloodied === !!v,
  momentum: (v, ctx) => inRange(ctx.state?.momentum ?? 0, v),
  actionAvailable: (v, ctx) => asArray(v).every(a => ctx.state?.economy?.[a] !== false),
  concentrating: (v, ctx) => !!ctx.state?.concentrating === !!v,
  usingTechnique: (v, ctx) => asArray(v).includes(ctx.use?.technique),
  usingWeave: (v, ctx) => asArray(v).includes(ctx.use?.weave)
};

export const KNOWN_KEYS = Object.freeze(Object.keys(TESTERS));

/**
 * Evaluate a condition against a context.
 * @param {object|null|undefined} cond
 * @param {object} ctx
 * @returns {{ok: boolean, failed: Array<{key: string, value: *}>}}
 */
export function evaluate(cond, ctx) {
  if ( !cond ) return { ok: true, failed: [] };
  const failed = [];
  for ( const [key, value] of Object.entries(cond) ) {
    const test = TESTERS[key];
    if ( !test ) { failed.push({ key: "unknown", value: key }); continue; }
    if ( !test(value, ctx) ) failed.push({ key, value });
  }
  return { ok: failed.length === 0, failed };
}

/**
 * Structural check used by content validation: every key known, composites well-formed.
 * @returns {string[]} problems
 */
export function lintCondition(cond, path = "condition") {
  if ( cond == null ) return [];
  if ( typeof cond !== "object" || Array.isArray(cond) ) return [`${path}: must be an object`];
  const problems = [];
  for ( const [key, value] of Object.entries(cond) ) {
    if ( !TESTERS[key] ) problems.push(`${path}: unknown condition key "${key}"`);
    else if ( (key === "all" || key === "any") ) {
      if ( !Array.isArray(value) ) problems.push(`${path}.${key}: must be an array`);
      else value.forEach((c, i) => problems.push(...lintCondition(c, `${path}.${key}[${i}]`)));
    }
    else if ( key === "not" ) problems.push(...lintCondition(value, `${path}.not`));
  }
  return problems;
}

/** Collect ids this condition references, for dependency-graph checks. */
export function referencedIds(cond, out = { node: new Set(), technique: new Set(), weaponPath: new Set(), weave: new Set() }) {
  if ( !cond || typeof cond !== "object" ) return out;
  for ( const [key, value] of Object.entries(cond) ) {
    if ( key === "all" || key === "any" ) value.forEach(c => referencedIds(c, out));
    else if ( key === "not" ) continue; // negative references never create a dependency
    else if ( key === "node" || key === "anyNode" ) asArray(value).forEach(id => out.node.add(id));
    else if ( key === "technique" ) asArray(value).forEach(id => out.technique.add(id));
    else if ( key === "weaponPath" ) asArray(value).forEach(id => out.weaponPath.add(id));
    else if ( key === "weave" ) asArray(value).forEach(id => out.weave.add(id));
  }
  return out;
}
