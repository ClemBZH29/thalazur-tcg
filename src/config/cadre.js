/**
 * Géométrie relevée directement sur Card_Front.png (1024 × 1536).
 * Toutes les valeurs sont des pourcentages de la carte, jamais des pixels :
 * c'est ce qui rend le texte solidaire du cadre quelle que soit la taille
 * d'affichage — vignette de bibliothèque, pile de révélation ou plein écran.
 */
export const CADRE = {
  ratio: 2 / 3,

  /** Fenêtre d'art : zone transparente du PNG, le portrait passe dessous. */
  art: { x: 8.2, y: 8.66, w: 83.69, h: 60.09 },

  /** Plaque haute — le nom, sur une seule ligne. */
  nom: { x: 8.01, y: 71.22, w: 83.98, h: 5.73 },

  /** Plaque basse — grade, corps et occupation. */
  detail: { x: 8.01, y: 79.23, w: 83.88, h: 8.79 },

  /** Bandeau libre sous les plaques, sur le cadre sombre : matière et encoches. */
  pied: { x: 14, y: 89.3, w: 72, h: 4.2 },
};

export const ASSET = {
  cadre: "carte-cadre.webp",
  cadreFullart: "carte-cadre-fullart.webp",
  dos: "carte-dos.webp",
};

/**
 * Cadre pleine illustration, porté par les full art et les cartes PJ.
 * Pas de plaque de texte : l'image occupe toute la fenêtre, le nom se lit
 * dans la bibliothèque et en plein écran.
 */
export const CADRE_PLEIN = {
  art: { x: 8.5, y: 8.85, w: 83.1, h: 84.31 },
  /** Angle peint plus généreux que sur le cadre standard : 4,2 % contre 3,2 %. */
  rayon: "4.4%/2.93%",
};

/** Le dos est livré au même format que le cadre, 1024 × 1536. Cette couleur
 *  ne sert que de fond d'attente pendant le chargement de l'image. */
export const DOS_FOND = "#0a243d";

/** Découpe du sachet, alignée sur le premier quart de sa hauteur. */
export const COUPE = 0.25;
