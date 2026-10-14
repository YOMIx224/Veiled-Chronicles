// =============================================================
//  RnR — attributemodifiers.js
//  Permanent attribute modifiers
// =============================================================
//
// An attribute in play is the sum of three sources, and each is owned by
// something that already knows how to disappear:
//
//   1. the value typed on the sheet          — system.attributes.<key>.value
//   2. items the character carries           — extraskills granting a bonus
//   3. Active Effects                        — anything temporary: a spell,
//                                              a condition, a rest, a GM flag
//
// This module owns the remaining case: a bonus that is *permanent* and is not
// carried by an item. Cybernetics, a scar, an oath, a piece of surgery - things
// that are part of the character rather than their pack. Those belong to the
// actor itself, so they are stored on the actor and survive everything above.
//
// Why not an Active Effect for these too? Because an effect is a document the
// player can toggle off, and can be deleted by cleaning up "just the temporary
// ones". A permanent bonus has to be as durable as the character sheet, which is
// what an embedded list is. Temporary bonuses stay on effects, where the duration
// and expiry logic already lives; nothing here needs to know when a buff ends.
//
// An entry is a plain object so it round-trips through Foundry's document data
// without a DataModel class:
//
//   { id, attribute, value, source }
//
//   id        stable handle used for editing and removal
//   attribute one of the nine attribute keys
//   value     signed; negative modifiers are legitimate
//   source    free text explaining where the bonus came from
// =============================================================

/** The attribute a modifier may target. Supplied by the caller to avoid a cycle. */
const ATTRIBUTE_KEYS = [
  "strength", "dexterity", "toughness", "intellect", "aptitude",
  "sanity", "charm", "rhetoric", "ego",
];

/** Upper bound, matching the sheet's own range so a typo cannot produce a 9000 STR. */
const MAX_MODIFIER = 99;

const getProp = (doc, path) => (globalThis.foundry?.utils?.getProperty
  ? foundry.utils.getProperty(doc, path)
  : String(path).split(".").reduce((o, k) => (o == null ? o : o[k]), doc));

/** Foundry's id generator, with a fallback for use outside a live world. */
function newId() {
  if (globalThis.foundry?.utils?.randomID) return foundry.utils.randomID(16);
  return `mod${Math.random().toString(36).slice(2, 10)}`;
}

/** True for an attribute key the sheet actually has. */
export function isAttributeKey(key) {
  return ATTRIBUTE_KEYS.includes(key);
}

/**
 * Coerce anything found in stored data into a usable modifier.
 *
 * Stored lists are edited by hand, by older versions and by macros, so every
 * field is treated as untrusted. A row that cannot be repaired is dropped rather
 * than returned with NaN in it, because a single NaN would poison the total for
 * the whole attribute and show up as a blank on the sheet.
 *
 * @returns {{id:string, attribute:string, value:number, source:string}|null}
 */
export function normalizeModifier(entry) {
  if (!entry || typeof entry !== "object") return null;

  const attribute = String(entry.attribute ?? "").trim();
  if (!isAttributeKey(attribute)) return null;

  // A blank or unparseable value is treated as no bonus, which is what an
  // abandoned row almost always is, rather than as a NaN that ruins the total.
  const raw = Number(entry.value);
  const value = Math.max(-MAX_MODIFIER, Math.min(MAX_MODIFIER, Number.isFinite(raw) ? Math.trunc(raw) : 0));
  if (value === 0) return null;

  return {
    id: String(entry.id || newId()),
    attribute,
    value,
    source: String(entry.source ?? "").trim(),
  };
}

/** The stored list, repaired. Always an array, even on a document with nothing. */
export function modifierList(actor) {
  const raw = getProp(actor, "system.attributeModifiers");
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeModifier).filter(Boolean);
}

/**
 * Total permanent bonus for one attribute.
 *
 * Overrides are not supported on purpose. A permanent bonus is arithmetic, not
 * a replacement: two +1s make a +2, and nothing about an implant is allowed to
 * quietly decide what Strength *is*. Temporary effects are where overrides belong,
 * and `activeEffectValue` already handles that case.
 */
export function attributeBonus(actor, key) {
  if (!isAttributeKey(key)) return 0;
  return modifierList(actor)
    .filter(modifier => modifier.attribute === key)
    .reduce((total, modifier) => total + modifier.value, 0);
}

/** Every modifier, grouped by attribute, for the sheet. */
export function modifiersByAttribute(actor) {
  const grouped = Object.fromEntries(ATTRIBUTE_KEYS.map(key => [key, []]));
  for (const modifier of modifierList(actor)) grouped[modifier.attribute].push(modifier);
  return grouped;
}

/**
 * Add a permanent modifier.
 *
 * @param {Actor} actor
 * @param {{attribute:string, value:number|number, source?:string}} data
 * @returns {Promise<object|null>} the stored modifier, or null if rejected
 */
export async function addAttributeModifier(actor, data) {
  const modifier = normalizeModifier({ id: newId(), ...data });
  if (!modifier) {
    ui.notifications.warn("That modifier needs a valid attribute and a non-zero value.");
    return null;
  }
  // The whole list is written rather than patched by index: a sheet edit and a
  // macro edit can land in the same tick, and index arithmetic is where that
  // goes wrong.
  const list = modifierList(actor).concat(modifier);
  await actor.update({ "system.attributeModifiers": list });
  return modifier;
}

/** Remove a permanent modifier by id. Unknown ids are ignored, not an error. */
export async function removeAttributeModifier(actor, id) {
  const list = modifierList(actor);
  const next = list.filter(modifier => modifier.id !== id);
  if (next.length === list.length) return false;
  await actor.update({ "system.attributeModifiers": next });
  return true;
}

/** Replace one modifier, identified by id. */
export async function updateAttributeModifier(actor, id, patch) {
  const list = modifierList(actor);
  const index = list.findIndex(modifier => modifier.id === id);
  if (index < 0) return null;
  const merged = normalizeModifier({ ...list[index], ...patch, id });
  if (!merged) {
    // The edit would leave the row meaningless, so drop it instead of storing
    // an empty one the sheet would render as a blank line.
    return removeAttributeModifier(actor, id);
  }
  list[index] = merged;
  await actor.update({ "system.attributeModifiers": list });
  return merged;
}

/** Remove every permanent modifier. Separate because it is a deliberate act. */
export async function clearAttributeModifiers(actor) {
  const list = modifierList(actor);
  if (!list.length) return false;
  await actor.update({ "system.attributeModifiers": [] });
  return true;
}
