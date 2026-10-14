import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = dirname(fileURLToPath(import.meta.url));
const sourceRoot = join(root, "_source");
const stats = { systemId: "RnR", systemVersion: "0.3.6", coreVersion: "13" };
const universalPacks = ["rnr-weapons", "rnr-armors", "rnr-equipment", "rnr-consumables", "rnr-abilities", "rnr-spells", "rnr-extraskills", "rnr-classes", "rnr-races"];
const modes = ["active", "passive", "reaction"];
let total = 0;

for (const pack of universalPacks) {
  const dir = join(sourceRoot, pack);
  const files = readdirSync(dir).filter(file => file.endsWith(".json")).sort();
  if (files.length < 40) throw new Error(`${pack}: expected at least 40 entries, found ${files.length}`);
  files.forEach((file, index) => {
    const path = join(dir, file);
    const doc = JSON.parse(readFileSync(path, "utf8"));
    doc.system = { ...doc.system, universal: true };
    doc.system.source = { ...(doc.system.source || {}), book: "RnR Universal Collection" };
    if (pack === "rnr-extraskills" && index < 40) {
      const mode = modes[index % modes.length];
      doc.system.abilityType = mode;
      doc.system.actionType = mode === "reaction" ? "reaction" : mode === "active" ? "action" : "passive";
      doc.system.description = {
        ...doc.system.description,
        value: `${doc.system.description?.value || doc.name} This Extra Skill is setting-neutral and may be reskinned as training, a perk, implant, technique, gadget, or power. Mode: ${mode.toUpperCase()}.`,
      };
    }
    doc._stats = stats;
    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
    total++;
  });
}
console.log(`Normalized ${total} universal source entries; Extra Skills include active, passive, and reaction modes.`);
