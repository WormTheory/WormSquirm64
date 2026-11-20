// The music: original tunes made up by the game itself and played on a few simple voices
// (a square-wave lead, a triangle bass, a quiet arpeggio and noise for drums), in the manner of
// a cartridge game. Each song is grown from a seed: a key, a run of chords, and a melody that
// walks around the chord's notes. The same seed always gives the same tune, so every track has its own.
import { makeRng } from './sim/rng.js';
import { audioCtx, musicOut } from './audio.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
// name: [seed, beats a minute, lowest note of the key (MIDI), minor?, chords (steps of the scale), how busy the lead is]
const SONGS = {
  menu: [11, 104, 57, false, [0, 5, 3, 4], 0.45],
  results: [7, 118, 60, false, [0, 3, 4, 0], 0.5],
  race0: [101, 152, 60, false, [0, 4, 5, 3], 0.7],
  race1: [102, 144, 55, false, [0, 3, 0, 4], 0.6],
  race2: [103, 156, 62, false, [0, 5, 3, 4], 0.7],
  race3: [104, 148, 57, true, [0, 6, 5, 4], 0.65],
  race4: [105, 150, 64, false, [0, 2, 3, 4], 0.6],
  race5: [106, 142, 53, true, [0, 5, 2, 6], 0.7],
  race6: [107, 136, 50, true, [0, 3, 6, 4], 0.55],
  race7: [108, 158, 60, false, [0, 4, 2, 5], 0.8],
};
const BARS = 8, STEPS = 16; // a song is eight bars of sixteen steps, then round again

// Writes a song out as, for each step, the notes to start: [voice, MIDI note, length in steps].
function compose(name) {
  const [seed, bpm, root, minor, chords, busy] = SONGS[name], rng = makeRng(seed), scale = minor ? MINOR : MAJOR;
  const note = (deg, oct = 0) => root + 12 * (oct + Math.floor(deg / 7)) + scale[((deg % 7) + 7) % 7];
  const steps = Array.from({ length: BARS * STEPS }, () => []);
  // A rhythm for the lead: which of the sixteen steps start a note. Strong beats nearly always do.
  const rhythm = () => Array.from({ length: STEPS }, (_, i) => rng() < (i % 4 === 0 ? 0.92 : i % 2 === 0 ? busy : busy * 0.35));
  // Two melody bars (A and B) are written against the first chord and then moved to follow each chord: A A B A, twice.
  const phrase = () => {
    const r = rhythm(), out = [];
    let d = rng.pick([0, 2, 4]);
    for (let i = 0; i < STEPS; i++) {
      if (!r[i]) continue;
      d += i % 8 === 0 ? rng.pick([-2, 0, 2]) : rng.pick([-2, -1, -1, 1, 1, 2]);
      d = Math.max(-2, Math.min(9, d));
      if (i % 8 === 0) d = [0, 2, 4, 7][Math.round(Math.max(0, Math.min(3, d / 2.4)))]; // land on a note of the chord
      let len = 1;
      while (i + len < STEPS && !r[i + len] && len < 4) len++;
      out.push([i, d, len]);
    }
    return out;
  };
  const A = phrase(), B = phrase();
  for (let bar = 0; bar < BARS; bar++) {
    const ch = chords[bar % chords.length], at = bar * STEPS;
    for (const [i, d, len] of (bar % 4 === 2 ? B : A)) steps[at + i].push(['lead', note(ch + d, 1), len]);
    for (let i = 0; i < STEPS; i += 2) {
      steps[at + i].push(['bass', note(ch, -2) + (i % 8 === 4 ? 12 : i % 8 === 6 ? 7 : 0), 2]);
      steps[at + i].push(['arp', note(ch + [0, 2, 4, 2][(i / 2) % 4], 0), 1]);
      steps[at + i].push(['hat', 0, 1]);
    }
    for (const i of [0, 8, bar % 2 ? 10 : 6]) steps[at + i].push(['kick', 0, 1]);
    for (const i of [4, 12]) steps[at + i].push(['snare', 0, 1]);
  }
  return { bpm, steps };
}

let song = null, name = null, step = 0, nextAt = 0, speed = 1, timer = null, noise = null;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

function voice(kind, midi, len, t, stepLen) {
  const c = audioCtx(), out = musicOut(), g = c.createGain(), dur = len * stepLen;
  g.connect(out);
  if (kind === 'lead' || kind === 'bass' || kind === 'arp') {
    const o = c.createOscillator(), vol = kind === 'lead' ? 0.055 : kind === 'bass' ? 0.11 : 0.022;
    o.type = kind === 'bass' ? 'triangle' : 'square';
    o.frequency.setValueAtTime(hz(midi), t);
    g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur * 0.98);
    o.connect(g); o.start(t); o.stop(t + dur);
    return;
  }
  if (kind === 'kick') {
    const o = c.createOscillator();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); o.start(t); o.stop(t + 0.15);
    return;
  }
  // Snare and hi-hat: a burst of noise, the hat shorter and thinner.
  if (!noise) { noise = c.createBuffer(1, c.sampleRate * 0.2, c.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = c.createBufferSource(), f = c.createBiquadFilter(), hat = kind === 'hat';
  s.buffer = noise; f.type = 'highpass'; f.frequency.value = hat ? 7000 : 1800;
  g.gain.setValueAtTime(hat ? 0.03 : 0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + (hat ? 0.04 : 0.12));
  s.connect(f).connect(g); s.start(t); s.stop(t + 0.15);
}

// Notes are booked a fifth of a second ahead on the sound clock, so the tune keeps time even when the picture stutters.
function pump() {
  const c = audioCtx();
  if (!c || !song || c.state !== 'running') return;
  if (nextAt < c.currentTime) nextAt = c.currentTime + 0.05;
  while (nextAt < c.currentTime + 0.2) {
    const stepLen = 60 / (song.bpm * speed) / 4;
    for (const [kind, midi, len] of song.steps[step]) voice(kind, midi, len, nextAt, stepLen);
    step = (step + 1) % song.steps.length;
    nextAt += stepLen;
  }
}

// Starts a song (or carries on, if it's the one already playing). Nothing sounds until the page has been clicked or a key pressed.
export function playSong(n) {
  if (!SONGS[n]) n = 'race0';
  if (n === name) return;
  name = n; song = compose(n); step = 0; nextAt = 0; speed = 1;
  if (!timer) timer = setInterval(pump, 50);
}
export function songSpeed(k) { speed = k; }
export const raceSong = (trackIdx) => 'race' + (trackIdx % 8);
