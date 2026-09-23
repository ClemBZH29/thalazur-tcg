import { bourseNeuve } from "./economie.js";
import { cles } from "./nuage/fusion.js";
import { SCHEMA, migrer } from "./sauvegarde/schema.js";

/**
 * Persistance locale. Le navigateur garde toujours la partie : c'est elle
 * qu'on lit au démarrage, hors ligne compris. Un joueur connecté voit en plus
 * cette même partie recopiée sur son compte (voir `src/jeu/Compte.jsx`) ; le
 * stockage local reste alors un cache, et la copie du compte fait foi entre
 * appareils. L'export produit un fichier JSON réimportable ou archivable.
 *
 * Deux clés, parce que la mine se sauve toutes les quinze secondes et qu'il
 * serait absurde de réécrire toute la collection à ce rythme. Un seul format :
 * les deux portent le même `schema` (voir `sauvegarde/schema.js`).
 *
 * Le porte-monnaie vit ici, donc quiconque avance l'horloge de sa machine ou
 * édite le stockage se donne autant de pièces qu'il veut. Pour un site de
 * campagne entre gens qui se connaissent, c'est sans importance.
 *
 * Les compteurs d'exemplaires (`normale`, `rainbow`) se lisent aussi en
 * booléen partout où l'affichage ne demande que « possédée ou non » : 0 est
 * faux, tout entier positif est vrai.
 */
const CLE = "brume-thalazur:partie";
const CLE_MINE_STOCKAGE = "brume-thalazur:mine";

/** Clés des formats antérieurs au schéma 6, effacées à la première visite. */
const PERIMEES = ["brume-thalazur:v4", "brume-thalazur:v5", "brume-thalazur:kazim"];

const vide = () => ({
  schema: SCHEMA,
  collections: {}, // boosterId -> { [carteId]: { normale: n, rainbow: n, carte } }
  boosters: {},    // boosterId -> nombre ouverts
  pity: {},        // boosterId -> { depuis, vu }
  bourse: bourseNeuve(),
  // Ouverture en cours, conservée pour pouvoir la reprendre après une
  // fermeture d'onglet : les cartes sont déjà acquises, seul l'affichage manque.
  enCours: null,
  reglages: {},
  rosters: {},     // boosterId -> lignes chargées à la main (outils MJ, développement)
  grades: {},      // boosterId -> corrections de palier par grade (outils MJ)
  comptoir: {},    // boosterId -> état du marché (voir comptoir/marche.js)
  mine: null,      // { jour: "AAAA-MM-JJ", credite: PO } — plafond quotidien
  colporteur: null, // { jour: "AAAA-MM-JJ", depuis: n }
  // Ce que le joueur a choisi de montrer de lui. Rien n'est lu chez Google
  // pour le remplir : le pseudo est saisi à la main, ou reste vide.
  profil: {},       // { pseudo }
});

export const etatVide = vide;

/**
 * Remet une sauvegarde du jeu, d'où qu'elle vienne (stockage local, compte,
 * fichier importé), à la forme courante. `null` si elle n'est pas lisible.
 */
export function relireJeu(donnees) {
  const d = migrer("jeu", donnees);
  if (!d) return null;
  return { ...vide(), ...d, schema: SCHEMA, bourse: { ...bourseNeuve(), ...(d.bourse || {}) } };
}

/**
 * Formats antérieurs : effacés, pas convertis (voir l'historique dans
 * `sauvegarde/schema.js`). La base de synchronisation du compte part avec eux,
 * sinon l'appareil croirait avoir quelque chose à fusionner.
 */
function nettoyerPerimees() {
  let trouve = false;
  for (const c of PERIMEES) {
    if (localStorage.getItem(c) !== null) { localStorage.removeItem(c); trouve = true; }
  }
  if (trouve) localStorage.removeItem("brume-thalazur:compte-base");
}

export function charger() {
  try {
    nettoyerPerimees();
    const brut = localStorage.getItem(CLE);
    return (brut && relireJeu(JSON.parse(brut))) || vide();
  } catch {
    return vide();
  }
}

export function sauver(etat) {
  try {
    localStorage.setItem(CLE, JSON.stringify({ ...etat, schema: SCHEMA }));
    return true;
  } catch {
    return false; // quota dépassé
  }
}

export function effacer() {
  try {
    localStorage.removeItem(CLE);
    localStorage.removeItem(CLE_MINE_STOCKAGE);
    PERIMEES.forEach((c) => localStorage.removeItem(c));
  } catch { /* stockage refusé : il n'y a rien à effacer */ }
}

/* ── La mine, vue de l'extérieur du module ─────────────────────────────── */

/** Écouteurs prévenus à chaque sauvegarde de la mine : la synchronisation. */
const suiveursMine = new Set();
export function suivreMine(fn) {
  suiveursMine.add(fn);
  return () => suiveursMine.delete(fn);
}

export function lireMine() {
  try { return localStorage.getItem(CLE_MINE_STOCKAGE); } catch { return null; }
}

/**
 * Sauvegarde de mine arrivée de l'extérieur, en attente d'être relue.
 *
 * Le module sauve en se démontant. Quand on remplace sa sauvegarde puis qu'on
 * le remonte pour qu'il la relise, ce dernier soupir de l'ancienne instance
 * écraserait la nouvelle. Tant qu'une adoption attend, les écritures du
 * module sont ignorées, et la prochaine lecture rend la sauvegarde adoptée.
 */
let adoptee = null;

/** Écrit la mine sans prévenir personne : c'est une adoption, pas un coup de pioche. */
export function ecrireMine(valeur) {
  adoptee = valeur ?? "";
  try {
    if (valeur == null) localStorage.removeItem(CLE_MINE_STOCKAGE);
    else localStorage.setItem(CLE_MINE_STOCKAGE, valeur);
  } catch { /* quota */ }
}

/**
 * Magasin de la mine, tenu à part de l'état de l'app. La mine se sauve toutes
 * les quinze secondes ; la faire passer par l'état React réécrirait toute la
 * collection à chaque tour d'horloge pour rien.
 */
export const magasinKazim = {
  get: () => {
    if (adoptee !== null) { const v = adoptee || null; adoptee = null; return Promise.resolve(v); }
    return Promise.resolve(lireMine());
  },
  set: (valeur) => {
    if (adoptee !== null) return Promise.resolve();
    try { localStorage.setItem(CLE_MINE_STOCKAGE, valeur); } catch { /* quota : la partie continue */ }
    suiveursMine.forEach((fn) => { try { fn(valeur); } catch { /* sans importance */ } });
    return Promise.resolve();
  },
};

/* ── Fichier exporté ───────────────────────────────────────────────────── */

/**
 * Le fichier porte le jeu et la mine côte à côte, au même schéma :
 * `{ format, schema, jeu, mine }`.
 */
export function exporter(etat) {
  const date = new Date().toISOString().slice(0, 10);
  let mine = null;
  try { mine = JSON.parse(lireMine()); } catch { /* pas de mine */ }
  const fichier = { format: "brume-thalazur", schema: SCHEMA, jeu: { ...etat, schema: SCHEMA }, mine };
  const blob = new Blob([JSON.stringify(fichier, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `brume-thalazur-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Importe un export. En mode « fusion », les exemplaires s'additionnent et le
 * porte-monnaie retenu est le plus garni des deux — on ne punit pas un import.
 */
export async function importer(fichier, actuel, mode = "fusion") {
  let entrant;
  try { entrant = JSON.parse(await fichier.text()); } catch { throw new Error("Fichier illisible"); }
  if (!entrant || entrant.format !== "brume-thalazur") throw new Error("Ce fichier n'est pas une sauvegarde de La Brume de Thalazur");
  const jeu = relireJeu(entrant.jeu);
  if (!jeu) throw new Error("Sauvegarde d'une version incompatible");

  if (entrant.mine && migrer("mine", entrant.mine)) {
    ecrireMine(JSON.stringify(migrer("mine", entrant.mine)));
  }
  if (mode === "remplacement") return jeu;
  return fusionner(actuel, jeu);
}

/**
 * Additionne deux parties : les exemplaires et les boosters se cumulent, le
 * porte-monnaie retenu est le plus garni des deux — on ne punit pas un import.
 */
export function fusionner(actuel, net) {
  const fusion = { ...vide(), ...actuel };
  fusion.collections = { ...fusion.collections };
  fusion.boosters = { ...fusion.boosters };
  fusion.pity = { ...fusion.pity };
  for (const bid of cles(net.collections)) {
    const coll = net.collections[bid];
    fusion.collections[bid] = { ...(fusion.collections[bid] || {}) };
    for (const cid of cles(coll)) {
      const e = coll[cid];
      const a = fusion.collections[bid][cid];
      fusion.collections[bid][cid] = a
        ? { ...a, normale: (a.normale || 0) + (e.normale || 0), rainbow: (a.rainbow || 0) + (e.rainbow || 0) }
        : e;
    }
  }
  for (const bid of cles(net.boosters)) {
    fusion.boosters[bid] = (fusion.boosters[bid] || 0) + net.boosters[bid];
  }
  for (const bid of cles(net.pity)) {
    const p = net.pity[bid];
    const a = fusion.pity[bid];
    fusion.pity[bid] = a ? { depuis: Math.min(a.depuis, p.depuis), vu: a.vu || p.vu } : p;
  }
  fusion.bourse = (net.bourse?.po || 0) > (fusion.bourse.po || 0) ? net.bourse : fusion.bourse;
  fusion.enCours = actuel.enCours || net.enCours || null;
  fusion.reglages = { ...fusion.reglages, ...(net.reglages || {}) };
  fusion.rosters = { ...fusion.rosters, ...(net.rosters || {}) };
  fusion.grades = { ...fusion.grades, ...(net.grades || {}) };
  // Le marché est un état de simulation, pas un acquis : celui en place gagne.
  fusion.comptoir = { ...(net.comptoir || {}), ...(fusion.comptoir || {}) };
  // Même raisonnement pour le colporteur : importer une sauvegarde ne doit pas
  // le faire repasser le jour même s'il est déjà venu ici.
  fusion.colporteur = actuel.colporteur || net.colporteur || null;
  fusion.profil = { ...(net.profil || {}), ...(actuel.profil || {}) };
  return fusion;
}
