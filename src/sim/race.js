// One race: the worms, the countdown, laps, places and when it's over.
import { makeRng } from './rng.js';
import { buildTrack, locate, pointAt } from './track.js';
import { makeWorm, pressAction, stepWorm, assistedAim } from './worm.js';
import { makeAi, stepAi } from './ai.js';
import { makeItems, stepItems, stun, STUN } from './items.js';
import { makeEvents, stepEvents, wash, drop } from './events.js';

const TIMERS = ['stun', 'boost', 'star', 'shrunk', 'flat'];

export const STEP = 1 / 60;
const COUNTDOWN = 5;       // seconds before GO (the track's name shows for the first of them)
const AFTER_WINNER = 30;   // the race is called this long after the first worm finishes

// Where the worm in grid place i starts.
export const gridSlot = (track, i) => pointAt(track, -3 - 2.2 * i, i % 2 ? -3 : 3);

export class Race {
  // racers: [{char, human, out}], in grid order (first is on pole). out: already taken by the bird in an earlier race.
  // events: whether random events happen, and eventFreq how often (1 to 10).
  constructor({ trackDef, seed = 1, racers, events = false, eventFreq = 5 }) {
    this.track = buildTrack(trackDef);
    this.laps = trackDef.laps;
    this.rng = makeRng(seed);
    this.clock = -COUNTDOWN;
    this.state = 'countdown';
    this.firstFinish = -1;
    this.events = [];
    this.worms = racers.map((r, i) => {
      const p = gridSlot(this.track, i);
      const w = makeWorm(i, r.char, !!r.human, p.x, p.z);
      w.aim = w.look = Math.atan2(p.tx, p.tz);
      const loc = locate(this.track, w.x, w.z, -1);
      w.hint = loc.i; w.s = loc.s; w.prog = -3 - 2.2 * i;
      w.ai = r.human ? null : makeAi(this.rng);
      w.out = !!r.out;
      return w;
    });
    this.order = [...this.worms];
    this.items = makeItems(this.track);
    this.weather = makeEvents(this, events, eventFreq);
  }

  get time() { return Math.max(0, this.clock); }

  // Hands a worm to the computer (its player went away).
  toAi(i) { const w = this.worms[i]; if (!w.ai) { w.human = false; w.ai = makeAi(this.rng); } }

  press(i, action) { if (this.state !== 'countdown') pressAction(this.worms[i], action); }
  // Where a player's camera is looking. The step turns this into where the worm aims.
  setAim(i, yaw) { this.worms[i].look = yaw; }

  step(dt = STEP) {
    this.clock += dt;
    if (this.state === 'countdown') {
      if (this.clock < 0) return;
      this.state = 'racing';
      this.events.push({ type: 'go' });
    }
    const tr = this.track, L = tr.length, n = this.worms.length, open = !!tr.def.open;
    stepEvents(this, dt);
    for (const w of this.worms) {
      for (const k of TIMERS) if (w[k] > 0) w[k] = Math.max(0, w[k] - dt);
      if (w.out) continue;
      if (w.finished && w.spot) {
        // A finished worm slides over to its dancing spot.
        const dx = w.spot.x - w.x, dz = w.spot.z - w.z, d = Math.hypot(dx, dz), go = Math.min(d, 7 * dt);
        if (d > 1e-3) { w.x += (dx / d) * go; w.z += (dz / d) * go; }
      }
      const here = locate(tr, w.x, w.z, w.hint);
      if (w.ai) stepAi(w.ai, w, here, dt, this.rng);
      // Looking generally the right way is as good as looking exactly the right way.
      w.aim = assistedAim(w.look, Math.atan2(here.tx, here.tz));
      const a = stepWorm(w, dt, this.rng, n > 1 ? w.rank / (n - 1) : 0.5);
      if (a) this.events.push({ type: 'spasm', idx: w.idx, action: a });
    }
    // Worms shove each other apart, and one with a star bowls the others over.
    const solid = (w) => !w.out && !w.finished && !(w.fall > 0) && !(w.lift > 0); // (a finished worm dances where it stopped, in nobody's way)
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = this.worms[i], b = this.worms[j];
      if (!solid(a) || !solid(b)) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < 1.1 && d > 1e-4) {
        const p = (1.1 - d) / 2 / d;
        a.x -= dx * p; a.z -= dz * p; b.x += dx * p; b.z += dz * p;
        if (a.star > 0 && !(b.stun > 0)) stun(this, b, STUN.star);
        if (b.star > 0 && !(a.stun > 0)) stun(this, a, STUN.star);
      }
    }
    for (const w of this.worms) {
      if (w.out || w.lift > 0) continue;
      if (w.fall > 0) {
        // Fallen off (or dead): gone for a moment, then back in the middle of the road where it left.
        w.fall -= dt;
        if (w.fall <= 0) {
          if (!w.dead) { const p = pointAt(tr, w.s, 0); w.x = p.x; w.z = p.z; } // (a baked worm is revived where it lies)
          this.events.push({ type: 'respawn', idx: w.idx, revived: w.dead });
          w.fall = 0; w.dead = false; w.stun = 0.4; w.heat = 0;
        }
        continue;
      }
      if (wash(this, w, dt)) {
        // Washed over the wall: it ends up on the ground just beyond it.
        if (!open) { const l = locate(tr, w.x, w.z, w.hint), p = pointAt(tr, l.s, Math.sign(l.lat) * (tr.hw + 2.8)); w.x = p.x; w.z = p.z; w.s = l.s; }
        drop(this, w, 'fall');
        continue;
      }
      let loc = locate(tr, w.x, w.z, w.hint);
      const lim = tr.hw + 0.4;
      if (Math.abs(loc.lat) > lim) {
        // A road with no walls can be fallen off. Otherwise the walls hold.
        if (open) { if (Math.abs(loc.lat) > lim + 0.5) { drop(this, w, 'fall'); continue; } } else {
          const over = loc.lat - Math.sign(loc.lat) * lim;
          w.x -= loc.tz * over; w.z += loc.tx * over;
          loc = locate(tr, w.x, w.z, loc.i);
        }
      }
      let ds = loc.s - w.s;
      if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
      w.s = loc.s; w.hint = loc.i;
      if (w.finished) continue;
      w.prog += ds;
      const lap = Math.max(1, Math.min(this.laps, Math.floor(w.prog / L) + 1));
      if (lap > w.lap) { w.lap = lap; this.events.push({ type: 'lap', idx: w.idx, lap }); }
      if (w.prog >= this.laps * L) {
        w.finished = true; w.finishTime = this.clock;
        // Each finisher gets a spot of its own to dance on, spread in rows across the road just past the line.
        const k = this.worms.filter((o) => o.finished).length - 1, row = Math.floor(k / 3), col = k % 3;
        w.spot = pointAt(tr, 4.5 + row * 5.2, [0, -1, 1][col] * 4.7 * (tr.hw / 7)); // (three across, the winner in the middle at the front)
        if (this.firstFinish < 0) this.firstFinish = this.clock;
        this.events.push({ type: 'finish', idx: w.idx });
      }
    }
    stepItems(this, dt);
    // The order: finishers by time, then the rest by how far they've got, then any the bird took.
    const cls = (w) => (w.finished ? 0 : w.out ? 2 : 1);
    const order = [...this.worms].sort((a, b) => cls(a) - cls(b) || (a.finished ? a.finishTime - b.finishTime : b.prog - a.prog));
    order.forEach((w, r) => { w.rank = r; });
    this.order = order;
    if (this.state === 'racing') {
      // Over when every player has finished (or been eaten) and somebody has won, when everyone left has finished,
      // or half a minute after the winner.
      const humans = this.worms.filter((w) => w.human), settled = (w) => w.finished || w.out;
      const humansDone = humans.length > 0 && humans.every(settled) && (this.firstFinish >= 0 || humans.some((w) => w.finished));
      if (humansDone || this.worms.every(settled) || (this.firstFinish >= 0 && this.clock > this.firstFinish + AFTER_WINNER)) {
        this.state = 'done';
        this.events.push({ type: 'done' });
      }
    }
  }
}
