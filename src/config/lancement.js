import { FERMETURE, attenteAffichee } from "./phases.js";

/**
 * La phase de ce build, figée à la compilation (`vite.config.js` résout
 * `VITE_SITE_ETAT` avant de construire) : le format des sauvegardes en
 * dépend, il ne doit jamais changer en cours de session au gré de l'horloge.
 */
export const PHASE = import.meta.env?.VITE_SITE_ETAT || "beta";
export const SITE_OUVERT = PHASE === "ouvert";

/**
 * L'heure d'ouverture : celle de l'étiquette `lancement` posée par l'action
 * GitHub. Les lignes du classement écrites avant elle sont celles de la bêta,
 * et ne s'affichent plus. Sans étiquette (développement), la fermeture.
 */
export const OUVERTURE = Date.parse(import.meta.env?.VITE_SITE_OUVERTURE || "") || FERMETURE;

export const pageAttente = (maintenant = Date.now()) => attenteAffichee(PHASE, maintenant);
