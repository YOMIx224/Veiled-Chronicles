// =============================================================
//  smokeTest.js — in-Foundry health check for Role&Roll
// =============================================================
// Run from the browser console (F12) as a GM:  await game.RnR.smokeTest()
//
// Every sheet is rendered for an in-memory document, so the check never
// creates, changes or deletes anything in the World. Results are printed as a
// table and returned so they can be copied into a bug report.

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function check(results, name, fn) {
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => { errors.push(args.map(a => a?.message ?? String(a)).join(" ")); originalError(...args); };
  try {
    const detail = await fn();
    results.push({ check: name, ok: errors.length === 0, detail: errors[0] ?? detail ?? "" });
  } catch (error) {
    results.push({ check: name, ok: false, detail: error?.message ?? String(error) });
  } finally {
    console.error = originalError;
  }
}

async function renderSheet(doc) {
  const sheet = doc.sheet;
  await sheet.render({ force: true });
  await wait(250);
  const rendered = sheet.rendered;
  const nestedForms = sheet.element?.querySelectorAll("form").length ?? 0;
  await sheet.close({ animate: false });
  if (!rendered) throw new Error(`${sheet.constructor.name} did not render`);
  if (nestedForms) throw new Error(`${sheet.constructor.name} contains ${nestedForms} nested <form>`);
  return sheet.constructor.name;
}

export async function runSmokeTest() {
  if (!game.user?.isGM) {
    ui.notifications.warn("RnR smoke test: run this as a GM.");
    return [];
  }
  const results = [];

  await check(results, "System id / version", () => {
    if (game.system.id !== "rnr") throw new Error(`system id is "${game.system.id}", expected "rnr"`);
    return `${game.system.id} ${game.system.version} on Foundry ${game.version}`;
  });

  for (const type of game.documentTypes.Actor.filter(t => t !== "base")) {
    await check(results, `Actor sheet: ${type}`, () =>
      renderSheet(new CONFIG.Actor.documentClass({ name: `Smoke ${type}`, type })));
  }
  for (const type of game.documentTypes.Item.filter(t => t !== "base")) {
    await check(results, `Item sheet: ${type}`, () =>
      renderSheet(new CONFIG.Item.documentClass({ name: `Smoke ${type}`, type })));
  }

  await check(results, "Chat message render hook", async () => {
    const message = new ChatMessage.implementation({ content: "<p>RnR smoke test</p>", speaker: { alias: "RnR" } });
    await message.renderHTML();
    return "renderChatMessageHTML ran";
  });

  for (const pack of game.packs.filter(p => p.metadata.packageName === game.system.id)) {
    await check(results, `Compendium: ${pack.metadata.name}`, async () => {
      const index = await pack.getIndex();
      if (!index.size) throw new Error("pack is empty");
      const first = await pack.getDocument(index.contents[0]._id);
      if (!first) throw new Error("first entry could not be loaded");
      if (["Actor", "Item"].includes(pack.documentName)) await renderSheet(first);
      return `${index.size} entries`;
    });
  }

  await check(results, "Extra Skill Shop data", async () => {
    let total = 0;
    for (const pack of game.packs.filter(p => p.documentName === "Item")) {
      const index = await pack.getIndex({ fields: ["type"] });
      total += index.filter(entry => entry.type === "extraskills").length;
    }
    if (!total) throw new Error("no extraskills found in any Item Compendium");
    return `${total} extra skills available`;
  });

  const failed = results.filter(result => !result.ok);
  console.table(results);
  if (failed.length) ui.notifications.error(`RnR smoke test: ${failed.length} of ${results.length} checks failed. See the console (F12).`);
  else ui.notifications.info(`RnR smoke test: all ${results.length} checks passed.`);
  return results;
}
