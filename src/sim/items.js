// Items. Rows of boxes sit across the road; a worm that touches one gets something, and since a worm
// can't be trusted to aim anything, it's used that instant. What you get leans on your place:
// the front of the pack gets things to leave behind, the back gets things that catch up.
import { locate, pointAt } from './track.js';

export const ITEMS = ['BOOST', 'PEEL', 'PEBBLE', 'HOMING', 'STAR', 'ZAP', 'MOLE', 'GLUE', 'SWAP', 'SPRING', 'BUBBLE', 'GIANT'];
export const ITEM_NAMES = ['WORMSHROOM', 'SQUIRMANA PEEL', 'PEBBLE', 'HOMING PEBBLE', 'SQUIRM STAR', 'LIGHTNING', 'MOLE', 'GLUE POT', 'SWITCHEROO', 'SPRING', 'BUBBLE', 'GIANT GRUB'];
export const ENT_TYPES = ['peel', 'pebble', 'homing', 'mole', 'glue'];
const SPRING = { secs: 0.9, dist: 13, high: 4.6 }, GLUE_R = 1.6;
const BOX_BACK = 4;       // seconds before a taken box comes back
export const STUN = { peel: 1.3, pebble: 1.3, homing: 1.5, mole: 2.2, star: 1.0 };

// Three rows of four boxes, spread round the lap.
export function makeItems(track) {
  const boxes = [];
  for (const f of [0.22, 0.52, 0.8]) for (const lat of [-4.5, -1.5, 1.5, 4.5]) {
    const p = pointAt(track, f * track.length, (lat * track.hw) / 7);
    boxes.push({ x: p.x, z: p.z, t: 0 });
  }
  return { boxes, ents: [] };
}

// A worm in a bubble is spared the next bad thing, and the bubble bursts. Returns whether that happened.
export function popped(race, w) {
  if (!(w.shield > 0)) return false;
  w.shield = 0;
  race.events.push({ type: 'pop', idx: w.idx });
  return true;
}

// Knocks a worm silly for a while. A worm with a star shrugs it off. Returns whether it landed.
export function stun(race, w, secs) {
  if (w.star > 0 || w.giant > 0 || w.out || w.fall > 0) return false;
  if (popped(race, w)) return false;
  w.stun = Math.max(w.stun, secs); w.spasm = null; w.queued = null;
  race.events.push({ type: 'hit', idx: w.idx });
  return true;
}

// How likely each item is, for a worm r of the way down the order (0: leading, 1: last).
function roll(rng, r) {
  const wts = [1 + 2 * r, 0.5 + 3 * (1 - r), 0.5 + 2.5 * (1 - r), 0.6 + 1.5 * r, 2.2 * r * r, 1.3 * r * r, r > 0.3 ? 1.4 * r : 0,
    0.4 + 2 * (1 - r), r > 0.15 ? 1.3 * r : 0, 0.7 + 1.1 * r, 0.9, 1.7 * r * r];
  let x = rng() * wts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < wts.length; i++) { x -= wts[i]; if (x <= 0) return i; }
  return 0;
}

function give(race, w) {
  const n = race.worms.length, rng = race.rng, ents = race.items.ents;
  let item = roll(rng, n > 1 ? w.rank / (n - 1) : 0.5);
  const leader = race.order && race.order.find((o) => !o.out && !o.finished);
  if (item === 6 && (!leader || leader === w)) item = 0; // nobody ahead to send a mole after
  // (Nor to change places with, if the worm in front can't be swapped just now.)
  const front = race.order && race.order[w.rank - 1], canSwap = front && !front.out && !front.finished && !(front.fall > 0) && !(front.lift > 0) && !(front.wolf > 0);
  if (item === 8 && !canSwap) item = 0;
  w.item = item; w.items++;
  race.events.push({ type: 'item', idx: w.idx, item });
  const here = locate(race.track, w.x, w.z, w.hint);
  if (item === 0) w.boost = 3;
  else if (item === 1) ents.push({ type: 'peel', x: w.x - here.tx * 1.6, z: w.z - here.tz * 1.6, vx: 0, vz: 0, owner: w.idx, grace: 1.2, life: 25 });
  else if (item === 2) ents.push({ type: 'pebble', x: w.x + here.tx, z: w.z + here.tz, vx: here.tx * 14, vz: here.tz * 14, owner: w.idx, grace: 0.6, life: 7, hint: w.hint });
  else if (item === 3) {
    const ahead = race.order && race.order[w.rank - 1];
    ents.push({ type: 'homing', x: w.x + here.tx, z: w.z + here.tz, vx: here.tx * 15, vz: here.tz * 15, owner: w.idx, grace: 0.6, life: 9, hint: w.hint,
      target: ahead && !ahead.out && !ahead.finished ? ahead.idx : -1 });
  } else if (item === 4) w.star = 6;
  else if (item === 5) {
    for (const o of race.worms) if (o !== w && !(o.star > 0) && !(o.giant > 0) && !o.out && !o.finished && !popped(race, o)) o.shrunk = 5;
    race.events.push({ type: 'zap' });
  } else if (item === 6) ents.push({ type: 'mole', x: w.x, z: w.z, vx: 0, vz: 0, owner: w.idx, grace: 0.5, life: 14, hint: w.hint, target: leader.idx });
  // A glue pot: a sticky puddle left behind that slows whoever wades through it, for as long as it lasts.
  else if (item === 7) ents.push({ type: 'glue', x: w.x - here.tx * 2.4, z: w.z - here.tz * 2.4, vx: 0, vz: 0, owner: w.idx, grace: 1.5, life: 18 });
  else if (item === 8) {
    // Switcheroo: it and the worm in front change places, lap and all.
    for (const k of ['x', 'z', 's', 'hint', 'prog', 'lap']) { const t = w[k]; w[k] = front[k]; front[k] = t; }
    w.spasm = null; front.spasm = null; w.star = Math.max(w.star, 0.4); front.star = Math.max(front.star, 0.4); // (a moment's sparkle on both)
    race.events.push({ type: 'swap', idx: w.idx, other: front.idx });
  } else if (item === 10) w.shield = 12;   // a bubble: spared the next bad thing
  else if (item === 11) w.giant = 5;       // giant grub: huge for a while, faster, and it flattens whoever it touches
  else {
    // A spring: one great bound up the road.
    w.spring = { t: 0, s0: here.s, lat: here.lat }; w.lift = 0.01; w.spasm = null;
  }
}

export function stepItems(race, dt) {
  const { boxes, ents } = race.items, tr = race.track;
  const live = race.worms.filter((w) => !w.out && !w.finished && !(w.fall > 0) && !(w.lift > 0));
  for (const b of boxes) {
    if (b.t > 0) { b.t -= dt; continue; }
    for (const w of live) if (!w.finished && (w.x - b.x) ** 2 + (w.z - b.z) ** 2 < 1.7) { b.t = BOX_BACK; give(race, w); break; }
  }
  for (const w of race.worms) {
    const sp = w.spring;
    if (!sp) continue;
    sp.t += dt;
    const u = Math.min(1, sp.t / SPRING.secs), p = pointAt(tr, sp.s0 + SPRING.dist * u, sp.lat * (1 - 0.6 * u));
    w.x = p.x; w.z = p.z; w.lift = u < 1 ? 0.01 + SPRING.high * Math.sin(Math.PI * u) : 0;
    if (u >= 1) w.spring = null;
  }
  for (let i = ents.length - 1; i >= 0; i--) {
    const e = ents[i];
    e.life -= dt; e.grace -= dt;
    let dead = e.life <= 0;
    if (e.type === 'glue') {
      for (const w of live) {
        if ((w.idx === e.owner && e.grace > 0) || w.star > 0 || w.giant > 0 || (w.x - e.x) ** 2 + (w.z - e.z) ** 2 > GLUE_R * GLUE_R) continue;
        if (!(w.slow > 0)) race.events.push({ type: 'glued', idx: w.idx });
        w.slow = 2.5;
      }
      if (dead) ents.splice(i, 1);
      continue;
    }
    if (e.type === 'pebble') {
      e.x += e.vx * dt; e.z += e.vz * dt;
      const loc = locate(tr, e.x, e.z, e.hint);
      e.hint = loc.i;
      if (Math.abs(loc.lat) > tr.hw) {
        if (tr.def.open) dead = dead || Math.abs(loc.lat) > tr.hw + 1; // no wall to bounce off: it sails away
        else {
          // Bounce: turn back the part of its speed that points at the wall.
          const rx = loc.tz, rz = -loc.tx, into = e.vx * rx + e.vz * rz;
          if (into * loc.lat > 0) { e.vx -= 2 * into * rx; e.vz -= 2 * into * rz; }
        }
      }
    } else if (e.type === 'homing' || e.type === 'mole') {
      // Runs along the middle of the road until its target is near, then goes straight at it.
      const t = race.worms[e.target], loc = locate(tr, e.x, e.z, e.hint), speed = e.type === 'mole' ? 20 : 15;
      e.hint = loc.i;
      let ax, az;
      if (t && !t.out && Math.hypot(t.x - e.x, t.z - e.z) < 9) { ax = t.x; az = t.z; } else { const p = pointAt(tr, loc.s + 5, 0); ax = p.x; az = p.z; }
      const d = Math.hypot(ax - e.x, az - e.z) || 1;
      e.x += ((ax - e.x) / d) * speed * dt; e.z += ((az - e.z) / d) * speed * dt;
      if (!t || t.out || t.finished) dead = true;
    }
    if (!dead) {
      for (const w of live) {
        if ((w.idx === e.owner && e.grace > 0) || (e.type === 'mole' && w.idx !== e.target)) continue;
        if ((w.x - e.x) ** 2 + (w.z - e.z) ** 2 < 1.1) { stun(race, w, STUN[e.type]); dead = true; break; }
      }
    }
    if (dead) ents.splice(i, 1);
  }
}
