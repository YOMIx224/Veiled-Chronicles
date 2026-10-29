/**
 * Actor flag storage, the live registry, and the managed passive ActiveEffect.
 *
 * flags["ascendant-forge"]:
 *   build      — the player's choices (engine/build.js shape)
 *   runtime    — { momentum, economy, uses, once, respecWindow }
 *   bonusPoints — GM-granted extra Constellation points
 */
import { MODULE_ID, STAT_KEYS } from "../constants.js";
import { deriveBuild, normalizeBuild, validateBuild } from "../engine/build.js";
import { momentumState, momentumTick } from "../engine/resolver.js";
import { actorContext, combatKeys } from "./context.js";

let registry = null;
export const setRegistry = r => { registry = r; };
export const getRegistry = () => registry;

/* ------------------------------------------------------------------ */
/*  Build                                                              */
/* ------------------------------------------------------------------ */

export function getBuild(actor) {
  return normalizeBuild(actor.getFlag(MODULE_ID, "build"));
}

export function derive(actor) {
  return deriveBuild(registry, actorContext(actor), getBuild(actor));
}

export function validate(actor, build = null) {
  return validateBuild(registry, actorContext(actor), build ?? getBuild(actor));
}

/**
 * Save a build. Invalid builds are refused unless `force` (GM repair).
 * @returns {Promise<{ok: boolean, errors: object[]}>}
 */
export async function saveBuild(actor, build, { force = false } = {}) {
  const normalized = normalizeBuild(build);
  const result = validateBuild(registry, actorContext(actor), normalized);
  if ( !result.ok && !(force && game.user.isGM) ) return { ok: false, errors: result.errors };
  await actor.setFlag(MODULE_ID, "build", normalized);
  await syncPassiveEffect(actor);
  return { ok: true, errors: result.errors };
}

/* ------------------------------------------------------------------ */
/*  Runtime                                                            */
/* ------------------------------------------------------------------ */

export function getRuntime(actor) {
  const raw = actor.getFlag(MODULE_ID, "runtime") ?? {};
  const keys = combatKeys(actor);
  return {
    momentum: momentumTick(raw.momentum, keys),
    economy: raw.economy?.roundKey === keys.roundKey ? { ...raw.economy } : { roundKey: keys.roundKey, reaction: true },
    uses: { ...(raw.uses ?? {}) },
    once: { ...(raw.once ?? {}) },
    respecWindow: !!raw.respecWindow,
    armedWeave: raw.armedWeave ?? null,
    armedSynergies: [...(raw.armedSynergies ?? [])]
  };
}

export async function setRuntime(actor, runtime) {
  return actor.update({ [`flags.${MODULE_ID}.runtime`]: runtime }, { [MODULE_ID]: { runtime: true } });
}

/** Momentum maximum for this actor right now. */
export function momentumMax(actor) {
  return derive(actor).budgets.momentumMax;
}

export function usesLeft(key, def, runtime) {
  if ( !def ) return Infinity;
  return Math.max(0, def.max - (runtime.uses[key]?.spent ?? 0));
}

/** Reset per-rest usage. type: "short" | "long" */
export async function resetForRest(actor, type) {
  const rt = getRuntime(actor);
  for ( const [key, u] of Object.entries(rt.uses) ) {
    if ( u.per === "sr" || (type === "long" && u.per === "lr") ) delete rt.uses[key];
  }
  if ( type === "long" ) {
    rt.momentum = momentumState({ ...rt.momentum, value: 0 });
    rt.respecWindow = true;
  }
  await setRuntime(actor, rt);
}

/* ------------------------------------------------------------------ */
/*  Passive ActiveEffect                                               */
/* ------------------------------------------------------------------ */

const ADD = 2; // CONST.ACTIVE_EFFECT_MODES.ADD (kept literal so this file stays importable in tests)

/**
 * Keep exactly one managed ActiveEffect that carries passive stat effects
 * through dnd5e's native data preparation.
 */
export async function syncPassiveEffect(actor) {
  if ( !actor.isOwner ) return;
  const d = derive(actor);
  const changes = Object.entries(d.passives.stats)
    .filter(([key, v]) => v && STAT_KEYS[key])
    .map(([key, v]) => ({ key: STAT_KEYS[key], mode: ADD, value: key === "speed" ? String(v) : `+${v}`, priority: 20 }));
  const existing = actor.effects.find(e => e.getFlag(MODULE_ID, "managed"));
  if ( !changes.length ) {
    if ( existing ) await existing.delete();
    return;
  }
  const data = {
    name: game.i18n.localize("AF.Title"),
    img: "icons/magic/symbols/star-yellow.webp",
    changes,
    transfer: false,
    disabled: false,
    flags: { [MODULE_ID]: { managed: true } }
  };
  if ( existing ) {
    const same = JSON.stringify(existing.changes.map(c => [c.key, c.value])) === JSON.stringify(changes.map(c => [c.key, c.value]));
    if ( !same ) await existing.update({ changes });
  }
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
}

/* ------------------------------------------------------------------ */
/*  Responsibility                                                     */
/* ------------------------------------------------------------------ */

/**
 * The single client that should write automatic changes for an actor:
 * the first active non-GM owner, otherwise the active GM.
 */
export function isResponsible(actor) {
  const owners = game.users.filter(u => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"))
    .sort((a, b) => a.id.localeCompare(b.id));
  if ( owners.length ) return owners[0] === game.user;
  return game.users.activeGM === game.user;
}
