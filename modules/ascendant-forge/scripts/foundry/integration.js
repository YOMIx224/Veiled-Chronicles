/**
 * dnd5e / Foundry hook wiring.
 *
 * Native workflows stay in charge: the module only adds parts to native attack and
 * damage rolls, changes damage types, resizes native templates and posts a card that
 * explains what applied. Resolution order follows constants.RESOLUTION_ORDER.
 */
import { MODULE_ID } from "../constants.js";
import { resolveAttack, resolveDamage, resolveSecondary, resolveShape } from "../engine/resolver.js";
import { effectiveTechnique } from "../engine/build.js";
import { useContext } from "./context.js";
import { derive, getBuild, getRegistry, getRuntime, isResponsible, resetForRest, setRuntime, syncPassiveEffect } from "./store.js";
import {
  collectUseEntries, expireTurnEffects, fireEvent, forgeDC, getPending, onChatButton, payWeave, pending,
  postResolutionCard, recordSynergyUse, useTechnique
} from "./actions.js";
import { loc } from "./i18n.js";

/** Weaves paid for a cast, keyed by actor id, until the spell's rolls resolve. */
const castWeaves = new Map();
/** Attack resolutions waiting for their damage roll, keyed by activity uuid. */
const attackLog = new Map();

const hasBuild = actor => actor?.type === "character" && !!actor.getFlag(MODULE_ID, "build");

function useFor(activity) {
  const actor = activity?.actor;
  if ( !hasBuild(actor) ) return null;
  const item = activity.item;
  const derived = derive(actor);
  const p = getPending(actor, item);
  const w = castWeaves.get(actor.id);
  const weaveUse = w && w.itemId === item.id && Date.now() < w.expires ? w : null;
  const runtime = getRuntime(actor);
  const use = { technique: p?.technique ?? null, weave: weaveUse?.weave.id ?? null };
  const ctx = useContext(actor, { derived, item, activity, use, runtime });
  const entries = collectUseEntries(actor, derived, {
    techniqueEff: p?.eff ?? null, weave: weaveUse?.weave ?? null, optIns: [...(p?.optIns ?? []), ...(weaveUse?.optIns ?? [])]
  });
  return { actor, item, derived, pending: p, weaveUse, ctx, entries };
}

/* ------------------------------------------------------------------ */
/*  Rolls                                                              */
/* ------------------------------------------------------------------ */

function onPreRollAttack(config) {
  const u = useFor(config.subject);
  if ( !u ) return;
  const r = resolveAttack(u.entries, u.ctx);
  if ( r.parts.length ) config.rolls?.[0]?.parts?.push(...r.parts);
  attackLog.set(config.subject.uuid, { attack: r, at: Date.now() });
}

function onRollAttack(rolls, { subject }) {
  const actor = subject?.actor;
  const roll = rolls?.[0];
  if ( !actor || !roll ) return;
  if ( roll.isCritical ) fireEvent(actor, "crit");
  const known = Number.isNumeric(roll.options?.target);
  if ( !known || roll.isCritical || roll.isSuccess ) return;
  // A definite miss.
  if ( hasBuild(actor) ) fireEvent(actor, "miss");
  for ( const token of game.user.targets ) {
    if ( hasBuild(token.actor) ) fireEvent(token.actor, "missedBy", { attackerName: actor.name });
  }
  const p = getPending(actor, subject.item);
  if ( p ) {
    pending.delete(actor.id);
    postResolutionCard(actor, { use: p, applied: attackLog.get(subject.uuid)?.attack.applied ?? [], notes: [game.i18n.localize("AF.Card.Missed")] });
  }
}

function onPreRollDamage(config) {
  const activity = config.subject;
  if ( !activity || activity.type === "heal" ) return;
  const u = useFor(activity);
  if ( !u ) return;
  const rolls = config.rolls ?? [];
  const baseTypes = rolls.flatMap(r => [r.options?.type, ...(r.options?.types ?? [])]).filter(Boolean);
  const dmg = resolveDamage(u.entries, u.ctx, baseTypes);
  const first = rolls[0];
  for ( const part of dmg.parts ) {
    if ( !part.type || part.penalty || !first ) first?.parts?.push(part.formula.startsWith("-") ? part.formula : `+${part.formula}`);
    else rolls.push({
      parts: [part.formula], data: first.data ?? {},
      options: { ...first.options, type: part.type, types: [part.type] }
    });
  }
  if ( dmg.typeSwap ) {
    const { from, to } = dmg.typeSwap;
    for ( const r of rolls ) {
      if ( !r.options ) continue;
      if ( from.includes(r.options.type) ) r.options.type = to;
      if ( Array.isArray(r.options.types) ) r.options.types = [...new Set(r.options.types.map(t => (from.includes(t) ? to : t)))];
    }
  }
  const log = attackLog.get(activity.uuid) ?? {};
  log.damage = dmg;
  log.secondary = resolveSecondary(u.entries, u.ctx);
  log.ctx = u.ctx;
  attackLog.set(activity.uuid, log);
}

async function onRollDamage(rolls, { subject }) {
  const activity = subject;
  const actor = activity?.actor;
  if ( !hasBuild(actor) || activity.type === "heal" ) return;
  const log = attackLog.get(activity.uuid);
  attackLog.delete(activity.uuid);
  const p = getPending(actor, activity.item);
  const w = castWeaves.get(actor.id);
  const weaveUse = w && w.itemId === activity.item.id ? w : null;
  if ( p ) pending.delete(actor.id);
  if ( weaveUse ) castWeaves.delete(actor.id);
  if ( activity.type === "attack" ) fireEvent(actor, "hit", { technique: p?.technique ?? null });
  if ( !log ) return;
  const applied = [...(log.attack?.applied ?? []), ...(log.damage?.applied ?? [])];
  const dropped = [...(log.attack?.dropped ?? []).filter(d => d.reason !== "condition"), ...(log.damage?.dropped ?? []).filter(d => d.reason !== "condition")];
  const candidates = log.secondary?.candidates ?? [];
  if ( !p && !weaveUse && !applied.length && !candidates.length ) return;
  await postResolutionCard(actor, {
    use: { ...(p ?? {}), weave: weaveUse?.weave.id ?? null, momentumCost: (p?.momentumCost ?? 0) + (weaveUse?.cost ?? 0), targets: p?.targets ?? [...game.user.targets].map(t => t.document.uuid) },
    secondary: log.secondary, applied, dropped,
    title: p ? null : weaveUse ? null : game.i18n.localize("AF.Card.Passive"),
    dc: forgeDC(actor, { item: activity.item, activity })
  });
  await recordSynergyUse(actor, applied);
}

/* ------------------------------------------------------------------ */
/*  Spells & templates                                                 */
/* ------------------------------------------------------------------ */

function onPreConsumption(activity, usageConfig) {
  if ( activity.item?.type !== "spell" || !hasBuild(activity.actor) ) return;
  const paid = payWeave(activity.actor, activity, usageConfig);
  if ( paid === false ) return false;
  if ( paid ) castWeaves.set(activity.actor.id, { ...paid, itemId: activity.item.id, expires: Date.now() + 3 * 60 * 1000 });
}

function onPreCreateTemplate(activity, templateData) {
  const actor = activity?.actor;
  if ( !hasBuild(actor) ) return;
  const u = useFor(activity);
  if ( !u ) return;
  const shape = resolveShape(u.entries, u.ctx);
  if ( shape.area ) templateData.distance = Math.max(5, (templateData.distance ?? 0) + shape.area);
}

async function onPostUse(activity) {
  const actor = activity?.actor;
  if ( !hasBuild(actor) ) return;
  const item = activity.item;
  if ( item.type === "spell" && (item.system.level ?? 0) >= 1 ) fireEvent(actor, "spellCast");

  // Weaves whose effects don't touch rolls resolve now.
  const w = castWeaves.get(actor.id);
  if ( w && w.itemId === item.id ) {
    const touchesRolls = w.weave.effects.some(e => ["attackBonus", "attackPenalty", "damageBonus", "damagePenalty", "riderDie", "damageTypeSwap"].includes(e.kind));
    const hasDamage = !!activity.damage?.parts?.length || activity.type === "attack";
    if ( !touchesRolls || !hasDamage ) {
      castWeaves.delete(actor.id);
      const u = { derived: derive(actor) };
      const ctx = useContext(actor, { derived: u.derived, item, activity, use: { weave: w.weave.id }, runtime: getRuntime(actor) });
      const entries = collectUseEntries(actor, u.derived, { weave: w.weave, optIns: w.optIns });
      const shape = resolveShape(entries, ctx);
      const sec = resolveSecondary(entries, ctx);
      const notes = [];
      if ( shape.range ) notes.push(game.i18n.format("AF.Card.Range", { feet: shape.range }));
      if ( shape.targets ) notes.push(game.i18n.format("AF.Card.Targets", { value: shape.targets }));
      await postResolutionCard(actor, {
        use: { weave: w.weave.id, momentumCost: w.cost, targets: [...game.user.targets].map(t => t.document.uuid) },
        secondary: sec, applied: [...shape.applied, ...sec.applied], notes, dc: forgeDC(actor, { item })
      });
    }
  }

  // Techniques that modify this native feature.
  const identifier = item.identifier;
  if ( !identifier ) return;
  const registry = getRegistry();
  for ( const entry of getBuild(actor).loadout ) {
    const eff = effectiveTechnique(registry, entry);
    if ( eff?.technique.kind !== "modifyFeature" || eff.technique.modifiesFeature.feature !== identifier ) continue;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: loc(eff.technique.name) },
      content: `<p>${loc(eff.technique.description)}</p><p>${game.i18n.format("AF.Use.ConfirmCost", { value: eff.momentum })}</p>`,
      rejectClose: false
    });
    if ( ok ) await useTechnique(actor, eff.technique.id);
  }
}

/* ------------------------------------------------------------------ */
/*  Combat, damage, rest                                               */
/* ------------------------------------------------------------------ */

async function onTurnChange(combat, prior, current) {
  if ( !game.user.isGM ) return;
  const actor = combat.combatants.get(current.combatantId)?.actor;
  if ( !actor ) return;
  await expireTurnEffects(actor);
  if ( hasBuild(actor) ) fireEvent(actor, "turnStart");
}

async function onCombatStart(combat) {
  if ( !game.user.isGM ) return;
  for ( const c of combat.combatants ) {
    const actor = c.actor;
    if ( !hasBuild(actor) ) continue;
    const rt = getRuntime(actor);
    if ( rt.respecWindow ) { rt.respecWindow = false; await setRuntime(actor, rt); }
  }
}

async function onDeleteCombat(combat) {
  if ( !game.user.isGM || !game.settings.get(MODULE_ID, "resetMomentumAfterCombat") ) return;
  for ( const c of combat.combatants ) {
    const actor = c.actor;
    if ( !hasBuild(actor) ) continue;
    const rt = getRuntime(actor);
    rt.momentum.value = 0;
    rt.economy = { roundKey: "out", reaction: true };
    await setRuntime(actor, rt);
    await expireTurnEffects(actor);
  }
}

function onDamageActor(actor, changes, update, userId) {
  if ( userId !== game.user.id || !hasBuild(actor) ) return;
  if ( (changes?.hp ?? 0) < 0 || (changes?.total ?? 0) < 0 ) fireEvent(actor, "damaged");
}

async function onRestCompleted(actor, result, config) {
  if ( !hasBuild(actor) || !isResponsible(actor) ) return;
  const type = config?.type ?? (result?.longRest ? "long" : "short");
  await resetForRest(actor, type === "long" ? "long" : "short");
}

async function onClassChange(item) {
  if ( item.type !== "class" && item.type !== "subclass" ) return;
  const actor = item.parent;
  if ( hasBuild(actor) && isResponsible(actor) ) await syncPassiveEffect(actor);
}

/* ------------------------------------------------------------------ */
/*  Registration                                                       */
/* ------------------------------------------------------------------ */

export function registerHooks({ openForge }) {
  Hooks.on("dnd5e.preRollAttackV2", onPreRollAttack);
  Hooks.on("dnd5e.rollAttackV2", onRollAttack);
  Hooks.on("dnd5e.preRollDamageV2", onPreRollDamage);
  Hooks.on("dnd5e.rollDamageV2", onRollDamage);
  Hooks.on("dnd5e.preActivityConsumption", onPreConsumption);
  Hooks.on("dnd5e.preCreateActivityTemplate", onPreCreateTemplate);
  Hooks.on("dnd5e.postUseActivity", onPostUse);
  Hooks.on("dnd5e.damageActor", onDamageActor);
  Hooks.on("dnd5e.beginConcentrating", actor => hasBuild(actor) && fireEvent(actor, "concentrationStart"));
  Hooks.on("dnd5e.restCompleted", onRestCompleted);
  Hooks.on("combatTurnChange", onTurnChange);
  Hooks.on("combatStart", onCombatStart);
  Hooks.on("deleteCombat", onDeleteCombat);
  Hooks.on("updateItem", onClassChange);
  Hooks.on("createItem", onClassChange);
  Hooks.on("deleteItem", onClassChange);

  Hooks.on("renderChatMessageHTML", (message, html) => {
    html.querySelectorAll("[data-af-action]").forEach(btn => btn.addEventListener("click", event => {
      event.preventDefault();
      onChatButton(message, btn);
    }));
  });

  Hooks.on("getHeaderControlsActorSheetV2", (app, controls) => {
    const actor = app.document;
    if ( actor?.type !== "character" || !actor.isOwner ) return;
    controls.push({
      icon: "fa-solid fa-star", label: "AF.Open", action: "ascendantForge",
      onClick: () => openForge(actor)
    });
  });

  game.socket.on(`module.${MODULE_ID}`, async payload => {
    if ( payload?.type !== "event" ) return;
    const actor = await fromUuid(payload.actorUuid);
    if ( actor && isResponsible(actor) ) fireEvent(actor, payload.event, payload.data ?? {});
  });
}
