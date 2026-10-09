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
 * 8      Full art de La Troupe renommés : Selssy devient Selsy, Trodonak
 *        devient Trodonac, la série Passion Ardente devient Nuit Écarlate.
 *        Leur identifiant découle du nom et de la série
 *        (« fa-selssy-sable-chaud » devient « fa-selsy-sable-chaud ») : même
 *        remplacement partout, et les instantanés reprennent nom et série.
 * 10     Aucun champ ne change de sens (pas de migration) : la montée sert à
 *        figer les onglets restés sur la version précédente. Ils lisaient le
 *        numéro d'écriture (`ecriture`) comme une clé inconnue et le
 *        réécrivaient tel quel ; l'onglet à jour les rejetait, et eux
 *        adoptaient sa réécriture par-dessus leurs propres actions. Au format
 *        10, ils se gèlent et demandent à recharger (09/10/2026).
 */
export const SCHEMA = 10;

/** Première version encore lisible. En dessous, on repart d'une partie neuve. */
export const SCHEMA_MIN = 6;

import RENUMEROTATION_TROUPE from "./renumerotation-troupe.json" with { type: "json" };
import { SON_DEFAUT, lireSon } from "../../config/son.js";

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

/** Schéma 8 : ancien identifiant de full art → nouvelle définition. */
export const RENOMMAGE_FULLART = {
  "fa-selssy-sable-chaud": { id: "fa-selsy-sable-chaud", nom: "Selsy", serie: "Sable Chaud", slug: "selsy-sable-chaud" },
  "fa-nemelye-passion-ardente": { id: "fa-nemelye-nuit-ecarlate", nom: "Nemelye", serie: "Nuit Écarlate", slug: "nemelye-nuit-ecarlate" },
  "fa-trodonak-passion-ardente": { id: "fa-trodonac-nuit-ecarlate", nom: "Trodonac", serie: "Nuit Écarlate", slug: "trodonac-nuit-ecarlate" },
};

/**
 * Renomme les full art de `RENOMMAGE_FULLART` dans toute une sauvegarde :
 * même parcours que `renumeroter()` pour les clés et les valeurs. Dans un
 * instantané de full art, le numéro est l'identifiant lui-même (« fa-… ») :
 * il suit l'identifiant, ainsi que le nom, la série et le slug.
 */
export function renommerFullart(valeur, table = RENOMMAGE_FULLART) {
  const ids = Object.fromEntries(Object.entries(table).map(([a, n]) => [a, n.id]));
  const parcourir = (v) => {
    if (typeof v === "string") return ids[v] ?? v;
    if (Array.isArray(v)) return v.map(parcourir);
    if (!v || typeof v !== "object") return v;
    const sortie = {};
    for (const [cle, x] of Object.entries(v)) sortie[ids[cle] ?? cle] = parcourir(x);
    const def = typeof v.id === "string" ? table[v.id] : null;
    if (def) {
      if ("num" in v) sortie.num = def.id;
      for (const champ of ["nom", "serie", "slug"]) if (champ in v) sortie[champ] = def[champ];
    }
    return sortie;
  };
  return parcourir(valeur);
}

/**
 * `MIGRATIONS[n]` fait passer une sauvegarde de n − 1 à n.
 * Exemple pour une future version 7 :
 *
 *   7: {
 *     mine: (d) => ({ ...d, talents: { ...d.talents, patience: 0 } }),
 *   },
 */
/** Schéma 9 : l'ancien réglage du son (booléen ou absent) en objet. */
export function sonV9(ancien) {
  if (ancien && typeof ancien === "object") return lireSon(ancien);
  return { ...SON_DEFAUT, coupe: ancien === false };
}

export const MIGRATIONS = {
  7: {
    jeu: (d) => renumeroter(d, RENUMEROTATION_TROUPE.ids),
    mine: (d) => renumeroter(d, RENUMEROTATION_TROUPE.ids),
  },
  8: {
    jeu: (d) => renommerFullart(d),
    mine: (d) => renommerFullart(d),
  },
  // Le son : un booléen (`false` = coupé) devient un réglage, la coupure et
  // deux volumes en pourcentage (config/son.js). Un ancien « son coupé »
  // reste coupé ; les volumes prennent leurs valeurs par défaut.
  9: {
    jeu: (d) => ({ ...d, reglages: { ...(d.reglages || {}), son: sonV9(d.reglages?.son) } }),
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
