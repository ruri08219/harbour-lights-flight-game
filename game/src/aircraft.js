// Harbour Lights — the seaplane.
// One clear job: build the aircraft out of primitives (nothing borrowed) and
// pose it from the flight state each frame.
// SPDX-License-Identifier: MIT
import * as THREE from 'three';

export function buildAircraft() {
  const plane = new THREE.Group();
  const yellow = new THREE.MeshLambertMaterial({ color: 0xe8a13a });
  const cream = new THREE.MeshLambertMaterial({ color: 0xf2e3c0 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const glass = new THREE.MeshPhongMaterial({ color: 0x0e2a3a, shininess: 140, specular: 0x9fd8ff });

  // Fuselage: a stretched capsule, nose forward (-z is forward in our math,
  // so the nose sits at -z).
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 6.5, 6, 12), yellow);
  body.rotation.x = Math.PI / 2;
  plane.add(body);
  // Belly stripe.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 7.5), cream);
  stripe.position.set(0, -1.2, 0);
  plane.add(stripe);
  // Cabin windows.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 3.2), glass);
  cabin.position.set(0, 0.7, 1.2);
  plane.add(cabin);
  // Main wing (high wing, as a floatplane wears it).
  const wing = new THREE.Mesh(new THREE.BoxGeometry(15, 0.35, 2.6), cream);
  wing.position.set(0, 1.1, 0.4);
  plane.add(wing);
  // Wing-tip lights are added below as points; the tips get a red/green cap.
  const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 2.6), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  tipL.position.set(-7.6, 1.1, 0.4);
  plane.add(tipL);
  const tipR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 2.6), new THREE.MeshBasicMaterial({ color: 0x30e060 }));
  tipR.position.set(7.6, 1.1, 0.4);
  plane.add(tipR);
  // Tail: horizontal stabiliser + vertical fin.
  const tail = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.3, 1.6), yellow);
  tail.position.set(0, 0.5, 4.4);
  plane.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, 1.8), yellow);
  fin.position.set(0, 1.4, 4.4);
  plane.add(fin);
  // Floats: two long pontoons under the belly, with struts.
  for (const side of [-1, 1]) {
    const float = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 4.6, 4, 10), dark);
    float.rotation.x = Math.PI / 2;
    float.position.set(side * 2.1, -1.9, 0.2);
    plane.add(float);
    for (const z of [-1.4, 1.4]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.1, 0.25), dark);
      strut.position.set(side * 2.1, -1.2, z);
      plane.add(strut);
    }
  }
  // Propeller: a hub with two blades, spinning on the nose.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.6, 10), dark);
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  for (const angle of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.6, 0.12), dark);
    blade.rotation.z = angle;
    prop.add(blade);
  }
  prop.position.set(0, 0, -4.6);
  plane.add(prop);
  plane.userData.prop = prop;
  // Strobe: a white blink on the tail, and a warm landing light under the nose.
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  strobe.position.set(0, 2.4, 4.4);
  plane.add(strobe);
  plane.userData.strobe = strobe;
  const lamp = new THREE.PointLight(0xffe9a8, 30, 90, 1.6);
  lamp.position.set(0, -1, -6);
  plane.add(lamp);
  // Soft warm fill above the plane so the chase camera always reads her
  // yellow paint, even with the moon behind her.
  const fill = new THREE.PointLight(0xffe0b0, 14, 55, 1.4);
  fill.position.set(0, 7, 2);
  plane.add(fill);
  plane.scale.setScalar(1.6);
  return plane;
}

// Pose the aircraft from flight state. Forward is -z in model space; the
// model's nose points -z, so heading rotates around y and pitch/bank follow.
export function poseAircraft(plane, state, time) {
  plane.position.set(state.x, state.y, state.z);
  plane.rotation.order = 'YXZ';
  plane.rotation.y = state.heading + Math.PI;
  // Nose up is positive pitch for a -z-nose model.
  plane.rotation.x = state.pitch;
  plane.rotation.z = state.bank;
  const spin = 6 + state.throttle * 26;
  plane.userData.prop.rotation.z += spin * 0.016;
  plane.userData.strobe.visible = Math.floor(time * 1.4) % 2 === 0;
}
