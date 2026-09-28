/**
 * Le barème des succès : ce que l'on mesure, à quels paliers, et ce que
 * chaque palier rapporte.
 *
 * Deux catégories, comme les joueurs les lisent :
 *
 * - **Global** : ce que l'on fait sur tout le site, toutes extensions et
 *   tous modules confondus (boosters ouverts, Mines, Comptoir, colporteur).
 * - **Collection** : ce que l'on possède dans une extension. Ces familles
 *   sont construites à partir du roster de chaque extension ouverte (voir
 *   `src/succes/regles.js`) : une extension qui ouvre apporte les siennes
 *   sans qu'on touche à ce fichier.
 *
 * Dans les libellés, `{n}` est le seuil et `{s}` la marque du pluriel,
 * posée seulement au-delà de un.
 *
 * Une récompense est `{ po }`, `{ sachets }` (des sachets offerts) ou les
 * deux. Un sachet offert en Global est un **sachet au choix**, à ouvrir dans
 * n'importe quelle extension ; en Collection, c'est un sachet de l'extension
 * concernée — il rapproche de la complétion, et ses doublons nourrissent le
 * Comptoir.
 *
 * La règle qui tient l'économie : chaque palier rend moins que ce qu'il a
 * coûté pour l'atteindre, et de moins en moins à mesure qu'on monte. La
 * boucle « un booster offert compte vers le palier suivant » s'éteint donc
 * d'elle-même. `node scripts/audit-succes.mjs` le vérifie ; le relancer après
 * toute retouche de ce fichier.
 *
 * Les titres sont provisoires : ce sont des noms de travail, à remplacer par
 * ceux de la campagne. Un titre se gagne en réclamant le palier qui le porte.
 */

/** Clé des sachets au choix dans `etat.sachets`. */
export const SACHET_LIBRE = "*";

/** Les familles globales. `mesure` est un champ de `mesuresGlobales()`. */
export const GLOBAL = [
  {
    id: "boosters",
    nom: "Déchireur de sachets",
    quoi: "Ouvrir {n} boosters, toutes extensions confondues",
    mesure: "boosters",
    paliers: [
      { seuil: 10, recompense: { sachets: 1 } },
      { seuil: 30, recompense: { sachets: 2 } },
      { seuil: 100, recompense: { sachets: 5 }, titre: "Habitué de la boutique" },
      { seuil: 300, recompense: { sachets: 10 } },
      { seuil: 1000, recompense: { sachets: 25 }, titre: "Déchireur de sachets" },
    ],
  },
  {
    id: "strate",
    nom: "Plus profond",
    quoi: "Atteindre la strate {n} des Mines de Kazim",
    mesure: "strate",
    paliers: [
      { seuil: 3, recompense: { po: 120 } },
      { seuil: 5, recompense: { po: 240 } },
      { seuil: 8, recompense: { po: 480 }, titre: "Descendu à l'Abîme" },
      { seuil: 12, recompense: { po: 720 } },
      { seuil: 20, recompense: { sachets: 10 }, titre: "Ami des kobolds" },
    ],
  },
  {
    id: "effondrements",
    nom: "Tout reprendre à zéro",
    quoi: "Provoquer {n} effondrement{s} dans les Mines",
    mesure: "effondrements",
    paliers: [
      { seuil: 1, recompense: { po: 120 } },
      { seuil: 5, recompense: { po: 360 } },
      { seuil: 20, recompense: { sachets: 5 }, titre: "Fossoyeur de galeries" },
      { seuil: 50, recompense: { sachets: 10 } },
    ],
  },
  {
    id: "ventes",
    nom: "Au Comptoir",
    quoi: "Vendre {n} exemplaire{s} au Comptoir",
    mesure: "ventes",
    paliers: [
      { seuil: 10, recompense: { po: 60 } },
      { seuil: 50, recompense: { po: 180 } },
      { seuil: 200, recompense: { po: 480 }, titre: "Habitué du Comptoir" },
      { seuil: 500, recompense: { sachets: 5 } },
    ],
  },
  {
    id: "affaires",
    nom: "Les affaires de Mirko",
    quoi: "Conclure {n} affaire{s} avec le colporteur",
    mesure: "affaires",
    paliers: [
      { seuil: 1, recompense: { po: 60 } },
      { seuil: 10, recompense: { po: 240 } },
      { seuil: 30, recompense: { sachets: 3 }, titre: "Compère de Mirko" },
    ],
  },
  {
    id: "pj",
    nom: "Les héros eux-mêmes",
    quoi: "Obtenir {n} carte{s} PJ",
    mesure: "pj",
    paliers: [
      { seuil: 1, recompense: { sachets: 3 }, titre: "Reconnu par les héros" },
    ],
  },
];

/**
 * Les familles de collection, décrites une fois pour toutes les extensions.
 * `{ext}` est remplacé par le titre de l'extension.
 */
export const COLLECTION = {
  completion: {
    nom: "Complétion",
    quoi: "Compléter {n} % de {ext}",
    /** Les derniers pourcents coûtent le plus : la récompense grimpe en fin de course. */
    paliers: [
      { seuil: 25, recompense: { sachets: 1 } },
      { seuil: 50, recompense: { sachets: 2 } },
      { seuil: 75, recompense: { sachets: 3 } },
      { seuil: 90, recompense: { sachets: 5, po: 240 } },
      { seuil: 100, recompense: { sachets: 10, po: 600 }, titre: "Archiviste de {ext}" },
    ],
  },
  /**
   * Par type de carte. Les seuils au-delà du nombre de cartes du type sont
   * écartés, et le dernier palier est toujours « toutes ».
   */
  type: {
    seuils: [5, 10, 25, 50, 100],
    po: { 5: 60, 10: 120, 25: 240, 50: 360, 100: 480 },
    tous: { sachets: 3 },
    types: {
      pnj: { nom: "Rencontres", quoi: "Posséder {n} PNJ de {ext}", tous: "tous les PNJ de {ext}", titre: "Physionomiste de {ext}" },
      artefact: { nom: "Artéfacts", quoi: "Posséder {n} artéfacts de {ext}", tous: "tous les artéfacts de {ext}", titre: "Antiquaire de {ext}" },
      lieu: { nom: "Lieux", quoi: "Posséder {n} lieux de {ext}", tous: "tous les lieux de {ext}", titre: "Cartographe de {ext}" },
    },
  },
  legendaires: {
    nom: "Légendes",
    quoi: "Posséder {n} légendaire{s} de {ext}",
    /** Une, la moitié, toutes : les seuils suivent le roster. */
    recompenses: [{ po: 120 }, { sachets: 2 }, { sachets: 5 }],
    titre: "Chasseur de légendes de {ext}",
  },
  irisees: {
    nom: "Irisées",
    quoi: "Posséder {n} carte{s} irisée{s} de {ext}",
    paliers: [
      { seuil: 1, recompense: { po: 60 } },
      { seuil: 5, recompense: { po: 180 } },
      { seuil: 10, recompense: { sachets: 2 } },
      { seuil: 25, recompense: { sachets: 5 }, titre: "Irisé de {ext}" },
    ],
  },
  fullart: {
    nom: "Pleine illustration",
    quoi: "Obtenir {n} carte{s} pleine illustration de {ext}",
    paliers: [{ seuil: 1, recompense: { sachets: 2 }, titre: "Pleine lumière sur {ext}" }],
  },
};

/**
 * Poids d'une carte dans le score du classement, par palier : une légendaire
 * compte huit communes. Sans pondération, le score serait celui de qui a le
 * plus de communes, c'est-à-dire de qui a ouvert le plus de sachets.
 */
export const POIDS_SCORE = { commun: 1, peucommun: 2, rare: 4, legendaire: 8 };
