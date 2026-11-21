// Mutations: what the Gene Splice event can do to a worm. A worm keeps a count for each (they all stack), and the
// counts are what's carried through a cup, copied to an evil clone, and kept by both pieces of a worm that's cut.
export const GENES = ['long', 'short', 'fat', 'narrow', 'spider', 'human', 'horse', 'wings', 'fin', 'poison', 'spikes', 'fur', 'head'];
// What the screen calls each. (Three sorts of legs, and it only ever says LEGS.)
export const GENE_NAMES = ['LONG', 'SHORT', 'FAT', 'NARROW', 'LEGS', 'LEGS', 'LEGS', 'WINGS', 'FIN', 'POISONOUS', 'SPIKES', 'FUR', 'EXTRA HEAD'];
export const GENE = Object.fromEntries(GENES.map((g, i) => [g, i]));
export const MOST = 9; // the most of any one mutation a worm can have
export const noGenes = () => GENES.map(() => 0);

// How many balls long the worm is: a quarter longer for each Long, a quarter shorter for each Short, from ten.
export const segsOf = (m) => Math.max(6, Math.min(64, Math.round(10 * 1.25 ** m[GENE.long] * 0.75 ** m[GENE.short])));
// How fat: a quarter fatter for each Fat, a quarter thinner for each Narrow. (Length isn't changed by it.)
export const girthOf = (m) => Math.max(0.3, Math.min(4, 1.25 ** m[GENE.fat] * 0.75 ** m[GENE.narrow]));
// How much faster it goes: a twentieth for every set of legs, and a quarter for each fin while it's raining.
export const speedOf = (m, wet) => 1.05 ** (m[GENE.spider] + m[GENE.human] + m[GENE.horse]) * (wet ? 1.25 ** m[GENE.fin] : 1);
// How much faster it goes through the air (off a spring, in a tornado): half as fast again for each pair of wings.
export const airOf = (m) => 1.5 ** m[GENE.wings];
