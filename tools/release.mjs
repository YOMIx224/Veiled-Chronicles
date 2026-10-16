/**
 * release.mjs — build and verify an installable Role&Roll ZIP.
 *
 *   node tools/release.mjs              tests + packs + ZIP into dist/
 *   node tools/release.mjs --skip-tests skip `node --test tests/`
 *
 * The compendium packs are built into a temporary directory, so this is safe to
 * run while Foundry has the installed packs open. The ZIP is read back after it
 * is written: an archive with missing or empty files fails the release instead
 * of being shipped.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync, inflateRawSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const manifest = JSON.parse(readFileSync(join(root, "system.json"), "utf8"));
const zipFolder = manifest.id;

/** Shipped from the source tree. Generated LevelDB packs are added separately. */
const INCLUDE = ["system.json", "template.json", "README.txt", "RULES.md", "lang", "scripts", "styles", "templates", "docs",
  "packs/_source", "packs/build-packs.mjs", "packs/pack-folders.mjs", "packs/generate-universal-content.mjs", "packs/normalize-universal-content.mjs",
  "packs/package.json", "packs/package-lock.json", "tools", "tests"];
const LEVELDB_SKIP = new Set(["LOCK", "LOG", "LOG.old"]);

function step(label) { console.log(`\n▶ ${label}`); }
function fail(message) { console.error(`\n✗ ${message}`); process.exit(1); }

function walk(path) {
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  return readdirSync(path).flatMap(name => (name === "node_modules" ? [] : walk(join(path, name))));
}

// ── 1. Manifest ───────────────────────────────────────────────
step(`Manifest ${manifest.id} v${manifest.version}`);
if (!/^[a-z0-9-]+$/.test(manifest.id)) fail(`system.json id "${manifest.id}" must stay lowercase`);
const declared = [...(manifest.esmodules ?? []), ...(manifest.styles ?? []), ...(manifest.languages ?? []).map(l => l.path)];
const missing = declared.filter(path => !existsSync(join(root, path)));
if (missing.length) fail(`system.json references missing files: ${missing.join(", ")}`);
const wrongSystem = (manifest.packs ?? []).filter(pack => pack.system !== manifest.id).map(pack => pack.name);
if (wrongSystem.length) fail(`packs not declared for system "${manifest.id}": ${wrongSystem.join(", ")}`);
console.log(`  ${declared.length} declared files present, ${manifest.packs.length} packs declared`);

// ── 1b. Core icon paths ───────────────────────────────────────
// Foundry v14 ships fewer core icons than v13; a path that no longer exists
// shows as a broken image in the Compendium. Checked when Foundry is installed.
const foundryPublic = join(process.env.FOUNDRY_APP ?? "C:/Program Files/Foundry Virtual Tabletop", "resources", "app", "public");
if (existsSync(join(foundryPublic, "icons"))) {
  step("Core icon paths");
  const sources = [...walk(join(root, "packs", "_source")), ...walk(join(root, "scripts")), ...walk(join(root, "templates"))];
  const broken = [];
  for (const file of sources) {
    for (const match of readFileSync(file, "utf8").matchAll(/icons\/[A-Za-z0-9_\-/]+\.(?:webp|svg|png|jpg)/g)) {
      if (!existsSync(join(foundryPublic, match[0]))) broken.push(`${relative(root, file)}: ${match[0]}`);
    }
  }
  if (broken.length) fail(`icon paths missing from this Foundry install:\n  ${broken.slice(0, 20).join("\n  ")}`);
  console.log(`  all icon paths exist in ${foundryPublic}`);
}

// ── 2. Tests ──────────────────────────────────────────────────
if (args.has("--skip-tests")) {
  step("Tests skipped (--skip-tests)");
} else {
  step("Unit tests");
  const testFiles = readdirSync(join(root, "tests")).filter(name => name.endsWith(".test.mjs")).map(name => join(root, "tests", name));
  const result = spawnSync(process.execPath, ["--test", ...testFiles], { cwd: root, encoding: "utf8" });
  const summary = (result.stdout ?? "").split("\n").filter(line => /^# (tests|pass|fail)/.test(line)).join("  ");
  console.log(`  ${summary}`);
  if (result.status !== 0) { console.error(result.stdout?.slice(-4000)); fail("unit tests failed"); }
}

// ── 3. Compendium packs (temporary output) ────────────────────
step("Compendium packs");
if (!existsSync(join(root, "packs", "node_modules", "classic-level"))) fail("run `npm ci --prefix packs` first");
const packOut = mkdtempSync(join(tmpdir(), "rnr-packs-"));
const build = spawnSync(process.execPath, [join(root, "packs", "build-packs.mjs")], {
  cwd: root, encoding: "utf8", env: { ...process.env, RNR_OUTPUT_DIR: packOut, RNR_PACKS: "" },
});
process.stdout.write(build.stdout ?? "");
if (build.status !== 0) { console.error(build.stderr); fail("pack build failed"); }

// ── 4. Collect files ──────────────────────────────────────────
step("Collect files");
const entries = [];
for (const item of INCLUDE) {
  const abs = join(root, item);
  if (!existsSync(abs)) continue;
  for (const file of walk(abs)) entries.push({ name: `${zipFolder}/${relative(root, file).split(sep).join("/")}`, file });
}
for (const pack of manifest.packs) {
  const dir = join(packOut, pack.name);
  const files = readdirSync(dir).filter(name => !LEVELDB_SKIP.has(name));
  if (!files.includes("CURRENT")) fail(`${pack.name}: built pack has no CURRENT file`);
  for (const name of files) entries.push({ name: `${zipFolder}/${pack.path}/${name}`, file: join(dir, name) });
}
const empty = entries.filter(entry => statSync(entry.file).size === 0 && !entry.name.endsWith(".log"));
if (empty.length) fail(`empty files would be shipped: ${empty.map(e => e.name).join(", ")}`);
console.log(`  ${entries.length} files`);

// ── 5. Write ZIP ──────────────────────────────────────────────
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function dosTime(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

step("Write ZIP");
const locals = [];
const centrals = [];
let offset = 0;
const now = dosTime(new Date());
for (const entry of entries) {
  const data = readFileSync(entry.file);
  const compressed = deflateRawSync(data, { level: 9 });
  const name = Buffer.from(entry.name, "utf8");
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(8, 8); local.writeUInt16LE(now.time, 10); local.writeUInt16LE(now.date, 12);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(now.time, 12);
  central.writeUInt16LE(now.date, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
  locals.push(local, name, compressed);
  centrals.push(central, name);
  offset += local.length + name.length + compressed.length;
}
const centralSize = centrals.reduce((total, buffer) => total + buffer.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...locals, ...centrals, end]);
const distDir = join(root, "dist");
mkdirSync(distDir, { recursive: true });
const zipPath = join(distDir, `RnR-v${manifest.version}.zip`);
writeFileSync(zipPath, zip);

// ── 6. Verify ZIP by reading it back ──────────────────────────
step("Verify ZIP");
const check = readFileSync(zipPath);
const eocd = check.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
const count = check.readUInt16LE(eocd + 10);
let pointer = check.readUInt32LE(eocd + 16);
const names = new Map();
for (let i = 0; i < count; i++) {
  const nameLength = check.readUInt16LE(pointer + 28);
  const extra = check.readUInt16LE(pointer + 30) + check.readUInt16LE(pointer + 32);
  const name = check.toString("utf8", pointer + 46, pointer + 46 + nameLength);
  const localOffset = check.readUInt32LE(pointer + 42);
  const size = check.readUInt32LE(pointer + 24);
  names.set(name, { localOffset, size, compressed: check.readUInt32LE(pointer + 20) });
  pointer += 46 + nameLength + extra;
}
if (count !== entries.length) fail(`ZIP lists ${count} files, expected ${entries.length}`);
const readEntry = name => {
  const info = names.get(name);
  const start = info.localOffset + 30 + check.readUInt16LE(info.localOffset + 26) + check.readUInt16LE(info.localOffset + 28);
  return inflateRawSync(check.subarray(start, start + info.compressed));
};
const shippedManifest = JSON.parse(readEntry(`${zipFolder}/system.json`).toString("utf8"));
if (shippedManifest.id !== manifest.id || shippedManifest.version !== manifest.version) fail("system.json inside the ZIP does not match");
for (const path of declared) if (!names.has(`${zipFolder}/${path}`)) fail(`ZIP is missing ${path}`);
for (const pack of manifest.packs) {
  if (!names.has(`${zipFolder}/${pack.path}/CURRENT`)) fail(`ZIP is missing ${pack.path}/CURRENT`);
}
const sha = createHash("sha256").update(check).digest("hex").slice(0, 16);
rmSync(packOut, { recursive: true, force: true });
console.log(`  ${count} files, ${(check.length / 1024).toFixed(0)} KB, sha256 ${sha}…`);
console.log(`\n✅ ${relative(root, zipPath)} — unzip into Data/systems/ so the result is Data/systems/${zipFolder}/system.json\n`);
