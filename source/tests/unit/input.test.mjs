// Unit tests for src/engine/input.js (keyboard, mouse, multi-touch, touch layer).
import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers.mjs";
import { createInput } from "../../src/engine/input.js";

let dom, doc, win, rootEl, input;

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `expected ${a} to be near ${b}`);

// jsdom has no PointerEvent, so build a plain Event and attach the pointer fields.
function ptr(type, target, init = {}) {
  const e = new win.Event(type, { bubbles: true, cancelable: true });
  const fields = { pointerId: 1, pointerType: "mouse", button: 0, clientX: 0, clientY: 0, ...init };
  for (const k of Object.keys(fields)) Object.defineProperty(e, k, { value: fields[k] });
  target.dispatchEvent(e);
  return e;
}
const keyEvent = (type, key, opts = {}) => new win.KeyboardEvent(type, { key, bubbles: true, cancelable: true, ...opts });
const down = (key, target = doc.body, opts = {}) => { const e = keyEvent("keydown", key, opts); target.dispatchEvent(e); return e; };
const up = (key, target = doc.body) => { target.dispatchEvent(keyEvent("keyup", key)); };
const tbtn = (name) => rootEl.querySelector(`[data-touch-btn="${name}"]`);
const update = () => input.update();
const touch = (type, target, id, x, y) => ptr(type, target, { pointerType: "touch", pointerId: id, clientX: x, clientY: y });

before(async () => {
  dom = await installDom();
  doc = dom.window.document;
  win = dom.window;
});
after(() => dom.cleanup());

beforeEach(() => {
  rootEl = doc.createElement("div");
  rootEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200 });
  doc.body.append(rootEl);
  input = createInput(rootEl);
});
afterEach(() => {
  input.dispose();
  rootEl.remove();
});

describe("setup", () => {
  it("adds a hidden touch layer with the three touch buttons and stick elements", () => {
    const layer = rootEl.querySelector(".dusk-touch");
    assert.ok(layer);
    assert.equal(layer.classList.contains("on"), false);
    assert.deepEqual(["attack", "dodge", "skill"].map((n) => tbtn(n).textContent), ["Attack", "Dodge", "Bash"]);
    assert.ok(rootEl.querySelector(".dusk-stick"));
    assert.ok(rootEl.querySelector(".dusk-knob"));
    assert.equal(rootEl.classList.contains("dusk-input-root"), true);
  });

  it("makes a static root relative so the touch layer positions against it", () => {
    const original = win.getComputedStyle;
    win.getComputedStyle = () => ({ position: "static" });
    const root = doc.createElement("div");
    doc.body.append(root);
    try {
      const inp = createInput(root);
      assert.equal(root.style.position, "relative");
      inp.dispose();
      assert.equal(root.style.position, "");
    } finally {
      win.getComputedStyle = original;
      root.remove();
    }
  });

  it("leaves an already positioned root alone and restores its position on dispose", () => {
    const root = doc.createElement("div");
    root.style.position = "absolute";
    doc.body.append(root);
    const inp = createInput(root);
    assert.equal(root.style.position, "absolute");
    inp.dispose();
    assert.equal(root.style.position, "absolute");
    root.remove();
  });

  it("starts with the touch layer hidden when the device is not coarse-pointer", () => {
    assert.equal(input.isTouchVisible(), false);
    assert.equal(rootEl.querySelector(".dusk-touch").classList.contains("on"), false);
  });

  it("shows the touch layer at creation on a coarse-pointer device", () => {
    win.matchMedia = () => ({ matches: true });
    const root = doc.createElement("div");
    doc.body.append(root);
    try {
      const inp = createInput(root);
      assert.equal(inp.isTouchVisible(), true);
      assert.equal(root.querySelector(".dusk-touch").classList.contains("on"), true);
      inp.dispose();
    } finally {
      delete win.matchMedia;
      root.remove();
    }
  });

  it("keeps touch hidden when the media query does not match or throws", () => {
    const root = doc.createElement("div");
    doc.body.append(root);
    try {
      win.matchMedia = () => ({ matches: false });
      const a = createInput(root);
      assert.equal(a.isTouchVisible(), false);
      a.dispose();
      win.matchMedia = () => { throw new Error("unsupported"); };
      const b = createInput(root);
      assert.equal(b.isTouchVisible(), false);
      b.dispose();
    } finally {
      delete win.matchMedia;
      root.remove();
    }
  });

  it("setTouchVisible toggles the layer and isTouchVisible reports it", () => {
    input.setTouchVisible(true);
    assert.equal(input.isTouchVisible(), true);
    assert.equal(rootEl.querySelector(".dusk-touch").classList.contains("on"), true);
    input.setTouchVisible(0);
    assert.equal(input.isTouchVisible(), false);
    assert.equal(rootEl.querySelector(".dusk-touch").classList.contains("on"), false);
  });

  it("hiding the touch layer releases a held touch button", () => {
    input.setTouchVisible(true);
    touch("pointerdown", tbtn("attack"), 4, 150, 150);
    input.update();
    assert.equal(input.state.attack, true);
    input.setTouchVisible(false);
    input.update();
    assert.equal(input.state.attack, false);
    assert.equal(tbtn("attack").classList.contains("down"), false);
  });
});

describe("keyboard", () => {
  it("maps WASD and arrow keys to a movement vector with y pointing up", () => {
    down("w"); update();
    assert.deepEqual(input.state.move, { x: 0, y: 1 });
    up("w");
    down("ArrowLeft"); update();
    assert.deepEqual(input.state.move, { x: -1, y: 0 });
    up("ArrowLeft");
    down("S"); update();
    assert.deepEqual(input.state.move, { x: 0, y: -1 });
    up("S");
    down("ArrowRight"); update();
    assert.equal(input.state.move.x, 1);
    up("ArrowRight");
    down("ArrowUp"); update();
    assert.equal(input.state.move.y, 1);
    up("ArrowUp");
    down("ArrowDown"); update();
    assert.equal(input.state.move.y, -1);
    up("ArrowDown");
    down("a"); update();
    assert.equal(input.state.move.x, -1);
    up("a");
    down("d"); update();
    assert.equal(input.state.move.x, 1);
    up("d");
  });

  it("normalises diagonal movement to unit length", () => {
    down("d"); down("w"); update();
    const len = Math.hypot(input.state.move.x, input.state.move.y);
    near(len, 1);
    near(input.state.move.x, 1 / Math.hypot(1, 1));
    up("d"); up("w");
  });

  it("cancels opposite directions to no movement", () => {
    down("a"); down("d"); down("w"); down("s"); update();
    assert.deepEqual(input.state.move, { x: 0, y: 0 });
    up("a"); up("d"); up("w"); up("s");
  });

  it("stops moving when the key is released", () => {
    down("w"); update();
    assert.equal(input.state.move.y, 1);
    up("w"); update();
    assert.equal(input.state.move.y, 0);
  });

  it("prevents default for game keys but not for other keys", () => {
    assert.equal(down("w").defaultPrevented, true);
    assert.equal(down("q").defaultPrevented, false);
    up("w");
  });

  it("does not prevent the Space bar on a focused button, so it can still activate it", () => {
    const button = doc.createElement("button");
    rootEl.append(button);
    const e = down(" ", button);
    assert.equal(e.defaultPrevented, false);
    update();
    assert.equal(input.state.dodge, true);
    up(" ", button);
  });

  it("latches dodge on Space or K, skill on L, and pause on Escape or P, once per press", () => {
    down(" "); update();
    assert.equal(input.state.dodge, true);
    update();
    assert.equal(input.state.dodge, false);
    up(" ");

    down("k"); update();
    assert.equal(input.state.dodge, true);
    up("k");

    down("l"); update();
    assert.equal(input.state.skill, true);
    update();
    assert.equal(input.state.skill, false);
    up("l");

    down("Escape"); update();
    assert.equal(input.pausePressed(), true);
    update();
    assert.equal(input.pausePressed(), false);
    up("Escape");

    down("p"); update();
    assert.equal(input.pausePressed(), true);
    up("p");
  });

  it("does not latch again while the key is still held, and ignores auto-repeat", () => {
    down("k"); update();
    assert.equal(input.state.dodge, true);
    down("k"); update();
    assert.equal(input.state.dodge, false);
    up("k");
    down("l", doc.body, { repeat: true }); update();
    assert.equal(input.state.skill, false);
    up("l");
  });

  it("holds attack while J is down", () => {
    down("j"); update();
    assert.equal(input.state.attack, true);
    up("j"); update();
    assert.equal(input.state.attack, false);
  });

  it("reports any key for the frame it was pressed in, and ignores keys inside text fields", () => {
    down("q"); update();
    assert.equal(input.anyKey(), true);
    update();
    assert.equal(input.anyKey(), false);
    up("q");

    down(""); update();
    assert.equal(input.anyKey(), true);
    assert.equal(input.state.move.x + input.state.move.y, 0);

    const field = doc.createElement("input");
    doc.body.append(field);
    try {
      down("w", field); update();
      assert.equal(input.state.move.y, 0);
      assert.equal(input.anyKey(), false);
    } finally {
      field.remove();
    }
  });

  it("clears held keys when the window loses focus", () => {
    down("w"); down("j");
    win.dispatchEvent(new win.Event("blur"));
    update();
    assert.equal(input.state.move.y, 0);
    assert.equal(input.state.attack, false);
  });

  it("clears held keys when the page becomes hidden but not when it becomes visible", () => {
    down("w");
    Object.defineProperty(doc, "hidden", { value: false, configurable: true });
    doc.dispatchEvent(new win.Event("visibilitychange"));
    update();
    assert.equal(input.state.move.y, 1);
    Object.defineProperty(doc, "hidden", { value: true, configurable: true });
    doc.dispatchEvent(new win.Event("visibilitychange"));
    update();
    assert.equal(input.state.move.y, 0);
    delete doc.hidden;
    up("w");
  });

  it("clear() forgets held keys, mouse buttons and touches", () => {
    down("w");
    ptr("pointerdown", rootEl, { button: 0 });
    input.setTouchVisible(true);
    touch("pointerdown", tbtn("dodge"), 2, 150, 150);
    input.clear();
    update();
    assert.equal(input.state.move.y, 0);
    assert.equal(input.state.attack, false);
    assert.equal(tbtn("dodge").classList.contains("down"), false);
    up("w");
    ptr("pointerup", win, { button: 0 });
  });
});

describe("mouse", () => {
  it("aims at the pointer relative to the root centre with y pointing up", () => {
    ptr("pointerdown", rootEl, { clientX: 150, clientY: 50, button: 1 });
    update();
    near(input.state.aim.x, Math.SQRT1_2);
    near(input.state.aim.y, Math.SQRT1_2);
    ptr("pointerup", win, { button: 1 });
  });

  it("keeps the previous aim while the pointer is within 4 px of the centre", () => {
    update();
    assert.equal(input.state.aim, null);
    ptr("pointermove", win, { clientX: 101, clientY: 101 });
    update();
    assert.equal(input.state.aim, null);
    ptr("pointermove", win, { clientX: 200, clientY: 100 });
    update();
    near(input.state.aim.x, 1);
    near(input.state.aim.y, 0);
    ptr("pointermove", win, { clientX: 101, clientY: 101 });
    update();
    near(input.state.aim.x, 1);
    near(input.state.aim.y, 0);
  });

  it("does not move the aim when the root has no size", () => {
    rootEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
    ptr("pointermove", win, { clientX: 200, clientY: 100 });
    update();
    assert.equal(input.state.aim, null);
  });

  it("holds attack while the left button is down", () => {
    ptr("pointerdown", rootEl, { button: 0 });
    update();
    assert.equal(input.state.attack, true);
    ptr("pointerup", win, { button: 1 });
    update();
    assert.equal(input.state.attack, true);
    ptr("pointerup", win, { button: 0 });
    update();
    assert.equal(input.state.attack, false);
  });

  it("releases attack when the pointer is cancelled", () => {
    ptr("pointerdown", rootEl, { button: 0 });
    ptr("pointercancel", win, { button: 0 });
    update();
    assert.equal(input.state.attack, false);
  });

  it("latches skill on a right click and prevents the context menu", () => {
    ptr("pointerdown", rootEl, { button: 2 });
    update();
    assert.equal(input.state.skill, true);
    assert.equal(input.state.attack, false);
    update();
    assert.equal(input.state.skill, false);
    ptr("pointerup", win, { button: 2 });
    assert.equal(ptr("contextmenu", rootEl, { button: 2 }).defaultPrevented, true);
  });

  it("ignores pointer presses on UI controls and on data-ui elements", () => {
    const button = doc.createElement("button");
    const panel = doc.createElement("div");
    panel.setAttribute("data-ui", "");
    rootEl.append(button, panel);
    ptr("pointerdown", button, { button: 0, clientX: 150, clientY: 50 });
    update();
    assert.equal(input.state.attack, false);
    assert.equal(input.state.aim, null);
    ptr("pointerdown", panel, { button: 0 });
    update();
    assert.equal(input.state.attack, false);
    ptr("pointerup", win, { button: 0 });
  });

  it("reports a pointer press for any-key purposes", () => {
    ptr("pointerdown", rootEl, { button: 0 });
    update();
    assert.equal(input.anyKey(), true);
    update();
    assert.equal(input.anyKey(), false);
    ptr("pointerup", win, { button: 0 });
  });

  it("prevents the browser's gesture and double-click defaults on the root", () => {
    for (const type of ["gesturestart", "gesturechange", "dblclick"]) {
      assert.equal(ptr(type, rootEl).defaultPrevented, true, type);
    }
  });
});

describe("touch", () => {
  it("starts the virtual stick on the left half and reports a clamped, normalised move", () => {
    touch("pointerdown", rootEl, 7, 50, 100);
    assert.equal(input.isTouchVisible(), true);
    assert.equal(rootEl.querySelector(".dusk-stick").style.display, "block");
    touch("pointermove", win, 7, 350, 100);
    update();
    assert.equal(input.state.move.x, 1);
    near(input.state.move.y + 0, 0);
    const knob = rootEl.querySelector(".dusk-knob");
    assert.equal(knob.style.left, "84px");
    touch("pointerup", win, 7, 350, 100);
    update();
    assert.deepEqual(input.state.move, { x: 0, y: 0 });
    assert.equal(rootEl.querySelector(".dusk-stick").style.display, "none");
  });

  it("scales partial stick deflection past the deadzone and maps up to positive y", () => {
    touch("pointerdown", rootEl, 7, 50, 100);
    touch("pointermove", win, 7, 80, 100);
    update();
    near(input.state.move.x, 0.35 / 0.85);
    touch("pointermove", win, 7, 50, 40);
    update();
    near(input.state.move.y, 1);
    near(input.state.move.x + 0, 0);
    touch("pointerup", win, 7, 50, 40);
  });

  it("ignores stick movement inside the deadzone", () => {
    touch("pointerdown", rootEl, 7, 50, 100);
    touch("pointermove", win, 7, 55, 100);
    update();
    assert.deepEqual(input.state.move, { x: 0, y: 0 });
    touch("pointerup", win, 7, 55, 100);
  });

  it("ignores moves and releases from other pointers", () => {
    touch("pointerdown", rootEl, 7, 50, 100);
    touch("pointermove", win, 9, 350, 100);
    update();
    assert.deepEqual(input.state.move, { x: 0, y: 0 });
    touch("pointerup", win, 9, 0, 0);
    assert.equal(rootEl.querySelector(".dusk-stick").style.display, "block");
    touch("pointerup", win, 7, 50, 100);
  });

  it("does not start a second stick while one is already held", () => {
    touch("pointerdown", rootEl, 7, 50, 100);
    touch("pointerdown", rootEl, 8, 20, 100);
    touch("pointermove", win, 8, 150, 100);
    update();
    assert.deepEqual(input.state.move, { x: 0, y: 0 });
    touch("pointerup", win, 7, 50, 100);
  });

  it("does not start the stick on the right half of the screen", () => {
    touch("pointerdown", rootEl, 3, 150, 100);
    assert.equal(rootEl.querySelector(".dusk-stick").style.display, "");
    touch("pointermove", win, 3, 190, 100);
    update();
    assert.deepEqual(input.state.move, { x: 0, y: 0 });
  });

  it("ignores touches that land on UI controls outside the touch layer", () => {
    const panelButton = doc.createElement("button");
    rootEl.append(panelButton);
    touch("pointerdown", panelButton, 5, 20, 100);
    assert.equal(rootEl.querySelector(".dusk-stick").style.display, "");
    touch("pointerup", win, 5, 20, 100);
  });

  it("holds attack while the Attack button is touched and releases it on pointer up", () => {
    touch("pointerdown", tbtn("attack"), 4, 150, 150);
    assert.equal(tbtn("attack").classList.contains("down"), true);
    update();
    assert.equal(input.state.attack, true);
    touch("pointerup", win, 4, 150, 150);
    update();
    assert.equal(input.state.attack, false);
    assert.equal(tbtn("attack").classList.contains("down"), false);
  });

  it("latches dodge and skill from their touch buttons", () => {
    touch("pointerdown", tbtn("dodge"), 4, 150, 150);
    update();
    assert.equal(input.state.dodge, true);
    update();
    assert.equal(input.state.dodge, false);
    touch("pointerup", win, 4, 150, 150);

    touch("pointerdown", tbtn("skill"), 6, 150, 150);
    update();
    assert.equal(input.state.skill, true);
    update();
    assert.equal(input.state.skill, false);
    touch("pointercancel", win, 6, 150, 150);
    update();
    assert.equal(input.state.attack, false);
  });

  it("cancels a touch button hold when its pointer is cancelled by the system", () => {
    touch("pointerdown", tbtn("attack"), 4, 150, 150);
    touch("pointercancel", win, 4, 150, 150);
    update();
    assert.equal(input.state.attack, false);
    assert.equal(tbtn("attack").classList.contains("down"), false);
  });

  it("prevents default on touch-button presses", () => {
    assert.equal(touch("pointerdown", tbtn("attack"), 4, 150, 150).defaultPrevented, true);
    touch("pointerup", win, 4, 150, 150);
  });

  it("prevents touchmove scrolling only for cancelable events", () => {
    const cancellable = new win.Event("touchmove", { cancelable: true });
    rootEl.dispatchEvent(cancellable);
    assert.equal(cancellable.defaultPrevented, true);
    const passive = new win.Event("touchmove", { cancelable: false });
    rootEl.dispatchEvent(passive);
    assert.equal(passive.defaultPrevented, false);
  });

  it("prevents pinch-zoom touchstarts with more than one finger", () => {
    const pinch = new win.Event("touchstart", { cancelable: true });
    Object.defineProperty(pinch, "touches", { value: [{}, {}] });
    rootEl.dispatchEvent(pinch);
    assert.equal(pinch.defaultPrevented, true);

    const single = new win.Event("touchstart", { cancelable: true });
    Object.defineProperty(single, "touches", { value: [{}] });
    rootEl.dispatchEvent(single);
    assert.equal(single.defaultPrevented, false);

    const uncancelable = new win.Event("touchstart", { cancelable: false });
    Object.defineProperty(uncancelable, "touches", { value: [{}, {}] });
    rootEl.dispatchEvent(uncancelable);
    assert.equal(uncancelable.defaultPrevented, false);
  });
});

describe("dispose", () => {
  it("removes listeners, the touch layer and the injected style", () => {
    const styles = () => [...doc.querySelectorAll("style")].filter((s) => s.textContent.includes(".dusk-touch{")).length;
    assert.equal(styles(), 1);
    input.dispose();
    assert.equal(styles(), 0);
    assert.equal(rootEl.querySelector(".dusk-touch"), null);
    assert.equal(rootEl.classList.contains("dusk-input-root"), false);

    down("w"); update();
    assert.equal(input.state.move.y, 0);
    ptr("pointerdown", rootEl, { button: 0 });
    update();
    assert.equal(input.state.attack, false);
    assert.equal(ptr("contextmenu", rootEl).defaultPrevented, false);
    touch("pointerdown", rootEl, 7, 50, 100);
    touch("pointerup", win, 7, 50, 100);
  });
});
