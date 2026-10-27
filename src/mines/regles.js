/**
 * Mines de Kazim — les règles : constantes d'économie et formules pures.
 *
 * Tout ici prend l'état de la partie `S` et rend un nombre, sans effet de
 * bord : c'est ce qui permet à `scripts/audit-economie.mjs` et aux tests de
 * rejouer l'économie sans navigateur. Une formule qui change ici change
 * partout — l'interface ne recalcule rien de son côté.
 */
import { STRATES, COMPAGNONS, EQUIPEMENT, AMELIORATIONS, COMMANDES } from "./donnees.js";
import {
  aFaveur, rendementAbsence, absenceMax, fortuneOfferte, multCritique, petitesCommandes,
} from "./faveur.js";

export const FILONS_PAR_STRATE = 12;

/* ── La pente des strates (retour bêta, 07/10/2026) ───────────────────────
   Les points de roche montaient de ×3,2 par strate et un filon rendait 24 %
   de ce qu'il avait coûté. L'équipe se rembourse donc en une minute au
   début, sa production double toutes les cinq : un vrai joueur était à la
   strate 12 en vingt-six minutes, et Clément à la strate 25 en moins d'une
   semaine. Les huit strates nommées défilaient dans la première heure.

   Deux leviers, mesurés par `scripts/audit-strates.mjs` :
   - la récolte tombe à 7 % (`RECOLTE`) : l'équipe se rembourse trois fois
     et demie moins vite, c'est ce qui freine la première heure ;
   - la pente des strates monte d'elle-même (`echelle`) : ×6 par strate,
     multiplié de 8 % de plus à chaque strate franchie. Elle borne le
     milieu et la fin de partie, là où la récolte seule ne joue plus.
   Même joueur, une heure par jour : strate 7 au premier soir au lieu de 13,
   13 à une semaine au lieu de 28, 16 à deux mois au lieu de 32.

   L'accélération n'a pas de plafond : depuis que les éclats se comptent en
   strates (voir plus bas), elle ne fait plus mur — la simulation de la Faveur
   descend encore d'une strate tous les quinze jours au troisième mois. */
export const RECOLTE = 0.07;
export const PENTE_STRATE = 6;
export const ACCELERATION_STRATE = 1.08;
export const echelle = (p) =>
  Math.pow(PENTE_STRATE, p - 1) * Math.pow(ACCELERATION_STRATE, ((p - 1) * (p - 2)) / 2);
/* Version des règles. Une partie jouée sous des règles antérieures repart
   de zéro au chargement, avec un écran pour le dire (`relireMine`,
   `sauvegarde.js`) : 2 était la pente du 07/10/2026, 3 la refonte des
   commandes, des éclats comptés en strates et de la Faveur. */
export const REGLES_VERSION = 3;

/* ── Ce qui sort de la mine (refonte du 07/10/2026) ───────────────────────
   La mine vendait son étoile aux kobolds à un cours qui s'épuisait, ne se
   reconstituait qu'à l'effondrement et s'appauvrissait d'une dette à chaque
   effondrement. Six modificateurs que personne ne lisait, et une stratégie
   cachée : le joueur qui réinvestit son étoile, comme dans tout clicker,
   touchait de 0 à 100 PO par jour ; celui qui stockait une demi-heure puis
   vendait tout touchait 400. Voir docs/conception/mines.md.

   Les kobolds passent désormais commande : Tafix apporte chaque jour trois
   commandes à paie fixe, dont la demande suit la production de l'équipe
   (`commandesDuJour`). La grosse demande de l'étoile fraîche, sortie page
   ouverte : la production d'absence n'y compte pas. */
export const PIOCHES = ["p4", "p3", "p2", "p1"];


export const equipA = (S, id) => S.equipement.indexOf(id) !== -1;
export const equipMult = (S, type) =>
  EQUIPEMENT.reduce((m, e) => (e.type === type && equipA(S, e.id) ? m * e.val : m), 1);
/* ── Les éclats ───────────────────────────────────────────────────────────
   Deuxième version (07/10/2026). Ils suivaient la racine cubique de l'étoile
   cumulée ; avec la Faveur du Fossoyeur, qui raccourcit chaque mine, la boucle
   corrigée en septembre se rouvrait — 3 000 éclats en deux semaines à vingt
   minutes par jour, l'arbre entier acheté en dix jours.

   Un effondrement rapporte maintenant **un éclat par strate atteinte au-delà
   de la quatrième, dans cette mine**. La strate est déjà le logarithme de
   l'étoile : plus de boucle possible, et le gain se lit d'avance. L'éclat ne
   touche que les dégâts, comme avant. */
export const ECLAT_BONUS = 0.03;      // dégâts ajoutés par éclat
export const STRATE_ECLATS = 5;       // première strate qui rapporte
export const mEclats = (S) => 1 + S.eclats * ECLAT_BONUS;

/* ── Troisième version : les éclats se gagnent sur le record (27/10/2026) ─
   Compter les éclats dans la mine en cours bornait ce que rapporte une mine,
   pas le nombre de mines par heure. Avec la Mémoire et les éclats, la
   strate 12 tombait en une minute : huit éclats toutes les deux minutes,
   l'arbre entier en moins de dix heures de jeu (audit du 27/10/2026,
   `claude/audit-mines-gameplay.md`).

   Le total des éclats gagnés est maintenant une fonction du **record** de
   profondeur, toutes mines confondues, et un effondrement ne verse que la
   différence avec ce qui a déjà été gagné : le modèle de Cookie Clicker, où
   le prestige suit le cumul de toujours. Refaire la même mine ne rapporte
   rien ; seul aller plus loin paie.

   La courbe est cubique : le pas d'une strate de record grandit avec la
   profondeur, comme son coût (record 7 : 4 éclats, 10 : 36, 13 : 121,
   16 : 288). Avec la pente des strates, l'arbre (257) se complète vers la
   strate 16 : cinq à six semaines à une heure par jour. Calée par
   `scripts/audit-eclats.mjs`. */
export const ECLATS_DIVISEUR = 6;
export const eclatsDuRecord = (p) => {
  const n = Math.max(0, Math.floor(p) - STRATE_ECLATS + 1);
  return Math.floor((n * n * n) / ECLATS_DIVISEUR);
};
/** La strate la plus profonde jamais atteinte, mine en cours comprise. */
export const record = (S) => Math.max(S.record || 0, S.profondeurMax || 1);
/* Force convertit la présence en revenu : une frappe vaut une fraction de la
   production passive, donc cliquer reste utile quand les compagnons pèsent des
   millions. Sans cela, Discipline écrase tout le reste par construction. */
/* Les pioches ajoutent des secondes de production à la frappe (27/10/2026).
   Elles multipliaient la frappe de base, que la part de production dépasse dès
   la strate 3 : passé les premières minutes, aucune n'avait plus d'effet, et
   la Pioche de Kazim s'achetait pour rien (audit du 27/10/2026). */
export const equipSecondes = (S) =>
  EQUIPEMENT.reduce((t, e) => (e.type === "frappe" && equipA(S, e.id) ? t + e.val : t), 0);
export const secondesParFrappe = (S) => 0.15 + 0.12 * S.talents.force + equipSecondes(S);
export const degatsClic = (S) => Math.max(
  (1 + S.talents.force * 0.3 + 20 * equipSecondes(S)) * mEclats(S),
  dpsBrut(S) * secondesParFrappe(S)
);
/* Les talents plafonnés le disent (27/10/2026) : au-delà, le bouton se grise.
   Écho plafonnait à 15 % de critique, soit 7,5 points, et Fortune à 35 % de
   filons riches : les points suivants se plaçaient sans rien faire, et la
   Mémoire les rendait perdus pour toujours. Écho passe à 16 % pour tomber
   juste sur le huitième point. */
export const TALENT_MAX = { echo: 8, fortune: 12 };
/** Le dernier point de talent utile. Le point de Fortune offert par l'Œil compte. */
export const talentMax = (S, id) =>
  id === "fortune" ? TALENT_MAX.fortune - fortuneOfferte(S) : TALENT_MAX[id] ?? Infinity;
/** La valeur qui agit : le talent placé, plus ce que la Faveur offre. */
export const talentEffectif = (S, id) => (id === "fortune" ? fortune(S) : S.talents[id]);
export const critChance = (S) =>
  Math.min(75, EQUIPEMENT.reduce(
    (c, e) => (equipA(S, e.id) && (e.type === "crit" || e.type === "crit2") ? c + e.val : c),
    Math.min(2 * TALENT_MAX.echo, S.talents.echo * 2)
  ));
export const critMult = (S) => multCritique(S, equipA(S, "l2"));
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
/* Sans les éclats : voir plus haut, c'est le carré qui emballait la mine. */
export const multRecolte = (S) => equipMult(S, "recolte");
/* Fortune ne touche pas la moyenne par la même porte que Discipline : elle
   gonfle la fréquence des filons qui rendent plus, donc la variance. */
export const fortune = (S) => S.talents.fortune + fortuneOfferte(S);
export const chanceEvenement = (S) => Math.min(0.35, 0.05 * (1 + 0.5 * fortune(S)));
/* Un filon sur combien rend plus. Le chiffre est affiché sous les talents :
   douze points placés dans Fortune ne se voyaient nulle part. */
export const unFilonSur = (S) => Math.max(1, Math.round(1 / chanceEvenement(S)));
/* En pourcentage : « un sur 3 » ne bougeait plus à partir de Fortune 8, et
   l'Œil du sourcier paraissait sans effet (audit du 27/10/2026). */
export const partRiche = (S) => Math.round(chanceEvenement(S) * 1000) / 10;
/* La teinte des filons qui rendent plus : ambre à zéro point de Fortune, rouge
   franc à dix. Le talent gouverne la fréquence ; la couleur dit jusqu'où on
   l'a poussé, ce qu'aucun chiffre de l'interface ne disait. */
export const teinteFortune = (S) => Math.round(40 - 40 * Math.min(1, fortune(S) / TALENT_MAX.fortune));
export const pvFilon = (prof, brises) => Math.ceil(18 * echelle(prof) * Math.pow(1.09, brises));
export const xpRequis = (S) => Math.floor(22 * Math.pow(S.niveau, 1.55));
export const brisesIci = (S) => S.brises[S.profondeur] || 0;
/** Éclats que rapporterait un effondrement maintenant : ce que vaut le
    record, moins ce qui a déjà été gagné. Les éclats gagnés sous l'ancienne
    règle restent acquis ; ils retardent seulement les suivants. */
export const eclatsDispo = (S) => Math.max(0, eclatsDuRecord(record(S)) - (S.eclats || 0));
/** Étoile sortie par seconde par l'équipe seule, à plein rendement. */
export const etoileParSeconde = (S) => dps(S) * RECOLTE * multRecolte(S);
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

/* ── Le cycle d'un filon, sans interface ──────────────────────────────────
   Le filon naît, prend des coups, se brise et paie. Ce cycle vivait dans le
   composant, mêlé aux particules et aux messages ; il est ici pour que
   l'absence rejoue exactement les mêmes règles que le jeu en direct. */

/** Rang d'un filon à sa naissance : 0 ordinaire · 1 généreux (×4) · 2 exceptionnel (×12). */
export function tirerRang(S, r = Math.random()) {
  const seuil = chanceEvenement(S);
  return r < seuil * 0.4 ? 2 : r < seuil ? 1 : 0;
}

/* Le tirage du rang est fixé d'avance (27/10/2026) : il dépend de la mine
   (`graine`), de la strate et du numéro du filon. Remonter puis redescendre
   faisait naître un filon neuf, donc un nouveau tirage : en recommençant
   jusqu'au ×12, huit essais en moyenne, la récolte était multipliée par
   quatre. Comme les sorts du Grimoire de Cookie Clicker, l'issue ne change
   plus en revenant en arrière. */
export const tirageFilon = (S) => {
  let h = (S.graine >>> 0) ^ Math.imul(S.profondeur | 0, 0x9e3779b1) ^ Math.imul((brisesIci(S) | 0) + 1, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

/** Un filon neuf à la profondeur courante. `alea` ne sert qu'aux simulations. */
export function naitreFilon(S, alea) {
  S.pvMax = pvFilon(S.profondeur, brisesIci(S));
  S.pv = S.pvMax;
  S.filonRang = tirerRang(S, alea ? alea() : tirageFilon(S));
}

/* ── La récolte suit les coups (27/10/2026) ───────────────────────────────
   Le filon payait son étoile en une fois, en cédant. Avec les éclats gagnés
   sur le record, un joueur arrivé au mur ne gagne plus d'éclats, donc plus de
   force : au front, un seul filon demandait une semaine de production, et
   pendant cette semaine plus une étoile n'entrait — ni compagnon, ni commande
   (`audit-economie`, profil d'une heure : la grosse commande livrée un jour
   sur trois au lieu de tous les jours). Chaque coup arrache maintenant sa
   part d'étoile, comme les cookies de Cookie Clicker tombent à la seconde.
   Le total d'un filon ne change pas ; le filon riche multiplie tout ce qu'on
   lui arrache. */
export const multRang = (rang) => (rang === 2 ? 12 : rang === 1 ? 4 : 1);
export const recolteDe = (S, d) => d * RECOLTE * multRecolte(S) * multRang(S.filonRang || 0);
/** `d` points de dégâts sur le filon courant, sans le briser (`d` ≤ `S.pv`). */
export function entamer(S, d) {
  const e = recolteDe(S, d);
  S.pv -= d;
  S.etoile += e;
  S.etoileTotale += e;
  return e;
}
/** Une frappe au-delà, et le reste des dégâts est perdu : ce n'est jamais arrivé. */
export const FILONS_PAR_COUP = 500;
/**
 * Inflige `d` points de dégâts : entame le filon, le brise, passe au suivant.
 * `quandBrise` reçoit le bilan de chaque filon brisé (l'interface l'annonce).
 * Rend le nombre de filons brisés.
 */
export function infliger(S, d, quandBrise = null, alea, max = FILONS_PAR_COUP) {
  let n = 0;
  while (d > 0 && n < max) {
    if (d < S.pv) { entamer(S, d); break; }
    d -= S.pv;
    entamer(S, S.pv);
    const r = briser(S, alea);
    n++;
    if (quandBrise) quandBrise(r);
  }
  return n;
}

/* L'expérience suit la dureté (27/10/2026). Chaque filon rapportait
   l'expérience de sa strate, si tendre soit-il : remonter dans une mine neuve
   et briser des centaines de filons d'une frappe donnait autant que quatre
   cents filons du front — 2,4 niveaux par mine, rejoués à chaque
   effondrement. Un filon du front rapporte ce qu'il rapportait ; un filon
   plus tendre, au prorata de sa résistance. L'expérience par point de dégât
   est donc la même partout dans la mine. */
export const xpFront = (S) => 5 * Math.pow(S.profondeurMax || 1, 1.25);
export function xpFilon(S) {
  const front = pvFilon(S.profondeurMax || 1, S.brises[S.profondeurMax] || 0);
  const durete = front > 0 ? Math.min(1, S.pvMax / front) : 1;
  return Math.round(xpFront(S) * durete);
}

/**
 * Le filon courant cède : récolte, expérience, niveaux, et descente quand la
 * strate la plus profonde atteinte est épuisée. Rend ce qui s'est passé, pour
 * que l'appelant l'annonce à sa façon.
 */
export function briser(S, alea) {
  const rang = S.filonRang || 0;
  // Ce que le filon a rendu en tout, coup après coup (voir `entamer`).
  const recolte = S.pvMax * RECOLTE * multRecolte(S) * multRang(rang);
  S.xp += xpFilon(S);
  S.brises[S.profondeur] = brisesIci(S) + 1;
  S.brisesTotal++;
  let niveaux = 0;
  while (S.xp >= xpRequis(S)) {
    S.xp -= xpRequis(S);
    S.niveau++;
    S.points++;
    niveaux++;
  }
  let descente = false;
  if (S.brises[S.profondeur] >= FILONS_PAR_STRATE && S.profondeur === S.profondeurMax) {
    S.profondeur++;
    S.profondeurMax = S.profondeur;
    descente = true;
  }
  naitreFilon(S, alea);
  return { rang, recolte, niveaux, descente };
}

/** Part du travail de l'équipe retenue pendant une absence, sans faveur. */
export const RENDEMENT_ABSENCE = 0.35;
/** Au-delà, l'absence ne rapporte plus rien : la mine attend son contremaître. */
export const ABSENCE_MAX = 8 * 3600000;
export { rendementAbsence, absenceMax };
/** Garde-fou de boucle ; les filons durcissent assez vite pour ne jamais l'atteindre. */
const FILONS_MAX_ABSENCE = 20000;

/**
 * Rejoue `ms` millisecondes de travail de l'équipe, au rendement donné : les
 * filons se brisent, la strate se vide, on descend — comme si l'on avait
 * laissé la page ouverte, en plus lent. Rend le bilan.
 */
export function simulerAbsence(S, ms, rendement = rendementAbsence(S), alea) {
  const bilan = { ms, filons: 0, etoile: 0, niveaux: 0, strates: 0, exceptionnels: 0 };
  const duree = Math.max(0, Math.min(absenceMax(S), ms));
  let d = dps(S) * (duree / 1000) * rendement;
  if (!(d > 0)) return bilan;
  if (!S.pvMax) naitreFilon(S, alea);
  const avant = S.etoile;
  bilan.filons = infliger(S, d, (r) => {
    bilan.niveaux += r.niveaux;
    if (r.descente) bilan.strates++;
    if (r.rang === 2) bilan.exceptionnels++;
  }, alea, FILONS_MAX_ABSENCE);
  bilan.etoile = S.etoile - avant;
  return bilan;
}

/* ── Les commandes de Tafix ───────────────────────────────────────────────
   Trois commandes par jour, date locale, comme le Comptoir. La demande est
   relative — des minutes de production du moment (`productionNominale`),
   avec un plancher en filons pour la première minute —
   et la paie est fixe : l'économie du site se règle au PO près, sans rien
   savoir de la profondeur de la mine.

   Modèle hybride (décision du 07/10/2026) : la petite et la moyenne se
   remplissent d'une nuit d'absence, c'est la récompense du passage
   quotidien ; la grosse demande de l'étoile fraîche — un quart d'heure de
   mine, page ouverte et visible, depuis son arrivée (le principe du cookie
   doré).

   Fraîche se mesure en temps et non en étoile : la première version
   comptait l'étoile sortie page ouverte, mais un joueur qui dépense en
   arrivant le stock de sa nuit multiplie sa production par dix en deux
   minutes, et le simple passage remplissait la grosse un jour sur cinq
   (`audit-economie.mjs`). */
export const jourLocal = (d = new Date()) => d.toLocaleDateString("sv");

/** Le jour suivant `jour` (AAAA-MM-JJ, local). */
export function lendemain(jour) {
  const [a, m, j] = jour.split("-").map(Number);
  return jourLocal(new Date(a, m - 1, j + 1));
}

/** Les commandes du jour, tirées à la première visite du jour. */
/* Ce que sort le joueur par seconde, page ouverte : l'équipe, plus une
   frappe toutes les cinq secondes. Sans la frappe, la demande ignorait ce
   que la pioche fait dans les premiers jours ; à une frappe par seconde, la
   petite commande du premier matin demandait mille deux cents coups. */
export const FRAPPES_NOMINALES = 0.2;
export const productionNominale = (S) => (dps(S) + FRAPPES_NOMINALES * degatsClic(S)) * RECOLTE * multRecolte(S);

export function commandesDuJour(S, jour = jourLocal()) {
  const ps = productionNominale(S);
  /* Le plancher se compte en filons de la galerie d'entrée : à la strate
     courante, il dépassait de loin ce que l'équipe sort, et une commande
     pouvait rester hors d'atteinte des jours durant. */
  const plancher = pvFilon(1, 0) * RECOLTE;
  const liste = [];
  for (const c of COMMANDES) {
    const n = c.id === "petite" ? petitesCommandes(S) : 1;
    for (let i = 0; i < n; i++) {
      liste.push({
        id: c.id + (i ? "-" + (i + 1) : ""), taille: c.id,
        demande: Math.ceil(Math.max(ps * c.minutes * 60, plancher * c.filons)),
        po: c.po, presence: c.presence || 0, depart: S.presence || 0, livree: false,
      });
    }
  }
  return { jour, liste };
}

/** Rafraîchit les commandes si un jour nouveau s'est levé. Rend `true` s'il y en a de nouvelles. */
export function majCommandes(S, jour = jourLocal()) {
  /* Seulement si le jour est *postérieur* à celui des commandes (les dates
     AAAA-MM-JJ se comparent comme des chaînes). Avec « différent », avancer
     puis reculer l'horloge de l'appareil rendait trois commandes neuves à
     chaque bascule : 2 200 PO pour dix aller-retour (audit du 09/10/2026).
     Qui avance l'horloge prend de l'avance, puis attend ce jour-là. */
  /* Un jour enregistré à plus d'un jour dans le futur vient d'une horloge
     fausse, ici ou sur un autre appareil du compte (la synchro garde le jour
     le plus récent) : on le ramène à aujourd'hui, sans commandes neuves.
     Sinon plus aucune commande jusqu'à cette date (relecture, 09/10/2026). */
  if (S.commandes && S.commandes.jour > lendemain(jour)) S.commandes = { ...S.commandes, jour };
  if (S.commandes && !(jour > S.commandes.jour)) return false;
  S.commandes = commandesDuJour(S, jour);
  return true;
}

/** Le plus que les commandes d'un jour peuvent payer : toutes livrées, la
    quatrième (Faveur « quatrieme », une petite de plus) comprise. L'application
    n'en crédite pas davantage par jour (src/jeu/mine.js). */
export const PO_COMMANDES_JOUR = COMMANDES.reduce((t, c) => t + c.po * (c.id === "petite" ? 2 : 1), 0);

/* Frappes comptées par seconde, au plus (27/10/2026). Rien ne bornait la
   cadence : Entrée maintenue frappait à la répétition du clavier, une
   trentaine de fois par seconde, et un autoclicker à cent atteignait la
   strate 13 en trente-huit minutes. Le site a un classement. Au-delà, la
   frappe ne compte pas. Dix par seconde en continu, c'est le rythme d'un
   joueur très rapide (Mormegil, sans aide, avait la strate 13 en 81 min ;
   la cadence plafonnée y met 68 min) ; une rafale de quinze passe. */
export const FRAPPES_MAX = 10;
export const FRAPPES_RAFALE = 15;
/** Une horloge en arrière de plus d'un jour est fausse : on la croit. Moins,
    on attend qu'elle rattrape l'instant déjà joué. */
export const HORLOGE_TOLERANCE = 24 * 3600000;
/** Au-delà, un onglet caché compte comme une absence, à son rendement. */
export const CACHE_MAX = 60000;

/* L'étoile filante attrapée : frappes multipliées le temps de la frénésie. */
export const FRENESIE = { duree: 15000, mult: 7 };
/** La frénésie court-elle à l'instant `t` ? Sa fin ne peut pas être plus loin
    que sa durée : une étoile attrapée horloge avancée, puis l'horloge remise à
    l'heure, laissait sinon la frénésie courir des heures. */
export const enFrenesie = (fin, t = Date.now()) => fin > t && fin - t <= FRENESIE.duree;

/** Minutes de mine (page ouverte et visible) passées depuis l'arrivée d'une commande. */
export const presencePour = (S, c) => Math.max(0, ((S.presence || 0) - (c.depart || 0)) / 60);
/** Ce qui manque encore en étoile (le temps de présence se lit à part). */
export const manque = (S, c) => (c.livree ? 0 : Math.max(0, c.demande - S.etoile));
export const livrable = (S, c) =>
  !c.livree && manque(S, c) <= 0 && presencePour(S, c) >= (c.presence || 0);

/** Livre une commande. Rend les PO à verser, ou 0. */
export function livrer(S, id) {
  const c = S.commandes && S.commandes.liste.find((x) => x.id === id);
  if (!c || !livrable(S, c)) return 0;
  S.etoile -= c.demande;
  c.livree = true;
  S.poGagnes = (S.poGagnes || 0) + c.po;
  return c.po;
}

/* ── L'effondrement ────────────────────────────────────────────────────── */

export const MEMOIRE_PART = 1 / 3;
export const PUITS_PART = 1 / 3;

/**
 * La mine d'après. Ce qui reste : les éclats (et ceux qu'on vient de
 * gagner), la Faveur, les compteurs de toujours et les commandes du jour.
 * L'Héritage décide de ce qu'on retrouve en rouvrant.
 */
export function effondrer(S, neuve) {
  const gain = eclatsDispo(S);
  if (gain < 1) return null;
  const n = neuve();
  Object.assign(n, {
    record: record(S), niveauRecord: Math.max(S.niveauRecord || 0, S.niveau || 1),
    eclats: S.eclats + gain, eclatsDepenses: S.eclatsDepenses || 0, faveurs: [...(S.faveurs || [])],
    effondrements: S.effondrements + 1, etoileTotale: S.etoileTotale, echanges: S.echanges,
    poGagnes: S.poGagnes, commandes: S.commandes, presence: S.presence || 0,
  });
  if (aFaveur(n, "plans")) n.equipement = ["p1", "l1"];
  if (aFaveur(n, "equipe")) n.compagnons = { fanal: 10, nain: 5 };
  /* La Mémoire (27/10/2026) rouvre au tiers du meilleur niveau, points à
     replacer. Elle gardait talents et niveau entiers : la mine neuve partait
     avec toute la force de la précédente, et la strate 12 tombait en une
     minute. Replacer à chaque mine sert aussi de remise à plat des talents. */
  if (aFaveur(n, "memoire")) {
    const niveau = Math.max(1, Math.floor(n.niveauRecord * MEMOIRE_PART));
    Object.assign(n, { niveau, xp: 0, points: niveau - 1 });
  }
  /* Le Puits rouvre au tiers du record : la strate 3 ne faisait plus gagner
     une seule frappe au moment où l'on pouvait se l'offrir. */
  if (aFaveur(n, "puits")) {
    const p = Math.max(1, Math.floor(n.record * PUITS_PART));
    n.profondeur = p; n.profondeurMax = p;
  }
  /* Les commandes pas encore livrées se remettent à la mesure de la mine
     neuve : tirées le matin sur une équipe de millions, elles devenaient
     inatteignables jusqu'au soir pour qui effondrait à midi. Elles ne font
     que baisser — effondrer n'est pas un moyen de les renchérir. */
  if (n.commandes) {
    const neuves = commandesDuJour(n, n.commandes.jour);
    n.commandes = {
      ...n.commandes,
      liste: n.commandes.liste.map((c) => {
        const m = neuves.liste.find((x) => x.id === c.id);
        return c.livree || !m ? c : { ...c, demande: Math.min(c.demande, m.demande) };
      }),
    };
  }
  return { mine: n, gain };
}
