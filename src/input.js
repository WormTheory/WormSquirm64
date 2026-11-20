// One player's controls from whatever is to hand: a gamepad (left stick turns the camera, the four
// face buttons and four shoulder buttons are the eight actions), the keyboard, or a touch screen
// (drag to turn the camera, on-screen buttons for actions).
import { ACTIONS } from './sim/worm.js';

const KEY_ACTION = { KeyJ: 0, KeyK: 1, KeyL: 2, KeyI: 3, KeyU: 4, KeyO: 5, Space: 6, ShiftLeft: 7, ShiftRight: 7 };

export class Input {
  constructor(dragEl) {
    this.keys = new Set();
    this.presses = [];
    this.dragX = 0; this.dragY = 0;
    this.padPrev = [];
    this.any = false; // set by any press at all, for "press any button" screens
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code); this.any = true;
      if (e.code in KEY_ACTION) { this.presses.push(ACTIONS[KEY_ACTION[e.code]]); e.preventDefault(); }
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    let drag = null;
    dragEl.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; this.any = true; });
    addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      this.dragX += e.clientX - drag.x; this.dragY += e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
    });
    const end = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
  }

  // For on-screen buttons.
  tap(action) { this.presses.push(action); this.any = true; }

  // Returns how the camera should turn this frame (radians) and the actions pressed since last time.
  poll(dt) {
    const k = this.keys;
    let sx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let sy = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      sx += dz(p.axes[0] || 0); sy += dz(p.axes[1] || 0);
      for (let b = 0; b < p.buttons.length; b++) {
        const down = p.buttons[b].pressed, id = p.index * 32 + b;
        if (down && !this.padPrev[id]) { this.any = true; if (b < 8) this.presses.push(ACTIONS[b]); }
        this.padPrev[id] = down;
      }
      break; // one pad for now; split screen will give each player their own
    }
    const out = {
      yaw: -sx * 2.6 * dt - this.dragX * 0.007,
      pitch: sy * 1.4 * dt + this.dragY * 0.004,
      presses: this.presses, any: this.any,
    };
    this.presses = []; this.dragX = 0; this.dragY = 0; this.any = false;
    return out;
  }
}
