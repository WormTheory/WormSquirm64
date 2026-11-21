// How a worm moves. Every button does the same thing underneath: one "spasm", a lunge of random
// length in a direction that's only loosely where the worm was aiming. The names and the
// animations differ; the odds never do.
export const ACTIONS = ['SQUIRM', 'WIGGLE', 'UNDULATE', 'FLOP', 'WRITHE', 'THRASH', 'LURCH', 'SPASM'];

export const TUNE = {
  // A spasm and the pause after it average a quarter of a second, so four presses a second is
  // the most that ever counts. Pressing faster than that changes nothing.
  distMin: 1.1, distMax: 4.2,    // how far one spasm travels (sets the race length: about a minute and a half)
  durMin: 0.14, durMax: 0.22,    // how long it takes
  restMin: 0.04, restMax: 0.10,  // the pause after, when presses do nothing but queue
  // Aim assist, in degrees off the way the track goes. Looking within assistFull counts as dead on.
  // From there to assistEnd the worm's real aim swings smoothly out to meet the camera, and past
  // assistEnd it aims exactly where the camera points. Nothing snaps, so there's no edge to notice.
  assistFull: 60, assistEnd: 95,
  // A button wears out, slowly enough not to be noticed: each use tires it by one, each use of a
  // different button rests it by two (so taking two buttons in turn never tires either). The first
  // tiredAt uses are free; after that each one lunges a little less far, down to tiredMul after
  // tiredSpan more. Rest brings it back the same gradual way.
  tiredAt: 3, tiredSpan: 24, tiredMul: 0.35,
  pGood: 0.68, pSide: 0.22,      // chance of going roughly the right way, or off to one side (the rest: backwards)
  band: 0.3,                     // hidden catch-up: last place lunges this much further than the middle of the pack
};

export function makeWorm(idx, char, human, x, z) {
  return { idx, char, human, x, z, look: 0, aim: 0, action: null, tired: {}, taps: 0, spasm: null, rest: 0, queued: null, count: 0,
    hint: -1, s: 0, prog: 0, lap: 1, rank: idx, finished: false, finishTime: 0,
    // What's happened to it. Timers count down in seconds: stunned, boosted, starred, shrunk, falling (or dead) and flattened.
    stun: 0, boost: 0, star: 0, shrunk: 0, fall: 0, flat: 0, slow: 0, // (slow: stuck in glue)
    shield: 0, giant: 0,    // seconds left in a bubble, and as a giant
    heat: 0, hurts: 0,      // how baked it is (0 to 1), and how many times it's been hurt
    items: 0, item: -1,     // how many items it's had, and the last one
    dead: false, pit: false, // whether its "fall" is a death by baking, or a real fall into nothing (otherwise it just lies off the road)
    wolf: 0, howl: 0,       // whether the blood moon has made it a were-wolf-worm, and seconds left of rearing up to change
    bit: false, safe: 0, patch: 0, // bitten by the wolf (and lying there); seconds before it can be bitten again; how many plasters it wears
    hold: 0,                // seconds it's being kept still (while the hand does something to it)
    // Things that stay with a worm through a cup: cut in two (half; second marks the half that was made, twin the other one's number),
    // money it's been given, and whether it's been branded with a scarlet letter.
    // (cuts: how many times this piece has been cut, so 1 is half a worm and 3 an eighth. pid names a piece that
    // was made by a cut, '' for the one that was there from the start; root is that first piece's number, and from
    // the number of the piece this one was cut off.)
    half: false, second: false, twin: -1, cuts: 0, pid: '', root: idx, from: -1, money: 0, scarlet: false,
    chain: -1, // the number of the worm this one is chained to
    lift: 0, out: false };  // how high a bird is carrying it, and whether it's out of the race for good
}

// A press never does more than ask for the next spasm. While one's under way (or the worm is
// resting after it) the press is just remembered, so mashing gains nothing beyond four presses a second.
// Every press is counted in taps all the same, so the worm can be shown twitching at each one.
export function pressAction(w, action) {
  w.queued = action;
  w.taps++;
}

// Where a worm really aims (radians), given where it's looking and the way the track goes.
export function assistedAim(look, fwd) {
  const off = Math.atan2(Math.sin(look - fwd), Math.cos(look - fwd)), deg = Math.abs(off) * 180 / Math.PI;
  if (deg >= TUNE.assistEnd) return look;
  if (deg <= TUNE.assistFull) return fwd;
  const t = (deg - TUNE.assistFull) / (TUNE.assistEnd - TUNE.assistFull);
  return fwd + Math.sign(off) * TUNE.assistEnd * t * t * (3 - 2 * t) * Math.PI / 180;
}

function startSpasm(w, action, rng, rankFrac) {
  const r = rng();
  let err;
  if (r < TUNE.pGood) err = ((rng() + rng() + rng() - 1.5) / 1.5) * 0.75;
  else if (r < TUNE.pGood + TUNE.pSide) err = (rng() < 0.5 ? -1 : 1) * rng.range(0.9, 2.0);
  else err = Math.PI + rng.range(-0.5, 0.5);
  const a = w.aim + err;
  for (const k in w.tired) if (k !== action) w.tired[k] = Math.max(0, w.tired[k] - 2);
  w.tired[action] = Math.min(TUNE.tiredAt + TUNE.tiredSpan, (w.tired[action] || 0) + 1);
  const worn = Math.max(0, w.tired[action] - TUNE.tiredAt) / TUNE.tiredSpan;
  w.spasm = {
    action, t: 0, dur: rng.range(TUNE.durMin, TUNE.durMax),
    dx: Math.sin(a), dz: Math.cos(a),
    dist: rng.range(TUNE.distMin, TUNE.distMax) * (1 + TUNE.band * (rankFrac - 0.5)) * (1 - (1 - TUNE.tiredMul) * worn) * speedOf(w),
    rest: rng.range(TUNE.restMin, TUNE.restMax),
  };
  w.action = action;
  w.count++;
}

// How far a worm's lunges go just now, as a multiple of normal: items speed it up or shrink it,
// baking slows it, and a flattened worm barely moves at all.
export function speedOf(w) {
  return (w.boost > 0 ? 1.8 : 1) * (w.star > 0 ? 1.5 : 1) * (w.shrunk > 0 ? 0.6 : 1) * (1 - 0.55 * Math.min(1, w.heat)) * (w.flat > 0 ? 0.12 : 1) * (w.slow > 0 ? 0.4 : 1) * (w.giant > 0 ? 1.3 : 1);
}

// Moves a worm on by dt. Returns the action if a new spasm started this step (for sound and the HUD).
export function stepWorm(w, dt, rng, rankFrac) {
  let started = null;
  // Stunned, falling, carried off, gone or finished (and busy celebrating): it does nothing.
  if (w.stun > 0 || w.fall > 0 || w.lift > 0 || w.out || w.finished || w.wolf > 0 || w.howl > 0 || w.hold > 0) { w.spasm = null; w.queued = null; return null; } // (a wolf goes where the curse takes it)
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
