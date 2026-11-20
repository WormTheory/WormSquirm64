# Worm Squirm 64

A kart racer without the karts. You are a worm. Every button does something; none of them does it well.

What's here so far: four tracks (the Wormroom Cup), eight worms, Grand Prix and VS Race, computer worms
filling the empty places, and split screen for up to four. Online play is still to come.

## Playing

The game is plain files with no build step, but browsers only load its scripts from a web address,
so serve the folder and open it:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

- **Controller:** left stick turns the camera; the four face buttons and four shoulder buttons are the eight actions.
- **Keyboard, left half:** A/D turn the camera; Q E R F Z X C V are the actions.
- **Keyboard, right half:** arrow keys turn the camera; J K L I U O N M are the actions.
  Someone alone on the keyboard gets both halves; two people can share it.
- **Touch:** drag to turn the camera; tap the on-screen buttons.
- Escape or Start pauses.

## Layout

- `src/sim/` is the race itself as plain maths, with no three.js: the track, how a worm moves, the computer
  worms, laps and places. It uses its own seeded random numbers, so a race replays exactly from its seed.
- `src/` is everything you see and touch: scenery (`view.js`), the worm model (`wormview.js`), controls (`input.js`),
  each player's HUD (`hud.js`), the menus (`menus.js`), sound, and `main.js`, which runs the race and shares out the screen.
- `vendor/` holds three.js r160, so the game depends on no other site.

## Checking a change

```bash
node tools/simstats.mjs 200   # runs 200 races per pressing style; nothing should beat four presses a second, roughly forwards

node tools/trackcheck.mjs      # each track's length and tightest bend; a bend tighter than the road is wide folds over itself
```

`tools/playtest.cjs` opens the game in a headless browser (needs Playwright), walks the menus, plays a little by
keyboard and by touch, and saves screenshots of every screen, track and split-screen layout.
The numbers that set how a worm moves are `TUNE` in `src/sim/worm.js`.
