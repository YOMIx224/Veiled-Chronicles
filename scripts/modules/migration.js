// =============================================================
//  RnR — migration.js
//  Upgrades Actor and Item data from old schema versions to the
//  current schema without breaking existing worlds.
//
//  Version map (stored on each document as flags.RnR.schemaVersion):
//    undefined / 0  → first install, no history
//    1              → added armorValue, damageFormula, equipmentSlot
//    2              → added speedBonus, attackBonus, damageBonus on items
//    3              → split disabledOrgans into structured array
//    4              → added race/class/background bonus tracking
//    5              → removed legacy proficiency fields (RnR has no proficiency system)
//    6              → cleared explicit Core Actor Sheet selections so RnR is used
//    7              → removed Level/EXP; converted to Growth Points and Hit Dice pool
//    8              → consolidated duplicate fields onto canonical paths; legacy
//                     values archived under flags.RnR.legacySchema7
//    9              → dnd5e removal pass: attribute baseline re-anchored to 8,
//                     conditions.statuses folded into conditions.physicalStates,
//                     death saves replaced by the Down & Recovery track,
//                     damage modifiers split into flat + dice fragment
//   10             → colour themes retired; actors and items now carry
//                     system.setting and the sheet theme is derived from it
//   11             → Level/EXP restored as system.progression, and the
//                     free-form system.customAttributes list was added. Schema 7
//                     deleted Level/EXP outright; this pass reads back the
//                     _legacyLevel/_legacyExp it archived so nothing is lost.
//   12             → loot items carry an explicit value, items declare
//                     handsRequired for the two-handed rule, and actors carry
//                     the attribute modifier list.
//   13             → actors carry system.activeFeatures, the list of spell and
//                     ability ids that are currently ready to use.
//   14             → Vehicle actors carry separate model, manufacturer, and
//                     serial metadata fields.
//  CURRENT_SCHEMA = 14
// =============================================================

export const CURRENT_SCHEMA = 14;

/**
 * The valid setting ids. Kept as a literal list rather than importing the
 * profile object so this module stays importable on its own (the test harness
 * loads migration.js without booting the system).
 *
 * Must stay in sync with SETTING_PROFILES in RnR.js; the validator enforces it.
 */
export const SETTINGS = Object.freeze([
  "universal", "fantasy", "modern", "future", "space", "superhero", "martial", "mecha",
]);

const LEGACY_FLAG = "legacySchema9";

/** foundry.utils.getProperty, guarded for older cores / unit tests. */
const gp = (obj, key) => (globalThis.foundry?.utils?.getProperty
  ? foundry.utils.getProperty(obj, key)
  : String(key).split(".").reduce((o, k) => (o == null ? o : o[k]), obj));

import { removeAllLegacyItemEffects } from "./activeeffects.js";

/**
 * Archive the pre-consolidation values of the fields that schema 8 rewrites.
 * The object is small and only ever written when something actually changed.
 */
function legacyArchive(source) {
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    try { JSON.stringify(value); } catch { continue; }
    out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Stash removed data under a per-schema flag so nothing is silently destroyed
 * and each pass can be inspected independently.
 *
 * The flag name is derived from the schema whose block is running. Passing an
 * explicit name is only needed where a block archives on behalf of another.
 */
function mergeLegacyArchive(doc, archive, flagName = LEGACY_FLAG) {
  if (!archive) return {};
  return { [`flags.RnR.${flagName}`]: { ...(doc.flags?.RnR?.[flagName] ?? {}), ...archive } };
}

// ─────────────────────────────────────────────────────────────
//  ENTRY POINT — call from Hooks.once("ready")
// ─────────────────────────────────────────────────────────────

export async function runMigrations() {
  if (!game.user.isGM) return { complete: false, skipped: true };

  const worldSchema = Number(game.settings.get("RnR", "worldSchemaVersion") ?? 0);
  if (worldSchema >= CURRENT_SCHEMA) return { complete: true, skipped: true };   // already up to date

  ui.notifications.info(`RnR | Migrating world data from schema ${worldSchema} → ${CURRENT_SCHEMA}…`);
  console.log(`RnR | Migration start (${worldSchema} → ${CURRENT_SCHEMA})`);

  const failures = [];
  const recordFailure = (scope, document, error) => {
    const failure = {
      scope,
      id: document?.id ?? document?._id ?? "unknown",
      name: document?.name ?? "Unnamed document",
      message: String(error?.message ?? error),
    };
    failures.push(failure);
    console.error(`RnR | Migration failed for ${scope} "${failure.name}" (${failure.id})`, error);
  };

  // Schema transformations are designed to be idempotent. Keep the world
  // version unchanged until every operation succeeds so a later startup can
  // safely retry documents which failed this pass.
  let legacyEffectsRemoved = 0;
  for (const actor of game.actors.contents) {
    try {
      const updates = migrateActorData(actor, worldSchema);
      if (Object.keys(updates).length) await actor.update(updates);
    } catch (err) {
      recordFailure("actor", actor, err);
    }

    // Legacy per-item Active Effects double-counted every worn bonus that
    // buildData() already sums. This operation is safe to retry if a later
    // migration step fails because already-removed effects are simply absent.
    if (worldSchema < 8) {
      try {
        legacyEffectsRemoved += await removeAllLegacyItemEffects(actor);
      } catch (err) {
        recordFailure("legacy Active Effect cleanup", actor, err);
      }
    }

    // Migrate embedded items independently so one malformed item does not
    // prevent its siblings or other actors from being processed.
    for (const item of actor.items.contents) {
      try {
        const iu = migrateItemData(item, worldSchema);
        if (Object.keys(iu).length) await item.update(iu);
      } catch (err) {
        recordFailure("embedded item", item, err);
      }
    }
  }

  // ── World items ────────────────────────────────────────────
  for (const item of game.items.contents) {
    try {
      const iu = migrateItemData(item, worldSchema);
      if (Object.keys(iu).length) await item.update(iu);
    } catch (err) {
      recordFailure("world item", item, err);
    }
  }

  // ── Scenes (token actors) ──────────────────────────────────
  for (const scene of game.scenes.contents) {
    for (const tokenDoc of scene.tokens.contents) {
      if (tokenDoc.actorLink) continue; // linked actors already migrated above
      const a = tokenDoc.actor;
      if (!a) continue;
      try {
        const updates = migrateActorData(a, worldSchema);
        if (Object.keys(updates).length) await a.update(updates);
      } catch (err) {
        recordFailure(`unlinked scene token in ${scene.name}`, tokenDoc, err);
      }
    }
  }

  if (failures.length) {
    ui.notifications.error(`RnR | Migration incomplete: ${failures.length} operation(s) failed. World schema remains at ${worldSchema}; reload after correcting the errors to retry.`);
    console.error("RnR | Migration incomplete; failed documents:", failures);
    return { complete: false, schema: worldSchema, failures };
  }

  try {
    await game.settings.set("RnR", "worldSchemaVersion", CURRENT_SCHEMA);
  } catch (err) {
    recordFailure("world schema setting", { id: "worldSchemaVersion", name: "RnR world schema" }, err);
    ui.notifications.error(`RnR | Data was migrated, but the schema version could not be saved. It remains at ${worldSchema}; the idempotent migration will retry on next startup.`);
    return { complete: false, schema: worldSchema, failures };
  }

  ui.notifications.info(`RnR | Migration complete (schema ${CURRENT_SCHEMA}).`);
  if (legacyEffectsRemoved) {
    console.log(`RnR | Migration removed ${legacyEffectsRemoved} legacy item effect(s).`);
    ui.notifications.warn(`RnR | Removed ${legacyEffectsRemoved} duplicated item effect(s) that were double-counting worn bonuses.`);
  }
  console.log(`RnR | Migration complete`);
  return { complete: true, schema: CURRENT_SCHEMA, legacyEffectsRemoved };
}

// ─────────────────────────────────────────────────────────────
//  ACTOR MIGRATION
// ─────────────────────────────────────────────────────────────

export function migrateActorData(actor, fromSchema) {
  const updates = {};
  const sys = actor.system ?? {};

  // ── Schema ≤ 0 → 1: fill missing actor fields ───────────────
  if (fromSchema < 1) {
    // identity fields that old actors might lack
    if (sys.identity?.disabilityCount === undefined)
      updates["system.identity.disabilityCount"] = 0;
    if (!Array.isArray(sys.identity?.extraSkills))
      updates["system.identity.extraSkills"] = [];
    if (sys.identity?.extraSkillPoints === undefined)
      updates["system.identity.extraSkillPoints"] = 6;

    // vitals
    if (sys.vitals?.mental === undefined)
      updates["system.vitals.mental"] = { value: 9, max: 18 };

    // defenses: old actors used to store different keys
    if (sys.defenses?.speed === undefined)
      updates["system.defenses.speed"] = 30;
    if (sys.defenses?.resistance === undefined)
      updates["system.defenses.resistance"] = "";
    if (sys.defenses?.immunity === undefined)
      updates["system.defenses.immunity"] = "";
    if (sys.defenses?.vulnerability === undefined)
      updates["system.defenses.vulnerability"] = "";

    // death saves (schema ≤ 8 shape; schema 9 replaces this block)
    if (sys.death?.success === undefined) updates["system.death.success"] = 0;
    if (sys.death?.failure === undefined) updates["system.death.failure"] = 0;
  }

  // ── Schema ≤ 2: structured skills ────────────────────────────
  if (fromSchema < 2) {
    // Skills may be missing on very old actors
    const SKILL_DEFS = {
      generalEducation:["General education","intellect"], search:["Search","aptitude"],
      history:["History","intellect"], art:["Art","intellect"], medicine:["Medicine","intellect"],
      herb:["Herb","intellect"], firstAid:["First aid","aptitude"], law:["Law","intellect"],
      electronic:["Electronic","intellect"], mechanical:["Mechanical","intellect"],
      craft:["Craft","dexterity"], occult:["Occult","sanity"], perception:["Perception","dexterity"],
      hideAndSneak:["Hide & sneak","dexterity"], persuade:["Persuade","rhetoric"],
      consider:["Consider","ego"], empathy:["Empathy","aptitude"], bet:["Bet","rhetoric"],
      senseOfLie:["Sense of lie","aptitude"], intimidate:["Intimidate","charm"],
      survival:["Survival","aptitude"], climb:["Climb","strength"], stealth:["Stealth","dexterity"],
      brawl:["Brawl","strength"], weapons:["Weapons","strength"], swordPlay:["Sword play","dexterity"],
      throwing:["Throwing","strength"], shootingWeapons:["Shooting weapons","dexterity"],
      reflex:["Reflex","dexterity"], larceny:["Larceny","dexterity"], athlete:["Athlete","strength"],
    };
    for (const k of Object.keys(SKILL_DEFS)) {
      if (sys.skills?.[k] === undefined)
        updates[`system.skills.${k}`] = { label: SKILL_DEFS[k][0], attribute: SKILL_DEFS[k][1], value: 0 };
    }
  }

  // ── Schema ≤ 3: disabledOrgans was string, now number ────────
  if (fromSchema < 3) {
    const dc = sys.identity?.disabilityCount;
    if (typeof dc === "string") {
      updates["system.identity.disabilityCount"] = Number(dc) || 0;
    }
    // Old "psychiatricDisorder" string → conditions block
    if (sys.identity?.psychiatricDisorder && typeof sys.identity.psychiatricDisorder === "string") {
      // leave as-is but ensure conditions block exists
      if (!sys.conditions?.psychiatricDisorders) {
        updates["system.conditions.psychiatricDisorders"] = {
          active: [],
          depression:    { description: "" },
          panicDisorder: { description: "" },
          schizophrenia: { description: "" },
          ptsd:          { description: "" },
          specificPhobia:{ description: "" },
        };
      }
    }
  }

  // ── Schema ≤ 3 → 4: race/class/background bonus tracking ─────
  if (fromSchema < 4) {
    if (sys.appliedBonuses === undefined)
      updates["system.appliedBonuses"] = { race: null, class: null, background: null };
  }

  // ── Schema ≤ 4 → 5: remove legacy proficiency data ───────────
  if (fromSchema < 5) {
    const attributeKeys = ["strength", "dexterity", "toughness", "intellect", "aptitude", "sanity", "charm", "rhetoric", "ego"];
    for (const key of attributeKeys) {
      updates[`system.attributes.${key}.-=proficient`] = null;
      updates[`system.attributes.${key}.save.-=proficient`] = null;
    }
    updates["system.traits.-=weaponProf"] = null;
    updates["system.traits.-=armorProf"] = null;
    updates["system.traits.-=toolProf"] = null;
  }

  // ── Schema ≤ 5 → 6: restore the system Actor Sheet ───────────
  if (fromSchema < 6 && actor.flags?.core?.sheetClass !== undefined) {
    updates["flags.core.-=sheetClass"] = null;
  }

  // ── Schema ≤ 6 → 7: convert level/exp to growthPoints / hitDice ──
  if (fromSchema < 7) {
    if (sys.identity?.level !== undefined) {
      updates["system.identity._legacyLevel"] = sys.identity.level;
      updates["system.identity.-=level"] = null;
    }
    if (sys.details?.level !== undefined) {
      updates["system.details.-=level"] = null;
    }
    if (sys.identity?.exp !== undefined) {
      updates["system.identity._legacyExp"] = sys.identity.exp;
      updates["system.identity.-=exp"] = null;
    }
    if (sys.identity?.expMax !== undefined) {
      updates["system.identity.-=expMax"] = null;
    }
    if (sys.details?.xp !== undefined) {
      updates["system.details.-=xp"] = null;
    }
    if (sys.identity?.growthPoints === undefined) {
      updates["system.identity.growthPoints"] = 0;
    }
    if (sys.identity?.hitDice === undefined) {
      updates["system.identity.hitDice"] = 3;
    }
    if (sys.identity?.hitDiceMax === undefined) {
      updates["system.identity.hitDiceMax"] = 3;
    }
  }

  // ── Schema ≤ 7 → 8: consolidate duplicate actor fields ───────
  if (fromSchema < 8) {
    const archive = {};

    // Vehicle/NPC sheets historically wrote these at the top level.
    const topToDefense = {
      speed:    "system.defenses.speed",
      cover:    "system.defenses.cover",
      armorDR:  "system.defenses.armorDamageReduction",
      damageReduction: "system.defenses.armorDamageReduction",
    };
    for (const [oldKey, newPath] of Object.entries(topToDefense)) {
      if (sys[oldKey] === undefined) continue;
      archive[oldKey] = sys[oldKey];
      const target = newPath.replace(/^system\./, "");
      if (gp(sys, target) === undefined) updates[newPath] = Number(sys[oldKey]) || 0;
      updates[`system.-=${oldKey}`] = null;
    }

    // weaponSystems / crew were sometimes stored as a plain number.
    if (sys.crew !== undefined && sys.crew !== null && !Array.isArray(sys.crew) && typeof sys.crew !== "object") {
      archive.crew = sys.crew;
      updates["system.crew"] = { value: [], max: Number(sys.crew) || 0 };
    }

    // mods block introduced in 8. The damage value is a placeholder here; the
    // schema 9 pass below reshapes it into damageFlat + damage.
    if (sys.mods === undefined) {
      updates["system.mods"] = { attack: 0, damage: 0, damageFlat: 0 };
    }

    // appliedBonuses (progression.js) must exist for every actor
    if (sys.appliedBonuses === undefined) {
      updates["system.appliedBonuses"] = { race: null, class: null, background: null };
    }

    Object.assign(updates, mergeLegacyArchive(actor, archive, "legacySchema7"));
  }

  // ── Schema < 9: dnd5e removal pass ──────────────────────────
  // Four changes, all data preserving:
  //   1. conditions.statuses -> conditions.physicalStates.active
  //   2. death success/failure pips -> Down & Recovery state
  //   3. mods.damage split into mods.damageFlat (number) + mods.damage (string)
  //   4. per-attribute .mod dropped (always derived from .value)
  if (fromSchema < 9) {
    const archive = {};

    // 1. Conditions. The old block was boolean-per-status; the new group keeps an
    //    `active` array of the same keys, so no state is lost.
    const legacyStatuses = sys.conditions?.statuses;
    if (legacyStatuses && typeof legacyStatuses === "object") {
      const active = Array.isArray(gp(actor, "system.conditions.physicalStates.active"))
        ? [...gp(actor, "system.conditions.physicalStates.active")]
        : [];
      for (const [key, on] of Object.entries(legacyStatuses)) {
        if (on && !active.includes(key)) active.push(key);
      }
      updates["system.conditions.physicalStates.active"] = active;
      archive.conditionsStatuses = legacyStatuses;
      updates["system.-=conditions.statuses"] = null;

      // Carry over any per-state description that used to live beside the flag.
      for (const [key, val] of Object.entries(legacyStatuses)) {
        if (val && typeof val === "object" && typeof val.description === "string" && val.description) {
          updates[`system.conditions.physicalStates.${key}.description`] = val.description;
        }
      }
    }
    if (sys.conditions?.physicalStates === undefined) {
      updates["system.conditions.physicalStates"] = { active: [] };
    }

    // 2. Death saves -> Down & Recovery.
    //    These are computed first and assigned once. Assigning a "default if
    //    missing" afterwards would clobber the migrated values.
    const hadDeathPips = sys.death?.success !== undefined || sys.death?.failure !== undefined;
    const successes = Number(sys.death?.success) || 0;
    const failures  = Number(sys.death?.failure) || 0;
    if (hadDeathPips) {
      // Enough failures used to mean death outright. RnR never kills on its own,
      // so this becomes a character the GM must confirm rather than an automatic
      // result, and partial progress is kept as recovery.
      const downState = failures >= 3 ? "deceased"
                      : successes >= 3 ? "recovered"
                      : (successes + failures) > 0  ? "recovering"
                      : "active";
      updates["system.death.state"]    = downState;
      updates["system.death.recovery"] = successes;
      updates["system.death.rounds"]   = failures;
      archive.deathSaves = { success: successes, failure: failures };
      if (failures >= 3) {
        console.warn(`RnR | ${actor.name} had 3+ death failures. Migrated to "${downState}" — the GM must confirm this before it takes effect.`);
      }
    } else {
      // "active" used to be the template default, which meant a brand-new actor
      // was born Down. Schema 10 introduces "healthy" and stops treating that
      // value as a downed state.
      if (sys.death?.state === undefined)    updates["system.death.state"] = "healthy";
      if (sys.death?.rounds === undefined)   updates["system.death.rounds"] = 0;
      if (sys.death?.recovery === undefined) updates["system.death.recovery"] = 0;
    }
    if (sys.death?.success !== undefined) updates["system.-=death.success"] = null;
    if (sys.death?.failure !== undefined) updates["system.-=death.failure"] = null;

    // 3. Damage modifiers: a number becomes a flat bonus, a string stays a
    //    fragment. A legacy numeric 0 must not turn into a "+0" fragment.
    const mods = (sys.mods && typeof sys.mods === "object") ? sys.mods : {};
    const legacyDamage = mods.damage;
    if (typeof legacyDamage === "number") {
      updates["system.mods.damageFlat"] = legacyDamage;
      updates["system.mods.damage"] = "";
    } else {
      if (typeof legacyDamage === "string" && legacyDamage.trim() !== "") {
        updates["system.mods.damage"] = legacyDamage.trim();
      } else if (mods.damage === undefined) {
        updates["system.mods.damage"] = "";
      }
      if (mods.damageFlat === undefined) updates["system.mods.damageFlat"] = 0;
    }
    if (legacyDamage !== undefined) archive.modsDamage = legacyDamage;
    if (mods.attack === undefined) updates["system.mods.attack"] = 0;

    // 4. The stored per-attribute .mod was never read; attrMod() derives it from
    //    .value. Drop it so the sheet cannot show a stale number.
    for (const attrKey of Object.keys(sys.attributes ?? {})) {
      const attr = sys.attributes[attrKey];
      if (attr && typeof attr === "object" && "mod" in attr) {
        updates[`system.-=attributes.${attrKey}.mod`] = null;
      }
    }

    Object.assign(updates, mergeLegacyArchive(actor, archive));
  }

  // ── Schema < 10: colour themes become settings ───────────────
  // The six cosmetic themes (classic/midnight/parchment/tactical/neon/mono) are
  // gone. Each actor now carries a *setting*, and the sheet theme is derived
  // from it. There is no honest colour-name -> genre mapping, so we only
  // promote the old flag when it already names a valid setting, and otherwise
  // fall through to the template default. The original value is archived, so a


  if (fromSchema < 10) {
    const archive = {};
    const legacyFlag = actor?.flags?.RnR?.sheetTheme;
    // An actor that already carries a real setting keeps it. Only a document
    // with no setting can be seeded from the old flag, so a stale flag can
    // never quietly override a choice the player already made.
    if (sys.setting === undefined) {
      if (SETTINGS.includes(legacyFlag)) {
        updates["system.setting"] = legacyFlag;
      } else {
        updates["system.setting"] = "universal";
      }
    }
    if (legacyFlag !== undefined) {
      // Always record what was dropped, even when it was promoted, so the
      // change is auditable after the fact.
      archive.legacySheetTheme = legacyFlag;
      updates["flags.-=RnR.sheetTheme"] = null;
    }

    // Repair the "new actors are born Down" default. Guarded on the schema < 9
    // block not having already computed a state, so a death-save conversion in
    // this same pass is never clobbered.
    const schema9ComputedState = fromSchema < 9 && updates["system.death.state"] !== undefined;
    if (!schema9ComputedState) {
      const state = sys.death?.state;
      const hp = Number(sys.vitals?.health?.value);
      if ((state === "active" || state === undefined) && Number.isFinite(hp) && hp > 0) {
        updates["system.death.state"] = "healthy";
      }
    }

    Object.assign(updates, mergeLegacyArchive(actor, archive, "legacySchema10"));
  }

  // ── Schema < 11: Level/EXP returns, plus custom attributes ──
  // Schema 7 converted Level/EXP into Growth Points and a Hit Dice pool and
  // parked the original numbers in system.identity._legacyLevel/_legacyExp.
  // Progression is back, so those values are promoted again rather than left
  // to rot in a flag. The archive itself is left in place: it is the only record
  // of what the sheet used to hold.
  if (fromSchema < 11) {
    const legacyLevel = Number(sys.identity?._legacyLevel);
    const legacyExp   = Number(sys.identity?._legacyExp);
    const storedLevel = Number(sys.progression?.level);
    const storedExp   = Number(sys.progression?.experience);

    const level = Number.isFinite(storedLevel) && storedLevel >= 1
      ? Math.trunc(storedLevel)
      : (Number.isFinite(legacyLevel) && legacyLevel >= 1 ? Math.trunc(legacyLevel) : 1);
    const experience = Number.isFinite(storedExp) && storedExp >= 0
      ? Math.trunc(storedExp)
      : (Number.isFinite(legacyExp) && legacyExp >= 0 ? Math.trunc(legacyExp) : 0);

    // One key, one object. Writing `system.progression` and
    // `system.progression.level` in the same update would leave the result
    // dependent on key order.
    updates["system.progression"] = { level, experience };

    if (!Array.isArray(sys.customAttributes)) updates["system.customAttributes"] = [];
  }

  // ── Schema < 12: permanent attribute modifiers ───────────────
  // The list has a template default, so this only writes where the field is
  // missing or holds something that is not a list. Rows that are present are
  // left exactly as they are: a modifier a player wrote by hand is data, and
  // repairing it here would be a silent second opinion about their character.
  if (fromSchema < 12) {
    if (!Array.isArray(sys.attributeModifiers)) updates["system.attributeModifiers"] = [];
  }

  // GM who liked "parchment" can find it and hand-pick Fantasy.
  // ── Schema < 13: the active-ability bar ───────────────────
  // `system.activeFeatures` holds the ids of the spells and abilities the
  // character currently has ready. The field has a template default, so this
  // only writes where it is missing or holds something that is not a list of
  // ids. A stored value is filtered rather than trusted: an id left behind by a
  // deleted item would render as a dead slot that can never be cleared.
  if (fromSchema < 13) {
    const stored = sys.activeFeatures;
    if (!Array.isArray(stored)) {
      updates["system.activeFeatures"] = [];
    } else {
      // `actor.items` is an EmbeddedCollection, not an array, so it has to be
      // read through `.contents`. The empty case is left alone rather than
      // emptied: an actor whose items have not loaded yet would otherwise have
      // its whole bar cleared.
      const live = new Set((actor?.items?.contents ?? []).map(item => item?.id).filter(Boolean));
      const clean = stored.filter(id => typeof id === "string" && (live.size === 0 || live.has(id)));
      if (clean.length !== stored.length) updates["system.activeFeatures"] = clean;
    }
  }

  // ── Schema < 14: Vehicle identity metadata ───────────────────
  // Existing Vehicle Actors receive empty defaults only for fields they do not
  // already have. Non-empty values are never overwritten, making retries safe.
  if (fromSchema < 14 && actor.type === "vehicle") {
    for (const field of ["model", "manufacturer", "serial"]) {
      if (sys[field] === undefined || sys[field] === null) updates[`system.${field}`] = "";
    }
  }

  return updates;
}

// ─────────────────────────────────────────────────────────────
//  ITEM MIGRATION
// ─────────────────────────────────────────────────────────────

export function migrateItemData(item, fromSchema) {
  const updates = {};
  const sys = item.system ?? {};

  // ── Schema ≤ 0 → 1 ───────────────────────────────────────────
  if (fromSchema < 1) {
    // Weapons: old items used "damage" string, new uses damageFormula
    if (item.type === "weapon") {
      if (!sys.damageFormula && sys.damage) {
        // Try to extract a dice formula from the old damage string, e.g. "1d6+2 slashing"
        const match = String(sys.damage).match(/^(\d+d\d+(?:[+-]\d+)?)/i);
        updates["system.damageFormula"] = match ? match[1] : "1d6";
      }
      if (!sys.damageType && sys.damage) {
        // Guess type from string
        const str = String(sys.damage).toLowerCase();
        if (str.includes("slash")) updates["system.damageType"] = "slashing";
        else if (str.includes("pierc")) updates["system.damageType"] = "piercing";
        else if (str.includes("blud") || str.includes("bludgeon")) updates["system.damageType"] = "bludgeoning";
        else if (str.includes("fire")) updates["system.damageType"] = "fire";
        else updates["system.damageType"] = "physical";
      }
      if (sys.attackBonus === undefined) updates["system.attackBonus"] = 0;
      if (sys.damageBonus === undefined) updates["system.damageBonus"] = 0;
      if (sys.weaponType === undefined)  updates["system.weaponType"]  = "melee";
      if (sys.attribute === undefined)   updates["system.attribute"]   = "strength";
      if (sys.reach === undefined)       updates["system.reach"]       = 5;
      if (sys.range === undefined)       updates["system.range"]       = "";
    }

    // Armor: old "protection" field → armorValue
    if (item.type === "armor") {
      if (sys.armorValue === undefined) {
        updates["system.armorValue"] = Number(sys.protection) || 0;
      }
      if (sys.armorType === undefined) updates["system.armorType"] = "light";
    }

    // All items: ensure equipmentSlot exists
    if (sys.equipmentSlot === undefined) updates["system.equipmentSlot"] = "";
    if (sys.handSlot      === undefined) updates["system.handSlot"]      = "";
  }

  // ── Schema ≤ 1 → 2 ───────────────────────────────────────────
  if (fromSchema < 2) {
    if (item.type === "weapon" || item.type === "equipment") {
      if (sys.speedBonus  === undefined) updates["system.speedBonus"]  = 0;
    }
    if (item.type === "armor" || item.type === "equipment") {
      // schema 8 renamed armorBonus → armorValue, so seed the canonical field
      if (sys.armorValue === undefined) updates["system.armorValue"] = 0;
      if (sys.speedBonus  === undefined) updates["system.speedBonus"]  = 0;
      if (sys.attackBonus === undefined) updates["system.attackBonus"] = 0;
      if (sys.damageBonus === undefined) updates["system.damageBonus"] = 0;
    }
    // extraskills: ensure bonus field
    if (item.type === "extraskills") {
      if (sys.bonus      === undefined) updates["system.bonus"]      = 0;
      if (sys.speedBonus === undefined) updates["system.speedBonus"] = 0;
      if (sys.skill      === undefined) updates["system.skill"]      = "";
      if (sys.effect     === undefined) updates["system.effect"]     = "";
    }
  }

  // ── Schema ≤ 2 → 3 ───────────────────────────────────────────
  if (fromSchema < 3) {
    // description path normalisation (set individual leaves, never replace the object)
    if (sys.itemDescription?.description && !gp(sys, "description.value")) {
      updates["system.description.value"] = String(sys.itemDescription.description);
    }
    if (sys.itemDescription?.chat && !gp(sys, "description.chat")) {
      updates["system.description.chat"] = String(sys.itemDescription.chat);
    }
    // consumable: old "uses" number → object
    if (item.type === "consumable" && typeof sys.uses === "number") {
      updates["system.uses"] = { value: sys.uses, max: sys.uses, per: "charges" };
    }
  }

  // ── Schema ≤ 3 → 4 ───────────────────────────────────────────
  if (fromSchema < 4) {
    // ability/spell: ensure uses object
    if (["ability","spell"].includes(item.type) && typeof sys.uses !== "object") {
      updates["system.uses"] = { value: 0, max: 0, per: "" };
    }
  }

  // ── Schema ≤ 4 → 5: remove legacy proficiency data ───────────
  if (fromSchema < 5) {
    updates["system.-=proficient"] = null;
    updates["system.-=proficiency"] = null;
  }

  // ── Schema ≤ 7 → 8: consolidate duplicate item fields ────────
  if (fromSchema < 8) {
    const archive = {};

    // ── description: three competing paths → system.description.value
    const legacyDesc = sys.itemDescription?.description
      ?? sys.itemDescription?.value
      ?? (typeof sys.description === "string" ? sys.description : undefined);
    const canonicalDesc = sys.description?.value;
    if (!canonicalDesc && legacyDesc) updates["system.description.value"] = String(legacyDesc);
    if (sys.itemDescription !== undefined) {
      archive.itemDescription = sys.itemDescription;
      updates["system.-=itemDescription"] = null;
    }

    // ── armour DR: four competing paths → system.armorValue
    const legacyArmor = sys.armorBonus ?? sys.protection ?? sys.damageReduction
      ?? sys.armorDamageReduction ?? (sys.armor && typeof sys.armor === "object" ? sys.armor.value : sys.armor);
    if (sys.armorValue === undefined || sys.armorValue === null) {
      updates["system.armorValue"] = Number(legacyArmor) || 0;
    }
    for (const key of ["armorBonus", "protection", "damageReduction", "armorDamageReduction"]) {
      if (sys[key] === undefined) continue;
      archive[key] = sys[key];
      updates[`system.-=${key}`] = null;
    }
    if (sys.armor !== undefined) {
      archive.armor = sys.armor;
      updates["system.-=armor"] = null;
    }

    // ── healing: healFormula → healingFormula
    if (sys.healFormula !== undefined) {
      archive.healFormula = sys.healFormula;
      if (!sys.healingFormula) updates["system.healingFormula"] = String(sys.healFormula);
      updates["system.-=healFormula"] = null;
    }

    // ── attributeBonus: races used an object here; that data belongs to
    //    abilityScoreIncrease, while attributeBonus is a flat worn-gear number.
    if (sys.attributeBonus !== undefined && typeof sys.attributeBonus === "object" && sys.attributeBonus !== null) {
      archive.attributeBonus = sys.attributeBonus;
      if (item.type === "race") {
        if (!sys.abilityScoreIncrease || !Object.keys(sys.abilityScoreIncrease).length)
          updates["system.abilityScoreIncrease"] = sys.attributeBonus;
      }
      updates["system.attributeBonus"] = 0;
    }

    // ── equipment.damage used a nested object; flatten to damageFormula
    if (sys.damage && typeof sys.damage === "object" && sys.damage.base) {
      archive.damage = sys.damage;
      const formula = sys.damage.base?.formula ?? sys.damage.base?.value;
      if (!sys.damageFormula && formula) updates["system.damageFormula"] = String(formula);
      updates["system.-=damage"] = null;
    }

    // ── guarantee every canonical bonus field exists
    const NUMERIC_BONUSES = ["armorValue", "speedBonus", "attackBonus", "damageBonus", "carryBonus", "bonus", "attributeBonus"];
    for (const key of NUMERIC_BONUSES) {
      if (sys[key] === undefined) updates[`system.${key}`] = 0;
    }
    for (const key of ["skill", "attribute", "prostheticFor", "allowedSlot", "slot", "handSlot", "equipmentSlot"]) {
      if (sys[key] === undefined) updates[`system.${key}`] = "";
    }
    // "equipped" was a write-only boolean that duplicated equipmentSlot/handSlot
    // and was never read. Drop it so worn gear has exactly one source of truth.
    if (sys.equipped !== undefined) updates["system.equipped"] = null;
    if (sys.uses === undefined) updates["system.uses"] = { value: 0, max: 0, per: "" };
    if (sys.rangeData === undefined) updates["system.rangeData"] = { value: 0, long: 0, reach: 0, units: "ft" };

    Object.assign(updates, mergeLegacyArchive(item, archive));
  }

  // ── Schema < 10: colour themes become settings ───────────────
  // Same rule as actors. The old flag is only promoted when it already names a
  // valid setting; otherwise it is archived and the item falls back to the
  // template default.
  if (fromSchema < 10) {
    const archive = {};
    const legacyFlag = item?.flags?.RnR?.sheetTheme;
    if (sys.setting === undefined) {
      updates["system.setting"] = SETTINGS.includes(legacyFlag) ? legacyFlag : "universal";
    }
    if (legacyFlag !== undefined) {
      archive.legacySheetTheme = legacyFlag;
      updates["flags.-=RnR.sheetTheme"] = null;
    }
    Object.assign(updates, mergeLegacyArchive(item, archive, "legacySchema10"));
  }

  // ── Schema < 12: loot value and the two-handed flag ───────────
  // Both fields have template defaults, so an untouched document already reads
  // correctly and this writes nothing. It only fires on documents whose stored
  // value is wrong: a loot `value` that is missing or not a number, and a
  // `handsRequired` that is neither 1 nor 2. The second case matters because the
  // equip rules read "exactly 2" as two-handed - a stored 0 or 3 would be
  // silently treated as one-handed and quietly break the rule rather than
  // report a bad value.
  if (fromSchema < 12) {
    if (item.type === "loot" && !Number.isFinite(Number(sys.value))) {
      updates["system.value"] = 0;
    }
    const hands = Number(sys.handsRequired);
    if (!Number.isFinite(hands) || (hands !== 1 && hands !== 2)) {
      updates["system.handsRequired"] = 1;
    }
  }

  return updates;
}
