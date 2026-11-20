// Computer worms use the same presses and the same odds as a player. They look straight along
// the track (which is all a player has to roughly do) and press about as fast as counts.
import { ACTIONS } from './worm.js';

// Seconds between a computer worm's presses.
export const AI_PRESS = [0.12, 0.3];

export function makeAi(rng) {
  return { next: rng.range(0, 0.4) };
}

export function stepAi(ai, w, loc, dt, rng) {
  w.look = Math.atan2(loc.tx, loc.tz);
  ai.next -= dt;
  if (ai.next <= 0) { w.queued = rng.pick(ACTIONS); ai.next = rng.range(AI_PRESS[0], AI_PRESS[1]); }
}
