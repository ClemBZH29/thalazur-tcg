/**
 * Le calendrier du Comptoir, sans rien d'autre : le bandeau du site le lit
 * pour allumer le point de la navigation les jours du Conservateur, et il ne
 * doit pas embarquer pour cela le marché ni les acheteurs (chargés à la
 * demande avec la page).
 */

/** Journée de référence. Le jour 14 du module reste le premier jour du site. */
const EPOCH = Date.UTC(2026, 0, 1);
export const JOUR_UN = 14;

/**
 * Le jour, indexé sur la date réelle et non sur un bouton. Les acheteurs
 * tournent avec le calendrier : on revient demain, on ne rejoue pas la journée.
 * Minuit local plutôt qu'UTC, parce qu'un joueur change de jour quand il
 * change de jour.
 */
export function jourCourant(maintenant = new Date()) {
  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const decalage = minuit.getTimezoneOffset() * 60000;
  return JOUR_UN + Math.floor((minuit.getTime() - decalage - EPOCH) / 86400000);
}

/** Le Conservateur Royal ne passe qu'un jour sur dix. */
export const conservateurPresent = (jour) => (((jour * 29) % 100) + 100) % 100 < 10;
