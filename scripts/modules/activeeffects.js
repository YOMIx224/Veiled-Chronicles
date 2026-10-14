// =============================================================
//  RnR — activeeffects.js
//  Active Effects UI — create, edit, toggle, duration tracking
//  Effects from: Equipment, Extra Skills, Conditions, Manual
// =============================================================

// ─────────────────────────────────────────────────────────────
//  EFFECT PRESETS  (common RnR effects)
// ─────────────────────────────────────────────────────────────

// Keep module evaluation safe even when Foundry exposes CONST after the
// ES-module is evaluated. Foundry v13 uses ADD=2 and CUSTOM=0.
const ACTIVE_EFFECT_MODES = globalThis.CONST?.ACTIVE_EFFECT_MODES ?? { ADD: 2, CUSTOM: 0, SET: 5 };

export const EFFECT_PRESETS = [
  // Attack bonus → system.mods.attack (read by the item card attack roll)
  { label: "+1 Attack Rolls",    changes: [{ key: "system.mods.attack",                      mode: ACTIVE_EFFECT_MODES.ADD, value: "1" }] },
  { label: "+2 Attack Rolls",    changes: [{ key: "system.mods.attack",                      mode: ACTIVE_EFFECT_MODES.ADD, value: "2" }] },
  // Damage bonus. Flat amounts go to system.mods.damageFlat, which is numeric and
  // stacks with ADD. Dice expressions go to system.mods.damage, a *string* field.
  //
  // Dice effects must use SET, not ADD: Foundry's ADD coerces the field and the
  // value to numbers, so "1d4" became NaN and the bonus silently vanished. SET
  // stores the fragment intact, and RnR.js gathers the fragments from every
  // active effect individually, so two "+1d4 Damage" effects stack to
  // "1d8+1d4+1d4" rather than one overwriting the other.
  { label: "+1 Damage",          changes: [{ key: "system.mods.damageFlat",                    mode: ACTIVE_EFFECT_MODES.ADD, value: "1" }] },
  { label: "+2 Damage",          changes: [{ key: "system.mods.damageFlat",                    mode: ACTIVE_EFFECT_MODES.ADD, value: "2" }] },
  { label: "+1d4 Damage",        changes: [{ key: "system.mods.damage",                        mode: ACTIVE_EFFECT_MODES.SET, value: "1d4" }] },
  { label: "+1d6 Damage",        changes: [{ key: "system.mods.damage",                        mode: ACTIVE_EFFECT_MODES.SET, value: "1d6" }] },
  // DR → system.defenses.armorDamageReduction (read by damage.js)
  { label: "+2 DR",              changes: [{ key: "system.defenses.armorDamageReduction",    mode: ACTIVE_EFFECT_MODES.ADD, value: "2" }] },
  { label: "+5 DR (Shield Effect)", changes:[{ key: "system.defenses.armorDamageReduction",    mode: ACTIVE_EFFECT_MODES.ADD, value: "5" }] },
  // Speed → system.defenses.speed
  { label: "+10 Speed",          changes: [{ key: "system.defenses.speed",                  mode: ACTIVE_EFFECT_MODES.ADD, value: "10" }] },
  { label: "−10 Speed",          changes: [{ key: "system.defenses.speed",                  mode: ACTIVE_EFFECT_MODES.ADD, value: "-10" }] },
  // Attribute bonus
  { label: "+2 Strength",        changes: [{ key: "system.attributes.strength.value",      mode: ACTIVE_EFFECT_MODES.ADD, value: "2" }] },
  { label: "+2 Dexterity",       changes: [{ key: "system.attributes.dexterity.value",     mode: ACTIVE_EFFECT_MODES.ADD, value: "2" }] },
  { label: "+2 Toughness",       changes: [{ key: "system.attributes.toughness.value",     mode: ACTIVE_EFFECT_MODES.ADD, value: "2" }] },
  { label: "+2 Intellect",       changes: [{ key: "system.attributes.intellect.value",     mode: ACTIVE_EFFECT_MODES.ADD, value: "2" }] },
  // Skill bonus
  { label: "+2 Reflex",          changes: [{ key: "system.skills.reflex.value",             mode: ACTIVE_EFFECT_MODES.ADD, value: "2" }] },
  { label: "+2 Perception",      changes: [{ key: "system.skills.perception.value",         mode: ACTIVE_EFFECT_MODES.ADD, value: "2" }] },
  // Reflex Defense (NPC / Vehicle static value)
  { label: "+3 Reflex Defense",  changes: [{ key: "system.defenses.reflexDefense",           mode: ACTIVE_EFFECT_MODES.ADD, value: "3" }] },
];

// ─────────────────────────────────────────────────────────────
//  CREATE EFFECT ON ACTOR
// ─────────────────────────────────────────────────────────────

/**
 * @param {Actor}  actor
 * @param {object} effectData   plain ActiveEffect data
 */
export async function createEffect(actor, effectData) {
  return actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
}

/**
 * Open a dialog to build a new Active Effect on an actor.
 */
export async function createEffectDialog(actor) {
  const presetOpts = EFFECT_PRESETS
    .map((p, i) => `<option value="${i}">${p.label}</option>`).join("");

  const MODES = ACTIVE_EFFECT_MODES;
  const modeOpts = Object.entries(MODES)
    .map(([name, val]) => `<option value="${val}">${name}</option>`).join("");

  const DialogV2 = globalThis.foundry.applications.api.DialogV2;
  const classes = [...new Set([...(DialogV2.DEFAULT_OPTIONS?.classes ?? []), "rnr-dialog"] )];
  await DialogV2.wait({
    classes,
    modal: true,
    rejectClose: false,
    window: { title: "Create Active Effect" },
    content: `
<div class="rnr-ae-dialog">
  <label>Name
    <input id="rnr-ae-label" type="text" value="New Effect" />
  </label>
  <label>Icon (optional)
    <input id="rnr-ae-icon" type="text" placeholder="icons/svg/aura.svg" />
  </label>
  <label>Preset
    <select id="rnr-ae-preset">
      <option value="">— Manual —</option>
      ${presetOpts}
    </select>
  </label>
  <hr/>
  <h4>Change (optional)</h4>
  <label>Key (e.g. system.defenses.armorClass)
    <input id="rnr-ae-key" type="text" placeholder="system.attributes.strength.value" />
  </label>
  <label>Mode
    <select id="rnr-ae-mode">${modeOpts}</select>
  </label>
  <label>Value
    <input id="rnr-ae-value" type="text" placeholder="2" />
  </label>
  <hr/>
  <label>Duration (rounds, 0 = permanent)
    <input id="rnr-ae-duration" type="number" min="0" value="0" />
  </label>
  <label>Description
    <textarea id="rnr-ae-desc" rows="2"></textarea>
  </label>
 </div>`,
    buttons: [
      {
        action: "create",
        label: "Create",
        default: true,
        callback: async (_event, button) => {
          const root     = button.form;
          const label    = root.querySelector("#rnr-ae-label")?.value?.trim()    || "Effect";
          const icon     = root.querySelector("#rnr-ae-icon")?.value?.trim()     || "icons/svg/aura.svg";
          const key      = root.querySelector("#rnr-ae-key")?.value?.trim()      || "";
          const mode     = Number(root.querySelector("#rnr-ae-mode")?.value)     ?? MODES.ADD;
          const value    = root.querySelector("#rnr-ae-value")?.value?.trim()    || "0";
          const duration = Number(root.querySelector("#rnr-ae-duration")?.value) || 0;
          const desc     = root.querySelector("#rnr-ae-desc")?.value?.trim()     || "";
          const presetIdx= root.querySelector("#rnr-ae-preset")?.value;

          let changes = key ? [{ key, mode, value, priority: 20 }] : [];
          let finalIcon = icon;
          if (presetIdx !== "" && presetIdx !== null) {
            const preset = EFFECT_PRESETS[Number(presetIdx)];
            if (preset) {
              changes   = preset.changes;
              finalIcon = preset.icon || icon;
            }
          }

          const effectData = {
            name: label,
            img:  finalIcon,
            disabled: false,
            duration: duration > 0 ? { rounds: duration } : {},
            changes,
            description: desc,
            flags: { RnR: { source: "manual" } },
          };
          await createEffect(actor, effectData);
          ui.notifications.info(`Effect "${label}" added to ${actor.name}.`);
        },
      },
      { action: "cancel", label: "Cancel" },
    ],
  });
}

// ─────────────────────────────────────────────────────────────
//  TOGGLE EFFECT
// ─────────────────────────────────────────────────────────────

export async function toggleEffect(actor, effectId) {
  const effect = actor.effects?.get(effectId);
  if (!effect) return;
  await effect.update({ disabled: !effect.disabled });
}

// ─────────────────────────────────────────────────────────────
//  REMOVE EXPIRED EFFECTS  (called on combat turn advance)
// ─────────────────────────────────────────────────────────────

export async function removeExpiredEffects(actor, currentRound) {
  const expired = (actor.effects?.contents ?? []).filter(e => {
    if (e.disabled || !e.duration?.rounds) return false;
    const start  = e.duration?.startRound ?? 0;
    const rounds = e.duration.rounds;
    return currentRound >= start + rounds;
  });
  for (const e of expired) await e.delete();
  if (expired.length) ui.notifications.info(`${actor.name}: ${expired.length} effect(s) expired.`);
}

// ─────────────────────────────────────────────────────────────
//  LEGACY ITEM EFFECTS
//  Older RnR versions created an Active Effect for every equipped item
//  (armorBonus / speedBonus / attackBonus / damageBonus / skill bonus).
//  buildData() in RnR.js already sums every one of those live from the worn
//  items, so those effects double-counted each bonus. They are deleted on
//  migration instead of being created again.
// ─────────────────────────────────────────────────────────────

/**
 * Remove the Active Effect that was auto-created from a specific item.
 * @returns {Promise<number>} how many effects were removed
 */
export async function removeItemEffect(actor, itemId) {
  const toRemove = (actor.effects?.contents ?? []).filter(
    e => e.flags?.RnR?.source === "item" && e.flags?.RnR?.itemId === itemId
  );
  for (const e of toRemove) await e.delete();
  return toRemove.length;
}

/**
 * Strip every legacy auto-generated item effect from an actor.
 * Safe to call more than once.
 * @returns {Promise<number>} how many effects were removed
 */
export async function removeAllLegacyItemEffects(actor) {
  const legacy = (actor.effects?.contents ?? []).filter(e => e.flags?.RnR?.source === "item");
  for (const e of legacy) await e.delete();
  return legacy.length;
}

// ─────────────────────────────────────────────────────────────
//  EFFECTS PANEL (for actor sheet sidebar)
// ─────────────────────────────────────────────────────────────

export function buildEffectsPanelData(actor) {
  return (actor.effects?.contents ?? []).map(e => ({
    id:       e.id,
    name:     e.name,
    img:      e.img,
    disabled: e.disabled,
    source:   e.flags?.RnR?.source ?? "manual",
    duration: e.duration?.rounds
      ? `${e.duration.rounds} round(s)`
      : "Permanent",
    changes:  (e.changes ?? []).map(c => `${c.key} ${c.value >= 0 ? "+" : ""}${c.value}`).join(", "),
  }));
}
