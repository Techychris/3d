// Door sign sheet: every room type's sign as the game camera sees it. Open tests/sign-demo.html
import * as THREE from "three";
import { signGeometry } from "../src/game/rooms.js";
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(innerWidth, innerHeight); document.body.style.margin = 0; document.body.append(r.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x4a3a66);
const types = ["combat", "elite", "treasure", "rest", "boss", "stairs"];
const a = innerWidth / innerHeight, vh = 2.2, cam = new THREE.OrthographicCamera(-vh * a / 2, vh * a / 2, vh / 2, -vh / 2, 0.1, 100);
types.forEach((t, i) => [1, 0.5].forEach((dim, row) => {
  const m = new THREE.Mesh(signGeometry(t), new THREE.MeshBasicMaterial({ vertexColors: true }));
  m.material.color.setScalar(dim); m.rotation.order = "YXZ"; m.rotation.set(-0.45, Math.PI / 4, 0);
  const d = (i - 2.5) * 1.25; m.position.set(d * Math.SQRT1_2, row ? -0.75 : 0.55, -d * Math.SQRT1_2); scene.add(m);
}));
cam.position.set(10, 8.2, 10); cam.lookAt(0, 0, 0); // the game's view direction
r.render(scene, cam); window.__done = true;
