// Pose sheet: one row per character, one column per pose. Open tests/rig-demo.html?ids=hero-warrior,enemy-skeleton
import * as THREE from "three";
import { makeAsset } from "../src/engine/assets.js";
const q = new URLSearchParams(location.search);
const ids = (q.get("ids") || "hero-warrior").split(",");
const ALL = [["idle", 0, 0], ["idle", 0, 1], ["idle", 0.2, 1], ["windup", 0.5, 0], ["windup", 1, 0], ["attack", 0.2, 0], ["attack", 1, 0], ["recover", 0.5, 0], ["bash", 1, 0], ["dodge", 1, 0]];
const [c0, c1] = (q.get("cols") || "0-9").split("-").map(Number), POSES = ALL.slice(c0, c1 + 1);
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(innerWidth, innerHeight); document.body.style.margin = 0; document.body.append(r.domElement);
r.shadowMap.enabled = true;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x3d3350);
scene.add(new THREE.HemisphereLight(0xffe0f0, 0x403060, 1.6));
const sun = new THREE.DirectionalLight(0xfff0e0, 2.2); sun.position.set(4, 8, 6); scene.add(sun);
const SP = +(q.get("sp") || 1), W = POSES.length * 1.3 * SP, H = ids.length * 1.5 * SP, a = innerWidth / innerHeight, vh = Math.max(H * 1.15, W / a * 0.95);
const cam = new THREE.OrthographicCamera(-vh * a / 2, vh * a / 2, vh / 2, -vh / 2, 0.1, 100);
const side = q.get("view") === "side";
ids.forEach((id, row) => POSES.forEach(([act, k, move], col) => {
  const A = makeAsset(id);
  A.update(q.get("t") ? +q.get("t") : 0.31 + col * 0.11, { act, k, move });
  const holder = new THREE.Group(); holder.add(A.group);
  holder.rotation.y = side ? Math.PI / 2 : Math.PI / 4; // game camera looks from +x+z
  holder.position.set((col - (POSES.length - 1) / 2) * 1.3 * SP, -(row - (ids.length - 1) / 2) * 1.5 * SP - 0.5 * SP, 0);
  scene.add(holder);
}));
cam.position.set(0, side ? 0.5 : 6, 10); cam.lookAt(0, 0, 0);
r.render(scene, cam); window.__done = true;
