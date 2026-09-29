/**
 * Le Reliquaire : règles pures.
 *
 * Il dissout les exemplaires en trop en vestiges et forge une carte qui
 * manque. Trois garde-fous, tous tenus ici plutôt qu'à l'écran :
 *
 * - le dernier exemplaire d'une carte ne se dissout jamais ;
 * - on ne forge que ce qui manque : aucun cycle forge puis revente au Comptoir ;
 * - rainbow, full art et cartes de personnage restent hors du Reliquaire.
 *
 * Les vestiges vivent dans `etat.reliquaire.vestiges` ; la date de la
 * dernière légendaire forgée dans `etat.reliquaire.derniereForgeL`.
 */
import { RELIQUAIRE } from "../config/reliquaire.js";

const J = 24 * 3600e3;
export const PALIERS = ["commun", "peucommun", "rare", "legendaire"];

export const etatReliquaire = (etat) => ({ vestiges: 0, derniereForgeL: null, ouvert: null, ...(etat.reliquaire || {}) });
export const vestiges = (etat) => etatReliquaire(etat).vestiges;

/** Une carte que le Reliquaire accepte de traiter. */
export const eligible = (c) => !!c && PALIERS.includes(c.tier) && !String(c.id).startsWith("pj-");

const exemplaires = (etat, ext, c) => etat.collections?.[ext]?.[c.id]?.normale || 0;

/** Part de l'extension possédée (case normale), sur les cartes du roster. */
export function completion(etat, ext, cartes) {
  const r = cartes.filter(eligible);
  if (!r.length) return 0;
  return r.filter((c) => exemplaires(etat, ext, c) > 0).length / r.length;
}

/**
 * Le seuil d'ouverture est-il atteint ? `extensions` : { id: cartes }. La
 * meilleure extension suffit.
 */
export const seuilAtteint = (etat, extensions) =>
  Object.entries(extensions).some(([ext, cartes]) => completion(etat, ext, cartes) >= RELIQUAIRE.ouverture);

/** Ouvert pour de bon : noté à l'annonce, il ne se referme plus. */
export const estOuvert = (etat) => !!etatReliquaire(etat).ouvert;

export const ouvrir = (etat, maintenant = Date.now()) =>
  estOuvert(etat) ? etat : { ...etat, reliquaire: { ...etatReliquaire(etat), ouvert: maintenant } };

/** Dissout `n` exemplaires en trop. L'état est rendu tel quel si c'est impossible. */
export function dissoudre(etat, ext, c, n = 1) {
  const k = exemplaires(etat, ext, c);
  if (!eligible(c) || n < 1 || k - n < 1) return etat;
  const coll = { ...(etat.collections[ext] || {}) };
  coll[c.id] = { ...coll[c.id], normale: k - n };
  const R = etatReliquaire(etat);
  return {
    ...etat,
    collections: { ...etat.collections, [ext]: coll },
    reliquaire: { ...R, vestiges: R.vestiges + n * RELIQUAIRE.dissolution[c.tier] },
    stats: { ...(etat.stats || {}), dissous: ((etat.stats || {}).dissous || 0) + n },
  };
}

/** Tous les exemplaires en trop des paliers demandés, en un geste. */
export function dissoudreSurplus(etat, ext, cartes, paliers = ["commun", "peucommun"]) {
  return cartes
    .filter((c) => eligible(c) && paliers.includes(c.tier))
    .reduce((e, c) => dissoudre(e, ext, c, exemplaires(e, ext, c) - 1), etat);
}

export const surplus = (etat, ext, cartes, paliers = PALIERS) =>
  cartes.filter((c) => eligible(c) && paliers.includes(c.tier))
    .reduce((s, c) => {
      const n = Math.max(0, exemplaires(etat, ext, c) - 1);
      return { cartes: s.cartes + n, vestiges: s.vestiges + n * RELIQUAIRE.dissolution[c.tier] };
    }, { cartes: 0, vestiges: 0 });

/** Où en sont les conditions d'une légendaire. */
export function conditionsLegendaire(etat, ext, cartes, maintenant = Date.now()) {
  const L = RELIQUAIRE.legendaire, R = etatReliquaire(etat);
  const prochaine = R.derniereForgeL == null ? maintenant : R.derniereForgeL + L.delaiJours * J;
  const pct = completion(etat, ext, cartes);
  return {
    completion: pct, completionOk: pct >= L.completionMin,
    prochaine, delaiOk: maintenant >= prochaine,
    vestigesOk: R.vestiges >= RELIQUAIRE.forge.legendaire,
  };
}

export function peutForger(etat, ext, c, cartes, maintenant = Date.now()) {
  if (!eligible(c) || exemplaires(etat, ext, c) > 0) return false;
  if (vestiges(etat) < RELIQUAIRE.forge[c.tier]) return false;
  if (c.tier === "legendaire") {
    const k = conditionsLegendaire(etat, ext, cartes, maintenant);
    return k.completionOk && k.delaiOk;
  }
  return true;
}

/** Forge une carte manquante. L'état est rendu tel quel si c'est impossible. */
export function forger(etat, ext, c, cartes, maintenant = Date.now()) {
  if (!peutForger(etat, ext, c, cartes, maintenant)) return etat;
  const R = etatReliquaire(etat);
  const coll = { ...(etat.collections[ext] || {}) };
  const { ext: _ext, rainbow: _r, slot: _s, ...carte } = c;
  coll[c.id] = { rainbow: 0, ...(coll[c.id] || {}), normale: 1, carte };
  return {
    ...etat,
    collections: { ...etat.collections, [ext]: coll },
    reliquaire: {
      ...R,
      vestiges: R.vestiges - RELIQUAIRE.forge[c.tier],
      derniereForgeL: c.tier === "legendaire" ? maintenant : R.derniereForgeL,
    },
    stats: { ...(etat.stats || {}), forges: ((etat.stats || {}).forges || 0) + 1 },
  };
}
