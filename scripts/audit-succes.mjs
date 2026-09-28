/**
 * Audit des succès : ce que le barème rend, rapporté à ce qu'il coûte.
 *
 *   node scripts/audit-succes.mjs
 *
 * Deux mesures.
 *
 * 1. Le barème à plat : tout ce que chaque famille rend si on la termine,
 *    en équivalent boosters (un sachet = un booster, 120 PO = un booster).
 * 2. Une course simulée sur le vrai roster : des joueurs ouvrent des
 *    boosters, réclament chaque palier dès qu'il est atteint et ouvrent aussi
 *    les sachets offerts — la boucle « plus tu gagnes, plus tu gagnes ». On
 *    relève, à chaque palier de complétion, combien de boosters ont été
 *    payés, combien ont été offerts, et la part remboursée.
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
La part remboursée doit rester nettement sous 100 % à chaque jalon et
décroître à mesure qu'on avance : c'est ce qui éteint la boucle. Elle est
forte au début — les premiers paliers de chaque famille tombent ensemble —
et c'est voulu : c'est la prise en main.
Les succès des Mines, du Comptoir et du colporteur s'ajoutent à ce tableau,
au rythme où l'on joue ces modules : voir la ligne « Global » ci-dessus.`);
