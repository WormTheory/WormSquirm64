// What a guest has in place of a race. It has the same shape as Race, so the rest of the game
// (models, HUD, sounds) can't tell the difference, but it decides nothing: it shows the host's
// snapshots a tenth of a second behind, sliding each worm between the two either side of that moment.
import { buildTrack } from '../sim/track.js';
import { gridSlot } from '../sim/race.js';
import { makeWorm, ACTIONS } from '../sim/worm.js';
import { makeItems, ENT_TYPES } from '../sim/items.js';
import { EVENT_KINDS } from '../sim/events.js';

const DELAY = 0.1, PER = 16; // seconds shown behind the host; numbers per worm in a snapshot
const STATES = ['countdown', 'racing', 'done'];
const FLAGS = ['stun', 'boost', 'star', 'shrunk', 'flat']; // (sent as on or off: a guest only needs to show them)
const r2 = (v) => Math.round(v * 100) / 100;

// Host side: a race as a snapshot message.
//   w: per worm: x, z, spasm count, action, taps, progress, lap, place, finish time (-1: still going),
//      what's wrong with it (a bit each for stunned, boosted, starred, shrunk, flat; 32 for eaten; 64 for baked to death; 128 for fallen into a pit;
//      256 a were-wolf-worm; 512 rearing up to change; 1024 bitten; 2048 wearing a plaster),
//      seconds of fall left, height it's being carried at, how baked, times hurt, items had, last item.
//   b: which item boxes are there (a 1 or 0 each).   e: things lying or flying about: kind, x, z.
//   ev: the random event: kind, seconds in, then the bird's x, z and height, or the feet's x, z and time each.
export function snapshot(race) {
  const w = [];
  for (const o of race.worms) {
    let flags = (o.out ? 32 : 0) | (o.dead ? 64 : 0) | (o.pit ? 128 : 0) | (o.wolf > 0 ? 256 : 0) | (o.howl > 0 ? 512 : 0) | (o.bit ? 1024 : 0) | (o.patch > 0 ? 2048 : 0);
    FLAGS.forEach((k, i) => { if (o[k] > 0) flags |= 1 << i; });
    w.push(r2(o.x), r2(o.z), o.count, Math.max(0, ACTIONS.indexOf(o.action)), o.taps, Math.round(o.prog * 10) / 10, o.lap, o.rank,
      o.finished ? r2(o.finishTime) : -1, flags, r2(o.fall), r2(o.lift), r2(o.heat), o.hurts, o.items, o.item);
  }
  const e = [], wx = race.weather, ev = [EVENT_KINDS.indexOf(wx.type), r2(wx.t)];
  for (const o of race.items.ents) e.push(ENT_TYPES.indexOf(o.type), r2(o.x), r2(o.z));
  if (wx.bird) ev.push(r2(wx.bird.x), r2(wx.bird.z), r2(wx.bird.h));
  else if (wx.stomp) for (const f of wx.stomp.steps) ev.push(r2(f.x), r2(f.z), r2(f.t));
  return { t: 's', c: Math.round(race.clock * 1000) / 1000, st: STATES.indexOf(race.state), w, b: race.items.boxes.map((b) => (b.t > 0 ? 0 : 1)).join(''), e, ev };
}

export class MirrorRace {
  constructor({ trackDef, racers }) {
    this.track = buildTrack(trackDef);
    this.laps = trackDef.laps;
    this.clock = -5; this.state = 'countdown'; this.events = [];
    this.worms = racers.map((r, i) => {
      const p = gridSlot(this.track, i), w = makeWorm(i, r.char, !!r.human, p.x, p.z);
      w.aim = w.look = Math.atan2(p.tx, p.tz);
      w.out = !!r.out;
      return w;
    });
    this.order = [...this.worms];
    this.items = makeItems(this.track);
    this.weather = { type: 'none', t: 0, bird: null, stomp: null };
    this.buf = []; this.rc = null; this.pend = {}; this.mine = new Set(); this.sentAt = 0; this.feet = 0;
  }

  get time() { return Math.max(0, this.clock); }

  // This browser's own players. Their presses are sent to the host; here they only make the worm shiver at once.
  setAim(i, yaw) { this.worms[i].look = yaw; this.mine.add(i); }
  press(i, action) {
    if (this.state === 'countdown') return;
    this.worms[i].taps++;
    (this.pend[i] || (this.pend[i] = [])).push(ACTIONS.indexOf(action));
  }
  // The controls message for the given worms, or null if there's nothing new and one went lately (30 a second at most).
  takeInputs(idxs, now) {
    const any = idxs.some((i) => this.pend[i] && this.pend[i].length);
    if (!any && now - this.sentAt < 33) return null;
    this.sentAt = now;
    const p = idxs.map((i) => [Math.round(this.worms[i].look * 1000) / 1000, this.pend[i] || []]);
    this.pend = {};
    return p;
  }

  onSnap(s) {
    if (!s || !Array.isArray(s.w) || s.w.length !== this.worms.length * PER || !Array.isArray(s.ev) || !Array.isArray(s.e)) return;
    this.buf.push(s);
    if (this.buf.length > 30) this.buf.shift();
  }

  step(dt) {
    const buf = this.buf, ev = this.events;
    if (!buf.length) return;
    // The moment being shown runs on its own clock, nudged towards a tenth of a second behind the newest snapshot.
    const target = buf[buf.length - 1].c - DELAY;
    if (this.rc === null || Math.abs(target - this.rc) > 0.5) this.rc = target;
    else this.rc += dt + (target - this.rc) * 0.05;
    let a = buf[0], b = buf[0];
    for (let i = 0; i < buf.length; i++) { if (buf[i].c <= this.rc) { a = buf[i]; b = buf[Math.min(i + 1, buf.length - 1)]; } }
    const f = b.c > a.c ? Math.max(0, Math.min(1, (this.rc - a.c) / (b.c - a.c))) : 0;
    const was = this.state;
    this.clock = this.rc; this.state = STATES[a.st] || 'racing';
    if (was === 'countdown' && this.state !== 'countdown') ev.push({ type: 'go' });
    let zapped = false;
    this.worms.forEach((w, i) => {
      const k = i * PER, A = a.w, B = b.w, fl = A[k + 9];
      w.x = A[k] + (B[k] - A[k]) * f; w.z = A[k + 1] + (B[k + 1] - A[k + 1]) * f;
      if (A[k + 2] > w.count) { w.count = A[k + 2]; w.action = ACTIONS[A[k + 3]]; ev.push({ type: 'spasm', idx: i, action: w.action }); }
      if (!this.mine.has(i)) w.taps = A[k + 4];
      w.prog = A[k + 5];
      if (A[k + 6] > w.lap) { w.lap = A[k + 6]; ev.push({ type: 'lap', idx: i, lap: w.lap }); }
      w.rank = A[k + 7];
      if (A[k + 8] >= 0 && !w.finished) { w.finished = true; w.finishTime = A[k + 8]; ev.push({ type: 'finish', idx: i }); }
      // The same noises and sights a host gets, worked out from what changed.
      if ((fl & 1) && !(w.stun > 0)) ev.push({ type: 'hit', idx: i });
      if ((fl & 8) && !(w.shrunk > 0)) zapped = true;
      if ((fl & 16) && !(w.flat > 0)) ev.push({ type: 'squash', idx: i });
      FLAGS.forEach((name, bit) => { w[name] = fl & (1 << bit) ? 1 : 0; });
      if ((fl & 32) && !w.out) ev.push({ type: 'eaten', idx: i });
      w.out = !!(fl & 32);
      if (A[k + 10] > 0 && !(w.fall > 0)) ev.push({ type: fl & 64 ? 'die' : fl & 1024 ? 'bitten' : 'fall', idx: i });
      if ((fl & 512) && !(w.howl > 0)) ev.push({ type: fl & 256 ? 'unwolf' : 'howl', idx: i });
      w.wolf = fl & 256 ? 1 : 0; w.howl = fl & 512 ? 1 : 0; w.bit = !!(fl & 1024); w.patch = fl & 2048 ? 1 : 0;
      if (!(A[k + 10] > 0) && w.fall > 0) ev.push({ type: 'respawn', idx: i, revived: w.dead });
      w.fall = A[k + 10]; w.dead = !!(fl & 64); w.pit = !!(fl & 128);
      if (A[k + 11] > 0 && !(w.lift > 0)) ev.push({ type: 'grab', idx: i });
      w.lift = A[k + 11] + (B[k + 11] > 0 ? (B[k + 11] - A[k + 11]) * f : 0);
      w.heat = A[k + 12];
      if (A[k + 13] > w.hurts) ev.push({ type: 'hurt', idx: i });
      w.hurts = A[k + 13];
      if (A[k + 14] > w.items) ev.push({ type: 'item', idx: i, item: A[k + 15] });
      w.items = A[k + 14]; w.item = A[k + 15];
    });
    if (zapped) ev.push({ type: 'zap' });
    this.order = [...this.worms].sort((x, y) => x.rank - y.rank);
    // Items and the random event.
    this.items.boxes.forEach((box, i) => { box.t = a.b && a.b[i] === '0' ? 1 : 0; });
    const ents = [];
    for (let i = 0; i + 2 < a.e.length; i += 3) ents.push({ type: ENT_TYPES[a.e[i]], x: a.e[i + 1], z: a.e[i + 2] });
    this.items.ents = ents;
    const wx = this.weather, kind = EVENT_KINDS[a.ev[0]] || 'none', E = a.ev;
    if (kind !== wx.type) { ev.push({ type: 'event', kind }); this.feet = 0; }
    wx.type = kind; wx.t = E[1] + (this.rc - a.c);
    wx.bird = kind === 'bird' && E.length >= 5 ? { x: E[2], z: E[3], h: E[4] } : null;
    if (wx.bird && b.ev[0] === a.ev[0] && b.ev.length >= 5) { wx.bird.x += (b.ev[2] - E[2]) * f; wx.bird.z += (b.ev[3] - E[3]) * f; wx.bird.h += (b.ev[4] - E[4]) * f; }
    wx.stomp = null;
    if (kind === 'stomp' && E.length >= 5) {
      const steps = [];
      for (let i = 2; i + 2 < E.length; i += 3) steps.push({ x: E[i], z: E[i + 1], t: E[i + 2] });
      wx.stomp = { steps };
      const down = steps.filter((s) => s.t <= wx.t).length;
      for (let i = this.feet; i < down; i++) ev.push({ type: 'stomp', x: steps[i].x, z: steps[i].z });
      this.feet = Math.max(this.feet, down);
    }
    if (was !== 'done' && this.state === 'done') ev.push({ type: 'done' });
  }
}
