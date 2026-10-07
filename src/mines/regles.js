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
/* La teinte des filons qui rendent plus : ambre à zéro point de Fortune, rouge
   franc à dix. Le talent gouverne la fréquence ; la couleur dit jusqu'où on
   l'a poussé, ce qu'aucun chiffre de l'interface ne disait. */
export const teinteFortune = (S) => Math.round(40 - 40 * Math.min(1, fortune(S) / 10));
export const pvFilon = (prof, brises) => Math.ceil(18 * echelle(prof) * Math.pow(1.09, brises));
export const xpRequis = (S) => Math.floor(22 * Math.pow(S.niveau, 1.55));
export const brisesIci = (S) => S.brises[S.profondeur] || 0;
/** Éclats que rapporterait un effondrement maintenant. */
export const eclatsDispo = (S) =>
  S.profondeurMax < STRATE_ECLATS ? 0 : S.profondeurMax - STRATE_ECLATS + 1;
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

/** Un filon neuf à la profondeur courante. */
export function naitreFilon(S, alea = Math.random) {
  S.pvMax = pvFilon(S.profondeur, brisesIci(S));
  S.pv = S.pvMax;
  S.filonRang = tirerRang(S, alea());
}

/**
 * Le filon courant cède : récolte, expérience, niveaux, et descente quand la
 * strate la plus profonde atteinte est épuisée. Rend ce qui s'est passé, pour
 * que l'appelant l'annonce à sa façon.
 */
export function briser(S, alea = Math.random) {
  const rang = S.filonRang || 0;
  const recolte = S.pvMax * RECOLTE * multRecolte(S) * (rang === 2 ? 12 : rang === 1 ? 4 : 1);
  S.etoile += recolte;
  S.etoileTotale += recolte;
  S.brises[S.profondeur] = brisesIci(S) + 1;
  S.brisesTotal++;
  S.xp += Math.round(5 * Math.pow(S.profondeur, 1.25));
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
export function simulerAbsence(S, ms, rendement = rendementAbsence(S), alea = Math.random) {
  const bilan = { ms, filons: 0, etoile: 0, niveaux: 0, strates: 0, exceptionnels: 0 };
  const duree = Math.max(0, Math.min(absenceMax(S), ms));
  let d = dps(S) * (duree / 1000) * rendement;
  if (!(d > 0)) return bilan;
  if (!S.pvMax) naitreFilon(S, alea);
  while (d > 0 && bilan.filons < FILONS_MAX_ABSENCE) {
    if (d < S.pv) { S.pv -= d; d = 0; break; }
    d -= S.pv;
    S.pv = 0;
    const r = briser(S, alea);
    bilan.filons++;
    bilan.etoile += r.recolte;
    bilan.niveaux += r.niveaux;
    if (r.descente) bilan.strates++;
    if (r.rang === 2) bilan.exceptionnels++;
  }
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

/** Rafraîchit les commandes si le jour a changé. Rend `true` s'il y en a de nouvelles. */
export function majCommandes(S, jour = jourLocal()) {
  if (S.commandes && S.commandes.jour === jour) return false;
  S.commandes = commandesDuJour(S, jour);
  return true;
}

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
    eclats: S.eclats + gain, eclatsDepenses: S.eclatsDepenses || 0, faveurs: [...(S.faveurs || [])],
    effondrements: S.effondrements + 1, etoileTotale: S.etoileTotale, echanges: S.echanges,
    poGagnes: S.poGagnes, commandes: S.commandes, presence: S.presence || 0,
  });
  if (aFaveur(n, "plans")) n.equipement = ["p1", "l1"];
  if (aFaveur(n, "equipe")) n.compagnons = { fanal: 10, nain: 5 };
  // Les talents gardés gardent leur niveau : sinon les niveaux regagnés
  // donneraient une seconde fois les mêmes points.
  if (aFaveur(n, "memoire")) Object.assign(n, { talents: { ...S.talents }, niveau: S.niveau, xp: S.xp, points: S.points });
  if (aFaveur(n, "puits")) { n.profondeur = 3; n.profondeurMax = 3; }
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
