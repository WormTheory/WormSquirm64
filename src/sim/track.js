// Tracks are a closed loop through a few control points, flat for now.
// Everything here is plain maths (no three.js) so the race can also run in Node for testing.
// The look of a track: sky and fog colours, the two tones of the ground, the road and its speckle,
// the centre line (or none), kerb and wall stripes, far hills, and what stands around (kind, how many).
export const TRACKS = [
  {
    id: 'green-morm-raceway', name: 'Green Morm Raceway', width: 14, laps: 3,
    pts: [[0.5, -20.5], [18.8, -19.8], [30.9, -9.9], [31.5, 4.9], [21.8, 14.6], [7.3, 16.1], [-7.4, 19.5], [-21.9, 18.9], [-31.1, 7.9], [-29.3, -7.1], [-17.2, -16.8]],
    theme: { sky: 0x78b8f8, fog: 0xa8d0f8, ground: ['#3fa838', '#4cb843'], road: ['#6a6a72', '#5e5e66', '#767680'], line: '#e8e0a0',
      kerb: ['#e8e8e8', '#d83028'], wall: ['#f0d020', '#2850c8'], hill: 0x2f8a40, mesa: false, props: [['tree', 70]] },
  },
  {
    id: 'moo-moo-worm-farm', name: 'Moo Moo Worm Farm', width: 14, laps: 3,
    pts: [[27.6, 0.3], [23, 16.1], [8.2, 24.9], [-9.3, 21.8], [-24.2, 14.6], [-29, -2], [-20.3, -18], [-4.3, -24.9], [11.3, -19.9], [24.1, -12.9]],
    theme: { sky: 0x90c8f0, fog: 0xc0e0f0, ground: ['#5aa838', '#68b848'], road: ['#9a7448', '#8a6638', '#aa8458'], line: null,
      kerb: ['#b08858', '#a07848'], wall: ['#f4f0e0', '#8a5a30'], hill: 0x4a9a40, mesa: false, props: [['tree', 30], ['cow', 24], ['hay', 14]] },
  },
  {
    id: 'squirma-troopa-beach', name: 'Squirma Troopa Beach', width: 14, laps: 3,
    pts: [[-31.2, -5.7], [-19.1, -18.8], [-0.5, -19.5], [17.7, -21.4], [32.8, -11.7], [34.7, 5.5], [21.4, 16.8], [2.5, 16], [-15.7, 19.4], [-30.5, 11.4]],
    theme: { sky: 0x58c8f8, fog: 0xb0e8f8, ground: ['#e8d890', '#f0e0a0'], road: ['#c8a868', '#b89858', '#d8b878'], line: null,
      kerb: ['#f0f0f0', '#40a8e0'], wall: ['#f08030', '#f8f0e0'], hill: 0x7a8a90, mesa: false, sea: 0x2878d8, props: [['palm', 55]] },
  },
  {
    id: 'kalimari-wormsert', name: 'Kalimari Wormsert', width: 14, laps: 3,
    pts: [[1.3, -28.2], [20.7, -21.8], [31.6, -6.4], [27.2, 9.7], [13.6, 18.2], [0.7, 27.1], [-15, 27.9], [-27.1, 16.5], [-29.1, -1.2], [-28.9, -16.9], [-16.9, -26.9]],
    theme: { sky: 0xf8c890, fog: 0xf8d8b0, ground: ['#d89048', '#e09a50'], road: ['#7a6a62', '#6e5e56', '#86766e'], line: '#f0e0b0',
      kerb: ['#e8e8e8', '#c85020'], wall: ['#8a4a28', '#c87838'], hill: 0xb85a30, mesa: true, props: [['cactus', 50], ['rock', 22]] },
  },
  {
    id: 'frappe-wormland', name: 'Frappe Wormland', width: 14, laps: 3,
    pts: [[-29.7, -12.2], [-9.3, -22.3], [14.5, -23.8], [32.7, -21.2], [38.9, -7.5], [29.1, 6.4], [11, 12.9], [-7.6, 20.9], [-26.7, 20.5], [-36.9, 6.2]],
    theme: { sky: 0xb8d8f8, fog: 0xe0f0ff, ground: ['#f0f4fa', '#e2eaf4'], road: ['#c8d8e8', '#b8cce0', '#d8e6f2'], line: null,
      kerb: ['#f8f8f8', '#4890d8'], wall: ['#e8f0f8', '#80b0e0'], hill: 0xd0dcec, mesa: false, props: [['pine', 45], ['snowman', 16]] },
  },
  {
    id: 'choco-squirmtain', name: 'Choco Squirmtain', width: 14, laps: 3,
    pts: [[-0.3, -29.1], [20.1, -22.8], [31.2, -6.8], [30.9, 11.9], [25.1, 26.7], [9, 32.2], [-11.1, 28.5], [-28.1, 21.6], [-34, 7.1], [-29.1, -9.6], [-19.7, -23.7]],
    theme: { sky: 0xe8b078, fog: 0xe0b888, ground: ['#7a4a28', '#84522e'], road: ['#5a3418', '#4e2c12', '#663c1e'], line: null,
      kerb: ['#e8d8b8', '#8a5a30'], wall: ['#4a2810', '#9a6a3a'], hill: 0x6a3c1c, mesa: true, props: [['rock', 40], ['tree', 12]] },
  },
  {
    id: 'banshee-wormwalk', name: 'Banshee Wormwalk', width: 14, laps: 3,
    pts: [[-34.1, -3.5], [-22.7, -20.1], [-1.5, -26.6], [20.5, -24.5], [36.1, -18.3], [39.8, -3.4], [33.1, 13.8], [23.8, 27.1], [6.1, 29.8], [-14.5, 23.5], [-30.6, 14.2]],
    theme: { sky: 0x101830, fog: 0x182040, ground: ['#28303c', '#2c3440'], road: ['#8a6038', '#7a5430', '#966a40'], line: null,
      kerb: ['#5a3c20', '#3a2410'], wall: ['#6a4828', '#2a1a0c'], hill: 0x1c2438, mesa: false, sea: 0x0c1c3c, dark: true, props: [['deadtree', 40]] },
  },
  {
    id: 'wormbow-road', name: 'Wormbow Road', width: 17, laps: 3, open: true,
    pts: [[-35, -10.1], [-16.3, -26.3], [8, -31.7], [28.7, -28.9], [40, -13], [38.9, 8.5], [32.8, 26.9], [15.7, 33.4], [-6.1, 29.8], [-27.2, 24.9], [-39.4, 10.4]],
    theme: { sky: 0x08041c, fog: 0x08041c, ground: null, road: null, rainbow: true, line: null,
      kerb: ['#ffffff', '#ffe24a'], wall: null, hill: 0, mesa: false, space: true, props: [] },
  },
];
// The cups: four races each, with points for the first four home.
export const CUPS = [
  { name: 'Wormroom Cup', tracks: [0, 1, 2, 3] },
  { name: 'Squirm Cup', tracks: [4, 5, 6, 7] },
  { name: 'Ultimate Grand Prix', tracks: [0, 1, 2, 3, 4, 5, 6, 7] },
];
export const POINTS = [9, 6, 3, 1];

function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

// Turns the control points into evenly spaced samples (about half a unit apart) with a tangent at each.
export function buildTrack(def) {
  const P = def.pts, n = P.length, fine = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n], d = P[(i + 2) % n];
    for (let k = 0; k < 32; k++) fine.push([cr(a[0], b[0], c[0], d[0], k / 32), cr(a[1], b[1], c[1], d[1], k / 32)]);
  }
  const m = fine.length, cum = [0];
  for (let i = 0; i < m; i++) {
    const p = fine[i], q = fine[(i + 1) % m];
    cum.push(cum[i] + Math.hypot(q[0] - p[0], q[1] - p[1]));
  }
  const length = cum[m], N = Math.round(length / 0.5), step = length / N;
  const px = new Float32Array(N), pz = new Float32Array(N), tx = new Float32Array(N), tz = new Float32Array(N);
  let j = 0;
  for (let i = 0; i < N; i++) {
    const s = i * step;
    while (cum[j + 1] < s) j++;
    const f = (s - cum[j]) / (cum[j + 1] - cum[j]), p = fine[j], q = fine[(j + 1) % m];
    px[i] = p[0] + (q[0] - p[0]) * f;
    pz[i] = p[1] + (q[1] - p[1]) * f;
  }
  for (let i = 0; i < N; i++) {
    const a = (i + N - 1) % N, b = (i + 1) % N;
    const dx = px[b] - px[a], dz = pz[b] - pz[a], l = Math.hypot(dx, dz);
    tx[i] = dx / l; tz[i] = dz / l;
  }
  return { def, N, px, pz, tx, tz, step, length, hw: def.width / 2 };
}

// Where a point is relative to the track: the nearest sample, distance along the lap (s),
// and how far to the side of the centre line (lat, along the side vector (tz, -tx)).
// hint is the sample found last time (only its neighbours are searched), or -1 to search everything.
export function locate(tr, x, z, hint) {
  const N = tr.N;
  let best = 0, bd = Infinity;
  if (hint < 0) {
    for (let i = 0; i < N; i++) {
      const d = (x - tr.px[i]) ** 2 + (z - tr.pz[i]) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
  } else {
    for (let k = -24; k <= 24; k++) {
      const i = (hint + k + N) % N, d = (x - tr.px[i]) ** 2 + (z - tr.pz[i]) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
  }
  const dx = x - tr.px[best], dz = z - tr.pz[best], ax = tr.tx[best], az = tr.tz[best];
  return { i: best, s: best * tr.step + dx * ax + dz * az, lat: dx * az - dz * ax, tx: ax, tz: az };
}

// The middle of the road nearest a point: where a worm that fell off there is put back.
export function centreNear(tr, x, z, hint) { return pointAt(tr, locate(tr, x, z, hint === undefined ? -1 : hint).s, 0); }

// The point at distance s along the lap, lat to the side.
export function pointAt(tr, s, lat) {
  s = ((s % tr.length) + tr.length) % tr.length;
  const i = Math.min(tr.N - 1, Math.floor(s / tr.step)), f = s - i * tr.step;
  return {
    x: tr.px[i] + tr.tx[i] * f + tr.tz[i] * lat,
    z: tr.pz[i] + tr.tz[i] * f - tr.tx[i] * lat,
    tx: tr.tx[i], tz: tr.tz[i],
  };
}
