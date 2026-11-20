// Everything in a race that isn't the scenery or a worm: item boxes and the things items leave about,
// rain, the heat's glare, the bird, and the giant legs. It only shows what the race says is there.
import * as THREE from '../vendor/three.module.min.js';
import { canvasTex } from './view.js';
import { centreNear } from './sim/track.js';
import { FALL_TIME, DEAD_TIME, DROP_PART, OUT_TIME, LIE_PART, BITE_TIME, PLASTER_PART, PAT_END, HAIL, carried } from './sim/events.js';

const lam = (color, o) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...o });
const RAIN_BOX = 26;
// The colour each event turns the sky.
const TINTS = { rain: 0x4a5868, heat: 0xf8a040, moon: 0x6a0810, frost: 0xd8ecff, twister: 0x70747c, hail: 0x5a6878, dizzy: 0x9040c0 };

// A bird, built facing +z, with wings that can be flapped. size: about its length.
export function makeBird(size, body = 0x283a70, belly = 0xd8dce8) {
  const g = new THREE.Group(), s = size;
  const part = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x * s, y * s, z * s); m.scale.set(sx * s, sy * s, sz * s); g.add(m); return m; };
  const ball = new THREE.SphereGeometry(1, 7, 5);
  part(ball, lam(body), 0, 0, 0, 0.28, 0.24, 0.5);
  part(ball, lam(belly), 0, -0.07, 0.05, 0.22, 0.18, 0.4);
  part(ball, lam(body), 0, 0.2, 0.42, 0.18, 0.18, 0.18);
  part(new THREE.ConeGeometry(0.07, 0.26, 4), lam(0xf0a020), 0, 0.17, 0.66, 1, 1, 1).rotation.x = Math.PI / 2;
  for (const x of [-0.08, 0.08]) part(ball, new THREE.MeshBasicMaterial({ color: 0x101010 }), x, 0.28, 0.54, 0.035, 0.035, 0.035);
  part(new THREE.ConeGeometry(0.16, 0.5, 4), lam(body), 0, 0.02, -0.6, 1, 1, 1).rotation.x = -Math.PI / 2;
  g.userData.wings = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.2 * s, 0.1 * s, 0);
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.04 * s, 0.42 * s), lam(body));
    w.position.x = side * 0.45 * s;
    pivot.add(w); g.add(pivot);
    return pivot;
  });
  return g;
}
export function flap(bird, time, rate = 9) { bird.userData.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(time * rate) * 0.7; }); }

// A crudely made human hand, fingers down, on the end of an arm that reaches up out of sight.
// It can also be holding a jug, with water to pour from it.
function makeHand() {
  const g = new THREE.Group(), skin = lam(0xe8b890), box = (w, h, d, x, y, z, mat = skin) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };
  box(1.7, 600, 1.4, 0, 302.4, 0);                     // arm (far taller than any camera can see the top of)
  box(2.4, 2.2, 1.1, 0, 1.4, 0);                       // palm
  for (let i = 0; i < 4; i++) box(0.5, 1.5, 0.5, -0.95 + i * 0.63, -0.3, 0.35); // fingers
  box(0.55, 1.3, 0.55, -1.5, 0.2, -0.3).rotation.z = 0.5; // thumb
  const jug = new THREE.Group();
  const glass = lam(0xa8d8f0, { transparent: true, opacity: 0.75 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.9, 2.4, 7), glass); body.position.y = -1.2;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.16, 4, 6), glass); handle.position.set(-1.2, -1.1, 0);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.6), glass); lip.position.set(1.2, -0.15, 0);
  jug.add(body, handle, lip);
  jug.position.set(1.4, 0.4, 0.4);
  const water = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1, 0.4), new THREE.MeshBasicMaterial({ color: 0x48a0f0, transparent: true, opacity: 0.8 }));
  g.add(jug, water);
  // A sticking plaster, held ready in the fingers.
  const plaster = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.55), lam(0xe8c090)); plaster.position.set(0, -1.15, 0.35);
  g.add(plaster);
  g.userData = { jug, water, plaster };
  g.scale.setScalar(0.8);
  return g;
}

export class FxView {
  constructor(scene, race) {
    this.scene = scene;
    this.hands = race.worms.map(() => null); // one hand per worm, made the first time it's needed
    // Item boxes: a spinning cube with a question mark on it.
    const tex = canvasTex(16, 16, (c) => {
      const g = c.createLinearGradient(0, 0, 16, 16);
      ['#f03030', '#f8e030', '#40c840', '#30a0f0', '#b050e0'].forEach((col, i) => g.addColorStop(i / 4, col));
      c.fillStyle = g; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#fff'; c.font = '900 14px "Arial Black",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 8, 9);
    });
    const boxMat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity: 0.9 }), boxGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    this.boxes = race.items.boxes.map((b) => { const m = new THREE.Mesh(boxGeo, boxMat); m.position.set(b.x, 1, b.z); scene.add(m); return m; });
    // What items leave lying or flying about. Models are made as they're needed and kept for next time.
    const ball = new THREE.IcosahedronGeometry(1, 0);
    this.make = {
      peel: () => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.3, 5), lam(0xf0d830)); m.position.y = 0.15; return m; },
      pebble: () => { const m = new THREE.Mesh(ball, lam(0x9a9aa4)); m.scale.setScalar(0.36); m.position.y = 0.4; return m; },
      homing: () => { const m = new THREE.Mesh(ball, lam(0xe03828)); m.scale.setScalar(0.4); m.position.y = 0.45; return m; },
      mole: () => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.6, 6), lam(0x6a4424)); m.position.y = 0.3; return m; },
      glue: () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.75, 0.12, 9), lam(0xc8d030, { transparent: true, opacity: 0.85 })); m.position.y = 0.07; return m; },
    };
    this.pool = { peel: [], pebble: [], homing: [], mole: [], glue: [] };
    // Rain: two stacked boxes of streaks that fall through each other, kept round whichever camera is drawing.
    const pts = [];
    for (let i = 0; i < 420; i++) { const x = (Math.random() - 0.5) * 44, y = Math.random() * RAIN_BOX, z = (Math.random() - 0.5) * 44; pts.push(x, y, z, x + 0.15, y - 1.3, z); }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const rm = new THREE.LineBasicMaterial({ color: 0xc8dcff, transparent: true, opacity: 0.6, fog: false });
    this.rain = new THREE.Group();
    for (const y of [0, RAIN_BOX]) { const l = new THREE.LineSegments(rg, rm); l.position.y = y; this.rain.add(l); }
    this.rain.visible = false;
    scene.add(this.rain);
    // The bird that carries worms off.
    this.bird = makeBird(9);
    this.bird.visible = false;
    scene.add(this.bird);
    this.birdAt = null;
    // The legs: trousers and a shoe each, tall enough that the top is out of sight.
    // Snow for a frost: the rain's trick again, with flakes that drift down slowly.
    const flakes = [];
    for (let i = 0; i < 380; i++) flakes.push((Math.random() - 0.5) * 44, Math.random() * RAIN_BOX, (Math.random() - 0.5) * 44);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(flakes, 3));
    const sm = new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, sizeAttenuation: false, fog: false });
    this.snow = new THREE.Group();
    for (const y of [0, RAIN_BOX]) { const pts2 = new THREE.Points(sg, sm); pts2.position.y = y; this.snow.add(pts2); }
    this.snow.visible = false;
    scene.add(this.snow);
    this.hail = [];
    this.twister = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.7 + i * 0.36, 0.4 + i * 0.34, 1.45, 7, 1, true), lam(i % 2 ? 0x8a8e98 : 0xa8acb4, { side: THREE.DoubleSide, transparent: true, opacity: 0.72 }));
      ring.position.y = 0.7 + i * 1.4;
      this.twister.add(ring);
    }
    this.twister.visible = false;
    scene.add(this.twister);
    this.legs = [0, 1].map(() => {
      const g = new THREE.Group();
      const leg = new THREE.Mesh(new THREE.BoxGeometry(2.6, 600, 2.6), lam(0x3050a0)); leg.position.y = 301.7;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 6), lam(0x5a3418)); shoe.position.set(0, 1.06, 1.2);
      // (The sole sits just clear of the road, and the shoe just clear of the sole: faces lying in the same plane flicker.)
      const sole = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 6.2), lam(0x201810)); sole.position.set(0, 0.2, 1.2);
      g.add(leg, shoe, sole); g.visible = false;
      g.scale.setScalar(1.5); // (big enough that the shoe covers what it flattens)
      scene.add(g);
      return g;
    });
    this.tint = 0; this.tintTo = new THREE.Color(); this.deep = 0.6; this.dir = new THREE.Vector3();
    // The blood moon: a big red disc with darker seas on it, hung in the same part of the sky for every camera.
    const moonTex = canvasTex(32, 32, (c) => {
      c.clearRect(0, 0, 32, 32);
      c.fillStyle = '#d81818'; c.beginPath(); c.arc(16, 16, 15, 0, 7); c.fill();
      c.fillStyle = '#a00c10'; for (const [x, y, r] of [[11, 11, 4], [20, 9, 2.5], [21, 20, 5], [10, 21, 2.5], [15, 16, 1.5]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    });
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, alphaTest: 0.5 }));
    this.moon.scale.set(150, 150, 1); this.moon.visible = false;
    scene.add(this.moon);
  }

  update(race, time, dt) {
    this.boxes.forEach((m, i) => {
      m.visible = race.items.boxes[i].t <= 0;
      m.rotation.set(time * 1.3, time * 1.9 + i, 0); m.position.y = 1 + 0.15 * Math.sin(time * 3 + i);
    });
    const used = { peel: 0, pebble: 0, homing: 0, mole: 0, glue: 0 };
    for (const e of race.items.ents) {
      const pool = this.pool[e.type];
      if (!pool) continue;
      let m = pool[used[e.type]++];
      if (!m) { m = this.make[e.type](); pool.push(m); this.scene.add(m); }
      m.visible = true; m.position.x = e.x; m.position.z = e.z;
      if (e.type !== 'peel' && e.type !== 'glue') m.rotation.set(time * 9, time * 7, 0);
    }
    for (const k in this.pool) for (let i = used[k]; i < this.pool[k].length; i++) this.pool[k][i].visible = false;

    // The hand: it lowers a fallen worm back onto the road, or pours a jug of water over one that's baked,
    // and then goes back up where it came from.
    race.worms.forEach((w, i) => {
      let h = this.hands[i];
      const busy = w.fall > 0 && !w.out;
      if (!busy && !(h && h.visible)) return;
      if (!h) { h = this.hands[i] = makeHand(); this.scene.add(h); }
      const { jug, water, plaster } = h.userData;
      plaster.visible = false;
      if (!busy) { h.position.y += dt * 26; water.visible = false; if (h.position.y > 40) h.visible = false; return; } // job done: away
      jug.visible = w.dead;
      if (w.bit) {
        // Down with a plaster, stick it on, three gentle pats, and away.
        const e = BITE_TIME - w.fall, down = Math.min(1, e / PLASTER_PART), pat = e > PLASTER_PART && e < PAT_END ? Math.abs(Math.sin(((e - PLASTER_PART) / (PAT_END - PLASTER_PART)) * Math.PI * 3)) : 0;
        h.visible = true; water.visible = false; plaster.visible = e < PLASTER_PART;
        h.position.set(w.x, 1.75 + 26 * (1 - down) ** 2 + pat * 0.9 + Math.max(0, e - PAT_END) * 6, w.z - 0.3);
      } else if (w.dead) {
        // Down beside the worm, tip the jug, pour, and straighten up again.
        const e = DEAD_TIME - w.fall, down = Math.min(1, e / 0.7), tip = Math.max(0, Math.min(1, (e - 0.7) / 0.4)) - Math.max(0, Math.min(1, (e - 2.1) / 0.4));
        h.visible = true;
        h.position.set(w.x - 2.2, 4.4 + 26 * (1 - down) ** 2, w.z);
        jug.rotation.z = -tip * 1.25;
        water.visible = tip > 0.9;
        water.scale.set(1, 5.2, 1); water.position.set(2.75, -2.6 + 0.15 * Math.sin(time * 40), 0.4);
      } else {
        const p = centreNear(race.track, w.x, w.z);
        water.visible = false;
        if (w.pit) {
          const e = FALL_TIME - w.fall, u = Math.max(0, (e - DROP_PART) / (FALL_TIME - DROP_PART));
          h.visible = e >= DROP_PART;
          h.position.set(p.x, 10.6 - 6.6 * u, p.z - 0.3);
        } else {
          // Down to where the worm lies, then up and over the wall with it.
          const e = OUT_TIME - w.fall;
          h.visible = true;
          if (e < LIE_PART) h.position.set(w.x, 1.1 + 28 * (1 - e / LIE_PART) ** 2, w.z - 0.3);
          else { const c = carried(w, p, (e - LIE_PART) / (OUT_TIME - LIE_PART)); h.position.set(c[0], c[2] + 0.6, c[1] - 0.3); }
        }
      }
    });

    const wx = race.weather, kind = wx.type;
    this.time = time;
    this.rain.visible = kind === 'rain';
    this.moon.visible = kind === 'moon';
    this.snow.visible = kind === 'frost';
    // Hail: each stone drops onto its mark, where a shadow has been growing to warn of it.
    const stones = wx.hail || [];
    stones.forEach((h, i) => {
      let m = this.hail[i];
      if (!m) {
        m = this.hail[i] = { ball: new THREE.Mesh(this.make.pebble().geometry, lam(0xe8f4ff)), mark: new THREE.Mesh(new THREE.CircleGeometry(1, 8), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })) };
        m.mark.rotation.x = -Math.PI / 2; m.ball.scale.setScalar(0.65);
        this.scene.add(m.ball, m.mark);
      }
      const left = Math.max(0, h.t - wx.t), u = 1 - Math.min(1, left / HAIL.fall);
      m.ball.visible = left > 0; m.mark.visible = true;
      m.ball.position.set(h.x, 0.6 + HAIL.high * (1 - u) ** 1.5, h.z); m.ball.rotation.set(time * 5, time * 4, 0);
      m.mark.position.set(h.x, 0.05, h.z); m.mark.scale.setScalar(0.3 + 1.3 * u);
    });
    for (let i = stones.length; i < this.hail.length; i++) { this.hail[i].ball.visible = false; this.hail[i].mark.visible = false; }
    // The tornado: a stack of rings, each turning and swaying a little out of step with the one below.
    this.twister.visible = !!wx.twister;
    if (wx.twister) {
      this.twister.position.set(wx.twister.x, 0, wx.twister.z);
      this.twister.children.forEach((ring, i) => { ring.rotation.y = time * (9 - i * 0.5); ring.position.x = Math.sin(time * 5 + i * 0.7) * 0.12 * i; ring.position.z = Math.cos(time * 4 + i * 0.9) * 0.12 * i; });
    }
    // Rain darkens the sky and a heatwave turns it a hot orange, each fading in and out.
    const want = TINTS[kind] ? 1 : 0;
    this.tint += Math.sign(want - this.tint) * Math.min(Math.abs(want - this.tint), dt * 0.8);
    if (TINTS[kind]) this.tintTo.set(TINTS[kind]);
    if (kind !== 'none') this.deep = kind === 'moon' ? 0.9 : 0.6; // (the blood moon turns the sky nearly all the way red)
    const u = this.scene.userData;
    if (u.sky) { this.scene.background.copy(u.sky).lerp(this.tintTo, this.tint * this.deep); this.scene.fog.color.copy(u.fog).lerp(this.tintTo, this.tint * this.deep); }

    const b = wx.bird;
    this.bird.visible = !!b;
    if (b) {
      if (this.birdAt) { const dx = b.x - this.birdAt[0], dz = b.z - this.birdAt[1]; if (dx * dx + dz * dz > 1e-4) this.bird.rotation.y = Math.atan2(dx, dz); }
      this.birdAt = [b.x, b.z];
      this.bird.position.set(b.x, b.h + 2.2, b.z);
      flap(this.bird, time);
    } else this.birdAt = null;

    const st = wx.stomp;
    this.legs.forEach((g, k) => {
      g.visible = !!st;
      if (!st) return;
      // Each foot stands where it last came down, and swings to its next place while the other is planted.
      const steps = st.steps, mine = steps.filter((_, i) => i % 2 === k), t = wx.t;
      const dirx = steps[steps.length - 1].x - steps[0].x, dirz = steps[steps.length - 1].z - steps[0].z, dl = Math.hypot(dirx, dirz) || 1;
      let from = { x: mine[0].x - (dirx / dl) * 6, z: mine[0].z - (dirz / dl) * 6, t: mine[0].t - 0.75 }, to = mine[0];
      for (let i = 0; i < mine.length; i++) if (t >= mine[i].t) { from = mine[i]; to = mine[i + 1] || mine[i]; }
      const start = Math.max(from.t, to.t - 0.75), f = to === from ? 1 : Math.max(0, Math.min(1, (t - start) / Math.max(0.01, to.t - start)));
      g.position.set(from.x + (to.x - from.x) * f, Math.sin(Math.PI * f) * 7 * (to === from ? 0 : 1), from.z + (to.z - from.z) * f);
      g.rotation.y = Math.atan2(dirx, dirz);
    });
  }

  // Where the moon is for a given camera: up and to the right of wherever it's looking (level), so nobody can miss it,
  // and far off beyond the hills, so they stand in front of it. It rises as the sky turns. The answer goes in `out`.
  moonAt(camera, out) {
    camera.getWorldDirection(this.dir); this.dir.y = 0; this.dir.normalize();
    return out.set(camera.position.x + this.dir.x * 380 - this.dir.z * 110, camera.position.y + 195 * Math.min(1, this.tint * 1.3) - 65, camera.position.z + this.dir.z * 380 + this.dir.x * 110);
  }

  // Call before drawing each player's view: the rain goes wherever that camera is.
  around(camera) {
    if (this.moon.visible) this.moonAt(camera, this.moon.position);
    if (this.snow.visible) this.snow.position.set(camera.position.x, camera.position.y - RAIN_BOX / 2 - ((this.time * 5) % RAIN_BOX), camera.position.z);
    if (!this.rain.visible) return;
    this.rain.position.set(camera.position.x, camera.position.y - RAIN_BOX / 2 - ((this.time * 34) % RAIN_BOX), camera.position.z);
  }
}

// The nest. A worm the bird has taken is brought here and fed to a chick, and the player whose worm it was
// watches that in place of the race, and then goes on watching the nest. Every feeding plays for everyone watching.
export class NestView {
  constructor() {
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x88c8f0);
    scene.add(new THREE.AmbientLight(0xffffff, 2.2));
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.6); sun.position.set(3, 8, 5); scene.add(sun);
    this.camera = new THREE.PerspectiveCamera(46, 4 / 3, 0.2, 200);
    this.camera.position.set(0, 4.2, 9.5); this.camera.lookAt(0, 1.6, 0);
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); scene.add(m); return m; };
    this.backdrop = [add(new THREE.CylinderGeometry(0.9, 1.4, 14, 7), lam(0x5a3a20), -1, -7.4, -1)]; // the tree
    const branch = add(new THREE.CylinderGeometry(0.5, 0.7, 16, 6), lam(0x5a3a20), 2, -0.6, -0.4); branch.rotation.z = Math.PI / 2 - 0.08;
    for (const [x, y, z, r] of [[-5, 3, -4, 3], [5, 4, -5, 3.6], [0, 6, -6, 4], [-7, -2, -3, 2.6], [7, -1, -4, 2.8]]) this.backdrop.push(add(new THREE.IcosahedronGeometry(r, 0), lam(0x2f8a40), x, y, z));
    this.sky = scene.background;
    add(new THREE.TorusGeometry(2.1, 0.6, 5, 9), lam(0x8a6a3a), 0, 0.5, 0).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(2.1, 1.6, 0.5, 9), lam(0x6a4e28), 0, 0.2, 0);
    // Three chicks, all mouth.
    const ball = new THREE.SphereGeometry(1, 7, 5);
    this.chicks = [-1.1, 0, 1.1].map((x, i) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(ball, lam(0xf0d048)); body.scale.set(0.62, 0.7, 0.62);
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 4), lam(0xf08020)), bottom = top.clone();
      top.position.set(0, 0.55, 0.3); bottom.position.set(0, 0.45, 0.3); bottom.rotation.x = Math.PI;
      for (const ex of [-0.22, 0.22]) { const e = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: 0x101010 })); e.scale.setScalar(0.07); e.position.set(ex, 0.3, 0.52); g.add(e); }
      g.add(body, top, bottom);
      g.position.set(x, 1.1, i === 1 ? 0.5 : 0);
      g.userData = { top, bottom };
      scene.add(g);
      return g;
    });
    this.parent = makeBird(5.5);
    this.parent.visible = false;
    scene.add(this.parent);
    // The worm in the parent's beak: a short string of blobs, coloured for whoever it was.
    this.wormMat = lam(0xe88aa0);
    this.worm = Array.from({ length: 7 }, (_, i) => { const m = new THREE.Mesh(ball, this.wormMat); m.scale.setScalar(0.2 - i * 0.012); m.visible = false; scene.add(m); return m; });
    this.queue = []; this.now = null; this.fed = 0; this.onGulp = null;
    // Once the first worm has been fed, the view turns to look down on the race from the nest: the race is drawn first,
    // and the nest, its branch and the chicks are drawn over it, in the way. watching says that's so.
    this.watching = false;
    this.raceCam = new THREE.PerspectiveCamera(52, 4 / 3, 0.5, 500);
    this.eye = new THREE.Vector3();
  }

  // Another worm for the chicks.
  feed(color) { this.queue.push(color); }

  // From now on: no sky and no tree behind the nest (the race is there instead), and the camera sits behind the chicks
  // looking out over their heads, so they fill the bottom of the picture.
  setWatching() {
    this.watching = true;
    this.scene.background = null;
    for (const m of this.backdrop) m.visible = false;
    this.camera.position.set(0.4, 2.6, 5.6); this.camera.lookAt(0, 2.9, 0); this.camera.updateProjectionMatrix();
  }

  // Points the camera that looks down on the race: from high up to one side, at the middle of the worms still racing.
  watch(race, dt) {
    let x = 0, z = 0, n = 0;
    for (const w of race.worms) if (!w.out) { x += w.x; z += w.z; n++; }
    if (!n) return;
    const k = 1 - Math.exp(-dt * 1.5);
    this.eye.x += (x / n - this.eye.x) * k; this.eye.z += (z / n - this.eye.z) * k;
    this.raceCam.position.set(this.eye.x + 16, 30, this.eye.z + 34);
    this.raceCam.lookAt(this.eye.x, 0, this.eye.z);
  }

  update(time, dt) {
    if (!this.now && this.queue.length) { this.now = { t: 0, chick: this.fed++ % 3 }; this.wormMat.color.setHex(this.queue.shift()); }
    const f = this.now;
    this.chicks.forEach((c, i) => {
      // They cheep (beaks opening and shutting) all the time, and gape wide when food's coming.
      const eating = f && f.chick === i, open = eating && f.t < 3.4 ? 0.9 : 0.25 + 0.25 * Math.sin(time * 7 + i * 2);
      c.userData.top.rotation.x = -open; c.userData.bottom.rotation.x = Math.PI + open;
      c.position.y = 1.1 + 0.08 * Math.sin(time * 9 + i * 1.7) + (eating && f.t > 3.4 && f.t < 3.9 ? 0.25 * Math.sin((f.t - 3.4) * Math.PI * 2) : 0);
    });
    this.parent.visible = !!f;
    this.worm.forEach((m) => { m.visible = !!f && f.t < 3.4; });
    if (!f) return;
    f.t += dt;
    // The parent flies in, hovers over a chick, drops the worm in, and leaves.
    const c = this.chicks[f.chick].position, inK = Math.min(1, f.t / 2), outK = Math.max(0, (f.t - 4) / 2), e = 1 - (1 - inK) ** 2;
    const px = c.x - 9 * (1 - e) + 10 * outK * outK, py = 3.6 + 5 * (1 - e) + 5 * outK * outK;
    this.parent.position.set(px, py + 0.15 * Math.sin(time * 12), c.z - 0.2);
    this.parent.rotation.y = Math.PI / 2 - 0.5;
    flap(this.parent, time, 14);
    const drop = Math.max(0, Math.min(1, (f.t - 2.6) / 0.8));
    this.worm.forEach((m, i) => {
      const hang = 0.26 * i;
      m.position.set(px + 1.6 + 0.12 * Math.sin(time * 11 + i), py + 0.4 - hang - drop * (py - c.y - 0.2 - hang * 0.5), c.z + 0.1);
    });
    if (f.t > 3.4 && !f.gulped) { f.gulped = true; if (this.onGulp) this.onGulp(); }
    if (f.t > 6.2) { this.now = null; this.setWatching(); }
  }
}
