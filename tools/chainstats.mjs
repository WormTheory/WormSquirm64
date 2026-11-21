// Chains two worms in each of a dozen races and says how well the chain held and how far apart they danced.
//   node tools/chainstats.mjs
import { Race } from '../src/sim/race.js';
import { TRACKS } from '../src/sim/track.js';
import { begin } from '../src/sim/events.js';
let bad = 0, tot = 0, unfinished = 0, apartDance = [];
for (let seed = 1; seed <= 12; seed++) {
  const r = new Race({ trackDef: TRACKS[seed % 8], seed, racers: [0,1,2,3,4,5,6,7].map((char) => ({ char, human: false })), events: false });
  while (r.clock < 10) r.step(1 / 60);
  begin(r, r.weather, 'chain');
  const c = r.weather.chain; if (!c) { console.log('no chain', seed); continue; }
  const a = r.worms[c.a], b = r.worms[c.b];
  let worst = 0, why = '';
  for (let n = 0; n < 60 * 400 && !(a.finished && b.finished); n++) {
    r.step(1 / 60);
    if (!a.chains.length) continue;
    if (a.lift > 0 || b.lift > 0 || a.finished || b.finished) continue;
    const d = Math.hypot(a.x - b.x, a.z - b.z); tot++;
    if (d > 3.7) { bad++; if (d > worst) { worst = d; why = `fall ${a.fall.toFixed(1)}/${b.fall.toFixed(1)} pit ${a.pit}/${b.pit} t ${r.clock.toFixed(1)}`; } }
  }
  for (let n = 0; n < 400; n++) r.step(1 / 60);
  if (!(a.finished && b.finished)) { unfinished++; console.log('seed', seed, 'unfinished', a.finished, b.finished, a.prog.toFixed(0), b.prog.toFixed(0), r.track.length * 3 | 0, 'chain', a.chains, 'fall', a.fall, b.fall); }
  else apartDance.push(Math.hypot(a.x - b.x, a.z - b.z).toFixed(1));
  if (worst) console.log('seed', seed, 'worst', worst.toFixed(1), why);
}
console.log('frames over length:', bad, 'of', tot, 'unfinished', unfinished, 'dance gaps', apartDance.join(' '));
