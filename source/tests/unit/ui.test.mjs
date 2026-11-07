// Unit tests for src/ui/ui.js (HUD + overlays) and src/ui/style.js (stylesheet string).
import { describe, it, before, after, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { installDom, spy } from "./helpers.mjs";
import { createUI } from "../../src/ui/ui.js";
import CSS from "../../src/ui/style.js";

let dom, doc, win, rootEl, ui;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const q = (sel, from = rootEl) => from.querySelector(sel);
const qa = (sel, from = rootEl) => [...from.querySelectorAll(sel)];
const button = (text) => qa("button").find((b) => b.textContent === text);
const overlay = () => q(".screen:not(.rotate)");
const press = (key, opts = {}, target = doc.body) => {
  const e = new win.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts });
  target.dispatchEvent(e);
  return e;
};

before(async () => {
  dom = await installDom();
  doc = dom.window.document;
  win = dom.window;
});
after(() => dom.cleanup());

beforeEach(() => {
  rootEl = doc.createElement("div");
  doc.body.append(rootEl);
  ui = createUI(rootEl);
});
afterEach(() => {
  ui.hideAll();
  rootEl.remove();
  mock.restoreAll();
});

describe("createUI setup", () => {
  it("mounts a .dusk-ui root inside rootEl and returns the root as el", () => {
    assert.equal(ui.el.parentNode, rootEl);
    assert.equal(ui.el.classList.contains("dusk-ui"), true);
  });

  it("injects the stylesheet exactly once per document", () => {
    const styles = doc.querySelectorAll("#dusk-ui-style");
    assert.equal(styles.length, 1);
    assert.equal(styles[0].textContent, CSS);
    const other = doc.createElement("div");
    doc.body.append(other);
    createUI(other);
    assert.equal(doc.querySelectorAll("#dusk-ui-style").length, 1);
    other.remove();
  });

  it("style.js exports the generated stylesheet for the .dusk-ui scope", () => {
    assert.equal(typeof CSS, "string");
    assert.ok(CSS.includes(".dusk-ui .hud{"));
    assert.ok(CSS.includes(".dusk-tbtn.dodge::before"));
  });

  it("ignores Escape when no overlay is open", () => {
    const e = press("Escape");
    assert.equal(e.defaultPrevented, false);
    assert.equal(q(".hud").hidden, true);
  });

  it("ignores keys with Ctrl, Meta or Alt held even while a shrine is open", () => {
    const takes = [];
    ui.showShrine([{ id: "a", name: "A" }, { id: "b", name: "B" }], { onTake: (id) => takes.push(id) });
    press("2", { ctrlKey: true });
    press("2", { metaKey: true });
    press("2", { altKey: true });
    assert.deepEqual(takes, []);
    assert.equal(qa(".card")[0].classList.contains("sel"), true);
  });
});

describe("HUD", () => {
  const hud = () => q(".hud");

  it("is hidden until shown, and show(v) toggles it", () => {
    assert.equal(hud().hidden, true);
    ui.hud.show(true);
    assert.equal(hud().hidden, false);
    ui.hud.show(false);
    assert.equal(hud().hidden, true);
  });

  it("fills the health bar, text and meter attributes", () => {
    ui.hud.update({ hp: 20, maxHp: 100, currency: 7 });
    assert.equal(q(".bar.hp > i:not(.sh)").style.width, "20%");
    assert.equal(q(".bar.hp b").textContent, "20 / 100");
    assert.equal(q(".bar.hp").classList.contains("low"), true);
    assert.equal(q(".bar.hp").getAttribute("aria-valuenow"), "20");
    assert.equal(q(".bar.hp").getAttribute("aria-valuemax"), "100");
    assert.equal(q(".bar.hp").getAttribute("aria-valuemin"), "0");
    assert.equal(q(".coin").textContent, "7");
  });

  it("rounds health up in the text and flags low health only below 30%", () => {
    ui.hud.update({ hp: 29.2, maxHp: 100 });
    assert.equal(q(".bar.hp b").textContent, "30 / 100");
    assert.equal(q(".bar.hp").classList.contains("low"), true);
    ui.hud.update({ hp: 30, maxHp: 100 });
    assert.equal(q(".bar.hp").classList.contains("low"), false);
  });

  it("shows shield as an extra figure, a capped shield bar, and hides it at zero", () => {
    ui.hud.update({ hp: 30, maxHp: 100, shield: 12 });
    const shield = q(".bar.hp > i.sh");
    assert.equal(q(".bar.hp b").textContent, "30 / 100  +12");
    assert.equal(shield.style.display, "");
    assert.equal(shield.style.width, "12%");
    ui.hud.update({ hp: 30, maxHp: 100, shield: 250 });
    assert.equal(shield.style.width, "100%");
    assert.equal(q(".bar.hp b").textContent, "30 / 100  +250");
    ui.hud.update({ hp: 30, maxHp: 100, shield: 0 });
    assert.equal(shield.style.display, "none");
  });

  it("uses safe defaults when called with no state", () => {
    ui.hud.update();
    assert.equal(q(".bar.hp b").textContent, "0 / 1");
    assert.equal(q(".bar.hp").classList.contains("low"), true);
    assert.equal(q(".coin").textContent, "0");
    assert.equal(q(".foes").textContent, "");
    assert.equal(q(".fl").textContent, "");
    assert.equal(q(".hud-top").hidden, true);
  });

  it("toggles the touch class on the HUD", () => {
    ui.hud.update({ touch: true });
    assert.equal(hud().classList.contains("touch"), true);
    ui.hud.update({ touch: false });
    assert.equal(hud().classList.contains("touch"), false);
  });

  it("labels the floor, room type and progress count", () => {
    const path = ["elite", "treasure", "rest"];
    const fl = () => q(".fl").textContent;
    ui.hud.update({ floor: 2, rooms: 4, room: 0, path });
    assert.equal(fl(), "Floor 2 · Elite 1 of 3");
    ui.hud.update({ floor: 2, rooms: 4, room: 1, path });
    assert.equal(fl(), "Floor 2 · Treasure 2 of 3");
    ui.hud.update({ floor: 2, rooms: 4, room: 2, path });
    assert.equal(fl(), "Floor 2 · Rest 3 of 3");
    ui.hud.update({ floor: 2, rooms: 4, room: 3, path });
    assert.equal(fl(), "Floor 2 · Boss");
  });

  it("falls back to a generic room label and handles floors without rooms", () => {
    ui.hud.update({ floor: 1, rooms: 4, room: 1, path: ["fight", "fight", "fight"] });
    assert.equal(q(".fl").textContent, "Floor 1 · Room 2 of 3");
    ui.hud.update({ floor: 5, rooms: 0, room: 0 });
    assert.equal(q(".fl").textContent, "Floor 5");
    ui.hud.update({ floor: null });
    assert.equal(q(".fl").textContent, "");
  });

  it("draws one progress pip per room with done, now, type and boss classes", () => {
    ui.hud.update({ floor: 2, rooms: 4, room: 1, path: ["elite", "treasure", "rest"] });
    const pips = qa(".pips > i");
    assert.equal(pips.length, 4);
    assert.equal(pips[0].classList.contains("elite"), true);
    assert.equal(pips[0].classList.contains("done"), true);
    assert.equal(pips[1].classList.contains("treasure"), true);
    assert.equal(pips[1].classList.contains("now"), true);
    assert.equal(pips[2].classList.contains("rest"), true);
    assert.equal(pips[2].classList.contains("done"), false);
    assert.equal(pips[2].classList.contains("now"), false);
    assert.equal(pips[3].classList.contains("boss"), true);
    assert.equal(pips[3].title, "boss");
    assert.equal(pips[0].title, "elite");
  });

  it("marks the boss pip as current in the boss room", () => {
    ui.hud.update({ floor: 2, rooms: 3, room: 2, path: ["elite", "rest"] });
    const pips = qa(".pips > i");
    assert.equal(pips[2].classList.contains("boss"), true);
    assert.equal(pips[2].classList.contains("now"), true);
    assert.equal(pips[1].classList.contains("done"), true);
  });

  it("leaves a pip untyped when the path is shorter than the room count", () => {
    ui.hud.update({ floor: 1, rooms: 3, room: 0, path: ["elite"] });
    const pips = qa(".pips > i");
    assert.equal(pips[1].title, "");
    assert.equal(pips[1].classList.contains("now"), false);
    assert.equal(pips[2].title, "boss");
  });

  it("describes foes left, a chosen portal, or an open portal", () => {
    const foes = () => q(".foes");
    ui.hud.update({ foes: 1 });
    assert.equal(foes().textContent, "1 foe left");
    ui.hud.update({ foes: 3 });
    assert.equal(foes().textContent, "3 foes left");
    assert.equal(foes().classList.contains("clear"), false);
    ui.hud.update({ foes: 0, exitCount: 2 });
    assert.equal(foes().textContent, "Choose a portal");
    assert.equal(foes().classList.contains("clear"), true);
    ui.hud.update({ foes: 0, exitCount: 1 });
    assert.equal(foes().textContent, "Portal open");
    ui.hud.update({ foes: 0 });
    assert.equal(foes().textContent, "Portal open");
  });

  it("shows the Saved chip only while the save flag is set", () => {
    const chip = () => q(".saved");
    ui.hud.update({ saved: true });
    assert.equal(chip().classList.contains("show"), true);
    ui.hud.update({ saved: false });
    assert.equal(chip().classList.contains("show"), false);
  });

  it("renders build chips sorted by count, with pips and on/max classes", () => {
    ui.hud.update({ tags: { fire: 3, frost: 2, bleed: 1, crit: 0 } });
    const chips = qa(".tagchip");
    assert.deepEqual(chips.map((c) => c.querySelector("span").textContent), ["Fire", "Frost", "Bleed"]);
    assert.equal(chips[0].classList.contains("max"), true);
    assert.equal(chips[1].classList.contains("on"), true);
    assert.equal(chips[2].classList.contains("on"), false);
    assert.equal(chips[2].classList.contains("max"), false);
    assert.deepEqual(chips.map((c) => c.querySelectorAll(".dots > i.f").length), [3, 2, 1]);
    assert.equal(chips[0].querySelectorAll(".dots > i").length, 3);
    assert.equal(chips[0].getAttribute("aria-label"), "Fire 3 of 3, bonus active");
    assert.equal(chips[2].getAttribute("aria-label"), "Bleed 1 of 3");
  });

  it("uses the raw key for unknown tags and clears chips when no tags remain", () => {
    ui.hud.update({ tags: { zap: 1 } });
    assert.equal(q(".tagchip span").textContent, "zap");
    ui.hud.update({});
    assert.equal(qa(".tagchip").length, 0);
  });

  it("keeps existing chip elements when the tags have not changed", () => {
    ui.hud.update({ tags: { fire: 1 } });
    const first = q(".tagchip");
    ui.hud.update({ tags: { fire: 1 } });
    assert.equal(q(".tagchip"), first);
  });

  it("shows the boss bar with name, fill and meter values, and hides it without a boss", () => {
    ui.hud.update({ boss: { name: "Warden", hp: 50, maxHp: 200 } });
    const bar = q(".hud-top .bar.boss");
    assert.equal(q(".hud-top").hidden, false);
    assert.equal(q(".hud-top .nm").textContent, "Warden");
    assert.equal(q(".hud-top .bar.boss > i").style.width, "25%");
    assert.equal(bar.getAttribute("aria-valuenow"), "50");
    assert.equal(bar.getAttribute("aria-valuemax"), "200");
    ui.hud.update({ boss: { name: "Warden", hp: 0, maxHp: 0 } });
    assert.equal(q(".hud-top .bar.boss > i").style.width, "0%");
    ui.hud.update({});
    assert.equal(q(".hud-top").hidden, true);
  });

  it("shows ability slots as ready with their label, or counts down the cooldown", () => {
    ui.hud.update({ dodgeCd: 0, dodgeMax: 2, skillCd: 1.23, skillMax: 4 });
    const [dodge, bash] = qa(".slot");
    assert.equal(dodge.classList.contains("ready"), true);
    assert.equal(dodge.querySelector(".lbl").textContent, "Dodge");
    assert.equal(dodge.querySelector("i").style.width, "100%");
    assert.equal(bash.classList.contains("ready"), false);
    assert.equal(bash.querySelector(".lbl").textContent, "1.2s");
    assert.equal(bash.querySelector("i").style.width, "69%");
    ui.hud.update({ dodgeCd: 0, dodgeMax: 2, skillCd: 0 });
    assert.equal(bash.classList.contains("ready"), true);
    assert.equal(bash.querySelector(".lbl").textContent, "Bash");
  });

  it("treats cooldowns at or under 0.05 s as ready and clamps progress to 0..100%", () => {
    ui.hud.update({ dodgeCd: 0.05, dodgeMax: 2, skillCd: 3, skillMax: 2 });
    const [dodge, bash] = qa(".slot");
    assert.equal(dodge.classList.contains("ready"), true);
    assert.equal(bash.classList.contains("ready"), false);
    assert.equal(bash.querySelector("i").style.width, "0%");
    assert.equal(bash.querySelector(".lbl").textContent, "3.0s");
  });

  it("defaults the cooldown maximum to 1 when none is given", () => {
    ui.hud.update({ dodgeCd: 0.5 });
    assert.equal(q(".slot i").style.width, "50%");
  });

  it("drives the cooldown ring on touch buttons that exist in the document", () => {
    const dodgeBtn = doc.createElement("button");
    dodgeBtn.className = "dusk-tbtn dodge";
    const skillBtn = doc.createElement("button");
    skillBtn.className = "dusk-tbtn skill";
    doc.body.append(dodgeBtn, skillBtn);
    try {
      ui.hud.update({ dodgeCd: 1, dodgeMax: 2, skillCd: 0, skillMax: 2 });
      assert.equal(dodgeBtn.style.getPropertyValue("--p"), "0.500");
      assert.equal(dodgeBtn.classList.contains("cooling"), true);
      assert.equal(skillBtn.style.getPropertyValue("--p"), "1.000");
      assert.equal(skillBtn.classList.contains("cooling"), false);
      ui.hud.update({ dodgeCd: 0, dodgeMax: 2 });
      assert.equal(dodgeBtn.style.getPropertyValue("--p"), "1.000");
      assert.equal(dodgeBtn.classList.contains("cooling"), false);
    } finally {
      dodgeBtn.remove();
      skillBtn.remove();
    }
  });

  it("flashes the hurt vignette with a strength-based opacity", () => {
    const vignette = q(".hurt");
    ui.hud.hurt(0.5);
    assert.ok(Math.abs(Number(vignette.style.getPropertyValue("--a")) - 0.675) < 1e-9);
    assert.equal(vignette.classList.contains("on"), true);
    ui.hud.hurt();
    assert.equal(vignette.style.getPropertyValue("--a"), "1");
    ui.hud.hurt(0);
    assert.equal(Number(vignette.style.getPropertyValue("--a")), 0.35);
    assert.equal(vignette.classList.contains("on"), true);
  });

  it("calls the pause handler when one is registered and not the bubbling event", () => {
    const pause = spy();
    const bubbled = spy();
    rootEl.addEventListener("dusk:pause", bubbled);
    ui.hud.onPause(pause);
    q(".pausebtn").click();
    assert.equal(pause.calls.length, 1);
    assert.equal(bubbled.calls.length, 0);
  });

  it("dispatches a bubbling dusk:pause event when no pause handler is registered", () => {
    const bubbled = spy();
    rootEl.addEventListener("dusk:pause", bubbled);
    q(".pausebtn").click();
    assert.equal(bubbled.calls.length, 1);
    assert.equal(bubbled.calls[0][0].bubbles, true);
  });
});

describe("showHub", () => {
  const meta = { currency: 50, endings: ["a", "b"], upgrades: { vigor: 1 } };

  it("renders the camp stats and fires start, daily, upgrade, codex and settings callbacks", () => {
    const calls = [];
    ui.showHub(meta, {
      upgradeCost: 30,
      onStart: () => calls.push("start"),
      onDaily: () => calls.push("daily"),
      onUpgrade: (k) => calls.push("upgrade:" + k),
      onCodex: () => calls.push("codex"),
      onSettings: () => calls.push("settings"),
    });
    const screen = overlay();
    assert.equal(screen.hidden, false);
    assert.equal(screen.getAttribute("aria-label"), "Camp");
    assert.equal(q("h1", screen).textContent, "Dusk Camp");
    assert.deepEqual(qa(".stat span:last-child", screen).map((s) => s.textContent), ["50", "2 of 3", "1 of 2"]);
    button("Start run").click();
    button("Daily seed run").click();
    button("Codex").click();
    button("Settings").click();
    button("Vigor +5% max HP: 30 embers").click();
    assert.deepEqual(calls, ["start", "daily", "codex", "settings", "upgrade:vigor"]);
  });

  it("disables the vigor upgrade when embers are short and says why", () => {
    const calls = [];
    ui.showHub({ currency: 10 }, { upgradeCost: 30, onUpgrade: () => calls.push("up") });
    const up = q('button[aria-label="Buy Vigor upgrade for 30 embers, not enough embers"]');
    assert.ok(up);
    assert.equal(up.disabled, true);
    up.click();
    assert.deepEqual(calls, []);
  });

  it("shows the upgrade as maxed and disabled when there is no next cost", () => {
    ui.showHub({ currency: 500 }, { upgradeCost: null });
    const up = button("Vigor maxed");
    assert.equal(up.disabled, true);
    assert.equal(up.getAttribute("aria-label"), "Vigor upgrade, maxed out");
  });

  it("uses empty defaults when called with no arguments and does not throw on clicks", () => {
    ui.showHub();
    assert.equal(q("h1").textContent, "Dusk Camp");
    assert.equal(button("Vigor maxed").disabled, true);
    assert.deepEqual(qa(".stat span:last-child").map((s) => s.textContent), ["0", "0 of 3", "0 of 2"]);
    button("Start run").click();
    button("Settings").click();
  });

  it("treats missing currency as zero when deciding whether the upgrade is affordable", () => {
    ui.showHub({}, { upgradeCost: 30 });
    const up = q('button[aria-label="Buy Vigor upgrade for 30 embers, not enough embers"]');
    assert.equal(up.disabled, true);
  });

  it("logs and swallows an error thrown by a callback", () => {
    const err = mock.method(console, "error", () => {});
    const boom = new Error("boom");
    ui.showHub({}, { onStart: () => { throw boom; } });
    button("Start run").click();
    assert.equal(err.mock.callCount(), 1);
    assert.equal(err.mock.calls[0].arguments[0], boom);
    assert.equal(overlay().hidden, false);
  });

  it("focuses the primary button when the camp opens", async () => {
    ui.showHub(meta, {});
    await flush();
    assert.equal(doc.activeElement.textContent, "Start run");
  });
});

describe("showShrine", () => {
  const cards = [
    { id: "ember", name: "Ember Blade", tags: ["fire", { id: "crit", owned: true }], desc: "Hot steel.", effect: "+10% fire damage", combo: true },
    { id: "ice", name: "Ice Wall", tags: [{ id: "frost", name: "Frost Ward", owned: false }], desc: "Cold stone.", pairsWith: "Ember Blade", bonusNote: "Bonus: +1 Frost" },
    { id: "plain", name: "Plain Cloak", tags: [], desc: "Nothing special." },
  ];

  it("renders each card with tags, effect, pairing and combo markers", () => {
    ui.showShrine(cards, {});
    const els = qa(".card");
    assert.equal(els.length, 3);
    assert.deepEqual(qa(".key", els[0]).map((k) => k.textContent), ["[1]"]);
    assert.equal(q("h3", els[0]).textContent, "Ember Blade");
    assert.equal(els[0].getAttribute("aria-label"), "Ember Blade, completes a combo");
    assert.equal(q(".combo", els[0]).textContent, "COMBO");
    assert.equal(q(".effect", els[0]).textContent, "+10% fire damage");
    assert.deepEqual(qa(".tag", els[0]).map((t) => t.textContent), ["Fire", "Crit (owned)"]);
    assert.equal(q(".tag.owned", els[0]).textContent, "Crit (owned)");
    assert.equal(q(".flavor", els[0]).textContent, "Hot steel.");
    assert.equal(q(".tag", els[1]).textContent, "Frost Ward");
    assert.equal(q(".tag.owned", els[1]), null);
    assert.equal(q(".pairs", els[1]).textContent, "Pairs with your Ember Blade");
    assert.equal(q(".bonus", els[1]).textContent, "Bonus: +1 Frost");
    assert.equal(q(".combo", els[1]).textContent, "COMBO");
    assert.equal(els[2].getAttribute("aria-label"), "Plain Cloak");
    assert.equal(q(".combo", els[2]), null);
    assert.equal(q(".effect", els[2]), null);
    assert.equal(q(".pairs", els[2]), null);
    assert.equal(q(".bonus", els[2]), null);
  });

  it("renders a bare card without description or tags", () => {
    ui.showShrine([{ name: "Bare" }]);
    const el = q(".card");
    assert.equal(q("h3", el).textContent, "Bare");
    assert.equal(q(".flavor", el).textContent, "");
    assert.equal(qa(".tag", el).length, 0);
    assert.equal(el.getAttribute("aria-label"), "Bare");
  });

  it("selects the first card on open and moves selection on hover", () => {
    ui.showShrine(cards, {});
    const els = qa(".card");
    assert.equal(els[0].classList.contains("sel"), true);
    els[2].dispatchEvent(new win.Event("pointerenter"));
    assert.equal(els[2].classList.contains("sel"), true);
    assert.equal(els[0].classList.contains("sel"), false);
  });

  it("takes a card with its Take button and reports its id", () => {
    const taken = [];
    ui.showShrine(cards, { onTake: (id) => taken.push(id) });
    qa(".take")[1].click();
    assert.deepEqual(taken, ["ice"]);
  });

  it("keys 1-3 select and focus a card, and Enter takes the selected card", async () => {
    const taken = [];
    ui.showShrine(cards, { onTake: (id) => taken.push(id) });
    await flush(); // let the open-time focus on card 1 land first
    const e = press("2");
    assert.equal(e.defaultPrevented, true);
    assert.equal(qa(".card")[1].classList.contains("sel"), true);
    assert.equal(doc.activeElement.getAttribute("aria-label"), "Take Ice Wall");
    press("Enter");
    assert.deepEqual(taken, ["ice"]);
  });

  it("ignores number keys without a matching card and leaves other keys alone", () => {
    ui.showShrine(cards.slice(0, 1), {});
    assert.equal(press("2").defaultPrevented, false);
    assert.equal(press("9").defaultPrevented, false);
    assert.equal(press("Escape").defaultPrevented, false);
    assert.equal(overlay().hidden, false);
  });

  it("does not take a card when Enter is pressed on a button", () => {
    const taken = [];
    ui.showShrine(cards, { onTake: (id) => taken.push(id), onReroll: () => {} });
    const e = press("Enter", {}, button("Reroll"));
    assert.equal(e.defaultPrevented, false);
    assert.deepEqual(taken, []);
  });

  it("does nothing on Enter when there are no cards", () => {
    const taken = [];
    ui.showShrine([], { onTake: (id) => taken.push(id) });
    press("Enter");
    assert.deepEqual(taken, []);
  });

  it("ignores shortcuts typed into a text field", () => {
    const taken = [];
    ui.showShrine(cards, { onTake: (id) => taken.push(id) });
    const field = doc.createElement("input");
    doc.body.append(field);
    try {
      press("Enter", {}, field);
      press("3", {}, field);
      assert.deepEqual(taken, []);
      assert.equal(qa(".card")[0].classList.contains("sel"), true);
    } finally {
      field.remove();
    }
  });

  it("falls back to the tag id when an object tag has neither a name nor a known id", () => {
    ui.showShrine([{ name: "Odd", tags: [{ id: "mystery" }] }], {});
    assert.equal(q(".card .tag").textContent, "mystery");
  });

  it("shows a reroll cost, disables reroll when told, and wires reroll and skip", () => {
    const calls = [];
    ui.showShrine(cards, { rerollCost: 15, canReroll: true, onReroll: () => calls.push("reroll"), onSkip: () => calls.push("skip") });
    const reroll = button("Reroll (15 embers)");
    assert.equal(reroll.disabled, false);
    assert.equal(reroll.getAttribute("aria-label"), "Reroll offers for 15 embers");
    reroll.click();
    button("Skip").click();
    assert.deepEqual(calls, ["reroll", "skip"]);
  });

  it("disables reroll with no cost shown when canReroll is false", () => {
    ui.showShrine(cards, { canReroll: false });
    const reroll = button("Reroll");
    assert.equal(reroll.disabled, true);
    assert.equal(reroll.getAttribute("aria-label"), "Reroll offers");
  });

  it("uses defaults when called with no arguments and Skip works without a handler", () => {
    ui.showShrine();
    assert.equal(qa(".card").length, 0);
    button("Skip").click();
    press("Enter");
    assert.equal(overlay().hidden, false);
  });

  it("focuses the first card's Take button on open", async () => {
    ui.showShrine(cards, {});
    await flush();
    assert.equal(doc.activeElement.getAttribute("aria-label"), "Take Ember Blade");
  });
});

describe("showRecap", () => {
  it("shows a victory with kept embers, new endings, and no death details", () => {
    const calls = [];
    ui.showRecap(
      { won: true, floor: 3, room: 4, currencyKept: 42, endingsNew: ["Dawn"], itemsLost: [], killer: "Brute", tip: "Dodge" },
      { onAgain: () => calls.push("again"), onHub: () => calls.push("hub") },
    );
    const screen = overlay();
    assert.equal(screen.getAttribute("aria-label"), "Run won");
    assert.equal(q("h1", screen).textContent, "Victory");
    assert.ok(qa("p", screen).some((p) => p.textContent === "Reached floor 3, room 5."));
    assert.equal(q(".tipbox", screen), null);
    assert.equal(q(".lost", screen), null);
    assert.deepEqual(qa("ul li", screen).map((li) => li.textContent), ["Dawn"]);
    assert.equal(q(".coin", screen).textContent, "42");
    button("Again").click();
    button("Back to camp").click();
    assert.deepEqual(calls, ["again", "hub"]);
  });

  it("shows a defeat with killer, floor, tip and lost items", () => {
    ui.showRecap({ won: false, killer: "Brute", floor: 2, room: 0, tip: "Dodge the slam", itemsLost: ["Sword", "Ring"], endingsNew: [], currencyKept: 5 }, {});
    const screen = overlay();
    assert.equal(screen.getAttribute("aria-label"), "Run over");
    assert.equal(q("h1", screen).textContent, "You fell");
    assert.ok(qa("p", screen).some((p) => p.textContent === "Defeated by Brute on floor 2, room 1."));
    assert.equal(q(".tipbox", screen).textContent, "Tip: Dodge the slam");
    assert.equal(q(".lost", screen).textContent, "Items lost:");
    assert.deepEqual(qa("ul li", screen).map((li) => li.textContent), ["Sword", "Ring"]);
    assert.equal(qa("ul", screen).length, 1);
  });

  it("reports only the floor reached when there is no killer or tip", () => {
    ui.showRecap({ won: false, floor: 4, room: 2, currencyKept: 0 }, {});
    const screen = overlay();
    assert.ok(qa("p", screen).some((p) => p.textContent === "Reached floor 4, room 3."));
    assert.equal(q(".tipbox", screen), null);
    assert.equal(qa("ul", screen).length, 0);
  });

  it("renders with no details and no callbacks", () => {
    ui.showRecap();
    assert.equal(q("h1", overlay()).textContent, "You fell");
    button("Again").click();
    button("Back to camp").click();
  });
});

describe("showPause", () => {
  it("offers resume, settings and quit, and Escape does nothing here", () => {
    const calls = [];
    ui.showPause({ onResume: () => calls.push("resume"), onSettings: () => calls.push("settings"), onQuit: () => calls.push("quit") });
    assert.equal(overlay().getAttribute("aria-label"), "Paused");
    button("Resume").click();
    button("Settings").click();
    button("Quit to camp").click();
    assert.deepEqual(calls, ["resume", "settings", "quit"]);
    const e = press("Escape");
    assert.equal(e.defaultPrevented, false);
    assert.equal(overlay().hidden, false);
  });

  it("tolerates missing callbacks and stays open", () => {
    ui.showPause();
    button("Resume").click();
    button("Settings").click();
    button("Quit to camp").click();
    assert.equal(overlay().hidden, false);
    assert.equal(overlay().getAttribute("aria-label"), "Paused");
  });
});

describe("showSettings", () => {
  const settings = { music: 0.5, sfx: 0.25, shake: true, flashes: false, blur: true, screenRelative: false, quality: "high" };
  const sliders = () => qa('input[type="range"]');
  const checks = () => qa('input[type="checkbox"]');

  it("reflects the current values in every control", () => {
    ui.showSettings(settings, {});
    const [music, sfx] = sliders();
    assert.equal(music.value, "50");
    assert.equal(music.closest("label").querySelector(".muted").textContent, "50%");
    assert.equal(sfx.value, "25");
    assert.equal(music.getAttribute("aria-label"), "Music");
    assert.equal(sfx.getAttribute("aria-label"), "Sound effects");
    assert.deepEqual(checks().map((c) => c.checked), [true, false, true, false]);
    const sel = q("select");
    assert.equal(sel.value, "high");
    assert.deepEqual(qa("option", sel).map((o) => o.textContent), ["Auto", "High", "Medium", "Low"]);
  });

  it("reports slider, checkbox and quality changes through onChange", () => {
    const changes = [];
    ui.showSettings(settings, { onChange: (k, v) => changes.push([k, v]) });
    const [music] = sliders();
    music.value = "70";
    music.dispatchEvent(new win.Event("input"));
    assert.deepEqual(changes, [["music", 0.7]]);
    assert.equal(music.closest("label").querySelector(".muted").textContent, "70%");
    const flashes = checks()[1];
    flashes.checked = true;
    flashes.dispatchEvent(new win.Event("change"));
    const sel = q("select");
    sel.value = "low";
    sel.dispatchEvent(new win.Event("change"));
    assert.deepEqual(changes, [["music", 0.7], ["flashes", true], ["quality", "low"]]);
  });

  it("treats a missing value as zero and tolerates a missing onChange", () => {
    ui.showSettings({}, {});
    const [music, sfx] = sliders();
    assert.equal(music.value, "0");
    assert.equal(sfx.closest("label").querySelector(".muted").textContent, "0%");
    music.value = "10";
    music.dispatchEvent(new win.Event("input"));
    assert.equal(music.closest("label").querySelector(".muted").textContent, "10%");
    checks()[0].dispatchEvent(new win.Event("change"));
    q("select").dispatchEvent(new win.Event("change"));
    assert.equal(overlay().hidden, false);
  });

  it("copies the save code and says so when the clipboard is unavailable", () => {
    ui.showSettings(settings, { onCopyCode: () => "CODE-1" });
    button("Copy code").click();
    assert.equal(q("textarea").value, "CODE-1");
    assert.equal(q(".msg").textContent, "Copy it from the box above.");
    assert.equal(q(".msg").classList.contains("warn"), false);
  });

  it("confirms a copy when the clipboard write succeeds", async () => {
    const writeText = spy(() => Promise.resolve());
    Object.defineProperty(win.navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      ui.showSettings(settings, { onCopyCode: () => "CODE-2" });
      button("Copy code").click();
      assert.deepEqual(writeText.calls, [["CODE-2"]]);
      await flush();
      assert.equal(q(".msg").textContent, "Code copied.");
    } finally {
      delete win.navigator.clipboard;
    }
  });

  it("falls back to the manual copy hint when the clipboard write is refused", async () => {
    Object.defineProperty(win.navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true });
    try {
      ui.showSettings(settings, { onCopyCode: () => "CODE-3" });
      button("Copy code").click();
      await flush();
      assert.equal(q(".msg").textContent, "Copy it from the box above.");
    } finally {
      delete win.navigator.clipboard;
    }
  });

  it("warns when the code cannot be made", () => {
    ui.showSettings(settings, { onCopyCode: () => { throw new Error("no save"); } });
    button("Copy code").click();
    assert.equal(q(".msg").textContent, "Could not make a code.");
    assert.equal(q(".msg").classList.contains("warn"), true);
  });

  it("copies an empty code when no copy handler is supplied", () => {
    ui.showSettings(settings, {});
    button("Copy code").click();
    assert.equal(q("textarea").value, "");
    assert.equal(q(".msg").textContent, "Copy it from the box above.");
  });

  it("loads a trimmed code and shows the result message", () => {
    const seen = [];
    ui.showSettings(settings, { onLoadCode: (code) => (seen.push(code), { ok: true, message: "Loaded your run." }) });
    q("textarea").value = "  CODE-9  ";
    button("Load code").click();
    assert.deepEqual(seen, ["CODE-9"]);
    assert.equal(q(".msg").textContent, "Loaded your run.");
    assert.equal(q(".msg").classList.contains("warn"), false);
  });

  it("shows a rejected code as a warning", () => {
    ui.showSettings(settings, { onLoadCode: () => ({ ok: false, message: "Unknown code." }) });
    button("Load code").click();
    assert.equal(q(".msg").textContent, "Unknown code.");
    assert.equal(q(".msg").classList.contains("warn"), true);
  });

  it("clears the message when the load handler gives nothing back", () => {
    ui.showSettings(settings, { onLoadCode: () => null });
    button("Load code").click();
    assert.equal(q(".msg").textContent, "");
    assert.equal(q(".msg").classList.contains("warn"), false);
  });

  it("uses the thrown error's message, or a fallback, when loading fails", () => {
    ui.showSettings(settings, { onLoadCode: () => { throw new Error("Corrupt code"); } });
    button("Load code").click();
    assert.equal(q(".msg").textContent, "Corrupt code");
    assert.equal(q(".msg").classList.contains("warn"), true);
    ui.close();
    ui.showSettings(settings, { onLoadCode: () => { throw "oops"; } });
    button("Load code").click();
    assert.equal(q(".msg").textContent, "Could not load.");
  });

  it("treats a missing load handler as no result", () => {
    ui.showSettings(settings, {});
    button("Load code").click();
    assert.equal(q(".msg").textContent, "");
  });

  it("closes from the Close button and from Escape, even inside the code box", () => {
    const closes = [];
    ui.showSettings(settings, { onClose: () => closes.push("close") });
    button("Close").click();
    const e = press("Escape", {}, q("textarea"));
    assert.equal(e.defaultPrevented, true);
    assert.deepEqual(closes, ["close", "close"]);
  });

  it("does not throw on Escape when no close handler is supplied", () => {
    ui.showSettings(settings, {});
    press("Escape");
    assert.equal(overlay().hidden, false);
  });
});

describe("showCodex", () => {
  const entries = [
    { name: "Ember Blade", seen: true, tags: ["fire"], desc: "Hot steel." },
    { name: "Secret Charm", seen: false, tags: ["frost"], desc: "Hidden." },
    { name: "Ice Wall", seen: true, desc: "Cold stone." },
  ];

  it("lists discovered entries with tags and hides undiscovered names", () => {
    ui.showCodex(entries, {});
    const screen = overlay();
    assert.equal(screen.getAttribute("aria-label"), "Codex");
    assert.ok(qa("p", screen).some((p) => p.textContent === "2 of 3 items discovered"));
    assert.deepEqual(qa(".entry:not(.unseen) h3", screen).map((h) => h.textContent), ["Ember Blade", "Ice Wall"]);
    assert.equal(q(".entry:not(.unseen) .tag", screen).textContent, "Fire");
    const hidden = q(".entry.unseen", screen);
    assert.equal(hidden.getAttribute("aria-label"), "Undiscovered item");
    assert.equal(q("h3", hidden).textContent, "Unknown item");
    assert.equal(screen.textContent.includes("Secret Charm"), false);
    assert.equal(screen.textContent.includes("Hidden."), false);
  });

  it("closes from the Close button and from Escape", () => {
    const closes = [];
    ui.showCodex(entries, { onClose: () => closes.push("close") });
    press("Escape");
    button("Close").click();
    assert.deepEqual(closes, ["close", "close"]);
  });

  it("opens empty with no arguments and Escape without a handler is harmless", () => {
    ui.showCodex();
    assert.ok(qa("p", overlay()).some((p) => p.textContent === "0 of 0 items discovered"));
    press("Escape");
    assert.equal(overlay().hidden, false);
  });
});

describe("rotate, loading, toast and teardown", () => {
  it("shows and hides the rotate-device prompt", () => {
    const rotate = q(".rotate");
    ui.showRotate(true);
    assert.equal(rotate.hidden, false);
    assert.equal(rotate.getAttribute("role"), "alert");
    assert.equal(q("h2", rotate).textContent, "Rotate your device");
    ui.showRotate(false);
    assert.equal(rotate.hidden, true);
  });

  it("shows a loading message, hides on null or false, and keeps the last text for an empty string", () => {
    const loading = q(".loading");
    ui.showLoading("Brewing tea");
    assert.equal(loading.hidden, false);
    assert.equal(loading.textContent, "Brewing tea");
    ui.showLoading(null);
    assert.equal(loading.hidden, true);
    ui.showLoading("Again");
    ui.showLoading(false);
    assert.equal(loading.hidden, true);
    ui.showLoading("");
    assert.equal(loading.hidden, false);
    assert.equal(loading.textContent, "Again");
  });

  it("shows a toast and hides it after 2.4 s, restarting the timer on each new toast", (t) => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      ui.toast("Saved");
      const el = q(".toast");
      assert.equal(el.textContent, "Saved");
      assert.equal(el.classList.contains("show"), true);
      mock.timers.tick(2000);
      ui.toast("Loaded");
      assert.equal(el.textContent, "Loaded");
      mock.timers.tick(2000);
      assert.equal(el.classList.contains("show"), true);
      mock.timers.tick(400);
      assert.equal(el.classList.contains("show"), false);
    } finally {
      mock.timers.reset();
    }
  });

  it("hideAll closes overlays and loading but leaves the HUD and toast alone", () => {
    ui.hud.show(true);
    ui.showHub({}, {});
    ui.showLoading("Loading");
    ui.hideAll();
    assert.equal(overlay().hidden, true);
    assert.equal(overlay().children.length, 0);
    assert.equal(q(".loading").hidden, true);
    assert.equal(q(".hud").hidden, false);
  });

  it("close() hides the overlay, clears its key handlers and leaves loading alone", () => {
    const closes = [];
    ui.showLoading("Still here");
    ui.showSettings({}, { onClose: () => closes.push("close") });
    ui.close();
    assert.equal(overlay().hidden, true);
    assert.equal(overlay().children.length, 0);
    assert.equal(q(".loading").hidden, false);
    press("Escape");
    assert.deepEqual(closes, []);
  });

  it("a key press with no open overlay is not handled by any screen", () => {
    ui.showShrine([{ id: "a", name: "A" }], {});
    ui.close();
    assert.equal(press("1").defaultPrevented, false);
  });

  it("a key press on a text field is ignored by the overlay", () => {
    ui.showPause({ onResume: () => assert.fail("should not resume") });
    const field = doc.createElement("input");
    doc.body.append(field);
    try {
      assert.equal(press("Enter", {}, field).defaultPrevented, false);
    } finally {
      field.remove();
    }
  });
});
