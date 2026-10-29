/**
 * Player-facing actions: using techniques, arming weaves, Momentum events,
 * applying secondary effects and the chat cards that explain resolution.
 */
import { AUTO_TRIGGERS, EFFECT_KINDS, MODULE_ID } from "../constants.js";
import { evaluate } from "../engine/conditions.js";
import { activeSynergies, effectiveTechnique } from "../engine/build.js";
import { resolveSecondary, momentumGain, momentumSpend, TriggerGuard } from "../engine/resolver.js";
import { resolveValue } from "../engine/effects.js";
import { combatKeys, useContext } from "./context.js";
import { derive, getRegistry, getRuntime, isResponsible, setRuntime, usesLeft, validate } from "./store.js";
import { loc, notify, describeFailures } from "./i18n.js";

const { DialogV2 } = foundry.applications.api;
const USE_KINDS = new Set(Object.entries(EFFECT_KINDS)
  .filter(([, s]) => ["attack", "damage", "secondary", "shape"].includes(s.channel)).map(([k]) => k));

export const guard = new TriggerGuard();

/** Pending technique uses on this client, keyed by actor id. Consumed by roll hooks. */
export const pending = new Map();
const PENDING_TTL = 3 * 60 * 1000;

export function getPending(actor, item = null) {
  const p = pending.get(actor?.id);
  if ( !p ) return null;
  if ( Date.now() > p.expires ) { pending.delete(actor.id); return null; }
  if ( item && p.itemId && p.itemId !== item.id ) return null;
  return p;
}

/* ------------------------------------------------------------------ */
/*  Effect collection                                                  */
/* ------------------------------------------------------------------ */

/**
 * All effect entries that may apply to one use, before conditions are evaluated.
 * Passive kinds are excluded (they live on the managed ActiveEffect).
 */
export function collectUseEntries(actor, derived, { techniqueEff = null, weave = null, optIns = [] } = {}) {
  const registry = getRegistry();
  const entries = derived.sources.filter(s => USE_KINDS.has(s.effect.kind));
  if ( techniqueEff ) entries.push(...techniqueEff.effects.filter(e => USE_KINDS.has(e.effect.kind)));
  if ( weave ) entries.push(...weave.effects.filter(e => USE_KINDS.has(e.kind)).map(effect => ({ effect, source: weave.id, sourceType: "weave" })));
  const runtime = getRuntime(actor);
  const keys = combatKeys(actor);
  for ( const syn of activeSynergies(registry, derived) ) {
    const costly = (syn.cost?.momentum ?? 0) > 0;
    if ( costly && !optIns.includes(syn.id) ) continue;
    const key = syn.oncePer === "turn" ? keys.turnKey : keys.roundKey;
    if ( runtime.once[`synergy:${syn.id}`] === key ) continue;
    entries.push(...syn.effects.filter(e => USE_KINDS.has(e.kind) || e.kind === "note")
      .map(effect => ({ effect, source: syn.id, sourceType: "synergy", priority: syn.priority })));
  }
  return entries;
}

/** Synergies that cost Momentum and could apply to this use; the player opts in. */
function optionalSynergies(derived, ctx) {
  return activeSynergies(getRegistry(), derived)
    .filter(s => (s.cost?.momentum ?? 0) > 0)
    .filter(s => s.effects.some(e => evaluate(e.when, ctx).ok));
}

/* ------------------------------------------------------------------ */
/*  Technique use                                                      */
/* ------------------------------------------------------------------ */

/**
 * Validate, pay for and perform a technique.
 * @param {Actor} actor
 * @param {string} techniqueId
 * @param {object} [opts]
 * @param {string} [opts.itemId]    Weapon to use (otherwise chosen).
 * @param {string} [opts.trigger]   Event the player declares for a reaction.
 * @param {number} [opts.depth]     Trigger chain depth when started from a prompt.
 */
export async function useTechnique(actor, techniqueId, { itemId = null, trigger = null, depth = 0 } = {}) {
  const registry = getRegistry();
  const validation = validate(actor);
  const derived = validation.derived;
  const entry = derived.state.loadout.find(e => e.technique === techniqueId);
  if ( !entry ) return notify("warn", "AF.Use.NotEquipped");
  const blocking = validation.errors.filter(e => e.data?.index === derived.state.loadout.indexOf(entry) || e.data?.id === techniqueId);
  if ( blocking.length ) return notify("error", "AF.Use.InvalidLoadout", { reasons: blocking.map(e => e.message).join("; ") });

  const eff = effectiveTechnique(registry, entry);
  const tech = eff.technique;
  if ( depth > 1 ) return notify("warn", "AF.Use.Recursion");
  if ( tech.kind === "reaction" && trigger && eff.trigger && trigger !== eff.trigger ) {
    return notify("warn", "AF.Use.WrongTrigger", { trigger: game.i18n.localize(`AF.Trigger.${eff.trigger}`) });
  }

  // Choose the weapon
  let item = null;
  if ( tech.delivery === "weaponAttack" ) {
    const weapons = actor.itemTypes.weapon.filter(i => i.system.equipped && (!itemId || i.id === itemId))
      .filter(i => evaluate(tech.requires, useContext(actor, { derived, item: i, use: { technique: tech.id } })).ok);
    if ( !weapons.length ) return notify("warn", "AF.Use.NoWeapon", { name: loc(tech.name) });
    item = weapons.length === 1 ? weapons[0] : await chooseWeapon(weapons);
    if ( !item ) return;
  }

  const runtime = getRuntime(actor);
  const ctx = useContext(actor, { derived, item, use: { technique: tech.id }, runtime });
  const req = evaluate(tech.requires, ctx);
  if ( !req.ok ) return notify("warn", "AF.Use.Requirements", { reasons: describeFailures(req.failed) });

  // Limits & economy
  const keys = combatKeys(actor);
  const onceKey = tech.limits?.oncePer === "round" ? keys.roundKey : keys.turnKey;
  if ( tech.limits?.oncePer && runtime.once[`technique:${tech.id}`] === onceKey ) return notify("warn", "AF.Use.OncePer");
  if ( tech.action === "reaction" && !runtime.economy.reaction ) return notify("warn", "AF.Use.NoReaction");
  if ( tech.action === "bonus" && runtime.economy.bonusTurn === keys.turnKey ) return notify("warn", "AF.Use.NoBonus");
  const usesToSpend = [];
  for ( const [key, uses] of [[`technique:${tech.id}`, tech.cost.uses], ...eff.modifiers.map(m => [`modifier:${m.id}`, m.cost.uses])] ) {
    if ( !uses ) continue;
    if ( usesLeft(key, uses, runtime) < 1 ) return notify("warn", "AF.Use.NoUses", { name: key.split(":")[1] });
    usesToSpend.push([key, uses]);
  }

  // Optional synergies
  let optIns = [];
  const optional = optionalSynergies(derived, ctx);
  if ( optional.length ) {
    optIns = await chooseSynergies(optional, runtime.momentum.value - eff.momentum);
    if ( optIns === null ) return;
  }
  const momentumCost = eff.momentum + optIns.reduce((s, id) => s + (registry.get("synergy", id).cost.momentum ?? 0), 0);
  const spend = momentumSpend(runtime.momentum, momentumCost);
  if ( !spend.ok ) return notify("warn", "AF.Use.NoMomentum", { need: momentumCost, have: runtime.momentum.value });

  // Pay
  runtime.momentum = spend.state;
  for ( const [key, uses] of usesToSpend ) runtime.uses[key] = { spent: (runtime.uses[key]?.spent ?? 0) + 1, per: uses.per };
  if ( tech.limits?.oncePer ) runtime.once[`technique:${tech.id}`] = onceKey;
  if ( tech.action === "reaction" ) runtime.economy.reaction = false;
  if ( tech.action === "bonus" ) runtime.economy.bonusTurn = keys.turnKey;
  await setRuntime(actor, runtime);

  const refund = async () => {
    const rt = getRuntime(actor);
    rt.momentum.value += momentumCost;
    for ( const [key] of usesToSpend ) if ( rt.uses[key] ) rt.uses[key].spent -= 1;
    if ( tech.limits?.oncePer ) delete rt.once[`technique:${tech.id}`];
    if ( tech.action === "reaction" ) rt.economy.reaction = true;
    if ( tech.action === "bonus" ) delete rt.economy.bonusTurn;
    await setRuntime(actor, rt);
  };

  const use = {
    actorId: actor.id, itemId: item?.id ?? null, technique: tech.id, eff, optIns, depth,
    targets: [...game.user.targets].map(t => t.document.uuid),
    expires: Date.now() + PENDING_TTL, momentumCost
  };

  if ( tech.delivery === "weaponAttack" ) {
    const activity = item.system.activities?.getByType("attack")?.[0];
    if ( !activity ) { await refund(); return notify("warn", "AF.Use.NoAttackActivity"); }
    pending.set(actor.id, use);
    const result = await activity.use({}, {}, {});
    if ( !result ) { pending.delete(actor.id); await refund(); return notify("info", "AF.Use.Cancelled"); }
    return result;
  }

  // Self / ally / area: resolve immediately.
  const entries = collectUseEntries(actor, derived, { techniqueEff: eff, optIns });
  const sec = resolveSecondary(entries, ctx);
  await postResolutionCard(actor, { use, ctx, secondary: sec, applied: sec.applied, dropped: sec.dropped });
  await recordSynergyUse(actor, sec.applied);
  return true;
}

async function chooseWeapon(weapons) {
  const options = weapons.map(w => `<option value="${w.id}">${foundry.utils.escapeHTML(w.name)}</option>`).join("");
  return DialogV2.prompt({
    window: { title: game.i18n.localize("AF.Use.ChooseWeapon") },
    content: `<select name="weapon">${options}</select>`,
    ok: { callback: (event, button) => weapons.find(w => w.id === button.form.elements.weapon.value) },
    rejectClose: false
  });
}

async function chooseSynergies(synergies, momentumLeft) {
  const rows = synergies.map(s => `<label class="af-check"><input type="checkbox" name="${s.id}">
    <strong>${loc(s.name)}</strong> (${s.cost.momentum} ${game.i18n.localize("AF.Momentum")})<br><small>${loc(s.tactic)}</small></label>`).join("");
  return DialogV2.prompt({
    window: { title: game.i18n.localize("AF.Use.OptionalSynergies") },
    content: `<p>${game.i18n.format("AF.Use.MomentumLeft", { value: momentumLeft })}</p>${rows}`,
    ok: { callback: (event, button) => synergies.filter(s => button.form.elements[s.id]?.checked).map(s => s.id) },
    rejectClose: false
  });
}

export async function recordSynergyUse(actor, applied) {
  const synIds = new Set(applied.map(a => a.source).filter(id => getRegistry().has("synergy", id)));
  if ( !synIds.size ) return;
  const rt = getRuntime(actor);
  const keys = combatKeys(actor);
  for ( const id of synIds ) {
    const syn = getRegistry().get("synergy", id);
    rt.once[`synergy:${id}`] = syn.oncePer === "turn" ? keys.turnKey : keys.roundKey;
  }
  await setRuntime(actor, rt);
}

/* ------------------------------------------------------------------ */
/*  Weaves                                                             */
/* ------------------------------------------------------------------ */

/** Arm (or disarm with null) a weave for the next eligible spell. */
export async function armWeave(actor, weaveId) {
  const rt = getRuntime(actor);
  if ( !weaveId ) { delete rt.armedWeave; await setRuntime(actor, rt); return; }
  const build = derive(actor).state;
  if ( !build.weaves.includes(weaveId) ) return notify("warn", "AF.Weave.NotKnown");
  const weave = getRegistry().get("weave", weaveId);
  if ( weave.metamagic.policy === "exclusive" && weave.metamagic.conflicts.length ) {
    const owned = weave.metamagic.conflicts.filter(c => actor.items.some(i => i.identifier === c));
    if ( owned.length ) notify("info", "AF.Weave.MetamagicWarning", { options: owned.join(", ") });
  }
  const derived = derive(actor);
  const related = activeSynergies(getRegistry(), derived)
    .filter(syn => (syn.cost?.momentum ?? 0) > 0 && syn.effects.some(e => [e.when?.usingWeave].flat().includes(weaveId)));
  let optIns = [];
  if ( related.length ) {
    optIns = await chooseSynergies(related, rt.momentum.value - (weave.cost.momentum ?? 0));
    if ( optIns === null ) return;
  }
  rt.armedWeave = weaveId;
  rt.armedSynergies = optIns;
  await setRuntime(actor, rt);
  notify("info", "AF.Weave.Armed", { name: loc(weave.name) });
}

/**
 * Check and pay a weave for a spell activity. Called from dnd5e.preActivityConsumption,
 * which cannot await, so this is synchronous and the flag write is fire-and-forget.
 * @returns {{weave: object, optIns: string[]}|false|null}
 *          the paid weave, false to block the cast, null when no weave applies
 */
export function payWeave(actor, activity, usageConfig) {
  const rt = getRuntime(actor);
  const weave = rt.armedWeave ? getRegistry().get("weave", rt.armedWeave) : null;
  if ( !weave ) return null;
  const derived = derive(actor);
  const ctx = useContext(actor, { derived, item: activity.item, activity, use: { weave: weave.id }, runtime: rt });
  if ( !evaluate(weave.appliesTo, ctx).ok ) return null;
  if ( weave.cost.slotLevel ) {
    const slotLevel = actor.system.spells?.[usageConfig.spell?.slot]?.level ?? activity.item.system.level;
    if ( slotLevel < activity.item.system.level + weave.cost.slotLevel ) {
      notify("warn", "AF.Weave.NeedHigherSlot", { level: activity.item.system.level + weave.cost.slotLevel });
      return false;
    }
  }
  const key = `weave:${weave.id}`;
  if ( weave.cost.uses && usesLeft(key, weave.cost.uses, rt) < 1 ) { notify("warn", "AF.Use.NoUses", { name: loc(weave.name) }); return false; }
  const optIns = (rt.armedSynergies ?? []).filter(id => getRegistry().has("synergy", id));
  const cost = (weave.cost.momentum ?? 0) + optIns.reduce((s, id) => s + (getRegistry().get("synergy", id).cost.momentum ?? 0), 0);
  const spend = momentumSpend(rt.momentum, cost);
  if ( !spend.ok ) { notify("warn", "AF.Use.NoMomentum", { need: cost, have: rt.momentum.value }); return false; }
  rt.momentum = spend.state;
  if ( weave.cost.uses ) rt.uses[key] = { spent: (rt.uses[key]?.spent ?? 0) + 1, per: weave.cost.uses.per };
  delete rt.armedWeave;
  delete rt.armedSynergies;
  setRuntime(actor, rt);
  return { weave, optIns, cost };
}

/* ------------------------------------------------------------------ */
/*  Events & Momentum                                                  */
/* ------------------------------------------------------------------ */

/**
 * Process an event for an actor: Momentum gains and reaction prompts.
 * Runs only on the actor's responsible client; others relay over the socket.
 */
export async function fireEvent(actor, event, data = {}) {
  if ( !actor ) return;
  if ( !isResponsible(actor) ) {
    game.socket.emit(`module.${MODULE_ID}`, { type: "event", actorUuid: actor.uuid, event, data });
    return;
  }
  await guard.run(`${actor.uuid}:${event}`, async depth => {
    if ( depth > 1 && !data.allowNested ) return;
    await gainFromEvent(actor, event, data, depth - 1);
    if ( AUTO_TRIGGERS.includes(event) ) await promptReactions(actor, event, data);
  });
}

async function gainFromEvent(actor, event, data, depth) {
  const derived = derive(actor);
  let rt = getRuntime(actor);
  const ctx = useContext(actor, { derived, runtime: rt, use: { technique: data.technique ?? null } });
  const gains = derived.sources.filter(s => s.effect.kind === "resourceGain" && s.effect.on === event);
  // Modifier gains fire only for the technique they are attached to.
  if ( data.technique ) {
    const entry = derived.state.loadout.find(e => e.technique === data.technique);
    for ( const id of entry?.modifiers ?? [] ) {
      const mod = getRegistry().get("modifier", id);
      for ( const effect of mod?.effects ?? [] ) {
        if ( effect.kind === "resourceGain" && effect.on === event ) gains.push({ effect, source: `${id}@${data.technique}`, sourceType: "modifier" });
      }
    }
  }
  if ( event === "hit" && game.settings.get(MODULE_ID, "baseMomentum") ) {
    gains.push({ effect: { kind: "resourceGain", on: "hit", value: 1, oncePer: "turn" }, source: "base:hit", sourceType: "base" });
  }
  const max = derived.budgets.momentumMax;
  const log = [];
  for ( const g of gains ) {
    if ( !evaluate(g.effect.when, ctx).ok ) continue;
    const r = momentumGain(rt.momentum, { amount: g.effect.value, source: g.source, oncePer: g.effect.oncePer, max, depth });
    rt.momentum = r.state;
    if ( r.gained ) log.push(g.source);
  }
  if ( log.length ) {
    await setRuntime(actor, rt);
    if ( game.settings.get(MODULE_ID, "announceMomentum") ) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        whisper: ChatMessage.getWhisperRecipients(actor.name).map(u => u.id),
        content: `<div class="af-card af-momentum">${game.i18n.format("AF.MomentumGained", {
          name: actor.name, value: rt.momentum.value, max, event: game.i18n.localize(`AF.Trigger.${event}`)
        })}</div>`
      });
    }
  }
}

/** Offer equipped reactions whose (possibly overridden) trigger matches the event. */
async function promptReactions(actor, event, data) {
  const registry = getRegistry();
  const derived = derive(actor);
  const rt = getRuntime(actor);
  if ( !rt.economy.reaction ) return;
  const offers = derived.state.loadout.map(e => effectiveTechnique(registry, e))
    .filter(eff => eff && eff.technique.kind === "reaction" && eff.trigger === event)
    .filter(eff => eff.momentum <= rt.momentum.value);
  if ( !offers.length ) return;
  const owners = game.users.filter(u => actor.testUserPermission(u, "OWNER")).map(u => u.id);
  const buttons = offers.map(eff => `<button type="button" data-af-action="react" data-actor="${actor.uuid}"
    data-technique="${eff.technique.id}" data-trigger="${event}">${loc(eff.technique.name)} (${eff.momentum})</button>`).join("");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: owners,
    content: `<div class="af-card"><header>${game.i18n.format("AF.React.Prompt", {
      name: actor.name, trigger: game.i18n.localize(`AF.Trigger.${event}`)
    })}</header>${data.attackerName ? `<p>${foundry.utils.escapeHTML(data.attackerName)}</p>` : ""}<div class="af-buttons">${buttons}</div></div>`
  });
}

/* ------------------------------------------------------------------ */
/*  Secondary effects                                                  */
/* ------------------------------------------------------------------ */

export function forgeDC(actor, { item = null, activity = null } = {}) {
  const sys = actor.system;
  if ( item?.type === "spell" ) return sys.attributes?.spell?.dc ?? 10;
  const ability = activity?.ability ?? (item ? (item.system.properties?.has?.("fin")
    ? (sys.abilities.dex.mod >= sys.abilities.str.mod ? "dex" : "str") : "str") : null);
  const mod = ability ? sys.abilities[ability]?.mod ?? 0
    : Math.max(sys.abilities.str?.mod ?? 0, sys.abilities.dex?.mod ?? 0);
  return 8 + (sys.attributes?.prof ?? 2) + mod;
}

async function expiringEffect(target, source, { name, img, changes = [], description = "" }) {
  return target.createEmbeddedDocuments("ActiveEffect", [{
    name, img, changes, description, transfer: false,
    duration: { rounds: 1 },
    origin: source.uuid,
    flags: { [MODULE_ID]: { expiresOnTurnOf: source.uuid } }
  }]);
}

/**
 * Apply one secondary effect.
 * @param {object} effect   secondary effect (with resolved target)
 * @param {Actor} source
 * @param {Actor[]} targets
 * @param {number} dc
 */
export async function applySecondary(effect, source, targets, dc) {
  const pb = source.system.attributes?.prof ?? 2;
  const lines = [];
  const recipients = effect.target === "self" ? [source] : targets;
  if ( !recipients.length ) return [game.i18n.localize("AF.Card.NoTargets")];
  for ( const actor of recipients ) {
    if ( !actor.isOwner ) { lines.push(game.i18n.format("AF.Card.NeedOwner", { name: actor.name })); continue; }
    switch ( effect.type ) {
      case "condition": {
        let failed = true;
        if ( effect.save ) {
          const rolls = await actor.rollSavingThrow({ ability: effect.save, target: dc });
          failed = !(rolls?.[0]?.total >= dc);
        }
        if ( failed ) await actor.toggleStatusEffect(effect.condition, { active: true });
        lines.push(game.i18n.format(failed ? "AF.Card.ConditionApplied" : "AF.Card.Saved", {
          name: actor.name, condition: game.i18n.localize(CONFIG.statusEffects.find(s => s.id === effect.condition)?.name ?? effect.condition)
        }));
        break;
      }
      case "tempHp": {
        const value = resolveValue(effect.value, pb);
        const current = actor.system.attributes.hp.temp ?? 0;
        if ( value > current ) await actor.update({ "system.attributes.hp.temp": value });
        lines.push(game.i18n.format("AF.Card.TempHp", { name: actor.name, value, kept: Math.max(value, current) }));
        break;
      }
      case "guard":
        await expiringEffect(actor, source, {
          name: game.i18n.format("AF.Effect.Guard", { value: effect.value }), img: "icons/equipment/shield/heater-steel-worn.webp",
          changes: [{ key: "system.attributes.ac.bonus", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: `+${effect.value}` }]
        });
        lines.push(game.i18n.format("AF.Card.Guard", { name: actor.name, value: effect.value }));
        break;
      case "slow":
        await expiringEffect(actor, source, {
          name: game.i18n.format("AF.Effect.Slow", { feet: effect.feet }), img: "icons/magic/time/clock-stopwatch-white-blue.webp",
          changes: [{ key: "system.attributes.movement.walk", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: `-${effect.feet}` }]
        });
        lines.push(game.i18n.format("AF.Card.Slow", { name: actor.name, feet: effect.feet }));
        break;
      case "mark":
        await expiringEffect(actor, source, {
          name: game.i18n.format("AF.Effect.Mark", { source: source.name }), img: "icons/skills/targeting/crosshair-pointed-orange.webp",
          description: game.i18n.format("AF.Effect.MarkDesc", { source: source.name })
        });
        lines.push(game.i18n.format("AF.Card.Mark", { name: actor.name, source: source.name }));
        break;
      case "disadvantageTarget":
        await expiringEffect(actor, source, {
          name: game.i18n.localize("AF.Effect.Off-balance"), img: "icons/skills/movement/feet-winged-boots-brown.webp",
          description: game.i18n.localize("AF.Effect.Off-balanceDesc")
        });
        lines.push(game.i18n.format("AF.Card.Disadvantage", { name: actor.name }));
        break;
      default: // push, shift, advantageAlly: positional/instructional, resolved by the table
        lines.push(game.i18n.format(`AF.Card.${effect.type}`, { name: actor.name, feet: effect.feet ?? 0 }));
    }
  }
  return lines;
}

/** Remove effects that last "until the start of <source>'s next turn". GM only. */
export async function expireTurnEffects(sourceActor) {
  if ( !game.user.isGM ) return;
  for ( const combatant of game.combat?.combatants ?? [] ) {
    const actor = combatant.actor;
    if ( !actor ) continue;
    const ids = actor.effects.filter(e => e.getFlag(MODULE_ID, "expiresOnTurnOf") === sourceActor.uuid).map(e => e.id);
    if ( ids.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  }
  const ids = sourceActor.effects.filter(e => e.getFlag(MODULE_ID, "expiresOnTurnOf") === sourceActor.uuid).map(e => e.id);
  if ( ids.length ) await sourceActor.deleteEmbeddedDocuments("ActiveEffect", ids);
}

/* ------------------------------------------------------------------ */
/*  Chat cards                                                         */
/* ------------------------------------------------------------------ */

const KIND_LABEL = kind => game.i18n.localize(`AF.Kind.${kind}`);

function sourceName(id) {
  const r = getRegistry();
  for ( const type of ["technique", "modifier", "node", "synergy", "weave", "weaponPath", "evolution"] ) {
    const def = r.get(type, id.split("#")[0].split("@")[0]);
    if ( def ) return loc(def.name);
  }
  return id === "base:hit" ? game.i18n.localize("AF.BaseRule") : id;
}

/**
 * Post the resolution card: what applied, what was dropped by stacking rules,
 * and buttons for the secondary choice.
 */
export async function postResolutionCard(actor, { use, ctx, secondary, applied = [], dropped = [], title = null, dc = null, notes = [] }) {
  const registry = getRegistry();
  const tech = use?.technique ? registry.get("technique", use.technique) : null;
  const weave = use?.weave ? registry.get("weave", use.weave) : null;
  const heading = title ?? loc((tech ?? weave)?.name ?? { en: "Ascendant Forge", th: "Ascendant Forge" });
  const fmt = a => `<li><span class="af-src">${sourceName(a.source)}</span> · ${KIND_LABEL(a.kind)}${a.value != null && typeof a.value !== "object" ? ` <b>${a.value}</b>` : ""}</li>`;
  const fmtDrop = d => `<li class="af-dropped"><span class="af-src">${sourceName(d.source)}</span> · ${KIND_LABEL(d.kind)} — ${game.i18n.localize(`AF.Drop.${d.reason}`)}</li>`;
  const candidates = secondary?.candidates ?? [];
  const buttons = candidates.map((c, i) => `<button type="button" data-af-action="secondary" data-index="${i}">
    ${game.i18n.localize(`AF.Secondary.${c.type}`)}${c.condition ? `: ${c.condition}` : ""} — ${sourceName(c.source)}</button>`).join("");
  const noteLines = [...notes, ...applied.filter(a => a.kind === "note")].map(n => `<li>${typeof n === "string" ? n : loc(n.value)}</li>`);
  const content = `<div class="af-card">
    <header><i class="fa-solid fa-star"></i> ${heading}</header>
    ${use?.momentumCost ? `<p class="af-cost">${game.i18n.format("AF.Card.Spent", { value: use.momentumCost })}</p>` : ""}
    ${applied.length ? `<ul class="af-applied">${applied.filter(a => a.kind !== "note").map(fmt).join("")}</ul>` : ""}
    ${noteLines.length ? `<ul class="af-notes">${noteLines.join("")}</ul>` : ""}
    ${dropped.length && game.settings.get(MODULE_ID, "showDropped") ? `<details><summary>${game.i18n.localize("AF.Card.Dropped")}</summary><ul>${dropped.map(fmtDrop).join("")}</ul></details>` : ""}
    ${candidates.length ? `<p>${game.i18n.localize(candidates.length > 1 ? "AF.Card.ChooseOne" : "AF.Card.Apply")}</p><div class="af-buttons">${buttons}</div>` : ""}
  </div>`;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: { [MODULE_ID]: { card: { actorUuid: actor.uuid, candidates, targets: use?.targets ?? [], dc: dc ?? forgeDC(actor), used: false } } }
  });
}

/** Chat button handling (wired in integration.js). */
export async function onChatButton(message, button) {
  const action = button.dataset.afAction;
  if ( action === "react" ) {
    const actor = await fromUuid(button.dataset.actor);
    if ( !actor?.isOwner ) return notify("warn", "AF.Card.NeedOwner", { name: actor?.name ?? "?" });
    return useTechnique(actor, button.dataset.technique, { trigger: button.dataset.trigger, depth: 1 });
  }
  if ( action === "secondary" ) {
    const card = message.getFlag(MODULE_ID, "card");
    if ( !card ) return;
    if ( card.used ) return notify("warn", "AF.Card.AlreadyUsed");
    const source = await fromUuid(card.actorUuid);
    if ( !source ) return;
    if ( !(source.isOwner || game.user.isGM) ) return notify("warn", "AF.Card.NeedOwner", { name: source.name });
    const effect = card.candidates[Number(button.dataset.index)];
    let targets = (await Promise.all(card.targets.map(u => fromUuid(u)))).map(t => t?.actor).filter(Boolean);
    if ( !targets.length ) targets = [...game.user.targets].map(t => t.actor).filter(Boolean);
    const lines = await applySecondary(effect, source, targets, card.dc);
    if ( message.isOwner ) await message.setFlag(MODULE_ID, "card.used", true);
    await recordSynergyUse(source, [{ source: effect.source }]);
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: source }), content: `<div class="af-card"><ul>${lines.map(l => `<li>${l}</li>`).join("")}</ul></div>` });
  }
}
