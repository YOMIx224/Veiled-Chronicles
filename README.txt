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

The build script writes Foundry LevelDB data into `packs/<pack-name>/`. **Close Foundry before building in place**: Foundry locks open compendiums, and the build stops with a message if a pack is locked. Every built pack is read back and checked against its source count.

## Health check inside Foundry

As a GM, open the browser console (F12) in any World and run:

```js
await game.RnR.smokeTest()
```

It renders every Actor and Item sheet type, a chat message and one entry of every RnR Compendium, using in-memory documents only. Nothing in the World is created or changed. A table of results is printed to the console.

## Releases

Build a verified, installable ZIP:

```bash
npm ci --prefix packs
node tools/release.mjs
```

The release tool checks the manifest and every core icon path, runs the unit tests, builds all packs into a temporary folder (safe while Foundry is running), writes `dist/RnR-v<version>.zip`, and then reads the ZIP back to confirm that `rnr/system.json` and every pack are inside. Use `--skip-tests` to skip the unit tests.

## Sandbox testing

`node tools/foundry-sandbox.mjs` starts the locally installed Foundry against a separate, temporary data folder with an empty test World (`rnr-sandbox`). Real Worlds are never opened. Join at `http://localhost:30777/join` as Gamemaster and run the health check above.

## Support and releases

This local system manifest does not currently publish a repository, issue tracker, changelog, or distribution URL. Add project-owned URLs to `system.json` before distributing releases.
