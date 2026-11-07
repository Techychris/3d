# Headless playtest: python3 tests/play.py [god]
import sys, time, json, subprocess, os
from playwright.sync_api import sync_playwright
GOD = "god" in sys.argv
ROOT = os.path.join(os.path.dirname(__file__), "..", "dist")
OUT = os.path.join(os.path.dirname(__file__), "play")
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "-d", ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
ARGS = ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
report = {"errors": [], "warnings": [], "timeline": []}
def log(msg):
    report["timeline"].append(msg); print(msg, flush=True)
try:
  with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=ARGS)
    # ---------- desktop run ----------
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    pg.on("console", lambda m: report["errors" if m.type == "error" else "warnings"].append(m.text) if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: report["errors"].append("PAGEERROR " + str(e)))
    pg.goto("http://localhost:8765/?bot" + ("&god" if GOD else ""))
    pg.wait_for_function("window.__game && window.__game.state === 'hub'", timeout=60000)
    time.sleep(1.5); pg.screenshot(path=f"{OUT}/desk-hub.png"); log("hub ok")
    pg.get_by_role("button", name="Start run").click()
    shots = set(); t0 = time.time(); last = None; limit = 900 if GOD else 420
    while time.time() - t0 < limit:
        st = pg.evaluate("(() => { const g = window.__game; const r = g.run; return { s: g.state, f: r && r.floor, r: r && r.room, hp: g.world.player && Math.round(g.world.player.hp), foes: g.world.enemies.filter(e => !e.dead).length, items: r ? r.items.length : 0 }; })()")
        key = (st["s"], st["f"], st["r"])
        if key != last: log(f"{time.time()-t0:6.1f}s {st}"); last = key
        if st["s"] == "run":
            tag = f"f{st['f']}r{st['r']}"
            if tag not in shots and st["foes"] > 0 and (st["r"] in (0, 4)):
                time.sleep(2.0); pg.screenshot(path=f"{OUT}/desk-{tag}.png"); shots.add(tag)
        elif st["s"] == "shrine":
            if "shrine" not in shots: time.sleep(0.5); pg.screenshot(path=f"{OUT}/desk-shrine.png"); shots.add("shrine")
            btns = pg.locator("button.take")
            if btns.count(): btns.first.click()
        elif st["s"] == "recap":
            time.sleep(1.0); pg.screenshot(path=f"{OUT}/desk-recap.png"); log("recap: " + pg.locator("#ui").inner_text()[:300].replace("\n", " | ")); break
        time.sleep(0.4)
    fps = pg.evaluate("window.__game.fps || null"); log(f"fps hook: {fps}")
    pg.close()
    # ---------- phone (touch, landscape) ----------
    ctx = b.new_context(viewport={"width": 844, "height": 390}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ph = ctx.new_page()
    ph.on("pageerror", lambda e: report["errors"].append("PHONE PAGEERROR " + str(e)))
    ph.on("console", lambda m: report["errors"].append("PHONE " + m.text) if m.type == "error" else None)
    ph.goto("http://localhost:8765/?bot")
    ph.wait_for_function("window.__game && window.__game.state === 'hub'", timeout=60000)
    time.sleep(1.2); ph.screenshot(path=f"{OUT}/phone-hub.png")
    ph.get_by_role("button", name="Start run").tap()
    ph.wait_for_function("window.__game.state === 'run'", timeout=30000); time.sleep(3)
    ph.screenshot(path=f"{OUT}/phone-room.png"); log("phone room ok")
    ph.set_viewport_size({"width": 390, "height": 844}); time.sleep(1.0)
    ph.screenshot(path=f"{OUT}/phone-portrait.png"); log("phone portrait state: " + ph.evaluate("window.__game.state"))
    b.close()
finally:
    srv.terminate()
report["warnings"] = sorted(set(report["warnings"]))[:30]
json.dump(report, open(f"{OUT}/report{'-god' if GOD else ''}.json", "w"), indent=1)
print("ERRORS:", len(report["errors"])); [print(" ", e[:300]) for e in report["errors"][:15]]
print("WARNINGS:", report["warnings"][:10])
