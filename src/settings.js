// The player's options, kept in the browser between visits. A value of null means "pick for me".
//   renderPx: how many screen pixels to one pixel of the 3D picture.
//   uiPx: how many screen pixels to one pixel of the HUD and menus (1: not pixelated at all).
const KEY = 'ws64-settings';
//   music, sfx: volumes, 0 to 10.   events: whether random events happen in races.
export const settings = { renderPx: null, uiPx: null, music: 6, sfx: 8, events: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* no storage: defaults */ }
export function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* not kept */ } }

// What each is when left alone: the picture 240 lines on its short side, the HUD and menus two
// screen pixels to one on a small screen (any more and small text can't be read) and three on a big one.
export const autoRenderPx = (w, h) => Math.max(1, Math.round((Math.min(w, h) / 240) * 2) / 2);
export const autoUiPx = (w, h) => (Math.min(w, h) < 700 ? 2 : 3);
export const renderPx = (w, h) => settings.renderPx || autoRenderPx(w, h);
export const uiPx = (w, h) => settings.uiPx || autoUiPx(w, h);
