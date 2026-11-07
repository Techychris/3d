import test from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers.mjs";
import { ICONS, iconSvg, iconEl } from "../../src/ui/icons.js";

test("every icon has a label and SVG body on the 24px grid", () => {
  const names = Object.keys(ICONS);
  assert.ok(names.length >= 30);
  for (const n of names) {
    assert.match(ICONS[n].label, /\S/);
    assert.match(ICONS[n].body, /^<(path|rect|circle)/, n);
    for (const m of ICONS[n].body.matchAll(/-?(\d*\.\d+|\d+)/g)) {
      const v = Number(m[0]);
      assert.ok(Math.abs(v) <= 24, `${n}: value ${v} larger than the 24px grid`);
    }
  }
});

test("the icons the UI uses all exist", () => {
  for (const n of ["pause", "play", "settings", "codex", "back", "reroll", "skip", "daily", "music", "sound", "vigor", "ember", "endings",
    "attack", "dodge", "bash", "fire", "frost", "bleed", "crit", "shield", "speed", "summon",
    "battle", "elite", "treasure", "rest", "boss", "stairs"]) assert.ok(ICONS[n], n);
});

test("iconSvg: decorative by default, titled and labelled on request, empty for unknown names", () => {
  const plain = iconSvg("pause");
  assert.match(plain, /^<svg viewBox="0 0 24 24"/);
  assert.match(plain, /stroke="currentColor"/);
  assert.match(plain, /aria-hidden="true"/);
  assert.doesNotMatch(plain, /<title>/);
  const titled = iconSvg("boss", "Boss room");
  assert.match(titled, /role="img" aria-label="Boss room"><title>Boss room<\/title>/);
  assert.equal(iconSvg("no-such-icon"), "");
});

test("iconEl builds a hidden span with the SVG, using the given or the global document", async () => {
  const dom = await installDom();
  try {
    const a = iconEl("fire");
    assert.equal(a.tagName, "SPAN");
    assert.equal(a.className, "ico ico-fire");
    assert.equal(a.getAttribute("aria-hidden"), "true");
    assert.ok(a.querySelector("svg path"));
    const b = iconEl("frost", dom.window.document);
    assert.ok(b.querySelector("svg"));
    assert.equal(iconEl("nope").innerHTML, "");
  } finally { dom.cleanup(); }
});
