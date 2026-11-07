// Visual demo: ?floor=1&seed=abc&boss=0&exits=combat,elite&type=combat&zoom=0.8
import { createRenderer } from "../src/engine/render.js";
import { createWorld } from "../src/game/world.js";
import { buildRoom } from "../src/game/rooms.js";
const q = new URLSearchParams(location.search);
const R = createRenderer(document.getElementById("app"));
const world = createWorld(R.scene);
const boss = q.get("boss") === "1";
const room = buildRoom(world, { floor: +(q.get("floor") || 1), seed: q.get("seed") || "demo", index: +(q.get("index") || 0), boss, exits: q.get("exits") ? q.get("exits").split(",") : undefined, roomType: q.get("type") || "combat" });
R.addLampsFrom(room.group);
if (q.get("open")) room.exits.forEach((e) => e.setOpen(true));
if (room.chest && q.get("chest")) room.chest.open();
R.setZoom(+(q.get("zoom") || 0.9));
const b = room.cameraBounds;
R.lookAt((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2);
// spawn markers
const sp = [];
for (const s of room.spawns) { const m = new world.THREE.Mesh(new world.THREE.CylinderGeometry(0.25, 0.25, 0.8, 8), new world.THREE.MeshBasicMaterial({ color: 0xff3030 })); m.position.set(s.x, 0.4, s.z); world.add(m); }
const pm = new world.THREE.Mesh(new world.THREE.CylinderGeometry(0.25, 0.25, 1, 8), new world.THREE.MeshBasicMaterial({ color: 0x30ff60 })); pm.position.set(room.playerStart.x, 0.5, room.playerStart.z); world.add(pm);
let t = 0;
R.renderer.setAnimationLoop(() => { t += 1 / 60; world.time = t; room.update(world, 1 / 60); R.render(1 / 60, null); window.__ready = true;
  let calls = 0; R.scene.traverse((o) => { if ((o.isMesh || o.isPoints) && o.visible) { let v = true; for (let p = o.parent; p; p = p.parent) if (!p.visible) v = false; if (v) calls++; } });
  window.__calls = calls; });
window.__info = { spawns: room.spawns.length, layout: [room.layout.w, room.layout.h], bounds: room.cameraBounds };
