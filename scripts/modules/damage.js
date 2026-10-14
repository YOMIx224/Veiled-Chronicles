// =============================================================
//  RnR — damage.js
//  Damage application: Resistance / Immunity / Vulnerability
//  per damage type + chat card Apply buttons + multi-target
// =============================================================

import { getRnRFlag, setRnRFlag } from "./flags.js";

// Known damage types (used in UI dropdowns)
export const DAMAGE_TYPES = [
  "physical", "bludgeoning", "slashing", "piercing",
  "fire", "cold", "lightning", "acid", "poison", "necrotic",
  "radiant", "psychic", "force", "thunder", "healing",
];

// ─────────────────────────────────────────────────────────────
//  MULTIPLIER
// ─────────────────────────────────────────────────────────────

/**
 * Returns the damage multiplier for a given actor and damage type.
 *   Immunity      → 0
 *   Vulnerability → 2
 *   Resistance    → 0.5
 *   Otherwise     → 1
 *
 * Values are stored as comma/semicolon-separated strings in
 *   system.defenses.immunity / .vulnerability / .resistance
 * e.g. "fire, cold; lightning"
 */
export function damageMultiplier(actor, damageType = "") {
  const type = String(damageType ?? "").toLowerCase().trim();
  if (!type) return 1;

  const parseList = (path) =>
    String(foundry.utils.getProperty(actor, path) ?? "")
      .toLowerCase()
      .split(/[,;\/\s]+/)
      .map(v => v.trim())
      .filter(Boolean);

  const immunity      = parseList("system.defenses.immunity");
  const vulnerability = parseList("system.defenses.vulnerability");
  const resistance    = parseList("system.defenses.resistance");

  // "all" keyword covers every type
  if (immunity.includes("all")      || immunity.includes(type))      return 0;
  if (vulnerability.includes("all") || vulnerability.includes(type)) return 2;
  if (resistance.includes("all")    || resistance.includes(type))    return 0.5;
  return 1;
}

/**
 * Collect the Actor's authored damage-dice fragment plus each active effect's
 * contribution. Read the authored value from `_source` because `actor.system`
 * is already prepared with active effects and would otherwise duplicate the
 * last SET effect when stacking multiple dice bonuses.
 */
export function collectDamageDiceFragments(actor) {
  if (!actor) return [];
  const authored = foundry.utils.getProperty(actor._source ?? actor, "system.mods.damage");
  const fragments = [authored];
  for (const effect of actor.effects?.contents ?? []) {
    if (effect.disabled || effect.isSuppressed) continue;
    for (const change of effect.changes ?? []) {
      if (change.key === "system.mods.damage") fragments.push(change.value);
    }
  }
  return fragments
    .filter(value => value !== undefined && value !== null && String(value).trim())
    .map(value => String(value).trim());
}

/**
 * Flat reduction from the Actor's prepared defense value and equipped armor.
 * Foundry has already applied Active Effects to actor.system, so do not sum
 * their changes again here.
 */
export function armorDamageReduction(actor) {
  const actorReduction = Number(foundry.utils.getProperty(actor, "system.defenses.armorDamageReduction")) || 0;
  const equipped = actor.items?.contents ?? actor.items?.toArray?.() ?? [];
  const itemReduction = equipped.reduce((total, item) => {
    if (!item.system?.equipmentSlot) return total;
    if (!["armor", "equipment"].includes(item.type)) return total;
    return total + (Number(item.system?.armorValue) || 0);
  }, 0);
  return Math.max(0, actorReduction + itemReduction);
}

// ─────────────────────────────────────────────────────────────
//  APPLY DAMAGE
// ─────────────────────────────────────────────────────────────

/**
 * Apply damage to an actor, respecting Resistance / Immunity /
 * Vulnerability. Returns a result object for logging.
 *
 * @param {Actor}  actor
 * @param {number} amount       raw damage before multiplier
 * @param {string} damageType   e.g. "fire"
 * @param {object} [opts]
 * @param {boolean} opts.healing  if true, adds HP instead of subtracting
 */
export async function applyDamage(actor, amount, damageType = "", { healing = false, multiplier = null } = {}) {
  if (!actor) return null;

  // Permission check — only the owning player or GM may modify HP
  if (!actor.isOwner && !game.user?.isGM) {
    ui.notifications.warn(`You do not have permission to modify ${actor.name}'s HP.`);
    return null;
  }

  const raw = Math.max(0, Number(amount) || 0);
  const reduction = healing ? 0 : armorDamageReduction(actor);
  const afterArmor = healing ? raw : Math.max(0, raw - reduction);

  let baseMult = healing ? 1 : damageMultiplier(actor, damageType);
  const mult = (!healing && multiplier !== null) ? (baseMult * multiplier) : baseMult;

  const final = Math.floor(afterArmor * mult);

  const hpMax  = Number(foundry.utils.getProperty(actor, "system.vitals.health.max"))   || 0;
  const hpCur  = Number(foundry.utils.getProperty(actor, "system.vitals.health.value")) || 0;
  const newHp  = healing
    ? Math.min(hpMax,  hpCur + final)
    : Math.max(0,      hpCur - final);

  await actor.update({ "system.vitals.health.value": newHp });

  // Announce the result through a hook rather than importing the down/recovery
  // helpers, which live in RnR.js and would create an import cycle.
  Hooks.callAll("rnrDamageApplied", actor, { newHp, hpMax, healing, delta: healing ? final : -final });

  // Show the exact HP change above every active token for this actor.
  const delta = healing ? final : -final;
  if (delta !== 0) {
    const tokens = actor.getActiveTokens?.(true, true) ?? [];
    for (const token of tokens) {
      try {
        if (typeof token.showFloatingText === "function") {
          await token.showFloatingText(`${delta > 0 ? "+" : ""}${delta}`, { type: healing ? "healing" : "damage" });
        } else if (canvas.interface?.createScrollingText) {
          const anchorTop = globalThis.CONST?.TEXT_ANCHOR_POINTS?.TOP;
          canvas.interface.createScrollingText(token.center, `${delta > 0 ? "+" : ""}${delta}`, {
            ...(anchorTop === undefined ? {} : { anchor: anchorTop }),
            distance: 20,
          });
        }
      } catch (error) {
        console.debug("RnR | Could not display HP change", error);
      }
    }
  }

  return {
    raw,           // original amount
    armorReduction: reduction,
    afterArmor,
    multiplier: mult,
    final,         // after resistance/vuln
    hpBefore: hpCur,
    hpAfter:  newHp,
    hpMax,
    type: damageType,
    healing,
    immune: mult === 0,
    resistant: mult < 1 && mult > 0,
    vulnerable: mult > 1,
  };
}

// ─────────────────────────────────────────────────────────────
//  APPLY DAMAGE TO SELECTED / TARGETED TOKENS
// ─────────────────────────────────────────────────────────────

const TARGET_APPLICATIONS_FLAG = "damageApplications";

function readTargetApplications(actor) {
  return getRnRFlag(actor, TARGET_APPLICATIONS_FLAG) ?? {};
}

async function writeTargetApplications(actor, applications) {
  if (typeof actor.update === "function") {
    await setRnRFlag(actor, TARGET_APPLICATIONS_FLAG, applications);
    return;
  }
  actor.flags ??= {};
  actor.flags.RnR = { ...(actor.flags.RnR ?? {}), [TARGET_APPLICATIONS_FLAG]: applications };
}

async function claimTargetApplication(actor, messageId, action) {
  const applications = readTargetApplications(actor);
  const current = applications[messageId];
  if (["processing", "applied", "review"].includes(current?.status)) return null;

  const claim = {
    id: foundry.utils.randomID(),
    status: "processing",
    action,
    userId: game.user.id,
    startedAt: Date.now(),
  };
  await writeTargetApplications(actor, { ...applications, [messageId]: claim });

  // Confirm the target Actor owns the claim before changing HP. The Actor flag
  // is writable by its owner/GM, unlike a ChatMessage authored by another user.
  const latest = readTargetApplications(actor)[messageId];
  return latest?.id === claim.id ? claim : null;
}

async function finishTargetApplication(actor, messageId, claim, status) {
  const applications = readTargetApplications(actor);
  const current = applications[messageId];
  if (current?.id !== claim.id) return;
  await writeTargetApplications(actor, {
    ...applications,
    [messageId]: { ...claim, status, finishedAt: Date.now() },
  });
}

/**
 * Apply damage to currently targeted tokens (or controlled tokens if none are
 * targeted). A Chat Card's sourceMessageId is recorded per target Actor so each
 * Actor owner or GM can apply the same roll once without editing another user's
 * ChatMessage. The Actor's ownership check remains authoritative.
 *
 * @param {number} amount
 * @param {string} damageType
 * @param {object} [opts] { healing: bool, sourceMessageId?: string, action?: string, targetActorIds?: string[] }
 * @returns {Promise<object[]>} array of successful result objects
 */
export async function applyDamageToTargets(amount, damageType = "", opts = {}) {
  const { sourceMessageId = "", action = "apply-damage", targetActorIds, ...damageOptions } = opts;
  let targets = [];
  if (Array.isArray(targetActorIds) && targetActorIds.length) {
    const resolveActor = id => game.actors?.get?.(id)
      ?? (canvas.tokens?.placeables ?? []).find(token => token.actor?.id === id)?.actor
      ?? null;
    targets = targetActorIds.map(resolveActor).filter(Boolean);
    if (!targets.length) {
      ui.notifications.warn("The target Actor is no longer available in this World or Scene.");
      return [];
    }
  } else {
    targets = [...(game.user.targets ?? [])].map(t => t.actor).filter(Boolean);
  }
  if (!targets.length) {
    // Fallback to controlled tokens
    const controlled = canvas.tokens?.controlled?.map(t => t.actor).filter(Boolean) ?? [];
    if (!controlled.length) {
      ui.notifications.warn("No targets selected. Target or control a Token first.");
      return [];
    }
    targets.push(...controlled);
  }

  const results = [];
  const uniqueTargets = [...new Map(targets.map(actor => [actor.uuid ?? actor.id, actor])).values()];
  for (const actor of uniqueTargets) {
    if (!actor.isOwner && !game.user?.isGM) {
      ui.notifications.warn(`You do not have permission to modify ${actor.name}'s HP.`);
      continue;
    }

    const claim = sourceMessageId ? await claimTargetApplication(actor, sourceMessageId, action) : null;
    if (sourceMessageId && !claim) {
      ui.notifications.warn(`${actor.name}: this Chat Card action is already applied or being processed.`);
      continue;
    }

    try {
      const result = await applyDamage(actor, amount, damageType, damageOptions);
      if (claim) await finishTargetApplication(actor, sourceMessageId, claim, result ? "applied" : "ready");
      if (result) results.push({ actor, ...result });
    } catch (error) {
      if (claim) {
        try {
          await finishTargetApplication(actor, sourceMessageId, claim, "review");
        } catch (stateError) {
          console.error("Role&Roll | Could not update the target damage lock", stateError);
        }
      }
      throw error;
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────
//  BUILD DAMAGE RESULT LINES (for chat card detail)
// ─────────────────────────────────────────────────────────────

export function buildDamageResultLines(results) {
  return results.map(r => {
    let tag = "";
    if (r.immune)     tag = `<span class="rnr-dmg-tag immune">IMMUNE</span>`;
    else if (r.resistant)  tag = `<span class="rnr-dmg-tag resist">RESIST (×½)</span>`;
    else if (r.vulnerable) tag = `<span class="rnr-dmg-tag vuln">VULN (×2)</span>`;
    const armor = r.armorReduction ? ` · Armor DR −${r.armorReduction}` : "";
    return `${r.actor.name}: <strong>${r.final}</strong> ${r.type || "dmg"}${armor}${tag} → HP ${r.hpAfter}/${r.hpMax}`;
  }).join("<br>");
}
