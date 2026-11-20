// Pixelates the menus. The menus are ordinary page elements (so they can be clicked, tapped, typed
// in and laid out by the browser), but they're made invisible, and this paints a copy of them onto
// the small HUD canvas instead: every box, border, picture and word, each where the browser put it.
// Stretched up with the HUD, the copy comes out in the same chunky pixels.
// It reads only what every browser offers (where things are and their computed styles), so it needs
// no special filter support.
const alphaOf = (col) => { const m = /rgba\([^)]*,\s*([\d.]+)\)/.exec(col); return col === 'transparent' ? 0 : m ? +m[1] : 1; };
const GHOSTS = '.panel,.trackname,.pads'; // the elements made invisible and painted here instead

export class DomPainter {
  // roots: the elements to copy (with everything inside them).
  constructor(root, layer, roots) {
    this.root = root; this.layer = layer; this.roots = roots;
    this.cache = document.createElement('canvas');
    this.c = this.cache.getContext('2d');
    this.dirty = true; this.last = 0;
    const touch = () => { this.dirty = true; };
    new MutationObserver(touch).observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
    root.addEventListener('input', touch, true);
    root.addEventListener('scroll', touch, true);
  }

  // Call each frame after the HUD is drawn. The copy is only remade when something changed
  // (or five times a second, for things that blink).
  draw(now) {
    const L = this.layer;
    if (L.n <= 1) return;
    if (this.dirty || now - this.last > 200 || this.cache.width !== L.W || this.cache.height !== L.H) {
      this.dirty = false; this.last = now;
      this.cache.width = L.W; this.cache.height = L.H;
      const r = this.root.getBoundingClientRect();
      this.ox = r.left; this.oy = r.top; this.n = L.n;
      this.c.imageSmoothingEnabled = false;
      for (const el of this.roots()) this.walk(el, 1);
    }
    L.ctx.drawImage(this.cache, 0, 0);
  }

  box(x, y, w, h, r) {
    const c = this.c;
    c.beginPath();
    if (r > 0.5 && c.roundRect) c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else c.rect(x, y, w, h);
  }

  // A fill for a box or for text: the element's gradient (top to bottom) or its plain colour.
  fill(image, color, y, h) {
    if (image && image.includes('gradient')) {
      const cols = image.match(/rgba?\([^)]+\)/g);
      if (cols && cols.length > 1) {
        const g = this.c.createLinearGradient(0, y, 0, y + Math.max(1, h));
        cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col));
        return g;
      }
    }
    return alphaOf(color) > 0 ? color : null;
  }

  // An element marked data-tilt="degrees" is painted turned about its middle. (The real element is left
  // straight while it's invisible: once turned, the browser only reports the box around it, not where each word is.)
  walk(el, alpha) {
    const tilt = el.dataset && +el.dataset.tilt;
    if (!tilt) return this.paint(el, alpha);
    const c = this.c, r = el.getBoundingClientRect(), cx = (r.left + r.width / 2 - this.ox) / this.n, cy = (r.top + r.height / 2 - this.oy) / this.n;
    c.save();
    c.translate(cx, cy); c.rotate((tilt * Math.PI) / 180); c.translate(-cx, -cy);
    this.paint(el, alpha);
    c.restore();
  }

  paint(el, alpha) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const a = alpha * (el.matches(GHOSTS) ? 1 : parseFloat(cs.opacity));
    if (a < 0.02) return;
    const c = this.c, n = this.n, r = el.getBoundingClientRect();
    const x = (r.left - this.ox) / n, y = (r.top - this.oy) / n, w = r.width / n, h = r.height / n;
    c.globalAlpha = a;
    const clipText = cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text';
    const tl = cs.borderTopLeftRadius, rad = tl.includes('%') ? (Math.min(r.width, r.height) * parseFloat(tl)) / 100 / n : (parseFloat(tl) || 0) / n;
    const bw = (parseFloat(cs.borderTopWidth) || 0) / n;
    // A hard drop shadow under buttons.
    if (cs.boxShadow !== 'none' && !cs.boxShadow.includes('inset')) {
      const px = cs.boxShadow.replace(/rgba?\([^)]*\)/g, '').match(/-?[\d.]+px/g);
      if (px) { c.fillStyle = '#000'; this.box(x + parseFloat(px[0]) / n, y + parseFloat(px[1]) / n, w, h, rad); c.fill(); }
    }
    if (!clipText) {
      const bg = this.fill(cs.backgroundImage, cs.backgroundColor, y, h);
      if (bg) { c.fillStyle = bg; this.box(x, y, w, h, rad); c.fill(); }
    }
    if (bw > 0 && cs.borderTopStyle !== 'none' && alphaOf(cs.borderTopColor) > 0) {
      c.strokeStyle = cs.borderTopColor; c.lineWidth = bw;
      c.setLineDash(cs.borderTopStyle === 'dashed' ? [bw * 3, bw * 2] : []);
      this.box(x + bw / 2, y + bw / 2, w - bw, h - bw, Math.max(0, rad - bw / 2)); c.stroke();
      c.setLineDash([]);
    }
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) {
      const ow = parseFloat(cs.outlineWidth) / n;
      c.strokeStyle = cs.outlineColor; c.lineWidth = ow;
      this.box(x - ow / 2, y - ow / 2, w + ow, h + ow, rad + ow / 2); c.stroke();
    }
    const tag = el.tagName;
    if (tag === 'IMG' || tag === 'CANVAS') {
      if (tag === 'CANVAS' || (el.complete && el.naturalWidth)) c.drawImage(el, x + bw, y + bw, w - bw * 2, h - bw * 2);
      return;
    }
    if (tag === 'INPUT') return this.input(el, cs, x, y, w, h);
    const textFill = clipText ? this.fill(cs.backgroundImage, cs.color, y, h) : cs.color;
    for (const node of el.childNodes) {
      if (node.nodeType === 3) this.text(node, cs, textFill);
      else if (node.nodeType === 1) { this.walk(node, a); c.globalAlpha = a; }
    }
  }

  // Each word is drawn where the browser laid it out, so wrapping and centring come for free.
  text(node, cs, fill) {
    const txt = node.nodeValue;
    if (!txt.trim() || !fill) return;
    const c = this.c, n = this.n, size = parseFloat(cs.fontSize) / n;
    c.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.lineJoin = 'round';
    const edge = parseFloat(cs.webkitTextStrokeWidth) || 0, shadowed = cs.textShadow !== 'none';
    // Widely spaced letters (a room code) are placed one at a time.
    // (Words are also split after a hyphen, where the browser may have broken the line.)
    const re = (parseFloat(cs.letterSpacing) || 0) > 1 ? /\S/g : /[^\s-]+-?|-/g, range = document.createRange();
    for (let m = re.exec(txt); m; m = re.exec(txt)) {
      range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
      const q = range.getBoundingClientRect();
      if (!q.width) continue;
      const tx = (q.left - this.ox) / n, ty = (q.top + q.height / 2 - this.oy) / n;
      if (edge) {
        c.fillStyle = cs.webkitTextStrokeColor; c.fillText(m[0], tx + 3 / n, ty + 3 / n);
        c.strokeStyle = cs.webkitTextStrokeColor; c.lineWidth = Math.max(1.5, (edge * 2) / n); c.strokeText(m[0], tx, ty);
      } else if (shadowed) { c.strokeStyle = '#000'; c.lineWidth = Math.max(1.5, 3.5 / n); c.strokeText(m[0], tx, ty); }
      c.fillStyle = fill; c.fillText(m[0], tx, ty);
    }
  }

  // A slider (a line and a knob at its value) or a text box (what's typed, or its hint in grey).
  input(el, cs, x, y, w, h) {
    const c = this.c, n = this.n;
    if (el.type === 'range') {
      const f = (el.value - el.min) / (el.max - el.min || 1), k = Math.max(3, h * 0.42), cy = y + h / 2;
      c.fillStyle = '#000'; c.fillRect(x, cy - k * 0.35, w, k * 0.7);
      c.fillStyle = '#ffe24a'; c.fillRect(x + 1, cy - k * 0.35 + 1, (w - 2) * f, k * 0.7 - 2);
      c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = Math.max(1, 2 / n);
      c.beginPath(); c.arc(x + k + (w - 2 * k) * f, cy, k, 0, 7); c.fill(); c.stroke();
      return;
    }
    const size = parseFloat(cs.fontSize) / n, shown = el.value || el.placeholder || '';
    c.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    c.textBaseline = 'middle'; c.textAlign = 'center';
    c.fillStyle = el.value ? cs.color : '#8a94a8';
    c.fillText(cs.textTransform === 'uppercase' ? shown.toUpperCase() : shown, x + w / 2, y + h / 2);
  }
}
