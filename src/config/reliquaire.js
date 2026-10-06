/**
 * Le Reliquaire : réglages.
 *
 * Depuis le 30/09/2026, le Reliquaire ne propose plus qu'une carte par jour,
 * la même pour tous, forgée avec des vestiges. On y gagne des vestiges en
 * dissolvant ses doublons depuis la bibliothèque (menu de la carte agrandie).
 *
 * La carte du jour est tirée comme dans un booster : une commune sort bien
 * plus souvent qu'une légendaire, et elle est irisée trois fois sur cent,
 * comme à l'ouverture d'un sachet. Le prix est celui de la forge, relevé de
 * deux fois et demie par rapport à l'ancien étal (où l'on choisissait sa carte
 * parmi toutes celles qui manquaient) : on ne choisit plus, mais on paie
 * davantage la carte qui tombe. Une version irisée coûte cinq fois la normale.
 *
 * Mesures : `node scripts/audit-reliquaire.mjs`.
 */
export const RELIQUAIRE = {
  dissolution: { commun: 5, peucommun: 10, rare: 25, legendaire: 100 },
  forge: { commun: 50, peucommun: 100, rare: 250, legendaire: 1000 },
  multRainbow: 5,
  // La forge à l'aveugle (06/10/2026) : la carte du jour se présente face
  // cachée et se forge sans la retourner au prix moyen de la carte du jour
  // (l'espérance de son prix, ~97 vestiges), relevé au multiple de `arrondi`
  // supérieur : 100. Perdant sur une commune (50), juste sur une peu commune,
  // gagnant sur une rare (250), une légendaire (1 000) ou une rainbow. La
  // retourner est gratuit mais renonce au prix moyen pour la journée : c'est
  // ce renoncement qui fait le pari. `marge` > 1 ferait payer le frisson.
  aveugle: { marge: 1, arrondi: 5 },
  // Le Reliquaire n'apparaît qu'une fois une extension complétée à 60 % : avant,
  // les boosters complètent mieux que lui, et la page ne ferait que promettre.
  // Une fois ouvert, il le reste. Le même seuil ouvre la dissolution depuis la
  // bibliothèque.
  ouverture: 0.6,
};

/**
 * L'entraînement : un doublon sacrifié donne de l'expérience à sa carte, la
 * même que celle du Donjon et des Expéditions. Une descente rapporte une
 * quarantaine de points à chaque compagnon : un doublon commun en vaut un
 * tiers, une légendaire presque six descentes.
 */
export const ENTRAINEMENT = {
  xp: { commun: 15, peucommun: 30, rare: 75, legendaire: 250 },
};

/**
 * La fiche de combat d'une carte (volet « Combat » de la carte agrandie) :
 * ce que coûtent, en vestiges, les rangs d'ATQ et d'INI, et le changement de
 * geste ou de technique. Une compétence naturelle au rôle de la carte coûte
 * moitié prix ; revenir à celle d'origine est gratuit.
 *
 * Repères : un doublon commun dissous rapporte 5 vestiges, un rare 25. Un
 * premier rang coûte donc dix communes, une technique trente — un vrai
 * choix, pas une formalité. Les soins sont réservés à leurs rôles (voir
 * `reservee`, src/donjon/regles.js). L'étoile, elle, ne se paie qu'en rainbow (une
 * version irisée en trop de la carte par ligne).
 */
export const PERSONNALISATION = {
  rangs: [50, 100, 200],
  geste: 80,
  tech: 150,
  affinite: 0.5,
};
