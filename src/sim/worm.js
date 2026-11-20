// How a worm moves. Every button does the same thing underneath: one "spasm", a lunge of random
// length in a direction that's only loosely where the worm was aiming. The names and the
// animations differ; the odds never do.
export const ACTIONS = ['SQUIRM', 'WIGGLE', 'UNDULATE', 'FLOP', 'WRITHE', 'THRASH', 'LURCH', 'SPASM'];

export const TUNE = {
  distMin: 2, distMax: 8,        // how far one spasm travels
  durMin: 0.45, durMax: 0.85,    // how long it takes
  restMin: 0.08, restMax: 0.35,  // the pause after, when presses do nothing but queue
  pGood: 0.68, pSide: 0.22,      // chance of going roughly the right way, or off to one side (the rest: backwards)
  band: 0.3,                     // hidden catch-up: last place lunges this much further than the middle of the pack
};

export function makeWorm(idx, char, human, x, z) {
  return { idx, char, human, x, z, aim: 0, spasm: null, rest: 0, queued: null, count: 0,
    hint: -1, s: 0, prog: 0, lap: 1, rank: idx, finished: false, finishTime: 0 };
}

// A press never does more than ask for the next spasm. While one's under way (or the worm is
// resting after it) the press is just remembered, so mashing gains nothing over one press a second.
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
  w.spasm = {
    action, t: 0, dur: rng.range(TUNE.durMin, TUNE.durMax),
    dx: Math.sin(a), dz: Math.cos(a),
    dist: rng.range(TUNE.distMin, TUNE.distMax) * (1 + TUNE.band * (rankFrac - 0.5)),
    rest: rng.range(TUNE.restMin, TUNE.restMax),
  };
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
