// What's drawn over each player's part of the picture: lap, time, place, the running order,
// the minimap and (for the touch-screen player) the on-screen buttons. Sizes are in "cq" units,
// which measure the player's own part of the screen, so a quarter-screen HUD is a quarter the size.
import { CHARS, hex } from './characters.js';

export const CSS = `
html,body{height:100%;margin:0;background:#101820;overflow:hidden;overscroll-behavior:none}
#ws{position:fixed;inset:0;background:#101820;color:#fff;user-select:none;-webkit-user-select:none;touch-action:none;
  font:italic 900 16px "Arial Black","Arial Bold",Impact,"Helvetica Neue",sans-serif;
  --pt:max(10px,env(safe-area-inset-top,0px));--pr:max(16px,env(safe-area-inset-right,0px));
  --pb:max(10px,env(safe-area-inset-bottom,0px));--pl:max(16px,env(safe-area-inset-left,0px))}
#ws [hidden]{display:none!important}
#ws canvas.game{position:absolute;inset:0;width:100%;height:100%;display:block}
#ws .t{text-shadow:2px 2px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;letter-spacing:.02em}
#ws .hud{position:absolute;pointer-events:none;container-type:size;overflow:hidden;box-sizing:border-box}
#ws .hud.split{box-shadow:inset 0 0 0 1px #000}
#ws .lap{position:absolute;top:var(--pt);left:var(--pl);font-size:clamp(11px,3.4cqmin,30px);color:#ffe24a}
#ws .lap b{font-size:1.5em;color:#fff}
#ws .time{position:absolute;top:var(--pt);right:var(--pr);font-size:clamp(10px,3cqmin,26px);text-align:right;color:#ffe24a;font-variant-numeric:tabular-nums}
#ws .time b{color:#fff}
#ws .place{position:absolute;bottom:var(--pb);left:var(--pl);font-size:clamp(34px,15cqmin,130px);line-height:.9;padding-right:.1em;
  background:linear-gradient(#fff36a,#ff8a1c);-webkit-background-clip:text;background-clip:text;color:transparent;
  -webkit-text-stroke:3px #000;filter:drop-shadow(3px 3px 0 #000)}
#ws .place sup{font-size:.4em}
#ws .order{position:absolute;left:var(--pl);top:calc(var(--pt) + clamp(30px,8cqmin,70px));display:flex;flex-direction:column;gap:3px;font-size:clamp(9px,1.9cqmin,14px)}
#ws .order div{display:flex;align-items:center;gap:5px}
#ws .order i{width:1.3em;height:1.3em;border-radius:50%;border:2px solid #000;display:inline-block;box-sizing:border-box}
#ws .order .me{color:#ffe24a}
#ws .map{position:absolute;right:var(--pr);top:calc(var(--pt) + clamp(22px,6cqmin,50px));width:clamp(56px,20cqmin,150px);height:clamp(56px,20cqmin,150px)}
#ws .pop{position:absolute;left:0;right:0;bottom:30%;text-align:center;font-size:clamp(16px,6cqmin,52px);color:#fff;opacity:0}
#ws .big{position:absolute;left:0;right:0;top:28%;text-align:center;font-size:clamp(40px,22cqmin,190px);
  background:linear-gradient(#fff36a,#ff5a1c);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:4px #000;filter:drop-shadow(4px 4px 0 #000)}
#ws .pads{position:absolute;right:var(--pr);bottom:var(--pb);display:grid;grid-template-columns:1fr 1fr;gap:10px;pointer-events:auto}
#ws .pads button{width:clamp(56px,19cqmin,96px);height:clamp(56px,19cqmin,96px);border-radius:50%;border:3px solid #000;color:#fff;
  font:inherit;font-size:clamp(8px,2.5cqmin,13px);box-shadow:0 4px 0 #000;touch-action:none;padding:0}
#ws .pads button:active{transform:translateY(3px);box-shadow:0 1px 0 #000}
#ws .trackname{position:absolute;left:0;right:0;top:12%;text-align:center;pointer-events:none;font-size:clamp(20px,6.5vmin,64px);
  background:linear-gradient(#ffffff,#8ad8ff);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:2px #102060;filter:drop-shadow(3px 3px 0 #102060)}
`;
export const ORD = ['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th'];
export const fmtTime = (t) => {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t * 100) % 100);
  return `${m}'${String(s).padStart(2, '0')}"${String(c).padStart(2, '0')}`;
};

// Draws a track's centre line to fill a square canvas, and returns how to place a point on it.
export function drawTrackMap(canvas, tr) {
  const S = canvas.width, c = canvas.getContext('2d');
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < tr.N; i++) { x0 = Math.min(x0, tr.px[i]); x1 = Math.max(x1, tr.px[i]); z0 = Math.min(z0, tr.pz[i]); z1 = Math.max(z1, tr.pz[i]); }
  const k = (S * 0.8) / Math.max(x1 - x0, z1 - z0), ox = S / 2 - ((x0 + x1) / 2) * k, oz = S / 2 - ((z0 + z1) / 2) * k;
  c.clearRect(0, 0, S, S);
  c.beginPath();
  for (let i = 0; i <= tr.N; i += 4) c.lineTo(tr.px[i % tr.N] * k + ox, tr.pz[i % tr.N] * k + oz);
  c.closePath();
  c.lineJoin = 'round'; c.strokeStyle = '#000'; c.lineWidth = S * 0.07; c.stroke(); c.strokeStyle = '#f4f4f4'; c.lineWidth = S * 0.04; c.stroke();
  return { k, ox, oz };
}

export class PlayerHud {
  // rect: [left, top, width, height] as fractions of the screen. inputs is given only to the touch player.
  constructor(root, rect, { split, showOrder, inputs }) {
    const el = (cls, parent, tag = 'div') => { const e = document.createElement(tag); e.className = cls; parent.appendChild(e); return e; };
    const hud = this.el = el('hud' + (split ? ' split' : ''), root);
    hud.style.cssText = `left:${rect[0] * 100}%;top:${rect[1] * 100}%;width:${rect[2] * 100}%;height:${rect[3] * 100}%`;
    this.lap = el('lap t', hud); this.time = el('time t', hud); this.place = el('place', hud);
    this.order = showOrder ? el('order t', hud) : null;
    this.pop = el('pop t', hud); this.big = el('big', hud);
    this.map = el('map', hud, 'canvas'); this.map.width = this.map.height = 128;
    if (inputs) {
      const pads = el('pads', hud), cols = ['#2f9a38', '#d82818', '#2860e8', '#e0a010'];
      ['SQUIRM', 'WIGGLE', 'UNDULATE', 'FLOP'].forEach((a, i) => {
        const b = el('', pads, 'button'); b.type = 'button'; b.textContent = a; b.style.background = cols[i];
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); inputs.tap(a); });
      });
    }
    this.popT = 0;
  }

  remove() { this.el.remove(); }

  popAction(text) {
    this.pop.textContent = text + '!'; this.popT = 0.5;
    this.pop.style.transform = `rotate(${(Math.random() * 16 - 8).toFixed(1)}deg)`;
  }

  update(race, me, dt) {
    const w = race.worms[me];
    this.lap.innerHTML = `LAP <b>${w.lap}</b>/${race.laps}`;
    this.time.innerHTML = `TIME <b>${fmtTime(w.finished ? w.finishTime : race.time)}</b>`;
    this.place.innerHTML = `${w.rank + 1}<sup>${ORD[w.rank]}</sup>`;
    if (this.order) {
      this.order.innerHTML = (race.order || race.worms).map((o) =>
        `<div class="${o.idx === me ? 'me' : ''}"><i style="background:${hex(CHARS[o.char].color)}"></i>${CHARS[o.char].name}</div>`).join('');
    }
    this.popT = Math.max(0, this.popT - dt);
    this.pop.style.opacity = Math.min(1, this.popT * 4);
    if (race.state === 'countdown') {
      const n = Math.ceil(-race.clock);
      this.big.textContent = n <= 3 ? String(n) : '';
    } else if (race.clock < 1) this.big.textContent = 'GO!';
    else if (w.finished) this.big.textContent = 'FINISH!';
    else this.big.textContent = '';
    // Minimap: the track's centre line and a dot per worm, this player's on top.
    const { k, ox, oz } = drawTrackMap(this.map, race.track), c = this.map.getContext('2d');
    for (const o of [...race.worms].sort((a, b) => (a.idx === me) - (b.idx === me))) {
      c.beginPath(); c.arc(o.x * k + ox, o.z * k + oz, o.idx === me ? 5 : 3.5, 0, 7);
      c.fillStyle = hex(CHARS[o.char].color); c.fill(); c.lineWidth = 1.5; c.strokeStyle = o.idx === me ? '#fff' : '#000'; c.stroke();
    }
  }
}
