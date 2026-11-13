import { accents } from "../engine/rig.js";

export const meta = {
  id: "enemy-imp",
  name: "Fire imp",
  category: "enemy",
  footprint: [0.6, 0.6],
  height: 1.1,
  flying: true
};

const HOVER = 0.8;   // rest height of the rig (body centre sits about here)

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, extra) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...extra });

  const red = mat(0xa8423a);
  const stoneDark = mat(0x3b3a40);
  const woodDark = mat(0x4e3423);
  const eyeMat = mat(0xff4d3d, { emissive: 0xff4d3d, emissiveIntensity: 1.0 });
  const fireMat = mat(0xff7a2e, { emissive: 0xff7a2e, emissiveIntensity: 1.0 });
  const shadowMat = new THREE.MeshStandardMaterial({
    color: 0x000000, flatShading: true, roughness: 0.8, metalness: 0,
    transparent: true, opacity: 0.35, depthWrite: false
  });

  // Everything that hovers and bobs lives in the rig.
  const rig = new THREE.Group(); rig.name = "rig"; rig.position.y = HOVER; g.add(rig);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), red);
  body.position.set(0, -0.02, 0); body.scale.y = 1.1; body.name = "body"; rig.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), red);
  head.position.set(0, 0.13, 0.02); head.name = "head"; rig.add(head);

  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.1, 6), stoneDark);
    horn.position.set(s * 0.07, 0.22, 0);
    horn.rotation.z = -s * 0.35;       // splay outward
    horn.name = "horn"; rig.add(horn);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), eyeMat);
    eye.position.set(s * 0.045, 0.14, 0.11); eye.name = "eye"; rig.add(eye);
  }

  // Pointed tail: thick at the body, thin at the back, dark tip.
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.16, 6), red);
  tail.rotation.x = Math.PI / 2; tail.position.set(0, -0.05, -0.2); tail.name = "tail"; rig.add(tail);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 6), woodDark);
  tip.rotation.x = -Math.PI / 2; tip.position.set(0, -0.05, -0.295); tip.name = "tailTip"; rig.add(tip);

  // Bat wings: each hinges at the shoulder and flaps around z.
  const wingGeo = new THREE.BoxGeometry(0.22, 0.04, 0.2);
  const wings = {};
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.08, 0.04, -0.04);
    pivot.name = s < 0 ? "wingL" : "wingR";
    rig.add(pivot);
    const wing = new THREE.Mesh(wingGeo, woodDark);
    wing.position.set(s * 0.11, 0, 0); wing.name = "wing"; pivot.add(wing);
    wings[s < 0 ? "wingL" : "wingR"] = pivot;
  }

  // Arm and the small ember fireball held out to the right.
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.14), red);
  arm.position.set(0.15, -0.05, 0.1); arm.rotation.y = -0.5; arm.name = "arm"; rig.add(arm);

  const fire = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), fireMat);
  fire.position.set(0.2, -0.06, 0.16); fire.name = "fireball"; rig.add(fire);

  // Ground parts: stay on the floor, not in the rig.
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow"; g.add(shadow);

  const dropLine = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 5), shadowMat);
  dropLine.name = "dropLine"; g.add(dropLine);

  g.userData.parts = {
    rig, wingL: wings.wingL, wingR: wings.wingR,
    fire, fireMat, dropLine
  };

  update(g, 0);
  return g;
}

// pose: the fireball swells and the wings beat wide while it winds up a throw
export function update(group, t, pose) {
  const p = group.userData.parts;
  if (!p) return;

  // Body bobs.
  const bob = Math.sin(t * 3.2) * 0.03;
  p.rig.position.y = HOVER + bob;

  // Wings flap in opposite-mirrored arcs.
  const { wind, hit } = accents(pose);
  const flap = Math.sin(t * 14) * (0.6 + 0.3 * wind);
  p.wingL.rotation.z = -flap;
  p.wingR.rotation.z = flap;

  // Fireball pulses in size and glow.
  const pulse = Math.sin(t * 7);
  p.fire.scale.setScalar(1 + 0.12 * pulse + 0.9 * wind - 0.5 * hit);
  p.fireMat.emissiveIntensity = 1.0 + 0.4 * pulse + 1.5 * wind;

  // Drop line runs from the floor shadow up to the underside of the body.
  const top = p.rig.position.y - 0.2;
  p.dropLine.scale.y = top - 0.01;
  p.dropLine.position.y = (top + 0.01) / 2;
}
