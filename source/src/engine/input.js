// Module F: input. Keyboard, mouse and multi-touch (pointer events).
const STICK_R = 60;
const DEADZONE = 0.15;
const UI_SELECTOR = "button,input,select,textarea,a,label,[role=dialog],[data-ui]";

const STYLE = `
.dusk-input-root,.dusk-input-root canvas{touch-action:none;-webkit-touch-callout:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.dusk-touch{position:absolute;inset:0;pointer-events:none;z-index:5;display:none;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.dusk-touch.on{display:block}
.dusk-tbtn{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;box-sizing:border-box;border:2px solid #c8b6ff;background:rgba(92,58,160,.42);color:#f2ecff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;letter-spacing:.02em;text-shadow:0 1px 2px #120a24,0 0 4px #120a24;padding:0;margin:0;outline:none;user-select:none;-webkit-user-select:none}
.dusk-tbtn.down{background:rgba(160,112,255,.65);transform:scale(.94)}
.dusk-tbtn.attack{width:76px;height:76px;font-size:15px;right:calc(env(safe-area-inset-right,0px) + 22px);bottom:calc(env(safe-area-inset-bottom,0px) + 22px)}
.dusk-tbtn.dodge{width:56px;height:56px;right:calc(env(safe-area-inset-right,0px) + 110px);bottom:calc(env(safe-area-inset-bottom,0px) + 18px)}
.dusk-tbtn.skill{width:56px;height:56px;right:calc(env(safe-area-inset-right,0px) + 66px);bottom:calc(env(safe-area-inset-bottom,0px) + 106px)}
.dusk-stick,.dusk-knob{position:absolute;pointer-events:none;border-radius:50%;box-sizing:border-box;display:none}
.dusk-stick{width:120px;height:120px;border:2px solid #c8b6ff;background:rgba(92,58,160,.25)}
.dusk-knob{width:52px;height:52px;border:2px solid #c8b6ff;background:rgba(160,112,255,.5)}
`;

export function createInput(rootEl) {
  const doc = rootEl.ownerDocument;
  const win = doc.defaultView;
  const state = { move: { x: 0, y: 0 }, aim: null, attack: false, dodge: false, skill: false };

  const keys = new Set();
  const mouseDown = { 0: false, 2: false };
  let mouseAim = null; // {x,y} or null
  let dodgeLatch = false, skillLatch = false, pauseLatch = false, anyLatch = false;
  let anyFrame = false;
  let touchVisible = false;
  let explicitTouch = false;
  const stick = { id: -1, cx: 0, cy: 0, x: 0, y: 0 };
  const btnHeld = { attack: false, dodge: false, skill: false };
  const btnPointers = new Map(); // pointerId -> name

  // ---- DOM
  const styleEl = doc.createElement("style");
  styleEl.textContent = STYLE;
  doc.head.appendChild(styleEl);
  rootEl.classList.add("dusk-input-root");
  const prevPos = rootEl.style.position;
  if (win.getComputedStyle(rootEl).position === "static") rootEl.style.position = "relative";

  const layer = doc.createElement("div");
  layer.className = "dusk-touch";
  const stickEl = doc.createElement("div"); stickEl.className = "dusk-stick";
  const knobEl = doc.createElement("div"); knobEl.className = "dusk-knob";
  layer.append(stickEl, knobEl);
  const btnEls = {};
  for (const [name, label] of [["attack", "Attack"], ["dodge", "Dodge"], ["skill", "Skill"]]) {
    const b = doc.createElement("div");
    b.className = "dusk-tbtn " + name;
    b.textContent = label;
    b.dataset.touchBtn = name;
    layer.appendChild(b);
    btnEls[name] = b;
  }
  rootEl.appendChild(layer);

  function setTouchVisible(v) {
    touchVisible = !!v;
    layer.classList.toggle("on", touchVisible);
    if (!touchVisible) releaseTouches();
  }

  function releaseTouches() {
    stick.id = -1; stick.x = stick.y = 0;
    stickEl.style.display = knobEl.style.display = "none";
    btnPointers.clear();
    for (const n in btnHeld) { btnHeld[n] = false; btnEls[n].classList.remove("down"); }
  }

  function clearAll() {
    keys.clear();
    mouseDown[0] = mouseDown[2] = false;
    releaseTouches();
  }

  // ---- keyboard
  const isTextTarget = (t) => t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  const GAME_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "j", "k", "l", " ", "p", "escape"]);
  const keyName = (e) => (e.key || "").toLowerCase();

  function onKeyDown(e) {
    if (isTextTarget(e.target)) return;
    const k = keyName(e);
    anyLatch = true;
    if (!GAME_KEYS.has(k)) return;
    // let focused UI buttons keep Space activation
    const onBtn = e.target && e.target.tagName === "BUTTON";
    if (!(onBtn && k === " ")) e.preventDefault();
    if (e.repeat) return;
    if (!keys.has(k)) {
      if (k === " " || k === "k") dodgeLatch = true;
      else if (k === "l") skillLatch = true;
      else if (k === "escape" || k === "p") pauseLatch = true;
    }
    keys.add(k);
  }
  function onKeyUp(e) { keys.delete(keyName(e)); }

  // ---- pointers
  const inUI = (t) => t && t.closest && t.closest(UI_SELECTOR);
  const rootRect = () => rootEl.getBoundingClientRect();

  function updateAim(e) {
    const r = rootRect();
    if (!r.width) return;
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = -(e.clientY - (r.top + r.height / 2));
    const len = Math.hypot(dx, dy);
    mouseAim = len > 4 ? { x: dx / len, y: dy / len } : mouseAim;
  }

  function onRootPointerDown(e) {
    anyLatch = true;
    if (e.pointerType === "touch") {
      explicitTouch = true;
      if (!touchVisible) setTouchVisible(true);
      const btn = e.target.closest && e.target.closest("[data-touch-btn]");
      if (btn) {
        const name = btn.dataset.touchBtn;
        btnPointers.set(e.pointerId, name);
        btnHeld[name] = true;
        btn.classList.add("down");
        if (name === "dodge") dodgeLatch = true;
        else if (name === "skill") skillLatch = true;
        try { btn.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
        return;
      }
      if (inUI(e.target)) return;
      const r = rootRect();
      if (stick.id === -1 && e.clientX < r.left + r.width / 2) {
        stick.id = e.pointerId;
        stick.cx = e.clientX - r.left; stick.cy = e.clientY - r.top;
        stick.x = stick.y = 0;
        stickEl.style.left = stick.cx - 60 + "px"; stickEl.style.top = stick.cy - 60 + "px";
        knobEl.style.left = stick.cx - 26 + "px"; knobEl.style.top = stick.cy - 26 + "px";
        stickEl.style.display = knobEl.style.display = "block";
        e.preventDefault();
      }
      return;
    }
    // mouse / pen
    if (inUI(e.target)) return;
    updateAim(e);
    if (e.button === 0) mouseDown[0] = true;
    else if (e.button === 2) { mouseDown[2] = true; skillLatch = true; }
  }

  function onWinPointerMove(e) {
    if (e.pointerType === "touch") {
      if (e.pointerId === stick.id) {
        const r = rootRect();
        let dx = e.clientX - r.left - stick.cx, dy = e.clientY - r.top - stick.cy;
        const len = Math.hypot(dx, dy);
        const k = len > STICK_R ? STICK_R / len : 1;
        dx *= k; dy *= k;
        stick.x = dx / STICK_R; stick.y = -dy / STICK_R; // y up
        knobEl.style.left = stick.cx + dx - 26 + "px"; knobEl.style.top = stick.cy + dy - 26 + "px";
      }
    } else {
      updateAim(e);
    }
  }

  function onWinPointerUp(e) {
    if (e.pointerType === "touch") {
      if (e.pointerId === stick.id) {
        stick.id = -1; stick.x = stick.y = 0;
        stickEl.style.display = knobEl.style.display = "none";
      }
      const name = btnPointers.get(e.pointerId);
      if (name) {
        btnPointers.delete(e.pointerId);
        btnHeld[name] = false;
        btnEls[name].classList.remove("down");
      }
    } else if (e.type === "pointercancel") {
      mouseDown[0] = mouseDown[2] = false;
    } else if (e.button === 0) mouseDown[0] = false;
    else if (e.button === 2) mouseDown[2] = false;
  }

  const prevent = (e) => e.preventDefault();
  const onTouchMove = (e) => { if (e.cancelable) e.preventDefault(); };
  const onBlur = () => clearAll();
  const onVis = () => { if (doc.hidden) clearAll(); };

  win.addEventListener("keydown", onKeyDown);
  win.addEventListener("keyup", onKeyUp);
  win.addEventListener("blur", onBlur);
  doc.addEventListener("visibilitychange", onVis);
  rootEl.addEventListener("pointerdown", onRootPointerDown);
  win.addEventListener("pointermove", onWinPointerMove);
  win.addEventListener("pointerup", onWinPointerUp);
  win.addEventListener("pointercancel", onWinPointerUp);
  rootEl.addEventListener("contextmenu", prevent);
  rootEl.addEventListener("gesturestart", prevent);
  rootEl.addEventListener("gesturechange", prevent);
  rootEl.addEventListener("dblclick", prevent);
  rootEl.addEventListener("touchmove", onTouchMove, { passive: false });
  rootEl.addEventListener("touchstart", (e) => { if (e.touches.length > 1 && e.cancelable) e.preventDefault(); }, { passive: false });

  // auto-detect
  try {
    if (win.matchMedia && win.matchMedia("(pointer: coarse)").matches) setTouchVisible(true);
  } catch (_) {}

  function update() {
    // movement
    let x = 0, y = 0;
    if (keys.has("a") || keys.has("arrowleft")) x -= 1;
    if (keys.has("d") || keys.has("arrowright")) x += 1;
    if (keys.has("w") || keys.has("arrowup")) y += 1;
    if (keys.has("s") || keys.has("arrowdown")) y -= 1;
    if (x || y) {
      const l = Math.hypot(x, y);
      x /= l; y /= l;
    } else if (stick.id !== -1) {
      const l = Math.hypot(stick.x, stick.y);
      if (l > DEADZONE) {
        const m = Math.min(1, (l - DEADZONE) / (1 - DEADZONE)) / l;
        x = stick.x * m; y = stick.y * m;
      }
    }
    state.move.x = x; state.move.y = y;
    state.aim = mouseAim ? { x: mouseAim.x, y: mouseAim.y } : null;
    state.attack = keys.has("j") || mouseDown[0] || btnHeld.attack;
    state.dodge = dodgeLatch; dodgeLatch = false;
    state.skill = skillLatch || false; skillLatch = false;
    anyFrame = anyLatch; anyLatch = false;
    pauseFrame = pauseLatch; pauseLatch = false;
  }
  let pauseFrame = false;

  function dispose() {
    win.removeEventListener("keydown", onKeyDown);
    win.removeEventListener("keyup", onKeyUp);
    win.removeEventListener("blur", onBlur);
    doc.removeEventListener("visibilitychange", onVis);
    rootEl.removeEventListener("pointerdown", onRootPointerDown);
    win.removeEventListener("pointermove", onWinPointerMove);
    win.removeEventListener("pointerup", onWinPointerUp);
    win.removeEventListener("pointercancel", onWinPointerUp);
    rootEl.removeEventListener("contextmenu", prevent);
    rootEl.removeEventListener("gesturestart", prevent);
    rootEl.removeEventListener("gesturechange", prevent);
    rootEl.removeEventListener("dblclick", prevent);
    rootEl.removeEventListener("touchmove", onTouchMove);
    layer.remove(); styleEl.remove();
    rootEl.classList.remove("dusk-input-root");
    rootEl.style.position = prevPos;
  }

  return {
    state,
    update,
    pausePressed: () => pauseFrame,
    anyKey: () => anyFrame,
    setTouchVisible,
    isTouchVisible: () => touchVisible, // addition
    clear: clearAll,                    // addition
    dispose,
  };
}
