export const meta = {
  id: "prop-campfire",
  name: "Campfire",
  category: "prop",
  footprint: [1, 1],
  height: 0.7,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...extra });
  const stoneDark = mat(0x3b3a40);
  const stone = mat(0x5a5862);
  const stoneLight = mat(0x8a8794);
  const wood = mat(0x7a5236);
  const woodDark = mat(0x4e3423);
  const ember = mat(0xff7a2e, { emissive: 0xff7a2e, emissiveIntensity: 1.2 });
  const gold = mat(0xe0b04a, { emissive: 0xe0b04a, emissiveIntensity: 1.0 });

  // Blob shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 16),
    mat(0x000000, { transparent: true, opacity: 0.35, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow"; g.add(shadow);

  // Ring of 8 stone rocks
  const rockGeo = new THREE.DodecahedronGeometry(0.1, 0);
  const rockMats = [stone, stoneLight, stone, stoneDark, stoneLight, stone, stoneLight, stoneDark];
  const rockScale = [1.0, 0.8, 1.2, 0.9, 1.1, 0.75, 1.0, 0.85];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const s = rockScale[i];
    const rock = new THREE.Mesh(rockGeo, rockMats[i]);
    rock.scale.set(s, 0.7, s);
    rock.position.set(Math.cos(a) * 0.36, 0.07, Math.sin(a) * 0.36);
    rock.rotation.y = i * 0.7;
    rock.name = "rock"; g.add(rock);
  }

  // Crossed logs
  const logGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.5, 8);
  const logA = new THREE.Mesh(logGeo, wood);
  logA.rotation.z = Math.PI / 2; logA.position.y = 0.05; logA.name = "log"; g.add(logA);
  const logB = new THREE.Mesh(logGeo, woodDark);
  logB.rotation.x = Math.PI / 2; logB.position.y = 0.13; logB.name = "log"; g.add(logB);

  // Glowing ember coals
  const coalGeo = new THREE.IcosahedronGeometry(0.05, 0);
  const coalA = new THREE.Mesh(coalGeo, ember);
  coalA.position.set(0.1, 0.03, 0.08); coalA.scale.set(1, 0.6, 1); coalA.name = "coal"; g.add(coalA);
  const coalB = new THREE.Mesh(coalGeo, ember);
  coalB.position.set(-0.12, 0.03, -0.05); coalB.scale.set(1.1, 0.6, 0.9); coalB.name = "coal"; g.add(coalB);

  // Flame: three stacked cones, animated from update()
  const flame = new THREE.Group(); flame.name = "flame"; flame.position.y = 0.12; g.add(flame);
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 7), ember);
  c1.position.y = 0.14; c1.name = "flameCone"; flame.add(c1);
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 7), ember);
  c2.position.y = 0.28; c2.name = "flameCone"; flame.add(c2);
  const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), gold);
  c3.position.y = 0.40; c3.name = "flameCone"; flame.add(c3);
  g.userData.flame = flame;

  return g;
}

export function update(group, t) {
  const f = group.userData.flame;
  if (!f) return;
  const flick = Math.sin(t * 7.3) * 0.5 + Math.sin(t * 13.1 + 1.7) * 0.5; // -1..1
  f.scale.y = 1 + 0.06 * flick;
  f.scale.x = 1 - 0.03 * flick;
  f.scale.z = 1 - 0.03 * flick;
}
