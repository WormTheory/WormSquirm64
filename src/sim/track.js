// Tracks are a closed loop through a few control points, flat for now.
// Everything here is plain maths (no three.js) so the race can also run in Node for testing.
export const TRACKS = [
  {
    id: 'green-morm-raceway',
    name: 'Green Morm Raceway',
    width: 14,
    laps: 3,
    pts: [[0, -18], [18, -20], [30, -10], [30, 6], [20, 16], [6, 12], [-6, 18], [-20, 20], [-30, 8], [-28, -8], [-16, -16]],
  },
];

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
