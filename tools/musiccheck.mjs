// The music can't be listened to from a test, so this looks at what the generator writes instead: for each song,
// how many notes each voice plays, the range of each, how full the busiest step is, and a picture of the tune.
//   node tools/musiccheck.mjs [song]
import { compose } from '../src/music.js';

const names = process.argv[2] ? [process.argv[2]] : ['menu', 'results', 'race0', 'race1', 'race2', 'race3', 'race4', 'race5', 'race6', 'race7'];
const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], nm = (m) => NOTE[m % 12] + (Math.floor(m / 12) - 1);
let bad = 0;
for (const name of names) {
  const s = compose(name), by = {};
  let fullest = 0;
  s.steps.forEach((notes) => {
    fullest = Math.max(fullest, notes.filter((n) => n[4] === 0).length);
    for (const [voice, note, len, vol] of notes) {
      const v = by[voice] || (by[voice] = { n: 0, lo: 999, hi: -1 });
      v.n++;
      if (voice !== 'drum') { if (!Number.isFinite(note) || !(len > 0) || !(vol > 0)) bad++; v.lo = Math.min(v.lo, note); v.hi = Math.max(v.hi, note); }
    }
  });
  const bars = s.steps.length / 16;
  console.log(`\n${name}: ${s.bpm} bpm, ${bars} bars (${(bars * 4 * 60 / s.bpm).toFixed(0)}s before it comes round), ${s.style.scale}, lead ${s.style.lead}, fullest step ${fullest} notes`);
  console.log('  ' + Object.entries(by).map(([v, x]) => `${v} ${x.n}${v === 'drum' ? '' : ` (${nm(x.lo)}-${nm(x.hi)})`}`).join('   '));
  if (process.argv[2]) {
    // The tune, a row to a bar: each sixteenth shows the lead's note as a height (0-9, then a-z), or a dot.
    for (let b = 0; b < bars; b++) {
      let row = '';
      for (let k = 0; k < 16; k++) { const n = s.steps[b * 16 + k].find((x) => x[0] === 'lead'); row += n ? (n[1] - by.lead.lo).toString(36) : '.'; if (k % 4 === 3) row += ' '; }
      console.log(`  bar ${String(b).padStart(2)}  ${row}`);
    }
  }
}
console.log(bad ? `\n${bad} BAD NOTES` : '\nevery note has a pitch, a length and a volume');
