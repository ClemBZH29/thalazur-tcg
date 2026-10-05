import { construirePool, deduireGrades } from "../src/lib/roster.js";
import { specialesPour } from "../src/config/speciales.js";
import { TAUX_DEFAUT, TIER_ORDER, REVENTE } from "../src/config/tiers.js";
import { construireMarche, Marche, jourCourant, CFG } from "../src/comptoir/marche.js";
import { acheteursDuJour, TOUS_ACHETEURS, gaspardEn, PROVINCES, CYCLE } from "../src/comptoir/acheteurs.js";
import { readFileSync } from "node:fs";

const r = JSON.parse(readFileSync(new URL("../src/extensions/troupe-valeran/roster.json", import.meta.url), "utf8"));
const { default: extension } = await import("../src/extensions/troupe-valeran/extension.js");
const grades = deduireGrades(r.lignes);
const pool = construirePool(r.lignes, grades);
const sp = specialesPour(extension);
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
const tous = TOUS_ACHETEURS();
const pct = (x) => `${(x * 100).toFixed(0)} %`;
console.log("\n--- garde-fous ---");
console.log(`  acheteurs du jour   liq ${pct(M.gardeFous(bs).liq)} | liqMax ${pct(M.gardeFous(bs).liqMax)}`);
/* Le pire jour possible : chaque journée du cycle, le Conservateur ajouté
   d'office. C'est lui qui doit rester sous 100 %. */
let pire = 0, pireJour = null;
for (let j = jour; j < jour + CYCLE.length; j++) {
  const l = acheteursDuJour(j);
  const avec = l.some((b) => b.exceptionnel) ? l : [...l, tous.find((b) => b.exceptionnel)];
  const g = M.gardeFous(avec).liqMax;
  if (g > pire) { pire = g; pireJour = avec.map((b) => b.nom.split(" ").pop()).join(", "); }
}
console.log(`  pire jour du cycle  liqMax ${pct(pire)}  (${pireJour}) : doit rester sous 100 %`);

/* Chaque acheteur : ce qu'il regarde, sa prime sur l'échoppe, et si son
   plafond l'écrase encore. Une prime moyenne proche de zéro est un acheteur
   sans caractère : c'était le cas de Sorelle et de Voren sur les rainbow. */
const poids = arts.reduce((s, a) => s + a.p, 0);
console.log("\n--- acheteurs ---");
for (const b of [...tous, ...PROVINCES.slice(1).map((_, i) => gaspardEn(i + 1))]) {
  const inter = arts.filter((a) => M.affinite(a, b) > 0);
  if (!inter.length) { console.log(`  ${b.nom.padEnd(22)} aucun article`); continue; }
  const prime = inter.reduce((s, a) => s + M.offreUnitaire(a, b) / M.cotation(a).bid, 0) / inter.length - 1;
  const plaf = inter.filter((a) => M.offreUnitaire(a, b) >= Math.round(M.plafondDe(a, b))).length;
  const part = inter.reduce((s, a) => s + a.p, 0) / poids;
  console.log(`  ${(b.nom + (b.province ? ` (${b.province.nom})` : "")).padEnd(36)} ${String(inter.length).padStart(3)} articles  ${pct(part).padStart(5)} du surplus  prime ${pct(prime).padStart(5)}  au plafond ${plaf}`);
}

/* La couverture d'un cycle complet : part du surplus qui a preneur, jour par jour. */
let min = 1, somme = 0;
for (let j = jour; j < jour + CYCLE.length; j++) {
  const presents = acheteursDuJour(j);
  const ok = arts.filter((a) => presents.some((b) => M.affinite(a, b) > 0)).reduce((s, a) => s + a.p, 0) / poids;
  min = Math.min(min, ok); somme += ok;
}
console.log(`\n--- couverture sur ${CYCLE.length} jours --- minimum ${pct(min)} | moyenne ${pct(somme / CYCLE.length)}`);

console.log("\n--- affinités du jour :", bs.map(b=>b.nom).join(", "));
for (const b of bs) {
  const inter = arts.filter(a => M.affinite(a,b) > 0);
  const top = inter.sort((x,y)=>M.offreUnitaire(y,b)-M.offreUnitaire(x,b)).slice(0,3);
  console.log(`  ${b.nom.padEnd(22)} ${String(inter.length).padStart(3)} articles  ex.: ` +
    top.map(a=>`${a.carte.nom}${a.rainbow?" (rainbow)":""} ${M.offreUnitaire(a,b)} PO`).join(" · "));
}
const taille = JSON.stringify(M.serialiser()).length;
console.log("\npoids en stockage :", Math.round(taille/1024), "Ko");
