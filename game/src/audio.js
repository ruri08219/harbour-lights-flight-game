// Harbour Lights — procedural sound, no audio files.
// One clear job: every sound the game makes, synthesized with WebAudio:
// engine hum tied to throttle, wind tied to speed, and event chimes.
// SPDX-License-Identifier: MIT

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windSrc = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      // Engine: two detuned saws through a low-pass, pitch follows throttle.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = 58;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      osc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      osc2.start();
      // Wind: looped noise through a band-pass, loudness follows speed.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      windSrc = ctx.createBufferSource();
      windSrc.buffer = buffer;
      windSrc.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      windSrc.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, ctx.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + dur);
    } catch { /* sound is garnish, never fatal */ }
  }

  return {
    // Call on the first user gesture; safe to call repeatedly.
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = muted ? 0 : 0.05;
      return muted;
    },
    update(state) {
      if (!ctx || muted) return;
      try {
        const t = ctx.currentTime;
        engineGain.gain.setTargetAtTime(state.airborne ? 0.04 + state.throttle * 0.05 : 0.015, t, 0.1);
        engineOsc.frequency.setTargetAtTime(50 + state.throttle * 70 + state.speed * 0.4, t, 0.1);
        windGain.gain.setTargetAtTime(Math.min(0.12, state.speed * 0.0012), t, 0.15);
        windFilter.frequency.setTargetAtTime(300 + state.speed * 8, t, 0.15);
      } catch { /* ignore */ }
    },
    ring() { blip(880, 0.35, 'sine', 0.16); blip(1318, 0.5, 'sine', 0.12, 0.09); },
    drop() { blip(659, 0.3, 'triangle', 0.16); blip(988, 0.45, 'triangle', 0.12, 0.08); },
    mission() { [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.4, 'triangle', 0.14, i * 0.1)); },
    splash() { blip(220, 0.5, 'sine', 0.2); blip(110, 0.7, 'sine', 0.16, 0.1); },
    crash() { blip(90, 0.9, 'sawtooth', 0.22); blip(55, 1.2, 'sawtooth', 0.18, 0.15); },
    click() { blip(660, 0.08, 'square', 0.06); },
  };
}
