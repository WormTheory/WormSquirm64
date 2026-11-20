// Computer worms use the same presses and the same odds as a player. All they decide is
// roughly where to aim (along the track, with a wandering error) and when to press.
import { ACTIONS } from './worm.js';

export function makeAi(rng) {
  return { next: rng.range(0, 0.6), drift: rng.range(-0.3, 0.3) };
}

export function stepAi(ai, w, loc, hw, dt, rng) {
  ai.drift += (rng() - 0.5) * 2.5 * dt;
  ai.drift = Math.max(-0.6, Math.min(0.6, ai.drift)) * (1 - 0.3 * dt);
  // Along the track, leaning back towards the middle of the road.
  const k = -0.6 * loc.lat / hw;
  w.aim = Math.atan2(loc.tx + loc.tz * k, loc.tz - loc.tx * k) + ai.drift;
  ai.next -= dt;
  if (ai.next <= 0) { w.queued = rng.pick(ACTIONS); ai.next = rng.range(0.25, 1.1); }
}
