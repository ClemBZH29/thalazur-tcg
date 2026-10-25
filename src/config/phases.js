/**
 * Les trois phases du site autour du lancement — sans `import.meta`, pour
 * être lues aussi bien par le site que par `vite.config.js` et le script du
 * workflow (`scripts/etat-site.mjs`).
 *
 *   beta    le site de test, tel qu'il tourne jusqu'au 25/10/2026 à minuit ;
 *           passé cette heure, il n'affiche plus que la page d'attente
 *   ferme   le build de la page d'attente seule : le jeu n'est même pas dans
 *           le paquet publié, il n'y a rien à rouvrir depuis la console
 *   ouvert  le site lancé : format 11, les parties de la bêta repartent de
 *           zéro à la lecture (voir docs/conception/lancement.md)
 *
 * Voir docs/conception/lancement.md pour le déroulé et l'action GitHub.
 */
export const PHASES = ["beta", "ferme", "ouvert"];

/** Minuit, heure de Paris (encore à l'heure d'été cette nuit-là : UTC+2). */
export const FERMETURE_ISO = "2026-10-25T00:00:00+02:00";
export const FERMETURE = Date.parse(FERMETURE_ISO);

/**
 * La phase d'un build. Le workflow la fixe toujours (`VITE_SITE_ETAT`) ; sans
 * elle — développement, aperçu, tests — elle suit l'horloge : la bêta avant
 * la fermeture, le site ouvert après. Jamais « ferme » par défaut : en local,
 * on veut le jeu.
 */
export function phaseDuBuild(brut, maintenant = Date.now()) {
  if (PHASES.includes(brut)) return brut;
  return maintenant >= FERMETURE ? "ouvert" : "beta";
}

/** La page d'attente s'affiche-t-elle, pour ce build et à cette heure ? */
export function attenteAffichee(phase, maintenant = Date.now()) {
  return phase === "ferme" || (phase === "beta" && maintenant >= FERMETURE);
}
