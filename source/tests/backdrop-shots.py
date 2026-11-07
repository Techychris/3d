import sys, asyncio
from playwright.sync_api import sync_playwright
themes = sys.argv[1].split(",") if len(sys.argv) > 1 else ["1","2","3","hub"]
extra = sys.argv[2] if len(sys.argv) > 2 else ""
suffix = sys.argv[3] if len(sys.argv) > 3 else ""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
    for th in themes:
        for name,(w,h) in {"desk":(1280,800),"phone":(844,390)}.items():
            pg = b.new_page(viewport={"width":w,"height":h})
            msgs=[]
            pg.on("console", lambda m: msgs.append(m.text) if m.type in ("error","warning") else None)
            pg.on("pageerror", lambda e: msgs.append(str(e)))
            pg.goto(f"http://localhost:8123/tests/backdrop-demo.html?theme={th}{extra}")
            pg.wait_for_function("window.__done===true", timeout=60000)
            pg.wait_for_timeout(1500)
            pg.screenshot(path=f"/home/claude/game/tests/backdrop-{th}-{name}{suffix}.png")
            info = pg.evaluate("window.__info()")
            print(th,name,"calls",info["calls"],"errors",msgs, pg.evaluate("window.__errors"))
            pg.close()
    b.close()
