# Ascendant Forge

Build-crafting for **D&D 5e 2024** on Foundry VTT (verified V14 / dnd5e 6.0.3). Original content and rules, available in **English and Thai**.

Characters build up an identity across six linked systems. Each system is data-driven, and all of them share one validation and resolution engine. Native dnd5e advancement, weapon mastery, spellcasting, attack and damage rolls stay in charge. The module adds to them and never replaces them.

| System | What the player chooses | Where |
|---|---|---|
| **Ascendant Constellation** | Nodes on a graph with four roots (Iron, Tide, Lantern, Anchor), bridges and conflicting keystones | `scripts/data/constellation.js` |
| **Ability Techniques** | New tactical actions, reactions and feature modifications | `scripts/data/techniques.js` |
| **Technique Modifiers** | Limited slots per technique; compatibility by tags, kinds and groups | `scripts/data/techniques.js` |
| **Class Evolution** | One path per class; tiers at class level 3/7/11/15 | `scripts/data/progression.js` |
| **Weapon Mastery Expansion** | Paths that require real mastery and augment it | `scripts/data/progression.js` |
| **Advanced Magic (Weaves)** | One weave armed per spell, with exact eligibility and cost | `scripts/data/magic.js` |
| **Build Synergies** | Curated combinations across two or more systems | `scripts/data/synergies.js` |

Open the window from the ★ button in a character sheet's header, or with `AscendantForge.open(actor)`.

## Resolution order and limits

`validate → pay costs → shape → attack → native mastery → damage → one secondary → Momentum → reactions`

- **Closed effect vocabulary** (`constants.EFFECT_KINDS`). There is no multiplier kind, so only native critical hits double dice.
- **Attack:** Forge bonuses total at most +2 per roll. Penalties always apply.
- **Damage:** flat Forge bonuses total at most your proficiency bonus. Each hit gets one rider die (the largest) and at most one damage-type change. A type change converts Forge parts of a matching type too, but never changes amounts.
- **Secondary effects:** one per hit, which the player picks from a chat card. Native weapon mastery is separate.
- **Shape:** a single range, area or target change applies (the largest), within hard limits.
- **Momentum** (the shared resource):
  - Max = proficiency bonus + bonuses (hard cap 8).
  - Gains: at most 2 per round in total, and each source at most once per turn or round.
  - A technique with modifiers can never generate as much Momentum as it costs.
  - A technique that costs Momentum can never be made free.
- **Triggers:** chains are limited to depth 1, and techniques never trigger from other techniques.
- **Magic:** weaves never create or refund spell slots, never remove Concentration, and declare which Metamagic options they exclude.

Content that breaks these rules is rejected when it is registered. Other checks run over the whole registry: dangling references, prerequisite and synergy cycles, unreachable nodes, asymmetric conflicts, Thai text present, and balance notes on evolutions. Rejected content is disabled and listed in the console.

## Respec

| Node respec mode | When it can be refunded |
|---|---|
| `free` | Any time out of combat |
| `rest` | After a long rest, until the next combat starts |
| `locked` | GM only |

Refunds must keep the graph connected and every remaining prerequisite satisfied. Evolution, weapon-path and weave changes follow the `rest` rule once chosen.

## Adding content

```js
Hooks.on("ascendantForge.registerContent", add => add({
  technique: [/* definitions */],
  node: [/* … */]
}));
AscendantForge.lint("technique", def); // → list of problems, empty if valid
```

## What is automated and what isn't

**Automated:**
- Attack and damage parts, damage types and template sizes.
- Momentum gains, reaction prompts, and reaction/bonus-action use by Forge techniques.
- Per-turn and per-rest limits.
- Guard, Slow, Mark and Off-balance effects, which expire at the start of the user's next turn.
- Temporary HP (non-stacking) and save-or-condition riders.
- The passive stat ActiveEffect.

**Manual (shown on the chat card):**
- Moving tokens for push and shift.
- Range and extra targets for spells.
- Triggers the module can't see, such as "an ally is hit", which the player declares by using the reaction.

## Tests

```
node --test tests/engine.test.mjs
```

The engine (`scripts/engine`) and the content (`scripts/data`) have no Foundry dependencies, so they are tested directly in Node. To regenerate the language files after editing `tools/build-lang.py`, run `python tools/build-lang.py`.
