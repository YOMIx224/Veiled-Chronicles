/**
 * Shared constants for Ascendant Forge.
 * Everything here is pure data so the engine can be tested outside Foundry.
 */

export const MODULE_ID = "ascendant-forge";

/** Node categories in the Ascendant Constellation. */
export const NODE_CATEGORIES = Object.freeze(["attribute", "mechanic", "specialization", "keystone", "synergy"]);

/** Respec behaviours a node may declare. */
export const RESPEC_MODES = Object.freeze({
  free: "free",          // refund freely at any time out of combat
  rest: "rest",          // refundable only during a long rest
  locked: "locked"       // only a full rebuild (GM-approved) can remove it
});

/** Specialization themes used by Class Evolution, techniques and synergies. */
export const THEMES = Object.freeze([
  "offense", "defense", "control", "mobility", "leadership", "support", "resource", "reactive"
]);

/** dnd5e action economy slots techniques can require. */
export const ACTION_TYPES = Object.freeze(["action", "bonus", "reaction", "free", "attackReplace"]);

/**
 * Closed effect vocabulary. Anything not listed here is rejected by validation,
 * which is what keeps content from smuggling in multipliers or loops.
 *  - channel: which resolution stage consumes the effect
 *  - stack:   "sum" (summed, then capped) | "highest" (only the best one applies) | "unique" (one per source id)
 */
export const EFFECT_KINDS = Object.freeze({
  attackBonus:     { channel: "attack",    stack: "sum" },
  attackPenalty:   { channel: "attack",    stack: "sum" },
  damageBonus:     { channel: "damage",    stack: "sum" },
  damagePenalty:   { channel: "damage",    stack: "sum" },
  riderDie:        { channel: "damage",    stack: "highest" },
  damageTypeSwap:  { channel: "damage",    stack: "highest" },
  secondary:       { channel: "secondary", stack: "highest" },
  stat:            { channel: "passive",   stack: "sum" },
  resourceMax:     { channel: "passive",   stack: "sum" },
  resourceGain:    { channel: "resource",  stack: "unique" },
  techniqueSlot:   { channel: "passive",   stack: "sum" },
  modifierSlot:    { channel: "passive",   stack: "sum" },
  grantTechnique:  { channel: "passive",   stack: "unique" },
  rangeDelta:      { channel: "shape",     stack: "highest" },
  areaDelta:       { channel: "shape",     stack: "highest" },
  targetDelta:     { channel: "shape",     stack: "highest" },
  triggerOverride: { channel: "trigger",   stack: "highest" },
  costDelta:       { channel: "cost",      stack: "sum" },
  note:            { channel: "info",      stack: "unique" }
});

/** Passive stats that map onto native dnd5e ActiveEffect keys. */
export const STAT_KEYS = Object.freeze({
  ac: "system.attributes.ac.bonus",
  initiative: "system.attributes.init.bonus",
  speed: "system.attributes.movement.walk",
  hpPerLevel: "system.attributes.hp.bonuses.level",
  spellDC: "system.bonuses.spell.dc",
  saveAll: "system.bonuses.abilities.save",
  checkAll: "system.bonuses.abilities.check",
  concentration: "system.attributes.concentration.bonuses.save"
});

/** Secondary conditions a rider may apply (native dnd5e status ids). */
export const RIDER_CONDITIONS = Object.freeze([
  "prone", "grappled", "restrained", "frightened", "blinded", "deafened", "poisoned", "incapacitated"
]);

/** Event names triggers can listen to. */
export const TRIGGER_EVENTS = Object.freeze([
  "hit", "crit", "miss", "kill", "missedBy", "damaged", "turnStart", "turnEnd", "spellCast",
  "concentrationStart", "allyHit", "techniqueUsed"
]);

/**
 * Triggers the module detects on its own. The rest are declared by the player when
 * they use the reaction (the engine still validates economy, cost and depth).
 */
export const AUTO_TRIGGERS = Object.freeze(["hit", "crit", "miss", "missedBy", "damaged", "turnStart", "spellCast", "concentrationStart"]);

/**
 * Hard limits. These are the engine's anti-exploit ceilings and are enforced
 * regardless of what content asks for.
 */
export const LIMITS = Object.freeze({
  /** Total flat attack bonus from all Forge sources on a single roll. */
  attackBonusCap: 2,
  /** Total flat damage bonus from all Forge sources on a single damage roll; "pb" means proficiency bonus. */
  damageBonusCap: "pb",
  /** Rider dice that may apply to a single hit. */
  riderDicePerHit: 1,
  /** Secondary (control) effects from Forge sources per hit. Native mastery is separate. */
  secondaryPerHit: 1,
  /** Momentum gained per round from all triggers combined. */
  momentumGainPerRound: 2,
  /** Absolute Momentum ceiling. */
  momentumHardMax: 8,
  /** Modifiers on a single technique. */
  modifierSlotsMax: 3,
  /** Equipped techniques. */
  techniqueSlotsMax: 6,
  /** Feet a single shape effect may add to range. */
  rangeDeltaMax: 30,
  /** Feet a single shape effect may add to an area's size. */
  areaDeltaMax: 10,
  /** Extra targets a single shape effect may add. */
  targetDeltaMax: 1,
  /** Trigger chains deeper than this are refused (1 = a trigger can't cause another trigger). */
  triggerDepthMax: 1,
  /** Passive stat totals per key. */
  statCaps: { ac: 2, initiative: 5, speed: 10, hpPerLevel: 1, spellDC: 1, saveAll: 1, checkAll: 2, concentration: 3 },
  /** Minimum cost of any active technique (0 = free techniques allowed only if they have a once-per limit). */
  minTechniqueCost: 0
});

/** Ordered resolution stages. Lower runs first. */
export const RESOLUTION_ORDER = Object.freeze([
  "validate",      // 0  requirements, action economy, resources
  "cost",          // 1  pay costs (Momentum, uses)
  "shape",         // 2  range / area / targets
  "attack",        // 3  attack roll bonuses & penalties
  "mastery",       // 4  native dnd5e weapon mastery (untouched, observed only)
  "damage",        // 5  damage bonuses, one rider die, type swaps
  "secondary",     // 6  one Forge secondary effect
  "resource",      // 7  Momentum gains (capped per round)
  "trigger"        // 8  reaction/trigger follow-ups (depth-limited)
]);
