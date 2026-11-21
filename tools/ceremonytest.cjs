// Plays a whole cup as fast as the race will go and watches the medal ceremony: bronze, silver and gold each say
// something, and then the final table comes up. Also prints every worm's lines, to read them over.
//   node tools/ceremonytest.cjs <url> <folder for screenshots>
const { chromium } = require('playwright');

(async () => {
  const [url, out] = process.argv.slice(2);
  const browser = await chromium.launch(), errs = [], fails = [];
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  const shot = (n) => page.screenshot({ path: `${out}/medal-${n}.png` });
  const key = async (k, wait = 150) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
  const ws = (fn, arg) => page.evaluate(fn, arg);
  const check = (what, ok) => { console.log((ok ? 'ok    ' : 'FAIL  ') + what); if (!ok) fails.push(what); };
  await page.goto(url); await page.waitForTimeout(800);
  for (const k of ['Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter']) await key(k); // a Grand Prix, first cup
  for (let race = 0; race < 4; race++) {
    await page.waitForFunction(() => window.__ws.phase === 'race', null, { timeout: 10000 });
    if (race === 1) await ws(() => { const r = window.__ws.race; while (r.clock < 3) r.step(1 / 60); window.__ws.event('clone', 2); for (let n = 0; n < 400; n++) r.step(1 / 60); window.__ws.event('wormx'); });
    await ws(() => { const r = window.__ws.race, A = ['SQUIRM', 'WIGGLE', 'FLOP']; r.weather.on = false; for (let n = 0; r.state !== 'done' && n < 90000; n++) { if (n % 12 === 0) r.worms.forEach((w) => { if (w.human) r.press(w.idx, A[(n / 12) % 3]); }); r.step(1 / 60); } });
    await page.waitForSelector('.panel table', { timeout: 10000 }); await page.waitForTimeout(400);
    if (race === 3) check('the last race offers the ceremony', (await page.locator('.panel .btn').first().innerText()).includes('MEDAL CEREMONY'));
    await key('Enter', 600);
  }
  check('the ceremony is on', await ws(() => window.__ws.phase) === 'ceremony');
  await page.waitForTimeout(1200); await shot('podium');
  const seen = [];
  for (let k = 0; k < 3; k++) {
    await page.waitForFunction((k) => window.__ws.ceremony.stage === k, k, { timeout: 30000 });
    await page.waitForFunction(() => { const c = window.__ws.ceremony, s = c.spots[c.order[c.stage]]; return s && c.shown >= s.text.length; }, null, { timeout: 30000 });
    seen.push(await ws(() => { const c = window.__ws.ceremony, s = c.spots[c.order[c.stage]]; return s.medal + ' ' + s.name + ': ' + s.text; }));
    await page.waitForTimeout(300); await shot(['bronze', 'silver', 'gold'][k]);
  }
  console.log(seen.join('\n'));
  check('bronze, then silver, then gold', seen.length === 3 && seen[0].startsWith('BRONZE') && seen[1].startsWith('SILVER') && seen[2].startsWith('GOLD'));
  await page.waitForSelector('.panel table', { timeout: 15000 }); await page.waitForTimeout(500); await shot('table');
  check('then the final table, with a way back to the menu', (await page.locator('.panel .btn').first().innerText()).includes('MAIN MENU'));
  await key('Enter', 800);
  check('and back to the title', await ws(() => window.__ws.phase) === 'menu');
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})();
