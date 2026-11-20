// Everything drawn over the 3D picture: lap, time, place, the running order, the minimap,
// the on-screen buttons for touch screens, and the title and results screens.
import { CHARS, hex } from './characters.js';

const CSS = `
html,body{height:100%;margin:0;background:#101820;overflow:hidden;overscroll-behavior:none}
#ws{position:fixed;inset:0;background:#101820;color:#fff;user-select:none;-webkit-user-select:none;touch-action:none;
  font:italic 900 16px "Arial Black","Arial Bold",Impact,"Helvetica Neue",sans-serif;
  --pt:max(10px,env(safe-area-inset-top,0px));--pr:max(16px,env(safe-area-inset-right,0px));
  --pb:max(10px,env(safe-area-inset-bottom,0px));--pl:max(16px,env(safe-area-inset-left,0px))}
#ws [hidden]{display:none!important}
#ws canvas.game{position:absolute;inset:0;width:100%;height:100%;display:block}
#ws .hud{position:absolute;inset:0;pointer-events:none}
#ws .t{text-shadow:2px 2px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;letter-spacing:.02em}
#ws .lap{position:absolute;top:var(--pt);left:var(--pl);font-size:clamp(16px,3.4vmin,30px);color:#ffe24a}
#ws .lap b{font-size:1.5em;color:#fff}
#ws .time{position:absolute;top:var(--pt);right:var(--pr);font-size:clamp(14px,3vmin,26px);text-align:right;color:#ffe24a;font-variant-numeric:tabular-nums}
#ws .time b{color:#fff}
#ws .place{position:absolute;bottom:var(--pb);left:var(--pl);font-size:clamp(54px,15vmin,130px);line-height:.9;padding-right:.1em;
  background:linear-gradient(#fff36a,#ff8a1c);-webkit-background-clip:text;background-clip:text;color:transparent;
  -webkit-text-stroke:3px #000;filter:drop-shadow(3px 3px 0 #000)}
#ws .place sup{font-size:.4em}
#ws .order{position:absolute;left:var(--pl);top:calc(var(--pt) + clamp(40px,8vmin,70px));display:flex;flex-direction:column;gap:3px;font-size:clamp(9px,1.9vmin,14px)}
#ws .order div{display:flex;align-items:center;gap:5px}
#ws .order i{width:1.3em;height:1.3em;border-radius:50%;border:2px solid #000;display:inline-block;box-sizing:border-box}
#ws .order .me{color:#ffe24a}
#ws .map{position:absolute;right:var(--pr);top:calc(var(--pt) + clamp(30px,6vmin,50px));width:clamp(84px,20vmin,150px);height:clamp(84px,20vmin,150px)}
#ws .pop{position:absolute;left:0;right:0;bottom:30%;text-align:center;font-size:clamp(22px,6vmin,52px);color:#fff;opacity:0}
#ws .big{position:absolute;left:0;right:0;top:28%;text-align:center;font-size:clamp(60px,22vmin,190px);
  background:linear-gradient(#fff36a,#ff5a1c);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:4px #000;filter:drop-shadow(4px 4px 0 #000)}
#ws .pads{position:absolute;right:var(--pr);bottom:var(--pb);display:grid;grid-template-columns:1fr 1fr;gap:10px;pointer-events:auto}
#ws .pads button{width:clamp(64px,19vmin,96px);height:clamp(64px,19vmin,96px);border-radius:50%;border:3px solid #000;color:#fff;
  font:inherit;font-size:clamp(9px,2.5vmin,13px);box-shadow:0 4px 0 #000;touch-action:none;padding:0}
#ws .pads button:active{transform:translateY(3px);box-shadow:0 1px 0 #000}
#ws .panel{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.2vmin;
  background:rgba(8,16,40,.55);pointer-events:auto;text-align:center;box-sizing:border-box;
  padding:var(--pt) var(--pr) var(--pb) var(--pl)}
#ws .logo{font-size:clamp(34px,11vmin,110px);line-height:.92;padding:0 .15em;background:linear-gradient(#fff36a 20%,#ff8a1c 60%,#e02818);
  -webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:3px #1a0a40;filter:drop-shadow(5px 5px 0 #1a0a40);transform:rotate(-3deg)}
#ws .logo span{font-size:1.5em;background:linear-gradient(#7cf0ff,#2860e8);-webkit-background-clip:text;background-clip:text}
#ws .blink{font-size:clamp(14px,3.6vmin,30px);animation:wsb 1s steps(2) infinite}
@keyframes wsb{50%{opacity:0}}
#ws .help{font-size:clamp(10px,2.2vmin,15px);font-style:normal;font-weight:700;max-width:34em;line-height:1.5;color:#d8e4ff}
#ws table{border-collapse:collapse;font-size:clamp(13px,3vmin,24px)}
#ws td{padding:.12em .6em;text-align:left;font-variant-numeric:tabular-nums}
#ws tr.me td{color:#ffe24a}
#ws .btn{font:inherit;font-size:clamp(14px,3.4vmin,26px);padding:.4em 1.2em;border:3px solid #000;border-radius:10px;color:#fff;
  background:linear-gradient(#ff7a3a,#d82818);box-shadow:0 5px 0 #000;cursor:pointer}
#ws .btn:focus-visible{outline:3px solid #fff}
@media (prefers-reduced-motion:reduce){#ws .blink{animation:none}}
`;
const ORD = ['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th'];
export const fmtTime = (t) => {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t * 100) % 100);
  return `${m}'${String(s).padStart(2, '0')}"${String(c).padStart(2, '0')}`;
};

export class Hud {
  constructor(root, input) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const el = (cls, parent, tag = 'div') => { const e = document.createElement(tag); e.className = cls; parent.appendChild(e); return e; };
    const hud = this.hud = el('hud', root);
    this.lap = el('lap t', hud); this.time = el('time t', hud); this.place = el('place', hud);
    this.order = el('order t', hud); this.pop = el('pop t', hud); this.big = el('big', hud);
    this.map = el('map', hud, 'canvas'); this.map.width = this.map.height = 128;
    this.touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.pads = null;
    if (this.touch) {
      const pads = this.pads = el('pads', hud), cols = ['#2f9a38', '#d82818', '#2860e8', '#e0a010'];
      ['SQUIRM', 'WIGGLE', 'UNDULATE', 'FLOP'].forEach((a, i) => {
        const b = el('', pads, 'button'); b.type = 'button'; b.textContent = a; b.style.background = cols[i];
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); input.tap(a); });
      });
    }
    this.panel = el('panel', root);
    this.popT = 0;
    this.inRace(false);
  }

  inRace(on) {
    for (const e of [this.lap, this.time, this.place, this.order, this.map, this.pads]) if (e) e.hidden = !on;
    this.big.textContent = '';
  }

  title(onStart) {
    this.inRace(false);
    this.panel.hidden = false;
    this.panel.innerHTML = `<div class="logo">WORM<br>SQUIRM <span>64</span></div><div class="blink t">PRESS ANY BUTTON</div>
      <div class="help">${this.touch ? 'Touch: drag to turn the camera. Tap the buttons to squirm, wiggle, undulate or flop.<br>' : ''}
      Controller: left stick turns the camera. Every face and shoulder button does something.<br>
      Keyboard: A/D or the arrow keys turn the camera. J K L I U O, Space and Shift do something.<br>
      Your worm heads roughly where the camera points. Roughly.</div>`;
    this.panel.onclick = onStart;
  }

  results(race, me, onAgain) {
    this.panel.hidden = false;
    const rows = race.order.map((w, i) => `<tr class="${w.idx === me ? 'me' : ''}"><td>${i + 1}${ORD[i]}</td>
      <td><i style="display:inline-block;width:.8em;height:.8em;border-radius:50%;border:2px solid #000;background:${hex(CHARS[w.char].color)}"></i> ${CHARS[w.char].name}</td>
      <td>${w.finished ? fmtTime(w.finishTime) : 'still squirming'}</td></tr>`).join('');
    this.panel.innerHTML = `<div class="logo" style="font-size:clamp(26px,7vmin,60px)">RESULTS</div><table class="t">${rows}</table>
      <button class="btn" id="ws-again" type="button">RACE AGAIN</button>`;
    this.panel.onclick = null;
    this.panel.querySelector('#ws-again').onclick = onAgain;
  }

  hidePanel() { this.panel.hidden = true; this.panel.onclick = null; }

  popAction(text) { this.pop.textContent = text + '!'; this.popT = 0.5; this.pop.style.transform = `rotate(${(Math.random() * 16 - 8).toFixed(1)}deg)`; }

  update(race, me, dt) {
    const w = race.worms[me];
    this.lap.innerHTML = `LAP <b>${w.lap}</b>/${race.laps}`;
    this.time.innerHTML = `TIME <b>${fmtTime(w.finished ? w.finishTime : race.time)}</b>`;
    this.place.innerHTML = `${w.rank + 1}<sup>${ORD[w.rank]}</sup>`;
    const order = race.order || race.worms;
    this.order.innerHTML = order.map((o) => `<div class="${o.idx === me ? 'me' : ''}"><i style="background:${hex(CHARS[o.char].color)}"></i>${CHARS[o.char].name}</div>`).join('');
    this.popT = Math.max(0, this.popT - dt);
    this.pop.style.opacity = Math.min(1, this.popT * 4);
    if (race.state === 'countdown') {
      const n = Math.ceil(-race.clock);
      this.big.textContent = n <= 3 ? String(n) : '';
    } else if (race.clock < 1) this.big.textContent = 'GO!';
    else if (w.finished) this.big.textContent = 'FINISH!';
    else this.big.textContent = '';
    // Minimap: the track's centre line and a dot per worm.
    const c = this.map.getContext('2d'), tr = race.track;
    if (!this.mapFit) {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let i = 0; i < tr.N; i++) { x0 = Math.min(x0, tr.px[i]); x1 = Math.max(x1, tr.px[i]); z0 = Math.min(z0, tr.pz[i]); z1 = Math.max(z1, tr.pz[i]); }
      const k = 104 / Math.max(x1 - x0, z1 - z0);
      this.mapFit = { k, ox: 64 - ((x0 + x1) / 2) * k, oz: 64 - ((z0 + z1) / 2) * k };
    }
    const { k, ox, oz } = this.mapFit;
    c.clearRect(0, 0, 128, 128);
    c.beginPath();
    for (let i = 0; i <= tr.N; i += 4) c.lineTo(tr.px[i % tr.N] * k + ox, tr.pz[i % tr.N] * k + oz);
    c.closePath();
    c.lineJoin = 'round'; c.strokeStyle = '#000'; c.lineWidth = 9; c.stroke(); c.strokeStyle = '#f4f4f4'; c.lineWidth = 5; c.stroke();
    for (const o of [...race.worms].sort((a, b) => (a.idx === me) - (b.idx === me))) {
      c.beginPath(); c.arc(o.x * k + ox, o.z * k + oz, o.idx === me ? 5 : 3.5, 0, 7);
      c.fillStyle = hex(CHARS[o.char].color); c.fill(); c.lineWidth = 1.5; c.strokeStyle = o.idx === me ? '#fff' : '#000'; c.stroke();
    }
  }
}
