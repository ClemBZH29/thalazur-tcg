import { bourseNeuve } from "./economie.js";

/**
 * Persistance locale. Le navigateur garde toujours la partie : c'est elle
 * qu'on lit au démarrage, hors ligne compris. Un joueur connecté voit en plus
 * cette même partie recopiée sur son compte (voir `src/lib/nuage/`) ; le
 * stockage local reste alors un cache, et la copie du compte fait foi entre
 * appareils. L'export produit un fichier JSON réimportable ou archivable.
 *
 * Le porte-monnaie vit ici, donc quiconque avance l'horloge de sa machine ou
 * édite le stockage se donne autant de pièces qu'il veut. Pour un site de
 * campagne entre gens qui se connaissent, c'est sans importance.
 *
 * ── Version 5 ────────────────────────────────────────────────────────────
 * Les cases `normale` et `rainbow` étaient des booléens : une carte tombant
 * dans une case déjà remplie était revendue sur-le-champ. Le Comptoir a besoin
 * d'exemplaires à écouler, donc ces deux champs sont devenus des compteurs.
 *
 * Le choix vaut la peine d'être noté : les compteurs restent lus en booléen
 * partout où l'affichage ne demande que « possédée ou non », parce que 0 est
 * faux et tout entier positif est vrai. Aucune vue de la bibliothèque n'a eu
 * à changer. La migration se contente de projeter les booléens sur 0 et 1.
 */
const CLE = "brume-thalazur:v5";
const CLE_KAZIM = "brume-thalazur:kazim";
const VERSION = 5;

/** Les versions antérieures, dans l'ordre, pour la reprise d'une partie. */
const ANCIENNES = ["brume-thalazur:v4"];

const vide = () => ({
  version: VERSION,
  collections: {}, // boosterId -> { [carteId]: { normale: n, rainbow: n, carte } }
  boosters: {},    // boosterId -> nombre ouverts
  pity: {},        // boosterId -> { depuis, vu }
  bourse: bourseNeuve(),
  // Ouverture en cours, conservée pour pouvoir la reprendre après une
  // fermeture d'onglet : les cartes sont déjà acquises, seul l'affichage manque.
  enCours: null,
  reglages: {},
  rosters: {},     // boosterId -> lignes chargées à la main
  grades: {},      // boosterId -> corrections de palier par grade
  comptoir: {},    // boosterId -> état du marché (voir comptoir/marche.js)
  mine: null,      // { jour: "AAAA-MM-JJ", credite: PO } — plafond quotidien
  // Passages du colporteur : le dernier jour où il s'est arrêté, et le nombre
  // de boosters ouverts depuis. Champ ajouté sans changer de version : les
  // sauvegardes v5 antérieures le reçoivent par défaut au chargement.
  colporteur: null, // { jour: "AAAA-MM-JJ", depuis: n }
  // Ce que le joueur a choisi de montrer de lui. Rien n'est lu chez Google
  // pour le remplir : le pseudo est saisi à la main, ou reste vide.
  profil: {},       // { pseudo }
});

export const etatVide = vide;

/** Booléens de la v4 vers compteurs d'exemplaires de la v5. */
function migrerV4(d) {
  const collections = {};
  for (const [bid, coll] of Object.entries(d.collections || {})) {
    collections[bid] = {};
    for (const [cid, e] of Object.entries(coll)) {
      collections[bid][cid] = {
        ...e,
        normale: e.normale ? 1 : 0,
        rainbow: e.rainbow ? 1 : 0,
      };
    }
  }
  return { ...d, collections, version: VERSION };
}

/** Une sauvegarde relue peut porter des booléens laissés par un vieil export. */
const normaliser = (etat) => migrerV4(etat);

export function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) {
      const d = JSON.parse(brut);
      if (d.version === VERSION) return { ...vide(), ...d, bourse: { ...bourseNeuve(), ...(d.bourse || {}) } };
    }
    // Reprise d'une partie de la version précédente : la collection est le
    // fruit de dizaines d'ouvertures, la perdre au changement de format serait
    // le pire accueil possible.
    for (const ancienne of ANCIENNES) {
      const vieux = localStorage.getItem(ancienne);
      if (!vieux) continue;
      const d = JSON.parse(vieux);
      return { ...vide(), ...migrerV4(d), bourse: { ...bourseNeuve(), ...(d.bourse || {}) } };
    }
    return vide();
  } catch {
    return vide();
  }
}

export function sauver(etat) {
  try {
    localStorage.setItem(CLE, JSON.stringify({ ...etat, version: VERSION }));
    return true;
  } catch {
    return false; // quota dépassé
  }
}

export function effacer() {
  try {
    localStorage.removeItem(CLE);
    localStorage.removeItem(CLE_KAZIM);
    ANCIENNES.forEach((c) => localStorage.removeItem(c));
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
  try { return localStorage.getItem(CLE_KAZIM); } catch { return null; }
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
    if (valeur == null) localStorage.removeItem(CLE_KAZIM);
    else localStorage.setItem(CLE_KAZIM, valeur);
  } catch { /* quota */ }
}

/**
 * Magasin de la mine, tenu à part de l'état de l'app. La mine se sauve toutes
 * les quinze secondes ; la faire passer par l'état React réécrirait toute la
 * collection à chaque tour d'horloge pour rien.
 */
export const magasinKazim = {
  get: (cle) => {
    if (adoptee !== null) { const v = adoptee || null; adoptee = null; return Promise.resolve(v); }
    try { return Promise.resolve(localStorage.getItem(cle)); }
    catch { return Promise.resolve(null); }
  },
  set: (cle, valeur) => {
    if (adoptee !== null) return Promise.resolve();
    try { localStorage.setItem(cle, valeur); } catch { /* quota : la partie continue */ }
    suiveursMine.forEach((fn) => { try { fn(valeur); } catch { /* sans importance */ } });
    return Promise.resolve();
  },
};

export const CLE_MINE = CLE_KAZIM;
export const VERSION_ETAT = VERSION;

export function exporter(etat) {
  const date = new Date().toISOString().slice(0, 10);
  let mine = null;
  try { mine = localStorage.getItem(CLE_KAZIM); } catch { /* sans importance */ }
  const blob = new Blob([JSON.stringify({ ...etat, mine, version: VERSION }, null, 2)], {
    type: "application/json",
  });
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
  let entrant = JSON.parse(await fichier.text());
  if (!entrant || typeof entrant !== "object") throw new Error("Fichier illisible");
  if (entrant.version === 4) entrant = normaliser(entrant);
  if (entrant.version !== VERSION) throw new Error("Version d'export incompatible");

  if (entrant.mine) {
    try { localStorage.setItem(CLE_KAZIM, entrant.mine); } catch { /* sans importance */ }
  }
  const { mine, ...net } = entrant;
  if (mode === "remplacement") return { ...vide(), ...net };
  return fusionner(actuel, net);
}

/**
 * Additionne deux parties : les exemplaires et les boosters se cumulent, le
 * porte-monnaie retenu est le plus garni des deux — on ne punit pas un import.
 * Sert à l'import d'un fichier comme à la première connexion d'un joueur qui
 * avait déjà joué sans compte.
 */
export function fusionner(actuel, net) {
  const fusion = { ...vide(), ...normaliser(actuel) };
  for (const [bid, coll] of Object.entries(net.collections || {})) {
    fusion.collections[bid] = { ...(fusion.collections[bid] || {}) };
    for (const [cid, e] of Object.entries(coll)) {
      const a = fusion.collections[bid][cid];
      fusion.collections[bid][cid] = a
        ? { ...a, normale: (a.normale || 0) + (e.normale || 0), rainbow: (a.rainbow || 0) + (e.rainbow || 0) }
        : e;
    }
  }
  for (const [bid, n] of Object.entries(net.boosters || {})) {
    fusion.boosters[bid] = (fusion.boosters[bid] || 0) + n;
  }
  for (const [bid, p] of Object.entries(net.pity || {})) {
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
