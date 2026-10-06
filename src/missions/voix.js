/**
 * La voix de Bodégué, qui confie les missions. Une réplique selon l'état de
 * la journée, tirée au jour pour ne pas changer à chaque rendu.
 *
 * Textes provisoires, à réécrire dans la langue de la campagne.
 */
export const VOIX = {
  accueil: [
    "Trois petites choses aujourd'hui. Rien d'héroïque, mais faites-les bien.",
    "J'ai noté ce qu'il faudrait faire. Le reste, je vous le laisse.",
    "On ne bâtit pas une troupe en un jour. En trois tâches, peut-être.",
  ],
  pret: [
    "C'est fait ? Venez chercher votre dû.",
    "Je l'ai vu. Votre bourse aussi va le voir.",
  ],
  fini: [
    "Rien d'autre pour aujourd'hui. Revenez demain, j'aurai trouvé.",
    "Vous avez tout fait. Allez donc vous reposer, ou ouvrir un booster.",
  ],
  remplacee: "Celle-là ne vous plaisait pas ? Soit. Essayez plutôt ceci.",
};

/** La réplique du jour pour un état donné. */
export function replique(etat, jour = "") {
  const l = VOIX[etat];
  if (!Array.isArray(l)) return l || "";
  let h = 0;
  for (const c of jour) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return l[h % l.length];
}
