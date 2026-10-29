/**
 * The Ascendant Forge window: constellation, evolution, weapon paths, weaves,
 * technique loadout, synergies and build validation for one actor.
 */
import { MODULE_ID } from "../constants.js";
import { activeSynergies, canAllocateNode, canRefundNode, effectiveTechnique, modifierCompatible, normalizeBuild, evolutionTier } from "../engine/build.js";
import { evaluate } from "../engine/conditions.js";
import { actorContext, combatKeys } from "../foundry/context.js";
import { derive, getBuild, getRegistry, getRuntime, momentumMax, saveBuild, setRuntime, usesLeft, validate } from "../foundry/store.js";
import { armWeave, useTechnique } from "../foundry/actions.js";
import { createTechniqueMacro } from "../foundry/compat.js";
import { describeFailures, errorText, loc, notify } from "../foundry/i18n.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const TABS = ["constellation", "evolution", "weapons", "magic", "techniques", "synergies", "validation"];
const RADIUS = { attribute: 11, mechanic: 14, specialization: 17, keystone: 23, synergy: 16 };

export class ForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static #instances = new Map();

  static open(actor) {
    // Opening the window starts a build record, which is what roll hooks use to recognise Forge characters.
    if ( !actor.getFlag(MODULE_ID, "build") && actor.isOwner ) actor.setFlag(MODULE_ID, "build", getBuild(actor));
    let app = ForgeApp.#instances.get(actor.uuid);
    if ( !app ) {
      app = new ForgeApp({ actor });
      ForgeApp.#instances.set(actor.uuid, app);
    }
    app.render({ force: true });
    return app;
  }

  /** Re-render open windows for an actor (after flag updates). */
  static refresh(actor) {
    ForgeApp.#instances.get(actor.uuid)?.render();
  }

  constructor(options) {
    super(options);
    this.actor = options.actor;
    this.tab = "constellation";
  }

  static DEFAULT_OPTIONS = {
    classes: ["ascendant-forge"],
    tag: "div",
    window: { icon: "fa-solid fa-star", resizable: true },
    position: { width: 1000, height: 760 },
    actions: {
      tab: ForgeApp.#onTab,
      node: ForgeApp.#onNode,
      evolution: ForgeApp.#onEvolution,
      weaponPath: ForgeApp.#onWeaponPath,
      weave: ForgeApp.#onWeave,
      arm: ForgeApp.#onArm,
      equip: ForgeApp.#onEquip,
      unequip: ForgeApp.#onUnequip,
      removeModifier: ForgeApp.#onRemoveModifier,
      use: ForgeApp.#onUse,
      macro: ForgeApp.#onMacro,
      momentum: ForgeApp.#onMomentum
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/forge.hbs`, scrollable: [".af-panel"] }
  };

  get title() {
    return `${game.i18n.localize("AF.Title")}: ${this.actor.name}`;
  }

  /* ------------------------------------------------------------------ */

  async _prepareContext() {
    const registry = getRegistry();
    const actor = this.actor;
    const ctx = actorContext(actor);
    const validation = validate(actor);
    const d = validation.derived;
    const runtime = getRuntime(actor);
    const build = d.state;
    const owned = new Set(build.nodes);
    const inCombat = combatKeys(actor).inCombat;

    const nodes = registry.all("node").map(n => {
      const isOwned = owned.has(n.id);
      const check = isOwned
        ? canRefundNode(registry, ctx, build, n.id, { resting: runtime.respecWindow, inCombat, gm: game.user.isGM })
        : canAllocateNode(registry, ctx, build, n.id);
      return {
        id: n.id, x: n.position.x, y: n.position.y, r: RADIUS[n.category], category: n.category,
        name: loc(n.name), description: loc(n.description), cost: n.cost,
        state: isOwned ? "owned" : check.ok ? "available" : "locked",
        diamond: n.category === "synergy",
        points: `0,${-RADIUS.synergy} ${RADIUS.synergy},0 0,${RADIUS.synergy} ${-RADIUS.synergy},0`,
        tooltip: [
          `${loc(n.name)} — ${game.i18n.localize(`AF.Category.${n.category}`)} (${n.cost})`,
          loc(n.description),
          `${game.i18n.localize("AF.Respec.Label")}: ${game.i18n.localize(`AF.Respec.${n.respec}`)}`,
          ...(n.conflicts.length ? [`${game.i18n.localize("AF.Conflicts")}: ${n.conflicts.map(c => loc(registry.get("node", c)?.name)).join(", ")}`] : []),
          ...check.errors.map(errorText)
        ].join("\n")
      };
    });
    const pos = Object.fromEntries(nodes.map(n => [n.id, n]));
    const edges = [];
    for ( const n of registry.all("node") ) for ( const l of n.links ) {
      if ( !pos[l] ) continue;
      edges.push({ x1: pos[n.id].x, y1: pos[n.id].y, x2: pos[l].x, y2: pos[l].y, lit: owned.has(n.id) && owned.has(l) });
    }

    // Evolutions per class the actor has
    const evolutions = Object.entries(ctx.classes).map(([cls, info]) => {
      const chosen = build.evolutions[cls]?.path ?? null;
      const paths = registry.all("evolution").filter(e => e.class === cls).map(e => ({
        id: e.id, name: loc(e.name), description: loc(e.description), theme: game.i18n.localize(`AF.Theme.${e.theme}`),
        chosen: chosen === e.id,
        locked: !evaluate(e.learn, d.ctx).ok,
        tier: chosen === e.id ? evolutionTier(e, info.levels) : 0,
        tiers: e.tiers.map(t => ({ ...t, name: loc(t.name), description: loc(t.description), reached: info.levels >= t.classLevel })),
        interactions: e.interactions.features.map(f => ({ feature: f.feature, rule: loc(f.rule) })),
        subclasses: loc(e.interactions.subclasses),
        balance: loc(e.balance.note)
      }));
      return { cls, label: actor.classes[cls]?.name ?? cls, levels: info.levels, paths, canChange: !chosen || runtime.respecWindow || game.user.isGM };
    }).filter(c => c.paths.length);

    const weaponPaths = registry.all("weaponPath").map(w => ({
      id: w.id, name: loc(w.name), description: loc(w.description),
      owned: build.weaponPaths.includes(w.id),
      locked: !evaluate(w.learn, d.ctx).ok, why: describeFailures(evaluate(w.learn, d.ctx).failed),
      ranks: w.ranks.map(r => ({ rank: r.rank, level: r.level, reached: ctx.level >= r.level, effects: r.effects.map(e => effectLabel(e)).join("; ") }))
    }));

    const weaves = registry.all("weave").map(w => ({
      id: w.id, name: loc(w.name), description: loc(w.description), category: game.i18n.localize(`AF.WeaveCat.${w.category}`),
      owned: build.weaves.includes(w.id), armed: runtime.armedWeave === w.id,
      locked: !evaluate(w.learn, d.ctx).ok,
      cost: costLabel(w.cost, `weave:${w.id}`, runtime),
      preserves: loc(w.preserves),
      metamagic: w.metamagic.policy === "exclusive" ? game.i18n.format("AF.Weave.Exclusive", { options: w.metamagic.conflicts.join(", ") }) : ""
    }));

    const loadout = build.loadout.map((entry, index) => {
      const eff = effectiveTechnique(registry, entry);
      if ( !eff ) return { index, missing: entry.technique };
      const t = eff.technique;
      const usedSlots = eff.modifiers.reduce((s, m) => s + m.slotCost, 0);
      const compatible = registry.all("modifier")
        .filter(m => !entry.modifiers.includes(m.id) && modifierCompatible(m, t).ok)
        .map(m => ({ id: m.id, name: `${loc(m.name)} (${m.slotCost})` }));
      return {
        index, id: t.id, name: loc(t.name), description: loc(t.description),
        action: game.i18n.localize(`AF.Action.${t.action}`), theme: game.i18n.localize(`AF.Theme.${t.theme}`),
        trigger: eff.trigger ? game.i18n.localize(`AF.Trigger.${eff.trigger}`) : null,
        momentum: eff.momentum, uses: t.cost.uses ? `${usesLeft(`technique:${t.id}`, t.cost.uses, runtime)}/${t.cost.uses.max}` : null,
        modifiers: eff.modifiers.map(m => ({ id: m.id, name: loc(m.name), description: loc(m.description), interaction: loc(m.interaction) })),
        compatible, slots: `${usedSlots}/${d.budgets.modifierSlots}`, canAdd: usedSlots < d.budgets.modifierSlots && compatible.length,
        mastery: t.masteryInteraction ? loc(t.masteryInteraction) : null,
        errors: validation.errors.filter(e => e.data?.index === index).map(errorText)
      };
    });
    const equipped = new Set(build.loadout.map(e => e.technique));
    const known = [...d.known].map(id => registry.get("technique", id)).filter(Boolean).map(t => ({
      id: t.id, name: loc(t.name), description: loc(t.description), equipped: equipped.has(t.id),
      action: game.i18n.localize(`AF.Action.${t.action}`), cost: costLabel(t.cost, `technique:${t.id}`, runtime)
    }));

    const active = new Set(activeSynergies(registry, d).map(s => s.id));
    const synergies = registry.all("synergy").map(s => ({
      id: s.id, name: loc(s.name), description: loc(s.description), tactic: loc(s.tactic), active: active.has(s.id),
      priority: s.priority, oncePer: game.i18n.localize(`AF.Once.${s.oncePer}`),
      cost: s.cost?.momentum ? `${s.cost.momentum} ${game.i18n.localize("AF.Momentum")}` : game.i18n.localize("AF.Free"),
      requires: requirementList(registry, s.requires, d)
    }));

    return {
      actor, tab: this.tab, isGM: game.user.isGM,
      tabs: TABS.map(id => ({ id, label: game.i18n.localize(`AF.Tab.${id}`), active: id === this.tab,
        badge: id === "validation" && validation.errors.length ? validation.errors.length : null })),
      points: { spent: d.pointsSpent, max: d.budgets.points },
      budgets: d.budgets,
      keystones: build.nodes.filter(id => registry.get("node", id)?.category === "keystone").length,
      momentum: { value: runtime.momentum.value, max: momentumMax(actor) },
      respecWindow: runtime.respecWindow, inCombat,
      nodes, edges, evolutions, weaponPaths, weaves, spellcaster: ctx.spellcaster,
      loadout, known, slotsUsed: build.loadout.length,
      synergies,
      errors: validation.errors.map(errorText),
      warnings: validation.warnings.map(errorText),
      passives: Object.entries(d.passives.stats).map(([k, v]) => ({ label: game.i18n.localize(`AF.Stat.${k}`), value: v }))
    };
  }

  /* ------------------------------------------------------------------ */

  _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelectorAll("select[data-add-modifier]").forEach(sel => sel.addEventListener("change", async event => {
      const index = Number(event.currentTarget.dataset.addModifier);
      const id = event.currentTarget.value;
      if ( !id ) return;
      await this.#mutate(b => { b.loadout[index].modifiers.push(id); });
    }));
  }

  /** Apply a change to the build; refuse if the result is invalid. */
  async #mutate(fn, { allowInCombat = false } = {}) {
    if ( !allowInCombat && combatKeys(this.actor).inCombat && !game.user.isGM && !game.settings.get(MODULE_ID, "loadoutInCombat") ) {
      notify("warn", "AF.Error.inCombat");
      return false;
    }
    const build = normalizeBuild(structuredClone(getBuild(this.actor)));
    fn(build);
    const result = await saveBuild(this.actor, build);
    if ( !result.ok ) notify("error", "AF.Error.Refused", { reason: result.errors.slice(0, 3).map(errorText).join("; ") });
    this.render();
    return result.ok;
  }

  static #onTab(event, target) {
    this.tab = target.dataset.tab;
    this.render();
  }

  static async #onNode(event, target) {
    const id = target.dataset.node;
    const registry = getRegistry();
    const build = getBuild(this.actor);
    const ctx = actorContext(this.actor);
    if ( build.nodes.includes(id) ) {
      const rt = getRuntime(this.actor);
      const check = canRefundNode(registry, ctx, build, id, { resting: rt.respecWindow, inCombat: combatKeys(this.actor).inCombat, gm: game.user.isGM });
      if ( !check.ok ) return notify("warn", "AF.Error.Refused", { reason: check.errors.map(errorText).join("; ") });
      return this.#mutate(b => { b.nodes = b.nodes.filter(n => n !== id); }, { allowInCombat: game.user.isGM });
    }
    const check = canAllocateNode(registry, ctx, build, id);
    if ( !check.ok ) return notify("warn", "AF.Error.Refused", { reason: check.errors.map(errorText).join("; ") });
    return this.#mutate(b => { b.nodes.push(id); });
  }

  static async #onEvolution(event, target) {
    const { cls, path } = target.dataset;
    const current = getBuild(this.actor).evolutions[cls]?.path;
    if ( current && current !== path && !getRuntime(this.actor).respecWindow && !game.user.isGM ) return notify("warn", "AF.Error.respecRest");
    return this.#mutate(b => {
      if ( current === path ) delete b.evolutions[cls];
      else b.evolutions[cls] = { path };
    });
  }

  static async #onWeaponPath(event, target) {
    const id = target.dataset.id;
    const owned = getBuild(this.actor).weaponPaths.includes(id);
    if ( owned && !getRuntime(this.actor).respecWindow && !game.user.isGM ) return notify("warn", "AF.Error.respecRest");
    return this.#mutate(b => { b.weaponPaths = owned ? b.weaponPaths.filter(x => x !== id) : [...b.weaponPaths, id]; });
  }

  static async #onWeave(event, target) {
    const id = target.dataset.id;
    const owned = getBuild(this.actor).weaves.includes(id);
    if ( owned && !getRuntime(this.actor).respecWindow && !game.user.isGM ) return notify("warn", "AF.Error.respecRest");
    return this.#mutate(b => { b.weaves = owned ? b.weaves.filter(x => x !== id) : [...b.weaves, id]; });
  }

  static async #onArm(event, target) {
    const id = target.dataset.id;
    await armWeave(this.actor, getRuntime(this.actor).armedWeave === id ? null : id);
    this.render();
  }

  static async #onEquip(event, target) {
    return this.#mutate(b => { b.loadout.push({ technique: target.dataset.id, modifiers: [] }); });
  }

  static async #onUnequip(event, target) {
    const index = Number(target.dataset.index);
    return this.#mutate(b => { b.loadout.splice(index, 1); });
  }

  static async #onRemoveModifier(event, target) {
    const index = Number(target.dataset.index);
    return this.#mutate(b => { b.loadout[index].modifiers = b.loadout[index].modifiers.filter(m => m !== target.dataset.id); });
  }

  static async #onUse(event, target) {
    await useTechnique(this.actor, target.dataset.id);
    this.render();
  }

  static async #onMacro(event, target) {
    await createTechniqueMacro(this.actor, target.dataset.id);
  }

  static async #onMomentum(event, target) {
    if ( !game.user.isGM ) return;
    const rt = getRuntime(this.actor);
    rt.momentum.value = Math.clamp(rt.momentum.value + Number(target.dataset.delta), 0, momentumMax(this.actor));
    await setRuntime(this.actor, rt);
    this.render();
  }
}

/* ------------------------------------------------------------------ */

function costLabel(cost, key, runtime) {
  const parts = [];
  if ( cost?.momentum ) parts.push(`${cost.momentum} ${game.i18n.localize("AF.Momentum")}`);
  if ( cost?.uses ) parts.push(`${usesLeft(key, cost.uses, runtime)}/${cost.uses.max} ${game.i18n.localize(`AF.Per.${cost.uses.per}`)}`);
  if ( cost?.slotLevel ) parts.push(game.i18n.format("AF.SlotPlus", { value: cost.slotLevel }));
  return parts.join(" · ") || game.i18n.localize("AF.Free");
}

function effectLabel(e) {
  const label = game.i18n.localize(`AF.Kind.${e.kind}`);
  const value = e.value ?? e.dice ?? e.feet ?? e.id ?? e.type ?? "";
  return `${label} ${value}`.trim();
}

function requirementList(registry, r, d) {
  const equippedTech = new Set(d.state.loadout.map(e => e.technique));
  const equippedMods = new Set(d.state.loadout.flatMap(e => e.modifiers));
  const out = [];
  const add = (type, id, met) => out.push({ label: loc(registry.get(type, id)?.name) || id, type: game.i18n.localize(`AF.Type.${type}`), met });
  (r.nodes ?? []).forEach(id => add("node", id, d.state.nodes.includes(id)));
  (r.techniques ?? []).forEach(id => add("technique", id, equippedTech.has(id)));
  (r.modifiers ?? []).forEach(id => add("modifier", id, equippedMods.has(id)));
  (r.weaponPaths ?? []).forEach(id => add("weaponPath", id, d.state.weaponPaths.includes(id)));
  (r.weaves ?? []).forEach(id => add("weave", id, d.state.weaves.includes(id)));
  (r.evolutions ?? []).forEach(e => add("evolution", e.path, d.evolutions[e.class]?.path === e.path && d.evolutions[e.class].tier >= (e.tier ?? 1)));
  (r.synergies ?? []).forEach(id => add("synergy", id, false));
  return out;
}
