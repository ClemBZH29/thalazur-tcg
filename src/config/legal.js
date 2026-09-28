/**
 * Mentions légales et contact RGPD.
 *
 * À compléter avant la mise en ligne : tant qu'un champ vaut `null`, la page
 * Confidentialité l'affiche comme « à compléter », pour que l'oubli se voie.
 *
 * Pour un site personnel non professionnel, la loi (LCEN, art. 6-III-2)
 * permet de ne publier que les coordonnées de l'hébergeur, à condition de
 * communiquer son identité à celui-ci. L'adresse de contact, elle, doit
 * permettre d'exercer ses droits sur ses données : une adresse dédiée suffit.
 */
export const LEGAL = {
  site: "thalazur.io",
  /** Nom ou pseudonyme de l'éditeur du site. */
  editeur: "Clément L'Huillier",
  /** Adresse e-mail où écrire pour toute question ou demande sur ses données. */
  contact: "clement.lhuillier24@gmail.com",
  /**
   * Conservation : un compte sans aucune utilisation pendant ce nombre
   * d'années est supprimé, partie comprise. Chaque écriture repousse
   * l'échéance (champ `expire`, politique TTL Firestore) ; les identités
   * sont purgées par `scripts/purge-comptes.mjs`.
   */
  conservationAns: 5,
  /** Date de dernière mise à jour de la politique (JJ/MM/AAAA). */
  miseAJour: "26/09/2026",
  hebergeur: {
    nom: "GitHub, Inc. (GitHub Pages)",
    adresse: "88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis",
  },
  /** Les illustrations des cartes, servies à part (voir VITE_PORTRAITS_BASE). */
  hebergeurImages: {
    nom: "Google Ireland Limited (Firebase Hosting)",
    adresse: "Gordon House, Barrow Street, Dublin 4, Irlande",
  },
  sousTraitant: {
    nom: "Google Ireland Limited (Firebase)",
    adresse: "Gordon House, Barrow Street, Dublin 4, Irlande",
  },
};
