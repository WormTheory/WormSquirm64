// Opens the game in a headless browser, walks through the menus into a Grand Prix race, plays a
// little, then looks at each track and each split-screen layout. Saves screenshots along the way.
//   node tools/playtest.cjs <url> <folder for screenshots>
const { chromium } = require('playwright');

(async () => {
  const [url, out] = process.argv.slice(2);
  const browser = await chromium.launch();
  const errs = [];
  for (const [name, viewport, hasTouch] of [['desk', { width: 960, height: 600 }, false], ['phone', { width: 400, height: 780 }, true]]) {
    const ctx = await browser.newContext({ viewport, hasTouch, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
    page.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    const shot = (n) => page.screenshot({ path: `${out}/${name}-${n}.png` });
    const key = async (k, wait = 150) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
    const ws = (fn, arg) => page.evaluate(fn, arg);
    await page.goto(url);
    await page.waitForTimeout(1000);
    await shot('title');
    if (hasTouch) {
      // By touch alone: tap through the menus, then tap the on-screen buttons.
      await page.touchscreen.tap(200, 120); await page.waitForTimeout(200); await shot('mode');
      await page.tap('text=GRAND PRIX'); await page.waitForTimeout(200);
      await page.tap('[data-v="touch:0"]'); await page.waitForTimeout(200); await shot('players');
      await page.tap('text=START'); await page.waitForTimeout(200); await shot('worms');
      await page.tap('text=Flopple');
      await page.waitForTimeout(5500);
      const pads = ['SQUIRM', 'WIGGLE', 'UNDULATE', 'FLOP'];
      for (let i = 0; i < 40; i++) { await page.tap(`.pads button:text-is("${pads[i % 4]}")`); await page.waitForTimeout(220); }
    } else {
      await key('Enter'); await shot('mode');           // title -> game select
      await key('Enter');                               // Grand Prix -> who's playing
      await key('Enter'); await shot('players');        // the keyboard goes to player 1...
      await key('ArrowDown'); await key('ArrowUp');     // (up and down do nothing here)
      await key('Enter'); await shot('confirmed');      // ...and confirms it
      await key('Enter'); await key('ArrowRight'); await shot('worms'); // START
      await key('Enter');                               // choose a worm: the race starts
      await page.waitForTimeout(1200); await shot('trackname');
      await page.waitForTimeout(4300);
      const keys = ['KeyJ', 'KeyK', 'KeyL', 'KeyI'];
      for (let i = 0; i < 40; i++) await key(keys[i % 4], 250);
    }
    await shot('race');
    console.log(name, await ws(() => {
      const r = window.__ws.race, w = r.worms[window.__ws.G.players[0].me];
      return JSON.stringify({ phase: window.__ws.phase, state: r.state, t: r.time.toFixed(1), prog: w.prog.toFixed(1), rank: w.rank, spasms: w.count });
    }));
    if (name === 'desk') {
      await key('Escape'); await shot('pause'); await key('Enter');
      // Run the rest of the race at once to reach the results, then on through the cup.
      const finish = () => ws(() => {
        const r = window.__ws.race, me = window.__ws.G.players[0].me, A = ['SQUIRM', 'WIGGLE', 'FLOP'];
        for (let n = 0; r.state !== 'done' && n < 60000; n++) { if (n % 12 === 0) r.press(me, A[(n / 12) % 3]); r.step(1 / 60); }
      });
      await finish(); await page.waitForTimeout(2300); await shot('results');
      for (let t = 1; t < 4; t++) {
        await key('Enter'); await page.waitForTimeout(600);
        await ws(() => { const r = window.__ws.race; while (r.clock < 2) r.step(1 / 60); });
        await page.waitForTimeout(300); await shot('track' + t);
        await finish(); await page.waitForTimeout(2300);
      }
      await key('Enter'); await shot('final');
      await key('Enter'); await page.waitForTimeout(300);
      for (const n of [2, 3, 4]) {
        await ws((n) => { window.__ws.quick(n, n - 1); const r = window.__ws.race; while (r.clock < 3) { r.worms.forEach((w, i) => r.press(i, 'FLOP')); r.step(1 / 60); } }, n);
        await page.waitForTimeout(500); await shot('split' + n);
      }
      await ws(() => { window.__ws.menus.session.players = [{ dev: 'kb', devs: ['kbL', 'kbR'], char: 0 }]; window.__ws.menus.session.mode = 'vs'; window.__ws.menus.trackSel(); });
      await page.waitForTimeout(200); await shot('tracksel');
    }
    await ctx.close();
  }
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close();
})();
