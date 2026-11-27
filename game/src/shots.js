// Harbour Lights — the screenshot scenes behind ?shot=cover|cockpit|landing|mission.
// Each one stages the real game (never a fake frame): it sets the flight
// state to a chosen moment, then plays the real rules forward for a fixed
// number of steps steered by a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
// SPDX-License-Identifier: MIT
import { MISSIONS } from './config.js';

const STEP = 1 / 60;

// Steer toward a target point: bank toward it, hold speed, pitch to its height.
function autopilot(state, target, pitchGain = 0.02, cruise = 57, flaps = false) {
  const dx = target.x - state.x;
  const dz = target.z - state.z;
  const wantHeading = Math.atan2(dx, dz);
  let diff = wantHeading - state.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const roll = Math.max(-1, Math.min(1, -diff * 2.2));
  const altErr = target.y - state.y;
  const pitch = Math.max(-1, Math.min(1, altErr * pitchGain));
  const throttle = state.speed < cruise - 5 ? 1 : state.speed > cruise + 5 ? -1 : 0;
  return { pitch, roll, throttle, flaps };
}

function playForward(game, seconds, targetFn, pitchGain = 0.02, cruise = 57, flaps = false) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const target = targetFn(game.state);
    const input = autopilot(game.state, target, pitchGain, cruise, flaps);
    game.stepGame(STEP, input);
    if (game.state.crashed || game.state.landed) break;
  }
}

// Set `game` to the named scene and return the camera mode to shoot it with.
export function stageShot(name, game) {
  const state = game.state;
  if (name === 'cockpit') {
    // Mid ring run, lined up on the second ring with the moon ahead —
    // the ring stays centred in the windshield, instruments lit.
    game.missions.stage(0, { rings: 1 });
    Object.assign(state, { x: -100, y: 160, z: -300, heading: -2.26, pitch: 0.02, bank: 0, speed: 56, throttle: 0.62, fuel: 88, airborne: true });
    playForward(game, 1.2, () => MISSIONS[0].rings[1]);
    return { camera: 'cockpit', screen: 'play' };
  }
  if (name === 'landing') {
    // Final approach to the harbour circle: straight in from the south,
    // flaps down, low and slow, beam sweeping — no hard turn, no dive.
    game.missions.stage(2, {});
    Object.assign(state, { x: 120, y: 20, z: 480, heading: Math.PI, pitch: -0.03, bank: 0, speed: 40, throttle: 0.25, fuel: 41, airborne: true });
    state.flaps = true;
    playForward(game, 3.0, () => ({ x: 120, y: 8, z: 140 }), 0.004, 40, true);
    return { camera: 'chase', screen: 'play' };
  }
  if (name === 'mission') {
    // Mail drop over North Isle: straight in from the south along the beam
    // line, low over open water — the island stays off the right wing.
    // Start far enough out that the beam is still ahead when the frame lands.
    game.missions.stage(1, { drops: ['East Rock', 'South Cay'] });
    Object.assign(state, { x: -800, y: 60, z: -240, heading: Math.PI, pitch: -0.02, bank: 0, speed: 48, throttle: 0.55, fuel: 66, airborne: true });
    playForward(game, 2.0, () => ({ x: -800, y: 55, z: -640 }), 0.02, 48);
    return { camera: 'chase', screen: 'play' };
  }
  // cover: the densest moment — banking through the last ring on the leg
  // home, with Beacon Isle, its lighthouse and the harbour ahead.
  game.missions.stage(0, { rings: 4 });
  Object.assign(state, { x: 280, y: 160, z: -40, heading: 0.53, pitch: 0.03, bank: 0.2, speed: 58, throttle: 0.66, fuel: 91, airborne: true });
  playForward(game, 2.0, () => MISSIONS[0].rings[4]);
  return { camera: 'chase', screen: 'play' };
}
