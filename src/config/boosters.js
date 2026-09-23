/**
 * Catalogue des extensions. Pour en ouvrir une nouvelle :
 *   1. déposer le roster dans data/<id>.json (voir scripts/xlsx-to-json.mjs)
 *   2. ajouter l'entrée ici avec `statut: "ouvert"` et `data: "<id>"`
 */
export const BOOSTERS = [
  {
    id: "troupe-valeran",
    titre: "La Troupe",
    statut: "ouvert",
    data: "troupe-valeran",
    sachet: "sachet-troupe.webp",
    /* Chaque visuel a son propre rapport : les forcer à un rapport commun les
       déformerait. Toute la scène d'ouverture en dérive. */
    ratio: 0.5512,
    accent: "#e8a33d",
    cire: "#b33049",
    sceau: "V",
    resume:
      "Rejoignez Valéran Alfax dans son expédition de Thalazur ! Retrouvez de nombreux alliés de la Troupe mais aussi de puissants ennemis, dans cette extension basée sur l'avant-dernier arc de la campagne.",
  },
  {
    id: "nakova",
    titre: "Nakova",
    statut: "bientot",
    sachet: "sachet-nakova.webp",
    ratio: 0.6054,
    accent: "#8fa3ad",
    cire: "#4a5b64",
    sceau: "N",
    resume:
      "Retour dans le passé avec une extension centrée sur le premier arc : découvrez en profondeur les ressources du sud.",
  },
  {
    id: "rendez-vous-odiana",
    titre: "Rendez-vous à Odiana",
    statut: "bientot",
    sachet: "sachet-odiana.webp",
    ratio: 0.6120,
    accent: "#7fa06a",
    cire: "#3f5c39",
    sceau: "O",
    resume:
      "Arpentez les rues de la capitale de Thalazur et collectionnez les plus grands nobles du royaume.",
  },
  {
    id: "kobolds-dragons",
    titre: "Kobolds et Dragons",
    statut: "bientot",
    sachet: "sachet-kobolds.webp",
    ratio: 0.6041,
    accent: "#b2604e",
    cire: "#6d2a1e",
    sceau: "K",
    resume: "Rejoignez l'île de Kazim et découvrez ses merveilles !",
  },
];

export const BOOSTER_PAR_ID = Object.fromEntries(BOOSTERS.map((b) => [b.id, b]));
