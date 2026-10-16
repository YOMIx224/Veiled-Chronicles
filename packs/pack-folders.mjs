/**
 * pack-folders.mjs
 * Folder layout inside each compendium pack. build-packs.mjs files every
 * document into a folder from these rules, so new source JSON is sorted
 * automatically and the source files never carry folder IDs.
 *
 * A rule returns the folder name for a document, or null to leave it at the
 * pack root. Folders are listed in display order; each folder sorts its
 * contents alphabetically.
 */
import { createHash } from "node:crypto";

const titleCase = value => String(value ?? "").replace(/\b\w/g, c => c.toUpperCase());

const EQUIPMENT_SLOT_GROUPS = {
  head: "Head & Neck", neck: "Head & Neck",
  torso: "Body & Back", back: "Body & Back", waist: "Body & Back",
  hands: "Arms & Hands", ring: "Arms & Hands", leftArm: "Arms & Hands", rightArm: "Arms & Hands",
  feet: "Legs & Feet", leftLeg: "Legs & Feet", rightLeg: "Legs & Feet",
};

export const PACK_FOLDERS = {
  "rnr-weapons": {
    folders: ["Melee Weapons", "Ranged Weapons"],
    rule: doc => (doc.system?.weaponType === "ranged" ? "Ranged Weapons" : "Melee Weapons"),
  },
  "rnr-armors": {
    folders: ["Light Armor", "Medium Armor", "Heavy Armor", "Shields", "Accessories"],
    rule: doc => ({ light: "Light Armor", medium: "Medium Armor", heavy: "Heavy Armor", shield: "Shields" })[doc.system?.armorType] ?? "Accessories",
  },
  "rnr-equipment": {
    folders: ["Head & Neck", "Body & Back", "Arms & Hands", "Legs & Feet", "Prosthetics", "Tools", "Adventuring Gear"],
    rule: doc => {
      const s = doc.system ?? {};
      if (s.prostheticFor) return "Prosthetics";
      if (s.equipType === "tool") return "Tools";
      return EQUIPMENT_SLOT_GROUPS[s.slot || s.allowedSlot] ?? "Adventuring Gear";
    },
  },
  "rnr-consumables": {
    folders: ["Potions", "Ammunition", "Supplies"],
    rule: doc => ({ potion: "Potions", ammunition: "Ammunition" })[doc.system?.consumableType] ?? "Supplies",
  },
  "rnr-abilities": {
    folders: ["Active Abilities", "Reactions", "Passive Abilities", "Mecha Abilities"],
    rule: doc => {
      if (/mecha/i.test(doc.system?.source?.book ?? "")) return "Mecha Abilities";
      return ({ reaction: "Reactions", passive: "Passive Abilities" })[doc.system?.abilityType] ?? "Active Abilities";
    },
  },
  "rnr-spells": {
    folders: ["Intellect", "Aptitude", "Sanity", "Ego", "Rhetoric", "Other Spells"],
    rule: doc => titleCase(doc.system?.attribute) || "Other Spells",
  },
  "rnr-extraskills": {
    folders: ["Combat", "Physical", "Communication", "Investigation", "Academic", "Science", "Arts", "Other"],
    rule: doc => titleCase(doc.system?.category) || "Other",
  },
  "rnr-classes": {
    folders: ["Hit Die d6", "Hit Die d8", "Hit Die d10", "Hit Die d12"],
    rule: doc => {
      const die = /d(\d+)/.exec(doc.system?.hitDie ?? "")?.[1];
      return die ? `Hit Die d${die}` : null;
    },
  },
  "rnr-races": {
    folders: ["Peoples", "Origin Traits"],
    rule: doc => (/ Origin$/.test(doc.name) ? "Origin Traits" : "Peoples"),
  },
};

/** Stable 16-character alphanumeric ID, so rebuilds keep the same folder IDs. */
export function folderId(pack, name) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = createHash("sha256").update(`rnr-folder:${pack}:${name}`).digest();
  return Array.from(bytes.subarray(0, 16), b => alphabet[b % alphabet.length]).join("");
}

/**
 * Folder documents for one pack and a lookup from document to folder ID.
 * Folders a rule never uses are dropped, so empty folders are not shipped.
 */
export function planFolders(pack, documentName, docs) {
  const config = PACK_FOLDERS[pack];
  if (!config) return { folders: [], folderFor: () => null };
  const assigned = new Map(docs.map(doc => [doc, config.rule(doc)]));
  const used = new Set(assigned.values());
  const names = [...config.folders, ...[...used].filter(name => name && !config.folders.includes(name))];
  const folders = names.filter(name => used.has(name)).map((name, index) => ({
    _id: folderId(pack, name),
    name,
    type: documentName,
    description: "",
    folder: null,
    sorting: "a",
    sort: (index + 1) * 100000,
    color: null,
    flags: {},
  }));
  return { folders, folderFor: doc => (assigned.get(doc) ? folderId(pack, assigned.get(doc)) : null) };
}
