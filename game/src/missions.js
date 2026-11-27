// Harbour Lights — the three sorties.
// One clear job: track which mission the player is on, what counts as done,
// and the score. It reads flight state and the world; it draws nothing.
// SPDX-License-Identifier: MIT
import { MISSIONS, SCORE, HARBOUR, FLIGHT } from './config.js';
import { terrainHeightAt } from './world.js';

export function createMissions() {
  let index = 0; // 0 rings, 1 mail, 2 return, 3 done
  let ringNext = 0;
  let dropsDone = new Set();
  let score = 0;
  let warn = '';
  let done = false;

  function current() {
    return MISSIONS[Math.min(index, MISSIONS.length - 1)];
  }

  function progressText() {
    if (index === 0) return `Rings ${ringNext}/${MISSIONS[0].rings.length} — thread the lit rings`;
    if (index === 1) return `Mail ${dropsDone.size}/${MISSIONS[1].drops.length} — fly low under the beams`;
    if (index === 2) return 'Land inside the green harbour circle — gentle and slow';
    return 'All sorties complete';
  }

  function ringDistance(state, ring) {
    const dx = state.x - ring.x;
    const dy = state.y - ring.y;
    const dz = state.z - ring.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  return {
    get title() {
      return done ? 'ALL SORTIES COMPLETE' : current().title;
    },
    get progress() {
      return progressText();
    },
    get warn() {
      return warn;
    },
    get score() {
      return score;
    },
    get index() {
      return index;
    },
    get isDone() {
      return done;
    },
    // The ring the player should aim at now (for the HUD arrow / autopilot).
    get nextRing() {
      return index === 0 ? MISSIONS[0].rings[ringNext] : null;
    },
    get nextDrop() {
      if (index !== 1) return null;
      return MISSIONS[1].drops.find((d) => !dropsDone.has(d.name)) || null;
    },
    get dropsDoneCount() {
      return dropsDone.size;
    },
    get ringsDoneCount() {
      return ringNext;
    },
    // Test-only seam: jump the mission state (used by shots.js staging).
    stage(stageIndex, opts = {}) {
      index = stageIndex;
      ringNext = opts.rings ?? (stageIndex > 0 ? MISSIONS[0].rings.length : 0);
      dropsDone = new Set(opts.drops ?? (stageIndex > 1 ? MISSIONS[1].drops.map((d) => d.name) : []));
      score = opts.score ?? 0;
      done = stageIndex >= 3;
    },
    // Step the missions. Returns events: 'ring', 'drop', 'mission', 'landed-home'.
    step(state, events) {
      const out = [];
      warn = '';
      if (done || state.crashed) return out;
      if (index === 0) {
        const ring = MISSIONS[0].rings[ringNext];
        if (ring && ringDistance(state, ring) < 26) {
          ringNext += 1;
          score += SCORE.ring;
          out.push('ring');
          if (ringNext >= MISSIONS[0].rings.length) {
            index = 1;
            out.push('mission');
          }
        } else if (ring) {
          const d = Math.round(ringDistance(state, ring));
          if (d > 900) warn = 'OFF COURSE — TURN BACK TO THE RING';
        }
      } else if (index === 1) {
        for (const drop of MISSIONS[1].drops) {
          if (dropsDone.has(drop.name)) continue;
          const dx = state.x - drop.x;
          const dz = state.z - drop.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < drop.r && state.y < drop.maxAlt && state.airborne) {
            dropsDone.add(drop.name);
            score += SCORE.drop;
            out.push('drop');
            if (dropsDone.size >= MISSIONS[1].drops.length) {
              index = 2;
              out.push('mission');
            }
            break;
          }
        }
      } else if (index === 2) {
        if (events.includes('landed')) {
          const dx = state.x - HARBOUR.x;
          const dz = state.z - HARBOUR.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist <= HARBOUR.circleR) {
            done = true;
            score += SCORE.landing;
            score += Math.round(state.fuel) * SCORE.fuelBonusPerUnit;
            score -= Math.round(state.damage) * SCORE.damagePenaltyPerUnit;
            if (state.time < SCORE.timeParSeconds) score += Math.round((SCORE.timeParSeconds - state.time) / 10) * 10;
            out.push('landed-home');
          } else {
            // Landed outside the circle: it counts as a landing, but the
            // sortie wants the harbour — taxi is not modelled, so this ends
            // the run as a landing short of home.
            done = true;
            score += Math.round(state.fuel) * SCORE.fuelBonusPerUnit;
            score -= Math.round(state.damage) * SCORE.damagePenaltyPerUnit;
            out.push('landed-short');
          }
        } else {
          const dx = state.x - HARBOUR.x;
          const dz = state.z - HARBOUR.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (state.airborne && state.y < 120 && dist > 700) warn = 'TOO FAR FROM THE HARBOUR — TURN HOME';
        }
      }
      // Terrain proximity warning, any mission.
      if (state.airborne) {
        const ground = terrainHeightAt(state.x, state.z);
        if (ground > 0 && state.y - ground < 35) warn = 'PULL UP — TERRAIN';
      }
      return out;
    },
    // Final tally text for the debrief screen.
    debrief(state) {
      return {
        score,
        time: state.time,
        fuel: Math.round((state.fuel / FLIGHT.fuelCapacity) * 100),
        damage: Math.round(state.damage),
        rings: ringNext,
        drops: dropsDone.size,
      };
    },
  };
}
