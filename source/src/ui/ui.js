// Module E: UI. Plain DOM; never touches three.js.
import CSS from "./style.js";

const TAG_NAMES = { fire: "Fire", frost: "Frost", bleed: "Bleed", crit: "Crit", shield: "Shield", speed: "Speed", summon: "Summon" };
const tagName = (t) => (t && typeof t === "object" ? t.name || TAG_NAMES[t.id] || t.id : TAG_NAMES[t] || String(t));

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k in el && k !== "list") el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const btn = (text, onclick, cls = "", extra = {}) => h("button", { type: "button", class: cls, onclick, ...extra }, text);
const pct = (v, m) => Math.max(0, Math.min(100, m > 0 ? (v / m) * 100 : 0));
const safe = (fn, ...a) => { try { return fn && fn(...a); } catch (e) { console.error(e); } };

export function createUI(rootEl) {
  if (!document.getElementById("dusk-ui-style")) {
    const st = document.createElement("style");
    st.id = "dusk-ui-style";
    st.textContent = CSS;
    document.head.append(st);
  }
  const root = h("div", { class: "dusk-ui" });
  rootEl.append(root);

  // ---------- HUD ----------
  // Top-left: health (+shield) and ability slots. Top-right: floor progress, foes left, embers, pause.
  // Bottom-left: build tags with 2/3 bonus pips. Top-centre: boss bar with phase ticks. Full-screen hurt vignette.
  const hpFill = h("i"), shFill = h("i", { class: "sh" }), hpText = h("b");
  const hpBar = h("div", { class: "bar hp", role: "meter", "aria-label": "Health", "aria-valuemin": 0 }, hpFill, shFill, hpText);
  const mkSlot = (label, key) => {
    const f = h("i"), t = h("span", { class: "lbl", text: label }), k = h("kbd", { text: key });
    return { el: h("div", { class: "slot", "aria-label": label + " (" + key + ")" }, f, k, t), f, t, label };
  };
  const dodgeSlot = mkSlot("Dodge", "Space"), skillSlot = mkSlot("Bash", "L");
  const hudTL = h("div", { class: "hud-tl plate" }, hpBar, h("div", { class: "slots" }, dodgeSlot.el, skillSlot.el));
  const floorText = h("span", { class: "fl" });
  const pips = h("span", { class: "pips", "aria-hidden": "true" });
  const foesText = h("span", { class: "foes" });
  const curText = h("span", { class: "coin", "aria-label": "Embers" });
  const savedChip = h("span", { class: "saved", text: "Saved" });
  const pauseBtn = h("button", { type: "button", class: "pausebtn", "aria-label": "Pause", text: "II" });
  let pauseHandler = null;
  pauseBtn.addEventListener("click", () => {
    if (pauseHandler) pauseHandler();
    else root.dispatchEvent(new CustomEvent("dusk:pause", { bubbles: true }));
  });
  const hudTR = h("div", { class: "hud-tr" },
    h("div", { class: "plate prog" }, h("div", { class: "row1" }, floorText, pips), h("div", { class: "row2" }, foesText, curText, savedChip)), pauseBtn);
  const hudBL = h("div", { class: "hud-bl", "aria-label": "Build" });
  const bossName = h("div", { class: "nm" }), bossFill = h("i");
  const bossBar = h("div", { class: "bar boss", role: "meter", "aria-label": "Boss health" }, bossFill, h("u", { style: "left:33.3%" }), h("u", { style: "left:66.6%" }));
  const hudTop = h("div", { class: "hud-top plate", hidden: true }, bossName, bossBar);
  const hurt = h("div", { class: "hurt", "aria-hidden": "true" });
  const hud = h("div", { class: "hud", hidden: true }, hurt, hudTL, hudTR, hudBL, hudTop);
  root.append(hud);

  const last = {};
  const setTxt = (el, key, v) => { if (last[key] !== v) { last[key] = v; el.textContent = v; } };
  const touchBtn = {};
  function setCd(slot, key, cd, max, touchSel) {
    const ready = !(cd > 0.05);
    const frac = ready ? 1 : Math.max(0, Math.min(1, (max - cd) / max));
    const k = ready ? "r" : Math.round(cd * 10);
    if (last[key] === k) return;
    last[key] = k;
    slot.el.classList.toggle("ready", ready);
    slot.f.style.width = Math.round(frac * 100) + "%";
    slot.t.textContent = ready ? slot.label : cd.toFixed(1) + "s";
    // touch buttons carry their own cooldown ring
    const tb = touchBtn[touchSel] || (touchBtn[touchSel] = document.querySelector(".dusk-tbtn." + touchSel));
    if (tb) { tb.style.setProperty("--p", frac.toFixed(3)); tb.classList.toggle("cooling", !ready); }
  }

  const hudApi = {
    show(v) { hud.hidden = !v; },
    onPause(fn) { pauseHandler = fn; },
    hurt(strength = 1) {
      hurt.style.setProperty("--a", String(Math.min(1, 0.35 + 0.65 * strength)));
      hurt.classList.remove("on"); void hurt.offsetWidth; hurt.classList.add("on");
    },
    update(s = {}) {
      hud.classList.toggle("touch", !!s.touch);
      const maxHp = s.maxHp || 1, hp = Math.max(0, s.hp || 0), sh = s.shield || 0;
      hpFill.style.width = pct(hp, maxHp) + "%";
      shFill.style.width = pct(Math.min(sh, maxHp), maxHp) + "%";
      shFill.style.display = sh > 0 ? "" : "none";
      hpBar.classList.toggle("low", hp / maxHp < 0.3);
      setTxt(hpText, "hp", Math.ceil(hp) + " / " + Math.ceil(maxHp) + (sh > 0 ? "  +" + Math.ceil(sh) : ""));
      hpBar.setAttribute("aria-valuemax", Math.ceil(maxHp));
      hpBar.setAttribute("aria-valuenow", Math.ceil(hp));
      setTxt(curText, "cur", String(s.currency | 0));
      // floor progress: one pip per room, boss last
      const rooms = s.rooms || 0, room = s.room || 0, isBoss = rooms && room >= rooms - 1;
      setTxt(floorText, "fl", s.floor != null ? "Floor " + s.floor + (isBoss ? " · Boss" : rooms ? " · Room " + (room + 1) + " of " + (rooms - 1) : "") : "");
      const pk = rooms + ":" + room;
      if (last.pips !== pk) {
        last.pips = pk;
        const out = [];
        for (let i = 0; i < rooms; i++) out.push(h("i", { class: (i === rooms - 1 ? "boss " : "") + (i < room ? "done" : i === room ? "now" : "") }));
        pips.replaceChildren(...out);
      }
      setTxt(foesText, "foes", s.foes == null ? "" : s.foes > 0 ? s.foes + (s.foes === 1 ? " foe left" : " foes left") : "Portal open");
      foesText.classList.toggle("clear", s.foes === 0);
      savedChip.classList.toggle("show", !!s.saved);
      setCd(dodgeSlot, "dodge", s.dodgeCd || 0, s.dodgeMax || 1, "dodge");
      setCd(skillSlot, "skill", s.skillCd || 0, s.skillMax || 1, "skill");
      const tags = s.tags || {};
      const tk = Object.keys(tags).filter((k) => tags[k] > 0).map((k) => k + tags[k]).join(",");
      if (last.tags !== tk) {
        last.tags = tk;
        hudBL.replaceChildren(...Object.keys(tags).filter((k) => tags[k] > 0).sort((x, y) => tags[y] - tags[x]).map((k) => {
          const n = tags[k], dots = [1, 2, 3].map((i) => h("i", { class: i <= n ? "f" : "" }));
          return h("span", { class: "tagchip" + (n >= 3 ? " max" : n >= 2 ? " on" : ""), "aria-label": tagName(k) + " " + n + " of 3" + (n >= 2 ? ", bonus active" : "") },
            h("span", { text: tagName(k) }), h("span", { class: "dots" }, ...dots));
        }));
      }
      const b = s.boss;
      hudTop.hidden = !b;
      if (b) {
        setTxt(bossName, "bn", b.name);
        bossFill.style.width = pct(b.hp, b.maxHp) + "%";
        bossBar.setAttribute("aria-valuenow", Math.ceil(b.hp));
        bossBar.setAttribute("aria-valuemax", Math.ceil(b.maxHp));
      }
    },
  };

  // ---------- overlays ----------
  const screen = h("div", { class: "screen", hidden: true, role: "dialog", "aria-modal": "true" });
  const rotate = h("div", { class: "screen rotate", hidden: true, role: "alert" },
    h("div", { class: "phone", "aria-hidden": "true" }), h("h2", { text: "Rotate your device" }), h("p", { class: "muted", text: "This game plays in landscape." }));
  const loadText = h("div");
  const loading = h("div", { class: "screen loading", hidden: true, role: "status" }, h("div", { class: "spin", "aria-hidden": "true" }), loadText);
  const toastEl = h("div", { class: "toast", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  root.append(screen, rotate, loading, toastEl);

  let keyHandler = null; // active screen's key handler
  let escHandler = null;
  function open(panel, focusEl) {
    screen.replaceChildren(panel);
    screen.hidden = false;
    screen.setAttribute("aria-label", panel.getAttribute("aria-label") || "Menu");
    screen.scrollTop = 0;
    const f = focusEl || panel.querySelector(".primary") || panel.querySelector("button");
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 0);
  }
  function close() { screen.hidden = true; screen.replaceChildren(); keyHandler = escHandler = null; }

  document.addEventListener("keydown", (e) => {
    if (screen.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === "Escape" && escHandler) { e.preventDefault(); e.stopPropagation(); escHandler(); return; }
    if (inField) return;
    if (keyHandler && keyHandler(e)) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  const panel = (cls, label, ...kids) => h("div", { class: "panel stack " + cls, "aria-label": label }, ...kids);

  // ---------- hub ----------
  function showHub(meta = {}, o = {}) {
    keyHandler = escHandler = null;
    const endings = (meta.endings || []).length;
    const cost = o.upgradeCost == null ? null : o.upgradeCost;
    const lvl = (meta.upgrades && meta.upgrades.vigor) || 0;
    const canBuy = cost != null && (meta.currency || 0) >= cost;
    const up = btn(cost == null ? "Vigor maxed" : "Vigor +5% max HP: " + cost + " embers", () => safe(o.onUpgrade, "vigor"), "", { disabled: cost == null || !canBuy, "aria-label": cost == null ? "Vigor upgrade, maxed out" : "Buy Vigor upgrade for " + cost + " embers" + (canBuy ? "" : ", not enough embers") });
    open(panel("hub center", "Camp",
      h("h1", { text: "Dusk Camp" }),
      h("p", { class: "muted sub", text: "Gather by the fire, then step through the portal." }),
      h("div", { class: "row" }, btn("Start run", () => safe(o.onStart), "primary big"), btn("Daily seed run", () => safe(o.onDaily))),
      h("div", { class: "stats" },
        h("div", { class: "stat" }, h("span", { text: "Embers" }), h("span", { class: "coin", text: String(meta.currency | 0) })),
        h("div", { class: "stat" }, h("span", { text: "Endings found" }), h("span", { text: endings + " of 3" })),
        h("div", { class: "stat" }, h("span", { text: "Vigor" }), h("span", { text: lvl + " of 2" }))),
      h("div", { class: "row" }, up, btn("Codex", () => safe(o.onCodex)), btn("Settings", () => safe(o.onSettings)))));
  }

  // ---------- shrine ----------
  function showShrine(cards = [], o = {}) {
    let sel = 0;
    const els = cards.map((c, i) => {
      const tags = (c.tags || []).map((t) => {
        const owned = t && t.owned;
        return h("span", { class: "tag" + (owned ? " owned" : "") }, tagName(t), owned ? " (owned)" : "");
      });
      const combo = !!(c.combo || c.bonusNote);
      const el = h("div", { class: "card", role: "group", "aria-label": c.name + (combo ? ", completes a combo" : "") },
        h("span", { class: "key", "aria-hidden": "true", text: "[" + (i + 1) + "]" }),
        h("h3", { text: c.name }),
        h("div", { class: "tags" }, tags),
        combo ? h("span", { class: "combo", text: "COMBO" }) : null,
        c.effect ? h("p", { class: "effect", text: c.effect }) : null,
        h("p", { class: "flavor", text: c.desc }),
        c.pairsWith ? h("p", { class: "pairs", text: "Pairs with your " + c.pairsWith }) : null,
        c.bonusNote ? h("p", { class: "bonus", text: c.bonusNote }) : null,
        h("div", { class: "grow" }),
        btn("Take", () => take(i), "primary take", { "aria-label": "Take " + c.name }));
      el.addEventListener("pointerenter", () => select(i));
      el.querySelector(".take").addEventListener("focus", () => select(i));
      return el;
    });
    function select(i) { sel = i; els.forEach((e, j) => e.classList.toggle("sel", j === i)); }
    function take(i) { if (cards[i]) safe(o.onTake, cards[i].id); }
    const cost = o.rerollCost;
    const reroll = btn("Reroll" + (cost != null ? " (" + cost + " embers)" : ""), () => safe(o.onReroll), "", { disabled: o.canReroll === false, "aria-label": "Reroll offers" + (cost != null ? " for " + cost + " embers" : "") });
    open(h("div", { class: "shrine", "aria-label": "Shrine" },
       h("div", { class: "panel center head", style: "padding:12px 28px" }, h("h2", { text: "Shrine of Dusk" }), h("p", { class: "muted sub", text: "Choose one blessing. Keys 1-3 select, Enter takes." })),
      h("div", { class: "cards" }, els),
      h("div", { class: "row" }, reroll, btn("Skip", () => safe(o.onSkip)))), els[0] && els[0].querySelector(".take"));
    select(0);
    keyHandler = (e) => {
      if (e.key >= "1" && e.key <= "3" && cards[+e.key - 1]) { select(+e.key - 1); els[sel].querySelector(".take").focus({ preventScroll: true }); return true; }
      if (e.key === "Enter" && e.target.tagName !== "BUTTON") { take(sel); return true; }
      return false;
    };
  }

  // ---------- recap ----------
  function showRecap(r = {}, o = {}) {
    keyHandler = escHandler = null;
    const lost = r.itemsLost || [], ends = r.endingsNew || [];
    open(panel("recap", r.won ? "Run won" : "Run over",
      h("h1", { text: r.won ? "Victory" : "You fell" }),
      !r.won && r.killer ? h("p", { text: "Defeated by " + r.killer + " on floor " + r.floor + ", room " + (r.room + 1) + "." }) : h("p", { text: "Reached floor " + r.floor + ", room " + (r.room + 1) + "." }),
      !r.won && r.tip ? h("p", { class: "tipbox" }, h("b", { text: "Tip: " }), r.tip) : null,
      h("p", {}, "Embers kept: ", h("span", { class: "coin", text: String(r.currencyKept | 0) })),
      lost.length ? h("div", {}, h("p", { class: "lost", text: "Items lost:" }), h("ul", {}, lost.map((n) => h("li", { text: n })))) : null,
      ends.length ? h("div", {}, h("p", { class: "coin", text: "New endings:" }), h("ul", {}, ends.map((n) => h("li", { text: n })))) : null,
      h("div", { class: "row" }, btn("Again", () => safe(o.onAgain), "primary big"), btn("Back to camp", () => safe(o.onHub)))));
  }

  // ---------- pause ----------
  function showPause(o = {}) {
    keyHandler = escHandler = null;
    open(panel("center", "Paused", h("h2", { text: "Paused" }),
      btn("Resume", () => safe(o.onResume), "primary big"), btn("Settings", () => safe(o.onSettings)), btn("Quit to camp", () => safe(o.onQuit))));
  }

  // ---------- settings ----------
  function showSettings(s = {}, o = {}) {
    keyHandler = null;
    escHandler = () => safe(o.onClose);
    const msg = h("p", { class: "msg", role: "status", "aria-live": "polite" });
    const slider = (key, label) => {
      const val = h("span", { class: "muted", text: Math.round((s[key] ?? 0) * 100) + "%" });
      const inp = h("input", { type: "range", min: 0, max: 100, value: Math.round((s[key] ?? 0) * 100), "aria-label": label, oninput: () => { val.textContent = inp.value + "%"; safe(o.onChange, key, inp.value / 100); } });
      return h("label", { class: "field" }, h("span", { text: label }), inp, val);
    };
    const check = (key, label) => {
      const inp = h("input", { type: "checkbox", checked: !!s[key], onchange: () => safe(o.onChange, key, inp.checked) });
      return h("label", { class: "field" }, h("span", { text: label }), inp);
    };
    const quality = h("select", { "aria-label": "Graphics quality", onchange: () => safe(o.onChange, "quality", quality.value) },
      ["auto", "high", "medium", "low"].map((q) => h("option", { value: q, selected: s.quality === q, text: q[0].toUpperCase() + q.slice(1) })));
    const code = h("textarea", { "aria-label": "Save code", placeholder: "Paste a save code here", rows: 3, spellcheck: false });
    const say = (text, bad) => { msg.textContent = text; msg.className = "msg" + (bad ? " warn" : " coin"); };
    open(panel("settings", "Settings", h("h2", { text: "Settings" }),
      h("label", { class: "field" }, h("span", { text: "Graphics quality" }), quality),
      slider("music", "Music"), slider("sfx", "Sound effects"),
      check("shake", "Screen shake"), check("flashes", "Flashing effects"), check("blur", "Blur effects"), check("screenRelative", "Screen-relative movement"),
      h("div", { class: "stack" },
        h("h3", { text: "Save code" }), code,
        h("div", { class: "row" },
          btn("Copy code", () => {
            try {
              const c = o.onCopyCode ? o.onCopyCode() : "";
              code.value = c;
              if (navigator.clipboard) navigator.clipboard.writeText(c).then(() => say("Code copied."), () => say("Copy it from the box above."));
              else say("Copy it from the box above.");
            } catch (e) { say("Could not make a code.", true); }
          }),
          btn("Load code", () => {
            try { const r = o.onLoadCode ? o.onLoadCode(code.value.trim()) : null; say(r ? r.message : "", r && !r.ok); } catch (e) { say(e.message || "Could not load.", true); }
          })), msg),
      btn("Close", () => safe(o.onClose), "primary")));
  }

  // ---------- codex ----------
  function showCodex(entries = [], o = {}) {
    keyHandler = null;
    escHandler = () => safe(o.onClose);
    const seen = entries.filter((e) => e.seen).length;
    const tagEls = (tags) => h("div", { class: "tags" }, (tags || []).map((t) => h("span", { class: "tag" }, tagName(t))));
    open(panel("codex", "Codex", h("h2", { text: "Codex" }), h("p", { class: "muted", text: seen + " of " + entries.length + " items discovered" }),
      h("div", { class: "codex-grid" }, entries.map((e) => e.seen
        ? h("div", { class: "entry" }, h("h3", { text: e.name }), tagEls(e.tags), h("p", { class: "muted", text: e.desc }))
        : h("div", { class: "entry unseen", "aria-label": "Undiscovered item" }, h("h3", { text: "Unknown item" }), h("p", { class: "muted", text: "Not yet discovered." })))),
      btn("Close", () => safe(o.onClose), "primary")));
  }

  let toastT = 0;
  return {
    hud: hudApi,
    showHub, showShrine, showRecap, showPause, showSettings, showCodex,
    showRotate(v) { rotate.hidden = !v; },
    showLoading(t) { loading.hidden = t == null || t === false; if (t) loadText.textContent = t; },
    toast(text) {
      toastEl.textContent = text;
      toastEl.classList.add("show");
      clearTimeout(toastT);
      toastT = setTimeout(() => toastEl.classList.remove("show"), 2400);
    },
    hideAll() { close(); loading.hidden = true; },
    // additions
    close,
    el: root,
  };
}
