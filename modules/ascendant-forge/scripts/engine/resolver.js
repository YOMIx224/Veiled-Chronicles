/**
 * Resolution pipeline.
 *
 * Order (constants.RESOLUTION_ORDER):
 *   validate → cost → shape → attack → mastery (native, untouched) → damage → secondary → resource → trigger
 *
 * Stacking rules:
 *   - attack: Forge bonuses are summed and capped at LIMITS.attackBonusCap; penalties always apply in full.
 *   - damage: flat bonuses summed and capped at proficiency bonus; exactly one rider die (the largest);
 *             exactly one damage-type swap (highest priority). There is no multiplier kind at all;
 *             only native critical hits double dice.
 *   - secondary: one Forge secondary per hit (highest priority). Native weapon mastery is separate.
 *   - shape: one range, one area and one target change (largest each), each within hard limits.
 *   - resource: Momentum gains are capped per round and per source.
 *   - trigger: chains deeper than LIMITS.triggerDepthMax are refused.
 *
 * All functions are pure; integration.js turns the results into dnd5e roll parts.
 */
import { LIMITS } from "../constants.js";
import { evaluate } from "./conditions.js";
import { diceAverage, resolveValue } from "./effects.js";

const DEFAULT_PRIORITY = { technique: 50, modifier: 45, synergy: 40, weaponPath: 30, evolution: 30, node: 20 };
const priorityOf = e => e.priority ?? DEFAULT_PRIORITY[e.sourceType] ?? 0;

/** Keep entries whose `when` condition passes in the use-time context. */
export function applicable(entries, ctx) {
  const kept = [];
  const dropped = [];
  for ( const e of entries ) {
    const r = evaluate(e.effect.when, ctx);
    if ( r.ok ) kept.push(e);
    else dropped.push({ source: e.source, kind: e.effect.kind, reason: "condition", failed: r.failed });
  }
  return { kept, dropped };
}

const ofKind = (entries, ...kinds) => entries.filter(e => kinds.includes(e.effect.kind));

/** Pick one entry by score then priority; report the rest as dropped. */
function pickOne(entries, score, reason) {
  if ( !entries.length ) return { pick: null, dropped: [] };
  const sorted = [...entries].sort((a, b) => (score(b) - score(a)) || (priorityOf(b) - priorityOf(a)));
  return { pick: sorted[0], dropped: sorted.slice(1).map(e => ({ source: e.source, kind: e.effect.kind, reason })) };
}

/* ------------------------------------------------------------------ */

export function resolveShape(entries, ctx) {
  const { kept, dropped } = applicable(ofKind(entries, "rangeDelta", "areaDelta", "targetDelta"), ctx);
  const out = { range: 0, area: 0, targets: 0, applied: [], dropped };
  for ( const [kind, key, field, cap] of [
    ["rangeDelta", "range", "feet", LIMITS.rangeDeltaMax],
    ["areaDelta", "area", "feet", LIMITS.areaDeltaMax],
    ["targetDelta", "targets", "value", LIMITS.targetDeltaMax]
  ] ) {
    const { pick, dropped: d } = pickOne(ofKind(kept, kind), e => Math.abs(e.effect[field]), "shapeStack");
    out.dropped.push(...d);
    if ( pick ) {
      const raw = pick.effect[field];
      out[key] = Math.sign(raw) * Math.min(Math.abs(raw), cap);
      out.applied.push({ source: pick.source, kind, value: out[key] });
    }
  }
  return out;
}

export function resolveAttack(entries, ctx) {
  const { kept, dropped } = applicable(ofKind(entries, "attackBonus", "attackPenalty"), ctx);
  const applied = [];
  let bonus = 0;
  for ( const e of ofKind(kept, "attackBonus").sort((a, b) => priorityOf(b) - priorityOf(a)) ) {
    const room = LIMITS.attackBonusCap - bonus;
    if ( room <= 0 ) { dropped.push({ source: e.source, kind: e.effect.kind, reason: "cap" }); continue; }
    const v = Math.min(room, e.effect.value);
    bonus += v;
    applied.push({ source: e.source, kind: "attackBonus", value: v });
  }
  let penalty = 0;
  for ( const e of ofKind(kept, "attackPenalty") ) {
    penalty += e.effect.value;
    applied.push({ source: e.source, kind: "attackPenalty", value: -e.effect.value });
  }
  const net = bonus - penalty;
  return { total: net, parts: net ? [`${net >= 0 ? "+" : ""}${net}`] : [], applied, dropped };
}

/**
 * @param {Array} entries
 * @param {object} ctx           use-time context (needs ctx.pb)
 * @param {string[]} baseTypes   damage types of the native roll
 */
export function resolveDamage(entries, ctx, baseTypes = []) {
  const { kept, dropped } = applicable(ofKind(entries, "damageBonus", "damagePenalty", "riderDie", "damageTypeSwap"), ctx);
  const pb = ctx.pb ?? 2;
  const cap = LIMITS.damageBonusCap === "pb" ? pb : LIMITS.damageBonusCap;
  const applied = [];
  const parts = [];

  // Flat bonuses (capped)
  let flat = 0;
  for ( const e of ofKind(kept, "damageBonus").sort((a, b) => priorityOf(b) - priorityOf(a)) ) {
    const room = cap - flat;
    const value = resolveValue(e.effect.value, pb);
    if ( room <= 0 ) { dropped.push({ source: e.source, kind: "damageBonus", reason: "cap" }); continue; }
    const v = Math.min(room, value);
    flat += v;
    applied.push({ source: e.source, kind: "damageBonus", value: v });
    parts.push({ formula: String(v), type: e.effect.damageType ?? null });
  }

  // One rider die
  const rider = pickOne(ofKind(kept, "riderDie"), e => diceAverage(e.effect.dice), "riderStack");
  dropped.push(...rider.dropped);
  if ( rider.pick ) {
    applied.push({ source: rider.pick.source, kind: "riderDie", value: rider.pick.effect.dice });
    parts.push({ formula: rider.pick.effect.dice, type: rider.pick.effect.damageType ?? null });
  }

  // Penalties always apply
  for ( const e of ofKind(kept, "damagePenalty") ) {
    const v = e.effect.value;
    const formula = v === "ability" ? "-@mod" : typeof v === "number" ? `-${v}` : `-${v}`;
    applied.push({ source: e.source, kind: "damagePenalty", value: v });
    parts.push({ formula, type: null, penalty: true });
  }

  // One type swap, only if a base type matches
  const swaps = ofKind(kept, "damageTypeSwap").filter(e => e.effect.from.some(t => baseTypes.includes(t)));
  const swap = pickOne(swaps, () => 0, "swapStack");
  dropped.push(...swap.dropped);
  let typeSwap = null;
  if ( swap.pick ) {
    typeSwap = { from: swap.pick.effect.from, to: swap.pick.effect.to };
    applied.push({ source: swap.pick.source, kind: "damageTypeSwap", value: typeSwap });
    // A type swap also converts Forge parts of a matching type, never their amount.
    for ( const part of parts ) if ( part.type && typeSwap.from.includes(part.type) ) part.type = typeSwap.to;
  }
  return { parts, typeSwap, applied, dropped };
}

export function resolveSecondary(entries, ctx) {
  const { kept, dropped } = applicable(ofKind(entries, "secondary"), ctx);
  const { pick, dropped: d } = pickOne(kept, () => 0, "secondaryStack");
  return {
    effect: pick ? { ...pick.effect, source: pick.source } : null,
    // Every applicable option, best first: the player may pick a different one (only one applies).
    candidates: [...kept].sort((a, b) => priorityOf(b) - priorityOf(a)).map(e => ({ ...e.effect, source: e.source })),
    applied: pick ? [{ source: pick.source, kind: "secondary", value: pick.effect.type }] : [],
    dropped: [...dropped, ...d]
  };
}

/* ------------------------------------------------------------------ */
/*  Momentum ledger                                                    */
/* ------------------------------------------------------------------ */

/**
 * Pure Momentum bookkeeping. State is a plain object stored in actor flags:
 *   { value, roundKey, gainedThisRound, sourcesThisTurn: string[], sourcesThisRound: string[], turnKey }
 */
export function momentumState(raw = {}) {
  return {
    value: Number.isInteger(raw.value) ? raw.value : 0,
    roundKey: raw.roundKey ?? null,
    turnKey: raw.turnKey ?? null,
    gainedThisRound: raw.gainedThisRound ?? 0,
    sourcesThisRound: [...(raw.sourcesThisRound ?? [])],
    sourcesThisTurn: [...(raw.sourcesThisTurn ?? [])]
  };
}

/** Roll over counters when the combat round/turn changes. */
export function momentumTick(raw, { roundKey, turnKey }) {
  const s = momentumState(raw);
  if ( roundKey !== s.roundKey ) { s.roundKey = roundKey; s.gainedThisRound = 0; s.sourcesThisRound = []; }
  if ( turnKey !== s.turnKey ) { s.turnKey = turnKey; s.sourcesThisTurn = []; }
  return s;
}

/**
 * Attempt a gain.
 * @returns {{state: object, gained: number, reason?: string}}
 */
export function momentumGain(raw, { amount = 1, source, oncePer = "round", max, depth = 0 }) {
  const s = momentumState(raw);
  if ( depth > LIMITS.triggerDepthMax ) return { state: s, gained: 0, reason: "depth" };
  const list = oncePer === "turn" ? s.sourcesThisTurn : s.sourcesThisRound;
  if ( list.includes(source) ) return { state: s, gained: 0, reason: "oncePer" };
  const room = Math.min(LIMITS.momentumGainPerRound - s.gainedThisRound, max - s.value);
  if ( room <= 0 ) return { state: s, gained: 0, reason: s.value >= max ? "full" : "roundCap" };
  const gained = Math.min(room, amount);
  s.value += gained;
  s.gainedThisRound += gained;
  list.push(source);
  return { state: s, gained };
}

export function momentumSpend(raw, amount) {
  const s = momentumState(raw);
  if ( amount > s.value ) return { state: s, ok: false };
  s.value -= amount;
  return { state: s, ok: true };
}

/* ------------------------------------------------------------------ */
/*  Trigger guard                                                      */
/* ------------------------------------------------------------------ */

/**
 * Tracks the current trigger chain so a triggered effect can't trigger again.
 * One instance per client; integration wraps event handling in `run`.
 */
export class TriggerGuard {
  depth = 0;
  chain = [];

  canEnter(key) {
    return this.depth <= LIMITS.triggerDepthMax && !this.chain.includes(key);
  }

  async run(key, fn) {
    if ( !this.canEnter(key) ) return { refused: true };
    this.depth++;
    this.chain.push(key);
    try { return { refused: false, result: await fn(this.depth) }; }
    finally { this.depth--; this.chain.pop(); }
  }
}
