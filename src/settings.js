// The player's options, kept in the browser between visits. A value of null means "pick for me".
//   renderPx: how many screen pixels to one pixel of the 3D picture.
//   uiPx: how many screen pixels to one pixel of the HUD and menus (1: not pixelated at all).
const KEY = 'ws64-settings';
//   music, sfx: volumes, 0 to 10.   events: whether random events happen in races, and eventFreq how often (1 to 10).
export const settings = { renderPx: null, uiPx: null, music: 6, sfx: 8, events: false, eventFreq: 5,
  // debug: shows the switches below in the options. off: the random events switched off one by one. auto: players' worms race by themselves.
  debug: false, off: {}, auto: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* no storage: defaults */ }
export function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* not kept */ } }

// What each is when left alone: the picture 240 lines on its short side, the HUD and menus two
// screen pixels to one on a small screen (any more and small text can't be read) and three on a big one.
export const autoRenderPx = (w, h) => Math.max(1, Math.round((Math.min(w, h) / 240) * 2) / 2);
export const autoUiPx = (w, h) => (Math.min(w, h) < 700 ? 2 : 3);
export const renderPx = (w, h) => settings.renderPx || autoRenderPx(w, h);
export const uiPx = (w, h) => settings.uiPx || autoUiPx(w, h);
// The random events that may happen, and whether the worms drive themselves: the debug switches only count while debug is on.
export const EVENT_NAMES = { rain: 'RAIN', heat: 'HEATWAVE', bird: 'BIRD', stomp: 'FEET', moon: 'BLOOD MOON', twister: 'TORNADO', quake: 'EARTHQUAKE', frost: 'FROST', hail: 'HAIL', dizzy: 'MIX-UP',
  split: 'SPLIT', check: 'CHECK FOR $30.00', brand: 'SCARLET LETTER', monkey: 'MONKEY MADNESS', chain: 'CHAIN', wormx: 'WORM X', clone: 'EVIL CLONE', gene: 'GENE SPLICE',
  fog: 'FOG', wind: 'WIND', night: 'NIGHT', lowgrav: 'LOW GRAVITY', mower: 'LAWNMOWER', sprinkler: 'SPRINKLER', roadworks: 'ROADWORKS', sinkhole: 'SINKHOLE', reverse: 'REVERSE',
  moles: 'MOLE UPRISING', chicken: 'CHICKEN', ants: 'ANT PARADE', snail: 'SNAIL', frog: 'FROG', birds2: 'TWO BIRDS', pace: 'PACE WORM', fisher: 'FISHERMAN', swapmeet: 'SWAP MEET', makeover: 'MAKEOVER',
  tax: 'TAX AUDIT', knot: 'KNOT', adoption: 'ADOPTION', fused: 'FUSED', marry: 'MARRIAGE' };
export const allowedEvents = () => Object.keys(EVENT_NAMES).filter((k) => !(settings.debug && settings.off && settings.off[k]));
export const autoMode = () => !!(settings.debug && settings.auto);
