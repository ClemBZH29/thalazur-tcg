/**
 * Les paliers de rareté. Le cadre étant
 * un asset unique, la rareté se lit à la teinte appliquée sur ses traits —
 * le PNG sert de masque, le portrait n'est jamais recoloré.
 *
 * `tele` = durée de la lueur annonciatrice avant le retournement (ms).
 * `flip` = durée du retournement (ms). Un légendaire tourne lentement :
 *          le tempo est lui-même une information.
 */
export const TIERS = [
  { id: "commun",     nom: "Commun",     encoches: 1, lueur: "#8fb8d8", teinte: null,      teinteA: 0,    tele: 150, flip: 430, motes: 0,  ombre: 0 },
  { id: "peucommun",  nom: "Peu commun", encoches: 2, lueur: "#4e8c7e", teinte: "#3f9c86", teinteA: 0.5,  tele: 230, flip: 470, motes: 8,  ombre: 0 },
  { id: "rare",       nom: "Rare",       encoches: 3, lueur: "#d19a3c", teinte: "#d19a3c", teinteA: 0.68, tele: 470, flip: 640, motes: 16, ombre: 0.24 },
  { id: "legendaire", nom: "Légendaire", encoches: 4, lueur: "#b33049", teinte: "#b33049", teinteA: 0.7,  tele: 820, flip: 840, motes: 28, ombre: 0.56 },

  // Hors roster, hors tables d'emplacement : tirées pour le booster entier.
  // Elles portent le cadre pleine illustration et n'affichent aucun texte.
  { id: "fullart",    nom: "Full art", encoches: 0, lueur: "#b33049", teinte: "#b33049", teinteA: 0.74, tele: 1700, flip: 1000, motes: 42, ombre: 0.72, pleine: true },
  { id: "pj",         nom: "Carte PJ", encoches: 0, lueur: "#e3ecf4", teinte: null,      teinteA: 0,    tele: 2300, flip: 1250, motes: 58, ombre: 0.84, pleine: true, noir: true },
];

export const TIER_ORDER = TIERS.map((t) => t.id);

/** Les paliers issus du roster, par opposition aux cartes hors roster. */
export const TIERS_ROSTER = TIERS.filter((t) => !t.pleine);
export const TIER_INFO = Object.fromEntries(TIERS.map((t) => [t.id, t]));

/**
 * Structure d'emplacements. Chaque position a sa propre table : c'est ce qui
 * produit la montée. Les trois premières cartes sont un plancher garanti,
 * le quatrième est légèrement enrichi, le cinquième nettement.
 *
 * Calibrage aligné sur Hearthstone : environ 28 % de chances d'un rare ou
 * mieux par booster, et un légendaire tous les dix-neuf boosters.
 */
export const SLOTS = [
  { commun: 1 },
  { commun: 1 },
  { commun: 1 },
  { peucommun: 0.955, rare: 0.038, legendaire: 0.007 },
  { peucommun: 0.755, rare: 0.2, legendaire: 0.045 },
];

/** Booster exceptionnel : les cinq emplacements passent en Rare ou mieux. */
export const TABLE_APPEL = { rare: 0.7, legendaire: 0.3 };

/**
 * `rainbow` est une surcouche indépendante du palier, tirée par carte.
 * `fullart` et `pj` sont des tirages du booster entier, pas de l'emplacement.
 */
export const TAUX_DEFAUT = {
  rainbow: 0.03,
  appel: 0.006,
  fullart: 1 / 4096,
  pj: 1 / 8192,
};

/**
 * Filets de sécurité, sur le modèle de Hearthstone. Sans eux, quatre visiteurs
 * sur cinq découvriraient le site sans jamais croiser le palier qui justifie
 * tout le dispositif.
 */
export const GARANTIES = {
  premierLegendaire: 8, // légendaire garanti dans les huit premiers boosters
  intervalle: 25,       // puis un légendaire forcé tous les vingt-cinq
};

/** Revente automatique des doublons, en pièces d'or. */
export const REVENTE = { commun: 2, peucommun: 5, rare: 15, legendaire: 50, fullart: 250, pj: 600 };

/**
 * Économie. Le point fixe : un booster contient en moyenne 3 communs,
 * 1,71 peu commun, 0,24 rare et 0,052 légendaire, soit 20,7 PO de revente
 * quand la collection est avancée — un coût net de 99 PO, donc 3,6 boosters
 * par jour. Au démarrage rien n'est doublon, le rythme réel part de 3,0 et
 * monte vers 3,6 à mesure que le roster se remplit.
 */
export const ECONOMIE = {
  depart: 600,
  prix: 120,
  parHeure: 15,
  plafond: 720, // 48 h d'accumulation : on peut sauter un jour sans rien perdre
};

/*
 * Les Mines de Kazim n'ont plus de conversion ici (07/10/2026) : elles
 * vendaient leur étoile aux kobolds, et l'application convertissait ×15 avec
 * un plafond de 480 PO par jour. Les commandes de Tafix paient désormais en
 * PO du site, à prix fixe — voir `COMMANDES` dans src/mines/donnees.js.
 */

/**
 * Le Donjon, vues de l'application. Le module annonce le butin rapporté du
 * donjon, la conversion se fait ici.
 *
 * Deux modes (`modes`) :
 *
 * - **le donjon du jour**, une descente par jour, la même carte pour tous, une
 *   composition et une source imposées (06/10/2026). Imposée, l'équipe est
 *   moins forte que celle qu'on aurait choisie (butin −20 % pour une
 *   collection moyenne, presque −50 % pour un débutant) : le butin y compte
 *   ×2,5 au lieu de ×2 ;
 * - **le donjon infini** (06/10/2026) : 100 PO l'entrée, ni fuite ni
 *   remontée, l'équipe va jusqu'à la chute et rapporte tout le sac, sans
 *   plafond. Le sac croît plus vite que l'étage : il est converti en PO par
 *   une courbe concave (`conversion`), qui laisse le débutant à peu près
 *   rentrer dans ses frais et paie une équipe forte trois à quatre fois
 *   plus. La chute immobilise l'équipe un jour : c'est elle qui borne le
 *   nombre de descentes.
 *
 * Mesures : `node scripts/audit-donjon.mjs` et docs/conception/donjon.md.
 */
export const DONJON = {
  multiplicateur: 0.6,   // PO créditées par pièce de butin rapportée (donjon du jour)
  modes: {
    jour: { tentatives: 1, gain: 2.5, xp: 1 },
    infini: { tentatives: Infinity, gain: 1, xp: 0.5, entree: 100, conversion: { coef: 1.1, expo: 0.7 } },
  },
  // Les débuts adoucis : adversaires affaiblis et butin réduit, qui remontent
  // en ligne droite jusqu'au jeu normal à la `jusqua`-ième descente jouée.
  // Indexé sur les boosters, l'apprentissage disparaissait avant la première
  // descente : un bêta-testeur en avait ouvert quarante dans sa première
  // heure (retour du 06/10/2026). Mesuré par scripts/audit-donjon.mjs.
  apprentissage: { jusqua: 5, difficulte: 0.75, gain: 0.4 },
};

/** Les PO que vaut un sac rapporté du Donjon, selon le mode. */
export function poDuButin(butin, mode = "jour") {
  if (butin <= 0) return 0;
  const k = DONJON.modes[mode]?.conversion;
  return Math.round(k ? k.coef * Math.pow(butin, k.expo) : butin * DONJON.multiplicateur);
}
