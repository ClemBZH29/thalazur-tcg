/**
 * Mines de Kazim — les règles : constantes d'économie et formules pures.
 *
 * Tout ici prend l'état de la partie `S` et rend un nombre, sans effet de
 * bord : c'est ce qui permet à `scripts/audit-economie.mjs` et aux tests de
 * rejouer l'économie sans navigateur. Une formule qui change ici change
 * partout — l'interface ne recalcule rien de son côté.
 */
import { STRATES, COMPAGNONS, EQUIPEMENT, AMELIORATIONS } from "./donnees.js";

export const FILONS_PAR_STRATE = 12;

/* Économie. L'économie de base donne 15 PO par heure plafonnées à 720, soit
   trois boosters par jour. La mine complète, elle ne remplace pas.

   Les kobolds rachètent à un cours qui monte avec le volume d'une vente et qui
   s'appauvrit à mesure qu'ils ont déjà payé. L'appauvrissement est indexé sur
   les PO VERSÉS depuis le dernier effondrement, jamais sur le nombre de ventes :
   sinon il suffirait de vendre une seule fois, très gros, pour l'annuler.

   Prix d'un PO : ancre * e^(PO versés / FATIGUE_PO). Le stock nécessaire croît
   en exponentielle quand les PO croissent en linéaire, ce qui transforme une
   production exponentielle en revenu logarithmique. */
export const FILONS_PAR_PO = 4;       // ancre du ratio : un PO vaut quatre filons de la strate 1
export const ANCRE_EXPO = 0.85;       // sous-linéaire : descendre rend l'étoile un peu plus payante
export const FATIGUE_PO = 32;         // PO versés pour que le cours soit divisé par e
export const T_MAX = 0.75;            // plafond du bonus de volume
export const DETTE_PAS = 0.06;        // creusement logarithmique de la dette par effondrement
export const DETTE_MAX = 0.55;        // plancher du cours : la mine ne meurt jamais tout à fait
export const RESONANCE_MAX = 0.25;    // bonus de cours accumulable par les critiques
/* Plafond quotidien laissé à zéro, donc désactivé : la mine complète le gain
   passif de l'application au lieu de le remplacer, et son économie est déjà
   logarithmique — le cours kobold est divisé par e tous les trente-deux PO
   versés, ce qui borne la journée bien mieux qu'un couperet. Voir
   docs/audit-economie.md pour les ordres de grandeur mesurés. */
export const PLAFOND_JOUR = 0;
export const PIOCHES = ["p4", "p3", "p2", "p1"];


export const equipA = (S, id) => S.equipement.indexOf(id) !== -1;
export const equipMult = (S, type) =>
  EQUIPEMENT.reduce((m, e) => (e.type === type && equipA(S, e.id) ? m * e.val : m), 1);
export const mEclats = (S) => 1 + S.eclats * 0.03;
/* Force convertit la présence en revenu : une frappe vaut une fraction de la
   production passive, donc cliquer reste utile quand les compagnons pèsent des
   millions. Sans cela, Discipline écrase tout le reste par construction. */
export const secondesParFrappe = (S) => 0.15 + 0.12 * S.talents.force;
export const degatsClic = (S) => Math.max(
  (1 + S.talents.force * 0.3) * equipMult(S, "clic") * mEclats(S),
  dpsBrut(S) * secondesParFrappe(S)
);
export const critChance = (S) =>
  Math.min(75, EQUIPEMENT.reduce(
    (c, e) => (equipA(S, e.id) && (e.type === "crit" || e.type === "crit2") ? c + e.val : c),
    Math.min(15, S.talents.echo * 2)
  ));
export const critMult = (S) => (equipA(S, "l2") ? 7.5 : 5);
export const prodUnitaire = (S) => (1 + S.talents.discipline * 0.12) * equipMult(S, "dps") * mEclats(S);
/* Les améliorations d'un compagnon se cumulent en doublant : ×2, ×4, ×8, ×16.
   Elles vivent dans le même tableau `equipement` que le chantier, donc un
   effondrement les emporte comme le reste — « achats définitifs » vaut pour
   la mine en cours, pas pour l'éternité. */
export const multCompagnon = (S, id) => Math.pow(
  2,
  AMELIORATIONS.reduce((n, a) => (a.compagnon === id && equipA(S, a.id) ? n + 1 : n), 0)
);
export const dpsUn = (S, c) => c.dps * multCompagnon(S, c.id) * prodUnitaire(S);
export const dpsBrut = (S) =>
  COMPAGNONS.reduce((a, c) => a + (S.compagnons[c.id] || 0) * c.dps * multCompagnon(S, c.id), 0)
  * prodUnitaire(S);
export const dps = dpsBrut;
export const multRecolte = (S) => equipMult(S, "recolte") * mEclats(S);
/* Fortune ne touche pas la moyenne par la même porte que Discipline : elle
   gonfle la fréquence des filons qui rendent plus, donc la variance. */
export const chanceEvenement = (S) => Math.min(0.35, 0.05 * (1 + 0.5 * S.talents.fortune));
/* Un filon sur combien rend plus. Le chiffre est affiché sous les talents :
   douze points placés dans Fortune ne se voyaient nulle part. */
export const unFilonSur = (S) => Math.max(1, Math.round(1 / chanceEvenement(S)));
/* La teinte des filons qui rendent plus : ambre à zéro point de Fortune, rouge
   franc à dix. Le talent gouverne la fréquence ; la couleur dit jusqu'où on
   l'a poussé, ce qu'aucun chiffre de l'interface ne disait. */
export const teinteFortune = (S) => Math.round(40 - 40 * Math.min(1, S.talents.fortune / 10));
export const pvFilon = (prof, brises) => Math.ceil(18 * Math.pow(3.2, prof - 1) * Math.pow(1.09, brises));
export const xpRequis = (S) => Math.floor(22 * Math.pow(S.niveau, 1.55));
export const brisesIci = (S) => S.brises[S.profondeur] || 0;
export const margeKobold = (S) =>
  Math.pow(0.94, Math.min(12, Math.floor(S.echanges / 4))) * equipMult(S, "taux");
/* Ancre : ce que coûterait un PO si les kobolds étaient honnêtes. Elle suit la
   profondeur atteinte avec un exposant plus faible que les points de roche, donc
   descendre augmente réellement le revenu, d'environ 19 % par strate. */
export const ancrePO = (S) =>
  Math.max(12, 0.24 * 18 * Math.pow(3.2, (S.profondeurMax - 1) * ANCRE_EXPO) * FILONS_PAR_PO);

/* Dette d'effondrement : imperceptible au premier, jamais rattrapable ensuite. */
export const dette = (S) => Math.min(DETTE_MAX, DETTE_PAS * Math.log(1 + S.effondrements));
/* Bonus de volume : vendre gros paie, avec un rendement décroissant. */
export const bonusVolume = (S, mise) =>
  Math.min(T_MAX, 0.18 * Math.log2(1 + Math.max(0, mise) / ancrePO(S) / 5));
export const resonance = (S) => Math.min(RESONANCE_MAX, (S.resonance || 0) * 0.004);
/* Cours hors fatigue, exprimé comme un multiplicateur : tout ce qui aide monte. */
export const coursBase = (S, mise) =>
  Math.max(0.05, (1 + bonusVolume(S, mise) + resonance(S)) * (1 - dette(S))
    / equipMult(S, "taux") / S.cours);
export const coursAffiche = (S, mise) =>
  Math.round(coursBase(S, mise) * Math.exp(-S.poRun / FATIGUE_PO) * 100);

/* Combien de PO pour une mise, fatigue intégrée sur toute la vente.
   E = (ancre / cours) * F * (e^(p1/F) - e^(p0/F)), résolu en p1. */
export function poPourMise(S, mise) {
  const ancre = ancrePO(S), c = coursBase(S, mise), F = FATIGUE_PO, p0 = S.poRun;
  const p1 = F * Math.log(Math.exp(p0 / F) + (Math.max(0, mise) * c) / (ancre * F));
  const po = Math.floor(p1 - p0);
  if (po < 1) return { po: 0, depense: 0, prixMoyen: Math.ceil(ancre / c) };
  const depense = Math.ceil((ancre / c) * F * (Math.exp((p0 + po) / F) - Math.exp(p0 / F)));
  return { po, depense, prixMoyen: Math.ceil(depense / po) };
}
export const prochainPO = (S) =>
  Math.ceil((ancrePO(S) / coursBase(S, 0)) * FATIGUE_PO
    * (Math.exp((S.poRun + 1) / FATIGUE_PO) - Math.exp(S.poRun / FATIGUE_PO)));

export const eclatsDispo = (S) =>
  S.profondeurMax < 5 ? 0 : Math.max(0, Math.floor(Math.sqrt(S.etoileTotale / 4e6)) - S.eclats);
export const coutUn = (S, c) => Math.ceil(c.base * Math.pow(1.15, S.compagnons[c.id] || 0));
export const coutN = (S, c, n) =>
  Math.ceil(c.base * Math.pow(1.15, S.compagnons[c.id] || 0) * (Math.pow(1.15, n) - 1) / 0.15);
export const nbAbordable = (S, c) => {
  const unite = c.base * Math.pow(1.15, S.compagnons[c.id] || 0);
  return Math.max(0, Math.min(500, Math.floor(Math.log(S.etoile * 0.15 / unite + 1) / Math.log(1.15))));
};

/* ── Le semis d'étoile d'un filon ──────────────────────────────────────────
   Chaque filon a son propre semis : c'est ce qui fait qu'aucun bloc de roche ne
   ressemble au précédent. Deux corrections par rapport au tirage naïf.

   1. Le recouvrement est constant. Le nombre d'éclats variait de cinq à huit et
      leur taille de six à seize, indépendamment : l'aire totale allait donc du
      simple au décuple, et un filon sur trois paraissait vide quand le suivant
      était constellé. Les tailles sont maintenant tirées en valeurs relatives
      puis mises à l'échelle pour que la somme des aires vaille toujours la même
      fraction de la roche. La variété des tailles est conservée, c'est leur
      total qui est fixé.

   2. Les positions sont réparties, pas seulement aléatoires. Un tirage uniforme
      sur si peu de points produit des grappes et des vides. Chaque éclat est
      choisi parmi douze candidats, celui qui s'éloigne le plus de ses voisins
      déjà posés — c'est le tirage « meilleur candidat » de Mitchell, qui donne
      un bruit bleu : ça reste imprévisible, mais ça ne s'agglutine plus.        */

/* Ellipse inscrite dans le bloc de roche, en unités du viewBox 400 × 300. */
export const SEMIS = { cx: 197, cy: 155, rx: 106, ry: 78 };
/* Un éclat est un losange de demi-diagonales t et 0,58 t, donc d'aire 1,16 t². */
export const AIRE_ECLAT = 1.16;
/* Part de l'ellipse couverte par l'étoile, quel que soit le filon. */
export const PART_ETOILE = 0.036;

export function genererEclats() {
  const n = 5 + Math.floor(Math.random() * 4);

  /* Tailles relatives, puis mise à l'échelle sur l'aire visée. */
  const poids = Array.from({ length: n }, () => 0.62 + Math.random() * 0.83);
  const cible = Math.PI * SEMIS.rx * SEMIS.ry * PART_ETOILE;
  const somme = poids.reduce((a, w) => a + w * w, 0);
  const k = Math.sqrt(cible / (AIRE_ECLAT * somme));
  const tailles = poids.map((w) => k * w).sort((a, b) => b - a);

  const out = [];
  for (const t of tailles) {
    /* Marge : l'éclat doit tenir entier dans la roche, donc on rétrécit
       l'ellipse de placement de sa propre demi-diagonale. */
    const rx = Math.max(6, SEMIS.rx - t * 1.15);
    const ry = Math.max(6, SEMIS.ry - t * 1.15);
    let meilleur = null;
    let meilleureDistance = -1;
    for (let c = 0; c < 12; c++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());          // uniforme en aire
      const x = SEMIS.cx + Math.cos(a) * r * rx;
      const y = SEMIS.cy + Math.sin(a) * r * ry;
      /* Distance au voisin le plus proche, normalisée par les tailles : deux
         gros éclats doivent s'écarter plus que deux petits. */
      let d = Infinity;
      for (const e of out) {
        d = Math.min(d, Math.hypot(e.x - x, e.y - y) - (e.t + t) * 0.62);
      }
      if (d > meilleureDistance) { meilleureDistance = d; meilleur = { x, y }; }
    }
    out.push({ x: meilleur.x, y: meilleur.y, t, rot: Math.round((Math.random() * 2 - 1) * 24) });
  }
  return out;
}

export function strate(p) {
  if (p <= STRATES.length) return STRATES[p - 1];
  return { nom: "Abîme de Kazim, niveau " + (p - STRATES.length + 1),
           sous: "On ne remonte pas d'ici avec la même tête." };
}
