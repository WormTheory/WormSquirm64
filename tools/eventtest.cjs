// Starts each of the newer random events in turn, lets it run its course, and checks it began, ended and broke
// nothing. Takes a picture of each part-way through.
//   node tools/eventtest.cjs <url> <folder for screenshots>
const { chromium } = require('playwright');

(async () => {
  const [url, out] = process.argv.slice(2);
  const browser = await chromium.launch(), errs = [], fails = [];
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  const ws = (fn, arg) => page.evaluate(fn, arg);
  const check = (what, ok) => { console.log((ok ? 'ok    ' : 'FAIL  ') + what); if (!ok) fails.push(what); };
  const KINDS = ['fog', 'wind', 'night', 'lowgrav', 'mower', 'sprinkler', 'roadworks', 'sinkhole', 'reverse', 'moles', 'chicken', 'ants', 'snail', 'frog', 'pace', 'fisher', 'swapmeet', 'makeover', 'tax', 'knot', 'adoption', 'marry', 'fused', 'birds2'];
  await page.goto(url); await page.waitForTimeout(800);
  await ws(() => window.__ws.quick(1, 0)); await page.waitForTimeout(6000);
  const me = await ws(() => window.__ws.G.players[0].me);
  await ws(() => { const r = window.__ws.race; r.weather.on = false; r.weather.next = Infinity; r.laps = 60; r.items.boxes.forEach((b) => { b.t = 1e9; }); for (let n = 0; n < 240; n++) r.step(1 / 60); window.__ws.G.players[0].cam.pitch = 0.4; });
  const bad = [];
  for (const kind of KINDS) {
    const got = await ws(([kind, me]) => { const r = window.__ws.race; r.worms[me].money = 30; return window.__ws.event(kind, ['fisher', 'swapmeet', 'makeover', 'tax', 'knot', 'adoption', 'marry', 'fused', 'ants'].includes(kind) ? me : undefined); }, [kind, me]);
    const want = kind === 'birds2' ? 'bird' : kind;
    if (got !== want) { bad.push(kind + ' did not start (' + got + ')'); continue; }
    // (Part of the way in real time, for the picture; the rest as fast as the race will go.)
    await page.waitForTimeout(kind === 'birds2' ? 300 : 2300);
    await page.screenshot({ path: `${out}/ev-${kind}.png` });
    const ended = await ws(() => { const r = window.__ws.race; let n = 0; for (; n < 60 * 60 && (r.weather.type !== 'none' || r.weather.again); n++) r.step(1 / 60); for (let k = 0; k < 120; k++) r.step(1 / 60); return r.weather.type === 'none'; });
    if (!ended) bad.push(kind + ' did not end');
    await page.waitForTimeout(150);
  }
  console.log(bad.length ? bad.join('\n') : 'every event began and ended');
  check('all the newer events begin and end', bad.length === 0);
  const state = await ws((me) => { const r = window.__ws.race, w = r.worms[me]; return { glam: w.glam, holes: (r.holes || []).length, babies: (r.babies || []).length, wed: r.worms.filter((o) => o.wed >= 0).length, fused: r.worms.filter((o) => o.fusedTo >= 0).length, heads: w.mut[12], worms: r.worms.length, stuck: r.worms.filter((o) => !o.out && o.lift > 0).length }; }, me);
  console.log(JSON.stringify(state));
  check('what they leave behind is there: a makeover, a hole, a baby, a married couple, a fused worm', state.glam && state.holes === 1 && state.babies === 1 && state.wed === 2 && state.fused === 1 && state.heads >= 1);
  check('nobody is left hanging in the air', state.stuck === 0);
  // The race can still be finished.
  const done = await ws(() => { const r = window.__ws.race; r.laps = Math.max(...r.worms.map((w) => w.lap)); const A = ['SQUIRM', 'WIGGLE', 'FLOP']; for (let n = 0; r.state !== 'done' && n < 90000; n++) { if (n % 12 === 0) r.worms.forEach((w) => { if (w.human) r.press(w.idx, A[(n / 12) % 3]); }); r.step(1 / 60); } return r.state; });
  check('and the race still finishes', done === 'done');
  await page.waitForTimeout(2400); await page.screenshot({ path: `${out}/ev-results.png` });
  console.log('errors:', errs.length ? errs.slice(0, 5) : 'none');
  await browser.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})();
