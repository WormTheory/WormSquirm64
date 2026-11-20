// How a worm looks: a chain of ten blobs dragged behind the head, with a different
// wobble laid over it for each action. None of this affects where the worm goes.
import * as THREE from '../vendor/three.module.min.js';

const SEGS = 10, GAP = 0.5;
const ANIM = 0.65; // seconds one press's wobble lasts, however short the lunge under it
const BALL = new THREE.SphereGeometry(1, 7, 5);
const DISC = new THREE.CircleGeometry(1, 8);
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

export class WormView {
  constructor(char, scene) {
    const lam = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
    const base = new THREE.Color(char.color);
    const mats = [lam(base), lam(base.clone().multiplyScalar(0.82)), lam(base.clone().lerp(new THREE.Color(0xffffff), 0.35))];
    this.group = new THREE.Group();
    this.px = new Float32Array(SEGS); this.pz = new Float32Array(SEGS);
    this.rad = []; this.meshes = []; this.shadows = [];
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
        }
        // Accessories are built at world size, so undo the head's own scale for them.
        const accG = new THREE.Group();
        accG.scale.setScalar(1 / r);
        accessory(char.acc, accG, lam);
        m.add(accG);
      } else {
        m = new THREE.Mesh(BALL, mats[i === 3 ? 2 : i % 2]);
      }
      m.scale.setScalar(r);
      this.group.add(m); this.meshes.push(m);
      const sh = new THREE.Mesh(DISC, SHADOW);
      sh.rotation.x = -Math.PI / 2;
      this.group.add(sh); this.shadows.push(sh);
    }
    scene.add(this.group);
  }

  // Lays the body out in a straight line behind the head.
  reset(w) {
    this.at = ANIM; this.hopT = 0; this.seen = w.count; this.act = null; this.hopMul = 1; this.lastT = null;
    for (let i = 0; i < SEGS; i++) { this.px[i] = w.x - Math.sin(w.aim) * GAP * i; this.pz[i] = w.z - Math.cos(w.aim) * GAP * i; }
  }

  update(w, time) {
    const px = this.px, pz = this.pz;
    px[0] = w.x; pz[0] = w.z;
    for (let i = 1; i < SEGS; i++) {
      let dx = px[i] - px[i - 1], dz = pz[i] - pz[i - 1], l = Math.hypot(dx, dz);
      if (l < 1e-5) { dx = 0; dz = -1; l = 1; }
      px[i] = px[i - 1] + (dx / l) * GAP; pz[i] = pz[i - 1] + (dz / l) * GAP;
    }
    // The wobble runs on its own clock. A press starts it; pressing again while it's still going
    // changes its style and keeps it going (and bouncing) rather than starting it over.
    const dt = this.lastT === null ? 0 : Math.min(0.1, Math.max(0, time - this.lastT));
    this.lastT = time;
    this.at += dt; this.hopT += dt / ANIM;
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
      let lat = 0.05 * Math.sin(time * 3 - i * 0.8 + w.idx), y = this.rad[i];
      if (st) {
        lat += env * st.lat * Math.sin(time * st.latF - i * 0.9);
        const ph = this.hopT - i * st.lag;
        if (ph > 0) y += st.hop * hopMul * Math.abs(Math.sin(Math.PI * ph)) * Math.min(1, env * 3);
        y += env * st.vert * (0.5 + 0.5 * Math.sin(time * st.vertF - i * 1.1));
        if (st.jit) { lat += env * st.jit * Math.sin(time * 91 + i * 7.3); y += env * st.jit * (0.5 + 0.5 * Math.sin(time * 77 + i * 5.1)); }
      }
      const x = px[i] + dz * lat, z = pz[i] - dx * lat, m = this.meshes[i];
      m.position.set(x, y, z);
      if (i === 0) m.rotation.y = Math.atan2(dx, dz);
      const sh = this.shadows[i], k = this.rad[i] * Math.max(0.4, 1 - (y - this.rad[i]) * 0.3);
      sh.position.set(x, 0.04, z); sh.scale.setScalar(k);
    }
  }
}
