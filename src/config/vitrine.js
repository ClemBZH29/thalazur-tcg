/**
 * La vitrine de l'accueil (1.1.0) : un carrousel d'affiches, chacune vers
 * son module. L'affiche des notes de version ouvre la note au lieu de
 * changer de page (`note`).
 *
 * `image` : l'affiche, sous public/accueil/ (16:9, sans texte : le titre est
 * posé par la page, prompts dans docs/conception/prompts-vitrine.json).
 * Tant qu'elle manque, l'affiche se compose d'un fond teinté (`teinte`) et du
 * personnage du module (`repli`), déjà livré avec le site.
 */
export const AFFICHES = [
  {
    id: "notes", note: true, etiquette: "Mise à jour 1.1.0", titre: "Les coffres ont des dents",
    texte: "Mimiques, Mirko qui rachète vos reliques, un Donjon tout en PO. Lire la note de version.",
    image: "accueil/affiche-notes.webp", repli: "donjon/mimiques/mimique-vorace.webp", teinte: "#5a2a1e",
  },
  {
    id: "missions", vers: "/missions", etiquette: "Missions de Bodégué", titre: "Trois services par jour",
    texte: "Bodégué a du travail pour vous : trois missions par jour, une par semaine, payées en PO et en boosters.",
    image: "accueil/affiche-missions.webp", repli: "missions/bodegue-content.webp", teinte: "#4a3a1c",
  },
  {
    id: "mines", vers: "/mines", etiquette: "Mines de Kazim", titre: "Tafix a des commandes",
    texte: "Creusez, descendez, livrez à Tafix : les Mines paient plus vite que la patience.",
    image: "accueil/affiche-mines.webp", repli: "kazim/tafix-malicieux.webp", teinte: "#1e3a4a",
  },
  {
    id: "comptoir", vers: "/comptoir", etiquette: "Le Comptoir", titre: "Vos doublons valent de l'or",
    texte: "Chaque jour, des acheteurs aux goûts différents : vendez vos doublons, achetez la carte qui manque.",
    image: "accueil/affiche-comptoir.webp", repli: "comptoir/lise.webp", teinte: "#2a3b2a",
  },
];
