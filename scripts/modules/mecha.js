const MODULE_NAME = "RnR";
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
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
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
  if (!pilot) ui.notifications.warn("เลือก Token ของ Pilot ก่อน หรือกำหนด Character ให้ผู้ใช้ปัจจุบัน");
  return pilot;
}

function pilotTokenFor(actor) {
  return canvas?.tokens?.placeables?.find(token => token.actor?.id === actor?.id) ?? null;
}

function deploymentTokenForPilot(actor) {
  return canvas?.tokens?.placeables?.find(token =>
    token.actor?.type === "vehicle" && token.document.getFlag(MODULE_NAME, "mechaDeployment.pilotActorId") === actor?.id
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
  ui.notifications.info(`ส่งคำขอเรียกหุ่นไปยัง ${owner.name} แล้ว`);
  return true;
}

async function deployMecha(pilot, mecha) {
  const scene = canvas?.scene;
  const pilotToken = pilotTokenFor(pilot);
  if (!scene || !pilotToken) {
    ui.notifications.warn("วาง Token ของ Pilot ไว้บน Scene ปัจจุบันก่อนเรียกหุ่น");
    return null;
  }
  if (!mecha || mecha.type !== "vehicle") {
    ui.notifications.warn("เลือก Actor ประเภท Vehicle/Mecha ที่นำเข้าไว้ใน World แล้ว");
    return null;
  }
  if (!game.user?.isGM && !mecha.isOwner) {
    ui.notifications.warn("คุณไม่มีสิทธิ์ควบคุม Actor หุ่นนี้ ให้ GM เปิด Ownership ให้ Pilot ก่อน");
    return null;
  }

  const alreadyDeployed = deploymentTokenForPilot(pilot);
  if (alreadyDeployed) {
    alreadyDeployed.control({ releaseOthers: true });
    ui.notifications.info(`${mecha.name} ถูกเรียกอยู่แล้ว — เปลี่ยนการควบคุมไปยังหุ่น`);
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
    await postMechaMessage(pilot, mecha, "เปิดใช้งานกำไล — เรียกหุ่นและเข้าสู่โหมด Mecha");
    ui.notifications.info(`เรียก ${mecha.name} สำเร็จ`);
    return placed ?? created;
  } catch (error) {
    console.error("RnR | Mecha deployment failed", error);
    ui.notifications.error("สร้าง Token หุ่นไม่สำเร็จ ตรวจสิทธิ์การสร้าง Token บน Scene และสิทธิ์ Owner ของ Actor กับ GM");
    return null;
  }
}

export async function summonMecha(actor = null, mechaId = null) {
  const pilot = pilotActorOrNotify(actor);
  if (!pilot) return null;

  if (!game.user?.isGM && !userOwnsPilot(pilot)) {
    ui.notifications.warn("เรียกหุ่นได้เฉพาะ GM หรือ Player ที่เป็น Owner ของ Pilot");
    return null;
  }

  const alreadyDeployed = deploymentTokenForPilot(pilot);
  if (alreadyDeployed) {
    alreadyDeployed.control({ releaseOthers: true });
    ui.notifications.info("หุ่นถูกเรียกอยู่แล้ว — เปลี่ยนการควบคุมไปยังหุ่นตัวเดิม");
    return alreadyDeployed;
  }

  // A GM may initiate a summon, but the active Player owner gets the private
  // decision popup and performs the deployment from their own client.
  if (game.user?.isGM && activePilotOwner(pilot)) {
    try {
      await requestOwnerSummon(pilot, mechaId);
    } catch (error) {
      console.error("RnR | Could not send Mecha summon request", error);
      ui.notifications.error("ส่ง popup คำขอเรียกหุ่นไปยัง Player ไม่สำเร็จ");
    }
    return null;
  }

  const mecha = mechaId ? game.actors?.get(mechaId) : null;
  if (mecha) return deployMecha(pilot, mecha);

  const candidates = availableMecha();
  if (!candidates.length) {
    ui.notifications.warn("ยังไม่มี Actor ประเภท Vehicle/Mecha ที่คุณควบคุมได้ใน World — ให้ GM นำเข้า ‘RnR Mecha Frames’ จาก Compendium และเปิด Ownership");
    return null;
  }
  if (candidates.length === 1) return deployMecha(pilot, candidates[0]);

  const options = candidates.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
  renderMechaDialog({
    title: "กำไลเรียกหุ่น Mecha",
    content: `<form><p>เลือกหุ่นที่จะเรียกมาข้าง Token ของ Pilot:</p><select name="mechaId">${options}</select></form>`,
    buttons: [
      {
        action: "summon",
        label: "เรียกหุ่น",
        callback: async (_event, button) => {
          const id = button?.form?.elements?.mechaId?.value;
          const chosen = game.actors.get(id);
          if (chosen) await deployMecha(pilot, chosen);
        },
      },
      { action: "cancel", label: "ยกเลิก" },
    ],
    defaultAction: "summon",
  });
  return null;
}

export function handleMechaSummonMessage(message) {
  const request = message?.getFlag?.(MODULE_NAME, "mechaSummonRequest");
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
    ui.notifications.warn("GM ส่งคำขอเรียกหุ่นมา แต่คุณยังไม่มีสิทธิ์ Owner ของ Actor Vehicle/Mecha");
    return;
  }

  const requestedMecha = candidates.find(item => item.id === request.mechaActorId);
  const selectedId = requestedMecha?.id ?? candidates[0].id;
  const options = candidates.map(item =>
    `<option value="${escapeHtml(item.id)}"${item.id === selectedId ? " selected" : ""}>${escapeHtml(item.name)}</option>`
  ).join("");
  renderMechaDialog({
    title: "คำขอเรียกหุ่น Mecha",
    content: `<form><p>GM ขอให้เรียกหุ่นสำหรับ <strong>${escapeHtml(pilot.name)}</strong>:</p><label>เลือกหุ่น <select name="mechaId">${options}</select></label></form>`,
    buttons: [
      {
        action: "summon",
        label: "เรียกหุ่น",
        callback: async (_event, button) => {
          const id = button?.form?.elements?.mechaId?.value;
          const chosen = game.actors?.get(id);
          if (!chosen || !userOwnsPilot(pilot)) {
            ui.notifications.warn("ไม่พบหุ่นที่เลือก หรือสิทธิ์ Owner ของ Pilot เปลี่ยนไปแล้ว");
            return;
          }
          await deployMecha(pilot, chosen);
        },
      },
      { action: "dismiss", label: "ไม่ใช่ตอนนี้" },
    ],
    defaultAction: "summon",
  });
}

export async function returnToPilot(actor = null) {
  const controlled = canvas?.tokens?.controlled?.[0] ?? null;
  const mechToken = controlled?.actor?.type === "vehicle" && controlled.document.getFlag(MODULE_NAME, "mechaDeployment.pilotActorId")
    ? controlled
    : actor?.type === "vehicle"
      ? canvas?.tokens?.placeables?.find(token => token.actor?.id === actor.id && token.document.getFlag(MODULE_NAME, "mechaDeployment.pilotActorId"))
      : deploymentTokenForPilot(actor);
  if (!mechToken) {
    ui.notifications.warn("ไม่พบ Token หุ่นที่เรียกด้วยกำไล ให้เลือก Token หุ่น หรือเลือก Token Pilot ก่อน");
    return null;
  }

  const pilotId = mechToken.document.getFlag(MODULE_NAME, "mechaDeployment.pilotActorId");
  const pilot = game.actors?.get(pilotId);
  const pilotToken = pilotTokenFor(pilot);
  if (!pilotToken) {
    ui.notifications.warn("ไม่พบ Token Pilot ใน Scene นี้ จึงสลับกลับไม่ได้ — วาง Token Pilot ลงบน Scene ก่อน");
    return null;
  }

  const mecha = mechToken.actor;
  try {
    await mechToken.document.delete();
  } catch (error) {
    console.error("RnR | Could not remove summoned Mecha Token", error);
    ui.notifications.error("ลบ Token หุ่นไม่สำเร็จ ตรวจสิทธิ์การลบ Token กับ GM");
    return null;
  }

  pilotToken.control({ releaseOthers: true });
  await postMechaMessage(pilot, mecha, "กลับสู่โหมด Pilot — นำ Token หุ่นออกจาก Scene แล้ว");
  ui.notifications.info("กลับมาควบคุม Token Pilot แล้ว — ลบ Token หุ่นออกจาก Scene แล้ว (Actor หุ่นยังอยู่ใน World)");
  return pilotToken;
}

export function openMechaBraceletDialog(actor) {
  if (!actor || actor.type === "vehicle") {
    ui.notifications.warn("ใช้กำไลจาก Actor ของ Pilot ไม่ใช่จาก Actor หุ่น");
    return;
  }
  renderMechaDialog({
    title: "กำไลบัญชาการ Mecha",
    content: `<p>เลือกการทำงานของกำไล:</p><ul><li><strong>เรียกหุ่น / แปลงเข้าสู่โหมด Mecha</strong> — สร้าง Token ข้าง Pilot และสลับการควบคุมไปยังหุ่น</li><li><strong>กลับสู่โหมด Pilot</strong> — ลบ Token หุ่นที่เรียกออกจาก Scene แล้วสลับกลับ (Actor หุ่นยังอยู่ใน World)</li></ul><p class="notes">ต้องมี Token Pilot บน Scene และ Actor Vehicle ที่ผู้เล่นควบคุมได้</p>`,
    buttons: [
      { action: "summon", label: "เรียกหุ่น / แปลงร่าง", callback: () => summonMecha(actor) },
      { action: "return", label: "กลับเป็น Pilot และเก็บหุ่น", callback: () => returnToPilot(actor) },
      { action: "cancel", label: "ยกเลิก" },
    ],
    defaultAction: "summon",
  });
}

export function registerMechaMacroApi() {
  game.RnR = game.RnR ?? {};
  game.RnR.mecha = { summon: summonMecha, returnToPilot };
}
