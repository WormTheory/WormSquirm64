// The music: original tunes made up by the game itself, in the manner of a mid-nineties kart racer.
// Nothing is recorded and nothing is copied: each song is grown from a seed and a style.
//
// A song has a shape: a short intro, then sections A, A again with more going on, B (a change of
// chords and a new tune), and back round. Its band is a lead instrument, a second voice in harmony,
// a bass line, off-beat chord stabs, an arpeggio and a drum kit that plays fills into each new section.
// Each track picks its own band and feel: funk with slap bass and brass on the raceway, a banjo hoedown
// on the farm, steel drums on the beach, sleigh bells in the snow, a wheezing organ on the haunted boardwalk.
//
// It also listens to the race: the last lap is faster and a semitone higher, and a player near the
// front gets an extra layer on top.
import { makeRng } from './sim/rng.js';
import { audioCtx, musicOut } from './audio.js';

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 4, 5, 7, 8, 10] };
// Chords for a section, as steps of the scale, a bar each. A song picks one of these for A and one for B.
const PROGS = {
  bright: { A: [[0, 5, 3, 4, 0, 5, 3, 4], [0, 3, 0, 4, 0, 3, 4, 0], [0, 0, 3, 3, 1, 4, 0, 4], [0, 2, 3, 4, 0, 2, 3, 4]],
    B: [[3, 3, 0, 0, 3, 3, 4, 4], [5, 5, 3, 3, 1, 1, 4, 4], [3, 4, 2, 5, 3, 4, 0, 4]] },
  dark: { A: [[0, 0, 5, 6, 0, 0, 5, 4], [0, 6, 5, 4, 0, 6, 5, 4], [0, 3, 6, 4, 0, 3, 6, 0]],
    B: [[5, 5, 6, 6, 5, 5, 4, 4], [3, 3, 6, 6, 5, 5, 4, 4], [5, 6, 0, 0, 5, 6, 4, 4]] },
};
// Rhythms for one beat of the tune (four sixteenths: 1 starts a note). The later ones are the syncopated ones.
const CELLS = [[1, 0, 0, 0], [1, 0, 1, 0], [1, 0, 0, 1], [1, 0, 1, 1], [1, 1, 0, 1], [0, 0, 1, 0], [0, 1, 0, 1], [0, 1, 1, 0], [0, 0, 0, 0]];
// Bass lines for one bar: [sixteenth, note, length]. Notes: 0 the chord's root, 4 its fifth, 7 the octave, 'a' a step up into the next chord.
const BASS = {
  funk: [[0, 0, 2], [3, 7, 1], [4, 0, 1], [6, 7, 1], [8, 0, 2], [10, 4, 1], [11, 7, 1], [13, 0, 1], [14, 'a', 2]],
  boom: [[0, 0, 3], [4, 4, 3], [8, 0, 3], [12, 4, 2], [14, 'a', 2]],
  walk: [[0, 0, 4], [4, 2, 4], [8, 4, 4], [12, 'a', 4]],
  sync: [[0, 0, 3], [3, 0, 3], [6, 4, 2], [8, 0, 3], [11, 7, 3], [14, 'a', 2]],
  slow: [[0, 0, 6], [6, 4, 2], [8, 0, 6], [14, 'a', 2]],
  drive: [[0, 0, 2], [2, 0, 2], [4, 7, 2], [6, 0, 2], [8, 0, 2], [10, 0, 2], [12, 7, 2], [14, 'a', 2]],
};
// Drum patterns for one bar, a list of sixteenths per drum. tick is the extra percussion (shaker or sleigh bells).
const DRUMS = {
  funk: { kick: [0, 6, 8, 11], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], ghost: [7, 15], open: [14] },
  train: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15], ghost: [], open: [] },
  calypso: { kick: [0, 6, 8, 14], snare: [4, 12], hat: [2, 6, 10, 14], ghost: [3, 11], open: [], tick: [0, 2, 4, 6, 8, 10, 12, 14] },
  march: { kick: [0, 4, 8, 12], snare: [4, 12, 14], hat: [0, 4, 8, 12], ghost: [2, 10], open: [] },
  sleigh: { kick: [0, 8, 10], snare: [4, 12], hat: [0, 4, 8, 12], ghost: [], open: [6, 14], tick: [0, 2, 4, 6, 8, 10, 12, 14] },
  shuffle: { kick: [0, 7, 8], snare: [4, 12], hat: [0, 3, 4, 7, 8, 11, 12, 15], ghost: [15], open: [] },
  creep: { kick: [0, 10], snare: [8], hat: [4, 12], ghost: [], open: [] },
  disco: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], ghost: [], open: [2, 6, 10, 14] },
  easy: { kick: [0, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], ghost: [], open: [], tick: [2, 6, 10, 14] },
};
// name: seed, beats a minute, the key's lowest note (MIDI), scale, lead and second instruments, bass line and sound,
// drum pattern, what plays the chord stabs (or none), how busy the tune is (0 to 1), and how much the sixteenths swing.
const SONGS = {
  menu: { seed: 11, bpm: 104, root: 57, scale: 'major', lead: 'pulse', second: 'steel', bass: 'sync', bassSound: 'round', drums: 'easy', stabs: 'pad', busy: 0.35, swing: 0.1 },
  results: { seed: 7, bpm: 122, root: 60, scale: 'major', lead: 'brass', second: 'square', bass: 'boom', bassSound: 'round', drums: 'march', stabs: 'brass', busy: 0.5, swing: 0 },
  race0: { seed: 101, bpm: 152, root: 60, scale: 'major', lead: 'square', second: 'pulse', bass: 'funk', bassSound: 'slap', drums: 'funk', stabs: 'brass', busy: 0.6, swing: 0.08 },
  race1: { seed: 102, bpm: 148, root: 55, scale: 'major', lead: 'banjo', second: 'fiddle', bass: 'boom', bassSound: 'round', drums: 'train', stabs: null, busy: 0.85, swing: 0 },
  race2: { seed: 103, bpm: 138, root: 62, scale: 'major', lead: 'steel', second: 'steel', bass: 'sync', bassSound: 'round', drums: 'calypso', stabs: 'pad', busy: 0.6, swing: 0.06 },
  race3: { seed: 104, bpm: 146, root: 57, scale: 'phrygian', lead: 'reed', second: 'reed', bass: 'drive', bassSound: 'slap', drums: 'march', stabs: 'brass', busy: 0.55, swing: 0 },
  race4: { seed: 105, bpm: 150, root: 64, scale: 'major', lead: 'bell', second: 'pulse', bass: 'boom', bassSound: 'round', drums: 'sleigh', stabs: 'pad', busy: 0.55, swing: 0 },
  race5: { seed: 106, bpm: 140, root: 53, scale: 'dorian', lead: 'square', second: 'brass', bass: 'walk', bassSound: 'round', drums: 'shuffle', stabs: 'brass', busy: 0.6, swing: 0.16 },
  race6: { seed: 107, bpm: 126, root: 50, scale: 'minor', lead: 'organ', second: 'bell', bass: 'slow', bassSound: 'round', drums: 'creep', stabs: 'pad', busy: 0.4, swing: 0 },
  race7: { seed: 108, bpm: 150, root: 60, scale: 'major', lead: 'pulse', second: 'bell', bass: 'funk', bassSound: 'slap', drums: 'disco', stabs: 'pad', busy: 0.65, swing: 0 },
};
const BAR = 16, INTRO = 2, SECTION = 8; // sixteenths in a bar; bars of intro; bars in a section

// Writes a song out. Returns its tempo and swing, how many steps of intro it has, and for every step the notes that
// start there: [voice, MIDI note or drum name, length in steps, loudness 0 to 1, layer].
// Layer 0 always plays; layer 1 is the extra that comes in for a player near the front.
export function compose(name) {
  const S = SONGS[name], rng = makeRng(S.seed), scale = SCALES[S.scale], dark = S.scale !== 'major';
  const deg = (d, oct = 0) => S.root + 12 * (oct + Math.floor(d / 7)) + scale[((d % 7) + 7) % 7];
  const prog = PROGS[dark ? 'dark' : 'bright'], A = rng.pick(prog.A), B = rng.pick(prog.B);
  // The whole song, a chord to a bar: the intro sits on the home chord and the one that leads back to it; then A, A, B, A.
  const form = ['A', 'A2', 'B', 'A3'], chords = [0, 4];
  for (const sec of form) chords.push(...(sec === 'B' ? B : A));
  const bars = chords.length, steps = Array.from({ length: bars * BAR }, () => []);
  const put = (bar, step, voice, note, len, vol, layer = 0) => { const at = bar * BAR + step; if (at < steps.length) steps[at].push([voice, note, len, vol, layer]); };

  // The tune. A two-bar idea is written once and then followed round the chords, as tunes do, with the last
  // two bars of each section changed to come to rest. B gets an idea of its own.
  const idea = () => {
    const out = [];
    let d = rng.pick([0, 2, 4]);
    for (let beat = 0; beat < 8; beat++) {
      // (Busier styles reach further down the list of rhythms, where the off-beat ones are.)
      const cell = beat === 0 ? CELLS[rng() < 0.5 ? 1 : 0] : CELLS[Math.min(CELLS.length - 1, Math.floor(rng() * rng() * (3 + S.busy * 7)))];
      cell.forEach((on, k) => {
        if (!on) return;
        const strong = k === 0 && beat % 2 === 0;
        d += strong ? rng.pick([-2, 0, 2]) : rng.pick([-2, -1, -1, 1, 1, 1, 2, rng() < 0.2 ? 4 : 1]);
        d = Math.max(-3, Math.min(8, d));
        if (strong) d = [0, 2, 4, 7][Math.max(0, Math.min(3, Math.round(d / 2.4)))]; // strong beats land on the chord
        out.push([beat * 4 + k, d]);
      });
    }
    return out;
  };
  // The same idea decorated: some notes arrive a sixteenth early (a push), and long gaps get a run of passing notes.
  const vary = (src, runs) => {
    const out = [];
    src.forEach(([at, d], i) => {
      const next = src[i + 1] ? src[i + 1][0] : 32, nd = src[i + 1] ? src[i + 1][1] : d;
      out.push([at > 0 && at % 4 === 0 && rng() < 0.3 ? at - 1 : at, d]);
      if (runs && next - at >= 4 && rng() < 0.6) { out.push([next - 2, nd + (nd >= d ? -2 : 2)]); out.push([next - 1, nd + (nd >= d ? -1 : 1)]); }
    });
    return out.filter(([at], i) => i === 0 || at > out[i - 1][0]);
  };
  const ideaA = idea(), ideaB = idea(), ideas = { A: ideaA, A2: vary(ideaA, false), A3: vary(ideaA, true), B: ideaB };
  // The tune sits in the octave or so above the middle of the keyboard, whatever the key: notes that would climb out of it are dropped an octave.
  const base = Math.round((67 - S.root) / 12), top = S.root + 12 * base + 17;
  const fit = (m, lift = 0) => { while (m > top + lift) m -= 12; return m; };
  const tune = (bar0, sec) => {
    const src = ideas[sec], lift = sec === 'B' ? 4 : 0, taken = new Set();
    for (let pair = 0; pair < SECTION / 2; pair++) {
      const last = pair === SECTION / 2 - 1;
      let notes = src.map(([at, d]) => [at, d]);
      if (pair === 2) notes = notes.map(([at, d], i) => [at, d + (i % 3 === 2 ? 1 : 0)]);  // third time, a little different
      if (last) { notes = notes.filter(([at]) => at < 20); notes.push([24, sec === 'B' ? 4 : 0]); } // and the last comes to rest
      notes.forEach(([at, d], i) => {
        const bar = bar0 + pair * 2 + Math.floor(at / BAR), ch = chords[bar], next = notes[i + 1] ? notes[i + 1][0] : 32;
        const len = Math.max(1, Math.min(last && at === 24 ? 7 : 6, next - at)), m = fit(deg(ch + d, base), lift);
        put(bar, at % BAR, 'lead', m, len, 0.9);
        for (let k = at; k < at + len; k++) taken.add(bar0 * BAR + pair * 2 * BAR + k);
        // The second voice shadows the tune a third below, once the song has got going.
        if (sec !== 'A') put(bar, at % BAR, 'second', fit(deg(ch + d - 2, base), lift), len, 0.55);
        // And near the front, a glitter of the same tune an octave up.
        put(bar, at % BAR, 'sparkle', m + 12, Math.min(len, 2), 0.35, 1);
      });
    }
    // Where the tune leaves the end of a bar empty, the second voice answers it with three quick notes up the chord.
    if (sec !== 'A') {
      for (let b2 = 0; b2 < SECTION; b2++) {
        const bar = bar0 + b2, free = [11, 12, 13, 14, 15].every((k) => !taken.has(bar * BAR + k));
        if (free) [[12, 2], [13, 4], [14, 7]].forEach(([k, d]) => put(bar, k, 'second', fit(deg(chords[bar] + d, base), lift), 1, 0.7));
      }
    }
  };

  for (let bar = 0; bar < bars; bar++) {
    const intro = bar < INTRO, sec = intro ? 'intro' : form[Math.floor((bar - INTRO) / SECTION)], inSec = intro ? bar : (bar - INTRO) % SECTION;
    const ch = chords[bar], nextCh = chords[bar + 1 < bars ? bar + 1 : INTRO], lastBar = !intro && inSec === SECTION - 1;
    // Bass: the style's line on this bar's chord, with a step up into the next one.
    for (const [at, n, len] of BASS[S.bass]) {
      const midi = n === 'a' ? deg(nextCh, -2) - (rng() < 0.5 ? 1 : 2) : deg(ch, -2) + (n === 7 ? 12 : n === 4 ? 7 : n === 2 ? scale[2] : 0);
      put(bar, at, 'bass', midi, len, at === 0 ? 1 : 0.75);
    }
    // Drums: the pattern, a crash where a section starts, and a roll round the toms to lead into the next.
    const D = DRUMS[S.drums];
    if (inSec === 0 && !intro) put(bar, 0, 'drum', 'crash', 1, 0.7);
    for (const k of D.kick) put(bar, k, 'drum', 'kick', 1, 1);
    for (const k of D.hat) if (!(lastBar && k >= 12)) put(bar, k, 'drum', 'hat', 1, k % 4 === 0 ? 0.8 : 0.5);
    for (const k of D.open) if (!(lastBar && k >= 12)) put(bar, k, 'drum', 'open', 1, 0.5);
    for (const k of D.snare) if (!(lastBar && k >= 12)) put(bar, k, 'drum', 'snare', 1, 1);
    for (const k of D.ghost) put(bar, k, 'drum', 'snare', 1, 0.3);
    for (const k of D.tick || []) put(bar, k, 'drum', 'tick', 1, 0.5);
    for (const k of [2, 6, 10, 14]) put(bar, k, 'drum', 'tick', 1, 0.45, 1);
    if (lastBar || bar === INTRO - 1) [12, 13, 14, 15].forEach((k, i) => put(bar, k, 'drum', 'tom' + i, 1, 0.9));
    if (intro) continue;
    // Chord stabs on the off-beats, from the second time round; in B they hold instead.
    if (S.stabs && sec !== 'A') {
      const notes = [deg(ch, 0), deg(ch + 2, 0), deg(ch + 4, 0), deg(ch + 6, 0)];
      if (sec === 'B') notes.forEach((m) => put(bar, 0, 'stab', m, 14, 0.5));
      else for (const k of S.stabs === 'pad' ? [0, 6, 10] : [2, 7, 10, 15]) notes.slice(0, 3).forEach((m) => put(bar, k, 'stab', m, S.stabs === 'pad' ? 3 : 1, 0.6));
    }
    // An arpeggio running under the last A, to lift it.
    if (sec === 'A3' || sec === 'B') for (let k = 0; k < BAR; k += sec === 'B' ? 4 : 2) put(bar, k, 'arp', deg(ch + [0, 2, 4, 2, 4, 6, 4, 2][(k / 2) % 8], 1), 1, 0.5);
  }
  for (let i = 0; i < form.length; i++) tune(INTRO + i * SECTION, form[i]);
  return { bpm: S.bpm, swing: S.swing, intro: INTRO * BAR, steps, style: S };
}

let song = null, name = null, step = 0, nextAt = 0, speed = 1, shift = 0, level = 0, timer = null, noise = null;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

// One note on one instrument. t: when (on the sound clock). dur: seconds. vol: 0 to 1.
function play(sound, midi, t, dur, vol) {
  const c = audioCtx(), g = c.createGain(), f = hz(midi + shift);
  g.connect(musicOut());
  const osc = (type, freq, to = g) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); o.connect(to); o.start(t); o.stop(t + dur + 0.05); return o; };
  const held = (v, attack = 0.008) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + attack); g.gain.setValueAtTime(v, t + dur * 0.75); g.gain.linearRampToValueAtTime(0.0001, t + dur); };
  const plucked = (v, len) => { g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + len); };
  // A waver in pitch that comes in on notes held long enough to notice.
  const vibrato = (o, depth = 0.007) => { if (dur < 0.25) return; const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * depth, t + 0.2); l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); };
  const filtered = (type, freq, q = 1) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.setValueAtTime(freq, t); b.Q.value = q; b.connect(g); return b; };
  switch (sound) {
    case 'square': vibrato(osc('square', f)); held(vol * 0.05); break;
    case 'pulse': { vibrato(osc('square', f * 1.004)); osc('square', f * 0.996); held(vol * 0.032); break; }
    case 'reed': { const lp = filtered('lowpass', 1800, 4); vibrato(osc('sawtooth', f, lp), 0.012); held(vol * 0.07, 0.02); break; }
    case 'fiddle': { const lp = filtered('lowpass', 2600, 2); vibrato(osc('sawtooth', f, lp), 0.014); held(vol * 0.055, 0.03); break; }
    case 'brass': { const lp = filtered('lowpass', 500, 2); lp.frequency.exponentialRampToValueAtTime(2600, t + 0.05); osc('sawtooth', f, lp); osc('sawtooth', f * 1.006, lp); held(vol * 0.05, 0.015); break; }
    case 'banjo': { const bp = filtered('bandpass', f * 3, 1.5); osc('sawtooth', f, bp); plucked(vol * 0.22, 0.16); break; }
    // A steel drum: a struck note with an octave and a twelfth ringing over it.
    case 'steel': { osc('sine', f); const o2 = c.createGain(); o2.gain.value = 0.45; o2.connect(g); osc('sine', f * 2, o2); const o3 = c.createGain(); o3.gain.value = 0.2; o3.connect(g); osc('sine', f * 3.01, o3); plucked(vol * 0.13, Math.max(0.22, dur * 1.3)); break; }
    case 'bell': { osc('sine', f * 2); const o2 = c.createGain(); o2.gain.value = 0.3; o2.connect(g); osc('sine', f * 5.4, o2); plucked(vol * 0.1, Math.max(0.3, dur * 1.6)); break; }
    // An organ with a wobble in its volume, for the haunted track.
    case 'organ': { osc('sine', f); const o2 = c.createGain(); o2.gain.value = 0.5; o2.connect(g); osc('sine', f * 2, o2); const o3 = c.createGain(); o3.gain.value = 0.3; o3.connect(g); osc('square', f * 3, o3);
      held(vol * 0.06, 0.03); const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 6.5; lg.gain.value = vol * 0.02; l.connect(lg).connect(g.gain); l.start(t); l.stop(t + dur + 0.05); break; }
    case 'pad': { osc('triangle', f); osc('sine', f * 2.005); held(vol * 0.04, 0.04); break; }
    case 'slap': { const lp = filtered('lowpass', 2400, 3); lp.frequency.exponentialRampToValueAtTime(300, t + 0.12); osc('sawtooth', f, lp); plucked(vol * 0.2, Math.max(0.14, dur)); break; }
    case 'round': osc('triangle', f); held(vol * 0.13, 0.005); break;
    default:
  }
}

function drum(kind, t, vol) {
  const c = audioCtx(), g = c.createGain();
  g.connect(musicOut());
  if (kind === 'kick' || kind.startsWith('tom')) {
    // Toms are kicks that start higher; the four of a fill step down.
    const o = c.createOscillator(), top = kind === 'kick' ? 150 : 330 - 55 * +kind.slice(3), len = kind === 'kick' ? 0.13 : 0.16;
    o.frequency.setValueAtTime(top, t); o.frequency.exponentialRampToValueAtTime(top * 0.3, t + len);
    g.gain.setValueAtTime(vol * (kind === 'kick' ? 0.24 : 0.16), t); g.gain.exponentialRampToValueAtTime(0.001, t + len + 0.02);
    o.connect(g); o.start(t); o.stop(t + len + 0.03);
    return;
  }
  if (!noise) { noise = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = c.createBufferSource(), f = c.createBiquadFilter();
  const [type, freq, level2, len] = { snare: ['highpass', 1700, 0.1, 0.12], hat: ['highpass', 7500, 0.035, 0.035], open: ['highpass', 6500, 0.035, 0.2], tick: ['bandpass', 9500, 0.03, 0.03], crash: ['highpass', 4500, 0.07, 0.9] }[kind];
  s.buffer = noise; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol * level2, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  s.connect(f).connect(g); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
  if (kind === 'snare') { const o = c.createOscillator(), og = c.createGain(); o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.07); og.gain.setValueAtTime(vol * 0.07, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.09); o.connect(og).connect(musicOut()); o.start(t); o.stop(t + 0.1); }
}

// Notes are booked a fifth of a second ahead on the sound clock, so the tune keeps time even when the picture stutters.
function pump() {
  const c = audioCtx();
  if (!c || !song || c.state !== 'running') return;
  if (nextAt < c.currentTime) nextAt = c.currentTime + 0.05;
  while (nextAt < c.currentTime + 0.2) {
    const len = 60 / (song.bpm * speed) / 4, st = song.style, at = nextAt + (step % 2 ? song.swing * len : 0);
    for (const [voice, note, n, vol, layer] of song.steps[step]) {
      if (layer > level) continue;
      if (voice === 'drum') drum(note, at, vol);
      else play(voice === 'lead' ? st.lead : voice === 'second' ? st.second : voice === 'bass' ? st.bassSound : voice === 'stab' ? st.stabs : voice === 'sparkle' ? 'bell' : 'pulse', note, at, n * len * 0.95, vol * (voice === 'arp' ? 0.6 : 1));
    }
    step++;
    if (step >= song.steps.length) step = song.intro; // round again, without the intro
    nextAt += len;
  }
}

// Starts a song (or carries on, if it's the one already playing). Nothing sounds until the page has been clicked or a key pressed.
// again: start it from the top even if it's already the one playing (a new race on the same track).
export function playSong(n, again) {
  if (!SONGS[n]) n = 'race0';
  if (n === name && !again) return;
  name = n; song = compose(n); step = 0; nextAt = 0; speed = 1; shift = 0; level = 0;
  if (!timer) timer = setInterval(pump, 50);
}
export function songSpeed(k) { speed = k; }
export function songShift(semitones) { shift = semitones; }   // (the last lap is played a semitone up)
export function songLevel(l) { level = l; }                   // (1: the extra layer for a player near the front)
export const raceSong = (trackIdx) => 'race' + (trackIdx % 8);
