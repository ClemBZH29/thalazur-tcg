/**
 * La ligne publique d'un joueur au classement, et son pseudo.
 *
 * C'est tout ce qui sort de la partie vers les autres joueurs : un pseudo
 * choisi à la main, le titre affiché, et des chiffres de progression. Rien ne
 * vient du compte Google (ni nom, ni photo, ni adresse), et rien ne part tant
 * que le joueur n'a pas coché « apparaître au classement ».
 */
import { resumeClassement } from "./regles.js";

export const PSEUDO_MIN = 2;
export const PSEUDO_MAX = 24;

/** Espaces resserrés, caractères de contrôle retirés, longueur bornée. */
export function nettoyerPseudo(v) {
  return String(v ?? "")
    // Contrôle et formatage invisibles (Cc, Cf : espaces nulles, inversions
    // de sens), séparateurs de ligne et de paragraphe.
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PSEUDO_MAX);
}

export const pseudoValide = (v) => nettoyerPseudo(v).length >= PSEUDO_MIN;

/** Le document `classement/{uid}`, sans ses deux horodatages serveur. */
export function ligneClassement(catalogue, etat, mine, titres) {
  const profil = etat.profil || {};
  const titre = titres.find((t) => t.id === profil.titre)?.titre || "";
  return { pseudo: nettoyerPseudo(profil.pseudo), titre, ...resumeClassement(catalogue, etat, mine) };
}

/** Un entier entre 0 et `max`, ou 0 : jamais un objet, une chaîne ou NaN. */
const borne = (v, max) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : 0);
const objet = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
/** Au plus 40 entrées, comme les règles Firestore. */
const entrees = (v) => (objet(v) ? Object.entries(v).slice(0, 40) : []);

/**
 * Une ligne du classement telle qu'un autre joueur l'a écrite, ramenée à la
 * forme que la page attend.
 *
 * Les règles Firestore ne savent pas parcourir une table : elles bornent le
 * nombre d'extensions et de premières complétions, pas leurs valeurs. Une
 * ligne falsifiée (`pct` qui serait un objet) faisait tomber la page du
 * classement chez tous les joueurs (« Objects are not valid as a React
 * child »). Tout ce qui sort d'ici est un nombre borné ou une chaîne.
 */
export function assainirLigne(x) {
  const l = objet(x) ? x : {};
  const extensions = {};
  for (const [id, e] of entrees(l.extensions)) {
    if (!objet(e)) continue;
    extensions[id] = { pct: borne(e.pct, 100), irisees: borne(e.irisees, 100000) };
  }
  const premiers = {};
  for (const [id, t] of entrees(l.premiers)) {
    if (typeof t === "number" && Number.isFinite(t) && t > 0) premiers[id] = t;
  }
  return {
    pseudo: nettoyerPseudo(typeof l.pseudo === "string" ? l.pseudo : ""),
    titre: typeof l.titre === "string" ? l.titre.slice(0, 80) : "",
    score: borne(l.score, 10000),
    boosters: borne(l.boosters, 1000000),
    strate: borne(l.strate, 100000),
    succes: borne(l.succes, 10000),
    extensions,
    premiers,
  };
}
