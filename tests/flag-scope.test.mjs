import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { getRnRFlag, setRnRFlag } from "../scripts/modules/flags.js";
import { handleMechaSummonMessage } from "../scripts/modules/mecha.js";

const manifest = JSON.parse(readFileSync(new URL("../system.json", import.meta.url), "utf8"));
const scriptFiles = [
  new URL("../scripts/RnR.js", import.meta.url),
  ...readdirSync(new URL("../scripts/modules/", import.meta.url)).map(name => new URL(`../scripts/modules/${name}`, import.meta.url)),
];

// Mirrors Foundry v13+/v14 ClientDocument#getFlag: only core, world, the active
// system id and active modules are valid scopes.
function strictFlagDocument(flags = {}) {
  return {
    flags,
    getFlag(scope) {
      if (!["core", "world", manifest.id].includes(scope)) throw new Error(`Flag scope "${scope}" is not valid or not currently active`);
      return undefined;
    },
  };
}

test("scripts never pass the legacy RnR scope to Foundry's getFlag/setFlag/unsetFlag", () => {
  for (const file of scriptFiles) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /\b(?:get|set|unset)Flag\??\.?\(\s*(?:"RnR"|'RnR'|MODULE_NAME)/, `${file.pathname} uses an invalid flag scope`);
  }
});

test("RnR flag helpers read and write the existing flags.RnR path", async () => {
  const doc = strictFlagDocument({ RnR: { mechaDeployment: { pilotActorId: "pilot" } } });
  assert.equal(getRnRFlag(doc, "mechaDeployment.pilotActorId"), "pilot");
  assert.equal(getRnRFlag(doc, "missing.path"), undefined);
  let update;
  doc.update = async data => { update = data; };
  await setRnRFlag(doc, "damageApplications", { card: { status: "applied" } });
  assert.deepEqual(update, { "flags.RnR.damageApplications": { card: { status: "applied" } } });
});

test("rendering an ordinary chat message does not throw on Foundry's flag scope check", () => {
  assert.doesNotThrow(() => handleMechaSummonMessage(strictFlagDocument()));
});

test("the Extra Skill Shop reads compendiums declared for the active system id", () => {
  const source = readFileSync(new URL("../scripts/RnR.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /metadata\.system\s*!==\s*"RnR"/);
  assert.ok(manifest.packs.every(pack => pack.system === manifest.id));
});
