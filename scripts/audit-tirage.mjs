/**
 * Audit du tirage : ce que vaut chaque palier, carte par carte, et le temps
 * qu'il faut pour compléter une extension.
 *
 *   node scripts/audit-tirage.mjs [joueurs, 1000 par défaut] [boosters par jour, 7]
 *
 * La question n'est pas « combien de légendaires par booster » mais « quelle
 * chance de tirer *cette* légendaire » : la table d'un palier se partage entre
 * toutes ses cartes. C'est ce chiffre qui fait sentir la rareté, et c'est lui
 * qui ordonne la complétion.
 *
 * Tout vient du site : tirage (src/lib/draw.js), filets (GARANTIES),
 * colporteur (passage et affaires de src/config/colporteur.js), carte du jour
 * du Reliquaire, trouvailles d'Expéditions. Les full art et les PJ sont hors
 * sujet : ils ont leur propre tirage, au booster entier.
 *
 * Le joueur simulé ouvre ses boosters et accepte le troc de Mirko chaque fois
 * qu'il est proposé — c'est le comportement le plus rapide, donc la borne
 * basse du temps de complétion. Le Comptoir et le Reliquaire n'y sont pas :
 * ils accélèrent encore (voir audit-reliquaire.mjs).
 */
import { readFileSync } from "node:fs";
import { ouvrirBooster, fullartParBooster } from "../src/lib/draw.js";
import { construirePool, deduireGrades } from "../src/lib/roster.js";
import { GARANTIES, TAUX_DEFAUT, SLOTS, TABLE_APPEL } from "../src/config/tiers.js";
import { TABLE_PARI, passeAujourdhui, propositions } from "../src/config/colporteur.js";
import { EXPEDITION } from "../src/config/expeditions.js";
import { frequences, prixAveugle, esperanceForge } from "../src/reliquaire/regles.js";

const JOUEURS = Number(process.argv[2]) || 1000;
const PAR_JOUR = Number(process.argv[3]) || 7;
const MAX = 3000;
const ID = "troupe-valeran";
const roster = JSON.parse(readFileSync(new URL(`../src/extensions/${ID}/roster.json`, import.meta.url), "utf8"));
const pool = construirePool(roster.lignes, deduireGrades(roster.lignes));
const PALIERS = ["commun", "peucommun", "rare", "legendaire"];
const N = Object.fromEntries(PALIERS.map((t) => [t, pool[t].length]));
const pct = (x, d = 2) => `${(x * 100).toFixed(d).replace(".", ",")} %`;
const nb = (x, d = 2) => x.toFixed(d).replace(".", ",");

function rng(g) {
  let a = g >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : "—"; };

/** Une partie : boosters ouverts jusqu'à compléter les quatre paliers. */
function partie(graine, troc) {
  const r = rng(graine);
  const coll = {};
  let pity = { depuis: 0, vu: false }, colp = null, premiere = null;
  const fini = {}, m = { boosters: 0, cartes: {}, avecLeg: 0, filet: 0, trocs: {} };
  const manquantes = (t) => pool[t].filter((c) => !coll[c.id]?.normale).length;
  for (let b = 0; b < MAX; b++) {
    const garantir = (!pity.vu && b + 1 >= GARANTIES.premierLegendaire) || pity.depuis + 1 >= GARANTIES.intervalle;
    const res = ouvrirBooster(pool, TAUX_DEFAUT, { garantirLegendaire: garantir, rng: r });
    const leg = res.cards.some((c) => c.tier === "legendaire");
    pity = { depuis: leg ? 0 : pity.depuis + 1, vu: pity.vu || leg };
    if (b < 400) {
      m.boosters++;
      if (leg) m.avecLeg++;
      if (res.garanti) m.filet++;
      for (const c of res.cards) m.cartes[c.tier] = (m.cartes[c.tier] || 0) + 1;
    }
    if (leg && premiere === null) premiere = { b: b + 1, filet: res.garanti };
    for (const c of res.cards) {
      const e = (coll[c.id] ||= { normale: 0, rainbow: 0, carte: c });
      e[c.rainbow ? "rainbow" : "normale"]++;
    }

    if (troc) {
      const jour = `j${Math.floor(b / PAR_JOUR)}`;
      if (passeAujourdhui(colp, b + 1, r, jour)) {
        colp = { jour, depuis: 0 };
        const deal = propositions({ collection: coll, pool, bourse: { po: 0 } }, b).find((d) => d.id === "troc");
        if (deal) {
          for (const x of deal.effet.retire) coll[x.carteId][x.version] -= x.n;
          const cibles = pool[deal.effet.troc].filter((c) => !coll[c.id]?.normale);
          const c = cibles[Math.floor(r() * cibles.length)];
          (coll[c.id] ||= { normale: 0, rainbow: 0, carte: c }).normale++;
          m.trocs[deal.effet.troc] = (m.trocs[deal.effet.troc] || 0) + 1;
        }
      } else colp = { jour: colp?.jour ?? null, depuis: (colp?.depuis || 0) + 1 };
    }

    for (const t of PALIERS) if (!fini[t] && manquantes(t) === 0) fini[t] = b + 1;
    if (PALIERS.every((t) => fini[t])) { fini.tout = b + 1; break; }
  }
  return { fini, premiere, m };
}

function serie(troc) {
  const fin = Object.fromEntries([...PALIERS, "tout"].map((t) => [t, []]));
  const tot = { boosters: 0, cartes: {}, avecLeg: 0, filet: 0, trocs: {} };
  const premieres = [];
  for (let j = 0; j < JOUEURS; j++) {
    const { fini, premiere, m } = partie(9001 + j * 7919, troc);
    for (const t of Object.keys(fin)) if (fini[t]) fin[t].push(fini[t]);
    tot.boosters += m.boosters; tot.avecLeg += m.avecLeg; tot.filet += m.filet;
    for (const [t, n] of Object.entries(m.cartes)) tot.cartes[t] = (tot.cartes[t] || 0) + n;
    for (const [t, n] of Object.entries(m.trocs)) tot.trocs[t] = (tot.trocs[t] || 0) + n;
    if (premiere) premieres.push(premiere);
  }
  return { fin, tot, premieres };
}

console.log(`Audit du tirage — ${ID}, ${JOUEURS} joueurs, ${PAR_JOUR} boosters par jour`);
console.log(`Roster : ${PALIERS.map((t) => `${N[t]} ${t}`).join(" · ")}\n`);

const sans = serie(false);
const { tot, premieres } = sans;
console.log("1. Une carte précise, par booster (filet et Appel compris)");
for (const t of PALIERS) {
  const parB = (tot.cartes[t] || 0) / tot.boosters;
  console.log(`   ${t.padEnd(11)} ${nb(parB, 3)} par booster · ${pct(parB / N[t])} par carte`);
}
console.log(`\n2. Légendaires`);
console.log(`   un booster sur ${nb(tot.boosters / tot.avecLeg, 1)} en contient une`);
console.log(`   part apportée par le filet : ${pct(tot.filet / tot.avecLeg, 0)}`);
console.log(`   première légendaire : booster ${nb(premieres.reduce((s, p) => s + p.b, 0) / premieres.length, 1)} en moyenne, ` +
  `${pct(premieres.filter((p) => p.filet).length / premieres.length, 0)} par le filet`);
const appelLeg = 5 * TABLE_APPEL.legendaire * TAUX_DEFAUT.appel;
console.log(`   apport de l'Appel : ${nb(appelLeg, 4)} légendaire par booster`);

const avec = serie(true);
console.log(`\n3. Complétion, en boosters — médiane (10 % – 90 %)`);
console.log(`   ${"".padEnd(11)} ${"boosters seuls".padEnd(22)} avec le troc de Mirko`);
for (const t of [...PALIERS, "tout"]) {
  const f = (s) => `${q(s.fin[t], 0.5)} (${q(s.fin[t], 0.1)}–${q(s.fin[t], 0.9)})`;
  console.log(`   ${t.padEnd(11)} ${f(sans).padEnd(22)} ${f(avec)}`);
}
console.log(`   trocs par joueur : ${Object.entries(avec.tot.trocs).map(([t, n]) => `${nb(n / JOUEURS, 1)} ${t}`).join(" · ")}`);
console.log(`   soit ${nb(q(avec.fin.tout, 0.5) / PAR_JOUR, 0)} jours à ${PAR_JOUR} boosters par jour`);

console.log(`\n4. Les autres sources`);
const pari = Object.entries(TABLE_PARI).map(([t, p]) => `${pct(p, 0)} ${t}`).join(" · ");
console.log(`   pari de Mirko : ${pari}`);
const tr = EXPEDITION.trouvailles.poids, trTot = Object.values(tr).reduce((s, v) => s + v, 0);
console.log(`   trouvaille d'expédition : ${Object.entries(tr).map(([t, p]) => `${pct(p / trTot, 0)} ${t}`).join(" · ")}`);
const f = frequences(SLOTS), fTot = PALIERS.reduce((s, t) => s + f[t], 0);
console.log(`   carte du jour du Reliquaire : ${PALIERS.map((t) => `${pct(f[t] / fTot, 1)} ${t}`).join(" · ")}`);
console.log(`   prix à l'aveugle : ${prixAveugle(SLOTS, TAUX_DEFAUT.rainbow)} vestiges (espérance ${nb(esperanceForge(SLOTS, TAUX_DEFAUT.rainbow), 1)})`);
console.log(`   full art : une pour ${Math.round(1 / fullartParBooster(TAUX_DEFAUT))} boosters · PJ : une pour ${Math.round(1 / TAUX_DEFAUT.pj)}`);
console.log(`   rainbow : ${pct(TAUX_DEFAUT.rainbow, 0)} par carte, ${pct(1 - (1 - TAUX_DEFAUT.rainbow) ** 5, 0)} des boosters en ont une`);
