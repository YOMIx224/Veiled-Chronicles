/**
 * Integrations with other modules. Each one is optional and only activates when
 * the other module is active.
 *
 *  - Tidy 5e Sheets: an "Ascendant Forge" tab on character sheets (Momentum,
 *    equipped techniques with Use buttons, armed weave, open button).
 *  - Hotbars (core, Monk's Hotbar Expansion, BG3 HUD): techniques become Macros,
 *    which those hotbars accept by drag and drop.
 */
import { MODULE_ID } from "../constants.js";
import { effectiveTechnique } from "../engine/build.js";
import { getBuild, getRegistry, getRuntime, momentumMax } from "./store.js";
import { armWeave, useTechnique } from "./actions.js";
import { loc } from "./i18n.js";

/* ------------------------------------------------------------------ */
/*  Hotbar macros                                                      */
/* ------------------------------------------------------------------ */

/**
 * Create (or reuse) a script Macro that uses a technique, and put it on the core hotbar.
 * The Macro can then be dragged into BG3 HUD or Monk's Hotbar Expansion.
 */
export async function createTechniqueMacro(actor, techniqueId) {
  const tech = getRegistry().get("technique", techniqueId);
  if ( !tech ) return null;
  let macro = game.macros.find(m => m.getFlag(MODULE_ID, "technique") === techniqueId
    && m.getFlag(MODULE_ID, "actor") === actor.uuid && m.isOwner);
  if ( !macro ) {
    macro = await Macro.create({
      name: `${loc(tech.name)} (${actor.name})`,
      type: "script",
      img: "icons/magic/symbols/star-yellow.webp",
      command: `const actor = await fromUuid(${JSON.stringify(actor.uuid)});\n`
        + `if ( actor ) AscendantForge.useTechnique(actor, ${JSON.stringify(techniqueId)});`,
      flags: { [MODULE_ID]: { technique: techniqueId, actor: actor.uuid } }
    });
  }
  const free = Array.fromRange(50, 1).find(slot => !game.user.hotbar[slot]);
  if ( free && !Object.values(game.user.hotbar).includes(macro.id) ) await game.user.assignHotbarMacro(macro, free);
  ui.notifications.info(game.i18n.format("AF.Macro.Created", { name: macro.name }));
  return macro;
}

/* ------------------------------------------------------------------ */
/*  Tidy 5e Sheets                                                     */
/* ------------------------------------------------------------------ */

const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

function tidyTabHtml(actor) {
  const registry = getRegistry();
  const build = getBuild(actor);
  const rt = getRuntime(actor);
  const rows = build.loadout.map(entry => {
    const eff = effectiveTechnique(registry, entry);
    if ( !eff ) return "";
    const t = eff.technique;
    return `<li class="af-tidy-tech">
      <div><b>${esc(loc(t.name))}</b> <span class="af-chip">${esc(game.i18n.localize(`AF.Action.${t.action}`))}</span>
        <span class="af-chip">${eff.momentum} ${esc(game.i18n.localize("AF.Momentum"))}</span><br>
        <small>${esc(loc(t.description))}</small></div>
      <button type="button" data-af-tidy="use" data-id="${t.id}"><i class="fa-solid fa-bolt"></i> ${esc(game.i18n.localize("AF.Use.Button"))}</button>
    </li>`;
  }).join("");
  const armed = rt.armedWeave ? registry.get("weave", rt.armedWeave) : null;
  return `<div class="af-tidy">
    <header class="af-summary">
      <div class="af-stat"><span>${esc(game.i18n.localize("AF.Momentum"))}</span><b>${rt.momentum.value} / ${momentumMax(actor)}</b></div>
      ${armed ? `<div class="af-stat"><span>${esc(game.i18n.localize("AF.ArmedWeave"))}</span><b>${esc(loc(armed.name))}</b>
        <button type="button" class="af-mini" data-af-tidy="disarm" aria-label="${esc(game.i18n.localize("AF.Disarm"))}">×</button></div>` : ""}
      <button type="button" data-af-tidy="open"><i class="fa-solid fa-star"></i> ${esc(game.i18n.localize("AF.Open"))}</button>
    </header>
    ${rows ? `<ul class="af-tidy-list">${rows}</ul>` : `<p class="af-empty">${esc(game.i18n.localize("AF.Empty.loadout"))}</p>`}
  </div>`;
}

function registerTidy(api, openForge) {
  api.registerCharacterTab(new api.models.HtmlTab({
    title: () => game.i18n.localize("AF.Open"),
    tabId: `${MODULE_ID}-tab`,
    iconClass: "fa-solid fa-star",
    html: "",
    renderScheme: "force",
    enabled: data => !!data?.actor?.isOwner,
    onRender: ({ app, tabContentsElement }) => {
      const actor = app.document;
      const el = tabContentsElement;
      if ( !el || !actor ) return;
      el.innerHTML = tidyTabHtml(actor);
      el.querySelectorAll("[data-af-tidy]").forEach(btn => btn.addEventListener("click", async event => {
        event.preventDefault();
        const action = btn.dataset.afTidy;
        if ( action === "open" ) openForge(actor);
        else if ( action === "use" ) await useTechnique(actor, btn.dataset.id);
        else if ( action === "disarm" ) await armWeave(actor, null);
      }));
    }
  }));
}

/* ------------------------------------------------------------------ */

export function registerCompat({ openForge }) {
  Hooks.once("tidy5e-sheet.ready", api => {
    try { registerTidy(api, openForge); }
    catch(err) { console.warn(`${MODULE_ID} | Tidy 5e integration failed`, err); }
  });
}
