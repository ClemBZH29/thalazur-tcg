/**
 * Ce qui fait une bonne descente : chaque choix du Donjon infini mesuré
 * seul, sur plusieurs bonnes équipes, en visant un étage (25 par défaut).
 *
 *   npm run choix:donjon                       # 400 descentes par cas, tous les cœurs
 *   npm run choix:donjon -- --descentes 1000   # plus précis
 *   npm run choix:donjon -- --cible 30         # viser l'étage 30
 *   npm run choix:donjon -- --essai            # miniature
 *
 * Options : --profil, --descentes, --cible, --coeurs, --graine, --equipes
 * (liste séparée par des virgules, parmi celles de EQUIPES).
 *
 * La méthode : chaque équipe joue d'abord avec sa tactique (la « base »).
 * Puis on force un seul choix, toujours ou jamais (l'autel, le coffre,
 * l'écho, le colporteur, le blessé, la source, le chemin, les reliques) et
 * on rejoue **les mêmes donjons** : l'écart avec la base, descente par
 * descente, est l'effet propre de ce choix. Les reliques se mesurent en en
 * donnant une à l'équipe dès l'entrée. Enfin, les meilleurs choix de chaque
 * famille sont combinés, et la combinaison est rejouée contre la base.
 *
 * Les équipes et les tactiques de départ sont celles des évolutions du
 * 01/11/2026 (evoluees.json), plus deux variantes : sans Tempête, et
 * l'équipe naïve (les quatre cartes de plus haut palier).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import { Pool } from "./pool.mjs";
import { ALLIES, ARTEFACTS, PROFILS, etiquette, nomSource } from "./moteur.mjs";
import { GENES, tactiquePrudence } from "./tactique.mjs";
import { effetsArtefact, texteEffets } from "../../src/donjon/pouvoirs.js";

const { values: A } = parseArgs({ options: {
  profil: { type: "string", default: "moyen" }, descentes: { type: "string" }, cible: { type: "string", default: "25" },
  coeurs: { type: "string" }, graine: { type: "string", default: "0" }, equipes: { type: "string" }, essai: { type: "boolean" },
} });
const profil = PROFILS[A.profil];
if (!profil) throw new Error(`Profil inconnu : ${A.profil}`);
const N = Number(A.descentes) || (A.essai ? 6 : 400);
const CIBLE = Number(A.cible);
const OK = (g) => g >= CIBLE - 1; // atteindre l'étage n, c'est avoir battu n − 1 gardiens
const COEURS = Number(A.coeurs) || Math.max(1, availableParallelism() - 1);
const DEBUT = Number(A.graine) * 1_000_000_000 + 300_000_001;

/* ── Les équipes de base ─────────────────────────────────────────────── */

const EV = JSON.parse(readFileSync(new URL("./evoluees.json", import.meta.url), "utf8"));
if (EV.genes.join() !== GENES.map((g) => g.id).join()) throw new Error("Les gènes ont changé depuis evoluees.json : relancer une évolution et mettre ce fichier à jour.");
const tac = (id) => EV.tactiques[id].genome;
const cfg = (e, tactique) => ({ cartes: e.cartes, source: e.source, strategie: "prudence", fiches: e.cartes.map((k) => e.fiches[k] || {}), tactique });
const sansTempete = (e) => ({ ...e, fiches: Object.fromEntries(Object.entries(e.fiches).map(([k, f]) => [k, { geste: f.geste }])) });
const RANG = { legendaire: 4, rare: 3, peucommun: 2, commun: 1 };
const naive = { cartes: Object.keys(ALLIES).sort((a, b) => RANG[ALLIES[b].tier] - RANG[ALLIES[a].tier] || a.localeCompare(b)).slice(0, 4),
  source: EV.equipes.pantheon1.source, fiches: {} };
const EQUIPES = {
  dispater: { nom: "Dispater, 4 Tempêtes", cfg: cfg(EV.equipes.dispater, tac("dispater")) },
  pantheon1: { nom: "Panthéon, Meneurs et Dame Estale", cfg: cfg(EV.equipes.pantheon1, tac("pantheon")) },
  pantheon2: { nom: "Panthéon, Sethi et Ondrei", cfg: cfg(EV.equipes.pantheon2, tac("pantheon")) },
  sansTempete: { nom: "Dispater sans Tempête", cfg: cfg(sansTempete(EV.equipes.dispater), tac("dispater")) },
  naive: { nom: "Équipe naïve, Prudence", cfg: cfg(naive, tactiquePrudence()) },
};
const choisies = A.equipes ? A.equipes.split(",") : Object.keys(EQUIPES);
for (const e of choisies) if (!EQUIPES[e]) throw new Error(`Équipe inconnue : ${e} (${Object.keys(EQUIPES).join(", ")})`);

/* ── Les choix à éprouver ────────────────────────────────────────────── */

const ren = (id, v) => ({ rencontres: { [id]: v } });
const FAMILLES = [
  { id: "autel", nom: "Autel (offrir son sang)", options: [["toujours", ren("autel", "oui")], ["jamais", ren("autel", "non")], ["à partir de l'étage 5", ren("autel", { des: 5 })], ["3 fois au plus", ren("autel", { max: 3 })], ["6 fois au plus", ren("autel", { max: 6 })]] },
  { id: "coffre", nom: "Coffre moussu (l'ouvrir)", options: [["toujours", ren("coffre", "oui")], ["jamais", ren("coffre", "non")], ["jusqu'à l'étage 3", ren("coffre", { jusqua: 3 })], ["jusqu'à l'étage 6", ren("coffre", { jusqua: 6 })], ["jusqu'à l'étage 10", ren("coffre", { jusqua: 10 })]] },
  { id: "echo", nom: "Écho (suivre la voix)", options: [["toujours", ren("echo", "oui")], ["jamais", ren("echo", "non")], ["jusqu'à l'étage 3", ren("echo", { jusqua: 3 })], ["jusqu'à l'étage 6", ren("echo", { jusqua: 6 })], ["jusqu'à l'étage 10", ren("echo", { jusqua: 10 })]] },
  { id: "mirko", nom: "Colporteur (acheter les onguents)", options: [["toujours", ren("mirko", "oui")], ["jamais", ren("mirko", "non")]] },
  { id: "blesse", nom: "Voyageur blessé (cinquième membre)", options: [["l'emmener", ren("blesse", "oui")], ["lui laisser des vivres", ren("blesse", "non")]] },
  { id: "source", nom: "Source claire", options: [["boire", ren("source", "oui")], ["fouiller le bassin", ren("source", "non")]] },
  { id: "chemin", nom: "Chemin", options: [["au hasard", { chemin: "hasard" }], ["élites d'abord", { chemin: "elite" }], ["éviter les élites", { chemin: "sansElite" }],
    ["repos d'abord", { chemin: "repos" }], ["rencontres d'abord", { chemin: "evenement" }], ["trésors d'abord", { chemin: "tresor" }], ["combats d'abord", { chemin: "combat" }]] },
  { id: "reliques", nom: "Reliques", options: [["aucune dans le donjon", { sansReliques: true }]] },
];
const RELIQUES = Object.keys(ARTEFACTS);

/* ── Les mesures ─────────────────────────────────────────────────────── */

const pool = new Pool(COEURS);
let total = 0, fait = 0, dernier = 0;
const t0 = Date.now();
const duree = (ms) => { const s = Math.round(ms / 1000); return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}` : `${Math.floor(s / 3600)} h ${String(Math.floor(s / 60) % 60).padStart(2, "0")}`; };
function progres() {
  const t = Date.now();
  if (t - dernier < 1000 && fait < total) return;
  dernier = t;
  process.stdout.write(`\r  ${Math.floor((100 * fait) / total)} % (${fait.toLocaleString("fr-FR")} / ${total.toLocaleString("fr-FR")} descentes), reste ~${duree(((t - t0) / fait) * (total - fait))}      `);
}
/** Joue une configuration sur les graines DEBUT … DEBUT + n − 1. */
async function jouer(c, n, journal = false) {
  const g = new Array(n), journaux = [];
  total += n;
  const parts = [];
  for (let d = 0; d < n; d += 10) {
    const k = Math.min(10, n - d);
    parts.push(pool.tache({ cfg: c, profil, opts: { journal }, debut: DEBUT + d, n: k }).then((m) => {
      for (let i = 0; i < k; i++) g[d + i] = m.gardiens[i];
      if (journal) journaux[d / 10] = m.journaux;
      fait += k; progres();
    }));
  }
  await Promise.all(parts);
  return { g, journaux: journaux.flat() };
}
const moy = (l) => l.reduce((s, x) => s + x, 0) / (l.length || 1);
const taux = (g) => moy(g.map((x) => (OK(x) ? 1 : 0)));
/** Écart apparié de b sur a (mêmes graines) : moyenne, IC 95 %, significatif. */
function ecart(a, b, f = (x) => x) {
  const n = Math.min(a.length, b.length);
  const d = Array.from({ length: n }, (_, i) => f(b[i]) - f(a[i]));
  const m = moy(d), se = Math.sqrt(moy(d.map((x) => (x - m) ** 2)) / n);
  return { m, ic: 1.96 * se, sig: Math.abs(m) > 1.96 * se };
}

console.log(`\nCe qui fait une bonne descente : ${choisies.length} équipes, profil ${profil.nom}, ${N} descentes par cas, cible l'étage ${CIBLE}, ${COEURS} cœur${COEURS > 1 ? "s" : ""}.`);
const resultats = {};
await Promise.all(choisies.map(async (id) => {
  const E = EQUIPES[id];
  const base = await jouer(E.cfg, N, true);
  const familles = await Promise.all(FAMILLES.map(async (F) => ({ ...F, mesures: await Promise.all(F.options.map(async ([nom, regles]) => ({ nom, regles, g: (await jouer({ ...E.cfg, regles }, N)).g }))) })));
  const reliques = await Promise.all(RELIQUES.map(async (k) => ({ k, g: (await jouer({ ...E.cfg, regles: { reliqueDepart: k } }, N)).g })));
  resultats[id] = { base, familles, reliques };
}));
process.stdout.write("\n");

// La meilleure combinaison : dans chaque famille, l'option qui bat nettement la base, s'il y en a une.
console.log("Combinaison des meilleurs choix, sur deux fois plus de descentes.");
total = 0; fait = 0;
await Promise.all(choisies.map(async (id) => {
  const R0 = resultats[id];
  const regles = { rencontres: {} }, retenus = [];
  for (const F of R0.familles) {
    if (F.id === "reliques") continue;
    const best = F.mesures.map((m) => ({ m, e: ecart(R0.base.g, m.g) })).filter((x) => x.e.sig && x.e.m > 0).sort((a, b) => b.e.m - a.e.m)[0];
    if (!best) continue;
    retenus.push(`${F.nom} : ${best.m.nom}`);
    if (best.m.regles.rencontres) Object.assign(regles.rencontres, best.m.regles.rencontres);
    else Object.assign(regles, best.m.regles);
  }
  const [b2, c2] = await Promise.all([jouer(EQUIPES[id].cfg, 2 * N), jouer({ ...EQUIPES[id].cfg, regles }, 2 * N)]);
  R0.combinaison = { retenus, base: b2.g, g: c2.g };
}));
process.stdout.write("\n");
pool.fermer();

/* ── Le rapport ──────────────────────────────────────────────────────── */

const f1 = (x) => x.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pc = (x) => `${Math.round(x * 100)} %`;
const signe = (x, f = f1) => `${x >= 0 ? "+" : "−"}${f(Math.abs(x))}`;
const cellule = (e, f = f1) => (e.sig ? `**${signe(e.m, f)}**` : `${signe(e.m, f)}`);
const pts = (x) => `${Math.round(x * 100)} pts`;
const L = [];
const d0 = new Date();
L.push(`# Ce qui fait une bonne descente (donjon infini)`, "");
L.push(`${String(d0.getDate()).padStart(2, "0")}/${String(d0.getMonth() + 1).padStart(2, "0")}/${d0.getFullYear()}. Profil ${profil.nom} (niveau ${profil.niveau}, rangs ${profil.rangs}, étoiles : ${profil.etoiles.length ? profil.etoiles.join(", ") : "aucune"}). ${N} descentes par cas, sur les mêmes donjons pour tous les cas d'une équipe ; ${fait ? "" : ""}durée ${duree(Date.now() - t0)} sur ${COEURS} cœur${COEURS > 1 ? "s" : ""}. Cible : l'étage ${CIBLE} (${CIBLE - 1} gardiens battus).`, "");
L.push("Un écart en **gras** est significatif (il dépasse son intervalle de confiance à 95 %, écart apparié) ; les autres peuvent être du bruit.", "");
L.push("## Les équipes", "", `| Équipe | Composition | Source | Gardiens (base) | Atteint l'étage ${CIBLE} | Meilleure combinaison | Atteint l'étage ${CIBLE} |`, "|---|---|---|---:|---:|---:|---:|");
for (const id of choisies) {
  const R0 = resultats[id], C = R0.combinaison;
  L.push(`| ${EQUIPES[id].nom} | ${etiquette(EQUIPES[id].cfg)} | ${nomSource(EQUIPES[id].cfg.source)} | ${f1(moy(R0.base.g))} | ${pc(taux(R0.base.g))} | ${f1(moy(C.g))} (${signe(moy(C.g) - moy(C.base))}) | ${pc(taux(C.g))} (${signe(taux(C.g) - taux(C.base), pts)}) |`);
}
L.push("", "## Ce que vaut chaque choix", "", `Écart de gardiens battus avec la base (la tactique de l'équipe), puis, en dessous, l'écart de chances d'atteindre l'étage ${CIBLE}.`, "");
L.push(`| Choix | ${choisies.map((id) => EQUIPES[id].nom).join(" | ")} |`, `|---|${choisies.map(() => "---:").join("|")}|`);
for (const [fi, F] of FAMILLES.entries()) {
  F.options.forEach(([nom], oi) => {
    const cells = choisies.map((id) => {
      const m = resultats[id].familles[fi].mesures[oi];
      return `${cellule(ecart(resultats[id].base.g, m.g))}<br>${cellule(ecart(resultats[id].base.g, m.g, (x) => (OK(x) ? 1 : 0)), pts)}`;
    });
    L.push(`| ${F.nom} : ${nom} | ${cells.join(" | ")} |`);
  });
}
L.push("", "## La valeur de chaque relique", "", "La relique est donnée à l'équipe dès l'entrée, en plus de ce qu'elle trouvera : écart de gardiens avec la base. L'équipe porte huit reliques au plus (`RELIQUES_MAX`) : une bonne équipe atteint ce plafond, et une relique de départ y prend alors la place d'une trouvée en route.", "");
L.push(`| Relique | Effet | ${choisies.map((id) => EQUIPES[id].nom).join(" | ")} | Moyenne |`, `|---|---|${choisies.map(() => "---:").join("|")}|---:|`);
const lignesRel = RELIQUES.map((k, ri) => {
  const es = choisies.map((id) => ecart(resultats[id].base.g, resultats[id].reliques[ri].g));
  return { k, es, m: moy(es.map((e) => e.m)) };
}).sort((a, b) => b.m - a.m);
for (const x of lignesRel) {
  const a = ARTEFACTS[x.k];
  L.push(`| ${a.nom} (${{ commun: "C", peucommun: "PC", rare: "R", legendaire: "L" }[a.tier]}) | ${texteEffets(effetsArtefact(a))} | ${x.es.map((e) => cellule(e)).join(" | ")} | ${signe(x.m)} |`);
}
L.push("", "## L'anatomie des descentes", "", "Sur les descentes de base. Une descente qui va loin traverse plus de salles : ces chiffres disent ce qui accompagne le succès, pas ce qui le cause (c'est le rôle des tableaux du dessus).", "");
for (const id of choisies) {
  const R0 = resultats[id], J = R0.base.journaux, g = R0.base.g;
  L.push(`### ${EQUIPES[id].nom}`, "");
  const tranches = [[1, 5], [6, 10], [11, 15], [16, 20], [21, 25], [26, 30], [31, Infinity]];
  const ch = tranches.map(([a, b]) => [a, b, J.filter((j) => j.chute.etage >= a && j.chute.etage <= b).length]).filter((x) => x[2]);
  L.push(`- **Où elle tombe** : ${ch.map(([a, b, n]) => `étages ${a}${b === Infinity ? " et plus" : `-${b}`} ${pc(n / J.length)}`).join(", ")}.`);
  const genres = {};
  for (const j of J) genres[j.chute.genre] = (genres[j.chute.genre] || 0) + 1;
  const NOMS = { combat: "en combat", elite: "contre une élite", boss: "contre le gardien", evenement: "dans une rencontre" };
  L.push(`- **Contre quoi** : ${Object.entries(genres).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${NOMS[k] || k} ${pc(n / J.length)}`).join(", ")}.`);
  const ok = J.filter((_, i) => OK(g[i])), ko = J.filter((_, i) => !OK(g[i]));
  const par = (l, f) => (l.length ? f1(moy(l.map(f))) : "–");
  L.push(`- **Ce que portent celles qui atteignent l'étage ${CIBLE}** (${ok.length}) **et les autres** (${ko.length}) : reliques ${par(ok, (j) => j.reliques.length)} contre ${par(ko, (j) => j.reliques.length)} ; bénédictions de l'autel ${par(ok, (j) => j.autels)} contre ${par(ko, (j) => j.autels)} ; cinquième membre ${ok.length ? pc(moy(ok.map((j) => (j.recrue ? 1 : 0)))) : "–"} contre ${pc(moy(ko.map((j) => (j.recrue ? 1 : 0))))} ; pièges subis ${par(ok, (j) => j.pieges.coffre + j.pieges.echo)} contre ${par(ko, (j) => j.pieges.coffre + j.pieges.echo)}.`);
  const parEtage = (f) => f1(moy(J.map((j) => f(j) / Math.max(1, j.chute.etage))));
  L.push(`- **Par étage traversé** : ${parEtage((j) => j.salles.elite || 0)} élite, ${parEtage((j) => j.salles.repos || 0)} repos, ${parEtage((j) => j.salles.evenement || 0)} rencontre, ${parEtage((j) => j.salles.tresor || 0)} trésor ; ${parEtage((j) => j.reliques.length)} relique ramassée.`);
  L.push(`- **Meilleure combinaison** : ${R0.combinaison.retenus.length ? R0.combinaison.retenus.join(" ; ") : "aucun choix ne bat nettement la tactique"}.`, "");
}
L.push("## Limites", "");
L.push("- Un choix est forcé seul, le reste suit la tactique de l'équipe : son effet dépend de cette tactique (les deux tactiques évoluées prennent déjà l'autel, par exemple, d'où un « toujours » proche de zéro).");
L.push("- Les cartes sont toutes au niveau du profil, sans rangs ni étoiles sauf profil contraire.");
L.push("- La combinaison retient le meilleur choix de chaque famille mesuré seul ; deux choix peuvent se gêner, d'où sa propre mesure.");
const dossier = new URL("./resultats/", import.meta.url);
mkdirSync(dossier, { recursive: true });
const nom = `choix-${A.profil}-${d0.toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;
writeFileSync(new URL(`${nom}.md`, dossier), L.join("\n") + "\n");
writeFileSync(new URL(`${nom}.json`, dossier), JSON.stringify(Object.fromEntries(choisies.map((id) => [id, {
  base: { moyenne: moy(resultats[id].base.g), cible: taux(resultats[id].base.g) },
  familles: resultats[id].familles.map((F) => ({ id: F.id, options: F.mesures.map((m) => ({ nom: m.nom, moyenne: moy(m.g), cible: taux(m.g), ecart: ecart(resultats[id].base.g, m.g) })) })),
  reliques: resultats[id].reliques.map((x) => ({ relique: x.k, moyenne: moy(x.g), ecart: ecart(resultats[id].base.g, x.g) })),
  combinaison: { retenus: resultats[id].combinaison.retenus, moyenne: moy(resultats[id].combinaison.g), base: moy(resultats[id].combinaison.base) },
}]))));
console.log(`\nTerminé en ${duree(Date.now() - t0)}. Rapport : scripts/simu-donjon/resultats/${nom}.md`);
