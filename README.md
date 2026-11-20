# Worm Squirm 64

A kart racer without the karts. You are a worm. Every button does something; none of them does it well.

This is the first playable: one track (Green Morm Raceway), one player against seven computer worms.
Menus, more tracks, split screen and online play are still to come.

## Playing

The game is plain files with no build step, but browsers only load its scripts from a web address,
so serve the folder and open it:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

- **Controller:** left stick turns the camera; the four face buttons and four shoulder buttons are the eight actions.
- **Keyboard:** A/D or the arrow keys turn the camera; J K L I U O, Space and Shift are the actions.
- **Touch:** drag to turn the camera; tap the on-screen buttons.
- Add `?worm=0` to `?worm=7` to the address to pick a worm.

## Layout

- `src/sim/` is the race itself as plain maths, with no three.js: the track, how a worm moves, the computer
  worms, laps and places. It uses its own seeded random numbers, so a race replays exactly from its seed.
- `src/` is everything you see and touch: scenery (`view.js`), the worm model (`wormview.js`), controls, HUD, sound.
- `vendor/` holds three.js r160, so the game depends on no other site.

## Checking a change

```bash
node tools/simstats.mjs 200   # runs 200 races per pressing style; nothing should beat four presses a second, roughly forwards
```

`tools/playtest.cjs` opens the game in a headless browser (needs Playwright), plays a little and saves screenshots.
The numbers that set how a worm moves are `TUNE` in `src/sim/worm.js`.
