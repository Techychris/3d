export const meta = {
  id: "enemy-brute",
  name: "Armoured brute",
  category: "enemy",
  footprint: [1.0, 1.0],
  height: 1.4,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness });
  const stone = mat(0x5a5862);
  const stoneDark = mat(0x3b3a40);
  const metalDark = mat(0x5b636d, 0.3);
  const metal = mat(0x9aa3ad, 0.3);
  const skin = mat(0xd9a27e);
  const wood = mat(0x7a5236);
  const woodDark = mat(0x4e3423);
  const danger = new THREE.MeshStandardMaterial({
    color: 0xff4d3d, emissive: 0xff4d3d, emissiveIntensity: 1.0, flatShading: true, roughness: 0.8, metalness: 0
  });

  // blob shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 12),
    new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow"; g.add(shadow);

  // legs and feet
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.32), stoneDark);
    leg.position.set(s * 0.2, 0.21, 0); leg.name = "leg"; g.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.4), metalDark);
    foot.position.set(s * 0.2, 0.06, 0.04); foot.name = "foot"; g.add(foot);
  }

  // hunched torso, leaning forward
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.62, 0.58), stone);
  torso.position.set(0, 0.73, 0); torso.rotation.x = 0.12; torso.name = "torso"; g.add(torso);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.09, 0.6), woodDark);
  belt.position.set(0, 0.5, 0); belt.name = "belt"; g.add(belt);

  // back hump
  const hump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), stone);
  hump.position.set(0, 1.0, -0.12); hump.name = "hump"; g.add(hump);

  // shoulder plates
  for (const s of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.38), metalDark);
    plate.position.set(s * 0.38, 1.0, 0.0); plate.name = "shoulder"; g.add(plate);
  }

  // head: helmet with danger-red eye slit
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.36, 0.42), metalDark);
  helmet.position.set(0, 1.2, 0.02); helmet.name = "helmet"; g.add(helmet);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.02), danger);
  eye.position.set(0, 1.23, 0.235); eye.name = "eye"; g.add(eye);

  // free arm hangs at the left side
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.6, 8), skin);
  armL.position.set(-0.4, 0.66, 0.02); armL.name = "armL"; g.add(armL);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skin);
  handL.position.set(-0.4, 0.34, 0.06); handL.name = "handL"; g.add(handL);

  // hammer held two-handed on the right, resting close to the body
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.7, 8), skin);
  armR.position.set(0.42, 0.6, 0.12); armR.name = "armR"; g.add(armR);

  const hammer = new THREE.Group(); hammer.name = "hammer";
  hammer.position.set(0.38, 0.0, 0.22);
  hammer.rotation.z = -0.06;
  g.add(hammer);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6), wood);
  handle.position.set(0, 0.45, 0); handle.name = "handle"; hammer.add(handle);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.3), metal);
  head.position.set(0, 0.92, 0); head.name = "hammerHead"; hammer.add(head);
  for (const y of [0.25, 0.5]) {
    const grip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skin);
    grip.position.set(0, y, 0.03); grip.name = "grip"; hammer.add(grip);
  }

  g.userData.torso = torso;
  return g;
}

export function update(group, t) {
  const torso = group.userData.torso;
  if (!torso) return;
  const s = 1 + 0.025 * Math.sin(t * 2.0);
  torso.scale.set(1, s, 1);
}
