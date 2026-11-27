// Harbour Lights — flight model.
// One clear job: how the seaplane moves. Pure numbers in, new state out —
// no rendering, no DOM, so the model can be stepped by the game, the
// autopilot in shots.js, and tests alike.
// SPDX-License-Identifier: MIT
import { FLIGHT } from './config.js';

export function freshState() {
  return {
    x: 60, y: 0.5, z: 320, // on the water at the harbour, nose north
    heading: Math.PI, // facing -z (north)
    pitch: 0,
    bank: 0,
    speed: 0,
    throttle: 0,
    flaps: false,
    fuel: FLIGHT.fuelCapacity,
    damage: 0,
    airborne: false,
    stalled: false,
    overspeed: false,
    crashed: false,
    crashReason: '',
    landed: false,
    fuelEmptyWarned: false,
    time: 0,
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// input: { pitch: -1..1 (up positive), roll: -1..1 (right positive),
//          throttle: -1..1 change, flaps: bool, gear: n/a }
// Returns events: array of strings ('stall', 'overspeed', 'fuel-empty', ...).
export function stepFlight(state, input, dt, terrainHeightAt) {
  const events = [];
  if (state.crashed || state.landed) return events;
  state.time += dt;

  // Throttle.
  state.throttle = clamp(state.throttle + input.throttle * dt * 0.55, 0, 1);
  state.flaps = !!input.flaps;

  // Fuel: full throttle drinks; idle sips. Empty tank kills the engine.
  const burn = FLIGHT.fuelBurnIdle + (FLIGHT.fuelBurn - FLIGHT.fuelBurnIdle) * state.throttle;
  state.fuel = Math.max(0, state.fuel - burn * dt);
  if (state.fuel <= 0 && state.throttle > 0) {
    state.throttle = 0;
    if (!state.fuelEmptyWarned) {
      state.fuelEmptyWarned = true;
      events.push('fuel-empty');
    }
  }

  // Speed: throttle pulls toward its target, drag bites at high speed.
  const target = state.throttle * FLIGHT.maxSpeed;
  const drag = 1 + FLIGHT.drag * (state.speed / FLIGHT.maxSpeed);
  state.speed += (target - state.speed) * Math.min(1, (FLIGHT.accel / FLIGHT.maxSpeed) * dt * drag);
  if (state.speed < 0) state.speed = 0;

  const stallSpeed = state.flaps ? FLIGHT.stallSpeedFlaps : FLIGHT.stallSpeed;
  state.stalled = state.airborne && state.speed < stallSpeed;
  state.overspeed = state.speed > FLIGHT.maxSpeed * 0.98;
  if (state.stalled) events.push('stall');

  // Bank: roll toward the commanded bank; heading follows the bank.
  const wantBank = input.roll * FLIGHT.maxBank;
  state.bank += (wantBank - state.bank) * Math.min(1, FLIGHT.bankRate * dt * 2.2);
  const speedFactor = clamp(state.speed / FLIGHT.cruiseSpeed, 0.25, 1.4);
  state.heading += -state.bank * FLIGHT.turnRate * speedFactor * dt;

  // Pitch: authority grows with speed; a stalled wing cannot hold the nose up.
  const authority = state.stalled ? 0.25 : FLIGHT.pitchAuthority * clamp(state.speed / 40, 0.25, 1);
  state.pitch = clamp(state.pitch + input.pitch * authority * dt, -0.5, 0.5);
  if (state.stalled) state.pitch -= 0.35 * dt;

  // Vertical speed from pitch and speed; a stalled wing sinks hard.
  let climb = Math.sin(state.pitch) * state.speed;
  if (state.stalled) climb -= 14;
  // Steep banks bleed lift: the wing pays for the turn.
  climb -= Math.abs(Math.sin(state.bank)) * state.speed * 0.12;

  // Move.
  const forwardX = Math.sin(state.heading);
  const forwardZ = Math.cos(state.heading);
  state.x += forwardX * Math.cos(state.pitch) * state.speed * dt;
  state.z += forwardZ * Math.cos(state.pitch) * state.speed * dt;
  state.y += climb * dt;

  // Take-off: fast enough on the water and the floats let go.
  if (!state.airborne && state.speed > 34 && state.y <= 0.5) {
    state.airborne = true;
    state.y = Math.max(state.y, 2);
    events.push('takeoff');
  }
  // On the water: stay on it.
  if (!state.airborne && state.y < 0.5) state.y = 0.5;

  // Terrain: islands are solid. Hitting one is a crash.
  const ground = terrainHeightAt(state.x, state.z);
  if (state.y < ground) {
    if (ground <= 0.5) {
      // Water: a gentle, slow touchdown is a landing; anything else is a crash.
      const descent = -climb;
      if (state.airborne && descent <= FLIGHT.maxLandingDescent && state.speed <= FLIGHT.maxLandingSpeed) {
        state.landed = true;
        state.airborne = false;
        state.y = 0.5;
        state.speed = Math.max(0, state.speed - 20 * dt);
        events.push('landed');
      } else if (state.airborne) {
        state.crashed = true;
        state.crashReason = descent > FLIGHT.maxLandingDescent
          ? 'Came down too hard on the water — the floats broke apart.'
          : 'Hit the water too fast — the hull dug in and flipped.';
        events.push('crashed');
      } else {
        state.y = 0.5;
      }
    } else {
      state.crashed = true;
      state.crashReason = 'Flew into the island — rock wins against aluminium.';
      events.push('crashed');
    }
  }
  return events;
}
