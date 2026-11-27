// Harbour Lights — the lit instruments.
// One clear job: paint the flight state onto the HUD DOM (altitude, speed,
// heading, fuel, damage, mission, warnings) and the artificial horizon.
// SPDX-License-Identifier: MIT

function el(id) {
  return document.getElementById(id);
}

function compassLabel(heading) {
  // World: +z is south, -z is north, +x is east. Bearing 0 = north.
  const deg = ((180 - (heading * 180) / Math.PI) % 360 + 360) % 360;
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const point = points[Math.round(deg / 45) % 8];
  return `${String(Math.round(deg)).padStart(3, '0')}° ${point}`;
}

import { FLIGHT } from './config.js';

export function createHud() {
  const horizon = el('horizon');
  const hctx = horizon.getContext('2d');
  let bannerTimer = 0;

  function drawHorizon(bank, pitch) {
    const w = horizon.width;
    const h = horizon.height;
    const cx = w / 2;
    const cy = h / 2;
    hctx.clearRect(0, 0, w, h);
    hctx.save();
    hctx.beginPath();
    hctx.arc(cx, cy, 62, 0, Math.PI * 2);
    hctx.clip();
    // Sky above the line, sea below it; the line rolls with the bank and
    // slides with the pitch, as a real attitude indicator does.
    hctx.translate(cx, cy);
    hctx.rotate(bank);
    const dy = -pitch * 90;
    hctx.fillStyle = '#274b73';
    hctx.fillRect(-70, -70 + dy, 140, 70);
    hctx.fillStyle = '#0a2036';
    hctx.fillRect(-70, dy, 140, 70);
    hctx.strokeStyle = '#ffcf6e';
    hctx.lineWidth = 2;
    hctx.beginPath();
    hctx.moveTo(-64, dy);
    hctx.lineTo(64, dy);
    hctx.stroke();
    hctx.restore();
    // Fixed aircraft symbol.
    hctx.strokeStyle = '#ffcf6e';
    hctx.lineWidth = 2.5;
    hctx.beginPath();
    hctx.moveTo(cx - 26, cy);
    hctx.lineTo(cx - 8, cy);
    hctx.moveTo(cx + 8, cy);
    hctx.lineTo(cx + 26, cy);
    hctx.moveTo(cx, cy - 4);
    hctx.lineTo(cx, cy + 4);
    hctx.stroke();
    hctx.strokeStyle = 'rgba(255,207,110,0.5)';
    hctx.lineWidth = 1.5;
    hctx.beginPath();
    hctx.arc(cx, cy, 62, 0, Math.PI * 2);
    hctx.stroke();
  }

  return {
    showBanner(text, sub) {
      el('banner-title').textContent = text;
      el('banner-sub').textContent = sub || '';
      el('banner').classList.add('show');
      bannerTimer = 3.2;
    },
    update(state, mission, score, timeLeft) {
      if (bannerTimer > 0) {
        bannerTimer -= 1 / 60;
        if (bannerTimer <= 0) el('banner').classList.remove('show');
      }
      el('hud-alt').textContent = `${Math.max(0, Math.round(state.y * 3.28))} ft`;
      el('hud-speed').textContent = `${Math.round(state.speed * 1.94)} kt`;
      el('hud-heading').textContent = compassLabel(state.heading);
      el('hud-throttle').style.width = `${Math.round(state.throttle * 100)}%`;
      el('hud-throttle-label').textContent = `${Math.round(state.throttle * 100)}%`;
      const fuelPct = Math.round((state.fuel / FLIGHT.fuelCapacity) * 100);
      el('hud-fuel').style.width = `${fuelPct}%`;
      el('hud-fuel-label').textContent = `${fuelPct}%`;
      el('hud-damage').style.width = `${Math.round(state.damage)}%`;
      el('hud-score').textContent = String(score);
      const mins = Math.floor(state.time / 60);
      const secs = Math.floor(state.time % 60);
      el('hud-time').textContent = `${mins}:${String(secs).padStart(2, '0')}`;
      el('hud-mission').textContent = mission.title;
      el('hud-objective').textContent = mission.progress;
      drawHorizon(state.bank, state.pitch);
      // Warnings, loud and lit.
      const warn = el('hud-warn');
      const messages = [];
      if (state.stalled) messages.push('STALL — NOSE DOWN, THROTTLE UP');
      if (state.overspeed) messages.push('OVERSPEED');
      if (state.fuel > 0 && fuelPct < 15) messages.push('LOW FUEL');
      if (state.fuel <= 0) messages.push('FUEL EMPTY — GLIDE HER IN');
      if (mission.warn) messages.push(mission.warn);
      warn.textContent = messages.join('  ·  ');
      warn.classList.toggle('show', messages.length > 0);
      el('hud-fuel').classList.toggle('low', fuelPct < 15);
    },
  };
}
