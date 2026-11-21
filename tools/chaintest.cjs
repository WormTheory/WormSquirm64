// Checks the chain: two worms far apart are carried together and chained, can't then get further apart than the
// chain allows, dance side by side, and are still chained in the next race of a cup. Takes pictures on the way.
//   node tools/chaintest.cjs <url> <folder for screenshots>
const { chromium } = require('playwright');

(async () => {
  const [url, out] = process.argv.slice(2);
  const browser = await chromium.launch(), errs = [], fails = [];
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  const shot = (n) => page.screenshot({ path: `${out}/chain-${n}.png` });
  const key = async (k, wait = 150) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
  const ws = (fn, arg) => page.evaluate(fn, arg);
  const check = (what, ok) => { console.log((ok ? 'ok    ' : 'FAIL  ') + what); if (!ok) fails.push(what); };
  await page.goto(url); await page.waitForTimeout(800);
  // Main menu -> Grand Prix -> keyboard as player 1 -> first worm -> the cups: the third is all eight tracks.
  for (const k of ['Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter']) await key(k);
  await shot('cups');
  check('there is an eight-track cup', await page.locator('.card.cup').nth(2).locator('span').count() === 8);
  await key('Enter'); await page.waitForTimeout(5600);
  const me = await ws(() => window.__ws.G.players[0].me);
  // Let them spread out, then chain: the player's worm and whoever's nearest are likely too far apart by now.
  await ws(() => { const r = window.__ws.race; while (r.clock < 14) r.step(1 / 60); r.weather.type = 'none'; r.weather.omen = { kind: 'chain', idx: window.__ws.G.players[0].me }; r.weather.on = true; r.weather.next = 0.05; r.weather.may = ['chain']; });
  await page.waitForFunction(() => window.__ws.race.weather.type === 'chain', null, { timeout: 5000 });
  const far = await ws(() => window.__ws.race.weather.chain.far);
  console.log('carried:', far);
  await page.waitForTimeout(1100); await shot('carry');
  await page.waitForFunction(() => window.__ws.race.worms.some((w) => w.chain >= 0), null, { timeout: 8000 });
  await ws(() => { const x = window.__ws.race.weather; x.on = false; });
  await page.waitForTimeout(300); await shot('on');
  const pair = await ws((me) => { const r = window.__ws.race, w = r.worms[me]; return { a: me, b: w.chain, back: r.worms[w.chain] && r.worms[w.chain].chain }; }, me);
  check('the player\'s worm is chained to another, and that one to it', pair.b >= 0 && pair.back === me);
  const was = await ws(() => { const r = window.__ws.race; return r.worms.filter((w) => w.chain >= 0).map((w) => w.char + '-' + r.worms[w.chain].char).sort().join(' '); });
  await page.waitForTimeout(2500); await shot('racing');
  // Race on for a while: they're never further apart than the chain (with a little slack for the step in between).
  const worst = await ws((p) => { const r = window.__ws.race, a = r.worms[p.a], b = r.worms[p.b], A = ['SQUIRM', 'WIGGLE', 'FLOP']; let over = 0; for (let n = 0; n < 1800; n++) { if (n % 12 === 0) r.press(p.a, A[(n / 12) % 3]); r.step(1 / 60); if (!(a.lift > 0) && !(b.lift > 0) && !a.finished && !b.finished && Math.hypot(a.x - b.x, a.z - b.z) > 3.7) over++; } return over / 1800; }, pair);
  console.log('share of the time further apart than the chain:', worst.toFixed(3));
  check('they stay within the chain\'s length (but for a moment when something flings one away)', worst < 0.05);
  await ws(() => { const r = window.__ws.race, A = ['SQUIRM', 'WIGGLE', 'FLOP']; for (let n = 0; r.state !== 'done' && n < 90000; n++) { if (n % 12 === 0) r.worms.forEach((w) => { if (w.human) r.press(w.idx, A[(n / 12) % 3]); }); r.step(1 / 60); } });
  await ws((p) => { const r = window.__ws.race, a = r.worms[p.a], b = r.worms[p.b]; for (let n = 0; n < 9000 && !(a.finished && b.finished); n++) r.step(1 / 60); for (let n = 0; n < 300; n++) r.step(1 / 60); }, pair);
  const dance = await ws((p) => { const r = window.__ws.race, a = r.worms[p.a], b = r.worms[p.b]; return a.finished && b.finished ? Math.hypot(a.x - b.x, a.z - b.z) : -1; }, pair);
  console.log('apart when dancing:', dance.toFixed(2));
  if (dance >= 0) check('they dance side by side', dance < 2.5);
  await page.waitForTimeout(2400); await shot('dance');
  await key('Enter'); await page.waitForTimeout(900);
  const again = await ws(() => { const r = window.__ws.race; return r.worms.filter((w) => w.chain >= 0).map((w) => w.char + '-' + r.worms[w.chain].char).sort().join(' '); });
  console.log('chained:', was, '| next race:', again);
  check('the same two are still chained in the next race', again === was && was.length > 0);
  await ws(() => { const r = window.__ws.race; while (r.clock < 3) r.step(1 / 60); }); await page.waitForTimeout(600); await shot('race2');
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})();
