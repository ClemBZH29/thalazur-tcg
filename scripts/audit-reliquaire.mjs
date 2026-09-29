/**
 * Audit du Reliquaire : combien de jours pour compléter une extension, avec
 * ou sans lui, et ce qu'il rapporte en vestiges.
 *
 *   node scripts/audit-reliquaire.mjs [joueurs par cas, 100 par défaut]
 *
 * Des joueurs simulés ouvrent chaque jour le nombre de boosters de leur profil
 * (tirage du site, garanties de légendaire comprises) et suivent l'une des
 * politiques suivantes pour leurs doublons :
 *
 * - les garder ;
 * - les vendre au rachat de l'échoppe et racheter des boosters avec ;
 * - tout dissoudre au Reliquaire et forger ce qui manque, la légendaire
 *   d'abord dès qu'elle est permise, puis le moins cher.
 *
 * Le barème du Reliquaire est celui de src/config/reliquaire.js ; la V1 est
 * gardée en comparaison. Les prix de rachat viennent de scripts/audit-marche.mjs.
 * Rien n'est recopié des règles : le tirage est celui du site.
 */
import { readFileSync } from "node:fs";
import { ouvrirBooster } from "../src/lib/draw.js";
import { construirePool, deduireGrades } from "../src/lib/roster.js";
import { specialesPour } from "../src/config/speciales.js";
import { GARANTIES, TAUX_DEFAUT, ECONOMIE } from "../src/config/tiers.js";
import { RELIQUAIRE } from "../src/config/reliquaire.js";

const ID = "troupe-valeran";
const roster = JSON.parse(readFileSync(new URL(`../src/extensions/${ID}/roster.json`, import.meta.url), "utf8"));
const { default: def } = await import(`../src/extensions/${ID}/extension.js`);
const pool = construirePool(roster.lignes, deduireGrades(roster.lignes));
const speciales = specialesPour({ ...def, roster });
const PALIERS = ["commun", "peucommun", "rare", "legendaire"];
const TOTAL = PALIERS.reduce((s, t) => s + pool[t].length, 0);

function rng(g) {
  let a = g >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Rachat de l'échoppe, relevé par audit-marche.mjs (28/09/2026). */
const RACHAT = { commun: 3.6, peucommun: 8.7, rare: 25.8, legendaire: 84.3 };
const VENTE = { commun: 10.6, peucommun: 25.9, rare: 80.8, legendaire: 271.2 };
const BAREMES = {
  V1: { diss: { commun: 2, peucommun: 5, rare: 15, legendaire: 0 }, coeurL: 1,
    forge: { commun: 20, peucommun: 50, rare: 150, legendaire: 400 }, coeursForgeL: 3 },
  actuel: { diss: RELIQUAIRE.dissolution, coeurL: 0, forge: RELIQUAIRE.forge, coeursForgeL: 0 },
};
const LEG = RELIQUAIRE.legendaire;

function course(graine, parJour, politique, jours = 400) {
  const r = rng(graine), B = BAREMES[politique];
  const ex = {}, parId = {};
  for (const t of PALIERS) for (const c of pool[t]) parId[c.id] = t;
  let po = 0, vest = 0, coeurs = 0, derL = -99, ouverts = 0, reste = 0, pity = { depuis: 0, vu: false }, gagnes = 0;
  const releves = {};
  const distincts = () => Object.keys(ex).length;
  for (let j = 1; j <= jours; j++) {
    reste += parJour + po / ECONOMIE.prix; po = 0;
    const n = Math.floor(reste); reste -= n;
    for (let i = 0; i < n; i++) {
      const garantir = (!pity.vu && ouverts + 1 >= GARANTIES.premierLegendaire) || pity.depuis + 1 >= GARANTIES.intervalle;
      const t = ouvrirBooster(pool, TAUX_DEFAUT, { speciales, garantirLegendaire: garantir, rng: r });
      ouverts++;
      for (const c of t.cards) if (PALIERS.includes(c.tier) && !c.rainbow) ex[c.id] = (ex[c.id] || 0) + 1;
      const aL = t.cards.some((c) => c.tier === "legendaire");
      pity = { depuis: aL ? 0 : pity.depuis + 1, vu: pity.vu || aL };
    }
    if (politique === "comptoir") for (const id in ex) if (ex[id] > 1) { po += (ex[id] - 1) * RACHAT[parId[id]]; ex[id] = 1; }
    if (B) {
      for (const id in ex) if (ex[id] > 1) {
        const t = parId[id], k = ex[id] - 1;
        vest += k * B.diss[t]; gagnes += k * B.diss[t];
        if (t === "legendaire") coeurs += k * B.coeurL;
        ex[id] = 1;
      }
      for (;;) {
        const manq = PALIERS.flatMap((t) => pool[t].filter((c) => !ex[c.id]).map((c) => ({ id: c.id, t })));
        if (!manq.length) break;
        const mL = manq.find((m) => m.t === "legendaire");
        const eligL = mL && distincts() / TOTAL >= LEG.completionMin && j - derL >= LEG.delaiJours;
        if (eligL && vest >= B.forge.legendaire && coeurs >= B.coeursForgeL) {
          vest -= B.forge.legendaire; coeurs -= B.coeursForgeL; ex[mL.id] = 1; derL = j; continue;
        }
        const autre = manq.filter((m) => m.t !== "legendaire").sort((a, b) => B.forge[a.t] - B.forge[b.t])[0];
        if (!autre || vest < B.forge[autre.t]) break;
        vest -= B.forge[autre.t]; ex[autre.id] = 1;
      }
    }
    const pct = (distincts() / TOTAL) * 100;
    for (const J of [90, 100]) if (pct >= J && !releves[J]) releves[J] = j;
    if (j === 30) releves.vest30 = gagnes / 30;
    if (releves[100]) break;
  }
  return releves;
}

const N = Number(process.argv[2]) || 100;
const PROFILS = [["Occasionnel", 3.85], ["Régulier", 5.95], ["Assidu", 7.1]];
const POLITIQUES = [["garder", "Boosters seuls"], ["comptoir", "Doublons vendus au Comptoir"], ["V1", "Reliquaire V1"], ["actuel", "Reliquaire actuel"]];
const moy = (l) => (l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : "—");

console.log(`\nRoster de ${ID} : ${TOTAL} cartes (${PALIERS.map((t) => `${pool[t].length} ${t}`).join(", ")}), ${N} joueurs par cas.\n`);
console.log("| Profil | Doublons | 90 % en | 100 % en | Vestiges/jour (J1-30) |");
console.log("|---|---|---:|---:|---:|");
for (const [nom, bj] of PROFILS) {
  for (const [pol, lib] of POLITIQUES) {
    const cs = Array.from({ length: N }, (_, i) => course(500 + i, bj, pol));
    const j100 = cs.map((c) => c[100]).filter(Boolean);
    console.log(`| ${nom} (${bj} b/j) | ${lib} | ${moy(cs.map((c) => c[90]).filter(Boolean))} j | ${moy(j100)} j${j100.length < N ? ` (${j100.length}/${N})` : ""} | ${BAREMES[pol] ? moy(cs.map((c) => c.vest30 || 0)) : "—"} |`);
  }
}

console.log("\nDétour : dissoudre puis forger, rapporté à vendre puis racheter au Comptoir.\n");
for (const t of PALIERS) {
  const d = (B) => ((B.diss[t] || 0) / B.forge[t]) * VENTE[t] / RACHAT[t];
  console.log(`  ${t.padEnd(11)} V1 ${t === "legendaire" ? "29 % (cœurs)" : `${Math.round(d(BAREMES.V1) * 100)} %`}  ·  actuel ${Math.round(d(BAREMES.actuel) * 100)} %`);
}
