import * as THREE from "three";
import { createBackdrop } from "../src/engine/backdrop.js";

const q = new URLSearchParams(location.search);
const theme = q.get("theme") || "1";
const quality = q.get("quality") || "high";
const tx = parseFloat(q.get("tx") || "0"), tz = parseFloat(q.get("tz") || "0");
window.__errors = [];
window.addEventListener("error", e => window.__errors.push(String(e.message)));
const ce = console.error; console.error = (...a) => { window.__errors.push(a.join(" ")); ce(...a); };

const container = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(1);
container.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xb9a8e0, 0x4a3a50, 1.5));
const sun = new THREE.DirectionalLight(0xffd2c0, 1.1); sun.position.set(-6, 10, 4); scene.add(sun);

// placeholder island
const top = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, 12), new THREE.MeshStandardMaterial({ color: 0x8fb07a, roughness: 1 }));
top.position.y = -0.4; if (!q.get('noisland')) scene.add(top);
const under = new THREE.Mesh(new THREE.ConeGeometry(7, 3, 6), new THREE.MeshStandardMaterial({ color: 0x6d5f8c, roughness: 1, flatShading: true }));
under.rotation.x = Math.PI; under.position.y = -2.3; if (!q.get('noisland')) scene.add(under);

// camera rig copied from src/engine/render.js
const CAM_DIR = new THREE.Vector3(1, 0.85, 1).normalize(), CAM_DIST = 40;
const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 200);
const target = new THREE.Vector3(tx, 0, tz);
const halfH = 5.2, zoom = 1;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + "px"; renderer.domElement.style.height = h + "px";
  const a = w / Math.max(h, 1), needH = Math.max(halfH, 7.4 / a);
  camera.left = -needH * a / zoom; camera.right = needH * a / zoom; camera.top = needH / zoom; camera.bottom = -needH / zoom;
  camera.updateProjectionMatrix();
}
resize(); addEventListener("resize", resize);

const bd = createBackdrop(scene, camera);
bd.setQuality(quality);
bd.setTheme(theme === "hub" ? "hub" : +theme, true);

const timer = new THREE.Timer();
let frames = 0;
renderer.setAnimationLoop((ts) => {
  timer.update(ts);
  const dt = Math.min(timer.getDelta(), 0.1), t = 20 + timer.getElapsed();
  camera.position.copy(target).addScaledVector(CAM_DIR, CAM_DIST);
  camera.lookAt(target.x, 0, target.z); camera.updateMatrixWorld();
  bd.update(dt, t, target.x, target.z);
  renderer.render(scene, camera);
  if (++frames === 6) window.__done = true;
});
window.__info = () => renderer.info.render;
