// =============================================================
//  RnR — chatcard.js
//  Builds rich chat cards for Attack / Damage / Ability rolls.
//  Handles "Apply Damage" and "Apply Healing" buttons that:
//    • respect Resistance / Immunity / Vulnerability
//    • work with targeted or controlled tokens
//    • prevent double-application
//    • show full breakdown in card
// =============================================================

import { checkAttackFeasibility, attackFeasibilitySummary } from "./targeting.js";
import { applyDamageToTargets } from "./damage.js";
import { getRnRFlag } from "./flags.js";

// ─────────────────────────────────────────────────────────────
//  CARD TEMPLATE HELPER
// ─────────────────────────────────────────────────────────────

function actorImg(actor) {
  return actor?.img ?? "icons/svg/mystery-man.svg";
}

function cardClass(isCrit, isFail) {
  if (isCrit) return "rnr-card-crit";
  if (isFail) return "rnr-card-fail";
  return "";
}

function d20Badge(value) {
  const cls = value === 20 ? "crit" : value === 1 ? "fail" : "";
  return `<span class="rnr-card-d20 ${cls}">${value}</span>`;
}

function modeTag(mode) {
  if (mode === "advantage")    return `<span class="rnr-card-mode adv">ADV</span>`;
  if (mode === "disadvantage") return `<span class="rnr-card-mode dis">DIS</span>`;
  return "";
}

// ─────────────────────────────────────────────────────────────
//  ROLL RESULT EXTRACTION
// ─────────────────────────────────────────────────────────────

function resolveRolls(roll1, roll2, mode) {
  const d1  = roll1.dice[0]?.results[0]?.result ?? roll1.total;
  const d2  = roll2 ? (roll2.dice[0]?.results[0]?.result ?? roll2.total) : null;

  let kept = d1, dropped = null, finalRoll = roll1;
  if (d2 !== null) {
    if (mode === "advantage") {
      if (d2 > d1) { kept = d2; dropped = d1; finalRoll = roll2; }
      else         { kept = d1; dropped = d2; }
    } else {
      if (d2 < d1) { kept = d2; dropped = d1; finalRoll = roll2; }
      else         { kept = d1; dropped = d2; }
    }
  }
  return { kept, dropped, finalRoll, isCrit: kept === 20, isFail: kept === 1 };
}

// ─────────────────────────────────────────────────────────────
//  ATTACK ROLL CARD
// ─────────────────────────────────────────────────────────────

/**
 * Send an attack roll card with optional range/LoS info and
 * a "Roll Damage" button that posts a follow-up card.
 *
 * @param {object} opts
 *   actor, item, roll1, roll2?, mode, attackerToken?, targetToken?
 */
export async function sendAttackCard({ actor, item, roll1, roll2 = null, mode = "normal", attackerToken = null, targetToken = null }) {
  const { kept, dropped, finalRoll, isCrit, isFail } = resolveRolls(roll1, roll2, mode);

  const totalMod = finalRoll.total - kept;   // modifier = total − d20 result
  const modStr   = totalMod >= 0 ? `+${totalMod}` : `${totalMod}`;

  // Range / LoS info
  let rangeHtml = "";
  if (attackerToken && targetToken && item) {
    const check = checkAttackFeasibility(attackerToken, targetToken, item);
    rangeHtml = `<div class="rnr-card-range">${attackFeasibilitySummary(check, item)}</div>`;
  }

  // Target display
  const targetName = targetToken?.actor?.name ?? (game.user.targets.size ? [...game.user.targets][0]?.actor?.name : "");
  const targetLine = targetName ? `<div class="rnr-card-target">🎯 ${targetName}</div>` : "";

  // Critical damage formula (double dice)
  const dmgFormula = item?.system?.damageFormula?.trim() || "1d6";
  const dmgType    = item?.system?.damageType    ?? "";
  const dmgBonus   = Number(item?.system?.damageBonus) || 0;
  const bonusStr   = dmgBonus !== 0 ? (dmgBonus > 0 ? `+${dmgBonus}` : `${dmgBonus}`) : "";
  const critDmgFormula = isCrit
    ? `${dmgFormula}+${dmgFormula}${bonusStr}`
    : `${dmgFormula}${bonusStr}`;

  const dmgDataAttr = `data-damage-formula="${critDmgFormula}" data-damage-type="${dmgType}"`;

  const html = `
<div class="rnr-chat-card ${cardClass(isCrit, isFail)}">
  <div class="rnr-card-header">
    <img src="${actorImg(actor)}" />
    <div>
      <strong>${actor.name}</strong>
      <span>⚔ Attack — ${item?.name ?? "Attack"}</span>
    </div>
    ${modeTag(mode)}
  </div>
  ${targetLine}
  ${rangeHtml}
  <div class="rnr-card-dice">
    ${d20Badge(kept)}
    ${dropped !== null ? `<span class="rnr-card-d20 dropped">${dropped}</span>` : ""}
    <span class="rnr-card-total">${finalRoll.total} <small>(${modStr})</small></span>
    ${isCrit ? `<span class="rnr-card-label crit">CRITICAL!</span>` : ""}
    ${isFail ? `<span class="rnr-card-label fail">FUMBLE</span>`    : ""}
  </div>
  <div class="rnr-card-actions">
    <button type="button" class="rnr-card-btn" data-action="roll-damage" ${dmgDataAttr}
      data-actor-id="${actor.id}">
      💥 Roll Damage${isCrit ? " (Critical)" : ""}
    </button>
  </div>
</div>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html,
    rolls:   [finalRoll],
  });
}

// ─────────────────────────────────────────────────────────────
//  DAMAGE CARD
// ─────────────────────────────────────────────────────────────

/**
 * Send a damage card after damage has already been resolved by the attack flow.
 *
 * @param {object} opts
 *   actor, itemName, dmgRoll, damageType
 */
export async function sendDamageCard({ actor, itemName = "Damage", dmgRoll, damageType = "" }) {
  const total = dmgRoll.total;
  const formula = dmgRoll.formula ?? "";

  const html = `
<div class="rnr-chat-card">
  <div class="rnr-card-header">
    <img src="${actorImg(actor)}" />
    <div>
      <strong>${actor.name}</strong>
      <span>💥 Damage — ${itemName}</span>
      ${damageType ? `<em>${damageType}</em>` : ""}
    </div>
  </div>
  <div class="rnr-card-dice">
    <span class="rnr-card-total">${total}</span>
    <span class="rnr-card-formula">${formula}</span>
  </div>
  <div class="rnr-card-detail"><strong>Damage applied automatically.</strong> HP is reduced when the attack hits.</div>
</div>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html,
    rolls:   [dmgRoll],
  });
}

// ─────────────────────────────────────────────────────────────
//  GENERAL ROLL CARD (attribute / skill / save)
// ─────────────────────────────────────────────────────────────

export async function sendRollCard({ actor, title, subtitle = "", roll1, roll2 = null, mode = "normal", detail = "" }) {
  const { kept, dropped, finalRoll, isCrit, isFail } = resolveRolls(roll1, roll2, mode);

  const html = `
<div class="rnr-chat-card ${cardClass(isCrit, isFail)}">
  <div class="rnr-card-header">
    <img src="${actorImg(actor)}" />
    <div>
      <strong>${actor.name}</strong>
      <span>${title}</span>
      ${subtitle ? `<em>${subtitle}</em>` : ""}
    </div>
    ${modeTag(mode)}
  </div>
  <div class="rnr-card-dice">
    ${d20Badge(kept)}
    ${dropped !== null ? `<span class="rnr-card-d20 dropped">${dropped}</span>` : ""}
    <span class="rnr-card-total">${finalRoll.total}</span>
    ${isCrit ? `<span class="rnr-card-label crit">CRITICAL!</span>` : ""}
    ${isFail ? `<span class="rnr-card-label fail">FUMBLE</span>`    : ""}
  </div>
  ${detail ? `<div class="rnr-card-detail">${detail}</div>` : ""}
</div>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html,
    rolls:   [finalRoll],
  });
}

// ─────────────────────────────────────────────────────────────
//  renderChatMessage HOOK HANDLER
//  — wires up Attack / Damage / Heal / Apply buttons
// ─────────────────────────────────────────────────────────────

/** Resolve the actor + item a card button refers to. */
function buttonTarget(btn, message = null) {
  let actor = btn.dataset.actorId ? game.actors.get(btn.dataset.actorId) : null;
  if (!actor && message?.speaker?.scene && message?.speaker?.token) {
    actor = game.scenes.get(message.speaker.scene)?.tokens.get(message.speaker.token)?.actor ?? null;
  }
  if (!actor && btn.dataset.actorId) {
    actor = (canvas.tokens?.placeables ?? []).find(token => token.actor?.id === btn.dataset.actorId)?.actor ?? null;
  }
  const item  = actor?.items?.get(btn.dataset.itemId) ?? null;
  return { actor, item };
}

function canUseActorAction(button, actor, actionLabel) {
  if (game.user?.isGM) return true;
  const allowedUserId = button?.dataset?.allowedUserId;
  if (allowedUserId && allowedUserId !== game.user?.id) {
    ui.notifications.warn(`Only the designated player can ${actionLabel}.`);
    return false;
  }
  if (!actor?.isOwner) {
    ui.notifications.warn(`You do not own this Actor and cannot ${actionLabel}.`);
    return false;
  }
  return true;
}

function reportCardError(label, error) {
  console.error(`Role&Roll | Chat Card ${label} failed`, error);
  ui.notifications.error(`Chat Card ${label} failed. Check the console for details.`);
}

const APPLY_ACTION_SELECTOR = "[data-action='apply-damage'], [data-action='apply-half-damage'], [data-action='apply-healing']";

function legacyApplyActionState(message) {
  return getRnRFlag(message, "damageApplication") ?? null;
}

function setApplyButtonsDisabled(root, disabled, title = "") {
  root?.querySelectorAll?.(APPLY_ACTION_SELECTOR).forEach(button => {
    button.disabled = disabled;
    if (title) button.title = title;
    else if (!disabled) button.removeAttribute?.("title");
  });
}

async function executeApplyAction({ message, root, button, action, resolveAmount, damageType = "", options = {}, onSuccess }) {
  if (button.disabled || button.dataset.rnrApplying === "true") return;
  button.dataset.rnrApplying = "true";
  setApplyButtonsDisabled(root, true, "Applying the Chat Card result…");

  let allowRetry = false;
  try {
    const legacyState = legacyApplyActionState(message);
    if (["processing", "applied", "review"].includes(legacyState?.status)) {
      ui.notifications.warn("This older Damage/Healing card was already applied or is waiting for GM review.");
      return;
    }

    const amount = await resolveAmount();
    const results = await applyDamageToTargets(amount, damageType, {
      ...options,
      sourceMessageId: message?.id ?? "",
      action,
      targetActorIds: button.dataset.targetActorId ? [button.dataset.targetActorId] : undefined,
    });
    if (!results?.length) {
      allowRetry = true;
      return;
    }

    onSuccess?.(results, amount);
  } catch (error) {
    // Target-level flags prevent duplicates on actors already changed, while
    // other valid targets can be retried after an error.
    allowRetry = true;
    reportCardError("Apply Action", error);
  } finally {
    delete button.dataset.rnrApplying;
    if (allowRetry) setApplyButtonsDisabled(root, false);
    else setApplyButtonsDisabled(root, true, "Already applied to the selected Actor(s).");
  }
}

/**
 * @param {ChatMessage} message
 * @param {JQuery|HTMLElement} html
 * @param {object} handlers  { onAttack, onDamage, onHealing, onReload, onDefenseChoice } supplied by
 *                           RnR.js to avoid a circular import back into the main script.
 */
export function activateChatCardListeners(message, html, handlers = {}) {
  const root = html?.[0] ?? html;
  const { onAttack, onDamage, onHealing, onReload } = handlers;
  const existingApplyState = legacyApplyActionState(message);
  if (["processing", "applied", "review"].includes(existingApplyState?.status)) {
    setApplyButtonsDisabled(root, true, existingApplyState.status === "review"
      ? "This action may have partially applied; ask the GM to review it."
      : "This chat card's damage/healing action has already been applied or is in progress.");
  }

  root.querySelectorAll("[data-action='defense-choice']").forEach(btn => {
    if (btn.dataset.rnrBound) return;
    btn.dataset.rnrBound = "1";
    btn.addEventListener("click", async () => {
      if (!handlers.onDefenseChoice) return;
      try {
        const resolved = await handlers.onDefenseChoice(message, btn.dataset.choice, btn);
        if (resolved === false) return;
        root.querySelectorAll("[data-action='defense-choice']").forEach(choice => { choice.disabled = true; });
      } catch (error) {
        reportCardError("Defense Choice", error);
      }
    });
  });

  // ── Attack Roll (from Item card) ────────────────────────────
  root.querySelectorAll("[data-action='roll-item-attack']").forEach(btn => {
    if (btn.dataset.rnrBound) return;
    btn.dataset.rnrBound = "1";
    btn.addEventListener("click", async ev => {
      if (!onAttack) return;
      const { actor, item } = buttonTarget(btn, message);
      if (!item) { ui.notifications.warn("Could not find that item."); return; }
      if (!canUseActorAction(btn, actor, "make this attack")) return;
      // Shift+Click opens the Roll Mode dialog (Normal/Advantage/Disadvantage).
      try {
        await onAttack(actor, item, { openDialog: ev.shiftKey });
      } catch (error) {
        reportCardError("Attack Roll", error);
      }
    });
  });

  root.querySelectorAll("[data-action='counterattack']").forEach(btn => {
    if (btn.dataset.rnrBound) return;
    btn.dataset.rnrBound = "1";
    btn.addEventListener("click", async () => {
      if (!onAttack) return;
      const { actor, item } = buttonTarget(btn, message);
      if (!actor || !item) { ui.notifications.warn("Could not find the counterattack weapon."); return; }
      if (!canUseActorAction(btn, actor, "make this counterattack")) return;
      const targetActorId = btn.dataset.counterTargetActorId;
      if (targetActorId) {
        const targetToken = (canvas.tokens?.placeables ?? []).find(token => token.actor?.id === targetActorId);
        targetToken?.setTarget?.(true, { releaseOthers: true });
      }
      try {
        await onAttack(actor, item, { skipDialog: true, mode: "normal" });
      } catch (error) {
        reportCardError("Counterattack", error);
        return;
      }
      btn.disabled = true;
      btn.textContent = "Counterattack used";
    });
  });

  // ── Damage Roll (from Item card and from the Attack card) ───
  root.querySelectorAll("[data-action='roll-item-damage']").forEach(btn => {
    if (btn.dataset.rnrBound) return;
    btn.dataset.rnrBound = "1";
    btn.addEventListener("click", async () => {
      if (!onDamage) return;
      const { actor, item } = buttonTarget(btn, message);
      if (!item) { ui.notifications.warn("Could not find that item."); return; }
      if (!canUseActorAction(btn, actor, "roll damage for this item")) return;
      try {
        await onDamage(actor, item, {
          isCrit: btn.dataset.isCrit === "true",
          targetActorId: btn.dataset.targetActorId || "",
          attackerUserId: btn.dataset.allowedUserId || "",
        });
      } catch (error) {
        reportCardError("Damage Roll", error);
      }
    });
  });

  // ── Heal / Use (from Item card) ─────────────────────────────
  root.querySelectorAll("[data-action='roll-item-healing']").forEach(btn => {
    if (btn.dataset.rnrBound) return;
    btn.dataset.rnrBound = "1";
    btn.addEventListener("click", async () => {
      if (!onHealing) return;
      const { actor, item } = buttonTarget(btn);
      if (!item) { ui.notifications.warn("Could not find that item."); return; }
      if (!canUseActorAction(btn, actor, "use this healing item")) return;
      await onHealing(actor, item);
    });
  });

  // ── Reload (from Item card) ─────────────────────────────────
  root.querySelectorAll("[data-action='reload-item']").forEach(btn => {
    if (btn.dataset.rnrBound) return;
    btn.dataset.rnrBound = "1";
    btn.addEventListener("click", async () => {
      if (!onReload) return;
      const { actor, item } = buttonTarget(btn);
      if (!item) { ui.notifications.warn("Could not find that item."); return; }
      if (!canUseActorAction(btn, actor, "reload this item")) return;
      await onReload(actor, item);
    });
  });

  // ── Roll Damage (from Attack card) ──────────────────────────
  root.querySelectorAll("[data-action='roll-damage']").forEach(btn => {
    if (btn.dataset.rnrBound) return;
    btn.dataset.rnrBound = "1";
    btn.addEventListener("click", async () => {
      const formula    = btn.dataset.damageFormula || "1d6";
      const damageType = btn.dataset.damageType    || "";
      const actorId    = btn.dataset.actorId;
      const speakerActor = message.speaker?.scene
        ? game.scenes.get(message.speaker.scene)?.tokens.get(message.speaker.token)?.actor
        : null;
      const actor = game.actors.get(actorId) ?? speakerActor;
      if (!actor) { ui.notifications.warn("Could not find actor to roll damage."); return; }
      if (!canUseActorAction(btn, actor, "roll damage for this Actor")) return;

      const dmgRoll = await new Roll(formula).evaluate();
      await sendDamageCard({ actor, itemName: "Damage", dmgRoll, damageType });
    });
  });

  // ── Apply Damage (to targets) ─────────────────────────────
  root.querySelectorAll("[data-action='apply-damage']").forEach(btn => {
    if (btn.dataset.rnrBound) return;
    btn.dataset.rnrBound = "1";
    btn.addEventListener("click", async () => {
      await executeApplyAction({
        message, root, button: btn, action: "apply-damage",
        resolveAmount: async () => {
          let amount = Number(btn.dataset.amount);
          if (isNaN(amount) || amount === 0) {
            if (btn.dataset.formula) amount = (await new Roll(btn.dataset.formula).evaluate()).total;
          }
          return amount;
        },
        damageType: btn.dataset.damageType || "",
        onSuccess: results => ui.notifications.info(results.map(r => `${r.actor.name}: ${r.raw} raw - ${r.armorReduction} DR = ${r.afterArmor}; ×${r.multiplier} = ${r.final} final`).join(" | ")),
      });
    });
  });

  // ── Apply Half Damage (to targets) ────────────────────────
  root.querySelectorAll("[data-action='apply-half-damage']").forEach(btn => {
    if (btn.dataset.rnrBound) return;
    btn.dataset.rnrBound = "1";
    btn.addEventListener("click", async () => {
      await executeApplyAction({
        message, root, button: btn, action: "apply-half-damage",
        resolveAmount: async () => {
          let amount = Number(btn.dataset.amount);
          if (isNaN(amount) || amount === 0) {
            if (btn.dataset.formula) amount = (await new Roll(btn.dataset.formula).evaluate()).total;
          }
          return Math.floor(amount / 2);
        },
        damageType: btn.dataset.damageType || "",
        onSuccess: (results, half) => ui.notifications.info(`Applied ${half} (half) ${btn.dataset.damageType || ""} damage to ${results.map(r => r.actor.name).join(", ")}.`),
      });
    });
  });

  // ── Apply Healing (to targets) ────────────────────────────
  root.querySelectorAll("[data-action='apply-healing']").forEach(btn => {
    if (btn.dataset.rnrBound) return;
    btn.dataset.rnrBound = "1";
    btn.addEventListener("click", async () => {
      await executeApplyAction({
        message, root, button: btn, action: "apply-healing",
        resolveAmount: async () => {
          let amount = Number(btn.dataset.amount);
          if (isNaN(amount) || amount === 0) {
            if (btn.dataset.formula) amount = (await new Roll(btn.dataset.formula).evaluate()).total;
          }
          return amount;
        },
        options: { healing: true },
        onSuccess: (results, amount) => ui.notifications.info(`Applied ${amount} healing to ${results.map(r => r.actor.name).join(", ")}.`),
      });
    });
  });

}
