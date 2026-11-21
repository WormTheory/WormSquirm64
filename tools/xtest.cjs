// Checks Worm X (he arrives, takes the lead, and is there again in the next race of a cup), plasters that add up,
// the monkey's fall from the sky, and a bird taking both of two chained worms. Takes pictures on the way.
//   node tools/xtest.cjs <url> <folder for screenshots>
const { chromium } = require('playwright');

(async () => {
  const [url, out] = process.argv.slice(2);
  const browser = await chromium.launch(), errs = [], fails = [];
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  const shot = (n) => page.screenshot({ path: `${out}/x-${n}.png` });
  const key = async (k, wait = 150) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
  const ws = (fn, arg) => page.evaluate(fn, arg);
  const check = (what, ok) => { console.log((ok ? 'ok    ' : 'FAIL  ') + what); if (!ok) fails.push(what); };
  await page.goto(url); await page.waitForTimeout(800);
  for (const k of ['Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter']) await key(k); // a Grand Prix, first cup
  await page.waitForTimeout(5600);
  const me = await ws(() => window.__ws.G.players[0].me);
  await ws(() => { const r = window.__ws.race; while (r.clock < 6) r.step(1 / 60); });
  check('the event starts', await ws(() => window.__ws.event('wormx')) === 'wormx');
  await page.waitForTimeout(1300); await shot('entering');
  await page.waitForFunction(() => window.__ws.race.weather.t >= 2.6 || window.__ws.race.weather.type !== 'wormx', null, { timeout: 8000 });
  check('Worm X has joined and is in front', await ws(() => { const r = window.__ws.race, x = r.worms.find((w) => w.char === 8); return r.worms.length === 9 && x && x.rank === 0; }));
  await ws(() => { const r = window.__ws.race, x = r.worms.find((w) => w.char === 8); window.__ws.G.players[0].me = x.idx; window.__ws.G.players[0].cam.pitch = 0.35; });
  await page.waitForTimeout(700); await shot('wormx');
  await ws((me) => { window.__ws.G.players[0].me = me; }, me);
  check('he only comes once', await ws(() => window.__ws.event('wormx')) === 'none');
  // Three bites: three plasters, and a scarlet letter among them.
  await ws((me) => { const w = window.__ws.race.worms[me]; w.patch = 3; w.scarlet = true; }, me);
  await page.waitForTimeout(500); await shot('plasters');
  // The monkey, on its way down.
  await ws(() => window.__ws.event('monkey')); await page.waitForTimeout(450); await shot('monkey-fall');
  await page.waitForFunction(() => window.__ws.race.weather.monkey && window.__ws.race.weather.monkey.thrown >= 0, null, { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(2300); await shot('monkey-flee');
  await page.waitForFunction(() => window.__ws.race.weather.type === 'none', null, { timeout: 20000 });
  // Two chained worms and a bird.
  // A chain gang of three and a bird: the bird takes the lot, and the chicks get them in one feeding.
  const gang = await ws((me) => { const r = window.__ws.race, o = r.worms.filter((w) => w.idx !== me && !w.out && !w.finished && w.char !== 8).slice(0, 2), m = r.worms[me];
    m.chains.push(o[0].idx); o[0].chains.push(me); o[0].chains.push(o[1].idx); o[1].chains.push(o[0].idx);
    o.forEach((w, k) => { w.x = m.x + 1 + k; w.z = m.z + 1; });
    window.__ws.event('bird', o[1].idx); return [me, o[0].idx, o[1].idx]; }, me);
  await page.waitForFunction((p) => window.__ws.race.worms[p[2]].out, gang, { timeout: 20000 });
  check('the bird takes every worm on the chain', await ws((p) => p.every((i) => window.__ws.race.worms[i].out), gang));
  await page.waitForTimeout(400);
  check('and they are one feeding, not three', await ws(() => { const n = window.__ws.nest; return (n.now ? 1 : 0) + n.queue.length === 1 && n.now && n.now.n === 3; }));
  await page.waitForTimeout(2300); await shot('nest-three');
  await ws(() => { const r = window.__ws.race; for (let n = 0; r.state !== 'done' && n < 90000; n++) r.step(1 / 60); });
  await page.waitForTimeout(2400); await shot('results');
  check('Worm X is on the score screen', (await page.locator('.panel table').innerText()).includes('Worm X'));
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})();
