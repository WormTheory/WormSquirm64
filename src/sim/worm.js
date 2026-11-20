// How a worm moves. Every button does the same thing underneath: one "spasm", a lunge of random
// length in a direction that's only loosely where the worm was aiming. The names and the
// animations differ; the odds never do.
export const ACTIONS = ['SQUIRM', 'WIGGLE', 'UNDULATE', 'FLOP', 'WRITHE', 'THRASH', 'LURCH', 'SPASM'];

export const TUNE = {
  // A spasm and the pause after it average a quarter of a second, so four presses a second is
  // the most that ever counts. Pressing faster than that changes nothing.
  distMin: 0.6, distMax: 2.3,    // how far one spasm travels
  durMin: 0.14, durMax: 0.22,    // how long it takes
  restMin: 0.04, restMax: 0.10,  // the pause after, when presses do nothing but queue
  assist: 1.05,                  // looking within this (radians, 60 degrees) of the way the track goes counts as dead on
  // A button wears out: each use tires it by one, each use of a different button rests it by two
  // (so taking two buttons in turn is fine, and the fourth press in a row of one is not).
  // Past tiredAt it only lunges tiredMul as far, until other buttons have rested it.
  tiredAt: 3, tiredMax: 6, tiredMul: 0.35,
  pGood: 0.68, pSide: 0.22,      // chance of going roughly the right way, or off to one side (the rest: backwards)
  band: 0.3,                     // hidden catch-up: last place lunges this much further than the middle of the pack
};

export function makeWorm(idx, char, human, x, z) {
  return { idx, char, human, x, z, look: 0, aim: 0, action: null, tired: {}, wasTired: false, spasm: null, rest: 0, queued: null, count: 0,
    hint: -1, s: 0, prog: 0, lap: 1, rank: idx, finished: false, finishTime: 0 };
}

// A press never does more than ask for the next spasm. While one's under way (or the worm is
// resting after it) the press is just remembered, so mashing gains nothing beyond four presses a second.
export function pressAction(w, action) {
  w.queued = action;
}

function startSpasm(w, action, rng, rankFrac) {
  const r = rng();
  let err;
  if (r < TUNE.pGood) err = ((rng() + rng() + rng() - 1.5) / 1.5) * 0.75;
  else if (r < TUNE.pGood + TUNE.pSide) err = (rng() < 0.5 ? -1 : 1) * rng.range(0.9, 2.0);
  else err = Math.PI + rng.range(-0.5, 0.5);
  const a = w.aim + err;
  for (const k in w.tired) if (k !== action) w.tired[k] = Math.max(0, w.tired[k] - 2);
  w.tired[action] = Math.min(TUNE.tiredMax, (w.tired[action] || 0) + 1);
  w.wasTired = w.tired[action] > TUNE.tiredAt;
  w.spasm = {
    action, t: 0, dur: rng.range(TUNE.durMin, TUNE.durMax),
    dx: Math.sin(a), dz: Math.cos(a),
    dist: rng.range(TUNE.distMin, TUNE.distMax) * (1 + TUNE.band * (rankFrac - 0.5)) * (w.wasTired ? TUNE.tiredMul : 1),
    rest: rng.range(TUNE.restMin, TUNE.restMax),
  };
  w.action = action;
  w.count++;
}

// Moves a worm on by dt. Returns the action if a new spasm started this step (for sound and the HUD).
export function stepWorm(w, dt, rng, rankFrac) {
  let started = null;
  if (!w.spasm) {
    if (w.rest > 0) w.rest -= dt;
    else if (w.queued) { startSpasm(w, w.queued, rng, rankFrac); started = w.queued; w.queued = null; }
  }
  const sp = w.spasm;
  if (sp) {
    // Speed follows half a sine wave: slow, fast, slow. This is that curve's exact area for the step.
    const u0 = sp.t / sp.dur;
    sp.t += dt;
    const u1 = Math.min(1, sp.t / sp.dur);
    const d = sp.dist * (Math.cos(Math.PI * u0) - Math.cos(Math.PI * u1)) / 2;
    w.x += sp.dx * d; w.z += sp.dz * d;
    if (u1 >= 1) { w.rest = sp.rest; w.spasm = null; }
  }
  return started;
}
