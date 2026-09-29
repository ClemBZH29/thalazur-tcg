/**
 * Le Reliquaire : réglages.
 *
 * Un vestige vaut à peu près une pièce d'or de rachat au Comptoir : dissoudre
 * un doublon ou le vendre se comparent. La forge coûte quatre dissolutions à
 * tous les paliers. Le détour (dissoudre puis forger, rapporté à vendre puis
 * racheter au Comptoir) rend environ trois quarts : le Reliquaire paie un peu
 * moins, mais il a toujours la carte que l'on cherche.
 *
 * Mesures et comparaison avec la V1 : docs/audit-expeditions-reliquaire.md,
 * `node scripts/audit-reliquaire.mjs`.
 */
export const RELIQUAIRE = {
  dissolution: { commun: 5, peucommun: 10, rare: 25, legendaire: 100 },
  forge: { commun: 20, peucommun: 40, rare: 100, legendaire: 400 },
  // Le Reliquaire n'apparaît qu'une fois une extension complétée à 60 % : avant,
  // les boosters complètent mieux que lui, et la page ne ferait que promettre.
  // Une fois ouvert, il le reste.
  ouverture: 0.6,
  // Une légendaire ne se forge qu'avec la collection de son extension bien
  // entamée, et pas plus d'une par semaine.
  legendaire: { completionMin: 0.6, delaiJours: 7 },
};
