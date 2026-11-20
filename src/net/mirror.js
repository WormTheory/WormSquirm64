// What a guest has in place of a race. It has the same shape as Race, so the rest of the game
// (models, HUD, sounds) can't tell the difference, but it decides nothing: it shows the host's
// snapshots a tenth of a second behind, sliding each worm between the two either side of that moment.
import { buildTrack } from '../sim/track.js';
import { gridSlot } from '../sim/race.js';
import { makeWorm, ACTIONS } from '../sim/worm.js';

const DELAY = 0.1, PER = 9; // seconds shown behind the host; numbers per worm in a snapshot
const STATES = ['countdown', 'racing', 'done'];

// Host side: a race as a snapshot message. Per worm: x, z, spasm count, action, taps, progress, lap, place, finish time (-1: still going).
export function snapshot(race) {
  const w = [];
  for (const o of race.worms) {
    w.push(Math.round(o.x * 100) / 100, Math.round(o.z * 100) / 100, o.count, Math.max(0, ACTIONS.indexOf(o.action)), o.taps,
      Math.round(o.prog * 10) / 10, o.lap, o.rank, o.finished ? Math.round(o.finishTime * 100) / 100 : -1);
  }
  return { t: 's', c: Math.round(race.clock * 1000) / 1000, st: STATES.indexOf(race.state), w };
}

export class MirrorRace {
  constructor({ trackDef, racers }) {
    this.track = buildTrack(trackDef);
    this.laps = trackDef.laps;
    this.clock = -5; this.state = 'countdown'; this.events = [];
    this.worms = racers.map((r, i) => {
      const p = gridSlot(this.track, i), w = makeWorm(i, r.char, !!r.human, p.x, p.z);
      w.aim = w.look = Math.atan2(p.tx, p.tz);
      return w;
    });
    this.order = [...this.worms];
    this.buf = []; this.rc = null; this.pend = {}; this.mine = new Set(); this.sentAt = 0;
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
    if (!s || !Array.isArray(s.w) || s.w.length !== this.worms.length * PER) return;
    this.buf.push(s);
    if (this.buf.length > 30) this.buf.shift();
  }

  step(dt) {
    const buf = this.buf;
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
    if (was === 'countdown' && this.state !== 'countdown') this.events.push({ type: 'go' });
    this.worms.forEach((w, i) => {
      const k = i * PER, A = a.w, B = b.w;
      w.x = A[k] + (B[k] - A[k]) * f; w.z = A[k + 1] + (B[k + 1] - A[k + 1]) * f;
      if (A[k + 2] > w.count) { w.count = A[k + 2]; w.action = ACTIONS[A[k + 3]]; this.events.push({ type: 'spasm', idx: i, action: w.action }); }
      if (!this.mine.has(i)) w.taps = A[k + 4];
      w.prog = A[k + 5];
      if (A[k + 6] > w.lap) { w.lap = A[k + 6]; this.events.push({ type: 'lap', idx: i, lap: w.lap }); }
      w.rank = A[k + 7];
      if (A[k + 8] >= 0 && !w.finished) { w.finished = true; w.finishTime = A[k + 8]; this.events.push({ type: 'finish', idx: i }); }
    });
    this.order = [...this.worms].sort((x, y) => x.rank - y.rank);
    if (was !== 'done' && this.state === 'done') this.events.push({ type: 'done' });
  }
}
