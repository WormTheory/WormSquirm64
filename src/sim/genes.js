// Mutations: what the Gene Splice event can do to a worm. A worm keeps a count for each (they all stack), and the
// counts are what's carried through a cup, copied to an evil clone, and kept by both pieces of a worm that's cut.
export const GENES = ['long', 'short', 'fat', 'narrow', 'spider', 'human', 'horse', 'wings', 'fin', 'poison', 'spikes', 'fur', 'head',
  'gills', 'shell', 'glow', 'tentacles', 'stinger', 'springy', 'sticky', 'eyes', 'antlers', 'rubber', 'camo', 'thick', 'magnetic', 'loud', 'arms', 'beak',
  'hooves', 'unstable', 'regen', 'photo'];
// What the screen calls each. (Three sorts of legs, and it only ever says LEGS.)
export const GENE_NAMES = ['LONG', 'SHORT', 'FAT', 'NARROW', 'LEGS', 'LEGS', 'LEGS', 'WINGS', 'FIN', 'POISONOUS', 'SPIKES', 'FUR', 'EXTRA HEAD',
  'GILLS', 'SHELL', 'GLOW', 'TENTACLES', 'TAIL STINGER', 'SPRINGY', 'STICKY', 'EYES', 'ANTLERS', 'RUBBER', 'CAMOUFLAGE', 'THICK SKIN', 'MAGNETIC', 'LOUD', 'TINY ARMS', 'BEAK',
  'HOOVES', 'UNSTABLE', 'REGENERATION', 'PHOTOSYNTHESIS'];
export const GENE = Object.fromEntries(GENES.map((g, i) => [g, i]));
export const MOST = 9; // the most of any one mutation a worm can have
export const noGenes = () => GENES.map(() => 0);
// (A list made before there were so many kinds is made up to length.)
export const allGenes = (m) => GENES.map((_, i) => (m && m[i]) || 0);

// How many balls long the worm is: a quarter longer for each Long, a quarter shorter for each Short, from ten.
export const segsOf = (m) => Math.max(6, Math.min(64, Math.round(10 * 1.25 ** m[GENE.long] * 0.75 ** m[GENE.short])));
// How fat: a quarter fatter for each Fat, a quarter thinner for each Narrow. (Length isn't changed by it.)
export const girthOf = (m) => Math.max(0.3, Math.min(4, 1.25 ** m[GENE.fat] * 0.75 ** m[GENE.narrow]));
// How much faster it goes: a twentieth for every set of legs (or of hooves), and a quarter for each fin while it's
// raining; a tenth for photosynthesis in a heatwave; a twentieth slower for each shell on its back.
export const speedOf = (m, wet, hot) => 1.05 ** (m[GENE.spider] + m[GENE.human] + m[GENE.horse] + m[GENE.hooves]) * (wet ? 1.25 ** m[GENE.fin] : 1) * (hot ? 1.1 ** m[GENE.photo] : 1) * 0.95 ** m[GENE.shell];
// How much faster it goes through the air (off a spring, in a tornado): half as fast again for each pair of wings.
export const airOf = (m) => 1.5 ** m[GENE.wings];

// What the rest do (the rules are where the thing they change is):
//   gills      rain doesn't wash it about            shell     it can't be flattened (and it's a little slower)
//   glow       it glows                              tentacles it picks up item boxes from twice as far
//   stinger    a worm that runs into the back of it is stunned
//   springy    it bounces off walls                  sticky    frost doesn't make it slide; it leaves a trail of glue
//   eyes       eyes all down it                      antlers   it wins every shoving match
//   rubber     a chain on it stretches twice as far  camo      homing things lose it half the time
//   thick      a were-wolf-worm's bite only stuns it magnetic  pebbles curve towards it
//   loud       its noises are three times as loud    arms      tiny arms
//   beak       the bird leaves it alone              hooves    faster, and it clip-clops
//   unstable   every race one of its other mutations turns into a different one
//   regen      if it's cut in two, the piece cut off grows back to full size
//   photo      a heatwave doesn't bake it, and it goes faster in one
