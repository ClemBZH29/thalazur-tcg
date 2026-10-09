import { bourseNeuve } from "./economie.js";
import { SON_DEFAUT } from "../config/son.js";
import { cles, comparerMines, fusionnerMine } from "./nuage/fusion.js";
import { SCHEMA, migrer } from "./sauvegarde/schema.js";
import { estGele, geler } from "./gel.js";

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
/**
 * Ce que l'appareil remplaçait quand une synchronisation lui a retiré des
 * cartes (voir `adopter`, src/jeu/Compte.jsx). Elle appartient au joueur de
 * cet appareil : `effacer()` l'emporte avec la partie.
 */
export const CLE_SECOURS = "brume-thalazur:secours";

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
  reglages: { son: { ...SON_DEFAUT } }, // son : voir config/son.js
  rosters: {},     // boosterId -> lignes chargées à la main (outils MJ, développement)
  grades: {},      // boosterId -> corrections de palier par grade (outils MJ)
  comptoir: {},    // boosterId -> état du marché (voir comptoir/marche.js)
  mine: null,      // { regles, solde, livre } — remise des Mines payée, PO de commandes du jour (src/jeu/mine.js)
  // Tafix, le kobold des Mines : conseils déjà vus, onglets déjà ouverts
  // (un onglet ouvert l'est pour le compte, pas pour la mine), silence.
  tafix: { vus: [], onglets: [], muet: false },
  colporteur: null, // { jour: "AAAA-MM-JJ", depuis: n }
  // Ce que le joueur a choisi de montrer de lui. Rien n'est lu chez Google
  // pour le remplir : le pseudo est saisi à la main, ou reste vide.
  profil: {},       // { pseudo, titre, classement, pseudoReporte }
  // Succès réclamés : id -> { t, po, n, cle } (voir src/succes/regles.js).
  succes: {},
  // Sachets offerts par les succès, à ouvrir sans payer : boosterId -> n,
  // et "*" pour les sachets au choix.
  sachets: {},
  // Compteurs que rien d'autre ne garde : exemplaires vendus au Comptoir,
  // affaires conclues avec le colporteur. Ils ne partent que de leur mise en
  // service ; les parties plus anciennes commencent à zéro.
  stats: {},
  // Le Donjon : { jour, tentatives, partie, dernier, convalescence }. La partie en
  // cours y est sauvée entre deux salles (voir src/donjon/regles.js).
  donjon: null,
  // Expérience des cartes au Donjon : "extension:carte" -> { xp, irisee, cent }
  // (voir src/donjon/experience.js).
  xp: {},
  // Expéditions : { routes, orJour, seq } (voir src/expeditions/regles.js).
  expeditions: null,
  // Reliquaire : { vestiges, achats, reveles, ouvert } (voir src/reliquaire/regles.js).
  reliquaire: null,
  // Fiches de combat : "extension:carte" -> { atq, ini, geste, tech, etoiles }
  // (voir src/donjon/fiches.js).
  fiches: {},
  // Missions de Bodégué : { jour, remplacees, quotidiennes, semaine, hebdo }
  // (voir src/missions/regles.js).
  missions: null,
});

export const etatVide = vide;

/**
 * Remet une sauvegarde du jeu, d'où qu'elle vienne (stockage local, compte,
 * fichier importé), à la forme courante. `null` si elle n'est pas lisible.
 */
export function relireJeu(donnees) {
  const d = migrer("jeu", donnees);
  if (!d) return null;
  // Un champ du mauvais type (collections: null, une chaîne à la place d'un
  // objet…) faisait planter le jeu plus loin, loin de sa cause : il reprend
  // sa valeur par défaut. Les champs inconnus passent tels quels.
  const defaut = vide();
  const sortie = { ...defaut };
  for (const [k, v] of Object.entries(d)) {
    sortie[k] = k in defaut && !memeForme(defaut[k], v) ? defaut[k] : v;
  }
  return { ...sortie, schema: SCHEMA, bourse: relireBourse(d.bourse) };
}

const objet = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** `v` a-t-il la forme de la valeur par défaut `defaut` ? Nul par défaut : objet ou null. */
function memeForme(defaut, v) {
  if (defaut === null) return v === null || objet(v);
  if (Array.isArray(defaut)) return Array.isArray(v);
  if (objet(defaut)) return objet(v);
  return typeof v === typeof defaut;
}

/**
 * La bourse, en nombres finis. Une chaîne (« 100 ») se concaténait au lieu
 * de s'additionner ; elle est convertie, et ce qui n'est pas un nombre
 * reprend la valeur d'une bourse neuve.
 */
function relireBourse(b) {
  const neuve = bourseNeuve();
  if (!objet(b)) return neuve;
  const sortie = { ...b };
  for (const [k, def] of Object.entries(neuve)) {
    const n = typeof b[k] === "string" && b[k].trim() !== "" ? Number(b[k]) : b[k];
    sortie[k] = typeof n === "number" && Number.isFinite(n) ? n : def;
  }
  return sortie;
}

/**
 * Le genre d'une sauvegarde texte, par rapport au format de ce site :
 * "absent", "illisible", "ancien", "courant" ou "futur". Sert aux onglets qui
 * s'écoutent (Jeu.jsx, Compte.jsx) : une écriture d'un onglet en retard ne
 * s'adopte pas, une écriture d'un onglet en avance gèle celui-ci.
 */
export function classerTexte(texte) {
  if (texte == null) return "absent";
  let d;
  try { d = JSON.parse(texte); } catch { return "illisible"; }
  return classerDonnees(d);
}

export function classerDonnees(d) {
  if (!objet(d)) return "illisible";
  const n = Number(d.schema);
  if (!Number.isFinite(n)) return "illisible";
  return n > SCHEMA ? "futur" : n < SCHEMA ? "ancien" : "courant";
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
    // Une partie (ou une mine) d'un format plus récent : un autre onglet tourne
    // sur la nouvelle version. On ne la lit pas, et surtout on ne réécrit pas
    // par-dessus une partie vide : l'onglet se gèle et demande à recharger.
    if (classerTexte(brut) === "futur" || classerTexte(localStorage.getItem(CLE_MINE_STOCKAGE)) === "futur") {
      geler("onglet");
      return vide();
    }
    return (brut && relireJeu(JSON.parse(brut))) || vide();
  } catch {
    return vide();
  }
}

/** Clés partagées entre les onglets ouverts sur le site (voir Jeu.jsx). */
export const CLE_PARTIE = CLE;
export const CLE_MINE = CLE_MINE_STOCKAGE;

/**
 * `dejaLa` : le texte qu'un autre onglet vient d'écrire et que cet onglet a
 * adopté. Le réécrire tel quel relancerait l'adoption dans l'autre onglet.
 */
export function sauver(etat, dejaLa = null) {
  if (estGele()) return true; // pas une panne : l'onglet attend d'être rechargé
  try {
    const texte = JSON.stringify({ ...etat, schema: SCHEMA });
    if (texte !== dejaLa) localStorage.setItem(CLE, texte);
    return true;
  } catch {
    return false; // quota dépassé
  }
}

export function effacer() {
  try {
    localStorage.removeItem(CLE);
    localStorage.removeItem(CLE_MINE_STOCKAGE);
    localStorage.removeItem(CLE_SECOURS);
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
  if (estGele()) return;
  adoptee = valeur ?? "";
  try {
    if (valeur == null) localStorage.removeItem(CLE_MINE_STOCKAGE);
    else localStorage.setItem(CLE_MINE_STOCKAGE, valeur);
  } catch { /* quota */ }
}

/**
 * Remet dans le stockage une mine qu'un onglet resté sur une ancienne version
 * du site vient de recouvrir (voir Jeu.jsx). Ni adoption ni écouteurs : c'est
 * la mine que cet onglet avait déjà, le module n'a rien à relire.
 */
export function retablirMine(texte) {
  if (estGele() || texte == null) return;
  try { localStorage.setItem(CLE_MINE_STOCKAGE, texte); } catch { /* quota */ }
}

/**
 * Magasin de la mine, tenu à part de l'état de l'app. La mine se sauve toutes
 * les quinze secondes ; la faire passer par l'état React réécrirait toute la
 * collection à chaque tour d'horloge pour rien.
 */
/**
 * Ce que la prochaine lecture doit rendre : l'adoption en attente, sauf si le
 * stockage tient depuis une partie plus avancée. L'adoption peut dater :
 * faite onglet caché, puis l'onglet redevenu visible n'adopte plus ce qu'un
 * autre onglet écrit ensuite (audit du 09/10/2026). Une adoption vide
 * (déconnexion, appareil vidé) reste vide.
 */
function aServir() {
  const stockee = lireMine();
  if (adoptee === null) return stockee;
  if (!adoptee || !stockee) return adoptee || null;
  const lire = (v) => { try { return JSON.parse(v); } catch { return null; } };
  return comparerMines(lire(stockee), lire(adoptee)) > 0 ? stockee : adoptee;
}

export const magasinKazim = {
  get: () => {
    const v = aServir();
    adoptee = null;
    return Promise.resolve(v);
  },
  /** Lecture sans effet : ne consomme pas une adoption en attente. */
  voir: aServir,
  set: (valeur) => {
    if (adoptee !== null || estGele()) return Promise.resolve();
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
 * La mine, elle, ne s'additionne pas : en fusion, la plus avancée des deux
 * reste (un fichier ancien ne remet pas à zéro des semaines de galerie) ; en
 * remplacement, celle du fichier s'impose.
 */
export async function importer(fichier, actuel, mode = "fusion") {
  let entrant;
  try { entrant = JSON.parse(await fichier.text()); } catch { throw new Error("Fichier illisible"); }
  if (!entrant || entrant.format !== "brume-thalazur") throw new Error("Ce fichier n'est pas une sauvegarde de La Brume de Thalazur");
  const jeu = relireJeu(entrant.jeu);
  if (!jeu) throw new Error("Sauvegarde d'une version incompatible");

  const mine = entrant.mine ? migrer("mine", entrant.mine) : null;
  if (mine) {
    const texte = JSON.stringify(mine);
    const retenue = mode === "remplacement" ? texte : fusionnerMine(lireMine(), texte);
    if (retenue !== lireMine()) ecrireMine(retenue);
  }
  if (mode === "remplacement") return jeu;
  return fusionner(actuel, jeu);
}

/* ── Copie de secours ──────────────────────────────────────────────────── */

/** La copie de secours gardée par l'appareil, ou `null`. */
export function lireSecours() {
  try {
    const c = JSON.parse(localStorage.getItem(CLE_SECOURS));
    return c && objet(c.jeu) ? c : null;
  } catch { return null; }
}

export function effacerSecours() {
  try { localStorage.removeItem(CLE_SECOURS); } catch { /* rien à effacer */ }
}

/**
 * Remet dans la partie ce que la copie de secours avait de plus.
 *
 * La copie est une version antérieure de la même partie, pas une seconde
 * partie : l'additionner (comme un import en fusion) comptait deux fois chaque
 * carte — 10 et 9 donnaient 19, et un second clic 29. On garde donc, carte par
 * carte et compteur par compteur, le plus grand des deux ; la mine la plus
 * avancée ; puis la copie est effacée, son travail fait.
 *
 * Rend `{ jeu, mine }` (`mine` : texte à écrire, ou `null` si celle en cours
 * reste), ou `null` s'il n'y a rien à restaurer.
 */
export function restaurerSecours(actuel, copie) {
  const net = copie && relireJeu(copie.jeu);
  if (!net) return null;
  const jeu = fusionner(actuel, net, { cumul: false });
  let mine = null;
  const sienne = copie.mine ? migrer("mine", copie.mine) : null;
  if (sienne) {
    const retenue = fusionnerMine(lireMine(), JSON.stringify(sienne));
    if (retenue !== lireMine()) mine = retenue;
  }
  effacerSecours();
  return { jeu, mine };
}

/**
 * Réunit deux parties : les exemplaires et les boosters se cumulent, le
 * porte-monnaie retenu est le plus garni des deux — on ne punit pas un import.
 *
 * `cumul: false` : `net` est une version antérieure de la même partie (copie
 * de secours) ; exemplaires et boosters prennent alors le plus grand des deux
 * au lieu de la somme.
 */
export function fusionner(actuel, net, { cumul = true } = {}) {
  const reunir = (a, b) => (cumul ? a + b : Math.max(a, b));
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
        ? { ...a, normale: reunir(a.normale || 0, e.normale || 0), rainbow: reunir(a.rainbow || 0, e.rainbow || 0) }
        : e;
    }
  }
  for (const bid of cles(net.boosters)) {
    fusion.boosters[bid] = reunir(fusion.boosters[bid] || 0, net.boosters[bid] || 0);
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
  // Un succès réclamé l'est une fois pour toutes, où qu'il l'ait été. Les
  // sachets et les compteurs ne s'additionnent pas : importer un fichier ne
  // doit pas rendre deux fois ce qu'il a déjà rendu.
  fusion.succes = { ...(net.succes || {}), ...(actuel.succes || {}) };
  fusion.sachets = { ...(actuel.sachets || {}) };
  fusion.stats = { ...(actuel.stats || {}) };
  fusion.xp = { ...(net.xp || {}) };
  for (const k of cles(actuel.xp)) {
    const a = actuel.xp[k], n = fusion.xp[k];
    fusion.xp[k] = !n ? a : { xp: Math.max(a.xp || 0, n.xp || 0), irisee: a.irisee || n.irisee, cent: a.cent || n.cent };
  }
  for (const k of cles(net.stats)) {
    fusion.stats[k] = Math.max(fusion.stats[k] || 0, net.stats[k] || 0);
  }
  return fusion;
}
