// Harbour Lights — the night archipelago.
// One clear job: build the three.js world (sea, islands, lighthouse, rings,
// harbour) and answer how high the ground is at any x,z for collisions.
// SPDX-License-Identifier: MIT
import * as THREE from 'three';
import { WORLD, ISLANDS, HARBOUR, MISSIONS, COLORS, mulberry32 } from './config.js';

// Height of solid ground at (x, z). Islands are smooth cones; the sea is 0.
export function terrainHeightAt(x, z) {
  let h = 0;
  for (const isle of ISLANDS) {
    const dx = x - isle.x;
    const dz = z - isle.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < isle.r) h = Math.max(h, isle.h * (1 - d / isle.r));
  }
  return h;
}

// Sky dome: a vertical gradient so the horizon reads — dark blue overhead,
// a paler teal band at the horizon, darker again below it. Painted once on
// a tiny canvas, no texture file to ship.
function makeSkyDome(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#050a18');
  grad.addColorStop(0.45, '#0a1226');
  grad.addColorStop(0.52, '#1b3a5e');
  grad.addColorStop(0.58, '#0d1730');
  grad.addColorStop(1, '#070d1c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(4200, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }),
  );
  scene.add(dome);
}

function makeStars(scene, random) {
  const count = 900;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const a = random() * Math.PI * 2;
    const e = 0.12 + random() * 1.35;
    const r = 2400;
    positions[i * 3] = Math.cos(a) * Math.cos(e) * r;
    positions[i * 3 + 1] = Math.sin(e) * r;
    positions[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xcdd8ff, size: 2.2, sizeAttenuation: false, fog: false });
  scene.add(new THREE.Points(geo, mat));
}

function makeMoon(scene) {
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(46, 40),
    new THREE.MeshBasicMaterial({ color: COLORS.moon, fog: false }),
  );
  moon.position.set(-900, 780, -1900);
  moon.lookAt(0, 0, 0);
  scene.add(moon);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(90, 40),
    new THREE.MeshBasicMaterial({ color: 0x8a7f56, transparent: true, opacity: 0.25, fog: false }),
  );
  glow.position.copy(moon.position).multiplyScalar(0.995);
  glow.lookAt(0, 0, 0);
  scene.add(glow);
  const light = new THREE.DirectionalLight(0xcfd8ff, 1.1);
  light.position.set(-900, 780, -1900);
  scene.add(light);
  // Fill from the south-east so the sea and the plane's far side never go black.
  const fill = new THREE.DirectionalLight(0x8fb0ff, 0.35);
  fill.position.set(900, 500, 1200);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0x35486b, 1.25));
  scene.add(new THREE.HemisphereLight(0x33456e, 0x0a1420, 0.55));
}

function makeSea(scene) {
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.seaSize, WORLD.seaSize, 1, 1),
    new THREE.MeshPhongMaterial({ color: 0x11395e, shininess: 140, specular: 0xa8c4e0 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0;
  scene.add(sea);
  // Moon glitter: a long pale streak on the water under the moon.
  const glitter = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 1500),
    new THREE.MeshBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0.16 }),
  );
  glitter.rotation.x = -Math.PI / 2;
  glitter.rotation.z = 0.42;
  glitter.position.set(-450, 0.4, -900);
  scene.add(glitter);
}

function makeIslands(scene, random) {
  const rock = new THREE.MeshLambertMaterial({ color: 0x1d2b22 });
  const rockTop = new THREE.MeshLambertMaterial({ color: 0x2c4636 });
  const windowMat = new THREE.MeshBasicMaterial({ color: COLORS.window });
  for (const isle of ISLANDS) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(isle.r, isle.h, 9), rock);
    cone.position.set(isle.x, isle.h / 2 - 2, isle.z);
    cone.rotation.y = random() * Math.PI;
    scene.add(cone);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(isle.r * 0.45, isle.h * 0.5, 9), rockTop);
    cap.position.set(isle.x, isle.h * 0.75 - 2, isle.z);
    cap.rotation.y = random() * Math.PI;
    scene.add(cap);
    // Lit windows: tiny warm dots scattered up the slope.
    const count = isle.windows;
    const geo = new THREE.BoxGeometry(3, 3, 3);
    const inst = new THREE.InstancedMesh(geo, windowMat, count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i += 1) {
      const a = random() * Math.PI * 2;
      const d = isle.r * (0.25 + random() * 0.6);
      const y = Math.max(4, isle.h * (1 - d / isle.r) + 2);
      m.setPosition(isle.x + Math.cos(a) * d, y, isle.z + Math.sin(a) * d);
      inst.setMatrixAt(i, m);
    }
    scene.add(inst);
    if (isle.lighthouse) makeLighthouse(scene, isle);
  }
}

function makeLighthouse(scene, isle) {
  const g = new THREE.Group();
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 10, 46, 10),
    new THREE.MeshLambertMaterial({ color: 0xd8d2c0 }),
  );
  tower.position.y = 23;
  g.add(tower);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(6, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
  );
  lamp.position.y = 50;
  g.add(lamp);
  // Rotating beam: a long translucent cone.
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(16, 420, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.set(210, 50, 0);
  const beamPivot = new THREE.Group();
  beamPivot.add(beam);
  beamPivot.position.y = 0;
  g.add(beamPivot);
  g.position.set(isle.x, isle.h - 2, isle.z);
  g.userData.beamPivot = beamPivot;
  scene.add(g);
  scene.userData.lighthouse = g;
}

function makeHarbour(scene) {
  // Pontoon: a lit floating dock the player taxis from and lands beside.
  const pontoon = new THREE.Mesh(
    new THREE.BoxGeometry(46, 3, 14),
    new THREE.MeshLambertMaterial({ color: 0x4a3826 }),
  );
  pontoon.position.set(HARBOUR.x - 40, 1.5, HARBOUR.z + 40);
  scene.add(pontoon);
  const lampMat = new THREE.MeshBasicMaterial({ color: COLORS.window });
  for (let i = 0; i < 5; i += 1) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 8), lampMat);
    lamp.position.set(HARBOUR.x - 58 + i * 9, 4.5, HARBOUR.z + 40);
    scene.add(lamp);
  }
  // Landing circle: a glowing ring lying on the water.
  const circle = new THREE.Mesh(
    new THREE.RingGeometry(HARBOUR.circleR - 2, HARBOUR.circleR, 48),
    new THREE.MeshBasicMaterial({ color: 0x37e0a0, transparent: true, opacity: 0.65, side: THREE.DoubleSide }),
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.set(HARBOUR.x, 0.6, HARBOUR.z);
  scene.add(circle);
  // Moored buoys around the circle.
  const buoyMat = new THREE.MeshBasicMaterial({ color: 0xff5d5d });
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const buoy = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 8), buoyMat);
    buoy.position.set(HARBOUR.x + Math.cos(a) * (HARBOUR.circleR + 12), 1.2, HARBOUR.z + Math.sin(a) * (HARBOUR.circleR + 12));
    scene.add(buoy);
  }
}

function makeRings(scene) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: COLORS.ring });
  const matDone = new THREE.MeshBasicMaterial({ color: COLORS.ringDone });
  const geo = new THREE.TorusGeometry(26, 2.2, 10, 36);
  const rings = [];
  for (const def of MISSIONS[0].rings) {
    const ring = new THREE.Mesh(geo, mat);
    ring.position.set(def.x, def.y, def.z);
    ring.userData.home = { ...def };
    ring.userData.mat = mat;
    ring.userData.matDone = matDone;
    group.add(ring);
    rings.push(ring);
  }
  scene.add(group);
  scene.userData.rings = rings;
}

function makeDropBeams(scene) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x7fe7ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  const beams = [];
  for (const drop of MISSIONS[1].drops) {
    // Slim light column marking the drop zone — the gameplay radius lives
    // in config, the visual stays a narrow beacon, never a wall.
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(6, 10, 200, 12, 1, true), mat);
    beam.position.set(drop.x, 100, drop.z);
    group.add(beam);
    beams.push(beam);
  }
  scene.add(group);
  scene.userData.dropBeams = beams;
}

function makeClouds(scene, random) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0.07 });
  const clouds = [];
  for (let i = 0; i < 14; i += 1) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(60 + random() * 90, 10, 8), mat);
    cloud.scale.y = 0.32;
    cloud.position.set((random() - 0.5) * 3600, 260 + random() * 160, (random() - 0.5) * 3600);
    scene.add(cloud);
    clouds.push(cloud);
  }
  scene.userData.clouds = clouds;
}

export function buildWorld(seed) {
  const random = mulberry32(seed);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.fog, WORLD.fogNear, WORLD.fogFar);
  scene.userData = {};
  makeSkyDome(scene);
  makeStars(scene, random);
  makeMoon(scene);
  makeSea(scene);
  makeIslands(scene, random);
  makeHarbour(scene);
  makeRings(scene);
  makeDropBeams(scene);
  makeClouds(scene, random);
  return scene;
}

// Gentle life: the lighthouse beam sweeps, rings bob, clouds drift.
export function animateWorld(scene, time) {
  const light = scene.userData.lighthouse;
  if (light) light.userData.beamPivot.rotation.y = time * 0.45;
  for (const ring of scene.userData.rings || []) {
    ring.position.y = ring.userData.home.y + Math.sin(time * 0.8 + ring.userData.home.x) * 3;
    ring.rotation.y = time * 0.2;
  }
  for (const cloud of scene.userData.clouds || []) {
    cloud.position.x += 0.6;
    if (cloud.position.x > 1900) cloud.position.x = -1900;
  }
}
