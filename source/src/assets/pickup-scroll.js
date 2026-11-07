export const meta = {
  id: "pickup-scroll",
  name: "Spell scroll",
  category: "pickup",
  footprint: [0.4, 0.4],
  height: 0.4,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...extra });
  const bone = mat(0xe8dcc0);
  const woodDark = mat(0x4e3423);
  const cloth = mat(0xa8423a);
  const gold = mat(0xe0b04a, { metalness: 0.3 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x8c5be0, emissive: 0x8c5be0, emissiveIntensity: 0.9,
    flatShading: true, roughness: 0.8, metalness: 0,
    transparent: true, opacity: 0.3, depthWrite: false
  });

  // Everything that bobs and spins lives in this sub-group; the shadow stays on the group.
  const scroll = new THREE.Group(); scroll.name = "scroll";
  scroll.position.y = 0.25;
  g.add(scroll);

  // Parchment body lying along x.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 10), bone);
  body.rotation.z = Math.PI / 2; body.name = "body"; scroll.add(body);

  // Wood-dark rollers at both ends.
  for (const s of [-1, 1]) {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 10), woodDark);
    roller.rotation.z = Math.PI / 2; roller.position.x = s * 0.14; roller.name = "roller"; scroll.add(roller);
  }

  // Cloth-red ribbon around the body, with a hanging tail.
  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.13, 0.13), cloth);
  ribbon.position.x = -0.04; ribbon.name = "ribbon"; scroll.add(ribbon);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.012), cloth);
  tail.position.set(-0.04, -0.05, 0.07); tail.name = "ribbonTail"; scroll.add(tail);

  // Gold seal on the ribbon, facing front (+z).
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.015, 10), gold);
  seal.rotation.x = Math.PI / 2; seal.position.set(-0.04, 0, 0.07); seal.name = "seal"; scroll.add(seal);

  // Magic glow around the scroll: lowest point ~0.10, top ~0.40.
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), glowMat);
  glow.name = "glow"; scroll.add(glow);

  // Blob shadow: stays put.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.18, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow"; g.add(shadow);

  g.userData.scroll = scroll;
  g.userData.glowMat = glowMat;
  return g;
}

export function update(group, t) {
  const scroll = group.userData.scroll;
  const glowMat = group.userData.glowMat;
  scroll.position.y = 0.25 + Math.sin(t * 2.2) * 0.02;
  scroll.rotation.y = t * 0.8;
  glowMat.opacity = 0.3 + Math.sin(t * 2.5) * 0.12;
  glowMat.emissiveIntensity = 0.9 + Math.sin(t * 2.5) * 0.3;
}
