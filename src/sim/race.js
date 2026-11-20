// One race: the worms, the countdown, laps, places and when it's over.
import { makeRng } from './rng.js';
import { buildTrack, locate, pointAt } from './track.js';
import { makeWorm, pressAction, stepWorm, assistedAim } from './worm.js';
import { makeAi, stepAi } from './ai.js';

export const STEP = 1 / 60;
const COUNTDOWN = 5;       // seconds before GO (the track's name shows for the first of them)
const AFTER_WINNER = 30;   // the race is called this long after the first worm finishes

export class Race {
  // racers: [{char, human}], in grid order (first is on pole).
  constructor({ trackDef, seed = 1, racers }) {
    this.track = buildTrack(trackDef);
    this.laps = trackDef.laps;
    this.rng = makeRng(seed);
    this.clock = -COUNTDOWN;
    this.state = 'countdown';
    this.firstFinish = -1;
    this.events = [];
    this.worms = racers.map((r, i) => {
      const p = pointAt(this.track, -3 - 2.2 * i, i % 2 ? -3 : 3);
      const w = makeWorm(i, r.char, !!r.human, p.x, p.z);
      w.aim = w.look = Math.atan2(p.tx, p.tz);
      const loc = locate(this.track, w.x, w.z, -1);
      w.hint = loc.i; w.s = loc.s; w.prog = -3 - 2.2 * i;
      w.ai = r.human ? null : makeAi(this.rng);
      return w;
    });
  }

  get time() { return Math.max(0, this.clock); }

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
    const tr = this.track, L = tr.length, n = this.worms.length;
    for (const w of this.worms) {
      const here = locate(tr, w.x, w.z, w.hint);
      if (w.ai) stepAi(w.ai, w, here, dt, this.rng);
      // Looking generally the right way is as good as looking exactly the right way.
      w.aim = assistedAim(w.look, Math.atan2(here.tx, here.tz));
      const a = stepWorm(w, dt, this.rng, n > 1 ? w.rank / (n - 1) : 0.5);
      if (a) this.events.push({ type: 'spasm', idx: w.idx, action: a });
    }
    // Worms shove each other apart.
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = this.worms[i], b = this.worms[j];
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < 1.1 && d > 1e-4) {
        const p = (1.1 - d) / 2 / d;
        a.x -= dx * p; a.z -= dz * p; b.x += dx * p; b.z += dz * p;
      }
    }
    for (const w of this.worms) {
      let loc = locate(tr, w.x, w.z, w.hint);
      // The walls: a worm can't leave the road.
      const lim = tr.hw + 0.4;
      if (Math.abs(loc.lat) > lim) {
        const over = loc.lat - Math.sign(loc.lat) * lim;
        w.x -= loc.tz * over; w.z += loc.tx * over;
        loc = locate(tr, w.x, w.z, loc.i);
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
        if (this.firstFinish < 0) this.firstFinish = this.clock;
        this.events.push({ type: 'finish', idx: w.idx });
      }
    }
    const order = [...this.worms].sort((a, b) =>
      a.finished !== b.finished ? (a.finished ? -1 : 1) : a.finished ? a.finishTime - b.finishTime : b.prog - a.prog);
    order.forEach((w, r) => { w.rank = r; });
    this.order = order;
    if (this.state === 'racing') {
      const humans = this.worms.filter((w) => w.human);
      const humansDone = humans.length > 0 && humans.every((w) => w.finished);
      if (humansDone || this.worms.every((w) => w.finished) || (this.firstFinish >= 0 && this.clock > this.firstFinish + AFTER_WINNER)) {
        this.state = 'done';
        this.events.push({ type: 'done' });
      }
    }
  }
}
