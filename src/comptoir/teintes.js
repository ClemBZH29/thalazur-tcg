import { TIER_INFO } from "../config/tiers.js";

/**
 * Les teintes de rareté du Comptoir.
 *
 * La lueur reprend celle de la charte, `tiers.js` faisant foi. Les encres, en
 * revanche, sont des variantes éclaircies : la teinte de cadre d'un légendaire
 * (#b33049) tombe à 2,4:1 sur un panneau et ne peut pas servir de texte. Ces
 * valeurs-ci sont vérifiées à 4,5:1 sur --panel2, la surface la plus claire de
 * l'interface.
 */
const ENCRES = {
  commun: "#8fb8d8",
  peucommun: "#78c2b0",
  rare: "#d19a3c",
  legendaire: "#e8899a",
  fullart: "#e8899a",
  pj: "#e3ecf4",
};

export const encre = (tier) => ENCRES[tier] || "#b7b2a4";

export function lueur(tier) {
  const c = TIER_INFO[tier]?.lueur || "#8fb8d8";
  return `inset 0 0 0 1px ${c}88, 0 0 12px ${c}2e`;
}

/**
 * Le style d'un dos de carte : l'image du dos, plus la lueur du palier.
 *
 * Le chemin passe par `BASE_URL` et non par la feuille de style, parce que le
 * site est publié dans un sous-chemin sur GitHub Pages : une URL absolue dans
 * un `url()` de CSS y pointerait à la racine du domaine.
 */
export const dos = (tier) => ({
  backgroundImage: `url(${import.meta.env.BASE_URL}carte-dos.webp)`,
  boxShadow: lueur(tier),
});
