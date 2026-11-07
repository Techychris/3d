export const meta = {
  id: "pickup-heart-container",
  name: "Heart container",
  category: "pickup",
  footprint: [0.4, 0.4],
  height: 0.55,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const cloth = new THREE.MeshStandardMaterial({ color: 0xa8423a, flatShading: true, roughness: 0.8, metalness: 0 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b04a, flatShading: true, roughness: 0.8, metalness: 0.3 });
  const heal = new THREE.MeshStandardMaterial({
    color: 0x5fd38a, emissive: 0x5fd38a, emissiveIntensity: 0.9, flatShading: true, roughness: 0.8, metalness: 0
  });
  const black = new THREE.MeshStandardMaterial({
    color: 0x000000, flatShading: true, roughness: 0.8, metalness: 0,
    transparent: true, opacity: 0.35, depthWrite: false
  });

  // Heart outline in the XY plane, scaled by k about its origin.
  const S = 0.34;
  const heartShape = (k) => {
    const s = new THREE.Shape();
    const p = (x, y) => [x * S * k, y * S * k];
    s.moveTo(...p(0, -0.5));
    s.bezierCurveTo(...p(-0.1, -0.35), ...p(-0.5, -0.1), ...p(-0.5, 0.2));
    s.bezierCurveTo(...p(-0.5, 0.45), ...p(-0.25, 0.55), ...p(0, 0.3));
    s.bezierCurveTo(...p(0.25, 0.55), ...p(0.5, 0.45), ...p(0.5, 0.2));
    s.bezierCurveTo(...p(0.5, -0.1), ...p(0.1, -0.35), ...p(0, -0.5));
    return s;
  };

  // Blob shadow stays on the floor and does not bob or spin.
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16), black);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow";
  g.add(shadow);

  // body bobs and spins; pivot pulses. Heart centre sits at y 0.32.
  const body = new THREE.Group(); body.name = "body"; g.add(body);
  const pivot = new THREE.Group(); pivot.name = "pivot"; pivot.position.y = 0.32; body.add(pivot);

  // Glow ring behind the heart.
  const ringGeo = new THREE.RingGeometry(0.185, 0.22, 24);
  const ring = new THREE.Mesh(ringGeo, heal);
  ring.position.set(0, 0.01, -0.12); ring.scale.y = 0.9; ring.name = "glow";
  pivot.add(ring);

  // Thin gold outline, slightly larger heart behind the red one.
  const outlineGeo = new THREE.ExtrudeGeometry(heartShape(1.14), {
    depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 8
  });
  outlineGeo.translate(0, 0, -0.02);
  const outline = new THREE.Mesh(outlineGeo, gold);
  outline.position.z = -0.04; outline.name = "outline";
  pivot.add(outline);

  // Chunky red heart, extruded upright so it faces +z.
  const heartGeo = new THREE.ExtrudeGeometry(heartShape(1), {
    depth: 0.1, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 8
  });
  heartGeo.translate(0, 0, -0.05);
  const heart = new THREE.Mesh(heartGeo, cloth);
  heart.name = "heart";
  pivot.add(heart);

  g.userData.body = body;
  g.userData.pivot = pivot;
  return g;
}

export function update(group, t) {
  const body = group.userData.body;
  const pivot = group.userData.pivot;
  // Bob between 0 and 0.03 so the lowest point stays near 0.12.
  body.position.y = 0.03 * (0.5 + 0.5 * Math.sin(t * 2.4));
  body.rotation.y = t * 0.6;
  // Heartbeat: a sharp beat at the start of each cycle, then a fall back.
  const ph = (t * 1.2) % 1;
  pivot.scale.setScalar(1 + 0.08 * Math.exp(-ph * 14));
}
