import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BODY_EQUIPMENT_SLOTS,
  allowedBodySlots,
  bodyEquipmentAssignments,
  bodySlotCandidates,
} from "../scripts/modules/equipmentSlots.js";

test("wearable layout defines the requested twelve physical slots", () => {
  assert.deepEqual(BODY_EQUIPMENT_SLOTS.map(([key]) => key), [
    "head", "neck", "rightArm", "torso", "leftArm",
    "rightHand", "back", "leftHand",
    "rightLeg", "leftLeg", "rightFoot", "leftFoot",
  ]);
});

test("wearable CSS maps every slot into the requested 3-column body layout", () => {
  const css = readFileSync(new URL("../styles/RnR.css", import.meta.url), "utf8");
  for (const [slot] of BODY_EQUIPMENT_SLOTS) {
    assert.match(css, new RegExp(`\\.rnr-wearable-grid > \\.slot-${slot}\\s*\\{\\s*grid-area:`));
  }
  assert.match(css, /"right-arm torso left-arm"/);
  assert.match(css, /"right-hand back left-hand"/);
  assert.match(css, /"right-leg \. left-leg"/);
  assert.match(css, /"right-foot \. left-foot"/);
});

test("new and legacy slot values resolve to compatible physical positions", () => {
  assert.deepEqual(bodySlotCandidates("leftHand"), ["leftHand"]);
  assert.deepEqual(bodySlotCandidates("hands"), ["rightHand", "leftHand"]);
  assert.deepEqual(bodySlotCandidates("feet"), ["rightFoot", "leftFoot"]);
  assert.deepEqual(bodySlotCandidates("ring"), ["rightHand", "leftHand"]);
  assert.deepEqual(bodySlotCandidates("waist"), ["torso"]);
  assert.deepEqual(bodySlotCandidates("unknown"), []);
});

test("armor and equipment expose only compatible slots", () => {
  assert.deepEqual(allowedBodySlots({ type: "armor", system: { armorType: "shield" } }), ["rightHand", "leftHand"]);
  assert.deepEqual(allowedBodySlots({ type: "armor", system: { armorType: "heavy" } }), ["torso"]);
  assert.deepEqual(allowedBodySlots({ type: "equipment", system: { allowedSlot: "hands" } }), ["rightHand", "leftHand"]);
  assert.deepEqual(allowedBodySlots({ type: "equipment", system: { allowedSlot: "leftFoot" } }), ["leftFoot"]);
});

test("explicit slots take precedence while legacy hand/foot items fill free sides", () => {
  const items = [
    { id: "legacy-hand-a", system: { equipmentSlot: "hands" } },
    { id: "explicit-right", system: { equipmentSlot: "rightHand" } },
    { id: "legacy-feet", system: { equipmentSlot: "feet" } },
    { id: "legacy-ring", system: { equipmentSlot: "ring" } },
  ];
  const assignments = bodyEquipmentAssignments(items);
  assert.equal(assignments.get("explicit-right"), "rightHand");
  assert.equal(assignments.get("legacy-hand-a"), "leftHand");
  assert.equal(assignments.get("legacy-feet"), "rightFoot");
  assert.equal(assignments.has("legacy-ring"), false);

  const ringAssignments = bodyEquipmentAssignments([
    { id: "right", system: { equipmentSlot: "rightHand" } },
    { id: "ring", system: { equipmentSlot: "ring" } },
  ]);
  assert.equal(ringAssignments.get("ring"), "leftHand");
});
