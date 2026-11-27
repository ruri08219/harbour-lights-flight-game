// Harbour Lights — Night Seaplane Mail Run.
// One clear job: wire the pieces together — world, plane, physics, missions,
// HUD, sound — and run the game loop. This is the only file that touches
// the screens (title, pause, debrief) and the ?shot= staging.
// SPDX-License-Identifier: MIT
import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { buildWorld, animateWorld, terrainHeightAt } from './world.js';
import { buildAircraft, poseAircraft } from './aircraft.js';
import { freshState, stepFlight } from './physics.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRender } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot') || '';
const SEED = Number(params.get('seed') || '7');
// A staged shot is a frozen frame: the staging plays the real game forward,
// then the loop renders without stepping, so the screenshot always shows
// the staged moment (never a later crash or a threaded ring).
const FROZEN = SHOT !== '';

const canvas = document.getElementById('game');
const scene = buildWorld(SEED);
const plane = buildAircraft();
scene.add(plane);
const render = createRender(canvas);

const game = {
  state: freshState(),
  missions: createMissions(),
  screen: 'title', // title | play | pause | over | done
  score: 0,
  // One fixed step of the real game. Shots and the loop both go through here,
  // so a staged frame is a genuinely played frame.
  stepGame(dt, input) {
    const flightEvents = stepFlight(this.state, input, dt, terrainHeightAt);
    const missionEvents = this.missions.step(this.state, flightEvents);
    for (const e of [...flightEvents, ...missionEvents]) {
      if (e === 'ring') audio.ring();
      if (e === 'drop') audio.drop();
      if (e === 'mission') {
        audio.mission();
        hud.showBanner(this.missions.title, MISSIONS[Math.min(this.missions.index, 2)].brief);
      }
      if (e === 'landed') audio.splash();
      if (e === 'landed-home' || e === 'landed-short') {
        audio.mission();
        this.screen = 'done';
      }
      if (e === 'crashed') {
        audio.crash();
        this.screen = 'over';
      }
      if (e === 'takeoff') hud.showBanner('AIRBORNE', 'Gear up — she flies. Mind the fuel.');
    }
    if (this.state.crashed) this.screen = 'over';
  },
};

const hud = createHud();
const input = createInput();
const audio = createAudio();

const screens = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  over: document.getElementById('screen-over'),
  done: document.getElementById('screen-done'),
};

function showScreen(name) {
  for (const [key, node] of Object.entries(screens)) node.classList.toggle('show', key === name);
  document.getElementById('hud').classList.toggle('show', name === 'play' || name === 'pause');
}

function startGame() {
  audio.unlock();
  audio.click();
  game.state = freshState();
  game.missions = createMissions();
  game.screen = 'play';
  showScreen('play');
  hud.showBanner(MISSIONS[0].title, MISSIONS[0].brief);
}

function restart() {
  startGame();
}

input.setActionHandler((action) => {
  audio.unlock();
  if (action === 'start') startGame();
  else if (action === 'restart') restart();
  else if (action === 'resume') {
    game.screen = 'play';
    showScreen('play');
  } else if (action === 'how') {
    document.getElementById('screen-how').classList.toggle('show');
  }
});

function fillDebrief() {
  const d = game.missions.debrief(game.state);
  const rows = [
    ['Score', d.score],
    ['Time', `${Math.floor(d.time / 60)}:${String(Math.floor(d.time % 60)).padStart(2, '0')}`],
    ['Rings threaded', `${d.rings}/${MISSIONS[0].rings.length}`],
    ['Mail delivered', `${d.drops}/${MISSIONS[1].drops.length}`],
    ['Fuel left', `${d.fuel}%`],
    ['Damage', `${d.damage}%`],
  ];
  const html = rows
    .map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('');
  if (game.state.crashed) {
    document.getElementById('crash-reason').textContent = game.state.crashReason || 'The sea keeps what it catches.';
    document.getElementById('debrief-rows-crash').innerHTML = html;
  } else {
    document.getElementById('debrief-title').textContent = game.missions.isDone
      ? 'MAIL DELIVERED — HARBOUR LIGHTS'
      : 'RUN OVER';
    document.getElementById('debrief-rows').innerHTML = html;
  }
}

let last = performance.now();
let shotDone = false;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const keys = input.poll();
  if (keys.mute) audio.toggleMute();
  if (keys.camera && game.screen === 'play') render.toggleCamera();
  if (keys.restart && game.screen !== 'title') restart();

  if (game.screen === 'title') {
    if (keys.start) startGame();
    // The title screen idles over the harbour: a slow taxi circle on the water.
    const t = now / 1000;
    game.state.x = 120 + Math.sin(t * 0.05) * 60;
    game.state.z = 140 + Math.cos(t * 0.05) * 60;
    game.state.y = 0.5;
    game.state.heading = t * 0.05;
    game.state.speed = 0;
  } else if (game.screen === 'play') {
    if (keys.pause) {
      game.screen = 'pause';
      showScreen('pause');
    } else if (!FROZEN) {
      game.stepGame(dt, keys);
      if (game.screen === 'over' || game.screen === 'done') {
        fillDebrief();
        showScreen(game.screen === 'over' ? 'over' : 'done');
      }
    }
  } else if (game.screen === 'pause') {
    if (keys.pause) {
      game.screen = 'play';
      showScreen('play');
    }
  } else if (keys.start) {
    restart();
  }

  audio.update(game.state);
  animateWorld(scene, now / 1000);
  poseAircraft(plane, game.state, now / 1000);
  render.render(scene, plane, game.state);
  if (game.screen === 'play' || game.screen === 'pause') {
    hud.update(game.state, { title: game.missions.title, progress: game.missions.progress, warn: game.missions.warn }, game.missions.score, 0);
  }
  if (SHOT && !shotDone) {
    shotDone = true;
    // The staged frame is already rendered above; freeze it for the shot.
    document.title = `Harbour Lights — shot ${SHOT}`;
  }
}

// Screenshot staging: pose the real game, then let the loop render it.
if (SHOT) {
  const staged = stageShot(SHOT, game);
  render.setCamera(staged.camera);
  render.snap();
  game.screen = 'play';
  showScreen('play');
  hud.showBanner(game.missions.title, MISSIONS[Math.min(game.missions.index, 2)].brief);
  hud.update(game.state, { title: game.missions.title, progress: game.missions.progress, warn: '' }, game.missions.score, 0);
} else {
  showScreen('title');
}
requestAnimationFrame(frame);
