// Checks the evil clone (made, named, coloured, there again next race, scoring for itself), the Long mutation
// (stacks, and is passed on to a clone), and that a worm's accessories are shared out when it's cut in two.
//   node tools/mutanttest.cjs <url> <folder for screenshots>
const { chromium } = require('playwright');

(async () => {
  const [url, out] = process.argv.slice(2);
  const browser = await chromium.launch(), errs = [], fails = [];
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  const shot = (n) => page.screenshot({ path: `${out}/mut-${n}.png` });
  const key = async (k, wait = 150) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
  const ws = (fn, arg) => page.evaluate(fn, arg);
  const check = (what, ok) => { console.log((ok ? 'ok    ' : 'FAIL  ') + what); if (!ok) fails.push(what); };
  const quiet = () => page.waitForFunction(() => window.__ws.race.weather.type === 'none', null, { timeout: 30000 });
  await page.goto(url); await page.waitForTimeout(800);
  for (const k of ['Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter']) await key(k); // a Grand Prix, first cup
  await page.waitForTimeout(5600);
  const me = await ws(() => window.__ws.G.players[0].me);
  await ws(() => { const r = window.__ws.race; while (r.clock < 3) r.step(1 / 60); window.__ws.G.players[0].cam.pitch = 0.3; });
  // Long, twice.
  await ws((me) => window.__ws.event('long', me), me); await page.waitForTimeout(1500); await shot('syringe'); await quiet();
  await ws((me) => window.__ws.event('long', me), me); await quiet();
  check('two injections make it long twice over', await ws((me) => window.__ws.race.worms[me].long === 2 && window.__ws.G.views[me].n === 23, me));
  await page.waitForTimeout(600); await shot('long');
  // The clone.
  await ws((me) => window.__ws.event('clone', me), me);
  await page.waitForTimeout(3000); await shot('tank');
  await page.waitForTimeout(1300); await shot('draining');
  await quiet(); await page.waitForTimeout(300);
  const evil = await ws((me) => { const r = window.__ws.race, e = r.worms.find((w) => w.evil); return e && { idx: e.idx, char: e.char, long: e.long, same: e.char === r.worms[me].char, n: r.worms.length, human: e.human }; }, me);
  check('an evil clone of the player\'s worm has joined, as long as it, driven by the computer', evil && evil.same && evil.long === 2 && evil.n === 9 && !evil.human);
  await ws((i) => { window.__ws.G.players[0].me = i; }, evil.idx); await page.waitForTimeout(700); await shot('evil');
  await ws((me) => { window.__ws.G.players[0].me = me; }, me);
  check('a worm is cloned only once', await ws((me) => { window.__ws.event('clone'); const v = window.__ws.race.weather.visit; const r = window.__ws.race; const ok = v !== me && !r.worms[v].evil; r.weather.type = 'none'; r.weather.visit = -1; r.weather.clone = null; return ok; }, me));
  // Accessories shared out by the knife: a letter and three plasters.
  await ws((me) => { const w = window.__ws.race.worms[me]; w.scarlet = true; w.patch = 3; w.money = 30; window.__ws.event('split', me); }, me);
  await quiet();
  const halves = await ws((me) => { const r = window.__ws.race, a = r.worms[me], b = r.worms[r.worms.length - 1]; return { a: [a.scarlet, a.patch, a.money], b: [b.scarlet, b.patch, b.money, b.long, b.root === me] }; }, me);
  console.log(JSON.stringify(halves));
  check('the front keeps the letter and one plaster, the back gets two plasters, and the money is halved', halves.a[0] && halves.a[1] === 1 && halves.a[2] === 15 && !halves.b[0] && halves.b[1] === 2 && halves.b[2] === 15 && halves.b[3] === 2 && halves.b[4]);
  await page.waitForTimeout(500); await shot('halves');
  await ws(() => { const r = window.__ws.race, A = ['SQUIRM', 'WIGGLE', 'FLOP']; r.weather.on = false; for (let n = 0; r.state !== 'done' && n < 90000; n++) { if (n % 12 === 0) r.worms.forEach((w) => { if (w.human) r.press(w.idx, A[(n / 12) % 3]); }); r.step(1 / 60); } });
  await page.waitForTimeout(2400); await shot('results');
  const table = await page.locator('.panel table').innerText();
  check('the score screen names the evil clone', table.includes('Evil '));
  await key('Enter'); await page.waitForTimeout(900);
  check('next race: the clone again, still long, still the computer\'s; the halves still long', await ws(() => { const r = window.__ws.race, e = r.worms.filter((w) => w.evil); return e.length === 1 && e[0].long === 2 && !e[0].human && e[0].root === e[0].idx && r.worms.filter((w) => w.half && w.long === 2).length === 2 && r.worms.length === 10; }));
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})();
