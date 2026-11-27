// Harbour Lights — Night Seaplane Mail Run.
// One clear job: every number that tunes the game lives here, so the rest of
// the code reads as rules, not magic numbers.
// SPDX-License-Identifier: MIT

// World: metres. Sea is y = 0. x east, z south. Home harbour near the origin.
export const WORLD = {
  seaSize: 5200,
  fogNear: 350,
  fogFar: 2600,
};

export const ISLANDS = [
  // name, x, z, radius, height, windows (lit), hasLighthouse
  { name: 'Harbour Island', x: -260, z: -160, r: 260, h: 42, windows: 26 },
  { name: 'North Isle', x: -520, z: -640, r: 210, h: 95, windows: 18 },
  { name: 'East Rock', x: 720, z: -240, r: 150, h: 125, windows: 10 },
  { name: 'South Cay', x: -220, z: 720, r: 185, h: 62, windows: 14 },
  { name: 'West Point', x: -840, z: 220, r: 175, h: 105, windows: 12 },
  { name: 'Beacon Isle', x: 520, z: 820, r: 230, h: 72, windows: 16, lighthouse: true },
];

// Home pontoon + landing circle (on the water, east of Harbour Island).
export const HARBOUR = { x: 120, z: 140, circleR: 90 };

// Flight model tuning.
export const FLIGHT = {
  maxSpeed: 92, // m/s at full throttle, level
  cruiseSpeed: 55,
  stallSpeed: 30, // below this the wing quits; flaps lower it
  stallSpeedFlaps: 23,
  accel: 14, // m/s^2 toward throttle target
  drag: 0.22, // extra drag coefficient at high speed
  climbRate: 9, // m/s at full climb, full speed
  sinkRate: 7, // m/s at full descent
  bankRate: 1.5, // rad/s toward commanded bank
  maxBank: 1.05, // rad (~60 deg)
  turnRate: 0.55, // heading rad/s at full bank and cruise speed
  pitchAuthority: 0.55, // rad/s
  fuelCapacity: 140,
  fuelBurn: 0.28, // units/s at full throttle
  fuelBurnIdle: 0.06,
  damageHardLanding: 55, // hitting water faster than this descent
  maxLandingDescent: 3.2, // m/s: gentle touchdown
  maxLandingSpeed: 46, // m/s: gentle touchdown
};

// Missions, in order. Rings are {x, y, z} centres, radius 26 m.
export const MISSIONS = [
  {
    id: 'rings',
    title: 'SORTIE 1 — RING RUN',
    brief: 'Thread all five lit rings over the bay. Keep her above stall speed.',
    rings: [
      { x: -40, y: 150, z: -260 },
      { x: -320, y: 165, z: -480 },
      { x: -560, y: 150, z: -560 },
      { x: -120, y: 175, z: -720 },
      { x: 420, y: 160, z: 200 },
    ],
  },
  {
    id: 'mail',
    title: 'SORTIE 2 — MAIL DROP',
    brief: 'Three islands wait for their mail. Fly low under the beams to drop it.',
    // drop zones: fly below 70 m inside radius 90 of the centre.
    // Drop beams stand in open water just off each island — low enough to
    // be a thrill, never inside the rock itself.
    drops: [
      { name: 'North Isle', x: -800, z: -640, maxAlt: 70, r: 95 },
      { name: 'East Rock', x: 950, z: -240, maxAlt: 70, r: 95 },
      { name: 'South Cay', x: -220, z: 960, maxAlt: 70, r: 95 },
    ],
  },
  {
    id: 'return',
    title: 'SORTIE 3 — HARBOUR RETURN',
    brief: 'Bring her home. Land on the water inside the lit harbour circle, gentle and slow.',
    landing: HARBOUR,
  },
];

export const SCORE = {
  ring: 150,
  drop: 250,
  landing: 500,
  fuelBonusPerUnit: 4,
  damagePenaltyPerUnit: 6,
  timeParSeconds: 420,
};

// Palette: one night style — deep blue sea and sky, warm amber lights.
export const COLORS = {
  sky: 0x0a1226,
  fog: 0x0d1730,
  sea: 0x0a2036,
  moon: 0xf5ead0,
  ring: 0xffc94d,
  ringDone: 0x37e0a0,
  beam: 0xffe9a8,
  window: 0xffb45e,
  hud: '#ffcf6e',
  hudCyan: '#7fe7ff',
  danger: '#ff5d5d',
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
