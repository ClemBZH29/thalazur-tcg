/**
 * La voix de Bodégué, qui confie les missions. Une réplique selon l'état de
 * la journée, et une par type de mission quand elle est remplie, tirée au
 * jour pour ne pas changer à chaque rendu.
 *
 * Textes provisoires, à réécrire dans la langue de la campagne.
 */
export const VOIX = {
  accueil: [
    "Trois petites choses aujourd'hui. Rien d'héroïque, mais faites-les bien.",
    "J'ai noté ce qu'il faudrait faire. Le reste, je vous le laisse.",
    "On ne bâtit pas une troupe en un jour. En trois tâches, peut-être.",
  ],
  fini: [
    "Rien d'autre pour aujourd'hui. Revenez demain, j'aurai trouvé.",
    "Vous avez tout fait. Allez donc vous reposer, ou ouvrir un booster.",
  ],
  remplacee: "Celle-là ne vous plaisait pas ? Soit. Essayez plutôt ceci.",

  /** Une mission remplie, par type : ce que Bodégué en dit avant de payer. */
  faite: {
    boosters: [
      "Des emballages déchirés partout. C'est bon signe.",
      "Alors, ces boosters ? Ne me dites rien, je vois votre sourire.",
    ],
    nouvelles: [
      "De nouvelles têtes dans votre classeur. La Troupe s'agrandit.",
      "Des visages que vous n'aviez jamais vus. Notez leurs noms, ils comptent.",
    ],
    ventes: [
      "Lise m'a dit que vous étiez passé. Elle avait l'air contente.",
      "Vendu, et bien vendu. Le Comptoir vous connaît, maintenant.",
    ],
    mine: [
      "Les kobolds ont payé ? Comptez deux fois, on ne sait jamais.",
      "Vous sentez la poussière de Kazim. Ça vous va bien.",
    ],
    descentes: [
      "Revenu du Donjon. C'est déjà plus que beaucoup.",
      "Descendre, c'est le plus dur. Le reste n'est que de la marche.",
    ],
    gardiens: [
      "Deux gardiens de moins. Les couloirs seront plus calmes cette nuit.",
      "On m'a parlé de vos gardiens. Racontez-moi, après.",
    ],
    expeditions: [
      "La route vous a rendu vos gens. Entiers, j'espère.",
      "Une expédition de retour, et des histoires plein les sacs.",
    ],
    dissous: [
      "Des vestiges, de la poussière qui brille. Le gardien sera ravi.",
      "Vous avez fait de la place. Le Reliquaire, lui, a pris des forces.",
    ],
    forges: [
      "Une carte sortie de la forge. Elle a encore l'odeur du métal chaud.",
    ],
  },
  /** La mission de la semaine remplie. */
  semaine: [
    "Toute une semaine de travail. Voilà de quoi ouvrir quelque chose de neuf.",
    "Je l'avais dit lundi : vous y arriveriez. Vos boosters vous attendent.",
  ],
};

/** Un élément d'une liste, choisi au jour : stable jusqu'à minuit. */
function auJour(liste, jour = "") {
  if (!Array.isArray(liste)) return liste || "";
  let h = 0;
  for (const c of jour) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return liste[h % liste.length];
}

/**
 * La réplique du moment. `etat` : « accueil », « fini », « remplacee », ou
 * une mission jugée prête (`{ type, semaine }`), dont le type choisit la
 * réplique de complétion.
 */
export function replique(etat, jour = "") {
  if (etat && typeof etat === "object") {
    return auJour(etat.semaine ? VOIX.semaine : VOIX.faite[etat.type] || VOIX.fini, jour);
  }
  return auJour(VOIX[etat], jour);
}
