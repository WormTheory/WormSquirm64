// Ties it together: makes the picture, runs the race at a fixed 60 steps a second, moves the camera.
import * as THREE from '../vendor/three.module.min.js';
import { Race, STEP } from './sim/race.js';
import { TRACKS, buildTrack, pointAt } from './sim/track.js';
import { CHARS } from './characters.js';
import { buildWorld } from './view.js';
import { WormView } from './wormview.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import * as sfx from './audio.js';

const root = document.getElementById('ws');
const canvas = document.createElement('canvas');
canvas.className = 'game';
root.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
const camera = new THREE.PerspectiveCamera(62, 4 / 3, 0.3, 500);
const input = new Input(canvas);
const hud = new Hud(root, input);

// The picture is drawn small (240 lines on its short side) and stretched, as the old machines did.
function resize() {
  const w = root.clientWidth || 640, h = root.clientHeight || 480, k = Math.min(1, 240 / Math.min(w, h), 640 / Math.max(w, h));
  renderer.setSize(Math.max(2, Math.round(w * k)), Math.max(2, Math.round(h * k)), false);
  camera.aspect = w / h;
  camera.fov = w < h ? 80 : 62;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const trackDef = TRACKS[0];
const scene = buildWorld(buildTrack(trackDef));
const q = new URLSearchParams(location.search);
const myChar = Math.max(0, Math.min(7, +(q.get('worm') || 0) | 0));
const views = CHARS.map((c) => new WormView(c, scene));

let race = null, mode = 'title', acc = 0, clockT = 0, lastBeep = 9;
const ME = 7; // the player starts at the back of the grid
const cam = { yaw: 0, pitch: 0.4, fx: 0, fz: 0 };

function newRace() {
  const others = CHARS.map((_, i) => i).filter((i) => i !== myChar);
  const racers = others.map((char) => ({ char, human: false })).concat([{ char: myChar, human: true }]);
  race = new Race({ trackDef, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, racers });
  race.worms.forEach((w) => views[w.char].reset(w));
  const me = race.worms[ME];
  cam.yaw = me.aim; cam.pitch = 0.4; cam.fx = me.x; cam.fz = me.z;
  acc = 0; lastBeep = 9;
  hud.mapFit = null;
}

function startRace() {
  sfx.unlock();
  newRace();
  mode = 'race';
  hud.hidePanel(); hud.inRace(true);
}

newRace();
hud.title(startRace);

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now; clockT += dt;
  const inp = input.poll(dt);
  if (mode === 'title') {
    if (inp.any) startRace();
    // A slow turn around the start line behind the title.
    const p = pointAt(race.track, 0, 0), a = clockT * 0.15;
    camera.position.set(p.x + Math.sin(a) * 26, 11, p.z + Math.cos(a) * 26);
    camera.lookAt(p.x, 1, p.z);
  } else {
    cam.yaw += inp.yaw;
    cam.pitch = Math.max(0.08, Math.min(1.1, cam.pitch + inp.pitch));
    race.setAim(ME, cam.yaw);
    for (const a of inp.presses) race.press(ME, a);
    acc += dt;
    while (acc >= STEP) { race.step(STEP); acc -= STEP; }
    for (const e of race.events) {
      if (e.type === 'spasm') { sfx.squelch(e.idx === ME ? 0.2 : 0.04); if (e.idx === ME) hud.popAction(e.action); }
      else if (e.type === 'go') sfx.beep(true);
      else if (e.type === 'lap' && e.idx === ME) sfx.lapJingle();
      else if (e.type === 'finish' && e.idx === ME) sfx.finishJingle();
      else if (e.type === 'done' && mode === 'race') { mode = 'results'; setTimeout(() => hud.results(race, ME, startRace), 1800); }
    }
    race.events.length = 0;
    if (race.state === 'countdown') {
      const n = Math.ceil(-race.clock);
      if (n <= 3 && n < lastBeep) { lastBeep = n; sfx.beep(false); }
    }
    hud.update(race, ME, dt);
    // The camera follows a smoothed point, so a flop doesn't shake the whole picture.
    const me = race.worms[ME], k = 1 - Math.exp(-dt * 6);
    cam.fx += (me.x - cam.fx) * k; cam.fz += (me.z - cam.fz) * k;
    const D = 10, cp = Math.cos(cam.pitch);
    camera.position.set(cam.fx - Math.sin(cam.yaw) * D * cp, 1.2 + D * Math.sin(cam.pitch), cam.fz - Math.cos(cam.yaw) * D * cp);
    camera.lookAt(cam.fx, 1.2, cam.fz);
  }
  for (const w of race.worms) views[w.char].update(w, clockT);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// For the tests, and for poking at a race from the browser console.
window.__ws = { get race() { return race; }, get mode() { return mode; }, cam, input };
