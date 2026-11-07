export const meta = {
  id: "hero-warrior",
  name: "Warrior",
  category: "hero",
  footprint: [0.8, 0.8],
  height: 1.0,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const mat = (color, metal = false) => new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: metal ? 0.5 : 0.8, metalness: metal ? 0.3 : 0
  });
  const stoneDark = mat(0x3b3a40);
  const metal = mat(0x9aa3ad, true);
  const metalDark = mat(0x5b636d, true);
  const gold = mat(0xe0b04a, true);
  const clothRed = mat(0xa8423a);
  const skin = mat(0xd9a27e);
  const wood = mat(0x7a5236);
  const woodDark = mat(0x4e3423);

  // Adds a mesh at (x, y, z) and remembers its base height for the idle bob.
  const place = (geo, material, name, x, y, z) => {
    const m = new THREE.Mesh(geo, material);
    m.name = name;
    m.position.set(x, y, z);
    m.userData.baseY = y;
    g.add(m);
    return m;
  };

  // Blob shadow (not bobbed).
  const shadowMat = new THREE.MeshStandardMaterial({
    color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.38, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  shadow.name = "shadow";
  g.add(shadow);

  // Legs (stationary during the bob).
  place(new THREE.BoxGeometry(0.13, 0.3, 0.14), stoneDark, "leg", -0.09, 0.15, 0);
  place(new THREE.BoxGeometry(0.13, 0.3, 0.14), stoneDark, "leg", 0.09, 0.15, 0);

  // Torso, belt, red tabard.
  place(new THREE.BoxGeometry(0.34, 0.3, 0.24), metal, "torso", 0, 0.45, 0);
  place(new THREE.BoxGeometry(0.36, 0.05, 0.26), woodDark, "belt", 0, 0.31, 0);
  place(new THREE.BoxGeometry(0.2, 0.34, 0.03), clothRed, "tabard", 0, 0.44, 0.125);

  // Shoulders and arms.
  place(new THREE.SphereGeometry(0.09, 8, 6), metal, "pauldron", -0.22, 0.6, 0);
  place(new THREE.SphereGeometry(0.09, 8, 6), metal, "pauldron", 0.22, 0.6, 0);
  place(new THREE.BoxGeometry(0.1, 0.28, 0.1), metalDark, "arm", -0.22, 0.5, 0);
  place(new THREE.BoxGeometry(0.1, 0.28, 0.1), metalDark, "arm", 0.22, 0.5, 0);

  // Oversized helmet with visor, nose guard, crest and gold band.
  place(new THREE.SphereGeometry(0.2, 8, 6), metal, "helmet", 0, 0.78, 0);
  place(new THREE.BoxGeometry(0.22, 0.05, 0.05), metalDark, "visor", 0, 0.76, 0.18);
  place(new THREE.BoxGeometry(0.04, 0.12, 0.04), metalDark, "noseGuard", 0, 0.72, 0.19);
  place(new THREE.BoxGeometry(0.06, 0.1, 0.28), metalDark, "crest", 0, 0.94, 0);
  const band = place(new THREE.TorusGeometry(0.2, 0.02, 6, 12), gold, "band", 0, 0.78, 0);
  band.rotation.x = Math.PI / 2;

  // Round shield on the left arm (character's left = +x).
  const shieldFace = place(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 12), wood, "shield", 0.25, 0.45, 0.14);
  shieldFace.rotation.x = Math.PI / 2;
  const shieldRim = place(new THREE.TorusGeometry(0.15, 0.025, 6, 12), metalDark, "shieldRim", 0.25, 0.45, 0.16);
  shieldRim.rotation.x = 0;
  place(new THREE.SphereGeometry(0.05, 8, 6), gold, "shieldBoss", 0.25, 0.45, 0.17);

  // Big sword in the right hand (character's right = -x), tilted forward.
  const pivot = { x: -0.25, y: 0.45, z: 0 };
  const tilt = 0.35;
  const cos = Math.cos(tilt), sin = Math.sin(tilt);
  const bladeLen = 0.55;
  place(new THREE.SphereGeometry(0.05, 8, 6), skin, "hand", pivot.x, pivot.y, pivot.z);
  const blade = place(new THREE.BoxGeometry(0.1, bladeLen, 0.03), metal, "blade",
    pivot.x, pivot.y + (bladeLen / 2) * cos, pivot.z + (bladeLen / 2) * sin);
  blade.rotation.x = tilt;
  const guard = place(new THREE.BoxGeometry(0.26, 0.05, 0.05), gold, "guard", pivot.x, pivot.y, pivot.z);
  guard.rotation.x = tilt;
  const handleLen = 0.16;
  const handle = place(new THREE.CylinderGeometry(0.03, 0.03, handleLen, 8), woodDark, "handle",
    pivot.x, pivot.y - (handleLen / 2) * cos, pivot.z - (handleLen / 2) * sin);
  handle.rotation.x = tilt;

  return g;
}

export function update(group, t) {
  // Gentle breathing bob of the body; legs and shadow stay put.
  const bob = Math.sin(t * 2.4) * 0.012;
  for (const c of group.children) {
    if (c.name === "shadow" || c.name === "leg") continue;
    c.position.y = c.userData.baseY + bob;
  }
}
