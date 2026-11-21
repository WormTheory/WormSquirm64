// One race: the worms, the countdown, laps, places and when it's over.
import { makeRng } from './rng.js';
import { buildTrack, locate, pointAt } from './track.js';
import { makeWorm, pressAction, stepWorm, assistedAim } from './worm.js';
import { makeAi, stepAi } from './ai.js';
import { makeItems, stepItems, stun, popped, STUN } from './items.js';
import { makeEvents, stepEvents, wash, drop, CHAIN } from './events.js';

const TIMERS = ['stun', 'boost', 'star', 'shrunk', 'flat', 'howl', 'safe', 'slow', 'shield', 'giant', 'hold'];

export const STEP = 1 / 60;
const COUNTDOWN = 5;       // seconds before GO (the track's name shows for the first of them)
const AFTER_WINNER = 30;   // the race is called this long after the first worm finishes
const DRAW_AFTER = 7.5;    // and this long after the bird has eaten the last player

// Where the worm in grid place i starts.
export const gridSlot = (track, i) => pointAt(track, -3 - 2.2 * i, i % 2 ? -3 : 3);

export class Race {
  // racers: [{char, human, out}], in grid order (first is on pole). out: already taken by the bird in an earlier race.
  // events: whether random events happen, eventFreq how often (1 to 10), and eventKinds which ones (all if not given).
  constructor({ trackDef, seed = 1, racers, events = false, eventFreq = 5, eventKinds = null }) {
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
      w.out = !!r.out; w.cuts = r.cuts || (r.half ? 1 : 0); w.half = w.cuts > 0; w.pid = r.pid || ''; w.second = !!w.pid; w.money = r.money || 0; w.scarlet = !!r.scarlet; w.patch = +r.plaster || 0; w.chain = r.chain >= 0 ? r.chain : -1;
      return w;
    });
    // The pieces of a worm that's been cut up know which worm they came from.
    for (const w of this.worms) if (w.pid) { const o = this.worms.find((x) => x.char === w.char && !x.pid); if (o) { w.root = o.idx; w.twin = o.idx; if (o.twin < 0) o.twin = w.idx; } }
    this.order = [...this.worms];
    this.base = this.worms.length; // (how many started: a worm cut in two mid-race adds one)
    this.items = makeItems(this.track);
    this.weather = makeEvents(this, events, eventFreq, eventKinds);
  }

  get time() { return Math.max(0, this.clock); }

  // Hands a worm to the computer (its player went away).
  toAi(i) { for (const w of this.both(i)) if (!w.ai) { w.human = false; w.ai = makeAi(this.rng); } }
  // A worm and, if it's been cut up, all its other pieces: one player works the lot.
  both(i) { const root = this.worms[i].root; return this.worms.filter((w) => w.root === root); }

  press(i, action) { if (this.state !== 'countdown') for (const w of this.both(i)) pressAction(w, action); }
  // Where a player's camera is looking. The step turns this into where the worm aims.
  setAim(i, yaw) { for (const w of this.both(i)) w.look = yaw; }

  step(dt = STEP) {
    this.clock += dt;
    if (this.state === 'countdown') {
      if (this.clock < 0) return;
      this.state = 'racing';
      this.events.push({ type: 'go' });
    }
    const tr = this.track, L = tr.length, open = !!tr.def.open;
    stepEvents(this, dt);
    const n = this.worms.length; // (counted after the events, one of which can add a worm)
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
      // (In a mix-up everything's back to front: a worm goes the opposite way to where it looks. A computer worm
      // works that out after a few seconds; a player has to turn the camera round.)
      const mixed = this.weather.type === 'dizzy' && !(w.ai && this.weather.t >= (w.wise || 0));
      w.aim = assistedAim(w.look + (mixed ? Math.PI : 0), Math.atan2(here.tx, here.tz));
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
        // A giant flattens whatever it rolls into.
        for (const [big, small] of [[a, b], [b, a]]) {
          if (!(big.giant > 0) || small.giant > 0 || small.star > 0 || small.flat > 0 || popped(this, small)) continue;
          small.flat = 3; small.spasm = null;
          this.events.push({ type: 'squash', idx: small.idx });
        }
      }
    }
    // Chained worms can't get further apart than the chain is long: whichever pulls drags the other after it, half
    // and half. (One that's lying hurt, or fallen, is dead weight: the other can't shift it. And while either is in
    // the air there's no holding them; when it comes down the chain hauls them together again.)
    for (const a of this.worms) {
      const b = this.worms[a.chain];
      if (!b || b.idx < a.idx) continue;
      if (a.out || b.out) { a.chain = b.chain = -1; continue; } // (the bird took one: the chain's broken)
      if (a.finished || b.finished || a.lift > 0 || b.lift > 0 || (a.fall > 0 && b.fall > 0)) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), over = d - CHAIN.len;
      if (over <= 0) continue;
      const pull = (over > 2 ? Math.min(over, CHAIN.haul * dt) : over) / d, ka = a.fall > 0 ? 0 : b.fall > 0 ? 1 : 0.5;
      a.x += dx * pull * ka; a.z += dz * pull * ka; b.x -= dx * pull * (1 - ka); b.z -= dz * pull * (1 - ka);
    }
    for (const w of this.worms) {
      if (w.out || w.lift > 0) continue;
      if (w.fall > 0) {
        // Fallen off (or dead): gone for a moment, then back in the middle of the road where it left.
        w.fall -= dt;
        if (w.fall <= 0) {
          if (!w.dead && !w.bit) { const p = pointAt(tr, w.s, 0); w.x = p.x; w.z = p.z; } // (a baked or bitten worm is revived where it lies)
          this.events.push({ type: 'respawn', idx: w.idx, revived: w.dead });
          if (w.bit) w.patch = Math.min(7, w.patch + 1); // (one more plaster, worn from now on through the rest of a cup)
          w.bit = false;
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
          // On ice, a worm that slides into the wall at any speed either goes over it (about two times in five) or is stopped by it.
          const out = w.slide && this.weather.type === 'frost' ? (w.slide.x * loc.tz - w.slide.z * loc.tx) * Math.sign(loc.lat) : 0;
          if (out > 3) {
            w.slide = null;
            if (this.rng() < 0.4) {
              const p = pointAt(tr, loc.s, Math.sign(loc.lat) * (tr.hw + 2.8));
              w.x = p.x; w.z = p.z; w.s = loc.s;
              drop(this, w, 'fall');
              continue;
            }
          }
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
        w.spotAt = [4.5 + row * 5.2, [0, -1, 1][col] * 4.7 * (tr.hw / 7)]; // (three across, the winner in the middle at the front)
        // (A worm chained to one that's already dancing has to dance right beside it.)
        const mate = this.worms[w.chain];
        if (mate && mate.finished && mate.spotAt) w.spotAt = [mate.spotAt[0], mate.spotAt[1] + (mate.spotAt[1] > 0 ? -1.9 : 1.9)];
        w.spot = pointAt(tr, w.spotAt[0], w.spotAt[1]);
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
      // Over when every player has finished (or been eaten) and somebody has won, when everyone not eaten has finished,
      // or half a minute after the winner. And if the bird has eaten every player, it's a draw: the race ends a few
      // seconds later (long enough to watch the last of them fed to the chicks), whatever the computer's worms are doing.
      const humans = this.worms.filter((w) => w.human), settled = (w) => w.finished || w.out;
      const allEaten = humans.length > 0 && humans.every((w) => w.out);
      if (allEaten && this.eatenAt === undefined) this.eatenAt = this.clock;
      const humansDone = humans.length > 0 && humans.every(settled) && (this.firstFinish >= 0 || humans.some((w) => w.finished));
      if (allEaten ? this.clock > this.eatenAt + DRAW_AFTER : humansDone || this.worms.every(settled) || (this.firstFinish >= 0 && this.clock > this.firstFinish + AFTER_WINNER)) {
        this.state = 'done';
        this.events.push({ type: 'done' });
      }
    }
  }
}
