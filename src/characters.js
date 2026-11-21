// The eight worms. They are all the same worm: a colour and, at most, one small accessory.
export const CHARS = [
  { name: 'Worm', color: 0xe88aa0, acc: 'none' },
  { name: 'Green Worm', color: 0x58c048, acc: 'none' },
  { name: 'Wormst', color: 0x9a62d8, acc: 'tophat' },
  { name: 'Squirmt', color: 0xf0c830, acc: 'bow' },
  { name: 'Flopple', color: 0xf08030, acc: 'sprout' },
  { name: 'Wyrm', color: 0x30b8b0, acc: 'horns' },
  { name: 'Morm', color: 0xd84030, acc: 'stache' },
  { name: 'Green Morm', color: 0x58c048, acc: 'stache' },
  // Not one to choose: a masked stranger who turns up in the middle of a race (the Worm X event).
  { name: 'Worm X', color: 0xf2f2f2, acc: 'mask', secret: true },
];
export const X_CHAR = 8;
// The worms a player can pick.
export const PICKABLE = CHARS.filter((c) => !c.secret);
// What a worm in a race looks like and is called. An evil clone is its original with the colour turned inside out,
// no accessory, and 'Evil' before the name. (kind: whose victory dance it does.)
const evils = {};
export function charOf(w) {
  if (!w.evil) return CHARS[w.char];
  return evils[w.char] || (evils[w.char] = { name: 'Evil ' + CHARS[w.char].name, color: 0xffffff ^ CHARS[w.char].color, acc: 'none', kind: w.char });
}
export const hex = (c) => '#' + c.toString(16).padStart(6, '0');
