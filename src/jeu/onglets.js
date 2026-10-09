import { comparerMines } from "../lib/nuage/fusion.js";

/**
 * Petites décisions pures de la cohabitation entre onglets (voir Jeu.jsx).
 */

/** Deux états qui ne diffèrent que par la bourse (le gain passif d'un tour). */
export function seuleLaBourse(avant, apres) {
  if (avant === apres) return true;
  const cles = new Set([...Object.keys(avant || {}), ...Object.keys(apres || {})]);
  cles.delete("bourse");
  for (const k of cles) if (avant[k] !== apres[k]) return false;
  return true;
}

/** La mine `nouvelle` (texte) est-elle moins avancée que `ancienne` ? */
export function mineMoinsAvancee(nouvelle, ancienne) {
  if (!nouvelle || !ancienne) return false;
  try {
    return comparerMines(JSON.parse(nouvelle), JSON.parse(ancienne)) < 0;
  } catch { return false; }
}
