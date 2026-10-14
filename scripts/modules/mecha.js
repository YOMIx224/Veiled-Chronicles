import { FLAG_NAMESPACE as MODULE_NAME, getRnRFlag } from "./flags.js";
import { RnRDialogV2 } from "./dialogs.js";

const pendingOwnerPopupMessages = new Set();

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function userOwnsPilot(pilot, user = game.user) {
  if (!pilot || !user) return false;
  if (user.id === game.user?.id && pilot.isOwner) return true;
  return Boolean(pilot.testUserPermission?.(user, "OWNER"));
}

function activePilotOwner(pilot) {
  return (game.users?.contents ?? []).find(user =>
    user.active && !user.isGM && userOwnsPilot(pilot, user)
  ) ?? null;
}

function availableMecha() {
  return (game.actors?.contents ?? [])
    .filter(actor => actor.type === "vehicle" && (game.user?.isGM || actor.isOwner))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function renderMechaDialog({ title, content, buttons, defaultAction }) {
  const DialogV2 = RnRDialogV2;
  if (!DialogV2) {
    ui.notifications.error("Mecha popup requires the Foundry DialogV2 API (Foundry v13 or later).");
    return null;
  }
  return new DialogV2({
    window: { title },
    content,
    modal: true,
    buttons: buttons.map(button => ({
      action: button.action,
      label: button.label,
      ...(button.action === defaultAction ? { default: true } : {}),
      ...(button.callback ? { callback: button.callback } : {}),
    })),
  }).render({ force: true });
}

function pilotActorOrNotify(actor = null) {
  if (actor && actor.type !== "vehicle") return actor;
  const controlled = canvas?.tokens?.controlled?.find(token => token.actor && token.actor.type !== "vehicle")?.actor;
  const pilot = controlled ?? game.user?.character ?? null;
  if (!pilot) ui.notifications.warn("Select the Pilot's Token first, or assign a Character to the current user.");
  return pilot;
}

function pilotTokenFor(actor) {
  return canvas?.tokens?.placeables?.find(token => token.actor?.id === actor?.id) ?? null;
}

function deploymentTokenForPilot(actor) {
  return canvas?.tokens?.placeables?.find(token =>
    token.actor?.type === "vehicle" && getRnRFlag(token.document, "mechaDeployment.pilotActorId") === actor?.id
  ) ?? null;
}

async function postMechaMessage(actor, mecha, text) {
  if (!globalThis.ChatMessage) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="rnr-chat-card"><div class="rnr-card-header"><strong>${escapeHtml(actor?.name || "Pilot")}</strong><span>${escapeHtml(text)}</span></div><div class="rnr-card-detail">${escapeHtml(mecha?.name || "Mecha")}</div></div>`,
  });
}

async function requestOwnerSummon(pilot, mechaId = null) {
  const owner = activePilotOwner(pilot);
  if (!owner || !globalThis.ChatMessage) return false;

  const requesterName = game.user?.name || "GM";
  const requestId = foundry.utils.randomID();
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: pilot }),
    whisper: [owner.id],
    blind: false,
    content: `<div class="rnr-chat-card"><div class="rnr-card-header"><strong>Mecha summon request</strong><span>${escapeHtml(requesterName)} is asking ${escapeHtml(owner.name)} to summon a Mecha for ${escapeHtml(pilot.name)}.</span></div><div class="rnr-card-detail">A private popup has been sent to the active Pilot owner.</div></div>`,
    flags: {
      [MODULE_NAME]: {
        mechaSummonRequest: {
          requestId,
          pilotActorId: pilot.id,
          mechaActorId: mechaId || null,
          requestedById: game.user.id,
        },
      },
    },
  });
  ui.notifications.info(`Mecha summon request sent to ${owner.name}.`);
  return true;
}

async function deployMecha(pilot, mecha) {
  const scene = canvas?.scene;
  const pilotToken = pilotTokenFor(pilot);
  if (!scene || !pilotToken) {
    ui.notifications.warn("Place the Pilot's Token on the current Scene before summoning a Mecha.");
    return null;
  }
  if (!mecha || mecha.type !== "vehicle") {
    ui.notifications.warn("Choose a Vehicle/Mecha Actor that has been imported into this World.");
    return null;
  }
  if (!game.user?.isGM && !mecha.isOwner) {
    ui.notifications.warn("You do not control this Mecha Actor. Ask the GM to grant the Pilot Ownership.");
    return null;
  }

  const alreadyDeployed = deploymentTokenForPilot(pilot);
  if (alreadyDeployed) {
    alreadyDeployed.control({ releaseOthers: true });
    ui.notifications.info(`${mecha.name} is already deployed — switching control to the Mecha.`);
    return alreadyDeployed;
  }

  const gridSize = Number(canvas.grid?.size) || 100;
  const prototype = mecha.prototypeToken?.toObject?.() ?? {};
  const tokenData = foundry.utils.deepClone(prototype);
  delete tokenData._id;
  delete tokenData.id;
  delete tokenData._stats;
  tokenData.name = mecha.name;
  tokenData.actorId = mecha.id;
  tokenData.actorLink = true;
  tokenData.x = Number(pilotToken.document.x) + Math.max(1, Number(pilotToken.document.width) || 1) * gridSize;
  tokenData.y = Number(pilotToken.document.y);
  tokenData.hidden = false;
  tokenData.flags = foundry.utils.mergeObject(tokenData.flags ?? {}, {
    [MODULE_NAME]: { mechaDeployment: { pilotActorId: pilot.id, pilotTokenId: pilotToken.id } },
  }, { inplace: false, overwrite: true });

  try {
    const [created] = await scene.createEmbeddedDocuments("Token", [tokenData]);
    const placed = canvas.tokens.get(created.id);
    placed?.control({ releaseOthers: true });
    await postMechaMessage(pilot, mecha, "Bracelet activated — Mecha summoned, entering Mecha mode.");
    ui.notifications.info(`${mecha.name} summoned.`);
    return placed ?? created;
  } catch (error) {
    console.error("RnR | Mecha deployment failed", error);
    ui.notifications.error("Could not create the Mecha Token. Ask the GM to check Token creation permission on this Scene and Ownership of the Actor.");
    return null;
  }
}

export async function summonMecha(actor = null, mechaId = null) {
  const pilot = pilotActorOrNotify(actor);
  if (!pilot) return null;

  if (!game.user?.isGM && !userOwnsPilot(pilot)) {
    ui.notifications.warn("Only the GM or a Player who owns the Pilot can summon a Mecha.");
    return null;
  }

  const alreadyDeployed = deploymentTokenForPilot(pilot);
  if (alreadyDeployed) {
    alreadyDeployed.control({ releaseOthers: true });
    ui.notifications.info("A Mecha is already deployed — switching control to it.");
    return alreadyDeployed;
  }

  // A GM may initiate a summon, but the active Player owner gets the private
  // decision popup and performs the deployment from their own client.
  if (game.user?.isGM && activePilotOwner(pilot)) {
    try {
      await requestOwnerSummon(pilot, mechaId);
    } catch (error) {
      console.error("RnR | Could not send Mecha summon request", error);
      ui.notifications.error("Could not send the Mecha summon request to the Player.");
    }
    return null;
  }

  const mecha = mechaId ? game.actors?.get(mechaId) : null;
  if (mecha) return deployMecha(pilot, mecha);

  const candidates = availableMecha();
  if (!candidates.length) {
    ui.notifications.warn("You do not control any Vehicle/Mecha Actor in this World. Ask the GM to import one from the 'RnR — Mecha Frames' Compendium and grant Ownership.");
    return null;
  }
  if (candidates.length === 1) return deployMecha(pilot, candidates[0]);

  const options = candidates.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
  renderMechaDialog({
    title: "Mecha Summon Bracelet",
    content: `<form><p>Choose the Mecha to summon next to the Pilot's Token:</p><select name="mechaId">${options}</select></form>`,
    buttons: [
      {
        action: "summon",
        label: "Summon",
        callback: async (_event, button) => {
          const id = button?.form?.elements?.mechaId?.value;
          const chosen = game.actors.get(id);
          if (chosen) await deployMecha(pilot, chosen);
        },
      },
      { action: "cancel", label: "Cancel" },
    ],
    defaultAction: "summon",
  });
  return null;
}

export function handleMechaSummonMessage(message) {
  const request = getRnRFlag(message, "mechaSummonRequest");
  if (!request?.requestId || !request.pilotActorId) return;
  if (!(message.whisper ?? []).includes(game.user?.id)) return;

  const requester = game.users?.get(request.requestedById);
  if (!requester?.isGM) return;

  const pilot = game.actors?.get(request.pilotActorId);
  if (!pilot || !userOwnsPilot(pilot)) return;
  if (pendingOwnerPopupMessages.has(request.requestId)) return;
  pendingOwnerPopupMessages.add(request.requestId);

  // If a token is already on the Scene, the request has been fulfilled; do not
  // reopen a stale modal when the chat log is rendered again.
  if (deploymentTokenForPilot(pilot)) return;

  const candidates = availableMecha();
  if (!candidates.length) {
    ui.notifications.warn("The GM requested a Mecha summon, but you do not own a Vehicle/Mecha Actor yet.");
    return;
  }

  const requestedMecha = candidates.find(item => item.id === request.mechaActorId);
  const selectedId = requestedMecha?.id ?? candidates[0].id;
  const options = candidates.map(item =>
    `<option value="${escapeHtml(item.id)}"${item.id === selectedId ? " selected" : ""}>${escapeHtml(item.name)}</option>`
  ).join("");
  renderMechaDialog({
    title: "Mecha Summon Request",
    content: `<form><p>The GM asks you to summon a Mecha for <strong>${escapeHtml(pilot.name)}</strong>:</p><label>Mecha <select name="mechaId">${options}</select></label></form>`,
    buttons: [
      {
        action: "summon",
        label: "Summon",
        callback: async (_event, button) => {
          const id = button?.form?.elements?.mechaId?.value;
          const chosen = game.actors?.get(id);
          if (!chosen || !userOwnsPilot(pilot)) {
            ui.notifications.warn("The selected Mecha was not found, or the Pilot's Ownership has changed.");
            return;
          }
          await deployMecha(pilot, chosen);
        },
      },
      { action: "dismiss", label: "Not now" },
    ],
    defaultAction: "summon",
  });
}

export async function returnToPilot(actor = null) {
  const controlled = canvas?.tokens?.controlled?.[0] ?? null;
  const mechToken = controlled?.actor?.type === "vehicle" && getRnRFlag(controlled.document, "mechaDeployment.pilotActorId")
    ? controlled
    : actor?.type === "vehicle"
      ? canvas?.tokens?.placeables?.find(token => token.actor?.id === actor.id && getRnRFlag(token.document, "mechaDeployment.pilotActorId"))
      : deploymentTokenForPilot(actor);
  if (!mechToken) {
    ui.notifications.warn("No bracelet-summoned Mecha Token found. Select the Mecha Token or the Pilot Token first.");
    return null;
  }

  const pilotId = getRnRFlag(mechToken.document, "mechaDeployment.pilotActorId");
  const pilot = game.actors?.get(pilotId);
  const pilotToken = pilotTokenFor(pilot);
  if (!pilotToken) {
    ui.notifications.warn("The Pilot Token is not on this Scene, so control cannot switch back. Place the Pilot Token on the Scene first.");
    return null;
  }

  const mecha = mechToken.actor;
  try {
    await mechToken.document.delete();
  } catch (error) {
    console.error("RnR | Could not remove summoned Mecha Token", error);
    ui.notifications.error("Could not remove the Mecha Token. Ask the GM to check Token deletion permission.");
    return null;
  }

  pilotToken.control({ releaseOthers: true });
  await postMechaMessage(pilot, mecha, "Returned to Pilot mode — the Mecha Token was removed from the Scene.");
  ui.notifications.info("Back in control of the Pilot Token. The Mecha Token was removed from the Scene; the Mecha Actor remains in the World.");
  return pilotToken;
}

export function openMechaBraceletDialog(actor) {
  if (!actor || actor.type === "vehicle") {
    ui.notifications.warn("Use the bracelet from the Pilot's Actor, not from the Mecha Actor.");
    return;
  }
  renderMechaDialog({
    title: "Mecha Command Bracelet",
    content: `<p>Choose a bracelet function:</p><ul><li><strong>Summon / Mecha mode</strong> — create the Mecha Token next to the Pilot and switch control to it.</li><li><strong>Return to Pilot</strong> — remove the summoned Mecha Token from the Scene and switch back (the Mecha Actor stays in the World).</li></ul><p class="notes">Requires the Pilot Token on the Scene and a Vehicle Actor the player controls.</p>`,
    buttons: [
      { action: "summon", label: "Summon / Mecha Mode", callback: () => summonMecha(actor) },
      { action: "return", label: "Return to Pilot", callback: () => returnToPilot(actor) },
      { action: "cancel", label: "Cancel" },
    ],
    defaultAction: "summon",
  });
}

export function registerMechaMacroApi() {
  game.RnR = game.RnR ?? {};
  game.RnR.mecha = { summon: summonMecha, returnToPilot };
}
