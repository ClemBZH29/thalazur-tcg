/**
 * La remise à zéro du lancement (format 11).
 *
 * Décision de Clément : au lancement, les parties de la bêta repartent de
 * zéro, et chaque bêta-testeur reçoit en contrepartie un dos de carte
 * exclusif, le Dos de l'Éclaireur.
 *
 * Comme la remise des Mines du 07/10/2026, elle se fait **à la lecture** :
 * c'est une migration (`MIGRATIONS[11]`, schema.js), par laquelle passent
 * toutes les lectures — stockage local, copie du compte, base de
 * synchronisation, fichier importé, copie de secours, autre onglet. Aucune
 * porte ne laisse entrer une partie de la bêta : retirer l'avis de la page
 * avec l'inspecteur ne rend rien, la partie est déjà remise quand il
 * s'affiche. L'avis ne fait qu'informer, et attend d'être validé.
 *
 * Fonctions pures, sans import du stockage : `relireJeu` complète ensuite
 * tout ce qui manque par les valeurs de `etatVide()`.
 */
import { DOS_BETA } from "./dos-beta.js";

/** La partie a-t-elle vraiment été jouée ? Une visite sans booster ouvert ne vaut pas un dos. */
export function partieJouee(d) {
  if (!d || typeof d !== "object") return false;
  const boosters = Object.values(d.boosters || {}).some((n) => Number(n) > 0);
  const cartes = Object.values(d.collections || {}).some((c) => c && Object.keys(c).length > 0);
  return boosters || cartes;
}

/** Partie du jeu, format 10 → 11. */
export function remiseLancement(d) {
  const profil = d?.profil && typeof d.profil === "object" ? d.profil : {};
  // On garde ce qui est au joueur plutôt qu'à la partie : son nom, son choix
  // de figurer au classement, ses préférences (son, animations, doublons) et
  // les conseils de Tafix déjà lus. Le titre et la carte préférée partent :
  // ils venaient de succès et de cartes qui ne sont plus là.
  const neuve = {
    reglages: d?.reglages && typeof d.reglages === "object" ? d.reglages : undefined,
    profil: {
      ...(profil.pseudo ? { pseudo: profil.pseudo } : {}),
      ...(profil.classement === true ? { classement: true } : {}),
      ...(profil.pseudoReporte ? { pseudoReporte: true } : {}),
    },
    tafix: d?.tafix && typeof d.tafix === "object" ? d.tafix : undefined,
  };
  if (neuve.reglages === undefined) delete neuve.reglages;
  if (neuve.tafix === undefined) delete neuve.tafix;
  if (!partieJouee(d)) return neuve;
  return {
    ...neuve,
    dos: { gagnes: [DOS_BETA], choisi: DOS_BETA },
    // L'avis s'affiche jusqu'à ce que le joueur l'ait validé (AvisLancement.jsx).
    lancement: { beta: true, avis: "a-lire" },
  };
}

/**
 * Mine des Mines de Kazim, format 10 → 11 : une galerie neuve. Un objet sans
 * version de règles est remis à zéro par `relireMine` (mines/sauvegarde.js),
 * sans solde à verser puisqu'aucun filon n'y a été brisé.
 */
export function remiseMineLancement() {
  return {};
}
