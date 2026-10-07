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
  /** Juste après une réclamation, quand il reste à faire. */
  apres: [
    "Bien. Il en reste, si le cœur vous en dit.",
    "Une de faite. Les autres ne vont pas s'envoler.",
  ],

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
      "Tafix a payé ? Comptez deux fois, on ne sait jamais.",
      "Vous sentez la poussière de Kazim. Ça vous va bien.",
    ],
    commandes: [
      "Tafix a payé ? Comptez deux fois, on ne sait jamais.",
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

/**
 * Ce que montre la scène : la réplique de la bulle et la pose de Bodégué.
 * Les poses sont les fichiers `public/missions/bodegue-<pose>.webp`
 * (« neutre » est `bodegue.webp`). Par ordre de priorité :
 *
 * - juste après un remplacement : malicieux, « Celle-là ne vous plaisait pas ? » ;
 * - une mission du jour remplie : content, la réplique de son type ;
 * - la semaine remplie : la lettre scellée levée ;
 * - un instant après une réclamation (`content`) : content ;
 * - la journée finie : serein, yeux clos ;
 * - juste après une réclamation, s'il reste à faire : neutre ;
 * - missions toutes neuves : il tend le billet du jour ;
 * - sinon : neutre.
 */
export function humeurDe({ quotidiennes = [], hebdo = null, remplacee = false, apres = false, content = false }) {
  const prete = quotidiennes.find((m) => m.atteinte && !m.reclamee);
  const semaine = hebdo && hebdo.atteinte && !hebdo.reclamee ? hebdo : null;
  const fini = quotidiennes.length > 0 && quotidiennes.every((m) => m.reclamee);
  const neuf = quotidiennes.length > 0 && quotidiennes.every((m) => !m.reclamee && m.valeur === 0);
  if (remplacee) return { voix: "remplacee", pose: "malicieux" };
  if (prete) return { voix: prete, pose: "content" };
  if (semaine) return { voix: semaine, pose: "semaine" };
  if (content) return { voix: fini ? "fini" : "apres", pose: "content" };
  if (fini) return { voix: "fini", pose: "serein" };
  if (apres) return { voix: "apres", pose: "neutre" };
  if (neuf) return { voix: "accueil", pose: "billet" };
  return { voix: "accueil", pose: "neutre" };
}

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
