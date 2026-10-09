import { useSyncExternalStore } from "react";

/**
 * Le gel de l'onglet : plus aucune écriture, ni locale ni vers le compte.
 *
 * Après une montée de `SCHEMA`, un onglet resté ouvert sur l'ancienne version
 * du site ne sait pas lire ce qu'écrit la nouvelle. Il continuait pourtant à
 * sauver sa vieille partie (gain passif toutes les vingt secondes) par-dessus
 * celle de l'onglet à jour, qui l'adoptait en la migrant : la progression
 * jouée dans l'onglet récent disparaissait. Dès qu'un onglet voit une
 * sauvegarde d'un format plus récent que le sien (stockage partagé, copie du
 * compte, ou au chargement), il se gèle et demande à être rechargé : il ne
 * peut plus rien faire d'utile sans le code de la nouvelle version.
 *
 * Le gel ne se lève pas : seul un rechargement de la page l'efface.
 */

let gel = null; // null, ou d'où vient l'alerte : "onglet" | "compte"
const suiveurs = new Set();

export const estGele = () => gel !== null;

/** `origine` : "onglet" (stockage partagé) ou "compte" (copie du compte). */
export function geler(origine = "onglet") {
  if (gel) return;
  gel = origine;
  suiveurs.forEach((f) => { try { f(); } catch { /* sans importance */ } });
}

/** Pour React : `null` tant que l'onglet n'est pas gelé, sinon l'origine. */
export function useGel() {
  return useSyncExternalStore(
    (f) => { suiveurs.add(f); return () => suiveurs.delete(f); },
    () => gel,
  );
}
