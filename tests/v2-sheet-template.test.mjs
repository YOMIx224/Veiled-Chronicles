import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const templates = ["actor-sheet.html", "npc-sheet.html", "item-sheet.html"];
const scripts = readFileSync(new URL("../scripts/RnR.js", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../system.json", import.meta.url), "utf8"));

test("DocumentSheetV2 templates do not create nested form elements", () => {
  for (const name of templates) {
    const html = readFileSync(new URL(`../templates/${name}`, import.meta.url), "utf8");
    assert.doesNotMatch(html, /<\/?form\b/i, `${name} must rely on DocumentSheetV2's top-level form`);
    assert.match(html.trimStart(), /^<div\b/i, `${name} should have one root element`);
  }
});

test("all custom document sheets explicitly use the outer form tag", () => {
  for (const className of ["RnRActorSheet", "RnRNpcSheet", "RnRItemSheet"]) {
    assert.match(scripts, new RegExp(`class ${className}[\\s\\S]*?tag: "form"`));
  }
});

test("all v2 sheets compose the Handlebars renderer into their base classes", () => {
  assert.match(scripts, /HandlebarsApplicationMixin\(\s*foundry\.applications\.sheets\.ActorSheetV2\s*\)/);
  assert.match(scripts, /HandlebarsApplicationMixin\(\s*foundry\.applications\.sheets\.ItemSheetV2\s*\)/);
  assert.match(scripts, /class RnRActorSheet extends RnRHandlebarsActorSheet/);
  assert.match(scripts, /class RnRNpcSheet extends RnRHandlebarsActorSheet/);
  assert.match(scripts, /class RnRItemSheet extends RnRHandlebarsItemSheet/);
});

test("document sheets register through the Foundry v13+ namespace", () => {
  assert.equal((scripts.match(/foundry\.applications\.apps\.DocumentSheetConfig\.registerSheet/g) ?? []).length, 3);
  assert.doesNotMatch(scripts, /^\s*DocumentSheetConfig\.registerSheet/m);
});

test("system manifest uses a lowercase id and matches pack system metadata", () => {
  assert.equal(manifest.id, "rnr");
  assert.match(manifest.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(manifest.packs.every(pack => pack.system === manifest.id));
});

test("sheet template URLs use the lowercase installed system directory", () => {
  assert.equal((scripts.match(/systems\/rnr\/templates\//g) ?? []).length, 3);
  assert.doesNotMatch(scripts, /systems\/RnR\/templates\//);
});
