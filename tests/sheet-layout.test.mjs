import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { bodyFigureSvg, BODY_FIGURE_REGIONS, BODY_FIGURE_ORGAN_MARKS } from "../scripts/modules/bodyFigure.js";
import { BODY_EQUIPMENT_SLOTS } from "../scripts/modules/equipmentSlots.js";

const script = readFileSync(new URL("../scripts/RnR.js", import.meta.url), "utf8");
const actorSheet = readFileSync(new URL("../templates/actor-sheet.html", import.meta.url), "utf8");
const npcSheet = readFileSync(new URL("../templates/npc-sheet.html", import.meta.url), "utf8");

test("the chat-card render hook can resolve actors (Defend / Dodge / Take the Hit)", () => {
  // The hook called resolveActor while it only existed inside handleDefenseChoice;
  // the ReferenceError left every button on a defense card without a listener.
  assert.match(script, /^function resolveActor\(id\)/m);
  assert.doesNotMatch(script, /const resolveActor = /);
});

test("every wear slot and every disabled organ has a body-figure region", () => {
  for (const [slot] of BODY_EQUIPMENT_SLOTS) assert.ok(BODY_FIGURE_REGIONS.includes(slot), slot);
  const organs = [...script.matchAll(/^\s*\["(\w+)",\s+"[^"]+",\s+"(?:Limbs|Senses|Internal)"/gm)].map(m => m[1]);
  assert.equal(organs.length, 20);
  for (const organ of organs) {
    assert.ok(BODY_FIGURE_REGIONS.includes(organ) || BODY_FIGURE_ORGAN_MARKS.includes(organ), organ);
  }
});

test("the organ figure marks disabled and prosthetic parts and makes organs clickable", () => {
  const svg = bodyFigureSvg("organs", { leftArm: "disabled", heart: "prosthetic" });
  assert.match(svg, /data-region="leftArm" data-organ="leftArm"/);
  assert.match(svg, /class="rnr-fig-region is-disabled" data-region="leftArm"/);
  assert.match(svg, /class="rnr-fig-region is-prosthetic" data-region="heart" data-organ="heart"/);
  assert.doesNotMatch(bodyFigureSvg("equipment", {}), /data-organ=/);
});

test("character and NPC sheets no longer show the campaign theme label", () => {
  assert.doesNotMatch(actorSheet, /settingProfileLabel/);
  assert.doesNotMatch(npcSheet, /settingProfileLabel/);
});

test("the NPC sheet has no custom attributes panel and shares the character topbar", () => {
  assert.doesNotMatch(npcSheet, /customAttributes|custom-attr-add/);
  assert.match(npcSheet, /class="rnr-topbar rnr-npc-topbar"/);
  assert.match(npcSheet, /class="rnr-abilities rnr-npc-abilities"/);
  assert.match(npcSheet, /data-action="close"/);
});

test("disabled organs have their own full-width Body Condition card", () => {
  assert.match(actorSheet, /rnr-bio-card rnr-bio-wide-card rnr-body-condition/);
  assert.match(actorSheet, /{{{organFigure}}}/);
});
