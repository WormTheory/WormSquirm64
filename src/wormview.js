// How a worm looks: a chain of ten blobs dragged behind the head, with a different
// wobble laid over it for each action. None of this affects where the worm goes.
import * as THREE from '../vendor/three.module.min.js';
import { CHARS } from './characters.js';
import { GENE, segsOf, girthOf, noGenes } from './sim/genes.js';

const NO_GENES = noGenes();
import { centreNear } from './sim/track.js';

// The red A, drawn once and shared.
let scarlet = null;
function scarletTex() {
  if (scarlet) return scarlet;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.font = '900 30px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 5; g.strokeStyle = '#300000'; g.strokeText('A', 16, 18);
  g.fillStyle = '#e01010'; g.fillText('A', 16, 18);
  scarlet = new THREE.CanvasTexture(c);
  scarlet.magFilter = THREE.NearestFilter; scarlet.colorSpace = THREE.SRGBColorSpace;
  return scarlet;
}
import { FALL_TIME, DROP_PART, OUT_TIME, LIE_PART, BITE_TIME, BITE_LIE, PLASTER_PART, carried } from './sim/events.js';

const SEGS = 10, GAP = 0.5;
const ANIM = 0.65; // seconds one press's wobble lasts, however short the lunge under it
const BALL = new THREE.SphereGeometry(1, 7, 5);
const DISC = new THREE.CircleGeometry(1, 8);
const BOX = new THREE.BoxGeometry(1, 1, 1), CONE = new THREE.ConeGeometry(1, 1, 5), RING = new THREE.TorusGeometry(1, 0.09, 4, 9);
// A bat's wing: a ragged triangle, drawn flat and stood up by whoever uses it.
const WING = (() => { const sh = new THREE.Shape(); sh.moveTo(-0.5, 0.3); sh.lineTo(0.5, 0.42); sh.lineTo(0.36, 0.05); sh.lineTo(0.22, 0.16); sh.lineTo(0.08, -0.18); sh.lineTo(-0.1, 0.06); sh.lineTo(-0.3, -0.25); sh.lineTo(-0.5, 0.3); return new THREE.ShapeGeometry(sh); })();
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

// Where plasters go, in the order they're stuck on: which ball of the body, and how far round its side. (Not the
// fourth ball, which is the scarlet letter's, nor the second, which has Worm X's mark: nothing sits on anything else.)
const PLASTER_AT = [[4, 0], [2, 0], [6, 0], [5, 0.95], [7, 0], [5, -0.95], [8, 0]];

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
  } else if (kind === 'mask') {
    // Worm X: a black hood over the top and back of the head (the eyes show through it), with a white band round it.
    const hood = add(BALL, 0x141418, 0, 0.1, -0.15); hood.scale.set(0.57, 0.55, 0.57);
    add(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 9), 0xf4f4f4, 0, 0.04, -0.15); // (the white band)
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
  // Worm X: signs his name. He slithers an X on the ground over and over, one stroke, then round the end and back
  // along the other, his body crossing itself in the middle, and lifts his head at the end of each stroke.
  (i, t, r) => {
    const A = 1.1, D = 2 * Math.SQRT2 * A, E = 2 * A, LOOP = 2 * D + 2 * E;
    const d = (((t * 3.2 - i * GAP) % LOOP) + LOOP) % LOOP; // how far round the loop this ball has got
    let x, z, end = 0;
    if (d < D) { const u = d / D; x = -A + 2 * A * u; z = -A + 2 * A * u; end = u; }                 // the first stroke
    else if (d < D + E) { const u = (d - D) / E; x = A; z = A - 2 * A * u; }                           // round the end
    else if (d < 2 * D + E) { const u = (d - D - E) / D; x = A - 2 * A * u; z = -A + 2 * A * u; end = u; } // the second stroke
    else { const u = (d - 2 * D - E) / E; x = -A; z = A - 2 * A * u; }                                 // and back to the start
    return [x, r + (i < 3 ? (3 - i) * 0.3 * Math.max(0, end * 4 - 3) : 0), z];
  },
];

export class WormView {
  constructor(char, scene) {
    this.kind = char.kind !== undefined ? char.kind : Math.max(0, CHARS.indexOf(char));
    this.n = SEGS; this.spare = []; this.spareSh = []; this.extras = []; this.sig = ''; this.girth = 1; this.stand = 0;
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
        this.accG = accG;
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
        m.userData.body = true;
        // The plasters the hand sticks on a bitten worm: one more each time, each in a place of its own.
        PLASTER_AT.forEach(([seg, round], k) => {
          if (seg !== i) return;
          const strip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.62), new THREE.MeshLambertMaterial({ color: 0xe8c090 }));
          const pad = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 0.55), new THREE.MeshLambertMaterial({ color: 0xf8f0e0 }));
          const turn = new THREE.Group(), lean = new THREE.Group(), p = new THREE.Group();
          p.add(strip, pad); p.position.y = 0.92; p.rotation.y = (k % 2 ? -1 : 1) * (0.25 + 0.2 * k);
          lean.rotation.z = round; lean.add(p); turn.add(lean); turn.visible = false; turn.userData.seg = seg;
          m.add(turn);
          (this.plasters || (this.plasters = []))[k] = turn;
        });
        if (i === 1 && char.acc === 'mask') {
          // Worm X's mark: a black X on a yellow patch, on his back just behind the head.
          const patch = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 8), new THREE.MeshLambertMaterial({ color: 0xf8d020 }));
          patch.position.y = 0.9; m.add(patch);
          for (const s of [-1, 1]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 1), new THREE.MeshLambertMaterial({ color: 0x101010 })); bar.position.y = 0.93; bar.rotation.y = s * 0.78; m.add(bar); }
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
    // A bubble: a see-through ball round the front of a worm that's protected.
    // The scarlet letter: a red A made of three strips, stuck flat on the worm's back (on the fourth ball, so it
    // goes wherever that goes).
    this.letter = new THREE.Group();
    const red = new THREE.MeshLambertMaterial({ color: 0xe01818 });
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 1.25), red); leg.position.set(s * 0.22, 0, 0); leg.rotation.y = s * 0.35; this.letter.add(leg); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.2), red); bar.position.set(0, 0, 0.15); this.letter.add(bar);
    this.letter.position.y = 0.93; this.letter.visible = false;
    this.meshes[3].add(this.letter);
    this.bubble = new THREE.Mesh(BALL, new THREE.MeshLambertMaterial({ color: 0xa8e0ff, transparent: true, opacity: 0.32, depthWrite: false }));
    this.bubble.visible = false;
    this.group.add(this.bubble);
    this.auraMat = new THREE.MeshBasicMaterial({ color: 0xffe24a });
    this.aura = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(SPARK, this.auraMat); m.visible = false; this.group.add(m); return m; });
    scene.add(this.group);
  }

  // Lays the body out in a straight line behind the head.
  // Makes the model match the worm: as long as its mutations have made it (half as long again for each), and bare
  // of its hat if it's a piece that was cut off, or a clone.
  fit(w) {
    const mut = w.mut || NO_GENES; // (a worm drawn for a portrait has none)
    this.accG.visible = !w.second;
    this.girth = girthOf(mut);
    // (On legs like a person's or a horse's it stands up off the ground.)
    this.stand = mut[GENE.human] || mut[GENE.horse] ? 0.7 * this.girth : 0;
    const sig = mut.join('');
    if (sig !== this.sig) { this.sig = sig; this.grow(mut); }
    const n = segsOf(mut);
    if (n < this.n) {
      // Shorter: balls come out from ahead of the two small ones at the tail, and are kept in case it grows again.
      const cut = this.n - n, at = this.n - 2 - cut;
      for (const m of this.meshes.splice(at, cut)) { m.visible = false; this.spare.push(m); }
      for (const sh of this.shadows.splice(at, cut)) { sh.visible = false; this.spareSh.push(sh); }
      const px = new Float32Array(n), pz = new Float32Array(n);
      for (let i = 0; i < n; i++) { const from = i < at ? i : i + cut; px[i] = this.px[from]; pz[i] = this.pz[from]; }
      this.px = px; this.pz = pz; this.n = n;
      this.sizes();
      return;
    }
    if (n === this.n) return;
    // New balls go in ahead of the two small ones at the tail, each starting where the tail is.
    const px = new Float32Array(n), pz = new Float32Array(n), old = this.n, tx = this.px[old - 1], tz = this.pz[old - 1];
    for (let i = 0; i < n; i++) { const from = i < old - 2 ? i : i >= n - 2 ? i - (n - old) : -1; px[i] = from < 0 ? tx : this.px[from]; pz[i] = from < 0 ? tz : this.pz[from]; }
    for (let k = old; k < n; k++) {
      const at = this.meshes.length - 2, m = this.spare.pop() || new THREE.Mesh(BALL, this.mats[at % 2]), sh = this.spareSh.pop() || new THREE.Mesh(DISC, SHADOW);
      sh.rotation.x = -Math.PI / 2; m.visible = true; sh.visible = true;
      this.group.add(m, sh);
      this.meshes.splice(at, 0, m); this.shadows.splice(at, 0, sh);
    }
    // (Laid out in a line on from where the old body stopped, so a worm lengthened while it's lying still isn't in a heap.)
    { let dx = px[old - 3] - px[Math.max(0, old - 4)], dz = pz[old - 3] - pz[Math.max(0, old - 4)]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; if (l === 1 && !dx && !dz) dz = -1;
      for (let i = old - 2; i < n; i++) { px[i] = px[i - 1] + dx * GAP; pz[i] = pz[i - 1] + dz * GAP; } }
    this.px = px; this.pz = pz; this.n = n;
    this.sizes();
  }

  // Sizes: the body tapering over the first few balls and then holding, with the same two small ones last.
  sizes() {
    const n = this.n;
    this.rad = [];
    for (let i = 0; i < n; i++) { const b = i < n - 2 ? Math.min(i, 7) : i - (n - SEGS); this.rad.push(0.46 * (b === 0 ? 1.08 : 1 - 0.03 * b) * (b >= SEGS - 2 ? 0.8 - 0.2 * (b - SEGS + 2) : 1)); }
  }

  // What mutations add to the body: legs, wings, a fin, warts, spikes, fur, more heads. Each piece hangs off one ball
  // of the body (by its number, or counted from the tail if negative) and is put there, turned to face along the
  // body, every frame; the balls themselves don't turn. Rebuilt whenever the worm's mutations change.
  grow(mut) {
    for (const a of this.extras) this.group.remove(a.obj);
    this.extras = [];
    const lam = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
    const base = this.base[0], dark = base.clone().multiplyScalar(0.55).getHex();
    const part = (g, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); g.add(m); return m; };
    const put = (seg, obj, extra = {}) => { this.group.add(obj); this.extras.push({ seg, obj, ...extra }); return obj; };
    const box = BOX, cone = CONE;
    const many = (count, most) => Math.min(most, count);
    // Spider legs: four thin black pairs, each bent at the knee. (More of the mutation, more pairs further back.)
    for (let k = 0; k < many(mut[GENE.spider], 3) * 4; k++) {
      const g = new THREE.Group(), black = lam(0x181418);
      for (const s of [-1, 1]) { const leg = new THREE.Group(); part(leg, box, black, s * 1.2, 0.25, 0, 0, 0, s * -1.0, 0.15, 1, 0.15); part(leg, box, black, s * 1.8, -0.25, 0, 0, 0, s * 0.26, 0.13, 1.6, 0.13); g.add(leg); }
      put(2 + k, g, { walk: 'spider', phase: k * 1.3 });
    }
    // A person's legs: a pair in trousers and shoes, under the middle. (More: more pairs.)
    for (let k = 0; k < many(mut[GENE.human], 4); k++) {
      const g = new THREE.Group(), cloth = lam(0x2c4a9a), shoe = lam(0x5a2a14), legs = [];
      for (const s of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(s * 0.45, -0.5, 0); part(leg, box, cloth, 0, -0.8, 0, 0, 0, 0, 0.36, 1.6, 0.36); part(leg, box, shoe, 0, -1.6, 0.18, 0, 0, 0, 0.42, 0.26, 0.8); g.add(leg); legs.push(leg); }
      put([4, 2, 6, 3][k], g, { walk: 'stride', legs, phase: k * 2 });
    }
    // A horse's legs: four, brown with dark hooves, a pair to the fore and a pair behind.
    for (let k = 0; k < many(mut[GENE.horse], 2) * 2; k++) {
      const g = new THREE.Group(), hide = lam(0x7a4a22), hoof = lam(0x1c1410), legs = [];
      for (const s of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(s * 0.5, -0.4, 0); part(leg, box, hide, 0, -0.5, 0, 0, 0, 0, 0.3, 1, 0.3); part(leg, box, hide, 0, -1.25, 0.05, 0, 0, 0, 0.22, 0.7, 0.22); part(leg, box, hoof, 0, -1.68, 0.05, 0, 0, 0, 0.32, 0.22, 0.36); g.add(leg); legs.push(leg); }
      put(k % 2 ? -3 - (k >> 1) * 2 : 2 + (k >> 1) * 2, g, { walk: 'stride', legs, phase: k * 1.6 });
    }
    // Bat wings: a dark pair that flap.
    for (let k = 0; k < many(mut[GENE.wings], 3); k++) {
      const g = new THREE.Group(), skin = new THREE.MeshLambertMaterial({ color: 0x3a2048, flatShading: true, side: THREE.DoubleSide }), wings = [];
      for (const s of [-1, 1]) { const wing = new THREE.Group(); wing.position.set(s * 0.6, 0.5, 0); part(wing, WING, skin, s * 2.6, 0, 0, -Math.PI / 2, 0, 0, s * 5.2, 3.4, 1); part(wing, box, lam(0x201028), s * 2.5, 0.03, 1.0, 0, s * -0.36, 0, 5.2, 0.14, 0.14); g.add(wing); wings.push(wing); }
      put(2 + k * 2, g, { walk: 'flap', wings, phase: k });
    }
    // A fin on its back.
    for (let k = 0; k < many(mut[GENE.fin], 4); k++) { const g = new THREE.Group(); part(g, cone, lam(0x6a7a8a), 0, 1.9, -0.3, -0.4, 0, 0, 0.2, 2.4, 1.3); put(5 + k * 2, g); }
    // Poisonous: bright warts, the colours of things that shouldn't be eaten.
    if (mut[GENE.poison]) for (let seg = 1; seg < 40; seg++) {
      const g = new THREE.Group(), wart = new THREE.MeshLambertMaterial({ color: seg % 2 ? 0xb030e0 : 0x60f020, emissive: seg % 2 ? 0x30083c : 0x103c04 });
      for (let j = 0; j < Math.min(4, 1 + mut[GENE.poison]); j++) { const a = seg * 2.4 + j * 1.9; part(g, BALL, wart, Math.sin(a) * 0.82, 0.45 + 0.35 * Math.cos(j * 2.1 + seg), Math.cos(a) * 0.5, 0, 0, 0, 0.2, 0.2, 0.2); }
      put(seg, g, { every: true });
    }
    // Spikes: pale and sharp, all down its back.
    if (mut[GENE.spikes]) for (let seg = 1; seg < 40; seg++) {
      const g = new THREE.Group(), bone = lam(0xf4f0e0);
      for (const a of mut[GENE.spikes] > 1 ? [-1.1, -0.55, 0, 0.55, 1.1] : [-0.75, 0, 0.75]) part(g, cone, bone, Math.sin(a) * 1.25, Math.cos(a) * 1.25, 0, 0, 0, -a, 0.16, 0.75, 0.16);
      put(seg, g, { every: true });
    }
    // Fur: tufts in a darker shade of its own colour, everywhere.
    if (mut[GENE.fur]) for (let seg = 0; seg < 40; seg++) {
      const g = new THREE.Group(), hair = lam(dark);
      for (let j = 0; j < Math.min(14, 6 + mut[GENE.fur] * 2); j++) { const a = -1.9 + (3.8 * ((j * 7 + seg * 3) % 11)) / 10, f = ((j * 5 + seg) % 7) / 7 - 0.5; part(g, cone, hair, Math.sin(a) * 1.02, Math.cos(a) * 1.02, f * 0.9, f * 0.9, 0, -a, 0.11, 0.42, 0.11); }
      put(seg, g, { every: true });
    }
    const every = (step, fn) => { for (let seg = 1; seg < 40; seg += step) { const g = new THREE.Group(); fn(g, seg); put(seg, g, { every: true }); } };
    // Gills: dark slits behind the head.
    if (mut[GENE.gills]) { const g = new THREE.Group(); for (const s of [-1, 1]) for (let j = 0; j < 3; j++) part(g, box, lam(0x501828), s * 0.93, 0.15, -0.3 + j * 0.3, 0, 0, s * 0.25, 0.1, 0.7, 0.08); put(1, g); }
    // A snail's shell on its back.
    for (let k = 0; k < many(mut[GENE.shell], 3); k++) { const g = new THREE.Group(); part(g, BALL, lam(0xa8743c), 0, 1.5, 0, 0, 0, 0, 0.9, 1.25, 1.35); part(g, BALL, lam(0x6a4420), 0.72, 1.5, 0, 0, 0, 0, 0.3, 0.75, 0.8); part(g, BALL, lam(0x6a4420), -0.72, 1.5, 0, 0, 0, 0, 0.3, 0.75, 0.8); put(4 + k * 2, g); }
    // Tentacles: purple arms that wave.
    for (let k = 0; k < many(mut[GENE.tentacles], 3); k++) {
      const g = new THREE.Group(), flesh = lam(0x9a4ab0), arms = [];
      for (const s of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(s * 0.8, 0.1, 0); part(arm, box, flesh, s * 0.7, 0, 0, 0, 0, 0, 1.4, 0.26, 0.26); part(arm, box, flesh, s * 1.9, 0.2, 0, 0, 0, s * 0.5, 1.2, 0.2, 0.2); part(arm, BALL, flesh, s * 2.5, 0.5, 0, 0, 0, 0, 0.2, 0.2, 0.2); g.add(arm); arms.push(arm); }
      put(3 + k * 2, g, { walk: 'flap', wings: arms, phase: k * 2 });
    }
    // A scorpion's sting, curled up over the tail.
    if (mut[GENE.stinger]) { const g = new THREE.Group(), red = lam(0x7a1c14); part(g, box, red, 0, 0.9, -0.5, 0.5, 0, 0, 0.5, 1.6, 0.5); part(g, box, red, 0, 2.0, -0.3, -0.7, 0, 0, 0.42, 1.3, 0.42); part(g, cone, lam(0x201010), 0, 2.4, 0.5, 1.9, 0, 0, 0.3, 0.9, 0.3); put(-1, g, { tail: true }); }
    // Springy: coils round it.
    if (mut[GENE.springy]) every(1, (g) => { const ring = part(g, RING, lam(0xb8c0cc), 0, 0, 0, 0, 0, 0, 1.12, 1.12, 1.12); ring.rotation.y = 0.25; });
    // Sticky: green slime dripping off it.
    if (mut[GENE.sticky]) every(1, (g, seg) => { const goo = lam(0x7ad020); for (let j = 0; j < 3; j++) { const a = seg * 1.7 + j * 2.1; part(g, BALL, goo, Math.sin(a) * 0.8, -0.55 - 0.25 * (j % 2), Math.cos(a) * 0.5, 0, 0, 0, 0.22, 0.34, 0.22); } });
    // Eyes, all the way down.
    if (mut[GENE.eyes]) every(1, (g) => { for (const s of [-1, 1]) { part(g, BALL, new THREE.MeshLambertMaterial({ color: 0xffffff }), s * 0.62, 0.72, 0, 0, 0, 0, 0.3, 0.3, 0.3); part(g, BALL, new THREE.MeshBasicMaterial({ color: 0x101010 }), s * 0.72, 0.88, 0.08, 0, 0, 0, 0.14, 0.14, 0.14); } });
    // Antlers.
    if (mut[GENE.antlers]) { const g = new THREE.Group(), horn = lam(0xa8804a); for (const s of [-1, 1]) { part(g, box, horn, s * 0.6, 1.6, 0, 0, 0, s * -0.35, 0.2, 1.8, 0.2); part(g, box, horn, s * 1.15, 2.0, 0, 0, 0, s * -1.1, 0.16, 1, 0.16); part(g, box, horn, s * 0.55, 2.45, 0, 0, 0, s * 0.6, 0.16, 0.9, 0.16); } put(0, g); }
    // Rubber: a shine on every ball.
    if (mut[GENE.rubber]) every(1, (g) => { part(g, BALL, new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.35, 0.82, 0.2, 0, 0, 0, 0.26, 0.12, 0.2); });
    // Thick skin: grey plates.
    if (mut[GENE.thick]) every(1, (g) => { part(g, BALL, lam(0x7a7a80), 0, 0.5, 0, 0, 0, 0, 1.0, 0.72, 0.8); });
    // Magnetic: a horseshoe magnet on its head.
    if (mut[GENE.magnetic]) { const g = new THREE.Group(), red = lam(0xd82020), steel = lam(0xc8ccd4); part(g, box, red, 0, 1.25, -0.2, 0, 0, 0, 1.4, 0.36, 0.36); for (const s of [-1, 1]) { part(g, box, red, s * 0.52, 1.75, -0.2, 0, 0, 0, 0.36, 0.7, 0.36); part(g, box, steel, s * 0.52, 2.25, -0.2, 0, 0, 0, 0.36, 0.34, 0.36); } put(0, g); }
    // Loud: a megaphone for a mouth.
    if (mut[GENE.loud]) { const g = new THREE.Group(); part(g, cone, lam(0xe8e8e8), 0, -0.05, 1.5, -Math.PI / 2, 0, 0, 0.75, 1.3, 0.75); part(g, cone, lam(0xd82020), 0, -0.05, 1.95, -Math.PI / 2, 0, 0, 0.9, 0.3, 0.9); put(0, g); }
    // Tiny arms.
    if (mut[GENE.arms]) { const g = new THREE.Group(), arms = []; for (const s of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(s * 0.85, 0.1, 0.3); part(arm, box, this.mats[1], s * 0.25, 0, 0.2, 0, 0, 0, 0.5, 0.2, 0.2); part(arm, box, this.mats[1], s * 0.5, 0, 0.5, 0, 0, 0, 0.2, 0.2, 0.5); g.add(arm); arms.push(arm); } put(1, g, { walk: 'flap', wings: arms, phase: 0 }); }
    // A beak.
    if (mut[GENE.beak]) { const g = new THREE.Group(); part(g, cone, lam(0xf08020), 0, 0.05, 1.3, Math.PI / 2, 0, 0, 0.42, 1, 0.3); put(0, g); }
    // Hooves, and no legs to go with them.
    for (let k = 0; k < many(mut[GENE.hooves], 2) * 2; k++) { const g = new THREE.Group(); for (const s of [-1, 1]) part(g, box, lam(0x1c1410), s * 0.55, -0.85, 0, 0, 0, 0, 0.42, 0.34, 0.5); put(k % 2 ? -3 - (k >> 1) : 2 + (k >> 1), g); }
    // Photosynthesis: leaves down its back.
    if (mut[GENE.photo]) every(2, (g, seg) => { const leaf = lam(0x38b030); for (const s of [-1, 1]) part(g, BALL, leaf, s * 0.5, 1.15, 0, 0, 0.5 * s + seg, s * -0.6, 0.6, 0.08, 0.3); });
    // Camouflage: it's the colour of the road. (The colours it's drawn from are changed, and the materials redone.)
    if (mut[GENE.camo] && !this.camo) { this.camo = true; this.base.forEach((c, k) => c.lerp(new THREE.Color(k === 1 ? 0x56565c : 0x66666c), 0.85)); this.burnt = -1; }
    // (What only changes its glow: see the colours in update.)
    this.shine = mut[GENE.glow] ? 1 : mut[GENE.regen] ? 2 : 0; this.flicker = !!mut[GENE.unstable];
    // Another head: the first on the tail, looking back the way it came; any more sprout along its back.
    for (let k = 0; k < many(mut[GENE.head], 5); k++) {
      const g = new THREE.Group(), head = new THREE.Group();
      part(head, BALL, this.mats[0], 0, 0, 0, 0, 0, 0, 1.08, 1.08, 1.08);
      for (const s of [-1, 1]) { part(head, BALL, new THREE.MeshLambertMaterial({ color: 0xffffff }), s * 0.41, 0.45, 0.76, 0, 0, 0, 0.32, 0.32, 0.32); part(head, BALL, new THREE.MeshBasicMaterial({ color: 0x101010 }), s * 0.43, 0.5, 1.03, 0, 0, 0, 0.16, 0.16, 0.16); }
      if (k === 0) { head.position.set(0, 0.1, -0.7); head.rotation.y = Math.PI; put(-1, g, { tail: true }); }
      else { head.position.set((k % 2 ? 1 : -1) * 0.75, 1.35, 0); head.rotation.set(0, (k % 2 ? 1 : -1) * 0.5, (k % 2 ? -1 : 1) * 0.45); head.scale.setScalar(0.8); part(g, box, this.mats[1], (k % 2 ? 1 : -1) * 0.4, 0.75, 0, 0, 0, (k % 2 ? -1 : 1) * 0.5, 0.5, 0.9, 0.5); put(1 + k * 2, g); }
      g.add(head);
    }
  }

  // Puts every mutation's piece where its ball of the body is this frame. scale: how big the worm is drawn.
  dress(time) {
    const n = this.n;
    for (const a of this.extras) {
      const i = a.seg < 0 ? n + a.seg : a.seg;
      // (A worm too short for a piece just doesn't show it.)
      a.obj.visible = i >= 0 && (a.tail ? true : i < n - (a.every ? 0 : 2)) && this.meshes[i].visible !== false;
      if (!a.obj.visible) continue;
      const m = this.meshes[i], f = this.meshes[Math.max(0, i - 1)].position, b = this.meshes[Math.min(n - 1, i + 1)].position;
      a.obj.position.copy(m.position);
      a.obj.rotation.y = Math.atan2(f.x - b.x, f.z - b.z);
      a.obj.scale.setScalar(a.tail ? this.meshes[0].scale.x : m.scale.x); // (a head on the tail is as big as the head on the front)
      if (a.walk === 'stride') a.legs.forEach((leg, k) => { leg.rotation.x = 0.6 * Math.sin(time * 11 + a.phase + k * Math.PI); });
      else if (a.walk === 'spider') a.obj.children.forEach((leg, k) => { leg.rotation.y = 0.35 * Math.sin(time * 16 + a.phase + k * Math.PI); });
      else if (a.walk === 'flap') a.wings.forEach((wing, k) => { wing.rotation.z = (k ? -1 : 1) * (0.25 + 0.55 * Math.sin(time * 13 + a.phase)); });
    }
  }

  // Shows the first n plasters, each turned to lie across the body where its ball is (the balls themselves don't turn).
  showPlasters(n) {
    this.plasters.forEach((p, k) => {
      p.visible = k < n;
      if (!p.visible) return;
      const seg = p.userData.seg, f = this.meshes[seg - 1].position, b = this.meshes[Math.min(this.n - 1, seg + 1)].position;
      p.rotation.y = Math.atan2(f.x - b.x, f.z - b.z);
    });
  }

  reset(w) {
    this.fit(w);
    this.at = ANIM; this.hopT = 0; this.seen = w.count; this.act = null; this.hopMul = 1; this.lastT = null;
    this.taps = w.taps; this.tw = 0; this.hurts = w.hurts || 0; this.flash = 0; this.winT = 0;
    for (let i = 0; i < this.n; i++) { this.px[i] = w.x - Math.sin(w.aim) * GAP * i; this.pz[i] = w.z - Math.cos(w.aim) * GAP * i; }
  }

  // A worm that has finished stops where it is and does its own victory dance until the race ends.
  celebrate(w, time) {
    this.fit(w);
    const dt = this.lastT === null ? 0 : Math.min(0.1, Math.max(0, time - this.lastT));
    this.lastT = time; this.winT += dt;
    for (const m of this.mats) m.emissive.setRGB(0, 0, 0);
    for (const m of this.aura) m.visible = false;
    this.bubble.visible = false;
    this.letter.visible = !!w.scarlet;
    // (Its point towards the head: the balls of the body don't turn, so the letter is turned to lie along them.)
    if (w.scarlet) { const f = this.meshes[2].position, b = this.meshes[4].position; this.letter.rotation.y = Math.atan2(f.x - b.x, f.z - b.z) + Math.PI; }
    this.wolfKit.visible = false; this.showPlasters(w.patch); this.meshes[0].rotation.x = 0; this.meshes[0].rotation.z = 0;
    // (tight: on the podium there's less room, and the dance is kept closer in.)
    const pose = VICTORY[this.kind] || VICTORY[0], small = Math.max(0.2, 0.62 ** (w.cuts || 0)), tight = this.tight || 1;
    let hx = 0, hz = 1;
    for (let i = 0; i < this.n; i++) {
      // (A piece of a worm dances the same dance at its own size.)
      const [x0, y0, z0] = pose(i, this.winT, this.rad[i]), m = this.meshes[i], sh = this.shadows[i], x = x0 * small * tight, y = y0 * small, z = z0 * small * tight;
      m.position.set(w.x + x, y + this.stand * small, w.z + z); m.scale.setScalar(this.rad[i] * small * this.girth);
      this.px[i] = w.x + x; this.pz[i] = w.z + z;
      if (i === 1) { hx = this.px[0] - this.px[1]; hz = this.pz[0] - this.pz[1]; }
      sh.visible = true; sh.position.set(w.x + x, 0.04, w.z + z); sh.scale.setScalar(this.rad[i] * small * Math.max(0.35, 1 - (y - this.rad[i] * small) * 0.25));
    }
    // The head faces the way the body leads, or the camera's usual side when it's standing straight up.
    this.meshes[0].rotation.y = Math.hypot(hx, hz) > 0.05 ? Math.atan2(hx, hz) : 0;
    this.dress(time, small);
  }

  // track: the race's track, to know where a fallen worm will be put back.
  update(w, time, track) {
    // A worm the bird has taken isn't there any more.
    // (Nor is one that's been taken to the nest and not eaten, until the last moment, when it falls back out of the sky.)
    this.group.visible = !w.out && !(w.nested && w.fall > 0.7);
    if (!this.group.visible) return;
    if (w.finished) return this.celebrate(w, time);
    this.fit(w);
    // (A were-wolf-worm is bigger. While it's changing, to or from, it flickers between the two.)
    const wolf = w.wolf > 0 ? !(w.howl > 0) || Math.floor(time * 14) % 2 === 0 : w.howl > 0 && Math.floor(time * 14) % 2 === 0;
    const small = (w.shrunk > 0 ? 0.55 : 1) * (wolf ? 1.3 : 1) * (w.giant > 0 ? 1.9 : 1) * Math.max(0.2, 0.62 ** (w.cuts || 0)), flat = w.flat > 0 || (w.fall > 0 && w.dead), gap = GAP * small;
    const bitten = w.fall > 0 && w.bit;
    this.wolfKit.visible = wolf;
    this.showPlasters((w.patch || 0) + (bitten && BITE_TIME - w.fall >= BITE_LIE + PLASTER_PART ? 1 : 0));
    for (const e of this.eyes) e.material.color.setHex(wolf ? 0xff2020 : 0xffffff);
    const back = w.fall > 0 && !w.dead && !w.bit && track ? centreNear(track, w.x, w.z) : null;
    let held = false, onBack = false, rear = false, hx = back ? back.x : 0, hz = back ? back.z : 0;
    const px = this.px, pz = this.pz;
    px[0] = w.x; pz[0] = w.z;
    for (let i = 1; i < this.n; i++) {
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
    // (An unstable worm's colours won't settle; one that glows, glows; one that regenerates shimmers.)
    else if (this.flicker) glow.setHSL((time * 0.9 + w.idx * 0.13) % 1, 1, 0.22 + 0.1 * Math.sin(time * 23));
    else glow.setRGB(0.18 * Math.min(1, w.heat || 0), this.shine === 1 ? 0.5 : this.shine === 2 ? 0.14 + 0.12 * Math.sin(time * 5) : 0, this.shine === 1 ? 0.22 : 0);
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
    for (let i = 0; i < this.n; i++) {
      const a = Math.max(i, 1);
      let dx = px[a - 1] - px[a], dz = pz[a - 1] - pz[a];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      let lat = 0.05 * Math.sin(time * 3 - i * 0.8 + w.idx) + tw * 0.13 * Math.sin(time * 55 - i * 1.7) + (w.stun > 0 ? 0.4 * Math.sin(time * 26 - i * 1.4) : 0), y = this.rad[i] + tw * 0.07 * (1 + Math.sin(time * 47 - i * 2.1));
      // (On the title screen it slithers, as a worm does: a wave running down it from head to tail.)
      if (w.demo) lat = 0.34 * Math.sin(time * 9 - i * 0.95 + w.idx) * Math.min(1, i / 2 + 0.3);
      if (st) {
        lat += env * st.lat * Math.sin(time * st.latF - i * 0.9);
        const ph = this.hopT - i * st.lag;
        if (ph > 0) y += st.hop * hopMul * Math.abs(Math.sin(Math.PI * ph)) * Math.min(1, env * 3);
        y += env * st.vert * (0.5 + 0.5 * Math.sin(time * st.vertF - i * 1.1));
        if (st.jit) { lat += env * st.jit * Math.sin(time * 91 + i * 7.3); y += env * st.jit * (0.5 + 0.5 * Math.sin(time * 77 + i * 5.1)); }
      }
      // What's happened to it shows: shrunk by lightning, squashed flat, dropping out of sight, or dangling from a bird.
      const big = small * this.rad[i] * this.girth;
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
          else { held = true; y = Math.max(big, 10 - 6.6 * ((e - DROP_PART) / (FALL_TIME - DROP_PART)) - i * 0.36 * small); }
        } else {
          // Over the wall: it lies on its back, squirming, until the hand lifts it and carries it home.
          const e = OUT_TIME - w.fall;
          if (e < LIE_PART) { y = big; lat = 0.3 * Math.sin(time * 16 - i * 1.1); onBack = true; }
          else { held = true; const c = carried(w, back || w, (e - LIE_PART) / (OUT_TIME - LIE_PART)); hx = c[0]; hz = c[1]; y = Math.max(big, c[2] - i * 0.36 * small); }
        }
      }
      if (w.lift > 0) y = Math.max(y, w.lift - i * 0.45 * small * Math.min(1, w.lift / 3));
      // (Wobbles are as big as the worm is: a small piece of one shakes a small way.)
      lat *= small;
      let x = px[i] + dz * lat, z = pz[i] - dx * lat;
      const m = this.meshes[i];
      if (held && back) { x = hx + 0.1 * Math.sin(time * 9 + i); z = hz; }
      if (rear && i < 4) { x = px[4] + lat; z = pz[4]; }
      // (On legs it stands clear of the ground; back from the nest it comes down out of the sky.)
      if (this.stand && !flat && !onBack && !held) y += this.stand * small;
      if (w.nested && w.fall > 0) y += 60 * (w.fall / 0.7) ** 2;
      if (w.spring && w.spring.dig) y -= 1.1; // (digging: only a ridge of it shows)
      m.position.set(x, y, z);
      m.scale.set(big * (flat ? 1.5 : 1), big * (flat ? 0.2 : 1), big * (flat ? 1.5 : 1));
      if (i === 0) { m.rotation.y = Math.atan2(dx, dz) + (w.stun > 0 ? time * 18 : 0); m.rotation.z = onBack ? 2.5 : 0; m.rotation.x = rear ? -1.1 : 0; }
      const sh = this.shadows[i], k = big * Math.max(0.4, 1 - (y - big) * 0.3);
      sh.visible = !(w.fall > 0) && !(w.lift > 0);
      sh.position.set(x, 0.04, z); sh.scale.setScalar(k);
    }
    this.letter.visible = !!w.scarlet;
    // (Its point towards the head: the balls of the body don't turn, so the letter is turned to lie along them.)
    if (w.scarlet) { const f = this.meshes[2].position, b = this.meshes[4].position; this.letter.rotation.y = Math.atan2(f.x - b.x, f.z - b.z) + Math.PI; }
    this.dress(time, small);
    this.bubble.visible = w.shield > 0 && !(w.fall > 0);
    if (this.bubble.visible) { const c = this.meshes[2].position; this.bubble.position.set(c.x, c.y + 0.2, c.z); this.bubble.scale.setScalar(1.75 * small * (1 + 0.04 * Math.sin(time * 6))); }
    const mode = w.fall > 0 || w.lift > 0 ? null : w.stun > 0 ? 'stun' : w.star > 0 ? 'star' : w.boost > 0 ? 'boost' : null;
    const head = this.meshes[0].position, mid = this.meshes[4].position, tail = this.meshes[this.n - 1].position, prev = this.meshes[this.n - 2].position;
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
