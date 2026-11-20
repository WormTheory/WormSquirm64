// The screens before and between races: title, game mode, who's playing on what, worm select,
// track select, and plain button dialogs (pause, results). Everything can be clicked or tapped,
// and steered from the keyboard or any controller.
import { CHARS } from './characters.js';
import { DEVICE_NAMES, devsOf } from './input.js';
import { drawTrackMap } from './hud.js';
import { buildTrack, CUP } from './sim/track.js';
import { settings, saveSettings, renderPx, uiPx } from './settings.js';

export const CSS = `
#ws .panel{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.2vmin;
  background:rgba(8,16,40,.6);pointer-events:auto;text-align:center;box-sizing:border-box;overflow:auto;
  padding:var(--pt) var(--pr) var(--pb) var(--pl)}
#ws .logo{display:flex;align-items:center;justify-content:center;gap:.04em;font-size:clamp(34px,11vmin,110px);padding:0 .15em;
  -webkit-text-stroke:3px #1a0a40;filter:drop-shadow(5px 5px 0 #1a0a40)}
#ws:not(.ghost) [data-tilt]{transform:rotate(-3deg)}
#ws .logo span{-webkit-background-clip:text;background-clip:text;color:transparent}
#ws .logo .ws{line-height:.76;background-image:linear-gradient(#fff36a 20%,#ff8a1c 60%,#e02818)}
#ws .logo .n64{font-size:2.08em;line-height:.8;background-image:linear-gradient(#7cf0ff,#2860e8)}
#ws .head{font-size:clamp(22px,6vmin,54px);padding:0 .15em;background:linear-gradient(#fff36a,#ff8a1c);-webkit-background-clip:text;background-clip:text;
  color:transparent;-webkit-text-stroke:2px #1a0a40;filter:drop-shadow(3px 3px 0 #1a0a40)}
#ws .blink{font-size:clamp(14px,3.6vmin,30px);animation:wsb 1s steps(2) infinite}
@keyframes wsb{50%{opacity:0}}
#ws .help{font-size:clamp(12px,2.1vmin,15px);font-style:normal;font-weight:700;max-width:38em;line-height:1.5;color:#d8e4ff}
#ws table{border-collapse:collapse;font-size:clamp(12px,2.8vmin,22px)}
#ws td{padding:.1em .55em;text-align:left;font-variant-numeric:tabular-nums}
#ws tr.me td{color:#ffe24a}
#ws .dot{display:inline-block;width:.8em;height:.8em;border-radius:50%;border:2px solid #000;vertical-align:-.05em}
#ws .row{display:flex;flex-wrap:wrap;gap:1.6vmin;justify-content:center}
#ws .btn{font:inherit;font-size:clamp(13px,3.2vmin,26px);padding:.4em 1.1em;border:3px solid #000;border-radius:10px;color:#fff;
  background:linear-gradient(#5a6a90,#2a3658);box-shadow:0 5px 0 #000;cursor:pointer}
#ws .btn:disabled{opacity:.4;cursor:default}
#ws .col{display:flex;flex-direction:column;gap:1.6vmin;align-items:stretch}
#ws .opts{display:flex;flex-direction:column;gap:1.4vmin;width:min(94%,30em);font-size:clamp(12px,2.6vmin,20px)}
#ws .opt{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1.2fr) 2.2em;gap:.6em;align-items:center;text-align:left}
#ws .rng{width:100%;height:1.6em;margin:0;min-width:0;touch-action:none}
#ws .rng.foc{outline:3px solid #fff}
#ws .btn.foc{background:linear-gradient(#ff7a3a,#d82818);outline:3px solid #fff}
#ws .assign{display:grid;grid-template-columns:minmax(0,2.2fr) repeat(4,minmax(0,1fr));gap:1vmin;width:min(94%,36em);align-items:stretch;
  font-size:clamp(12px,2.5vmin,19px)}
#ws .assign .hd{padding:.2em 0}
#ws .assign .dev{display:flex;align-items:center;justify-content:center;border:3px solid #000;border-radius:10px;padding:.4em .3em;background:rgba(0,0,0,.45);min-width:0}
#ws .assign .dev.out{background:linear-gradient(#5a6a90,#2a3658)}
#ws .assign .cell{font:inherit;color:#fff;border:3px dashed rgba(255,255,255,.35);border-radius:10px;background:rgba(0,0,0,.3);cursor:pointer;
  min-height:2.4em;padding:0;min-width:0}
#ws .assign .cell.on{border-style:solid;border-color:#000;box-shadow:0 4px 0 #000}
#ws .assign .cell.maybe{animation:wsb 1s steps(2) infinite}
#ws .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1.4vmin;width:min(94%,44em)}
#ws .card{position:relative;border:3px solid #000;border-radius:10px;background:rgba(0,0,0,.45);padding:.6em .2em .4em;cursor:pointer;
  font:inherit;color:#fff;font-size:clamp(11px,2.2vmin,17px);font-style:normal;min-width:0;display:flex;flex-direction:column;align-items:center;gap:.4em}
#ws .card.taken{background:rgba(0,0,0,.75)}
#ws .card.taken .pic{opacity:.45}
#ws .card.foc{outline:3px solid #fff;background:rgba(216,40,24,.55)}
#ws .pic{width:clamp(44px,12vmin,96px);aspect-ratio:1;border:3px solid #000;border-radius:6px;image-rendering:pixelated;display:block;background:#1c2c50}
#ws .tags{position:absolute;top:-.7em;left:0;right:0;display:flex;gap:2px;justify-content:center;flex-wrap:wrap}
#ws .tag{border:2px solid #000;border-radius:6px;padding:0 .3em;font-size:.85em;background:#444c60}
#ws .card canvas{width:clamp(60px,15vmin,120px);aspect-ratio:1}
@media (max-width:520px){#ws .grid.tracks{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (prefers-reduced-motion:reduce){#ws .blink,#ws .assign .cell.maybe{animation:none}}
`;
export const PCOL = ['#e03020', '#2868e8', '#e0a010', '#2f9a38'];

// One card of a worm select grid: the worm's picture and name, and tags over it (who's on it, who has it).
export function wormCard(i, pic, tags, taken) {
  return `<button class="card ${taken ? 'taken' : ''}" type="button" data-a="pick" data-v="${i}"><span class="tags">${tags}</span>
    <img class="pic" src="${pic}" alt="">${CHARS[i].name}</button>`;
}
// Moves a cursor around the four-by-two grid of worms.
export function moveCursor(cur, n) {
  const col = (((cur % 4) + Math.sign(n.dx)) + 4) % 4, row = (Math.floor(cur / 4) + (n.dy ? 1 : 0)) % 2;
  return row * 4 + col;
}

export class Menus {
  // onRace(session) is called when everything's chosen. session: {mode, cpu, players: [{dev, devs, char}], track}
  constructor(panel, inputs, tracks, onRace) {
    this.panel = panel; this.inputs = inputs; this.tracks = tracks; this.onRace = onRace;
    this.touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.session = { mode: 'gp', cpu: true, players: [], track: 0 };
    this.assign = {};      // which player slot (0 to 3) each input is on
    this.conf = new Set(); // the inputs that have confirmed theirs
    this.portraits = [];   // a picture of each worm, set by the game once it can draw them
    this.screen = null; this.focus = 0; this.btns = []; this.tickFn = null;
    this.onOnline = () => {}; // set by the game: what ONLINE leads to once the players are settled
    this.onSettings = () => {}; // set by the game: called when a slider in the options moves
    panel.addEventListener('click', (e) => {
      const t = e.target.closest('[data-a]');
      if (t && this.acts[t.dataset.a]) this.acts[t.dataset.a](t.dataset.v);
    });
    this.acts = {};
  }

  get active() { return this.screen !== null; }
  hide() { this.screen = null; this.panel.hidden = true; }

  // Puts a screen up. acts: what each data-a button does. Buttons with class "btn" (or "card pick") can be steered between.
  put(screen, html, acts, focus = 0) {
    this.screen = screen; this.acts = acts; this.panel.hidden = false; this.tickFn = null; this.onFocus = null;
    this.panel.innerHTML = html;
    this.btns = [...this.panel.querySelectorAll('.btn:not(:disabled),.card.pick,.rng')];
    // Pointing at a button with the mouse picks it out, as steering to it does.
    this.btns.forEach((b, i) => b.addEventListener('pointerenter', () => { if (this.btns[i] === b) this.setFocus(i); }));
    this.setFocus(focus);
  }
  setFocus(i) {
    const n = this.btns.length;
    if (!n) return;
    this.focus = ((i % n) + n) % n;
    this.btns.forEach((b, k) => b.classList.toggle('foc', k === this.focus));
    if (this.onFocus) this.onFocus();
  }
  // Moves between buttons by where they are on the screen: left and right along a row, up and down
  // between rows. So up and down do nothing to a single row of buttons, and left and right nothing to a column.
  steer(nav) {
    const cur = this.btns[this.focus];
    // On a slider, left and right change its value rather than moving on.
    if (cur && cur.classList.contains('rng') && nav.dx) {
      if (nav.dx > 0) cur.stepUp(); else cur.stepDown();
      cur.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (cur && (nav.dx || nav.dy)) {
      const box = (b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; };
      const me = box(cur), sameRow = (o) => Math.abs(o.y - me.y) < Math.min(o.h, me.h) / 2;
      let best = -1, bd = Infinity;
      this.btns.forEach((b, i) => {
        if (b === cur) return;
        const o = box(b);
        let d;
        if (nav.dx) { if (!sameRow(o) || Math.sign(o.x - me.x) !== Math.sign(nav.dx)) return; d = Math.abs(o.x - me.x); }
        else { if (sameRow(o) || Math.sign(o.y - me.y) !== Math.sign(nav.dy)) return; d = Math.abs(o.y - me.y) * 1000 + Math.abs(o.x - me.x); }
        if (d < bd) { bd = d; best = i; }
      });
      if (best >= 0) this.setFocus(best);
    }
    if (nav.ok && this.btns[this.focus]) this.btns[this.focus].click();
  }

  // A plain dialog: some HTML and a row of buttons [{label, fn}]. onBack runs on a back press.
  // withOptions puts the pixel-size sliders above the buttons.
  dialog(html, buttons, onBack, withOptions) {
    const acts = {};
    buttons.forEach((b, i) => { acts['b' + i] = b.fn; });
    this.onBack = onBack || null;
    this.put('dialog', `${html}${withOptions ? this.optionsHtml() : ''}<div class="row">${buttons.map((b, i) => `<button class="btn" type="button" data-a="b${i}">${b.label}</button>`).join('')}</div>`, acts, withOptions ? 2 : 0);
    if (withOptions) this.bindOptions();
  }

  // The main menu.
  title() {
    this.put('title', `<div class="logo" data-tilt="-3"><span class="ws">WORM<br>SQUIRM</span><span class="n64">64</span></div>
      <div class="col"><button class="btn" type="button" data-a="start">START</button>
      <button class="btn" type="button" data-a="controls">CONTROLS</button>
      <button class="btn" type="button" data-a="options">OPTIONS</button></div>`,
    { start: () => this.mode(), controls: () => this.controls(), options: () => this.options() }, this.titleFocus || 0);
  }

  controls() {
    this.titleFocus = 1;
    this.put('controls', `<div class="head">CONTROLS</div>
      <div class="help"><b>Controller:</b> the left stick turns the camera. Every face and shoulder button does something.</div>
      <div class="help"><b>Keyboard and mouse:</b> A/D or the arrow keys turn the camera, or drag with the mouse.
      Q E R F Z X C V and J K L I U O N M do something.</div>
      <div class="help"><b>Touch:</b> drag to turn the camera. Tap the buttons to squirm, wiggle, undulate or flop.</div>
      <div class="help">Your worm heads roughly where the camera points. Roughly.<br>Escape or Start pauses.</div>
      <div class="row"><button class="btn" type="button" data-a="back">BACK</button></div>`, { back: () => this.title() });
    this.tickFn = (nav) => { if (nav.back) this.title(); else this.steer(nav); };
  }

  options() {
    this.titleFocus = 2;
    this.put('options', `<div class="head">OPTIONS</div>${this.optionsHtml()}
      <div class="row"><button class="btn" type="button" data-a="back">BACK</button></div>`, { back: () => this.title() });
    this.bindOptions();
    this.tickFn = (nav) => { if (nav.back) this.title(); else this.steer(nav); };
  }

  // The two pixel-size sliders, shown in the options and in the pause menu. Both read and write the
  // same saved settings, so a change in one place is there in the other.
  optionsHtml() {
    const el = this.panel.parentElement, w = el.clientWidth || 640, h = el.clientHeight || 480;
    const row = (id, label, min, max, step, val) => `<label class="opt"><span>${label}</span>
      <input class="rng" type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" aria-label="${label}"><b id="${id}-v">${val}</b></label>`;
    return `<div class="opts">${row('ws-rpx', 'PICTURE PIXEL SIZE', 1, 8, 0.5, Math.min(8, renderPx(w, h)))}
      ${row('ws-upx', 'MENU AND HUD PIXEL SIZE', 1, 5, 1, uiPx(w, h))}</div>`;
  }
  bindOptions() {
    for (const [id, key] of [['ws-rpx', 'renderPx'], ['ws-upx', 'uiPx']]) {
      const sl = this.panel.querySelector('#' + id);
      if (!sl) continue;
      sl.addEventListener('input', () => {
        settings[key] = +sl.value; saveSettings();
        this.panel.querySelector('#' + id + '-v').textContent = sl.value;
        this.onSettings();
      });
    }
  }

  mode() {
    const go = (m) => { this.session.mode = m; this.players(); };
    const about = [`The four races of the ${CUP.name}, with points.`, 'One race on a track you pick.',
      'Race people elsewhere, with a room code or from the list of open games.'];
    this.put('mode', `<div class="head">SELECT GAME</div><div class="row">
      <button class="btn" type="button" data-a="gp">GRAND PRIX</button><button class="btn" type="button" data-a="vs">VS RACE</button>
      <button class="btn" type="button" data-a="online">ONLINE</button></div>
      <div class="help" id="ws-about"></div>`,
    { gp: () => go('gp'), vs: () => go('vs'), online: () => go('online') }, ['gp', 'vs', 'online'].indexOf(this.session.mode));
    // The line underneath describes whichever one is picked out.
    this.onFocus = () => { this.panel.querySelector('#ws-about').textContent = about[this.focus]; };
    this.onFocus();
  }

  // Who's playing on what: a row for every input there is, and a column for each player slot.
  // An input moves itself left and right to a player number, then presses a button to confirm it.
  // Only a confirmed input can work the buttons underneath. Clicking or tapping a square chooses and confirms at once.
  players() {
    const s = this.session, devs = this.inputs.devices(this.touch);
    for (const d in this.assign) if (!devs.includes(d)) { delete this.assign[d]; this.conf.delete(d); }
    this.devList = devs.join();
    const rows = devs.map((d) => {
      const at = this.assign[d], sure = this.conf.has(d);
      return `<div class="dev ${at === undefined ? 'out' : ''}">${DEVICE_NAMES[d]}</div>` + [0, 1, 2, 3].map((k) =>
        `<button class="cell ${at === k ? (sure ? 'on' : 'maybe') : ''}" type="button" data-a="slot" data-v="${d}:${k}" aria-label="${DEVICE_NAMES[d]} as player ${k + 1}"
          style="${at === k ? (sure ? 'background:' : 'border-color:') + PCOL[k] : ''}">${at === k ? 'P' + (k + 1) + (sure ? ' OK' : '?') : ''}</button>`).join('');
    }).join('');
    const off = this.conf.size ? '' : 'disabled';
    if (this.screen !== 'players') this.pFocus = s.mode === 'online' ? 0 : 1; // START
    this.put('players', `<div class="head">WHO'S PLAYING?</div>
      <div class="assign"><div class="hd">INPUT</div>${[1, 2, 3, 4].map((k) => `<div class="hd" style="color:${PCOL[k - 1]}">P${k}</div>`).join('')}${rows}</div>
      <div class="row">${s.mode === 'online' ? '' : `<button class="btn" type="button" data-a="cpu" ${off}>COMPUTER WORMS: ${s.cpu ? 'ON' : 'OFF'}</button>`}
      <button class="btn" type="button" data-a="go" ${off}>START</button>
      <button class="btn" type="button" data-a="back" ${off}>BACK</button></div>`,
    {
      slot: (v) => {
        const [d, k] = v.split(':');
        if (this.assign[d] === +k && this.conf.has(d)) return this.setSlot(d, undefined);
        if (this.setSlot(d, +k)) { this.conf.add(d); this.players(); }
      },
      cpu: () => { s.cpu = !s.cpu; this.players(); },
      go: () => this.playersDone(),
      back: () => this.mode(),
    }, this.pFocus);
  }
  // Moves an input to a slot, unconfirmed (undefined: not playing). A slot someone else has is refused.
  setSlot(dev, slot) {
    if (slot !== undefined && Object.entries(this.assign).some(([d, k]) => d !== dev && k === slot)) return false;
    this.conf.delete(dev);
    if (slot === undefined) delete this.assign[dev]; else this.assign[dev] = slot;
    this.players();
    return true;
  }
  // The next slot nobody has, going left or right from where an input is now. Off the left end is "not playing".
  nextSlot(dev, dir) {
    const used = new Set(Object.entries(this.assign).filter(([d]) => d !== dev).map(([, k]) => k));
    for (let k = (this.assign[dev] === undefined ? -1 : this.assign[dev]) + dir; k >= 0 && k <= 3; k += dir) if (!used.has(k)) return k;
    return dir < 0 ? undefined : this.assign[dev];
  }
  // Only inputs that confirmed their number play.
  playersDone() {
    const s = this.session, sure = Object.entries(this.assign).filter(([d]) => this.conf.has(d));
    if (!sure.length) return;
    s.players = sure.sort((a, b) => a[1] - b[1]).map(([dev], i) => ({ dev, devs: devsOf(dev), char: -1, cur: i }));
    if (!s.cpu && s.players.length < 2) s.cpu = true; // a race needs someone to race
    if (s.mode === 'online') this.onOnline(s); else this.worms();
  }

  worms() {
    const s = this.session;
    const card = (c, i) => {
      const tags = s.players.map((p, k) => (p.char < 0 && p.cur === i) || p.char === i
        ? `<span class="tag" style="background:${PCOL[k]}">${p.char === i ? 'P' + (k + 1) + ' OK' : 'P' + (k + 1)}</span>` : '').join('');
      return wormCard(i, this.portraits[i], tags, s.players.some((p) => p.char === i));
    };
    this.put('worms', `<div class="head">SELECT WORM</div><div class="grid">${CHARS.map(card).join('')}</div>`,
    {
      pick: (v) => {
        const ps = s.players, p = ps.find((q) => q.dev === 'touch' && q.char < 0) || ps.find((q) => q.char < 0);
        if (p) this.lock(p, +v);
      },
    });
  }
  lock(p, c) {
    const s = this.session;
    if (s.players.some((q) => q.char === c)) return;
    p.char = c; p.cur = c;
    if (s.players.every((q) => q.char >= 0)) { if (s.mode === 'vs') this.trackSel(); else this.onRace(s); } else this.worms();
  }

  trackSel() {
    const s = this.session;
    this.put('tracks', `<div class="head">SELECT TRACK</div><div class="grid tracks">${this.tracks.map((t, i) =>
      `<button class="card pick" type="button" data-a="t" data-v="${i}"><canvas width="128" height="128"></canvas>${t.name}</button>`).join('')}</div>`,
    { t: (v) => { s.track = +v; this.onRace(s); } }, s.track);
    this.panel.querySelectorAll('canvas').forEach((c, i) => drawTrackMap(c, buildTrack(this.tracks[i])));
  }

  // Call every frame while a screen is up.
  tick() {
    const inp = this.inputs, s = this.session, all = inp.nav();
    if (this.screen === 'title') { this.steer(all); return; }
    if (this.screen === 'mode') { if (all.back) { this.titleFocus = 0; this.title(); } else this.steer(all); return; }
    if (this.tickFn) return this.tickFn(all);
    if (this.screen === 'dialog') { if (all.back && this.onBack) this.onBack(); else this.steer(all); return; }
    if (this.screen === 'tracks') {
      if (all.back) { s.players.forEach((p) => { p.char = -1; }); this.worms(); } else this.steer(all);
      return;
    }
    if (this.screen === 'players') {
      const devs = inp.devices(this.touch);
      if (devs.join() !== this.devList) return this.players(); // a controller arrived or left
      for (const d of devs) {
        if (d === 'touch') continue; // (touch works the screen by tapping it)
        const n = inp.nav(devsOf(d)), at = this.assign[d];
        if (this.conf.has(d)) {
          // Confirmed: this input now works the buttons. Back un-confirms.
          if (n.back) return this.setSlot(d, at);
          if (n.start) return this.playersDone();
          this.steer(n);
          if (this.screen !== 'players') return;
          this.pFocus = this.focus;
          continue;
        }
        if (n.dx) return this.setSlot(d, this.nextSlot(d, Math.sign(n.dx)));
        if (n.back) return at === undefined ? this.mode() : this.setSlot(d, undefined);
        if (n.ok || n.start || n.any) {
          if (at === undefined) return this.setSlot(d, this.nextSlot(d, 1));
          this.conf.add(d);
          return this.players();
        }
      }
      if (inp.esc) this.mode();
      return;
    }
    if (this.screen === 'worms') {
      for (const p of s.players) {
        const n = inp.nav(p.devs);
        if (p.char < 0 && (n.dx || n.dy)) { p.cur = moveCursor(p.cur, n); return this.worms(); }
        if (n.ok && p.char < 0) return this.lock(p, p.cur);
        if (n.back) {
          if (p.char >= 0) { p.char = -1; return this.worms(); }
          return this.players();
        }
      }
      if (inp.esc) this.players();
    }
  }
}
