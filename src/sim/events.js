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
import { makeWorm } from './worm.js';

export const EVENT_KINDS = ['none', 'rain', 'heat', 'bird', 'stomp', 'moon', 'twister', 'quake', 'frost', 'hail', 'dizzy', 'split', 'check', 'brand', 'monkey', 'chain', 'wormx', 'clone', 'long'];
// The three things the hand does to one worm: seconds for the whole visit, and when in it the deed is done.
export const VISIT = { len: 4, at: 1.7 };
export const MAX_WORMS = 16;
// (drop: seconds it takes to fall out of the sky at the start; flee: seconds it spends running off at the end.)
export const MONKEY = { speed: 17, reach: 1.6, cap: 24, toss: 1.4, scatter: 13, high: 8, drop: 0.9, flee: 2.2 };
// Worm X: the number its kind of worm has, and its entrance: run seconds to come from back behind the leader to ahead in front.
export const X_CHAR = 8, XIN = { run: 2.6, back: 24, ahead: 5, len: 3.4 };
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
  const may = ['rain', 'heat', 'stomp', 'moon', 'bird', 'twister', 'quake', 'frost', 'hail', 'dizzy', 'split', 'check', 'brand', 'monkey', 'chain', 'wormx', 'clone', 'long'].filter((k) => !kinds || kinds.includes(k)); // (each as likely as the next)
  return { on, wait, may, twister: null, monkey: null, chain: null, xin: null, clone: null, visit: -1, type: 'none', t: 0, next: on && may.length ? race.rng.range(8, 14) * wait : Infinity, bird: null, stomp: null, wolf: -1 };
}

// The worms the hand may call on for a visit (the knife will cut a piece of a worm again, into quarters and eighths, while there's room for more worms).
const visitable = (race, kind, live) => live.filter((w) => !(w.fall > 0) && !(w.lift > 0) && (kind !== 'split' || (w.cuts < 7 && race.worms.length < MAX_WORMS)) && !(kind === 'brand' && w.scarlet)
  && !(kind === 'long' && w.long >= LONG_MOST)
  // (A worm is cloned once, and its clone never.)
  && !(kind === 'clone' && (w.evil || race.worms.length >= MAX_WORMS || race.worms.some((o) => o.evil && o.char === w.char))));
// The events that are a hand calling on one worm.
export const VISITS = ['split', 'check', 'brand', 'clone', 'long'];
// The most times a worm can be lengthened. And the evil clone's tank: when it's lowered, when its fluid drains, when
// the clone breaks out, and when it's all over.
export const LONG_MOST = 4, CLONE = { down: [2, 3.2], drain: [3.2, 4.5], out: 4.6, len: 5.6 };

// An event is settled on a moment before it starts (OMEN seconds), along with the worm it's coming for, if it's
// that sort. Nothing shows yet; it's so that anyone just watching can be looking at the right worm when it happens.
export const OMEN = 1.4;
// The chain: how far apart it lets two worms get; how near they must be for the hand to chain them where they are
// (otherwise a hand each carries them to a spot between: grab for the hands to come down, carry for the whole trip);
// seconds from then until the chain goes on; and how fast a chain hauls in two worms that something has flung apart.
export const CHAIN = { len: 3.2, near: 4.5, grab: 0.45, carry: 2, at: 1.5, haul: 20 };
const chainable = (live) => live.filter((w) => !(w.fall > 0) && !(w.lift > 0) && w.chain < 0);
function foresee(race, ev) {
  const rng = race.rng, live = race.worms.filter((w) => !w.out && !w.finished), kind = rng.pick(ev.may);
  let idx = -1;
  if (VISITS.includes(kind)) { const able = visitable(race, kind, live); if (able.length) idx = rng.pick(able).idx; }
  else if ((kind === 'bird' || kind === 'moon') && live.length >= 2) idx = rng.pick(live).idx;
  else if (kind === 'chain') { const able = chainable(live); if (able.length >= 2) idx = rng.pick(able).idx; }
  ev.omen = { kind, idx };
  if (idx >= 0) race.events.push({ type: 'omen', idx });
}

// The worms an event has singled out: the one the hand is visiting, the bird's prey, the were-wolf-worm, the two being chained.
export function chosen(race) {
  const wx = race.weather;
  if (wx.visit >= 0) return [wx.visit];
  if (wx.type === 'bird' && wx.bird && wx.bird.target >= 0) return [wx.bird.target];
  if (wx.type === 'moon') { const w = race.worms.find((o) => o.wolf > 0 || o.howl > 0); return w ? [w.idx] : []; }
  if (wx.type === 'chain' && wx.chain) return [wx.chain.a, wx.chain.b];
  if (wx.type === 'wormx' && wx.xin) return [wx.xin.idx];
  return [];
}

// Worm X's entrance: he's run up the road past the leader, from well behind to just ahead, whatever the leader does.
function enterX(race, ev) {
  // (Whoever is leading at each moment, should the lead change hands while he's on his way.)
  const x = ev.xin, w = race.worms[x.idx], tr = race.track, L = tr.length;
  const lead = race.worms.filter((o) => o !== w && !o.out && !o.finished).reduce((a, b) => (!a || b.prog > a.prog ? b : a), null) || race.worms[x.lead];
  const u = Math.min(1, ev.t / XIN.run), e = u * u * (3 - 2 * u), off = -XIN.back + (XIN.back + XIN.ahead) * e;
  const p = pointAt(tr, lead.s + off, x.side * tr.hw * 0.5), l = locate(tr, p.x, p.z, -1);
  w.x = p.x; w.z = p.z; w.s = l.s; w.hint = l.i; w.prog = lead.prog + off;
  w.lap = Math.max(1, Math.min(race.laps, Math.floor(w.prog / L) + 1));
  w.look = w.aim = Math.atan2(l.tx, l.tz); w.hold = 0.2; w.spasm = null; w.queued = null; w.boost = 0.3;
}

// (kind can be given, to start a particular event, and the worm it's to pick on: the tests do.)
export function begin(race, ev, force, target) {
  const rng = race.rng, tr = race.track, live = race.worms.filter((w) => !w.out && !w.finished);
  // (What was foreseen happens, to the worm foreseen if it's still there to be had.)
  const omen = !force && ev.omen ? ev.omen : force && target !== undefined ? { kind: force, idx: target } : null, pick = (able) => (omen && able.find((w) => w.idx === omen.idx)) || rng.pick(able);
  ev.omen = null;
  let kind = force || (omen ? omen.kind : rng.pick(ev.may));
  // (A wolf needs someone to hunt, and the bird always leaves someone to race: failing that, whatever else is allowed, or nothing.)
  if ((kind === 'moon' || kind === 'bird') && live.length < 2) {
    const other = ev.may.filter((k) => k !== 'moon' && k !== 'bird');
    if (!other.length) { ev.next = rng.range(GAP[0], GAP[1]) * ev.wait; return; }
    kind = rng.pick(other);
  }
  ev.type = kind; ev.t = 0;
  if (kind === 'moon') { ev.len = MOON.len; ev.wolf = -1; ev.want = omen ? omen.idx : -1; }
  else if (kind === 'twister') {
    // It starts a way ahead of the leader and comes back down the road to meet everyone.
    const lead = live.reduce((a, b) => (b.prog > a.prog ? b : a), live[0] || race.worms[0]);
    ev.twister = { s: lead.s + 30, x: 0, z: 0 }; ev.len = TWIST.len;
    const p = pointAt(tr, ev.twister.s, 0); ev.twister.x = p.x; ev.twister.z = p.z;
  } else if (kind === 'quake') { ev.len = rng.range(6, 8); ev.shake = 0.6; }
  else if (kind === 'frost') ev.len = rng.range(9, 12);
  else if (kind === 'hail') { ev.len = rng.range(8, 10); ev.hail = []; ev.nextStone = 0.4; }
  else if (VISITS.includes(kind)) {
    // The hand picks a worm that's free to be bothered.
    const able = visitable(race, kind, live);
    if (!able.length) { ev.type = 'none'; ev.next = rng.range(2, 5); return; } // (nobody suitable: try something else shortly)
    ev.visit = pick(able).idx; ev.done = false; ev.len = VISIT.len;
    if (kind === 'clone') {
      // The tank comes down on the road a little way ahead of the worm it's copying, nearer the middle.
      const a = race.worms[ev.visit], l = locate(tr, a.x, a.z, a.hint), p = pointAt(tr, l.s + 3.5, l.lat > 0 ? l.lat - 2.6 : l.lat + 2.6);
      ev.clone = { x: p.x, z: p.z, made: false }; ev.len = CLONE.len;
    }
  } else if (kind === 'wormx') {
    // A stranger joins the race, once: he comes up from behind the leader and goes straight past.
    if (!live.length || race.worms.length >= MAX_WORMS || race.worms.some((w) => w.char === X_CHAR)) { ev.type = 'none'; ev.next = rng.range(2, 5); return; }
    const lead = live.reduce((a, b) => (b.prog > a.prog ? b : a)), w = makeWorm(race.worms.length, X_CHAR, false, lead.x, lead.z);
    w.ai = makeAi(rng); w.lap = lead.lap; w.rank = race.worms.length;
    race.worms.push(w);
    ev.xin = { idx: w.idx, lead: lead.idx, side: rng() < 0.5 ? -1 : 1 }; ev.len = XIN.len;
    enterX(race, ev);
    race.events.push({ type: 'newcomer', idx: w.idx });
  } else if (kind === 'chain') {
    // Two worms that aren't chained to anyone yet: one picked, and whoever's nearest it.
    const able = chainable(live);
    if (able.length < 2) { ev.type = 'none'; ev.next = rng.range(2, 5); return; }
    const a = pick(able), gap = (o) => (o.x - a.x) ** 2 + (o.z - a.z) ** 2, b = able.filter((o) => o !== a).reduce((m, o) => (gap(o) < gap(m) ? o : m));
    const far = Math.sqrt(gap(b)) > CHAIN.near, L = tr.length;
    ev.chain = { a: a.idx, b: b.idx, far, t0: far ? CHAIN.carry : 0, from: [[a.x, a.z], [b.x, b.z]], to: null };
    if (far) {
      // Too far apart: they're set down side by side at the point of the road half way between them.
      let ds = b.s - a.s;
      if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
      const pa = pointAt(tr, a.s + ds / 2 + 0.8, -0.9), pb = pointAt(tr, a.s + ds / 2 - 0.8, 0.9);
      ev.chain.to = [[pa.x, pa.z], [pb.x, pb.z]];
    }
    ev.done = false; ev.len = ev.chain.t0 + CHAIN.at + 1.3;
  } else if (kind === 'monkey') {
    if (live.length < 2) { ev.type = 'none'; ev.next = rng.range(2, 5); return; }
    const lead = live.reduce((a, b) => (b.prog > a.prog ? b : a), live[0]), p = pointAt(tr, lead.s + 14, 0);
    ev.monkey = { x: p.x, z: p.z, held: [], thrown: -1 }; ev.len = MONKEY.drop + MONKEY.cap + MONKEY.toss + MONKEY.flee;
  } else if (kind === 'dizzy') { ev.len = rng.range(7, 9); for (const w of race.worms) w.wise = rng.range(1.2, 5); }
  else if (kind === 'rain' || kind === 'heat') {
    ev.len = rng.range(WEATHER_FOR[0], WEATHER_FOR[1]);
    for (const w of race.worms) { w.wash = null; w.bake = rng.range(0.15, 1.1); } // (bake: hurts a second, on average)
  } else if (kind === 'bird') {
    // (It takes a chained worm's partner too, so it leaves a chained pair alone if they're all but the last.)
    const fair = live.filter((w) => w.chain < 0 || live.length > 2), prey = pick(fair.length ? fair : live), a = rng.range(0, Math.PI * 2);
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
// A worm the wolf has bitten lies where it fell, in its own blood, for BITE_LIE seconds; then the hand comes, sticks a
// plaster on it (which takes PLASTER_PART) and pats it better. (The hand's times count from when it sets out.)
export const BITE_LIE = 2, BITE_TIME = 5, PLASTER_PART = 0.8, PAT_END = 2.4;
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
    // (Once nobody's left racing, nothing more happens: the score screen is left in peace.)
    if (race.worms.every((w) => w.finished || w.out)) { ev.omen = null; return; }
    ev.next -= dt;
    if (ev.next <= OMEN && !ev.omen && ev.on && ev.may.length) foresee(race, ev);
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
  } else if (VISITS.includes(ev.type)) {
    const w = race.worms[ev.visit];
    if (ev.clone && !ev.clone.made && ev.t >= CLONE.out) {
      // The glass breaks and the evil clone is loose: the same worm, mutations and all, without the trimmings.
      ev.clone.made = true;
      if (w && race.worms.length < MAX_WORMS) {
        const tr = race.track, L = tr.length, e = makeWorm(race.worms.length, w.char, false, ev.clone.x, ev.clone.z), l = locate(tr, e.x, e.z, -1);
        let ds = l.s - w.s;
        if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
        e.ai = makeAi(rng); e.evil = true; e.pid = 'e'; e.second = true; e.long = w.long;
        e.s = l.s; e.hint = l.i; e.prog = w.prog + ds; e.lap = Math.max(1, Math.min(race.laps, Math.floor(e.prog / L) + 1));
        e.look = e.aim = Math.atan2(l.tx, l.tz); e.stun = 0.7; e.rank = race.worms.length;
        race.worms.push(e);
        race.events.push({ type: 'newcomer', idx: e.idx });
      }
    }
    if (w && !w.out && !ev.done) {
      if (ev.t < VISIT.at) { w.hold = 0.2; w.spasm = null; } // it's kept still until the deed is done
      else {
        ev.done = true;
        if (ev.type === 'check') { w.money += 30; race.events.push({ type: 'paid', idx: w.idx }); }
        else if (ev.type === 'brand') { w.scarlet = true; w.hurts++; race.events.push({ type: 'branded', idx: w.idx }); }
        else if (ev.type === 'long') { w.long++; w.hurts++; race.events.push({ type: 'jab', idx: w.idx }); }
        else if (ev.type === 'clone') { w.hurts++; race.events.push({ type: 'jab', idx: w.idx }); }
        else {
          // Cut in two: the worm becomes the front half, and a new worm, a copy of it in every way that matters, the back.
          // (The back is nobody's to drive, whoever had the worm: the computer takes it, and it races for itself.)
          // (Half a worm cut again makes two quarters, and so on down.)
          w.cuts++;
          const l = locate(race.track, w.x, w.z, w.hint), t = { ...w, idx: race.worms.length, tired: {}, spasm: null, queued: null, human: false, ai: makeAi(rng), wash: null, spring: null, spin: null, slide: null, second: true, pid: w.pid + String(w.cuts), from: w.idx, chain: -1 };
          // What it was wearing is shared out: the chain, the letter and the plasters, in that order, the front
          // piece taking the first half of them and the back piece the rest. The money it has at that moment is split evenly.
          {
            const mate = race.worms[w.chain], things = [...(mate ? ['chain'] : []), ...(w.scarlet ? ['letter'] : []), ...Array(w.patch).fill('plaster')];
            const back = things.slice(Math.ceil(things.length / 2));
            t.scarlet = back.includes('letter'); t.patch = back.filter((k) => k === 'plaster').length;
            if (t.scarlet) w.scarlet = false;
            w.patch -= t.patch;
            if (back.includes('chain')) { t.chain = mate.idx; mate.chain = t.idx; w.chain = -1; }
            t.money = w.money / 2; w.money = t.money; // (down the middle, to the cent)
          }
          w.half = t.half = true; w.twin = t.idx; t.twin = w.idx;
          w.x += l.tx * 0.9; w.z += l.tz * 0.9; t.x -= l.tx * 1.1; t.z -= l.tz * 1.1;
          w.stun = t.stun = 0.9; w.hurts++; t.hurts++;
          race.worms.push(t);
          race.events.push({ type: 'cut', idx: w.idx, twin: t.idx });
        }
      }
    }
  } else if (ev.type === 'wormx') {
    if (ev.t < XIN.run) enterX(race, ev);
  } else if (ev.type === 'chain') {
    const c = ev.chain, pair = [race.worms[c.a], race.worms[c.b]];
    if (pair.some((w) => !w || w.out)) ev.t = ev.len; // (one of them has gone: never mind)
    else if (!ev.done) {
      pair.forEach((w, k) => {
        w.hold = 0.2; w.spasm = null; w.queued = null; // they're kept still until the chain is on
        if (!c.far || ev.t >= c.t0) { if (c.far && w.lift > 0) { w.lift = 0; w.x = c.to[k][0]; w.z = c.to[k][1]; w.hint = locate(race.track, w.x, w.z, -1).i; } return; }
        // Carried: up, across and down again, in a hand.
        const u = Math.max(0, (ev.t - CHAIN.grab) / (c.t0 - CHAIN.grab)), e = u * u * (3 - 2 * u);
        w.x = c.from[k][0] + (c.to[k][0] - c.from[k][0]) * e; w.z = c.from[k][1] + (c.to[k][1] - c.from[k][1]) * e;
        w.lift = u > 0 ? 0.01 + 5 * Math.sin(Math.PI * u) : 0;
      });
      if (ev.t >= c.t0 + CHAIN.at) {
        ev.done = true;
        pair[0].chain = c.b; pair[1].chain = c.a;
        race.events.push({ type: 'chained', idx: c.a, other: c.b });
      }
    }
  } else if (ev.type === 'monkey') {
    const mk = ev.monkey, tr = race.track;
    if (ev.t < MONKEY.drop) {
      // (Still falling out of the sky.)
    } else if (mk.thrown < 0) {
      if (!mk.landed) { mk.landed = true; race.events.push({ type: 'stomp', x: mk.x, z: mk.z }); }
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
      if ((!prey && !waiting && mk.held.length) || ev.t > MONKEY.drop + MONKEY.cap) {
        // It has them all: up they go, each to come down somewhere round about.
        mk.thrown = ev.t; ev.len = ev.t + MONKEY.toss + MONKEY.flee;
        // (And which way it will run off afterwards: straight across the road and away over the fields.)
        { const l = locate(tr, mk.x, mk.z, -1), side = l.lat < 0 ? -1 : 1; mk.fx = l.tz * side; mk.fz = -l.tx * side; }
        for (const i of mk.held) { const a = rng.range(0, Math.PI * 2), r = MONKEY.scatter * Math.sqrt(rng()); race.worms[i].toss = { x0: mk.x, z0: mk.z, x1: mk.x + Math.cos(a) * r, z1: mk.z + Math.sin(a) * r }; }
        race.events.push({ type: 'monkeythrow' });
      }
      // Those it holds ride along in a heap over its head.
      mk.held.forEach((i, k) => { const w = race.worms[i]; w.x = mk.x; w.z = mk.z; w.lift = 2.6 + k * 0.5; });
    } else {
      const u = Math.min(1, (ev.t - mk.thrown) / MONKEY.toss);
      if (u >= 1) { mk.x += mk.fx * 30 * dt; mk.z += mk.fz * 30 * dt; } // its work done, it runs for it
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
      // A worm chained to its prey goes too, dangling underneath, and is fed to the chicks as well.
      const mate = race.worms[prey.chain] && !race.worms[prey.chain].out ? race.worms[prey.chain] : null;
      if (mate) { mate.x = b.x; mate.z = b.z; mate.lift = Math.max(0.01, b.h - 3.4); mate.spasm = null; mate.queued = null; mate.fall = 0; }
      if (u >= 1) {
        prey.out = true; prey.lift = 0; race.events.push({ type: 'eaten', idx: prey.idx });
        if (mate) { mate.out = true; mate.lift = 0; race.events.push({ type: 'eaten', idx: mate.idx }); }
      }
    }
  } else if (ev.type === 'moon') {
    const wolf = race.worms[ev.wolf];
    if (!wolf) {
      // A moment for the moon to rise, and then it picks its worm.
      const able = live.filter((w) => !w.finished && !(w.flat > 0));
      if (ev.t >= MOON.pick && able.length) { const w = able.find((o) => o.idx === ev.want) || rng.pick(able); ev.wolf = w.idx; w.howl = MOON.rear; w.spasm = null; w.queued = null; race.events.push({ type: 'howl', idx: w.idx }); }
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
          else if (!popped(race, prey)) drop(race, prey, 'bitten');
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
    ev.type = 'none'; ev.bird = null; ev.stomp = null; ev.wolf = -1; ev.twister = null; ev.hail = null; ev.visit = -1; ev.chain = null; ev.xin = null; ev.clone = null;
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
