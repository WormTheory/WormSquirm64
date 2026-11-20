// Ties it together: the picture (one part of the screen per player), the race at a fixed
// 60 steps a second, each player's camera, and the run of screens around a race.
import * as THREE from '../vendor/three.module.min.js';
import { Race, STEP } from './sim/race.js';
import { TRACKS, CUP, pointAt } from './sim/track.js';
import { CHARS, hex } from './characters.js';
import { buildWorld, disposeWorld } from './view.js';
import { WormView } from './wormview.js';
import { Inputs } from './input.js';
import { PlayerHud, CSS as HUD_CSS, ORD, fmtTime } from './hud.js';
import { Menus, CSS as MENU_CSS } from './menus.js';
import * as sfx from './audio.js';

const root = document.getElementById('ws');
const style = document.createElement('style');
style.textContent = HUD_CSS + MENU_CSS;
document.head.appendChild(style);
const canvas = document.createElement('canvas');
canvas.className = 'game';
root.appendChild(canvas);
const huds = document.createElement('div');
root.appendChild(huds);
const trackName = document.createElement('div');
trackName.className = 'trackname'; trackName.hidden = true;
root.appendChild(trackName);
const panel = document.createElement('div');
panel.className = 'panel';
root.appendChild(panel);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
renderer.setScissorTest(true);
const inputs = new Inputs(canvas);
const menus = new Menus(panel, inputs, TRACKS, menuRace);
const titleCam = new THREE.PerspectiveCamera(62, 4 / 3, 0.5, 500);

// The picture is drawn small (240 lines on its short side) and stretched, as the old machines did.
let bufW = 2, bufH = 2;
function resize() {
  const w = root.clientWidth || 640, h = root.clientHeight || 480, k = Math.min(1, 240 / Math.min(w, h), 640 / Math.max(w, h));
  bufW = Math.max(2, Math.round(w * k)); bufH = Math.max(2, Math.round(h * k));
  renderer.setSize(bufW, bufH, false);
}
addEventListener('resize', resize);
resize();

// How the screen is shared: [left, top, width, height] as fractions, one per player.
const LAYOUTS = [
  [[0, 0, 1, 1]],
  [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]],
  [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5]],
  [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
];

// The game in hand: the race, its scenery and worm models, and the people playing it.
// phase: 'menu' (worms sit on the grid behind the menus), 'race', 'paused', 'after' (results showing).
let G = null, session = null, phase = 'menu', acc = 0, clockT = 0, lastBeep = 9;

function setupRace(trackIdx, humans, cpu) {
  if (G) { disposeWorld(G.scene); G.players.forEach((p) => p.hud.remove()); }
  const used = new Set(humans.map((h) => h.char));
  const ai = cpu ? CHARS.map((_, i) => i).filter((i) => !used.has(i)) : [];
  const racers = ai.map((char) => ({ char, human: false })).concat(humans.map((h) => ({ char: h.char, human: true })));
  const race = new Race({ trackDef: TRACKS[trackIdx], seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, racers });
  const scene = buildWorld(race.track);
  const views = race.worms.map((w) => { const v = new WormView(CHARS[w.char], scene); v.reset(w); return v; });
  const rects = LAYOUTS[Math.max(1, humans.length) - 1];
  const touchOwner = humans.findIndex((h) => h.devs.includes('touch'));
  const players = humans.map((h, i) => {
    const me = ai.length + i, w = race.worms[me];
    return {
      devs: h.devs, me, rect: rects[i], drag: touchOwner >= 0 ? i === touchOwner : i === 0,
      cam: { yaw: w.aim, pitch: 0.4, fx: w.x, fz: w.z },
      camera: new THREE.PerspectiveCamera(62, 4 / 3, 0.5, 500),
      hud: new PlayerHud(huds, rects[i], { split: humans.length > 1, showOrder: humans.length <= 2, inputs: h.devs.includes('touch') ? inputs : null }),
    };
  });
  // With three players the fourth corner shows the whole track from above.
  let overview = null;
  if (humans.length === 3) {
    const tr = race.track;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < tr.N; i++) { x0 = Math.min(x0, tr.px[i]); x1 = Math.max(x1, tr.px[i]); z0 = Math.min(z0, tr.pz[i]); z1 = Math.max(z1, tr.pz[i]); }
    overview = new THREE.PerspectiveCamera(50, 4 / 3, 0.5, 500);
    overview.position.set((x0 + x1) / 2, Math.max(x1 - x0, z1 - z0) * 1.05, (z0 + z1) / 2 + 30);
    overview.lookAt((x0 + x1) / 2, 0, (z0 + z1) / 2);
  }
  G = { race, scene, views, players, overview, trackIdx };
  acc = 0; lastBeep = 9;
}

function startSession(s) {
  sfx.unlock();
  session = { mode: s.mode, cpu: s.cpu, humans: s.players.map((p) => ({ devs: [...p.devs], char: p.char })), track: s.track, round: 0, points: {} };
  startRace(s.mode === 'gp' ? CUP.tracks[0] : s.track);
}
// Track select reached from a results screen keeps the same session; otherwise the menus start a new one.
function menuRace(s) {
  if (!(session && phase === 'after')) return startSession(s);
  session.humans = s.players.map((p) => ({ devs: [...p.devs], char: p.char }));
  startRace(s.track);
}

function startRace(trackIdx) {
  setupRace(trackIdx, session.humans, session.cpu);
  menus.hide();
  phase = 'race';
}

function toTitle() {
  session = null;
  setupRace(0, [], true);
  phase = 'menu';
  trackName.hidden = true;
  menus.title();
}

function pause(on) {
  if (on) {
    phase = 'paused';
    menus.dialog('<div class="head">PAUSED</div>', [{ label: 'RESUME', fn: () => pause(false) }, { label: 'QUIT', fn: toTitle }], () => pause(false));
  } else { phase = 'race'; menus.hide(); }
}

function showResults() {
  const race = G.race, mine = new Set(G.players.map((p) => p.me)), gp = session.mode === 'gp';
  if (gp) race.order.forEach((w, i) => { session.points[w.char] = (session.points[w.char] || 0) + (CUP.points[i] || 0); });
  const dot = (w) => `<i class="dot" style="background:${hex(CHARS[w.char].color)}"></i> ${CHARS[w.char].name}`;
  const rows = race.order.map((w, i) => `<tr class="${mine.has(w.idx) ? 'me' : ''}"><td>${i + 1}${ORD[i]}</td><td>${dot(w)}</td>
    <td>${w.finished ? fmtTime(w.finishTime) : 'still squirming'}</td>${gp ? `<td>+${CUP.points[i] || 0}</td><td>${session.points[w.char]}</td>` : ''}</tr>`).join('');
  const html = `<div class="head">${TRACKS[G.trackIdx].name.toUpperCase()}</div><table class="t">${rows}</table>`;
  if (!gp) {
    menus.dialog(html, [{ label: 'RACE AGAIN', fn: () => startRace(G.trackIdx) },
      { label: 'CHANGE TRACK', fn: () => { menus.session.track = G.trackIdx; menus.trackSel(); } }, { label: 'QUIT', fn: toTitle }]);
  } else if (session.round < CUP.tracks.length - 1) {
    menus.dialog(html, [{ label: 'NEXT RACE', fn: () => { session.round++; startRace(CUP.tracks[session.round]); } }, { label: 'QUIT', fn: toTitle }]);
  } else {
    menus.dialog(html, [{ label: 'FINAL STANDINGS', fn: () => {
      const final = [...race.worms].sort((a, b) => session.points[b.char] - session.points[a.char]);
      menus.dialog(`<div class="head">${CUP.name.toUpperCase()}</div><table class="t">${final.map((w, i) =>
        `<tr class="${mine.has(w.idx) ? 'me' : ''}"><td>${i + 1}${ORD[i]}</td><td>${dot(w)}</td><td>${session.points[w.char]} pts</td></tr>`).join('')}</table>`,
      [{ label: 'MAIN MENU', fn: toTitle }]);
    } }]);
  }
}

function stepRace(dt, live) {
  const race = G.race;
  for (const p of G.players) {
    const inp = inputs.play(p.devs, dt, p.drag);
    p.cam.yaw += inp.yaw;
    p.cam.pitch = Math.max(0.08, Math.min(1.1, p.cam.pitch + inp.pitch));
    if (!live) continue;
    race.setAim(p.me, p.cam.yaw);
    // Every press shows its name and makes a small noise, whether or not it ends up moving the worm.
    if (race.state !== 'countdown') for (const a of inp.presses) { race.press(p.me, a); p.hud.popAction(a); sfx.squelch(0.05); }
    if (inp.start && phase === 'race') pause(true);
  }
  if (live && inputs.esc && phase === 'race') pause(true);
  if (phase === 'paused') return;
  acc += dt;
  while (acc >= STEP) { race.step(STEP); acc -= STEP; }
  const mine = (i) => G.players.some((p) => p.me === i);
  for (const e of race.events) {
    if (e.type === 'spasm') sfx.squelch(mine(e.idx) ? 0.2 : 0.04);
    else if (e.type === 'go') sfx.beep(true);
    else if (e.type === 'lap' && mine(e.idx)) sfx.lapJingle();
    else if (e.type === 'finish' && mine(e.idx)) sfx.finishJingle();
    else if (e.type === 'done' && phase === 'race') { phase = 'after'; setTimeout(() => { if (phase === 'after') showResults(); }, 1800); }
  }
  race.events.length = 0;
  if (race.state === 'countdown') {
    const n = Math.ceil(-race.clock);
    if (n <= 3 && n < lastBeep) { lastBeep = n; sfx.beep(false); }
  }
  trackName.hidden = !(race.state === 'countdown' && race.clock < -3.2);
  if (!trackName.hidden) trackName.textContent = TRACKS[G.trackIdx].name.toUpperCase();
}

function view(rect, camera) {
  const x = Math.round(rect[0] * bufW), w = Math.round(rect[2] * bufW), h = Math.round(rect[3] * bufH), y = bufH - Math.round(rect[1] * bufH) - h;
  renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h);
  const aspect = (rect[2] * (root.clientWidth || 4)) / (rect[3] * (root.clientHeight || 3));
  if (camera.aspect !== aspect) { camera.aspect = aspect; camera.fov = aspect < 1 ? 80 : 62; camera.updateProjectionMatrix(); }
  renderer.render(G.scene, camera);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now; clockT += dt;
  inputs.frame();
  if (menus.active) menus.tick();
  else if (phase === 'race') stepRace(dt, true);
  if (phase === 'after') stepRace(dt, false); // the race carries on behind the results
  for (const p of G.players) {
    p.hud.update(G.race, p.me, dt);
    // The camera follows a smoothed point, so a flop doesn't shake the whole picture.
    const me = G.race.worms[p.me], k = 1 - Math.exp(-dt * 6), c = p.cam, D = 10, cp = Math.cos(c.pitch);
    c.fx += (me.x - c.fx) * k; c.fz += (me.z - c.fz) * k;
    p.camera.position.set(c.fx - Math.sin(c.yaw) * D * cp, 1.2 + D * Math.sin(c.pitch), c.fz - Math.cos(c.yaw) * D * cp);
    p.camera.lookAt(c.fx, 1.2, c.fz);
  }
  G.race.worms.forEach((w, i) => G.views[i].update(w, clockT));
  if (G.players.length) {
    renderer.setViewport(0, 0, bufW, bufH); renderer.setScissor(0, 0, bufW, bufH);
    renderer.setClearColor(0x000000); renderer.clear();
    for (const p of G.players) view(p.rect, p.camera);
    if (G.overview) view([0.5, 0.5, 0.5, 0.5], G.overview);
  } else {
    // Behind the title: a slow turn around the start line.
    const p = pointAt(G.race.track, 0, 0), a = clockT * 0.15;
    titleCam.position.set(p.x + Math.sin(a) * 26, 11, p.z + Math.cos(a) * 26);
    titleCam.lookAt(p.x, 1, p.z);
    view([0, 0, 1, 1], titleCam);
  }
  inputs.endFrame();
}
toTitle();
requestAnimationFrame(frame);

// For the tests, and for poking at a race from the browser console.
// quick(n, track) starts a VS race at once with n players on made-up devices.
window.__ws = {
  get race() { return G.race; }, get phase() { return phase; }, get G() { return G; }, menus, inputs,
  quick(n = 1, track = 0, cpu = true) {
    const devs = ['kbR', 'kbL', 'pad0', 'pad1'];
    startSession({ mode: 'vs', cpu, track, players: Array.from({ length: n }, (_, i) => ({ devs: [devs[i]], char: i })) });
  },
};
