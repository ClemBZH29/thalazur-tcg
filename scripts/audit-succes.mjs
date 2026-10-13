/**
 * Audit des succès : ce que le barème rend, rapporté à ce qu'il coûte.
 *
 *   node scripts/audit-succes.mjs
 *
 * Trois mesures.
 *
 * 1. Le barème à plat : tout ce que chaque famille rend si on la termine,
 *    en équivalent boosters (un sachet = un booster, 120 PO = un booster).
 * 2. Une course simulée sur le vrai roster : des joueurs ouvrent des
 *    boosters, réclament chaque palier dès qu'il est atteint et ouvrent aussi
 *    les sachets offerts — la boucle « plus tu gagnes, plus tu gagnes ». On
 *    relève, à chaque palier de complétion, combien de boosters ont été
 *    payés, combien ont été offerts, et la part remboursée.
 *
 * 3. Le calendrier : pour trois habitudes de jeu, le jour où chaque palier
 *    tombe, à partir des rythmes que mesurent les autres audits (boosters,
 *    strates, éclats, Donjon, missions). C'est ce qui juge la difficulté :
 *    l'ancien barème se vidait en un mois pour un joueur régulier.
 *
 * Le joueur simulé n'achète rien au Comptoir : c'est le chemin le plus long
 * vers la complétion, donc le pire cas pour la part remboursée en fin de course.
 * Les formules sont celles du site (tirage, évaluation, réclamation) : rien
 * n'est recopié.
 */
import { readFileSync } from "node:fs";
import { ouvrirBooster } from "../src/lib/draw.js";
import { construirePool, deduireGrades } from "../src/lib/roster.js";
import { specialesPour } from "../src/config/speciales.js";
import { ECONOMIE, GARANTIES, TAUX_DEFAUT } from "../src/config/tiers.js";
import { construireCatalogue, evaluer, reclamer } from "../src/succes/regles.js";

const ID = "troupe-valeran";
const roster = JSON.parse(readFileSync(new URL(`../src/extensions/${ID}/roster.json`, import.meta.url), "utf8"));
const { default: def } = await import(`../src/extensions/${ID}/extension.js`);
const ext = { ...def, roster };
const CAT = construireCatalogue([ext]);
const pool = construirePool(roster.lignes, deduireGrades(roster.lignes));
const speciales = specialesPour(ext);

const enBoosters = (r = {}) => (r.sachets || 0) + (r.po || 0) / ECONOMIE.prix;
const f1 = (x) => x.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/* ── 1. Le barème à plat ─────────────────────────────────────────────── */

console.log(`\n1. Barème complet, en équivalent boosters (${ECONOMIE.prix} PO = un sachet)\n`);
console.log("| Famille | Paliers | Rend au total |");
console.log("|---|---:|---:|");
let totalGlobal = 0, totalColl = 0;
for (const f of [...CAT.global, ...CAT.extensions[0].familles]) {
  const v = f.paliers.reduce((s, p) => s + enBoosters(p.recompense), 0);
  if (f.categorie === "global") totalGlobal += v; else totalColl += v;
  console.log(`| ${f.nom} | ${f.paliers.length} | ${f1(v)} |`);
}
console.log(`\nGlobal : ${f1(totalGlobal)} boosters · Collection ${ext.titre} : ${f1(totalColl)} boosters`);

/* ── 2. La course simulée ────────────────────────────────────────────── */

function rng(graine) {
  let a = graine >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const JALONS = [25, 50, 75, 90, 100];

function course(graine) {
  const r = rng(graine);
  let etat = { collections: { [ID]: {} }, boosters: {}, bourse: { po: 0, credite: 0, gagne: 0 }, succes: {}, sachets: {} };
  let payes = 0, offerts = 0, pity = { depuis: 0, vu: false };
  const releves = {};
  let ouverts = 0;
  while (!releves[100] && ouverts < 5000) {
    const leg = pool.legendaire.length > 0;
    const garantir = leg && ((!pity.vu && ouverts + 1 >= GARANTIES.premierLegendaire)
      || pity.depuis + 1 >= GARANTIES.intervalle);
    const t = ouvrirBooster(pool, TAUX_DEFAUT, { speciales, garantirLegendaire: garantir, rng: r });
    const coll = { ...etat.collections[ID] };
    for (const c of t.cards) {
      const cle = c.rainbow ? "rainbow" : "normale";
      const a = coll[c.id] || { normale: 0, rainbow: 0 };
      coll[c.id] = { ...a, [cle]: a[cle] + 1 };
    }
    const aLeg = t.cards.some((c) => c.tier === "legendaire");
    pity = { depuis: aLeg ? 0 : pity.depuis + 1, vu: pity.vu || aLeg };
    ouverts++;
    // Un sachet offert passe avant la bourse, comme sur le site.
    const s = { ...etat.sachets };
    const cle = (s[ID] || 0) > 0 ? ID : (s["*"] || 0) > 0 ? "*" : null;
    if (cle) { s[cle]--; offerts++; } else payes++;
    etat = { ...etat, collections: { [ID]: coll }, boosters: { [ID]: ouverts }, sachets: s };
    // Réclame tout ce qui est atteint ; les PO gagnées valent des boosters payés en moins.
    const { etat: apres, po } = reclamer(CAT, etat, evaluer(CAT, etat, null).aReclamer, null, ouverts);
    etat = apres;
    offerts += po / ECONOMIE.prix;
    payes -= po / ECONOMIE.prix;
    const pct = evaluer(CAT, etat, null).extensions[0].mesures.pct;
    for (const j of JALONS) if (pct >= j && !releves[j]) releves[j] = { ouverts, payes, offerts };
  }
  return releves;
}

const N = 200;
const courses = Array.from({ length: N }, (_, i) => course(1000 + i));
const moyenne = (j, k) => courses.reduce((s, c) => s + c[j][k], 0) / N;

console.log(`\n2. Course à la complétion de ${ext.titre} (${N} joueurs simulés, sans Comptoir)\n`);
console.log("| Complétion | Boosters ouverts | dont payés | dont offerts | Part remboursée |");
console.log("|---:|---:|---:|---:|---:|");
for (const j of JALONS) {
  const o = moyenne(j, "ouverts"), p = moyenne(j, "payes"), f = moyenne(j, "offerts");
  console.log(`| ${j} % | ${f1(o)} | ${f1(p)} | ${f1(f)} | ${f1((f / o) * 100)} % |`);
}
console.log(`
La part remboursée doit rester nettement sous 100 % à chaque jalon : c'est ce
qui éteint la boucle. Depuis le retour bêta (07/10/2026), elle doit aussi
rester sous un tiers dès le premier jalon — l'accueil ne paie pas une semaine
d'avance. Les succès des Mines, du Donjon, du Comptoir et du colporteur
s'ajoutent à ce tableau, au rythme où l'on joue ces modules : voir la ligne
« Global » ci-dessus.`);

/* ── 3. Le calendrier ────────────────────────────────────────────────── */

/**
 * Rythmes par jour, relevés le 09/10/2026 dans les autres audits et dans la
 * conception. Ce sont des ordres de grandeur : le calendrier dit « la
 * première semaine », « le troisième mois », pas un jour exact.
 *
 * - boosters : gain passif 3,4/j (boutique), missions 1,2/j, commandes de
 *   Tafix (audit-eclats : 199, 261, 266 PO/j), Donjon (~150 PO/j le donjon du
 *   jour, l'infini en plus), expéditions (100 PO/j au plus), Comptoir ;
 * - strate : audit-strates (20 min, 1 h, 3 h par jour) ; effondrements :
 *   audit-eclats (32, 81, 169 en trois mois) ; faveurs : mêmes courbes ;
 * - gardiens : le donjon du jour (1 à 3) et 0 à 3 descentes infinies ;
 *   record infini : médianes de donjon.md (2, 3, 5, 9 gardiens) ;
 * - expérience : 45 points par descente et par carte, la carte la plus
 *   jouée en reçoit chaque jour `xp`.
 */
const PROFILS = {
  occasionnel: { nom: "Occasionnel (20 min/j)", boosters: 6, gardiens: 1.2, remontees: 0.3, expeditions: 2,
    lieuxRainbow: 0.25, ventes: 5, achats: 0.1, affaires: 0.5, dissous: 10, forges: 0.5, xp: 50, rainbowXP: 0.3,
    missions: 2.5, semaines: 0.8 / 7, commandes: 2, effondrements: 32 / 90,
    strate: [[1, 8], [3, 9], [7, 12], [14, 14], [60, 15]], faveurs: [[2, 1], [20, 6], [85, 12]],
    record: [[14, 3], [60, 5]] },
  regulier: { nom: "Régulier (1 h/j)", boosters: 9, gardiens: 4, remontees: 0.5, expeditions: 4,
    lieuxRainbow: 0.33, ventes: 15, achats: 0.3, affaires: 0.7, dissous: 25, forges: 0.9, xp: 120, rainbowXP: 0.6,
    missions: 3, semaines: 0.95 / 7, commandes: 3, effondrements: 81 / 90,
    strate: [[1, 7], [3, 11], [7, 13], [14, 14], [60, 15]], faveurs: [[1, 1], [9, 6], [36, 12]],
    record: [[5, 3], [21, 5], [90, 8]] },
  assidu: { nom: "Assidu (3 h/j)", boosters: 11, gardiens: 10, remontees: 0.6, expeditions: 7,
    lieuxRainbow: 0.5, ventes: 30, achats: 0.5, affaires: 0.9, dissous: 50, forges: 1, xp: 230, rainbowXP: 1,
    missions: 3.1, semaines: 1 / 7, commandes: 3.5, effondrements: 169 / 90,
    strate: [[1, 12], [3, 13], [7, 14], [30, 15]], faveurs: [[1, 1], [5, 6], [18, 12]],
    record: [[2, 3], [10, 5], [42, 8], [180, 12]] },
};
const JAMAIS = Infinity;
/** Le premier jour d'une courbe [jour, valeur] où la valeur atteint `s`. */
const courbe = (pts, s) => pts.find(([, v]) => v >= s)?.[0] ?? JAMAIS;
const pointsNiveau = (n) => 5 * (n - 1) + (n * (n - 1)) / 2;
/** Boosters ouverts → complétion, lus dans la course ci-dessus (moyennes). */
const COURSE = [[0, 0], ...JALONS.map((j) => [moyenne(j, "ouverts"), j])];
const boostersPour = (pct) => {
  for (let i = 1; i < COURSE.length; i++) {
    const [b0, p0] = COURSE[i - 1], [b1, p1] = COURSE[i];
    if (p1 >= pct) return b0 + ((b1 - b0) * (pct - p0)) / (p1 - p0);
  }
  return JAMAIS;
};
const E = CAT.extensions[0];
const RAINBOW_PAR_BOOSTER = 0.18; // 5,97 cartes à 3 %

function jourDu(P, f, p) {
  const jB = (b) => Math.max(0, (b - 5) / P.boosters); // 600 PO de départ : 5 boosters
  const jPct = (pct) => jB(boostersPour(pct));
  const reliquaire = jPct(60);
  const s = p.seuil;
  const [m, sous] = f.mesure.split(".");
  switch (m) {
    case "boosters": return jB(s);
    case "strate": return courbe(P.strate, s);
    case "faveurs": return courbe(P.faveurs, s);
    case "recordInfini": return courbe(P.record, s);
    case "effondrements": return s / P.effondrements;
    case "lieuxRainbow": return 6 + s / P.lieuxRainbow;
    case "dissous": case "forges": return reliquaire + s / P[m];
    case "niveauMax": return pointsNiveau(s) / P.xp;
    case "centenaires": return (pointsNiveau(100) / P.xp) * (1 + (s - 1) * 0.6);
    case "rainbowXP": return 3 + s / P.rainbowXP;
    case "pj": return JAMAIS; // une chance sur 8 192 : un exploit, pas un objectif
    case "pct": return jPct(s);
    case "type": return jPct((100 * s) / E.roster.filter((c) => c.type === sous).length);
    case "province": return jPct((100 * s) / E.provinces.find((x) => x.id === sous).cartes.length);
    case "legendaires": {
      const n = E.roster.filter((c) => c.tier === "legendaire").length;
      return s === 1 ? jB(6) : jPct(Math.min(100, 70 + (30 * s) / n));
    }
    case "irisees": {
      // Les premières tombent des boosters et de l'expérience ; le set
      // complet demande la forge rainbow, Mirko et des mois de Donjon.
      const parJour = RAINBOW_PAR_BOOSTER * P.boosters + P.rainbowXP;
      return (s / parJour) * (1 + (s / E.roster.length) * 3);
    }
    case "fullart": return JAMAIS;
    default: return s / P[m];
  }
}

const periodes = [[1, "1er jour"], [7, "1re semaine"], [30, "1er mois"], [90, "3 mois"], [365, "1 an"], [JAMAIS, "au-delà"]];
const tous = [...CAT.global, ...E.familles];
console.log(`\n3. Calendrier : quand tombent les ${tous.reduce((n, f) => n + f.paliers.length, 0)} paliers (Global + ${ext.titre})\n`);
console.log("| Habitude | " + periodes.map(([, n]) => n).join(" | ") + " | exploits |");
console.log("|---|" + periodes.map(() => "---:").join("|") + "|---:|");
const cal = {};
for (const [k, P] of Object.entries(PROFILS)) {
  const jours = tous.flatMap((f) => f.paliers.map((p) => ({ f, p, j: jourDu(P, f, p) })));
  cal[k] = jours;
  let avant = -1;
  const cases = periodes.map(([lim]) => {
    const l = jours.filter((x) => x.j > avant && x.j <= lim && !(x.j === JAMAIS && x.p.cache));
    avant = lim;
    return `${l.length} · ${f1(l.reduce((s, x) => s + enBoosters(x.p.recompense), 0))} b`;
  });
  const exploits = jours.filter((x) => x.j === JAMAIS && x.p.cache).length;
  console.log(`| ${P.nom} | ${cases.join(" | ")} | ${exploits} |`);
}
console.log(`
Chaque case : paliers tombés dans la période · ce qu'ils rendent en boosters.
« Exploits » : paliers cachés tenus par la chance (PJ, full art) ou hors
d'atteinte du profil.`);

/* Garde-fous du calendrier (09/10/2026). */
const R = cal.regulier;
const nb = (l, a, b) => l.filter((x) => x.j > a && x.j <= b).length;
const total = R.length;
const semaine1 = R.filter((x) => x.j <= 7).reduce((s, x) => s + enBoosters(x.p.recompense), 0);
const echecs = [];
const valeur = (l) => l.reduce((s, x) => s + enBoosters(x.p.recompense), 0);
if (valeur(R.filter((x) => x.j <= 30)) > valeur(R) / 4) echecs.push(`le premier mois rend plus du quart du barème au joueur régulier`);
if (nb(R, -1, 30) > total / 2) echecs.push(`un joueur régulier vide plus de la moitié du barème le premier mois (${nb(R, -1, 30)} / ${total})`);
if (semaine1 > PROFILS.regulier.boosters * 7 / 3) echecs.push(`la première semaine rend plus d'un tiers des boosters ouverts (${f1(semaine1)})`);
if (nb(R, 90, JAMAIS) < total / 5) echecs.push(`moins d'un cinquième du barème reste au joueur régulier après trois mois (${nb(R, 90, JAMAIS)})`);
const horsAtteinte = cal.assidu.filter((x) => x.j === JAMAIS && !x.p.cache);
if (horsAtteinte.length) echecs.push(`paliers visibles hors d'atteinte même d'un assidu : ${horsAtteinte.map((x) => x.p.id).join(", ")}`);
for (const e of echecs) console.log(`\nÉCHEC : ${e}.`);
if (echecs.length) process.exitCode = 1;

/* Garde-fou : un barème qui rembourse plus d'un tiers des boosters à un
   jalon quelconque redonne le premier jour du bêta-testeur. */
const tropGenereux = JALONS.filter((j) => moyenne(j, "offerts") / moyenne(j, "ouverts") > 1 / 3);
if (tropGenereux.length) {
  console.log(`\nÉCHEC : plus d'un tiers des boosters offerts à ${tropGenereux.join(", ")} %.\n`);
  process.exit(1);
}
// DETAIL=1 node scripts/audit-succes.mjs : le jour de chaque palier, pour le joueur régulier.
if (process.env.DETAIL) for (const x of cal.regulier.sort((a, b) => a.j - b.j)) console.log(x.j.toFixed(1), x.p.id, f1(enBoosters(x.p.recompense)));
