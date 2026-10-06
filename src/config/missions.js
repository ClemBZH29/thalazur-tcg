/**
 * Les missions de Bodégué : trois par jour, une par semaine.
 *
 * Les succès sont un stock — une fois les paliers faciles pris, ils ne
 * rapportent plus rien pendant des semaines. Les missions sont le flux qui
 * leur manquait, sur le modèle des quêtes du jour de Hearthstone, de
 * Pokémon TCG Pocket et de MTG Arena : chaque jour trois petites choses à
 * faire dans des modes différents, une plus longue sur la semaine, une
 * mission remplaçable par jour.
 *
 * Chaque type de mission compte un compteur de la partie qui ne recule pas
 * (`mesure`, voir `mesuresMissions`) : la progression est l'écart depuis le
 * moment où la mission a été confiée. `dispo` dit si le joueur peut la
 * remplir avec ce qu'il a : on ne confie pas « dissoudre au Reliquaire » à
 * qui ne l'a pas ouvert. `mode` sert au tirage : les trois missions du jour
 * viennent de trois modes différents.
 *
 * Calibrage (scripts/audit-missions.mjs) : de l'ordre de 115 PO par jour
 * pour les trois missions remplies, un booster de plus par jour, et deux
 * boosters au choix par semaine. Le gain passif seul en donne trois par jour.
 *
 * Dans les libellés, `{n}` est la cible et `{s}` la marque du pluriel.
 */

/** Nombre de missions du jour, et remplacements permis par jour. */
export const QUOTIDIENNES = 3;
export const REMPLACEMENTS = 1;

/**
 * Boosters qu'on peut ouvrir sur la période au seul gain passif (trois par
 * jour). Sert à juger si une mission de collection reste faisable : ce qu'un
 * booster apporte de cartes nouvelles baisse à mesure que la collection se
 * remplit.
 */
export const RYTHME = { jour: 3, semaine: 21 };

export const TYPES = [
  {
    id: "boosters", mode: "boutique", mesure: "boosters",
    quoi: "Ouvrir {n} booster{s}",
    jour: { n: 2, po: 30 }, semaine: { n: 15 },
  },
  {
    id: "nouvelles", mode: "boutique", mesure: "possedees",
    quoi: "Ajouter {n} carte{s} nouvelle{s} à votre collection",
    jour: { n: 2, po: 40 }, semaine: { n: 12 },
    // Faisable tant que les boosters de la période en apportent assez, en
    // espérance : vers 85 % de complétion, il manque surtout des rares et des
    // légendaires, et deux cartes nouvelles par jour deviennent un hasard.
    // Le type disparaît alors du tirage (07/10/2026).
    dispo: (c, { n, boosters }) => c.nouvellesParBooster * boosters >= n,
  },
  {
    id: "ventes", mode: "comptoir", mesure: "ventes",
    quoi: "Vendre {n} carte{s} au Comptoir",
    jour: { n: 5, po: 40 }, semaine: { n: 40 },
    dispo: (c) => c.surplus >= 10,
  },
  {
    id: "mine", mode: "mines", mesure: "poMine",
    quoi: "Rapporter {n} PO des Mines de Kazim",
    jour: { n: 60, po: 40 }, semaine: { n: 600 },
  },
  {
    id: "descentes", mode: "donjon", mesure: "descentes",
    quoi: "Descendre {n} fois au Donjon",
    jour: { n: 1, po: 40 }, semaine: { n: 5 },
    dispo: (c) => c.pnj >= 4,
  },
  {
    id: "gardiens", mode: "donjon", mesure: "gardiens",
    quoi: "Vaincre {n} gardien{s} du Donjon",
    jour: { n: 2, po: 50 }, semaine: { n: 10 },
    dispo: (c) => c.pnj >= 4 && c.descentes >= 3,
  },
  {
    id: "expeditions", mode: "expeditions", mesure: "expeditions",
    quoi: "Accueillir {n} expédition{s}",
    jour: { n: 1, po: 30 }, semaine: { n: 7 },
    dispo: (c) => c.lieux >= 1 && c.pnj >= 4,
  },
  {
    id: "dissous", mode: "reliquaire", mesure: "dissous",
    quoi: "Dissoudre {n} exemplaire{s} au Reliquaire",
    jour: { n: 10, po: 30 }, semaine: { n: 60 },
    dispo: (c) => c.reliquaire && c.surplus >= 15,
  },
  {
    id: "forges", mode: "reliquaire", mesure: "forges",
    quoi: "Forger {n} carte{s} au Reliquaire",
    semaine: { n: 3 },
    dispo: (c) => c.reliquaire,
  },
];

/** Ce que rapporte la mission de la semaine : des boosters au choix. */
export const RECOMPENSE_SEMAINE = { sachets: 2 };
