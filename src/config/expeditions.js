/**
 * Les Expéditions : réglages.
 *
 * Une expédition emmène beaucoup de cartes et rapporte peu par carte. C'est le
 * travail du banc, pendant que le joueur fait autre chose : il n'y a rien à
 * jouer, seulement à envoyer et à accueillir. Le rendement est donc volontairement
 * bas, et borné par un plafond d'or quotidien commun à toutes les expéditions.
 *
 * Tout se mesure en « effort » : la somme des puissances des compagnons,
 * multipliée par les heures de route, le rendement de la durée et le
 * multiplicateur du Lieu. Voir docs/conception/expeditions-et-reliquaire.md
 * et docs/audit-expeditions-reliquaire.md pour les mesures.
 */
export const EXPEDITION = {
  simultanees: 3,
  // Places de départ par palier du Lieu, puis une de plus tous les 20 niveaux.
  capacite: { commun: 6, peucommun: 8, rare: 10, legendaire: 12 },
  placeTousLesNiveaux: 20,
  placesBonusMax: 5,
  // Rendement horaire : partir longtemps coûte un peu, revenir souvent rapporte un peu.
  durees: { 4: 1.0, 12: 0.9, 24: 0.8 },
  lieu: { commun: 1.0, peucommun: 1.1, rare: 1.2, legendaire: 1.35 },
  bonusNiveauLieu: 0.005, // +0,5 % par niveau du Lieu, soit ×1,5 au niveau 100
  puissance: { commun: 1, peucommun: 1.5, rare: 2.2, legendaire: 3 },
  // Carte dont la faction est la province du Lieu.
  affinite: 1.2,
  or: { parEffort: 0.1, plafondJour: 100 },
  vestiges: { parEffort: 0.05 },
  // L'expérience est la même pour tous les compagnons, quelle que soit leur rareté.
  xpCarte: { parHeure: 0.5 },
  // Multipliée par (0,5 + 0,5 × remplissage) : une équipe incomplète fait moins progresser le Lieu.
  xpLieu: { parHeure: 2 },
  // Une carte trouvée toutes les 12 heures de route, jamais légendaire.
  trouvailles: { toutesLes: 12, poids: { commun: 70, peucommun: 25, rare: 5 } },
};
