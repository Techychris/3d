import { accents } from "../engine/rig.js";

export const meta = {
  id: "enemy-mushroom",
  name: "Spore mushroom",
  category: "enemy",
  footprint: [0.6, 0.6],
  height: 0.8,
  flying: false
};

const CAP_RADIUS = 0.28;
const CAP_SQUASH = 0.7;
const CAP_Y = 0.5;

// Spots as [polar angle, azimuth] on the cap dome (radians).
const SPOTS = [[0.5, 0], [0.5, 2.1], [0.5, 4.2], [0.95, 1.05], [0.95, 3.15]];

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, extra) => new THREE.MeshStandardMaterial(
    Object.assign({ color, flatShading: true, roughness: 0.8, metalness: 0 }, extra || {})
  );
  const bone = mat(0xe8dcc0);
  const cloth = mat(0xa8423a);
  const eyeMat = mat(0xff4d3d, { emissive: 0xff4d3d, emissiveIntensity: 0.8 });
  const shadowMat = mat(0x000000, { transparent: true, opacity: 0.35, depthWrite: false });

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow"; g.add(shadow);

  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.4, 8), bone);
  stalk.position.y = 0.34; stalk.name = "stalk"; g.add(stalk);

  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 6), bone);
    leg.position.set(s * 0.09, 0.07, 0); leg.name = "leg"; g.add(leg);
  }

  // Cap: a squashed dome, so the spore puff animation scales it in place.
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(CAP_RADIUS, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    cloth
  );
  cap.position.y = CAP_Y; cap.scale.set(1, CAP_SQUASH, 1); cap.name = "cap"; g.add(cap);
  g.userData.cap = cap;

  // Gills: a flat bone disc under the cap, facing down.
  const gills = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), bone);
  gills.rotation.x = Math.PI / 2; gills.position.y = CAP_Y - 0.005; gills.name = "gills"; g.add(gills);

  // Spots are children of the cap so they move with the puff.
  const spotGeo = new THREE.SphereGeometry(0.05, 6, 4);
  const r = CAP_RADIUS * 1.02;
  for (const [th, ph] of SPOTS) {
    const spot = new THREE.Mesh(spotGeo, bone);
    spot.position.set(r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph));
    spot.name = "spot"; cap.add(spot);
  }

  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), eyeMat);
    eye.position.set(s * 0.05, 0.42, 0.1); eye.name = "eye"; g.add(eye);
  }

  return g;
}

// pose: the cap swells through the windup and snaps flat as the spores burst
export function update(group, t, pose) {
  const cap = group.userData.cap || group.getObjectByName("cap");
  if (!cap) return;
  const { wind, hit } = accents(pose);
  const s = 1 + 0.06 * Math.max(0, Math.sin(t * 2.5)) + 0.3 * wind;
  cap.scale.set(s + 0.25 * hit, CAP_SQUASH * s * (1 - 0.45 * hit), s + 0.25 * hit);
}
