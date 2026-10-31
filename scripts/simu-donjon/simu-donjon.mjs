/**
 * Simulations poussées du Donjon infini : quelle équipe, quelle source de
 * pouvoir, quelle stratégie et quelles compétences vont le plus loin ?
 *
 *   npm run simu:donjon                          # profil « moyen », tous les cœurs
 *   npm run simu:donjon -- --profil fort         # débutant, moyen, fort, max
 *   npm run simu:donjon -- --rapide              # environ deux fois et demie plus court, moins précis
 *   npm run simu:donjon -- --complet             # deux fois plus long, plus précis
 *   npm run simu:donjon -- --essai               # une miniature d'une minute, pour vérifier que tout tourne
 *   npm run simu:donjon -- --objectif p90        # viser le record (classement) plutôt que la moyenne
 *   npm run simu:donjon -- --palier rare --niveau 30 --rangs 1 --etoiles ini,tech --source-etoilee
 *
 * Autres options : --objectif moyenne|p90|po, --rencontres malin|premier,
 * --finalistes 5, --coeurs 6, --graine 0 (décale toutes les graines, pour
 * vérifier qu'un résultat tient sur d'autres tirages).
 *
 * La méthode (le pourquoi est dans docs/conception/donjon.md, « Simulations ») :
 *
 * 1. **Criblage** : les 495 compositions de quatre rôles × les sources de
 *    pouvoir (et « aucune »), en stratégie Prudence. Tout le monde joue
 *    quelques descentes, les meilleures en rejouent davantage, et ainsi de
 *    suite (élimination successive) : le temps va aux équipes qui comptent.
 * 2. **Sources** : pour chaque lieu, ses cinq meilleures compositions
 *    rejouées à égalité, pour un classement des sources à armes égales.
 * 3. **Affinage** des finalistes : la stratégie, puis chaque geste et chaque
 *    technique carte par carte, puis la source pour l'équipe affinée. Un
 *    changement n'est retenu que si son gain dépasse deux erreurs types de
 *    l'écart apparié (mêmes graines des deux côtés).
 * 4. **Finale** : chaque finaliste, avant et après affinage, sur un grand
 *    nombre de descentes.
 *
 * Résultat : un rapport Markdown et les chiffres bruts en JSON, dans
 * scripts/simu-donjon/resultats/ (hors dépôt).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import { parseArgs } from "node:util";
import { LIEUX, PROFILS, ROLES, STRATEGIES, competencesPermises, etiquette, nomSource, nomStrategie } from "./moteur.mjs";
import { COMPETENCES, ROLES as ROLES_JEU } from "../../src/donjon/regles.js";
import { effetsSource, texteEffets } from "../../src/donjon/pouvoirs.js";

/* ── Options ─────────────────────────────────────────────────────────── */

const { values: A } = parseArgs({ options: {
  profil: { type: "string", default: "moyen" }, palier: { type: "string" }, niveau: { type: "string" },
  rangs: { type: "string" }, etoiles: { type: "string" }, "source-etoilee": { type: "boolean" },
  objectif: { type: "string", default: "moyenne" }, rencontres: { type: "string", default: "malin" },
  finalistes: { type: "string", default: "5" }, coeurs: { type: "string" }, graine: { type: "string", default: "0" },
  rapide: { type: "boolean" }, essai: { type: "boolean" }, complet: { type: "boolean" }, aide: { type: "boolean" },
} });
if (A.aide) { console.log("Voir l'en-tête de scripts/simu-donjon/simu-donjon.mjs."); process.exit(0); }
if (!PROFILS[A.profil]) throw new Error(`Profil inconnu : ${A.profil} (${Object.keys(PROFILS).join(", ")})`);
const profil = { ...PROFILS[A.profil] };
if (A.palier) profil.palier = A.palier;
if (A.niveau) profil.niveau = profil.niveauSource = Number(A.niveau);
if (A.rangs) profil.rangs = Number(A.rangs);
if (A.etoiles != null) profil.etoiles = A.etoiles.split(",").filter(Boolean);
if (A["source-etoilee"]) profil.etoileSource = true;
if (A.palier || A.niveau || A.rangs || A.etoiles != null || A["source-etoilee"]) profil.nom = `${profil.nom} (ajusté)`;
if (!["commun", "peucommun", "rare", "legendaire"].includes(profil.palier)) throw new Error(`Palier inconnu : ${profil.palier}`);
if (!["moyenne", "p90", "po"].includes(A.objectif)) throw new Error("--objectif : moyenne, p90 ou po");
const opts = { rencontres: A.rencontres };
// --essai : une miniature (quelques équipes, quelques descentes) pour vérifier que tout tourne.
const facteur = A.essai ? 0.03 : A.rapide ? 0.4 : A.complet ? 2 : 1;
const signe = (x) => `${x >= 0 ? "+" : ""}${x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nb = (n) => Math.max(4, Math.round(n * facteur));
const DECALAGE = Number(A.graine) * 1_000_000;
const COEURS = Number(A.coeurs) || Math.max(1, availableParallelism() - 1);
const NB_FINALISTES = A.essai ? 2 : Number(A.finalistes);

/* ── Les workers ─────────────────────────────────────────────────────── */

class Pool {
  constructor(k) {
    this.libres = []; this.file = []; this.attente = new Map(); this.id = 0;
    this.w = Array.from({ length: k }, () => {
      const w = new Worker(new URL("./travailleur.mjs", import.meta.url));
      w.on("message", (m) => { this.attente.get(m.id)(m); this.attente.delete(m.id); this.libres.push(w); this.pomper(); });
      w.on("error", (e) => { console.error(e); process.exit(1); });
      this.libres.push(w);
      return w;
    });
  }
  tache(msg) { return new Promise((res) => { this.file.push({ msg, res }); this.pomper(); }); }
  pomper() {
    while (this.libres.length && this.file.length) {
      const w = this.libres.pop(), { msg, res } = this.file.shift();
      msg.id = ++this.id; this.attente.set(msg.id, res); w.postMessage(msg);
    }
  }
  fermer() { for (const w of this.w) w.terminate(); }
}
const pool = new Pool(COEURS);

/* ── Les mesures ─────────────────────────────────────────────────────── */

const TOUTES = new Map(); // clé → { cfg, g, po, blocages }
const cleCfg = (c) => JSON.stringify([c.roles, c.source, c.strategie, c.fiches || []]);
function entree(cfg) {
  const k = cleCfg(cfg);
  if (!TOUTES.has(k)) TOUTES.set(k, { cfg, g: [], po: [], blocages: 0 });
  return TOUTES.get(k);
}
let totalDescentes = 0;
const t0 = Date.now();
const duree = (ms) => { const s = Math.round(ms / 1000); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}`; };

/** Porte chaque équipe à `n` descentes (graines 1 à n), en ne jouant que celles qui manquent. */
async function mesurer(etape, cfgs, n) {
  const es = cfgs.map(entree);
  const taches = [];
  for (const e of es) {
    for (let d = e.g.length; d < n; d += 25) {
      const k = Math.min(25, n - d);
      taches.push({ e, d, k });
    }
  }
  const total = taches.reduce((s, t) => s + t.k, 0);
  let fait = 0, dernier = 0;
  const debut = Date.now();
  await Promise.all(taches.map(({ e, d, k }) => pool.tache({ cfg: e.cfg, profil, opts, debut: DECALAGE + d + 1, n: k }).then((m) => {
    for (let j = 0; j < k; j++) { e.g[d + j] = m.gardiens[j]; e.po[d + j] = m.po[j]; }
    e.blocages += m.blocages;
    fait += k; totalDescentes += k;
    const t = Date.now();
    if (t - dernier > 1000 || fait === total) {
      dernier = t;
      const reste = fait ? ((t - debut) / fait) * (total - fait) : 0;
      process.stdout.write(`\r  ${etape} : ${Math.floor((100 * fait) / total)} % (${fait.toLocaleString("fr-FR")} / ${total.toLocaleString("fr-FR")} descentes), reste ~${duree(reste)}      `);
    }
  })));
  if (total) process.stdout.write("\n");
  return es;
}

const moy = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0);
const quantile = (l, q) => { const t = [...l].sort((a, b) => a - b); return t[Math.min(t.length - 1, Math.floor(q * t.length))] ?? 0; };
function stats(e) {
  const n = e.g.length, m = moy(e.g);
  const sd = Math.sqrt(moy(e.g.map((x) => (x - m) ** 2)));
  return { n, moyenne: m, ic: (1.96 * sd) / Math.sqrt(n || 1), mediane: quantile(e.g, 0.5), p90: quantile(e.g, 0.9),
    record: Math.max(0, ...e.g), po: moy(e.po), blocages: e.blocages };
}
const score = (e) => { const s = stats(e); return A.objectif === "p90" ? s.p90 + s.moyenne / 100 : A.objectif === "po" ? s.po : s.moyenne; };
/** Écart apparié (mêmes graines) de b sur a, sur les graines que les deux ont jouées : moyenne et erreur type. */
function ecart(a, b) {
  const n = Math.min(a.g.length, b.g.length);
  const ga = A.objectif === "po" ? a.po : a.g, gb = A.objectif === "po" ? b.po : b.g;
  const d = Array.from({ length: n }, (_, i) => gb[i] - ga[i]);
  const m = moy(d);
  return { m, se: Math.sqrt(moy(d.map((x) => (x - m) ** 2)) / (n || 1)) };
}
const trier = (es) => [...es].sort((a, b) => score(b) - score(a));

/* ── 1. Criblage ─────────────────────────────────────────────────────── */

const COMPOS = [];
for (let a = 0; a < 9; a++) for (let b = a; b < 9; b++) for (let c = b; c < 9; c++) for (let d = c; d < 9; d++) COMPOS.push([ROLES[a], ROLES[b], ROLES[c], ROLES[d]]);
let SOURCES = [null, ...Object.keys(LIEUX)];
if (A.essai) { COMPOS.splice(0, COMPOS.length, ...COMPOS.filter((_, i) => i % 40 === 0)); SOURCES = SOURCES.slice(0, 4); }
console.log(`\nSimulation du Donjon infini, profil ${profil.nom} : ${profil.palier}, niveau ${profil.niveau}, rangs ${profil.rangs}, étoiles [${profil.etoiles.join(", ")}], source ${profil.etoileSource ? "étoilée" : "non étoilée"}.`);
console.log(`${COMPOS.length} compositions × ${SOURCES.length} sources = ${(COMPOS.length * SOURCES.length).toLocaleString("fr-FR")} équipes, objectif « ${A.objectif} », ${COEURS} cœur${COEURS > 1 ? "s" : ""}.\n`);

const base = COMPOS.flatMap((roles) => SOURCES.map((source) => ({ roles, source, strategie: "prudence" })));
const TOURS = [{ n: nb(8), garder: 2000 }, { n: nb(40), garder: 400 }, { n: nb(150), garder: 60 }, { n: nb(500), garder: 60 }];
let en = base;
let es = [];
for (const [i, T] of TOURS.entries()) {
  es = trier(await mesurer(`1. Criblage, tour ${i + 1}/${TOURS.length}`, en, T.n));
  en = es.slice(0, T.garder).map((e) => e.cfg);
}
const criblage = es.slice(0, 60);
const premierTour = base.map((c) => TOUTES.get(cleCfg(c)));

/* ── 2. Les sources à armes égales ───────────────────────────────────── */

const parSource = SOURCES.map((s) => {
  const l = premierTour.filter((e) => e.cfg.source === s);
  return { source: s, moyenneToutes: moy(l.flatMap((e) => e.g)), top: trier(l).slice(0, 5).map((e) => e.cfg) };
});
await mesurer("2. Sources, cinq meilleures compositions de chacune", parSource.flatMap((x) => x.top), nb(150));
for (const x of parSource) { x.meilleure = trier(x.top.map((c) => TOUTES.get(cleCfg(c))))[0]; }
parSource.sort((a, b) => score(b.meilleure) - score(a.meilleure));

/* ── 3. Affinage des finalistes ──────────────────────────────────────── */

// Des compositions différentes : cinq fois la même équipe avec cinq sources n'apprend rien.
const finalistes = [];
for (const e of criblage) {
  if (finalistes.length >= NB_FINALISTES) break;
  if (!finalistes.some((f) => f.cfg.roles.join() === e.cfg.roles.join())) finalistes.push(e);
}
const N_AFF = nb(300);
/** Mesure des variantes et garde la meilleure si elle bat la courante nettement. */
async function departager(etape, courant, variantes) {
  const l = await mesurer(etape, [courant, ...variantes], N_AFF);
  const ref = l[0];
  let best = ref, gain = { m: 0, se: 0 };
  for (const e of l.slice(1)) {
    const d = ecart(ref, e);
    if (d.m > 2 * d.se && d.m > gain.m) { best = e; gain = d; }
  }
  return { cfg: best.cfg, gain, change: best !== ref };
}
const affinages = [];
for (const [i, f] of finalistes.entries()) {
  const nom = `3. Affinage ${i + 1}/${finalistes.length}`;
  let cfg = { ...f.cfg, fiches: [{}, {}, {}, {}] };
  const journal = [];
  const r1 = await departager(`${nom}, stratégie`, cfg, STRATEGIES.filter((s) => s !== cfg.strategie).map((s) => ({ ...cfg, strategie: s })));
  if (r1.change) journal.push(`Stratégie ${nomStrategie(r1.cfg.strategie)} (${signe(r1.gain.m)})`);
  cfg = r1.cfg;
  for (let k = 0; k < 4; k++) {
    for (const place of ["tech", "geste"]) {
      const role = cfg.roles[k];
      const actuelle = cfg.fiches[k][place];
      const variantes = competencesPermises(role, place, profil.palier)
        .filter((id) => id !== (actuelle || (place === "geste" ? "attaque" : ROLES_JEU[role].tech)))
        .map((id) => ({ ...cfg, fiches: cfg.fiches.map((x, j) => (j === k ? { ...x, [place]: id } : x)) }));
      const r = await departager(`${nom}, carte ${k + 1} (${ROLES_JEU[role].nom}), ${place === "tech" ? "technique" : "geste"}`, cfg, variantes);
      if (r.change) journal.push(`Carte ${k + 1} (${ROLES_JEU[role].nom}) : ${COMPETENCES[r.cfg.fiches[k][place]].nom} (${signe(r.gain.m)})`);
      cfg = r.cfg;
    }
  }
  const r3 = await departager(`${nom}, source`, cfg, SOURCES.filter((s) => s !== cfg.source).map((s) => ({ ...cfg, source: s })));
  if (r3.change) journal.push(`Source ${nomSource(r3.cfg.source)} (${signe(r3.gain.m)})`);
  cfg = r3.cfg;
  affinages.push({ avant: f.cfg, apres: cfg, journal });
}

/* ── 4. Finale ───────────────────────────────────────────────────────── */

const N_FIN = nb(2000);
await mesurer("4. Finale", affinages.flatMap((a) => [a.avant, a.apres]), N_FIN);
pool.fermer();
const finale = affinages.map((a) => ({ ...a, sAvant: stats(TOUTES.get(cleCfg(a.avant))), sApres: stats(TOUTES.get(cleCfg(a.apres))) }))
  .sort((a, b) => score(TOUTES.get(cleCfg(b.apres))) - score(TOUTES.get(cleCfg(a.apres))));

/* ── Le rapport ──────────────────────────────────────────────────────── */

const f1 = (x) => x.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f0 = (x) => Math.round(x).toLocaleString("fr-FR");
const strat = (c) => nomStrategie(c.strategie);
const L = [];
const date = new Date();
const jj = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
L.push(`# Simulation du Donjon infini, profil ${profil.nom}`, "");
L.push(`${jj}. Cartes ${profil.palier} niveau ${profil.niveau}, rangs d'ATQ et d'INI ${profil.rangs}, lignes étoilées : ${profil.etoiles.length ? profil.etoiles.join(", ") : "aucune"} ; source niveau ${profil.niveauSource}${profil.etoileSource ? ", étoilée" : ""}. Rencontres : ${opts.rencontres}. Objectif : ${A.objectif}.`);
L.push(`${totalDescentes.toLocaleString("fr-FR")} descentes en ${duree(Date.now() - t0)} sur ${COEURS} cœur${COEURS > 1 ? "s" : ""}${DECALAGE ? `, graines décalées de ${DECALAGE}` : ""}. Score : gardiens battus avant la chute.`, "");
L.push("## Les meilleures équipes, après affinage", "");
L.push(`Sur ${N_FIN.toLocaleString("fr-FR")} descentes chacune. « Avant » : l'équipe sortie du criblage (stratégie Prudence, compétences d'origine).`, "");
L.push("| # | Équipe | Source | Stratégie | Gardiens (moyenne ± IC 95 %) | Médiane · 9/10 sous · record | PO nettes | Avant affinage |", "|---:|---|---|---|---:|---|---:|---:|");
finale.forEach((a, i) => L.push(`| ${i + 1} | ${etiquette(a.apres)} | ${nomSource(a.apres.source)} | ${strat(a.apres)} | ${f1(a.sApres.moyenne)} ± ${f1(a.sApres.ic)} | ${a.sApres.mediane} · ${a.sApres.p90} · ${a.sApres.record} | ${f0(a.sApres.po)} | ${f1(a.sAvant.moyenne)} |`));
L.push("", "Ce que l'affinage a changé :", "");
finale.forEach((a, i) => L.push(`- **#${i + 1}** ${a.journal.length ? a.journal.join(" ; ") : "rien de significatif"}`));
L.push("", "## Les sources de pouvoir", "");
L.push(`Chaque source avec ses cinq meilleures compositions, rejouées sur ${nb(150)} descentes ; « toutes compositions » : la moyenne sur les ${COMPOS.length} compositions au premier tour du criblage.`, "");
L.push("| # | Source | Effet | Meilleure composition | Gardiens | Toutes compositions |", "|---:|---|---|---|---:|---:|");
const sans = parSource.find((x) => x.source === null);
parSource.forEach((x, i) => {
  const s = stats(x.meilleure);
  const effet = x.source ? texteEffets(effetsSource(LIEUX[x.source], profil.niveauSource, profil.etoileSource)) : "aucun";
  L.push(`| ${i + 1} | ${nomSource(x.source)} | ${effet} | ${etiquette(x.meilleure.cfg)} | ${f1(s.moyenne)} | ${f1(x.moyenneToutes)}${x === sans ? " (réf.)" : ` (${x.moyenneToutes >= sans.moyenneToutes ? "+" : ""}${f1(x.moyenneToutes - sans.moyenneToutes)})`} |`);
});
L.push("", "## Les rôles", "");
L.push("Premier tour du criblage, toutes sources confondues : gardiens moyens des équipes qui comptent ce rôle 0, 1, 2 fois ou plus.", "");
L.push("| Rôle | Absent | 1 | 2 | 3 ou 4 |", "|---|---:|---:|---:|---:|");
for (const r of ROLES) {
  const col = (k) => { const l = premierTour.filter((e) => { const n = e.cfg.roles.filter((x) => x === r).length; return k === 3 ? n >= 3 : n === k; }); return l.length ? f1(moy(l.flatMap((e) => e.g))) : "–"; };
  L.push(`| ${ROLES_JEU[r].nom} | ${col(0)} | ${col(1)} | ${col(2)} | ${col(3)} |`);
}
L.push("", "## Le criblage", "");
L.push(`Les vingt meilleures équipes en stratégie Prudence, compétences d'origine, sur ${nb(500)} descentes.`, "");
L.push("| # | Équipe | Source | Gardiens | 9/10 sous |", "|---:|---|---|---:|---:|");
criblage.slice(0, 20).forEach((e, i) => { const s = stats(e); L.push(`| ${i + 1} | ${etiquette(e.cfg)} | ${nomSource(e.cfg.source)} | ${f1(s.moyenne)} ± ${f1(s.ic)} | ${s.p90} |`); });
const blocages = [...TOUTES.values()].reduce((s, e) => s + e.blocages, 0);
L.push("", "## Limites", "");
L.push("- Pilote automatique (`choixAuto`) : un joueur en manuel tire davantage des rôles qui demandent du placement (Provocation du Garde, Voile).");
L.push("- Les quatre cartes ont le même palier et le même niveau, et chaque rôle existe à tous les paliers : on compare des décisions, pas des collections réelles.");
L.push("- Chemin sur la carte tiré au hasard (le choix des salles ne change presque rien au donjon infini, mesuré le 31/10/2026).");
L.push(`- Combats sans issue (blocages) : ${blocages}.`);
const dossier = new URL("./resultats/", import.meta.url);
mkdirSync(dossier, { recursive: true });
const nomFichier = `donjon-${A.profil}-${date.toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;
writeFileSync(new URL(`${nomFichier}.md`, dossier), L.join("\n") + "\n");
writeFileSync(new URL(`${nomFichier}.json`, dossier), JSON.stringify({ profil, options: A, finale, sources: parSource.map((x) => ({ source: x.source, moyenneToutes: x.moyenneToutes, meilleure: { cfg: x.meilleure.cfg, ...stats(x.meilleure) } })),
  equipes: [...TOUTES.values()].map((e) => ({ cfg: e.cfg, ...stats(e) })) }));
console.log(`\nTerminé en ${duree(Date.now() - t0)}. Rapport : scripts/simu-donjon/resultats/${nomFichier}.md`);
