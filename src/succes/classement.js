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
