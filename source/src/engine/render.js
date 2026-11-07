// Renderer, camera, dusk lighting, post-effects and quality presets.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { HorizontalTiltShiftShader } from "three/addons/shaders/HorizontalTiltShiftShader.js";
import { VerticalTiltShiftShader } from "three/addons/shaders/VerticalTiltShiftShader.js";

const CAM_DIR = new THREE.Vector3(1, 0.85, 1).normalize();
const CAM_DIST = 40;
const PRESETS = {
  low: { pixelRatio: 0.75, shadows: false, bloom: false, blur: false, fog: false, maxFps: 30, lamps: 0 },
  medium: { pixelRatio: 1, shadows: true, bloom: true, blur: false, fog: true, maxFps: 60, lamps: 2 },
  high: { pixelRatio: 2, shadows: true, bloom: true, blur: true, fog: true, maxFps: 60, lamps: 4 },
};

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // gradient dusk sky
  const c = document.createElement("canvas"); c.width = 2; c.height = 256;
  const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "#8f87b8"); gr.addColorStop(0.55, "#c7a9c4"); gr.addColorStop(1, "#e7c3b8");
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const sky = new THREE.CanvasTexture(c); sky.colorSpace = THREE.SRGBColorSpace; scene.background = sky;
  const fog = new THREE.Fog(0xc9b0c8, CAM_DIST + 6, CAM_DIST + 34);

  const hemi = new THREE.HemisphereLight(0xb9a8e0, 0x4a3a50, 1.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd2c0, 1.1);
  sun.position.set(-6, 10, 4); sun.target.position.set(0, 0, 0);
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 40 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 200);
  const target = new THREE.Vector3();
  let halfH = 5.2, zoom = 1;
  const shakeOff = new THREE.Vector3();
  let shakeAmt = 0;

  // post-effects
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.6, 0.85);
  const hT = new ShaderPass(HorizontalTiltShiftShader), vT = new ShaderPass(VerticalTiltShiftShader);
  composer.addPass(bloom); composer.addPass(hT); composer.addPass(vT);
  composer.addPass(new OutputPass());

  let preset = "high", P = PRESETS.high, blurAllowed = true, lamps = [];
  const projected = new THREE.Vector3();

  function applyPreset(name) {
    preset = name; P = PRESETS[name];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, P.pixelRatio));
    renderer.shadowMap.enabled = P.shadows; sun.castShadow = P.shadows;
    scene.fog = P.fog ? fog : null;
    bloom.enabled = P.bloom;
    lamps.forEach((l, i) => { l.visible = i < P.lamps; });
    scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { m.needsUpdate = true; }); } });
    resize();
  }

  function resize() {
    const w = container.clientWidth || window.innerWidth, h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + "px"; renderer.domElement.style.height = h + "px";
    composer.setSize(w, h);
    composer.setPixelRatio(renderer.getPixelRatio());
    const a = w / Math.max(h, 1);
    // fit a 12 x 10 tile area at any aspect (room 10 x 8 plus margin)
    const needH = Math.max(halfH, 7.4 / a);
    camera.left = -needH * a / zoom; camera.right = needH * a / zoom; camera.top = needH / zoom; camera.bottom = -needH / zoom;
    camera.updateProjectionMatrix();
    hT.uniforms.h.value = 1.6 / w; vT.uniforms.v.value = 1.6 / h;
  }

  function lookAt(x, z) { target.set(x, 0, z); }

  // Warm point lights at every mesh named "flame" in a group (torches, braziers, campfire), up to the preset's cap.
  function addLampsFrom(group) {
    lamps.forEach(l => l.parent && l.parent.remove(l)); lamps = [];
    const flames = [];
    group.updateMatrixWorld(true);
    group.traverse(o => { if (o.name === "flame") flames.push(o); });
    for (const f of flames.slice(0, 4)) {
      const L = new THREE.PointLight(0xffb070, 2.4, 4.5, 1.6);
      f.getWorldPosition(L.position); L.position.y += 0.3;
      scene.add(L); lamps.push(L);
    }
    lamps.forEach((l, i) => { l.visible = i < P.lamps; });
  }

  function shake(amount) { shakeAmt = Math.max(shakeAmt, amount); }

  function render(dt, focus) {
    // camera follow with slight lag + shake rig offset
    shakeAmt *= Math.exp(-dt * 12);
    if (shakeAmt > 0.002) shakeOff.set((Math.random() - 0.5) * 2, (Math.random() - 0.5), (Math.random() - 0.5) * 2).multiplyScalar(shakeAmt);
    else shakeOff.set(0, 0, 0);
    camera.position.copy(target).addScaledVector(CAM_DIR, CAM_DIST).add(shakeOff);
    camera.lookAt(target.x + shakeOff.x, shakeOff.y, target.z + shakeOff.z);
    camera.updateMatrixWorld();
    const blur = P.blur && blurAllowed;
    hT.enabled = vT.enabled = blur;
    if (blur && focus) {
      // keep the band of sharp focus on the player's row (readability guard)
      projected.set(focus.x, 0.5, focus.z).project(camera);
      hT.uniforms.r.value = vT.uniforms.r.value = Math.min(0.85, Math.max(0.15, projected.y * 0.5 + 0.5));
    } else { hT.uniforms.r.value = vT.uniforms.r.value = 0.5; }
    if (P.bloom || blur) composer.render(); else renderer.render(scene, camera);
  }

  window.addEventListener("resize", resize);
  applyPreset("high");
  return {
    renderer, scene, camera, sun,
    resize, lookAt, render, shake, addLampsFrom,
    setPreset: applyPreset, get preset() { return preset; }, get maxFps() { return P.maxFps; },
    setBlurAllowed(v) { blurAllowed = v; },
    setZoom(z) { zoom = z; resize(); },
    PRESETS,
  };
}
