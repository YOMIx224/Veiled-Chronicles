/**
 * Ascendant Forge — entry point.
 *
 * Public API: game.modules.get("ascendant-forge").api  (also globalThis.AscendantForge)
 *   open(actor)                       open the build window
 *   useTechnique(actor, id, opts)     use an equipped technique
 *   armWeave(actor, id | null)        arm a weave for the next eligible spell
 *   createTechniqueMacro(actor, id)   hotbar Macro for a technique (drag into BG3 HUD / Monk's Hotbar)
 *   validate(actor)                   full build validation result
 *   registry                          the live content registry (read-only)
 *   lint(type, def)                   validate a content definition without registering it
 *
 * Other modules add content during init:
 *   Hooks.on("ascendantForge.registerContent", add => add({ node: [...], technique: [...] }));
 */
import { MODULE_ID } from "./constants.js";
import { buildRegistry } from "./data/index.js";
import { ContentRegistry } from "./engine/registry.js";
import { setRegistry, getRegistry, validate } from "./foundry/store.js";
import { registerHooks } from "./foundry/integration.js";
import { armWeave, useTechnique } from "./foundry/actions.js";
import { ForgeApp } from "./apps/forge-app.js";
import { createTechniqueMacro, registerCompat } from "./foundry/compat.js";

function registerSettings() {
  const world = (key, type, def) => game.settings.register(MODULE_ID, key, {
    name: `AF.Setting.${key}.name`, hint: `AF.Setting.${key}.hint`, scope: "world", config: true, type, default: def
  });
  world("baseMomentum", Boolean, true);
  world("resetMomentumAfterCombat", Boolean, true);
  world("loadoutInCombat", Boolean, false);
  world("showDropped", Boolean, true);
  game.settings.register(MODULE_ID, "announceMomentum", {
    name: "AF.Setting.announceMomentum.name", hint: "AF.Setting.announceMomentum.hint",
    scope: "client", config: true, type: Boolean, default: true
  });
}

Hooks.once("init", () => {
  registerSettings();
  // Before any module's "ready": Tidy 5e announces its API during ready.
  registerCompat({ openForge: actor => ForgeApp.open(actor) });
  const extras = [];
  Hooks.callAll("ascendantForge.registerContent", bundle => extras.push(bundle));
  const { registry, problems } = buildRegistry(extras);
  setRegistry(registry);
  if ( problems.length ) {
    console.warn(`${MODULE_ID} | ${problems.length} content problem(s); invalid content was disabled:`, problems);
  }
  const api = {
    open: actor => ForgeApp.open(actor),
    useTechnique, armWeave, validate, createTechniqueMacro,
    get registry() { return getRegistry(); },
    lint: (type, def) => ContentRegistry.lint(type, def),
    problems
  };
  game.modules.get(MODULE_ID).api = api;
  globalThis.AscendantForge = api;
});

Hooks.once("ready", () => {
  if ( game.system.id !== "dnd5e" ) {
    ui.notifications.error(game.i18n.localize("AF.WrongSystem"));
    return;
  }
  registerHooks({ openForge: actor => ForgeApp.open(actor) });
  const problems = game.modules.get(MODULE_ID).api.problems;
  if ( problems.length && game.user.isGM ) ui.notifications.warn(game.i18n.format("AF.ContentProblems", { count: problems.length }));

  Hooks.on("updateActor", (actor, changes) => {
    if ( foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`) || foundry.utils.hasProperty(changes, "system") ) ForgeApp.refresh(actor);
  });
});
