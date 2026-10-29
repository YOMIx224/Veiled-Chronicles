/**
 * Translate dnd5e actors, items and activities into the plain context objects
 * the engine evaluates. This is the only place that reads dnd5e data shapes.
 */
import { MODULE_ID } from "../constants.js";

const toSet = v => (v instanceof Set ? new Set(v) : new Set(Array.isArray(v) ? v : []));

/** Build-time context: who the character is. */
export function actorContext(actor) {
  const sys = actor.system;
  const classes = {};
  for ( const [id, cls] of Object.entries(actor.classes ?? {}) ) {
    classes[id] = { levels: cls.system.levels ?? 0, subclass: cls.subclass?.identifier ?? null };
  }
  const abilities = Object.fromEntries(Object.entries(sys.abilities ?? {}).map(([k, a]) => [k, a.value ?? 10]));
  const masteryProperties = new Set();
  for ( const item of actor.itemTypes?.weapon ?? [] ) {
    for ( const opt of item.system.masteryOptions ?? [] ) masteryProperties.add(opt.value);
  }
  // Item5e#identifier falls back to the slugified name, so features imported without an
  // identifier (e.g. by Plutonium) still match: "Second Wind" → "second-wind".
  const features = new Set(actor.items.filter(i => ["feat", "class", "subclass"].includes(i.type))
    .map(i => i.identifier).filter(Boolean));
  const spellcaster = Object.keys(actor.spellcastingClasses ?? {}).length > 0
    || Object.values(classes).length === 0 && !!sys.attributes?.spellcasting;
  return {
    level: sys.details?.level ?? 0,
    pb: sys.attributes?.prof ?? 2,
    classes, abilities, features, spellcaster,
    proficiencies: {
      weapons: toSet(sys.traits?.weaponProf?.value),
      armor: toSet(sys.traits?.armorProf?.value),
      masteryProperties
    },
    bonusPoints: actor.getFlag(MODULE_ID, "bonusPoints") ?? 0
  };
}

/** Current combat keys used to scope per-turn/per-round limits. */
export function combatKeys(actor) {
  const combat = game.combat;
  if ( !combat?.started || !combat.combatants.some(c => c.actor === actor) ) {
    return { inCombat: false, roundKey: "out", turnKey: `out:${Math.floor(Date.now() / 6000)}` };
  }
  return { inCombat: true, roundKey: `${combat.id}:${combat.round}`, turnKey: `${combat.id}:${combat.round}:${combat.turn}` };
}

/** Use-time state: situation of the character right now. */
export function stateContext(actor, runtime = {}) {
  const hp = actor.system.attributes?.hp ?? {};
  const shield = actor.itemTypes?.equipment?.some(i => i.system.equipped && i.system.type?.value === "shield") ?? false;
  const armor = actor.system.attributes?.ac?.equippedArmor?.system?.type?.value ?? "none";
  const { inCombat, roundKey } = combatKeys(actor);
  const economy = runtime.economy?.roundKey === roundKey ? runtime.economy : { roundKey, reaction: true };
  return {
    inCombat,
    bloodied: hp.max ? hp.value <= Math.floor(hp.max / 2) : false,
    shield, armor,
    concentrating: actor.statuses?.has?.("concentrating") ?? false,
    momentum: runtime.momentum?.value ?? 0,
    economy: { reaction: economy.reaction !== false }
  };
}

/** Use-time weapon context from a weapon item. */
export function weaponContext(item) {
  if ( item?.type !== "weapon" ) return null;
  const typeValue = item.system.type?.value ?? "";
  const range = item.system.attackType ?? (typeValue.endsWith("R") ? "ranged" : "melee");
  return {
    properties: toSet(item.system.properties),
    category: typeValue.startsWith("martial") ? "martial" : typeValue.startsWith("simple") ? "simple" : typeValue,
    range: range === "ranged" ? "ranged" : "melee",
    baseItem: item.system.type?.baseItem ?? null,
    mastery: item.system.mastery ?? null,
    masteryAvailable: !!item.system.masteryOptions?.length
  };
}

/** Use-time spell context from a spell item and (optionally) the activity being used. */
export function spellContext(item, activity = null) {
  if ( item?.type !== "spell" ) return null;
  const damageTypes = new Set();
  const activities = activity ? [activity] : [...(item.system.activities ?? [])];
  for ( const act of activities ) {
    for ( const part of act.damage?.parts ?? [] ) for ( const t of part.types ?? [] ) damageTypes.add(t);
    if ( act.healing?.types ) for ( const t of act.healing.types ) damageTypes.add(t === "temphp" ? "temphp" : "healing");
  }
  const act = activity ?? activities[0];
  return {
    level: item.system.level ?? 0,
    school: item.system.school ?? null,
    concentration: item.system.properties?.has?.("concentration") ?? false,
    damageTypes,
    activityType: act?.type ?? null,
    targetShape: act?.target?.template?.type || (act?.target?.affects?.count === "1" ? "single" : null)
  };
}

/**
 * Full use-time context = build context + state + weapon/spell + current use.
 * @param {Actor} actor
 * @param {object} opts
 * @param {object} opts.derived  derived build (engine/build.js deriveBuild)
 * @param {Item} [opts.item]
 * @param {object} [opts.activity]
 * @param {object} [opts.use]    { technique, weave }
 * @param {object} [opts.runtime] flags runtime block
 */
export function useContext(actor, { derived, item = null, activity = null, use = {}, runtime = {} }) {
  return {
    ...derived.ctx,
    state: stateContext(actor, runtime),
    weapon: weaponContext(item),
    spell: spellContext(item, activity),
    use
  };
}
