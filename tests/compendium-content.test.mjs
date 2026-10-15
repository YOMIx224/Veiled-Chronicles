import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

import { allowedBodySlots } from "../scripts/modules/equipmentSlots.js";

const sourceDir = pack => new URL(`../packs/_source/${pack}/`, import.meta.url);
const docs = pack => readdirSync(sourceDir(pack)).filter(f => f.endsWith(".json"))
  .map(f => JSON.parse(readFileSync(new URL(f, sourceDir(pack)), "utf8")));
const script = readFileSync(new URL("../scripts/RnR.js", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../system.json", import.meta.url), "utf8"));
const PLACEHOLDER = /GM (determines|agrees)|resolve (the|its) (described|narrative)|provides its described utility|choose campaign-appropriate|useful in exploration, travel, or problem-solving/i;

test("no compendium entry is left with placeholder rules text", () => {
  for (const pack of ["rnr-extraskills", "rnr-abilities", "rnr-spells", "rnr-consumables", "rnr-classes", "rnr-equipment", "rnr-weapons", "rnr-armors"]) {
    for (const doc of docs(pack)) {
      const text = `${doc.system.effect ?? ""} ${doc.system.description?.value ?? ""} ${doc.system.features ?? ""}`;
      assert.doesNotMatch(text, PLACEHOLDER, `${pack}: ${doc.name}`);
    }
  }
});

test("every Extra Skill has an automated effect", () => {
  for (const doc of docs("rnr-extraskills")) {
    const s = doc.system;
    const automated = Number(s.bonus) || s.attackRoll || s.damageFormula || s.healingFormula || Number(s.speedBonus) || Number(s.healthBonus);
    assert.ok(automated, doc.name);
  }
});

test("every Class grants two valid class skills", () => {
  const skillKeys = new Set([...script.matchAll(/\["(\w+)",\s*"[^"]+",\s*"(?:strength|dexterity|toughness|intellect|aptitude|sanity|charm|rhetoric|ego)"\]/g)].map(m => m[1]));
  const names = new Set();
  for (const doc of docs("rnr-classes")) {
    assert.equal(doc.system.skills.length, 2, doc.name);
    for (const key of doc.system.skills) assert.ok(skillKeys.has(key), `${doc.name}: ${key}`);
    assert.ok(!names.has(doc.name), `duplicate class ${doc.name}`);
    names.add(doc.name);
  }
});

test("melee weapons never require ammunition and two-handed weapons say so", () => {
  for (const doc of docs("rnr-weapons")) {
    if (doc.system.weaponType === "melee") assert.ok(!doc.system.caliber, `${doc.name} is melee but has a caliber`);
  }
});

test("accessory armour is worn in its own slot, body armour on the torso", () => {
  const byName = Object.fromEntries(docs("rnr-armors").map(doc => [doc.name, doc]));
  assert.deepEqual(allowedBodySlots(byName["Helm"]), ["head"]);
  assert.deepEqual(allowedBodySlots(byName["Gloves"]), ["rightHand", "leftHand"]);
  assert.deepEqual(allowedBodySlots(byName["Knee Guards"]), ["rightLeg", "leftLeg"]);
  assert.deepEqual(allowedBodySlots(byName["Plate Armor"]), ["torso"]);
});

test("skill rolls include worn equipment through the shared helper", () => {
  assert.match(script, /^function itemSkillBonus\(actor, key, attr\)/m);
  assert.match(script, /const extraBonus = itemSkillBonus\(actor, key, attr\);/);
});

test("the Session 0 pack is registered and its journals have valid ids", () => {
  assert.ok(manifest.packs.some(pack => pack.name === "rnr-session-zero" && pack.type === "JournalEntry"));
  const journals = docs("rnr-session-zero");
  assert.equal(journals.length, 3);
  for (const journal of journals) {
    assert.match(journal._id, /^[A-Za-z0-9]{16}$/);
    for (const page of journal.pages) assert.match(page._id, /^[A-Za-z0-9]{16}$/, `${journal.name}: ${page.name}`);
  }
  const handout = journals.find(j => j.flags?.RnR?.sessionZero === "handout");
  assert.equal(handout.ownership.default, 2, "players can read the handout");
  for (const gmOnly of journals.filter(j => j !== handout)) assert.equal(gmOnly.ownership.default, 0, gmOnly.name);
});
