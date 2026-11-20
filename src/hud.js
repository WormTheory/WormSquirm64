// What's drawn over each player's part of the picture: lap, time, place, the running order and
// the minimap. It's all painted onto one small canvas (a half or a third the size of the screen)
// and stretched without smoothing, so it comes out in chunky pixels like the picture beneath it.
// The menus, which are ordinary page elements, are copied onto the same canvas (dompaint.js).
import { CHARS, hex } from './characters.js';
import { uiPx } from './settings.js';
import { ITEM_NAMES } from './sim/items.js';

const EVENT_WORDS = { rain: 'RAIN!', heat: 'HEATWAVE!', bird: 'BIRD!', stomp: 'LOOK OUT!' };

export const CSS = `
html,body{height:100%;margin:0;background:#101820;overflow:hidden;overscroll-behavior:none}
#ws{position:fixed;inset:0;background:#101820;color:#fff;user-select:none;-webkit-user-select:none;touch-action:none;
  font:italic 900 16px "Arial Black","Arial Bold",Impact,"Helvetica Neue",sans-serif;
  --pt:max(10px,env(safe-area-inset-top,0px));--pr:max(16px,env(safe-area-inset-right,0px));
  --pb:max(10px,env(safe-area-inset-bottom,0px));--pl:max(16px,env(safe-area-inset-left,0px))}
#ws [hidden]{display:none!important}
#ws canvas.game,#ws canvas.hudc{position:absolute;inset:0;width:100%;height:100%;display:block}
#ws canvas.hudc{pointer-events:none;image-rendering:pixelated}
#ws.ghost .panel,#ws.ghost .trackname,#ws.ghost .pads{opacity:0}
#ws .probe{position:absolute;visibility:hidden;pointer-events:none;padding:var(--pt) var(--pr) var(--pb) var(--pl)}
#ws .t{text-shadow:2px 2px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;letter-spacing:.02em}
#ws .hud{position:absolute;pointer-events:none;container-type:size;overflow:hidden;box-sizing:border-box}
#ws .pads{position:absolute;right:var(--pr);bottom:var(--pb);display:grid;grid-template-columns:1fr 1fr;gap:10px;pointer-events:auto}
#ws .pads button{width:clamp(56px,19cqmin,96px);height:clamp(56px,19cqmin,96px);border-radius:50%;border:3px solid #000;color:#fff;
  font:inherit;font-style:normal;font-size:clamp(11px,2.6cqmin,14px);box-shadow:0 4px 0 #000;touch-action:none;padding:0}
#ws .pads button:active{transform:translateY(3px);box-shadow:0 1px 0 #000}
#ws .trackname{position:absolute;left:0;right:0;top:12%;text-align:center;pointer-events:none;font-size:clamp(20px,6.5vmin,64px);
  background:linear-gradient(#ffffff,#8ad8ff);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:2px #102060;filter:drop-shadow(3px 3px 0 #102060)}
`;
export const ORD = ['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th'];
export const fmtTime = (t) => {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t * 100) % 100);
  return `${m}'${String(s).padStart(2, '0')}"${String(c).padStart(2, '0')}`;
};
const FONT = '"Arial Black","Arial Bold",Impact,"Helvetica Neue",sans-serif';

// How a track's centre line fits a square of the given size.
function fitTrack(tr, S) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < tr.N; i++) { x0 = Math.min(x0, tr.px[i]); x1 = Math.max(x1, tr.px[i]); z0 = Math.min(z0, tr.pz[i]); z1 = Math.max(z1, tr.pz[i]); }
  const k = (S * 0.8) / Math.max(x1 - x0, z1 - z0);
  return { k, ox: S / 2 - ((x0 + x1) / 2) * k, oz: S / 2 - ((z0 + z1) / 2) * k };
}
function strokeTrack(c, tr, f, S, X, Y) {
  c.beginPath();
  for (let i = 0; i <= tr.N; i += 4) c.lineTo(X + tr.px[i % tr.N] * f.k + f.ox, Y + tr.pz[i % tr.N] * f.k + f.oz);
  c.closePath();
  c.lineJoin = 'round'; c.strokeStyle = '#000'; c.lineWidth = Math.max(3, S * 0.07); c.stroke();
  c.strokeStyle = '#f4f4f4'; c.lineWidth = Math.max(1.5, S * 0.04); c.stroke();
}
// Draws a track's centre line to fill a square canvas (the track select cards).
export function drawTrackMap(canvas, tr) {
  const S = canvas.width, c = canvas.getContext('2d'), f = fitTrack(tr, S);
  c.clearRect(0, 0, S, S);
  strokeTrack(c, tr, f, S, 0, 0);
  return f;
}

// The one canvas every player's HUD (and the copy of the menus) is painted on.
export class HudLayer {
  constructor(root) {
    this.root = root;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'hudc';
    root.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.probe = document.createElement('div');
    this.probe.className = 'probe';
    root.appendChild(this.probe);
    this.resize();
  }

  // n: how many screen pixels to one HUD pixel (the player's setting, or two on a small screen and three on a big one).
  resize() {
    const w = this.root.clientWidth || 640, h = this.root.clientHeight || 480, n = uiPx(w, h);
    this.n = n; this.W = Math.ceil(w / n); this.H = Math.ceil(h / n);
    this.canvas.width = this.W; this.canvas.height = this.H;
    // The space to leave at each edge for a phone's notch and bars, in HUD pixels.
    const cs = getComputedStyle(this.probe), px = (v) => (parseFloat(v) || 0) / n;
    this.inset = { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) };
    // With a pixel size above one, the real menus go invisible and a painted copy stands in (dompaint.js).
    this.root.classList.toggle('ghost', n > 1);
  }

  clear() { this.ctx.clearRect(0, 0, this.W, this.H); }
}

export class PlayerHud {
  // rect: [left, top, width, height] as fractions of the screen. inputs is given only to the touch player,
  // whose on-screen buttons are real page elements in `parent`.
  constructor(layer, parent, rect, { split, showOrder, inputs }) {
    this.layer = layer; this.rect = rect; this.split = split; this.showOrder = showOrder; this.el = null;
    if (inputs) {
      const el = (cls, p, tag = 'div') => { const e = document.createElement(tag); e.className = cls; p.appendChild(e); return e; };
      this.el = el('hud', parent);
      this.el.style.cssText = `left:${rect[0] * 100}%;top:${rect[1] * 100}%;width:${rect[2] * 100}%;height:${rect[3] * 100}%`;
      const pads = el('pads', this.el), cols = ['#2f9a38', '#d82818', '#2860e8', '#e0a010'];
      ['SQUIRM', 'WIGGLE', 'UNDULATE', 'FLOP'].forEach((a, i) => {
        const b = el('', pads, 'button'); b.type = 'button'; b.textContent = a; b.style.background = cols[i];
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); inputs.tap(a); });
      });
    }
  }

  remove() { if (this.el) this.el.remove(); }

  update(race, me, dt) {
    const L = this.layer, c = L.ctx, [rx, ry, rw, rh] = this.rect, w = race.worms[me];
    const X = Math.round(rx * L.W), Y = Math.round(ry * L.H), W = Math.round(rw * L.W), H = Math.round(rh * L.H), m = Math.min(W, H);
    const pad = Math.max(3, Math.round(m * 0.02));
    // Only the edges of this player's part that are also edges of the screen need room for a notch.
    const left = X + pad + (rx === 0 ? L.inset.l : 0), top = Y + pad + (ry === 0 ? L.inset.t : 0);
    const right = X + W - pad - (rx + rw >= 1 ? L.inset.r : 0), bottom = Y + H - pad - (ry + rh >= 1 ? L.inset.b : 0);
    c.save();
    c.beginPath(); c.rect(X, Y, W, H); c.clip();
    c.textBaseline = 'top'; c.lineJoin = 'round';
    const font = (size) => { c.font = `italic 900 ${Math.round(size)}px ${FONT}`; };
    const width = (str, size) => { font(size); return c.measureText(str).width; };
    // Outlined text. Returns how wide it was.
    const text = (str, x, y, size, fill, align = 'left') => {
      font(size); c.textAlign = align;
      c.lineWidth = Math.max(2, size * 0.2); c.strokeStyle = '#000'; c.strokeText(str, Math.round(x), Math.round(y));
      c.fillStyle = fill; c.fillText(str, Math.round(x), Math.round(y));
      return c.measureText(str).width;
    };
    const fade = (y, size, a, b) => { const g = c.createLinearGradient(0, y, 0, y + size); g.addColorStop(0.15, a); g.addColorStop(0.9, b); return g; };
    const border = () => { if (this.split) { c.lineWidth = 1; c.strokeStyle = '#000'; c.strokeRect(X + 0.5, Y + 0.5, W - 1, H - 1); } };

    // A player whose worm the bird took has no race to follow: their part of the screen shows the nest.
    if (w.out) {
      text('EATEN', X + W / 2, bottom - Math.max(12, m * 0.08), Math.max(12, m * 0.08), fade(bottom - m * 0.08, m * 0.08, '#fff36a', '#ff5a1c'), 'center');
      border(); c.restore();
      return;
    }
    // Weather colours the whole picture: grey-blue in rain, hot orange in a heatwave.
    const kind = race.weather.type;
    if (kind === 'rain' || kind === 'heat') { c.fillStyle = kind === 'rain' ? 'rgba(20,40,90,.16)' : 'rgba(255,110,0,.22)'; c.fillRect(X, Y, W, H); }
    if (kind !== this.kind) { this.kind = kind; this.bannerT = kind === 'none' ? 0 : 2.6; }
    if (w.items !== this.items) { this.items = w.items; this.itemT = w.items ? 2 : 0; }
    this.bannerT = Math.max(0, (this.bannerT || 0) - dt); this.itemT = Math.max(0, (this.itemT || 0) - dt);

    // Lap, top left.
    const s = Math.max(9, m * 0.05);
    let x = left;
    x += text('LAP ', x, top + s * 0.45, s, '#ffe24a');
    x += text(String(w.lap), x, top, s * 1.5, '#fff');
    text('/' + race.laps, x, top + s * 0.45, s, '#ffe24a');

    // Time, top right.
    const ts = Math.max(8, m * 0.042), tstr = fmtTime(w.finished ? w.finishTime : race.time);
    text(tstr, right, top, ts, '#fff', 'right');
    text('TIME ', right - width(tstr, ts), top, ts, '#ffe24a', 'right');

    // Minimap under the time: the track's centre line and a dot per worm, this player's on top.
    const ms = Math.max(44, Math.round(m * 0.22)), mx = Math.round(right - ms), my = Math.round(top + ts * 1.5), f = fitTrack(race.track, ms);
    strokeTrack(c, race.track, f, ms, mx, my);
    for (const o of [...race.worms].sort((a, b) => (a.idx === me) - (b.idx === me))) {
      c.beginPath(); c.arc(mx + o.x * f.k + f.ox, my + o.z * f.k + f.oz, Math.max(1.5, ms * (o.idx === me ? 0.045 : 0.03)), 0, 7);
      c.fillStyle = hex(CHARS[o.char].color); c.fill(); c.lineWidth = 1; c.strokeStyle = o.idx === me ? '#fff' : '#000'; c.stroke();
    }

    // The running order, down the left.
    if (this.showOrder) {
      const os = Math.max(7, m * 0.03);
      (race.order || race.worms).forEach((o, i) => {
        const oy = top + s * 2.1 + i * os * 1.4;
        c.beginPath(); c.arc(left + os * 0.5, oy + os * 0.55, os * 0.5, 0, 7);
        c.fillStyle = hex(CHARS[o.char].color); c.fill(); c.lineWidth = 1; c.strokeStyle = '#000'; c.stroke();
        text(CHARS[o.char].name, left + os * 1.4, oy, os, o.idx === me ? '#ffe24a' : '#fff');
      });
    }

    // Place, bottom left.
    const ps = Math.max(26, m * 0.17), py = bottom - ps;
    const pw = text(String(w.rank + 1), left, py, ps, fade(py, ps, '#fff36a', '#ff8a1c'));
    text(ORD[w.rank], left + pw, py + ps * 0.08, ps * 0.42, fade(py, ps * 0.5, '#fff36a', '#ff8a1c'));

    // The countdown, GO and FINISH across the middle.
    let big = '';
    if (race.state === 'countdown') { const n = Math.ceil(-race.clock); if (n <= 3) big = String(n); } else if (race.clock < 1) big = 'GO!';
    else if (w.finished) big = 'FINISH!';
    if (big) { const bs = Math.min(m * 0.26, (W * 0.9) / Math.max(2, big.length * 0.62)), by = Y + H * 0.28; text(big, X + W / 2, by, bs, fade(by, bs, '#fff36a', '#ff5a1c'), 'center'); }

    // The item just picked up, named in a box at the top, and the name of an event as it starts.
    if (this.itemT > 0 && w.item >= 0) {
      const is = Math.max(8, m * 0.04), name = ITEM_NAMES[w.item], iw = width(name, is) + is * 1.4, ix = X + W / 2 - iw / 2, iy = top;
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(ix, iy, iw, is * 1.9);
      c.lineWidth = 1; c.strokeStyle = '#ffe24a'; c.strokeRect(ix + 0.5, iy + 0.5, iw - 1, is * 1.9 - 1);
      text(name, X + W / 2, iy + is * 0.45, is, '#fff', 'center');
    }
    if (this.bannerT > 0 && EVENT_WORDS[kind] && !big && Math.floor(this.bannerT * 6) % 2 === 0) {
      const es = Math.min(m * 0.16, (W * 0.9) / (EVENT_WORDS[kind].length * 0.62)), ey = Y + H * 0.2;
      text(EVENT_WORDS[kind], X + W / 2, ey, es, fade(ey, es, '#ffffff', '#ff5a1c'), 'center');
    }
    border();
    c.restore();
  }
}
