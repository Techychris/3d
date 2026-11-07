export const meta = {
  id: "enemy-cultist",
  name: "Cultist",
  category: "enemy",
  footprint: [0.7, 0.7],
  height: 1.05,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...extra });
  const glow = (color, intensity) => mat(color, { emissive: color, emissiveIntensity: intensity });

  const robeMat = mat(0xa8423a);
  const sashMat = mat(0x3b3a40);
  const skinMat = mat(0xd9a27e);
  const blackMat = mat(0x000000);
  const goldMat = mat(0xe0b04a, { metalness: 0.3 });
  const orbMat = glow(0x8c5be0, 1.2);
  const eyeMat = glow(0xff4d3d, 1.0);
  const auraMat = mat(0x8c5be0, { emissive: 0x8c5be0, emissiveIntensity: 0.8, transparent: true, opacity: 0.25, depthWrite: false });

  // Parts whose y moves with the idle bob: { obj, baseY }
  const movers = [];
  const track = (obj) => { movers.push({ obj, baseY: obj.position.y }); return obj; };
  const add = (mesh, name) => { mesh.name = name; g.add(mesh); return mesh; };

  // A cylinder stretched between two points (used for raised forearms).
  const limb = (a, b, r, m) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), m);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return mesh;
  };

  // Blob shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 12),
    new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, flatShading: true, roughness: 0.8, metalness: 0 })
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01;
  add(shadow, "shadow");

  // Robe: tapered lathe-like cylinder, wide hem, narrow shoulders
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.3, 0.85, 8), robeMat);
  robe.position.y = 0.425;
  add(robe, "robe");

  // Stone-dark sash around the waist with a hanging tail on the front
  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.07, 8), sashMat);
  sash.position.y = 0.5;
  add(sash, "sash");
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.25, 0.025), sashMat);
  tail.position.set(0, 0.375, 0.245);
  add(tail, "sashTail");

  // Deep hood with a pointed drape at the back, shadowed face opening
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), robeMat);
  hood.position.y = 0.88;
  add(hood, "hood");
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.15, 0.22, 8), robeMat);
  tip.position.set(0, 0.93, -0.02);
  add(tip, "hoodTip");
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.13, 0.03), blackMat);
  face.position.set(0, 0.88, 0.15);
  add(face, "face");

  // Danger-red eyes
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), eyeMat);
    eye.position.set(s * 0.045, 0.9, 0.165);
    add(eye, "eye");
  }

  // Raised arms: red sleeves from shoulder to hand, skin hands around the orb
  const orbPos = new THREE.Vector3(0, 0.85, 0.24);
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Vector3(s * 0.17, 0.72, 0.03);
    const hand = new THREE.Vector3(s * 0.07, 0.84, 0.2);
    track(add(limb(shoulder, hand, 0.05, robeMat), "sleeve"));
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), skinMat);
    h.position.copy(hand);
    track(add(h, "hand"));
  }

  // Magic orb between the hands, with a faint aura
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), orbMat);
  orb.position.copy(orbPos);
  track(add(orb, "orb"));
  const aura = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), auraMat);
  aura.position.copy(orbPos);
  track(add(aura, "aura"));

  // Gold amulet on the chest
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 4, 10), goldMat);
  ring.position.set(0, 0.67, 0.19);
  add(ring, "amulet");
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.018, 0), goldMat);
  gem.position.set(0, 0.67, 0.2);
  add(gem, "amuletGem");

  g.userData.movers = movers;
  g.userData.orb = orb;
  g.userData.aura = aura;
  g.userData.orbMat = orbMat;
  return g;
}

export function update(group, t) {
  const movers = group.userData.movers;
  if (!movers) return;
  const bob = Math.sin(t * 2.5) * 0.012;
  for (let i = 0; i < movers.length; i++) {
    movers[i].obj.position.y = movers[i].baseY + bob;
  }
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  group.userData.orb.scale.setScalar(0.92 + 0.16 * pulse);
  group.userData.aura.scale.setScalar(0.95 + 0.15 * pulse);
  group.userData.orbMat.emissiveIntensity = 0.8 + 0.6 * pulse;
}
