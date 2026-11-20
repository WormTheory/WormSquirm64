// All sound is made on the spot with the Web Audio API. Browsers only allow sound after
// a tap or key press, so nothing exists until unlock() is called from one.
let ctx = null, noiseBuf = null;

export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; }
}

function tone(type, f0, f1, dur, vol, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}

// A wet little squelch, different every time. vol is lower for the other worms.
export function squelch(vol = 0.2) {
  if (!ctx) return;
  const f = 120 + Math.random() * 260;
  tone('sawtooth', f, f * (0.3 + Math.random() * 1.6), 0.12 + Math.random() * 0.12, vol);
  const t = ctx.currentTime, s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 500 + Math.random() * 1500; bp.Q.value = 3;
  g.gain.setValueAtTime(vol * 0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  s.connect(bp).connect(g).connect(ctx.destination); s.start(t); s.stop(t + 0.16);
}
export const beep = (high) => tone('square', high ? 880 : 440, high ? 880 : 440, high ? 0.5 : 0.18, 0.12);
export const lapJingle = () => [660, 880, 1100].forEach((f, i) => tone('square', f, f, 0.1, 0.1, i * 0.09));
export const finishJingle = () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone('square', f, f, 0.16, 0.12, i * 0.13));
