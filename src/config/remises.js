/**
 * Les remises à zéro du site, et Azel le Destructeur qui les annonce.
 *
 * Azel est un immense dragon noir aux yeux bleus. C'est lui qui fait table
 * rase quand une partie du site doit repartir de zéro (décision de Clément,
 * 27/10/2026) : sa première apparition est la remise des Mines. Pour la
 * prochaine, ajouter une entrée ici, une migration au format suivant
 * (`src/lib/sauvegarde/schema.js`) qui pose `azel[id] = "a-lire"`, et c'est
 * tout : l'écran (`src/remise/AvisAzel.jsx`) lit son texte dans cette table.
 *
 * Une remise se fait toujours à la lecture, comme celle du lancement : toutes
 * les copies d'une partie (navigateur, compte, fichier, autre onglet) passent
 * par `migrer()`. L'écran ne fait que l'annoncer ; il n'a rien à protéger.
 */

/** La remise des Mines et de leurs succès (format 12). */
export const REMISE_MINES = "mines-2026-10";

/**
 * L'heure de la remise des Mines. Une ligne du classement écrite avant elle
 * porte la strate et les éclats d'une mine qui n'existe plus : ces deux
 * colonnes s'y lisent à zéro jusqu'au retour du joueur (`lireClassement`).
 * À avancer si le déploiement part plus tard que prévu.
 */
export const REMISE_MINES_T = Date.parse("2026-10-27T18:00:00+01:00");

export const REMISES = [
  {
    id: REMISE_MINES,
    sur: "Les Mines de Kazim changent de règles",
    titre: "Azel le Destructeur est passé par Kazim.",
    parle: [
      "Vos galeries n'étaient que des égratignures. Je les ai refermées.",
    ],
    texte: [
      "Les Mines ont été rééquilibrées : les éclats se gagnent désormais en battant votre record de profondeur, chaque coup de pioche rapporte son étoile, et les pioches comptent enfin jusqu'au fond.",
      "Pour que tout le monde descende sous les mêmes règles, votre mine repart de la galerie d'entrée, avec ses succès : la strate, les effondrements et les faveurs du Fossoyeur se regagnent, récompenses comprises.",
    ],
    part: ["Étoile, compagnons, chantier et talents", "Éclats, faveurs du Fossoyeur et record de profondeur", "Succès de strate, d'effondrement et de faveurs"],
    reste: ["Vos cartes, vos PO et tout le reste du site", "Les commandes déjà livrées à Tafix, et leurs succès", "Les conseils de Tafix déjà lus"],
    bouton: "Redescendre dans les Mines",
    apres: "#/mines",
  },
];

export const REMISE_PAR_ID = Object.fromEntries(REMISES.map((r) => [r.id, r]));

/** La première remise que le joueur n'a pas encore lue, ou `null`. */
export function remiseEnAttente(etat) {
  const a = etat?.azel;
  if (!a || typeof a !== "object") return null;
  return REMISES.find((r) => a[r.id] === "a-lire") || null;
}
