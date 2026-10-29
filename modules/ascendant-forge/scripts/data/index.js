/**
 * Default content bundle and registry factory.
 */
import { ContentRegistry } from "../engine/registry.js";
import { NODES } from "./constellation.js";
import { TECHNIQUES, MODIFIERS } from "./techniques.js";
import { EVOLUTIONS, WEAPON_PATHS } from "./progression.js";
import { WEAVES } from "./magic.js";
import { SYNERGIES } from "./synergies.js";

export const DEFAULT_CONTENT = Object.freeze({
  node: NODES, technique: TECHNIQUES, modifier: MODIFIERS, evolution: EVOLUTIONS,
  weaponPath: WEAPON_PATHS, weave: WEAVES, synergy: SYNERGIES
});

/**
 * Build a registry from the default content plus any extra bundles.
 * Registration order matters only for duplicate detection: defaults first.
 * @param {Array<Record<string, object[]>>} extras
 * @returns {{registry: ContentRegistry, problems: string[]}}
 */
export function buildRegistry(extras = []) {
  const registry = new ContentRegistry();
  const problems = [];
  for ( const bundle of [DEFAULT_CONTENT, ...extras] ) {
    for ( const [type, defs] of Object.entries(bundle) ) problems.push(...registry.registerMany(type, defs ?? []));
  }
  problems.push(...registry.validateAll());
  return { registry, problems };
}
