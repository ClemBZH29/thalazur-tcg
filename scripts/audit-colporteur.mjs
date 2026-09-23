/**
 * Audit du colporteur.
 *
 * Deux questions, et une seule qui compte vraiment.
 *
 * 1. À quelle fréquence Mirko passe-t-il, selon le rythme d'ouverture ? Le
 *    tirage est à 8 % par booster, mais deux règles le déforment : un seul
 *    passage par jour, et une visite forcée au bout de dix-huit boosters sans
 *    rien. On simule un an de jeu pour chaque rythme.
 *
 * 2. Combien de pièces d'or son passage injecte-t-il dans l'économie ? C'est
 *    la question de fond : le mélange mine + gain passif a été calibré à
 *    3,0–7,0 boosters par jour (docs/audit-economie.md), et un évènement qui
 *    ajouterait un booster gratuit par jour le ferait sauter.
 *
 * Le script importe la décision et les affaires depuis src/config/colporteur.js
 * — rien n'est recopié ici, sinon l'audit ne mesurerait que lui-même.
 *
 *   node scripts/audit-colporteur.mjs
 */
import { ECONOMIE, REVENTE } from "../src/config/tiers.js";
import {
  VISITE, TARIFS, TABLE_PARI, passeAujourdhui, propositions,
} from "../src/config/colporteur.js";

const jour = (n) => new Date(2026, 0, 1 + n).toLocaleDateString("sv");
const fmt = (x, d = 1) => x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

/* ── 1. Fréquence des passages ────────────────────────────────────────── */

function simulerAnnee(boostersParJour, jours = 365) {
  let memoire = null;
  let ouverts = 0;
  let visites = 0;
  let ecarts = [];
  let dernier = 0;

  for (let j = 0; j < jours; j++) {
    const d = jour(j);
    // Le nombre de boosters du jour, arrondi au hasard sur la partie décimale.
    const n = Math.floor(boostersParJour) + (Math.random() < boostersParJour % 1 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      ouverts++;
      if (passeAujourdhui(memoire, ouverts, Math.random, d)) {
        visites++;
        ecarts.push(j - dernier);
        dernier = j;
        memoire = { jour: d, depuis: 0 };
      } else {
        memoire = { jour: memoire ? memoire.jour : null, depuis: (memoire?.depuis || 0) + 1 };
      }
    }
  }
  const moyen = ecarts.length > 1
    ? ecarts.slice(1).reduce((s, e) => s + e, 0) / (ecarts.length - 1)
    : jours;
  return { visites, parAn: visites, ecartMoyen: moyen, tauxJour: visites / jours };
}

console.log("Le colporteur — fréquence de passage");
console.log(`  tirage ${VISITE.parBooster * 100} % par booster · un passage par jour au plus`);
console.log(`  visite forcée au ${VISITE.pitie}ᵉ booster sans passage\n`);
console.log("  boosters/jour │ passages/an │ un passage tous les");
console.log("  ──────────────┼─────────────┼─────────────────────");
for (const r of [1, 2, 3, 3.6, 5, 7, 12]) {
  const n = 6;
  const runs = Array.from({ length: n }, () => simulerAnnee(r));
  const parAn = runs.reduce((s, x) => s + x.parAn, 0) / n;
  const ecart = runs.reduce((s, x) => s + x.ecartMoyen, 0) / n;
  console.log(`  ${String(fmt(r)).padStart(13)} │ ${String(Math.round(parAn)).padStart(11)} │ ${fmt(ecart)} jours`);
}

/* ── 2. Injection de pièces d'or ──────────────────────────────────────── */

/**
 * Ce que vaut chaque affaire, en pièces d'or *créées* — c'est-à-dire ce que le
 * joueur n'aurait pas obtenu autrement.
 *
 *   le lot        : il paie ×2,2 la revente, là où le Comptoir paie ≈ ×3
 *                   (×2,4 d'ancrage, relevé par le multiplicateur d'acheteur).
 *                   Sur un doublon vendable au Comptoir, l'affaire est donc
 *                   *négative* pour le joueur. Sur un doublon qu'aucun
 *                   acheteur du jour ne veut, elle vaut son prix plein.
 *   la botte      : la remise, soit 50 PO.
 *   le pari       : 55 PO contre une carte au plancher peu commun. Comparé au
 *                   booster, qui donne 1,71 carte peu commune ou mieux pour
 *                   120 PO, le pari paie 55 PO ce que le booster facture 70.
 *   le troc       : aucune pièce. Trois doublons contre une carte manquante.
 *   le lustrage   : −120 PO.
 */
const RATIO_COMPTOIR = 3.0;   // ce qu'un acheteur affine paie, en multiple de REVENTE
const RATIO_LOT = 2.2;

const cartesUtilesParBooster = 1.71; // peu commun ou mieux, cf. ECONOMIE
const valeurCartePari = (ECONOMIE.prix / cartesUtilesParBooster);

const injection = {
  "le lot (doublon vendable ailleurs)": (RATIO_LOT - RATIO_COMPTOIR) * REVENTE.peucommun,
  "le lot (doublon sans acheteur)": RATIO_LOT * REVENTE.peucommun,
  "la botte": ECONOMIE.prix - TARIFS.botte,
  "le pari": valeurCartePari - TARIFS.pari,
  "le troc": 0,
  "le lustrage": -TARIFS.lustrage,
};

console.log("\nCe que chaque affaire injecte, en PO équivalents");
console.log("  affaire                              │ par unité │ commentaire");
console.log("  ─────────────────────────────────────┼───────────┼────────────");
for (const [nom, po] of Object.entries(injection)) {
  const c = po > 0 ? "le joueur y gagne" : po < 0 ? "le joueur y dépense" : "aucune pièce en jeu";
  console.log(`  ${nom.padEnd(36)} │ ${String(fmt(po, 1)).padStart(9)} │ ${c}`);
}

/**
 * Le plafond théorique, et il faut lire ce qu'il mesure.
 *
 * Le joueur prend l'affaire la plus riche à chaque passage, et l'on suppose
 * que *tout* son surplus est invendable au Comptoir — aucun acheteur du jour
 * n'en veut, jamais. Le chiffre obtenu se compare alors à un joueur qui ne
 * vendrait rien du tout, ce qui n'est pas la vraie alternative : dès qu'une
 * carte trouve un acheteur, le Comptoir paie ≈ ×3 contre ×2,2 chez Mirko, et
 * l'affaire devient négative. Le lot ne remplace donc jamais le Comptoir comme
 * source de revenu ; il débouche ce que le Comptoir laisse sur les bras.
 */
const meilleureAffaire = Math.max(
  20 * RATIO_LOT * REVENTE.peucommun - 20 * 0, // lot de 20 doublons invendables
  ECONOMIE.prix - TARIFS.botte,
  valeurCartePari - TARIFS.pari
);

console.log("\nPlafond théorique — affaire la plus riche, surplus entièrement invendable");
for (const r of [3, 3.6, 7]) {
  const n = 4;
  const tauxJour = Array.from({ length: n }, () => simulerAnnee(r).tauxJour)
    .reduce((s, x) => s + x, 0) / n;
  const poParJour = tauxJour * meilleureAffaire;
  console.log(
    `  ${fmt(r)} boosters/jour → ${fmt(tauxJour * 100, 0)} % des jours avec passage, ` +
    `${fmt(poParJour, 0)} PO/jour, soit +${fmt(poParJour / ECONOMIE.prix, 2)} booster/jour`
  );
}
console.log("  (mesuré contre un joueur qui ne vendrait rien : ce n'est pas un gain attendu)");

/**
 * Le cas réaliste : le lot ne porte que sur le surplus effectivement présent,
 * et la moitié de ce surplus trouve un acheteur au Comptoir. On prend le lot
 * médian mesuré en session — six doublons — et une affaire prise sur deux.
 */
const lotMedian = 6;
const partInvendable = 0.5;
const affaireMoyenne =
  0.5 * (lotMedian * (partInvendable * RATIO_LOT * REVENTE.peucommun
       + (1 - partInvendable) * (RATIO_LOT - RATIO_COMPTOIR) * REVENTE.peucommun))
  + 0.25 * (ECONOMIE.prix - TARIFS.botte)
  + 0.25 * (valeurCartePari - TARIFS.pari);

console.log("\nCas réaliste — lot médian de six doublons, la moitié invendable au Comptoir");
for (const r of [3, 3.6, 7]) {
  const n = 4;
  const tauxJour = Array.from({ length: n }, () => simulerAnnee(r).tauxJour)
    .reduce((s, x) => s + x, 0) / n;
  const poParJour = tauxJour * affaireMoyenne;
  console.log(
    `  ${fmt(r)} boosters/jour → ${fmt(poParJour, 1)} PO/jour, ` +
    `soit +${fmt(poParJour / ECONOMIE.prix, 3)} booster/jour`
  );
}

/* ── 3. Le pari tient-il sa promesse ? ────────────────────────────────── */
const espere = Object.entries(TABLE_PARI)
  .reduce((s, [t, p]) => s + p * REVENTE[t], 0);
console.log(`\nLe pari : ${TARIFS.pari} PO pour une carte dont la revente garantie ` +
  `vaut ${fmt(espere, 2)} PO en espérance.`);
console.log("  C'est une dépense de collectionneur, pas un placement : la valeur");
console.log("  d'une carte est la case qu'elle remplit, pas sa revente.");

/* ── 4. Cohérence des affaires ────────────────────────────────────────── */
console.log("\nContrôle — les affaires proposées sur quelques états de collection");
const carte = (id, tier) => ({ id, nom: id, tier });
const etats = {
  "collection vierge": { collection: {}, pool: { commun: [], peucommun: [carte("a", "peucommun")], rare: [carte("b", "rare")], legendaire: [] }, bourse: { po: 600 } },
  "sans le sou": { collection: {}, pool: { commun: [], peucommun: [carte("a", "peucommun")], rare: [], legendaire: [] }, bourse: { po: 10 } },
  "trois doublons": {
    collection: {
      x: { normale: 4, rainbow: 0, carte: carte("x", "peucommun") },
    },
    pool: { commun: [], peucommun: [carte("x", "peucommun")], rare: [carte("b", "rare")], legendaire: [] },
    bourse: { po: 600 },
  },
};
for (const [nom, ctx] of Object.entries(etats)) {
  const d = propositions(ctx, 20260101);
  console.log(`  ${nom.padEnd(20)} → ${d.length ? d.map((x) => x.titre).join(", ") : "aucune affaire, il ne s'arrête pas"}`);
}
