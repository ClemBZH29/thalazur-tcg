/**
 * Les notes de version, affichées par la vitrine de l'accueil (1.1.0).
 *
 * Le texte suit l'annonce Discord (C:\Dev\TCG\Discord\annonces), sans ce qui
 * n'a de sens que là-bas (heure de mise en ligne, salons). Une ligne est
 * `[gras, suite]` : le gras ouvre la ligne, la suite peut être vide.
 * La plus récente en tête.
 */
export const NOTES = [
  {
    version: "1.1.0",
    titre: "Mimiques et Donjon en PO",
    intro: "Première mise à jour depuis l'ouverture : des coffres qui mordent, un colporteur qui rachète vos reliques, un Donjon qui parle enfin une seule langue, la PO, et deux bugs qui coûtaient cher corrigés.",
    sections: [
      {
        titre: "Nouveautés",
        lignes: [
          ["Les mimiques.", "Une salle au trésor sur quatre n'est pas ce qu'elle paraît : le coffre se dresse et se bat. Petite mimique, mimique vorace ou mimique ancienne, plus grosses à mesure qu'on descend. Vaincues, elles rendent ce qu'elles ont avalé : un gros butin, souvent une relique. Elles sont hors collection : leur cadre gris le rappelle, on ne les obtient jamais."],
          ["Mirko fait affaire.", "Rarement, dans une rencontre « ? », le colporteur ne vend rien : il achète une de vos reliques. De quoi faire de la place pour une meilleure."],
          ["L'écho montre ce qu'il promet.", "La relique que promet la voix s'affiche avant de la suivre. Elle ment parfois."],
          ["Bibliothèque : filtre par rôle du Donjon.", "Garde, Frappeur, Tireur, Soigneur… pour voir vos alliés qui tiennent chaque rôle. Au téléphone, il est dans « Filtrer »."],
          ["Vos rainbow au Donjon.", "Une carte dont vous possédez la version rainbow apparaît en rainbow pendant toute la descente."],
        ],
      },
      {
        titre: "Équilibrage",
        lignes: [
          ["Donjon : une seule monnaie, la PO.", "Chaque « +N PO » annoncé pendant une descente est exactement ce qui entre dans votre bourse, et leur somme fait le total versé à la fin."],
          ["Donjon infini : la profondeur paie mieux.", "Les gains suivent l'étage dès qu'ils tombent, au lieu d'être rabotés à la sortie. Au-delà de dix gardiens, comptez environ 10 % de plus."],
          ["Mines : contrôle des clics automatiques.", "Tenir la cadence maximale de frappe dix secondes d'affilée, c'est la signature d'un autoclicker : Tafix ferme alors la mine pour 24 h. Frapper vite par rafales n'est pas concerné."],
        ],
      },
      {
        titre: "Corrections",
        lignes: [
          ["Fini le coffre piégé", "des rencontres « ? » : le danger des coffres, ce sont maintenant les mimiques."],
          ["Mobile :", "toucher une carte de la bibliothèque pour l'agrandir ne compte plus comme un second toucher qui dissolvait des doublons."],
          ["Missions :", "« Accueillir une expédition » se valide aussi quand l'expédition est rentrée pendant la nuit."],
          ["Sortie d'étage :", "descendre et remonter ne se confondent plus. Deux grands boutons bien distincts, et remonter demande une confirmation."],
          ["Vocabulaire :", "le Donjon dit « rainbow » et « booster », comme le reste du site."],
        ],
      },
    ],
  },
];
