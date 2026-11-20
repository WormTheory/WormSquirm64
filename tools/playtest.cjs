// Opens the game in a headless browser at desktop and phone sizes, plays a little, and saves screenshots.
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
    await page.goto(url);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/${name}-title.png` });
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(4200);
    const keys = ['KeyJ', 'KeyK', 'KeyL', 'KeyI'];
    for (let i = 0; i < 40; i++) { await page.keyboard.press(keys[i % 4]); await page.waitForTimeout(250); }
    await page.screenshot({ path: `${out}/${name}-race.png` });
    // Look around from where the worm has got to: the road should be there from every angle.
    for (let a = 0; a < 4; a++) {
      await page.evaluate((a) => { window.__ws.cam.yaw += Math.PI / 2; window.__ws.cam.pitch = 0.25 + a * 0.2; }, a);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${name}-look${a}.png` });
    }
    console.log(name, await page.evaluate(() => {
      const r = window.__ws.race, w = r.worms[7];
      return JSON.stringify({ mode: window.__ws.mode, state: r.state, t: r.time.toFixed(1), prog: w.prog.toFixed(1), rank: w.rank, spasms: w.count });
    }));
    if (name === 'desk') {
      // Run the rest of the race at once to reach the results screen.
      await page.evaluate(() => {
        const r = window.__ws.race;
        for (let n = 0; r.state !== 'done' && n < 60000; n++) { if (n % 30 === 0) r.press(7, 'FLOP'); r.step(1 / 60); }
      });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${out}/${name}-results.png` });
    }
    await ctx.close();
  }
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close();
})();
