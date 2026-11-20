// Random events: things that happen to a race, off and on, when they're switched on in the options.
//   rain    washes every worm about in a direction of its own, sometimes clean off the road.
//   heat    bakes the worms: each takes damage at its own random rate, slowing as it does, and some die and respawn.
//   bird    swoops down, takes one worm and flies off with it. That worm is out for good.
//   stomp   a pair of giant legs walks across the road; a worm under a foot is flattened for five to ten seconds.
//   moon    a blood moon rises. One worm rears up, turns into a were-wolf-worm and hunts the others, biting them,
//           until the curse lifts and it goes back to racing. The hand patches up its victims.
import { locate, pointAt } from './track.js';

export const EVENT_KINDS = ['none', 'rain', 'heat', 'bird', 'stomp', 'moon'];
const MOON = { len: 17, pick: 2.6, rear: 1.7, back: 1.3, speed: 10.5 }; // seconds: the whole event, before a worm is chosen, rearing up, turning back; and how fast the wolf runs
const GAP = [10, 20];          // quiet seconds between events
const WEATHER_FOR = [8, 12];   // how long rain or a heatwave lasts
const BIRD_IN = 2.6, BIRD_OUT = 3;   // seconds for the bird to come down, and to leave with its catch
const BIRD_HIGH = 34;
const STEP_EVERY = 0.75, FOOT_R = 5;

// freq: how often, 1 (rarely) to 10 (one after another); 5 is a gap of ten to twenty seconds.
export function makeEvents(race, on, freq = 5) {
  const wait = 5 / Math.max(1, Math.min(10, freq));
  return { on, wait, type: 'none', t: 0, next: on ? race.rng.range(8, 14) * wait : Infinity, bird: null, stomp: null, wolf: -1 };
}

// (kind can be given, to start a particular event: the tests do.)
export function begin(race, ev, force) {
  const rng = race.rng, tr = race.track, live = race.worms.filter((w) => !w.out && !w.finished);
  let kind = force || rng.pick(['rain', 'heat', 'stomp', 'moon', 'rain', 'heat', 'stomp', 'moon', 'bird']); // (the bird is rarer: it's for keeps)
  if (kind === 'moon' && live.length < 2) kind = 'rain'; // (a wolf needs someone to hunt)
  if (kind === 'bird' && live.length < 2) kind = 'rain'; // (always leave someone to race)
  ev.type = kind; ev.t = 0;
  if (kind === 'moon') { ev.len = MOON.len; ev.wolf = -1; }
  else if (kind === 'rain' || kind === 'heat') {
    ev.len = rng.range(WEATHER_FOR[0], WEATHER_FOR[1]);
    for (const w of race.worms) { w.wash = null; w.bake = rng.range(0.15, 1.1); } // (bake: hurts a second, on average)
  } else if (kind === 'bird') {
    const prey = rng.pick(live), a = rng.range(0, Math.PI * 2);
    ev.bird = { target: prey.idx, x: prey.x + Math.cos(a) * 40, z: prey.z + Math.sin(a) * 40, h: BIRD_HIGH, got: false, ax: Math.cos(a), az: Math.sin(a) };
    ev.len = BIRD_IN + BIRD_OUT;
  } else {
    // The legs cross the road just ahead of one of the worms, one footfall after another from one side to the other.
    const near = live.length ? rng.pick(live) : race.worms[0], s0 = near.s + rng.range(0, 5), side = rng() < 0.5 ? -1 : 1;
    const steps = [], reach = tr.hw + 7;
    for (let lat = -reach, i = 0; lat <= reach; lat += 3.6, i++) {
      const p = pointAt(tr, s0 + rng.range(-2.5, 2.5) + (i % 2 ? 1.2 : -1.2), lat * side);
      steps.push({ x: p.x, z: p.z, t: 0.8 + i * STEP_EVERY });
    }
    ev.stomp = { steps, done: 0 };
    ev.len = steps[steps.length - 1].t + 1.5;
  }
  race.events.push({ type: 'event', kind });
}

// How long a worm is gone: one that fell drops out of sight (DROP_PART) and is then lowered back onto the road by a hand;
// one that baked lies where it died while a hand pours a jug of water over it.
export const FALL_TIME = 1.6, DEAD_TIME = 2.6, DROP_PART = 0.6;
// A worm that went over a wall hasn't fallen anywhere: it lies on its back on the far side (LIE_PART) until the hand
// picks it up and carries it back.
export const OUT_TIME = 2.4, LIE_PART = 0.9;
// A worm the wolf has bitten lies where it fell while the hand sticks a plaster on it (which takes PLASTER_PART) and pats it better.
export const BITE_TIME = 3, PLASTER_PART = 0.8, PAT_END = 2.4;
// Where a worm being carried back is, u of the way through the carry (0 to 1): from where it lay to the middle of the road,
// lifted up and over. Returns [x, z, height of its head].
export function carried(from, to, u) {
  const k = u * u * (3 - 2 * u);
  return [from.x + (to.x - from.x) * k, from.z + (to.z - from.z) * k, 0.5 + 2.9 * Math.min(1, u * 5) + 4.5 * Math.sin(Math.PI * u)];
}
// Sends a worm off the road, or kills it. Either way it's out of things for a moment, then back.
export function drop(race, w, why) {
  if (w.fall > 0 || w.out) return;
  w.dead = why === 'die'; w.bit = why === 'bitten';
  w.pit = !w.dead && !w.bit && !!race.track.def.open; // (only a road with no walls has anything to fall into)
  w.fall = w.dead ? DEAD_TIME : w.bit ? BITE_TIME : w.pit ? FALL_TIME : OUT_TIME; w.spasm = null; w.queued = null; w.stun = 0;
  race.events.push({ type: why, idx: w.idx });
}

export function stepEvents(race, dt) {
  const ev = race.weather, rng = race.rng;
  // Baked worms recover once the sun's off them.
  if (ev.type !== 'heat') for (const w of race.worms) if (w.heat > 0) w.heat = Math.max(0, w.heat - 0.12 * dt);
  if (ev.type === 'none') {
    ev.next -= dt;
    if (ev.next <= 0) begin(race, ev);
    return;
  }
  ev.t += dt;
  const live = race.worms.filter((w) => !w.out && !(w.fall > 0) && !(w.lift > 0));
  if (ev.type === 'rain') {
    for (const w of live) {
      if (!w.wash || (w.wash.t -= dt) <= 0) { const a = rng.range(0, Math.PI * 2), v = rng.range(1.5, 5); w.wash = { x: Math.cos(a) * v, z: Math.sin(a) * v, t: rng.range(0.8, 2) }; }
    }
  } else if (ev.type === 'heat') {
    for (const w of live) {
      if (w.star > 0 || w.finished || rng() >= w.bake * dt) continue;
      w.heat += rng.range(0.07, 0.2); w.hurts++;
      race.events.push({ type: 'hurt', idx: w.idx });
      if (w.heat >= 1) { w.heat = 0; drop(race, w, 'die'); }
    }
  } else if (ev.type === 'bird') {
    const b = ev.bird, prey = race.worms[b.target];
    if (!b.got) {
      // Down towards its prey, wherever the prey squirms to.
      const k = Math.min(1, ev.t / BIRD_IN), left = Math.max(0.05, BIRD_IN - ev.t);
      b.x += ((prey.x - b.x) / left) * dt; b.z += ((prey.z - b.z) / left) * dt;
      b.h = BIRD_HIGH * (1 - k) ** 2 + 1.2;
      if (k >= 1) { b.got = true; prey.spasm = null; prey.queued = null; race.events.push({ type: 'grab', idx: prey.idx }); }
    } else {
      const u = (ev.t - BIRD_IN) / BIRD_OUT;
      b.x += b.ax * 16 * dt * (0.3 + u); b.z += b.az * 16 * dt * (0.3 + u);
      b.h = 1.2 + BIRD_HIGH * u * u;
      prey.x = b.x; prey.z = b.z; prey.lift = Math.max(0.01, b.h - 1);
      if (u >= 1) { prey.out = true; prey.lift = 0; race.events.push({ type: 'eaten', idx: prey.idx }); }
    }
  } else if (ev.type === 'moon') {
    const wolf = race.worms[ev.wolf];
    if (!wolf) {
      // A moment for the moon to rise, and then it picks its worm.
      const able = live.filter((w) => !w.finished && !(w.flat > 0));
      if (ev.t >= MOON.pick && able.length) { const w = rng.pick(able); ev.wolf = w.idx; w.howl = MOON.rear; w.spasm = null; w.queued = null; race.events.push({ type: 'howl', idx: w.idx }); }
    } else if (ev.t >= ev.len - MOON.back) {
      // The curse lifts: it rears up once more and is itself again.
      if (wolf.wolf) { wolf.wolf = 0; wolf.howl = MOON.back; race.events.push({ type: 'unwolf', idx: wolf.idx }); }
    } else if (!(wolf.howl > 0) && !wolf.out && !wolf.finished) {
      wolf.wolf = 1;
      // It runs down the nearest worm it hasn't just bitten.
      let prey = null, best = Infinity;
      for (const o of live) {
        if (o === wolf || o.finished || o.safe > 0) continue;
        const d = (o.x - wolf.x) ** 2 + (o.z - wolf.z) ** 2;
        if (d < best) { best = d; prey = o; }
      }
      if (prey && !(wolf.stun > 0) && !(wolf.fall > 0)) {
        const d = Math.sqrt(best) || 1, go = Math.min(d, MOON.speed * dt);
        wolf.x += ((prey.x - wolf.x) / d) * go; wolf.z += ((prey.z - wolf.z) / d) * go;
        if (race.track.def.open) {
          // (On a road with no walls it keeps itself on the road.)
          const l = locate(race.track, wolf.x, wolf.z, wolf.hint), over = Math.abs(l.lat) - (race.track.hw - 0.6);
          if (over > 0) { wolf.x -= l.tz * over * Math.sign(l.lat); wolf.z += l.tx * over * Math.sign(l.lat); }
        }
        if (d < 1.5) {
          prey.safe = 7;
          if (prey.star > 0) { wolf.stun = 1; race.events.push({ type: 'hit', idx: wolf.idx }); } // a starred worm is too much for it
          else { prey.patch = 0; drop(race, prey, 'bitten'); }
        }
      }
    }
  } else if (ev.type === 'stomp') {
    const st = ev.stomp;
    while (st.done < st.steps.length && ev.t >= st.steps[st.done].t) {
      const f = st.steps[st.done++];
      race.events.push({ type: 'stomp', x: f.x, z: f.z });
      for (const w of live) {
        if ((w.x - f.x) ** 2 + (w.z - f.z) ** 2 > FOOT_R * FOOT_R) continue;
        w.flat = rng.range(5, 10); w.spasm = null; w.star = 0;
        race.events.push({ type: 'squash', idx: w.idx });
      }
    }
  }
  if (ev.t >= ev.len) {
    if (race.worms[ev.wolf]) race.worms[ev.wolf].wolf = 0;
    ev.type = 'none'; ev.bird = null; ev.stomp = null; ev.wolf = -1; ev.next = rng.range(GAP[0], GAP[1]) * ev.wait;
    for (const w of race.worms) w.wash = null;
    race.events.push({ type: 'event', kind: 'none' });
  }
}

// What rain does to a worm this step: carries it along, and a worm held against the wall by the water
// is, every so often, washed clean over it. Returns whether that happened.
export function wash(race, w, dt) {
  if (race.weather.type !== 'rain' || !w.wash) return false;
  w.x += w.wash.x * dt; w.z += w.wash.z * dt;
  const loc = locate(race.track, w.x, w.z, w.hint), out = (w.wash.x * loc.tz - w.wash.z * loc.tx) * Math.sign(loc.lat);
  return Math.abs(loc.lat) > race.track.hw + 0.3 && out > 1 && race.rng() < 0.9 * dt;
}
