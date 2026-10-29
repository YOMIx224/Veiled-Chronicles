/**
 * Effect vocabulary: structural validation and passive aggregation.
 *
 * Effects are the only way content changes the game. The vocabulary is closed
 * (constants.EFFECT_KINDS) and has no multiplier kind, so no combination of
 * content can multiply damage or action economy.
 */
import { EFFECT_KINDS, LIMITS, RIDER_CONDITIONS, STAT_KEYS, TRIGGER_EVENTS } from "../constants.js";
import { lintCondition } from "./conditions.js";

const DICE_RE = /^(\d)d(4|6|8|10|12)$/;
/** Largest rider die allowed, measured as average roll. 1d8 / 2d4 = 4.5 / 5. */
const RIDER_MAX_AVG = 5;
export const SECONDARY_TYPES = ["condition", "push", "slow", "shift", "tempHp", "guard", "mark", "advantageAlly", "disadvantageTarget"];
const SECONDARY_TARGETS = ["target", "self", "ally"];
const SAVE_ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

export function diceAverage(formula) {
  const m = DICE_RE.exec(formula ?? "");
  if ( !m ) return NaN;
  return Number(m[1]) * (Number(m[2]) + 1) / 2;
}

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/**
 * Validate one effect definition.
 * @param {object} effect
 * @param {string} path
 * @returns {string[]} problems
 */
export function lintEffect(effect, path = "effect") {
  const p = [];
  if ( !effect || typeof effect !== "object" ) return [`${path}: must be an object`];
  const spec = EFFECT_KINDS[effect.kind];
  if ( !spec ) return [`${path}: unknown effect kind "${effect.kind}"`];
  if ( effect.when ) p.push(...lintCondition(effect.when, `${path}.when`));

  switch ( effect.kind ) {
    case "attackBonus":
      if ( !isInt(effect.value, 1, LIMITS.attackBonusCap) ) p.push(`${path}: attackBonus must be 1..${LIMITS.attackBonusCap}`);
      break;
    case "attackPenalty":
      if ( !isInt(effect.value, 1, 5) ) p.push(`${path}: attackPenalty must be 1..5`);
      break;
    case "damageBonus":
      if ( !(isInt(effect.value, 1, 4) || ["pb", "halfpb"].includes(effect.value)) ) {
        p.push(`${path}: damageBonus must be 1..4, "pb" or "halfpb"`);
      }
      break;
    case "damagePenalty":
      if ( !(isInt(effect.value, 1, 10) || effect.value === "ability" || DICE_RE.test(effect.value ?? "")) ) {
        p.push(`${path}: damagePenalty must be 1..10, a die like "1d6", or "ability"`);
      }
      break;
    case "riderDie":
      if ( !(diceAverage(effect.dice) <= RIDER_MAX_AVG) ) p.push(`${path}: riderDie must be a single term no larger than 1d8/2d4`);
      break;
    case "damageTypeSwap":
      if ( !Array.isArray(effect.from) || !effect.from.length || typeof effect.to !== "string" ) {
        p.push(`${path}: damageTypeSwap needs from[] and to`);
      }
      else if ( effect.from.includes(effect.to) ) p.push(`${path}: damageTypeSwap cannot map a type to itself`);
      break;
    case "secondary":
      if ( !SECONDARY_TYPES.includes(effect.type) ) p.push(`${path}: secondary.type must be one of ${SECONDARY_TYPES.join(", ")}`);
      if ( effect.type === "condition" && !RIDER_CONDITIONS.includes(effect.condition) ) p.push(`${path}: unknown condition "${effect.condition}"`);
      if ( effect.save && !SAVE_ABILITIES.includes(effect.save) ) p.push(`${path}: save must be an ability key`);
      if ( effect.type === "push" && !isInt(effect.feet, 5, 15) ) p.push(`${path}: push feet must be 5..15`);
      if ( effect.type === "slow" && !isInt(effect.feet, 5, 15) ) p.push(`${path}: slow feet must be 5..15`);
      if ( effect.type === "shift" && !isInt(effect.feet, 5, 15) ) p.push(`${path}: shift feet must be 5..15`);
      if ( effect.type === "guard" && !isInt(effect.value, 1, 2) ) p.push(`${path}: guard value must be 1..2`);
      if ( effect.target && !SECONDARY_TARGETS.includes(effect.target) ) p.push(`${path}: target must be ${SECONDARY_TARGETS.join(" | ")}`);
      if ( effect.type === "tempHp" && !(isInt(effect.value, 1, 10) || ["pb", "halfpb"].includes(effect.value)) ) p.push(`${path}: tempHp value invalid`);
      if ( effect.type === "condition" && ["incapacitated"].includes(effect.condition) && !effect.save ) {
        p.push(`${path}: incapacitating riders must allow a save`);
      }
      break;
    case "stat":
      if ( !(effect.key in STAT_KEYS) ) p.push(`${path}: unknown stat "${effect.key}"`);
      else if ( !isInt(effect.value, 1, LIMITS.statCaps[effect.key]) ) p.push(`${path}: stat ${effect.key} must be 1..${LIMITS.statCaps[effect.key]}`);
      break;
    case "resourceMax":
      if ( !isInt(effect.value, 1, 2) ) p.push(`${path}: resourceMax must be 1..2`);
      break;
    case "resourceGain":
      if ( !TRIGGER_EVENTS.includes(effect.on) ) p.push(`${path}: unknown trigger "${effect.on}"`);
      if ( !isInt(effect.value, 1, 1) ) p.push(`${path}: resourceGain is always exactly 1 per trigger`);
      if ( !["turn", "round"].includes(effect.oncePer) ) p.push(`${path}: resourceGain needs oncePer "turn" or "round"`);
      break;
    case "techniqueSlot":
    case "modifierSlot":
      if ( !isInt(effect.value, 1, 1) ) p.push(`${path}: ${effect.kind} grants exactly 1`);
      break;
    case "grantTechnique":
      if ( typeof effect.id !== "string" ) p.push(`${path}: grantTechnique needs id`);
      break;
    case "rangeDelta":
      if ( !isInt(effect.feet, 5, LIMITS.rangeDeltaMax) || effect.feet % 5 ) p.push(`${path}: rangeDelta feet must be a multiple of 5 up to ${LIMITS.rangeDeltaMax}`);
      break;
    case "areaDelta":
      if ( !isInt(Math.abs(effect.feet ?? 0), 5, LIMITS.areaDeltaMax) || effect.feet % 5 ) p.push(`${path}: areaDelta feet must be ±5..${LIMITS.areaDeltaMax}`);
      break;
    case "targetDelta":
      if ( !isInt(effect.value, 1, LIMITS.targetDeltaMax) ) p.push(`${path}: targetDelta must be 1..${LIMITS.targetDeltaMax}`);
      break;
    case "triggerOverride":
      if ( !TRIGGER_EVENTS.includes(effect.to) ) p.push(`${path}: triggerOverride.to must be a trigger event`);
      if ( effect.to === "techniqueUsed" ) p.push(`${path}: a technique cannot be retargeted to fire from other techniques (recursion)`);
      break;
    case "costDelta":
      if ( !isInt(effect.value, -1, 2) || effect.value === 0 ) p.push(`${path}: costDelta must be -1, +1 or +2`);
      break;
    case "note":
      if ( !effect.text ) p.push(`${path}: note needs text`);
      break;
  }
  return p;
}

/**
 * Resolve a symbolic value ("pb", "halfpb") against proficiency bonus.
 */
export function resolveValue(value, pb) {
  if ( value === "pb" ) return pb;
  if ( value === "halfpb" ) return Math.max(1, Math.floor(pb / 2));
  return value;
}

/**
 * Aggregate passive (always-on) effects into totals with caps applied.
 * @param {Array<{effect: object, source: string}>} entries
 * @param {number} pb
 * @returns {{stats: Record<string, number>, resourceMax: number, techniqueSlots: number,
 *            modifierSlots: number, granted: Set<string>, clipped: string[]}}
 */
export function aggregatePassives(entries, pb) {
  const out = { stats: {}, resourceMax: 0, techniqueSlots: 0, modifierSlots: 0, granted: new Set(), clipped: [] };
  for ( const { effect } of entries ) {
    switch ( effect.kind ) {
      case "stat": out.stats[effect.key] = (out.stats[effect.key] ?? 0) + resolveValue(effect.value, pb); break;
      case "resourceMax": out.resourceMax += effect.value; break;
      case "techniqueSlot": out.techniqueSlots += effect.value; break;
      case "modifierSlot": out.modifierSlots += effect.value; break;
      case "grantTechnique": out.granted.add(effect.id); break;
    }
  }
  for ( const [key, total] of Object.entries(out.stats) ) {
    const cap = LIMITS.statCaps[key];
    if ( total > cap ) { out.stats[key] = cap; out.clipped.push(`stat.${key}`); }
  }
  if ( out.resourceMax > 3 ) { out.resourceMax = 3; out.clipped.push("resourceMax"); }
  if ( out.techniqueSlots > 3 ) { out.techniqueSlots = 3; out.clipped.push("techniqueSlots"); }
  if ( out.modifierSlots > 1 ) { out.modifierSlots = 1; out.clipped.push("modifierSlots"); }
  return out;
}
