// Runs whole races without drawing anything and prints how different ways of pressing compare.
// The point: pressing faster than four times a second, or aiming better than roughly forwards, should gain nothing,
// and leaning on one button should lose.
//   node tools/simstats.mjs [races]
import { Race, STEP } from '../src/sim/race.js';
import { TRACKS } from '../src/sim/track.js';
import { locate } from '../src/sim/track.js';
import { ACTIONS } from '../src/sim/worm.js';

const RACES = +process.argv[2] || 200;
// A track number and 'events' can follow: node tools/simstats.mjs 100 7 events
const TRACK = +process.argv[3] || 0, EVENTS = process.argv[4] === 'events';
const styles = {
  'mash 60/s, all buttons': { every: 0, aim: 0, keys: 8 },
  'press 6/s, all buttons': { every: 1 / 6, aim: 0, keys: 8 },
  'press 4/s, all buttons': { every: 1 / 4, aim: 0, keys: 8 },
  'press 4/s, two buttons in turn': { every: 1 / 4, aim: 0, keys: 2 },
  'press 4/s, three A then one B': { every: 1 / 4, aim: 0, keys: 'AAAB' },
  'press 4/s, one button only': { every: 1 / 4, aim: 0, keys: 1 },
  'press 4/s, looking 55 deg off': { every: 1 / 4, aim: 55, keys: 8 },
  'press 4/s, looking 70 deg off': { every: 1 / 4, aim: 70, keys: 8 },
  'press 4/s, looking 80 deg off': { every: 1 / 4, aim: 80, keys: 8 },
  'press 4/s, looking 95 deg off': { every: 1 / 4, aim: 95, keys: 8 },
  'press 3/s, all buttons': { every: 1 / 3, aim: 0, keys: 8 },
  'press 2/s, all buttons': { every: 1 / 2, aim: 0, keys: 8 },
};
for (const [name, st] of Object.entries(styles)) {
  let rankSum = 0, wins = 0, timeSum = 0, winTime = 0, dnf = 0;
  for (let r = 0; r < RACES; r++) {
    const race = new Race({ trackDef: TRACKS[TRACK], events: EVENTS, seed: 1000 + r, racers: Array.from({ length: 8 }, (_, i) => ({ char: i, human: i === 7 })) });
    const me = race.worms[7];
    let next = 0, k = 0;
    while (race.state !== 'done' && race.clock < 900) {
      { const l = locate(race.track, me.x, me.z, me.hint); race.setAim(7, Math.atan2(l.tx, l.tz) + st.aim * Math.PI / 180); }
      if (race.clock >= next) { race.press(7, st.keys === 'AAAB' ? ACTIONS[k++ % 4 === 3 ? 1 : 0] : ACTIONS[k++ % st.keys]); next = race.clock + st.every; }
      race.step(STEP);
    }
    rankSum += me.rank + 1; if (me.rank === 0) wins++;
    if (me.finished) timeSum += me.finishTime; else dnf++;
    winTime += race.firstFinish;
  }
  console.log(`${name.padEnd(32)} avg place ${(rankSum / RACES).toFixed(2)}  wins ${(100 * wins / RACES).toFixed(0)}%  ` +
    `own time ${(timeSum / Math.max(1, RACES - dnf)).toFixed(0)}s  unfinished ${dnf}  winner's time ${(winTime / RACES).toFixed(0)}s`);
}
