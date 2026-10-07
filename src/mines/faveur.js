/**
 * Mines de Kazim — la Faveur du Fossoyeur.
 *
 * L'arbre méta des Mines, sur le modèle de Cookie Clicker : les éclats gagnés
 * au total donnent toujours leurs dégâts (voir `mEclats`, `regles.js`), et ils
 * se dépensent en plus ici, contre des faveurs qui survivent à l'effondrement.
 * Dépenser un éclat ne retire rien : `eclatsDepenses` ne fait que compter ce
 * qui est déjà offert.
 *
 * Quatre branches, et dans chacune une faveur ne s'offre qu'après la
 * précédente. Les prix ont été calés par simulation (07/10/2026, voir
 * docs/conception/mines.md, « Combien d'éclats ») : à une heure par jour, la
 * première faveur tombe le premier soir et l'arbre se complète en cinq
 * semaines ; à vingt minutes, en trois mois.
 *
 * Ce fichier ne dépend pas de `regles.js` : c'est `regles.js` qui lit les
 * faveurs, pas l'inverse.
 */

export const BRANCHES = [
  {
    id: "heritage", nom: "Héritage",
    faveurs: [
      { id: "plans", nom: "Plans du chantier", desc: "Garde la pioche de fer et le fanal à l'effondrement.", cout: 3 },
      { id: "equipe", nom: "Équipe de départ", desc: "Chaque mine rouvre avec 10 porte-fanaux et 5 mineurs nains.", cout: 8 },
      { id: "memoire", nom: "Mémoire du contremaître", desc: "Vos talents restent placés d'une mine à l'autre.", cout: 20 },
      { id: "puits", nom: "Puits de reprise", desc: "Chaque mine rouvre à la troisième strate.", cout: 60 },
    ],
  },
  {
    id: "veille", nom: "Veille",
    faveurs: [
      { id: "lanterne", nom: "Lanterne veilleuse", desc: "En votre absence, l'équipe creuse à 50 % au lieu de 35 %.", cout: 5 },
      { id: "releve", nom: "Relève de nuit", desc: "L'équipe travaille jusqu'à 12 heures sans vous, au lieu de 8.", cout: 15 },
      { id: "contremaitre", nom: "Contremaître kobold", desc: "Absence à 65 %, jusqu'à 16 heures.", cout: 35 },
    ],
  },
  {
    id: "filon", nom: "Filon",
    faveurs: [
      { id: "filante", nom: "Étoile filante", desc: "Une étoile traverse parfois le filon : attrapez-la pour 15 secondes de frappes ×7.", cout: 6 },
      { id: "enchantee", nom: "Pioche enchantée", desc: "Deux frappes de plus chaque seconde, sans toucher la roche.", cout: 12 },
      { id: "oeil", nom: "Œil du sourcier", desc: "Un point de Fortune offert, à chaque mine.", cout: 18 },
      { id: "echoprofond", nom: "Écho profond", desc: "Les coups critiques frappent 2,5 fois plus fort qu'avant.", cout: 45 },
    ],
  },
  {
    id: "commandes", nom: "Commandes",
    faveurs: [
      { id: "quatrieme", nom: "Quatrième commande", desc: "Tafix apporte chaque jour une petite commande de plus.", cout: 30 },
    ],
  },
];

export const FAVEURS = BRANCHES.flatMap((b) =>
  b.faveurs.map((f, i) => ({ ...f, branche: b.id, rang: i, avant: i > 0 ? b.faveurs[i - 1].id : null }))
);
export const FAVEUR_PAR_ID = Object.fromEntries(FAVEURS.map((f) => [f.id, f]));
export const COUT_ARBRE = FAVEURS.reduce((a, f) => a + f.cout, 0);

export const aFaveur = (S, id) => Array.isArray(S.faveurs) && S.faveurs.indexOf(id) !== -1;
/** Éclats qu'on peut encore offrir. */
export const eclatsLibres = (S) => Math.max(0, (S.eclats || 0) - (S.eclatsDepenses || 0));
/** La faveur précédente de sa branche est acquise. */
export const faveurOuverte = (S, id) => {
  const f = FAVEUR_PAR_ID[id];
  return !!f && (!f.avant || aFaveur(S, f.avant));
};
export const faveurAbordable = (S, id) =>
  !aFaveur(S, id) && faveurOuverte(S, id) && eclatsLibres(S) >= FAVEUR_PAR_ID[id].cout;
/** Y a-t-il quelque chose à offrir maintenant ? (le point ambre du bouton) */
export const faveurAOffrir = (S) => FAVEURS.some((f) => faveurAbordable(S, f.id));

/** Offre des éclats au Fossoyeur. Rend `true` si la faveur est acquise. */
export function offrir(S, id) {
  if (!faveurAbordable(S, id)) return false;
  S.eclatsDepenses = (S.eclatsDepenses || 0) + FAVEUR_PAR_ID[id].cout;
  S.faveurs = [...(S.faveurs || []), id];
  return true;
}

/* ── Les effets, lus par regles.js ─────────────────────────────────────── */

/** Part du travail de l'équipe retenue pendant une absence. */
export const rendementAbsence = (S) =>
  aFaveur(S, "contremaitre") ? 0.65 : aFaveur(S, "lanterne") ? 0.5 : 0.35;
/** Au-delà, l'absence ne rapporte plus rien. */
export const absenceMax = (S) =>
  (aFaveur(S, "contremaitre") ? 16 : aFaveur(S, "releve") ? 12 : 8) * 3600000;
export const fortuneOfferte = (S) => (aFaveur(S, "oeil") ? 1 : 0);
/* L'Écho profond s'ajoute à la lentille de quartz au lieu de la remplacer :
   sinon le joueur qui l'avait déjà ne gagnait rien pour quarante-cinq éclats. */
export const multCritique = (S, lentille) =>
  (lentille ? 7.5 : 5) + (aFaveur(S, "echoprofond") ? 2.5 : 0);
/** Frappes automatiques par seconde (Pioche enchantée). */
export const frappesAuto = (S) => (aFaveur(S, "enchantee") ? 2 : 0);
export const etoileFilante = (S) => aFaveur(S, "filante");
export const petitesCommandes = (S) => (aFaveur(S, "quatrieme") ? 2 : 1);
