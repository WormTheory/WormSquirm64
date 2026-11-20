// Everyone's controls. A "device" is one of: a gamepad ('pad0' to 'pad3'), half of the keyboard
// ('kbL', 'kbR'), or the touch screen ('touch'). A player owns one device, or both keyboard halves
// when they're the only one on the keyboard.
//   Gamepad: left stick turns the camera; the four face and four shoulder buttons are the eight actions.
//   Keyboard: A/D or the arrow keys (W/S, up/down) camera, or drag with the mouse; Q E R F Z X C V and J K L I U O N M actions.
//   (Inside, the keyboard is two halves, 'kbL' and 'kbR'; one player always has both.)
//   Touch: drag to turn the camera; on-screen buttons for actions.
import { ACTIONS } from './sim/worm.js';

const KB = {
  kbL: { cam: ['KeyA', 'KeyD', 'KeyW', 'KeyS'], act: ['KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyZ', 'KeyX', 'KeyC', 'KeyV'], ok: ['Space', 'KeyF'], back: ['KeyQ'] },
  kbR: { cam: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'], act: ['KeyJ', 'KeyK', 'KeyL', 'KeyI', 'KeyU', 'KeyO', 'KeyN', 'KeyM'], ok: ['Enter', 'KeyJ'], back: ['Backspace'] },
};
// What a player can be given to play with: the keyboard and mouse together ('kb'), a controller, or the touch screen.
export const DEVICE_NAMES = { kb: 'Keyboard + mouse', touch: 'Touch screen', pad0: 'Controller 1', pad1: 'Controller 2', pad2: 'Controller 3', pad3: 'Controller 4' };
export const devsOf = (d) => (d === 'kb' ? ['kbL', 'kbR'] : [d]);
const blank = () => ({ acts: [], dx: 0, dy: 0, ok: false, back: false, start: false, any: false });

export class Inputs {
  constructor(dragEl) {
    this.keys = new Set();
    this.ev = {};          // what each device did this frame (presses and menu moves, not what's held)
    this.esc = false;      // Escape this frame
    this.anyKey = false;   // anything at all this frame, for "press any button"
    this.dragX = 0; this.dragY = 0;
    this.padPrev = {}; this.padAxes = {};
    addEventListener('keydown', (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      // Typing in a text box (a room code) is just typing, apart from Escape.
      if (e.target && e.target.tagName === 'INPUT') { if (e.code === 'Escape') this.esc = true; return; }
      this.keys.add(e.code); this.anyKey = true;
      if (e.code === 'Escape') this.esc = true;
      for (const dev in KB) {
        const k = KB[dev], ev = this.of(dev), cam = k.cam.indexOf(e.code), act = k.act.indexOf(e.code);
        if (cam >= 0) { if (cam < 2) ev.dx += cam ? 1 : -1; else ev.dy += cam === 3 ? 1 : -1; e.preventDefault(); }
        if (act >= 0) { ev.acts.push(ACTIONS[act]); ev.any = true; }
        if (k.ok.includes(e.code)) { ev.ok = true; e.preventDefault(); }
        if (k.back.includes(e.code)) { ev.back = true; e.preventDefault(); }
      }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    let drag = null;
    dragEl.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; this.anyKey = true; });
    addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      this.dragX += e.clientX - drag.x; this.dragY += e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
    });
    const end = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
  }

  of(dev) { return this.ev[dev] || (this.ev[dev] = blank()); }

  // Every input there is to hand out right now. (A browser only shows a controller once one of its buttons has been pressed.)
  devices(touch) {
    const out = ['kb'];
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.index <= 3) out.push('pad' + p.index);
    if (touch) out.push('touch');
    return out;
  }

  // For on-screen action buttons.
  tap(action) { const ev = this.of('touch'); ev.acts.push(action); ev.any = true; this.anyKey = true; }

  // Call once at the start of each frame: reads the gamepads.
  frame() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || p.index > 3) continue;
      const dev = 'pad' + p.index, ev = this.of(dev), prev = this.padPrev[dev] || (this.padPrev[dev] = {});
      const edge = (id, down) => { const hit = down && !prev[id]; prev[id] = down; return hit; };
      for (let b = 0; b < p.buttons.length; b++) {
        if (!edge(b, p.buttons[b].pressed)) continue;
        this.anyKey = true;
        if (b < 8) { ev.acts.push(ACTIONS[b]); ev.any = true; }
        if (b === 0) ev.ok = true;
        if (b === 1) ev.back = true;
        if (b === 9) ev.start = true;
        if (b === 12) ev.dy--; if (b === 13) ev.dy++; if (b === 14) ev.dx--; if (b === 15) ev.dx++;
      }
      const x = p.axes[0] || 0, y = p.axes[1] || 0;
      if (edge('l', x < -0.6)) ev.dx--; if (edge('r', x > 0.6)) ev.dx++;
      if (edge('u', y < -0.6)) ev.dy--; if (edge('d', y > 0.6)) ev.dy++;
      this.padAxes[dev] = [Math.abs(x) < 0.18 ? 0 : x, Math.abs(y) < 0.18 ? 0 : y];
    }
  }

  // Menu moves from a set of devices, or from every device if none is given.
  nav(devs) {
    const out = blank();
    for (const dev of devs || Object.keys(this.ev)) {
      const e = this.ev[dev];
      if (!e) continue;
      out.dx += e.dx; out.dy += e.dy; out.ok = out.ok || e.ok; out.back = out.back || e.back; out.start = out.start || e.start; out.any = out.any || e.any;
    }
    if (!devs && this.esc) out.back = true;
    return out;
  }

  // One player's racing controls this frame: how far to turn the camera (radians) and the actions pressed.
  // drag says whether dragging on the picture is theirs.
  play(devs, dt, drag) {
    let sx = 0, sy = 0;
    const presses = [];
    for (const dev of devs) {
      const k = KB[dev];
      if (k) {
        sx += (this.keys.has(k.cam[1]) ? 1 : 0) - (this.keys.has(k.cam[0]) ? 1 : 0);
        sy += (this.keys.has(k.cam[3]) ? 1 : 0) - (this.keys.has(k.cam[2]) ? 1 : 0);
      } else if (this.padAxes[dev]) { sx += this.padAxes[dev][0]; sy += this.padAxes[dev][1]; }
      if (this.ev[dev]) presses.push(...this.ev[dev].acts);
    }
    let yaw = -sx * 2.6 * dt, pitch = sy * 1.4 * dt;
    if (drag) { yaw -= this.dragX * 0.007; pitch += this.dragY * 0.004; }
    return { yaw, pitch, presses, start: devs.some((d) => this.ev[d] && this.ev[d].start) };
  }

  // Call once at the end of each frame.
  endFrame() { this.ev = {}; this.esc = false; this.anyKey = false; this.dragX = 0; this.dragY = 0; }
}
