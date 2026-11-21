// Checks the Gene Splice mutations: what each does to the worm's speed and shape, that they stack, and what the
// poisonous and spiky ones do at the nest. Takes a picture of each mutation.
//   node tools/genetest.cjs <url> <folder for screenshots>
const { chromium } = require('playwright');

(async () => {
  const [url, out] = process.argv.slice(2);
  const browser = await chromium.launch(), errs = [], fails = [];
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  const shot = (n) => page.screenshot({ path: `${out}/gene-${n}.png` });
  const ws = (fn, arg) => page.evaluate(fn, arg);
  const check = (what, ok) => { console.log((ok ? 'ok    ' : 'FAIL  ') + what); if (!ok) fails.push(what); };
  const quiet = () => page.waitForFunction(() => window.__ws.race.weather.type === 'none', null, { timeout: 30000 });
  const NAMES = ['long', 'short', 'fat', 'narrow', 'spider', 'human', 'horse', 'wings', 'fin', 'poison', 'spikes', 'fur', 'head'];
  await page.goto(url); await page.waitForTimeout(800);
  await ws(() => window.__ws.quick(1, 0)); await page.waitForTimeout(6000);
  const me = await ws(() => window.__ws.G.players[0].me);
  await ws(() => { const r = window.__ws.race; r.weather.on = false; r.weather.next = Infinity; while (r.clock < 2) r.step(1 / 60); const p = window.__ws.G.players[0]; p.cam.pitch = 0.32; p.cam.yaw += 2.2; });
  // The real event once, to see the words on the screen.
  await ws((me) => { window.__ws.event('gene', me); window.__ws.race.weather.gene = 12; }, me);
  await page.waitForTimeout(3300); await shot('message');
  await quiet();
  check('the splice gave it an extra head', await ws((me) => window.__ws.race.worms[me].mut[12] === 1, me));
  // Each mutation by itself, for its picture.
  for (let g = 0; g < 13; g++) {
    await ws(([me, g]) => { const w = window.__ws.race.worms[me]; w.mut = w.mut.map(() => 0); w.mut[g] = 1; }, [me, g]);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${out}/gene-${NAMES[g]}.png`, clip: { x: 200, y: 150, width: 560, height: 360 } });
  }
  // The lot at once, twice over.
  await ws((me) => { const w = window.__ws.race.worms[me]; w.mut = w.mut.map(() => 2); w.mut[1] = 0; w.mut[3] = 0; }, me);
  await page.waitForTimeout(500); await shot('everything');
  // Numbers.
  const n = await ws(() => { const { race } = window.__ws, w = race.worms[0]; const sp = (mut, wet) => { w.mut = mut; w.wet = wet; return window.__ws.speedOf(w); }; const z = () => w.mut.map(() => 0); const base = sp(z(), false);
    const legs = z(); legs[4] = 1; legs[5] = 1; legs[6] = 1; const fin = z(); fin[8] = 1; const out = { legs: sp(legs, false) / base, finDry: sp(fin, false) / base, finWet: sp(fin, true) / base }; w.mut = z(); w.wet = false; return out; });
  console.log(JSON.stringify(n));
  check('three sorts of legs: five per cent faster each', Math.abs(n.legs - 1.05 ** 3) < 1e-6);
  check('a fin: a quarter faster in the rain, and no faster out of it', Math.abs(n.finWet - 1.25) < 1e-6 && Math.abs(n.finDry - 1) < 1e-6);
  // Spikes: taken by the bird, spat out, back in the race.
  await ws((me) => { const w = window.__ws.race.worms[me]; w.mut = w.mut.map(() => 0); w.mut[10] = 1; window.__ws.event('bird', me); }, me);
  await page.waitForFunction((me) => window.__ws.race.worms[me].nested === 1, me, { timeout: 20000 });
  check('a spiky worm at the nest is not eaten', await ws((me) => !window.__ws.race.worms[me].out && window.__ws.race.chicks === 3, me));
  await page.waitForTimeout(4300); await shot('spat');
  await page.waitForFunction((me) => !window.__ws.race.worms[me].nested && !(window.__ws.race.worms[me].fall > 0), me, { timeout: 20000 });
  check('and it comes back to the race', await ws((me) => { const w = window.__ws.race.worms[me]; return !w.out && !w.nested; }, me));
  await quiet();
  // Poison: three poisonous computer worms, one bird each; then the nest is empty of chicks, and the next worm just visits.
  for (let k = 0; k < 3; k++) {
    const idx = await ws(() => { const r = window.__ws.race, w = r.worms.find((o) => !o.human && !o.out && !o.finished); w.mut[9] = 1; window.__ws.event('bird', w.idx); return w.idx; });
    await page.waitForFunction((i) => window.__ws.race.worms[i].out, idx, { timeout: 20000 });
    await quiet();
  }
  check('three poisonous worms eaten: no chicks left', await ws(() => window.__ws.race.chicks) === 0);
  await page.waitForTimeout(7000); await ws(() => { window.__ws.G.players[0].me = window.__ws.race.worms.find((o) => o.out).idx; }); await page.waitForTimeout(600); await shot('dead-chicks');
  await ws((me) => { window.__ws.G.players[0].me = me; const w = window.__ws.race.worms[me]; w.mut = w.mut.map(() => 0); window.__ws.event('bird', me); }, me);
  await page.waitForFunction((me) => window.__ws.race.worms[me].nested === 2, me, { timeout: 20000 });
  check('with no chicks, a worm the bird takes is only dropped in the nest', await ws((me) => !window.__ws.race.worms[me].out, me));
  await page.waitForTimeout(4200); await shot('visit');
  await page.waitForFunction((me) => !window.__ws.race.worms[me].nested, me, { timeout: 20000 });
  check('and jumps back onto the track', await ws((me) => { const w = window.__ws.race.worms[me]; return !w.out && !(w.fall > 0); }, me));
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})();
