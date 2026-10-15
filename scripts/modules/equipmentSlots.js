export const BODY_EQUIPMENT_SLOTS = [
  ["head", "Head", "◉"],
  ["neck", "Neck", "◇"],
  ["rightArm", "Right Arm", "➤"],
  ["torso", "Torso", "◆"],
  ["leftArm", "Left Arm", "◀"],
  ["rightHand", "Right Hand", "✦"],
  ["back", "Back", "▱"],
  ["leftHand", "Left Hand", "✦"],
  ["rightLeg", "Right Leg", "▼"],
  ["leftLeg", "Left Leg", "▼"],
  ["rightFoot", "Right Foot", "▾"],
  ["leftFoot", "Left Foot", "▾"],
];

export const BODY_SLOT_ORGANS = {
  leftArm: ["leftArm"],
  rightArm: ["rightArm"],
  leftHand: ["leftHand"],
  rightHand: ["rightHand"],
  leftLeg: ["leftLeg"],
  rightLeg: ["rightLeg"],
  leftFoot: ["leftFoot"],
  rightFoot: ["rightFoot"],
};

// Paper-doll layout for the Wearable Equipment panel. The character faces the
// viewer, so their right side is drawn on the left. Every slot appears once.
export const BODY_SLOT_COLUMNS = {
  right:  ["rightArm", "rightHand", "rightLeg", "rightFoot"],
  center: ["head", "neck", "torso", "back"],
  left:   ["leftArm", "leftHand", "leftLeg", "leftFoot"],
};

// Keep legacy generic body slots readable. Their contents are assigned to the
// first compatible, currently-free physical slot when the sheet is prepared.
export const LEGACY_BODY_SLOT_OPTIONS = [
  ["hands", "Either Hand (legacy)"],
  ["feet", "Either Foot (legacy)"],
  ["ring", "Either Hand (legacy ring)"],
  ["waist", "Torso (legacy waist)"],
  ["arms", "Either Arm"],
  ["legs", "Either Leg"],
];

const SLOT_KEYS = new Set(BODY_EQUIPMENT_SLOTS.map(([key]) => key));
const LEGACY_SLOT_ALIASES = {
  hands: ["rightHand", "leftHand"],
  feet: ["rightFoot", "leftFoot"],
  ring: ["rightHand", "leftHand"],
  waist: ["torso"],
  arms: ["rightArm", "leftArm"],
  legs: ["rightLeg", "leftLeg"],
};

export function bodySlotCandidates(value) {
  const slot = String(value ?? "").trim();
  if (SLOT_KEYS.has(slot)) return [slot];
  return LEGACY_SLOT_ALIASES[slot] ?? [];
}

export function isWearableItem(item) {
  if (!item) return false;
  if (item.type === "armor") return true;
  if (item.type !== "equipment") return false;
  const system = item.system ?? {};
  return system.equipType === "worn"
    || Boolean(String(system.slot ?? "").trim())
    || Boolean(system.equipmentSlot);
}

export function allowedBodySlots(item) {
  if (!item) return [];
  const system = item.system ?? {};
  if (item.type === "armor") {
    if (system.armorType === "shield") return ["rightHand", "leftHand"];
    // Accessory pieces (helm, gloves, boots…) name their own slot; body armour
    // is worn on the torso.
    const pieceSlots = bodySlotCandidates(system.allowedSlot);
    return pieceSlots.length ? pieceSlots : ["torso"];
  }
  if (item.type !== "equipment") return [];
  const requested = String(system.allowedSlot || system.slot || system.equipmentSlot || "").trim();
  const candidates = bodySlotCandidates(requested);
  return candidates.length ? candidates : BODY_EQUIPMENT_SLOTS.map(([key]) => key);
}

/** Assign worn entries to visible physical slots without modifying source data. */
export function bodyEquipmentAssignments(items) {
  const documents = Array.from(items ?? []);
  const occupied = new Set();
  const assignments = new Map();

  // Explicit new-format values take precedence over ambiguous legacy aliases.
  for (const item of documents) {
    const raw = String(item?.system?.equipmentSlot ?? item?.equipmentSlot ?? "").trim();
    if (!SLOT_KEYS.has(raw) || occupied.has(raw)) continue;
    occupied.add(raw);
    if (item?.id != null) assignments.set(item.id, raw);
  }

  // Assign generic legacy slots deterministically to a compatible free side.
  for (const item of documents) {
    const raw = String(item?.system?.equipmentSlot ?? item?.equipmentSlot ?? "").trim();
    if (SLOT_KEYS.has(raw)) continue;
    const slot = bodySlotCandidates(raw).find(candidate => !occupied.has(candidate));
    if (!slot) continue;
    occupied.add(slot);
    if (item?.id != null) assignments.set(item.id, slot);
  }
  return assignments;
}
