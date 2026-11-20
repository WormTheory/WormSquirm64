// Runs whole races without drawing anything and prints how different ways of pressing compare.
// The point: a masher, a steady presser and a computer worm should all finish about the same.
//   node tools/simstats.mjs [races]
import { Race, STEP } from '../src/sim/race.js';
import { TRACKS } from '../src/sim/track.js';
import { locate } from '../src/sim/track.js';
import { ACTIONS } from '../src/sim/worm.js';

const RACES = +process.argv[2] || 200;
const styles = {
  'mash (60/s), perfect aim': { every: 0, aim: 'perfect' },
  'steady (1 per 0.7s), perfect aim': { every: 0.7, aim: 'perfect' },
  'slow (1 per 1.5s), perfect aim': { every: 1.5, aim: 'perfect' },
  'mash, never turns camera': { every: 0, aim: 'fixed' },
};
for (const [name, st] of Object.entries(styles)) {
  let rankSum = 0, wins = 0, timeSum = 0, winTime = 0, dnf = 0;
  for (let r = 0; r < RACES; r++) {
    const race = new Race({ trackDef: TRACKS[0], seed: 1000 + r, racers: Array.from({ length: 8 }, (_, i) => ({ char: i, human: i === 7 })) });
    const me = race.worms[7];
    let next = 0;
    while (race.state !== 'done' && race.clock < 900) {
      if (st.aim === 'perfect') { const l = locate(race.track, me.x, me.z, me.hint); race.setAim(7, Math.atan2(l.tx, l.tz)); }
      if (race.clock >= next) { race.press(7, ACTIONS[r % 8]); next = race.clock + st.every; }
      race.step(STEP);
    }
    rankSum += me.rank + 1; if (me.rank === 0) wins++;
    if (me.finished) timeSum += me.finishTime; else dnf++;
    winTime += race.firstFinish;
  }
  console.log(`${name.padEnd(34)} avg place ${(rankSum / RACES).toFixed(2)}  wins ${(100 * wins / RACES).toFixed(0)}%  ` +
    `own time ${(timeSum / Math.max(1, RACES - dnf)).toFixed(0)}s  unfinished ${dnf}  winner's time ${(winTime / RACES).toFixed(0)}s`);
}
