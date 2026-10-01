/**
 * La fiche de combat d'une carte : ce que le joueur a acheté pour elle.
 *
 * Quatre lignes se modifient, toutes depuis la carte agrandie de la
 * bibliothèque (volet « Combat ») :
 *
 * - **ATQ** et **INI** : trois rangs chacun, +1 par rang, payés en vestiges ;
 * - **compétence 1** (le geste, sans recharge) et **compétence 2** (la
 *   technique) : on en choisit une autre dans COMPETENCES, contre des
 *   vestiges ; moitié prix si elle est naturelle au rôle, gratuit pour
 *   revenir à celle d'origine.
 *
 * Chaque ligne peut enfin être **étoilée** contre un exemplaire rainbow en
 * trop de la carte (la dernière rainbow reste dans la collection). Une ligne
 * étoilée est figée et gagne un bonus fort (ETOILE, regles.js) ; quatre
 * lignes étoilées et la carte porte l'étoile dans la collection. Les rainbow
 * tombent au même taux pour toutes les cartes : une commune, dont on ouvre
 * bien plus d'exemplaires, s'étoile plus vite qu'une légendaire.
 *
 * Rangée dans `etat.fiches["extension:carte"]` :
 * `{ atq, ini, geste, tech, etoiles: { atq, ini, geste, tech } }`, chaque
 * champ absent valant l'origine. Fonctions pures : elles rendent un nouvel
 * état, ou null si l'opération n'est pas permise.
 */
import { PERSONNALISATION as P } from "../config/reliquaire.js";
import { cleXP } from "./experience.js";
import { COMPETENCES, ROLES, roleDe } from "./regles.js";

export const LIGNES = ["atq", "ini", "geste", "tech"];
export const RANG_MAX = P.rangs.length;

export const ficheDe = (etat, c) => etat.fiches?.[cleXP(c)] || {};
export const etoiles = (f) => LIGNES.filter((l) => f.etoiles?.[l]).length;
/** Les quatre lignes étoilées : la carte porte l'étoile dans la collection. */
export const etoilee = (f) => etoiles(f) === LIGNES.length;

const entree = (etat, c) => etat.collections?.[c.ext]?.[c.id] || {};
export const possedee = (etat, c) => (entree(etat, c).normale || 0) > 0;
/** Les rainbow de la carte au-delà de la première, qui ne se sacrifie jamais. */
export const rainbowEnTrop = (etat, c) => Math.max(0, (entree(etat, c).rainbow || 0) - 1);
const vestigesDe = (etat) => etat.reliquaire?.vestiges || 0;

export const origine = (c, place) => (place === "geste" ? "attaque" : ROLES[roleDe(c.rep1)].tech);
export const competenceDe = (c, f, place) => {
  const id = f[place];
  return COMPETENCES[id]?.place === place ? id : origine(c, place);
};
/** Les compétences d'un emplacement : l'origine, celles du rôle, les autres, les réservées. */
export function catalogue(c, place) {
  const role = roleDe(c.rep1);
  return Object.values(COMPETENCES)
    .filter((k) => k.place === place)
    .sort((a, b) => (b.id === origine(c, place)) - (a.id === origine(c, place))
      || permise(c, b.id) - permise(c, a.id)
      || b.roles.includes(role) - a.roles.includes(role));
}
export const naturelle = (c, id) => COMPETENCES[id]?.roles.includes(roleDe(c.rep1)) || false;
/** Une compétence réservée (les soins) n'est ouverte qu'aux rôles qui la portent. */
export const permise = (c, id) => !!COMPETENCES[id] && (!COMPETENCES[id].reservee || naturelle(c, id) || id === origine(c, COMPETENCES[id].place));

/** Le prix du prochain rang d'ATQ ou d'INI, ou null s'il n'y en a plus. */
export function coutRang(f, ligne) {
  const r = f[ligne] || 0;
  return f.etoiles?.[ligne] || r >= RANG_MAX ? null : P.rangs[r];
}
/** Le prix pour passer à la compétence `id` sur son emplacement. */
export function coutCompetence(c, id) {
  const K = COMPETENCES[id];
  if (!K || !permise(c, id)) return null;
  if (id === origine(c, K.place)) return 0;
  return Math.round(P[K.place] * (naturelle(c, id) ? P.affinite : 1));
}

const payer = (etat, cout) => ({ ...etat, reliquaire: { ...(etat.reliquaire || {}), vestiges: vestigesDe(etat) - cout } });
const ecrire = (etat, c, f) => ({ ...etat, fiches: { ...(etat.fiches || {}), [cleXP(c)]: f } });

export function acheterRang(etat, c, ligne) {
  if (!["atq", "ini"].includes(ligne) || !possedee(etat, c)) return null;
  const f = ficheDe(etat, c);
  const cout = coutRang(f, ligne);
  if (cout == null || vestigesDe(etat) < cout) return null;
  return ecrire(payer(etat, cout), c, { ...f, [ligne]: (f[ligne] || 0) + 1 });
}

export function changerCompetence(etat, c, id) {
  const K = COMPETENCES[id];
  if (!K || !possedee(etat, c)) return null;
  const f = ficheDe(etat, c);
  if (f.etoiles?.[K.place] || competenceDe(c, f, K.place) === id) return null;
  const cout = coutCompetence(c, id);
  if (cout == null || vestigesDe(etat) < cout) return null;
  const g = { ...f };
  if (id === origine(c, K.place)) delete g[K.place];
  else g[K.place] = id;
  return ecrire(payer(etat, cout), c, g);
}

/** Étoile une ligne : une rainbow en trop de la carte sort de la collection. */
export function etoiler(etat, c, ligne) {
  if (!LIGNES.includes(ligne) || !possedee(etat, c) || rainbowEnTrop(etat, c) < 1) return null;
  const f = ficheDe(etat, c);
  if (f.etoiles?.[ligne]) return null;
  const e = entree(etat, c);
  const coll = { ...(etat.collections?.[c.ext] || {}), [c.id]: { ...e, rainbow: e.rainbow - 1 } };
  return ecrire({ ...etat, collections: { ...etat.collections, [c.ext]: coll } }, c,
    { ...f, etoiles: { ...(f.etoiles || {}), [ligne]: true } });
}

/** La fiche porte-t-elle quelque chose (rang, compétence, étoile) ? `remise` n'en est pas. */
export const modifiee = (f) => Object.keys(f).some((k) => k !== "remise" && (k !== "etoiles" || etoiles(f) > 0));

/**
 * STAR RESET : la fiche revient à l'origine (rangs, compétences, étoiles),
 * contre **tous** les exemplaires de la carte, normales et rainbow, comme si
 * on ne l'avait jamais eue : l'expérience repart de zéro, paliers payés
 * compris (irisation, niveau 100). Les vestiges dépensés ne sont pas rendus.
 *
 * `remise` date l'opération : sans elle, la fusion entre appareils
 * reprendrait les rangs et les étoiles de l'autre côté (voir fusionnerFiches).
 */
export function resetStar(etat, c, maintenant = Date.now()) {
  const e = entree(etat, c);
  if (!possedee(etat, c) || !modifiee(ficheDe(etat, c))) return null;
  const coll = { ...(etat.collections?.[c.ext] || {}), [c.id]: { ...e, normale: 0, rainbow: 0 } };
  const xp = { ...(etat.xp || {}), [cleXP(c)]: { xp: 0, remise: maintenant } };
  return ecrire({ ...etat, collections: { ...etat.collections, [c.ext]: coll }, xp }, c, { remise: maintenant });
}

/** Les fiches de toute une équipe, pour `creerPartie`. */
export const fichesDe = (etat, cartes) => Object.fromEntries(cartes.map((c) => [cleXP(c), ficheDe(etat, c)]));
