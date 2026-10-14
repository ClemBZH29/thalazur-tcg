/**
 * Les dos de carte.
 *
 * Un dos est un cosmétique : il habille le verso de toutes les cartes du
 * joueur (ouverture, bibliothèque, Reliquaire, Comptoir, Missions, grimoire).
 * Il ne trahit jamais le palier — la charte des dos s'applique à chacun
 * (claude/charte-dos-de-carte.md) : même grille, aucun texte, pas de rouge
 * ni d'effet arc-en-ciel.
 *
 * Dans la sauvegarde : `dos: { gagnes: [id…], choisi: id | null }`. Le dos
 * commun n'a pas à être gagné ; `choisi` nul ou inconnu le désigne.
 */
export const DOS_DEFAUT = "brumes";

export const DOS = [
  {
    id: "brumes",
    nom: "Dos des Brumes",
    fichier: "carte-dos.webp",
    fond: "#0a243d",
    obtention: "Le dos de tout aventurier.",
  },
  {
    id: "eclaireur",
    nom: "Dos de l'Éclaireur",
    fichier: "dos/eclaireur.webp",
    fond: "#0b1d24",
    exclusif: true,
    obtention: "Offert aux bêta-testeurs, qui ont arpenté Thalazur avant son ouverture.",
  },
];

export const DOS_PAR_ID = Object.fromEntries(DOS.map((d) => [d.id, d]));

/** Les dos que le joueur peut choisir : le commun, plus ceux qu'il a gagnés. */
export function dosDisponibles(etat) {
  const gagnes = new Set(Array.isArray(etat?.dos?.gagnes) ? etat.dos.gagnes : []);
  return DOS.filter((d) => d.id === DOS_DEFAUT || gagnes.has(d.id));
}

/** Le dos affiché : le choisi s'il est gagné, le commun sinon. */
export function dosChoisi(etat) {
  const id = etat?.dos?.choisi;
  return dosDisponibles(etat).find((d) => d.id === id) || DOS_PAR_ID[DOS_DEFAUT];
}

/** Ajoute un dos gagné (sans doublon). `choisir` : il devient le dos affiché. */
export function gagnerDos(etat, id, { choisir = false } = {}) {
  const dos = etat?.dos || {};
  const gagnes = Array.isArray(dos.gagnes) ? dos.gagnes : [];
  return {
    ...etat,
    dos: {
      gagnes: gagnes.includes(id) ? gagnes : [...gagnes, id],
      choisi: choisir ? id : (dos.choisi ?? null),
    },
  };
}

/**
 * Fusion entre deux appareils, ou à l'import : un dos gagné l'est partout
 * (union) ; le choix est une valeur, celle de l'appareil s'il l'a changée
 * depuis la base, celle de l'autre côté sinon.
 */
export function fusionnerDos(base, ici, la) {
  const liste = (d) => (Array.isArray(d?.gagnes) ? d.gagnes : []);
  const gagnes = [...new Set([...liste(la), ...liste(ici)])];
  const choisi = (ici?.choisi ?? null) !== (base?.choisi ?? null) ? (ici?.choisi ?? null) : (la?.choisi ?? null);
  return { gagnes, choisi };
}
