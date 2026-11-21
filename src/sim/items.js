// Items. Rows of boxes sit across the road; a worm that touches one gets something, and since a worm
// can't be trusted to aim anything, it's used that instant. What you get leans on your place:
// the front of the pack gets things to leave behind, the back gets things that catch up.
import { locate, pointAt } from './track.js';
import { airOf, GENE } from './genes.js';

export const ITEMS = ['BOOST', 'PEEL', 'PEBBLE', 'HOMING', 'STAR', 'ZAP', 'MOLE', 'GLUE', 'SWAP', 'SPRING', 'BUBBLE', 'GIANT',
  'COMPOST', 'SALT', 'HOOK', 'BROLLY', 'DECOY', 'MAGNET', 'HOSE', 'WHISTLE', 'SHOVEL', 'BUNCH', 'SAUCE', 'MIRROR', 'HICCUPS', 'COUPON', 'EGG'];
export const ITEM_NAMES = ['WORMSHROOM', 'SQUIRMANA PEEL', 'PEBBLE', 'HOMING PEBBLE', 'SQUIRM STAR', 'LIGHTNING', 'MOLE', 'GLUE POT', 'SWITCHEROO', 'SPRING', 'BUBBLE', 'GIANT GRUB',
  'COMPOST HEAP', 'SALT SHAKER', 'FISHING HOOK', 'LEAF UMBRELLA', 'DECOY WORM', 'MAGNET', 'GARDEN HOSE', 'WORM WHISTLE', 'SHOVEL', 'BANANA BUNCH', 'HOT SAUCE', 'MIRROR', 'HICCUPS', 'COUPON', 'MYSTERY EGG'];
export const ENT_TYPES = ['peel', 'pebble', 'homing', 'mole', 'glue', 'compost', 'salt', 'decoy'];
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
    0.4 + 2 * (1 - r), r > 0.15 ? 1.3 * r : 0, 0.7 + 1.1 * r, 0.9, 1.7 * r * r,
    // compost, salt, hook, umbrella, decoy, magnet, hose, whistle, shovel, bunch, hot sauce, mirror, hiccups, coupon, egg
    0.3 + 1.5 * (1 - r), 0.3 + 1.5 * (1 - r), r > 0.1 ? 1.2 * r : 0, 0.6, 0.3 + 1.4 * (1 - r), 1.1 * r, r > 0.2 ? 1.2 * r : 0, 1.2 * r * r, 0.5 + 0.8 * r,
    0.3 + 1.2 * (1 - r), 0.3 + 1.2 * r, 0.6, 1.3 * r * r, 0.5, 0.7];
  let x = rng() * wts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < wts.length; i++) { x -= wts[i]; if (x <= 0) return i; }
  return 0;
}

// (forced: the item it's to be, for the egg, the magnet and the tests.)
export function give(race, w, forced) {
  const n = race.worms.length, rng = race.rng, ents = race.items.ents;
  let item = forced !== undefined ? forced : roll(rng, n > 1 ? w.rank / (n - 1) : 0.5);
  const leader = race.order && race.order.find((o) => !o.out && !o.finished);
  if (item === 6 && (!leader || leader === w || (leader.mut[GENE.camo] && rng() < 0.5))) item = 0; // nobody ahead to send a mole after (or nobody it can see)
  // (Nor to change places with, if the worm in front can't be swapped just now.)
  const front = race.order && race.order[w.rank - 1], canSwap = front && !front.out && !front.finished && !(front.fall > 0) && !(front.lift > 0) && !(front.wolf > 0);
  if ((item === 8 || item === 14) && !canSwap) item = 0; // (nor to hook)
  w.item = item; w.items++;
  race.events.push({ type: 'item', idx: w.idx, item });
  const here = locate(race.track, w.x, w.z, w.hint);
  if (item === 0) w.boost = 3;
  else if (item === 1) ents.push({ type: 'peel', x: w.x - here.tx * 1.6, z: w.z - here.tz * 1.6, vx: 0, vz: 0, owner: w.idx, grace: 1.2, life: 25 });
  else if (item === 2) ents.push({ type: 'pebble', x: w.x + here.tx, z: w.z + here.tz, vx: here.tx * 14, vz: here.tz * 14, owner: w.idx, grace: 0.6, life: 7, hint: w.hint });
  else if (item === 3) {
    const ahead = race.order && race.order[w.rank - 1];
    ents.push({ type: 'homing', x: w.x + here.tx, z: w.z + here.tz, vx: here.tx * 15, vz: here.tz * 15, owner: w.idx, grace: 0.6, life: 9, hint: w.hint,
      target: ahead && !ahead.out && !ahead.finished && !(ahead.mut[GENE.camo] && rng() < 0.5) ? ahead.idx : -1 }); // (a camouflaged worm is lost sight of half the time)
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
  } else if (item === 12) ents.push({ type: 'compost', x: w.x - here.tx * 2.6, z: w.z - here.tz * 2.6, vx: 0, vz: 0, owner: w.idx, grace: 1.5, life: 15 });   // a compost heap: in the way
  else if (item === 13) { const p = pointAt(race.track, here.s + 8, here.lat * 0.5); ents.push({ type: 'salt', x: p.x, z: p.z, vx: 0, vz: 0, owner: w.idx, grace: 2, life: 12, hit: {} }); } // salt, thrown ahead
  else if (item === 14) {
    // A fishing hook: it and the worm in front are reeled together, to meet half way.
    const p = pointAt(race.track, w.s + (((front.s - w.s + race.track.length * 1.5) % race.track.length) - race.track.length / 2) / 2, (here.lat + locate(race.track, front.x, front.z, front.hint).lat) / 2);
    for (const [o, side] of [[w, -0.6], [front, 0.6]]) { o.tow = { x0: o.x, z0: o.z, x1: p.x + here.tz * side, z1: p.z - here.tx * side, t: 0 }; o.spasm = null; }
  } else if (item === 15) w.brolly = 10;  // a leaf umbrella: rain, hail and sun don't touch it
  else if (item === 16) ents.push({ type: 'decoy', x: w.x - here.tx * 2, z: w.z - here.tz * 2, vx: 0, vz: 0, owner: w.idx, grace: 99, life: 20 }); // a decoy: things sent after it go for that
  else if (item === 17) w.magnet = { n: 3, t: 0.7 };  // a magnet: three boxes' worth come to it, one after another
  else if (item === 18) {
    // A garden hose: everyone up the road is sprayed off to one side.
    for (const o of race.worms) { const d = o.prog - w.prog; if (o !== w && d > 0 && d < 28 && !o.out && !o.finished && !(o.star > 0)) o.hosed = { side: rng() < 0.5 ? -1 : 1, t: 3 }; }
  } else if (item === 19) race.summon = { kind: 'bird', target: leader && leader !== w ? leader.idx : undefined }; // a whistle: the bird, for whoever's in front
  else if (item === 20) { w.spring = { t: 0, s0: here.s, lat: here.lat, dig: true }; w.lift = 0.01; w.spasm = null; } // a shovel: under the road and up again further on
  else if (item === 21) for (let k = 0; k < 3; k++) { const a = rng.range(0, Math.PI * 2), d = rng.range(1.5, 3.5); ents.push({ type: 'peel', x: w.x - here.tx * 2 + Math.cos(a) * d, z: w.z - here.tz * 2 + Math.sin(a) * d, vx: 0, vz: 0, owner: w.idx, grace: 1.5, life: 25 }); }
  else if (item === 22) w.sauce = 4;      // hot sauce: fast, and it can't stop or steer
  else if (item === 23) w.mirror = 15;    // a mirror: the next thing thrown at it goes back
  else if (item === 24) { for (const o of race.worms) if (o !== w && !o.out && !o.finished && !(o.star > 0)) o.hic = 6; } // hiccups, for everyone else
  else if (item === 25) w.money += 1.5;   // a coupon
  else if (item === 26) w.egg = 5;        // a mystery egg: it hatches into something else in a while
  else if (item === 10) w.shield = 12;   // a bubble: spared the next bad thing
  else if (item === 11) w.giant = 5;       // giant grub: huge for a while, faster, and it flattens whoever it touches
  else {
    // A spring: one great bound up the road.
    w.spring = { t: 0, s0: here.s, lat: here.lat }; w.lift = 0.01; w.spasm = null;
  }
}

export function stepItems(race, dt) {
  const { boxes, ents } = race.items, tr = race.track;
  const rng = race.rng;
  const live = race.worms.filter((w) => !w.out && !w.finished && !(w.fall > 0) && !(w.lift > 0));
  for (const b of boxes) {
    if (b.t > 0) { b.t -= dt; continue; }
    for (const w of live) if (!w.finished && (w.x - b.x) ** 2 + (w.z - b.z) ** 2 < (w.mut[GENE.tentacles] ? 6.8 : 1.7)) { b.t = BOX_BACK; give(race, w); break; } // (tentacles reach twice as far)
  }
  for (const w of race.worms) {
    const sp = w.spring;
    if (!sp) continue;
    sp.t += dt * airOf(w.mut); // (wings make short work of being in the air)
    // (With a shovel it's the same journey, shorter, and underground.)
    const u = Math.min(1, sp.t / SPRING.secs), p = pointAt(tr, sp.s0 + (sp.dig ? 8 : SPRING.dist) * u, sp.lat * (1 - 0.6 * u));
    w.x = p.x; w.z = p.z; w.lift = u < 1 ? 0.01 + (sp.dig ? 0 : SPRING.high * Math.sin(Math.PI * u)) : 0;
    if (u >= 1) w.spring = null;
  }
  // What some items leave a worm doing.
  for (const w of race.worms) {
    if (w.out || w.finished) continue;
    // Reeled in on a hook.
    if (w.tow) { w.tow.t += dt / 0.55; const u = Math.min(1, w.tow.t), e = u * u * (3 - 2 * u); w.x = w.tow.x0 + (w.tow.x1 - w.tow.x0) * e; w.z = w.tow.z0 + (w.tow.z1 - w.tow.z0) * e; w.spasm = null; if (u >= 1) w.tow = null; }
    // Sprayed sideways by a hose.
    if (w.hosed) { const l = locate(tr, w.x, w.z, w.hint); w.x += l.tz * w.hosed.side * 4.5 * dt; w.z -= l.tx * w.hosed.side * 4.5 * dt; if ((w.hosed.t -= dt) <= 0) w.hosed = null; }
    // A magnet's boxes arriving; an egg hatching (into anything but another egg).
    if (w.magnet && (w.magnet.t -= dt) <= 0) { let k = 17; while (k === 17 || k === 26) k = Math.floor(rng() * ITEMS.length); give(race, w, k); w.magnet = --w.magnet.n > 0 ? { n: w.magnet.n, t: 0.7 } : null; }
    if (w.egg > 0 && (w.egg -= dt) <= 0) { let k = 26; while (k === 26 || k === 17) k = Math.floor(rng() * ITEMS.length); w.egg = 0; give(race, w, k); }
    // Hiccups: a jolt every second or so.
    if (w.hic > 0) { const was = Math.floor(w.hic); w.hic -= dt; if (Math.floor(w.hic) !== was && !(w.stun > 0) && !(w.fall > 0)) { w.stun = 0.3; w.spasm = null; race.events.push({ type: 'hic', idx: w.idx }); } }
    // Hot sauce: it lunges whether it's told to or not. (The rest is in how a worm moves.)
    if (w.sauce > 0 && !w.spasm && !w.queued) w.queued = 'THRASH';
  }
  for (let i = ents.length - 1; i >= 0; i--) {
    const e = ents[i];
    e.life -= dt; e.grace -= dt;
    let dead = e.life <= 0;
    if (e.type === 'compost') {
      // A heap: nobody gets through it, only round it.
      for (const w of live) { const dx = w.x - e.x, dz = w.z - e.z, d = Math.hypot(dx, dz); if (d < 2.4 && d > 1e-3 && !(w.star > 0) && !(w.giant > 0)) { w.x = e.x + (dx / d) * 2.4; w.z = e.z + (dz / d) * 2.4; } }
      if (dead) ents.splice(i, 1);
      continue;
    }
    if (e.type === 'salt') {
      // Salt: whoever crosses it writhes on the spot (once every few seconds each, so it can be got off).
      for (const w of live) { if ((w.idx === e.owner && e.grace > 0) || w.star > 0 || (w.x - e.x) ** 2 + (w.z - e.z) ** 2 > 4.4 || race.clock < (e.hit[w.idx] || 0)) continue; if (stun(race, w, 2)) e.hit[w.idx] = race.clock + 5; }
      if (dead) ents.splice(i, 1);
      continue;
    }
    if (e.type === 'decoy') { if (dead) ents.splice(i, 1); continue; }
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
      // (A magnetic worm pulls pebbles round towards it.)
      for (const w of live) if (w.mut[GENE.magnetic] && w.idx !== e.owner) { const dx = w.x - e.x, dz = w.z - e.z, d = Math.hypot(dx, dz); if (d < 9 && d > 0.3) { const sp = Math.hypot(e.vx, e.vz); e.vx += (dx / d) * 30 * dt; e.vz += (dz / d) * 30 * dt; const k = sp / (Math.hypot(e.vx, e.vz) || 1); e.vx *= k; e.vz *= k; } }
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
      // (If its target has left a decoy, it goes for that, and that's the end of both.)
      const lure = t ? ents.find((o) => o.type === 'decoy' && o.owner === t.idx) : null;
      if (lure && Math.hypot(lure.x - e.x, lure.z - e.z) < 12) { ax = lure.x; az = lure.z; if (Math.hypot(ax - e.x, az - e.z) < 1.2) { ents.splice(ents.indexOf(lure), 1); i = Math.min(i, ents.length); ents.splice(ents.indexOf(e), 1); race.events.push({ type: 'pop', idx: t.idx }); continue; } }
      else if (t && !t.out && Math.hypot(t.x - e.x, t.z - e.z) < 9) { ax = t.x; az = t.z; } else { const p = pointAt(tr, loc.s + 5, 0); ax = p.x; az = p.z; }
      const d = Math.hypot(ax - e.x, az - e.z) || 1;
      e.x += ((ax - e.x) / d) * speed * dt; e.z += ((az - e.z) / d) * speed * dt;
      if (!t || t.out || t.finished) dead = true;
    }
    if (!dead) {
      for (const w of live) {
        if ((w.idx === e.owner && e.grace > 0) || (e.type === 'mole' && w.idx !== e.target)) continue;
        if ((w.x - e.x) ** 2 + (w.z - e.z) ** 2 < 1.1) {
          // (A mirror sends it back where it came from.)
          if (w.mirror > 0 && e.type !== 'peel' && race.worms[e.owner] && !race.worms[e.owner].out) { w.mirror = 0; e.target = e.owner; e.owner = w.idx; e.grace = 0.6; e.vx = -e.vx; e.vz = -e.vz; e.life = Math.max(e.life, 6); if (e.type === 'pebble') e.type = 'homing'; race.events.push({ type: 'pop', idx: w.idx }); break; }
          stun(race, w, STUN[e.type]); dead = true; break;
        }
      }
    }
    if (dead) ents.splice(i, 1);
  }
}
