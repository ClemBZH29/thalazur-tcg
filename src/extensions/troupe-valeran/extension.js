/**
 * Extension « La Troupe ».
 *
 * Données seules, lisibles par le site comme par les scripts Node. Le sachet
 * (sachet.webp) et le roster (roster.json) de ce dossier sont trouvés
 * automatiquement par src/extensions/index.js.
 */
export default {
  id: "troupe-valeran",
  titre: "La Troupe",
  statut: "ouvert",
  // Rapport largeur / hauteur du visuel du sachet : chaque visuel a le sien,
  // toute la scène d'ouverture en dérive.
  ratio: 0.5512,
  accent: "#e8a33d",
  cire: "#b33049",
  sceau: "V",
  resume: "Rejoignez Valéran Alfax dans son expédition de Thalazur ! Retrouvez de nombreux alliés de la Troupe mais aussi de puissants ennemis, dans cette extension basée sur l'avant-dernier arc de la campagne.",
  ordre: 10,
  // Full art : une chance sur 4096 par booster, propres à cette extension.
  fullart: [
    { nom: "Vyrin", serie: "Maid Café" },
    { nom: "Valéran", serie: "Maid Café" },
    { nom: "Selssy", serie: "Sable Chaud" },
    { nom: "Hida", serie: "Sable Chaud" },
    { nom: "Nemelye", serie: "Passion Ardente" },
    { nom: "Trodonak", serie: "Passion Ardente" }
  ]
};
