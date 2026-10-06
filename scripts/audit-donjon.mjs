/**
 * Audit du Donjon : ce que rapporte une descente, ce qu'elle coûte, et ce
 * que pèsent les choix du joueur.
 *
 *   node scripts/audit-donjon.mjs            # 2 000 descentes par cas
 *   node scripts/audit-donjon.mjs 500        # plus rapide
 *
 * Les règles sont celles de `src/donjon/regles.js` et
 * `src/donjon/experience.js` : rien n'est recopié. Le joueur simulé choisit
 * ses salles au hasard parmi celles qui s'ouvrent, prend le premier choix
 * disponible des rencontres, et joue au pilote automatique. C'est un
 * plancher : un joueur qui lit la carte et choisit ses rencontres fait mieux.
 */
import { readFileSync } from "node:fs";
import extension from "../src/extensions/troupe-valeran/extension.js";
import {
  ETAGES, RENCONTRES, etagesDe, ROLES, COMPETENCES, cartesDonjon, choixAuto, choixIA, convalescences, creerPartie, demarrerCombat,
  apprentissage, compositionDuJour, descendre, entrer, gainsXP, issue, ouverts, prochain, rapporte, repos, resoudre, roleCarte, tirage, tresor, victoire,
} from "../src/donjon/regles.js";
import { PALIER_IRISEE, xpPourNiveau } from "../src/donjon/experience.js";
import { sourceDe } from "../src/donjon/pouvoirs.js";
import { DONJON, ECONOMIE, poDuButin } from "../src/config/tiers.js";

const BLOCAGES = [];
const N = Number(process.argv[2]) || 2000;
const roster = JSON.parse(readFileSync(new URL("../src/extensions/troupe-valeran/roster.json", import.meta.url), "utf8"));
const POOLS = cartesDonjon([{ ...extension, roster }]);
const ORDRE = ["legendaire", "rare", "peucommun", "commun"];
const pct = (x) => `${Math.round(x * 100)} %`;
const f1 = (x) => x.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const moy = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0);

/* ── Les équipes ─────────────────────────────────────────────────────── */

/** Une collection tirée comme au sortir des boosters ; on emmène les quatre meilleurs. */
function collectionTiree(r, taille = 18) {
  const poids = [["commun", 58], ["peucommun", 28], ["rare", 11], ["legendaire", 3]];
  const coll = new Set();
  while (coll.size < taille) {
    let x = r() * 100, t = "commun";
    for (const [k, v] of poids) { x -= v; if (x <= 0) { t = k; break; } }
    const l = POOLS.allies.filter((c) => c.tier === t);
    coll.add(l[Math.floor(r() * l.length)]);
  }
  return [...coll].sort((a, b) => ORDRE.indexOf(a.tier) - ORDRE.indexOf(b.tier));
}
const auPalier = (r, tier, n = 4) => {
  const l = POOLS.allies.filter((c) => c.tier === tier);
  return Array.from({ length: n }, () => l[Math.floor(r() * l.length)]);
};
const duRole = (r, role, tier) => {
  const l = POOLS.allies.filter((c) => roleCarte(c) === role && (!tier || c.tier === tier));
  return l.length ? l[Math.floor(r() * l.length)] : null;
};

/** Un lieu de la collection, tiré au palier comme au sortir des boosters. */
function lieuTire(r) {
  const poids = [["commun", 58], ["peucommun", 28], ["rare", 11], ["legendaire", 3]];
  let x = r() * 100, t = "commun";
  for (const [k, v] of poids) { x -= v; if (x <= 0) { t = k; break; } }
  const l = POOLS.lieux.filter((c) => c.tier === t);
  return l[Math.floor(r() * l.length)];
}

/* ── Une descente ────────────────────────────────────────────────────── */

/**
 * `politique(partie)` décide à la sortie de chaque gardien : true pour
 * descendre. `niveau` : le niveau de toute l'équipe.
 */
function descente(graine, { equipe, strategie = "concentrer", politique = () => true, niveau = 1, source = "hasard", apprenti = null, mode = "jour", fiches = null, niveauSource = null, etoileSource = false }) {
  const r = tirage(graine * 7919 + 17);
  const eq = typeof equipe === "function" ? equipe(r) : equipe;
  // Plus d'artéfact au départ (01/10/2026) : une source de pouvoir, un lieu
  // tiré comme une carte de la collection (« hasard »), imposé, ou aucun.
  const lieuSource = source === "hasard" ? lieuTire(r) : source;
  const niveaux = Object.fromEntries(eq.map((c) => [`${c.ext}:${c.id}`, niveau]));
  const M = DONJON.modes[mode];
  const partie = creerPartie({ equipe: eq, source: lieuSource ? { c: lieuSource, niveau: niveauSource ?? niveau, etoile: etoileSource } : null, graine: mode === "infini" ? graine * 104729 : graine % 365, jour: "2026-09-28", pools: POOLS, niveaux, fiches: fiches ? fiches(eq) : {}, apprenti, mode, gainMode: 1, xpMode: M.xp });
  const trace = { tours: [], salles: {}, combatsPerdusGenre: null };
  const fin = (iss) => ({ iss, partie, trace, butin: rapporte(partie, iss), repos: convalescences(partie, iss), xp: gainsXP(partie, iss) });
  for (let pas = 0; pas < 3000; pas++) {
    const o = ouverts(partie.plan);
    const n = entrer(partie, o[Math.floor(r() * o.length)]);
    trace.salles[n.genre] = (trace.salles[n.genre] || 0) + 1;
    if (n.genre === "tresor") tresor(partie, r, POOLS.artefacts);
    if (n.genre === "repos") repos(partie);
    if (n.genre === "evenement") {
      const ch = RENCONTRES[Math.floor(r() * RENCONTRES.length)].choix(partie, { r, pools: POOLS });
      ch.find((c) => c.ok !== false).f();
      if (!partie.equipe.some((u) => !u.ko)) return fin("defaite");
    }
    if (["combat", "elite", "boss"].includes(n.genre)) {
      const C = demarrerCombat(partie, n.genre, r, POOLS);
      let f = null, t = 0;
      for (; t < 600 && !f; t++) {
        const u = prochain(partie, C);
        if (!u) { f = issue(partie, C); break; } // un saignement ou une salve a clos le combat
        const { geste, cible } = u.camp === "e" ? choixIA(partie, C, u, r) : choixAuto(partie, C, u, strategie);
        resoudre(partie, C, u, geste, cible, r);
        f = issue(partie, C);
      }
      trace.tours.push({ genre: n.genre, round: C.round, actions: t });
      if (f === "defaite") { trace.combatsPerdusGenre = n.genre; return fin("defaite"); }
      if (!f) { // combat sans issue : on le compte, et on garde de quoi comprendre
        const q = (u) => `${u.camp}:${u.role}:${u.pv}/${u.pvMax}:atq${u.atq}${u.ko ? ":ko" : ""}`;
        BLOCAGES.push({ genre: n.genre, etage: partie.etage, equipe: partie.equipe.map(q), ennemis: C.ennemis.map(q) });
        return fin("blocage");
      }
      victoire(partie, C, r, POOLS.artefacts);
      if (n.genre === "boss") {
        if (partie.etage >= etagesDe(partie) || !politique(partie)) return fin("sortie");
        descendre(partie, POOLS);
      }
    }
  }
  throw new Error(`descente sans fin (graine ${graine}, étage ${partie.etage}, reliques ${partie.reliques.length}, source ${partie.source?.c?.nom}, équipe ${partie.equipe.map((u) => `${u.c.nom} ${u.pv}/${u.pvMax}${u.ko ? " ko" : ""}`).join(", ")})`);
}

function mesurer(cas) {
  const res = Array.from({ length: N }, (_, i) => descente(i + 1, cas));
  const po = res.map((x) => x.butin * DONJON.multiplicateur);
  const complet = res.filter((x) => x.iss === "sortie" && x.partie.stats.gardiens >= ETAGES).length / N;
  const defaite = res.filter((x) => x.iss === "defaite");
  const etages = [1, 2, 3].map((e) => defaite.filter((x) => x.partie.etage === e).length / N);
  const joursRepos = moy(res.map((x) => x.repos.reduce((s, y) => s + y.jours, 0)));
  const xp = moy(res.map((x) => moy(x.xp.map((y) => y.xp)) || 0));
  return { res, po: moy(po), complet, defaite: defaite.length / N, etages, joursRepos, xp,
    perduSur: defaite.reduce((m, x) => ((m[x.trace.combatsPerdusGenre || "rencontre"] = (m[x.trace.combatsPerdusGenre || "rencontre"] || 0) + 1), m), {}) };
}

const ligne = (nom, m) => `| ${nom} | ${pct(m.complet)} | ${pct(m.defaite)} | ${m.etages.map(pct).join(" · ")} | ${f1(m.po)} | ${f1(m.xp)} | ${f1(m.joursRepos)} |`;
const entete = "| Cas | Trois gardiens | Défaite | Défaite à l'étage 1 · 2 · 3 | PO créditées | XP par carte | Jours de repos |\n|---|---:|---:|---|---:|---:|---:|";

console.log(`# Audit du Donjon — ${N} descentes par cas\n`);

/* 1. Rôles des alliés dans le roster */
const roles = {};
for (const c of POOLS.allies) roles[roleCarte(c)] = (roles[roleCarte(c)] || 0) + 1;
console.log("## Rôles des alliés du roster\n");
console.log("| Rôle | Cartes |\n|---|---:|");
for (const [k, v] of Object.entries(roles).sort((a, b) => b[1] - a[1])) console.log(`| ${ROLES[k].nom} | ${v} |`);
const repDebrouillard = [...new Set(POOLS.allies.filter((c) => roleCarte(c) === "debrouillard").map((c) => c.rep1))];
console.log(`\nArchétypes tombés dans « Débrouillard » par défaut : ${repDebrouillard.join(", ")}`);
console.log(`\nAlliés ${POOLS.allies.length}, bestiaire ${POOLS.monstres.length}, rivaux ${POOLS.rivaux.length}, lieux ${POOLS.lieux.length}, artéfacts ${POOLS.artefacts.length}\n`);

/* 2. Stratégies, équipe tirée d'une collection de 18 */
console.log("## Stratégies (collection de 18, les 4 meilleurs, on descend toujours)\n");
console.log(entete);
const typique = (r) => collectionTiree(r).slice(0, 4);
const parStrat = {};
for (const s of ["concentrer", "menace", "prudence"]) { parStrat[s] = mesurer({ equipe: typique, strategie: s }); console.log(ligne(s, parStrat[s])); }

/* 3. Paliers : quatre cartes du même palier */
console.log("\n## Palier de l'équipe (Concentrer, on descend toujours)\n");
console.log(entete);
for (const t of ["commun", "peucommun", "rare", "legendaire"]) console.log(ligne(t, mesurer({ equipe: (r) => auPalier(r, t) })));

/* 4. Niveaux : quatre communes à différents niveaux */
console.log("\n## Niveau d'une équipe de communes (Concentrer)\n");
console.log(entete);
for (const n of [1, 20, 50, 100]) console.log(ligne(`communes niv. ${n}`, mesurer({ equipe: (r) => auPalier(r, "commun"), niveau: n })));
console.log(ligne("peu communes niv. 1 (repère)", mesurer({ equipe: (r) => auPalier(r, "peucommun") })));

/* 4 bis. Apprentissage : le Donjon adouci des débuts */
const cfgA = DONJON.apprentissage;
console.log(`\n## Apprentissage (jeu normal à la ${cfgA.jusqua}ᵉ descente)\n`);
console.log(entete);
for (const b of [0, Math.round(cfgA.jusqua / 3), Math.round((2 * cfgA.jusqua) / 3), cfgA.jusqua]) {
  const ap = apprentissage(b, cfgA);
  console.log(ligne(`communes, ${b} descentes (adversaires ×${ap.difficulte.toFixed(2).replace(".", ",")}, butin ×${ap.gain.toFixed(2).replace(".", ",")})`, mesurer({ equipe: (r) => auPalier(r, "commun"), apprenti: ap })));
}
for (const b of [0, cfgA.jusqua]) {
  const ap = apprentissage(b, cfgA);
  // Une collection de débutant : huit cartes tirées, les quatre meilleures.
  console.log(ligne(`collection de 8, ${b} descentes`, mesurer({ equipe: (r) => collectionTiree(r, 8).slice(0, 4), apprenti: ap })));
}

/* 5. Rôles : trois peu communes au hasard + une du rôle */
console.log("\n## Ce que vaut un rôle (trois peu communes au hasard + une carte du rôle, peu commune)\n");
console.log(entete);
for (const role of Object.keys(ROLES)) {
  const m = mesurer({ equipe: (r) => { const x = duRole(r, role, "peucommun") || duRole(r, role); return [...auPalier(r, "peucommun", 3), x]; } });
  console.log(ligne(ROLES[role].nom, m));
}
console.log(ligne("quatre soigneurs", mesurer({ equipe: (r) => [0, 1, 2, 3].map(() => duRole(r, "soigneur")) })));
console.log(ligne("quatre frappeurs", mesurer({ equipe: (r) => [0, 1, 2, 3].map(() => duRole(r, "frappeur")) })));

/* 6. Politiques de sortie */
console.log("\n## Quand remonter (collection de 18, Concentrer)\n");
console.log(entete);
const pols = { "après le 1er gardien": (p) => p.etage < 1, "après le 2e gardien": (p) => p.etage < 2, "toujours descendre": () => true,
  "descendre si 3 debout": (p) => p.equipe.filter((u) => !u.ko).length >= 3 };
const parPol = {};
for (const [k, f] of Object.entries(pols)) { parPol[k] = mesurer({ equipe: typique, politique: f }); console.log(ligne(k, parPol[k])); }

/* 7. Où l'on perd */
const m0 = parStrat.concentrer;
console.log("\n## Où l'on tombe (Concentrer, toujours descendre)\n");
console.log("| Salle | Part des défaites |\n|---|---:|");
const tot = Object.values(m0.perduSur).reduce((s, x) => s + x, 0);
for (const [k, v] of Object.entries(m0.perduSur).sort((a, b) => b[1] - a[1])) console.log(`| ${k} | ${pct(v / tot)} |`);

/* 8. Longueur des combats */
console.log("\n## Longueur des combats (Concentrer)\n");
console.log("| Salle | Tours | Actions |\n|---|---:|---:|");
for (const g of ["combat", "elite", "boss"]) {
  const l = m0.res.flatMap((x) => x.trace.tours.filter((t) => t.genre === g));
  console.log(`| ${g} | ${f1(moy(l.map((t) => t.round)))} | ${f1(moy(l.map((t) => t.actions)))} |`);
}
const salles = moy(m0.res.map((x) => x.partie.stats.salles));
const combats = moy(m0.res.map((x) => x.trace.tours.length));
const actions = moy(m0.res.map((x) => x.trace.tours.reduce((s, t) => s + t.actions, 0)));
console.log(`\nPar descente : ${f1(salles)} salles, ${f1(combats)} combats, ${f1(actions)} actions.`);
// Au pilote ×1 : ~480 ms par action ennemie, ~420 ms alliée, plus l'animation (~460 ms) ; ×4 divise par quatre.
const sec = (v) => (actions * 0.95) / v + salles * 3;
console.log(`Durée estimée : ${f1(sec(1) / 60)} min au pilote ×1, ${f1(sec(4) / 60)} min au pilote ×4 (3 s de lecture par salle).`);

/* 9. Le donjon infini : 100 PO l'entrée, jusqu'à la chute, tout le sac converti par une courbe concave */
const MI = DONJON.modes.infini;
console.log(`\n## Donjon infini (entrée ${MI.entree} PO, Concentrer, jusqu'à la chute)\n`);
const quant = (l, q) => [...l].sort((a, b) => a - b)[Math.floor(q * (l.length - 1))];
const lieuxLeg = POOLS.lieux.filter((l) => l.tier === "legendaire");
const PROFILS = {
  "Débutant (18 cartes, niv. 1)": { equipe: (r) => collectionTiree(r, 18).slice(0, 4), niveau: 1 },
  "Moyen (45 cartes, niv. 25)": { equipe: (r) => collectionTiree(r, 45).slice(0, 4), niveau: 25 },
  "Avancé (45 cartes, niv. 60)": { equipe: (r) => collectionTiree(r, 45).slice(0, 4), niveau: 60 },
  "Fort (4 légendaires niv. 100, source légendaire étoilée)": { equipe: (r) => auPalier(r, "legendaire"), niveau: 100, source: lieuxLeg[0], niveauSource: 100, etoileSource: true },
};
console.log("| Profil | Gardiens, médiane · 9/10 sous | Sac moyen | PO moyennes · médiane | Net après l'entrée | XP par carte |\n|---|---|---:|---:|---:|---:|");
let inf = [];
for (const [nom, cas] of Object.entries(PROFILS)) {
  const res = Array.from({ length: N }, (_, i) => descente(i + 1, { ...cas, mode: "infini" }));
  if (!inf.length) inf = res;
  const g = res.map((x) => x.partie.stats.gardiens), po = res.map((x) => poDuButin(x.butin, "infini"));
  console.log(`| ${nom} | ${quant(g, 0.5)} · ${quant(g, 0.9)} | ${f1(moy(res.map((x) => x.butin)))} | ${f1(moy(po))} · ${quant(po, 0.5)} | ${f1(moy(po) - MI.entree)} | ${f1(moy(res.map((x) => moy(x.xp.map((y) => y.xp)) || 0)))} |`);
}

/* 9 bis. Le donjon du jour, composition imposée */
console.log("\n## Donjon du jour : équipe libre ou composition imposée (meilleures cartes de chaque rôle imposé)\n");
console.log("| Collection | Libre : trois gardiens · butin | Imposée : trois gardiens · butin |\n|---|---|---|");
for (const [taille, niv] of [[18, 1], [45, 25]]) {
  const st = (l) => `${pct(l.filter((x) => x.iss === "sortie" && x.partie.stats.gardiens >= ETAGES).length / N)} · ${f1(moy(l.map((x) => x.butin)))}`;
  const libre = [], impose = [];
  for (let i = 1; i <= N; i++) {
    const coll = collectionTiree(tirage(i * 31 + 5), taille);
    const comp = compositionDuJour(`2026-10-${String(1 + (i % 28)).padStart(2, "0")}`, coll, []);
    const eq = Object.entries(comp.roles).flatMap(([k, n]) => coll.filter((c) => roleCarte(c) === k).slice(0, n));
    libre.push(descente(i, { equipe: coll.slice(0, 4), niveau: niv }));
    impose.push(descente(i, { equipe: eq, niveau: niv }));
  }
  console.log(`| ${taille} cartes, niv. ${niv} | ${st(libre)} | ${st(impose)} |`);
}

/* 10. Économie */
const MJ = DONJON.modes.jour;
const poJourMode = m0.po * MJ.gain * MJ.tentatives;
// Trois descentes infinies d'un débutant, entrée déduite.
const poInf = 3 * (moy(inf.map((x) => poDuButin(x.butin, "infini"))) - MI.entree);
console.log("\n## Économie\n");
console.log(`| Grandeur | Valeur |\n|---|---:|`);
console.log(`| PO de base par descente (moyenne, sans le multiplicateur du mode) | ${f1(m0.po)} |`);
console.log(`| Donjon du jour : ${MJ.tentatives} descente, butin ×${MJ.gain} | ${f1(poJourMode)} |`);
console.log(`| Donjon infini : trois descentes d'un débutant, entrée déduite | ${f1(poInf)} |`);
console.log(`| Par jour, les deux | ${f1(poJourMode + poInf)} |`);
console.log(`| En boosters par jour | ${f1((poJourMode + poInf) / ECONOMIE.prix)} |`);
console.log(`| Rapporté au gain passif (${ECONOMIE.parHeure * 24} PO/j) | ×${f1(1 + (poJourMode + poInf) / (ECONOMIE.parHeure * 24))} |`);
const meilleur = Object.entries(parPol).sort((a, b) => b[1].po - a[1].po)[0];
console.log(`| Meilleure politique de sortie (donjon du jour) | ${meilleur[0]}, ${f1(meilleur[1].po * MJ.gain)} PO |`);

/* 11. Expérience */
console.log("\n## Expérience : descentes pour l'irisation (Concentrer, collection de 18)\n");
const xpD = m0.xp;
console.log("| Palier | Niveau | XP | Descentes du jour | Jours (une par jour) |\n|---|---:|---:|---:|---:|");
for (const [t, n] of Object.entries(PALIER_IRISEE)) {
  const x = xpPourNiveau(n);
  console.log(`| ${t} | ${n} | ${x} | ${f1(x / xpD)} | ${f1(x / xpD)} |`);
}
console.log(`| niveau 100 | 100 | ${xpPourNiveau(100)} | ${f1(xpPourNiveau(100) / xpD)} | ${f1(xpPourNiveau(100) / xpD)} |`);

/*
 * La fiche de combat : ce que pèsent les rangs, les compétences et les
 * étoiles. Le cas réaliste : une seule carte de l'équipe modifiée (la
 * meilleure, celle qu'on emmène toujours) ; puis l'équipe entière.
 */
{
  console.log("\n## Fiche de combat (collection de 18, Concentrer, niveau 1)\n");
  console.log("Sauf mention, seule la meilleure carte de l'équipe porte la fiche.\n");
  console.log(entete);
  const eq = (r) => collectionTiree(r).slice(0, 4);
  const toutes = (f) => (l) => Object.fromEntries(l.map((c) => [`${c.ext}:${c.id}`, f]));
  const une = (f) => (l) => ({ [`${l[0].ext}:${l[0].id}`]: f });
  const E4 = { atq: true, ini: true, geste: true, tech: true };
  const cas = [
    ["Sans fiche (référence)", null],
    ["ATQ +3", une({ atq: 3 })],
    ["INI +3", une({ ini: 3 })],
    ["Rangs complets", une({ atq: 3, ini: 3 })],
    ...Object.values(COMPETENCES).filter((k) => k.place === "geste" && k.id !== "attaque").map((k) => [`Geste : ${k.nom}`, une({ geste: k.id })]),
    ...Object.values(COMPETENCES).filter((k) => k.place === "tech").map((k) => [`Technique : ${k.nom}`, une({ tech: k.id })]),
    ["ATQ étoilée", une({ etoiles: { atq: true } })],
    ["INI étoilée", une({ etoiles: { ini: true } })],
    ["Geste étoilé", une({ etoiles: { geste: true } })],
    ["Technique étoilée", une({ etoiles: { tech: true } })],
    ["Quatre étoiles", une({ etoiles: E4 })],
    ["Équipe : rangs complets", toutes({ atq: 3, ini: 3 })],
    ["Équipe : quatre étoiles", toutes({ etoiles: E4 })],
  ];
  for (const [nom, fiches] of cas) console.log(ligne(nom, mesurer({ equipe: eq, fiches })));
}

/* Les sources de pouvoir, une par une (niveau 1, puis niveau 100 étoilé). */
{
  console.log("\n## Sources de pouvoir (collection de 18, Concentrer)\n");
  console.log("| Lieu | Palier | Effet | Trois gardiens (niv. 1) | PO (niv. 1) | Trois gardiens (niv. 100 ★) |\n|---|---|---|---:|---:|---:|");
  const eq = (r) => collectionTiree(r).slice(0, 4);
  const sans = mesurer({ equipe: eq, source: null });
  console.log(`| Sans source | — | — | ${pct(sans.complet)} | ${f1(sans.po)} | — |`);
  const ordre = ["commun", "peucommun", "rare", "legendaire"];
  for (const l of [...POOLS.lieux].sort((a, b) => ordre.indexOf(a.tier) - ordre.indexOf(b.tier))) {
    const m1 = mesurer({ equipe: eq, source: l });
    const m100 = mesurer({ equipe: eq, source: l, niveauSource: 100, etoileSource: true });
    console.log(`| ${l.nom} | ${l.tier} | ${sourceDe(l).nom} | ${pct(m1.complet)} | ${f1(m1.po)} | ${pct(m100.complet)} |`);
  }
}

console.log(`\n## Combats sans issue\n\n${BLOCAGES.length} combats ont dépassé 600 actions sur l'ensemble des cas.`);
for (const b of BLOCAGES.slice(0, 6)) console.log(`- ${b.genre}, étage ${b.etage} — équipe ${b.equipe.join(" ")} — en face ${b.ennemis.join(" ")}`);
