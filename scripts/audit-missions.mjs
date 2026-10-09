/**
 * Audit des missions — ce que rapportent les missions de Bodégué.
 *
 *   node scripts/audit-missions.mjs
 *
 * Rejoue un an de tirages pour trois profils de joueur (débutant, joueur
 * sans Reliquaire, joueur qui a tout ouvert) avec les règles du site, et
 * mesure ce que rapportent les missions remplies, en PO et en boosters, à
 * côté du gain passif. Échoue si le flux dépasse la moitié du gain passif :
 * les missions complètent le rythme, elles ne le remplacent pas.
 */
import { ECONOMIE } from "../src/config/tiers.js";
import { RECOMPENSE_SEMAINE, TYPES } from "../src/config/missions.js";
import { contexte, mesuresMissions, tirerHebdo, tirerQuotidiennes, jourLocal, semaineLocale } from "../src/missions/regles.js";

/* Un roster à la forme de La Troupe, et une collection qui en possède une part. */
const ROSTER = [["commun", 110], ["peucommun", 66], ["rare", 33], ["legendaire", 11]]
  .flatMap(([tier, n]) => Array.from({ length: n }, (_, i) => ({ id: `${tier}-${i}`, tier })));
const EXTS = [{ id: "t", roster: ROSTER }];
const part = (p) => Object.fromEntries(ROSTER.filter((c) => Number(c.id.split("-")[1]) < Math.round(p[c.tier] * ROSTER.filter((x) => x.tier === c.tier).length))
  .map((c) => [c.id, { normale: 1, rainbow: 0, carte: { type: "pnj" } }]));

const passif = ECONOMIE.parHeure * 24;
const coll = (n, type, ex = 1) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${type}${i}`, { normale: ex, rainbow: 0, carte: { type, tier: "commun" } }]));
const PROFILS = [
  ["Débutant (un booster ouvert)", { boosters: { t: 1 }, collections: { t: coll(5, "pnj") }, stats: {} }],
  ["Sans Reliquaire, 40 boosters", { boosters: { t: 40 }, collections: { t: { ...coll(90, "pnj", 2), ...coll(10, "lieu") } }, stats: { descentes: 2 } }],
  ["Tout ouvert", { boosters: { t: 180 }, collections: { t: { ...coll(150, "pnj", 5), ...coll(30, "lieu", 3) } }, stats: { descentes: 30 }, reliquaire: { ouvert: 1 } }],
];

console.log("\nAUDIT DES MISSIONS — un an de tirages, missions toutes remplies\n");
console.log(`Gain passif : ${passif} PO par jour. Booster : ${ECONOMIE.prix} PO.\n`);
console.log("| Profil | PO par jour | Boosters par semaine (hebdo) | Boosters par jour, en tout | Part du gain passif |");
console.log("|---|---:|---:|---:|---:|");
let echec = false;
for (const [nom, e] of PROFILS) {
  const ctx = contexte(e, EXTS), mes = mesuresMissions(e);
  let po = 0, jours = 0;
  const vus = {}, semaines = new Set();
  for (let j = 0; j < 365; j++) {
    const d = new Date(2026, 9, 5 + j);
    for (const m of tirerQuotidiennes(jourLocal(d), ctx, mes)) { po += m.po; vus[m.type] = (vus[m.type] || 0) + 1; }
    semaines.add(semaineLocale(d));
    jours++;
  }
  const hebdoOk = !!tirerHebdo("2026-S41", ctx, mes);
  const parJour = po / jours;
  const boostersJour = (parJour + (hebdoOk ? (RECOMPENSE_SEMAINE.sachets * ECONOMIE.prix) / 7 : 0)) / ECONOMIE.prix;
  const part = (boostersJour * ECONOMIE.prix) / passif;
  console.log(`| ${nom} | ${parJour.toFixed(0)} | ${hebdoOk ? RECOMPENSE_SEMAINE.sachets : 0} | ${boostersJour.toFixed(2).replace(".", ",")} | ${(part * 100).toFixed(0)} % |`);
  console.log(`|  tirés : ${Object.entries(vus).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round((v / jours) * 100)} %`).join(", ")} | | | | |`);
  if (part > 0.5) echec = true;
}
/* Jusqu'où la mission « cartes nouvelles » reste confiée. */
console.log("\nCartes nouvelles par booster, et la mission « Ajouter 2 cartes nouvelles » :");
for (const p of [
  { commun: .4, peucommun: .15, rare: .03, legendaire: .1 },
  { commun: .7, peucommun: .4, rare: .1, legendaire: .2 },
  { commun: .95, peucommun: .75, rare: .3, legendaire: .3 },
  { commun: .99, peucommun: .9, rare: .5, legendaire: .45 },
  { commun: 1, peucommun: .95, rare: .67, legendaire: .55 },
]) {
  const c = part(p);
  const ctx = contexte({ collections: { t: c } }, EXTS);
  const pct = Math.round((Object.keys(c).length * 100) / ROSTER.length);
  const jour = ctx.nouvellesParBooster * 3 >= 2, semaine = ctx.nouvellesParBooster * 21 >= 12;
  console.log(`  ${String(pct).padStart(3)} % de la collection : ${ctx.nouvellesParBooster.toFixed(2).replace(".", ",")} par booster · jour ${jour ? "oui" : "non"} · semaine ${semaine ? "oui" : "non"}`);
}
const jamais = TYPES.filter((t) => t.jour).map((t) => t.id);
console.log(`\nTypes de missions du jour : ${jamais.join(", ")}.`);
if (echec) {
  console.log("\nÉCHEC : les missions dépassent la moitié du gain passif.\n");
  process.exit(1);
}
console.log("\nLes missions restent sous la moitié du gain passif.\n");
