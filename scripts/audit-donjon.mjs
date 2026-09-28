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
  ETAGES, RENCONTRES, ROLES, cartesDonjon, choixAuto, choixIA, convalescences, creerPartie, demarrerCombat,
  apprentissage, descendre, entrer, gainsXP, issue, ouverts, prochain, rapporte, repos, resoudre, roleDe, tirage, tresor, victoire,
} from "../src/donjon/regles.js";
import { PALIER_IRISEE, xpPourNiveau } from "../src/donjon/experience.js";
import { DONJON, ECONOMIE } from "../src/config/tiers.js";

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
  const l = POOLS.allies.filter((c) => roleDe(c.rep1) === role && (!tier || c.tier === tier));
  return l.length ? l[Math.floor(r() * l.length)] : null;
};

/* ── Une descente ────────────────────────────────────────────────────── */

/**
 * `politique(partie)` décide à la sortie de chaque gardien : true pour
 * descendre. `niveau` : le niveau de toute l'équipe.
 */
function descente(graine, { equipe, strategie = "concentrer", politique = () => true, niveau = 1, artefact = true, apprenti = null }) {
  const r = tirage(graine * 7919 + 17);
  const eq = typeof equipe === "function" ? equipe(r) : equipe;
  const art = artefact ? POOLS.artefacts[Math.floor(r() * POOLS.artefacts.length)] : null;
  const niveaux = Object.fromEntries(eq.map((c) => [`${c.ext}:${c.id}`, niveau]));
  const partie = creerPartie({ equipe: eq, artefact: art, graine: graine % 365, jour: "2026-09-28", pools: POOLS, niveaux, apprenti });
  const trace = { tours: [], salles: {}, combatsPerdusGenre: null };
  const fin = (iss) => ({ iss, partie, trace, butin: rapporte(partie, iss), repos: convalescences(partie, iss), xp: gainsXP(partie, iss) });
  for (let pas = 0; pas < 300; pas++) {
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
        if (partie.etage >= ETAGES || !politique(partie)) return fin("sortie");
        descendre(partie, POOLS);
      }
    }
  }
  throw new Error("descente sans fin");
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
for (const c of POOLS.allies) roles[roleDe(c.rep1)] = (roles[roleDe(c.rep1)] || 0) + 1;
console.log("## Rôles des alliés du roster\n");
console.log("| Rôle | Cartes |\n|---|---:|");
for (const [k, v] of Object.entries(roles).sort((a, b) => b[1] - a[1])) console.log(`| ${ROLES[k].nom} | ${v} |`);
const repDebrouillard = [...new Set(POOLS.allies.filter((c) => roleDe(c.rep1) === "debrouillard").map((c) => c.rep1))];
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
console.log(`\n## Apprentissage (jeu normal à ${cfgA.jusqua} boosters ouverts)\n`);
console.log(entete);
for (const b of [0, Math.round(cfgA.jusqua / 3), Math.round((2 * cfgA.jusqua) / 3), cfgA.jusqua]) {
  const ap = apprentissage(b, cfgA);
  console.log(ligne(`communes, ${b} boosters (adversaires ×${ap.difficulte.toFixed(2).replace(".", ",")}, butin ×${ap.gain.toFixed(2).replace(".", ",")})`, mesurer({ equipe: (r) => auPalier(r, "commun"), apprenti: ap })));
}
for (const b of [0, cfgA.jusqua]) {
  const ap = apprentissage(b, cfgA);
  // Une collection de débutant : huit cartes tirées, les quatre meilleures.
  console.log(ligne(`collection de 8, ${b} boosters`, mesurer({ equipe: (r) => collectionTiree(r, 8).slice(0, 4), apprenti: ap })));
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

/* 9. Économie */
const poJour = m0.po * DONJON.tentativesParJour;
console.log("\n## Économie\n");
console.log(`| Grandeur | Valeur |\n|---|---:|`);
console.log(`| PO créditées par descente (moyenne) | ${f1(m0.po)} |`);
console.log(`| Par jour, ${DONJON.tentativesParJour} descentes | ${f1(poJour)} |`);
console.log(`| En boosters par jour | ${f1(poJour / ECONOMIE.prix)} |`);
console.log(`| Rapporté au gain passif (${ECONOMIE.parHeure * 24} PO/j) | ×${f1(1 + poJour / (ECONOMIE.parHeure * 24))} |`);
const meilleur = Object.entries(parPol).sort((a, b) => b[1].po - a[1].po)[0];
console.log(`| Meilleure politique de sortie | ${meilleur[0]}, ${f1(meilleur[1].po)} PO |`);

/* 10. Expérience */
console.log("\n## Expérience : descentes pour l'irisation (Concentrer, collection de 18)\n");
const xpD = m0.xp;
console.log("| Palier | Niveau | XP | Descentes | Jours à 2 par jour |\n|---|---:|---:|---:|---:|");
for (const [t, n] of Object.entries(PALIER_IRISEE)) {
  const x = xpPourNiveau(n);
  console.log(`| ${t} | ${n} | ${x} | ${f1(x / xpD)} | ${f1(x / xpD / 2)} |`);
}
console.log(`| niveau 100 | 100 | ${xpPourNiveau(100)} | ${f1(xpPourNiveau(100) / xpD)} | ${f1(xpPourNiveau(100) / xpD / 2)} |`);

console.log(`\n## Combats sans issue\n\n${BLOCAGES.length} combats ont dépassé 600 actions sur l'ensemble des cas.`);
for (const b of BLOCAGES.slice(0, 6)) console.log(`- ${b.genre}, étage ${b.etage} — équipe ${b.equipe.join(" ")} — en face ${b.ennemis.join(" ")}`);
