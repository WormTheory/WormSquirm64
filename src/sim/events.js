// Random events: things that happen to a race, off and on, when they're switched on in the options.
//   rain    washes every worm about in a direction of its own, sometimes clean off the road.
//   heat    bakes the worms: each takes damage at its own random rate, slowing as it does, and some die and respawn.
//   bird    swoops down, takes one worm and flies off with it. That worm is out for good.
//   stomp   a pair of giant legs walks across the road; a worm under a foot is flattened for five to ten seconds.
//   moon    a blood moon rises. One worm rears up, turns into a were-wolf-worm and hunts the others, biting them,
//           until the curse lifts and it goes back to racing. The hand patches up its victims.
//   twister a tornado comes down the road the wrong way; a worm it catches is whirled up and put down somewhere else,
//           further on or further back.
//   quake   the ground shakes in fits, and each fit tips some of the worms over.
//   frost   the road ices up: every lunge keeps sliding afterwards.
//   hail    hailstones come down round the worms, each with a shadow to warn of it; one that lands on a worm stuns it.
//   dizzy   a mix-up: every worm goes the opposite way to where it's looking, until its owner catches on.
//   split   the hand comes down with a kitchen knife and cuts one worm in two. From then on there are two smaller ones.
//   check   the hand presents one worm with a check for $30.00.
//   brand   the hand brands one worm with a scarlet letter A.
//   monkey  a monkey grabs the leader, then every other worm one at a time, and once it has them all throws them
//           in the air. They come down scattered round it, some of them off the road.
import { locate, pointAt } from './track.js';
import { stun, popped } from './items.js';
import { makeAi } from './ai.js';

export const EVENT_KINDS = ['none', 'rain', 'heat', 'bird', 'stomp', 'moon', 'twister', 'quake', 'frost', 'hail', 'dizzy', 'split', 'check', 'brand', 'monkey'];
// The three things the hand does to one worm: seconds for the whole visit, and when in it the deed is done.
export const VISIT = { len: 4, at: 1.7 };
export const MAX_WORMS = 16;
const MONKEY = { speed: 17, reach: 1.6, cap: 24, toss: 1.4, scatter: 13, high: 8 };
export const HAIL = { fall: 1.1, every: 0.22, reach: 1.8, high: 20 }; // seconds a stone takes to land, seconds between stones, how near it must land, how high it starts
const TWIST = { len: 12, speed: 9, reach: 3, secs: 1.6, high: 6.5 };
const MOON = { len: 17, pick: 2.6, rear: 1.7, back: 1.3, speed: 10.5 }; // seconds: the whole event, before a worm is chosen, rearing up, turning back; and how fast the wolf runs
const GAP = [10, 20];          // quiet seconds between events
const WEATHER_FOR = [8, 12];   // how long rain or a heatwave lasts
const BIRD_IN = 2.6, BIRD_OUT = 3;   // seconds for the bird to come down, and to leave with its catch
const BIRD_HIGH = 34;
const STEP_EVERY = 0.75, FOOT_R = 5;

// freq: how often, 1 (rarely) to 10 (one after another); 5 is a gap of ten to twenty seconds.
// kinds: which events may happen (all of them if not given).
export function makeEvents(race, on, freq = 5, kinds = null) {
  const wait = 5 / Math.max(1, Math.min(10, freq));
  const may = ['rain', 'heat', 'stomp', 'moon', 'bird', 'twister', 'quake', 'frost', 'hail', 'dizzy', 'split', 'check', 'brand', 'monkey'].filter((k) => !kinds || kinds.includes(k)); // (each as likely as the next)
  return { on, wait, may, twister: null, monkey: null, visit: -1, type: 'none', t: 0, next: on && may.length ? race.rng.range(8, 14) * wait : Infinity, bird: null, stomp: null, wolf: -1 };
}

// (kind can be given, to start a particular event: the tests do.)
export function begin(race, ev, force) {
  const rng = race.rng, tr = race.track, live = race.worms.filter((w) => !w.out && !w.finished);
  let kind = force || rng.pick(ev.may);
  // (A wolf needs someone to hunt, and the bird always leaves someone to race: failing that, whatever else is allowed, or nothing.)
  if ((kind === 'moon' || kind === 'bird') && live.length < 2) {
    const other = ev.may.filter((k) => k !== 'moon' && k !== 'bird');
    if (!other.length) { ev.next = rng.range(GAP[0], GAP[1]) * ev.wait; return; }
    kind = rng.pick(other);
  }
  ev.type = kind; ev.t = 0;
  if (kind === 'moon') { ev.len = MOON.len; ev.wolf = -1; }
  else if (kind === 'twister') {
    // It starts a way ahead of the leader and comes back down the road to meet everyone.
    const lead = live.reduce((a, b) => (b.prog > a.prog ? b : a), live[0] || race.worms[0]);
    ev.twister = { s: lead.s + 30, x: 0, z: 0 }; ev.len = TWIST.len;
    const p = pointAt(tr, ev.twister.s, 0); ev.twister.x = p.x; ev.twister.z = p.z;
  } else if (kind === 'quake') { ev.len = rng.range(6, 8); ev.shake = 0.6; }
  else if (kind === 'frost') ev.len = rng.range(9, 12);
  else if (kind === 'hail') { ev.len = rng.range(8, 10); ev.hail = []; ev.nextStone = 0.4; }
  else if (kind === 'split' || kind === 'check' || kind === 'brand') {
    // The hand picks a worm that's free to be bothered (and, for the knife, one that's still in one piece).
    const able = live.filter((w) => !(w.fall > 0) && !(w.lift > 0) && (kind !== 'split' || (!w.half && race.worms.length < MAX_WORMS)) && !(kind === 'brand' && w.scarlet));
    if (!able.length) { ev.type = 'none'; ev.next = rng.range(2, 5); return; } // (nobody suitable: try something else shortly)
    ev.visit = rng.pick(able).idx; ev.done = false; ev.len = VISIT.len;
  } else if (kind === 'monkey') {
    if (live.length < 2) { ev.type = 'none'; ev.next = rng.range(2, 5); return; }
    const lead = live.reduce((a, b) => (b.prog > a.prog ? b : a), live[0]), p = pointAt(tr, lead.s + 14, 0);
    ev.monkey = { x: p.x, z: p.z, held: [], thrown: -1 }; ev.len = MONKEY.cap + MONKEY.toss + 1;
  } else if (kind === 'dizzy') { ev.len = rng.range(7, 9); for (const w of race.worms) w.wise = rng.range(1.2, 5); }
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
  // Worms the tornado has caught go on being whirled along even after it's gone.
  for (const w of race.worms) {
    const sp = w.spin;
    if (!sp) continue;
    sp.t += dt;
    const u = Math.min(1, sp.t / TWIST.secs), p = pointAt(race.track, sp.s0 + (sp.to - sp.s0) * u, 0);
    w.x = p.x; w.z = p.z; w.lift = u < 1 ? 0.01 + TWIST.high * Math.sin(Math.PI * u) : 0; w.stun = Math.max(w.stun, 0.3);
    if (u >= 1) { w.spin = null; w.stun = 0.5; }
  }
  // Baked worms recover once the sun's off them.
  if (ev.type !== 'heat') for (const w of race.worms) if (w.heat > 0) w.heat = Math.max(0, w.heat - 0.12 * dt);
  if (ev.type === 'none') {
    ev.next -= dt;
    if (ev.next <= 0) begin(race, ev);
    return;
  }
  ev.t += dt;
  const live = race.worms.filter((w) => !w.out && !(w.fall > 0) && !(w.lift > 0));
  if (ev.type === 'twister') {
    const tw = ev.twister, tr = race.track;
    tw.s -= TWIST.speed * dt;
    // It leans across the road towards whichever worm it's about to reach.
    let want = Math.sin(ev.t * 1.3) * tr.hw * 0.6, near = 16;
    for (const w of live) {
      let d = tw.s - w.s; d -= Math.round(d / tr.length) * tr.length;
      if (d > 0 && d < near && !(w.safe > 0)) { near = d; want = locate(tr, w.x, w.z, w.hint).lat; }
    }
    tw.lat = (tw.lat || 0) + Math.max(-7 * dt, Math.min(7 * dt, want - (tw.lat || 0)));
    const p = pointAt(tr, tw.s, tw.lat);
    tw.x = p.x; tw.z = p.z;
    for (const w of live) {
      if (w.finished || w.star > 0 || w.safe > 0 || (w.x - tw.x) ** 2 + (w.z - tw.z) ** 2 > TWIST.reach * TWIST.reach) continue;
      w.spin = { t: 0, s0: w.s, to: w.s + rng.range(-14, 22) }; w.lift = 0.01; w.spasm = null; w.queued = null; w.safe = 4;
      race.events.push({ type: 'twirl', idx: w.idx });
    }
  } else if (ev.type === 'quake') {
    // A fit of shaking every second or so; each one tips over some of the worms.
    ev.shake -= dt;
    if (ev.shake <= 0) {
      ev.shake = rng.range(0.9, 1.6);
      race.events.push({ type: 'tremor' });
      for (const w of live) if (!w.finished && !(w.star > 0) && rng() < 0.4) { w.stun = Math.max(w.stun, rng.range(0.8, 1.6)); w.spasm = null; race.events.push({ type: 'hit', idx: w.idx }); }
    }
  } else if (ev.type === 'split' || ev.type === 'check' || ev.type === 'brand') {
    const w = race.worms[ev.visit];
    if (w && !w.out && !ev.done) {
      if (ev.t < VISIT.at) { w.hold = 0.2; w.spasm = null; } // it's kept still until the deed is done
      else {
        ev.done = true;
        if (ev.type === 'check') { w.money += 30; race.events.push({ type: 'paid', idx: w.idx }); }
        else if (ev.type === 'brand') { w.scarlet = true; w.hurts++; race.events.push({ type: 'branded', idx: w.idx }); }
        else {
          // Cut in two: the worm becomes the front half, and a new worm, a copy of it in every way that matters, the back.
          const l = locate(race.track, w.x, w.z, w.hint), t = { ...w, idx: race.worms.length, tired: {}, spasm: null, queued: null, ai: w.ai ? makeAi(rng) : null, wash: null, spring: null, spin: null, slide: null, second: true };
          w.half = t.half = true; w.twin = t.idx; t.twin = w.idx;
          w.x += l.tx * 0.9; w.z += l.tz * 0.9; t.x -= l.tx * 1.1; t.z -= l.tz * 1.1;
          w.stun = t.stun = 0.9; w.hurts++; t.hurts++;
          race.worms.push(t);
          race.events.push({ type: 'cut', idx: w.idx, twin: t.idx });
        }
      }
    }
  } else if (ev.type === 'monkey') {
    const mk = ev.monkey, tr = race.track;
    if (mk.thrown < 0) {
      // Gathering. The leader first, then whoever's nearest, until there's nobody left on the road to take.
      const free = live.filter((w) => !w.finished && !mk.held.includes(w.idx));
      let prey = null, best = Infinity;
      if (!mk.held.length) prey = free.reduce((a, b) => (!a || b.prog > a.prog ? b : a), null);
      else for (const o of free) { const d = (o.x - mk.x) ** 2 + (o.z - mk.z) ** 2; if (d < best) { best = d; prey = o; } }
      const waiting = race.worms.some((w) => !w.out && !w.finished && w.fall > 0 && !mk.held.includes(w.idx));
      if (prey) {
        const d = Math.hypot(prey.x - mk.x, prey.z - mk.z) || 1, go = Math.min(d, MONKEY.speed * dt);
        mk.x += ((prey.x - mk.x) / d) * go; mk.z += ((prey.z - mk.z) / d) * go;
        if (d < MONKEY.reach) { mk.held.push(prey.idx); prey.spasm = null; prey.queued = null; prey.star = 0; race.events.push({ type: 'monkeygrab', idx: prey.idx }); }
      }
      if ((!prey && !waiting && mk.held.length) || ev.t > MONKEY.cap) {
        // It has them all: up they go, each to come down somewhere round about.
        mk.thrown = ev.t; ev.len = ev.t + MONKEY.toss + 1;
        for (const i of mk.held) { const a = rng.range(0, Math.PI * 2), r = MONKEY.scatter * Math.sqrt(rng()); race.worms[i].toss = { x0: mk.x, z0: mk.z, x1: mk.x + Math.cos(a) * r, z1: mk.z + Math.sin(a) * r }; }
        race.events.push({ type: 'monkeythrow' });
      }
      // Those it holds ride along in a heap over its head.
      mk.held.forEach((i, k) => { const w = race.worms[i]; w.x = mk.x; w.z = mk.z; w.lift = 2.6 + k * 0.5; });
    } else {
      const u = Math.min(1, (ev.t - mk.thrown) / MONKEY.toss);
      for (const i of mk.held) {
        const w = race.worms[i], ts = w.toss;
        if (!ts) continue;
        w.x = ts.x0 + (ts.x1 - ts.x0) * u; w.z = ts.z0 + (ts.z1 - ts.z0) * u; w.lift = u < 1 ? 0.01 + 2.6 * (1 - u) + MONKEY.high * Math.sin(Math.PI * u) : 0;
        if (u < 1) continue;
        // Down. On the road it's only dazed; off it, it has to be fetched back (or, with no walls, it's gone over the edge).
        w.toss = null;
        const l = locate(tr, w.x, w.z, -1);
        w.hint = l.i;
        if (Math.abs(l.lat) > tr.hw + 0.4) { w.s = l.s; drop(race, w, 'fall'); } else w.stun = 0.7;
      }
    }
  } else if (ev.type === 'hail') {
    // A stone every so often, aimed near one of the worms. It lands a moment later, and stuns any worm it lands on.
    ev.nextStone -= dt;
    if (ev.nextStone <= 0 && live.length && ev.t < ev.len - HAIL.fall) {
      ev.nextStone = HAIL.every;
      const w = rng.pick(live), a = rng.range(0, Math.PI * 2), d = rng.range(0, 4.5);
      ev.hail.push({ x: w.x + Math.cos(a) * d, z: w.z + Math.sin(a) * d, t: ev.t + HAIL.fall });
    }
    for (const h of ev.hail) {
      if (h.done || ev.t < h.t) continue;
      h.done = true;
      race.events.push({ type: 'hailhit', x: h.x, z: h.z });
      for (const w of live) if (!w.finished && (w.x - h.x) ** 2 + (w.z - h.z) ** 2 < HAIL.reach * HAIL.reach) stun(race, w, 1.2);
    }
    ev.hail = ev.hail.filter((h) => ev.t < h.t + 0.25);
  } else if (ev.type === 'frost') {
    // On ice, a lunge that has just ended carries on as a slide.
    for (const w of live) {
      if (w.wasSpasm && !w.spasm && !(w.stun > 0)) { const v = (w.wasSpasm.dist / w.wasSpasm.dur) * 0.5; w.slide = { x: w.wasSpasm.dx * v, z: w.wasSpasm.dz * v }; }
      w.wasSpasm = w.spasm;
      if (w.slide) { w.x += w.slide.x * dt; w.z += w.slide.z * dt; const k = Math.exp(-1.7 * dt); w.slide.x *= k; w.slide.z *= k; }
    }
  }
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
          if (prey.star > 0 || prey.giant > 0) { wolf.stun = 1; race.events.push({ type: 'hit', idx: wolf.idx }); } // a starred worm is too much for it
          else if (!popped(race, prey)) { prey.patch = 0; drop(race, prey, 'bitten'); }
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
    ev.type = 'none'; ev.bird = null; ev.stomp = null; ev.wolf = -1; ev.twister = null; ev.hail = null; ev.visit = -1;
    if (ev.monkey) { for (const i of ev.monkey.held) { const w = race.worms[i]; if (w.lift > 0 || w.toss) { w.lift = 0; w.toss = null; } } ev.monkey = null; }
    for (const w of race.worms) { w.slide = null; w.wasSpasm = null; }
    ev.next = ev.on ? rng.range(GAP[0], GAP[1]) * ev.wait : Infinity; // (an event started by hand with events off isn't followed by more)
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
