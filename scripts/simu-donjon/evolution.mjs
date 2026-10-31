/**
 * Évolution des équipes et des tactiques du Donjon infini, sur les vraies
 * cartes de La Troupe.
 *
 *   npm run evolution:donjon                     # profil « moyen », 48 individus, 100 générations par phase
 *   npm run evolution:donjon -- --longue         # 96 individus, 300 générations, 60 descentes chacun
 *   npm run evolution:donjon -- --essai          # miniature, pour vérifier que tout tourne
 *   npm run evolution:donjon -- --reprendre scripts/simu-donjon/resultats/evolution-moyen-....etat.json
 *
 * Options : --profil debutant|moyen|fort|max, --niveau, --rangs, --etoiles,
 * --population, --generations, --descentes (par individu et par
 * génération), --finale (descentes de la confrontation), --objectif
 * moyenne|p90|po, --coeurs, --graine.
 *
 * Un individu, c'est quatre vraies cartes alliées (toutes celles du
 * catalogue sont permises), une source de pouvoir, le geste et la technique
 * de chaque carte, et — dans la seconde phase — une tactique (tactique.mjs) :
 * cibles, moment des techniques, chemin sur la carte, rencontres.
 *
 * Deux phases, pour démêler ce que gagne l'équipe de ce que gagne la tactique :
 *
 * 1. **Équipe seule** : la tactique est la stratégie Prudence du jeu ;
 * 2. **Équipe et tactique** évoluent ensemble.
 *
 * Chaque génération joue des donjons neufs (graines jamais rejouées) : une
 * équipe ne peut pas apprendre par cœur un donjon. Les meilleurs (élite)
 * passent à la génération suivante et y rejouent, ce qui affine leur note ;
 * les autres naissent par tournoi, croisement et mutation.
 *
 * À la fin, la **confrontation** rejoue sur des donjons qu'aucune phase n'a
 * vus : l'équipe « naïve » (les quatre cartes de plus haut palier et la
 * source la plus rare), le champion de chaque phase, chacun avec les trois
 * stratégies du jeu et avec la tactique évoluée.
 *
 * Un état est sauvé à chaque génération : --reprendre repart de là.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import { Pool } from "./pool.mjs";
import { ALLIES, LIEUX, PROFILS, STRATEGIES, competencesCarte, etiquette, nomSource, nomStrategie } from "./moteur.mjs";
import { GENES, borner, decrire, tactiqueAleatoire, tactiquePrudence } from "./tactique.mjs";
import { ROLES, hacher, roleCarte, tirage } from "../../src/donjon/regles.js";

/* ── Options ─────────────────────────────────────────────────────────── */

const { values: A0 } = parseArgs({ options: {
  profil: { type: "string", default: "moyen" }, niveau: { type: "string" }, rangs: { type: "string" }, etoiles: { type: "string" },
  population: { type: "string" }, generations: { type: "string" }, descentes: { type: "string" }, finale: { type: "string" },
  objectif: { type: "string", default: "moyenne" }, coeurs: { type: "string" }, graine: { type: "string", default: "0" },
  essai: { type: "boolean" }, longue: { type: "boolean" }, reprendre: { type: "string" },
} });
const DOSSIER = new URL("./resultats/", import.meta.url);
mkdirSync(DOSSIER, { recursive: true });
const repris = A0.reprendre ? JSON.parse(readFileSync(A0.reprendre, "utf8")) : null;
const A = repris ? { ...repris.options, coeurs: A0.coeurs ?? repris.options.coeurs } : A0;
if (!PROFILS[A.profil]) throw new Error(`Profil inconnu : ${A.profil}`);
const profil = { ...PROFILS[A.profil] };
if (A.niveau) profil.niveau = profil.niveauSource = Number(A.niveau);
if (A.rangs) profil.rangs = Number(A.rangs);
if (A.etoiles != null) profil.etoiles = A.etoiles.split(",").filter(Boolean);
const taille = A.essai ? { P: 8, G: 3, N: 4, F: 20 } : A.longue ? { P: 96, G: 300, N: 60, F: 3000 } : { P: 48, G: 100, N: 40, F: 1500 };
const P = Number(A.population) || taille.P, G = Number(A.generations) || taille.G, N = Number(A.descentes) || taille.N, NF = Number(A.finale) || taille.F;
const COEURS = Number(A.coeurs) || Math.max(1, availableParallelism() - 1);
const DECALAGE = Number(A.graine) * 1_000_000_000;
const OPTS = { rencontres: "malin" };
const nomFichier = repris?.nomFichier || `evolution-${A.profil}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;
const r = tirage(hacher(`evolution-${A.graine}-${repris ? Date.now() : 0}`));

/* ── Les individus ───────────────────────────────────────────────────── */

const CLES_ALLIES = Object.keys(ALLIES), CLES_LIEUX = Object.keys(LIEUX);
const choisir = (l) => l[Math.floor(r() * l.length)];
const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const RANG = { legendaire: 4, rare: 3, peucommun: 2, commun: 1 };

function nouvelleFiche(k) {
  const f = {};
  if (r() < 0.3) f.geste = choisir(competencesCarte(ALLIES[k], "geste"));
  if (r() < 0.3) f.tech = choisir(competencesCarte(ALLIES[k], "tech"));
  return f;
}
const muterTactique = (t, p = 0.12, s = 0.15) => t.map((v, i) => (r() < p ? borner(i, v + gauss() * s * (GENES[i].max - GENES[i].min)) : v));
function aleatoire(avecTactique) {
  const cartes = [];
  while (cartes.length < 4) { const k = choisir(CLES_ALLIES); if (!cartes.includes(k)) cartes.push(k); }
  return { cartes, source: r() < 0.95 ? choisir(CLES_LIEUX) : null, fiches: Object.fromEntries(cartes.map((k) => [k, nouvelleFiche(k)])),
    tactique: avecTactique ? (r() < 0.4 ? muterTactique(tactiquePrudence(), 0.3) : tactiqueAleatoire(r)) : null, g: [], po: [] };
}
/** L'équipe « naïve » : les quatre cartes de plus haut palier, la source la plus rare, compétences d'origine. */
const parPalier = (l, P0) => [...l].sort((a, b) => RANG[P0[b].tier] - RANG[P0[a].tier] || a.localeCompare(b));
const NAIVE = { cartes: parPalier(CLES_ALLIES, ALLIES).slice(0, 4), source: parPalier(CLES_LIEUX, LIEUX)[0], fiches: {}, tactique: null, g: [], po: [] };

const clone = (x) => ({ cartes: [...x.cartes], source: x.source, fiches: Object.fromEntries(Object.entries(x.fiches).map(([k, v]) => [k, { ...v }])),
  tactique: x.tactique ? [...x.tactique] : null, g: [], po: [] });
function muter(x0) {
  const x = clone(x0);
  if (r() < 0.35) {
    const i = Math.floor(r() * 4);
    let k; do k = choisir(CLES_ALLIES); while (x.cartes.includes(k));
    delete x.fiches[x.cartes[i]]; x.cartes[i] = k; x.fiches[k] = nouvelleFiche(k);
  }
  if (r() < 0.15) x.source = r() < 0.97 ? choisir(CLES_LIEUX) : null;
  for (const k of x.cartes) for (const place of ["geste", "tech"]) {
    if (r() < 0.06) x.fiches[k] = { ...x.fiches[k], [place]: choisir(competencesCarte(ALLIES[k], place)) };
  }
  if (x.tactique) x.tactique = muterTactique(x.tactique);
  return x;
}
function croiser(a, b) {
  const union = [...new Set([...a.cartes, ...b.cartes])];
  for (let i = union.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [union[i], union[j]] = [union[j], union[i]]; }
  const cartes = union.slice(0, 4);
  const fiches = Object.fromEntries(cartes.map((k) => [k, { ...((a.fiches[k] && b.fiches[k] ? (r() < 0.5 ? a : b) : a.fiches[k] ? a : b).fiches[k] || {}) }]));
  const tactique = a.tactique && b.tactique ? a.tactique.map((v, i) => (r() < 0.5 ? v : b.tactique[i])) : a.tactique ? [...a.tactique] : null;
  return { cartes, source: r() < 0.5 ? a.source : b.source, fiches, tactique, g: [], po: [] };
}
const cfgDe = (x, strategie = "prudence", tactique = x.tactique) => ({ cartes: x.cartes, source: x.source, strategie,
  fiches: x.cartes.map((k) => x.fiches[k] || {}), tactique: tactique || null });
const cle = (x) => JSON.stringify([[...x.cartes].sort(), x.source, x.cartes.map((k) => x.fiches[k]).sort(), x.tactique?.map((v) => v.toFixed(3))]);

/* ── Mesures ─────────────────────────────────────────────────────────── */

const moy = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0);
const quantile = (l, q) => { const t = [...l].sort((a, b) => a - b); return t[Math.min(t.length - 1, Math.floor(q * t.length))] ?? 0; };
function score(x) {
  if (A.objectif === "po") return moy(x.po);
  if (A.objectif === "p90") return quantile(x.g, 0.9) + moy(x.g) / 100;
  return moy(x.g);
}
const pool = new Pool(COEURS);
let totalDescentes = repris?.totalDescentes || 0;
const t0 = Date.now() - (repris?.duree || 0);
const duree = (ms) => { const s = Math.round(ms / 1000); return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}` : `${Math.floor(s / 3600)} h ${String(Math.floor(s / 60) % 60).padStart(2, "0")}`; };

/** Joue `n` descentes (graines debut … debut + n − 1) pour chaque configuration. */
async function jouer(cfgs, debut, n, etiquetteProgres = null) {
  const out = cfgs.map(() => ({ g: new Array(n), po: new Array(n) }));
  const taches = [];
  cfgs.forEach((cfg, i) => { for (let d = 0; d < n; d += 10) taches.push({ i, d, k: Math.min(10, n - d) }); });
  let fait = 0, dernier = 0;
  const debutT = Date.now();
  await Promise.all(taches.map(({ i, d, k }) => pool.tache({ cfg: cfgs[i], profil, opts: OPTS, debut: debut + d, n: k }).then((m) => {
    for (let j = 0; j < k; j++) { out[i].g[d + j] = m.gardiens[j]; out[i].po[d + j] = m.po[j]; }
    fait += k; totalDescentes += k;
    if (etiquetteProgres && (Date.now() - dernier > 1000 || fait === n * cfgs.length)) {
      dernier = Date.now();
      const reste = ((Date.now() - debutT) / fait) * (n * cfgs.length - fait);
      process.stdout.write(`\r  ${etiquetteProgres} : ${Math.floor((100 * fait) / (n * cfgs.length))} %, reste ~${duree(reste)}      `);
    }
  })));
  if (etiquetteProgres) process.stdout.write("\n");
  return out;
}

/* ── L'évolution ─────────────────────────────────────────────────────── */

const etat = repris || { options: A, nomFichier, phases: {} };
const sauver = () => {
  etat.totalDescentes = totalDescentes; etat.duree = Date.now() - t0;
  writeFileSync(new URL(`${nomFichier}.etat.json`, DOSSIER), JSON.stringify(etat));
};
const f1 = (x) => x.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const court = (x) => x.cartes.map((k) => ALLIES[k].nom).join(", ") + ` + ${x.source ? LIEUX[x.source].nom : "aucune source"}`;
const tournoi = (pop) => { let b = null; for (let i = 0; i < 3; i++) { const x = choisir(pop); if (!b || score(x) > score(b)) b = x; } return b; };

async function evoluer(id, nom, avecTactique, rangPhase) {
  const ph = (etat.phases[id] ||= { gen: 0, pop: null, courbe: [], temple: [] });
  if (!ph.pop) {
    ph.pop = Array.from({ length: P }, () => aleatoire(avecTactique));
    ph.pop[0] = { ...clone(NAIVE), tactique: avecTactique ? tactiquePrudence() : null };
  }
  console.log(`\n${nom} : ${P} individus, ${G} générations, ${N} descentes par individu et par génération.`);
  const E = Math.max(2, Math.round(P * 0.15));
  const tGen = [];
  for (; ph.gen < G; ph.gen++) {
    const t = Date.now();
    // Des donjons neufs à chaque génération, jamais ceux de la confrontation.
    const debut = DECALAGE + rangPhase * 100_000_000 + ph.gen * 100_000 + 1;
    const res = await jouer(ph.pop.map((x) => cfgDe(x)), debut, N);
    ph.pop.forEach((x, i) => { x.g.push(...res[i].g); x.po.push(...res[i].po); });
    ph.pop.sort((a, b) => score(b) - score(a));
    const genMoy = moy(res.flatMap((x) => x.g));
    // Le temple : les meilleurs qui ont joué au moins deux générations (une seule, c'est encore de la chance).
    for (const x of ph.pop.filter((y) => y.g.length >= 2 * N)) {
      const k = cle(x), j = ph.temple.findIndex((y) => cle(y) === k);
      if (j >= 0) ph.temple[j] = x; else ph.temple.push(x);
    }
    ph.temple = ph.temple.sort((a, b) => score(b) - score(a)).slice(0, 10);
    const chef = ph.temple[0] || ph.pop[0];
    ph.courbe.push({ gen: ph.gen + 1, meilleur: score(chef), n: chef.g.length, moyenne: genMoy, equipe: court(chef) });
    tGen.push(Date.now() - t);
    const reste = moy(tGen.slice(-5)) * (G - ph.gen - 1);
    console.log(`  Gén. ${String(ph.gen + 1).padStart(3)}/${G} · meilleur ${f1(score(chef))} (${chef.g.length} descentes) · moyenne ${f1(genMoy)} · ${court(chef)} · reste ~${duree(reste)}`);
    // La génération suivante : l'élite, puis des enfants.
    const suivante = ph.pop.slice(0, E);
    while (suivante.length < P) suivante.push(muter(r() < 0.7 ? croiser(tournoi(ph.pop), tournoi(ph.pop)) : tournoi(ph.pop)));
    ph.pop = suivante;
    sauver();
  }
  return (etat.phases[id].temple[0]) || ph.pop[0];
}

const t1 = Date.now();
console.log(`Évolution sur les vraies cartes de La Troupe (${CLES_ALLIES.length} alliés, ${CLES_LIEUX.length} lieux), profil ${profil.nom} : niveau ${profil.niveau}, rangs ${profil.rangs}, étoiles [${profil.etoiles.join(", ")}]. ${COEURS} cœur${COEURS > 1 ? "s" : ""}.`);
const champA = await evoluer("equipe", "Phase 1, équipe seule (tactique Prudence)", false, 1);
const champB = await evoluer("tactique", "Phase 2, équipe et tactique", true, 2);

/* ── La confrontation ────────────────────────────────────────────────── */

console.log(`\nConfrontation sur ${NF} donjons inédits.`);
const EQUIPES = [["Équipe naïve", NAIVE], ["Champion phase 1", champA], ["Champion phase 2", champB]];
const TACTIQUES = [...STRATEGIES.map((s) => [nomStrategie(s), s, null]), ["Tactique évoluée", "prudence", champB.tactique]];
const cases = EQUIPES.flatMap(([ne, x]) => TACTIQUES.map(([nt, s, t]) => ({ ne, nt, cfg: cfgDe(x, s, t) })));
const resF = await jouer(cases.map((c) => c.cfg), DECALAGE + 900_000_000 + 1, NF, "Confrontation");
pool.fermer();
const st = (g, po) => { const m = moy(g), sd = Math.sqrt(moy(g.map((x) => (x - m) ** 2))); return { moyenne: m, ic: (1.96 * sd) / Math.sqrt(g.length), mediane: quantile(g, 0.5), p90: quantile(g, 0.9), record: Math.max(...g), po: moy(po) }; };
cases.forEach((c, i) => Object.assign(c, st(resF[i].g, resF[i].po), { g: resF[i].g }));
const appaire = (a, b) => { const d = a.g.map((x, i) => b.g[i] - x); const m = moy(d); return { m, se: Math.sqrt(moy(d.map((x) => (x - m) ** 2)) / d.length) }; };

/* ── Le rapport ──────────────────────────────────────────────────────── */

const L = [];
const d0 = new Date();
const jj = `${String(d0.getDate()).padStart(2, "0")}/${String(d0.getMonth() + 1).padStart(2, "0")}/${d0.getFullYear()}`;
const signe = (x) => `${x >= 0 ? "+" : ""}${f1(x)}`;
L.push(`# Évolution du Donjon infini, profil ${profil.nom}`, "");
L.push(`${jj}. Vraies cartes de La Troupe (${CLES_ALLIES.length} alliés, ${CLES_LIEUX.length} lieux), toutes au niveau ${profil.niveau}, rangs ${profil.rangs}, lignes étoilées : ${profil.etoiles.length ? profil.etoiles.join(", ") : "aucune"}. ${P} individus, ${G} générations par phase, ${N} descentes par individu et par génération ; objectif « ${A.objectif} ».`);
L.push(`${totalDescentes.toLocaleString("fr-FR")} descentes en ${duree(Date.now() - t0)} sur ${COEURS} cœur${COEURS > 1 ? "s" : ""}. Score : gardiens battus avant la chute.`, "");
L.push(`## La confrontation`, "", `Sur ${NF.toLocaleString("fr-FR")} donjons qu'aucune phase n'a vus. Gardiens en moyenne ± IC 95 % ; entre parenthèses, 9 descentes sur 10 sous ce nombre.`, "");
L.push(`| Équipe | ${TACTIQUES.map(([n]) => n).join(" | ")} |`, `|---|${TACTIQUES.map(() => "---:").join("|")}|`);
for (const [ne] of EQUIPES) {
  const l = cases.filter((c) => c.ne === ne);
  const best = Math.max(...l.map((c) => c.moyenne));
  L.push(`| ${ne} | ${l.map((c) => `${c.moyenne === best ? "**" : ""}${f1(c.moyenne)} ± ${f1(c.ic)}${c.moyenne === best ? "**" : ""} (${c.p90})`).join(" | ")} |`);
}
L.push("", "Ce que vaut la tactique évoluée face à la meilleure stratégie du jeu, sur la même équipe (écart apparié, mêmes donjons) :", "");
for (const [ne] of EQUIPES) {
  const l = cases.filter((c) => c.ne === ne);
  const jeu = l.filter((c) => c.nt !== "Tactique évoluée").sort((a, b) => b.moyenne - a.moyenne)[0];
  const evo = l.find((c) => c.nt === "Tactique évoluée");
  const d = appaire(jeu, evo);
  L.push(`- **${ne}** : ${signe(d.m)} gardien${Math.abs(d.m) >= 2 ? "s" : ""} (± ${f1(1.96 * d.se)}) contre ${jeu.nt}${Math.abs(d.m) < 2 * d.se ? ", écart non significatif" : ""}.`);
}
L.push("", "## Les équipes", "");
for (const [ne, x] of EQUIPES) {
  L.push(`- **${ne}** : ${etiquette(cfgDe(x))} ; source ${nomSource(x.source)}.`);
}
L.push("", "## La tactique évoluée", "", decrire(champB.tactique), "");
L.push("## La marche de l'évolution", "");
for (const [id, nom] of [["equipe", "Phase 1, équipe seule"], ["tactique", "Phase 2, équipe et tactique"]]) {
  const c = etat.phases[id].courbe;
  const pas = Math.max(1, Math.round(c.length / 12));
  L.push(`### ${nom}`, "", "| Génération | Meilleur (cumul) | Moyenne de la génération | Meilleure équipe |", "|---:|---:|---:|---|");
  c.filter((x, i) => i % pas === 0 || i === c.length - 1).forEach((x) => L.push(`| ${x.gen} | ${f1(x.meilleur)} (${x.n}) | ${f1(x.moyenne)} | ${x.equipe} |`));
  // Ce vers quoi la population a convergé.
  const pop = etat.phases[id].pop;
  const freq = (l) => Object.entries(l.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  const cartes = freq(pop.flatMap((x) => x.cartes)).slice(0, 8).map(([k, n]) => `${ALLIES[k].nom} (${ROLES[roleCarte(ALLIES[k])].nom}) ${Math.round((100 * n) / pop.length)} %`);
  const sources = freq(pop.map((x) => x.source || "aucune")).slice(0, 4).map(([k, n]) => `${k === "aucune" ? "aucune" : LIEUX[k].nom} ${Math.round((100 * n) / pop.length)} %`);
  L.push("", `Population finale : cartes ${cartes.join(", ")} ; sources ${sources.join(", ")}.`, "");
}
L.push("## Limites", "");
L.push("- Toutes les cartes au même niveau et toutes disponibles : c'est le Donjon d'un joueur qui a tout le catalogue, pas d'une collection réelle.");
L.push("- La tactique est une famille de règles (notes de cible, seuils) : l'évolution trouve la meilleure de cette famille, pas la meilleure possible.");
L.push("- Phase 1 et équipe naïve jouent le chemin au hasard et les rencontres avec la règle « malin » ; la tactique évoluée choisit les deux.");
L.push("- Les écarts d'une génération à l'autre sont bruités : seule la confrontation, sur des donjons inédits, tranche.");
writeFileSync(new URL(`${nomFichier}.md`, DOSSIER), L.join("\n") + "\n");
writeFileSync(new URL(`${nomFichier}.json`, DOSSIER), JSON.stringify({ profil, options: A, P, G, N, NF, champions: { naive: NAIVE, phase1: champA, phase2: champB },
  confrontation: cases.map(({ g: _g, ...c }) => c), courbes: { equipe: etat.phases.equipe.courbe, tactique: etat.phases.tactique.courbe } }));
sauver();
console.log(`\nTerminé en ${duree(Date.now() - t1)}. Rapport : scripts/simu-donjon/resultats/${nomFichier}.md`);
if (!existsSync(new URL(`${nomFichier}.md`, DOSSIER))) process.exitCode = 1;
