/**
 * Le Reliquaire : règles pures.
 *
 * Il dissout les exemplaires en trop en vestiges (depuis la bibliothèque),
 * et forge chaque jour une seule carte, la même pour tous (`offreDuJour`).
 * Deux garde-fous, tenus ici plutôt qu'à l'écran :
 *
 * - le dernier exemplaire d'une carte ne se dissout jamais ;
 * - full art et cartes de personnage restent hors du Reliquaire, et l'on ne
 *   dissout que des exemplaires normaux.
 *
 * Les vestiges vivent dans `etat.reliquaire.vestiges` ; le jour de la
 * dernière forge, par extension, dans `etat.reliquaire.achats`.
 */
import { RELIQUAIRE } from "../config/reliquaire.js";

export const PALIERS = ["commun", "peucommun", "rare", "legendaire"];

export const etatReliquaire = (etat) => ({ vestiges: 0, achats: {}, ouvert: null, ...(etat.reliquaire || {}) });
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

/* ── La carte du jour ─────────────────────────────────────────────────── */

/** Graine tirée d'une chaîne (FNV-1a), puis générateur mulberry32. */
function graineDe(texte) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) { h ^= texte.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
export function alea(texte) {
  let a = graineDe(texte);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Jour local, AAAA-MM-JJ : le Reliquaire change de carte à minuit. */
export const jourDe = (t = Date.now()) => new Date(t).toLocaleDateString("sv");

/**
 * Ce que vaut un palier dans un booster : le nombre moyen de cartes de ce
 * palier par sachet, lu dans la table des emplacements.
 */
export function frequences(slots) {
  const f = Object.fromEntries(PALIERS.map((t) => [t, 0]));
  for (const s of slots) for (const [t, p] of Object.entries(s)) if (t in f) f[t] += p;
  return f;
}

/**
 * La carte du jour d'une extension. Même jour, même extension : même carte,
 * pour tout le monde — rien ne dépend de la collection du joueur.
 *
 * Chaque carte pèse ce qu'elle pèse dans un booster : la fréquence de son
 * palier, partagée entre les cartes de ce palier. Puis l'irisation, au taux
 * du booster.
 */
export function offreDuJour(ext, cartes, jour, { slots, tauxRainbow }) {
  const r = alea(`reliquaire:${ext}:${jour}`);
  const elig = cartes.filter(eligible);
  if (!elig.length) return null;
  const f = frequences(slots);
  const parPalier = Object.fromEntries(PALIERS.map((t) => [t, elig.filter((c) => c.tier === t).length]));
  const poids = elig.map((c) => f[c.tier] / parPalier[c.tier]);
  let x = r() * poids.reduce((a, b) => a + b, 0);
  let i = 0;
  while (i < elig.length - 1 && (x -= poids[i]) > 0) i++;
  const c = elig[i];
  const rainbow = r() < tauxRainbow;
  return { ext, jour, c, rainbow, prix: prixOffre(c, rainbow) };
}

export const prixOffre = (c, rainbow) =>
  RELIQUAIRE.forge[c.tier] * (rainbow ? RELIQUAIRE.multRainbow : 1);

/** Déjà forgée aujourd'hui ? Une seule par jour et par extension. */
export const offrePrise = (etat, offre) =>
  !!offre && etatReliquaire(etat).achats?.[offre.ext] === offre.jour;

export const peutForgerOffre = (etat, offre) =>
  !!offre && !offrePrise(etat, offre) && vestiges(etat) >= offre.prix;

/**
 * Forge la carte du jour. On peut la forger même si on la possède : elle
 * s'ajoute aux exemplaires (ou à la case irisée). Pas de cycle possible : la
 * dissoudre rend le dixième de son prix.
 */
export function forgerOffre(etat, offre) {
  if (!peutForgerOffre(etat, offre)) return etat;
  const { ext, c, rainbow, prix } = offre;
  const R = etatReliquaire(etat);
  const coll = { ...(etat.collections?.[ext] || {}) };
  const { ext: _e, rainbow: _r, slot: _s, ...carte } = c;
  const e = coll[c.id] || { normale: 0, rainbow: 0 };
  coll[c.id] = rainbow
    ? { ...e, rainbow: (e.rainbow || 0) + 1, carte: e.carte || carte }
    : { ...e, normale: (e.normale || 0) + 1, carte: e.carte || carte };
  return {
    ...etat,
    collections: { ...etat.collections, [ext]: coll },
    reliquaire: { ...R, vestiges: R.vestiges - prix, achats: { ...(R.achats || {}), [ext]: offre.jour } },
    stats: { ...(etat.stats || {}), forges: ((etat.stats || {}).forges || 0) + 1 },
  };
}
