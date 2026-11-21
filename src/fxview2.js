// What the newer random events look like (events2.js has their rules). Everything is drawn from the event's short
// list of numbers, race.weather.data, so a guest in an online race draws the same from what the host sends.
import * as THREE from '../vendor/three.module.min.js';
import { pointAt } from './sim/track.js';
import { charOf } from './characters.js';

const lam = (color, o) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...o });
const BALL = new THREE.SphereGeometry(1, 7, 5), BOX = new THREE.BoxGeometry(1, 1, 1), CONE = new THREE.ConeGeometry(1, 1, 6), DISC = new THREE.CircleGeometry(1, 14);
const part = (g, geo, mat, x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); g.add(m); return m; };

const BUILD = {
  // A lawnmower: red, with a handle, and a blade going round underneath.
  mower: () => { const g = new THREE.Group(); part(g, BOX, lam(0xd82818), 0, 0.6, 0, 2.6, 0.7, 2.2); part(g, BOX, lam(0x2a2e38), 0, 1.1, 0.2, 1.2, 0.5, 1); part(g, BOX, lam(0x30343c), 0, 1.6, -1.6, 0.12, 2, 0.12, -0.7); part(g, BOX, lam(0x30343c), 0, 2.35, -2.25, 1.6, 0.12, 0.12); g.userData.blade = part(g, BOX, lam(0xc8ccd4), 0, 0.18, 0.4, 3, 0.06, 0.3); return g; },
  sprinkler: () => { const g = new THREE.Group(); part(g, BOX, lam(0x6a7078), 0, 0.5, 0, 0.3, 1, 0.3); const jet = new THREE.Group(); jet.position.y = 1; part(jet, BOX, new THREE.MeshBasicMaterial({ color: 0x90d0ff, transparent: true, opacity: 0.6 }), 0, 0.6, 4.5, 0.5, 0.25, 9, -0.12); g.add(jet); g.userData.jet = jet; return g; },
  cone: () => { const g = new THREE.Group(); part(g, CONE, lam(0xf07010), 0, 0.7, 0, 0.5, 1.4, 0.5); part(g, BOX, lam(0xf8f8f0), 0, 0.75, 0, 0.42, 0.22, 0.42); part(g, BOX, lam(0xf07010), 0, 0.05, 0, 1, 0.1, 1); return g; },
  hole: () => { const m = new THREE.Mesh(DISC, new THREE.MeshBasicMaterial({ color: 0x08060a, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.05; return m; },
  hill: () => { const g = new THREE.Group(); part(g, CONE, lam(0x6a4424), 0, 0.3, 0, 1.3, 0.6, 1.3); g.userData.mole = part(g, BALL, lam(0x3a2a20), 0, 0.2, 0, 0.5, 0.6, 0.5); part(g.userData.mole, BALL, lam(0xf0a0a0), 0, 0.5, 0.8, 0.25); return g; },
  // A hen: white, with a red comb and a yellow beak, that bobs as it pecks.
  chicken: () => { const g = new THREE.Group(), white = lam(0xf8f4ec); part(g, BALL, white, 0, 1.1, 0, 0.9, 0.85, 1.15); const head = new THREE.Group(); head.position.set(0, 1.9, 0.8); part(head, BALL, white, 0, 0, 0, 0.5); part(head, CONE, lam(0xf0b020), 0, -0.05, 0.6, 0.18, 0.5, 0.18, Math.PI / 2); part(head, BOX, lam(0xd82020), 0, 0.5, 0, 0.12, 0.35, 0.5); for (const s of [-1, 1]) part(head, BALL, new THREE.MeshBasicMaterial({ color: 0x101010 }), s * 0.3, 0.12, 0.35, 0.08); g.add(head); g.userData.head = head; part(g, CONE, white, 0, 1.5, -1.1, 0.4, 0.9, 0.4, -0.9); for (const s of [-1, 1]) part(g, BOX, lam(0xf0b020), s * 0.3, 0.25, 0, 0.1, 0.5, 0.1); return g; },
  ants: () => { const g = new THREE.Group(); for (let i = 0; i < 10; i++) part(g, BALL, lam(0x181014), ((i % 2) - 0.5) * 0.7, 0.12, 1 - i * 0.5, 0.14, 0.12, 0.2); return g; },
  snail: () => { const g = new THREE.Group(); part(g, BALL, lam(0xc8c090), 0, 0.3, 0.2, 0.45, 0.3, 1.2); part(g, BALL, lam(0xa8743c), 0, 0.95, -0.2, 0.3, 0.8, 0.85); for (const s of [-1, 1]) { part(g, BOX, lam(0xc8c090), s * 0.2, 0.8, 1.15, 0.06, 0.6, 0.06); part(g, BALL, new THREE.MeshBasicMaterial({ color: 0x101010 }), s * 0.2, 1.12, 1.15, 0.09); } return g; },
  frog: () => { const g = new THREE.Group(), green = lam(0x40a838); part(g, BALL, green, 0, 0.6, 0, 1, 0.7, 1.1); for (const s of [-1, 1]) { part(g, BALL, green, s * 0.5, 1.2, 0.5, 0.32); part(g, BALL, new THREE.MeshBasicMaterial({ color: 0x101010 }), s * 0.5, 1.28, 0.75, 0.14); part(g, BALL, green, s * 0.95, 0.3, -0.3, 0.45, 0.3, 0.7); } return g; },
  tongue: () => new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: 0xf06088 })),
  // The pace worm: white, slow, with a light on its head that it's very proud of.
  pace: () => { const g = new THREE.Group(); for (let i = 0; i < 7; i++) part(g, BALL, lam(i % 2 ? 0xe8e8e8 : 0xf8f8f8), 0, 0.46, -i * 0.5, 0.46 - i * 0.02); for (const s of [-1, 1]) { part(g, BALL, new THREE.MeshLambertMaterial({ color: 0xffffff }), s * 0.18, 0.66, 0.34, 0.14); part(g, BALL, new THREE.MeshBasicMaterial({ color: 0x101010 }), s * 0.19, 0.69, 0.45, 0.07); } g.userData.lamp = part(g, BOX, new THREE.MeshBasicMaterial({ color: 0xff9010 }), 0, 1.05, 0, 0.36, 0.26, 0.36); part(g, BOX, lam(0x2a2e38), 0, 0.5, -1, 0.95, 0.12, 0.5); return g; },
  water: () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshLambertMaterial({ color: 0x3078d8, transparent: true, opacity: 0.6, depthWrite: false })); m.rotation.x = -Math.PI / 2; return m; },
  leaf: () => new THREE.Mesh(BOX, lam(0x78b030)),
  baby: () => { const g = new THREE.Group(); g.userData.balls = [0, 1, 2, 3].map((i) => part(g, BALL, lam(0xffffff), 0, 0.22, -i * 0.26, 0.22 - i * 0.03)); for (const s of [-1, 1]) part(g, BALL, new THREE.MeshBasicMaterial({ color: 0x101010 }), s * 0.09, 0.32, 0.17, 0.045); return g; },
};

export class Fx2 {
  constructor(scene) {
    this.scene = scene; this.pools = {}; this.used = {};
    this.fog0 = [scene.fog.near, scene.fog.far];
    this.lights = scene.children.filter((o) => o.isLight).map((o) => [o, o.intensity]);
    this.dark = 0; this.murk = 0;
  }

  // The next free one of a kind of thing, made if there isn't one.
  get(kind) {
    const pool = this.pools[kind] || (this.pools[kind] = []), n = this.used[kind] || 0;
    let m = pool[n];
    if (!m) { m = BUILD[kind](); pool.push(m); this.scene.add(m); }
    this.used[kind] = n + 1; m.visible = true;
    return m;
  }

  update(race, time, dt) {
    const wx = race.weather, k = wx.type, d = wx.data || [], tr = race.track;
    this.used = {};
    // Fog closes in; night turns the lights down. Both come and go over a second or so.
    this.murk += Math.sign((k === 'fog' ? 1 : 0) - this.murk) * Math.min(Math.abs((k === 'fog' ? 1 : 0) - this.murk), dt * 1.2);
    this.scene.fog.near = this.fog0[0] + (1.5 - this.fog0[0]) * this.murk; this.scene.fog.far = this.fog0[1] + (15 - this.fog0[1]) * this.murk;
    this.dark += Math.sign((k === 'night' ? 1 : 0) - this.dark) * Math.min(Math.abs((k === 'night' ? 1 : 0) - this.dark), dt * 1.2);
    for (const [l, full] of this.lights) l.intensity = full * (1 - 0.8 * this.dark);
    if (k === 'flood') this.get('water').position.y = -0.3 + 0.62 * Math.min(1, wx.t / 1.5, Math.max(0, (wx.len || 99) - wx.t));
    if (k === 'wind' && d.length >= 2) {
      // Leaves, going past on the wind, round wherever the leader is.
      const at = (race.order || race.worms).find((w) => !w.out) || race.worms[0];
      for (let i = 0; i < 26; i++) { const m = this.get('leaf'), u = ((time * 0.9 + i * 0.37) % 1) - 0.5, side = ((i * 7) % 13) - 6; m.position.set(at.x + d[0] * u * 40 - d[1] * side * 2.2, 0.6 + ((i * 5) % 7) * 0.5, at.z + d[1] * u * 40 + d[0] * side * 2.2); m.scale.set(0.34, 0.05, 0.22); m.rotation.set(time * 7 + i, time * 5, i); }
    }
    if (k === 'mower' && d.length >= 3) { const m = this.get('mower'); m.position.set(d[0], 0, d[1]); m.rotation.y = d[2]; m.userData.blade.rotation.y = time * 40; }
    if (k === 'sprinkler' && d.length >= 3) { const m = this.get('sprinkler'); m.position.set(d[0], 0, d[1]); m.userData.jet.rotation.y = d[2]; }
    if (k === 'roadworks' && d.length >= 2) for (let i = 0; i <= 10; i++) { const p = pointAt(tr, d[0] + i * 3, d[1] * 0.4), m = this.get('cone'); m.position.set(p.x, 0, p.z); }
    for (const h of race.holes || []) { const m = this.get('hole'); m.position.x = h.x; m.position.z = h.z; m.scale.setScalar(h.r); }
    if (k === 'moles') for (let i = 0; i + 2 < d.length; i += 3) {
      // A molehill swelling, and then the mole out of the top of it.
      const m = this.get('hill'), left = d[i + 2];
      m.position.set(d[i], 0, d[i + 1]); m.scale.setScalar(left > 0 ? 1 - left * 0.6 : 1);
      m.userData.mole.position.y = left > 0 ? -0.6 : 0.9; m.userData.mole.visible = left <= 0;
    }
    if (k === 'chicken' && d.length >= 3) { const m = this.get('chicken'); m.position.set(d[0], 0.05 * Math.abs(Math.sin(time * 12)), d[1]); m.rotation.y = d[2]; m.userData.head.rotation.x = 0.7 * Math.max(0, Math.sin(time * 9)); }
    if (k === 'ants' && d.length) { const w = race.worms[d[0]]; if (w && !w.out) { const m = this.get('ants'); m.position.set(w.x, 0, w.z); m.rotation.y = Math.atan2(Math.sin(w.aim), Math.cos(w.aim)); m.children.forEach((a, i) => { a.position.y = 0.12 + 0.05 * Math.abs(Math.sin(time * 20 + i)); }); } }
    if (k === 'snail' && d.length >= 2) { const m = this.get('snail'), p = pointAt(tr, 0, 0); m.position.set(d[0], 0, d[1]); m.rotation.y = this.snailYaw === undefined || !this.snailAt ? 0 : this.snailYaw; if (this.snailAt && (d[0] !== this.snailAt[0] || d[1] !== this.snailAt[1])) this.snailYaw = Math.atan2(d[0] - this.snailAt[0], d[1] - this.snailAt[1]); this.snailAt = [d[0], d[1]]; void p; } else this.snailAt = null;
    if (k === 'frog' && d.length >= 3) {
      const m = this.get('frog'), held = race.worms[d[2]];
      m.position.set(d[0], 0, d[1]);
      if (held && !held.out) {
        const dx = held.x - d[0], dz = held.z - d[1], r = Math.hypot(dx, dz), t = this.get('tongue');
        m.rotation.y = Math.atan2(dx, dz);
        t.position.set(d[0] + dx / 2, 0.75, d[1] + dz / 2); t.scale.set(0.16, 0.12, Math.max(0.1, r)); t.rotation.y = Math.atan2(dx, dz);
      }
    }
    if (k === 'pace' && d.length >= 3) { const m = this.get('pace'); m.position.set(d[0], 0, d[1]); m.rotation.y = d[2]; m.userData.lamp.visible = Math.floor(time * 5) % 2 === 0; }
    for (const b of race.babies || []) {
      const o = race.worms[b.owner], m = this.get('baby');
      if (!o || o.out) { m.visible = false; continue; }
      m.position.set(b.x, 0.05 * Math.abs(Math.sin(time * 14)), b.z); m.rotation.y = Math.atan2(o.x - b.x, o.z - b.z);
      const colour = charOf(o).color;
      if (m.userData.colour !== colour) { m.userData.colour = colour; m.userData.balls.forEach((x) => x.material.color.setHex(colour)); }
    }
    for (const kind in this.pools) for (let i = this.used[kind] || 0; i < this.pools[kind].length; i++) this.pools[kind][i].visible = false;
  }
}
