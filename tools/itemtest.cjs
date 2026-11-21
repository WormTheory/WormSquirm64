// Uses every item on a worm in the middle of the pack and checks what the newer ones do. Takes a few pictures.
//   node tools/itemtest.cjs <url> <folder for screenshots>
const { chromium } = require('playwright');

(async () => {
  const [url, out] = process.argv.slice(2);
  const browser = await chromium.launch(), errs = [], fails = [];
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  const ws = (fn, arg) => page.evaluate(fn, arg);
  const check = (what, ok) => { console.log((ok ? 'ok    ' : 'FAIL  ') + what); if (!ok) fails.push(what); };
  await page.goto(url); await page.waitForTimeout(800);
  await ws(() => window.__ws.quick(1, 0)); await page.waitForTimeout(6000);
  const me = await ws(() => window.__ws.G.players[0].me);
  const run = (secs) => ws((secs) => { const r = window.__ws.race; for (let n = 0; n < secs * 60; n++) r.step(1 / 60); }, secs);
  await ws(() => { const r = window.__ws.race; r.weather.on = false; r.weather.next = Infinity; r.items.boxes.forEach((b) => { b.t = 1e9; }); window.__ws.G.players[0].cam.pitch = 0.4; });
  await run(8);
  // Every item there is, one after another, with the race running in between: nothing should break.
  const count = await ws((me) => { const { race } = window.__ws; let n = 0; for (let k = 0; k < 27; k++) { const mid = race.order[Math.floor(race.order.length / 2)]; window.__ws.give(mid.idx, k); n++; for (let s = 0; s < 90; s++) race.step(1 / 60); } return n; }, me);
  check('all 27 items can be used', count === 27);
  await ws(() => { const r = window.__ws.race; r.items.ents.length = 0; r.worms.forEach((w) => { w.egg = 0; w.magnet = null; w.hic = 0; w.sauce = 0; w.stun = 0; }); });
  await run(1);
  const one = (item, fn, arg) => ws(([me, item, fn, arg]) => { window.__ws.give(me, item); return null; }, [me, item]);
  // Compost, salt and a decoy are left on the road.
  await one(12); await one(13); await one(16);
  check('a heap, salt and a decoy are on the road', await ws(() => ['compost', 'salt', 'decoy'].every((t) => window.__ws.race.items.ents.some((e) => e.type === t))));
  await page.waitForTimeout(500); await page.screenshot({ path: `${out}/item-left.png` });
  // The umbrella, the mirror, the coupon.
  await one(15); await one(23); await one(25);
  check('umbrella up, mirror held, $1.50 richer', await ws((me) => { const w = window.__ws.race.worms[me]; return w.brolly > 9 && w.mirror > 14 && w.money === 1.5; }, me));
  // Hiccups for everyone else; hot sauce; an egg that hatches; a magnet that brings three more.
  await one(24);
  check('everyone else has hiccups', await ws((me) => window.__ws.race.worms.every((w) => (w.idx === me ? !(w.hic > 0) : w.hic > 5 || w.out || w.finished)), me));
  const before = await ws((me) => window.__ws.race.worms[me].items, me);
  await one(26); await run(5.5);
  check('the egg hatched into something', await ws((me) => window.__ws.race.worms[me].items, me) === before + 2);
  await one(17); await run(2.5);
  check('the magnet brought three more', await ws((me) => window.__ws.race.worms[me].items, me) === before + 6);
  // The shovel: forwards, underground.
  const s0 = await ws((me) => { const w = window.__ws.race.worms[me]; w.stun = 0; return w.prog; }, me);
  await one(20); await run(1.2);
  check('the shovel took it up the road', await ws((me) => window.__ws.race.worms[me].prog, me) > s0 + 6);
  // The whistle: a bird comes.
  await one(19); await run(0.2);
  check('the whistle brings the bird', await ws(() => window.__ws.race.weather.type) === 'bird');
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})();
