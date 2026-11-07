export const meta = {
  id: "boss-slime-king",
  name: "Slime King",
  category: "boss",
  footprint: [2, 2],
  height: 1.8,
  flying: false
};

const BODY_R = 0.7;   // slime shell radius; base sits on y = 0, top at y = 1.4 (before squash)

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const slime = new THREE.MeshStandardMaterial({ color: 0x7bc86c, flatShading: true, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.75 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x4f7a3f, flatShading: true, roughness: 0.8, metalness: 0 });
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, flatShading: true, roughness: 0.8, metalness: 0 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, flatShading: true, roughness: 0.8, metalness: 0.3 });
  const metalDark = new THREE.MeshStandardMaterial({ color: 0x5b636d, flatShading: true, roughness: 0.8, metalness: 0 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x4e3423, flatShading: true, roughness: 0.8, metalness: 0 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b04a, flatShading: true, roughness: 0.8, metalness: 0.3 });
  const danger = new THREE.MeshStandardMaterial({ color: 0xff4d3d, emissive: 0xff4d3d, emissiveIntensity: 1.0, flatShading: true, roughness: 0.8, metalness: 0 });
  const shadowMat = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });

  // Wobble pivot sits on the floor at the footprint centre, so squashing keeps the base planted.
  const wobble = new THREE.Group(); wobble.name = "wobble"; g.add(wobble);

  const shell = new THREE.Mesh(new THREE.SphereGeometry(BODY_R, 12, 10), slime);
  shell.position.y = BODY_R; shell.name = "body"; wobble.add(shell);

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), cloth);
  core.position.y = BODY_R; core.name = "core"; wobble.add(core);

  // Bones stuck inside the shell: a shaft with a knob at each end.
  const addBone = (x, y, z, rz) => {
    const b = new THREE.Group(); b.name = "bone";
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.34, 6), boneMat);
    b.add(shaft);
    for (const s of [-1, 1]) {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), boneMat);
      knob.position.y = s * 0.17; b.add(knob);
    }
    b.position.set(x, y, z); b.rotation.z = rz; wobble.add(b);
  };
  addBone(-0.2, 0.55, 0.15, 0.7);
  addBone(0.25, 0.45, -0.1, -0.4);

  // Sword stuck point-first into the core: blade, crossguard and grip in one tilted group.
  const sword = new THREE.Group(); sword.name = "sword";
  sword.position.set(0.1, 0.85, 0.1); sword.rotation.z = -0.35;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.02), metal);
  blade.name = "blade"; sword.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.05), metalDark);
  guard.position.y = -0.25; sword.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6), woodDark);
  grip.position.y = -0.33; sword.add(grip);
  wobble.add(sword);

  // Big danger-red eyes on the front (+z) face, glowing.
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), danger);
    eye.position.set(s * 0.25, 0.85, 0.62); eye.name = "eye"; wobble.add(eye);
  }

  // Gold crown: band plus five spikes. Its group rides on top of the shell in update().
  const crown = new THREE.Group(); crown.name = "crown";
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.12, 8), gold);
  band.position.y = 0.06; band.name = "band"; crown.add(band);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 5), gold);
    spike.position.set(Math.sin(a) * 0.24, 0.22, Math.cos(a) * 0.24);
    crown.add(spike);
  }
  crown.position.y = 1.4 - 0.04;
  g.add(crown);

  // Blob shadow sized to the footprint; it stays put during update().
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.95, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow";
  g.add(shadow);

  g.userData.wobble = wobble;
  g.userData.crown = crown;
  return g;
}

export function update(group, t) {
  const wobble = group.userData.wobble;
  const crown = group.userData.crown;
  const s = Math.sin(t * 2.2);              // slow wobble
  const sy = 1 + 0.06 * s;
  const sxz = 1 - 0.04 * s;                 // widen as it shortens, and the reverse
  wobble.scale.set(sxz, sy, sxz);
  crown.position.y = 1.4 * sy - 0.04;       // keep the crown on the top of the shell
}
