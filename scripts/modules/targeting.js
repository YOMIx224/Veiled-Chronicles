// =============================================================
//  RnR — targeting.js
//  Range checks, Line of Sight and Cover evaluation
// =============================================================

// ─────────────────────────────────────────────────────────────
//  DISTANCE HELPERS (grid-aware)
// ─────────────────────────────────────────────────────────────

/**
 * Returns the distance in feet between two tokens using Foundry's
 * built-in measurement so it respects the scene's grid settings.
 */
export function tokenDistance(originToken, targetToken) {
  if (!originToken || !targetToken || !canvas.grid) return Infinity;
  try {
    // Foundry v13: canvas.grid.measureDistance or measurePath
    const origin = { x: originToken.x + originToken.w / 2, y: originToken.y + originToken.h / 2 };
    const target = { x: targetToken.x + targetToken.w / 2, y: targetToken.y + targetToken.h / 2 };
    const segments = [{ ray: new Ray(origin, target) }];
    return canvas.grid.measureDistances(segments, { gridSpaces: true })[0];
  } catch {
    // Fallback: Euclidean in grid squares × scene grid distance
    const dx = (originToken.x - targetToken.x) / canvas.grid.size;
    const dy = (originToken.y - targetToken.y) / canvas.grid.size;
    return Math.hypot(dx, dy) * (canvas.scene?.grid?.distance ?? 5);
  }
}

// ─────────────────────────────────────────────────────────────
//  RANGE PARSING
// ─────────────────────────────────────────────────────────────

/**
 * Parse weapon range string, e.g.:
 *   "5"       → { normal: 5,   long: 5   }
 *   "20/60"   → { normal: 20,  long: 60  }
 *   "30/120"  → { normal: 30,  long: 120 }
 *   ""        → { normal: 5,   long: 5   }   (melee default)
 */
export function parseWeaponRange(item) {
  const type   = String(item?.system?.weaponType ?? "melee").toLowerCase();
  const reach  = Number(item?.system?.reach)  || 5;
  const rangeStr = String(item?.system?.range ?? "").trim();

  if (type === "melee") {
    // "reach" weapons extend to 10 ft
    const isReach = (item?.system?.properties ?? []).includes("reach");
    const n = isReach ? Math.max(10, reach) : reach;
    return { normal: n, long: n, melee: true };
  }

  // Ranged: parse "normal/long" or single value
  const parts = rangeStr.split("/").map(s => Number(s.trim())).filter(n => n > 0);
  if (parts.length >= 2) return { normal: parts[0], long: parts[1], melee: false };
  if (parts.length === 1) return { normal: parts[0], long: parts[0] * 3, melee: false };
  // No range specified on a ranged weapon — use generous defaults
  return { normal: 60, long: 120, melee: false };
}

// ─────────────────────────────────────────────────────────────
//  RANGE CHECK
// ─────────────────────────────────────────────────────────────

export const RANGE_RESULT = Object.freeze({
  IN_RANGE:        "in_range",
  LONG_RANGE:      "long_range",    // ranged weapon only — past the comfortable band
  OUT_OF_RANGE:    "out_of_range",
  NO_TARGET:       "no_target",
});

/**
 * Check if a token is within weapon range.
 *
 * @param {Token}  attackerToken
 * @param {Token}  targetToken
 * @param {Item}   weaponItem
 * @returns {{ result: RANGE_RESULT, distance: number, range: object }}
 */
export function checkRange(attackerToken, targetToken, weaponItem) {
  if (!attackerToken || !targetToken) return { result: RANGE_RESULT.NO_TARGET, distance: 0, range: {} };

  const dist  = tokenDistance(attackerToken, targetToken);
  const range = parseWeaponRange(weaponItem);

  let result;
  if (dist <= range.normal)     result = RANGE_RESULT.IN_RANGE;
  else if (!range.melee && dist <= range.long) result = RANGE_RESULT.LONG_RANGE;
  else                          result = RANGE_RESULT.OUT_OF_RANGE;

  return { result, distance: dist, range };
}

// ─────────────────────────────────────────────────────────────
//  LINE OF SIGHT
// ─────────────────────────────────────────────────────────────

/**
 * Test whether an attacker token has line of sight to a target.
 * Uses Foundry v13's `ClockwiseSweepPolygon` or the simpler
 * `testVisibility` API if available.
 *
 * Returns true if the attacker can see the target.
 */
export function hasLineOfSight(attackerToken, targetToken) {
  if (!attackerToken || !targetToken) return false;
  try {
    const walls = globalThis.canvas?.walls;
    if (typeof walls?.checkCollision !== "function") {
      console.warn("Role&Roll | Wall collision API unavailable; treating line of sight as blocked.");
      return false;
    }

    // Foundry v13 built-in visibility test
    const origin = { x: attackerToken.x + attackerToken.w / 2, y: attackerToken.y + attackerToken.h / 2 };
    const target = { x: targetToken.x + targetToken.w / 2,     y: targetToken.y + targetToken.h / 2 };

    // Check if walls block sight between the two points
    return !walls.checkCollision(
      new Ray(origin, target),
      { type: "sight", mode: "any" }
    );
  } catch (error) {
    console.warn("Role&Roll | Line-of-sight check failed; treating it as blocked.", error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
//  COVER
// ─────────────────────────────────────────────────────────────

/**
 * Cover tiers.
 *
 * These are deliberately *not* dnd5e's Half / Three-Quarters / Full ladder.
 * RnR only cares about how much a barrier is worth, so the tiers are named for
 * degree of protection and their bonuses come from the world settings
 * `coverPartialBonus` / `coverSubstantialBonus` / `coverTotalBonus`.
 *
 * The old design had two problems this removes:
 *   1. a hardcoded 999 sentinel meaning "cannot be targeted"
 *   2. three-quarter cover silently forcing disadvantage on every attack
 * Cover now only ever contributes a flat Reflex bonus, and the GM decides how
 * much that is.
 */
export const COVER_LEVEL = Object.freeze({
  NONE:       { key: "none",       label: "No Cover",      wallCount: 0 },
  PARTIAL:    { key: "partial",    label: "Partial Cover", wallCount: 1 },
  SUBSTANTIAL:{ key: "substantial", label: "Substantial Cover", wallCount: 2 },
  TOTAL:      { key: "total",      label: "Total Cover",   wallCount: 3 },
});

/** Resolve a cover tier to its configured Reflex bonus. */
function coverBonus(level) {
  const key = { partial: "coverPartialBonus", substantial: "coverSubstantialBonus", total: "coverTotalBonus" }[level.key];
  const fallback = { partial: 2, substantial: 4, total: 6 }[level.key] ?? 0;
  const raw = Number(globalThis.game?.settings?.get("RnR", key));
  return Number.isFinite(raw) ? raw : fallback;
}

/**
 * Simple cover estimation based on walls between attacker and target.
 * Uses Foundry wall collision count as a rough proxy.
 *
 * Returns a COVER_LEVEL entry.
 */
export function estimateCover(attackerToken, targetToken) {
  if (!attackerToken || !targetToken) return COVER_LEVEL.NONE;
  try {
    const origin = { x: attackerToken.x + attackerToken.w / 2, y: attackerToken.y + attackerToken.h / 2 };
    const target = { x: targetToken.x + targetToken.w / 2,     y: targetToken.y + targetToken.h / 2 };
    const ray    = new Ray(origin, target);

    const blockingWalls = canvas.walls.contents.filter(w => {
      if (!w.document.sight && !w.document.move) return false;
      return ray.intersectSegment(w.coords);
    });

    const count = blockingWalls.length;
    return count === 0 ? COVER_LEVEL.NONE
         : count === 1 ? COVER_LEVEL.PARTIAL
         : count === 2 ? COVER_LEVEL.SUBSTANTIAL
         :               COVER_LEVEL.TOTAL;
  } catch {
    return COVER_LEVEL.NONE;
  }
}

// ─────────────────────────────────────────────────────────────
//  FULL ATTACK FEASIBILITY CHECK
// ─────────────────────────────────────────────────────────────

/**
 * Runs range + LoS + cover checks and returns a summary object.
 *
 * Nothing here can force advantage or disadvantage any more. The result is a
 * set of *suggested* modifiers plus hard blockers (out of range / no LoS /
 * total cover) that the GM can override at the table.
 *
 * @param {Token} attackerToken
 * @param {Token} targetToken
 * @param {Item}  weaponItem
 * @returns {object} summary
 */
export function checkAttackFeasibility(attackerToken, targetToken, weaponItem) {
  const rangeCheck = checkRange(attackerToken, targetToken, weaponItem);
  const los        = hasLineOfSight(attackerToken, targetToken);
  const cover      = estimateCover(attackerToken, targetToken);

  const canAttack  = rangeCheck.result !== RANGE_RESULT.OUT_OF_RANGE
    && rangeCheck.result !== RANGE_RESULT.NO_TARGET
    && los
    && cover !== COVER_LEVEL.TOTAL;

  // Flat modifiers handed back to the caller instead of a forced roll mode.
  const modifiers = [];
  if (rangeCheck.result === RANGE_RESULT.LONG_RANGE) {
    const p = Number(globalThis.game?.settings?.get("RnR", "longRangePenalty"));
    if (Number.isFinite(p) && p !== 0) modifiers.push({ label: "Long range", value: p });
  }
  if (cover !== COVER_LEVEL.NONE) {
    const b = coverBonus(cover);
    if (b !== 0) modifiers.push({ label: cover.label, value: b });
  }

  const blockers = [];
  if (!los) blockers.push("No line of sight");
  if (cover === COVER_LEVEL.TOTAL) blockers.push(cover.label);

  return {
    canAttack,
    rangeCheck,
    los,
    cover,
    coverBonus: cover === COVER_LEVEL.NONE ? 0 : coverBonus(cover),
    modifiers,
    blockerReasons: blockers,
  };
}

// ─────────────────────────────────────────────────────────────
//  HUMAN-READABLE SUMMARY (for chat card or warning)
// ─────────────────────────────────────────────────────────────

export function attackFeasibilitySummary(check, weaponItem) {
  const lines = [];
  const d     = Math.round(check.rangeCheck.distance);
  const norm  = check.rangeCheck.range.normal;
  const long  = check.rangeCheck.range.long;

  switch (check.rangeCheck.result) {
    case RANGE_RESULT.IN_RANGE:
      lines.push(`✓ In range (${d} ft / max ${norm} ft)`);
      break;
    case RANGE_RESULT.LONG_RANGE: {
      const p = Number(globalThis.game?.settings?.get("RnR", "longRangePenalty"));
      const tail = Number.isFinite(p) && p !== 0 ? ` — ${p > 0 ? "+" : ""}${p}` : "";
      lines.push(`⚠ Long range (${d} ft — normal ${norm} ft, max ${long} ft)${tail}`);
      break;
    }
    case RANGE_RESULT.OUT_OF_RANGE:
      lines.push(`✗ Out of range (${d} ft — max ${long} ft)`);
      break;
  }

  if (!check.los) lines.push("✗ No line of sight");
  if (check.cover !== COVER_LEVEL.NONE)
    lines.push(`⚠ ${check.cover.label} (+${check.coverBonus} Reflex)`);

  return lines.join("<br>");
}
