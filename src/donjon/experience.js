/**
 * L'expérience des cartes, gagnée au Donjon.
 *
 * Une carte qui descend gagne de l'expérience à chaque combat remporté, et
 * monte de niveau. Deux paliers la récompensent :
 *
 * - **Le palier d'irisation**, plus bas pour les cartes modestes (niveau 20
 *   pour une commune, 30 une peu commune, 40 une rare, 50 une légendaire) :
 *   la carte y gagne sa version irisée, ou, si on la possède déjà, des PO.
 * - **Le niveau 100** : un sachet offert de son extension.
 *
 * C'est ce qui donne une raison d'emmener autre chose que ses légendaires :
 * une commune s'irise vite, et chaque niveau la rend un peu plus solide.
 *
 * La courbe monte : passer du niveau n au niveau n + 1 coûte 5 + n points.
 * Il en faut 285 pour le niveau 20, 1 470 pour le 50 et 5 445 pour le 100.
 * Une descente rapporte à chaque compagnon une quarantaine de points en
 * moyenne, une centaine si elle va au bout (voir tests/donjon.test.js).
 *
 * Rien ici ne touche au navigateur : le module est testé à nu.
 */

export const NIVEAU_MAX = 100;
export const PALIER_IRISEE = { commun: 20, peucommun: 30, rare: 40, legendaire: 50 };
/** Ce que rapporte le palier d'irisation d'une carte déjà possédée irisée. */
export const PO_SI_IRISEE = { commun: 60, peucommun: 120, rare: 240, legendaire: 480 };

/** Points cumulés qu'il faut pour atteindre le niveau `n`. */
export const xpPourNiveau = (n) => {
  const k = Math.max(0, Math.min(NIVEAU_MAX, n) - 1);
  return 5 * k + (k * (k + 1)) / 2;
};

export function niveauDe(xp = 0) {
  let n = 1;
  while (n < NIVEAU_MAX && xp >= xpPourNiveau(n + 1)) n++;
  return n;
}

/** Où en est la carte dans son niveau : 0 à 1. */
export function avancement(xp = 0) {
  const n = niveauDe(xp);
  if (n >= NIVEAU_MAX) return 1;
  const a = xpPourNiveau(n), b = xpPourNiveau(n + 1);
  return (xp - a) / (b - a);
}

/**
 * Ce que le niveau ajoute en combat : un PV tous les dix niveaux, un point
 * d'ATQ tous les vingt-cinq. Une commune au niveau 100 (+10 PV, +4 ATQ)
 * rejoint une légendaire neuve sans la dépasser de beaucoup.
 */
export const bonusNiveau = (n) => ({ pv: Math.floor(n / 10), atq: Math.floor(n / 25) });

/** Clé d'une carte dans `etat.xp` : l'extension et l'identifiant. */
export const cleXP = (c) => `${c.ext}:${c.id}`;
export const xpDe = (etat, c) => etat.xp?.[cleXP(c)]?.xp || 0;

/**
 * Crédite l'expérience d'une descente et distribue les paliers franchis.
 *
 * `gains` : [{ c, xp }]. Rend le nouvel état et la liste de ce qui s'est
 * passé, carte par carte, pour le bilan : niveau avant et après, irisée
 * gagnée, PO à la place, sachet offert. Un palier n'est payé qu'une fois :
 * il est noté dans `etat.xp[cle]` (`irisee`, `cent`).
 */
export function crediterXP(etat, gains) {
  const xp = { ...(etat.xp || {}) };
  const collections = { ...(etat.collections || {}) };
  const sachets = { ...(etat.sachets || {}) };
  let po = 0;
  const bilan = [];
  for (const { c, xp: gain } of gains) {
    if (!gain) continue;
    const cle = cleXP(c);
    const avant = xp[cle] || { xp: 0 };
    const apres = { ...avant, xp: (avant.xp || 0) + gain };
    const n0 = niveauDe(avant.xp), n1 = niveauDe(apres.xp);
    const ligne = { c, gain, avant: n0, apres: n1 };
    if (n1 >= (PALIER_IRISEE[c.tier] || 20) && !avant.irisee) {
      apres.irisee = true;
      const coll = { ...(collections[c.ext] || {}) };
      const e = coll[c.id] || { normale: 0, rainbow: 0 };
      if ((e.rainbow || 0) > 0) {
        const p = PO_SI_IRISEE[c.tier] || 60;
        po += p;
        ligne.po = p;
      } else {
        coll[c.id] = { ...e, rainbow: 1, carte: e.carte || c };
        collections[c.ext] = coll;
        ligne.irisee = true;
      }
    }
    if (n1 >= NIVEAU_MAX && !avant.cent) {
      apres.cent = true;
      sachets[c.ext] = (sachets[c.ext] || 0) + 1;
      ligne.sachet = true;
    }
    xp[cle] = apres;
    ligne.xp = apres.xp; // pour la jauge du bilan
    bilan.push(ligne);
  }
  return { etat: { ...etat, xp, collections, sachets }, bilan, po };
}

/**
 * L'entraînement : sacrifier `n` exemplaires en trop d'une carte pour lui
 * donner de l'expérience (`gainParDoublon` chacun). Le dernier exemplaire
 * n'est jamais pris, et une carte au niveau 100 n'a plus rien à apprendre.
 * Les paliers franchis paient comme au Donjon (irisée, PO, sachet). Rend
 * `{ etat, bilan, po }`, ou l'état tel quel si rien n'est possible.
 */
export function entrainer(etat, c, n, gainParDoublon) {
  const k = etat.collections?.[c.ext]?.[c.id]?.normale || 0;
  if (!c.ext || n < 1 || k - n < 1 || niveauDe(xpDe(etat, c)) >= NIVEAU_MAX) return { etat, bilan: [], po: 0 };
  const coll = { ...(etat.collections[c.ext] || {}) };
  coll[c.id] = { ...coll[c.id], normale: k - n };
  const avant = { ...etat, collections: { ...etat.collections, [c.ext]: coll } };
  const r = crediterXP(avant, [{ c, xp: n * gainParDoublon }]);
  const stats = { ...(r.etat.stats || {}), entraines: ((r.etat.stats || {}).entraines || 0) + n };
  return { ...r, etat: { ...r.etat, stats } };
}

/** Combien de doublons pour atteindre le niveau suivant (au moins 1). */
export function doublonsPourNiveau(etat, c, gainParDoublon) {
  const xp = xpDe(etat, c), n = niveauDe(xp);
  if (n >= NIVEAU_MAX) return 0;
  return Math.max(1, Math.ceil((xpPourNiveau(n + 1) - xp) / gainParDoublon));
}
