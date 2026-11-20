// The screens before and between races: title, game mode, who's playing, worm select, track select,
// and plain button dialogs (pause, results). Everything can be clicked or tapped, and steered from
// any joined keyboard half or controller.
import { CHARS, hex } from './characters.js';
import { DEVICE_NAMES } from './input.js';
import { drawTrackMap } from './hud.js';
import { buildTrack, CUP } from './sim/track.js';

export const CSS = `
#ws .panel{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.2vmin;
  background:rgba(8,16,40,.6);pointer-events:auto;text-align:center;box-sizing:border-box;overflow:auto;
  padding:var(--pt) var(--pr) var(--pb) var(--pl)}
#ws .logo{font-size:clamp(34px,11vmin,110px);line-height:.92;padding:0 .15em;background:linear-gradient(#fff36a 20%,#ff8a1c 60%,#e02818);
  -webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:3px #1a0a40;filter:drop-shadow(5px 5px 0 #1a0a40);transform:rotate(-3deg)}
#ws .logo span{font-size:1.5em;background:linear-gradient(#7cf0ff,#2860e8);-webkit-background-clip:text;background-clip:text}
#ws .head{font-size:clamp(22px,6vmin,54px);padding:0 .15em;background:linear-gradient(#fff36a,#ff8a1c);-webkit-background-clip:text;background-clip:text;
  color:transparent;-webkit-text-stroke:2px #1a0a40;filter:drop-shadow(3px 3px 0 #1a0a40)}
#ws .blink{font-size:clamp(14px,3.6vmin,30px);animation:wsb 1s steps(2) infinite}
@keyframes wsb{50%{opacity:0}}
#ws .help{font-size:clamp(10px,2.1vmin,15px);font-style:normal;font-weight:700;max-width:38em;line-height:1.5;color:#d8e4ff}
#ws table{border-collapse:collapse;font-size:clamp(12px,2.8vmin,22px)}
#ws td{padding:.1em .55em;text-align:left;font-variant-numeric:tabular-nums}
#ws tr.me td{color:#ffe24a}
#ws .dot{display:inline-block;width:.8em;height:.8em;border-radius:50%;border:2px solid #000;vertical-align:-.05em}
#ws .row{display:flex;flex-wrap:wrap;gap:1.6vmin;justify-content:center}
#ws .btn{font:inherit;font-size:clamp(13px,3.2vmin,26px);padding:.4em 1.1em;border:3px solid #000;border-radius:10px;color:#fff;
  background:linear-gradient(#5a6a90,#2a3658);box-shadow:0 5px 0 #000;cursor:pointer}
#ws .btn.foc{background:linear-gradient(#ff7a3a,#d82818);outline:3px solid #fff}
#ws .slots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.4vmin;width:min(92%,30em)}
#ws .slot{border:3px solid #000;border-radius:10px;padding:.5em;background:rgba(0,0,0,.45);font-size:clamp(11px,2.6vmin,20px);min-width:0}
#ws .slot small{display:block;font-size:.7em;font-style:normal;font-weight:700;color:#b8c4e0}
#ws .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1.4vmin;width:min(94%,44em)}
#ws .card{position:relative;border:3px solid #000;border-radius:10px;background:rgba(0,0,0,.45);padding:.6em .2em .4em;cursor:pointer;
  font:inherit;color:#fff;font-size:clamp(9px,2.2vmin,17px);min-width:0;display:flex;flex-direction:column;align-items:center;gap:.4em}
#ws .card.taken{opacity:.45}
#ws .card.foc{outline:3px solid #fff;background:rgba(216,40,24,.55)}
#ws .face{width:clamp(34px,9vmin,72px);aspect-ratio:1;border-radius:50%;border:3px solid #000;position:relative;box-sizing:border-box}
#ws .face::before,#ws .face::after{content:"";position:absolute;top:26%;width:24%;aspect-ratio:1;border-radius:50%;background:#fff;border:2px solid #000;
  box-sizing:border-box;box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 99px #111}
#ws .face::before{left:18%}#ws .face::after{right:18%}
#ws .tags{position:absolute;top:-.7em;left:0;right:0;display:flex;gap:2px;justify-content:center}
#ws .tag{border:2px solid #000;border-radius:6px;padding:0 .3em;font-size:.85em}
#ws .card canvas{width:clamp(60px,15vmin,120px);aspect-ratio:1}
@media (max-width:520px){#ws .grid.tracks{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (prefers-reduced-motion:reduce){#ws .blink{animation:none}}
`;
export const PCOL = ['#e03020', '#2868e8', '#e0a010', '#2f9a38'];

export class Menus {
  // onRace(session) is called when everything's chosen. session: {mode, cpu, players: [{devs, char}], track}
  constructor(panel, inputs, tracks, onRace) {
    this.panel = panel; this.inputs = inputs; this.tracks = tracks; this.onRace = onRace;
    this.touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.session = { mode: 'gp', cpu: true, players: [], track: 0 };
    this.screen = null; this.focus = 0; this.btns = [];
    panel.addEventListener('click', (e) => {
      const t = e.target.closest('[data-a]');
      if (t && this.acts[t.dataset.a]) this.acts[t.dataset.a](t.dataset.v);
    });
    this.acts = {};
  }

  get active() { return this.screen !== null; }
  hide() { this.screen = null; this.panel.hidden = true; }

  // Puts a screen up. acts: what each data-a button does. Buttons with class "btn" or "card" can be steered between.
  put(screen, html, acts, focus = 0) {
    this.screen = screen; this.acts = acts; this.panel.hidden = false;
    this.panel.innerHTML = html;
    this.btns = [...this.panel.querySelectorAll('.btn,.card.pick')];
    this.setFocus(focus);
  }
  setFocus(i) {
    const n = this.btns.length;
    if (!n) return;
    this.focus = ((i % n) + n) % n;
    this.btns.forEach((b, k) => b.classList.toggle('foc', k === this.focus));
  }
  steer(nav, cols = 1) {
    if (nav.dx) this.setFocus(this.focus + Math.sign(nav.dx));
    if (nav.dy) this.setFocus(this.focus + Math.sign(nav.dy) * cols);
    if (nav.ok && this.btns[this.focus]) this.btns[this.focus].click();
  }

  // A plain dialog: some HTML and a row of buttons [{label, fn}]. onBack runs on a back press.
  dialog(html, buttons, onBack) {
    const acts = {};
    buttons.forEach((b, i) => { acts['b' + i] = b.fn; });
    this.onBack = onBack || null;
    this.put('dialog', `${html}<div class="row">${buttons.map((b, i) => `<button class="btn" type="button" data-a="b${i}">${b.label}</button>`).join('')}</div>`, acts);
  }

  title() {
    this.put('title', `<div class="logo">WORM<br>SQUIRM <span>64</span></div><div class="blink t">PRESS ANY BUTTON</div>
      <div class="help">Controller: left stick turns the camera. Every face and shoulder button does something.<br>
      Keyboard: A/D or the arrow keys turn the camera. Q E R F Z X C V and J K L I U O N M do something.<br>
      ${this.touch ? 'Touch: drag to turn the camera. Tap the buttons to squirm, wiggle, undulate or flop.<br>' : ''}
      Your worm heads roughly where the camera points. Roughly.</div>`, {});
    this.panel.onclick = () => { if (this.screen === 'title') this.mode(); };
  }

  mode() {
    this.panel.onclick = null;
    const go = (m) => { this.session.mode = m; this.players(); };
    this.put('mode', `<div class="head">SELECT GAME</div><div class="row">
      <button class="btn" type="button" data-a="gp">GRAND PRIX</button><button class="btn" type="button" data-a="vs">VS RACE</button></div>
      <div class="help">Grand Prix: the four races of the ${CUP.name}, with points. VS Race: one race on a track you pick.</div>`,
    { gp: () => go('gp'), vs: () => go('vs') }, this.session.mode === 'vs' ? 1 : 0);
  }

  players() {
    const s = this.session, slot = (i) => {
      const p = s.players[i];
      return `<div class="slot" style="border-color:${p ? PCOL[i] : '#000'}">PLAYER ${i + 1}<small>${p ? DEVICE_NAMES[p.devs[0]] : 'not playing'}</small></div>`;
    };
    this.put('players', `<div class="head">WHO'S PLAYING?</div><div class="slots">${[0, 1, 2, 3].map(slot).join('')}</div>
      <div class="help">To join: press any button on a controller, F on the left of the keyboard, or J on the right.
      Up to four, sharing the screen. Press your back button (B, Q or Backspace) to drop out.</div>
      <div class="row">${this.touch ? `<button class="btn" type="button" data-a="touch">${s.players.some((p) => p.devs[0] === 'touch') ? 'LEAVE' : 'JOIN'} (TOUCH)</button>` : ''}
      <button class="btn" type="button" data-a="cpu">COMPUTER WORMS: ${s.cpu ? 'ON' : 'OFF'}</button>
      <button class="btn" type="button" data-a="go">START</button>
      <button class="btn" type="button" data-a="back">BACK</button></div>`,
    {
      touch: () => this.toggle('touch'),
      cpu: () => { s.cpu = !s.cpu; this.players(); },
      go: () => this.playersDone(),
      back: () => this.mode(),
    }, this.touch ? 2 : 1);
  }
  toggle(dev) {
    const ps = this.session.players, i = ps.findIndex((p) => p.devs[0] === dev);
    if (i >= 0) ps.splice(i, 1); else if (ps.length < 4) ps.push({ devs: [dev], char: -1 });
    this.players();
  }
  playersDone() {
    const s = this.session;
    if (!s.players.length) s.players.push({ devs: [this.touch ? 'touch' : 'kbR'], char: -1 });
    if (!s.cpu && s.players.length < 2) s.cpu = true; // a race needs someone to race
    // Someone alone on the keyboard gets all of it.
    const kb = s.players.filter((p) => p.devs[0].startsWith('kb'));
    if (kb.length === 1) kb[0].devs = [kb[0].devs[0], kb[0].devs[0] === 'kbL' ? 'kbR' : 'kbL'];
    s.players.forEach((p, i) => { p.char = -1; p.cur = i; });
    this.worms();
  }

  worms() {
    const s = this.session, taken = (c) => s.players.findIndex((p) => p.char === c);
    const card = (c, i) => {
      const who = taken(i), tags = s.players.map((p, k) => (p.char < 0 && p.cur === i) || p.char === i
        ? `<span class="tag" style="background:${PCOL[k]}">${p.char === i ? 'P' + (k + 1) + ' OK' : 'P' + (k + 1)}</span>` : '').join('');
      return `<button class="card ${who >= 0 ? 'taken' : ''}" type="button" data-a="pick" data-v="${i}"><span class="tags">${tags}</span>
        <span class="face" style="background:${hex(c.color)}"></span>${c.name}</button>`;
    };
    this.put('worms', `<div class="head">SELECT WORM</div><div class="grid">${CHARS.map(card).join('')}</div>
      <div class="help">Move with your stick or keys, then press a button to choose. Back un-chooses.</div>`,
    {
      pick: (v) => {
        const ps = s.players, p = ps.find((q) => q.devs[0] === 'touch' && q.char < 0) || ps.find((q) => q.char < 0);
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
    if (this.screen === 'title') { if (inp.anyKey) this.mode(); return; }
    if (this.screen === 'mode') { if (all.back) this.title(); else this.steer(all); return; }
    if (this.screen === 'dialog') { if (all.back && this.onBack) this.onBack(); else this.steer(all); return; }
    if (this.screen === 'tracks') {
      if (all.back) { s.players.forEach((p) => { p.char = -1; }); this.worms(); } else this.steer(all, 1);
      return;
    }
    if (this.screen === 'players') {
      for (const dev of Object.keys(inp.ev)) {
        if (dev === 'touch') continue;
        const e = inp.ev[dev], joined = s.players.some((p) => p.devs[0] === dev);
        if (!joined && e.any) return this.toggle(dev);
        if (joined && e.back) return this.toggle(dev);
        if (!joined && e.back) return this.mode();
        if (e.ok || e.start) {
          // Enter or Space with nobody in yet brings that half of the keyboard in first.
          if (!s.players.length && dev.startsWith('kb')) return this.toggle(dev);
          return this.playersDone();
        }
      }
      if (inp.esc) this.mode();
      return;
    }
    if (this.screen === 'worms') {
      for (const p of s.players) {
        const n = inp.nav(p.devs);
        if (p.char < 0 && (n.dx || n.dy)) {
          const col = (((p.cur % 4) + Math.sign(n.dx)) + 4) % 4, row = (Math.floor(p.cur / 4) + (n.dy ? 1 : 0)) % 2;
          p.cur = row * 4 + col;
          return this.worms();
        }
        if (n.ok && p.char < 0) return this.lock(p, p.cur);
        if (n.back) {
          if (p.char >= 0) { p.char = -1; return this.worms(); }
          s.players.forEach((q) => { q.devs = [q.devs[0]]; });
          return this.players();
        }
      }
      if (inp.esc) { s.players.forEach((q) => { q.devs = [q.devs[0]]; }); this.players(); }
    }
  }
}
