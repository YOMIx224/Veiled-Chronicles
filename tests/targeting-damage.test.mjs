import test from "node:test";
import assert from "node:assert/strict";

import { armorDamageReduction, applyDamage, applyDamageToTargets, collectDamageDiceFragments } from "../scripts/modules/damage.js";
import { hasLineOfSight } from "../scripts/modules/targeting.js";
import { activateChatCardListeners } from "../scripts/modules/chatcard.js";

function assertFoundryFlagScope(scope) {
  if (!["core", "world", "rnr"].includes(scope)) throw new Error(`Flag scope "${scope}" is not valid or not currently active`);
}

function setFoundryGlobals({ collision = () => false, isGM = false } = {}) {
  globalThis.foundry = {
    utils: {
      getProperty(object, path) {
        return path.split(".").reduce((value, key) => value?.[key], object);
      },
      randomID() { return `claim-${Date.now()}-${Math.random()}`; },
    },
  };
  globalThis.game = { user: { id: "test-user", isGM, targets: new Set() }, actors: { get: () => null } };
  globalThis.ui = { notifications: { warn() {}, info() {}, error() {} } };
  globalThis.Hooks = { callAll() {} };
  globalThis.Ray = class Ray {
    constructor(A, B) { this.A = A; this.B = B; }
  };
  globalThis.canvas = { walls: { checkCollision: collision } };
}

const tokenAt = (x, y) => ({ x, y, w: 100, h: 100 });

test("LOS reports clear/blocked collision results", () => {
  setFoundryGlobals({ collision: () => false });
  assert.equal(hasLineOfSight(tokenAt(0, 0), tokenAt(200, 0)), true);

  globalThis.canvas.walls.checkCollision = () => true;
  assert.equal(hasLineOfSight(tokenAt(0, 0), tokenAt(200, 0)), false);
});

test("LOS fails closed when the collision API is missing or throws", () => {
  setFoundryGlobals();
  delete globalThis.canvas.walls.checkCollision;
  assert.equal(hasLineOfSight(tokenAt(0, 0), tokenAt(200, 0)), false);

  setFoundryGlobals({ collision: () => { throw new Error("mock API failure"); } });
  assert.equal(hasLineOfSight(tokenAt(0, 0), tokenAt(200, 0)), false);
  assert.equal(hasLineOfSight(null, tokenAt(200, 0)), false);
});

test("DR adds prepared Actor defense and equipped armor without double-counting effects", () => {
  setFoundryGlobals();
  const actor = {
    system: { defenses: { armorDamageReduction: 7 } }, // base 3 + prepared Active Effects 4
    items: { contents: [
      { type: "armor", system: { equipmentSlot: "body", armorValue: 2 } },
      { type: "armor", system: { equipmentSlot: "", armorValue: 9 } },
      { type: "weapon", system: { equipmentSlot: "hand", armorValue: 50 } },
    ] },
    // These effects are already reflected in the prepared system value above.
    effects: { contents: [{ disabled: false, changes: [{ key: "system.defenses.armorDamageReduction", value: "4" }] }] },
  };

  assert.equal(armorDamageReduction(actor), 9);
});

test("damage dice use authored source plus each effect once, not prepared Actor value", () => {
  setFoundryGlobals();
  const actor = {
    _source: { system: { mods: { damage: "1d6" } } },
    // Foundry has prepared this field with the last SET Active Effect.
    system: { mods: { damage: "1d4" } },
    effects: { contents: [
      { disabled: false, isSuppressed: false, changes: [{ key: "system.mods.damage", value: "1d4" }] },
      { disabled: false, isSuppressed: false, changes: [{ key: "system.mods.damage", value: "1d8" }] },
      { disabled: true, changes: [{ key: "system.mods.damage", value: "1d10" }] },
    ] },
  };

  assert.deepEqual(collectDamageDiceFragments(actor), ["1d6", "1d4", "1d8"]);
});

test("damage applies Actor DR + equipped armor before resistance", async () => {
  setFoundryGlobals();
  const actor = {
    id: "target",
    name: "Target",
    isOwner: true,
    system: {
      defenses: { armorDamageReduction: 4, resistance: "fire", immunity: "", vulnerability: "" },
      vitals: { health: { value: 20, max: 25 } },
    },
    items: { contents: [{ type: "armor", system: { equipmentSlot: "body", armorValue: 2 } }] },
    effects: { contents: [] },
    getActiveTokens: () => [],
    async update(data) { this.system.vitals.health.value = data["system.vitals.health.value"]; },
  };

  const result = await applyDamage(actor, 9, "fire");
  assert.equal(result.armorReduction, 6);
  assert.equal(result.afterArmor, 3);
  assert.equal(result.final, 1);
  assert.equal(actor.system.vitals.health.value, 19);
});

test("damage application does not update an Actor the user does not own", async () => {
  setFoundryGlobals({ isGM: false });
  let updates = 0;
  const actor = {
    name: "Protected Target",
    isOwner: false,
    system: { defenses: {}, vitals: { health: { value: 10, max: 10 } } },
    items: { contents: [] },
    effects: { contents: [] },
    async update() { updates += 1; },
  };

  assert.equal(await applyDamage(actor, 5, "physical"), null);
  assert.equal(updates, 0);
});

test("a target owner can apply a Chat Card once without editing the ChatMessage", async () => {
  setFoundryGlobals();
  const actor = {
    id: "target",
    uuid: "Actor.target",
    name: "Owned Target",
    isOwner: true,
    flags: {},
    system: {
      defenses: { armorDamageReduction: 0, resistance: "", immunity: "", vulnerability: "" },
      vitals: { health: { value: 20, max: 20 } },
    },
    items: { contents: [] },
    effects: { contents: [] },
    getActiveTokens: () => [],
    // Foundry v13+ only accepts the system id ("rnr") as a flag scope; RnR
    // data lives under flags.RnR, so the system must not call getFlag/setFlag.
    getFlag(scope, key) { assertFoundryFlagScope(scope); return this.flags?.[scope]?.[key]; },
    async setFlag(scope, key, value) { assertFoundryFlagScope(scope); return this.update({ [`flags.${scope}.${key}`]: value }); },
    async update(data) {
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        const last = parts.pop();
        const target = parts.reduce((obj, part) => (obj[part] ??= {}), this);
        target[last] = structuredClone(value);
      }
    },
  };
  globalThis.game.actors = { get: id => id === actor.id ? actor : null };
  globalThis.game.user.targets = new Set();

  const first = await applyDamageToTargets(5, "physical", { sourceMessageId: "chat-card-1", action: "apply-damage", targetActorIds: [actor.id] });
  assert.equal(first.length, 1);
  assert.equal(actor.system.vitals.health.value, 15);
  assert.equal(actor.flags.RnR.damageApplications["chat-card-1"].status, "applied");

  const repeated = await applyDamageToTargets(5, "physical", { sourceMessageId: "chat-card-1", action: "apply-damage", targetActorIds: [actor.id] });
  assert.equal(repeated.length, 0);
  assert.equal(actor.system.vitals.health.value, 15);
});

test("a non-owner cannot claim or apply a Chat Card to another Actor", async () => {
  setFoundryGlobals();
  let updates = 0;
  const actor = {
    id: "protected",
    uuid: "Actor.protected",
    name: "Protected Target",
    isOwner: false,
    system: { defenses: {}, vitals: { health: { value: 10, max: 10 } } },
    items: { contents: [] },
    effects: { contents: [] },
    async setFlag() { throw new Error("An unauthorized user must not write Actor flags"); },
    async update() { updates += 1; },
  };
  globalThis.game.actors = { get: id => id === actor.id ? actor : null };
  globalThis.game.user.targets = new Set();

  const results = await applyDamageToTargets(5, "physical", { sourceMessageId: "chat-card-2", targetActorIds: [actor.id] });
  assert.equal(results.length, 0);
  assert.equal(updates, 0);
});

test("an unavailable explicit target never falls back to local token selection", async () => {
  setFoundryGlobals();
  let updates = 0;
  const selected = {
    id: "selected",
    uuid: "Actor.selected",
    name: "Different Selected Actor",
    isOwner: true,
    system: { defenses: {}, vitals: { health: { value: 10, max: 10 } } },
    items: { contents: [] },
    effects: { contents: [] },
    async update() { updates += 1; },
  };
  globalThis.game.user.targets = new Set([{ actor: selected }]);

  const results = await applyDamageToTargets(5, "physical", { targetActorIds: ["missing-target"] });
  assert.equal(results.length, 0);
  assert.equal(updates, 0);
});

test("Chat Card actor actions reject non-owners but allow GM override", async () => {
  const actor = {
    id: "restricted-actor",
    name: "Restricted Actor",
    isOwner: false,
    items: { get: () => ({ id: "weapon" }) },
  };
  const item = { id: "weapon" };
  const makeButton = () => ({
    dataset: { actorId: actor.id, itemId: item.id },
    listeners: {},
    addEventListener(event, callback) { this.listeners[event] = callback; },
  });
  const makeRoot = button => ({
    querySelectorAll(selector) {
      return selector === "[data-action='roll-item-attack']" ? [button] : [];
    },
  });
  globalThis.game.actors = { get: () => actor };
  let attackCalls = 0;
  const message = {};
  const restrictedButton = makeButton();
  activateChatCardListeners(message, makeRoot(restrictedButton), { onAttack: async () => { attackCalls += 1; } });
  await restrictedButton.listeners.click({ shiftKey: false });
  assert.equal(attackCalls, 0);

  globalThis.game.user.isGM = true;
  const gmButton = makeButton();
  activateChatCardListeners(message, makeRoot(gmButton), { onAttack: async () => { attackCalls += 1; } });
  await gmButton.listeners.click({ shiftKey: false });
  assert.equal(attackCalls, 1);
});
