/**
 * Le colporteur — l'évènement rare de l'ouverture.
 * ------------------------------------------------------------------
 *
 * Mirko passe sur les routes de Thalazur avec son ballot. Il s'arrête
 * rarement, il ne s'arrête jamais deux fois le même jour, et il ne reste que
 * le temps d'une affaire : une seule de ses propositions peut être prise, et
 * elles disparaissent avec lui.
 *
 * Ce module ne contient que la décision et l'arithmétique. Il ne connaît ni
 * React, ni le stockage : on lui donne un état, il rend des propositions.
 * C'est ce qui permet de l'auditer en ligne de commande — voir
 * scripts/audit-colporteur.mjs.
 *
 * ── Pourquoi il ne casse pas l'économie ───────────────────────────────────
 * Les cinq propositions ont été choisies pour qu'aucune ne crée de pièces à
 * partir de rien. Le lot convertit du surplus en PO *moins bien* que le
 * Comptoir (×2,2 contre ×2,4 corrigé de l'affinité, soit ≈ ×3 en pratique) :
 * sa valeur n'est pas le prix mais le volume et l'absence d'affinité, car un
 * commun sans acheteur au Comptoir ne se vend nulle part. Le troc et
 * le lustrage ne versent aucune pièce. Le pari et la botte sont des dépenses.
 * Reste la remise de la botte, cinquante pièces, sur une visite par jour au
 * plus : de l'ordre d'un dixième de booster par jour. Voir
 * docs/audit-economie.md.
 */

import { REVENTE, ECONOMIE, TIERS_ROSTER, TIER_INFO } from "./tiers.js";

/** Son identité. Il a quitté le tableau des acheteurs du Comptoir : un
 *  colporteur qui tiendrait boutique tous les trois jours n'en serait plus un. */
export const COLPORTEUR = {
  id: "colporteur",
  portrait: "mirko",
  nom: "Mirko",
  sub: "Colporteur des routes du Nord",
  quote: "« Je ne vends rien. Je fais seulement circuler ce qui dort. »",
};

/**
 * Fréquence de passage.
 *
 * `parBooster` est la chance à chaque ouverture. `pitie` force la visite quand
 * il s'est fait attendre — sans ce filet, la moitié des joueurs d'un site de
 * campagne ne le croiseraient jamais et l'évènement n'existerait que pour moi.
 * `apresBooster` le retient le temps que la boucle de base soit comprise.
 */
export const VISITE = {
  parBooster: 0.08,
  apresBooster: 3,
  pitie: 18,
};

/** Ce qu'il paie un doublon, en multiple de la revente garantie. */
const LOT_RATIO = 2.2;

/** Ses tarifs. */
export const TARIFS = {
  botte: 70,      // un sachet sous le manteau, contre 120 à l'étagère
  pari: 55,       // une carte scellée, peu commune au minimum
  lustrage: 120, // le chiffon et la salive de dragon
};

/** Table du pari : le plancher est peu commun, le reste est de la chance. */
export const TABLE_PARI = { peucommun: 0.76, rare: 0.2, legendaire: 0.04 };

/* ── Générateur pseudo-aléatoire à graine ──────────────────────────────────
   Les propositions doivent être stables : le même passage doit rendre les
   mêmes affaires d'un rendu React à l'autre, sinon le prix change sous le
   doigt du joueur. */
export function semis(graine) {
  let x = (graine | 0) || 0x9e3779b9;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 100000) / 100000;
  };
}

/** Le jour local, en entier, pour indexer la visite sur la date réelle. */
export const jourLocal = (d = new Date()) => d.toLocaleDateString("sv");

/**
 * Décide si Mirko s'arrête. `memoire` est la tranche persistée :
 * `{ jour, depuis }` — le dernier jour où il est passé, et le nombre de
 * boosters ouverts depuis.
 */
export function passeAujourdhui(memoire, ouverts, rng = Math.random, jour = jourLocal()) {
  if (ouverts < VISITE.apresBooster) return false;
  if (memoire && memoire.jour === jour) return false; // un seul passage par jour
  const depuis = (memoire && memoire.depuis) || 0;
  if (depuis + 1 >= VISITE.pitie) return true;
  return rng() < VISITE.parBooster;
}

/* ── Lecture de l'inventaire ───────────────────────────────────────────── */

const ECHELLE = TIERS_ROSTER.map((t) => t.id);

/** Le surplus, à plat : une ligne par exemplaire au delà de la case remplie. */
export function surplusParPalier(collection) {
  const par = {};
  for (const [carteId, e] of Object.entries(collection || {})) {
    const tier = e.carte?.tier;
    if (!tier) continue;
    for (const version of ["normale", "rainbow"]) {
      const n = Math.max(0, (e[version] || 0) - 1);
      if (!n) continue;
      (par[tier] ||= []).push({ carteId, version, n, carte: e.carte });
    }
  }
  return par;
}

/** Les cartes d'un palier qu'on ne possède pas encore, version normale. */
const manquantes = (pool, collection, tier) =>
  (pool[tier] || []).filter((c) => !(collection[c.id] && collection[c.id].normale));

/* ── Les cinq affaires ─────────────────────────────────────────────────────
   Chaque générateur rend `null` quand l'état du joueur ne s'y prête pas :
   c'est ce qui fait que Mirko propose toujours quelque chose de pertinent
   plutôt qu'un menu figé aux trois quarts grisé. */

/** « Le lot » — il emporte tout le surplus d'un palier, d'un coup. */
function dealLot({ collection }) {
  const par = surplusParPalier(collection);
  let choix = null;
  for (const [tier, lignes] of Object.entries(par)) {
    const n = lignes.reduce((s, l) => s + l.n, 0);
    if (n < 2) continue;
    const po = Math.round(n * (REVENTE[tier] || 2) * LOT_RATIO);
    if (!choix || po > choix.po) choix = { tier, lignes, n, po };
  }
  if (!choix) return null;
  const nom = TIER_INFO[choix.tier].nom.toLowerCase();
  return {
    id: "lot",
    titre: "Le lot",
    phrase: `« Tes ${choix.n} doublons ${nom}s ? Je prends tout, sans trier. »`,
    detail: `${choix.n} exemplaire${choix.n > 1 ? "s" : ""} en surplus quitte${choix.n > 1 ? "nt" : ""} ta collection.`,
    gain: choix.po,
    cout: 0,
    effet: {
      retire: choix.lignes.map((l) => ({ carteId: l.carteId, version: l.version, n: l.n })),
      po: choix.po,
    },
  };
}

/** « La botte » — un sachet sous le manteau, ouvert sur-le-champ. */
function dealBotte({ bourse }) {
  if (bourse.po < TARIFS.botte) return null;
  return {
    id: "botte",
    titre: "La botte",
    phrase: "« J'ai un sachet au fond du ballot. Personne ne l'a compté. »",
    detail: `Un booster complet à ${TARIFS.botte} PO au lieu de ${ECONOMIE.prix}, ouvert tout de suite.`,
    cout: TARIFS.botte,
    effet: { botte: TARIFS.botte },
  };
}

/** « Le pari » — une carte scellée, peu commune au minimum. */
function dealPari({ bourse, pool }) {
  if (bourse.po < TARIFS.pari) return null;
  const possible = ECHELLE.slice(1).some((t) => (pool[t] || []).length);
  if (!possible) return null;
  return {
    id: "pari",
    titre: "Le pari du colporteur",
    phrase: "« Une carte, scellée. Peu commune au pire. Au mieux, tu me remercieras. »",
    detail: `${TARIFS.pari} PO, tirée devant toi. Peu commun garanti, une chance sur cinq de rare.`,
    cout: TARIFS.pari,
    effet: { pari: true },
  };
}

/** « Le troc » — trois doublons d'un palier contre une carte neuve du palier au-dessus. */
function dealTroc({ collection, pool }) {
  const par = surplusParPalier(collection);
  for (let i = 0; i < ECHELLE.length - 1; i++) {
    const bas = ECHELLE[i];
    const haut = ECHELLE[i + 1];
    const lignes = par[bas] || [];
    const total = lignes.reduce((s, l) => s + l.n, 0);
    if (total < 3) continue;
    const cibles = manquantes(pool, collection, haut);
    if (!cibles.length) continue;

    // On prélève trois exemplaires en commençant par les cartes les plus
    // encombrées : le joueur garde ainsi la plus grande variété de doublons.
    const tri = [...lignes].sort((a, b) => b.n - a.n);
    const retire = [];
    let reste = 3;
    for (const l of tri) {
      if (!reste) break;
      const pris = Math.min(l.n, reste);
      retire.push({ carteId: l.carteId, version: l.version, n: pris });
      reste -= pris;
    }
    return {
      id: "troc",
      titre: "Le troc",
      phrase: `« Trois ${TIER_INFO[bas].nom.toLowerCase()}s dont tu ne fais rien, contre un ${TIER_INFO[haut].nom.toLowerCase()} qui te manque. »`,
      detail: `3 doublons ${TIER_INFO[bas].nom.toLowerCase()}s contre une carte ${TIER_INFO[haut].nom.toLowerCase()} absente de ta collection.`,
      cout: 0,
      effet: { retire, troc: haut },
    };
  }
  return null;
}

/** « Le lustrage » — il lustre un doublon jusqu'à l'écaille. */
function dealLustrage({ collection, bourse }) {
  if (bourse.po < TARIFS.lustrage) return null;
  let choix = null;
  for (const [carteId, e] of Object.entries(collection || {})) {
    if ((e.normale || 0) < 2 || (e.rainbow || 0) > 0) continue;
    const rang = ECHELLE.indexOf(e.carte?.tier);
    if (rang < 0) continue;
    if (!choix || rang > choix.rang) choix = { carteId, rang, carte: e.carte };
  }
  if (!choix) return null;
  return {
    id: "lustrage",
    titre: "Le lustrage",
    phrase: `« Ton double de ${choix.carte.nom} ? Un chiffon, un peu de patience, et l'écaille remonte. »`,
    detail: `Le doublon devient la version rainbow. La case normale n'est pas touchée.`,
    cout: TARIFS.lustrage,
    effet: {
      retire: [{ carteId: choix.carteId, version: "normale", n: 1 }],
      ajoute: [{ carte: choix.carte, version: "rainbow", n: 1 }],
      po: -TARIFS.lustrage,
    },
  };
}

const FABRIQUES = [dealLot, dealTroc, dealPari, dealBotte, dealLustrage];

/**
 * Ce qu'il déballe. Trois affaires au plus, dans un ordre stable pour une
 * graine donnée, le lot et le troc en tête quand ils sont possibles : ce sont
 * les deux qui répondent à un état de collection précis, donc les deux qui
 * donnent le sentiment qu'il a regardé dans le ballot du joueur.
 */
export function propositions(contexte, graine = 0) {
  const rng = semis(graine);
  const toutes = FABRIQUES.map((f) => f(contexte)).filter(Boolean);
  if (!toutes.length) return [];
  const prioritaires = toutes.filter((d) => d.id === "lot" || d.id === "troc");
  const autres = toutes.filter((d) => d.id !== "lot" && d.id !== "troc");
  // Mélange de Fisher-Yates sur les affaires génériques seulement.
  for (let i = autres.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [autres[i], autres[j]] = [autres[j], autres[i]];
  }
  return [...prioritaires, ...autres].slice(0, 3);
}

/** Tire le palier du pari. */
export function palierPari(rng = Math.random) {
  let x = rng();
  for (const [tier, p] of Object.entries(TABLE_PARI)) {
    x -= p;
    if (x <= 0) return tier;
  }
  return "peucommun";
}
