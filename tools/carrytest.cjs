// Checks the things that stick to a worm through a cup: being cut in two, a check for $30.00 and a scarlet letter.
// Starts a Grand Prix by keyboard, does all three to worms in the first race, and looks at the score screens and the
// second race. Also takes pictures of those events, the monkey, and an island's shore.
//   node tools/carrytest.cjs <url> <folder for screenshots>
const { chromium } = require('playwright');

(async () => {
  const [url, out] = process.argv.slice(2);
  const browser = await chromium.launch(), errs = [], fails = [];
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  const shot = (n) => page.screenshot({ path: `${out}/carry-${n}.png` });
  const key = async (k, wait = 150) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
  const ws = (fn, arg) => page.evaluate(fn, arg);
  const check = (what, ok) => { console.log((ok ? 'ok    ' : 'FAIL  ') + what); if (!ok) fails.push(what); };
  const finish = () => ws(() => {
    const r = window.__ws.race, A = ['SQUIRM', 'WIGGLE', 'FLOP'];
    for (let n = 0; r.state !== 'done' && n < 90000; n++) { if (n % 12 === 0) r.worms.forEach((w) => { if (w.human) r.press(w.idx, A[(n / 12) % 3]); }); r.step(1 / 60); }
  });
  await page.goto(url); await page.waitForTimeout(800);
  // Main menu -> Grand Prix -> keyboard as player 1 -> first worm -> first cup.
  for (const k of ['Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter']) await key(k);
  await page.waitForTimeout(5600);
  const me = await ws(() => window.__ws.G.players[0].me);

  await ws((me) => window.__ws.event('split', me), me);
  await page.waitForTimeout(1500); await shot('knife');
  await page.waitForTimeout(3000); await shot('halves');
  check('the knife leaves nine worms, two of them halves of the player\'s', await ws((me) => { const r = window.__ws.race; return r.worms.length === 9 && r.worms[me].half && r.worms[8].half && r.worms[8].twin === me && window.__ws.G.views.length === 9; }, me));
  await ws(() => window.__ws.event('check', 0)); await page.waitForTimeout(1500); await shot('check'); await page.waitForTimeout(3000);
  await ws(() => window.__ws.event('check', 0)); await page.waitForTimeout(4500);
  check('two checks stack to $60', await ws(() => window.__ws.race.worms[0].money) === 60);
  await ws(() => window.__ws.event('brand', 1)); await page.waitForTimeout(1500); await shot('iron'); await page.waitForTimeout(3000); await shot('branded');
  check('the iron leaves a scarlet letter', await ws(() => window.__ws.race.worms[1].scarlet) === true);
  await ws(() => window.__ws.event('monkey')); await page.waitForTimeout(2600); await shot('monkey-gather');
  await page.waitForFunction(() => window.__ws.race.weather.monkey && window.__ws.race.weather.monkey.thrown >= 0, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(500); await shot('monkey-throw');
  await page.waitForTimeout(4000);
  check('after the monkey, nobody is left in the air', await ws(() => window.__ws.race.worms.every((w) => !(w.lift > 0) || w.spring) /* (a worm on a spring is in the air honestly) */));

  await finish(); await page.waitForTimeout(2400); await shot('results');
  const table = await page.locator('.panel table').innerText();
  check('the score screen shows $60.00, a scarlet A and both halves', table.includes('$60.00') && /\bA\b/.test(table) && table.includes('Front of') && table.includes('Back of'));
  await key('Enter'); await page.waitForTimeout(900); // next race
  check('the second race starts with the worm still in two, the money and the letter', await ws(() => { const r = window.__ws.race; return r.worms.length === 9 && r.worms.filter((w) => w.half).length === 2 && r.worms.some((w) => w.money === 60) && r.worms.some((w) => w.scarlet); }));
  await ws(() => { const r = window.__ws.race; while (r.clock < 2) r.step(1 / 60); }); await page.waitForTimeout(600); await shot('race2');
  // Half a worm cut again makes two quarters.
  const halfIdx = await ws(() => window.__ws.race.worms.find((w) => w.half).idx);
  await ws((i) => window.__ws.event('split', i), halfIdx); await page.waitForTimeout(4500); await shot('quarters');
  check('cutting a half makes two quarters, ten worms in all', await ws((i) => { const r = window.__ws.race; return r.worms.length === 10 && r.worms[i].cuts === 2 && r.worms[9].cuts === 2 && r.worms.filter((w) => w.root === r.worms[i].root).length === 3 && r.both(i).length === 3; }, halfIdx));
  // The beach, looking out to sea, for the island's shore.
  await ws(() => { window.__ws.quick(1, 2); const r = window.__ws.race; while (r.clock < 1) r.step(1 / 60); window.__ws.G.players[0].cam.pitch = 0.12; window.__ws.G.players[0].cam.yaw += 1.6; });
  await page.waitForTimeout(700); await shot('shore');
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})();
