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
 * - tout dissoudre au Reliquaire (dès son ouverture, à 60 %) et forger la
 *   carte du jour quand elle manque et que les vestiges suffisent.
 *
 * Le barème et la carte du jour sont ceux du site (src/config/reliquaire.js,
 * `offreDuJour`). Les prix de rachat viennent de scripts/audit-marche.mjs.
 * Rien n'est recopié des règles : le tirage est celui du site.
 */
import { readFileSync } from "node:fs";
import { ouvrirBooster } from "../src/lib/draw.js";
import { construirePool, deduireGrades } from "../src/lib/roster.js";
import { specialesPour } from "../src/config/speciales.js";
import { GARANTIES, TAUX_DEFAUT, ECONOMIE, SLOTS } from "../src/config/tiers.js";
import { RELIQUAIRE } from "../src/config/reliquaire.js";
import { offreDuJour } from "../src/reliquaire/regles.js";

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
const CARTES = PALIERS.flatMap((t) => pool[t]);
const JOUR0 = Date.UTC(2026, 9, 1);
const jourN = (j) => new Date(JOUR0 + j * 864e5).toISOString().slice(0, 10);

function course(graine, parJour, politique, jours = 400) {
  const r = rng(graine), B = politique === "reliquaire";
  const ex = {}, parId = {};
  for (const t of PALIERS) for (const c of pool[t]) parId[c.id] = t;
  let po = 0, vest = 0, ouverts = 0, reste = 0, pity = { depuis: 0, vu: false }, gagnes = 0, forges = 0;
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
    if (B && distincts() / TOTAL >= RELIQUAIRE.ouverture) {
      for (const id in ex) if (ex[id] > 1) {
        const k = ex[id] - 1, g = k * RELIQUAIRE.dissolution[parId[id]];
        vest += g; gagnes += g; ex[id] = 1;
      }
      // Une graine par joueur : chaque course voit une suite de cartes du jour
      // différente, comme autant de joueurs arrivés à des dates différentes.
      const o = offreDuJour(ID, CARTES, `${graine}:${jourN(j)}`, { slots: SLOTS, tauxRainbow: TAUX_DEFAUT.rainbow });
      if (o && !o.rainbow && !ex[o.c.id] && vest >= o.prix) { vest -= o.prix; ex[o.c.id] = 1; forges++; }
    }
    const pct = (distincts() / TOTAL) * 100;
    for (const J of [90, 100]) if (pct >= J && !releves[J]) releves[J] = j;
    if (j === 30) releves.vest30 = gagnes / 30;
    releves.forges = forges;
    if (releves[100]) break;
  }
  return releves;
}

const N = Number(process.argv[2]) || 100;
const PROFILS = [["Occasionnel", 3.85], ["Régulier", 5.95], ["Assidu", 7.1]];
const POLITIQUES = [["garder", "Boosters seuls"], ["comptoir", "Doublons vendus au Comptoir"], ["reliquaire", "Reliquaire (carte du jour)"]];
const moy = (l) => (l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : "—");

console.log(`\nRoster de ${ID} : ${TOTAL} cartes (${PALIERS.map((t) => `${pool[t].length} ${t}`).join(", ")}), ${N} joueurs par cas.\n`);
console.log("| Profil | Doublons | 90 % en | 100 % en | Vestiges/jour (J1-30) | Cartes forgées |");
console.log("|---|---|---:|---:|---:|---:|");
for (const [nom, bj] of PROFILS) {
  for (const [pol, lib] of POLITIQUES) {
    const cs = Array.from({ length: N }, (_, i) => course(500 + i, bj, pol));
    const j100 = cs.map((c) => c[100]).filter(Boolean);
    const rel = pol === "reliquaire";
    console.log(`| ${nom} (${bj} b/j) | ${lib} | ${moy(cs.map((c) => c[90]).filter(Boolean))} j | ${moy(j100)} j${j100.length < N ? ` (${j100.length}/${N})` : ""} | ${rel ? moy(cs.map((c) => c.vest30 || 0)) : "—"} | ${rel ? moy(cs.map((c) => c.forges || 0)) : "—"} |`);
  }
}
