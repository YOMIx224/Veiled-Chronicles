// =============================================================
//  Role & Roll  —  RnR.js  (v0.4.3)
// =============================================================

// ── Module imports ────────────────────────────────────────────
import { runMigrations }                             from "./modules/migration.js";
import { applyDamage,
         applyDamageToTargets,
         buildDamageResultLines,
         damageMultiplier,
         armorDamageReduction,
         collectDamageDiceFragments } from "./modules/damage.js";
import { checkAttackFeasibility,
         attackFeasibilitySummary,
         RANGE_RESULT }                              from "./modules/targeting.js";
import { sendAttackCard, sendDamageCard,
         activateChatCardListeners }                 from "./modules/chatcard.js";
import { applyRaceBonus, applyClassBonus,
         applyBackgroundBonus, removeRaceBonus,
         removeClassBonus, removeBackgroundBonus,
         addGrowthPoints, addExperience, setProgressionLevel,
         progressionView }                    from "./modules/progression.js";
import { buildInventorySummary, addItemToActor,
         consumeItem }                               from "./modules/inventory.js";
import { registerGmToolbar, quickHpAdjust,
         applyConditionDialog, gmSecretRoll,
         giveItem }                                  from "./modules/gmtools.js";
import { createEffectDialog, toggleEffect,
 removeExpiredEffects, removeItemEffect, buildEffectsPanelData }   from "./modules/activeeffects.js";
import { attributeBonus }                                           from "./modules/attributemodifiers.js";
import { CONDITION_GROUPS }                                         from "./modules/conditionGroups.js";
import { resolveDefenseRoll }                                      from "./modules/defenseRules.js";
import { buildSession0Pages, GUIDE_REVISION }                from "./modules/session0Guide.js";
import { handleMechaSummonMessage, openMechaBraceletDialog, registerMechaMacroApi } from "./modules/mecha.js";
import { RnRDialogV2 }                                  from "./modules/dialogs.js";
import { bodyFigureSvg }                                from "./modules/bodyFigure.js";
import { runSmokeTest }                                  from "./modules/smokeTest.js";
import { BODY_EQUIPMENT_SLOTS, BODY_SLOT_COLUMNS, BODY_SLOT_ORGANS, LEGACY_BODY_SLOT_OPTIONS, allowedBodySlots, bodyEquipmentAssignments, bodySlotCandidates, isWearableItem } from "./modules/equipmentSlots.js";

// DocumentSheetV2 is rendering-engine agnostic. The RnR sheets use Handlebars
// templates, so explicitly compose the Handlebars renderer into each base.
const RnRHandlebarsActorSheet = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2
);
const RnRHandlebarsItemSheet = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2
);

// Sheets open at a fixed design size (up to 1000x820). On a smaller window
// that pushed the footer and right-hand controls off screen, so the opening
// size is clamped to the viewport. Users can still resize afterwards.
function fitSheetToViewport(options) {
  const position = options.position ?? {};
  const maxWidth = Math.max(420, (globalThis.innerWidth || 1280) - 40);
  const maxHeight = Math.max(420, (globalThis.innerHeight || 800) - 40);
  if (Number(position.width) > maxWidth) position.width = maxWidth;
  if (Number(position.height) > maxHeight) position.height = maxHeight;
  options.position = position;
  return options;
}

// ─────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────
const ATTR_LIST = [
  ["strength",  "STR", "Strength"],
  ["dexterity", "DEX", "Dexterity"],
  ["toughness", "TGH", "Toughness"],
  ["intellect", "INT", "Intellect"],
  ["aptitude",  "APT", "Aptitude"],
  ["sanity",    "SAN", "Sanity"],
  ["charm",     "CHR", "Charm"],
  ["rhetoric",  "RHT", "Rhetoric"],
  ["ego",       "EGO", "Ego"],
];

const ATTR_LABELS = Object.fromEntries(ATTR_LIST.map(([key,,label]) => [key, label]));


const SKILL_GROUPS = [{ label: "Skills", skills: [
  ["art", "Art", "intellect"],
  ["athlete", "Athlete", "strength"],
  ["bet", "Bet", "rhetoric"],
  ["brawl", "Brawl", "strength"],
  ["climb", "Climb", "strength"],
  ["consider", "Consider", "ego"],
  ["craft", "Craft", "dexterity"],
  ["electronic", "Electronic", "intellect"],
  ["empathy", "Empathy", "aptitude"],
  ["firstAid", "First Aid", "aptitude"],
  ["generalEducation", "General Education", "intellect"],
  ["herb", "Herb", "intellect"],
  ["hideAndSneak", "Hide & Sneak", "dexterity"],
  ["history", "History", "intellect"],
  ["intimidate", "Intimidate", "charm"],
  ["larceny", "Larceny", "dexterity"],
  ["law", "Law", "intellect"],
  ["mechanical", "Mechanical", "intellect"],
  ["medicine", "Medicine", "intellect"],
  ["occult", "Occult", "sanity"],
  ["perception", "Perception", "dexterity"],
  ["persuade", "Persuade", "rhetoric"],
  ["reflex", "Reflex", "dexterity"],
  ["search", "Search", "aptitude"],
  ["senseOfLie", "Sense of Lie", "aptitude"],
  ["shootingWeapons", "Shooting Weapons", "dexterity"],
  ["stealth", "Stealth", "dexterity"],
  ["survival", "Survival", "aptitude"],
  ["swordPlay", "Sword Play", "dexterity"],
  ["throwing", "Throwing", "strength"],
  ["weapons", "Weapons", "strength"],
]}];

;

const EXTRA_SKILL_CATEGORIES = [
  ["academic",      "Academic Study"],
  ["arts",          "Arts"],
  ["combat",        "Combat"],
  ["communication", "Communication & Psychology"],
  ["investigation", "Investigation & Tracking"],
  ["other",         "Other"],
  ["physical",      "Physical Training"],
  ["science",       "Science & Medicine"],
];

const BASE_SPEED = 30;
// [key, label, group, effect]. Each disabled organ grants 2 State Points.
// The first four entries must keep their order: characters from before
// v0.2 stored only a count, which is mapped onto the start of this list.
const DISABLED_ORGANS = [
  ["leftHand",  "Left Hand",  "Limbs",    "Cannot hold or wear items in this hand."],
  ["rightHand", "Right Hand", "Limbs",    "Cannot hold or wear items in this hand."],
  ["leftFoot",  "Left Foot",  "Limbs",    "−15 ft Speed. Cannot wear items on this foot."],
  ["rightFoot", "Right Foot", "Limbs",    "−15 ft Speed. Cannot wear items on this foot."],
  ["leftArm",   "Left Arm",   "Limbs",    "Also disables the left hand. Cannot wear items on this arm."],
  ["rightArm",  "Right Arm",  "Limbs",    "Also disables the right hand. Cannot wear items on this arm."],
  ["leftLeg",   "Left Leg",   "Limbs",    "Also disables the left foot (−15 ft Speed). Cannot wear items on this leg."],
  ["rightLeg",  "Right Leg",  "Limbs",    "Also disables the right foot (−15 ft Speed). Cannot wear items on this leg."],
  ["leftEye",   "Left Eye",   "Senses",   "Narrative. The GM may impose penalties on sight-based checks."],
  ["rightEye",  "Right Eye",  "Senses",   "Narrative. The GM may impose penalties on sight-based checks."],
  ["leftEar",   "Left Ear",   "Senses",   "Narrative. The GM may impose penalties on hearing-based checks."],
  ["rightEar",  "Right Ear",  "Senses",   "Narrative. The GM may impose penalties on hearing-based checks."],
  ["voice",     "Voice",      "Senses",   "Narrative. Cannot speak; communicates by other means."],
  ["smell",     "Smell",      "Senses",   "Narrative. Cannot rely on smell or taste."],
  ["heart",     "Heart",      "Internal", "Narrative. Needs a support device, medication or regular treatment."],
  ["lungs",     "Lungs",      "Internal", "Narrative. Strenuous activity and breath-holding are limited."],
  ["liver",     "Liver",      "Internal", "Narrative. Toxins and alcohol affect the character more."],
  ["kidneys",   "Kidneys",    "Internal", "Narrative. Needs regular treatment."],
  ["stomach",   "Stomach",    "Internal", "Narrative. Restricted diet; long rests without proper food are harder."],
  ["spine",     "Spine",      "Internal", "Narrative. The GM decides which movements are limited."],
];

// A disabled arm or leg also takes the hand or foot at its end out of use.
const ORGAN_DEPENDENCIES = {
  leftHand:  ["leftArm"],
  rightHand: ["rightArm"],
  leftFoot:  ["leftLeg"],
  rightFoot: ["rightLeg"],
};

const FLAW_OPTIONS = [
  ["", "No flaw"],
  ["arrogance", "Arrogance"],
  ["cowardice", "Cowardice"],
  ["greed", "Greed"],
  ["guilt", "Guilt"],
  ["obsession", "Obsession"],
  ["paranoia", "Paranoia"],
  ["recklessness", "Recklessness"],
  ["vengeance", "Vengeance"],
  ["other", "Other"],
];

// ─────────────────────────────────────────────────────────────
//  SETTING PROFILES  =  SHEET THEMES
//
//  RnR is setting-neutral, but a sheet still has to *look* like the game being
//  played. Each profile below therefore owns two things:
//
//    label / hint  -  what the profile is for, shown in the sheet header
//    theme         -  the CSS custom-property block that renders it
//
//  The seven genres are the ones the system advertises (Fantasy, Modern,
//  Future, Space, Superhero, Martial Arts, Robot/Vehicle combat). "universal"
//  is the neutral fallback used before a player picks one; it is a full theme in
//  its own right, not a leftover.
//
//  Themes are cosmetic only: no rule, data path, or layout differs between
//  them. The variable blocks live one-per-file in styles/themes/.
// ─────────────────────────────────────────────────────────────

const SETTING_PROFILES = {
  universal: {
    label: "Universal / Custom Setting",
    hint: "Use any era, genre, or mixed setting.",
    theme: "universal",
  },
  fantasy: {
    label: "Fantasy",
    hint: "Use magic, creatures, relics, classes, and origins as optional fiction.",
    theme: "fantasy",
  },
  modern: {
    label: "Modern",
    hint: "Use firearms, vehicles, street-level intrigue, medicine, and forensics.",
    theme: "modern",
  },
  future: {
    label: "Future / Cybernetic",
    hint: "Use cybernetics, drones, firearms, implants, and synthetic life.",
    theme: "future",
  },
  space: {
    label: "Space Opera",
    hint: "Use ships, zero-g scenes, alien cultures, and ranged hazards.",
    theme: "space",
  },
  superhero: {
    label: "Superhero",
    hint: "Use Abilities and Extra Skills for powers, limits, teams, and consequences.",
    theme: "superhero",
  },
  martial: {
    label: "Martial Arts",
    hint: "Focus on styles, techniques, duels, clans, and internal power.",
    theme: "martial",
  },
  mecha: {
    label: "Mecha / Robot Combat",
    hint: "Use Vehicles or NPC Actors for machines, pilots, armor, and systems.",
    theme: "mecha",
  },
};

const THEME_KEYS = Object.keys(SETTING_PROFILES);

/**
 * Localised label for a setting.
 *
 * Foundry's localize() echoes the key back when a translation is missing, so a
 * plain `|| fallback` would happily return "RnR.setting.martial" to the user.
 * Anything that still looks like a key is treated as missing.
 */
function settingProfileLabel(key) {
  const k1 = `RNR.setting.${key}.label`;
  const k2 = `RnR.setting.${key}.label`;
  const label = (globalThis.game?.i18n?.has?.(k1) ? globalThis.game.i18n.localize(k1) : null)
    || (globalThis.game?.i18n?.has?.(k2) ? globalThis.game.i18n.localize(k2) : null)
    || globalThis.game?.i18n?.localize?.(k1);
  return (typeof label === "string" && label && label !== k1 && label !== k2)
    ? label
    : (SETTING_PROFILES[key]?.label ?? key);
}

/** Localised one-line guidance for a setting, with the same key guard. */
function settingProfileHint(key) {
  const k1 = `RNR.setting.${key}.hint`;
  const k2 = `RnR.setting.${key}.hint`;
  const hint = (globalThis.game?.i18n?.has?.(k1) ? globalThis.game.i18n.localize(k1) : null)
    || (globalThis.game?.i18n?.has?.(k2) ? globalThis.game.i18n.localize(k2) : null)
    || globalThis.game?.i18n?.localize?.(k1);
  return (typeof hint === "string" && hint && hint !== k1 && hint !== k2)
    ? hint
    : (SETTING_PROFILES[key]?.hint ?? "");
}

/**
 * Which setting a document belongs to.
 *
 * Used to come from `doc.system.setting` with the world default as a fallback,
 * which let every sheet override the theme on its own - so a world set to one
 * genre quietly rendered half its sheets in another. The campaign setting is
 * now the only authority: the world's "settingProfile" value decides the theme
 * for every sheet, and a stale per-document value is ignored. The legacy
 * flags.RnR.sheetTheme flag is *not* consulted here either; migration 10 moves
 * anything useful out of it.
 */
function resolveSetting(doc) {
  const world = globalThis.game?.settings?.get("RnR", "settingProfile");
  return THEME_KEYS.includes(world) ? world : "universal";
}

/** The theme a document renders with. Always mirrors the campaign setting. */
function resolveSheetTheme(doc) {
  return SETTING_PROFILES[resolveSetting(doc)].theme;
}

// ─────────────────────────────────────────────────────────────
//  PURE HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Normalise a free-text roll fragment into a safe dice formula component.
 * Accepts plain numbers ("2", "-1") and dice ("1d4", "2d6+1", "d8"). Anything
 * that cannot be understood returns "" so a bad Active Effect can never inject
 * junk into a roll formula.
 */
function rollFragment(raw) {
  const s = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return "";
  if (/^[+-]?\d+$/.test(s)) {
    // A zero fragment is noise; dropping it keeps formulas free of "+0" when an
    // older document still holds the numeric default.
    const n = Number(s);
    return n === 0 ? "" : String(n);
  }
  if (/^\d*d\d+([+-]\d+)?$/.test(s)) return s;
  return "";
}

/**
 * Build a dice formula from a base term, a flat bonus and any number of
 * fragments. Flat bonuses are folded into the numeric tail; dice fragments are
 * appended as-is. Returns "" when there is nothing to roll.
 */
function buildFormula(base, flat, ...fragments) {
  const parts = [];
  const b = String(base ?? "").trim().replace(/\s+/g, "");
  if (b) parts.push(b);
  // Fragments are additive bonuses, so they need an explicit sign. A leading
  // "+" is stripped again at the end in case the base term was empty.
  for (const f of fragments) {
    const c = rollFragment(f);
    if (c) parts.push(/^[+-]/.test(c) ? c : `+${c}`);
  }
  let n = (flat === undefined || flat === null || Number.isNaN(Number(flat))) ? 0 : Math.trunc(Number(flat));
  if (n && parts.length) {
    // Fold the flat bonus into the trailing numeric tail when the last term is
    // a die, so "1d8+2" + (-2) collapses to "1d8" instead of "1d8+2-2".
    const m = parts[parts.length - 1].match(/^([+-]?\d*d\d+)([+-]\d+)?$/);
    if (m) {
      parts[parts.length - 1] = m[1];
      n += m[2] ? Number(m[2]) : 0;
    }
  }
  if (n) parts.push(n > 0 ? `+${n}` : `${n}`);
  return parts.join("").replace(/^\+/, "");
}

/**
 * RnR attribute modifier: floor((value − baseline) / 2).
 * The baseline comes from the world setting "attributeBaseline" (default 8) so
 * the curve is not welded to a dnd5e-style midpoint. A rating equal to the
 * baseline is a neutral +0.
 */
function attrBaseline() {
  const raw = Number(globalThis.game?.settings?.get("RnR", "attributeBaseline"));
  return Number.isFinite(raw) && raw > 0 ? raw : 8;
}

function attrMod(value) {
  // Ratings are clamped to a minimum of 1 rather than being treated as "missing".
  // Treating 0 as unset made the curve jump from 0 to -4 at the low end.
  const n = Number(value);
  const v = Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : attrBaseline();
  return Math.floor((v - attrBaseline()) / 2);
}

function signed(n) {
  const num = Number(n) || 0;
  return num >= 0 ? `+${num}` : `${num}`;
}

function gp(actor, path, fallback = 0) {
  const v = foundry.utils.getProperty(actor, path);
  return v ?? fallback;
}

// Origin (race) attribute increases are part of the character's starting
// package, not purchases, so they never count against the State Point pool.
function originAttributeBonus(actor, key) {
  const bonus = Number(gp(actor, `system.appliedBonuses.race.attrBonus.${key}`)) || 0;
  return bonus > 0 ? bonus : 0;
}

function statePointsSpent(actor) {
  return ATTR_LIST.reduce((total, [key]) =>
    total + Math.max(0, (Number(gp(actor, `system.attributes.${key}.value`)) || 8) - 8 - originAttributeBonus(actor, key)), 0);
}

/**
 * Skill bonus from owned Extra Skills and worn armour/equipment for one skill.
 * Mirrors the totals buildData shows on the sheet: an item names its skills in
 * `skills` (list) or `skill`, otherwise its bonus covers every skill of its
 * `attribute`. Equipment only counts while worn (it has an equipment slot).
 */
function itemSkillBonus(actor, key, attr) {
  let total = 0;
  for (const item of actor.items?.contents ?? []) {
    const worn = ["armor", "equipment"].includes(item.type) && item.system?.equipmentSlot;
    if (item.type !== "extraskills" && !worn) continue;
    const bonus = Number(item.system?.bonus) || 0;
    if (!bonus) continue;
    const list = Array.isArray(item.system?.skills) ? item.system.skills.map(v => String(v).trim()).filter(Boolean) : [];
    const single = String(item.system?.skill || "").trim();
    const attribute = String(item.system?.attribute || "").trim();
    const applies = list.length ? list.includes(key) : single ? single === key : attribute === attr;
    if (applies) total += bonus;
  }
  return total;
}

function canHoldItem(item) {
  return Boolean(item && ["weapon", "equipment", "tool", "consumable"].includes(item.type));
}

// ── Active abilities ──────────────────────────────────────────
//
// The Features tab works like the Backpack: an active spell, ability, or Extra Skill
// is dragged into the active bar to become ready to use, and dragged back out to be put away.
// Passive/reaction skills, class, background, and race remain outside the bar as
// permanent effects or character information, so giving them a drag handle would invite the player to
// "activate" something that has no active state.
const ACTIVATABLE_TYPES = new Set(["spell", "ability", "extraskills"]);
const MAX_ACTIVE_FEATURES = 8;

const ACTION_TYPE_LABELS = {
  action: "Action",
  bonusAction: "Bonus Action",
  reaction: "Reaction",
  freeAction: "Free Action",
  partOfAction: "Part of Action",
  partOfBonusAction: "Part of Bonus Action",
  partOfReaction: "Part of Reaction",
  passive: "Passive",
};

function normalizeActionType(value) {
  const raw = String(value ?? "").trim().toLowerCase().replace(/[–—_]/g, " ").replace(/\s+/g, " ");
  if (!raw) return "";
  const compact = raw.replace(/\s+/g, "");
  if (["partofbonusaction", "partbonusaction"].includes(compact)) return "partOfBonusAction";
  if (["partofreaction", "partreaction"].includes(compact)) return "partOfReaction";
  if (["partofaction", "partaction"].includes(compact)) return "partOfAction";
  if (compact === "bonusaction") return "bonusAction";
  if (compact === "freeaction") return "freeAction";
  if (/part of (a )?bonus action|part bonus action/.test(raw)) return "partOfBonusAction";
  if (/part of (a )?reaction|part reaction/.test(raw)) return "partOfReaction";
  if (/part of (an )?action|part action/.test(raw)) return "partOfAction";
  if (raw === "bonus" || /bonus action/.test(raw)) return "bonusAction";
  if (raw === "reaction" || /reaction/.test(raw)) return "reaction";
  if (raw === "free" || /free action/.test(raw)) return "freeAction";
  if (raw === "passive") return "passive";
  if (raw === "action" || /\baction\b/.test(raw)) return "action";
  return "";
}

function actionTypeLabel(item) {
  const sys = item?.system ?? item ?? {};
  const declaredMode = String(sys.abilityType ?? sys.featureType ?? "").trim().toLowerCase();
  if (declaredMode === "passive") return "Passive";
  if (declaredMode === "reaction" || declaredMode === "reactive") return "Reaction";
  const declared = sys.actionType || (item?.type === "spell" ? sys.castingTime : "");
  const normalized = normalizeActionType(declared);
  if (normalized) return ACTION_TYPE_LABELS[normalized];
  if (declaredMode === "active") return "Active";
  return "";
}

function featureMode(item) {
  const sys = item?.system ?? {};
  const declared = String(sys.abilityType || sys.activationType || sys.featureType || sys.mode || "").trim().toLowerCase();
  const aliases = { active: "ACTIVE", passive: "PASSIVE", reaction: "REACTION", reactive: "REACTION" };
  const action = normalizeActionType(sys.actionType || (item?.type === "spell" ? sys.castingTime : ""));
  if (action === "passive") return "PASSIVE";
  if (action === "reaction" || action === "partOfReaction") return "REACTION";
  if (aliases[declared]) return aliases[declared];
  return ACTIVATABLE_TYPES.has(item?.type) ? "ACTIVE" : "PASSIVE";
}

function canActivateFeature(item) {
  return Boolean(item && ACTIVATABLE_TYPES.has(item.type) && featureMode(item) === "ACTIVE");
}

function activeFeatureIds(actor) {
  const stored = gp(actor, "system.activeFeatures", []);
  return Array.isArray(stored)
    ? [...new Set(stored.filter(id => typeof id === "string" && id))]
    : [];
}

/**
 * Mark a feature ready to use, or put it away.
 *
 * Ids that no longer belong to an activatable item are dropped on the way
 * through, so a slot left behind by a deleted spell disappears instead of
 * sticking around as an empty box that can never be cleared.
 */
async function setFeatureActive(actor, item, active) {
  const current = activeFeatureIds(actor).filter(id => {
    const found = actor.items?.get?.(id);
    return found && canActivateFeature(found);
  }).slice(0, MAX_ACTIVE_FEATURES);
  if (active && !current.includes(item.id) && current.length >= MAX_ACTIVE_FEATURES) {
    ui.notifications.warn(`You can have at most ${MAX_ACTIVE_FEATURES} active abilities ready.`);
    return false;
  }
  const next = active
    ? (current.includes(item.id) ? current : [...current, item.id])
    : current.filter(id => id !== item.id);
  await actor.update({ "system.activeFeatures": next });
}

function disabledOrgans(actor) {
  if (gp(actor, "system.identity.disabledOrgansEnabled", false) !== true) return [];
  const stored = foundry.utils.getProperty(actor, "system.identity.disabledOrgans");
  if (Array.isArray(stored)) {
    const valid = new Set(DISABLED_ORGANS.map(([key]) => key));
    return [...new Set(stored.filter(key => valid.has(key)))];
  }
  const count = Math.max(0, Number(gp(actor, "system.identity.disabilityCount")) || 0);
  return DISABLED_ORGANS.slice(0, count).map(([key]) => key);
}

/**
 * A worn prosthetic replaces the limb(s) it was made for. `prostheticFor` may
 * name a single organ ("leftHand"), a pair ("hands", "feet"), or "fullBody"
 * for a whole-body replacement.
 */
// `organs` are restored by the prosthetic; `slots` are where it must be
// wearable for the Item sheet to offer it (eyes on the head, organs in the torso).
const PROSTHETIC_TARGETS = {
  leftHand:  { label: "Left Hand",  organs: ["leftHand"],  slots: ["leftHand"] },
  rightHand: { label: "Right Hand", organs: ["rightHand"], slots: ["rightHand"] },
  hands:     { label: "Both Hands", organs: ["leftHand", "rightHand"], slots: ["leftHand", "rightHand"] },
  leftFoot:  { label: "Left Foot",  organs: ["leftFoot"],  slots: ["leftFoot"] },
  rightFoot: { label: "Right Foot", organs: ["rightFoot"], slots: ["rightFoot"] },
  feet:      { label: "Both Feet",  organs: ["leftFoot", "rightFoot"], slots: ["leftFoot", "rightFoot"] },
  leftArm:   { label: "Left Arm (with hand)",  organs: ["leftArm", "leftHand"],   slots: ["leftArm"] },
  rightArm:  { label: "Right Arm (with hand)", organs: ["rightArm", "rightHand"], slots: ["rightArm"] },
  arms:      { label: "Both Arms",  organs: ["leftArm", "leftHand", "rightArm", "rightHand"], slots: ["leftArm", "rightArm"] },
  leftLeg:   { label: "Left Leg (with foot)",  organs: ["leftLeg", "leftFoot"],   slots: ["leftLeg"] },
  rightLeg:  { label: "Right Leg (with foot)", organs: ["rightLeg", "rightFoot"], slots: ["rightLeg"] },
  legs:      { label: "Both Legs",  organs: ["leftLeg", "leftFoot", "rightLeg", "rightFoot"], slots: ["leftLeg", "rightLeg"] },
  leftEye:   { label: "Left Eye",   organs: ["leftEye"],  slots: ["head"] },
  rightEye:  { label: "Right Eye",  organs: ["rightEye"], slots: ["head"] },
  eyes:      { label: "Both Eyes",  organs: ["leftEye", "rightEye"], slots: ["head"] },
  ears:      { label: "Both Ears",  organs: ["leftEar", "rightEar"], slots: ["head"] },
  voice:     { label: "Voice",      organs: ["voice"],   slots: ["neck"] },
  heart:     { label: "Heart",      organs: ["heart"],   slots: ["torso"] },
  lungs:     { label: "Lungs",      organs: ["lungs"],   slots: ["torso"] },
  spine:     { label: "Spine",      organs: ["spine"],   slots: ["back"] },
  fullBody:  { label: "Full Body / Cyborg", organs: DISABLED_ORGANS.map(([key]) => key), slots: [] },
};
const PROSTHETIC_GROUPS = Object.fromEntries(Object.entries(PROSTHETIC_TARGETS).map(([key, target]) => [key, target.organs]));
const PROSTHETIC_LABELS = Object.fromEntries(Object.entries(PROSTHETIC_TARGETS).map(([key, target]) => [key, target.label]));

function hasProsthetic(actor, organ) {
  return (actor.items?.contents ?? []).some(item => {
    if (!item.system?.equipmentSlot) return false;
    const target = item.system?.prostheticFor;
    if (!target) return false;
    return (PROSTHETIC_GROUPS[target] ?? [target]).includes(organ);
  });
}

function organUsable(actor, organ) {
  const working = !disabledOrgans(actor).includes(organ) || hasProsthetic(actor, organ);
  if (!working) return false;
  return (ORGAN_DEPENDENCIES[organ] ?? []).every(parent => organUsable(actor, parent));
}

/**
 * Flat roll penalty contributed by an actor's active conditions.
 *
 * This replaces the old dnd5e behaviour where `poisoned` / `frightened` /
 * `blinded` silently forced disadvantage on every check. Now nothing is
 * automatic: each condition carries a `rollPenalty` (defaulting to the value
 * declared in CONDITION_GROUPS) which the GM can override per actor. A GM who
 * wants a condition to feel like disadvantage simply sets it to -5.
 */
function conditionRollPenalty(actor) {
  if (!actor) return 0;
  let total = 0;
  for (const g of CONDITION_GROUPS) {
    const active = gp(actor, `system.conditions.${g.key}.active`) || [];
    for (const key of active) {
      const entry = g.entries.find(([k]) => k === key);
      if (!entry) continue;
      const override = Number(gp(actor, `system.conditions.${g.key}.${key}.rollPenalty`));
      const declared = Number(entry[3]) || 0;
      total += Number.isFinite(override) && gp(actor, `system.conditions.${g.key}.${key}.rollPenalty`) !== undefined
        ? override : declared;
    }
  }
  return total;
}

function waitRnRDialog(config) {
  const DialogV2 = RnRDialogV2;
  if (!DialogV2) {
    ui.notifications.error("RnR dialogs require the Foundry DialogV2 API (Foundry v13 or later).");
    return Promise.resolve(null);
  }
  const classes = [...new Set([...(DialogV2.DEFAULT_OPTIONS?.classes ?? []), "rnr-dialog"] )];
  return DialogV2.wait({ classes, modal: true, rejectClose: false, ...config });
}

function renderRnRDialog(config) {
  const DialogV2 = RnRDialogV2;
  if (!DialogV2) {
    ui.notifications.error("RnR dialogs require the Foundry DialogV2 API (Foundry v13 or later).");
    return null;
  }
  const classes = [...new Set([...(DialogV2.DEFAULT_OPTIONS?.classes ?? []), "rnr-dialog"] )];
  return new DialogV2({ classes, modal: true, ...config }).render({ force: true });
}

function onRnRDialogRender(id, callback) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2) return () => {};
  const hookId = Hooks.on("renderApplicationV2", (app, element) => {
    if (!(app instanceof DialogV2) || app.id !== id) return;
    Hooks.off("renderApplicationV2", hookId);
    callback(app, element);
  });
  return () => Hooks.off("renderApplicationV2", hookId);
}

function criticalFormula(formula) {
  return String(formula || "1d6").replace(/(\d+)d(\d+)/gi, (_m, count, faces) => `${Number(count) * 2}d${faces}`);
}

function actorReflexModifier(actor) {
  const dexMod = attrMod(actorAttributeValue(actor, "dexterity"));
  const reflexSkill = Number(gp(actor, "system.skills.reflex.value")) || 0;
  return dexMod + reflexSkill + activeEffectValue(actor, "system.skills.reflex.value") + activeEffectValue(actor, "system.defenses.reflexDefense");
}

async function rollReflex(actor, bonus = 0) {
  const modifier = actorReflexModifier(actor) + Number(bonus || 0) + conditionRollPenalty(actor);
  const first = await new Roll(buildFormula("1d20", modifier)).evaluate();
  return { first, second: null, die: first.dice[0]?.results[0]?.result ?? first.total, total: first.total, modifier, mode: "normal" };
}

function reflexRollDialog(actor, bonus = 0) {
  const modifier = actorReflexModifier(actor) + Number(bonus || 0);
  return waitRnRDialog({
    window: { title: `Reflex — ${actor.name}` },
    content: `<div class="rnr-roll-mode-dialog rnr-reflex-dialog">
      <p class="rnr-roll-mode-label">Roll Reflex to evade</p>
      <p class="rnr-roll-mode-hint">Roll d20 ${signed(modifier)} to avoid the incoming attack.</p>
    </div>`,
    buttons: [{
      action: "roll",
      label: "🎲 Roll Reflex",
      default: true,
      callback: () => rollReflex(actor, bonus),
    }],
  });
}

function defenseState(actor) {
  const round = Number(game.combat?.round) || 0;
  const stored = gp(actor, "system.combatDefense", {});
  if (!stored || Number(stored.round) !== round) return { round, defensesUsed: 0, counterUsed: false, lastChallengeId: "" };
  return { round, defensesUsed: Number(stored.defensesUsed) || 0, counterUsed: stored.counterUsed === true, lastChallengeId: String(stored.lastChallengeId || "") };
}

function extraDefenseUses(actor) {
  const extras = gp(actor, "system.identity.extraSkills", []);
  return Array.isArray(extras) && extras.some(entry => /defen[cs]|reaction|counter/i.test(String(entry?.name || entry || ""))) ? 1 : 0;
}

async function resolveIncomingDefense(targetActor, attackTotal, attackerName = "the attacker") {
  if (!targetActor) return null;
  const state = defenseState(targetActor);
  const maxUses = 1 + extraDefenseUses(targetActor);
  if (state.defensesUsed >= maxUses) return { choice: "spent", success: false, message: "Defense already used this turn." };
  const hands = (targetActor.items?.contents ?? [])
    .filter(item => item.type === "weapon" && ["left", "right"].includes(String(item.system?.handSlot || "")))
    .filter(item => organUsable(targetActor, item.system.handSlot === "left" ? "leftHand" : "rightHand"));
  const defenseWeapon = hands.find(item => getItemCombatData(targetActor, item).hasAttack);
  const buttons = [];
  if (defenseWeapon) buttons.push({
    action: "defend",
    label: `⚔ Defend (${defenseWeapon.name})`,
    default: true,
    callback: async () => {
      const data = getItemCombatData(targetActor, defenseWeapon);
      const roll = await new Roll(buildFormula("1d20", data.totalAtkMod + conditionRollPenalty(targetActor))).evaluate();
      await targetActor.update({ "system.combatDefense": { ...state, defensesUsed: state.defensesUsed + 1 } });
      return { choice: "defend", success: roll.total >= attackTotal, total: roll.total, weapon: defenseWeapon.name };
    },
  });
  buttons.push({
    action: "dodge",
    label: "↝ Dodge (Reflex)",
    ...(!defenseWeapon ? { default: true } : {}),
    callback: async () => {
      const roll = await rollReflex(targetActor);
      const earnsCounter = roll.total > attackTotal && !state.counterUsed;
      await targetActor.update({ "system.combatDefense": { ...state, defensesUsed: state.defensesUsed + 1, counterUsed: state.counterUsed || earnsCounter } });
      return { choice: "dodge", success: roll.total >= attackTotal, counter: earnsCounter, counterItemId: defenseWeapon?.id || "", total: roll.total };
    },
  });
  buttons.push({ action: "none", label: "Take the hit", callback: () => ({ choice: "none", success: false }) });
  return waitRnRDialog({
    window: { title: `Defense against ${attackerName}` },
    content: `<div class="rnr-defense-dialog"><p><strong>${attackerName}</strong> rolled <strong>${attackTotal}</strong>.</p><p>Choose one reaction: defend with a weapon or dodge with Reflex.</p><p class="rnr-roll-mode-hint">Defense uses: ${state.defensesUsed}/${maxUses} this turn.</p></div>`,
    buttons,
  }).then(result => result ?? { choice: "none", success: false });
}


function activeEffectValue(actor, path) {
  let total = 0;
  const modes = globalThis.CONST?.ACTIVE_EFFECT_MODES ?? { MULTIPLY: 1, OVERRIDE: 5 };
  for (const effect of actor.effects?.contents ?? []) {
    if (effect.disabled || effect.isSuppressed) continue;
    for (const change of effect.changes ?? []) {
      if (change.key !== path) continue;
      const value = Number(change.value);
      if (!Number.isFinite(value)) continue;
      if (Number(change.mode) === modes.OVERRIDE) total = value;
      else if (Number(change.mode) !== modes.MULTIPLY) total += value;
    }
  }
  return total;
}


function actorAttributeValue(actor, key) {
  const base = Number(gp(actor, `system.attributes.${key}.value`)) || 8;
  const bonus = (actor.items?.contents ?? []).reduce((total, item) => {
    return total + (item.type === "extraskills" && item.system?.attribute === key
      ? Number(item.system?.attributeBonus) || 0 : 0);
  }, 0);
  // Permanent bonuses live on the actor, temporary ones on effects. See
  // attributemodifiers.js for why the two are kept apart.
  return base + bonus + attributeBonus(actor, key) + activeEffectValue(actor, `system.attributes.${key}.value`);
}

// ─────────────────────────────────────────────────────────────
//  ACTOR INIT
// ─────────────────────────────────────────────────────────────

async function initActor(actor) {
  const tghMod   = attrMod(gp(actor, "system.attributes.toughness.value") || 8);
  const sanMod   = attrMod(gp(actor, "system.attributes.sanity.value")    || 8);
  const updates  = {};
  const migrationVersion = Number(gp(actor, "system.migrationVersion")) || 0;
  if (migrationVersion < 2) {
    const legacyCount = Math.max(0, Number(gp(actor, "system.identity.disabilityCount")) || 0);
    if (!Array.isArray(gp(actor, "system.identity.disabledOrgans", null)))
      updates["system.identity.disabledOrgans"] = DISABLED_ORGANS.slice(0, legacyCount).map(([key]) => key);
    updates["system.migrationVersion"] = 2;
  }
  if (migrationVersion < 3) {
    if (gp(actor, "system.defenses.armorDamageReduction", null) === null)
      updates["system.defenses.armorDamageReduction"] = 0;
    updates["system.migrationVersion"] = 3;
  }
  if (migrationVersion < 4) {
    // Remove obsolete fixed-defense and legacy disability fields. Reflex is rolled.
    updates["system.defenses.-=reflexDefense"] = null;
    updates["system.defenses.-=armorClass"] = null;
    updates["system.-=armorClass"] = null;
    updates["system.identity.-=disabilityCount"] = null;
    updates["system.migrationVersion"] = 4;
  }

  if (!Number(gp(actor, "system.vitals.health.max"))) {
    const v = 10 + tghMod;
    updates["system.vitals.health.max"]   = v;
    updates["system.vitals.health.value"] = v;
  }
  if (!Number(gp(actor, "system.vitals.willPower.max"))) {
    const v = 8 + sanMod;
    updates["system.vitals.willPower.max"]   = v;
    updates["system.vitals.willPower.value"] = v;
  }
  if (!Number(gp(actor, "system.vitals.mental.max"))) {
    updates["system.vitals.mental.max"]   = 18;
    updates["system.vitals.mental.value"] = 9;
  }
  if (gp(actor, "system.identity.extraSkillPoints") === undefined)
    updates["system.identity.extraSkillPoints"] = 6;
  if (["character", "npc", "vehicle"].includes(actor.type) && !/^\d{13}$/.test(String(gp(actor, "system.identity.identificationNumber", ""))))
    updates["system.identity.identificationNumber"] = uniqueIdentificationNumber(actor);
  if (!Array.isArray(gp(actor, "system.identity.extraSkills")))
    updates["system.identity.extraSkills"] = [];
  if (gp(actor, "system.identity.growthPoints") === undefined)
    updates["system.identity.growthPoints"] = 0;
  if (!Number(gp(actor, "system.identity.hitDice")))
    updates["system.identity.hitDice"] = 3;
  if (!Number(gp(actor, "system.identity.hitDiceMax")))
    updates["system.identity.hitDiceMax"] = 3;

  // Level/EXP and the free-form attribute list. Seeded here as well as in the
  // world migration so a player client that never runs migrations still gets a
  // legal actor. Both guards only fire when a value is actually missing, so
  // this settles after the first pass and cannot loop.
  if (!Number.isFinite(Number(gp(actor, "system.progression.level"))) || Number(gp(actor, "system.progression.level")) < 1)
    updates["system.progression.level"] = 1;
  if (!Number.isFinite(Number(gp(actor, "system.progression.experience"))) || Number(gp(actor, "system.progression.experience")) < 0)
    updates["system.progression.experience"] = 0;
  if (!Array.isArray(gp(actor, "system.customAttributes")))
    updates["system.customAttributes"] = [];

  if (Object.keys(updates).length) await actor.update(updates);
}

// ─────────────────────────────────────────────────────────────
//  CHAT CARD
// ─────────────────────────────────────────────────────────────

async function sendCard({ actor, title, subtitle = "", rolls = [], detail = "", mode = "normal", damageFormula = "", damageType = "" }) {
  // rolls = array of evaluated Roll objects
  // If adv/dis we expect rolls[0] and rolls[1]
  const r1    = rolls[0];
  const r2    = rolls[1] ?? null;
  if (!r1) return;

  const d1    = r1.dice[0]?.results[0]?.result ?? r1.total;
  const d2    = r2 ? (r2.dice[0]?.results[0]?.result ?? r2.total) : null;
  let kept    = d1;
  let dropped = null;
  let finalRoll = r1;

  if (r2 !== null) {
    if (mode === "advantage") {
      if (d2 > d1) { kept = d2; dropped = d1; finalRoll = r2; }
      else          { kept = d1; dropped = d2; finalRoll = r1; }
    } else {
      if (d2 < d1) { kept = d2; dropped = d1; finalRoll = r2; }
      else          { kept = d1; dropped = d2; finalRoll = r1; }
    }
  }

  const isCrit = kept === 20;
  const isFail = kept === 1;
  const cardCls = isCrit ? "rnr-card-crit" : isFail ? "rnr-card-fail" : "";
  const modeTag = mode === "advantage"
    ? `<span class="rnr-card-mode adv">ADV</span>`
    : mode === "disadvantage"
    ? `<span class="rnr-card-mode dis">DIS</span>`
    : "";

  const content = `
<div class="rnr-chat-card ${cardCls}">
  <div class="rnr-card-header">
    <img src="${actor.img}" />
    <div>
      <strong>${actor.name}</strong>
      <span>${title}</span>
      ${subtitle ? `<em>${subtitle}</em>` : ""}
    </div>
    ${modeTag}
  </div>
  <div class="rnr-card-dice">
    <span class="rnr-card-d20 ${isCrit ? "crit" : isFail ? "fail" : ""}">${kept}</span>
    ${dropped !== null ? `<span class="rnr-card-d20 dropped">${dropped}</span>` : ""}
    <span class="rnr-card-total">${finalRoll.total}</span>
    ${isCrit ? `<span class="rnr-card-label crit">CRITICAL!</span>` : ""}
    ${isFail ? `<span class="rnr-card-label fail">FUMBLE</span>`    : ""}
  </div>
  ${detail ? `<div class="rnr-card-detail">${detail}</div>` : ""}
  ${damageFormula ? `<button type="button" class="rnr-chat-action" data-action="apply-damage" data-formula="${foundry.utils.escapeHTML(damageFormula)}" data-damage-type="${foundry.utils.escapeHTML(damageType)}">Apply Damage to Target</button>` : ""}
</div>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls: [finalRoll],
  });
}

// ─────────────────────────────────────────────────────────────
//  ROLL DIALOG  (Normal / Advantage / Disadvantage)
// ─────────────────────────────────────────────────────────────

async function rollDialog(actor, title, modifier, subtitle = "", extraDetail = "") {
  const penalty = conditionRollPenalty(actor);
  const totalModifier = modifier + penalty;
  await waitRnRDialog({
    window: { title },
    content: `
<div class="rnr-roll-mode-dialog">
  <p class="rnr-roll-mode-label">Roll Mode</p>
  <div class="rnr-roll-mode-row">
    <label><input type="radio" name="mode" value="normal"      checked> Normal</label>
    <label><input type="radio" name="mode" value="advantage">           Advantage</label>
    <label><input type="radio" name="mode" value="disadvantage">        Disadvantage</label>
  </div>
  <p class="rnr-roll-mode-hint">Modifier: <strong>${signed(totalModifier)}</strong>${
    penalty ? ` <em class="rnr-condition-penalty">(${signed(penalty)} from conditions)</em>` : ""}</p>
 </div>`,
    buttons: [
      {
        action: "roll",
        label: "🎲 Roll",
        default: true,
        callback: async (_event, button) => {
          const mode = button.form?.querySelector("input[name=mode]:checked")?.value ?? "normal";
          const formula = buildFormula("1d20", totalModifier);
          const r1 = await new Roll(formula).evaluate();
          if (mode === "normal") {
            await sendCard({ actor, title, subtitle, rolls: [r1], detail: extraDetail, mode });
          } else {
            const r2 = await new Roll(formula).evaluate();
            await sendCard({ actor, title, subtitle, rolls: [r1, r2], detail: extraDetail, mode });
          }
        },
      },
      { action: "cancel", label: "Cancel" },
    ],
  });
}

function savingThrowDialog(actor, key) {
  const label = ATTR_LABELS[key] || key;
  return rollDialog(actor, `${label} Saving Throw`, attrMod(actorAttributeValue(actor, key)), `${label} save`);
}

// ─────────────────────────────────────────────────────────────
//  ID CARD
// ─────────────────────────────────────────────────────────────

/** Escape text for interpolation into the card's HTML. */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function randomIdentificationNumber() {
  const first = Math.floor(Math.random() * 9) + 1;
  const rest = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
  return `${first}${rest}`;
}

function uniqueIdentificationNumber(actor) {
  const used = new Set((game.actors?.contents ?? []).filter(other => other !== actor).map(other => String(gp(other, "system.identity.identificationNumber", ""))));
  let value = randomIdentificationNumber();
  while (used.has(value)) value = randomIdentificationNumber();
  return value;
}

/** A "Label: value" row, or nothing when the value was never filled in. */
function idCardField(label, value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return `<div class="rnr-id-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(text)}</strong></div>`;
}

function idCardRequiredField(label, value) {
  const text = String(value ?? "").trim();
  return `<div class="rnr-id-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(text || "—")}</strong></div>`;
}

/**
 * A read-only summary of a character, in the style of a physical ID card.
 *
 * The point is that the whole character fits on one readable page, which is what
 * you want when someone needs to check a character quickly — at the table, or
 * handed a printout. It is a dialog rather than a sheet tab because it is
 * something you look at, not something you fill in; every field here can still be
 * edited on the sheet itself.
 *
 * Nothing on the card is setting-specific. There is no "Species" for fantasy and
 * no "Clearance" for space, because RnR does not know which of those a campaign
 * uses — the fields are the ones the sheet actually stores, and whatever is blank
 * is simply left off. That is the same rule the rest of the system follows.
 */
/**
 * The card's own sections, so the dialog and the chat copy cannot drift apart.
 *
 * Each builder returns markup only — no presentation is decided here, which is
 * what lets the same identity data be shown at dialog size and at chat-log size
 * without the two versions being maintained by hand.
 */
function idCardHeaderHtml(actor, { level, settingLabel, flawLabel }) {
  const id = actor.system?.identity ?? {};
  return `
  <header class="rnr-id-header">
    <img src="${escapeHtml(actor.img)}" alt="" />
    <div class="rnr-id-header-text">
      <h2>${escapeHtml(actor.name)}</h2>
      <p class="rnr-id-subtitle">${escapeHtml(id.race || actor.system?.vehicleType || (actor.type === "vehicle" ? "Vehicle / Mecha" : "Unassigned"))}</p>
      <p class="rnr-id-tags">
        <span class="rnr-id-tag setting">${escapeHtml(settingLabel)}</span>
        <span class="rnr-id-tag">Level ${level}</span>
        ${flawLabel && flawLabel !== "No flaw" ? `<span class="rnr-id-tag flaw">${escapeHtml(flawLabel)}</span>` : ""}
      </p>
    </div>
  </header>`;
}

function idCardVitalsHtml(actor) {
  const vitals = actor.system?.vitals ?? {};
  const health = vitals.health ?? {};
  const willPower = vitals.willPower ?? {};
  const { experience, experienceNext } = progressionView(actor);
  return `
  <div class="rnr-id-vitals">
    <div><span>Health</span><strong>${Number(health.value) || 0} / ${Number(health.max) || 0}</strong></div>
    <div><span>Willpower</span><strong>${Number(willPower.value) || 0} / ${Number(willPower.max) || 0}</strong></div>
    <div><span>Experience</span><strong>${experience} / ${experienceNext}</strong></div>
  </div>`;
}

function idCardIdentityHtml(actor, disabled) {
  const id = actor.system?.identity ?? {};
  return `
  <div class="rnr-id-section">
    <h3>Identity</h3>
    <div class="rnr-id-fields">
      ${idCardRequiredField("Gender", id.gender)}
      ${idCardRequiredField("Age", id.age ? String(id.age) : "")}
      ${idCardRequiredField("Date of Birth", id.dateOfBirth)}
      ${idCardRequiredField("Identification No.", id.identificationNumber)}
      ${idCardRequiredField("Address", id.address)}
      ${idCardRequiredField("Birthplace", id.birthplace)}
      ${idCardRequiredField("Origin", id.race)}
      ${idCardField("Source of Willpower", id.sourceOfWillpower)}
      ${disabled.length ? idCardField("Disabled Areas", disabled.join(", ")) : ""}
    </div>
  </div>`;
}

function idCardAttributesHtml(actor) {
  return `
  <div class="rnr-id-section">
    <h3>Attributes</h3>
    <div class="rnr-id-attributes">
      ${ATTR_LIST.map(([key, abbr, label]) => {
        const value = actorAttributeValue(actor, key);
        return `<div class="rnr-id-attribute"><span>${escapeHtml(abbr)}</span><strong>${value}</strong><small>${signed(attrMod(value))}</small></div>`;
      }).join("")}
    </div>
  </div>`;
}

/** Everything that identifies a character, without the long-form prose. */
function idCardFactsHtml(actor) {
  const id = actor.system?.identity ?? {};
  const { level } = progressionView(actor);
  const settingKey = String(actor.system?.setting || "universal");
  const settingLabel = SETTING_PROFILES[settingKey] ? settingProfileLabel(settingKey) : settingProfileLabel("universal");
  const flawLabel = FLAW_OPTIONS.find(([key]) => key === String(id.flaw || ""))?.[1] ?? "";
  const disabled = disabledOrgans(actor)
    .map(key => DISABLED_ORGANS.find(([k]) => k === key)?.[1] ?? key);
  return [
    idCardHeaderHtml(actor, { level, settingLabel, flawLabel }),
    idCardIdentityHtml(actor, disabled),
  ].join("\n");
}

/** The compact identity card shown by the sheet button and posted to chat. */
function buildIdCardHtml(actor) {
  return `<div class="rnr-id-card">${idCardFactsHtml(actor)}</div>`;
}

/**
 * Post the ID to chat.
 *
 * The identity facts go into the log rather than only a modal, because "what is
 * this character?" is a question the table asks out loud, and a dialog answers it
 * only on the one screen that opened it. Chat keeps the answer where everyone can
 * scroll back to it. The long-form prose stays in the dialog: it is pages of text
 * that would bury the conversation without adding anything to a quick check.
 */
async function postIdCardToChat(actor) {
  const msg = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="rnr-chat-card rnr-id-card-chat">${idCardFactsHtml(actor)}</div>`,
    flags: { rnr: { idCard: true } },
  });
  return msg;
}

/**
 * A read-only summary of a character, in the style of a physical ID card.
 *
 * The point is that the whole character fits on one readable page, which is what
 * you want when someone needs to check a character quickly — at the table, or
 * handed a printout. It is a dialog rather than a sheet tab because it is
 * something you look at, not something you fill in; every field here can still be
 * edited on the sheet itself.
 *
 * Opening it also drops the identity facts into chat, so a check is visible to
 * everyone rather than only the player who clicked.
 *
 * Nothing on the card is setting-specific. There is no "Species" for fantasy and
 * no "Clearance" for space, because RnR does not know which of those a campaign
 * uses — the fields are the ones the sheet actually stores, and whatever is blank
 * is simply left off. That is the same rule the rest of the system follows.
 */
function showIdCard(actor) {
  renderRnRDialog({
    window: { title: `ID Card — ${actor.name}` },
    content: buildIdCardHtml(actor),
    buttons: [{ action: "close", label: "Close", default: true }],
    position: { width: 520 },
  });
  postIdCardToChat(actor).catch(err => {
    console.error("RnR | failed to post the ID card to chat", err);
  });
}


// ─────────────────────────────────────────────────────────────
//  WEAPON ATTACK
// ─────────────────────────────────────────────────────────────

function isAmmunitionItem(item, weapon) {
  if (!item || !["consumable", "loot"].includes(item.type)) return false;
  const sys = item.system ?? {};
  const type = String(sys.consumableType || sys.lootType || "").trim().toLowerCase();
  if (sys.isAmmunition !== true && !["ammunition", "ammo", "bullet", "bullets", "cartridge", "shell", "rounds"].includes(type)) return false;
  const weaponCaliber = String(gp(weapon, "system.caliber") || "").trim().toLowerCase();
  const ammoCaliber = String(sys.caliber || sys.ammunitionType || "").trim().toLowerCase();
  return !weaponCaliber || !ammoCaliber || weaponCaliber === ammoCaliber;
}

/**
 * Ask which stack of ammunition to load from.
 *
 * The old reload drained every compatible stack in turn, top to bottom, until
 * the magazine was full. That quietly ate the wrong ammunition whenever a
 * character carried more than one kind of matching round, and it gave no way to
 * load partially. This shows every candidate with its own count and lets the
 * player pick one stack and a number of rounds to take from it.
 *
 * @returns {Promise<{item: Item, amount: number}|null>}
 */
async function pickAmmunition(actor, weapon, candidates, needed) {
  if (!candidates.length) return Promise.resolve(null);

  // A single stack needs no choice to be made, but the amount still does, and a
  // mag that is 3 rounds short should not be filled to the brim by default.
  const options = candidates.map((ammo, i) => {
    const qty = Math.max(0, Number(gp(ammo, "system.quantity")) || 0);
    const caliber = String(gp(ammo, "system.caliber") || gp(ammo, "system.ammunitionType") || "").trim();
    return `<label class="rnr-ammo-option">
      <input type="radio" name="rnr-ammo-item" value="${ammo.id}" ${i === 0 ? "checked" : ""} />
      <span class="rnr-ammo-option-name">${ammo.name}</span>
      <span class="rnr-ammo-option-meta">${caliber ? `${caliber} · ` : ""}${qty} in stock</span>
    </label>`;
  }).join("");
  const id = `rnr-ammo-${foundry.utils.randomID()}`;
  const unhook = onRnRDialogRender(id, (_app, element) => {
    const root = element.querySelector(".rnr-ammo-dialog");
    const amount = root?.querySelector("input[name=rnr-ammo-amount]");
    if (!root || !amount) return;
    const sync = () => {
      const chosen = candidates.find(a => a.id === root.querySelector("input[name=rnr-ammo-item]:checked")?.value);
      const cap = Math.min(needed, stackCount(chosen));
      amount.max = String(cap);
      if (Number(amount.value) > cap) amount.value = String(cap);
    };
    root.querySelectorAll("input[name=rnr-ammo-item]").forEach(input => input.addEventListener("change", sync));
    sync();
  });
  try {
    const result = await waitRnRDialog({
      id,
      window: { title: `Reload — ${weapon.name}` },
      position: { width: 520 },
      content: `<div class="rnr-ammo-dialog">
        <p class="rnr-roll-mode-hint">
          ${weapon.name} needs <strong>${needed}</strong> more round(s) to reach ${Number(gp(weapon, "system.ammunitionMax")) || 0}.
        </p>
        <p class="rnr-roll-mode-label">Choose ammunition</p>
        <div class="rnr-ammo-options">${options}</div>
        <label class="rnr-ammo-amount">Rounds to load
          <input type="number" name="rnr-ammo-amount" min="1" max="${needed}" value="${needed}" />
        </label>
      </div>`,
      buttons: [
        {
          action: "reload",
          label: "Reload",
          default: true,
          callback: (_event, button) => {
            const root = button.form;
            const chosenId = root?.querySelector("input[name=rnr-ammo-item]:checked")?.value;
            const chosen = candidates.find(a => a.id === chosenId);
            if (!chosen) return { item: null, amount: 0 };
            const amount = Math.max(1, Math.min(needed, Math.trunc(Number(root.querySelector("input[name=rnr-ammo-amount]")?.value)) || needed));
            return { item: chosen, amount };
          },
        },
        { action: "cancel", label: "Cancel" },
      ],
    });
    return result?.item ? result : null;
  } finally {
    unhook();
  }
}

async function reloadWeapon(actor, weapon) {
  const capacity = Number(gp(weapon, "system.ammunitionMax")) || 0;
  const current = Math.max(0, Number(gp(weapon, "system.ammunition")) || 0);
  if (capacity <= 0) {
    ui.notifications.warn("Set Ammunition Max / Capacity on this weapon first.");
    return false;
  }
  if (current >= capacity) {
    ui.notifications.info(`${weapon.name} is already fully loaded.`);
    return false;
  }

  const stackCount = item => Math.max(0, Number(gp(item, "system.quantity")) || 0);
  // An empty stack is not a choice: offering it only leads to a dead end where
  // the reload reports the stack has no rounds left. Sorting by count puts the
  // stack that can actually fill the magazine first.
  const ammoItems = (actor.items?.contents ?? [])
    .filter(item => isAmmunitionItem(item, weapon) && stackCount(item) > 0)
    .sort((a, b) => stackCount(b) - stackCount(a));
  if (!ammoItems.length) {
    ui.notifications.warn("You do not have compatible ammunition in this Actor's Backpack.");
    return false;
  }

  const needed = capacity - current;
  const choice = await pickAmmunition(actor, weapon, ammoItems, needed);
  if (!choice) return false;

  // The chosen stack may hold fewer rounds than the gap, in which case the
  // weapon ends up partly loaded rather than silently drawing from another pile.
  const stock = Math.max(0, Number(gp(choice.item, "system.quantity")) || 0);
  const loaded = Math.min(choice.amount, stock, needed);
  if (loaded <= 0) {
    ui.notifications.warn(`${choice.item.name} is out of rounds.`);
    return false;
  }

  const left = stock - loaded;
  if (left > 0) await choice.item.update({ "system.quantity": left });
  else await choice.item.delete();

  const newValue = current + loaded;
  await weapon.update({ "system.ammunition": newValue });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="rnr-chat-card"><strong>${actor.name}</strong> reloads <strong>${weapon.name}</strong> with <strong>${choice.item.name}</strong>: ${loaded} round(s) loaded (${newValue}/${capacity}).</div>`,
  });
  return true;
}

// ─────────────────────────────────────────────────────────────
//  ITEM CARD & COMBAT ROLLS (dnd5e style)
// ─────────────────────────────────────────────────────────────

function getItemCombatData(actor, item) {
  const sys = item.system ?? {};
  const itemType = item.type;
  const isWeapon = itemType === "weapon";
  const isSpell = itemType === "spell";
  const isAbility = itemType === "ability";
  const isConsumable = itemType === "consumable";
  const isArmor = itemType === "armor";
  const isExtraSkill = itemType === "extraskills";

  const typeLabels = {
    weapon: "Weapon",
    armor: "Armor",
    equipment: "Equipment",
    consumable: "Consumable",
    tool: "Tool",
    loot: "Loot",
    spell: "Spell",
    ability: "Ability",
    extraskills: "Extra Skill",
    class: "Class",
    subclass: "Subclass",
    background: "Background",
    race: "Race",
    skill: "Skill",
  };
  const typeLabel = typeLabels[itemType] || itemType.toUpperCase();

  // Attribute & Attack Modifier
  const attrKey = String(sys.attribute || (isWeapon ? (sys.weaponType === "ranged" ? "dexterity" : "strength") : (isSpell ? "intellect" : "")));
  const attrLabel = ATTR_LABELS[attrKey] || attrKey;
  const attrVal = (actor && attrKey) ? actorAttributeValue(actor, attrKey) : 10;
  const attributeMod = attrKey ? attrMod(attrVal) : 0;

  const itemAtkBonus = Number(sys.attackBonus) || 0;
  let wornAtkBonus = 0, wornDmgBonus = 0;
  if (actor) {
    for (const wi of actor.items?.contents ?? []) {
      if (["armor", "equipment"].includes(wi.type) && wi.system?.equipmentSlot) {
        wornAtkBonus += Number(wi.system?.attackBonus) || 0;
        wornDmgBonus += Number(wi.system?.damageBonus) || 0;
      }
    }
  }
  // Global modifiers granted by Active Effects (manual presets / effects).
  //
  //   system.mods.attack      flat number, effects use ADD
  //   system.mods.damageFlat  flat number, effects use ADD
  //   system.mods.damage      dice fragment; authored value plus effects stack
  const modAtkBonus = actor ? Math.trunc(Number(gp(actor, "system.mods.attack")) || 0) : 0;
  const modDmgFlat  = actor ? Math.trunc(Number(gp(actor, "system.mods.damageFlat")) || 0) : 0;
  // Use raw source for the authored value because actor.system is prepared with
  // Active Effects. Each fragment is validated by rollFragment.
  const modDmgDice  = actor
    ? collectDamageDiceFragments(actor).map(rollFragment)
    : [];
  wornAtkBonus += modAtkBonus;
  wornDmgBonus += modDmgFlat;

  const totalAtkMod = attributeMod + itemAtkBonus + wornAtkBonus;
  // Items are not attacks merely because they have an attribute. Spell saves,
  // passive features, and non-combat abilities must not offer an attack roll.
  // Weapons remain attacks by definition; other items opt in explicitly.
  const hasAttack = isWeapon || sys.attackRoll === true || sys.requiresAttackRoll === true;

  // Damage
  const rawDmgFormula = String(sys.damageFormula || (typeof sys.damage === "string" ? sys.damage : sys.damage?.base?.formula) || "");
  const hasDamage = Boolean(rawDmgFormula);
  const dmgBonus = isWeapon
    ? (attributeMod + (Number(sys.damageBonus) || 0) + wornDmgBonus)
    : ((isSpell || isAbility) ? (attributeMod + (Number(sys.damageBonus) || 0)) : (Number(sys.damageBonus) || 0));
  const dmgFull = hasDamage ? buildFormula(rawDmgFormula, dmgBonus, modDmgDice) : "";
  const dmgType = String(sys.damageType || "");

  // Healing
  const healingFormula = String(sys.healingFormula || "");
  const hasHealing = Boolean(healingFormula);

  // Ammunition
  const ammo = Number(sys.ammunition);
  const hasAmmo = isWeapon && (sys.caliber !== "" || sys.weaponType === "ranged");

  return {
    sys, itemType, isWeapon, isSpell, isAbility, isConsumable, isArmor, isExtraSkill, typeLabel,
    attrKey, attrLabel, attributeMod, totalAtkMod, hasAttack,
    rawDmgFormula, hasDamage, dmgBonus, dmgFull, dmgType,
    healingFormula, hasHealing,
    ammo, hasAmmo,
    wornAtkBonus, wornDmgBonus,
  };
}

/**
 * Send an Item Card to chat (clean, dnd5e style — NO gp, NO common, NO weight).
 * Displays description/effects and contains action buttons:
 *   • [ ⚔ Attack Roll ] (if weapon or offensive spell/ability)
 *   • [ 💥 Damage Roll ] (if weapon or has damage formula)
 *   • [ 💚 Heal / Use ] (if consumable with healing)
 */
async function sendItemCard({ actor = null, item }) {
  if (!item) return;
  if (!actor && item.actor) actor = item.actor;

  const data = getItemCombatData(actor, item);
  const { sys, isWeapon, isArmor, isSpell, isAbility, isConsumable, isExtraSkill, typeLabel,
          hasAttack, hasDamage, hasHealing, dmgFull, dmgType, ammo, hasAmmo } = data;

  // ── Pills / Badges (NO gp, NO common/rarity, NO weight) ──
  const pills = [];
  if (isWeapon) {
    if (sys.weaponType) pills.push(`<span class="rnr-card-pill">${sys.weaponType.toUpperCase()}</span>`);
    if (dmgFull) pills.push(`<span class="rnr-card-pill dmg">${dmgFull}${dmgType ? " " + dmgType : ""}</span>`);
    if (sys.range) pills.push(`<span class="rnr-card-pill">🎯 ${sys.range}</span>`);
    if (sys.reach) pills.push(`<span class="rnr-card-pill">Reach ${sys.reach}ft</span>`);
    if (sys.caliber) pills.push(`<span class="rnr-card-pill">Caliber ${sys.caliber}</span>`);
    if (hasAmmo) pills.push(`<span class="rnr-card-pill">Ammo ${ammo}${sys.ammunitionMax ? `/${sys.ammunitionMax}` : ""}</span>`);
  } else if (isArmor) {
    if (sys.armorType) pills.push(`<span class="rnr-card-pill">${sys.armorType.toUpperCase()}</span>`);
    const dr = sys.armorValue ?? sys.armorDamageReduction;
    if (dr) pills.push(`<span class="rnr-card-pill">🛡 DR +${dr}</span>`);
    if (sys.equipmentSlot || sys.allowedSlot) pills.push(`<span class="rnr-card-pill">Slot: ${sys.equipmentSlot || sys.allowedSlot}</span>`);
    if (sys.speedPenalty) pills.push(`<span class="rnr-card-pill">Speed -${sys.speedPenalty}</span>`);
  } else if (isSpell || isAbility) {
    if (sys.spellLevel !== undefined && sys.spellLevel !== null && sys.spellLevel !== "") pills.push(`<span class="rnr-card-pill">Level ${sys.spellLevel}</span>`);
    if (sys.wpCost || sys.willpowerCost) pills.push(`<span class="rnr-card-pill">WP ${sys.wpCost || sys.willpowerCost}</span>`);
    if (dmgFull) pills.push(`<span class="rnr-card-pill dmg">${dmgFull}${dmgType ? " " + dmgType : ""}</span>`);
    if (sys.range) pills.push(`<span class="rnr-card-pill">Range ${sys.range}</span>`);
    if (sys.duration) pills.push(`<span class="rnr-card-pill">Duration ${sys.duration}</span>`);
    if (sys.target) pills.push(`<span class="rnr-card-pill">Target ${sys.target}</span>`);
  } else if (isConsumable) {
    if (sys.consumableType) pills.push(`<span class="rnr-card-pill">${sys.consumableType}</span>`);
    if (data.healingFormula) pills.push(`<span class="rnr-card-pill heal">${data.healingFormula} Healing</span>`);
    if (dmgFull) pills.push(`<span class="rnr-card-pill dmg">${dmgFull}${dmgType ? " " + dmgType : ""}</span>`);
    if (sys.quantity) pills.push(`<span class="rnr-card-pill">Qty: ${sys.quantity}</span>`);
  } else if (isExtraSkill) {
    if (sys.category) pills.push(`<span class="rnr-card-pill">${sys.category}</span>`);
    if (sys.bonus) pills.push(`<span class="rnr-card-pill">+${sys.bonus} Bonus</span>`);
  }
  const actionLabel = actionTypeLabel(item);
  if (actionLabel) pills.push(`<span class="rnr-card-pill">${foundry.utils.escapeHTML(actionLabel)}</span>`);

  const pillsHtml = pills.length ? `<div class="rnr-card-pills">${pills.join("")}</div>` : "";

  // ── Description / Details ──
  const descRaw = sys.description?.value || sys.description || sys.effect || sys.benefit || sys.traits || "";
  const descHtml = descRaw ? `<div class="rnr-card-detail">${descRaw}</div>` : "";

  // ── Action Buttons inside the Item Card ──
  let actionsHtml = "";
  const buttons = [];
  if (hasAttack) {
    buttons.push(`<button type="button" class="rnr-card-btn rnr-btn-attack" data-action="roll-item-attack" data-actor-id="${actor?.id || ""}" data-item-id="${item.id}" title="Roll attack (Shift+Click to choose Normal/Advantage/Disadvantage)">⚔ Attack Roll</button>`);
  }
  // Damage is only offered up front for items that cannot attack. Anything with
  // an attack reaches its damage roll through the attack card instead.
  if (hasDamage && !hasAttack) {
    buttons.push(`<button type="button" class="rnr-card-btn rnr-btn-damage" data-action="roll-item-damage" data-actor-id="${actor?.id || ""}" data-item-id="${item.id}">💥 Damage Roll</button>`);
  }
  if (hasHealing) {
    buttons.push(`<button type="button" class="rnr-card-btn rnr-btn-heal" data-action="roll-item-healing" data-actor-id="${actor?.id || ""}" data-item-id="${item.id}">💚 Heal / Use</button>`);
  }
  // Reload is offered whenever the weapon has a magazine that is not full, not
  // only when it is empty: topping up between fights is the common case, and
  // making the player empty the weapon first to reach the button would be
  // backwards.
  if (hasAmmo && Number(sys.ammunitionMax) > 0) {
    buttons.push(`<button type="button" class="rnr-card-btn rnr-btn-reload" data-action="reload-item" data-actor-id="${actor?.id || ""}" data-item-id="${item.id}" title="Load ammunition (${ammo}/${sys.ammunitionMax})">↻ Reload (${ammo}/${sys.ammunitionMax})</button>`);
  }
  if (buttons.length) {
    actionsHtml = `<div class="rnr-card-actions">${buttons.join("")}</div>`;
  }

  const aImg = actor?.img || item.img || "icons/svg/mystery-man.svg";
  const actorName = actor?.name || "";

  const content = `
<div class="rnr-chat-card">
  <div class="rnr-card-header">
    <img src="${aImg}" />
    <div>
      ${actorName ? `<strong>${actorName}</strong>` : ""}
      <span class="rnr-card-item-title"><img src="${item.img}" class="rnr-card-item-icon" /> ${item.name}</span>
      <em>${typeLabel}</em>
    </div>
  </div>
  ${pillsHtml}
  ${descHtml}
  ${actionsHtml}
</div>`;

  await ChatMessage.create({
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : { alias: item.name },
    content,
  });
}

/**
 * Rolls Attack for an item when clicked from the Chat Card or directly.
 */
function defenseOwnerId(actor) {
  const owner = (game.users?.contents ?? []).find(user => user.active && !user.isGM && actor?.testUserPermission?.(user, "OWNER"));
  return owner?.id || "";
}

function actorOwnerUserIds(actor) {
  return (game.users?.contents ?? [])
    .filter(user => !user.isGM && actor?.testUserPermission?.(user, "OWNER"))
    .map(user => user.id);
}

async function createAttackChallenge({ actor, item, targetActor, totalAttack, keptDie, droppedDie, isCrit, rolls, attrLabel, totalAtkMod, typeLabel }) {
  const allowedUserId = defenseOwnerId(targetActor);
  const attackerUserId = game.user.id;
  const challengeId = foundry.utils.randomID();
  const canDefend = (targetActor.items?.contents ?? []).some(candidate => candidate.type === "weapon" && ["left", "right"].includes(String(candidate.system?.handSlot || "")) && organUsable(targetActor, candidate.system.handSlot === "left" ? "leftHand" : "rightHand") && getItemCombatData(targetActor, candidate).hasAttack);
  const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
  const content = `<div class="rnr-chat-card ${isCrit ? "rnr-card-crit" : ""}">
    <div class="rnr-card-header"><img src="${actor?.img || item.img || "icons/svg/mystery-man.svg"}" /><div><strong>${esc(actor?.name || "")}</strong><span class="rnr-card-item-title">⚔ Attack — ${esc(item.name)}</span><em>${esc(typeLabel)}</em></div></div>
    <div class="rnr-card-target">🎯 Target: <strong>${esc(targetActor.name)}</strong></div>
    <div class="rnr-card-dice"><span class="rnr-card-d20 ${isCrit ? "crit" : ""}">${keptDie}</span>${droppedDie !== null ? `<span class="rnr-card-d20 dropped">${droppedDie}</span>` : ""}<span class="rnr-card-total">${totalAttack} <small>(${signed(totalAtkMod)} ${esc(attrLabel)})</small></span></div>
    <div class="rnr-card-defense-pending"><strong>Defense required</strong><span>${esc(targetActor.name)} must choose Defend, Dodge, or Take the Hit.</span></div>
    <div class="rnr-card-actions">
      ${canDefend ? `<button type="button" class="rnr-card-btn" data-action="defense-choice" data-choice="defend" data-defense-id="${challengeId}" data-attacker-user-id="${attackerUserId}" data-allowed-user-id="${allowedUserId}" data-target-actor-id="${targetActor.id}" data-attacker-actor-id="${actor?.id || ""}" data-item-id="${item.id}" data-attack-total="${totalAttack}" data-is-crit="${isCrit}">⚔ Defend</button>` : ""}
      <button type="button" class="rnr-card-btn" data-action="defense-choice" data-choice="dodge" data-defense-id="${challengeId}" data-attacker-user-id="${attackerUserId}" data-allowed-user-id="${allowedUserId}" data-target-actor-id="${targetActor.id}" data-attacker-actor-id="${actor?.id || ""}" data-item-id="${item.id}" data-attack-total="${totalAttack}" data-is-crit="${isCrit}">↝ Dodge / Reflex</button>
      <button type="button" class="rnr-card-btn" data-action="defense-choice" data-choice="none" data-defense-id="${challengeId}" data-attacker-user-id="${attackerUserId}" data-allowed-user-id="${allowedUserId}" data-target-actor-id="${targetActor.id}" data-attacker-actor-id="${actor?.id || ""}" data-item-id="${item.id}" data-attack-total="${totalAttack}" data-is-crit="${isCrit}">Take the Hit</button>
    </div>
  </div>`;
  await ChatMessage.create({ speaker: actor ? ChatMessage.getSpeaker({ actor }) : { alias: item.name }, content, rolls });
}

/**
 * Find an Actor by id: World Actors first, then unlinked token Actors on the
 * canvas. Shared by the chat-card render hook and the defense resolver; the hook
 * used to call this while it only existed inside handleDefenseChoice, which threw
 * and left every button on a defense card without a click handler.
 */
function resolveActor(id) {
  if (!id) return null;
  return game.actors?.get(id)
    ?? (canvas?.tokens?.placeables ?? []).find(token => token.actor?.id === id)?.actor
    ?? null;
}

async function handleDefenseChoice(message, choice, button) {
  const targetActor = resolveActor(button.dataset.targetActorId);
  const attacker = resolveActor(button.dataset.attackerActorId);
  const item = attacker?.items?.get(button.dataset.itemId);
  const attackTotal = Number(button.dataset.attackTotal) || 0;
  const isCrit = button.dataset.isCrit === "true";
  const challengeId = String(button.dataset.defenseId || "");
  if (!targetActor || !attacker || !item) { ui.notifications.warn("The attack data is no longer available."); return; }
  if (!game.user.isGM && !targetActor.isOwner && !targetActor.testUserPermission?.(game.user, "OWNER")) {
    ui.notifications.warn("Only the targeted character's owner can choose a defense.");
    return false;
  }
  const state = defenseState(targetActor);
  if (challengeId && state.lastChallengeId === challengeId) { ui.notifications.warn("This defense challenge has already been resolved."); return; }
  const maxUses = 1 + extraDefenseUses(targetActor);
  if (choice !== "none" && state.defensesUsed >= maxUses) { ui.notifications.warn("Defense has already been used this turn."); return; }
  const hands = (targetActor.items?.contents ?? []).filter(candidate => candidate.type === "weapon" && ["left", "right"].includes(String(candidate.system?.handSlot || ""))).filter(candidate => organUsable(targetActor, candidate.system.handSlot === "left" ? "leftHand" : "rightHand"));
  const defenseWeapon = hands.find(candidate => getItemCombatData(targetActor, candidate).hasAttack);
  let total = null, naturalDie = null, success = false, counter = false, automatic = null;
  if (choice === "defend" && defenseWeapon) {
    const data = getItemCombatData(targetActor, defenseWeapon);
    const defenseRoll = await new Roll(buildFormula("1d20", data.totalAtkMod + conditionRollPenalty(targetActor))).evaluate();
    total = defenseRoll.total;
    naturalDie = defenseRoll.dice[0]?.results[0]?.result ?? defenseRoll.total;
    ({ success, automatic } = resolveDefenseRoll(naturalDie, total, attackTotal));
  } else if (choice === "dodge") {
    const reflexRoll = await rollReflex(targetActor);
    total = reflexRoll.total;
    naturalDie = reflexRoll.die;
    ({ success, automatic } = resolveDefenseRoll(naturalDie, total, attackTotal));
    counter = success && total > attackTotal && !state.counterUsed && Boolean(defenseWeapon);
  }
  await targetActor.update({ "system.combatDefense": { ...state, defensesUsed: state.defensesUsed + (choice === "none" ? 0 : 1), counterUsed: state.counterUsed || counter, lastChallengeId: challengeId } });
  const automaticNote = automatic === "natural-20"
    ? " — Natural 20, automatic success"
    : automatic === "natural-1"
      ? " — Natural 1, automatic failure"
      : "";
  const defenseLabel = choice === "defend"
    ? `Defend ${total ?? "unavailable"}${automaticNote}`
    : choice === "dodge"
      ? `Reflex ${total}${automaticNote}`
      : "Take the Hit";
  const hit = choice === "none" || !success;
  const allowedAttacker = button.dataset.attackerUserId || message.user?.id || message.author?.id || "";
  const damage = hit ? `<button type="button" class="rnr-card-btn" data-action="roll-item-damage" data-allowed-user-id="${allowedAttacker}" data-actor-id="${attacker.id}" data-item-id="${item.id}" data-target-actor-id="${targetActor.id}" data-is-crit="${isCrit}">💥 Damage Roll${isCrit ? " (Critical)" : ""}</button>` : `<span class="rnr-card-outcome-note">No damage — attack was stopped.</span>`;
  const counterButton = counter ? `<button type="button" class="rnr-card-btn" data-action="counterattack" data-allowed-user-id="${game.user.id}" data-actor-id="${targetActor.id}" data-item-id="${defenseWeapon.id}" data-counter-target-actor-id="${attacker.id}">↻ Counterattack</button>` : "";
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: targetActor }), content: `<div class="rnr-chat-card"><div class="rnr-card-target"><strong>${hit ? "🎯 HIT" : "💨 DEFENDED / DODGED"}</strong><span>vs ${foundry.utils.escapeHTML(targetActor.name)} · ${defenseLabel}${counter ? " · ↻ COUNTERATTACK AVAILABLE" : ""}</span></div><div class="rnr-card-actions">${damage}${counterButton}</div></div>` });
  return true;
}

async function rollItemAttack(actor, item, { mode = null, skipDialog = false } = {}) {
  if (!item) return;
  if (!actor && item.actor) actor = item.actor;

  const data = getItemCombatData(actor, item);
  const { totalAtkMod, attrLabel, hasAmmo, ammo, wornAtkBonus, wornDmgBonus, typeLabel } = data;

  // An empty weapon cannot attack, so rather than warn and leave the player to
  // find the reload control, offer it here - this is the point where the player
  // discovers they are out of rounds. Reload only, no attack: spending an ammo
  // stack without rolling would hide the cost of the action.
  if (hasAmmo && ammo <= 0) {
    ui.notifications.warn(`${item.name} is empty. Choose ammunition to load.`);
    await reloadWeapon(actor, item);
    return;
  }

  const conditionPenalty = conditionRollPenalty(actor);

  const executeAttack = async (selectedMode) => {
    const rollMode = selectedMode;
    const atkMod = totalAtkMod + conditionPenalty;
    const atkFmla = buildFormula("1d20", atkMod);
    const r1 = await new Roll(atkFmla).evaluate();
    const r2 = rollMode !== "normal" ? await new Roll(atkFmla).evaluate() : null;
    const rolls = r2 ? [r1, r2] : [r1];

    const d1 = r1.dice[0]?.results[0]?.result ?? r1.total;
    const d2 = r2?.dice[0]?.results[0]?.result ?? null;
    const keptDie = r2 ? (rollMode === "advantage" ? Math.max(d1, d2) : Math.min(d1, d2)) : d1;
    const droppedDie = r2 ? (rollMode === "advantage" ? Math.min(d1, d2) : Math.max(d1, d2)) : null;
    const totalAttack = r2 ? (rollMode === "advantage" ? Math.max(r1.total, r2.total) : Math.min(r1.total, r2.total)) : r1.total;
    const isCrit = keptDie === 20;
    const isFail = keptDie === 1;

    if (hasAmmo && ammo > 0) await item.update({ "system.ammunition": ammo - 1 });

    // Let the defender choose weapon defense or Reflex dodge.
    const targetToken = [...(game.user.targets ?? [])][0];
    if (targetToken?.actor) {
      await createAttackChallenge({ actor, item, targetActor: targetToken.actor, totalAttack, keptDie, droppedDie, isCrit, rolls, attrLabel, totalAtkMod, typeLabel });
      return;
    }

    const modStr = signed(totalAtkMod);
    const hitText = "";

    const modeTag = rollMode === "advantage"
      ? `<span class="rnr-card-mode adv">ADV</span>`
      : rollMode === "disadvantage"
      ? `<span class="rnr-card-mode dis">DIS</span>`
      : "";

    const aImg = actor?.img || item.img || "icons/svg/mystery-man.svg";
    const actorName = actor?.name || "";

    const content = `
<div class="rnr-chat-card ${isCrit ? "rnr-card-crit" : isFail ? "rnr-card-fail" : ""}">
  <div class="rnr-card-header">
    <img src="${aImg}" />
    <div>
      ${actorName ? `<strong>${actorName}</strong>` : ""}
      <span class="rnr-card-item-title"><img src="${item.img}" class="rnr-card-item-icon" /> ⚔ Attack — ${item.name}</span>
      <em>${typeLabel}</em>
    </div>
    ${modeTag}
  </div>
  ${hitText}
  <div class="rnr-card-dice">
    <span class="rnr-card-d20 ${isCrit ? "crit" : isFail ? "fail" : ""}">${keptDie}</span>
    ${droppedDie !== null ? `<span class="rnr-card-d20 dropped">${droppedDie}</span>` : ""}
    <span class="rnr-card-total">${totalAttack} <small>(${modStr} ${attrLabel})</small></span>
    ${isCrit ? `<span class="rnr-card-label crit">CRITICAL!</span>` : ""}
    ${isFail ? `<span class="rnr-card-label fail">FUMBLE</span>` : ""}
  </div>
  <div class="rnr-card-actions">
    <button type="button" class="rnr-card-btn rnr-btn-damage" data-action="roll-item-damage" data-actor-id="${actor?.id || ""}" data-item-id="${item.id}" data-is-crit="${isCrit}">💥 Damage Roll${isCrit ? " (Critical)" : ""}</button>
  </div>
</div>`;

    await ChatMessage.create({
      speaker: actor ? ChatMessage.getSpeaker({ actor }) : { alias: item.name },
      content,
      rolls,
    });
  };

  if (skipDialog) {
    await executeAttack(mode || "normal");
    return;
  }

  const ammoLine = hasAmmo ? `<br><small>Ammo: <strong>${ammo}</strong></small>` : "";
  const wornLine = wornAtkBonus !== 0 || wornDmgBonus !== 0
    ? `<br><small>Worn bonus: Atk ${signed(wornAtkBonus)} / Dmg ${signed(wornDmgBonus)}</small>`
    : "";

  await waitRnRDialog({
    window: { title: `⚔ Attack — ${item.name}` },
    content: `
<div class="rnr-roll-mode-dialog">
  <p class="rnr-roll-mode-label">Roll Mode</p>
  <div class="rnr-roll-mode-row">
    <label><input type="radio" name="mode" value="normal" checked> Normal</label>
    <label><input type="radio" name="mode" value="advantage"> Advantage</label>
    <label><input type="radio" name="mode" value="disadvantage"> Disadvantage</label>
  </div>
  <p class="rnr-roll-mode-hint">
    Attack: <strong>${signed(totalAtkMod)}</strong> (${attrLabel})
    ${ammoLine}${wornLine}
  </p>
 </div>`,
    buttons: [
      ...(hasAmmo ? [{ action: "reload", label: "↻ Reload", callback: async () => { await reloadWeapon(actor, item); } }] : []),
      {
        action: "attack",
        label: "⚔ Attack Roll",
        default: true,
        callback: async (_event, button) => {
          const selectedMode = button.form?.querySelector("input[name=mode]:checked")?.value ?? "normal";
          await executeAttack(selectedMode);
        },
      },
      { action: "cancel", label: "Cancel" },
    ],
  });
}

/**
 * Rolls Damage for an item when clicked from the Chat Card.
 */
async function rollItemDamage(actor, item, { isCrit = false, targetActorId = "", attackerUserId = "" } = {}) {
  if (!item) return;
  if (!actor && item.actor) actor = item.actor;

  const data = getItemCombatData(actor, item);
  const { dmgFull, dmgType } = data;
  if (!dmgFull) {
    ui.notifications.warn("This item has no damage formula.");
    return;
  }

  const finalFormula = isCrit ? criticalFormula(dmgFull) : dmgFull;
  const dmgRoll = await new Roll(finalFormula).evaluate();

  const aImg = actor?.img || item.img || "icons/svg/mystery-man.svg";
  const actorName = actor?.name || "";

  const content = `
<div class="rnr-chat-card">
  <div class="rnr-card-header">
    <img src="${aImg}" />
    <div>
      ${actorName ? `<strong>${actorName}</strong>` : ""}
      <span class="rnr-card-item-title"><img src="${item.img}" class="rnr-card-item-icon" /> 💥 Damage — ${item.name}</span>
      <em>${dmgType ? dmgType.toUpperCase() : "DAMAGE"}</em>
    </div>
  </div>
  <div class="rnr-card-damage-block">
    <div>
      <div class="rnr-card-damage-total">${dmgRoll.total}</div>
      <div class="rnr-card-damage-formula">${finalFormula}${dmgType ? ` · ${dmgType}` : ""}${isCrit ? " [CRITICAL]" : ""}</div>
    </div>
  </div>
</div>`;

  if (targetActorId) {
    const targetActor = game.actors.get(targetActorId)
      ?? (canvas.tokens?.placeables ?? []).find(token => token.actor?.id === targetActorId)?.actor
      ?? null;
    const gmIds = (game.users?.contents ?? []).filter(user => user.isGM).map(user => user.id);
    const attackerRecipients = [...new Set([game.user.id, attackerUserId, ...gmIds].filter(Boolean))];
    await ChatMessage.create({
      speaker: actor ? ChatMessage.getSpeaker({ actor }) : { alias: item.name },
      content,
      rolls: [dmgRoll],
      whisper: attackerRecipients,
    });
    if (!targetActor) {
      ui.notifications.warn("Damage was rolled privately, but the target Actor is no longer available for application.");
      return;
    }

    const targetRecipients = [...new Set([...actorOwnerUserIds(targetActor), ...gmIds])];
    const escapedType = foundry.utils.escapeHTML(dmgType);
    const applyContent = `<div class="rnr-chat-card"><div class="rnr-card-header"><div><strong>${foundry.utils.escapeHTML(targetActor.name)}</strong><span>Incoming damage application</span></div></div><p>An attack hit this Actor. Apply the result once.</p><div class="rnr-card-actions"><button type="button" class="rnr-card-btn" data-action="apply-damage" data-amount="${dmgRoll.total}" data-damage-type="${escapedType}" data-target-actor-id="${targetActor.id}">⚔ Apply Damage</button><button type="button" class="rnr-card-btn" data-action="apply-half-damage" data-amount="${dmgRoll.total}" data-damage-type="${escapedType}" data-target-actor-id="${targetActor.id}">🛡 Half Damage</button></div></div>`;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: targetActor }),
      content: applyContent,
      whisper: targetRecipients,
    });
    return;
  }

  const actionButtons = `<div class="rnr-card-actions"><button type="button" class="rnr-card-btn apply-dmg" data-action="apply-damage" data-amount="${dmgRoll.total}" data-damage-type="${foundry.utils.escapeHTML(dmgType)}">⚔ Apply Damage</button><button type="button" class="rnr-card-btn apply-half" data-action="apply-half-damage" data-amount="${dmgRoll.total}" data-damage-type="${foundry.utils.escapeHTML(dmgType)}">🛡 Half Damage</button></div>`;
  const contentWithActions = content.replace(/<\/div>$/, `${actionButtons}</div>`);

  await ChatMessage.create({
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : { alias: item.name },
    content: contentWithActions,
    rolls: [dmgRoll],
  });
}

/**
 * Rolls Healing for a consumable item.
 */
async function rollItemHealing(actor, item) {
  if (!item) return;
  if (!actor && item.actor) actor = item.actor;

  const data = getItemCombatData(actor, item);
  const { healingFormula, isConsumable } = data;
  if (!healingFormula) return;

  const healRoll = await new Roll(healingFormula).evaluate();
  if (isConsumable) {
    await consumeItem(item, 1);
  }

  const aImg = actor?.img || item.img || "icons/svg/mystery-man.svg";
  const actorName = actor?.name || "";

  const content = `
<div class="rnr-chat-card">
  <div class="rnr-card-header">
    <img src="${aImg}" />
    <div>
      ${actorName ? `<strong>${actorName}</strong>` : ""}
      <span class="rnr-card-item-title"><img src="${item.img}" class="rnr-card-item-icon" /> 💚 ${item.name}</span>
      <em>HEALING</em>
    </div>
  </div>
  <div class="rnr-card-damage-block healing">
    <div>
      <div class="rnr-card-damage-total" style="color:#86efac">+${healRoll.total} HP</div>
      <div class="rnr-card-damage-formula">${healingFormula}</div>
    </div>
  </div>
  <div class="rnr-card-actions">
    <button type="button" class="rnr-card-btn apply-heal" data-action="apply-healing" data-amount="${healRoll.total}">💚 Apply Healing</button>
  </div>
</div>`;

  await ChatMessage.create({
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : { alias: item.name },
    content,
    rolls: [healRoll],
  });
}

async function weaponAttackDialog(actor, item) {
  return sendItemCard({ actor, item });
}

async function abilityRollDialog(actor, item) {
  return sendItemCard({ actor, item });
}

/**
 * Unified entry point for every "use this item" click path: sheet buttons,
 * hand-slot bodies, item names, the item sheet chat button, and the ✓ button on
 * an active slot in the Features bar.
 *
 * A plain click never rolls on its own: it posts the item's card to chat, and the
 * Attack / Damage / Healing / Reload buttons on that card are the only things that
 * roll. That keeps chat readable, because looking at a sword and swinging it are
 * two different intentions. An explicit `intent` (from a button that names its
 * action) skips the card and goes straight to that roll.
 *
 *   click           → post the card
 *   shift+click     → post the card, but open the Roll Mode dialog first
 *                     (Normal/Advantage/Disadvantage)
 *   intent:"attack" → roll the attack now
 *
 * Offensive items roll an attack and post an attack card; the damage roll is
 * then made from that card so a critical carries over into the damage dice.
 */
async function itemRollFlow(actor, item, { openDialog = false, intent = null } = {}) {
  if (!item) return;
  if (!actor && item.actor) actor = item.actor;

  const data = getItemCombatData(actor, item);
  const { isConsumable, hasAttack, hasHealing, hasAmmo, ammo } = data;

  // A plain click on an item shows its card and stops there. The card is the
  // only place the effect text, range, duration, save details and the reload
  // control appear, and its own buttons cover every case - attack, damage,
  // healing, reload. Rolling straight through on a click hid all of that and
  // spent ammunition or a consumable charge before the player had seen what the
  // item actually did.
  //
  // The ways to go straight to a roll are explicit instead:
  //   intent "attack"  the sheet's ⚔ button, and Shift+Click on a row
  //   intent "use"     a consumable's ✓ button
  const wants = intent ?? (openDialog ? "attack" : null);
  if (!wants) {
    await sendItemCard({ actor, item });
    return;
  }

  // Reload first when the weapon is dry: there is nothing to roll, and this is
  // where the player finds out they are out of rounds.
  if (wants === "attack" && hasAmmo && ammo <= 0) {
    await reloadWeapon(actor, item);
    return;
  }
  if (wants === "attack" && hasAttack) {
    // Shift+Click asks for the Normal/Advantage/Disadvantage choice; the ⚔
    // button takes the default and rolls immediately.
    await rollItemAttack(actor, item, { skipDialog: !openDialog });
    return;
  }
  if (wants === "use" && hasHealing && isConsumable) {
    await rollItemHealing(actor, item);
    return;
  }
  // The item has no roll of its own, so the card is still the right answer.
  await sendItemCard({ actor, item });
}

// ─────────────────────────────────────────────────────────────
//  DOWN & RECOVERY
// ─────────────────────────────────────────────────────────────

/**
 * RnR's incapacitated model, replacing dnd5e's three-successes / three-failures
 * death save.
 *
 * The old track was pure dnd5e: count three successes to become "stable", count
 * three failures to die, and a natural 20 or 1 jumped the counter by two. None
 * of that is genre-neutral, and it left no room for the common case where a
 * companion drags you somewhere safe and patches you up.
 *
 * The replacement is a two-track model:
 *   - `rounds`   how long the character has been down. A configurable threshold
 *                prompts the GM to escalate; it never kills on its own.
 *   - `recovery` progress toward standing back up, earned by treating, First
 *                Aid, a healing item, or a successful recovery roll.
 *
 * `state` is one of: active | recovering | recovered | deceased
 */
const DEATH_STATES = Object.freeze({
  HEALTHY:    "healthy",    // normal, nothing to do
  ACTIVE:     "active",     // down and out
  RECOVERING: "recovering",  // progress made, still down
  RECOVERED:  "recovered",  // back on their feet after a recovery roll
  DECEASED:   "deceased",   // out of the story
});

function deathSetting(key, fallback) {
  const raw = Number(globalThis.game?.settings?.get("RnR", key));
  return Number.isFinite(raw) ? raw : fallback;
}

function deathSnapshot(actor) {
  return {
    // A missing state means the actor is fine. Defaulting to ACTIVE here used to
    // drop every brand-new character straight into the Down panel.
    state:    gp(actor, "system.death.state") || DEATH_STATES.HEALTHY,
    rounds:   Number(gp(actor, "system.death.rounds")) || 0,
    recovery: Number(gp(actor, "system.death.recovery")) || 0,
  };
}

/** Mark an actor as down. Called when health reaches zero. */
async function markDown(actor) {
  const snap = deathSnapshot(actor);
  if (snap.state === DEATH_STATES.DECEASED) return;
  const updates = { "system.death.state": DEATH_STATES.ACTIVE };
  if (snap.rounds === 0) updates["system.death.rounds"] = 1;
  await actor.update(updates);
  await syncTokenConditions(actor);
}

/** Clear the down state and put a character back on their feet. */
async function markRecovered(actor, { restoreStates = true } = {}) {
  const updates = {
    "system.death.state": DEATH_STATES.RECOVERED,
    "system.death.rounds": 0,
    "system.death.recovery": 0,
  };
  await actor.update(updates);
  if (restoreStates) {
    const active = new Set(gp(actor, "system.conditions.physicalStates.active") || []);
    active.delete("unconscious");
    await actor.update({ "system.conditions.physicalStates.active": [...active] });
  }
  await syncTokenConditions(actor);
}

/**
 * Roll to make recovery progress while down.
 *
 * The roll itself is plain: meet the DC for one step of progress, beat it by
 * 10 for two. A natural 20 is honoured because every dice system grants it, but
 * nothing about this track is a dnd5e import.
 */
async function rollDeathRecovery(actor) {
  const snap = deathSnapshot(actor);
  if (snap.state === DEATH_STATES.DECEASED) {
    ui.notifications.warn(`${actor.name} has deceased — there is nothing left to recover.`);
    return;
  }
  if (snap.state === DEATH_STATES.RECOVERED) {
    ui.notifications.info(`${actor.name} is already back on their feet.`);
    return;
  }

  const dc      = deathSetting("deathRecoveryDC", 10);
  const needed  = Math.max(1, deathSetting("deathRecoverySteps", 2));
  const escalate = Math.max(1, deathSetting("deathEscalationRounds", 3));
  const hpFloor = deathSetting("deathRecoveryHP", 1);

  const roll   = await new Roll(buildFormula("1d20")).evaluate();
  const total  = roll.total;
  const natural = total === 20;

  let gained = 0;
  let note;
  if (natural) { gained = 2; note = "Natural 20 — two steps of recovery."; }
  else if (total >= dc + 10) { gained = 2; note = `Beats the DC by 10 — two steps.`; }
  else if (total >= dc) { gained = 1; note = "Success — one step."; }
  else { note = `Below the DC of ${dc} — no progress.`; }

  const recovery = snap.recovery + gained;
  const rounds   = snap.rounds + (gained ? 0 : 1);

  const updates = {
    "system.death.recovery": recovery,
    "system.death.rounds":   rounds,
    "system.death.state":    recovery > 0 ? DEATH_STATES.RECOVERING : DEATH_STATES.ACTIVE,
  };

  let outcome = "";
  if (recovery >= needed) {
    updates["system.death.state"] = DEATH_STATES.RECOVERED;
    const hpCur  = Number(gp(actor, "system.vitals.health.value")) || 0;
    const hpMax  = Number(gp(actor, "system.vitals.health.max")) || 1;
    updates["system.vitals.health.value"] = Math.min(hpMax, Math.max(hpCur, hpFloor));
    outcome = `<strong class="rnr-stable">BACK UP — ${actor.name} is on their feet.</strong>`;
  } else if (rounds >= escalate) {
    outcome = `<strong class="rnr-danger">This has gone on for ${rounds} rounds — the GM decides what happens next.</strong>`;
  }

  await actor.update(updates);
  if (updates["system.death.state"] === DEATH_STATES.RECOVERED) await markRecovered(actor);

  const step = (n, filled) =>
    `<span class="rnr-death-pip ${filled ? "success" : ""}">${filled ? "●" : "○"}</span>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
<div class="rnr-chat-card ${gained ? "" : "rnr-card-fail"}">
  <div class="rnr-card-header"><img src="${actor.img}"/>
    <div><strong>${actor.name}</strong><span>Recovery — DC ${dc}</span></div>
  </div>
  <div class="rnr-card-dice">
    <span class="rnr-card-d20 ${natural ? "crit" : ""}">${total}</span>
    <span class="rnr-card-total">${note}</span>
  </div>
  <div class="rnr-card-detail">
    Recovery: ${Array.from({ length: needed }, (_, i) => step(i, i < recovery)).join("")}
    &nbsp; Rounds down: <strong>${rounds}</strong>
    ${outcome ? `<br>${outcome}` : ""}
  </div>
</div>`,
    rolls: [roll],
  });
}

/** Declare an actor deceased. GM only, never automatic. */
async function markDeceased(actor) {
  await actor.update({
    "system.death.state": DEATH_STATES.DECEASED,
    "system.conditions.physicalStates.active": ["dead"],
  });
  await syncTokenConditions(actor);
}

// ─────────────────────────────────────────────────────────────
//  REST DIALOG
// ─────────────────────────────────────────────────────────────

async function restDialog(actor) {
  const hitDiceMax = Math.max(1, Number(gp(actor, "system.identity.hitDiceMax")) || Number(gp(actor, "system.identity.hitDice")) || 3);
  const hitDiceCur = Math.max(0, Number(gp(actor, "system.identity.hitDice")) ?? hitDiceMax);
  const tghMod     = attrMod(gp(actor, "system.attributes.toughness.value") || 8);
  const hpCur      = Number(gp(actor, "system.vitals.health.value"))    || 0;
  const hpMax      = Number(gp(actor, "system.vitals.health.max"))      || 10;
  const wpCur      = Number(gp(actor, "system.vitals.willPower.value")) || 0;
  const wpMax      = Number(gp(actor, "system.vitals.willPower.max"))   || 8;

  await waitRnRDialog({
    window: { title: "Rest" },
    content: `
<div class="rnr-rest-dialog">
  <div class="rnr-rest-option">
    <h3>☽ Short Rest</h3>
    <p>Spend Hit Dice to recover HP. Roll 1d6 + Toughness (${signed(tghMod)}) per die.</p>
    <label>Hit Dice <input id="rnr-rest-hd" type="number" min="0" max="${hitDiceCur}" value="${hitDiceCur > 0 ? 1 : 0}" />
      <small>/ ${hitDiceCur} (Max: ${hitDiceMax})</small>
    </label>
    <p class="rnr-rest-hint">WillPower recovers ½ max.</p>
  </div>
  <hr/>
  <div class="rnr-rest-option">
    <h3>🌙 Long Rest</h3>
    <p>Fully restore HP, WillPower, recover Hit Dice, and clear exhaustion.</p>
  </div>
 </div>`,
    buttons: [
      {
        action: "short",
        label: "☽ Short Rest",
        default: true,
        callback: async (_event, button) => {
          const dice = Math.max(0, Math.min(hitDiceCur, Number(button.form?.querySelector("#rnr-rest-hd")?.value) || 0));
          if (!dice) { ui.notifications.info("No Hit Dice spent."); return; }
          let total = 0; const parts = [];
          for (let i = 0; i < dice; i++) {
            const r = await new Roll(tghMod >= 0 ? `1d6+${tghMod}` : `1d6${tghMod}`).evaluate();
            total += Math.max(1, r.total); parts.push(r.total);
          }
          const newHp = Math.min(hpMax, hpCur + total);
          const newWp = Math.min(wpMax, wpCur + Math.floor(wpMax / 2));
          const newHd = Math.max(0, hitDiceCur - dice);
          await actor.update({
            "system.vitals.health.value": newHp,
            "system.vitals.willPower.value": newWp,
            "system.identity.hitDice": newHd,
          });
          ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content:
            `<div class="rnr-chat-card"><div class="rnr-card-header"><img src="${actor.img}"/><div><strong>${actor.name}</strong><span>☽ Short Rest</span></div></div><div class="rnr-card-detail">Spent <strong>${dice}</strong> Hit Dice → +<strong>${total}</strong> HP (${parts.join(", ")})<br>HP ${hpCur}→${newHp}/${hpMax} · WP ${wpCur}→${newWp}/${wpMax}<br>Hit Dice remaining: ${newHd}/${hitDiceMax}</div></div>` });
        },
      },
      {
        action: "long",
        label: "🌙 Long Rest",
        callback: async () => {
          await actor.update({
            "system.vitals.health.value":    hpMax,
            "system.vitals.willPower.value": wpMax,
            "system.identity.hitDice":       hitDiceMax,
            "system.exhaustion":             0,
            "system.death.state":    DEATH_STATES.HEALTHY,
            "system.death.rounds":   0,
            "system.death.recovery": 0,
          });
          ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content:
            `<div class="rnr-chat-card"><div class="rnr-card-header"><img src="${actor.img}"/><div><strong>${actor.name}</strong><span>🌙 Long Rest</span></div></div><div class="rnr-card-detail">HP, WillPower, and Hit Dice fully restored (${hitDiceMax}/${hitDiceMax}).</div></div>` });
        },
      },
      { action: "cancel", label: "Cancel" },
    ],
  });
}

// ─────────────────────────────────────────────────────────────
//  STATE POINT DIALOG
// ─────────────────────────────────────────────────────────────

function statePointDialog(actor) {
  const spent = statePointsSpent(actor);
  const dis       = disabledOrgans(actor).length;
  const growthPts = Math.max(0, Number(gp(actor, "system.identity.growthPoints")) || 0);
  const pool      = 30 + dis * 2 + growthPts;

  const opts = ATTR_LIST.map(([k,,label]) => {
    const cur = Number(gp(actor, `system.attributes.${k}.value`)) || 8;
    return `<option value="${k}">${label} (current ${cur})</option>`;
  }).join("");

  return waitRnRDialog({
    window: { title: "State Point & Growth" },
    content: `
<div class="rnr-state-point-dialog">
  <div class="rnr-state-point-row"><label>Action
    <select id="rnr-sp-action"><option value="add">Add</option><option value="remove">Remove</option></select>
  </label></div>
  <div class="rnr-state-point-row"><label>Attribute
    <select id="rnr-sp-target">${opts}</select>
  </label></div>
  <div class="rnr-state-point-row"><label>Points
    <input id="rnr-sp-points" type="number" min="1" value="1">
  </label></div>
  <p class="rnr-state-point-note">Used: ${spent} / ${pool} (30 base + disabled organs ${dis*2}${growthPts > 0 ? ` + growth points ${growthPts}` : ""})</p>
 </div>`,
    buttons: [
      {
        action: "apply",
        label: "Apply",
        default: true,
        callback: async (_event, button) => {
          const f       = button.form;
          const key     = f?.querySelector("#rnr-sp-target")?.value;
          const action  = f?.querySelector("#rnr-sp-action")?.value;
          const pts     = Number(f?.querySelector("#rnr-sp-points")?.value);
          if (!key || !Number.isFinite(pts) || pts < 1) return;

          const curVal  = Number(gp(actor, `system.attributes.${key}.value`)) || 8;
          const signed_ = action === "remove" ? -pts : pts;
          const newVal  = curVal + signed_;

          // Re-check budget live
          const curSpent = statePointsSpent(actor);
          const curDis   = disabledOrgans(actor).length;
          const curGP    = Math.max(0, Number(gp(actor, "system.identity.growthPoints")) || 0);
          const curPool  = 30 + curDis*2 + curGP;

          if (curSpent + signed_ > curPool)  { ui.notifications.warn(`Only ${curPool - curSpent} point(s) left.`); return; }
          if (curSpent + signed_ < 0)        { ui.notifications.warn("Cannot go below 0 spent points."); return; }
          if (newVal > 20)                   { ui.notifications.warn("Maximum attribute value is 20."); return; }
          const floor = 8 + originAttributeBonus(actor, key);
          if (newVal < floor)                { ui.notifications.warn(`Cannot reduce below ${floor} (base 8${floor > 8 ? " + Origin bonus" : ""}).`); return; }

          const ok = await RnRDialogV2.confirm({
            window: { title: "Confirm" },
            content: `<p>${action === "remove" ? "Remove" : "Add"} ${pts} pt ${action === "remove" ? "from" : "to"} ${key}?</p>`,
            rejectClose: false,
          });
          if (!ok) return;
          await actor.update({ [`system.attributes.${key}.value`]: newVal });
          ui.notifications.info(`${key} updated to ${newVal}.`);
        },
      },
      { action: "close", label: "Close" },
    ],
  });
}

// ─────────────────────────────────────────────────────────────
//  CONDITION MANAGER
// ─────────────────────────────────────────────────────────────

function conditionManager(actor) {
  const buildGroup = (g) => {
    const active = gp(actor, `system.conditions.${g.key}.active`) || [];
    const rows = g.entries.map(([k, label, thai, defaultPenalty]) => {
      const desc = gp(actor, `system.conditions.${g.key}.${k}.description`) || "";
      const stored = gp(actor, `system.conditions.${g.key}.${k}.rollPenalty`);
      const penalty = Number.isFinite(Number(stored)) ? Number(stored) : (Number(defaultPenalty) || 0);
      // A roll penalty field is only meaningful for groups that can gate a
      // check. Injuries and disorders are inert by default, but the GM can
      // still dial one in per actor when a campaign calls for it.
      const penaltyField = `<label class="rnr-condition-penalty-field">Penalty
        <input type="number" step="1" data-cp="${g.key}.${k}" value="${penalty}">
      </label>`;
      return `<div class="rnr-condition-manager-entry">
  <label><input type="checkbox" data-cg="${g.key}" data-ck="${k}" ${active.includes(k)?"checked":""}>
    <span>${label}<small>${thai}</small></span></label>
  <textarea data-cd="${g.key}.${k}" placeholder="Description">${desc}</textarea>
  ${penaltyField}
</div>`;
    }).join("");
    return `<section class="rnr-condition-manager-group"><h3>${g.label}<small>${g.thaiLabel}</small></h3>${rows}</section>`;
  };

  return waitRnRDialog({
    window: { title: "Manage Conditions" },
    content: `<div class="rnr-condition-manager"><div class="rnr-condition-manager-scroll">${CONDITION_GROUPS.map(buildGroup).join("")}</div></div>`,
    buttons: [
      {
        action: "save",
        label: "Save",
        default: true,
        callback: async (_event, button) => {
          const root = button.form;
          const updates = {};
          for (const g of CONDITION_GROUPS) {
            updates[`system.conditions.${g.key}.active`] =
              [...root.querySelectorAll(`[data-cg="${g.key}"]:checked`)].map(el=>el.dataset.ck);
            for (const [k] of g.entries) {
              updates[`system.conditions.${g.key}.${k}.description`] =
                root.querySelector(`[data-cd="${g.key}.${k}"]`)?.value || "";
              const penaltyInput = root.querySelector(`[data-cp="${g.key}.${k}"]`);
              if (penaltyInput) {
                updates[`system.conditions.${g.key}.${k}.rollPenalty`] =
                  Math.trunc(Number(penaltyInput.value)) || 0;
              }
            }
          }
          await actor.update(updates);
          await syncTokenConditions(actor);
          actor.sheet?.render(false);
        },
      },
      { action: "cancel", label: "Cancel" },
    ],
    position: { width: 520, height: 620 },
  });
}

// ─────────────────────────────────────────────────────────────
//  TOKEN CONDITION SYNC
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
//  EXPERIENCE AWARD
// ─────────────────────────────────────────────────────────────

/**
 * GM dialog for handing out experience.
 *
 * The amount is free-form rather than a fixed button set, because a single
 * award can be worth several levels at once. An award that does not cross a
 * threshold is still allowed: banking progress towards the next one is the
 * normal case.
 */
function experienceAwardDialog(actor) {
  if (!game.user.isGM) return;
  const view = progressionView(actor);

  return waitRnRDialog({
    window: { title: `Award — ${actor.name}` },
    content: `<div class="rnr-xp-dialog">
      <p class="rnr-roll-mode-hint">
        Level <strong>${view.level}</strong> · ${view.experience} / ${view.experienceNext} XP
        (${view.experienceProgress}%)
      </p>
      <label>Experience (XP)
        <input type="number" name="amount" value="100" step="1" />
      </label>
      <label>Growth Points <small>(each adds 1 State Point to the pool)</small>
        <input type="number" name="growth" value="0" step="1" min="0" />
      </label>
      <label>Extra Skill Points <small>(spent in the Extra Skill Shop)</small>
        <input type="number" name="extraSkill" value="0" step="1" />
      </label>
      <p class="rnr-help-text">
        ${view.experienceNext - view.experience} more XP reaches level ${view.level + 1}.
        A negative amount first drains the banked XP, then takes levels away until the
        balance is settled — Health and Willpower follow the level down. Level ${view.level}
        is the floor; XP below that is discarded.
        Every level grants +2 Health, and every second level grants +1 Willpower.
      </p>
    </div>`,
    buttons: [
      {
        action: "award",
        label: "Award",
        default: true,
        callback: async (_event, button) => {
          const root = button.form;
          const amount = Math.trunc(Number(root.querySelector("input[name=amount]")?.value)) || 0;
          const growth = Math.max(0, Math.trunc(Number(root.querySelector("input[name=growth]")?.value)) || 0);
          const extraSkill = Math.trunc(Number(root.querySelector("input[name=extraSkill]")?.value)) || 0;
          if (!amount && !growth && !extraSkill) {
            ui.notifications.warn("Enter a non-zero amount of XP, Growth Points or Extra Skill Points.");
            return;
          }
          if (growth) {
            await addGrowthPoints(actor, growth);
            ui.notifications.info(`${actor.name} gained ${growth} Growth Point(s).`);
          }
          if (extraSkill) {
            const current = Number(gp(actor, "system.identity.extraSkillPoints")) || 0;
            await actor.update({ "system.identity.extraSkillPoints": Math.max(0, current + extraSkill) });
            ui.notifications.info(`${actor.name}: ${extraSkill > 0 ? "+" : ""}${extraSkill} Extra Skill Point(s).`);
          }
          if (!amount) return;
          const result = await addExperience(actor, amount);
          if (!result) return;
          if (result.levelsGained > 0) {
            const gains = [];
            if (result.healthGained)    gains.push(`+${result.healthGained} Health`);
            if (result.willpowerGained) gains.push(`+${result.willpowerGained} Willpower`);
            ui.notifications.info(`${actor.name} reached level ${result.level}${gains.length ? ` (${gains.join(", ")})` : ""}.`);
          } else if (result.levelsGained < 0) {
            ui.notifications.info(`${actor.name} dropped to level ${result.level}.`);
          } else {
            ui.notifications.info(`${actor.name} gained ${amount} XP.`);
          }
        },
      },
      { action: "cancel", label: "Cancel" },
    ],
    position: { width: 420 },
  });
}

async function syncTokenConditions(actor) {
  const tokens = actor.isToken
    ? [actor.token]
    : (canvas.tokens?.placeables.filter(t => t.document.actorId === actor.id) ?? []);
  if (!tokens.length) return;

  const want = new Set();
  for (const g of CONDITION_GROUPS) {
    const active = gp(actor, `system.conditions.${g.key}.active`) || [];
    for (const k of active) { const m = g.statusMap?.[k]; if (m) want.add(m); }
  }

  for (const token of tokens) {
    // A player cannot toggle an effect on a token they do not own, and the
    // call throws rather than returning false. The GM runs the sync on load and
    // on every condition change, so skipping here costs nothing.
    if (!token?.testUserPermission?.(game.user, "OWNER")) continue;
    for (const se of CONFIG.statusEffects) {
      const has  = token.document.hasStatusEffect(se.id);
      const need = want.has(se.id);
      if (has === need) continue;
      try {
        await token.toggleEffect(se, { active: need });
      } catch (error) {
        console.warn(`RnR | Could not sync "${se.id}" onto token ${token.id ?? "?"}`, error);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  COMPENDIUM ITEM PICKER
// ─────────────────────────────────────────────────────────────

async function compendiumItemDialog(actor, initialType = "") {
  const allowedTypes = ["weapon", "armor", "consumable", "tool", "loot", "spell", "extraskills", "class", "subclass", "background", "race", "skill", "ability", "equipment"];
  const entries = [];
  for (const pack of game.packs ?? []) {
    if (pack.documentName !== "Item" && pack.metadata?.type !== "Item") continue;
    try {
      const index = await pack.getIndex({ fields: ["name", "type", "img"] });
      for (const entry of index) {
        if (!allowedTypes.includes(entry.type)) continue;
        entries.push({
          packId: pack.collection,
          packLabel: pack.metadata?.label || pack.collection,
          id: entry._id,
          name: entry.name || "Unnamed Item",
          type: entry.type,
          img: entry.img || "icons/svg/item-bag.svg",
        });
      }
    } catch (err) {
      console.warn(`RnR | Could not read Item Compendium ${pack.collection}`, err);
    }
  }

  if (!entries.length) {
    ui.notifications.warn("No Item Compendium entries are available. Ask the GM to add Items to a Compendium.");
    return;
  }

  const typeLabel = (type) => type === "extraskills" ? "Extra Skill" : type.charAt(0).toUpperCase() + type.slice(1);
  const typeOptions = [...new Set(entries.map(entry => entry.type))].sort()
    .map(type => `<option value="${type}" ${type === initialType ? "selected" : ""}>${typeLabel(type)}</option>`).join("");
  const packOptions = [...new Set(entries.map(entry => `${entry.packId}|${entry.packLabel}`))].sort()
    .map(value => { const [id, label] = value.split("|"); return `<option value="${id}">${label}</option>`; }).join("");
  const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
  const renderRows = (type = initialType, packId = "") => entries
    .filter(entry => (!type || entry.type === type) && (!packId || entry.packId === packId))
    .map(entry => `<div class="rnr-compendium-row" data-type="${entry.type}" data-pack="${escape(entry.packId)}">
      <img src="${escape(entry.img)}" alt="" /><span><strong>${escape(entry.name)}</strong><small>${escape(entry.packLabel)} · ${typeLabel(entry.type)}</small></span>
      <button type="button" data-action="compendium-add" data-pack="${escape(entry.packId)}" data-entry-id="${escape(entry.id)}">Add</button>
    </div>`).join("") || `<p class="rnr-shop-empty">No matching Items. Ask the GM to add an Item to the selected Compendium.</p>`;

  const dialogId = `rnr-compendium-${foundry.utils.randomID()}`;
  let dialogApp = null;
  const unhook = onRnRDialogRender(dialogId, (app, element) => {
    dialogApp = app;
    const root = element.querySelector(".rnr-compendium-dialog");
    if (!root) return;
    const bindAddButtons = () => root.querySelectorAll("[data-action='compendium-add']").forEach(button => {
      button.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const pack = game.packs.get(button.dataset.pack);
        if (!pack) { ui.notifications.error("Compendium not found."); return; }
        try {
          const source = await pack.getDocument(button.dataset.entryId);
          if (!source) throw new Error("Item entry not found.");
          const [created] = await actor.createEmbeddedDocuments("Item", [source.toObject()]);
          if (!created) throw new Error("Foundry did not return the created Item.");
          ui.notifications.info(`Added ${created.name} to ${actor.name}.`);
          await dialogApp?.close();
        } catch (err) {
          console.error("RnR | Compendium Item add failed", err);
          ui.notifications.error("Could not add this Item. Ask the GM to check the Compendium entry.");
        }
      });
    });
    const refresh = () => {
      const type = root.querySelector("#rnr-compendium-type")?.value || "";
      const packId = root.querySelector("#rnr-compendium-pack")?.value || "";
      const list = root.querySelector(".rnr-compendium-list");
      if (list) list.innerHTML = renderRows(type, packId);
      bindAddButtons();
    };
    root.querySelectorAll("#rnr-compendium-type, #rnr-compendium-pack").forEach(input => input.addEventListener("change", refresh));
    bindAddButtons();
  });
  try {
    await waitRnRDialog({
      id: dialogId,
      window: { title: "Add Item from Compendium" },
      position: { width: 560, height: 640 },
      content: `<div class="rnr-compendium-dialog">
      <p class="rnr-compendium-note">Only Items prepared by the GM in a Compendium are available here.</p>
      <div class="rnr-compendium-filters">
        <label>Type<select id="rnr-compendium-type"><option value="">All types</option>${typeOptions}</select></label>
        <label>Compendium<select id="rnr-compendium-pack"><option value="">All Compendiums</option>${packOptions}</select></label>
      </div>
      <div class="rnr-compendium-list">${renderRows(initialType)}</div>
    </div>`,
      buttons: [{ action: "close", label: "Close", default: true }],
    });
  } finally {
    unhook();
  }
}

// ─────────────────────────────────────────────────────────────
//  EXTRA SKILL SHOP  (pulls from all RnR packs)
// ─────────────────────────────────────────────────────────────

async function extraSkillShop(actor) {
  const points = Number(gp(actor, "system.identity.extraSkillPoints")) || 0;
  const owned  = gp(actor, "system.identity.extraSkills") || [];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  // ── Load extraskills from RnR packs ──────────────────────
  let compItems = [];
  try {
    for (const pack of game.packs) {
      // Any Item Compendium may hold extra skills, including GM-made world
      // Compendiums. Only the document type matters here.
      if ((pack.documentName ?? pack.metadata.type) !== "Item") continue;
      let index;
      try {
        index = await pack.getIndex({ fields: ["name","type","system.category","system.cost","system.attribute","system.effect","system.actionType","system.abilityType"] });
      } catch (err) {
        console.warn(`RnR | Could not read Compendium ${pack.collection} for the Extra Skill Shop`, err);
        continue;
      }
      for (const e of index) {
        if (e.type === "extraskills") {
          compItems.push({
            packId:    pack.collection,
            id:        e._id,
            name:      e.name,
            category:  e.system?.category ?? "other",
            cost:      Number(e.system?.cost)      || 1,
            attribute: e.system?.attribute         || "",
            effect:    e.system?.effect            || "",
            actionType: e.system?.actionType       || "",
            abilityType: e.system?.abilityType     || "",
          });
        }
      }
    }
    // Also include world items
    for (const item of game.items) {
      if (item.type === "extraskills")
        compItems.push({ packId: null, id: item.id, name: item.name, category: item.system?.category??"other", cost: Number(item.system?.cost)||1, attribute: item.system?.attribute||"", effect: item.system?.effect||"", actionType: item.system?.actionType||"", abilityType: item.system?.abilityType||"" });
    }
  } catch(e) { console.warn("RnR | extra skill shop load error", e); }

  // ── Group by category ─────────────────────────────────────
  const grouped = {};
  for (const item of compItems) {
    (grouped[item.category] ??= []).push(item);
  }

  // Rendering all ~600 entries at once made the dialog slow, so the browse list
  // shows one page and a "Show more" button.
  const SHOP_PAGE = 60;
  const buildBrowse = (selectedCategory = "all", query = "", { attribute = "", affordable = false, limit = SHOP_PAGE } = {}) => {
    if (!compItems.length)
      return `<p class="rnr-shop-empty">No extra skills found in packs.<br><small>Add items of type "extraskills" to an RnR pack and rebuild.</small></p>`;
    const needle = String(query || "").trim().toLocaleLowerCase();
    // An unknown category would be counted but never rendered; file it under Other.
    const knownCategory = key => EXTRA_SKILL_CATEGORIES.some(([k]) => k === key) ? key : "other";
    const matches = compItems.filter(item => {
      if (selectedCategory !== "all" && knownCategory(item.category) !== selectedCategory) return false;
      if (attribute && item.attribute !== attribute) return false;
      if (affordable && item.cost > points) return false;
      const categoryLabel = EXTRA_SKILL_CATEGORIES.find(([key]) => key === item.category)?.[1] || item.category;
      const haystack = [item.name, item.category, categoryLabel, item.effect, item.actionType, item.abilityType, item.attribute]
        .join(" ").toLocaleLowerCase();
      return !needle || haystack.includes(needle);
    });
    const shown = matches.slice(0, limit);
    const moreButton = matches.length > shown.length
      ? `<button type="button" class="rnr-shop-more" data-limit="${limit + SHOP_PAGE}">Show more (${matches.length - shown.length} remaining)</button>`
      : "";
    const summary = `<p class="rnr-shop-count">Showing ${shown.length} of ${matches.length} extra skills</p>`;
    const browseGroups = {};
    for (const item of shown) (browseGroups[knownCategory(item.category)] ??= []).push(item);
    const groupsHtml = EXTRA_SKILL_CATEGORIES
      .filter(([k]) => browseGroups[k]?.length)
      .map(([k, catLabel]) => {
        const renderRows = items => items.map(item => {
          const isOwned = owned.some(o => o.sourceId === item.id);
          const actionLabel = actionTypeLabel({ type: "extraskills", system: { actionType: item.actionType, abilityType: item.abilityType } });
          return `<div class="rnr-shop-row ${isOwned?"owned":""}">
  <span class="rnr-shop-item-name">${esc(item.name)}${actionLabel?`<small class="rnr-shop-action-type">${esc(actionLabel)}</small>`:""}${item.effect?`<small>${esc(item.effect)}</small>`:""}</span>
  <span class="rnr-shop-item-cost">${item.cost} pt</span>
  ${isOwned
    ? `<span class="rnr-shop-item-owned">✓</span>`
    : `<button type="button" class="rnr-shop-buy-btn"
         data-sid="${esc(item.id)}" data-pack="${esc(item.packId??"")}"
         data-cost="${item.cost}" data-name="${esc(item.name)}" data-cat="${esc(k)}">Buy</button>`}
</div>`;
        }).join("");
        const timingKeys = Object.keys(ACTION_TYPE_LABELS);
        const timingGroups = timingKeys.map(key => {
          const items = browseGroups[k].filter(item => normalizeActionType(item.actionType || item.abilityType) === key);
          return items.length ? `<section class="rnr-shop-action-group"><h5>${ACTION_TYPE_LABELS[key]} <small>(${items.length})</small></h5>${renderRows(items)}</section>` : "";
        }).join("");
        const untimed = browseGroups[k].filter(item => !normalizeActionType(item.actionType || item.abilityType));
        return `<div class="rnr-shop-cat-group"><h4>${esc(catLabel)}</h4>${timingGroups}${untimed.length ? `<section class="rnr-shop-action-group"><h5>Unspecified <small>(${untimed.length})</small></h5>${renderRows(untimed)}</section>` : ""}</div>`;
      }).join("");
    if (!groupsHtml) return `<p class="rnr-shop-empty">${needle || attribute || affordable ? "No extra skills match these filters." : "No extra skills in this category."}</p>`;
    return summary + groupsHtml + moreButton;
  };

  const buildOwned = () => owned.length
    ? owned.map((s,i)=>`<div class="rnr-extra-owned"><span>${s.name}<small>${s.categoryLabel??s.category??""}</small></span><button type="button" data-ri="${i}">Remove</button></div>`).join("")
    : `<p class="rnr-shop-empty">None purchased yet.</p>`;

  const dialogId = `rnr-extra-skill-${foundry.utils.randomID()}`;
  let dialogApp = null;
  const unhook = onRnRDialogRender(dialogId, (app, element) => {
    dialogApp = app;
    const root = element.querySelector(".rnr-extra-skill-shop");
    if (!root) return;
    const refreshBrowse = (limit = undefined) => {
      const category = root.querySelector("#rnr-extra-skill-category")?.value || "all";
      const query = root.querySelector("#rnr-extra-skill-search")?.value || "";
      const attribute = root.querySelector("#rnr-extra-skill-attribute")?.value || "";
      const affordable = root.querySelector("#rnr-extra-skill-affordable")?.checked === true;
      const panel = root.querySelector(".rnr-shop-panel[data-panel='browse']");
      if (panel) panel.innerHTML = buildBrowse(category, query, { attribute, affordable, ...(limit ? { limit } : {}) });
    };
    root.addEventListener("click", async (ev) => {
      const target = ev.target instanceof Element ? ev.target : null;
      const tab = target?.closest(".rnr-shop-tab");
      if (tab) {
        ev.preventDefault();
        const selected = tab.dataset.tab;
        root.querySelectorAll(".rnr-shop-tab").forEach(button => button.classList.toggle("active", button === tab));
        root.querySelectorAll(".rnr-shop-panel").forEach(panel => { panel.style.display = panel.dataset.panel === selected ? "" : "none"; });
        const filter = root.querySelector(".rnr-shop-filter");
        if (filter) filter.style.display = selected === "browse" ? "" : "none";
        return;
      }
      const moreButton = target?.closest(".rnr-shop-more");
      if (moreButton) {
        ev.preventDefault();
        refreshBrowse(Number(moreButton.dataset.limit) || undefined);
        return;
      }
      const buyButton = target?.closest(".rnr-shop-buy-btn");
      if (buyButton) {
        ev.preventDefault();
        const id = buyButton.dataset.sid;
        const packId = buyButton.dataset.pack || null;
        const cost = Number(buyButton.dataset.cost) || 1;
        const itemName = buyButton.dataset.name;
        const cat = buyButton.dataset.cat;
        const curPts = Number(gp(actor, "system.identity.extraSkillPoints")) || 0;
        if (curPts < cost) { ui.notifications.warn(`Need ${cost} point(s) — you have ${curPts}.`); return; }
        const catLabel = EXTRA_SKILL_CATEGORIES.find(([k]) => k === cat)?.[1] || cat;
        const curOwned = [...(gp(actor, "system.identity.extraSkills") || [])];
        let actorItemId = null;
        try {
          const src = packId ? await game.packs.get(packId)?.getDocument(id) : game.items.get(id);
          if (src) {
            const [created] = await actor.createEmbeddedDocuments("Item", [src.toObject()]);
            actorItemId = created?.id ?? null;
          }
        } catch (e) { console.warn("RnR | Could not clone extra skill item", e); }
        await actor.update({
          "system.identity.extraSkillPoints": curPts - cost,
          "system.identity.extraSkills": [...curOwned, { name: itemName, category: cat, categoryLabel: catLabel, cost, sourceId: id, actorItemId }],
        });
        ui.notifications.info(`Purchased "${itemName}"!`);
        await dialogApp?.close();
        return;
      }
      const removeButton = target?.closest("[data-ri]");
      if (removeButton) {
        ev.preventDefault();
        const idx = Number(removeButton.dataset.ri);
        const cur = [...(gp(actor, "system.identity.extraSkills") || [])];
        if (!cur[idx]) return;
        const removed = cur.splice(idx, 1)[0];
        if (removed?.actorItemId) actor.items.get(removed.actorItemId)?.delete().catch(() => {});
        await actor.update({
          "system.identity.extraSkillPoints": (Number(gp(actor, "system.identity.extraSkillPoints")) || 0) + (removed?.cost ?? 1),
          "system.identity.extraSkills": cur,
        });
        await dialogApp?.close();
      }
    });
    root.querySelector("#rnr-extra-skill-category")?.addEventListener("change", () => refreshBrowse());
    root.querySelector("#rnr-extra-skill-attribute")?.addEventListener("change", () => refreshBrowse());
    root.querySelector("#rnr-extra-skill-affordable")?.addEventListener("change", () => refreshBrowse());
    root.querySelector("#rnr-extra-skill-search")?.addEventListener("input", () => refreshBrowse());
  });
  try {
    await waitRnRDialog({
      id: dialogId,
      window: { title: "Extra Skill Shop" },
      position: { width: 560, height: 620 },
      content: `
<div class="rnr-extra-skill-shop">
  <div class="rnr-shop-balance">Points available: <strong>${points}</strong></div>
  <div class="rnr-shop-filter">
    <label>Search skills or topics
      <input id="rnr-extra-skill-search" type="search" placeholder="Search by name, effect, action, or category…" autocomplete="off" />
    </label>
    <label>Category
      <select id="rnr-extra-skill-category"><option value="all">All categories</option>${EXTRA_SKILL_CATEGORIES.map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select>
    </label>
    <label>Attribute
      <select id="rnr-extra-skill-attribute"><option value="">Any attribute</option>${ATTR_LIST.map(([key,, label]) => `<option value="${key}">${label}</option>`).join("")}</select>
    </label>
    <label class="rnr-shop-affordable"><input id="rnr-extra-skill-affordable" type="checkbox" /> Affordable only (≤ ${points} pt)</label>
  </div>
  <div class="rnr-shop-tabs">
    <button type="button" class="rnr-shop-tab active" data-tab="browse">Browse</button>
    <button type="button" class="rnr-shop-tab" data-tab="owned">Owned (${owned.length})</button>
  </div>
  <div class="rnr-shop-panel" data-panel="browse">${buildBrowse()}</div>
  <div class="rnr-shop-panel" data-panel="owned" style="display:none">${buildOwned()}</div>
      </div>`,
      buttons: [{ action: "close", label: "Close", default: true }],
    });
  } finally {
    unhook();
  }
}

// ─────────────────────────────────────────────────────────────
//  SHARED getData  (character + NPC)
// ─────────────────────────────────────────────────────────────

function buildData(data) {
  const actor = data.actor;

  data.isGM             = game.user.isGM;
  // Campaign setting drives the theme for every sheet; there is no per-actor
  // override any more, so only the resolved label and its help text are exposed.
  const profileKey       = resolveSetting(actor);
  data.settingProfileKey = profileKey;
  data.settingProfileLabel = settingProfileLabel(profileKey);
  data.settingProfileHint  = settingProfileHint(profileKey);
  const growthPts        = Math.max(0, Number(gp(actor, "system.identity.growthPoints")) || 0);
  data.growthPoints      = growthPts;
  data.hitDice           = Number(gp(actor, "system.identity.hitDice")) || 3;
  data.hitDiceMax        = Number(gp(actor, "system.identity.hitDiceMax")) || 3;
  data.extraSkillPoints = Number(gp(actor,"system.identity.extraSkillPoints")) || 0;
  data.extraSkills      = gp(actor,"system.identity.extraSkills") || [];
  data.biographyFields  = {
    background: String(gp(actor, "system.identity.background", "") ?? ""),
    sourceOfWillpower: String(gp(actor, "system.identity.sourceOfWillpower", "") ?? ""),
    bio: String(gp(actor, "system.identity.bio", "") ?? ""),
    flow: String(gp(actor, "system.identity.flow", "") ?? ""),
    notes: String(gp(actor, "system.identity.notes", "") ?? ""),
    birthplace: String(gp(actor, "system.identity.birthplace", "") ?? ""),
    dateOfBirth: String(gp(actor, "system.identity.dateOfBirth", "") ?? ""),
    identificationNumber: String(gp(actor, "system.identity.identificationNumber", "") ?? ""),
    address: String(gp(actor, "system.identity.address", "") ?? ""),
  };

  // Level & Experience. progressionView() owns the clamping, so the sheet can
  // never show a bar past 100% or a level below 1.
  const prog = progressionView(actor);
  data.level             = prog.level;
  data.experience        = prog.experience;
  data.experienceNext    = prog.experienceNext;
  data.experienceProgress= prog.experienceProgress;
  data.canGrantExperience= data.isGM;

  // Free-form custom attributes. Read defensively: a hand-edited world can hold
  // anything here, and a malformed entry must not take the whole sheet down.
  const storedAttributes = gp(actor, "system.customAttributes");
  data.customAttributes = (Array.isArray(storedAttributes) ? storedAttributes : [])
    .map((entry, index) => ({
      index,
      name:        typeof entry?.name        === "string" ? entry.name        : "",
      value:       typeof entry?.value       === "string" ? entry.value       : (entry?.value ?? ""),
      description: typeof entry?.description === "string" ? entry.description : "",
    }));
  data.hasCustomAttributes = data.customAttributes.length > 0;

  data.disabledOrgansEnabled = gp(actor, "system.identity.disabledOrgansEnabled", false) === true;
  const defense = defenseState(actor);
  data.defenseUses = defense.defensesUsed;
  data.defenseMax = 1 + extraDefenseUses(actor);
  data.defenseAvailable = defense.defensesUsed < data.defenseMax;
  data.counterattackAvailable = !defense.counterUsed;
  data.flawOptions      = FLAW_OPTIONS.map(([key, label]) => ({ key, label, selected: String(gp(actor, "system.identity.flaw") || "") === key }));
  data.statePointSpent  = statePointsSpent(actor);
  const disabled = disabledOrgans(actor);
  data.statePointMax    = 30 + (disabled.length * 2) + growthPts;
  data.disabledOrgans  = DISABLED_ORGANS.map(([key, label, group, effect]) => {
    const selected = disabled.includes(key);
    const usable = organUsable(actor, key);
    const status = !usable ? "Disabled" : selected ? "Prosthetic" : "Functional";
    return { key, label, group, effect, selected, usable, status, statusClass: status.toLowerCase() };
  });
  data.disabledOrganGroups = [...new Set(DISABLED_ORGANS.map(([, , group]) => group))].map(group => {
    const organs = data.disabledOrgans.filter(organ => organ.group === group);
    return { label: group, organs, selectedCount: organs.filter(organ => organ.selected).length };
  });
  data.disabledOrganCount = disabled.length;
  data.organStatePoints = disabled.length * 2;
  data.leftHandUsable  = organUsable(actor, "leftHand");
  data.rightHandUsable = organUsable(actor, "rightHand");

  // Vitals
  const tghMod = attrMod(gp(actor,"system.attributes.toughness.value") || 8);
  const sanMod = attrMod(gp(actor,"system.attributes.sanity.value")    || 8);
  const extraHealthBonus = (actor.items?.contents ?? []).reduce((total, item) =>
    total + (item.type === "extraskills" ? Number(item.system?.healthBonus) || 0 : 0), 0);
  data.healthMax     = (Number(gp(actor,"system.vitals.health.max")) || (10 + tghMod)) + extraHealthBonus;
  data.willPowerMax  = Number(gp(actor,"system.vitals.willPower.max"))   || (8  + sanMod);
  data.healthValue   = Number(gp(actor,"system.vitals.health.value"));
  data.willPowerValue= Number(gp(actor,"system.vitals.willPower.value"));
  if (!Number.isFinite(data.healthValue))    data.healthValue    = data.healthMax;
  if (!Number.isFinite(data.willPowerValue)) data.willPowerValue = data.willPowerMax;

  const mentalRaw = Number(gp(actor,"system.vitals.mental.value"));
  data.mentalValue  = Math.min(18, Math.max(0, Number.isFinite(mentalRaw) ? mentalRaw : 9));
  data.mentalMax    = 18;
  data.mentalHearts = Array.from({length:18},(_,i)=>({ index:i+1, filled:data.mentalValue>=i+1 }));

  // Initiative (dexterity modifier)
  const dexVal = Number(gp(actor,"system.attributes.dexterity.value")) || 8;
  data.initiative      = attrMod(dexVal);
  data.initiativeLabel = signed(data.initiative);

  // ── All owned items (used for bonus calculations below) ──────
  const actorItems = actor.items?.contents ?? [];

  // ── Bonuses from extraskills and worn equipment ───────────────
  const extraSkillBonuses = {}; // skillKey → total bonus

  let equippedArmorBonus  = 0;
  let equippedSpeedBonus  = 0;
  let equippedAttackBonus = 0;
  let equippedDamageBonus = 0;

  for (const item of actorItems) {
    // ── extraskills: skill bonus and speed bonus ────────────
    if (item.type === "extraskills") {
      const bonus    = Number(item.system?.bonus)     || 0;
      const skillKey = String(item.system?.skill      || "").trim();
      const skillKeys = Array.isArray(item.system?.skills) ? item.system.skills.map(k => String(k).trim()).filter(Boolean) : [];
      const attrKey  = String(item.system?.attribute  || "").trim();
      if (bonus !== 0) {
        if (skillKeys.length) {
          for (const key of skillKeys) extraSkillBonuses[key] = (extraSkillBonuses[key] || 0) + bonus;
        } else if (skillKey) {
          extraSkillBonuses[skillKey] = (extraSkillBonuses[skillKey] || 0) + bonus;
        } else if (attrKey) {
          for (const g of SKILL_GROUPS)
            for (const [sk,,skAttr] of g.skills)
              if (skAttr === attrKey)
                extraSkillBonuses[sk] = (extraSkillBonuses[sk] || 0) + bonus;
        }
      }
      equippedSpeedBonus += Number(item.system?.speedBonus) || 0;
    }
    // ── worn armor/equipment: stat bonuses ─────────────────
    if (["armor","equipment"].includes(item.type) && item.system?.equipmentSlot) {
      equippedArmorBonus  += Number(item.system?.armorValue) || 0;
      equippedSpeedBonus  += Number(item.system?.speedBonus)  || 0;
      equippedAttackBonus += Number(item.system?.attackBonus) || 0;
      equippedDamageBonus += Number(item.system?.damageBonus) || 0;
      // skill bonuses from equipment (e.g. gloves of stealth)
      const eSkillKey = String(item.system?.skill     || "").trim();
      const eSkillKeys = Array.isArray(item.system?.skills) ? item.system.skills.map(k => String(k).trim()).filter(Boolean) : [];
      const eAttrKey  = String(item.system?.attribute || "").trim();
      const eBonus    = Number(item.system?.bonus)    || 0;
      if (eBonus !== 0) {
        if (eSkillKeys.length) {
          for (const key of eSkillKeys) extraSkillBonuses[key] = (extraSkillBonuses[key] || 0) + eBonus;
        } else if (eSkillKey) {
          extraSkillBonuses[eSkillKey] = (extraSkillBonuses[eSkillKey] || 0) + eBonus;
        } else if (eAttrKey) {
          for (const g of SKILL_GROUPS)
            for (const [sk,,skAttr] of g.skills)
              if (skAttr === eAttrKey)
                extraSkillBonuses[sk] = (extraSkillBonuses[sk] || 0) + eBonus;
        }
      }
    }
  }

  // Speed: stored base (default 30) + all speed bonuses — READ-ONLY for players
  // Player speed is fixed at BASE_SPEED; only purchased Features and worn gear modify it.
  const missingFeet = ["leftFoot", "rightFoot"].filter(organ => !organUsable(actor, organ)).length;
  data.speed             = Math.max(5, BASE_SPEED + equippedSpeedBonus - (missingFeet * 15));
  data.speedBonus        = equippedSpeedBonus;
  data.equippedArmorBonus  = equippedArmorBonus;
  // For characters, Reflex is rolled when attacked and Armor DR is applied by damage.js.
  // For NPCs and Vehicles, Reflex Defense and Armor DR can be set as static values.
  data.reflexDefense     = actor.type === "character" ? null : (Number(gp(actor, "system.defenses.reflexDefense")) || 0);
  data.armorDamageReduction = actor.type === "character"
    ? armorDamageReduction(actor)
    : (Number(gp(actor, "system.defenses.armorDamageReduction")) || armorDamageReduction(actor));
  data.equippedAttackBonus = equippedAttackBonus;
  data.equippedDamageBonus = equippedDamageBonus;
  const down = deathSnapshot(actor);
  data.downState       = down.state;
  data.downRounds      = down.rounds;
  data.downRecovery    = down.recovery;
  data.downIsActive    = down.state === DEATH_STATES.ACTIVE || down.state === DEATH_STATES.RECOVERING;
  data.downNeeded      = Math.max(1, deathSetting("deathRecoverySteps", 2));
  data.downDC          = deathSetting("deathRecoveryDC", 10);
  data.downEscalation  = Math.max(1, deathSetting("deathEscalationRounds", 3));
  data.downRecoveryPips = Array.from({ length: data.downNeeded }, (_, i) => ({ filled: i < down.recovery }));
  data.isUnconscious    = (gp(actor,"system.conditions.physicalStates.active") || []).includes("unconscious");

  // Attributes  (no prof — just attrMod)
  // `actorAttributeValue` is the single definition of an attribute in play, so
  // the sheet, the rolls and the saving throws cannot drift apart: base, plus
  // item bonuses, plus permanent modifiers, plus Active Effects.
  data.attributeList = ATTR_LIST.map(([key, abbr, label]) => {
    const value    = actorAttributeValue(actor, key);
    const modifier = attrMod(value);
    const modifierBonus = attributeBonus(actor, key);
    return {
      key, abbr, label, value, modifier, modLabel: signed(modifier), passive: 10 + modifier,
      modifierBonus,
      hasModifiers: modifierBonus !== 0,
      // The Base input shows the stored value, not the total, or saving a
      // character with a +3 implant would quietly bake the implant into the
      // base and then apply it a second time.
      baseValue: Number(gp(actor, `system.attributes.${key}.value`)) || 8,
    };
  });

  // Skills: attrMod + system.skills[key].value (GM/player bonus) + extraSkills item bonuses
  data.skillGroups = SKILL_GROUPS.map(g => ({
    label: g.label,
    skills: g.skills.map(([key, label, attribute]) => {
      const aVal        = actorAttributeValue(actor, attribute);
      const skillBonus  = (Number(gp(actor, `system.skills.${key}.value`)) || 0) + activeEffectValue(actor, `system.skills.${key}.value`);
      const extraBonus  = extraSkillBonuses[key] || 0;
      const mod         = attrMod(aVal) + skillBonus + extraBonus;
      return {
        key, label, attribute,
        attributeLabel: ATTR_LABELS[attribute] || attribute,
        storedValue: Number(gp(actor, `system.skills.${key}.value`)) || 0,
        skillBonus, extraBonus,
        mod, modLabel: signed(mod), passive: 10 + mod,
      };
    }),
  }));

  // Conditions
  data.conditionGroups = CONDITION_GROUPS.map(g => {
    const active = gp(actor,`system.conditions.${g.key}.active`) || [];
    const entries = g.entries.map(([key, label, thaiLabel, defaultPenalty]) => {
      const stored = gp(actor,`system.conditions.${g.key}.${key}.rollPenalty`);
      const penalty = stored === undefined ? (Number(defaultPenalty) || 0) : (Number(stored) || 0);
      return {
        key, label, thaiLabel, rollPenalty: penalty,
        active:      active.includes(key),
        description: gp(actor,`system.conditions.${g.key}.${key}.description`) || "",
      };
    });
    return {
      key: g.key, label: g.label, thaiLabel: g.thaiLabel,
      hasActive: active.length > 0,
      // The physical/mental block is the third of three identical condition
      // panels stacked on the Main tab, and its full-size title repeated almost
      // the same words as the two above it. The block still has to show its
      // penalty badge and its Manage button, so only the title is dropped.
      showHeading: g.key !== "physicalStates",
      // Sum of penalties actually in force, so the sheet can warn when a
      // condition is quietly gating every roll.
      totalPenalty: entries.filter(e => e.active).reduce((s, e) => s + e.rollPenalty, 0),
      entries,
    };
  });

  return data;
}

// ─────────────────────────────────────────────────────────────
//  ITEM SHEET
// ─────────────────────────────────────────────────────────────

class RnRItemSheet extends RnRHandlebarsItemSheet {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: [...(super.DEFAULT_OPTIONS.classes ?? []), "rnr", "sheet", "item"],
    tag: "form",
    position: { ...super.DEFAULT_OPTIONS.position, width: 560, height: 720 },
    form: { ...super.DEFAULT_OPTIONS.form, submitOnChange: false, closeOnSubmit: false },
  };

  static PARTS = {
    main: { template: "systems/rnr/templates/item-sheet.html" },
  };

  _initializeApplicationOptions(options) {
    return fitSheetToViewport(super._initializeApplicationOptions(options));
  }

  /** Close at once instead of waiting for Foundry's shrink animation. */
  close(options = {}) {
    return super.close({ animate: false, ...options });
  }

  async _prepareContext(options) {
    const base = await super._prepareContext(options);
    const data = { ...base, item: this.item, system: this.item.system ?? {}, cssClass: "" };
    const t = this.item.type;
    // Ensure system is exposed at top level for Handlebars (Foundry v13 does this,
    // but we make it explicit as a safety net)
    if (!data.system) data.system = data.item.system ?? {};
    data.sheetTheme = resolveSheetTheme(data.item);
    data.settingProfileLabel = settingProfileLabel(resolveSetting(data.item));
    data.settingProfileHint  = settingProfileHint(resolveSetting(data.item));
    data.typeLabel    = t.toUpperCase();
    data.isWeapon     = t === "weapon";
    data.isArmor      = t === "armor";
    data.isConsumable = t === "consumable";
    data.isTool       = t === "tool";
    data.isLoot       = t === "loot";
    data.isSpell      = t === "spell";
    data.isExtraSkill = t === "extraskills";
    data.isClass      = t === "class";
    data.isSubclass   = t === "subclass";
    data.isBackground = t === "background";
    data.isRace       = t === "race";
    data.isAbility    = t === "ability";
    data.isEquipment  = t === "equipment";
    data.canHold      = canHoldItem(data.item);
    // Armor and Equipment always expose the wear-slot selector so a new item
    // can be configured as wearable before it has a slot assigned.
    data.isWearable    = ["armor", "equipment"].includes(t);
    const currentEquipmentSlot = bodySlotCandidates(data.item.system.equipmentSlot)[0] || "";
    const selectableSlots = t === "armor"
      ? allowedBodySlots(data.item)
      : BODY_EQUIPMENT_SLOTS.map(([key]) => key);
    data.equipmentSlotOptions = (data.isWearable
      ? [["", "Backpack"], ...selectableSlots.map(key => [key, BODY_EQUIPMENT_SLOTS.find(([slot]) => slot === key)?.[1] || key])]
      : [["", "Backpack"]])
      .map(([key, label]) => ({ key, label, selected: currentEquipmentSlot === key }));
    const currentAllowedSlot = data.item.system.allowedSlot || "";
    data.allowedSlotOptions = [...BODY_EQUIPMENT_SLOTS, ...LEGACY_BODY_SLOT_OPTIONS]
      .map(([key, label]) => ({ key, label, selected: currentAllowedSlot === key }));
    // Only offer prosthetic targets that match where the item can actually be
    // worn, so a head-mounted device cannot be set to replace a foot.
    const wearableSlots = new Set(allowedBodySlots(data.item));
    const currentProsthetic = data.item.system.prostheticFor || "";
    data.prostheticOptions = Object.entries(PROSTHETIC_TARGETS)
      .filter(([value, target]) => value === "fullBody" || target.slots.every(slot => wearableSlots.has(slot)))
      .map(([value]) => ({ value, label: PROSTHETIC_LABELS[value] ?? value, selected: currentProsthetic === value }));
    data.isLeftHand   = data.item.system.handSlot === "left";
    data.isRightHand  = data.item.system.handSlot === "right";
    // A stale value (junk in an imported document, or a field edited by hand)
    // is repaired here rather than trusted, so a weapon can never be configured
    // as needing zero or three hands.
    const handsRequired = Number(data.item.system.handsRequired);
    data.handsRequired = handsRequired === 2 ? 2 : 1;
    data.isOneHanded   = data.handsRequired === 1;
    data.isTwoHanded   = data.handsRequired === 2;
    data.isLight      = data.item.system.armorType === "light";
    data.isMedium     = data.item.system.armorType === "medium";
    data.isHeavy      = data.item.system.armorType === "heavy";
    data.isShield     = data.item.system.armorType === "shield";
    data.isAccessory  = data.item.system.armorType === "accessory";
    data.isMelee      = data.item.system.weaponType === "melee";
    data.isRanged     = data.item.system.weaponType === "ranged";
    data.attributeOptions = ATTR_LIST.map(([k,,l]) => ({ key:k, label:l, selected: data.item.system.attribute === k }));
    // Rich-text description: Compendium content is HTML, which a textarea showed
    // as raw tags. Locked (Compendium) items show the enriched text read-only.
    data.editable = this.isEditable;
    const TextEditorImpl = foundry.applications.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
    const rawDescription = String(data.item.system.description?.value ?? "");
    data.descriptionValue = rawDescription;
    data.enrichedDescription = TextEditorImpl?.enrichHTML
      ? await TextEditorImpl.enrichHTML(rawDescription, { relativeTo: this.item, secrets: this.item.isOwner })
      : rawDescription;
    return data;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const jq = globalThis.jQuery ?? globalThis.$;
    if (typeof jq === "function") this.activateListeners(jq(this.element));
    else console.error("RnR | jQuery is unavailable; Item sheet listeners were not bound.");
  }

  activateListeners(html) {
    html.find("[data-action='item-chat']").on("click", async ev => {
      ev.preventDefault();
      await itemRollFlow(this.item.actor, this.item, { openDialog: ev.shiftKey });
    });
    html.find("input[name],textarea[name],select[name],prose-mirror[name]").on("change", async ev => {
      const f = ev.currentTarget;
      try {
        const value = f.type==="number" ? Number(f.value)||0 : f.type==="checkbox" ? f.checked : f.value;

        // Hand and body placement go through the equip helpers rather than
        // straight to `update`. Writing `system.handSlot` directly would let a
        // two-handed weapon be dropped into one hand while another item still
        // occupies the other, and would skip the disabled-organ check - the same
        // paths the sheet buttons take.
        if (f.name === "system.handSlot" && value) {
          const actor = this.item.actor;
          if (actor) {
            // Renders either way: a refused equip has to put the select back to
            // the value the item actually holds.
            await equipInHand(actor, this.item, value);
            await this.render(false);
            return;
          }
        }
        if (f.name === "system.equipmentSlot" && value) {
          const actor = this.item.actor;
          if (actor) {
            await equipBodyItem(actor, this.item, value);
            await this.render(false);
            return;
          }
        }

        // Widening a held item to two hands has the same effect as dragging it
        // into a hand: it now claims both, so anything in the other hand has to
        // come out. Saved straight through `update`, the item would end up
        // needing two hands while something else still occupied one of them.
        if (f.name === "system.handsRequired" && Number(value) === 2) {
          const actor = this.item.actor;
          const held = String(gp(this.item, "system.handSlot") || "");
          if (actor && held) {
            await this.item.update({ "system.handsRequired": 2 });
            await equipInHand(actor, this.item, held);
            await this.render(false);
            return;
          }
        }

        await this.item.update({ [f.name]: value });
      } catch (err) {
        console.error("RnR | item field save failed", { field: f.name, value: f.value, err });
        ui.notifications.error(`Could not save ${f.name.replace(/^system\./, "")}. Check the Item type and console.`);
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────
//  SHARED LISTENER HELPERS  (used by both actor sheets)
// ─────────────────────────────────────────────────────────────

function readItemDragData(event) {
  const transfer = event?.dataTransfer;
  if (!transfer) return null;

  const raw = transfer.getData("application/json") || transfer.getData("text/plain");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_err) {
    return { itemId: raw };
  }
}

function clearBodyDropState(html) {
  html.find("[data-drop-zone]").removeClass("is-drag-over");
}

function bodySlotUsable(actor, slot) {
  const organs = BODY_SLOT_ORGANS[slot] ?? [];
  if (!organs.length) return true;
  return organs.some(organ => organUsable(actor, organ));
}

async function equipBodyItem(actor, item, slot) {
  if (!item || !BODY_EQUIPMENT_SLOTS.some(([key]) => key === slot)) return false;
  if (!isWearableItem(item)) {
    ui.notifications.warn("Only armor or clothing equipment can be worn on the body.");
    return false;
  }
  if (!allowedBodySlots(item).includes(slot)) {
    ui.notifications.warn(`${item.name} cannot be worn on the ${slot} slot.`);
    return false;
  }
  if (!bodySlotUsable(actor, slot)) {
    const label = BODY_EQUIPMENT_SLOTS.find(([key]) => key === slot)?.[1] ?? slot;
    ui.notifications.warn(`The ${label} slot is unusable while its limbs are disabled.`);
    return false;
  }

  // Single source of truth for worn gear: a non-empty system.equipmentSlot.
  // There is deliberately no boolean "equipped" flag — it used to be written
  // here and read nowhere, which let the two drift apart.
  const bodyAssignments = bodyEquipmentAssignments(actor.items);
  const prev = actor.items.find(i => bodyAssignments.get(i.id) === slot);
  if (prev && prev.id !== item.id)
    await prev.update({ "system.equipmentSlot": "", "system.handSlot": "" });
  await item.update({ "system.equipmentSlot": slot, "system.handSlot": "" });
  return true;
}

/** How many hands an item needs: 2 only when it explicitly asks for two. */
function handsNeeded(item) {
  return Number(gp(item, "system.handsRequired")) === 2 ? 2 : 1;
}

/**
 * The item occupying `hand`, if any.
 *
 * A two-handed weapon records a single `handSlot` but uses both hands, so it has
 * to be reported as the occupant of either one. Without this, a one-handed item
 * dropped into the "other" hand would sit alongside a greatsword that is
 * supposedly holding both, and the two rules would contradict each other.
 */
function handOccupant(actor, hand, excludeId = null) {
  return (actor.items?.contents ?? []).find(item => {
    if (item.id === excludeId) return false;
    const slot = gp(item, "system.handSlot");
    if (!slot) return false;
    // A two-handed item records only the hand it was dropped into, so matching on
    // `slot === hand` alone would report the "free" hand as empty and let a
    // one-handed item be equipped beside it. Two hands means either hand.
    return slot === hand || handsNeeded(item) === 2;
  }) || null;
}

/**
 * Put an item into a hand, applying the two-handed rule.
 *
 * A two-handed item takes both hands, so it displaces whatever was in either
 * one. It also needs both hands to work: if one of them is disabled the item
 * cannot be wielded at all, which is why that is checked before anything is
 * moved rather than after - a half-equipped greatsword would silently occupy
 * one hand and block the other.
 *
 * The rule runs in both directions. Equipping a two-handed item clears both
 * hands, and equipping anything into a hand held by a two-handed item displaces
 * that item, so the invariant "at most one item per hand" holds no matter which
 * of the two was equipped first.
 *
 * @returns {Promise<boolean>} whether the item ended up in a hand
 */
async function equipInHand(actor, item, hand) {
  const hands = handsNeeded(item);
  const wanted = hands === 2 ? ["left", "right"] : [hand];

  const disabled = wanted.filter(h => !organUsable(actor, `${h}Hand`));
  if (disabled.length) {
    const label = disabled.map(h => `${h} hand`).join(" and ");
    ui.notifications.warn(hands === 2
      ? `${item.name} needs both hands, and the ${label} is disabled.`
      : `The ${label} is disabled.`);
    return false;
  }

  // Clear the hands this item is about to take. `handOccupant` reports a
  // two-handed item for either hand, so a one-handed item equips into the other
  // side displacing it, exactly as it would be displaced itself.
  for (const target of wanted) {
    const occupant = handOccupant(actor, target, item.id);
    if (occupant) await occupant.update({ "system.handSlot": "", "system.equipmentSlot": "" });
  }

  // The slot it is being dragged out of is not a hand to clear.
  await item.update({ "system.handSlot": hand, "system.equipmentSlot": "" });
  return true;
}

function bindCommonListeners(sheet, html) {
  const actor = sheet.actor;

  // ── Backpack search ────────────────────────────────────────
  html.find("[data-action='inventory-search']").on("input", ev => {
    const query = String(ev.currentTarget.value || "").trim().toLowerCase();
    html.find(".rnr-inventory-group").each((_, group) => {
      let visible = 0;
      group.querySelectorAll(".rnr-equip-row").forEach(row => {
        const matches = !query || row.textContent.toLowerCase().includes(query);
        row.hidden = !matches;
        if (matches) visible += 1;
      });
      group.hidden = visible === 0;
    });
  });

  // ── Feature search ─────────────────────────────────────────
  // Same shape as the backpack search: filter the DOM in place rather than
  // re-rendering, so the caret in the search box is never thrown away mid-word.
  // The "nothing matched" line is toggled here because a hidden group leaves an
  // empty panel that would otherwise look like the tab failed to load.
  html.find("[data-action='feature-search']").on("input", ev => {
    const query = String(ev.currentTarget.value || "").trim().toLowerCase();
    let visible = 0;
    html.find(".rnr-feature-list-section .rnr-inventory-group").each((_, group) => {
      let shown = 0;
      group.querySelectorAll(".rnr-equip-row").forEach(card => {
        const matches = !query || card.textContent.toLowerCase().includes(query);
        card.hidden = !matches;
        if (matches) shown += 1;
      });
      group.hidden = shown === 0;
      visible += shown;
    });
    html.find("[data-action='feature-search-empty']").prop("hidden", !query || visible > 0);
  });

  // ── Rolls ───────────────────────────────────────────────────
  html.find("[data-roll='attribute']").on("click", ev => {
    const key = ev.currentTarget.dataset.key;
    const val = actorAttributeValue(actor, key);
    rollDialog(actor, `${ATTR_LABELS[key] || key} Check`, attrMod(val), ATTR_LABELS[key] || key);
  });

  html.find("[data-roll='saving']").on("click", ev => {
    savingThrowDialog(actor, ev.currentTarget.dataset.key);
  });

  html.find("[data-roll='skill']").on("click", ev => {
    const key = ev.currentTarget.dataset.key;
    const skillDef = SKILL_GROUPS.flatMap(group => group.skills).find(([skillKey]) => skillKey === key);
    const label = skillDef?.[1] || key;
    const attr  = skillDef?.[2] || gp(actor, `system.skills.${key}.attribute`) || "intellect";
    const aVal  = actorAttributeValue(actor, attr);

    // skill-specific bonus stored on actor
    const skillBonus = Number(gp(actor, `system.skills.${key}.value`)) || 0;

    // Extra Skills and worn equipment, the same bonuses the sheet shows.
    const extraBonus = itemSkillBonus(actor, key, attr);

    const mod = attrMod(aVal) + skillBonus + extraBonus;
    rollDialog(actor, label, mod, ATTR_LABELS[attr] || attr);
  });

  // ── Item attack / ability / chat roll ───────────────────────
  // A plain click shows the item's card; Shift+Click rolls straight away.
  html.find("[data-action='item-roll']").on("click", async ev => {
    ev.stopPropagation();
    const id = ev.currentTarget.dataset.itemId || ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    const item = id ? actor.items.get(id) : null;
    if (!item) { ui.notifications.warn("Item not found."); return; }
    await itemRollFlow(actor, item, { openDialog: ev.shiftKey });
  });

  // Clicking item name in inventory / features / npc action
  html.find(".rnr-equip-name, .rnr-feature-card, .rnr-npc-action-name").on("click", async ev => {
    if (ev.target.closest("button,a,input,select,textarea")) return;
    // These containers sit alongside elements that already carry
    // data-action="item-roll" - the name itself, the thumbnail, the dice button.
    // Both sets of handlers are bound to the same row, so without this a single
    // click on a name fired the roll twice: once here and once from the
    // item-roll handler on the element the click landed on. Only clicks that
    // reach no such element belong to this handler.
    if (ev.target.closest("[data-action='item-roll']")) return;
    const row = ev.currentTarget.closest("[data-item-id]");
    const id = row?.dataset.itemId;
    const item = id ? actor.items.get(id) : null;
    if (!item) return;
    await itemRollFlow(actor, item, { openDialog: ev.shiftKey });
  });

  // Consumables, including Bandages. Field Medic rolls Bandage healing twice
  // and keeps the higher result; its +2 skill bonus is calculated normally.
  html.find("[data-action='item-use']").on("click", async ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (!item) return;
    const sys = item.system ?? {};
    const isBandage = String(sys.consumableType || sys.type || item.name).toLowerCase().includes("bandage");
    const target = [...(game.user.targets ?? [])][0]?.actor ?? actor;
    const fieldMedic = (actor.items?.contents ?? []).some(i =>
      i.type === "extraskills" && (String(i.name).toLowerCase() === "field medic" || (Array.isArray(i.system?.skills) && i.system.skills.some(k => ["firstAid", "medicine"].includes(k))))
    );
    const formula = String(sys.healingFormula || "1d4");
    const rolls = [await new Roll(formula).evaluate()];
    if (isBandage && fieldMedic) rolls.push(await new Roll(formula).evaluate());
    const kept = rolls.length > 1 ? rolls.reduce((a, b) => a.total >= b.total ? a : b) : rolls[0];
    const result = await applyDamage(target, kept.total, "", { healing: true });
    await consumeItem(item, 1);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="rnr-chat-card"><div class="rnr-card-header"><strong>${actor.name}</strong><span>✓ Used ${item.name}</span></div><div class="rnr-card-detail">${isBandage && fieldMedic ? `Field Medic: ${rolls.map(r => r.total).join(" / ")} → kept ${kept.total}. ` : ""}${target.name} recovers <strong>+${result?.final ?? kept.total} HP</strong>.</div></div>`,
      rolls,
    });
  });

  // A consumable's ✓ Use button, which is the one click that means "use this"
  // rather than "tell me about this".
  html.find("[data-action='item-use-flow']").on("click", async ev => {
    ev.stopPropagation();
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (!item) return;
    await itemRollFlow(actor, item, { intent: "use" });
  });

  html.find("[data-action='mecha-bracelet']").on("click", ev => {
    ev.preventDefault();
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (!item || item.flags?.RnR?.mechaBracelet !== true) return;
    openMechaBraceletDialog(actor);
  });

  // ⚔ attack button in backpack/hand slots — stop propagation so slot-body click doesn't double-fire
  html.find("[data-action='item-attack']").on("click", async ev => {
    ev.stopPropagation();
    const btn  = ev.currentTarget;
    const id   = btn.dataset.itemId || btn.closest("[data-item-id]")?.dataset.itemId;
    const item = actor.items.get(id);
    if (!item) return;
    const hand = btn.closest("[data-hand]")?.dataset.hand;
    if (hand && !organUsable(actor, hand)) { ui.notifications.warn("This hand is disabled."); return; }
    // The ⚔ button always means "attack now", so it does not fall back to the
    // card the way a plain click on the same item would.
    await itemRollFlow(actor, item, { openDialog: ev.shiftKey, intent: "attack" });
  });

  // Click anywhere on in-hand slot body → open roll dialog for that item
  html.find(".rnr-slot-body").on("click", async ev => {
    if (ev.target.closest("button,a,input,select,textarea")) return;
    const slotEl = ev.currentTarget.closest("[data-item-id]");
    if (!slotEl?.dataset.itemId) return;
    const hand = slotEl.dataset.hand;
    if (hand && !organUsable(actor, hand)) { ui.notifications.warn("This hand is disabled."); return; }
    const item = actor.items.get(slotEl.dataset.itemId);
    if (!item) return;
    await itemRollFlow(actor, item, { openDialog: ev.shiftKey });
  });

  // ── Item CRUD ───────────────────────────────────────────────
  html.find("[data-action='item-create-from-select']").on("click", async ev => {
    const select = ev.currentTarget.closest(".rnr-create-item-controls")?.querySelector("[data-action='item-create-select']");
    const type = select?.value || "equipment";
    await createActorItem(actor, type, ev.currentTarget);
  });

  html.find("[data-action='item-create']").on("click", async ev => {
    const type = ev.currentTarget.dataset.type || "equipment";
    await createActorItem(actor, type, ev.currentTarget);
  });

  async function createActorItem(actor, type, sourceElement) {
    const validTypes = ["weapon", "armor", "consumable", "tool", "loot", "spell", "extraskills", "class", "subclass", "background", "race", "skill", "ability", "equipment"];
    if (!validTypes.includes(type)) {
      ui.notifications.warn(`Unknown RnR item type: ${type}`);
      return;
    }
    if (!actor.isOwner && !game.user.isGM) {
      await compendiumItemDialog(actor, type);
      return;
    }
    try {
      const [item] = await actor.createEmbeddedDocuments("Item", [{
        name: `New ${type}`,
        type,
        system: { handSlot: "" },
      }]);
      if (!item) throw new Error("Foundry did not return the created item.");
      sourceElement.closest("details")?.removeAttribute("open");
      await item.sheet.render(true);
    } catch (e) {
      console.error("RnR | item creation failed", e);
      ui.notifications.error(`Could not create ${type}. Check the console for details.`);
    }
  };

  html.find("[data-action='item-edit']").on("click", async ev => {
    const id = ev.currentTarget.dataset.itemId || ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    const item = id ? actor.items.get(id) : null;
    if (!item) { ui.notifications.warn("Item not found."); return; }
    await item.sheet.render(true);
  });

  html.find("[data-action='item-delete']").on("click", async ev => {
    const id = ev.currentTarget.dataset.itemId || ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    const item = actor.items.get(id);
    if (!item) return;
    const ok = await RnRDialogV2.confirm({
      window: { title: "Delete Item" },
      content: `<p>Delete <strong>${item.name}</strong>?</p>`,
      rejectClose: false,
    });
    if (ok) item.delete();
  });

  // ── Backpack → anatomy drag-and-drop ────────────────────────
  const draggableItems = html.find(".rnr-equip-row[draggable='true']");
  draggableItems.on("dragstart", ev => {
    const row = ev.currentTarget;
    const itemId = row.dataset.itemId;
    const transfer = ev.originalEvent?.dataTransfer;
    if (!itemId || !transfer) return;
    transfer.effectAllowed = "move";
    const payload = JSON.stringify({ type: "Item", itemId, actorId: actor.id });
    transfer.setData("application/json", payload);
    transfer.setData("text/plain", itemId);
    row.classList.add("is-dragging");
  });
  draggableItems.on("dragend", ev => {
    ev.currentTarget.classList.remove("is-dragging");
    clearBodyDropState(html);
  });

  const bodyDropZones = html.find("[data-drop-zone='body']");
  const bodyDragSources = html.find(".rnr-body-slot[draggable='true']");
  bodyDragSources.on("dragstart", ev => {
    const source = ev.currentTarget;
    const itemId = source.dataset.itemId;
    const transfer = ev.originalEvent?.dataTransfer;
    if (!itemId || !transfer) return;
    transfer.effectAllowed = "move";
    const payload = JSON.stringify({ type: "Item", itemId, actorId: actor.id, source: "body" });
    transfer.setData("application/json", payload);
    transfer.setData("text/plain", itemId);
    source.classList.add("is-dragging");
  });
  bodyDragSources.on("dragend", ev => {
    ev.currentTarget.classList.remove("is-dragging");
    clearBodyDropState(html);
  });
  bodyDropZones.on("dragenter", ev => {
    ev.preventDefault();
    ev.currentTarget.classList.add("is-drag-over");
  });
  bodyDropZones.on("dragover", ev => {
    ev.preventDefault();
    const transfer = ev.originalEvent?.dataTransfer;
    if (transfer) transfer.dropEffect = "move";
    ev.currentTarget.classList.add("is-drag-over");
  });
  bodyDropZones.on("dragleave", ev => {
    const zone = ev.currentTarget;
    const related = ev.originalEvent?.relatedTarget;
    if (!related || !zone.contains(related)) zone.classList.remove("is-drag-over");
  });
  bodyDropZones.on("drop", async ev => {
    ev.preventDefault();
    const zone = ev.currentTarget;
    clearBodyDropState(html);
    const dragData = readItemDragData(ev.originalEvent);
    const itemId = dragData?.itemId || dragData?.id;
    const item = itemId ? actor.items.get(itemId) : null;
    if (!item) {
      ui.notifications.warn("Drop an item from this actor's Backpack.");
      return;
    }
    if (await equipBodyItem(actor, item, zone.dataset.bodySlot)) await sheet.render(false);
  });

  // Drop a worn item back into Backpack Contents to unequip it.
  const backpackDropZone = html.find("[data-drop-zone='backpack']");
  backpackDropZone.on("dragover", ev => {
    ev.preventDefault();
    const transfer = ev.originalEvent?.dataTransfer;
    if (transfer) transfer.dropEffect = "move";
    ev.currentTarget.classList.add("is-drag-over");
  });
  backpackDropZone.on("dragleave", ev => ev.currentTarget.classList.remove("is-drag-over"));
  backpackDropZone.on("drop", async ev => {
    ev.preventDefault();
    ev.currentTarget.classList.remove("is-drag-over");
    const dragData = readItemDragData(ev.originalEvent);
    const item = dragData?.itemId ? actor.items.get(dragData.itemId) : null;
    if (!item) return ui.notifications.warn("Drop an item from this actor's equipment.");
    await item.update({ "system.equipmentSlot": "", "system.handSlot": "" });
    await sheet.render(false);
  });

  // ── Active abilities: drag to make ready, drag out to put away ──
  //
  // A slot already in the bar can itself be dragged, and dropping it back on the
  // feature list puts it away. Both directions go through setFeatureActive, so
  // a button and a drag can never leave the two disagreeing.
  const activeDropZone = html.find("[data-drop-zone='features-active']");
  const featureListZone = html.find("[data-drop-zone='features']");
  const activeDragSources = html.find(".rnr-active-slot[draggable='true']");
  activeDragSources.on("dragstart", ev => {
    const source = ev.currentTarget;
    const itemId = source.dataset.itemId;
    const transfer = ev.originalEvent?.dataTransfer;
    if (!itemId || !transfer) return;
    transfer.effectAllowed = "move";
    transfer.setData("application/json", JSON.stringify({ type: "Item", itemId, actorId: actor.id, source: "active" }));
    transfer.setData("text/plain", itemId);
    source.classList.add("is-dragging");
  });
  activeDragSources.on("dragend", ev => {
    ev.currentTarget.classList.remove("is-dragging");
    clearBodyDropState(html);
  });

  const onActiveDragOver = ev => {
    ev.preventDefault();
    const transfer = ev.originalEvent?.dataTransfer;
    if (transfer) transfer.dropEffect = "move";
    ev.currentTarget.classList.add("is-drag-over");
  };
  activeDropZone.on("dragover", onActiveDragOver);
  activeDropZone.on("dragenter", onActiveDragOver);
  activeDropZone.on("dragleave", ev => ev.currentTarget.classList.remove("is-drag-over"));
  activeDropZone.on("drop", async ev => {
    ev.preventDefault();
    ev.currentTarget.classList.remove("is-drag-over");
    const dragData = readItemDragData(ev.originalEvent);
    const item = dragData?.itemId ? actor.items.get(dragData.itemId) : null;
    if (!item) return ui.notifications.warn("Drag a spell or ability from the list below.");
    if (!canActivateFeature(item)) {
      // A row that cannot be activated gets no drag handle, so reaching here
      // means the type was changed underneath us or the drag was synthesised.
      ui.notifications.warn(`${item.name} cannot be made ready — only active spells, abilities, and Extra Skills can.`);
      return;
    }
    await setFeatureActive(actor, item, true);
    await sheet.render(false);
  });

  // Dropping back onto the list puts an ability away.
  featureListZone.on("dragover", onActiveDragOver);
  featureListZone.on("dragenter", onActiveDragOver);
  featureListZone.on("dragleave", ev => ev.currentTarget.classList.remove("is-drag-over"));
  featureListZone.on("drop", async ev => {
    ev.preventDefault();
    ev.currentTarget.classList.remove("is-drag-over");
    const dragData = readItemDragData(ev.originalEvent);
    const item = dragData?.itemId ? actor.items.get(dragData.itemId) : null;
    if (!item) return;
    await setFeatureActive(actor, item, false);
    await sheet.render(false);
  });

  html.find("[data-action='feature-activate'], [data-action='feature-deactivate']").on("click", async ev => {
    ev.stopPropagation();
    const btn = ev.currentTarget;
    const item = actor.items.get(btn.dataset.itemId);
    if (!item) return;
    if (!canActivateFeature(item)) {
      ui.notifications.warn(`${item.name} cannot be made ready — only active spells, abilities, and Extra Skills can.`);
      return;
    }
    await setFeatureActive(actor, item, btn.dataset.action === "feature-activate");
    await sheet.render(false);
  });

  // ── Hand slots ──────────────────────────────────────────────
  html.find("[data-action='equip-hand']").on("click", async ev => {
    const btn  = ev.currentTarget;
    const id   = btn.dataset.itemId || btn.closest("[data-item-id]")?.dataset.itemId;
    const hand = btn.dataset.hand;
    const item = actor.items.get(id);
    if (!item || !["left","right"].includes(hand)) return;
    if (!organUsable(actor, `${hand}Hand`)) {
      ui.notifications.warn(`The ${hand} hand is disabled.`);
      return;
    }
    if (await equipInHand(actor, item, hand)) await sheet.render(false);
  });

  html.find("[data-action='equip-body-select']").on("change", async ev => {
    const select = ev.currentTarget;
    const id = select.dataset.itemId || select.closest("[data-item-id]")?.dataset.itemId;
    const slot = select.value;
    if (!slot) return;
    const item = actor.items.get(id);
    if (await equipBodyItem(actor, item, slot)) await sheet.render(false);
  });

  html.find("[data-action='equip-body']").on("click", async ev => {
    const btn  = ev.currentTarget;
    const id   = btn.dataset.itemId || btn.closest("[data-item-id]")?.dataset.itemId;
    const slot = btn.dataset.slot;
    const item = actor.items.get(id);
    if (await equipBodyItem(actor, item, slot)) await sheet.render(false);
  });

  html.find("[data-action='clear-body']").on("click", async ev => {
    const id = ev.currentTarget.dataset.itemId || ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    await actor.items.get(id)?.update({ "system.equipmentSlot": "", "system.handSlot": "" });
    await sheet.render(false);
  });

  html.find("[data-action='clear-hand']").on("click", async ev => {
    const btn = ev.currentTarget;
    const id  = btn.dataset.itemId || btn.closest("[data-item-id]")?.dataset.itemId;
    await actor.items.get(id)?.update({"system.handSlot": ""});
    await sheet.render(false);
  });

  // ── Conditions ──────────────────────────────────────────────
  html.find("[data-action='manage-conditions']").on("click", () => {
    if (game.user.isGM) conditionManager(actor);
  });

  // ── Custom attributes ───────────────────────────────────────
  // The name/value/description inputs use indexed names
  // (system.customAttributes.N.value) and are saved by the generic field-save
  // handler below, so this only has to own adding and removing rows.
  const readCustomAttributes = () =>
    (Array.isArray(actor.system?.customAttributes) ? actor.system.customAttributes : [])
      .map(entry => ({
        name:        String(entry?.name        ?? ""),
        value:       String(entry?.value       ?? ""),
        description: String(entry?.description ?? ""),
      }));

  html.find("[data-action='custom-attr-add']").on("click", async ev => {
    ev.preventDefault();
    const next = readCustomAttributes();
    next.push({ name: "", value: "", description: "" });
    await actor.update({ "system.customAttributes": next });
    await sheet.render(false);
  });

  html.find("[data-action='custom-attr-remove']").on("click", async ev => {
    ev.preventDefault();
    const index = Number(ev.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0) return;
    const next = readCustomAttributes();
    if (index >= next.length) return;
    next.splice(index, 1);
    await actor.update({ "system.customAttributes": next });
    await sheet.render(false);
  });

  // ── ID card ──────────────────────────────────────────────────
  html.find("[data-action='show-id-card']").on("click", ev => {
    ev.preventDefault();
    showIdCard(actor);
  });

  // ── Level & Experience ──────────────────────────────────────
  html.find("[data-action='grant-experience']").on("click", () => {
    if (game.user.isGM) experienceAwardDialog(actor);
  });

  // The bar's fill is a data attribute, not an inline style, so it has to be
  // applied here. Both sheets render one, so this lives in the shared binder.
  html.find(".rnr-xp-bar i").each((_, el) => { el.style.width = `${Number(el.dataset.progress) || 0}%`; });

  // ── Field save ──────────────────────────────────────────────
  // Foundry may re-render a sheet when another field changes before a textarea
  // emits its native `change` event. Save prose on input as well, with a short
  // debounce, so Biography/Description text is not lost while typing or tabbing.
  const saveField = async f => {
    let v = f.type==="checkbox" ? f.checked : f.value;
    if (f.name === "system.identity.identificationNumber") {
      v = String(v).replace(/\D/g, "").slice(0, 13);
      f.value = v;
      const duplicate = (game.actors?.contents ?? []).some(other => other !== actor && String(gp(other, f.name, "")) === v && v.length === 13);
      if (duplicate) { ui.notifications.warn("Identification No. must be unique."); return; }
    }
    if (f.name === "system.identity.dateOfBirth" && v && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) {
      ui.notifications.warn("Date of Birth must use YYYY-MM-DD."); return;
    }
    // Level is not a plain field: typing a new number has to move Health max and
    // Willpower max with it. Writing `system.progression.level` on its own left
    // the character one level down with the HP and Willpower of the old level,
    // which is exactly the desync this route exists to prevent.
    if (f.name === "system.progression.level") {
      await setProgressionLevel(actor, Number(v));
      return;
    }
    try {
      await actor.update({ [f.name]: f.type==="number" ? Number(v)||0 : v });
    } catch (error) {
      console.error(`RnR | failed to save ${f.name}`, error);
      ui.notifications.error(`Could not save ${f.name}.`);
    }
  };
  const textSaveTimers = new WeakMap();
  html.find("input[name],textarea[name]").not(".rnr-organ-choice input").on("change", async ev => saveField(ev.currentTarget));
  html.find("textarea[name]").not(".rnr-organ-choice input").on("input", ev => {
    const field = ev.currentTarget;
    clearTimeout(textSaveTimers.get(field));
    textSaveTimers.set(field, setTimeout(() => saveField(field), 250));
  });
  // Do not rely only on `change`: closing a Foundry sheet or switching tabs can
  // replace the form before that event reaches the normal listener. Blur is the
  // last reliable boundary when a player finishes typing prose.
  html.find("textarea[name]").not(".rnr-organ-choice input").on("blur", ev => {
    const field = ev.currentTarget;
    clearTimeout(textSaveTimers.get(field));
    textSaveTimers.delete(field);
    saveField(field);
  });
  html.find(".rnr-organ-choice input").on("change", async () => {
    const organs = html.find(".rnr-organ-choice input:checked").map((_, el) => el.value).get();
    await actor.update({ "system.identity.disabledOrgans": organs });
  });
  // Clicking a body part on the Body Condition figure toggles that organ.
  html.find(".rnr-body-figure[data-figure='organs'] [data-organ]").on("click", ev => {
    const input = html.find(`.rnr-organ-choice input[value="${ev.currentTarget.dataset.organ}"]`)[0];
    if (!input || input.disabled) return;
    input.checked = !input.checked;
    globalThis.jQuery(input).trigger("change");
  });
  // Hovering a wear slot or an organ chip highlights the matching body part.
  const highlightRegion = (selector, key, on) =>
    html.find(`${selector} [data-region="${key}"]`).toggleClass("is-hover", on);
  html.find(".rnr-wear-slot").on("mouseenter mouseleave", ev =>
    highlightRegion(".rnr-body-figure[data-figure='equipment']", ev.currentTarget.dataset.bodySlot, ev.type === "mouseenter"));
  html.find(".rnr-organ-choice[data-organ]").on("mouseenter mouseleave", ev =>
    highlightRegion(".rnr-body-figure[data-figure='organs']", ev.currentTarget.dataset.organ, ev.type === "mouseenter"));
  html.find("select[name]").on("change", async ev => {
    const f = ev.currentTarget;
    if (f.multiple) await actor.update({ [f.name]: [...f.selectedOptions].map(o=>o.value) });
    else            await actor.update({ [f.name]: f.value });
  });
}

// ─────────────────────────────────────────────────────────────
//  CHARACTER SHEET
// ─────────────────────────────────────────────────────────────

class RnRActorSheet extends RnRHandlebarsActorSheet {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: [...(super.DEFAULT_OPTIONS.classes ?? []), "rnr", "sheet", "actor"],
    tag: "form",
    position: { ...super.DEFAULT_OPTIONS.position, width: 1000, height: 820 },
    form: { ...super.DEFAULT_OPTIONS.form, submitOnChange: false, closeOnSubmit: false },
  };

  static PARTS = {
    main: { template: "systems/rnr/templates/actor-sheet.html" },
  };

  _initializeApplicationOptions(options) {
    return fitSheetToViewport(super._initializeApplicationOptions(options));
  }

  /** Close at once instead of waiting for Foundry's shrink animation. */
  close(options = {}) {
    return super.close({ animate: false, ...options });
  }

  async _prepareContext(options) {
    const base = await super._prepareContext(options);
    const actor = this.actor;
    const data = buildData({ ...base, actor, system: actor.system ?? {}, cssClass: "" });

    data.sheetTheme = resolveSheetTheme(actor);

    // Backpack items. ActorSheet data differs between Foundry releases, so read the
    // embedded Item collection first and fall back to the base sheet data.
    const embeddedItems = actor.items?.contents ?? actor.items?.toArray?.() ?? data.items ?? [];
    const bodyAssignments = bodyEquipmentAssignments(embeddedItems);
    data.items = Array.from(embeddedItems).map(item => {
      const sys = item.system ?? {};
      const rawDamage = sys.damageFormula ?? sys.damage;
      const damage = typeof rawDamage === "string"
        ? rawDamage
        : rawDamage?.base?.formula ?? rawDamage?.base?.value ?? "";
      const description = sys.description?.value ?? "";
      return {
        id:          item.id,
        name:        item.name || "Unnamed Item",
        img:         item.img,
        type:        item.type,
        system: {
          abilityType: sys.abilityType,
          activationType: sys.activationType,
          featureType: sys.featureType,
          mode: sys.mode,
          actionType: sys.actionType,
          castingTime: sys.castingTime,
        },
        quantity:    Math.max(1, Number(sys.quantity) || 1),
        handSlot:    ["left", "right"].includes(sys.handSlot) ? sys.handSlot : "",
        equipmentSlot: bodyAssignments.get(item.id) || "",
        isWeapon:    item.type === "weapon",
        isArmor:     item.type === "armor",
        isConsumable:item.type === "consumable",
        isExtraSkill:item.type === "extraskills",
        canRoll:     ["weapon", "ability", "spell"].includes(item.type),
        // extraskills cannot be equipped to hand or body
        canEquipHand:["weapon", "equipment", "tool", "consumable"].includes(item.type),
        canHold:     canHoldItem(item),
        canWear:     isWearableItem(item),
        wearSlots:   allowedBodySlots(item).map(key => ({ key, label: BODY_EQUIPMENT_SLOTS.find(([slot]) => slot === key)?.[1] || key })),
        description,
        damage,
        damageType:  sys.damageType || "",
        armorValue:  Number(sys.armorValue) || 0,
        armorType:   sys.armorType || "",
        effect:      sys.effect || "",
        bonus:       Number(sys.bonus) || 0,
        speedBonus:  Number(sys.speedBonus) || 0,
        healthBonus: Number(sys.healthBonus) || 0,
        isMechaBracelet: item.flags?.RnR?.mechaBracelet === true,
      };
    });
    const backpackCategory = (item) => {
      if (item.type === "weapon") return "weapons";
      if (["armor", "equipment", "tool"].includes(item.type)) return "equipment";
      if (["consumable", "loot"].includes(item.type)) return "consumables";
      if (["spell", "ability"].includes(item.type)) return "magic";
      return "features";
    };
    const backpackCategoryLabels = {
      weapons: "Weapons",
      equipment: "Equipment",
      consumables: "Consumables",
      magic: "Magic & Abilities",
      features: "Features & Other",
    };
    data.items.forEach(item => {
      item.categoryKey = backpackCategory(item);
      item.categoryLabel = backpackCategoryLabels[item.categoryKey];
    });
    const bodySlots = BODY_EQUIPMENT_SLOTS;
    // A two-handed item records one `handSlot` but occupies both hands, so it
    // is shown in each. Without this it would look like the free hand was empty
    // while the sheet silently refused to accept anything for it.
    data.leftHand  = data.items.find(i => i.handSlot === "left" || (i.handSlot === "right" && handsNeeded(i) === 2)) || null;
    data.rightHand = data.items.find(i => i.handSlot === "right" || (i.handSlot === "left"  && handsNeeded(i) === 2)) || null;
    data.bodyEquipment = bodySlots.map(([key, label, icon]) => ({
      key, label, icon, cssClass: `slot-${key}`,
      usable: bodySlotUsable(actor, key),
      item: data.items.find(i => i.equipmentSlot === key) || null,
    }));
    const slotByKey = new Map(data.bodyEquipment.map(slot => [slot.key, slot]));
    const slotsFor = keys => keys.map(key => slotByKey.get(key)).filter(Boolean);
    data.wearCore  = slotsFor(BODY_SLOT_COLUMNS.center);
    data.wearRight = slotsFor(BODY_SLOT_COLUMNS.right);
    data.wearLeft  = slotsFor(BODY_SLOT_COLUMNS.left);
    data.wornCount = data.bodyEquipment.filter(slot => slot.item).length;
    data.wearSlotCount = data.bodyEquipment.length;
    data.equipFigure = bodyFigureSvg("equipment", Object.fromEntries(data.bodyEquipment
      .map(slot => [slot.key, slot.item ? "equipped" : slot.usable ? "" : "unusable"])));
    data.organFigure = bodyFigureSvg("organs", Object.fromEntries((data.disabledOrgans ?? [])
      .map(organ => [organ.key, !organ.usable ? "disabled" : organ.selected ? "prosthetic" : ""])));
    data.backpackItems = data.items.filter(i => !i.handSlot && !i.equipmentSlot);
    const makeGroups = keys => Object.entries(backpackCategoryLabels)
      .filter(([key]) => keys.includes(key))
      .map(([key, label]) => {
        const items = data.backpackItems.filter(item => item.categoryKey === key);
        return { key, label, items, count: items.length };
      }).filter(group => group.count);
    data.backpackGroups = makeGroups(["weapons", "equipment", "consumables"]);
    data.featureGroups = makeGroups(["features", "magic"]);
    data.hasFeatures = data.featureGroups.length > 0;
    // The raw `type` reads as a developer string on the card ("extraskills",
    // "class"). These are the only types a feature can be, and each has a name a
    // player would recognise.
    const featureTypeLabels = {
      spell: "Spell", ability: "Ability", extraskills: "Extra Skill",
      class: "Class", subclass: "Subclass", background: "Background", race: "Race",
    };
    // ── Active abilities ─────────────────────────────────────
    // Only active spells, abilities, and Extra Skills can be made ready, and
    // only by dragging them into the bar. `isActive` drives the Use button, so a feature not
    // been dragged in is visible but not usable - which is the whole point of
    // the bar.
    const activeIds = new Set(activeFeatureIds(actor).slice(0, MAX_ACTIVE_FEATURES));
    for (const item of data.items) {
      item.typeLabel  = featureTypeLabels[item.type] ?? String(item.type ?? "");
      item.featureMode = featureMode(item);
      item.actionTypeLabel = actionTypeLabel(item);
      const modeLabel = item.type === "ability" && !item.actionTypeLabel ? item.featureMode : "";
      item.featureModeLabel = [item.actionTypeLabel || modeLabel, item.typeLabel].filter(Boolean).join(" · ");
      const quantity  = Number(item.quantity) || 0;
      // Only meaningful for things that are actually counted; a weapon sitting
      // in the pack is always one of it, so "×1" is noise there.
      item.hasQuantity = quantity > 1;
      item.quantity    = quantity;
      item.canActivate = ACTIVATABLE_TYPES.has(item.type) && item.featureMode === "ACTIVE";
      item.isActive    = item.canActivate && activeIds.has(item.id);
      // Only a feature that can actually be activated gets a drag handle.
      item.canDragFeature = item.canActivate;
      // Why a row is not draggable, so the row can say so instead of silently
      // ignoring the drag.
      item.activationHint = item.canActivate
        ? (item.isActive ? "Drag out of the bar to put away" : "Drag into the bar to make ready")
        : "Not an active ability — edit the item to change its type";
    }
    // Ids pointing at a deleted or no-longer-activatable item are skipped
    // rather than rendered as a dead slot.
    data.activeFeatures = [...activeIds]
      .map(id => data.items.find(i => i.id === id && i.canActivate))
      .filter(Boolean);
    data.hasActiveFeatures = data.activeFeatures.length > 0;
    return data;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const jq = globalThis.jQuery ?? globalThis.$;
    if (typeof jq === "function") this.activateListeners(jq(this.element));
    else console.error("RnR | jQuery is unavailable; Character sheet listeners were not bound.");
  }

  activateListeners(html) {
    const actor = this.actor;

    bindCommonListeners(this, html);

    // XP bar: sized in bindCommonListeners so the NPC sheet's bar fills too.

    // State Point
    html.find("[data-action='state-point']").on("click",()=>statePointDialog(actor));

    // Extra Skill Shop
    html.find("[data-action='extra-skill-shop']").on("click",()=>extraSkillShop(actor));

    // Rest
    html.find("[data-action='rest']").on("click",()=>restDialog(actor));

    // Down & Recovery
    html.find("[data-action='death-save']").on("click",()=>rollDeathRecovery(actor));
    html.find("[data-action='death-reset']").on("click",async()=>{
      await actor.update({
        "system.death.state":    DEATH_STATES.HEALTHY,
        "system.death.rounds":   0,
        "system.death.recovery": 0,
      });
    });
    if (game.user.isGM) {
      html.find("[data-action='death-decease']").on("click", async () => {
        const yes = await RnRDialogV2.confirm({
          window: { title: "Declare Deceased" },
          content: `<p>Mark <strong>${actor.name}</strong> as deceased?</p>
            <p class="notes">This is a GM decision, never automatic. Recovery will be blocked until a
            character is brought back some other way.</p>`,
          yes: { label: "Yes" },
          no: { label: "No", default: true },
          rejectClose: false,
        });
        if (!yes) return;
        await markDeceased(actor);
        this.render();
      });
    }

    // Initiative
    html.find("[data-action='roll-initiative']").on("click",async()=>{
      const mod = attrMod(Number(gp(actor,"system.attributes.dexterity.value"))||8);
      if (game.combat) {
        const comb = game.combat;
        const existing = comb.combatants.find(c=>c.actorId===actor.id);
        if (!existing) await comb.createEmbeddedDocuments("Combatant",[{actorId:actor.id, tokenId:actor.token?.id??null}]);
        const ids = comb.combatants.filter(c=>c.actorId===actor.id).map(c=>c.id);
        await comb.rollInitiative(ids);
      } else {
        await rollDialog(actor, "Initiative", mod, "Dexterity");
      }
    });

    // Close
    html.find("[data-action='close']").on("click",()=>this.close());

    // Tabs: one visible workspace at a time, with a clear active state.
    const setCharacterTab = (tab) => {
      html.find(".rnr-tabs .item").removeClass("active").attr("aria-selected", "false");
      html.find(`.rnr-tabs .item[data-tab="${tab}"]`).addClass("active").attr("aria-selected", "true");
      html.find(".rnr-body").attr("data-active-tab", tab);
    };
    html.find(".rnr-tabs .item").on("click", ev => {
      ev.preventDefault();
      const tab = ev.currentTarget.dataset.tab || "main";
      this._activeTab = tab;
      setCharacterTab(tab);
    });
    // Restore last active tab instead of always resetting to main
    setCharacterTab(this._activeTab || "main");
  }
}

// ─────────────────────────────────────────────────────────────
//  NPC SHEET
// ─────────────────────────────────────────────────────────────

class RnRNpcSheet extends RnRHandlebarsActorSheet {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: [...(super.DEFAULT_OPTIONS.classes ?? []), "rnr", "sheet", "actor", "npc"],
    tag: "form",
    position: { ...super.DEFAULT_OPTIONS.position, width: 820, height: 680 },
    form: { ...super.DEFAULT_OPTIONS.form, submitOnChange: false, closeOnSubmit: false },
  };

  static PARTS = {
    main: { template: "systems/rnr/templates/npc-sheet.html" },
  };

  _initializeApplicationOptions(options) {
    return fitSheetToViewport(super._initializeApplicationOptions(options));
  }

  /** Close at once instead of waiting for Foundry's shrink animation. */
  close(options = {}) {
    return super.close({ animate: false, ...options });
  }

  async _prepareContext(options) {
    const base = await super._prepareContext(options);
    const actor = this.actor;
    const data = buildData({ ...base, actor, system: actor.system ?? {}, cssClass: "" });

    data.sheetTheme = resolveSheetTheme(actor);

    const embeddedItems = actor.items?.contents ?? actor.items?.toArray?.() ?? [];
    data.items = embeddedItems.map(item => ({
      id: item.id, name: item.name, img: item.img, type: item.type,
      system: item.system ?? {},
    }));

    data.isVehicle = actor.type === "vehicle";
    data.isMecha = data.isVehicle && data.settingProfileKey === "mecha";
    if (data.isVehicle) {
      const sys = actor.system ?? {};
      // Speed, Cover and Armor DR all live under system.defenses. That is the
      // single canonical home: template.json declares them there, the sheet
      // inputs write there, damage.js and the AE presets read there, and schema 8
      // migrated the old top-level system.speed / system.cover / system.armorDR
      // out of existence. Reading them from the old paths made every vehicle
      // display 0 while the data was sitting there untouched.
      data.vehicle = {
        model:        sys.model || "",
        manufacturer: sys.manufacturer || "",
        serial:       sys.serial || "",
        vehicleType: sys.vehicleType || "land",
        speed:       Number(gp(actor, "system.defenses.speed")) || 0,
        handling:    Number(sys.handling) || 0,
        cover:       Number(gp(actor, "system.defenses.cover")) || 0,
        crewValue:   Array.isArray(sys.crew?.value) ? sys.crew.value.length : 0,
        crewMax:     Number(sys.crew?.max) || 0,
        passengers:  Number(sys.passengers) || 0,
        cargo:       Number(sys.cargo) || 0,
        armorDR:     Number(gp(actor, "system.defenses.armorDamageReduction")) || 0,
        weaponSystems: Array.isArray(sys.weaponSystems) ? sys.weaponSystems : [],
      };
    }

    data.actionItems = (data.items ?? [])
      .filter(i => ["weapon","ability","spell"].includes(i.type))
      .map(i => {
        const sys = i.system ?? {};
        return {
          id:        i.id,
          name:      i.name,
          img:       i.img,
          type:      i.type,
          typeLabel: i.type.toUpperCase(),
          detail:    sys.damageFormula ? `${sys.damageFormula}${sys.damageType?" "+sys.damageType:""}` : sys.effect || "",
        };
      });

    return data;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const jq = globalThis.jQuery ?? globalThis.$;
    if (typeof jq === "function") this.activateListeners(jq(this.element));
    else console.error("RnR | jQuery is unavailable; NPC/Vehicle sheet listeners were not bound.");
  }

  activateListeners(html) {
    const actor = this.actor;

    bindCommonListeners(this, html);

    // V14's legacy ActorSheet bridge does not consistently submit custom
    // templates on change. Save each named system field directly as a fallback.
    html.find(".rnr-npc-sheet input[name], .rnr-npc-sheet select[name], .rnr-npc-sheet textarea[name]").on("change", async ev => {
      const field = ev.currentTarget;
      const path = field.name;
      if (!path || !path.startsWith("system.")) return;
      let value = field.value;
      if (field.type === "checkbox") value = Boolean(field.checked);
      else if (field.type === "number") value = value === "" ? null : Number(value);
      try {
        await actor.update({ [path]: value });
      } catch (error) {
        console.error(`RnR | Could not save NPC/Vehicle field ${path}`, error);
        ui.notifications.error(`Could not save ${field.labels?.[0]?.textContent?.trim() || path}. Check permissions and the Foundry console.`);
      }
    });

    // NPC Tabs
    const setNpcTab = (tab) => {
      html.find(".rnr-tabs .item").removeClass("active").attr("aria-selected", "false");
      html.find(`.rnr-tabs .item[data-tab="${tab}"]`).addClass("active").attr("aria-selected", "true");
      html.find(".rnr-npc-body").attr("data-active-tab", tab);
      html.find(".rnr-npc-tab").hide();
      html.find(`.rnr-npc-tab[data-tab-content="${tab}"]`).show();
    };
    html.find(".rnr-tabs .item").on("click", ev => {
      ev.preventDefault();
      const tab = ev.currentTarget.dataset.tab || "stats";
      this._activeTab = tab;
      setNpcTab(tab);
    });
    // Restore last active tab
    setNpcTab(this._activeTab || "stats");

    html.find("[data-action='close']").on("click", () => this.close());

    // Initiative
    html.find("[data-action='npc-roll-initiative']").on("click", async () => {
      const mod = attrMod(Number(gp(actor,"system.attributes.dexterity.value"))||8);
      if (game.combat) {
        const comb = game.combat;
        const existing = comb.combatants.find(c=>c.actorId===actor.id);
        if (!existing) await comb.createEmbeddedDocuments("Combatant",[{actorId:actor.id, tokenId:actor.token?.id??null}]);
        await comb.rollInitiative(comb.combatants.filter(c=>c.actorId===actor.id).map(c=>c.id));
      } else {
        await rollDialog(actor, "Initiative", mod, "Dexterity");
      }
    });

    // Rest
    html.find("[data-action='npc-rest']").on("click",()=>restDialog(actor));

    // NPC Attributes stepper (+ / -)
    html.find("[data-action='npc-attr-down']").on("click", async ev => {
      ev.preventDefault();
      const key = ev.currentTarget.dataset.attr;
      const cur = Number(foundry.utils.getProperty(actor, `system.attributes.${key}.value`)) || 8;
      await actor.update({ [`system.attributes.${key}.value`]: Math.max(1, cur - 1) });
    });

    html.find("[data-action='npc-attr-up']").on("click", async ev => {
      ev.preventDefault();
      const key = ev.currentTarget.dataset.attr;
      const cur = Number(foundry.utils.getProperty(actor, `system.attributes.${key}.value`)) || 8;
      await actor.update({ [`system.attributes.${key}.value`]: cur + 1 });
    });


  }
}

// ─────────────────────────────────────────────────────────────
//  SESSION 0 WORLD GUIDE FALLBACK
// ─────────────────────────────────────────────────────────────

async function ensureSession0WorldGuide() {
  if (!game.user?.isGM || !globalThis.JournalEntry) return;
  const guideName = "RnR — Session 0 Guide (พร้อมเล่น)";
  const guideCandidates = game.journal?.filter(j => j.flags?.RnR?.session0WorldGuide || j.name?.startsWith("RnR — Session 0")) ?? [];
  const existingGuide = guideCandidates.find(j => j.name === guideName);
  for (const duplicate of guideCandidates) {
    if (duplicate.id !== existingGuide?.id) await duplicate.delete();
  }
  if (existingGuide?.flags?.RnR?.guideRevision === GUIDE_REVISION) return;

  // Session 0 is maintained as one world Journal only. The old broken
  // JournalEntry Compendium was intentionally removed.
  const pack = null;
  let importedPages = [];
  if (pack) {
    try {
      const documents = await pack.getDocuments();
      for (const document of documents) {
        for (const page of document.pages ?? []) {
          if (page.type !== "text" || !page.text?.content) continue;
          importedPages.push({
            name: `${document.name} — ${page.name}`,
            type: "text",
            sort: importedPages.length * 100,
            text: { content: page.text.content, format: page.text.format ?? 1 },
          });
        }
      }
    } catch (error) {
      console.warn("RnR | Session 0 pack could not be read; using fallback guide", error);
    }
  }

  // The World copy is intentionally rebuilt from the detailed fallback below.
  // This also replaces an older empty/cached World Journal created by v0.2.2.

  if (!importedPages.length) {
    for (const p of buildSession0Pages()) importedPages.push(p);
  }

  const data = {
    name: guideName,
    img: "icons/magic/symbols/runes-carved-stone-yellow.webp",
    pages: importedPages,
    flags: { RnR: { session0WorldGuide: true, createdBy: "RnR", guideRevision: GUIDE_REVISION } },
  };
  if (existingGuide) {
    await existingGuide.update(data);
    ui.notifications.info("RnR | Session 0 Guide updated in the Journal Directory.");
  } else {
    await JournalEntry.create(data);
    ui.notifications.info("RnR | Session 0 Guide created in the Journal Directory.");
  }
}

// ─────────────────────────────────────────────────────────────
//  HOOKS
// ─────────────────────────────────────────────────────────────

Hooks.once("init", () => {
  console.log("Role&Roll | init");

  // ── Register world schema version setting ──────────────────
  game.settings.register("RnR", "worldSchemaVersion", {
    name:    "World Schema Version",
    scope:   "world",
    config:  false,
    type:    Number,
    default: 0,
  });
  game.settings.register("RnR", "settingProfile", {
    name: "Campaign Setting Profile",
    hint: "Default genre for the world. It picks the sheet theme for every actor and item, so a campaign reads as one setting; there is no per-sheet override any more. Cosmetic plus genre guidance only - it never changes RnR mechanics.",
    scope: "world",
    config: true,
    type: String,
    default: "universal",
    choices: Object.fromEntries(Object.keys(SETTING_PROFILES).map(key => [key, settingProfileLabel(key)])),
  });
  // The attribute curve is not pinned to a dnd5e-style midpoint. RnR treats the
  // baseline rating as the neutral point, so a freshly created character is
  // +0 across the board rather than starting every attribute at a penalty.
  game.settings.register("RnR", "attributeBaseline", {
    name: "Attribute Baseline",
    hint: "Rating that counts as a +0 modifier. RnR uses 8 by default so a new character starts neutral. Change it to re-anchor the whole curve without touching any sheet.",
    scope: "world",
    config: true,
    type: Number,
    default: 8,
    choices: Object.fromEntries([6, 7, 8, 9, 10, 11, 12].map(n => [n, `Neutral at ${n}`])),
  });
  // Cover and long range contribute flat modifiers only. Defaults stay gentle so
  // a wall is a meaningful but survivable change of pace rather than a swing to
  // disadvantage the way dnd5e's three-quarter cover rule did.
  game.settings.register("RnR", "longRangePenalty", {
    name: "Long Range Modifier",
    hint: "Modifier for attacking past a ranged weapon's comfortable range. 0 means long range is purely informational.",
    scope: "world", config: true, type: Number, default: 0,
  });
  game.settings.register("RnR", "coverPartialBonus", {
    name: "Partial Cover Defence",
    hint: "Reflex bonus granted by one wall between attacker and target.",
    scope: "world", config: true, type: Number, default: 2,
  });
  game.settings.register("RnR", "coverSubstantialBonus", {
    name: "Substantial Cover Defence",
    hint: "Reflex bonus granted by two walls between attacker and target.",
    scope: "world", config: true, type: Number, default: 4,
  });
  game.settings.register("RnR", "coverTotalBonus", {
    name: "Total Cover Defence",
    hint: "Reflex bonus granted by three or more walls. Total cover also blocks the attack outright; set 0 to let attacks through.",
    scope: "world", config: true, type: Number, default: 6,
  });
  // Down & Recovery knobs. Every number is exposed so a campaign can retune the
  // model without touching code.
  game.settings.register("RnR", "deathRecoveryDC", {
    name: "Recovery DC",
    hint: "Roll at or above this to gain one step of recovery while down.",
    scope: "world", config: true, type: Number, default: 10,
  });
  game.settings.register("RnR", "deathRecoverySteps", {
    name: "Recovery Steps Needed",
    hint: "Total recovery progress required before a downed character stands back up.",
    scope: "world", config: true, type: Number, default: 2,
  });
  game.settings.register("RnR", "deathEscalationRounds", {
    name: "Escalation Rounds",
    hint: "Rounds spent down before the GM is prompted to step in. RnR never kills a character automatically.",
    scope: "world", config: true, type: Number, default: 3,
  });
  game.settings.register("RnR", "deathRecoveryHP", {
    name: "Health on Recovery",
    hint: "Minimum health restored when a character gets back up.",
    scope: "world", config: true, type: Number, default: 1,
  });

  foundry.applications.apps.DocumentSheetConfig.registerSheet(Item, "rnr", RnRItemSheet, {
    label: "Role&Roll Item Sheet", makeDefault: true,
  });
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, "rnr", RnRActorSheet, {
    label: "Role&Roll Character Sheet", types: ["character"], makeDefault: true,
  });
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, "rnr", RnRNpcSheet, {
    label: "Role&Roll NPC / Vehicle Sheet", types: ["npc", "vehicle"], makeDefault: true,
  });

  // Initiative: patch getInitiativeRoll to use the Dexterity modifier
  Hooks.once("setup", () => {
    CONFIG.Actor.documentClass.prototype.getInitiativeRoll = function(_opts = {}) {
      const dexVal = Number(foundry.utils.getProperty(this, "system.attributes.dexterity.value")) || attrBaseline();
      const mod    = attrMod(dexVal);
      const f = buildFormula("1d20", mod);
      return new Roll(f, this.getRollData());
    };
  });

  CONFIG.Combat.initiative = { formula: "1d20", decimals: 0 };

  // ── Register GM Toolbar ────────────────────────────────────
  registerGmToolbar();

  console.log("Role&Roll | sheets registered");
});

Hooks.once("ready", async () => {
  registerMechaMacroApi();
  // GM health check: `await game.RnR.smokeTest()` in the console (F12).
  game.RnR.smokeTest = runSmokeTest;
  for (const actor of game.actors?.contents ?? []) initActor(actor);

  // ── Run migrations ──────────────────────────────────────────
  await runMigrations();
  await ensureSession0WorldGuide();

  // Conditions live on the actor, so a token placed before the actor was set up
  // never learns which effects it should be showing. Re-applying the icons once
  // the world has loaded makes a page reload restore them without a manual step.
  for (const actor of game.actors?.contents ?? []) await syncTokenConditions(actor);

  console.log("Role&Roll | ready");
});

// Every newly created character starts with a usable unarmed action in both hands.
Hooks.on("createActor", async (actor, _options, userId) => {
  if (userId !== game.user.id || !["character", "npc", "vehicle"].includes(actor.type)) return;
  if (!String(gp(actor, "system.identity.identificationNumber", "")).match(/^\d{13}$/)) {
    await actor.update({ "system.identity.identificationNumber": uniqueIdentificationNumber(actor) });
  }
  const existing = actor.items?.contents?.filter(item => item.name === "Unarmed Strike" && item.type === "weapon") ?? [];
  const hasHand = hand => existing.some(item => item.system?.handSlot === hand);
  const missing = [];
  if (!hasHand("left")) missing.push("left");
  if (!hasHand("right")) missing.push("right");
  if (!missing.length) return;
  await actor.createEmbeddedDocuments("Item", missing.map(handSlot => ({
      name: "Unarmed Strike", type: "weapon", img: "icons/skills/melee/unarmed-punch-fist.webp",
      system: { quantity: 1, weight: 0, handSlot, weaponType: "melee", attribute: "strength", damageFormula: "1d4", damageType: "bludgeoning", damageBonus: 0, attackBonus: 0, properties: ["unarmed"] },
  })));
});

// Give every DialogV2 the same readable RnR theme, including dialogs created
// by helper functions and future content added to the system.
Hooks.on("renderApplicationV2", (app, element) => {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2 || !(app instanceof DialogV2)) return;
  // Only theme dialogs that carry RnR content. Core Foundry dialogs (create,
  // delete, import from Compendium) must keep their own layout.
  if (!app.element?.classList?.contains("rnr-dialog") && !element?.querySelector?.("[class*='rnr-']")) return;
  app.element?.classList?.add("rnr-dialog");
  element?.classList?.add("rnr-dialog-content");
});

Hooks.on("renderChatMessageHTML", (message, html) => {
  handleMechaSummonMessage(message);
  const creatorId = message.user?.id || message.author?.id;
  const root = html?.[0] ?? html;
  root?.querySelectorAll?.("[data-action]").forEach(button => {
    const isDefenseChoice = button.dataset.action === "defense-choice";
    if (isDefenseChoice) {
      // Any owner of the targeted actor may answer; do not lock the card to
      // whichever owner happened to appear first in game.users.
      const targetActor = resolveActor(button.dataset.targetActorId);
      if (targetActor && !game.user.isGM && !targetActor.isOwner && !targetActor.testUserPermission?.(game.user, "OWNER")) {
        button.disabled = true;
        button.title = "Only an owner of the targeted character can choose a defense.";
      } else if (!targetActor) {
        const fallbackOwnerId = button.dataset.allowedUserId;
        if (fallbackOwnerId && fallbackOwnerId !== game.user.id && !game.user.isGM) {
          button.disabled = true;
          button.title = "This defense belongs to the targeted character's owner.";
        }
      }
      return;
    }
    const allowedUserId = button.dataset.allowedUserId || creatorId;
    if (allowedUserId && allowedUserId !== game.user.id && !game.user.isGM) {
      button.disabled = true;
      button.title = "This Chat Card action belongs to another user.";
    }
  });
  // Delegate to chatcard module
    activateChatCardListeners(message, html, {
    // The card's own Attack button always means "roll the attack", so it needs
    // an explicit intent. Without it a click on that button would post another
    // copy of the same card instead of rolling.
    onAttack:  (actor, item, opts)   => itemRollFlow(actor, item, { ...opts, intent: "attack" }),
    onDamage:  (actor, item, opts)   => rollItemDamage(actor, item, opts),
    onHealing: (actor, item)         => rollItemHealing(actor, item),
    onReload:  (actor, item)         => reloadWeapon(actor, item),
    onDefenseChoice: (message, choice, button) => handleDefenseChoice(message, choice, button),
  });
});

// Origin, Class and Background bonuses. Dropping one of these Items on a
// character applies its bonuses (replacing the previous one of the same kind);
// deleting the Item that supplied them takes them back off. Only the user who
// made the change runs this, so bonuses are applied exactly once.
const ORIGIN_BONUS_HANDLERS = {
  race:       { key: "race",       apply: applyRaceBonus,       remove: removeRaceBonus },
  class:      { key: "class",      apply: applyClassBonus,      remove: removeClassBonus },
  background: { key: "background", apply: applyBackgroundBonus, remove: removeBackgroundBonus },
};

Hooks.on("createItem", async (item, _options, userId) => {
  if (userId !== game.user?.id) return;
  const handler = ORIGIN_BONUS_HANDLERS[item.type];
  const actor = item.parent;
  if (!handler || !(actor instanceof Actor) || actor.type !== "character") return;
  try {
    await handler.apply(actor, item);
    ui.notifications.info(`${item.name}: bonuses applied to ${actor.name}.`);
  } catch (error) {
    console.error(`RnR | Could not apply ${item.type} bonuses`, error);
  }
});

Hooks.on("deleteItem", async (item, _options, userId) => {
  if (userId !== game.user?.id) return;
  const handler = ORIGIN_BONUS_HANDLERS[item.type];
  const actor = item.parent;
  if (!handler || !(actor instanceof Actor) || actor.type !== "character") return;
  const applied = foundry.utils.getProperty(actor, `system.appliedBonuses.${handler.key}`);
  if (applied?.itemId !== item.id) return;
  try {
    await handler.remove(actor);
  } catch (error) {
    console.error(`RnR | Could not remove ${item.type} bonuses`, error);
  }
});

// Sync token conditions on actor update
Hooks.on("updateActor", (actor, changes) => {
  if (foundry.utils.hasProperty(changes, "system.conditions")) syncTokenConditions(actor);
});

// Reaching zero health puts a character Down and starts the recovery clock.
// Healing back up clears it again, so a party can stabilise someone with a
// med-kit instead of watching a death-save counter run out.
Hooks.on("rnrDamageApplied", async (actor, { newHp, healing }) => {
  if (!actor || actor.isToken) return;
  if (!healing && newHp <= 0) {
    await markDown(actor);
  } else if (healing && newHp > 0) {
    const snap = deathSnapshot(actor);
    if (snap.state === DEATH_STATES.ACTIVE || snap.state === DEATH_STATES.RECOVERING) {
      await actor.update({
        "system.death.state":    DEATH_STATES.RECOVERED,
        "system.death.rounds":   0,
        "system.death.recovery": 0,
      });
    }
  }
});

// Auto-add token to active combat
Hooks.on("createToken", async (tokenDoc) => {
  // A token created for an actor that is already conditioned must start with
  // its icons, otherwise it only picks them up the next time the actor updates.
  if (tokenDoc.actor) await syncTokenConditions(tokenDoc.actor);
  if (!game.user.isGM || !game.combat?.started) return;
  const actor = tokenDoc.actor;
  if (!actor) return;
  if (game.combat.combatants.some(c => c.tokenId === tokenDoc.id)) return;
  await game.combat.createEmbeddedDocuments("Combatant",[{
    actorId: actor.id,
    tokenId: tokenDoc.id,
    sceneId: tokenDoc.parent?.id,
  }]);
  ui.notifications.info(`${actor.name} added to combat.`);
});

// ── Active Effect expiry on combat turn ─────────────────────
Hooks.on("combatTurn", async (combat, _updateData, _opts) => {
  if (!game.user.isGM) return;
  const currentActor = combat.combatant?.actor;
  if (currentActor) await currentActor.update({ "system.combatDefense": { round: Number(combat.round) || 0, defensesUsed: 0, counterUsed: false, lastChallengeId: "" } });
  const round = combat.round;
  for (const combatant of combat.combatants.contents) {
    if (!combatant.actor) continue;
    await removeExpiredEffects(combatant.actor, round);
  }
});

// ── Clear legacy item-sourced Active Effects when gear is re-equipped.
//    Bonuses are computed live by buildData() from the worn items, so no
//    effect is created here; this only cleans up effects made by older
//    versions of the system, which used to double-count every worn bonus.
Hooks.on("updateItem", async (item, changes) => {
  if (!item.parent) return;
  if (!foundry.utils.hasProperty(changes, "system.equipmentSlot")) return;

  const actor = item.parent;
  await removeItemEffect(actor, item.id);
});

// Foundry only needs the module side effects, but the two-handed hand rule is
// exported so it can be tested on its own. It is the part of this file with the
// most edge cases (one↔two hands, offhand, disabled limbs) and the fewest
// opportunities to notice a mistake by looking at it.
export { handsNeeded, handOccupant, equipInHand };
