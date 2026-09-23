import { ECONOMIE, REVENTE } from "../config/tiers.js";

export const bourseNeuve = () => ({ po: ECONOMIE.depart, credite: Date.now(), gagne: 0 });

/**
 * Crédite le gain passif écoulé depuis le dernier passage. Le plafond ne
 * s'applique qu'à l'accumulation : la revente des doublons peut le dépasser.
 */
export function crediter(bourse, maintenant = Date.now()) {
  // Horloge reculée : sans ce recalage, l'horodatage resterait dans le futur
  // et le gain passif serait gelé jusqu'à ce que le temps réel le rattrape.
  const depuis = Math.min(bourse.credite || maintenant, maintenant);
  const ecoule = Math.max(0, maintenant - depuis);
  if (bourse.po >= ECONOMIE.plafond) return { ...bourse, credite: maintenant };
  const gain = (ecoule / 3600000) * ECONOMIE.parHeure;
  return { ...bourse, po: Math.min(ECONOMIE.plafond, bourse.po + gain), credite: maintenant };
}

export const peutAcheter = (bourse, gratuit) => gratuit || bourse.po >= ECONOMIE.prix;

export const debiter = (bourse, gratuit) =>
  gratuit ? bourse : { ...bourse, po: bourse.po - ECONOMIE.prix };

/**
 * Crédit hors plafond. Le plafond de 720 PO ne borne que l'accumulation
 * passive : ce que le joueur est allé chercher lui-même — revente d'un
 * doublon, vente au Comptoir, pesée d'étoile chez les kobolds — se cumule
 * sans limite, sinon la mine cesserait de payer dès la deuxième heure.
 */
export const crediterGain = (bourse, montant) =>
  montant <= 0 ? bourse : { ...bourse, po: bourse.po + montant, gagne: (bourse.gagne || 0) + montant };

export const crediterRevente = crediterGain;

/** Dépense libre : achat d'une carte à l'échoppe, hors prix fixe du booster. */
export const debiterLibre = (bourse, montant) =>
  montant <= 0 ? bourse : { ...bourse, po: Math.max(0, bourse.po - montant) };

/** Temps restant avant de pouvoir s'offrir un booster, en millisecondes. */
export function attenteAvantAchat(bourse) {
  if (bourse.po >= ECONOMIE.prix) return 0;
  return ((ECONOMIE.prix - bourse.po) / ECONOMIE.parHeure) * 3600000;
}

export function formatDuree(ms) {
  const min = Math.ceil(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

export const valeurRevente = (tier) => REVENTE[tier] || 0;
