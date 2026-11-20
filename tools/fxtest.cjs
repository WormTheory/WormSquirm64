// Screenshots of the things the other tests don't reach: the second cup's tracks, each random event,
// and the nest a player watches once the bird has had their worm.
//   node tools/fxtest.cjs <url> <folder for screenshots>
const { chromium } = require('playwright');

(async () => {
  const [url, out] = process.argv.slice(2);
  const browser = await chromium.launch(), errs = [];
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  const shot = (n) => page.screenshot({ path: `${out}/fx-${n}.png` });
  const ws = (fn, arg) => page.evaluate(fn, arg);
  const race = (n, track) => ws(([n, track]) => { window.__ws.quick(n, track); const r = window.__ws.race; while (r.clock < 2) r.step(1 / 60); }, [n, track]);
  await page.goto(url); await page.waitForTimeout(800);
  for (const t of [4, 5, 6, 7]) { await race(1, t); await page.waitForTimeout(700); await shot('track' + t); }
  // Wormbow Road: shove the player's worm off the edge and catch it falling.
  await ws(() => { const r = window.__ws.race, w = r.worms[window.__ws.G.players[0].me]; w.x += 40; r.step(1 / 60); });
  await page.waitForTimeout(450); await shot('fall');
  await page.waitForTimeout(650); await shot('hand');
  // Baked to death: the hand comes with a jug of water.
  await race(1, 0);
  await ws(() => { const r = window.__ws.race, w = r.worms[window.__ws.G.players[0].me]; w.dead = true; w.fall = 2.6; r.step(1 / 60); });
  await page.waitForTimeout(1500); await shot('jug');
  for (const [kind, wait] of [['rain', 1500], ['heat', 3500], ['stomp', 2600]]) {
    await race(1, 0); await ws((k) => window.__ws.event(k), kind);
    await page.waitForTimeout(wait); await shot(kind);
  }
  // Item boxes, and a worm that's been given a star, shrunk and then flattened.
  await race(1, 0);
  await ws(() => { const r = window.__ws.race, w = r.worms[window.__ws.G.players[0].me], b = r.items.boxes[1]; w.x = b.x - 5; w.z = b.z - 1; window.__ws.G.players[0].cam.fx = w.x; window.__ws.G.players[0].cam.fz = w.z; r.worms[0].star = 9; r.worms[1].shrunk = 9; r.worms[2].flat = 9; r.worms[3].stun = 9; r.worms[4].boost = 9; for (const j of [3, 4]) { r.worms[j].x = b.x - 4 + (j - 3) * 3; r.worms[j].z = b.z + 5; } for (let i = 0; i < 3; i++) { r.worms[i].x = b.x - 3 + i * 1.5; r.worms[i].z = b.z + 2; } });
  await page.waitForTimeout(500); await shot('boxes');
  // Every worm's victory dance: all eight finished and lined up in front of the camera.
  await race(1, 0);
  await ws(() => { const r = window.__ws.race, p = window.__ws.G.players[0]; r.worms.forEach((w, i) => { w.finished = true; w.finishTime = 60 + i; w.x = -10 + (i % 4) * 6; w.z = -22 + Math.floor(i / 4) * 5; }); p.cam.fx = -1; p.cam.fz = -19; p.cam.yaw = 0; p.cam.pitch = 0.5; });
  for (const n of [1, 2]) { await page.waitForTimeout(650); await shot('victory' + n); }
  // The bird takes player one of two; player two races on.
  await race(2, 1);
  await ws(() => window.__ws.event('bird', window.__ws.G.players[0].me));
  await page.waitForTimeout(2300); await shot('bird-down');
  await page.waitForTimeout(2200); await shot('bird-away');
  await page.waitForTimeout(4200); await shot('nest-feeding');
  await page.waitForTimeout(5000); await shot('nest');
  console.log('eaten:', await ws(() => window.__ws.race.worms.filter((w) => w.out).length), 'errors:', errs.length ? errs : 'none');
  await browser.close();
})();
