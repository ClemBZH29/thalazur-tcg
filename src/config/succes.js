/**
 * Le barème des succès : ce que l'on mesure, à quels paliers, et ce que
 * chaque palier rapporte.
 *
 * Deux catégories, comme les joueurs les lisent :
 *
 * - **Global** : ce que l'on fait sur tout le site, toutes extensions et
 *   tous modules confondus (boosters ouverts, Mines, Comptoir, colporteur,
 *   Donjon, Expéditions, Reliquaire, expérience des cartes).
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
 * Barème refait le 07/10/2026 sur le retour bêta, à la manière des TCG en
 * ligne (Hearthstone, Pokémon TCG Pocket, Marvel Snap) : les premiers paliers
 * accueillent sans payer une semaine d'avance — un bêta-testeur avait touché
 * l'équivalent de 33 boosters dans sa première heure —, la récompense grossit
 * avec la difficulté du palier, les sachets vont aux paliers durs et les PO
 * aux premiers, et la collection se mesure en part de l'extension. Le
 * raisonnement est dans docs/conception/succes-et-classement.md.
 *
 * Les titres sont provisoires : ce sont des noms de travail, à remplacer par
 * ceux de la campagne. Un titre se gagne en réclamant le palier qui le porte.
 */

/** Clé des sachets au choix dans `etat.sachets`. */
export const SACHET_LIBRE = "*";

/**
 * Les chapitres du grimoire : un par module du site, dans l'ordre où le
 * joueur les découvre. Les familles de collection forment un chapitre par
 * extension ouverte, après ceux-ci.
 */
export const CHAPITRES = [
  { id: "boutique", nom: "La Boutique", quoi: "Les boosters, et les héros eux-mêmes" },
  { id: "mines", nom: "Les Mines de Kazim", quoi: "La descente, les effondrements, Tafix et le Fossoyeur" },
  { id: "donjon", nom: "Le Donjon", quoi: "Les gardiens, le donjon du jour et l'infini" },
  { id: "routes", nom: "Les Routes", quoi: "Les expéditions et les Lieux qu'elles font briller" },
  { id: "negoce", nom: "Le Négoce", quoi: "Le Comptoir et les affaires de Mirko" },
  { id: "reliquaire", nom: "Le Reliquaire", quoi: "Les cendres et la forge" },
  { id: "missions", nom: "Les Missions", quoi: "Les commandes de Bodégué" },
  { id: "cartes", nom: "Les Cartes", quoi: "L'expérience gagnée au Donjon et sur les routes" },
];

/**
 * Les familles globales, par chapitre. `mesure` est un champ de
 * `mesuresGlobales()`. Un palier `cache` ne montre ni son seuil ni sa
 * récompense tant qu'il n'est pas atteint : ce sont les exploits, à
 * découvrir plutôt qu'à viser.
 *
 * Barème refait le 09/10/2026 (`claude/audit-succes.md` dans le projet) :
 * l'ancien se vidait en un mois pour un joueur régulier — 58 paliers sur 80
 * —, et ne lui laissait presque rien à poursuivre ensuite. Chaque famille a
 * désormais une queue qui court sur six mois à un an, les premiers paliers
 * paient en PO et chaque module a son chapitre.
 */
export const GLOBAL = [
  /* ── La Boutique ─────────────────────────────────────────────────────── */
  {
    id: "boosters", chapitre: "boutique",
    nom: "Déchireur de boosters",
    quoi: "Ouvrir {n} boosters, toutes extensions confondues",
    mesure: "boosters",
    paliers: [
      { seuil: 25, recompense: { po: 60 } },
      { seuil: 100, recompense: { sachets: 1 }, titre: "Habitué de la boutique" },
      { seuil: 300, recompense: { sachets: 3 } },
      { seuil: 1000, recompense: { sachets: 8 }, titre: "Déchireur de boosters" },
      { seuil: 2500, recompense: { sachets: 15 }, titre: "Insatiable" },
    ],
  },
  {
    id: "pj", chapitre: "boutique",
    nom: "Les héros eux-mêmes",
    quoi: "Obtenir {n} carte{s} PJ",
    mesure: "pj",
    /** Le dernier palier est « tous les PJ » : il suit `PJ` (speciales.js). */
    tous: "Obtenir toutes les cartes PJ",
    paliers: [
      { seuil: 1, recompense: { sachets: 3 }, titre: "Reconnu par les héros", cache: true },
      { seuil: 3, recompense: { sachets: 6 }, cache: true },
      { seuil: "tous", recompense: { sachets: 15 }, titre: "Compagnon de la Troupe", cache: true },
    ],
  },

  /* ── Les Mines de Kazim ──────────────────────────────────────────────── */
  {
    id: "strate", chapitre: "mines",
    nom: "Plus profond",
    quoi: "Atteindre la strate {n} des Mines de Kazim",
    mesure: "strate",
    /**
     * La pente des strates plafonne vers la quinzième (`audit-strates.mjs` :
     * 15 à deux mois, quel que soit le temps de jeu). L'ancien palier 16 ne
     * s'atteignait pas.
     */
    paliers: [
      { seuil: 5, recompense: { po: 60 } },
      { seuil: 8, recompense: { po: 120 }, titre: "Descendu à l'Abîme" },
      { seuil: 11, recompense: { sachets: 1 } },
      { seuil: 13, recompense: { sachets: 1 }, titre: "Ami des kobolds" },
      { seuil: 15, recompense: { sachets: 5 }, titre: "Au cœur de Kazim" },
    ],
  },
  {
    id: "effondrements", chapitre: "mines",
    nom: "Tout reprendre à zéro",
    quoi: "Provoquer {n} effondrement{s} dans les Mines",
    mesure: "effondrements",
    paliers: [
      { seuil: 1, recompense: { po: 60 } },
      { seuil: 10, recompense: { sachets: 1 } },
      { seuil: 30, recompense: { sachets: 2 }, titre: "Fossoyeur de galeries" },
      { seuil: 75, recompense: { sachets: 4 } },
      { seuil: 150, recompense: { sachets: 8 } },
    ],
  },
  {
    id: "commandes", chapitre: "mines",
    nom: "Les commandes de Tafix",
    quoi: "Livrer {n} commande{s} à Tafix",
    mesure: "commandes",
    paliers: [
      { seuil: 10, recompense: { po: 60 } },
      { seuil: 50, recompense: { sachets: 1 } },
      { seuil: 200, recompense: { sachets: 3 }, titre: "Fournisseur de Tafix" },
      { seuil: 500, recompense: { sachets: 6 } },
    ],
  },
  {
    id: "faveurs", chapitre: "mines",
    nom: "La Faveur du Fossoyeur",
    quoi: "Recevoir {n} faveur{s} du Fossoyeur",
    mesure: "faveurs",
    /** Le dernier palier suit l'arbre (`FAVEURS`, src/mines/faveur.js). */
    tous: "Recevoir toutes les faveurs du Fossoyeur",
    paliers: [
      { seuil: 1, recompense: { po: 60 } },
      { seuil: 6, recompense: { sachets: 2 } },
      { seuil: "tous", recompense: { sachets: 4 }, titre: "Élu du Fossoyeur" },
    ],
  },

  /* ── Le Donjon ───────────────────────────────────────────────────────── */
  {
    id: "gardiens", chapitre: "donjon",
    nom: "Les gardiens",
    quoi: "Vaincre {n} gardien{s} du Donjon",
    mesure: "gardiens",
    paliers: [
      { seuil: 1, recompense: { po: 30 } },
      { seuil: 10, recompense: { po: 120 } },
      { seuil: 50, recompense: { sachets: 2 }, titre: "Pourfendeur de gardiens" },
      { seuil: 150, recompense: { sachets: 4 } },
      { seuil: 400, recompense: { sachets: 8 }, titre: "Fléau des profondeurs" },
    ],
  },
  {
    id: "remontees", chapitre: "donjon",
    nom: "Revenir d'en bas",
    quoi: "Mener {n} fois le donjon du jour à son terme",
    mesure: "remontees",
    paliers: [
      { seuil: 1, recompense: { sachets: 1 }, titre: "Revenu du Donjon" },
      { seuil: 10, recompense: { sachets: 2 } },
      { seuil: 30, recompense: { sachets: 4 } },
      { seuil: 100, recompense: { sachets: 8 }, titre: "Maître du donjon du jour" },
    ],
  },
  {
    id: "infini", chapitre: "donjon",
    nom: "Sans fond",
    quoi: "Vaincre {n} gardiens en une seule descente du donjon infini",
    mesure: "recordInfini",
    /**
     * Le record, pas un cumul : c'est le seul succès qui mesure la force de
     * l'équipe. Médianes du 06/10/2026 : 2 gardiens pour un débutant, 3 pour
     * une collection moyenne, 5 avancée, 9 pour quatre légendaires niveau 100 ;
     * le meilleur de 800 descentes en a vaincu quatorze.
     */
    paliers: [
      { seuil: 3, recompense: { po: 60 } },
      { seuil: 5, recompense: { sachets: 1 } },
      { seuil: 8, recompense: { sachets: 3 }, titre: "Sans fond" },
      { seuil: 12, recompense: { sachets: 6 }, titre: "Abyssal", cache: true },
    ],
  },

  /* ── Les Routes ──────────────────────────────────────────────────────── */
  {
    id: "expeditions", chapitre: "routes",
    nom: "Sur les routes",
    quoi: "Accueillir {n} expédition{s}",
    mesure: "expeditions",
    paliers: [
      { seuil: 1, recompense: { po: 30 } },
      { seuil: 25, recompense: { po: 120 } },
      { seuil: 100, recompense: { sachets: 2 }, titre: "Maître des routes" },
      { seuil: 300, recompense: { sachets: 4 } },
      { seuil: 750, recompense: { sachets: 8 } },
    ],
  },
  {
    id: "lieux-rainbow", chapitre: "routes",
    nom: "Des lieux qui brillent",
    quoi: "Faire passer en rainbow {n} carte{s} Lieu par les expéditions",
    mesure: "lieuxRainbow",
    paliers: [
      { seuil: 1, recompense: { sachets: 1 } },
      { seuil: 5, recompense: { sachets: 2 }, titre: "Arpenteur de Thalazur" },
      { seuil: 15, recompense: { sachets: 4 } },
      { seuil: 30, recompense: { sachets: 8 } },
    ],
  },

  /* ── Le Négoce ───────────────────────────────────────────────────────── */
  {
    id: "ventes", chapitre: "negoce",
    nom: "Au Comptoir",
    quoi: "Vendre {n} exemplaire{s} au Comptoir",
    mesure: "ventes",
    paliers: [
      { seuil: 10, recompense: { po: 30 } },
      { seuil: 100, recompense: { po: 120 } },
      { seuil: 500, recompense: { sachets: 2 }, titre: "Habitué du Comptoir" },
      { seuil: 1500, recompense: { sachets: 4 } },
      { seuil: 4000, recompense: { sachets: 8 }, titre: "Marchand de Thalazur" },
    ],
  },
  {
    id: "achats", chapitre: "negoce",
    nom: "Fin connaisseur",
    quoi: "Acheter {n} carte{s} au Comptoir",
    mesure: "achats",
    paliers: [
      { seuil: 1, recompense: { po: 30 } },
      { seuil: 10, recompense: { po: 120 } },
      { seuil: 50, recompense: { sachets: 2 }, titre: "Fin connaisseur" },
    ],
  },
  {
    id: "affaires", chapitre: "negoce",
    nom: "Les affaires de Mirko",
    quoi: "Conclure {n} affaire{s} avec le colporteur",
    mesure: "affaires",
    paliers: [
      { seuil: 1, recompense: { po: 30 } },
      { seuil: 10, recompense: { po: 120 } },
      { seuil: 30, recompense: { sachets: 2 }, titre: "Compère de Mirko" },
      { seuil: 100, recompense: { sachets: 5 } },
    ],
  },

  /* ── Le Reliquaire ───────────────────────────────────────────────────── */
  {
    id: "dissous", chapitre: "reliquaire",
    nom: "Cendres et vestiges",
    quoi: "Dissoudre {n} exemplaire{s} au Reliquaire",
    mesure: "dissous",
    paliers: [
      { seuil: 50, recompense: { po: 30 } },
      { seuil: 250, recompense: { po: 120 } },
      { seuil: 1000, recompense: { sachets: 2 }, titre: "Gardien des cendres" },
      { seuil: 3000, recompense: { sachets: 5 } },
    ],
  },
  {
    id: "forges", chapitre: "reliquaire",
    nom: "La forge du Reliquaire",
    quoi: "Forger {n} carte{s} au Reliquaire",
    mesure: "forges",
    paliers: [
      { seuil: 1, recompense: { po: 30 } },
      { seuil: 10, recompense: { po: 120 } },
      { seuil: 30, recompense: { sachets: 2 }, titre: "Artisan du Reliquaire" },
      { seuil: 100, recompense: { sachets: 4 } },
      { seuil: 250, recompense: { sachets: 8 } },
    ],
  },

  /* ── Les Missions ────────────────────────────────────────────────────── */
  {
    id: "missions", chapitre: "missions",
    nom: "Au service de Bodégué",
    quoi: "Accomplir {n} mission{s} du jour",
    mesure: "missions",
    paliers: [
      { seuil: 10, recompense: { po: 60 } },
      { seuil: 50, recompense: { sachets: 1 } },
      { seuil: 150, recompense: { sachets: 2 }, titre: "Commis de Bodégué" },
      { seuil: 500, recompense: { sachets: 5 } },
      { seuil: 1000, recompense: { sachets: 10 } },
    ],
  },
  {
    id: "semaines", chapitre: "missions",
    nom: "La grande commande",
    quoi: "Accomplir {n} mission{s} de la semaine",
    mesure: "semaines",
    paliers: [
      { seuil: 4, recompense: { sachets: 1 } },
      { seuil: 12, recompense: { sachets: 2 } },
      { seuil: 26, recompense: { sachets: 4 }, titre: "Bras droit de Bodégué" },
      { seuil: 52, recompense: { sachets: 8 } },
    ],
  },

  /* ── Les Cartes ──────────────────────────────────────────────────────── */
  {
    id: "niveau", chapitre: "cartes",
    nom: "Aguerri",
    quoi: "Mener une carte au niveau {n}",
    mesure: "niveauMax",
    paliers: [
      { seuil: 10, recompense: { po: 30 } },
      { seuil: 25, recompense: { po: 60 } },
      { seuil: 50, recompense: { sachets: 2 }, titre: "Vétéran" },
      { seuil: 100, recompense: { sachets: 5 }, titre: "Légende vivante" },
    ],
  },
  {
    id: "rainbow-xp", chapitre: "cartes",
    nom: "Trempé dans l'épreuve",
    quoi: "Atteindre le palier rainbow de {n} carte{s} par l'expérience",
    mesure: "rainbowXP",
    paliers: [
      { seuil: 1, recompense: { po: 60 } },
      { seuil: 5, recompense: { sachets: 1 } },
      { seuil: 15, recompense: { sachets: 2 }, titre: "Forgé par l'épreuve" },
      { seuil: 40, recompense: { sachets: 4 } },
      { seuil: 100, recompense: { sachets: 8 } },
    ],
  },
  {
    id: "centenaires", chapitre: "cartes",
    nom: "Centenaires",
    quoi: "Mener {n} carte{s} au niveau 100",
    mesure: "centenaires",
    paliers: [
      { seuil: 1, recompense: { sachets: 2 }, titre: "Mentor" },
      { seuil: 5, recompense: { sachets: 5 } },
      { seuil: 15, recompense: { sachets: 10 }, titre: "Grand maître" },
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
      { seuil: 25, recompense: { po: 120 } },
      { seuil: 50, recompense: { sachets: 1 } },
      { seuil: 75, recompense: { sachets: 3 } },
      { seuil: 90, recompense: { sachets: 6, po: 240 } },
      { seuil: 100, recompense: { sachets: 12, po: 600 }, titre: "Archiviste de {ext}" },
    ],
  },
  /**
   * Par type de carte, en part du type et non en nombre de cartes : 25, 50
   * et 75 %, puis « tous ». En nombre fixe (5, 10, 25, 50, 100), les PNJ
   * — trois quarts du roster — tombaient quatre paliers dans la première
   * heure ; une extension de quarante cartes n'en aurait eu que deux. Le
   * palier de 10 % est parti le 09/10/2026 : il tombait au premier booster.
   */
  type: {
    parts: [0.25, 0.5, 0.75],
    recompenses: [{ po: 30 }, { po: 120 }, { sachets: 1 }],
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
    recompenses: [{ po: 60 }, { sachets: 2 }, { sachets: 5 }],
    titre: "Chasseur de légendes de {ext}",
  },
  /**
   * Les rainbow de l'extension. Les premiers paliers en nombre, les deux
   * derniers en part du roster : la moitié, puis le set rainbow complet — le
   * « master set » des TCG, l'affaire d'une année et plus.
   */
  irisees: {
    nom: "Rainbow",
    quoi: "Posséder {n} carte{s} rainbow de {ext}",
    paliers: [
      { seuil: 1, recompense: { po: 30 } },
      { seuil: 10, recompense: { po: 60 } },
      { seuil: 25, recompense: { sachets: 2 } },
      { seuil: 50, recompense: { sachets: 4 } },
    ],
    moitie: { recompense: { sachets: 8 }, titre: "Chasseur de rainbow de {ext}", quoi: "la moitié de {ext} en rainbow" },
    tout: { recompense: { sachets: 20 }, titre: "Maître de {ext}", quoi: "tout {ext} en rainbow" },
  },
  /** Une full art tombe une fois sur 4 096 boosters : la première est un exploit, toutes une légende. */
  fullart: {
    nom: "Pleine illustration",
    quoi: "Obtenir {n} carte{s} pleine illustration de {ext}",
    paliers: [{ seuil: 1, recompense: { sachets: 2 }, titre: "Pleine lumière sur {ext}", cache: true }],
    toutes: { recompense: { sachets: 12 }, titre: "Galerie de {ext}", quoi: "toutes les pleines illustrations de {ext}", cache: true },
  },
  /**
   * Les provinces : toutes les cartes d'une région de Thalazur (PNJ de sa
   * faction, Lieux de sa province, artéfacts qui en viennent). Les mêmes
   * regroupements que Gaspard au Comptoir, plus la Troupe et le Bestiaire.
   * Une province de moins de huit cartes dans l'extension n'a pas de famille.
   * Un seul palier, « toutes » : la moitié tombait la première semaine avec
   * le reste de la collection.
   */
  provinces: {
    min: 8,
    toutes: { recompense: { sachets: 1 } },
    liste: [
      { id: "troupe", nom: "La Troupe", factions: ["troupe", "aventurier", "grc"], titre: "Ami de la Troupe" },
      { id: "nakova", nom: "Nakova", factions: ["nakova"], titre: "Familier de Nakova" },
      { id: "pronolo", nom: "Pronolo", factions: ["pronolo"], titre: "Familier de Pronolo" },
      { id: "saab", nom: "Säab et la Caravane", factions: ["saab", "caravane"], titre: "Familier de Säab" },
      { id: "cornalie", nom: "Cornalie", factions: ["cornalie"], titre: "Familier de Cornalie" },
      { id: "odiana", nom: "Odiana, Éléon et Inarva", factions: ["odiana", "eleon", "inarva"], titre: "Familier d'Odiana" },
      { id: "bestiaire", nom: "Le Bestiaire", factions: ["bestiaire"], titre: "Dompteur du Bestiaire" },
    ],
  },
};

/**
 * Poids d'une carte dans le score du classement, par palier : une légendaire
 * compte huit communes. Sans pondération, le score serait celui de qui a le
 * plus de communes, c'est-à-dire de qui a ouvert le plus de sachets.
 */
export const POIDS_SCORE = { commun: 1, peucommun: 2, rare: 4, legendaire: 8 };

/**
 * Les points de renommée d'un palier : dix par booster d'équivalent qu'il
 * rapporte (120 PO valent un booster), cinq au moins. La récompense grossit
 * déjà avec la difficulté : les points suivent sans second barème à tenir.
 */
export const pointsDe = (r = {}) => Math.max(5, Math.round(((r.sachets || 0) + (r.po || 0) / 120) * 10));

/**
 * Les titres de paliers retirés du barème, gagnés avant leur retrait : un
 * joueur qui les a réclamés les garde, et peut continuer de les afficher.
 */
export const TITRES_ANCIENS = {
  "effondrements@20": "Fossoyeur de galeries",
  "ventes@200": "Habitué du Comptoir",
  "gardiens@15": "Pourfendeur de gardiens",
  "expeditions@50": "Maître des routes",
  "dissous@500": "Gardien des cendres",
  "strate@16": "Ami des kobolds",
};
