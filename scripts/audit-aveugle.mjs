/**
 * Audit de la forge à l'aveugle : ce qu'elle rapporte, selon ce que le joueur
 * sait et ce qu'il possède déjà.
 *
 *   node scripts/audit-aveugle.mjs [joueurs par cas, 100 par défaut]
 *
 * Même joueurs simulés que scripts/audit-reliquaire.mjs (tirage du site,
 * doublons dissous dès l'ouverture à 60 %). Chaque jour, la carte du jour du
 * site, et une politique :
 *
 * - retourner : la retourner, la forger si elle manque (version normale) ;
 * - aveugle : la forger à l'aveugle chaque jour où les vestiges suffisent ;
 * - renseigne : un autre joueur l'a retournée et le dit (la carte est la même
 *   pour tous) : forger à l'aveugle seulement si elle manque ou vaut plus
 *   que le prix moyen, sinon la retourner et passer.
 */
import { readFileSync } from "node:fs";
import { ouvrirBooster } from "../src/lib/draw.js";
import { construirePool, deduireGrades } from "../src/lib/roster.js";
import { specialesPour } from "../src/config/speciales.js";
import { GARANTIES, TAUX_DEFAUT, ECONOMIE, SLOTS } from "../src/config/tiers.js";
import { RELIQUAIRE } from "../src/config/reliquaire.js";
import { offreDuJour, prixAveugle } from "../src/reliquaire/regles.js";

const ID = "troupe-valeran";
const roster = JSON.parse(readFileSync(new URL(`../src/extensions/${ID}/roster.json`, import.meta.url), "utf8"));
const { default: def } = await import(`../src/extensions/${ID}/extension.js`);
const pool = construirePool(roster.lignes, deduireGrades(roster.lignes));
const speciales = specialesPour({ ...def, roster });
const PALIERS = ["commun", "peucommun", "rare", "legendaire"];
const TOTAL = PALIERS.reduce((s, t) => s + pool[t].length, 0);
const CARTES = PALIERS.flatMap((t) => pool[t]);
const AVEUGLE = prixAveugle(SLOTS, TAUX_DEFAUT.rainbow);
const JOUR0 = Date.UTC(2026, 9, 1);
const jourN = (j) => new Date(JOUR0 + j * 864e5).toISOString().slice(0, 10);

function rng(g) {
  let a = g >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function course(graine, parJour, pol, jours = 400) {
  const r = rng(graine);
  const ex = {}, arc = {}, parId = {};
  for (const t of PALIERS) for (const c of pool[t]) parId[c.id] = t;
  let vest = 0, ouverts = 0, reste = 0, pity = { depuis: 0, vu: false };
  const s = { forges: 0, utiles: 0, depense: 0, rainbow: 0, valeur: 0, jours: 0, j90: null, j100: null, gagnes: 0 };
  const distincts = () => Object.keys(ex).length;
  for (let j = 1; j <= jours; j++) {
    reste += parJour; const n = Math.floor(reste); reste -= n;
    for (let i = 0; i < n; i++) {
      const garantir = (!pity.vu && ouverts + 1 >= GARANTIES.premierLegendaire) || pity.depuis + 1 >= GARANTIES.intervalle;
      const t = ouvrirBooster(pool, TAUX_DEFAUT, { speciales, garantirLegendaire: garantir, rng: r });
      ouverts++;
      for (const c of t.cards) if (PALIERS.includes(c.tier)) { if (c.rainbow) arc[c.id] = 1; else ex[c.id] = (ex[c.id] || 0) + 1; }
      const aL = t.cards.some((c) => c.tier === "legendaire");
      pity = { depuis: aL ? 0 : pity.depuis + 1, vu: pity.vu || aL };
    }
    if (distincts() / TOTAL >= RELIQUAIRE.ouverture) {
      for (const id in ex) if (ex[id] > 1) { const g = (ex[id] - 1) * RELIQUAIRE.dissolution[parId[id]]; vest += g; s.gagnes += g; ex[id] = 1; }
      s.jours++;
      const o = offreDuJour(ID, CARTES, `${graine}:${jourN(j)}`, { slots: SLOTS, tauxRainbow: TAUX_DEFAUT.rainbow });
      const manque = o.rainbow ? !arc[o.c.id] : !ex[o.c.id];
      let prix = null;
      if (pol === "retourner") { if (manque && !o.rainbow && vest >= o.prix) prix = o.prix; }
      else if (pol === "aveugle") { if (vest >= AVEUGLE) prix = AVEUGLE; }
      else if (pol === "renseigne") { if ((manque || o.prix > AVEUGLE) && vest >= AVEUGLE) prix = AVEUGLE; }
      if (prix !== null) {
        vest -= prix; s.depense += prix; s.forges++;
        // Valeur reçue, au prix de forge : ce qu'il aurait fallu payer retournée.
        s.valeur += o.prix;
        if (o.rainbow) { s.rainbow++; if (!arc[o.c.id]) s.utiles++; arc[o.c.id] = 1; }
        else { if (!ex[o.c.id]) s.utiles++; ex[o.c.id] = (ex[o.c.id] || 0) + 1; }
      }
    }
    const pct = distincts() / TOTAL;
    if (pct >= 0.9 && !s.j90) s.j90 = j;
    if (pct >= 1 && !s.j100) { s.j100 = j; break; }
  }
  s.reste = vest;
  return s;
}

const N = Number(process.argv[2]) || 100;
const PROFILS = [["Occasionnel", 3.85], ["Assidu", 7.1]];
const POL = [["retourner", "Retourner, forger si elle manque"], ["aveugle", "À l'aveugle chaque jour"], ["renseigne", "À l'aveugle, carte connue d'un autre joueur"]];
const moy = (l) => l.reduce((a, b) => a + b, 0) / (l.length || 1);
const f0 = (x) => Math.round(x).toLocaleString("fr-FR");

console.log(`\nPrix à l'aveugle : ${AVEUGLE}. ${N} joueurs par cas.\n`);
console.log("| Profil | Politique | 90 % en | 100 % en | Forges | Utiles | Vestiges/forge utile | Valeur reçue / payé | Rainbow | Vestiges gagnés/jour |");
console.log("|---|---|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const [nom, bj] of PROFILS) for (const [p, lib] of POL) {
  const cs = Array.from({ length: N }, (_, i) => course(900 + i, bj, p));
  const dep = moy(cs.map((c) => c.depense)), ut = moy(cs.map((c) => c.utiles));
  console.log(`| ${nom} | ${lib} | ${f0(moy(cs.map((c) => c.j90 || 400)))} j | ${f0(moy(cs.map((c) => c.j100 || 400)))} j | ${moy(cs.map((c) => c.forges)).toFixed(1)} | ${ut.toFixed(1)} | ${ut ? f0(dep / ut) : "—"} | ${(moy(cs.map((c) => c.valeur)) / (dep || 1)).toFixed(2)} | ${moy(cs.map((c) => c.rainbow)).toFixed(1)} | ${f0(moy(cs.map((c) => c.gagnes / Math.max(1, c.jours))))} |`);
}

/* La probabilité qu'elle manque, par palier, selon l'avancement : relevée
   sur la politique « retourner », jour par jour. */
const bandes = [[0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1]];
const cpt = bandes.map(() => Object.fromEntries(PALIERS.map((t) => [t, [0, 0]])));
for (let i = 0; i < N; i++) {
  const r = rng(900 + i); const ex = {}; let ouverts = 0, reste = 0, pity = { depuis: 0, vu: false };
  for (let j = 1; j <= 400; j++) {
    reste += 5.95; const n = Math.floor(reste); reste -= n;
    for (let k = 0; k < n; k++) {
      const garantir = (!pity.vu && ouverts + 1 >= GARANTIES.premierLegendaire) || pity.depuis + 1 >= GARANTIES.intervalle;
      const t = ouvrirBooster(pool, TAUX_DEFAUT, { speciales, garantirLegendaire: garantir, rng: r }); ouverts++;
      for (const c of t.cards) if (PALIERS.includes(c.tier) && !c.rainbow) ex[c.id] = 1;
      const aL = t.cards.some((c) => c.tier === "legendaire"); pity = { depuis: aL ? 0 : pity.depuis + 1, vu: pity.vu || aL };
    }
    const pct = Object.keys(ex).length / TOTAL;
    const b = bandes.findIndex(([a, z]) => pct >= a && pct < z);
    if (b < 0) continue;
    for (const t of PALIERS) { const l = pool[t]; cpt[b][t][0] += l.filter((c) => !ex[c.id]).length; cpt[b][t][1] += l.length; }
  }
}
console.log("\nPart des cartes manquantes, par palier (joueur régulier) :\n");
console.log("| Avancement | Commune | Peu commune | Rare | Légendaire |");
console.log("|---|---:|---:|---:|---:|");
bandes.forEach(([a, z], b) => console.log(`| ${a * 100}–${z * 100} % | ${PALIERS.map((t) => `${Math.round(cpt[b][t][0] / Math.max(1, cpt[b][t][1]) * 100)} %`).join(" | ")} |`));
