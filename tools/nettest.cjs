// Plays an online race between two tabs of one headless browser (linked through ?net=local, so no
// internet is needed): one hosts, the other finds it in the open games list and joins, both race,
// and both come back to the lobby. The game's files are handed to the browser straight from this folder.
//   node tools/nettest.cjs <folder for screenshots>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const out = process.argv[2], repo = path.join(__dirname, '..');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1 });
  await ctx.route('http://ws.test/**', (route) => {
    const file = path.join(repo, new URL(route.request().url()).pathname);
    if (!file.startsWith(repo) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.html') ? 'text/html' : 'text/javascript' });
  });
  const errs = [], fails = [];
  const check = (what, ok) => { console.log((ok ? 'ok    ' : 'FAIL  ') + what); if (!ok) fails.push(what); };
  const open = async (name) => {
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
    page.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    await page.goto('http://ws.test/index.html?net=local');
    await page.waitForTimeout(600);
    const key = async (k, wait = 150) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
    // Title -> ONLINE -> join on the keyboard -> the host-or-join screen.
    await key('Enter'); await key('ArrowRight'); await key('ArrowRight'); await key('Enter'); await key('Enter'); await key('Enter', 400);
    return { page, key, shot: (n) => page.screenshot({ path: `${out}/net-${name}-${n}.png` }), ws: (fn, arg) => page.evaluate(fn, arg) };
  };

  const host = await open('host');
  await host.key('Enter', 800); // HOST A GAME
  await host.shot('select');
  await host.key('Enter', 400); // the host takes the first worm
  const code = await host.ws(() => window.__ws.online.room && window.__ws.online.room.code);
  check('host opens a room with a four-letter code', /^[A-Z]{4}$/.test(code || ''));

  const guest = await open('guest');
  await guest.page.waitForSelector(`#ws-games button:has-text("${code}")`, { timeout: 8000 }).catch(() => {});
  await guest.shot('browse');
  check('the room shows in the guest\'s open games list', await guest.page.locator(`#ws-games button:has-text("${code}")`).count() === 1);
  await guest.page.click(`#ws-games button:has-text("${code}")`);
  await guest.page.waitForTimeout(1500);
  const seats = () => Promise.all([host, guest].map((t) => t.ws(() => window.__ws.online.room && window.__ws.online.room.state && window.__ws.online.room.state.seats.map((s) => s.char))));
  await guest.key('Enter', 500); // reaches for the worm the host already has
  let [hs, gs] = await seats();
  check('the guest is refused the host\'s worm', !!hs && hs.length === 2 && hs[0] === 0 && hs[1] === -1 && await guest.ws(() => window.__ws.menus.screen) === 'room-select');
  await guest.shot('select');
  await guest.key('ArrowRight'); await guest.key('Enter', 500);
  [hs, gs] = await seats();
  check('the guest picks another, and both sides agree on who has what', hs[1] === 1 && JSON.stringify(hs) === JSON.stringify(gs));
  await host.shot('lobby'); await guest.shot('lobby');

  await host.key('Enter', 6200); // START, then wait out the countdown
  check('both are racing', await host.ws(() => window.__ws.phase) === 'race' && await guest.ws(() => window.__ws.phase) === 'race');
  const keys = ['KeyJ', 'KeyK', 'KeyL', 'KeyI'];
  for (let i = 0; i < 24; i++) { await host.page.keyboard.press(keys[i % 4]); await guest.page.keyboard.press(keys[(i + 1) % 4]); await host.page.waitForTimeout(240); }
  await host.shot('race'); await guest.shot('race');
  const pos = (t) => t.ws(() => window.__ws.race.worms.map((w) => [w.x, w.z, w.count]));
  const [hp, gp] = [await pos(host), await pos(guest)];
  const far = Math.max(...hp.map((w, i) => Math.hypot(w[0] - gp[i][0], w[1] - gp[i][1])));
  check(`the guest shows the worms where the host has them (furthest apart: ${far.toFixed(2)})`, far < 3);
  const mine = await guest.ws(() => window.__ws.G.players[0].me);
  check(`the guest's presses move its worm on the host (${hp[mine][2]} spasms)`, hp[mine][2] > 10);

  // Finish the host's race at once; the guest should follow it to the results.
  await host.ws(() => { const r = window.__ws.race, A = ['SQUIRM', 'WIGGLE', 'FLOP']; for (let n = 0; r.state !== 'done' && n < 60000; n++) { if (n % 12 === 0) r.worms.forEach((w) => { if (w.human) r.press(w.idx, A[(n / 12) % 3]); }); r.step(1 / 60); } });
  await host.page.waitForTimeout(3200);
  await host.shot('results'); await guest.shot('results');
  check('both reach the results', await host.ws(() => window.__ws.phase) === 'after' && await guest.ws(() => window.__ws.phase) === 'after');
  const order = (t) => t.ws(() => window.__ws.race.order.map((w) => w.char).join());
  check('both show the same finishing order', await order(host) === await order(guest));
  await host.key('Enter', 800); // BACK TO LOBBY
  check('both are back in the lobby', await host.ws(() => window.__ws.menus.screen) === 'room' && await guest.ws(() => window.__ws.menus.screen) === 'room');

  await host.page.close();
  await guest.page.waitForTimeout(7000);
  await guest.shot('hostleft');
  check('when the host goes, the guest is told and put back on the online screen', await guest.ws(() => window.__ws.menus.screen) === 'online');

  console.log('errors:', errs.length ? errs : 'none');
  await browser.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})();
