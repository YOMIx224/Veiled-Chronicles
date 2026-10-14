// =============================================================
//  RnR — progression.js
//  Level & Experience, plus Class/Race/Background bonuses
// =============================================================

// Experience needed to leave `level` and reach the next one. The cost grows with
// every level, so levelling stays an event instead of a formality.
export const XP_PER_LEVEL = 300;

/** Health granted by every level gained. */
export const HP_PER_LEVEL = 2;

/**
 * Willpower is a half-rate track: +1 for every second level.
 * Comparing `Math.floor(level / 2)` across two levels is what makes that work
 * without a counter that can drift out of step with the level itself.
 */
export const WILLPOWER_PER_LEVELS = 2;

const getProp = (doc, path) => (globalThis.foundry?.utils?.getProperty
  ? foundry.utils.getProperty(doc, path)
  : String(path).split(".").reduce((o, k) => (o == null ? o : o[k]), doc));

/** Experience required to advance from `level` to `level + 1`. */
export function experienceForNextLevel(level) {
  const value = Math.trunc(Number(level));
  return (Number.isFinite(value) && value >= 1 ? value : 1) * XP_PER_LEVEL;
}

/** Total experience an actor needs to have banked to be exactly at `level`. */
export function experienceTotalForLevel(level) {
  let total = 0;
  for (let l = 1; l < level; l++) total += experienceForNextLevel(l);
  return total;
}

/** Read an actor's progression, repaired to the legal range. */
export function progressionSnapshot(actor) {
  const level = Math.trunc(Number(getProp(actor, "system.progression.level")));
  const experience = Math.trunc(Number(getProp(actor, "system.progression.experience")));
  return {
    level: Number.isFinite(level) && level >= 1 ? level : 1,
    experience: Number.isFinite(experience) && experience >= 0 ? experience : 0,
  };
}

/** Sheet-facing view: level, banked XP, next threshold, and a 0-100 percentage. */
export function progressionView(actor) {
  const { level, experience } = progressionSnapshot(actor);
  const next = experienceForNextLevel(level);
  return {
    level,
    experience,
    experienceNext: next,
    // A level that starts already over its threshold would render a bar past
    // 100%, so it is clamped rather than trusted.
    experienceProgress: Math.min(100, Math.max(0, Math.round((experience / next) * 100))),
  };
}

/**
 * Award experience, rolling over as many levels as the amount covers.
 *
 * A single grant can cross several thresholds (700 XP at level 1 is two levels
 * and a bit), so this loops instead of only stepping once. Every consequence -
 * level, banked XP, Health max, Willpower max - is computed first and then
 * written in a single `actor.update`, which is what stops the sheet from
 * bouncing between intermediate states or re-entering this function.
 *
 * @param {Actor} actor
 * @param {number} amount  may be negative to claw XP back
 * @returns {Promise<{level:number, experience:number, experienceNext:number,
 *                    levelsGained:number, healthGained:number, willpowerGained:number}>}
 */
export async function addExperience(actor, amount = 1) {
  const delta = Math.trunc(Number(amount));
  if (!actor || !Number.isFinite(delta) || delta === 0) {
    const view = actor ? progressionView(actor) : null;
    return view ? { ...view, levelsGained: 0, healthGained: 0, willpowerGained: 0 } : null;
  }

  const { level: fromLevel, experience: fromExp } = progressionSnapshot(actor);
  let level = fromLevel;
  let experience = fromExp + delta;

  // Level up while there is enough in the bank. The threshold is read from the
  // level being left, so the cost of each step is the cost of that level.
  while (experience >= experienceForNextLevel(level)) {
    experience -= experienceForNextLevel(level);
    level += 1;
  }
  // A negative award drains the bank first, and only starts taking levels away
  // once the bank is empty. Clawing back the XP of an already-earned level is
  // how a GM reverses a mistake or a character is de-powered, so the level
  // itself has to come back down with the XP - otherwise the level shown and the
  // banked XP would disagree with each other.
  while (experience < 0 && level > 1) {
    const cost = experienceForNextLevel(level - 1);
    experience += cost;
    level -= 1;
  }
  // Level 1 is the floor: there is nothing below it to give back, so any
  // remainder below zero is discarded rather than carried as debt.
  if (experience < 0) experience = 0;

  const levelsGained = level - fromLevel;

  const updates = { "system.progression": { level, experience } };
  const { healthGained, willpowerGained } = applyLevelGrowth(actor, fromLevel, level, updates);

  await actor.update(updates);

  return {
    level,
    experience,
    experienceNext: experienceForNextLevel(level),
    levelsGained,
    healthGained,
    willpowerGained,
  };
}

/**
 * Shift Health max and Willpower max for a change of level, writing into the
 * `updates` object the caller will pass to a single `actor.update`.
 *
 * Growth is applied as a difference rather than recomputed from the level, and
 * that is the whole point. A character's real maximum carries bonuses granted by
 * their race, background and class (`applyRaceBonus` and friends add to it), so
 * setting the maximum to `level * 2` would silently delete those bonuses the
 * moment a GM typed a level into the sheet. Adding the same delta `addExperience`
 * adds keeps every source of the maximum intact, and makes the two entry points
 * agree on what a level is worth.
 *
 * A decrease also pulls the current value down with the new maximum, but only as
 * far as it needs to: a character already at full health loses the health, while
 * a wounded one keeps their wounds. A level up never heals.
 *
 * @param {Actor} actor
 * @param {number} fromLevel
 * @param {number} toLevel
 * @param {object} updates  mutated in place
 * @returns {{healthGained:number, willpowerGained:number}}
 */
function applyLevelGrowth(actor, fromLevel, toLevel, updates) {
  // One level = 2 Health. Willpower moves every second level, so the count is
  // the difference between the two halvings rather than a running tally.
  const healthGained = (toLevel - fromLevel) * HP_PER_LEVEL;
  const willpowerGained = Math.floor(toLevel / WILLPOWER_PER_LEVELS) - Math.floor(fromLevel / WILLPOWER_PER_LEVELS);

  if (healthGained) {
    const max = Math.max(0, Number(getProp(actor, "system.vitals.health.max")) || 0);
    const nextMax = Math.max(0, max + healthGained);
    updates["system.vitals.health.max"] = nextMax;
    // Losing a level shrinks the maximum. A character that was already at full
    // health has to lose the same amount, otherwise they would be left
    // over-healed and the sheet would show more current than maximum.
    if (healthGained < 0) {
      const current = Math.max(0, Number(getProp(actor, "system.vitals.health.value")) || 0);
      updates["system.vitals.health.value"] = Math.min(current, nextMax);
    }
  }
  if (willpowerGained) {
    const max = Math.max(0, Number(getProp(actor, "system.vitals.willPower.max")) || 0);
    const nextMax = Math.max(0, max + willpowerGained);
    updates["system.vitals.willPower.max"] = nextMax;
    if (willpowerGained < 0) {
      const current = Math.max(0, Number(getProp(actor, "system.vitals.willPower.value")) || 0);
      updates["system.vitals.willPower.value"] = Math.min(current, nextMax);
    }
  }

  return { healthGained, willpowerGained };
}

/**
 * Set an actor's level outright, keeping Health max and Willpower max in step.
 *
 * The sheet's LEVEL box is editable, so a GM can put a character at any level
 * without having to hand out the exact amount of experience that level costs.
 * Banked XP is left alone: it was earned, and discarding it because someone
 * corrected the level by hand would throw away progress the character keeps.
 *
 * The maxima move by the same per-level difference `addExperience` applies rather
 * than being recomputed from the level, so race, background and class bonuses on
 * the maximums survive a manual level change.
 *
 * A decrease never takes a character below 1, and both maxima are floored at 0.
 * Current Health and Willpower are pulled down only when they exceed the new
 * maximum - a wounded character keeps their wounds, and the current values are
 * never raised to fill the space a new level opens up.
 *
 * @param {Actor} actor
 * @param {number} level
 * @returns {Promise<{level:number, healthMax:number, willpowerMax:number}>}
 */
export async function setProgressionLevel(actor, level) {
  const target = Math.max(1, Math.trunc(Number(level)) || 1);
  const { level: fromLevel, experience } = progressionSnapshot(actor);

  const updates = {
    "system.progression.level":      target,
    "system.progression.experience": experience,
  };
  applyLevelGrowth(actor, fromLevel, target, updates);

  const healthMax = updates["system.vitals.health.max"]
    ?? Math.max(0, Number(getProp(actor, "system.vitals.health.max")) || 0);
  const willpowerMax = updates["system.vitals.willPower.max"]
    ?? Math.max(0, Number(getProp(actor, "system.vitals.willPower.max")) || 0);

  await actor.update(updates);
  return { level: target, healthMax, willpowerMax, previousLevel: fromLevel };
}

// ─────────────────────────────────────────────────────────────
//  GROWTH POINTS
// ─────────────────────────────────────────────────────────────

/**
 * Award Growth Points to an actor.
 *
 * @param {Actor} actor
 * @param {number} points
 * @returns {Promise<number>} New total growth points
 */
export async function addGrowthPoints(actor, points = 1) {
  const cur = Math.max(0, Number(foundry.utils.getProperty(actor, "system.identity.growthPoints")) || 0);
  const next = cur + Math.max(0, Number(points) || 0);
  await actor.update({ "system.identity.growthPoints": next });
  return next;
}

// ─────────────────────────────────────────────────────────────
//  CLASS / RACE / BACKGROUND — apply bonuses to Actor
// ─────────────────────────────────────────────────────────────

/**
 * Apply bonuses from a Race item to an actor.
 * - abilityScoreIncrease: { strength: 1, dexterity: 2, … }
 * - speed: replaces base speed
 * - languages: appended
 * Tracks applied bonuses in system.appliedBonuses.race so they can be removed.
 *
 * Note: `system.attributeBonus` (a plain number) belongs to WORN equipment and
 * is handled by buildData(); races use the `abilityScoreIncrease` object.
 *
 * @param {Actor} actor
 * @param {Item}  raceItem
 */
export async function applyRaceBonus(actor, raceItem) {
  const sys     = raceItem.system ?? {};
  const updates = {};

  // Remove old race bonuses first
  await removeRaceBonus(actor);

  const attrBonus = sys.abilityScoreIncrease ?? {};
  for (const [attr, bonus] of Object.entries(attrBonus)) {
    if (!Number.isFinite(Number(bonus)) || bonus === 0) continue;
    const cur = Number(foundry.utils.getProperty(actor, `system.attributes.${attr}.value`)) || 8;
    updates[`system.attributes.${attr}.value`] = cur + Number(bonus);
  }

  if (sys.speed && sys.speed !== 30) {
    updates["system.defenses.speed"] = Number(sys.speed) || 30;
  }

  // Record what was applied
  updates["system.appliedBonuses.race"] = {
    itemId:      raceItem.id,
    name:        raceItem.name,
    attrBonus,
    speed:       sys.speed ?? 30,
  };

  if (Object.keys(updates).length) await actor.update(updates);
}

export async function removeRaceBonus(actor) {
  const applied = foundry.utils.getProperty(actor, "system.appliedBonuses.race");
  if (!applied?.itemId) return;

  const updates = {};
  const attrBonus = applied.attrBonus ?? {};
  for (const [attr, bonus] of Object.entries(attrBonus)) {
    if (!Number.isFinite(Number(bonus)) || bonus === 0) continue;
    const cur = Number(foundry.utils.getProperty(actor, `system.attributes.${attr}.value`)) || 8;
    updates[`system.attributes.${attr}.value`] = cur - Number(bonus);
  }
  updates["system.appliedBonuses.race"] = null;
  if (Object.keys(updates).length) await actor.update(updates);
}

/**
 * Apply bonuses from a Background item.
 * - benefit: text only (stored, no mechanical effect unless GM sets)
 * - skills: array of skill keys given +1 bonus
 */
export async function applyBackgroundBonus(actor, bgItem) {
  await removeBackgroundBonus(actor);
  const sys = bgItem.system ?? {};
  const updates = {};

  const skillKeys = Array.isArray(sys.skills) ? sys.skills : [];
  for (const key of skillKeys) {
    const cur = Number(foundry.utils.getProperty(actor, `system.skills.${key}.value`)) || 0;
    updates[`system.skills.${key}.value`] = cur + 1;
  }

  updates["system.appliedBonuses.background"] = {
    itemId: bgItem.id,
    name:   bgItem.name,
    skills: skillKeys,
  };

  if (Object.keys(updates).length) await actor.update(updates);
}

export async function removeBackgroundBonus(actor) {
  const applied = foundry.utils.getProperty(actor, "system.appliedBonuses.background");
  if (!applied?.itemId) return;

  const updates = {};
  for (const key of (applied.skills ?? [])) {
    const cur = Number(foundry.utils.getProperty(actor, `system.skills.${key}.value`)) || 0;
    updates[`system.skills.${key}.value`] = Math.max(0, cur - 1);
  }
  updates["system.appliedBonuses.background"] = null;
  if (Object.keys(updates).length) await actor.update(updates);
}

/**
 * Apply bonuses from a Class item (stored as text features for now —
 * actual mechanical unlocks are done via Active Effects or manual GM entry).
 */
export async function applyClassBonus(actor, classItem) {
  await removeClassBonus(actor);
  const updates = {
    "system.appliedBonuses.class": {
      itemId: classItem.id,
      name:   classItem.name,
      role:   classItem.system?.role ?? "",
      hitDie: classItem.system?.hitDie ?? "1d8",
    },
  };
  await actor.update(updates);
}

export async function removeClassBonus(actor) {
  const applied = foundry.utils.getProperty(actor, "system.appliedBonuses.class");
  if (!applied?.itemId) return;
  await actor.update({ "system.appliedBonuses.class": null });
}
