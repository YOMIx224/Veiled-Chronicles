# RnR Compendium Source Files

Each directory in `_source/` contains JSON source documents for one Foundry compendium pack. Edit those JSON files directly, then build the LevelDB packs with the repository script.

## Layout

```text
packs/
  _source/              Source JSON; edit files here
    rnr-weapons/
    rnr-armors/
    rnr-consumables/
    rnr-spells/
    rnr-abilities/
    rnr-extraskills/
    rnr-classes/
    rnr-backgrounds/
    rnr-races/
    rnr-equipment/
  rnr-weapons/          Generated LevelDB; Foundry reads this
  rnr-armors/
  ...
```

## Build

The build script uses the local `classic-level` dependency. From the system root:

```bash
npm install --prefix packs
node packs/build-packs.mjs
```

Build selected packs by setting `RNR_PACKS` to a comma-separated list:

```bash
RNR_PACKS=rnr-weapons,rnr-armors node packs/build-packs.mjs
```

Set `RNR_OUTPUT_DIR` only when generated packs must be written outside `packs/`. Reload Foundry after a successful build.

## Add an item

1. Create a JSON file in the appropriate `_source/<pack>/` directory.
2. Give it a unique 16-character alphanumeric `_id`.
3. Set `type` to the matching document type, such as `weapon`, `armor`, or `spell`.
4. Run the build command.
5. Reload Foundry and verify the compendium.

## Important fields

### Weapon

- `attribute`: Attribute used for attack rolls.
- `damageFormula`: A dice formula such as `1d6` or `2d8+3`.
- `damageType`: Damage category such as `physical`, `piercing`, `slashing`, `bludgeoning`, or `fire`.
- `weaponType`: `melee` or `ranged`.
- `attackBonus`: Flat bonus in addition to the attribute modifier.

### Armor

- `armorType`: `light`, `medium`, `heavy`, or `shield`.
- `armorValue`: Armor contribution to the actor's defence.

### Extra Skill

- `category`: `communication`, `physical`, `investigation`, `science`, `combat`, `arts`, or `other`.
- `cost`: Number of Extra Skill Points required.

## Folders

Do not put folder IDs in source files. `packs/pack-folders.mjs` files every
document into a compendium folder when the packs are built (for example
Weapons → Melee / Ranged, Extra Skills → by category), so a new item lands in
the right folder automatically. To add or rename a folder, edit the `folders`
list and `rule` for that pack there.

The grouping of the compendiums themselves in the Compendium sidebar
(Role&Roll → Rules & Guides, Character Creation, Abilities & Spells, Gear,
Mecha) is declared in `packFolders` in `system.json`.
