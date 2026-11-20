// Checks each track's shape: its length, its tightest bend (which must be wider than half the road
// plus the kerb, or the inside edge folds over itself), and how close two separate stretches come.
import { TRACKS, buildTrack } from '../src/sim/track.js';
for (const def of TRACKS) {
  const t = buildTrack(def), N = t.N;
  let minR = 1e9, gap = 1e9;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, turn = Math.abs(Math.atan2(t.tx[i] * t.tz[j] - t.tz[i] * t.tx[j], t.tx[i] * t.tx[j] + t.tz[i] * t.tz[j]));
    if (turn > 1e-6) minR = Math.min(minR, t.step / turn);
    for (let k = i + 80; k < i + N - 80; k++) gap = Math.min(gap, Math.hypot(t.px[i] - t.px[k % N], t.pz[i] - t.pz[k % N]));
  }
  const ok = minR > t.hw + 1.5 && gap > def.width + 3;
  console.log(`${def.name.padEnd(22)} length ${t.length.toFixed(0)}  tightest bend ${minR.toFixed(1)}  nearest other stretch ${gap.toFixed(1)}  ${ok ? 'ok' : 'PROBLEM'}`);
}
