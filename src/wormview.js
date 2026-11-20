// How a worm looks: a chain of ten blobs dragged behind the head, with a different
// wobble laid over it for each action. None of this affects where the worm goes.
import * as THREE from '../vendor/three.module.min.js';
import { CHARS } from './characters.js';
import { centreNear } from './sim/track.js';
import { FALL_TIME, DROP_PART, OUT_TIME, LIE_PART, BITE_TIME, PLASTER_PART, carried } from './sim/events.js';

const SEGS = 10, GAP = 0.5;
const ANIM = 0.65; // seconds one press's wobble lasts, however short the lunge under it
const BALL = new THREE.SphereGeometry(1, 7, 5);
const DISC = new THREE.CircleGeometry(1, 8);
const SPARK = new THREE.OctahedronGeometry(1, 0);
const BROWN = new THREE.Color(0x7a4a22), FUR = new THREE.Color(0x2e2420);
const SHADOW = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });

// lat: side-to-side wave (size, speed). vert: up-and-down wave. hop: how high it leaves the ground.
// lag: how much later each blob hops than the one in front. jit: random shaking.
const STYLES = {
  SQUIRM:   { lat: 0.35, latF: 18, vert: 0,    vertF: 0,  hop: 0.25, lag: 0.02, jit: 0 },
  WIGGLE:   { lat: 0.5,  latF: 32, vert: 0,    vertF: 0,  hop: 0.08, lag: 0,    jit: 0 },
  UNDULATE: { lat: 0,    latF: 0,  vert: 0.7,  vertF: 14, hop: 0.1,  lag: 0,    jit: 0 },
  FLOP:     { lat: 0.1,  latF: 8,  vert: 0,    vertF: 0,  hop: 1.9,  lag: 0.03, jit: 0 },
  WRITHE:   { lat: 0.6,  latF: 9,  vert: 0.4,  vertF: 9,  hop: 0.2,  lag: 0.02, jit: 0 },
  THRASH:   { lat: 0.75, latF: 42, vert: 0.3,  vertF: 37, hop: 0.5,  lag: 0,    jit: 0.08 },
  LURCH:    { lat: 0.05, latF: 6,  vert: 0,    vertF: 0,  hop: 0.8,  lag: 0.07, jit: 0 },
  SPASM:    { lat: 0.2,  latF: 25, vert: 0.2,  vertF: 31, hop: 1.0,  lag: 0.01, jit: 0.25 },
};

function accessory(kind, head, lam) {
  const add = (geo, color, x, y, z, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, lam(color));
    m.position.set(x, y, z); m.rotation.set(rx, 0, rz);
    head.add(m);
    return m;
  };
  if (kind === 'tophat') {
    add(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 8), 0x181818, 0, 0.42, 0);
    add(new THREE.CylinderGeometry(0.26, 0.26, 0.42, 8), 0x181818, 0, 0.64, 0);
  } else if (kind === 'bow') {
    add(new THREE.ConeGeometry(0.2, 0.34, 4), 0xf04890, -0.17, 0.5, 0, 0, -Math.PI / 2);
    add(new THREE.ConeGeometry(0.2, 0.34, 4), 0xf04890, 0.17, 0.5, 0, 0, Math.PI / 2);
  } else if (kind === 'sprout') {
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 4), 0x406020, 0, 0.55, 0);
    add(new THREE.ConeGeometry(0.14, 0.34, 4), 0x48b030, 0.14, 0.72, 0, 0, -1.1);
  } else if (kind === 'horns') {
    add(new THREE.ConeGeometry(0.1, 0.36, 4), 0xf0e8c0, -0.22, 0.5, -0.05, 0, 0.35);
    add(new THREE.ConeGeometry(0.1, 0.36, 4), 0xf0e8c0, 0.22, 0.5, -0.05, 0, -0.35);
  } else if (kind === 'stache') {
    add(new THREE.ConeGeometry(0.1, 0.36, 4), 0x201008, -0.17, -0.05, 0.42, 0, Math.PI / 2 + 0.3);
    add(new THREE.ConeGeometry(0.1, 0.36, 4), 0x201008, 0.17, -0.05, 0.42, 0, -Math.PI / 2 - 0.3);
  }
}

// Each worm's own way of celebrating once it's finished. Given a blob's number (0 is the head), the seconds
// since it finished and the blob's size, each says where that blob goes, measured from where the worm stopped.
const VICTORY = [
  // Worm: chases its own tail round and round.
  (i, t, r) => { const a = t * 4 - i * 0.628; return [0.8 * Math.cos(a), r, 0.8 * Math.sin(a)]; },
  // Green Worm: stands on its tail and sways.
  (i, t, r) => [0.5 * Math.sin(t * 5 + i * 0.4) * (1 - i / 9), r + (9 - i) * 0.4, 0],
  // Wormst: rears up and takes bow after bow.
  (i, t, r) => {
    if (i >= 5) return [0, r, -(i - 5) * GAP];
    const bend = (0.5 - 0.5 * Math.cos(t * 3)) * 1.7;
    let y = r, z = 0;
    for (let j = 4; j >= i; j--) { const a = (bend * (5 - j)) / 5; y += Math.cos(a) * GAP; z += Math.sin(a) * GAP; }
    return [0, y, z];
  },
  // Squirmt: bounces on the spot like a spring, stiff as a board.
  (i, t, r) => [(i - 4.5) * GAP, r + Math.abs(Math.sin(t * 6 - i * 0.08)) * 2.2, 0],
  // Flopple: flops over one way, then the other.
  (i, t, r) => { const u = (t * 1.5) % 1, side = Math.floor(t * 1.5) % 2 ? 1 : -1; return [(i - 4.5) * GAP, r + Math.sin(Math.PI * u) * 1.6 * Math.sin((Math.PI * i) / 9), side * (0.9 - 1.8 * u) * Math.sin((Math.PI * i) / 9)]; },
  // Wyrm: takes off and circles overhead like the dragon it thinks it is.
  (i, t, r) => { const a = t * 3 - i * 0.45, up = Math.min(1, t / 1.5); return [1.3 * Math.cos(a), r + up * (2.4 + 0.7 * Math.sin(t * 2)) - i * 0.1 * up, 1.3 * Math.sin(a)]; },
  // Morm: does the worm. Obviously.
  (i, t, r) => [(i - 4.5) * GAP, r + 0.9 * (1 + Math.sin(t * 7 - i * 0.9)), 0],
  // Green Morm: spins flat like a helicopter blade, hopping.
  (i, t, r) => { const a = t * 7, d = (i - 4.5) * GAP; return [d * Math.cos(a), r + 0.3 + 0.7 * Math.abs(Math.sin(t * 3.5)), d * Math.sin(a)]; },
];

export class WormView {
  constructor(char, scene) {
    this.kind = Math.max(0, CHARS.indexOf(char));
    const lam = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
    const base = new THREE.Color(char.color);
    const mats = [lam(base), lam(base.clone().multiplyScalar(0.82)), lam(base.clone().lerp(new THREE.Color(0xffffff), 0.35))];
    this.mats = mats; this.base = mats.map((m) => m.color.clone()); this.burnt = 0;
    this.group = new THREE.Group();
    this.px = new Float32Array(SEGS); this.pz = new Float32Array(SEGS);
    this.rad = []; this.meshes = []; this.shadows = []; this.eyes = [];
    for (let i = 0; i < SEGS; i++) {
      const r = 0.46 * (i === 0 ? 1.08 : 1 - 0.03 * i) * (i >= SEGS - 2 ? 0.8 - 0.2 * (i - SEGS + 2) : 1);
      this.rad.push(r);
      let m;
      if (i === 0) {
        m = new THREE.Group();
        const ball = new THREE.Mesh(BALL, mats[0]);
        m.add(ball);
        for (const s of [-1, 1]) {
          const eye = new THREE.Mesh(BALL, new THREE.MeshLambertMaterial({ color: 0xffffff }));
          eye.scale.setScalar(0.3); eye.position.set(s * 0.38, 0.42, 0.7);
          const pupil = new THREE.Mesh(BALL, new THREE.MeshBasicMaterial({ color: 0x101010 }));
          pupil.scale.setScalar(0.15); pupil.position.set(s * 0.4, 0.46, 0.95);
          m.add(eye, pupil);
          this.eyes.push(eye);
        }
        // Accessories are built at world size, so undo the head's own scale for them.
        const accG = new THREE.Group();
        accG.scale.setScalar(1 / r);
        accessory(char.acc, accG, lam);
        m.add(accG);
        // What the blood moon gives it: ears, a snout with fangs, and a clawed paw each side. Hidden until then.
        const kit = this.wolfKit = new THREE.Group(), fur = lam(0x2e2420), bone = lam(0xf4f0e0);
        const put = (geo, mat, x, y, z, rx = 0, rz = 0) => { const p = new THREE.Mesh(geo, mat); p.position.set(x, y, z); p.rotation.set(rx, 0, rz); kit.add(p); };
        for (const s of [-1, 1]) {
          put(new THREE.ConeGeometry(0.16, 0.42, 4), fur, s * 0.26, 0.52, -0.08, 0, -s * 0.25);            // ear
          put(new THREE.ConeGeometry(0.05, 0.2, 4), bone, s * 0.1, -0.12, 0.72, Math.PI);                   // fang
          put(new THREE.BoxGeometry(0.2, 0.2, 0.55), fur, s * 0.6, -0.1, 0.3);                              // paw
          for (const c of [-0.07, 0, 0.07]) put(new THREE.ConeGeometry(0.035, 0.22, 4), bone, s * 0.6 + c, -0.1, 0.66, Math.PI / 2); // claws
        }
        put(new THREE.ConeGeometry(0.22, 0.5, 5), fur, 0, 0.02, 0.6, Math.PI / 2);                           // snout
        kit.scale.setScalar(1 / r); kit.visible = false;
        m.add(kit);
      } else {
        m = new THREE.Mesh(BALL, mats[i === 3 ? 2 : i % 2]);
        if (i === 4) {
          // The plaster the hand sticks on a bitten worm.
          const strip = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 0.8), new THREE.MeshLambertMaterial({ color: 0xe8c090 }));
          const pad = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 0.7), new THREE.MeshLambertMaterial({ color: 0xf8f0e0 }));
          this.plaster = new THREE.Group();
          this.plaster.add(strip, pad); this.plaster.position.y = 0.92; this.plaster.visible = false;
          m.add(this.plaster);
        }
      }
      m.scale.setScalar(r);
      this.group.add(m); this.meshes.push(m);
      const sh = new THREE.Mesh(DISC, SHADOW);
      sh.rotation.x = -Math.PI / 2;
      this.group.add(sh); this.shadows.push(sh);
    }
    // Four small markers that show an item at work on this worm: stars circling a stunned head,
    // sparkles round a starred worm, flames behind a boosted one.
    this.auraMat = new THREE.MeshBasicMaterial({ color: 0xffe24a });
    this.aura = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(SPARK, this.auraMat); m.visible = false; this.group.add(m); return m; });
    scene.add(this.group);
  }

  // Lays the body out in a straight line behind the head.
  reset(w) {
    this.at = ANIM; this.hopT = 0; this.seen = w.count; this.act = null; this.hopMul = 1; this.lastT = null;
    this.taps = w.taps; this.tw = 0; this.hurts = w.hurts || 0; this.flash = 0; this.winT = 0;
    for (let i = 0; i < SEGS; i++) { this.px[i] = w.x - Math.sin(w.aim) * GAP * i; this.pz[i] = w.z - Math.cos(w.aim) * GAP * i; }
  }

  // A worm that has finished stops where it is and does its own victory dance until the race ends.
  celebrate(w, time) {
    const dt = this.lastT === null ? 0 : Math.min(0.1, Math.max(0, time - this.lastT));
    this.lastT = time; this.winT += dt;
    for (const m of this.mats) m.emissive.setRGB(0, 0, 0);
    for (const m of this.aura) m.visible = false;
    this.wolfKit.visible = false; this.plaster.visible = w.patch > 0; this.meshes[0].rotation.x = 0; this.meshes[0].rotation.z = 0;
    const pose = VICTORY[this.kind];
    let hx = 0, hz = 1;
    for (let i = 0; i < SEGS; i++) {
      const [x, y, z] = pose(i, this.winT, this.rad[i]), m = this.meshes[i], sh = this.shadows[i];
      m.position.set(w.x + x, y, w.z + z); m.scale.setScalar(this.rad[i]);
      this.px[i] = w.x + x; this.pz[i] = w.z + z;
      if (i === 1) { hx = this.px[0] - this.px[1]; hz = this.pz[0] - this.pz[1]; }
      sh.visible = true; sh.position.set(w.x + x, 0.04, w.z + z); sh.scale.setScalar(this.rad[i] * Math.max(0.35, 1 - (y - this.rad[i]) * 0.25));
    }
    // The head faces the way the body leads, or the camera's usual side when it's standing straight up.
    this.meshes[0].rotation.y = Math.hypot(hx, hz) > 0.05 ? Math.atan2(hx, hz) : 0;
  }

  // track: the race's track, to know where a fallen worm will be put back.
  update(w, time, track) {
    // A worm the bird has taken isn't there any more.
    this.group.visible = !w.out;
    if (w.out) return;
    if (w.finished) return this.celebrate(w, time);
    // (A were-wolf-worm is bigger. While it's changing, to or from, it flickers between the two.)
    const wolf = w.wolf > 0 ? !(w.howl > 0) || Math.floor(time * 14) % 2 === 0 : w.howl > 0 && Math.floor(time * 14) % 2 === 0;
    const small = (w.shrunk > 0 ? 0.55 : 1) * (wolf ? 1.3 : 1), flat = w.flat > 0 || (w.fall > 0 && w.dead), gap = GAP * small;
    const bitten = w.fall > 0 && w.bit;
    this.wolfKit.visible = wolf;
    this.plaster.visible = (bitten && BITE_TIME - w.fall >= PLASTER_PART) || w.patch > 0;
    for (const e of this.eyes) e.material.color.setHex(wolf ? 0xff2020 : 0xffffff);
    const back = w.fall > 0 && !w.dead && !w.bit && track ? centreNear(track, w.x, w.z) : null;
    let held = false, onBack = false, rear = false, hx = back ? back.x : 0, hz = back ? back.z : 0;
    const px = this.px, pz = this.pz;
    px[0] = w.x; pz[0] = w.z;
    for (let i = 1; i < SEGS; i++) {
      let dx = px[i] - px[i - 1], dz = pz[i] - pz[i - 1], l = Math.hypot(dx, dz);
      if (l < 1e-5) { dx = 0; dz = -1; l = 1; }
      px[i] = px[i - 1] + (dx / l) * gap; pz[i] = pz[i - 1] + (dz / l) * gap;
    }
    // The wobble runs on its own clock. A press starts it; pressing again while it's still going
    // changes its style and keeps it going (and bouncing) rather than starting it over.
    const dt = this.lastT === null ? 0 : Math.min(0.1, Math.max(0, time - this.lastT));
    this.lastT = time;
    this.at += dt; this.hopT += dt / ANIM;
    // Every press, counted or not, gives a small shiver that dies away in a fifth of a second.
    if (w.taps !== this.taps) { this.taps = w.taps; this.tw = 1; }
    this.tw = Math.max(0, this.tw - dt * 5);
    const tw = this.tw * this.tw;
    // Colour: a star cycles through the rainbow, being hurt flashes red, and a baked worm stays reddened.
    if ((w.hurts || 0) !== this.hurts) { this.hurts = w.hurts || 0; this.flash = 0.3; }
    this.flash = Math.max(0, this.flash - dt);
    const glow = this.mats[0].emissive;
    if (w.star > 0) glow.setHSL((time * 2) % 1, 1, 0.45);
    else if (this.flash > 0 && Math.floor(this.flash * 20) % 2 === 0) glow.setRGB(1, 0, 0);
    else if (w.shrunk > 0) glow.setRGB(0.05, 0.12, 0.4); // (struck by lightning: small and a bit blue)
    else if (w.slow > 0) glow.setRGB(0.25, 0.3, 0.02);    // (stuck in glue: a sickly yellow-green)
    else glow.setRGB(0.18 * Math.min(1, w.heat || 0), 0, 0);
    // Sun-baked worms go browner the more baked they are, and browner still once it's killed them.
    // (And a wolf's coat is dark fur.)
    const burnt = wolf ? 2 : w.fall > 0 && w.dead ? 0.75 : Math.round(0.5 * Math.min(1, w.heat || 0) * 20) / 20;
    if (burnt !== this.burnt) { this.burnt = burnt; this.mats.forEach((m, k) => m.color.copy(this.base[k]).lerp(burnt === 2 ? FUR : BROWN, burnt === 2 ? 0.82 : burnt)); }
    this.mats[1].emissive.copy(glow); this.mats[2].emissive.copy(glow);
    if (w.count !== this.seen) {
      this.seen = w.count; this.act = w.action;
      if (this.at < ANIM) this.at = Math.min(this.at, 0.35 * ANIM);
      else {
        this.at = 0; this.hopT = 0;
        const q = Math.sin(w.count * 12.9898 + w.idx * 78.233) * 43758.5453;
        this.hopMul = 0.6 + 0.8 * (q - Math.floor(q));
      }
    }
    const on = this.at < ANIM && this.act, st = on ? STYLES[this.act] : null, u = on ? this.at / ANIM : 0;
    const env = on ? Math.sin(Math.PI * u) : 0, hopMul = this.hopMul;
    for (let i = 0; i < SEGS; i++) {
      const a = Math.max(i, 1);
      let dx = px[a - 1] - px[a], dz = pz[a - 1] - pz[a];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      let lat = 0.05 * Math.sin(time * 3 - i * 0.8 + w.idx) + tw * 0.13 * Math.sin(time * 55 - i * 1.7) + (w.stun > 0 ? 0.4 * Math.sin(time * 26 - i * 1.4) : 0), y = this.rad[i] + tw * 0.07 * (1 + Math.sin(time * 47 - i * 2.1));
      if (st) {
        lat += env * st.lat * Math.sin(time * st.latF - i * 0.9);
        const ph = this.hopT - i * st.lag;
        if (ph > 0) y += st.hop * hopMul * Math.abs(Math.sin(Math.PI * ph)) * Math.min(1, env * 3);
        y += env * st.vert * (0.5 + 0.5 * Math.sin(time * st.vertF - i * 1.1));
        if (st.jit) { lat += env * st.jit * Math.sin(time * 91 + i * 7.3); y += env * st.jit * (0.5 + 0.5 * Math.sin(time * 77 + i * 5.1)); }
      }
      // What's happened to it shows: shrunk by lightning, squashed flat, dropping out of sight, or dangling from a bird.
      const big = small * this.rad[i];
      if (flat) y = big * 0.2; else y = y * small;
      if (bitten) { y = big; lat = 0.04 * Math.sin(time * 30 + i); onBack = true; }   // bitten: it lies there, quivering
      else if (w.wolf > 0 && !(w.howl > 0)) y += 0.4 * Math.abs(Math.sin(time * 14 - i * 0.7)); // the wolf bounds along
      // Rearing up to change: the front of it stands straight up off the fifth blob, head thrown back, shaking.
      if (w.howl > 0 && i < 4) { rear = true; y = big + (4 - i) * gap * 0.92; lat = 0.06 * Math.sin(time * 45 + i * 2); }
      if (w.fall > 0 && !w.dead && !w.bit) {
        // Fallen: it drops away, then comes back down pinched in a hand, hanging by its head over the middle of the road.
        if (w.pit) {
          const e = FALL_TIME - w.fall;
          if (e < DROP_PART) y -= e * e * 30;
          else { held = true; y = Math.max(big, 10 - 6.6 * ((e - DROP_PART) / (FALL_TIME - DROP_PART)) - i * 0.36); }
        } else {
          // Over the wall: it lies on its back, squirming, until the hand lifts it and carries it home.
          const e = OUT_TIME - w.fall;
          if (e < LIE_PART) { y = big; lat = 0.3 * Math.sin(time * 16 - i * 1.1); onBack = true; }
          else { held = true; const c = carried(w, back || w, (e - LIE_PART) / (OUT_TIME - LIE_PART)); hx = c[0]; hz = c[1]; y = Math.max(big, c[2] - i * 0.36); }
        }
      }
      if (w.lift > 0) y = Math.max(y, w.lift - i * 0.45 * Math.min(1, w.lift / 3));
      let x = px[i] + dz * lat, z = pz[i] - dx * lat;
      const m = this.meshes[i];
      if (held && back) { x = hx + 0.1 * Math.sin(time * 9 + i); z = hz; }
      if (rear && i < 4) { x = px[4] + lat; z = pz[4]; }
      m.position.set(x, y, z);
      m.scale.set(big * (flat ? 1.5 : 1), big * (flat ? 0.2 : 1), big * (flat ? 1.5 : 1));
      if (i === 0) { m.rotation.y = Math.atan2(dx, dz) + (w.stun > 0 ? time * 18 : 0); m.rotation.z = onBack ? 2.5 : 0; m.rotation.x = rear ? -1.1 : 0; }
      const sh = this.shadows[i], k = big * Math.max(0.4, 1 - (y - big) * 0.3);
      sh.visible = !(w.fall > 0) && !(w.lift > 0);
      sh.position.set(x, 0.04, z); sh.scale.setScalar(k);
    }
    const mode = w.fall > 0 || w.lift > 0 ? null : w.stun > 0 ? 'stun' : w.star > 0 ? 'star' : w.boost > 0 ? 'boost' : null;
    const head = this.meshes[0].position, mid = this.meshes[4].position, tail = this.meshes[SEGS - 1].position, prev = this.meshes[SEGS - 2].position;
    this.aura.forEach((m, k) => {
      m.visible = !!mode;
      if (!mode) return;
      const a = time * (mode === 'stun' ? 7 : 5) + (k * Math.PI) / 2;
      if (mode === 'stun') { m.position.set(head.x + Math.cos(a) * 0.75, head.y + 0.75, head.z + Math.sin(a) * 0.75); m.scale.setScalar(0.16); }
      else if (mode === 'star') { m.position.set(mid.x + Math.cos(a) * 1.7, mid.y + 0.5 + 0.5 * Math.sin(time * 9 + k), mid.z + Math.sin(a) * 1.7); m.scale.setScalar(0.2); }
      else {
        const dx = tail.x - prev.x, dz = tail.z - prev.z, l = Math.hypot(dx, dz) || 1, d = 0.5 + k * 0.42 + 0.12 * Math.sin(time * 40 + k * 2);
        m.position.set(tail.x + (dx / l) * d, tail.y + 0.1 * Math.sin(time * 33 + k), tail.z + (dz / l) * d);
        m.scale.setScalar((0.34 - k * 0.06) * (0.8 + 0.3 * Math.sin(time * 50 + k)));
      }
      m.rotation.set(time * 6, time * 5, 0);
    });
    if (mode) this.auraMat.color.setHex(mode === 'boost' ? (Math.floor(time * 20) % 2 ? 0xff7a20 : 0xffd040) : mode === 'star' ? 0xffffff : 0xffe24a);
  }
}
