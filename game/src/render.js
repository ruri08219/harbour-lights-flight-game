// Harbour Lights — camera and renderer.
// One clear job: own the WebGL renderer and the two cameras (chase and
// cockpit), and keep them pointed where the pilot is looking.
// SPDX-License-Identifier: MIT
import * as THREE from 'three';

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 6000);
  let mode = 'chase'; // 'chase' | 'cockpit'
  let needSnap = false;
  const chaseOffset = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return {
    get mode() {
      return mode;
    },
    toggleCamera() {
      mode = mode === 'chase' ? 'cockpit' : 'chase';
      return mode;
    },
    setCamera(m) {
      mode = m;
    },
    // Place the camera exactly where the chase view belongs, at once —
    // used when a screenshot stages the game, so the first frame is framed.
    snap() {
      needSnap = true;
    },
    render(scene, plane, state) {
      if (mode === 'cockpit') {
        // In the cabin, just behind the windshield: the sky, the ring and
        // the beam ahead, the lit instruments in the HUD below. The plane's
        // own airframe stays out of the way — it would fill the frame from
        // any seat close enough to see the nose.
        tmp.set(0, 1.4, 1.6).applyEuler(plane.rotation);
        camera.position.copy(plane.position).add(tmp);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = state.heading + Math.PI;
        camera.rotation.x = state.pitch + 0.04;
        camera.rotation.z = -state.bank * 0.6;
        plane.visible = false;
      } else {
        // Chase: behind and above, easing toward the plane so the camera
        // never fights the pilot — it follows, it does not lead. Far
        // enough back that the whole seaplane and the scene ahead both read.
        const back = 34;
        const up = 10;
        chaseOffset.set(
          -Math.sin(state.heading) * back,
          up,
          -Math.cos(state.heading) * back,
        );
        camera.position.lerp(tmp.copy(plane.position).add(chaseOffset), needSnap ? 1 : 0.06);
        needSnap = false;
        lookAt.copy(plane.position);
        lookAt.y += 2;
        lookAt.x += Math.sin(state.heading) * 18;
        lookAt.z += Math.cos(state.heading) * 18;
        camera.lookAt(lookAt);
        plane.visible = true;
      }
      renderer.render(scene, camera);
    },
  };
}
