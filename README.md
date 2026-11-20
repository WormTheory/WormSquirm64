# Worm Squirm 64

A kart racer without the karts. You are a worm. Every button does something; none of them does it well.

What's here so far: eight tracks in two cups (the Wormroom Cup and the Squirm Cup), eight worms, Grand Prix and
VS Race, computer worms filling the empty places, items, optional random events, music, split screen for up to
four, and online play with room codes and a list of open games.

It's published at https://wormtheory.github.io/WormSquirm64/ on every push.

## Playing

The game is plain files with no build step, but browsers only load its scripts from a web address,
so serve the folder and open it:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

- **Controller:** left stick turns the camera; the four face buttons and four shoulder buttons are the eight actions.
- **Keyboard and mouse:** A/D or the arrow keys turn the camera, or drag with the mouse;
  Q E R F Z X C V and J K L I U O N M are the actions.
- **Touch:** drag to turn the camera; tap the on-screen buttons.
- Escape or Start pauses.
- Options also has a DEBUG switch. With it on there's a switch for each random event, and AUTO MODE, which makes
  the players' own worms race by themselves (aiming along the road and pressing as fast as counts).
- Options (on the main menu and in the pause menu) has two sliders: the pixel size of the 3D picture, and of the
  HUD and menus. They're remembered in the browser.
- On the "Who's playing?" screen every input (the keyboard and mouse, each controller, the touch screen) has a row
  and moves itself into a player slot. A controller appears once one of its buttons has been pressed.

## Layout

- `src/sim/` is the race itself as plain maths, with no three.js: the track, how a worm moves, the computer
  worms, laps and places. It uses its own seeded random numbers, so a race replays exactly from its seed.
- `src/` is everything you see and touch: scenery (`view.js`), the worm model (`wormview.js`), controls (`input.js`),
  each player's HUD (`hud.js`), the menus (`menus.js`), sound, and `main.js`, which runs the race and shares out the screen.
- `vendor/` holds three.js r160, so the game depends on no other site.

## Items, events and music

- **Items** (`src/sim/items.js`). Three rows of boxes sit across each track. A worm that touches one gets an item
  and uses it that instant: a Wormshroom (faster for a few seconds), a Squirmana Peel (left behind), a Pebble
  (thrown ahead, bounces off walls), a Homing Pebble (goes for the worm in front), a Squirm Star (faster, can't be
  stopped, bowls others over), Lightning (shrinks and slows everyone else), a Mole (goes for the leader), a Glue Pot
  (a puddle that slows whoever wades through), a Switcheroo (changes places with the worm in front) or a Spring
  (one great bound up the road).
  Worms at the back get the better ones.
- **Random events** (`src/sim/events.js`), switched on in the options: rain washes worms about and sometimes off
  the road; a heatwave bakes them, slowing them and killing some; a bird takes one worm for good (for the rest of
  a cup, or of an online room), and that player watches the nest from then on; a pair of legs walks across and
  flattens whoever is underfoot for five to ten seconds. Under a blood moon one worm turns into a
  were-wolf-worm and hunts the rest, biting them, until the curse lifts; the hand sticks a plaster on each victim.
  A tornado comes down the road and whirls worms off to somewhere else; an earthquake tips them over; a frost
  makes every lunge slide on.
- **The hand.** A worm that falls off is lowered back onto the road by a giant hand, and one that bakes to death
  has a jug of water poured over it. How often events come is a slider in the options.
- **Wormbow Road** has no walls: a worm that goes over the edge falls and comes back in the middle of the road.
- **Music** (`src/music.js`) is made up by the game from a seed for each track, so there are no sound files.
  The last lap plays faster. Music and sound each have a volume slider in the options.

## Online play

There is no game server: GitHub Pages only serves files. Players' browsers talk to each other directly
(Trystero over WebRTC, finding each other through public Nostr relays), the same way Goblin Stompin' Gus does.

- **The host's browser runs the race** and is the only one that decides anything. Guests send their controls
  thirty times a second and show the host's snapshots (twenty a second) a tenth of a second behind
  (`src/net/mirror.js`). The camera is each player's own, so turning never waits on the network.
- **Rooms** (`src/net/room.js`) have a four-letter code. A browser can bring up to four split-screen players,
  and a room holds eight racers; computer worms take the rest. A guest who leaves mid-race is taken over by
  the computer. If the host leaves, the room ends.
- **Open games** are listed without a server: every browser on the online screen, and every host whose room
  isn't private, joins one shared room where hosts advertise every three seconds.
- **No relay fallback.** Two players whose routers both refuse direct connections can't play together.
  `TURN` in `src/net/transport.js` is the hook for adding a relay.
- A host's tab in the background keeps the race going through a timer in a small worker.
- Add `?net=local` to the address to link tabs of one browser instead of going over the internet.

## Checking a change

```bash
node tools/simstats.mjs 200   # runs 200 races per pressing style; nothing should beat four presses a second, roughly forwards
node tools/simstats.mjs 100 7 events   # the same on track 7 (Wormbow Road) with random events on

node tools/trackcheck.mjs      # each track's length and tightest bend; a bend tighter than the road is wide folds over itself
```

`tools/fxtest.cjs` takes screenshots of the second cup's tracks, each random event and the nest.

`tools/nettest.cjs` plays a whole online race between two tabs of a headless browser (host, join from the
open games list, race, results, back to the lobby, host leaves) and says what passed.

`tools/playtest.cjs` opens the game in a headless browser (needs Playwright), walks the menus, plays a little by
keyboard and by touch, and saves screenshots of every screen, track and split-screen layout.
The numbers that set how a worm moves are `TUNE` in `src/sim/worm.js`.
