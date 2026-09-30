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
 * 7      Renumérotation de La Troupe par palier puis par type (artéfacts,
 *        lieux, PNJ) : 001 à 110 les communes… 214 à 220 les légendaires.
 *        L'identifiant d'une carte contient son numéro (« 164-hida » devient
 *        « 219-hida ») : chaque ancien identifiant est remplacé partout où la
 *        sauvegarde le porte, voir `renumeroter()`.
 */
export const SCHEMA = 7;

/** Première version encore lisible. En dessous, on repart d'une partie neuve. */
export const SCHEMA_MIN = 6;

import RENUMEROTATION_TROUPE from "./renumerotation-troupe.json" with { type: "json" };

/**
 * Remplace, dans toute une sauvegarde, les identifiants de carte de `table`
 * (ancien → nouveau) : clés d'objet (la collection, indexée par carte), valeurs
 * (un identifiant cité par une expédition, une offre, un succès…), et dans les
 * instantanés de carte (`{ id, num, … }`) le numéro qui va avec.
 *
 * Parcours générique plutôt qu'une liste de champs : la sauvegarde cite des
 * cartes à une dizaine d'endroits (Comptoir, colporteur, expéditions, donjon,
 * Reliquaire, succès), et un champ oublié y laisserait une carte orpheline.
 * Un identifiant de carte (« 164-hida ») ne se confond avec aucune autre
 * valeur de la sauvegarde.
 */
export function renumeroter(valeur, table) {
  if (typeof valeur === "string") return table[valeur] ?? valeur;
  if (Array.isArray(valeur)) return valeur.map((v) => renumeroter(v, table));
  if (!valeur || typeof valeur !== "object") return valeur;
  const sortie = {};
  for (const [cle, v] of Object.entries(valeur)) sortie[table[cle] ?? cle] = renumeroter(v, table);
  const ancien = typeof valeur.id === "string" ? valeur.id : null;
  if (ancien && table[ancien] && "num" in valeur) {
    // Le numéro suit l'identifiant, dans le type d'origine (texte « 219 »).
    const num = table[ancien].split("-")[0];
    sortie.num = typeof valeur.num === "number" ? Number(num) : num;
  }
  return sortie;
}

/**
 * `MIGRATIONS[n]` fait passer une sauvegarde de n − 1 à n.
 * Exemple pour une future version 7 :
 *
 *   7: {
 *     mine: (d) => ({ ...d, talents: { ...d.talents, patience: 0 } }),
 *   },
 */
export const MIGRATIONS = {
  7: {
    jeu: (d) => renumeroter(d, RENUMEROTATION_TROUPE.ids),
    mine: (d) => renumeroter(d, RENUMEROTATION_TROUPE.ids),
  },
};

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
