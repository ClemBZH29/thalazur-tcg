/**
 * Le format des sauvegardes, et son histoire.
 *
 * Un seul numéro, `SCHEMA`, pour tout ce qui se sauvegarde : l'état du jeu
 * (collection, bourse, réglages…), la partie des Mines de Kazim, le document
 * du compte et les fichiers exportés. Ils changent ensemble, se migrent
 * ensemble, et un fichier ou un compte d'une version donnée se lit toujours
 * de la même façon.
 *
 * ── Changer le format ────────────────────────────────────────────────────
 * 1. Monter `SCHEMA` d'un cran.
 * 2. Ajouter dans `MIGRATIONS` l'entrée du nouveau numéro : une fonction par
 *    genre (`jeu`, `mine`) qui reçoit la sauvegarde de la version précédente
 *    et rend celle de la nouvelle. Un genre qui ne change pas n'a pas besoin
 *    d'entrée.
 * 3. Ajouter un test dans `tests/sauvegarde.test.js` : une sauvegarde de
 *    l'ancienne version doit se relire dans la nouvelle.
 *
 * Ajouter un champ avec une valeur par défaut ne demande rien de tout cela :
 * la valeur par défaut de `etatVide()` ou de `etatNeuf()` le remplit au
 * chargement.
 *
 * ── Historique ───────────────────────────────────────────────────────────
 * 1 à 5  Anciennes versions de l'état du jeu (la mine avait son propre `v: 1`).
 * 6      Numérotation commune au jeu et à la mine. Remise à zéro volontaire
 *        (un seul joueur à ce moment-là) : rien d'antérieur n'est repris.
 */
export const SCHEMA = 6;

/** Première version encore lisible. En dessous, on repart d'une partie neuve. */
export const SCHEMA_MIN = 6;

/**
 * `MIGRATIONS[n]` fait passer une sauvegarde de n − 1 à n.
 * Exemple pour une future version 7 :
 *
 *   7: {
 *     mine: (d) => ({ ...d, talents: { ...d.talents, patience: 0 } }),
 *   },
 */
export const MIGRATIONS = {};

/**
 * Amène une sauvegarde à la version courante. Rend `null` si elle est trop
 * ancienne, d'une version future (site pas encore rechargé), ou illisible :
 * l'appelant repart alors d'un état neuf plutôt que de deviner.
 */
export function migrer(genre, donnees) {
  if (!donnees || typeof donnees !== "object") return null;
  let n = Number(donnees.schema);
  if (!Number.isInteger(n) || n < SCHEMA_MIN || n > SCHEMA) return null;
  let d = donnees;
  while (n < SCHEMA) {
    n += 1;
    const etape = MIGRATIONS[n]?.[genre];
    d = { ...(etape ? etape(d) : d), schema: n };
  }
  return d;
}
