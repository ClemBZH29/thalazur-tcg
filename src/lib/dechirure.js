import { COUPE } from "../config/cadre.js";

/**
 * Bord déchiré déterministe. La ligne de coupe est posée sur le premier quart
 * de la hauteur du sachet. Les dents ne descendent que vers le bas : le quart
 * reste le point le plus haut de la déchirure, ce qui garantit que le titre
 * imprimé juste au-dessus n'est jamais entamé.
 */
const DENTS = (() => {
  const n = 56;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * 100;
    const r = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    pts.push([x, r * 2.1]);
  }
  return pts;
})();

const CUT = COUPE * 100;
const pt = ([x, d]) => `${x.toFixed(2)}% ${(CUT + d).toFixed(2)}%`;

/** Partie arrachée : du haut du sachet jusqu'à la déchirure. */
export const CLIP_HAUT = `polygon(0% 0%, 100% 0%, ${[...DENTS].reverse().map(pt).join(", ")})`;

/** Partie conservée : de la déchirure jusqu'au bas. */
export const CLIP_BAS = `polygon(${DENTS.map(pt).join(", ")}, 100% 100%, 0% 100%)`;

export const LIGNE_COUPE = CUT;
