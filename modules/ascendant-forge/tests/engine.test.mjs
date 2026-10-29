import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRegistry } from "../scripts/data/index.js";
import { ContentRegistry } from "../scripts/engine/registry.js";
import {
  canAllocateNode, canRefundNode, validateBuild, deriveBuild, activeSynergies, effectiveTechnique, emptyBuild
} from "../scripts/engine/build.js";
import {
  resolveAttack, resolveDamage, resolveSecondary, resolveShape, momentumGain, momentumTick, momentumSpend, TriggerGuard
} from "../scripts/engine/resolver.js";
import { evaluate } from "../scripts/engine/conditions.js";

const { registry, problems } = buildRegistry();

function ctx(over = {}) {
  return {
    level: 8, pb: 3,
    classes: { fighter: { levels: 8, subclass: "champion" } },
    abilities: { str: 16, dex: 14 },
    proficiencies: {
      weapons: new Set(["sim", "mar"]), armor: new Set(["lgt", "med", "hvy", "shl"]),
      masteryProperties: new Set(["vex", "topple", "graze", "sap"])
    },
    spellcaster: false, features: new Set(["second-wind"]),
    ...over
  };
}
const build = over => ({ ...emptyBuild(), ...over });

test("default content passes all validation", () => {
  assert.deepEqual(problems, []);
  assert.equal(registry.rejected.length, 0);
});

test("lint rejects unsafe or incomplete content", () => {
  const t = (en = "x") => ({ en, th: "ท" });
  const base = { name: t(), description: t() };
  const node = {
    ...base, id: "bad-node", category: "attribute", cost: 1, respec: "free", links: [], conflicts: [],
    position: { x: 0, y: 0 }, rules: {}, effects: []
  };
  assert.match(ContentRegistry.lint("node", { ...node, effects: [{ kind: "damageMultiplier", value: 2 }] }).join(), /unknown effect kind/);
  assert.match(ContentRegistry.lint("node", { ...node, effects: [{ kind: "riderDie", dice: "2d8" }] }).join(), /riderDie/);
  assert.match(ContentRegistry.lint("node", { ...node, effects: [{ kind: "attackBonus", value: 1 }] }).join(), /attribute nodes/);
  assert.match(ContentRegistry.lint("node", {
    ...node, category: "keystone", respec: "rest", effects: [{ kind: "stat", key: "ac", value: 1 }]
  }).join(), /drawback/);
  assert.match(ContentRegistry.lint("node", { ...node, name: { en: "x" } }).join(), /Thai/);
  assert.match(ContentRegistry.lint("node", { ...node, eligibility: { madeUpKey: 1 } }).join(), /unknown condition key/);

  const tech = {
    ...base, id: "bad-tech", kind: "action", action: "action", delivery: "weaponAttack", theme: "control",
    tags: ["weapon"], cost: {}, limits: { oncePer: "turn" }
  };
  assert.match(ContentRegistry.lint("technique", {
    ...tech, effects: [{ kind: "secondary", type: "condition", condition: "prone", save: "str" }]
  }).join(), /must trade/);
  assert.match(ContentRegistry.lint("technique", {
    ...tech, cost: { momentum: 1 }, effects: [{ kind: "resourceGain", on: "hit", value: 1, oncePer: "turn" }]
  }).join(), /may not generate Momentum/);
  assert.match(ContentRegistry.lint("technique", { ...tech, limits: {}, effects: [] }).join(), /free techniques/);
  assert.match(ContentRegistry.lint("technique", {
    ...tech, kind: "reaction", action: "reaction", trigger: "techniqueUsed", effects: []
  }).join(), /cannot trigger from other techniques/);

  const syn = { ...base, id: "bad-syn", priority: 1, oncePer: "turn", tactic: t(), cost: {}, requires: { nodes: ["iron-gate"] }, effects: [] };
  assert.match(ContentRegistry.lint("synergy", syn).join(), /two different subsystems/);

  const weave = {
    ...base, id: "bad-weave", category: "efficiency", appliesTo: { spell: true }, cost: {}, effects: [],
    metamagic: { policy: "compatible" }, preserves: t()
  };
  assert.match(ContentRegistry.lint("weave", weave).join(), /must cost/);
});

test("registry detects dependency cycles and unreachable nodes", () => {
  const t = { en: "x", th: "ท" };
  const mk = (id, extra) => ({
    id, name: t, description: t, category: "mechanic", cost: 1, respec: "free", links: [], conflicts: [],
    position: { x: 0, y: 0 }, rules: {}, effects: [], ...extra
  });
  const r = new ContentRegistry();
  r.register("node", mk("root-a", { rules: { root: true }, links: ["node-b"] }));
  r.register("node", mk("node-b", { prerequisites: { node: "node-c" }, links: ["node-c"] }));
  r.register("node", mk("node-c", { prerequisites: { node: "node-b" } }));
  r.register("node", mk("island", {}));
  const out = r.validateAll().join("\n");
  assert.match(out, /circular dependency/);
  assert.match(out, /island: unreachable/);
});

test("node allocation enforces adjacency, conflicts, groups and budget", () => {
  const c = ctx();
  assert.equal(canAllocateNode(registry, c, build({}), "iron-gate").ok, true);
  assert.equal(canAllocateNode(registry, c, build({}), "iron-hide").errors[0].code, "notAdjacent");
  const withBreaker = build({ nodes: ["iron-gate", "bulwark-stance", "breaker-discipline", "tide-root", "quickstep-lore"] });
  assert.ok(canAllocateNode(registry, c, withBreaker, "duelist-focus").errors.some(e => e.code === "exclusiveGroup"));
  const reckless = canAllocateNode(registry, ctx({ level: 12 }),
    build({ nodes: ["iron-gate", "bulwark-stance", "breaker-discipline", "unyielding-oath", "tide-root", "quickstep-lore"] }),
    "reckless-apex");
  assert.ok(reckless.errors.some(e => e.code === "conflicts"));
  const poor = canAllocateNode(registry, ctx({ level: 2 }), build({ nodes: ["iron-gate", "bulwark-stance"] }), "breaker-discipline");
  assert.ok(poor.errors.some(e => e.code === "notEnoughPoints"));
  const noArmor = ctx({ proficiencies: { weapons: new Set(), armor: new Set(), masteryProperties: new Set() } });
  assert.ok(canAllocateNode(registry, noArmor, build({ nodes: ["iron-gate"] }), "iron-hide").errors.some(e => e.code === "eligibility"));
});

test("respec keeps the graph connected and honours respec modes", () => {
  const c = ctx();
  const b = build({ nodes: ["iron-gate", "bulwark-stance", "breaker-discipline"] });
  assert.ok(canRefundNode(registry, c, b, "bulwark-stance").errors.some(e => e.code === "orphans"));
  assert.ok(canRefundNode(registry, c, b, "breaker-discipline").errors.some(e => e.code === "respecRest"));
  assert.equal(canRefundNode(registry, c, b, "breaker-discipline", { resting: true }).ok, true);
  assert.ok(canRefundNode(registry, c, b, "breaker-discipline", { resting: true, inCombat: true }).errors.some(e => e.code === "inCombat"));
});

test("loadout validation: compatibility, groups and Momentum loops", () => {
  const c = ctx();
  const nodes = ["iron-gate", "bulwark-stance"];
  const bad = validateBuild(registry, c, build({ nodes, loadout: [{ technique: "measured-thrust", modifiers: ["twin-mark"] }] }));
  assert.ok(bad.errors.some(e => e.code === "modifierIncompatible"));
  const group = validateBuild(registry, c, build({ nodes, loadout: [{ technique: "measured-thrust", modifiers: ["searing-edge", "frost-edge"] }] }));
  assert.ok(group.errors.some(e => e.code === "modifierGroup"));

  // Measured Thrust is free; Resonant Focus makes it cost 1 and gain 1 → loop, rejected.
  const loop = validateBuild(registry, c, build({ nodes, loadout: [{ technique: "measured-thrust", modifiers: ["resonant-focus"] }] }));
  assert.ok(loop.errors.some(e => e.code === "momentumLoop"), JSON.stringify(loop.errors));
  // Spellstrike Feint (1) + Resonant Focus (+1) = 2 cost vs 1 gain → allowed.
  const ok = validateBuild(registry, c, build({ nodes, loadout: [{ technique: "spellstrike-feint", modifiers: ["resonant-focus"] }] }));
  assert.ok(!ok.errors.some(e => e.code === "momentumLoop"), JSON.stringify(ok.errors));
  // …but Lean Form brings it back to 1 → loop again (two slots available at level 8).
  const lean = validateBuild(registry, c, build({ nodes, loadout: [{ technique: "spellstrike-feint", modifiers: ["resonant-focus", "lean-form"] }] }));
  assert.ok(lean.errors.some(e => e.code === "momentumLoop"), JSON.stringify(lean.errors));

  const tooMany = validateBuild(registry, ctx({ level: 1 }), build({ loadout: [
    { technique: "measured-thrust", modifiers: [] }, { technique: "pinning-volley", modifiers: [] },
    { technique: "measured-thrust", modifiers: [] }
  ] }));
  assert.ok(tooMany.errors.some(e => e.code === "techniqueSlots"));
  assert.ok(tooMany.errors.some(e => e.code === "duplicateTechnique"));
});

test("a costly technique can never be made free", () => {
  const eff = effectiveTechnique(registry, { technique: "spellstrike-feint", modifiers: ["lean-form"] });
  assert.equal(eff.momentum, 1);
});

test("evolution tiers follow class level and grant techniques", () => {
  const d = deriveBuild(registry, ctx(), build({ evolutions: { fighter: { path: "vanguard-bulwark" } } }));
  assert.equal(d.evolutions.fighter.tier, 2);
  assert.ok(d.known.has("interpose") && d.known.has("breathing-bastion"));
  const wrong = validateBuild(registry, ctx(), build({ evolutions: { fighter: { path: "ember-conduit" } } }));
  assert.ok(wrong.errors.some(e => e.code === "evolutionClass"));
});

test("passive stats are capped", () => {
  const d = deriveBuild(registry, ctx({ level: 20, pb: 6, classes: { paladin: { levels: 20 } } }), build({
    nodes: ["iron-gate", "iron-hide", "bulwark-stance", "unyielding-oath"], evolutions: { paladin: { path: "oathbound-aegis" } }
  }));
  assert.equal(d.passives.stats.ac, 2);
  assert.ok(d.passives.clipped.includes("stat.ac"));
});

test("attack bonuses cap at +2, penalties always apply", () => {
  const e = (kind, value, sourceType = "node") => ({ effect: { kind, value }, source: `${kind}-${value}-${sourceType}`, sourceType });
  const r = resolveAttack([e("attackBonus", 2, "technique"), e("attackBonus", 1), e("attackPenalty", 1)], {});
  assert.equal(r.total, 1);
  assert.equal(r.dropped.filter(d => d.reason === "cap").length, 1);
});

test("damage: one rider die, flat cap at proficiency bonus, no multipliers", () => {
  const entries = [
    { effect: { kind: "riderDie", dice: "1d4" }, source: "a", sourceType: "node" },
    { effect: { kind: "riderDie", dice: "1d6", damageType: "fire" }, source: "b", sourceType: "evolution" },
    { effect: { kind: "damageBonus", value: 2 }, source: "c", sourceType: "node" },
    { effect: { kind: "damageBonus", value: "pb" }, source: "d", sourceType: "technique" },
    { effect: { kind: "damageTypeSwap", from: ["fire"], to: "cold" }, source: "e", sourceType: "weave" }
  ];
  const r = resolveDamage(entries, { pb: 3 }, ["slashing"]);
  const riders = r.parts.filter(p => /d/.test(p.formula));
  assert.equal(riders.length, 1);
  assert.equal(riders[0].formula, "1d6");
  const flat = r.parts.filter(p => /^\d+$/.test(p.formula)).reduce((s, p) => s + Number(p.formula), 0);
  assert.equal(flat, 3);
  assert.equal(r.typeSwap, null, "swap only applies when the base roll has a matching type");
  const fire = resolveDamage(entries, { pb: 3 }, ["fire"]);
  assert.equal(fire.parts.find(p => p.formula === "1d6").type, "cold", "rider follows the type swap");
});

test("only one Forge secondary applies; candidates are offered for choice", () => {
  const r = resolveSecondary([
    { effect: { kind: "secondary", type: "condition", condition: "prone" }, source: "tech", sourceType: "technique" },
    { effect: { kind: "secondary", type: "push", feet: 10 }, source: "syn", sourceType: "synergy", priority: 60 }
  ], {});
  assert.equal(r.effect.source, "syn");
  assert.equal(r.candidates.length, 2);
});

test("shape changes take the largest single change within limits", () => {
  const r = resolveShape([
    { effect: { kind: "rangeDelta", feet: 5 }, source: "a" }, { effect: { kind: "rangeDelta", feet: 30 }, source: "b" },
    { effect: { kind: "targetDelta", value: 1 }, source: "c" }, { effect: { kind: "targetDelta", value: 1 }, source: "d" }
  ], {});
  assert.equal(r.range, 30);
  assert.equal(r.targets, 1);
});

test("Momentum: per-round cap, once-per source, depth and spending", () => {
  let s = momentumTick({}, { roundKey: "c1:1", turnKey: "c1:1:0" });
  let g = momentumGain(s, { source: "a", max: 5 }); s = g.state; assert.equal(g.gained, 1);
  g = momentumGain(s, { source: "a", max: 5 }); assert.equal(g.reason, "oncePer");
  g = momentumGain(s, { source: "b", max: 5 }); s = g.state; assert.equal(g.gained, 1);
  g = momentumGain(s, { source: "c", max: 5 }); assert.equal(g.reason, "roundCap");
  g = momentumGain(s, { source: "d", max: 5, depth: 2 }); assert.equal(g.reason, "depth");
  s = momentumTick(s, { roundKey: "c1:2", turnKey: "c1:2:0" });
  g = momentumGain(s, { source: "c", max: 2 }); assert.equal(g.reason, "full");
  assert.equal(momentumSpend(s, 3).ok, false);
  assert.equal(momentumSpend(s, 2).state.value, 0);
});

test("trigger guard refuses re-entry and deep chains", async () => {
  const guard = new TriggerGuard();
  const same = await guard.run("hit", async () => (await guard.run("hit", async () => 1)).refused);
  assert.equal(same.result, true);
  const deep = await guard.run("a", async () => (await guard.run("b", async () => (await guard.run("c", async () => 1)).refused)).result);
  assert.equal(deep.result, true);
});

test("synergies activate only when every requirement is present", () => {
  const nodes = ["iron-gate", "bulwark-stance", "breaker-discipline"];
  const full = build({ nodes, weaponPaths: ["heavy-breaker"], loadout: [{ technique: "sundering-blow", modifiers: [] }] });
  assert.deepEqual(activeSynergies(registry, deriveBuild(registry, ctx(), full)).map(s => s.id), ["anvil-and-hammer"]);
  const missing = build({ nodes, loadout: [{ technique: "sundering-blow", modifiers: [] }] });
  assert.equal(activeSynergies(registry, deriveBuild(registry, ctx(), missing)).length, 0);
});

test("use-time conditions read weapon, spell and technique context", () => {
  assert.equal(evaluate({ weaponProperty: "fin", shield: false }, { weapon: { properties: new Set(["fin"]) }, state: { shield: false } }).ok, true);
  assert.equal(evaluate({ usingTechnique: "riposte-line" }, { use: { technique: "riposte-line" } }).ok, true);
  assert.equal(evaluate({ spellLevel: { min: 1 } }, { spell: { level: 0 } }).ok, false);
});

test("content coverage: every class has at least two evolution paths", () => {
  const classes = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];
  for ( const cls of classes ) {
    assert.ok(registry.all("evolution").filter(e => e.class === cls).length >= 2, `${cls} needs 2+ paths`);
  }
});

test("content coverage: every grant-only technique is granted somewhere", () => {
  const granted = new Set();
  const scan = effects => (effects ?? []).filter(e => e.kind === "grantTechnique").forEach(e => granted.add(e.id));
  registry.all("node").forEach(n => scan(n.effects));
  registry.all("evolution").forEach(e => e.tiers.forEach(t => scan(t.effects)));
  registry.all("weaponPath").forEach(w => w.ranks.forEach(r => scan(r.effects)));
  for ( const t of registry.all("technique").filter(t => t.grantOnly) ) assert.ok(granted.has(t.id), `${t.id} is never granted`);
});

test("content coverage: every modifier fits at least one technique", async () => {
  const { modifierCompatible } = await import("../scripts/engine/build.js");
  for ( const m of registry.all("modifier") ) {
    assert.ok(registry.all("technique").some(t => modifierCompatible(m, t).ok), `${m.id} fits nothing`);
  }
});

test("constellation layout: nodes stay inside the canvas and don't overlap", () => {
  const nodes = registry.all("node");
  for ( const n of nodes ) {
    assert.ok(n.position.x >= 0 && n.position.x <= 1100 && n.position.y >= 0 && n.position.y <= 720, `${n.id} off canvas`);
  }
  for ( let i = 0; i < nodes.length; i++ ) for ( let j = i + 1; j < nodes.length; j++ ) {
    const a = nodes[i].position, b = nodes[j].position;
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 55, `${nodes[i].id} overlaps ${nodes[j].id}`);
  }
});

test("each region offers its own keystone and specialization route", () => {
  const keystones = registry.all("node").filter(n => n.category === "keystone");
  assert.ok(keystones.length >= 6);
  for ( const k of keystones ) for ( const c of k.conflicts ) assert.equal(registry.get("node", c)?.category, "keystone");
});
