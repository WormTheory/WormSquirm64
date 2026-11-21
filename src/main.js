// Ties it together: the picture (one part of the screen per player), the race at a fixed
// 60 steps a second, each player's camera, and the run of screens around a race.
import * as THREE from '../vendor/three.module.min.js';
import { Race, STEP } from './sim/race.js';
import { TRACKS, CUPS, POINTS, pointAt, centreNear, locate } from './sim/track.js';
import { ACTIONS } from './sim/worm.js';
import { CHARS, hex } from './characters.js';
import { buildWorld, disposeWorld } from './view.js';
import { WormView } from './wormview.js';
import { FxView, NestView } from './fxview.js';
import { Inputs } from './input.js';
import { PlayerHud, HudLayer, CSS as HUD_CSS, ORD, fmtTime } from './hud.js';
import { Menus, CSS as MENU_CSS } from './menus.js';
import { Online, CSS as ONLINE_CSS } from './online.js';
import { MirrorRace, snapshot } from './net/mirror.js';
import { makePortraits } from './portraits.js';
import { DomPainter } from './dompaint.js';
import { settings, allowedEvents, autoMode } from './settings.js';
import { playSong, songSpeed, songShift, songLevel, raceSong } from './music.js';
import { begin as beginEvent } from './sim/events.js';
import * as sfx from './audio.js';

const root = document.getElementById('ws');
const style = document.createElement('style');
style.textContent = HUD_CSS + MENU_CSS + ONLINE_CSS;
document.head.appendChild(style);
const canvas = document.createElement('canvas');
canvas.className = 'game';
root.appendChild(canvas);
const hudLayer = new HudLayer(root);
const huds = document.createElement('div');
root.appendChild(huds);
const trackName = document.createElement('div');
trackName.className = 'trackname'; trackName.hidden = true;
root.appendChild(trackName);
const panel = document.createElement('div');
panel.className = 'panel';
root.appendChild(panel);
const painter = new DomPainter(root, hudLayer, () => [trackName, ...huds.querySelectorAll('.pads'), panel]);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
renderer.setScissorTest(true);
const inputs = new Inputs(canvas);
const menus = new Menus(panel, inputs, TRACKS, menuRace);
const titleCam = new THREE.PerspectiveCamera(62, 4 / 3, 0.5, 500);

// The picture is drawn small (240 lines on its short side) and stretched, as the old machines did.
// (Left alone it's 240 lines on the short side and never more than 640 on the long one; the options can set the pixel size instead.)
let bufW = 2, bufH = 2;
function resize() {
  const w = root.clientWidth || 640, h = root.clientHeight || 480;
  const k = settings.renderPx ? 1 / settings.renderPx : Math.min(1, 240 / Math.min(w, h), 640 / Math.max(w, h));
  bufW = Math.max(2, Math.round(w * k)); bufH = Math.max(2, Math.round(h * k));
  renderer.setSize(bufW, bufH, false);
}
const applySettings = () => { resize(); hudLayer.resize(); sfx.applyVolume(); };
addEventListener('resize', applySettings);
menus.onSettings = applySettings;
menus.sound = (kind) => sfx.ui(kind);
resize();
menus.portraits = makePortraits(renderer, bufW, bufH);
// Browsers allow no sound until the page has been clicked, tapped or typed at.
for (const e of ['pointerdown', 'keydown']) addEventListener(e, () => sfx.unlock(), { capture: true });

// How the screen is shared: [left, top, width, height] as fractions, one per player.
const LAYOUTS = [
  [[0, 0, 1, 1]],
  [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]],
  [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5]],
  [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
];

// The game in hand: the race, its scenery and models, and the people playing it on this screen.
// phase: 'menu' (worms sit on the grid behind the menus), 'race', 'paused', 'after' (results showing).
// session: what's being played offline (mode, players, cup points). net: the room and start message of an online race.
// eaten: the worms (by number) the bird has taken, who stay gone for the rest of a cup or of a room. nest: where they went.
let G = null, session = null, net = null, phase = 'menu', acc = 0, clockT = 0, lastBeep = 9, lastSnap = 0;
let eaten = new Set(), nest = null;
const MOON_LOOK = 3.2, moonPos = new THREE.Vector3(); // seconds a camera spends looking up at a new blood moon

// racers: [{char, human, out}] in grid order. locals: this screen's players, [{devs, me: their worm's number}].
// mirror: true for a guest, whose race only shows what the host sends.
function setupRace(trackIdx, racers, locals, mirror) {
  if (G) { disposeWorld(G.scene); G.players.forEach((p) => p.hud.remove()); }
  const race = mirror ? new MirrorRace({ trackDef: TRACKS[trackIdx], racers })
    : new Race({ trackDef: TRACKS[trackIdx], seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, racers, events: !!settings.events && locals.length > 0, eventFreq: settings.eventFreq || 5, eventKinds: allowedEvents() });
  const scene = buildWorld(race.track);
  const views = race.worms.map((w) => { const v = new WormView(CHARS[w.char], scene); v.reset(w); return v; });
  const fx = new FxView(scene, race);
  const rects = LAYOUTS[Math.max(1, locals.length) - 1];
  // Dragging on the picture turns the camera of whoever has the touch screen, or else the mouse.
  let dragOwner = locals.findIndex((h) => h.devs.includes('touch'));
  if (dragOwner < 0) dragOwner = Math.max(0, locals.findIndex((h) => h.devs.includes('kbL')));
  const players = locals.map((h, i) => {
    const w = race.worms[h.me];
    return {
      devs: h.devs, me: h.me, rect: rects[i], drag: i === dragOwner,
      cam: { yaw: w.aim, pitch: 0.4, fx: w.x, fz: w.z },
      camera: new THREE.PerspectiveCamera(62, 4 / 3, 0.5, 500),
      hud: new PlayerHud(hudLayer, huds, rects[i], { split: locals.length > 1, showOrder: locals.length <= 2, inputs: h.devs.includes('touch') ? inputs : null }),
    };
  });
  // With three players the fourth corner shows the whole track from above.
  let overview = null;
  if (locals.length === 3) {
    const tr = race.track;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < tr.N; i++) { x0 = Math.min(x0, tr.px[i]); x1 = Math.max(x1, tr.px[i]); z0 = Math.min(z0, tr.pz[i]); z1 = Math.max(z1, tr.pz[i]); }
    overview = new THREE.PerspectiveCamera(50, 4 / 3, 0.5, 500);
    overview.position.set((x0 + x1) / 2, Math.max(x1 - x0, z1 - z0) * 1.05, (z0 + z1) / 2 + 30);
    overview.lookAt((x0 + x1) / 2, 0, (z0 + z1) / 2);
  }
  G = { race, scene, views, fx, players, overview, trackIdx };
  acc = 0; lastBeep = 9;
  songSpeed(1); songShift(0); songLevel(0);
}

// Nobody playing: eight worms sitting on the first track's grid, behind the menus.
function backdrop() {
  session = null; net = null; eaten = new Set(); nest = null;
  setupRace(0, CHARS.map((_, char) => ({ char, human: false })), [], false);
  phase = 'menu';
  trackName.hidden = true;
  playSong('menu');
}
function toTitle() { backdrop(); menus.title(); }

// ---- offline: Grand Prix and VS ----
function startSession(s) {
  sfx.unlock();
  session = { mode: s.mode, cpu: s.cpu, humans: s.players.map((p) => ({ devs: [...p.devs], char: p.char })), track: s.track, cup: CUPS[s.cup || 0], round: 0, points: {} };
  eaten = new Set(); nest = null;
  startRace(s.mode === 'gp' ? session.cup.tracks[0] : s.track);
}
// Track select reached from a results screen keeps the same session; otherwise the menus start a new one.
function menuRace(s) {
  if (!(session && phase === 'after')) return startSession(s);
  session.humans = s.players.map((p) => ({ devs: [...p.devs], char: p.char }));
  startRace(s.track);
}
function startRace(trackIdx) {
  const humans = session.humans, used = new Set(humans.map((h) => h.char));
  if (session.mode !== 'gp') { eaten = new Set(); nest = null; } // (the bird's catch only stays caught through a cup)
  const ai = session.cpu ? CHARS.map((_, i) => i).filter((i) => !used.has(i)) : [];
  const racer = (char, human) => ({ char, human, out: eaten.has(char) });
  setupRace(trackIdx, ai.map((c) => racer(c, false)).concat(humans.map((h) => racer(h.char, true))), humans.map((h, i) => ({ devs: h.devs, me: ai.length + i })), false);
  menus.hide();
  phase = 'race';
  playSong(raceSong(trackIdx), true);
}

// ---- online ----
const online = new Online(menus, inputs, TRACKS, {
  phase: () => phase,
  eaten: () => eaten,
  // The host has started a race (on the host, this is its own start).
  start(room, msg) {
    sfx.unlock();
    net = { room, msg }; session = null;
    eaten = new Set(msg.racers.filter((r) => r.out).map((r) => r.char));
    const locals = [];
    msg.seats.forEach((s, k) => { if (s.peer === room.self && online.humans[s.local]) locals.push({ devs: online.humans[s.local].devs, me: msg.seatIdx[k] }); });
    setupRace(msg.track, msg.racers, locals, !room.isHost);
    menus.hide();
    phase = 'race';
    playSong(raceSong(msg.track), true);
  },
  snap(msg) { if (net && G.race.onSnap) G.race.onSnap(msg); },
  // Host: a guest's controls, one entry per player they brought.
  input(peer, p) {
    if (!net || !net.room.isHost) return;
    net.msg.seats.forEach((s, k) => {
      const e = s.peer === peer && p[s.local], idx = net.msg.seatIdx[k];
      if (!Array.isArray(e)) return;
      if (Number.isFinite(e[0])) G.race.setAim(idx, e[0]);
      if (Array.isArray(e[1])) for (const a of e[1].slice(0, 8)) if (ACTIONS[a]) G.race.press(idx, ACTIONS[a]);
    });
  },
  // Host: a guest went away. The computer takes over their worms.
  peerLeft(peer) {
    if (!net || !net.room.isHost || !G.race.toAi) return;
    net.msg.seats.forEach((s, k) => { if (s.peer === peer) G.race.toAi(net.msg.seatIdx[k]); });
  },
  ended() { backdrop(); },
});
menus.onOnline = (s) => online.open(s.players.map((p) => ({ dev: p.dev, devs: [...p.devs] })));

function pause(on) {
  if (!on) { if (phase === 'paused') phase = 'race'; return menus.hide(); }
  if (net) {
    // An online race can't stop for one player: this only covers the screen.
    return menus.dialog('<div class="head">STILL RACING</div>', [{ label: 'RESUME', fn: () => pause(false) }, { label: 'LEAVE GAME', fn: () => online.leave() }], () => pause(false), true);
  }
  phase = 'paused';
  menus.dialog('<div class="head">PAUSED</div>', [{ label: 'RESUME', fn: () => pause(false) }, { label: 'QUIT', fn: toTitle }], () => pause(false), true);
}

function showResults() {
  const race = G.race, mine = new Set(G.players.map((p) => p.me)), gp = session && session.mode === 'gp';
  // If the bird ate everybody who was playing, it's a draw: no places and no points.
  const humans = race.worms.filter((w) => w.human), draw = humans.length > 0 && humans.every((w) => w.out);
  const pts = (w, i) => (w.out || draw ? 0 : POINTS[i] || 0);
  if (gp) race.order.forEach((w, i) => { session.points[w.char] = (session.points[w.char] || 0) + pts(w, i); });
  const dot = (w) => `<i class="dot" style="background:${hex(CHARS[w.char].color)}"></i> ${CHARS[w.char].name}`;
  const rows = race.order.map((w, i) => `<tr class="${mine.has(w.idx) ? 'me' : ''}"><td>${w.out || draw ? '' : i + 1 + ORD[i]}</td><td>${dot(w)}</td>
    <td>${w.out ? 'eaten by a bird' : w.finished ? fmtTime(w.finishTime) : 'still squirming'}</td>${gp ? `<td>+${pts(w, i)}</td><td>${session.points[w.char]}</td>` : ''}</tr>`).join('');
  const html = `<div class="head">${draw ? 'DRAW' : TRACKS[G.trackIdx].name.toUpperCase()}</div>${draw ? '<div class="help">Everybody playing was eaten.</div>' : ''}<table class="t">${rows}</table>`;
  playSong('results');
  if (net) {
    if (draw) eaten = new Set(); // (or the room's next race would start with nobody in it)
    if (net.room.isHost) menus.dialog(html, [{ label: 'BACK TO LOBBY', fn: () => net.room.toLobby() }, { label: 'LEAVE GAME', fn: () => online.leave() }]);
    else menus.dialog(html + '<div class="help">Waiting for the host.</div>', [{ label: 'LEAVE GAME', fn: () => online.leave() }]);
  } else if (!gp) {
    menus.dialog(html, [{ label: 'RACE AGAIN', fn: () => startRace(G.trackIdx) },
      { label: 'CHANGE TRACK', fn: () => { menus.session.track = G.trackIdx; menus.trackSel(); } }, { label: 'QUIT', fn: toTitle }]);
  } else if (session.round < session.cup.tracks.length - 1 && !draw) { // (a draw ends the cup: there's nobody left to race the rest)
    menus.dialog(html, [{ label: 'NEXT RACE', fn: () => { session.round++; startRace(session.cup.tracks[session.round]); } }, { label: 'QUIT', fn: toTitle }]);
  } else {
    menus.dialog(html, [{ label: 'FINAL STANDINGS', fn: () => {
      const final = [...race.worms].sort((a, b) => session.points[b.char] - session.points[a.char]);
      menus.dialog(`<div class="head">${session.cup.name.toUpperCase()}</div><table class="t">${final.map((w, i) =>
        `<tr class="${mine.has(w.idx) ? 'me' : ''}"><td>${i + 1}${ORD[i]}</td><td>${dot(w)}</td><td>${session.points[w.char]} pts${eaten.has(w.char) ? ' (eaten)' : ''}</td></tr>`).join('')}</table>`,
      [{ label: 'MAIN MENU', fn: toTitle }]);
    } }]);
  }
}

// What the race says happened, turned into noises (and, for a worm the bird got, a place at the nest).
function react(e, mine) {
  const me = e.idx !== undefined && mine(e.idx);
  switch (e.type) {
    case 'spasm': sfx.squelch(me ? 0.2 : 0.04); break;
    case 'go': sfx.beep(true); break;
    case 'lap': if (me) { sfx.lapJingle(); if (e.lap === G.race.laps) { songSpeed(1.15); songShift(1); } } break; // the last lap goes faster, and a semitone up
    case 'finish': if (me) sfx.finishJingle(); break;
    // Getting an item sounds its own way: a whoosh for a boost, a fanfare for a star, a toss for the things you throw or drop.
    case 'item': sfx.itemUse(e.item, me ? 1 : 0.3); if (me) sfx.itemJingle(); break;
    case 'hit': sfx.hit(me ? 0.2 : 0.05); break;
    case 'zap': sfx.zap(); G.players.forEach((p) => { p.hud.flash = 0.3; }); break; // (lightning lights up every screen)
    case 'fall': sfx.fallWhistle(me ? 0.12 : 0.03); break;
    case 'die': sfx.sizzle(me ? 0.16 : 0.05); break;
    case 'respawn': if (e.revived) sfx.splash(me ? 0.2 : 0.06); break;
    case 'howl': sfx.howl(); break;
    case 'unwolf': sfx.howl(true); break;
    case 'bitten': sfx.bite(me ? 0.22 : 0.09); break;
    case 'glued': sfx.glued(me ? 0.14 : 0.04); break;
    case 'twirl': sfx.twirl(me ? 0.16 : 0.06); break;
    case 'tremor': sfx.rumble(); break;
    case 'pop': sfx.pop(me ? 0.16 : 0.05); break;
    case 'hailhit': sfx.hailHit(); break;
    case 'hurt': sfx.hurt(me ? 0.12 : 0.025); break;
    case 'stomp': sfx.stomp(); break;
    case 'squash': sfx.squash(); break;
    case 'grab': sfx.caw(); break;
    case 'event':
      sfx.eventSting(e.kind);
      if (e.kind === 'moon') G.players.forEach((p) => { p.moonT = MOON_LOOK; }); // every camera glances up at it
      break;
    case 'eaten': {
      const char = G.race.worms[e.idx].char;
      eaten.add(char);
      if (!nest) { nest = new NestView(); nest.onGulp = () => sfx.gulp(); }
      nest.feed(CHARS[char].color);
      break;
    }
    default:
  }
}

// live: the players' controls count (false behind a results screen or an online pause).
function stepRace(dt, live, now) {
  const race = G.race;
  for (const p of G.players) {
    const inp = inputs.play(p.devs, dt, p.drag);
    if (!live) continue;
    p.cam.yaw += inp.yaw;
    p.cam.pitch = Math.max(0.08, Math.min(1.1, p.cam.pitch + inp.pitch));
    if (autoMode()) {
      // Auto mode (a debug switch): the worm plays as well as it can by itself. It looks dead along the road and
      // presses a different button every frame, which is faster than counts and never tires a button out.
      const w = race.worms[p.me], l = locate(race.track, w.x, w.z, -1), fwd = Math.atan2(l.tx, l.tz), off = Math.atan2(Math.sin(fwd - p.cam.yaw), Math.cos(fwd - p.cam.yaw));
      p.cam.yaw += off * Math.min(1, dt * 5);
      race.setAim(p.me, fwd + (race.weather.type === 'dizzy' ? Math.PI : 0)); // (in a mix-up, looking backwards is right)
      if (race.state !== 'countdown' && !w.out) race.press(p.me, ACTIONS[(p.autoN = (p.autoN || 0) + 1) % ACTIONS.length]);
      continue;
    }
    race.setAim(p.me, p.cam.yaw);
    // Every press makes a small noise (and the worm shiver), whether or not it ends up moving the worm.
    if (race.state !== 'countdown' && !race.worms[p.me].out) for (const a of inp.presses) { race.press(p.me, a); sfx.squelch(0.05); }
    if (inp.start && phase === 'race' && !menus.active) pause(true);
  }
  if (live && inputs.esc && phase === 'race' && !menus.active) pause(true);
  if (phase === 'paused') return;
  // A guest sends its controls to the host instead of acting on them.
  if (net && !net.room.isHost) { const out = race.takeInputs(G.players.map((p) => p.me), now); if (out) net.room.sendInput(out); }
  acc += dt;
  while (acc >= STEP) { race.step(STEP); acc -= STEP; }
  // The host sends everyone the state of the race, twenty times a second.
  if (net && net.room.isHost && now - lastSnap >= 50) { lastSnap = now; net.room.sendSnap(snapshot(race)); }
  const mine = (i) => G.players.some((p) => p.me === i);
  for (const e of race.events) {
    if (e.type === 'done') {
      if (phase !== 'race') continue;
      const g = G;
      phase = 'after';
      setTimeout(() => { if (phase === 'after' && G === g) showResults(); }, 1800);
    } else react(e, mine);
  }
  race.events.length = 0;
  if (race.state === 'countdown') {
    const n = Math.ceil(-race.clock);
    if (n <= 3 && n < lastBeep) { lastBeep = n; sfx.beep(false); }
  }
  // The music gains a layer while any of this screen's players is in the first three.
  songLevel(G.players.some((p) => { const w = race.worms[p.me]; return !w.out && w.rank < 3; }) && race.state === 'racing' ? 1 : 0);
  trackName.hidden = !(race.state === 'countdown' && race.clock < -3.2);
  if (!trackName.hidden) trackName.textContent = TRACKS[G.trackIdx].name.toUpperCase();
}

function view(rect, camera, scene) {
  const x = Math.round(rect[0] * bufW), w = Math.round(rect[2] * bufW), h = Math.round(rect[3] * bufH), y = bufH - Math.round(rect[1] * bufH) - h;
  renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h);
  const aspect = (rect[2] * (root.clientWidth || 4)) / (rect[3] * (root.clientHeight || 3));
  if (camera.aspect !== aspect) { camera.aspect = aspect; if (!nest || (camera !== nest.camera && camera !== nest.raceCam)) camera.fov = aspect < 1 ? 80 : 62; camera.updateProjectionMatrix(); }
  if (!scene) G.fx.around(camera);
  renderer.render(scene || G.scene, camera);
}

// One turn of the game. hidden: the tab is in the background, so run the race but draw nothing.
let last = performance.now();
function frame(now, hidden) {
  if (!hidden) requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now; clockT += dt;
  inputs.frame();
  if (menus.active) menus.tick();
  if (phase === 'race') stepRace(dt, !menus.active, now);
  else if (phase === 'after') stepRace(dt, false, now); // the race carries on behind the results
  if (!hidden) {
    hudLayer.clear();
    for (const p of G.players) {
      p.hud.update(G.race, p.me, dt);
      // The camera follows a smoothed point, so a flop doesn't shake the whole picture.
      const me = G.race.worms[p.me], k = 1 - Math.exp(-dt * 6), c = p.cam, D = 10, cp = Math.cos(c.pitch);
      // (A worm that's fallen off is watched from where the hand will put it back.)
      const at = me.fall > 0 && me.pit ? centreNear(G.race.track, me.x, me.z) : me;
      c.fx += (at.x - c.fx) * k; c.fz += (at.z - c.fz) * k;
      p.camera.position.set(c.fx - Math.sin(c.yaw) * D * cp, 1.2 + D * Math.sin(c.pitch) + (me.lift || 0) * 0.5, c.fz - Math.cos(c.yaw) * D * cp);
      // (In an earthquake the whole picture judders.)
      if (G.race.weather.type === 'quake') { p.camera.position.x += 0.3 * Math.sin(clockT * 61); p.camera.position.y += 0.22 * Math.sin(clockT * 83); p.camera.position.z += 0.3 * Math.sin(clockT * 71); }
      p.camera.lookAt(c.fx, 1.2 + (me.lift || 0), c.fz);
      if (p.moonT > 0) {
        // The blood moon has just appeared: the camera tips up to it for a moment, then comes back down.
        p.moonT -= dt;
        const u = 1 - p.moonT / MOON_LOOK, ease = (v) => { const k = Math.max(0, Math.min(1, v)); return k * k * (3 - 2 * k); }, b = ease(u / 0.3) * ease((1 - u) / 0.3);
        G.fx.moonAt(p.camera, moonPos);
        p.camera.lookAt(c.fx + (moonPos.x - c.fx) * b, 1.2 + (moonPos.y - 1.2) * b, c.fz + (moonPos.z - c.fz) * b);
      }
    }
    G.race.worms.forEach((w, i) => G.views[i].update(w, clockT, G.race.track));
    G.fx.update(G.race, clockT, dt);
    if (nest) { nest.update(clockT, dt); if (nest.watching) nest.watch(G.race, dt); }
    if (G.players.length) {
      renderer.setViewport(0, 0, bufW, bufH); renderer.setScissor(0, 0, bufW, bufH);
      renderer.setClearColor(0x000000); renderer.clear();
      // A player whose worm the bird took watches the nest instead.
      for (const p of G.players) {
        if (!(G.race.worms[p.me].out && nest)) { view(p.rect, p.camera); continue; }
        // After the feeding the nest looks down on the race: the race first, then the nest and chicks over it, in the way.
        if (nest.watching) {
          view(p.rect, nest.raceCam);
          renderer.autoClear = false; renderer.clearDepth();
          view(p.rect, nest.camera, nest.scene);
          renderer.autoClear = true;
        } else view(p.rect, nest.camera, nest.scene);
      }
      if (G.overview) view([0.5, 0.5, 0.5, 0.5], G.overview);
    } else {
      // Behind the menus: a slow turn around the start line.
      const p = pointAt(G.race.track, 0, 0), a = clockT * 0.15;
      titleCam.position.set(p.x + Math.sin(a) * 26, 11, p.z + Math.cos(a) * 26);
      titleCam.lookAt(p.x, 1, p.z);
      view([0, 0, 1, 1], titleCam);
    }
    painter.draw(now);
  }
  inputs.endFrame();
}

// Browsers give a hidden tab no animation frames and slow its timers, which would freeze a host's
// race for everyone. While hosting and hidden, a timer in a small worker keeps the game turning.
let bg = null;
document.addEventListener('visibilitychange', () => {
  if (bg) { if (bg.terminate) bg.terminate(); else clearInterval(bg); bg = null; }
  if (!document.hidden || !(net && net.room.isHost)) return;
  try {
    bg = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),16)'], { type: 'text/javascript' })));
    bg.onmessage = () => { if (document.hidden) frame(performance.now(), true); };
  } catch (e) { bg = setInterval(() => { if (document.hidden) frame(performance.now(), true); }, 16); }
});

toTitle();
requestAnimationFrame(frame);

// For the tests, and for poking at a race from the browser console.
// quick(n, track) starts a VS race at once with n players on made-up devices.
window.__ws = {
  get race() { return G.race; }, get phase() { return phase; }, get G() { return G; }, get net() { return net; }, get nest() { return nest; }, menus, inputs, online, settings,
  // event(kind, worm) starts a random event now (and, for the bird, says which worm it's after).
  event(kind, target) {
    const r = G.race;
    if (!r.rng) return;
    r.weather.type = 'none';
    beginEvent(r, r.weather, kind);
    if (kind === 'bird' && target !== undefined) r.weather.bird.target = target;
  },
  quick(n = 1, track = 0, cpu = true) {
    const devs = ['kbR', 'kbL', 'pad0', 'pad1'];
    startSession({ mode: 'vs', cpu, track, players: Array.from({ length: n }, (_, i) => ({ devs: [devs[i]], char: i })) });
  },
};
