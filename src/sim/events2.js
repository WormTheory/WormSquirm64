// More random events. These keep whatever a picture of them needs in ev.data, a short list of numbers, which is
// also all that's sent to the other players in an online race. (events.js has the rest, and starts and stops these.)
import { locate, pointAt } from './track.js';
import { stun, popped } from './items.js';
import { GENE } from './genes.js';
import { drop, cutWorm, MAX_WORMS } from './events.js';

// The ones that run by themselves...
export const KINDS2 = ['fog', 'wind', 'flood', 'night', 'lowgrav', 'mower', 'sprinkler', 'roadworks', 'sinkhole', 'reverse', 'moles', 'chicken', 'ants', 'snail', 'frog', 'birds2', 'pace'];
// ...and the ones that are the hand calling on one worm, as the knife and the check are.
export const VISITS2 = ['fisher', 'swapmeet', 'makeover', 'tax', 'knot', 'adoption', 'fused'];

const lead = (live) => live.reduce((a, b) => (!a || b.prog > a.prog ? b : a), null);
const last = (live) => live.reduce((a, b) => (!a || b.prog < a.prog ? b : a), null);
const near2 = (w, x, z, r) => (w.x - x) ** 2 + (w.z - z) ** 2 < r * r;
// Sends a worm through the air to another place along the road (the tornado's way of doing it).
const fling = (race, w, by) => { w.spin = { t: 0, s0: w.s, to: w.s + by }; w.lift = 0.01; w.spasm = null; w.queued = null; race.events.push({ type: 'twirl', idx: w.idx }); };

// Starts one. Returns false if it can't happen just now.
export function begin2(race, ev, kind, live) {
  const rng = race.rng, tr = race.track, L = lead(live);
  if (!L) return false;
  ev.data = [];
  if (kind === 'fog' || kind === 'night' || kind === 'lowgrav') ev.len = rng.range(10, 13);
  else if (kind === 'wind') { const a = rng.range(0, Math.PI * 2); ev.data = [Math.cos(a), Math.sin(a)]; ev.len = 10; }
  else if (kind === 'flood') { ev.len = rng.range(10, 13); for (const w of race.worms) w.wash = null; }
  else if (kind === 'reverse') ev.len = 10;
  else if (kind === 'mower') {
    // It starts behind the worm at the back and drives up the road, faster than anything can squirm.
    const b = last(live), lat = rng.range(-0.6, 0.6) * tr.hw;
    ev.mow = { s: b.s - 14, lat, cut: {} }; ev.len = 11;
    const p = pointAt(tr, ev.mow.s, lat); ev.data = [p.x, p.z, Math.atan2(p.tx, p.tz)];
  } else if (kind === 'sprinkler') { const p = pointAt(tr, L.s + 12, 0); ev.data = [p.x, p.z, 0]; ev.len = 10; }
  else if (kind === 'roadworks') { ev.data = [L.s + 10, rng() < 0.5 ? -1 : 1]; ev.len = 20; }
  else if (kind === 'sinkhole') {
    // A hole, somewhere on the road ahead of the leader, that's there for the rest of the race.
    const p = pointAt(tr, L.s + rng.range(14, 30), rng.range(-0.5, 0.5) * tr.hw);
    (race.holes || (race.holes = [])).push({ x: p.x, z: p.z, r: 0.2, to: 2.3 }); ev.len = 3;
  } else if (kind === 'moles') { ev.hills = []; ev.nextHill = 0.3; ev.len = 9; }
  else if (kind === 'chicken') { const p = pointAt(tr, L.s + 10, 0); ev.data = [p.x, p.z, 0]; ev.len = 15; }
  else if (kind === 'ants') {
    // The worm at the back, if there's anyone ahead of it to be carried up to.
    const b = last(live.filter((w) => !(w.fall > 0) && !(w.lift > 0)));
    if (!b || b === L) return false;
    ev.data = [b.idx]; ev.len = 9;
  } else if (kind === 'snail') { ev.snail = { s: L.s + 9, lat: -tr.hw - 1, glue: 0 }; ev.len = 9; const p = pointAt(tr, ev.snail.s, ev.snail.lat); ev.data = [p.x, p.z]; }
  else if (kind === 'frog') { const side = rng() < 0.5 ? -1 : 1, p = pointAt(tr, L.s + 8, side * (tr.hw + 1.6)); ev.data = [p.x, p.z, -1, 0]; ev.frog = { wait: 1, s: L.s + 8 }; ev.len = 12; }
  else if (kind === 'pace') {
    // The pace worm sets off from just ahead of the leader, and nobody passes it.
    ev.pace = { prog: L.prog + 5, s: L.s + 5 }; ev.len = 8;
    const p = pointAt(tr, ev.pace.s, 0); ev.data = [p.x, p.z, Math.atan2(p.tx, p.tz)];
  } else return false;
  return true;
}

export function step2(race, ev, dt, live) {
  const rng = race.rng, tr = race.track, k = ev.type, d = ev.data;
  if (k === 'wind') {
    // A gale: everyone's blown the same way, and wings are a sail.
    for (const w of live) if (!(w.fall > 0) && !(w.lift > 0) && !w.finished && !(w.star > 0)) { const f = 3.2 * (1 + 0.6 * w.mut[GENE.wings]); w.x += d[0] * f * dt; w.z += d[1] * f * dt; }
  } else if (k === 'flood') {
    // The road's under water: worms drift about in it (but for those with gills), and anything with a fin is in its element.
    for (const w of live) {
      if (w.finished || w.fall > 0 || w.lift > 0 || w.mut[GENE.gills]) continue;
      if (!w.wash || (w.wash.t -= dt) <= 0) { const a = rng.range(0, Math.PI * 2), v = rng.range(1, 3); w.wash = { x: Math.cos(a) * v, z: Math.sin(a) * v, t: rng.range(1, 2.5) }; }
      w.x += w.wash.x * dt; w.z += w.wash.z * dt;
    }
  } else if (k === 'mower') {
    const mw = ev.mow;
    mw.s += 20 * dt;
    const p = pointAt(tr, mw.s, mw.lat);
    d[0] = p.x; d[1] = p.z; d[2] = Math.atan2(p.tx, p.tz);
    // Whatever it goes over is cut in two (once each, and not if there's no room for more worms).
    for (const w of live) if (!mw.cut[w.idx] && !w.finished && !(w.fall > 0) && !(w.lift > 0) && !(w.star > 0) && near2(w, p.x, p.z, 1.7) && w.cuts < 7 && race.worms.length < MAX_WORMS && !popped(race, w)) { mw.cut[w.idx] = true; mw.cut[race.worms.length] = true; cutWorm(race, w); }
  } else if (k === 'sprinkler') {
    d[2] += 2.4 * dt;
    // Round and round: whoever's in reach is pushed away from it.
    for (const w of live) { const dx = w.x - d[0], dz = w.z - d[1], r = Math.hypot(dx, dz); if (r < 9 && r > 0.2 && !w.finished && !(w.fall > 0) && !(w.lift > 0) && !(w.brolly > 0)) { w.x += (dx / r) * 3.2 * dt; w.z += (dz / r) * 3.2 * dt; } }
  } else if (k === 'roadworks') {
    // Half the road is shut for a stretch: anyone on the shut side there is moved over.
    for (const w of live) {
      if (w.finished || w.fall > 0 || w.lift > 0) continue;
      const l = locate(tr, w.x, w.z, w.hint), along = ((l.s - d[0]) % tr.length + tr.length) % tr.length;
      if (along > 30 || l.lat * d[1] < 0.4) continue;
      const over = l.lat - d[1] * 0.4;
      w.x -= l.tz * over; w.z += l.tx * over;
    }
  } else if (k === 'moles') {
    // Molehills come up under the road, each with a moment's warning; whoever's on one when the mole arrives is thrown.
    ev.nextHill -= dt;
    if (ev.nextHill <= 0 && live.length && ev.t < ev.len - 1.2) { ev.nextHill = 0.3; const w = rng.pick(live), a = rng.range(0, Math.PI * 2), r = rng.range(0, 4); ev.hills.push({ x: w.x + Math.cos(a) * r, z: w.z + Math.sin(a) * r, t: ev.t + 1 }); }
    for (const h of ev.hills) {
      if (h.done || ev.t < h.t) continue;
      h.done = true;
      for (const w of live) if (!w.finished && !(w.fall > 0) && !(w.lift > 0) && !(w.star > 0) && near2(w, h.x, h.z, 1.5) && !popped(race, w)) fling(race, w, rng.range(-5, 7));
    }
    ev.hills = ev.hills.filter((h) => ev.t < h.t + 0.6);
    ev.data = ev.hills.flatMap((h) => [Math.round(h.x * 10) / 10, Math.round(h.z * 10) / 10, Math.round((h.t - ev.t) * 100) / 100]);
  } else if (k === 'chicken') {
    // A hen: it goes for the nearest worm it hasn't just pecked, and pecks it flat.
    let prey = null, best = Infinity;
    for (const w of live) { if (w.finished || w.safe > 0 || w.fall > 0 || w.lift > 0) continue; const q = (w.x - d[0]) ** 2 + (w.z - d[1]) ** 2; if (q < best) { best = q; prey = w; } }
    if (prey) {
      const r = Math.sqrt(best) || 1, go = Math.min(r, 7.5 * dt);
      d[2] = Math.atan2(prey.x - d[0], prey.z - d[1]);
      d[0] += ((prey.x - d[0]) / r) * go; d[1] += ((prey.z - d[1]) / r) * go;
      if (r < 1.4) { prey.safe = 4; if (!prey.mut[GENE.shell] && !(prey.star > 0) && !popped(race, prey)) { prey.flat = 4; prey.spasm = null; race.events.push({ type: 'squash', idx: prey.idx }); } }
    }
  } else if (k === 'ants') {
    // Ants carry the back marker up the road until it's with the leader (or they've had enough).
    const w = race.worms[d[0]], L = lead(live);
    if (!w || w.out || w.finished || !L || w.prog >= L.prog - 1.5 || ev.t > ev.len - 0.4) { if (w) { w.lift = 0; } ev.t = Math.max(ev.t, ev.len); return; }
    const l = locate(tr, w.x, w.z, w.hint), p = pointAt(tr, l.s + 15 * dt, l.lat * (1 - dt));
    w.x = p.x; w.z = p.z; w.hold = 0.2; w.spasm = null; w.prog += 15 * dt; w.s = locate(tr, p.x, p.z, l.i).s; w.hint = l.i;
    w.lap = Math.max(1, Math.min(race.laps, Math.floor(w.prog / tr.length) + 1));
  } else if (k === 'snail') {
    // A snail crosses the road from one side to the other, and what it leaves behind it is glue.
    const sn = ev.snail;
    sn.lat += ((tr.hw * 2 + 2) / 8) * dt;
    const p = pointAt(tr, sn.s, sn.lat);
    d[0] = p.x; d[1] = p.z;
    if ((sn.glue -= dt) <= 0 && Math.abs(sn.lat) < tr.hw) { sn.glue = 0.45; race.items.ents.push({ type: 'glue', x: p.x, z: p.z, vx: 0, vz: 0, owner: -1, grace: 0, life: 14 }); }
  } else if (k === 'frog') {
    // A frog by the road: every so often its tongue has the nearest worm, holds it a moment, and lets it go.
    const fr = ev.frog, held = race.worms[d[2]];
    if (held && !held.out) {
      d[3] += dt;
      const u = Math.min(1, d[3] / 0.25);
      held.x += (d[0] - held.x) * u * 0.5; held.z += (d[1] - held.z) * u * 0.5; held.hold = 0.2; held.spasm = null;
      if (d[3] > 1) { const p = pointAt(tr, fr.s - 3, 0); held.x = p.x; held.z = p.z; held.stun = 0.6; held.hint = -1; d[2] = -1; fr.wait = 1.6; }
    } else if ((fr.wait -= dt) <= 0) {
      let prey = null, best = 64;
      for (const w of live) { if (w.finished || w.fall > 0 || w.lift > 0 || w.star > 0 || w.giant > 0) continue; const q = (w.x - d[0]) ** 2 + (w.z - d[1]) ** 2; if (q < best) { best = q; prey = w; } }
      if (prey && !popped(race, prey)) { d[2] = prey.idx; d[3] = 0; race.events.push({ type: 'grab', idx: prey.idx }); } else fr.wait = 0.4;
    }
  } else if (k === 'pace') {
    const pc = ev.pace;
    pc.prog += 5 * dt; pc.s += 5 * dt;
    const p = pointAt(tr, pc.s, 0);
    d[0] = p.x; d[1] = p.z; d[2] = Math.atan2(p.tx, p.tz);
    // Nobody passes the pace worm: anyone who gets up to it is put back behind.
    for (const w of live) {
      if (w.finished || w.fall > 0 || w.lift > 0 || w.prog < pc.prog - 1.3) continue;
      const l = locate(tr, w.x, w.z, w.hint), back = w.prog - (pc.prog - 1.3), q = pointAt(tr, l.s - back, l.lat);
      w.x = q.x; w.z = q.z; w.spasm = null;
    }
  }
}

// Things these events leave behind that go on after them: holes in the road, and babies following their worms.
export function always2(race, dt) {
  for (const h of race.holes || []) {
    if (h.r < h.to) h.r = Math.min(h.to, h.r + dt * 1.2);
    for (const w of race.worms) if (!w.out && !w.finished && !(w.fall > 0) && !(w.lift > 0) && !(w.star > 0) && !(w.safe > 0) && near2(w, h.x, h.z, h.r * 0.8)) {
      // (Down it goes; the hand puts it back just past the hole, and it isn't to fall straight back in.)
      drop(race, w, 'fall'); w.pit = true; w.fall = 1.6; w.safe = 4; w.s = locate(race.track, h.x, h.z, -1).s + h.r + 1.6;
    }
  }
  for (const b of race.babies || []) {
    const o = race.worms[b.owner];
    if (!o || o.out) continue;
    // It trails along a little way behind its worm, and anyone else who runs into it is tripped.
    const dx = o.x - b.x, dz = o.z - b.z, r = Math.hypot(dx, dz);
    if (r > 1.7) { const go = Math.min(r - 1.7, 14 * dt); b.x += (dx / r) * go; b.z += (dz / r) * go; }
    for (const w of race.worms) if (w !== o && !w.out && !w.finished && !(w.fall > 0) && !(w.lift > 0) && !(w.safe > 0) && near2(w, b.x, b.z, 0.9)) { if (stun(race, w, 0.6)) w.safe = 3; }
  }
}

// What the hand does on one of its newer visits, at the moment it does it.
export function deed2(race, ev, w) {
  const rng = race.rng, tr = race.track, live = race.worms.filter((o) => !o.out && !o.finished && o !== w);
  if (ev.type === 'fisher') fling(race, w, (rng() < 0.5 ? -1 : 1) * rng.range(25, 60)); // hooked, and cast a long way up the road or down it
  else if (ev.type === 'swapmeet') {
    // It and some other worm are put down in each other's places.
    const o = live.filter((q) => !(q.fall > 0) && !(q.lift > 0)).sort(() => rng() - 0.5)[0];
    if (o) { for (const key of ['x', 'z', 's', 'hint', 'prog', 'lap']) { const t = w[key]; w[key] = o[key]; o[key] = t; } o.spasm = null; race.events.push({ type: 'swap', idx: w.idx, other: o.idx }); }
  } else if (ev.type === 'makeover') { w.glam = true; race.events.push({ type: 'branded', idx: w.idx, quiet: true }); }
  else if (ev.type === 'tax') {
    // Half of what it has, to whoever's last.
    const poor = last(live) || w, take = w.money / 2;
    w.money -= take; poor.money += take;
    race.events.push({ type: 'paid', idx: poor.idx });
  } else if (ev.type === 'knot') { w.knot = 6; w.hurts++; race.events.push({ type: 'hit', idx: w.idx }); }
  else if (ev.type === 'adoption') { (race.babies || (race.babies = [])).push({ x: w.x, z: w.z, owner: w.idx }); race.events.push({ type: 'pop', idx: w.idx }); }
  else if (ev.type === 'fused') {
    // Stuck end to end with the nearest worm: one long worm with a head at each end. The other worm is in it from now
    // on, goes where it goes and finishes where it finishes; whoever was driving either drives what's left.
    const o = live.filter((q) => !(q.fall > 0) && !(q.lift > 0) && !(q.fusedTo >= 0)).sort((a, b) => ((a.x - w.x) ** 2 + (a.z - w.z) ** 2) - ((b.x - w.x) ** 2 + (b.z - w.z) ** 2))[0];
    if (!o) return;
    o.out = true; o.fusedTo = w.idx; w.human = w.human || o.human; if (w.human) w.ai = null; o.human = false;
    w.mut[GENE.long] = Math.min(9, w.mut[GENE.long] + 3); w.mut[GENE.head]++;
    for (const m of o.chains) { const q = race.worms[m]; if (q) q.chains = q.chains.filter((i) => i !== o.idx); }
    o.chains = [];
    race.events.push({ type: 'fusion', idx: w.idx, other: o.idx });
  }
}
