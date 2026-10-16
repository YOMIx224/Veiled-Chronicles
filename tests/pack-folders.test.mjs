import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

import { PACK_FOLDERS, folderId, planFolders } from "../packs/pack-folders.mjs";

const manifest = JSON.parse(readFileSync(new URL("../system.json", import.meta.url), "utf8"));
const sourceDir = pack => new URL(`../packs/_source/${pack}/`, import.meta.url);
const docs = pack => readdirSync(sourceDir(pack)).filter(f => f.endsWith(".json"))
  .map(f => JSON.parse(readFileSync(new URL(f, sourceDir(pack)), "utf8")));

function collectPacks(folders, depth = 1) {
  const names = [];
  for (const folder of folders) {
    assert.ok(depth <= 3, `pack folder "${folder.name}" is nested deeper than Foundry allows`);
    assert.ok(folder.name, "pack folder without a name");
    names.push(...(folder.packs ?? []), ...collectPacks(folder.folders ?? [], depth + 1));
  }
  return names;
}

test("every compendium sits in exactly one sidebar folder", () => {
  const filed = collectPacks(manifest.packFolders ?? []);
  const declared = manifest.packs.map(pack => pack.name).sort();
  assert.deepEqual([...filed].sort(), declared);
});

test("folder rules only target declared packs", () => {
  const declared = new Set(manifest.packs.map(pack => pack.name));
  for (const pack of Object.keys(PACK_FOLDERS)) assert.ok(declared.has(pack), pack);
});

test("every document is filed into a declared folder of the right type", () => {
  for (const pack of manifest.packs) {
    const config = PACK_FOLDERS[pack.name];
    if (!config) continue;
    const sources = docs(pack.name);
    const { folders, folderFor } = planFolders(pack.name, pack.type, sources);
    const ids = new Set(folders.map(folder => folder._id));
    assert.equal(ids.size, folders.length, `${pack.name}: duplicate folder IDs`);
    for (const folder of folders) {
      assert.match(folder._id, /^[A-Za-z0-9]{16}$/);
      assert.equal(folder.type, pack.type);
      assert.ok(config.folders.includes(folder.name), `${pack.name}: undeclared folder "${folder.name}"`);
    }
    for (const doc of sources) {
      const id = folderFor(doc);
      assert.ok(id && ids.has(id), `${pack.name}: ${doc.name} has no folder`);
    }
  }
});

test("folder IDs are stable across builds", () => {
  assert.equal(folderId("rnr-weapons", "Melee Weapons"), folderId("rnr-weapons", "Melee Weapons"));
  assert.notEqual(folderId("rnr-weapons", "Melee Weapons"), folderId("rnr-armors", "Melee Weapons"));
});
