export const meta = {
  id: "prop-cauldron",
  name: "Witch's cauldron",
  category: "prop",
  footprint: [0.7, 0.7],
  height: 0.8,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...extra });
  const iron = mat(0x5b636d, { metalness: 0.3 });
  const wood = mat(0x7a5236);
  const woodDark = mat(0x4e3423);
  const ember = mat(0xff7a2e, { emissive: 0xff7a2e, emissiveIntensity: 1.2 });
  const heal = mat(0x5fd38a, { emissive: 0x5fd38a, emissiveIntensity: 0.9 });

  // Pot: lathe profile from the base up to the rim, then back down inside the lip.
  const profile = [
    new THREE.Vector2(0.0, 0.2),
    new THREE.Vector2(0.2, 0.2),
    new THREE.Vector2(0.3, 0.32),
    new THREE.Vector2(0.3, 0.42),
    new THREE.Vector2(0.26, 0.5),
    new THREE.Vector2(0.29, 0.53),
    new THREE.Vector2(0.24, 0.53),
    new THREE.Vector2(0.22, 0.47),
    new THREE.Vector2(0.0, 0.47)
  ];
  const pot = new THREE.Mesh(new THREE.LatheGeometry(profile, 12), iron);
  pot.name = "body"; g.add(pot);

  // Three short legs standing on the ground around the fire.
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + i * Math.PI * 2 / 3;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 5), iron);
    leg.position.set(Math.cos(a) * 0.2, 0.11, Math.sin(a) * 0.2);
    leg.name = "leg"; g.add(leg);
  }

  // Two crossed logs under the pot.
  const logA = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.07), wood);
  logA.position.set(0, 0.025, 0); logA.rotation.y = 0.4; logA.name = "log"; g.add(logA);
  const logB = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.07), woodDark);
  logB.position.set(0, 0.025, 0); logB.rotation.y = -0.4; logB.name = "log"; g.add(logB);

  // Ember glow flame between the logs and the pot.
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.16, 6), ember);
  fire.position.y = 0.12; fire.name = "fire"; g.add(fire);

  // Heal-green brew sitting inside the rim.
  const brew = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 12), heal);
  brew.position.y = 0.49; brew.name = "brew"; g.add(brew);

  // Four bubbles on the brew, each with its own phase.
  const bubbleGeo = new THREE.SphereGeometry(0.045, 6, 4);
  const spots = [
    [0.09, 0.05, 0.0],
    [-0.1, -0.03, 1.3],
    [0.02, -0.12, 2.6],
    [-0.05, 0.1, 3.9]
  ];
  const bubbles = [];
  for (const [x, z, phase] of spots) {
    const bubble = new THREE.Mesh(bubbleGeo, heal);
    bubble.position.set(x, 0.49, z);
    bubble.name = "bubble"; g.add(bubble);
    bubbles.push({ mesh: bubble, phase });
  }

  g.userData.fire = fire;
  g.userData.bubbles = bubbles;
  return g;
}

export function update(group, t) {
  const fire = group.userData.fire;
  if (fire) {
    const h = 1 + 0.08 * Math.sin(t * 9.0) + 0.05 * Math.sin(t * 13.7 + 1.1);
    const w = 1 + 0.04 * Math.sin(t * 11.0 + 0.5);
    fire.scale.set(w, h, w);
  }
  const bubbles = group.userData.bubbles;
  if (!bubbles) return;
  for (const b of bubbles) {
    // w runs 0..1 per cycle: the bubble rises and grows, then pops at the top.
    const w = 0.5 + 0.5 * Math.sin(t * 1.6 + b.phase);
    const s = w < 0.9 ? 0.4 + 0.6 * (w / 0.9) : Math.max(0, 1 - (w - 0.9) * 10);
    b.mesh.position.y = 0.49 + 0.05 * w;
    b.mesh.scale.setScalar(s);
  }
}
