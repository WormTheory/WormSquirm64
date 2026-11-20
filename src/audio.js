// All sound is made on the spot with the Web Audio API. Browsers only allow sound after
// a tap or key press, so nothing exists until unlock() is called from one.
import { settings } from './settings.js';

let ctx = null, noiseBuf = null, sfxGain = null, musicGain = null;

export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    sfxGain = ctx.createGain(); sfxGain.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.connect(ctx.destination);
    applyVolume();
  } catch (e) { ctx = null; }
}
// The two volume sliders in the options (0 to 10 each).
export function applyVolume() {
  if (!ctx) return;
  sfxGain.gain.value = (settings.sfx ?? 8) / 8;
  musicGain.gain.value = (settings.music ?? 6) / 6;
}
export const audioCtx = () => ctx;
export const musicOut = () => musicGain;

function tone(type, f0, f1, dur, vol, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(sfxGain); o.start(t); o.stop(t + dur + 0.02);
}

// A wet little squelch, different every time. vol is lower for the other worms.
export function squelch(vol = 0.2) {
  if (!ctx) return;
  const f = 120 + Math.random() * 260;
  tone('sawtooth', f, f * (0.3 + Math.random() * 1.6), 0.12 + Math.random() * 0.12, vol);
  const t = ctx.currentTime, s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 500 + Math.random() * 1500; bp.Q.value = 3;
  g.gain.setValueAtTime(vol * 0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  s.connect(bp).connect(g).connect(sfxGain); s.start(t); s.stop(t + 0.16);
}
export const beep = (high) => tone('square', high ? 880 : 440, high ? 880 : 440, high ? 0.5 : 0.18, 0.12);
export const lapJingle = () => [660, 880, 1100].forEach((f, i) => tone('square', f, f, 0.1, 0.1, i * 0.09));
export const finishJingle = () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone('square', f, f, 0.16, 0.12, i * 0.13));

// A burst of filtered noise: thuds, splashes and the like.
function burst(freq, dur, vol, type = 'lowpass') {
  if (!ctx) return;
  const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(sfxGain); s.start(t); s.stop(t + dur + 0.02);
}
export const itemJingle = () => [988, 1319, 1568].forEach((f, i) => tone('square', f, f, 0.07, 0.09, i * 0.06));
export const hit = (vol = 0.2) => { burst(900, 0.18, vol); tone('square', 300, 90, 0.2, vol * 0.5); };
export const zap = () => { tone('sawtooth', 1800, 80, 0.5, 0.14); burst(4000, 0.3, 0.12, 'highpass'); };
export const fallWhistle = (vol = 0.1) => tone('sine', 900, 120, 0.9, vol);
export const hurt = (vol = 0.12) => tone('square', 700 + Math.random() * 300, 380, 0.13, vol);
export const stomp = (vol = 0.3) => { burst(220, 0.45, vol); tone('sine', 90, 35, 0.4, vol); };
export const squash = () => tone('sawtooth', 500, 60, 0.35, 0.16);
export const caw = () => [0, 0.22].forEach((w) => tone('sawtooth', 1100, 620, 0.16, 0.12, w));
export const gulp = () => { tone('sine', 260, 90, 0.25, 0.2); tone('sine', 180, 320, 0.15, 0.15, 0.28); };
export const eventSting = (kind) => ({ rain: [392, 330, 262], heat: [523, 554, 587], bird: [880, 660, 880], stomp: [196, 147, 98], moon: [220, 208, 147, 139],
  twister: [330, 392, 330, 392], quake: [98, 92, 98, 87], frost: [1047, 988, 880, 784] }[kind] || [])
  .forEach((f, i) => tone('square', f, f, 0.16, 0.1, i * 0.14));

// Menu noises: moving between things, choosing one, going back, and a slider's click.
export function ui(kind) {
  if (kind === 'move') tone('square', 660, 660, 0.04, 0.06);
  else if (kind === 'select') { tone('square', 880, 880, 0.06, 0.08); tone('square', 1320, 1320, 0.09, 0.08, 0.06); }
  else if (kind === 'back') { tone('square', 520, 520, 0.06, 0.07); tone('square', 330, 330, 0.09, 0.07, 0.06); }
  else if (kind === 'tick') tone('square', 990, 990, 0.025, 0.05);
}
export const sizzle = (vol = 0.12) => burst(5000, 0.7, vol, 'highpass');
export const splash = (vol = 0.15) => { burst(1400, 0.5, vol, 'bandpass'); tone('sine', 500, 180, 0.3, vol * 0.5); };
// The sound of an item going off, by its number (see ITEMS in sim/items.js): boost, peel, pebble, homing pebble, star, lightning, mole.
export function itemUse(item, k = 1) {
  if (item === 0) { burst(1200, 0.5, 0.16 * k, 'bandpass'); tone('sawtooth', 180, 720, 0.45, 0.1 * k); }
  else if (item === 1) tone('sine', 520, 160, 0.22, 0.14 * k);
  else if (item === 2 || item === 3) { tone('square', 240, 520, 0.12, 0.1 * k); if (item === 3) tone('square', 700, 900, 0.3, 0.06 * k, 0.12); }
  else if (item === 4) [659, 784, 988, 1319, 1568].forEach((f, i) => tone('square', f, f, 0.09, 0.1 * k, i * 0.07));
  else if (item === 6) { burst(300, 0.4, 0.14 * k); tone('sine', 140, 60, 0.4, 0.12 * k); }
  else if (item === 7) { burst(500, 0.3, 0.12 * k); tone('sine', 220, 90, 0.3, 0.1 * k); }                      // glue: a glop
  else if (item === 8) { tone('sine', 400, 1200, 0.22, 0.12 * k); tone('sine', 1200, 400, 0.22, 0.12 * k, 0.05); }  // switcheroo: two notes crossing
  else if (item === 9) { tone('sine', 200, 900, 0.18, 0.16 * k); tone('sine', 900, 500, 0.3, 0.1 * k, 0.18); }      // spring: boing
}
// The wolf's howl (or, back: true, a whimper as the curse lifts), its bite with the victim's yelp, and the hand's three pats after.
export function howl(back) {
  if (back) { tone('sine', 620, 300, 0.7, 0.12); return; }
  tone('sine', 300, 760, 0.7, 0.16); tone('sine', 760, 700, 0.9, 0.16, 0.7); tone('sine', 700, 380, 0.5, 0.12, 1.6);
}
export function bite(vol = 0.15) {
  burst(700, 0.16, vol); tone('sawtooth', 160, 70, 0.22, vol * 0.8);
  tone('square', 1100, 520, 0.2, vol * 0.6, 0.12);
  for (const w of [1.1, 1.65, 2.2]) tone('sine', 190, 120, 0.09, vol * 0.7, w);
}
// Stuck in glue; whirled up by the tornado; the ground shaking.
export const glued = (vol = 0.12) => { burst(400, 0.25, vol); tone('sine', 180, 110, 0.25, vol * 0.7); };
export const twirl = (vol = 0.14) => { burst(900, 1.2, vol, 'bandpass'); tone('sine', 300, 900, 1.1, vol * 0.5); };
export const rumble = (vol = 0.25) => { burst(140, 0.8, vol); tone('sawtooth', 55, 38, 0.8, vol * 0.6); };
