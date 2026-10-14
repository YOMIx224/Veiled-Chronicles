/**
 * foundry-sandbox.mjs — run Foundry against a throwaway data folder.
 *
 *   node tools/foundry-sandbox.mjs [--port 30777] [--data <dir>]
 *
 * Copies this system and the local Foundry licence into a separate data path,
 * creates an empty test World ("rnr-sandbox") and starts the Foundry server
 * there. Real Worlds under Data/worlds are never opened or modified. Open
 * http://localhost:<port>/join, join as Gamemaster, then run
 * `await game.RnR.smokeTest()` in the browser console.
 *
 * Environment:
 *   FOUNDRY_APP       Foundry install folder (default: C:/Program Files/Foundry Virtual Tabletop)
 *   FOUNDRY_USERDATA  Real user data folder holding Config/license.json
 *                     (default: %LOCALAPPDATA%/FoundryVTT)
 */
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : fallback; };

const port = Number(option("--port", 30777));
const dataPath = option("--data", join(tmpdir(), "rnr-foundry-sandbox"));
const appDir = process.env.FOUNDRY_APP ?? "C:/Program Files/Foundry Virtual Tabletop";
const userData = process.env.FOUNDRY_USERDATA ?? join(process.env.LOCALAPPDATA ?? "", "FoundryVTT");
const exe = join(appDir, "Foundry Virtual Tabletop.exe");
const mainScript = join(appDir, "resources", "app", "main.mjs");

if (!existsSync(mainScript)) throw new Error(`Foundry not found at ${appDir}; set FOUNDRY_APP`);
if (!existsSync(join(userData, "Config", "license.json"))) throw new Error(`No licence at ${userData}/Config; set FOUNDRY_USERDATA`);
if (dataPath.replace(/\\/g, "/").toLowerCase() === userData.replace(/\\/g, "/").toLowerCase()) {
  throw new Error("The sandbox data path must not be the real Foundry data folder");
}

// Fresh copy of the system on every launch; the sandbox World is kept.
const systemDir = join(dataPath, "Data", "systems", "rnr");
rmSync(systemDir, { recursive: true, force: true });
mkdirSync(join(dataPath, "Config"), { recursive: true });
cpSync(root, systemDir, {
  recursive: true,
  filter: src => !/[\\/](\.git|\.claude|node_modules|dist)([\\/]|$)/.test(src.slice(root.length)) && !/[\\/]LOCK$/.test(src),
});
cpSync(join(userData, "Config", "license.json"), join(dataPath, "Config", "license.json"));
// Foundry rejects a World manifest without coreVersion, so take it from the install.
const release = JSON.parse(readFileSync(join(appDir, "resources", "app", "package.json"), "utf8")).release ?? {};
const coreVersion = `${release.generation ?? 14}.${release.build ?? 0}`;
const worldDir = join(dataPath, "Data", "worlds", "rnr-sandbox");
mkdirSync(worldDir, { recursive: true });
const worldFile = join(worldDir, "world.json");
const world = existsSync(worldFile) ? JSON.parse(readFileSync(worldFile, "utf8")) : {};
writeFileSync(worldFile, JSON.stringify({
  ...world,
  id: "rnr-sandbox", title: "RnR Sandbox", system: "rnr", coreVersion,
  compatibility: { minimum: String(release.generation ?? 13), verified: String(release.generation ?? 14) },
}, null, 2));
writeFileSync(join(dataPath, "Config", "options.json"), JSON.stringify({
  dataPath, port, upnp: false, hotReload: true, world: "rnr-sandbox", telemetry: false,
}, null, 2));

// Foundry's Electron build bundles the Node version it needs. Run its server in
// plain-Node mode; hiding process.versions.electron stops it opening a window.
const launcher = join(dataPath, "launch.mjs");
writeFileSync(launcher, [
  "const versions = { ...process.versions }; delete versions.electron;",
  "Object.defineProperty(process, \"versions\", { value: versions, configurable: true });",
  `await import(${JSON.stringify(pathToFileURL(mainScript).href)});`,
].join("\n"));

console.log(`RnR sandbox: http://localhost:${port}/join  (data: ${dataPath})`);
const child = spawn(exe, [launcher, `--dataPath=${dataPath}`, `--port=${port}`, "--noupnp", "--world=rnr-sandbox"], {
  cwd: join(appDir, "resources", "app"),
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  stdio: "inherit",
});
child.on("exit", code => process.exit(code ?? 0));
