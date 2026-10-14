/**
 * build-packs.mjs
 * Compile _source/*.json into Foundry v14-compatible LevelDB packs.
 * Run: node packs/build-packs.mjs
 */
import { ClassicLevel } from "classic-level";
import { readdirSync, readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir  = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dir, "_source");
const outRoot = process.env.RNR_OUTPUT_DIR || __dir;

const requestedPacks = process.env.RNR_PACKS?.split(",").map(p => p.trim()).filter(Boolean);
const sourcePackFolders = readdirSync(srcDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);
const systemManifest = JSON.parse(readFileSync(join(__dir, "..", "system.json"), "utf8"));
const manifestPacks = Array.isArray(systemManifest.packs) ? systemManifest.packs : [];
const manifestNames = manifestPacks.map(pack => pack.name);
const duplicateManifestNames = manifestNames.filter((name, index) => manifestNames.indexOf(name) !== index);
const unregisteredSources = sourcePackFolders.filter(name => !manifestNames.includes(name));
const missingSources = manifestPacks.filter(pack => !sourcePackFolders.includes(pack.name)).map(pack => pack.name);
const wrongPaths = manifestPacks.filter(pack => pack.path !== `packs/${pack.name}`).map(pack => `${pack.name}: ${pack.path}`);
const unknownRequested = (requestedPacks ?? []).filter(name => !sourcePackFolders.includes(name));
const manifestProblems = [
  ...duplicateManifestNames.map(name => `duplicate manifest pack "${name}"`),
  ...unregisteredSources.map(name => `source pack "${name}" is not registered in system.json`),
  ...missingSources.map(name => `manifest pack "${name}" has no source directory`),
  ...wrongPaths.map(name => `manifest path does not match source folder (${name})`),
  ...unknownRequested.map(name => `requested pack "${name}" has no source directory`),
];
if (manifestProblems.length) {
  throw new Error(`Pack manifest validation failed:\n${manifestProblems.map(problem => `  - ${problem}`).join("\n")}`);
}
const packFolders = sourcePackFolders.filter(name => !requestedPacks?.length || requestedPacks.includes(name));

console.log(`\nBuilding ${packFolders.length} pack(s) from ${srcDir}\n`);

for (const pack of packFolders) {
  const inDir  = join(srcDir, pack);
  const outDir = join(outRoot, pack);

  // Keep the existing directory. Removing a LevelDB directory with rmdirSync
  // fails on the Windows-mounted project drive (and may leave stale packs).
  // The database is cleared after opening below, which is portable and atomic.
  mkdirSync(outDir, { recursive: true });

  // Foundry LevelDB packs store each document as a UTF-8 JSON value.
  const db = new ClassicLevel(outDir, { keyEncoding: "utf8", valueEncoding: "utf8" });
  await db.open();

  // Wipe every existing key explicitly. db.clear() silently does nothing on this
  // Windows-mounted path, which left a corrupt "!items!null" record in every Item
  // pack; Foundry then refuses to load the pack, so the whole compendium looked
  // empty. Deleting key-by-key is slower but verifiably correct.
  const stale = [];
  for await (const key of db.keys()) stale.push(key);
  if (stale.length) {
    for (let i = 0; i < stale.length; i += 500) {
      await db.batch(stale.slice(i, i + 500).map(k => ({ type: "del", key: k })));
    }
  }
  let remaining = 0;
  for await (const _ of db.keys()) remaining++;
  if (remaining !== 0) throw new Error(`${pack}: could not clear ${remaining} stale key(s)`);

  const files = readdirSync(inDir).filter(f => f.endsWith(".json"));
  let count = 0;

  const batch = db.batch();
  const seenIds = new Set();
  const problems = [];
  for (const file of files) {
    try {
      const doc = JSON.parse(readFileSync(join(inDir, file), "utf8"));
      if (!doc._id) { problems.push(`${file}: missing _id`); continue; }
      if (!/^[a-zA-Z0-9]{16}$/.test(doc._id)) { problems.push(`${file}: _id "${doc._id}" must be a 16-character alphanumeric ID`); continue; }
      if (seenIds.has(doc._id)) { problems.push(`${file}: duplicate _id ${doc._id}`); continue; }
      seenIds.add(doc._id);
      // Foundry key format depends on the primary document collection.
      const isJournal = doc.pages !== undefined || doc.src !== undefined;
      const isMacro = ["script", "chat"].includes(doc.type) && typeof doc.command === "string";
      const isActor = ["character", "npc", "vehicle"].includes(doc.type) && doc.prototypeToken !== undefined;
      const collection = isJournal ? "journal" : isMacro ? "macros" : isActor ? "actors" : "items";
      const key = `!${collection}!${doc._id}`;
      if (isJournal) {
        // Foundry stores JournalEntryPage documents as separate embedded records.
        // The parent JournalEntry references page IDs; writing the full page
        // objects inline makes the Journal open with an empty page sidebar.
        const pages = Array.isArray(doc.pages) ? doc.pages : [];
        const journal = { ...doc, pages: pages.map(page => page._id) };
        batch.put(key, JSON.stringify(journal));
        const seenPageIds = new Set();
        for (const page of pages) {
          if (!page._id) { problems.push(`${file}: Journal page missing _id`); continue; }
          if (!/^[a-zA-Z0-9]{16}$/.test(page._id)) { problems.push(`${file}: Journal page _id "${page._id}" must be a 16-character alphanumeric ID`); continue; }
          if (seenPageIds.has(page._id)) { problems.push(`${file}: duplicate Journal page _id ${page._id}`); continue; }
          seenPageIds.add(page._id);
          const pageKey = `!journal.pages!${doc._id}.${page._id}`;
          const pageDoc = { ...page };
          delete pageDoc._key;
          batch.put(pageKey, JSON.stringify(pageDoc));
        }
      } else {
        const document = { ...doc };
        delete document._key;
        batch.put(key, JSON.stringify(document));
      }
      count++;
    } catch (e) {
      problems.push(`${file}: ${e.message}`);
    }
  }

  await batch.write();
  await db.close();

  if (problems.length) {
    for (const p of problems) console.error(`  ✗ ${p}`);
    throw new Error(`${pack}: ${problems.length} source file(s) rejected — pack is incomplete`);
  }
  console.log(`  ✓ ${pack.padEnd(24)} ${count} document(s)`);
}

console.log("\n✅ All packs built. Restart/reload Foundry to see changes.\n");
