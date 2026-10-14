# Role&Roll (RnR)

Role&Roll is a setting-neutral tabletop RPG system for Foundry Virtual Tabletop 13–14.

## Installation and first use

1. Place this folder in your Foundry data `systems` directory.
2. Start Foundry, create or open a world, and select Role&Roll as its game system.
3. Create a Character actor, set its name and portrait using Foundry's actor configuration, then complete its biography and details.
4. Set the campaign profile and optional rules in **Game Settings > Configure Settings > RnR**.
5. Open the automatically created **RnR — Session 0 Guide** in the Journal Directory before the first session.
6. Import weapons, armor, equipment, abilities, and other content from the supplied Compendiums.

## Character creation

- Every attribute starts at **8**.
- Characters receive **30 base State Points** to raise attributes.
- Each point raises one attribute rating; the State Point dialog prevents ratings below 8 and above 20.
- Growth Points and disabled organs can increase the available State Point pool.
- Attribute modifiers use the configurable Attribute Baseline; its default value is 8, so new characters begin at +0.

See [RULES.md](RULES.md) for the automated rules, configurable defaults, and GM decisions.

## Compendium maintenance

Edit source JSON in `packs/_source/`, install the pack dependencies, and build from the system root:

```bash
npm install --prefix packs
node packs/build-packs.mjs
```

To build selected packs only, set `RNR_PACKS` to a comma-separated list:

```bash
RNR_PACKS=rnr-weapons,rnr-armors node packs/build-packs.mjs
```

The build script writes Foundry LevelDB data into `packs/<pack-name>/`. Reload Foundry after a successful build.

## Support and releases

This local system manifest does not currently publish a repository, issue tracker, changelog, or distribution URL. Add project-owned URLs to `system.json` before distributing releases.
