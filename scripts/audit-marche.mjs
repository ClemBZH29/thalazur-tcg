import { construirePool, deduireGrades } from "../src/lib/roster.js";
import { specialesPour } from "../src/config/speciales.js";
import { TAUX_DEFAUT, TIER_ORDER, REVENTE } from "../src/config/tiers.js";
import { construireMarche, Marche, jourCourant, CFG } from "../src/comptoir/marche.js";
import { acheteursDuJour } from "../src/comptoir/acheteurs.js";
import { readFileSync } from "node:fs";

const r = JSON.parse(readFileSync(new URL("../data/troupe-valeran.json", import.meta.url), "utf8"));
const grades = deduireGrades(r.lignes);
const pool = construirePool(r.lignes, grades);
const sp = specialesPour("troupe-valeran");
const jeu = [...TIER_ORDER.flatMap(t => pool[t] || []), ...sp.fullart, ...sp.pj];
console.log("cartes du set :", jeu.length, "| par palier :",
  Object.fromEntries(TIER_ORDER.map(t => [t, jeu.filter(c=>c.tier===t).length])));

const arts = construireMarche(jeu, TAUX_DEFAUT);
const jour = jourCourant();
const M = new Marche(arts, null, jour);
console.log("jour", jour, "| articles", arts.length, "| fonds", Math.round(M.fonds));

console.log("\n--- prix par palier (normale) ---");
for (const t of TIER_ORDER) {
  const a = arts.filter(x=>x.tier===t && !x.rainbow);
  if (!a.length) continue;
  const f = (g) => Math.round(a.reduce((s,x)=>s+g(x),0)/a.length*10)/10;
  console.log(`${t.padEnd(11)} revente ${String(REVENTE[t]).padStart(3)} PO  ancrage ${String(f(x=>x.ancrage)).padStart(7)}  rayon ${String(f(x=>M.stock[x.id])).padStart(5)}  ask ${String(f(x=>M.cotation(x).ask)).padStart(7)}  bid ${String(f(x=>M.cotation(x).bid)).padStart(7)}`);
}
console.log("\n--- prix par palier (rainbow) ---");
for (const t of TIER_ORDER) {
  const a = arts.filter(x=>x.tier===t && x.rainbow);
  if (!a.length) continue;
  const f = (g) => Math.round(a.reduce((s,x)=>s+g(x),0)/a.length*10)/10;
  console.log(`${t.padEnd(11)} ancrage ${String(f(x=>x.ancrage)).padStart(7)}  rayon ${String(f(x=>M.stock[x.id])).padStart(5)}  ask ${String(f(x=>M.cotation(x).ask)).padStart(7)}  bid ${String(f(x=>M.cotation(x).bid)).padStart(7)}`);
}
const bs = acheteursDuJour(jour);
console.log("\n--- garde-fous ---", (()=>{const g=M.gardeFous(bs);return `liq ${(g.liq*100).toFixed(0)} % | liqMax ${(g.liqMax*100).toFixed(0)} %`;})());
console.log("\n--- affinités du jour :", bs.map(b=>b.nom).join(", "));
for (const b of bs) {
  const inter = arts.filter(a => M.affinite(a,b) > 0);
  const top = inter.sort((x,y)=>M.offreUnitaire(y,b)-M.offreUnitaire(x,b)).slice(0,3);
  console.log(`  ${b.nom.padEnd(22)} ${String(inter.length).padStart(3)} articles  ex.: ` +
    top.map(a=>`${a.carte.nom}${a.rainbow?" (rainbow)":""} ${Math.round(M.offreUnitaire(a,b))} PO`).join(" · "));
}
const taille = JSON.stringify(M.serialiser()).length;
console.log("\npoids en stockage :", Math.round(taille/1024), "Ko");
