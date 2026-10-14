// =============================================================
//  RnR — gmtools.js
//  GM utilities: quick HP adjust, apply condition to token,
//  secret rolls, give item to player, NPC template creator
// =============================================================

import { applyDamage } from "./damage.js";
import { CONDITION_GROUPS } from "./conditionGroups.js";
import { RnRDialogV2 } from "./dialogs.js";

function waitGmDialog(config) {
  const DialogV2 = RnRDialogV2;
  if (!DialogV2) {
    ui.notifications.error("RnR GM tools require the Foundry DialogV2 API (Foundry v13 or later).");
    return Promise.resolve(null);
  }
  const classes = [...new Set([...(DialogV2.DEFAULT_OPTIONS?.classes ?? []), "rnr-dialog"] )];
  return DialogV2.wait({ classes, modal: true, rejectClose: false, ...config });
}

// ─────────────────────────────────────────────────────────────
//  QUICK HP ADJUST  (for GM HUD right-click)
// ─────────────────────────────────────────────────────────────

export async function quickHpAdjust(actor) {
  if (!game.user.isGM) { ui.notifications.warn("GM only."); return; }

  const hpCur = Number(foundry.utils.getProperty(actor, "system.vitals.health.value")) || 0;
  const hpMax = Number(foundry.utils.getProperty(actor, "system.vitals.health.max"))   || 1;

  await waitGmDialog({
    window: { title: `HP — ${actor.name}` },
    content: `
<div class="rnr-gm-dialog">
  <p class="rnr-gm-current">Current HP: <strong>${hpCur} / ${hpMax}</strong></p>
  <div class="rnr-gm-row">
    <label>Mode
      <select id="rnr-gm-mode">
        <option value="damage">Deal Damage</option>
        <option value="heal">Heal</option>
        <option value="set">Set Absolute</option>
      </select>
    </label>
    <label>Amount
      <input id="rnr-gm-amount" type="number" min="0" value="0" />
    </label>
    <label>Damage Type (if damage)
      <input id="rnr-gm-dtype" type="text" placeholder="physical" />
    </label>
  </div>
</div>`,
    buttons: [
      {
        action: "apply",
        label: "Apply",
        default: true,
        callback: async (_event, button) => {
          const root   = button.form;
          const mode   = root.querySelector("#rnr-gm-mode")?.value ?? "damage";
          const amount = Number(root.querySelector("#rnr-gm-amount")?.value) || 0;
          const dtype  = root.querySelector("#rnr-gm-dtype")?.value ?? "";

          if (mode === "set") {
            const clamped = Math.max(0, Math.min(hpMax, amount));
            await actor.update({ "system.vitals.health.value": clamped });
            ui.notifications.info(`${actor.name} HP set to ${clamped}.`);
          } else if (mode === "heal") {
            const newHp = Math.min(hpMax, hpCur + amount);
            await actor.update({ "system.vitals.health.value": newHp });
            ui.notifications.info(`${actor.name} healed ${amount} HP → ${newHp}/${hpMax}.`);
          } else {
            const r = await applyDamage(actor, amount, dtype);
            if (r) ui.notifications.info(`${actor.name} took ${r.final} ${dtype || "damage"} → ${r.hpAfter}/${r.hpMax}.`);
          }
        },
      },
      { action: "cancel", label: "Cancel" },
    ],
  });
}

// ─────────────────────────────────────────────────────────────
//  APPLY CONDITION TO SELECTED TOKENS
// ─────────────────────────────────────────────────────────────

export async function applyConditionDialog() {
  if (!game.user.isGM) { ui.notifications.warn("GM only."); return; }

  const tokens = canvas.tokens?.controlled ?? [];
  if (!tokens.length) { ui.notifications.warn("Select one or more Tokens first."); return; }

  // Conditions come from the shared group definition so the GM tool, the
  // Manage Conditions dialog and the sheet can never drift apart.
  const groups = CONDITION_GROUPS.map(g =>
    `<optgroup label="${g.label}">${g.entries
      .map(([key, label]) => `<option value="${g.key}.${key}">${label}</option>`).join("")}
    </optgroup>`).join("");

  await waitGmDialog({
    window: { title: "Apply Condition" },
    content: `
<div class="rnr-gm-dialog">
  <p>Targets: <strong>${tokens.map(t => t.name).join(", ")}</strong></p>
  <label>Condition
    <select id="rnr-gm-cond">${groups}</select>
  </label>
  <label class="rnr-gm-check">
    <input type="checkbox" id="rnr-gm-remove"> Remove (instead of add)
  </label>
</div>`,
    buttons: [
      {
        action: "apply",
        label: "Apply",
        default: true,
        callback: async (_event, button) => {
          const root   = button.form;
          const cond   = root.querySelector("#rnr-gm-cond")?.value;
          const remove = root.querySelector("#rnr-gm-remove")?.checked;
          if (!cond) return;
          const [groupKey, condKey] = cond.split(".");
          for (const token of tokens) {
            const actor = token.actor;
            if (!actor) continue;
            const path = `system.conditions.${groupKey}.active`;
            const active = new Set(Array.isArray(foundry.utils.getProperty(actor, path)) ? foundry.utils.getProperty(actor, path) : []);
            if (remove) active.delete(condKey); else active.add(condKey);
            await actor.update({ [path]: [...active] });
          }
          ui.notifications.info(`${remove ? "Removed" : "Applied"} ${condKey} to ${tokens.length} token(s).`);
        },
      },
      { action: "cancel", label: "Cancel" },
    ],
  });
}

// ─────────────────────────────────────────────────────────────
//  SECRET ROLL (result only visible to GM)
// ─────────────────────────────────────────────────────────────

export async function gmSecretRoll(actor, formula = "1d20") {
  if (!game.user.isGM) { ui.notifications.warn("GM only."); return; }

  const roll = await new Roll(formula).evaluate();
  await ChatMessage.create({
    speaker:  ChatMessage.getSpeaker({ actor }),
    content:  `<div class="rnr-chat-card"><div class="rnr-card-header"><img src="${actor?.img ?? ''}"/><div><strong>${actor?.name ?? "GM"}</strong><span>🔒 Secret Roll</span></div></div><div class="rnr-card-dice"><span class="rnr-card-total">${roll.total}</span><span class="rnr-card-formula">${formula}</span></div></div>`,
    rolls:    [roll],
    whisper:  ChatMessage.getWhisperRecipients("GM"),
  });
  return roll;
}

// ─────────────────────────────────────────────────────────────
//  GIVE ITEM TO PLAYER
// ─────────────────────────────────────────────────────────────

/**
 * Move or copy an item from the GM's selected actor to a target player's actor.
 *
 * @param {Item}   item         the item to give
 * @param {Actor}  toActor      recipient actor
 * @param {boolean} move        if true, delete from source after copying
 */
export async function giveItem(item, toActor, move = false) {
  if (!game.user.isGM) { ui.notifications.warn("GM only."); return; }
  const data = item.toObject();
  // Clear worn state on transfer. equipmentSlot / handSlot are the only
  // "equipped" fields — a transferred item arrives in the backpack.
  foundry.utils.setProperty(data, "system.handSlot",      "");
  foundry.utils.setProperty(data, "system.equipmentSlot", "");
  const [created] = await toActor.createEmbeddedDocuments("Item", [data]);
  if (move) await item.delete();
  ui.notifications.info(`Gave "${item.name}" to ${toActor.name}.`);
  return created;
}

// ─────────────────────────────────────────────────────────────
//  NPC TEMPLATE CREATOR
// ─────────────────────────────────────────────────────────────

const NPC_TEMPLATES = {
  minion:  { cr: 0.25, hp: 10,  ac: 12, attributes: { strength: 10, dexterity: 12, toughness: 10, intellect: 8,  aptitude: 8,  sanity: 8,  charm: 8, rhetoric: 8, ego: 8 } },
  soldier: { cr: 1,    hp: 30,  ac: 14, attributes: { strength: 14, dexterity: 12, toughness: 14, intellect: 10, aptitude: 10, sanity: 10, charm: 8, rhetoric: 8, ego: 8 } },
  elite:   { cr: 3,    hp: 65,  ac: 16, attributes: { strength: 16, dexterity: 14, toughness: 16, intellect: 12, aptitude: 12, sanity: 12, charm: 10, rhetoric: 10, ego: 10 } },
  boss:    { cr: 7,    hp: 130, ac: 18, attributes: { strength: 20, dexterity: 16, toughness: 20, intellect: 14, aptitude: 14, sanity: 14, charm: 14, rhetoric: 14, ego: 14 } },
};

export async function createNpcFromTemplate(templateKey = "soldier", name = "NPC") {
  if (!game.user.isGM) { ui.notifications.warn("GM only."); return; }
  const tmpl = NPC_TEMPLATES[templateKey] ?? NPC_TEMPLATES.soldier;

  const actorData = {
    name,
    type: "npc",
    system: {
      details:   { cr: tmpl.cr, type: "humanoid", size: "med" },
      vitals:    { health: { value: tmpl.hp, max: tmpl.hp }, willPower: { value: 5, max: 5 } },
      defenses:  { armorDamageReduction: tmpl.ac, speed: 30 },
      attributes: Object.fromEntries(Object.entries(tmpl.attributes).map(([k,v]) => [k, { value: v }])),
    },
  };

  const actor = await Actor.create(actorData);
  ui.notifications.info(`Created NPC "${name}" (${templateKey}).`);
  actor.sheet.render(true);
  return actor;
}

// ─────────────────────────────────────────────────────────────
//  GM TOOLBAR (registered as a Scene Control button)
// ─────────────────────────────────────────────────────────────

export function registerGmToolbar() {
  Hooks.on("getSceneControlButtons", (controls) => {
    if (!game.user.isGM) return;
    const tokens = controls?.tokens;
    if (!tokens?.tools) return;

    const addButton = (name, title, icon, onChange) => {
      tokens.tools[name] = {
        name,
        title,
        icon,
        button: true,
        visible: true,
        order: Object.keys(tokens.tools).length,
        onChange,
      };
    };

    addButton("rnr-hp-adjust", "RnR: Quick HP Adjust", "fa-solid fa-heart", () => {
        const tokens = canvas.tokens?.controlled ?? [];
        if (!tokens.length) { ui.notifications.warn("Select a Token first."); return; }
        return quickHpAdjust(tokens[0].actor);
      });

    addButton("rnr-condition", "RnR: Apply Condition", "fa-solid fa-skull-crossbones", () => applyConditionDialog());

    addButton("rnr-secret-roll", "RnR: Secret Roll", "fa-solid fa-dice-d20", () => {
        const actor = canvas.tokens?.controlled?.[0]?.actor ?? null;
        return gmSecretRoll(actor, "1d20");
      });

    addButton("rnr-npc-template", "RnR: Create NPC from Template", "fa-solid fa-user-secret", () => npcTemplateDialog());
  });
}

async function npcTemplateDialog() {
  const opts = Object.keys(NPC_TEMPLATES)
    .map(k => `<option value="${k}">${k.charAt(0).toUpperCase() + k.slice(1)}</option>`).join("");

  await waitGmDialog({
    window: { title: "Create NPC from Template" },
    content: `
<div class="rnr-gm-dialog">
  <label>Template<select id="rnr-npc-tmpl">${opts}</select></label>
  <label>Name<input id="rnr-npc-name" type="text" value="New NPC" /></label>
 </div>`,
    buttons: [
      {
        action: "create",
        label: "Create",
        default: true,
        callback: async (_event, button) => {
          const root = button.form;
          const tmpl = root.querySelector("#rnr-npc-tmpl")?.value ?? "soldier";
          const name = root.querySelector("#rnr-npc-name")?.value ?? "NPC";
          await createNpcFromTemplate(tmpl, name);
        },
      },
      { action: "cancel", label: "Cancel" },
    ],
  });
}
