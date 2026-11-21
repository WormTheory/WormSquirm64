// The medal ceremony at the end of a Grand Prix: a podium past the finish line, the top three dancing on it, and a
// few words from each, bronze first. What a worm says depends on who it is: every worm has one loud, simple
// personality and a voice of its own, and they're the same every time.
import * as THREE from '../vendor/three.module.min.js';
import { pointAt } from './sim/track.js';
import { CHARS, charOf, hex } from './characters.js';
import { FRACTION } from './hud.js';
import * as sfx from './audio.js';

// Each worm's character, by its number: what sort it is, how it sounds (wave, pitch in Hz, how far the pitch
// wanders from letter to letter, how the pitch moves within a letter, letters a second), and what it says for
// gold, silver and bronze (it picks one of each pair).
export const PERSONAS = [
  { // Worm: humble
    sort: 'humble', voice: { wave: 'triangle', pitch: 330, spread: 0.18, slide: 1, rate: 22 },
    says: [["Oh gosh. I really don't deserve this. Everyone else squirmed so much better than me.", "Me? First? No, no. Give it to one of the others. Any of the others. Please."],
      ["Second is plenty. Second is honestly more than I'm comfortable with.", "I just want to thank the road for being there. I did nothing. The road did everything."],
      ["Third! That's still a medal. I'd have been happy with a firm handshake.", "I'm sorry to take up room on the podium. I'll be quick. Thank you. Sorry."]] },
  { // Green Worm: timid
    sort: 'timid', voice: { wave: 'triangle', pitch: 430, spread: 0.3, slide: 1.12, rate: 26 },
    says: [["I w-won? Is that allowed? Is somebody going to be angry? I don't like it up here.", "F-first place. Oh no. Now they'll all be looking at me. Please stop looking at me."],
      ["S-second is good. Nobody chases second. Right? Nobody chases second?", "I kept my eyes shut the whole way. It was the only way I could do it."],
      ["Third. Low to the ground. Safe. Can I get down now? It's very high.", "I saw a bird. Did anyone else see the bird? I think it saw me too."]] },
  { // Wormst: pompous
    sort: 'pompous', voice: { wave: 'square', pitch: 150, spread: 0.1, slide: 0.94, rate: 15 },
    says: [["Naturally. One does not wear a hat like this and come second. You may applaud. Briefly.", "Victory, as foreseen. I shall have this medal melted down into a slightly larger hat."],
      ["Second? I shall be writing a very long letter to the committee. On thick paper.", "Silver. How provincial. I suppose it will do for the servants' quarters."],
      ["Bronze. Bronze! In my family we do not even have bronze doorknobs.", "Third. Clearly the course was laid out by someone with no breeding whatsoever."]] },
  { // Squirmt: bubbly
    sort: 'bubbly', voice: { wave: 'sine', pitch: 640, spread: 0.25, slide: 1.25, rate: 30 },
    says: [["OH MY GOSH! I won! I won I won I won! This is the best day since yesterday!", "Eeeee! It's so shiny! It matches my bow! Everything is amazing and so am I!"],
      ["Second! That's like first, but with a friend in front! Yay, friends!", "Silver is totally my colour! I mean, every colour is my colour, but still!"],
      ["Third! Three is my favourite number! After one and two! Yaaay!", "A medal! For me! I'm going to name it Sparkle and take it everywhere!"]] },
  { // Flopple: stupid
    sort: 'dim', voice: { wave: 'sawtooth', pitch: 105, spread: 0.35, slide: 0.8, rate: 11 },
    says: [["I win? ... What was I doing? ... Is this the bus stop?", "Uhhh. I pressed the button. Then there was a line. Now I'm tall."],
      ["Second. That's the one after... the other one. I like the shiny rock.", "I got lost. Then I got more lost. Then they gave me this. Is it food?"],
      ["Three. I can count to that. One... three. Yeah.", "Duhhh. I thought we were going the other way. Was there another way?"]] },
  { // Wyrm: brooding
    sort: 'brooding', voice: { wave: 'sawtooth', pitch: 190, spread: 0.12, slide: 0.7, rate: 13 },
    says: [["I won. And yet the void remains. A medal is only a small, cold moon.", "Victory. It tastes of ash. Everything tastes of ash. It may be the road."],
      ["Second. As it was written in the ancient soil. As it shall ever be.", "Silver. The colour of the rain that falls only on me."],
      ["Third. I have been deeper underground than this, and felt more.", "Bronze. Darkness would have suited me better. Do you have it in black?"]] },
  { // Morm: cocky
    sort: 'cocky', voice: { wave: 'square', pitch: 265, spread: 0.2, slide: 1.06, rate: 27 },
    says: [["Was there ever any doubt? Look at me. LOOK at me. That's what a winner looks like.", "Too easy. I wasn't even trying. I did the last lap asleep. Next!"],
      ["Second? I LET them win. It's called being generous. Look it up.", "Silver's only because I stopped to admire my moustache. Worth it."],
      ["Third, and I still looked the best doing it. Ask anyone. Ask me.", "Bronze? The other two cheated. I'm basically first. Write that down."]] },
  { // Green Morm: bitter
    sort: 'bitter', voice: { wave: 'square', pitch: 175, spread: 0.15, slide: 1.3, rate: 19 },
    says: [["First. FINALLY. Did you see that, Morm? DID YOU? Who's the green one now?", "I won. I'd like to thank nobody. Nobody helped. Nobody ever helps."],
      ["Second. Of course. Always second. Second moustache, second billing, second place.", "It was rigged. The road was rigged. The line was rigged. I've got a list."],
      ["Third. Great. Put it with all the other things I didn't want.", "Bronze. I'm not angry. This is just how my face goes. I'm FINE."]] },
  { // Worm X: mysterious
    sort: 'mysterious', voice: { wave: 'sine', pitch: 235, spread: 0.06, slide: 0.97, rate: 12 },
    says: [["... You wonder who I am. ... Keep wondering. ... The medal knows.", "I was never here. ... You saw nothing. ... I will take the gold with me."],
      ["Silver. ... It is enough. ... A worm I once knew would have been proud. ... I can say no more.", "... I did not come here to win. ... I came to watch over someone. ... Do not ask who."],
      ["Third. ... By choice. ... Everything I do is by choice. ... Farewell.", "... Behind this mask is another mask. ... Behind that, bronze."]] },
];
// A worm nobody's written for yet says something plain, in a plain voice.
const PLAIN = { sort: 'plain', voice: { wave: 'triangle', pitch: 280, spread: 0.2, slide: 1, rate: 20 },
  says: [["I won. That's nice.", "First place. Good."], ["Second. Not bad.", "Silver. Fine by me."], ["Third. I'll take it.", "Bronze. Lovely."]] };
// An evil clone is a villain whoever it was cloned from: its original's voice, an octave down and with an edge on it.
const EVIL = [["FOOLS! The original {name} was weak. I am {name} PERFECTED. Today the podium. Tomorrow, the whole garden!", "Mwa ha ha! Grown in a tank for this one moment! Kneel before Evil {name}!"],
  ["Second?! The tank must have been faulty. No matter. There will be more tanks. So many tanks.", "Silver... for now. Enjoy your gold while you can. I know where you sleep. It's in the dirt."],
  ["Third. A setback. Every great villain has a setback. It's in the third act that I get you.", "Bronze?! Curse you, {name}! Curse the both of us!"]];

export function personaOf(w) {
  const base = PERSONAS[w.char] || PLAIN;
  if (!w.evil) return base;
  return { sort: 'evil', voice: { ...base.voice, wave: 'sawtooth', pitch: base.voice.pitch * 0.5, slide: 0.85, rate: 17, growl: true }, says: EVIL };
}

// One more sentence, about the state the worm has ended the cup in. (The first that fits.)
function aside(w) {
  if (w.gone) return '(This is coming from inside a bird.)';
  if (w.cuts) return 'And I did it with ' + (w.cuts === 1 ? 'half' : 'a fraction of') + ' a body.';
  if (w.chained) return "And thank you to whoever's on the other end of this chain. I had no say in it.";
  if (w.money) return 'I also have $' + w.money + '.00, which is nice.';
  if (w.scarlet) return 'Please stop looking at the letter.';
  if (w.mut && w.mut.some((n) => n)) return "I'd also like to thank my new genes. All of them.";
  if (w.patch) return 'It only hurts when I squirm.';
  return '';
}
export function speechFor(w, place, pick = Math.random()) {
  const p = personaOf(w), pair = p.says[place] || p.says[2], line = pair[Math.floor(pick * pair.length) % pair.length].replace(/\{name\}/g, CHARS[w.char] ? CHARS[w.char].name : 'worm');
  const more = aside(w);
  return more ? line + ' ' + more : line;
}

const MEDALS = [['GOLD', 0xf0c020, 1.7], ['SILVER', 0xc8ccd4, 1.2], ['BRONZE', 0xc07838, 0.8]];
const FONT = '"Arial Black","Arial Bold",Impact,"Helvetica Neue",sans-serif';

// top: the first three of the final standings, best first: each { w (the worm in the race), view (its model), and
// what's become of it (gone, chained, money, scarlet) }. done is called when it's over.
export class Ceremony {
  constructor({ scene, race, views, top, layer, cup, done }) {
    this.layer = layer; this.done = done; this.cup = cup; this.t = 0; this.stage = -1; this.at = 0; this.shown = 0; this.over = false;
    this.camera = new THREE.PerspectiveCamera(48, 4 / 3, 0.5, 900);
    const tr = race.track, c = pointAt(tr, 9, 0);
    this.fx = c.tx; this.fz = c.tz; this.nx = c.tz; this.nz = -c.tx; this.cx = c.x; this.cz = c.z;
    // Everything else is cleared off: nobody else on the road, no weather, no chains.
    race.weather.type = 'none'; race.weather.next = Infinity; race.weather.on = false;
    for (const k of ['bird', 'stomp', 'twister', 'monkey', 'chain', 'xin', 'clone']) race.weather[k] = null;
    race.weather.visit = -1;
    race.items.ents = [];
    for (const w of race.worms) { w.out = true; w.chains = []; }
    // The podium: gold in the middle, silver to one side, bronze to the other, each its own height.
    this.spots = top.map((e, k) => {
      const [, colour, h] = MEDALS[k], side = [0, -1, 1][k] * 3.7, x = c.x + this.nx * side, z = c.z + this.nz * side;
      const block = new THREE.Mesh(new THREE.BoxGeometry(3.5, h, 3.5), new THREE.MeshLambertMaterial({ color: 0xf4f0e8 }));
      block.position.set(x, h / 2, z); block.rotation.y = Math.atan2(this.fx, this.fz);
      const band = new THREE.Mesh(new THREE.BoxGeometry(3.56, Math.min(0.5, h * 0.5), 3.56), new THREE.MeshLambertMaterial({ color: colour }));
      band.position.set(x, h - 0.32, z); band.rotation.y = block.rotation.y;
      scene.add(block, band);
      const w = e.w;
      Object.assign(w, { out: false, finished: true, x, z, lift: 0, fall: 0, flat: 0, wolf: 0, howl: 0, giant: 0, shrunk: 0, star: 0, stun: 0, spot: null });
      views[w.idx].group.position.y = h;
      views[w.idx].winT = 0; views[w.idx].tight = 0.5;
      return { x, z, h, e, name: charOf(w).name + (w.cuts ? ' ' + FRACTION[w.cuts] : ''), colour: hex(charOf(w).color), voice: personaOf(w).voice, text: speechFor({ ...w, ...e }, k), medal: MEDALS[k][0], medalColour: hex(colour) };
    });
    // Bronze speaks first, gold last.
    this.order = this.spots.map((_, k) => k).reverse();
  }

  // ok: somebody pressed a button, to hurry it along.
  step(dt, ok) {
    this.t += dt; this.at += dt;
    if (this.over) return;
    const s = this.stage < 0 ? null : this.spots[this.order[this.stage]];
    if (!s) {
      // Before the speeches, a look at the whole podium.
      if (this.at > 2.6 || ok) this.next();
    } else {
      const before = Math.floor(this.shown);
      this.shown = Math.min(s.text.length, this.shown + s.voice.rate * dt);
      // A noise for every other letter as it appears, in that worm's voice.
      for (let i = before; i < Math.floor(this.shown); i++) if (i % 2 === 0 && /[a-z0-9]/i.test(s.text[i])) sfx.blip(s.voice, s.text.charCodeAt(i));
      const full = this.shown >= s.text.length;
      if (full && this.hold === undefined) this.hold = this.at;
      if (ok && !full) { this.shown = s.text.length; } else if ((full && this.at - this.hold > 2.6) || (ok && full)) this.next();
    }
    this.aim(dt);
    this.draw();
  }

  next() {
    this.stage++; this.at = 0; this.shown = 0; this.hold = undefined;
    if (this.stage >= this.order.length) { this.over = true; this.done(); }
  }

  // The camera: back from the podium to take it all in, or up close in front of whoever's speaking.
  aim(dt = 0.016) {
    const s = this.stage < 0 || this.over ? null : this.spots[this.order[this.stage]], sway = Math.sin(this.t * 0.5);
    const want = s
      ? [s.x + this.fx * 6.5 + this.nx * sway * 1.2, s.h + 2.4, s.z + this.fz * 6.5 + this.nz * sway * 1.2, s.x, s.h + 0.7, s.z]
      : [this.cx + this.fx * 15 + this.nx * sway * 3, 5.5, this.cz + this.fz * 15 + this.nz * sway * 3, this.cx, 1.6, this.cz];
    if (!this.cam) this.cam = want;
    const k = 1 - Math.exp(-4 * dt);
    this.cam = this.cam.map((v, i) => v + (want[i] - v) * k);
    this.camera.position.set(this.cam[0], this.cam[1], this.cam[2]);
    this.camera.lookAt(this.cam[3], this.cam[4], this.cam[5]);
  }

  // The words, on the HUD's own small canvas: a title to begin with, then a box with the medal, the name and the speech.
  draw() {
    const L = this.layer, c = L.ctx, W = L.W, H = L.H, m = Math.min(W, H);
    const font = (size) => { c.font = `italic 900 ${Math.round(size)}px ${FONT}`; };
    const text = (str, x, y, size, fill, align = 'left') => { font(size); c.textAlign = align; c.textBaseline = 'top'; c.lineJoin = 'round'; c.lineWidth = Math.max(2, size * 0.2); c.strokeStyle = '#000'; c.strokeText(str, Math.round(x), Math.round(y)); c.fillStyle = fill; c.fillText(str, Math.round(x), Math.round(y)); };
    c.save();
    const s = this.stage < 0 || this.over ? null : this.spots[this.order[this.stage]];
    if (!s) {
      const big = Math.max(14, m * 0.1);
      text('MEDAL CEREMONY', W / 2, H * 0.1, big, '#ffe24a', 'center');
      text(this.cup.toUpperCase(), W / 2, H * 0.1 + big * 1.15, big * 0.5, '#fff', 'center');
    } else {
      const size = Math.max(8, m * 0.042), pad = size * 0.8, bw = Math.min(W - 8, m * 1.5), bx = (W - bw) / 2;
      // Wrapped to the box.
      font(size);
      const lines = []; let line = '';
      for (const word of s.text.split(' ')) { const t = line ? line + ' ' + word : word; if (c.measureText(t).width > bw - pad * 2 && line) { lines.push(line); line = word; } else line = t; }
      lines.push(line);
      const bh = pad * 2 + size * 1.5 + lines.length * size * 1.25, by = H - bh - Math.max(4, m * 0.03) - L.inset.b;
      c.fillStyle = 'rgba(12,16,34,.82)'; c.fillRect(bx, by, bw, bh);
      c.lineWidth = 2; c.strokeStyle = s.medalColour; c.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
      text(s.name.toUpperCase(), bx + pad, by + pad * 0.7, size * 1.1, s.colour);
      // Which medal, across the top of the screen, beside a medal: a ribbon and a disc, drawn none too carefully.
      const big = Math.max(14, m * 0.1), r = big * 0.52, label = s.medal, top = Math.max(4, m * 0.04) + L.inset.t;
      font(big);
      const tw = c.measureText(label).width, mx = Math.round((W - tw) / 2 - r * 1.5), my = Math.round(top + big * 0.72);
      c.lineWidth = 2; c.strokeStyle = '#000'; c.lineJoin = 'miter';
      for (const [side, colour] of [[-1, '#d82818'], [1, '#2860e8']]) {
        c.beginPath(); c.moveTo(mx + side * r * 0.15, my - r * 0.5); c.lineTo(mx + side * r * 0.95, my - r * 2); c.lineTo(mx + side * r * 0.35, my - r * 2.05); c.lineTo(mx - side * r * 0.25, my - r * 0.7); c.closePath();
        c.fillStyle = colour; c.fill(); c.stroke();
      }
      c.beginPath(); c.arc(mx + 1, my, r, 0, 7); c.fillStyle = s.medalColour; c.fill(); c.stroke();
      c.beginPath(); c.arc(mx + 1, my, r * 0.62, 0.3, 5.9); c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,.45)'; c.stroke();
      text(String(3 - this.stage > 0 ? ['1', '2', '3'][this.order[this.stage]] : ''), mx + 1, my - r * 0.62, r * 1.15, '#fff', 'center');
      text(label, mx + r * 1.5, top, big, s.medalColour);
      let left = Math.floor(this.shown);
      lines.forEach((l, i) => { const part = l.slice(0, Math.max(0, left)); left -= l.length + 1; if (part) text(part, bx + pad, by + pad + size * 1.5 + i * size * 1.25, size, '#fff'); });
    }
    c.restore();
  }
}
