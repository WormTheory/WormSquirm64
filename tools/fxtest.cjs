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
  // Washed over a wall: the worm lies on its back beyond it, and the hand carries it home.
  await race(1, 0);
  await ws(() => { const r = window.__ws.race, w = r.worms[window.__ws.G.players[0].me]; w.x -= 9.8; w.fall = 2.4; w.pit = false; w.dead = false; w.spasm = null; r.step(1 / 60); });
  await page.waitForTimeout(500); await shot('onback');
  await page.waitForTimeout(900); await shot('carried');
  // Baked to death: the hand comes with a jug of water.
  await race(1, 0);
  await ws(() => { const r = window.__ws.race, w = r.worms[window.__ws.G.players[0].me]; w.dead = true; w.fall = 2.6; r.step(1 / 60); });
  await page.waitForTimeout(1500); await shot('jug');
  // The legs drop out of the sky to start with, and jump back up into it at the end.
  await race(1, 0); await ws(() => window.__ws.event('stomp'));
  await page.waitForTimeout(450); await shot('legs-falling');
  await ws(() => { const r = window.__ws.race; r.weather.t = r.weather.len - 0.75; });
  await page.waitForTimeout(450); await shot('legs-leaving');
  for (const [kind, wait] of [['rain', 1500], ['heat', 3500], ['stomp', 2600]]) {
    await race(1, 0); await ws((k) => window.__ws.event(k), kind);
    await page.waitForTimeout(wait); await shot(kind);
  }
  // Item boxes, and a worm that's been given a star, shrunk and then flattened.
  await race(1, 0);
  await ws(() => { const r = window.__ws.race, w = r.worms[window.__ws.G.players[0].me], b = r.items.boxes[1]; w.x = b.x - 5; w.z = b.z - 1; window.__ws.G.players[0].cam.fx = w.x; window.__ws.G.players[0].cam.fz = w.z; r.worms[0].star = 9; r.worms[1].shrunk = 9; r.worms[2].flat = 9; r.worms[3].stun = 9; r.worms[4].boost = 9; for (const j of [3, 4]) { r.worms[j].x = b.x - 4 + (j - 3) * 3; r.worms[j].z = b.z + 5; } for (let i = 0; i < 3; i++) { r.worms[i].x = b.x - 3 + i * 1.5; r.worms[i].z = b.z + 2; } });
  await page.waitForTimeout(500); await shot('boxes');
  // Every worm's victory dance: all eight sent over the line, each to its own spot beyond it.
  await race(1, 0);
  await ws(() => { const r = window.__ws.race, p = window.__ws.G.players[0]; r.worms.forEach((w) => { w.prog = r.laps * r.track.length - 0.5; w.x = 0; w.z = -19 + (w.idx % 4); }); for (let n = 0; n < 240; n++) { r.worms.forEach((w) => r.press(w.idx, 'FLOP')); r.step(1 / 60); } p.cam.yaw = Math.PI / 2 + 0.2; p.cam.pitch = 0.75; });
  console.log('finished:', await ws(() => window.__ws.race.worms.filter((w) => w.finished).length), 'closest two dancers:', await ws(() => { const f = window.__ws.race.worms.filter((w) => w.finished); let m = 99; f.forEach((a, i) => f.forEach((b, j) => { if (j > i) m = Math.min(m, Math.hypot(a.x - b.x, a.z - b.z)); })); return m.toFixed(1); }));
  for (const n of [1, 2]) { await page.waitForTimeout(650); await shot('victory' + n); }
  // The blood moon: the sky turns, one worm rears up and changes, hunts, and its victims get a plaster.
  await race(1, 0);
  await ws(() => window.__ws.event('moon'));
  await page.waitForTimeout(3500); await shot('moon-rear');
  await ws(() => { const r = window.__ws.race, wolf = r.worms[r.weather.wolf], p = window.__ws.G.players[0], me = r.worms[p.me]; me.x = wolf.x + 2.5; me.z = wolf.z; p.cam.yaw += 0.6; });
  await page.waitForTimeout(1700); await shot('moon-wolf');
  await page.waitForTimeout(1500); await shot('moon-plaster');
  console.log('wolf:', await ws(() => window.__ws.race.weather.wolf), 'bitten so far:', await ws(() => window.__ws.race.worms.filter((w) => w.bit || w.patch > 0).length));
  // The tornado, the frost and the earthquake, and the glue, spring and switcheroo items.
  await race(1, 0);
  await ws(() => { window.__ws.event('twister'); const r = window.__ws.race, tw = r.weather.twister, me = r.worms[window.__ws.G.players[0].me]; tw.s = me.s + 14; });
  await page.waitForTimeout(1300); await shot('twister');
  await page.waitForTimeout(900); await shot('twister-up');
  await race(1, 4); await ws(() => window.__ws.event('frost')); await page.waitForTimeout(2500); await shot('frost');
  await race(1, 0); await ws(() => window.__ws.event('quake')); await page.waitForTimeout(1200); await shot('quake');
  await race(1, 0);
  await ws(() => { const r = window.__ws.race, me = r.worms[window.__ws.G.players[0].me]; r.items.ents.push({ type: 'glue', x: me.x, z: me.z + 0.2, vx: 0, vz: 0, owner: -1, grace: 0, life: 9 }); const o = r.worms[0]; o.spring = { t: 0, s0: me.s - 4, lat: -3 }; o.lift = 0.01; });
  await page.waitForTimeout(450); await shot('glue-spring');
  console.log('glued:', await ws(() => window.__ws.race.worms[window.__ws.G.players[0].me].slow > 0));
  // Hail, the mix-up, and a worm in a bubble beside a giant one.
  await race(1, 0); await ws(() => window.__ws.event('hail')); await page.waitForTimeout(2600); await shot('hail');
  await race(1, 0); await ws(() => { window.__ws.event('dizzy'); const r = window.__ws.race, me = r.worms[window.__ws.G.players[0].me]; me.shield = 9; r.worms[0].giant = 9; r.worms[0].x = me.x + 3; r.worms[0].z = me.z + 1; });
  await page.waitForTimeout(900); await shot('dizzy-bubble-giant');
  // The bird takes player one of two; player two races on.
  await race(2, 1);
  await ws(() => window.__ws.event('bird', window.__ws.G.players[0].me));
  await page.waitForTimeout(2300); await shot('bird-down');
  await page.waitForTimeout(2200); await shot('bird-away');
  await page.waitForTimeout(4200); await shot('nest-feeding');
  await page.waitForTimeout(5000); await shot('nest');
  // A second worm is taken: the first player, now watching the race from the nest, sees that feeding too.
  await ws(() => window.__ws.event('bird', 0));
  await page.waitForTimeout(7600); await shot('nest-second');
  // The bird takes the other player too: with everyone playing eaten, the race ends as a draw.
  await ws(() => window.__ws.event('bird', window.__ws.G.players[1].me));
  await page.waitForTimeout(6200); await shot('order-greyed');
  await page.waitForTimeout(10500); await shot('draw');
  console.log('after both players eaten: phase', await ws(() => window.__ws.phase), 'heading', await page.locator('.panel .head').first().textContent().catch(() => '(none)'));
  console.log('eaten:', await ws(() => window.__ws.race.worms.filter((w) => w.out).length), 'errors:', errs.length ? errs : 'none');
  await browser.close();
})();
