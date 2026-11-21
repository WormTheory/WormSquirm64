// Ties it together: the picture (one part of the screen per player), the race at a fixed
// 60 steps a second, each player's camera, and the run of screens around a race.
import * as THREE from '../vendor/three.module.min.js';
import { Race, STEP } from './sim/race.js';
import { TRACKS, CUPS, POINTS, pointAt, centreNear, locate } from './sim/track.js';
import { ACTIONS, speedOf } from './sim/worm.js';
import { CHARS, PICKABLE, X_CHAR, charOf, hex } from './characters.js';
import { buildWorld, disposeWorld } from './view.js';
import { WormView } from './wormview.js';
import { FxView, NestView } from './fxview.js';
import { Inputs } from './input.js';
import { PlayerHud, HudLayer, CSS as HUD_CSS, ORD, fmtTime, FRACTION } from './hud.js';
import { Menus, CSS as MENU_CSS } from './menus.js';
import { Online, CSS as ONLINE_CSS } from './online.js';
import { MirrorRace, snapshot } from './net/mirror.js';
import { makePortraits } from './portraits.js';
import { DomPainter } from './dompaint.js';
import { Ceremony } from './ceremony.js';
import { settings, allowedEvents, autoMode } from './settings.js';
import { playSong, songSpeed, songShift, songLevel, raceSong } from './music.js';
import { begin as beginEvent } from './sim/events.js';
import { GENE, allGenes } from './sim/genes.js';
import { give as giveItem } from './sim/items.js';
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
const titleCam = new THREE.PerspectiveCamera(62, 4 / 3, 0.5, 900);

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
let nest = null;
let ceremony = null; // the medal ceremony at the end of a cup, while it's on
// What sticks to a worm from race to race, through a cup or an online room: eaten by the bird, cut in two, money it's
// been given, a scarlet letter. A worm is known by its number, with a 'b' and the piece's own name on the end for a
// piece that a cut made. pieces: those names, for each worm that's been cut; cuts: how many times each piece has been.
const keyOf = (w) => w.char + (w.pid ? 'b' + w.pid : '');
let carry = { eaten: new Set(), pieces: {}, cuts: {}, scarlet: new Set(), plaster: {}, chains: [], wormx: false, mut: {}, chicks: 3, glam: new Set(), fused: {}, weds: [], money: {} };
const resetCarry = () => { carry = { eaten: new Set(), pieces: {}, cuts: {}, scarlet: new Set(), plaster: {}, chains: [], wormx: false, mut: {}, chicks: 3, glam: new Set(), fused: {}, weds: [], money: {} }; nest = null; };
const resetCarryKeepNest = () => { const n = nest; resetCarry(); nest = n; };
// A plain list of racers [{char, human}], with all that put on: the pieces cut off worms are added on the end.
const notePiece = (w) => { if (w.pid) { const l = carry.pieces[w.char] || (carry.pieces[w.char] = []); if (!l.includes(w.pid)) l.push(w.pid); } };
function dress(base) {
  const out = base.map((r) => ({ ...r, pid: '' }));
  if (carry.wormx) { out.push({ char: X_CHAR, human: false, pid: '' }); base = [...base, { char: X_CHAR, human: false }]; } // (the stranger stays on, at the back of the grid)
  for (const r of base) for (const pid of carry.pieces[r.char] || []) out.push({ char: r.char, human: r.human, pid });
  for (const r of out) { const k = keyOf(r); if (r.pid) r.human = false; r.mut = allGenes(carry.mut[k]); if (!r.mut.some((n) => n)) delete r.mut; r.cuts = carry.cuts[k] || 0; // (a piece cut off a worm, or an evil clone, is nobody's to drive)
 r.half = r.cuts > 0; r.second = !!r.pid; r.out = carry.eaten.has(k); r.money = carry.money[k] || 0; r.scarlet = carry.scarlet.has(k); r.plaster = carry.plaster[k] || 0; r.chains = []; r.glam = carry.glam.has(k); }
  // (A worm that's been fused into another stays in it; and the married stay married.)
  out.forEach((r) => { const into = carry.fused[keyOf(r)], at = into === undefined ? -1 : out.findIndex((q) => keyOf(q) === into); if (at >= 0) { r.fusedTo = at; r.out = true; r.human = false; } });
  for (const [ka, kb] of carry.weds) { const a = out.findIndex((r) => keyOf(r) === ka), b = out.findIndex((r) => keyOf(r) === kb); if (a >= 0 && b >= 0) { out[a].wed = b; out[b].wed = a; } }
  // (An unstable worm: each race one of its other mutations turns into a different one.)
  for (const r of out) {
    if (!r.mut || !r.mut[GENE.unstable]) continue;
    const has = r.mut.map((n, g) => (n && g !== GENE.unstable ? g : -1)).filter((g) => g >= 0);
    if (!has.length) continue;
    const from = has[Math.floor(Math.random() * has.length)];
    let to = from;
    while (to === from || to === GENE.unstable) to = Math.floor(Math.random() * r.mut.length);
    r.mut[from]--; r.mut[to] = (r.mut[to] || 0) + 1;
    carry.mut[keyOf(r)] = r.mut.slice();
  }
  // (Chains: each end is told the other's place in the list.)
  for (const [ka, kb] of carry.chains) { const a = out.findIndex((r) => keyOf(r) === ka), b = out.findIndex((r) => keyOf(r) === kb); if (a >= 0 && b >= 0 && !out[a].out && !out[b].out) { out[a].chains.push(b); out[b].chains.push(a); } }
  return out;
}
// Notes what the race just run has done to its worms.
function remember(race) {
  carry.weds = race.worms.filter((w) => w.wed > w.idx && race.worms[w.wed]).map((w) => [keyOf(w), keyOf(race.worms[w.wed])]);
  carry.chicks = race.chicks;
  carry.chains = race.worms.flatMap((w) => w.chains.filter((m) => m > w.idx && race.worms[m]).map((m) => [keyOf(w), keyOf(race.worms[m])]));
  for (const w of race.worms) {
    const k = keyOf(w);
    carry.cuts[k] = w.cuts; notePiece(w); carry.mut[k] = w.mut.slice();
    if (w.scarlet) carry.scarlet.add(k);
    carry.plaster[k] = w.patch || 0;
    if (w.char === X_CHAR) carry.wormx = true;
    if (w.out && !(w.fusedTo >= 0)) carry.eaten.add(k);
    if (w.fusedTo >= 0 && race.worms[w.fusedTo]) carry.fused[k] = keyOf(race.worms[w.fusedTo]);
    if (w.glam) carry.glam.add(k);
    carry.money[k] = w.money;
  }
}
const MOON_LOOK = 3.2, moonPos = new THREE.Vector3(); // seconds a camera spends looking up at a new blood moon

// racers: [{char, human, out}] in grid order. locals: this screen's players, [{devs, me: their worm's number}].
// mirror: true for a guest, whose race only shows what the host sends.
function setupRace(trackIdx, racers, locals, mirror) {
  if (G) { disposeWorld(G.scene); G.players.forEach((p) => p.hud.remove()); }
  const race = mirror ? new MirrorRace({ trackDef: TRACKS[trackIdx], racers })
    : new Race({ trackDef: TRACKS[trackIdx], seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, racers, events: !!settings.events && locals.length > 0, eventFreq: settings.eventFreq || 5, eventKinds: allowedEvents(), chicks: carry.chicks });
  const scene = buildWorld(race.track);
  const views = race.worms.map((w) => { const v = new WormView(charOf(w), scene); v.reset(w); return v; });
  const fx = new FxView(scene, race);
  const rects = LAYOUTS[Math.max(1, locals.length) - 1];
  // Dragging on the picture turns the camera of whoever has the touch screen, or else the mouse.
  let dragOwner = locals.findIndex((h) => h.devs.includes('touch'));
  if (dragOwner < 0) dragOwner = Math.max(0, locals.findIndex((h) => h.devs.includes('kbL')));
  const players = locals.map((h, i) => {
    const w = race.worms[h.me];
    return {
      devs: h.devs, me: h.me, rect: rects[i], drag: i === dragOwner, spectator: !!h.spectator, auto: true,
      cam: { yaw: w.aim, pitch: 0.4, fx: w.x, fz: w.z },
      camera: new THREE.PerspectiveCamera(62, 4 / 3, 0.5, 900),
      hud: new PlayerHud(hudLayer, huds, rects[i], { split: locals.length > 1, showOrder: locals.length <= 2, inputs: h.devs.includes('touch') ? inputs : null }),
    };
  });
  // With three players the fourth corner shows the whole track from above.
  let overview = null;
  if (locals.length === 3) {
    const tr = race.track;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < tr.N; i++) { x0 = Math.min(x0, tr.px[i]); x1 = Math.max(x1, tr.px[i]); z0 = Math.min(z0, tr.pz[i]); z1 = Math.max(z1, tr.pz[i]); }
    overview = new THREE.PerspectiveCamera(50, 4 / 3, 0.5, 900);
    overview.position.set((x0 + x1) / 2, Math.max(x1 - x0, z1 - z0) * 1.05, (z0 + z1) / 2 + 30);
    overview.lookAt((x0 + x1) / 2, 0, (z0 + z1) / 2);
  }
  G = { race, scene, views, fx, players, overview, trackIdx };
  acc = 0; lastBeep = 9;
  songSpeed(1); songShift(0); songLevel(0);
  Object.assign(DIRECTOR, { until: 0, prio: 0, lastLead: -1, history: [], tick: 0, nestAt: 0 });
}

// Nobody playing: eight worms sitting on the first track's grid, behind the menus.
function backdrop() {
  session = null; net = null; resetCarry();
  setupRace(0, PICKABLE.map((_, char) => ({ char, human: false })), [], false);
  // (Behind the title the worms race properly, the way worms in a racing game ought to. It's a lie.)
  G.race.worms.forEach((w, i) => { w.demo = true; w.demoS = 14 - i * 2.4; w.demoLane = ((i % 4) - 1.5) * 0.42; });
  phase = 'menu';
  trackName.hidden = true;
  playSong('menu');
}
function toTitle() { backdrop(); menus.title(); }

// ---- offline: Grand Prix and VS ----
function startSession(s) {
  sfx.unlock();
  session = { mode: s.mode, cpu: s.cpu, spectate: !!s.spectate, humans: s.players.map((p) => ({ devs: [...p.devs], char: p.char })), track: s.track, cup: CUPS[s.cup || 0], round: 0, points: {} };
  resetCarry();
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
  if (session.mode !== 'gp') resetCarry(); // (what happens to a worm only sticks through a cup)
  const ai = session.cpu ? PICKABLE.map((_, i) => i).filter((i) => !used.has(i)) : [];
  const racer = (char, human) => ({ char, human });
  setupRace(trackIdx, dress(ai.map((c) => racer(c, false)).concat(humans.map((h) => racer(h.char, true)))), session.spectate ? [{ devs: [], me: 0, spectator: true }] : humans.map((h, i) => ({ devs: h.devs, me: ai.length + i })), false);
  menus.hide();
  phase = 'race';
  playSong(raceSong(trackIdx), true);
}

// ---- online ----
const online = new Online(menus, inputs, TRACKS, {
  phase: () => phase,
  dress,
  // The host has started a race (on the host, this is its own start).
  start(room, msg) {
    sfx.unlock();
    net = { room, msg }; session = null;
    // (A guest learns what's stuck to whom from the host's list.)
    resetCarryKeepNest();
    msg.racers.forEach((r, i) => { for (const m of r.chains || []) if (m > i && msg.racers[m]) carry.chains.push([keyOf(r), keyOf(msg.racers[m])]); });
    for (const r of msg.racers) { const k = keyOf(r); if (r.out && !(r.fusedTo >= 0)) carry.eaten.add(k); if (r.fusedTo >= 0 && msg.racers[r.fusedTo]) carry.fused[k] = keyOf(msg.racers[r.fusedTo]); if (r.glam) carry.glam.add(k); carry.cuts[k] = r.cuts || 0; if (r.mut) carry.mut[k] = r.mut.slice(); notePiece(r); if (r.scarlet) carry.scarlet.add(k); carry.plaster[k] = +r.plaster || 0; if (r.char === X_CHAR) carry.wormx = true; carry.money[k] = r.money || 0; }
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

// Points are kept for each worm on its own, and a piece cut off a worm is a worm on its own: when the knife falls the
// points so far are split down the middle, as the money is, and from then on each piece earns for itself.
const pk = keyOf, score = (w) => +(session.points[pk(w)] || 0).toFixed(2);
function showResults() {
  const race = G.race, mine = new Set(G.players.filter((p) => !p.spectator).map((p) => p.me)), gp = session && session.mode === 'gp';
  // If the bird ate everybody who was playing, it's a draw: no places and no points.
  const humans = race.worms.filter((w) => w.human), draw = humans.length > 0 && humans.every((w) => w.out);
  remember(race);
  const place = (w, i) => (w.out || draw ? 0 : POINTS[i] || 0), earned = {};
  race.order.forEach((w, i) => { earned[w.idx] = place(w, i); });
  // (A worm that's part of another gets what that one gets; a married couple put theirs together and halve it.)
  for (const w of race.worms) if (w.fusedTo >= 0) earned[w.idx] = earned[w.fusedTo] || 0;
  for (const w of race.worms) if (w.wed > w.idx && race.worms[w.wed]) { const half = (earned[w.idx] + earned[w.wed]) / 2; earned[w.idx] = half; earned[w.wed] = half; }
  const pts = (w) => earned[w.idx];
  if (gp) race.order.forEach((w) => { session.points[pk(w)] = (session.points[pk(w)] || 0) + pts(w); });
  // A worm's name on the score screen: its colour, a scarlet letter if it wears one, which half it is if it's been cut in two, and its money.
  const cash = (w) => (w.money ? ' <b class="money">&#36;' + w.money.toFixed(2) + '</b>' : '');
  const dot = (w) => `<i class="dot" style="background:${hex(charOf(w).color)}"></i> ${w.scarlet ? '<b class="scarlet">A</b> ' : ''}${w.cuts > 1 ? FRACTION[w.cuts] + ' of ' : w.half ? (w.second ? 'Back of ' : 'Front of ') : ''}${charOf(w).name}${cash(w)}`;
  const rows = race.order.map((w, i) => `<tr class="${mine.has(w.idx) ? 'me' : ''}"><td>${w.out || draw ? '' : i + 1 + ORD[i]}</td><td>${dot(w)}</td>
    <td>${w.fusedTo >= 0 ? 'part of ' + charOf(race.worms[w.fusedTo]).name : w.out ? 'eaten by a bird' : w.finished ? fmtTime(w.finishTime) : 'still squirming'}</td>${gp ? `<td>+${+pts(w).toFixed(2)}</td><td>${score(w)}</td>` : ''}</tr>`).join('');
  const html = `<div class="head">${draw ? 'DRAW' : TRACKS[G.trackIdx].name.toUpperCase()}</div>${draw ? '<div class="help">Everybody playing was eaten.</div>' : ''}<table class="t">${rows}</table>`;
  playSong('results');
  if (net) {
    if (draw) carry.eaten = new Set(); // (or the room's next race would start with nobody in it)
    if (net.room.isHost) menus.dialog(html, [{ label: 'BACK TO LOBBY', fn: () => net.room.toLobby() }, { label: 'LEAVE GAME', fn: () => online.leave() }]);
    else menus.dialog(html + '<div class="help">Waiting for the host.</div>', [{ label: 'LEAVE GAME', fn: () => online.leave() }]);
  } else if (!gp) {
    menus.dialog(html, [{ label: 'RACE AGAIN', fn: () => startRace(G.trackIdx) },
      { label: 'CHANGE TRACK', fn: () => { menus.session.track = G.trackIdx; menus.trackSel(); } }, { label: 'QUIT', fn: toTitle }]);
  } else if (session.round < session.cup.tracks.length - 1 && !draw) { // (a draw ends the cup: there's nobody left to race the rest)
    menus.dialog(html, [{ label: 'NEXT RACE', fn: () => { session.round++; startRace(session.cup.tracks[session.round]); } }, { label: 'QUIT', fn: toTitle }]);
  } else {
    menus.dialog(html, [{ label: 'MEDAL CEREMONY', fn: () => {
      // (One line for each worm, and each piece of a cut worm is a worm.)
      const whole = race.worms.map((w) => ({ ...w, gone: w.out }));
      const final = whole.sort((a, b) => score(b) - score(a));
      // First the top three get their medals and say their piece; then the table.
      const table = () => menus.dialog(`<div class="head">${session.cup.name.toUpperCase()}</div><table class="t">${final.map((w, i) =>
        `<tr class="${mine.has(w.idx) ? 'me' : ''}"><td>${i + 1}${ORD[i]}</td><td>${dot(w)}</td><td>${score(w)} pts${w.gone ? ' (eaten)' : ''}</td></tr>`).join('')}</table>`,
      [{ label: 'MAIN MENU', fn: toTitle }]);
      const top = final.slice(0, 3).map((f) => ({ w: race.worms[f.idx], gone: f.gone && !(f.fusedTo >= 0), chained: f.chains.length > 0, money: f.money, scarlet: f.scarlet }));
      menus.hide();
      phase = 'ceremony';
      ceremony = new Ceremony({ scene: G.scene, race, views: G.views, top, layer: hudLayer, cup: session.cup.name, done: () => { phase = 'after-ceremony'; table(); } });
    } }]);
  }
}

// What the race says happened, turned into noises (and, for a worm the bird got, a place at the nest).
function react(e, mine) {
  const me = e.idx !== undefined && mine(e.idx);
  direct(e);
  switch (e.type) {
    case 'spasm': {
      // (A loud worm is three times as loud; one with hooves clip-clops.)
      const w = G.race.worms[e.idx], vol = (me ? 0.2 : 0.04) * (w.mut[GENE.loud] ? 3 : 1);
      sfx.squelch(vol);
      if (w.mut[GENE.hooves]) sfx.clop(vol);
      break;
    }
    case 'go': sfx.beep(true); break;
    case 'lap': if (me) { sfx.lapJingle(); if (e.lap === G.race.laps) { songSpeed(1.15); songShift(1); } } break; // the last lap goes faster, and a semitone up
    case 'finish': if (me) sfx.finishJingle(); break;
    // Getting an item sounds its own way: a whoosh for a boost, a fanfare for a star, a toss for the things you throw or drop.
    case 'item': sfx.itemUse(e.item, me ? 1 : 0.3); if (me) sfx.itemJingle(); break;
    case 'hit': sfx.hit(me ? 0.2 : 0.05); break;
    case 'hic': sfx.hic(me ? 0.14 : 0.04); break;
    case 'zap': sfx.zap(); G.players.forEach((p) => { p.hud.flash = 0.3; }); break; // (lightning lights up every screen)
    case 'fall': sfx.fallWhistle(me ? 0.12 : 0.03); break;
    case 'die': sfx.sizzle(me ? 0.16 : 0.05); break;
    case 'respawn': if (e.revived) sfx.splash(me ? 0.2 : 0.06); break;
    case 'howl': sfx.howl(); break;
    case 'unwolf': sfx.howl(true); break;
    case 'bitten': sfx.bite(me ? 0.3 : 0.17); break;
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
      const w = G.race.worms[e.idx];
      carry.eaten.add(keyOf(w));
      if (!nest) { nest = new NestView(); nest.onGulp = () => sfx.gulp(); }
      nest.feed({ color: charOf(w).color, mode: 'eat', poison: w.mut[GENE.poison] > 0 }, clockT);
      break;
    }
    case 'nested': {
      // Taken to the nest but not eaten: spat back out (spikes), or dropped in with no chick left alive to eat it.
      const w = G.race.worms[e.idx];
      if (!nest) { nest = new NestView(); nest.onGulp = () => sfx.gulp(); }
      nest.feed({ color: charOf(w).color, mode: e.how, poison: w.mut[GENE.poison] > 0 }, clockT);
      break;
    }
    case 'mutation': sfx.mutate(); break;
    case 'fusion': sfx.squash(); sfx.mutate(); break;
    case 'cut': {
      sfx.chop();
      // (In a cup, the points the worm had are shared between the two pieces.)
      if (session && session.points) { const a = pk(G.race.worms[e.idx]), b = pk(G.race.worms[e.twin]), half = (session.points[a] || 0) / 2; session.points[a] = half; session.points[b] = half; }
      break;
    }
    case 'paid': sfx.kaching(); break;
    case 'chained': sfx.clank(); break;
    case 'jab': sfx.jab(); break;
    case 'newcomer': if (G.race.worms[e.idx].evil) sfx.smash(); break;
    case 'branded': sfx.sizzle(0.2); break;
    case 'monkeygrab': sfx.ook(me ? 0.16 : 0.08); break;
    case 'monkeythrow': sfx.twirl(0.16); break;
    default:
  }
}

// The race behind the title screen. Nothing here is the real game: each worm slides along its own line at a steady
// lick, easing past the others now and then, and slithers as it goes (the view does that for a worm marked demo).
function demoRace(dt) {
  const tr = G.race.track;
  for (const w of G.race.worms) {
    if (!w.demo) continue;
    w.demoS += (8.5 + 1.3 * Math.sin(clockT * 0.23 + w.idx * 1.9)) * dt;
    const lat = (w.demoLane + 0.12 * Math.sin(clockT * 0.31 + w.idx * 2.3)) * tr.hw, p = pointAt(tr, w.demoS, lat);
    w.x = p.x; w.z = p.z; w.s = w.demoS;
  }
}

// ---- spectator mode ----
// Somebody watching has a camera but no worm. They can pick a worm from the list (or step through with left and
// right), or leave AUTO VIEW on and have the game cut to whatever's worth seeing.
const DIRECTOR = { until: 0, prio: 0, lastLead: -1, history: [], tick: 0, nestAt: 0 };
// Cuts an auto-viewing spectator to a worm: prio says how much it matters, hold how many seconds before something lesser can cut away.
// (eaten: this is a look in at the nest, at a worm the bird has had.)
function focus(idx, prio, hold, eaten) {
  const p = G.players.find((q) => q.spectator && q.auto), w = G.race.worms[idx];
  if (!p || !w || (w.out && !eaten) || (clockT < DIRECTOR.until && prio < DIRECTOR.prio)) return;
  p.me = idx; DIRECTOR.until = clockT + hold; DIRECTOR.prio = prio;
}
// What's worth cutting to, as the race reports it.
function direct(e) {
  if (!G.players.some((p) => p.spectator)) return;
  const wx = G.race.weather;
  switch (e.type) {
    case 'event':
      if (wx.visit >= 0) focus(wx.visit, 3, 5);                       // the hand has come for someone
      else if (wx.bird && wx.bird.target !== undefined) focus(wx.bird.target, 3, 7);
      else if (e.kind === 'monkey' || e.kind === 'twister') { const lead = (G.race.order || []).find((w) => !w.out && !w.finished); if (lead) focus(lead.idx, 2, 6); }
      break;
    case 'omen': focus(e.idx, 3, 6); break;                           // an event is about to pick on this worm: be there first
    case 'howl': focus(e.idx, 3, 9); break;                           // the blood moon's choice
    case 'grab': case 'cut': case 'paid': case 'branded': case 'chained': case 'newcomer': case 'mutation': focus(e.idx, 3, 5); break;
    case 'nested': focus(e.idx, 3, 7); break;
    case 'eaten': focus(e.idx, 3, 7, true); break;                    // stay for the whole feeding at the nest
    case 'finish': focus(e.idx, 2, 3.5); break;
    case 'squash': case 'twirl': case 'hailhit': case 'monkeygrab': focus(e.idx, 1, 3); break;
    default:
  }
}
function spectate(p, dt, live) {
  const race = G.race, order = (race.order || race.worms).filter((w) => !w.out);
  if (live) {
    const nav = inputs.nav();
    if (nav.ok) { p.auto = !p.auto; sfx.ui('select'); }
    if (nav.dx && order.length) { const at = order.findIndex((w) => w.idx === p.me); p.me = order[(at + Math.sign(nav.dx) + order.length) % order.length].idx; p.auto = false; sfx.ui('move'); }
    if (nav.start && phase === 'race' && !menus.active) pause(true);
  }
  // (An eaten worm can be watched, at the nest. With no nest to show, as when it was eaten in an earlier race, on to someone else.)
  if (race.worms[p.me].out && !nest && order.length) p.me = order[0].idx;
  if (p.auto && race.state === 'racing') {
    // Once a second: a new leader is worth a look, and so is a worm that's made up three places in eight seconds.
    DIRECTOR.tick -= dt;
    if (DIRECTOR.tick <= 0) {
      DIRECTOR.tick = 1;
      const lead = order.find((w) => !w.finished);
      if (lead && lead.idx !== DIRECTOR.lastLead) { if (DIRECTOR.lastLead >= 0) focus(lead.idx, 1, 4); DIRECTOR.lastLead = lead.idx; }
      const then = DIRECTOR.history.length >= 8 ? DIRECTOR.history[0] : null;
      if (then) for (const w of order) if (!w.finished && then[w.idx] !== undefined && then[w.idx] - w.rank >= 3) { focus(w.idx, 2, 5); break; }
      DIRECTOR.history.push(Object.fromEntries(race.worms.map((w) => [w.idx, w.rank])));
      if (DIRECTOR.history.length > 8) DIRECTOR.history.shift();
      // With nothing going on, back to whoever's in front (and off anyone who's finished).
      if (clockT > DIRECTOR.until && lead && (race.worms[p.me].finished || race.worms[p.me].out || DIRECTOR.prio > 0)) { p.me = lead.idx; DIRECTOR.prio = 0; }
      // Now and then, in a quiet moment, a look in on a worm the bird took.
      const gone = race.worms.filter((w) => w.out);
      if (nest && gone.length && clockT > DIRECTOR.until && clockT > DIRECTOR.nestAt) { DIRECTOR.nestAt = clockT + 18 + Math.random() * 14; focus(gone[Math.floor(Math.random() * gone.length)].idx, 1, 4.5, true); }
    }
  }
  const w = race.worms[p.me], l = locate(race.track, w.x, w.z, -1), fwd = Math.atan2(l.tx, l.tz);
  let want = fwd;
  if (p.auto) {
    // Auto view still turns about its worm, but picks the side to stand on that gets the most other worms in the
    // picture: twice a second it tries every direction and counts who'd be in front of the camera. Looking up the
    // road wins a tie, and so does the angle it already has, so it doesn't dither.
    p.frameT = (p.frameT || 0) - dt;
    if (p.frameT <= 0 || p.frameOf !== p.me || p.frameYaw === undefined) {
      p.frameT = 0.5;
      let best = -1;
      const turn = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
      for (let i = 0; i < 24; i++) {
        const yaw = (i / 24) * Math.PI * 2, sx = Math.sin(yaw), sz = Math.cos(yaw), cx = w.x - sx * 10, cz = w.z - sz * 10;
        let score = 0.6 * Math.cos(yaw - fwd) + (p.frameOf === p.me && p.frameYaw !== undefined && turn(yaw, p.frameYaw) < 0.14 ? 0.7 : 0);
        for (const o of race.worms) {
          if (o === w || o.out) continue;
          const dx = o.x - cx, dz = o.z - cz, d = Math.hypot(dx, dz);
          if (d < 3 || d > 75 || (dx * sx + dz * sz) / d < 0.8) continue; // (within about 37 degrees of straight ahead)
          score += d < 35 ? 1.5 : 1;
        }
        if (score > best) { best = score; want = yaw; }
      }
      p.frameYaw = want; p.frameOf = p.me;
    }
    want = p.frameYaw;
  }
  // (Otherwise the camera swings round behind whichever worm it's on, following the road.)
  const off = Math.atan2(Math.sin(want - p.cam.yaw), Math.cos(want - p.cam.yaw));
  p.cam.yaw += off * Math.min(1, dt * (p.auto ? 2 : 3));
  p.hud.watching = { auto: p.auto };
}
canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  for (const p of G ? G.players : []) {
    if (!p.spectator || phase !== 'race') continue;
    const hit = p.hud.hit(e.clientX - r.left, e.clientY - r.top);
    if (!hit) continue;
    if (hit.auto) p.auto = !p.auto; else { p.me = hit.idx; p.auto = false; }
    sfx.ui('select');
  }
});

// live: the players' controls count (false behind a results screen or an online pause).
function stepRace(dt, live, now) {
  const race = G.race;
  for (const p of G.players) {
    if (p.spectator) { spectate(p, dt, live); continue; }
    // (A player whose worm has been fused into another drives that one now, with whoever else does.)
    if (race.worms[p.me].fusedTo >= 0 && race.worms[race.worms[p.me].fusedTo]) p.me = race.worms[p.me].fusedTo;
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
  if (phase === 'menu' && G) demoRace(dt);
  if (phase === 'race') stepRace(dt, !menus.active, now);
  else if (phase === 'after') stepRace(dt, false, now); // the race carries on behind the results
  const medals = phase === 'ceremony' || phase === 'after-ceremony';
  if (!hidden) {
    hudLayer.clear();
    // (Behind the score screen there are no players' views: see below.)
    for (const p of phase === 'after' || medals ? [] : G.players) {
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
    // (A worm cut in two mid-race needs a model for its new half.)
    while (G.views.length < G.race.worms.length) { const w = G.race.worms[G.views.length], v = new WormView(charOf(w), G.scene); v.reset(w); G.views.push(v); }
    { const low = G.race.weather.type === 'lowgrav'; for (const w of G.race.worms) w.floaty = low; }
    G.race.worms.forEach((w, i) => G.views[i].update(w, clockT, G.race.track));
    G.fx.update(G.race, clockT, dt);
    if (nest) { nest.update(clockT, dt); if (nest.watching) nest.watch(G.race, dt); nest.settle(G.race.chicks === undefined ? 3 : G.race.chicks); }
    if (medals) {
      // The medal ceremony runs itself: its own camera, and its words on the HUD. (It stays on behind the final table.)
      if (phase === 'ceremony') { const nav = inputs.nav(); ceremony.step(dt, nav.ok || nav.start); } else { ceremony.aim(dt); ceremony.haunt(); }
      view([0, 0, 1, 1], ceremony.camera);
    } else if (phase === 'after') {
      // Behind the score screen: one picture, circling the worms dancing past the finish line (or, if nobody's
      // finished, the line itself).
      const done = G.race.worms.filter((w) => w.finished && !w.out), mid = pointAt(G.race.track, 7, 0), a = clockT * 0.35;
      const cx = done.length ? done.reduce((n, w) => n + w.x, 0) / done.length : mid.x, cz = done.length ? done.reduce((n, w) => n + w.z, 0) / done.length : mid.z;
      const far = Math.max(11, ...done.map((w) => Math.hypot(w.x - cx, w.z - cz) + 8));
      titleCam.position.set(cx + Math.sin(a) * far, 2.5 + far * 0.33, cz + Math.cos(a) * far);
      titleCam.lookAt(cx, 1, cz);
      view([0, 0, 1, 1], titleCam);
    } else if (G.players.length) {
      renderer.setViewport(0, 0, bufW, bufH); renderer.setScissor(0, 0, bufW, bufH);
      renderer.setClearColor(0x000000); renderer.clear();
      // A player whose worm the bird took watches the nest instead.
      for (const p of G.players) {
        if (!((G.race.worms[p.me].out || G.race.worms[p.me].nested) && nest)) { view(p.rect, p.camera); continue; }
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
      // Behind the menus: a slow turn around the pack as it goes.
      const ws = G.race.worms, mid = ws.reduce((n, w) => n + (w.demoS || 0), 0) / ws.length, p = pointAt(G.race.track, mid, 0), a = clockT * 0.15;
      titleCam.position.set(p.x + Math.sin(a) * 22, 9, p.z + Math.cos(a) * 22);
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
  get race() { return G.race; }, get phase() { return phase; }, get G() { return G; }, get net() { return net; }, get nest() { return nest; }, get ceremony() { return ceremony; }, get session() { return session; }, give: (i, item) => giveItem(G.race, G.race.worms[i], item), speedOf, menus, inputs, online, settings,
  // event(kind, worm) starts a random event now (and, for the bird, says which worm it's after).
  event(kind, target) {
    const r = G.race;
    if (!r.rng) return;
    r.weather.type = 'none';
    beginEvent(r, r.weather, kind, target);
    if (kind === 'bird' && target !== undefined) r.weather.bird.target = target;
    if (['split', 'check', 'brand', 'clone', 'gene'].includes(kind) && target !== undefined) r.weather.visit = target;
    return r.weather.type;
  },
  quick(n = 1, track = 0, cpu = true) {
    const devs = ['kbR', 'kbL', 'pad0', 'pad1'];
    startSession({ mode: 'vs', cpu, track, players: Array.from({ length: n }, (_, i) => ({ devs: [devs[i]], char: i })) });
  },
};
