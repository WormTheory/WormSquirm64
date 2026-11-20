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
export const eventSting = (kind) => ({ rain: [392, 330, 262], heat: [523, 554, 587], bird: [880, 660, 880], stomp: [196, 147, 98] }[kind] || [])
  .forEach((f, i) => tone('square', f, f, 0.16, 0.1, i * 0.14));
