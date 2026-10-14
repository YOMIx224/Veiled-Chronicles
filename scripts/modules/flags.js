// =============================================================
//  flags.js — read/write RnR document flags
// =============================================================
// Existing worlds store RnR data under `flags.RnR` (mixed case), but the
// system id is `rnr`. Foundry v13+ `getFlag`/`setFlag` only accept the active
// system id as a scope and throw `Flag scope "RnR" is not valid`, so RnR reads
// and writes the stored path directly. This keeps every existing flag in place
// without a data migration.

export const FLAG_NAMESPACE = "RnR";

/** Read `flags.RnR.<key>` (dot paths allowed) without Foundry's scope check. */
export function getRnRFlag(doc, key) {
  let value = doc?.flags?.[FLAG_NAMESPACE];
  for (const part of String(key).split(".")) {
    if (value === undefined || value === null) return undefined;
    value = value[part];
  }
  return value;
}

/** Write `flags.RnR.<key>` through a normal Document update. */
export function setRnRFlag(doc, key, value) {
  return doc.update({ [`flags.${FLAG_NAMESPACE}.${key}`]: value });
}
