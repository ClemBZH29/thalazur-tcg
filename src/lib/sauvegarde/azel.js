/**
 * La remise des Mines par Azel le Destructeur (format 12, 27/10/2026).
 *
 * Décision de Clément : après le rééquilibrage des Mines, toute partie qui a
 * joué aux Mines repart de la galerie d'entrée, avec les succès qui en
 * découlent, et voit un écran obligatoire où Azel l'annonce
 * (`src/remise/AvisAzel.jsx`, textes dans `src/config/remises.js`).
 *
 * Comme la remise du lancement, elle se fait **à la lecture** : c'est une
 * migration, par laquelle passent toutes les copies de la partie. Fonctions
 * pures, sans import du stockage.
 *
 * ── Ce qui part ──────────────────────────────────────────────────────────
 * - La mine entière (étoile, compagnons, chantier, talents, éclats, faveurs,
 *   record) : `remiseMineAzel` rend une galerie neuve.
 * - Les succès mesurés sur la mine : strate, effondrements, faveurs. Ils se
 *   regagnent avec leurs récompenses — c'est la seule compensation, et elle
 *   suit l'effort à refaire. Le titre affiché part s'il venait de l'un d'eux.
 *
 * ── Ce qui reste ─────────────────────────────────────────────────────────
 * - Les commandes livrées et leurs succès : ils se mesurent sur
 *   `stats.commandes`, un compteur du site que les missions de Bodégué lisent
 *   aussi (une mission du jour part d'une valeur de départ : remettre le
 *   compteur à zéro la rendrait impossible jusqu'au lendemain).
 * - La marque des Mines (`etat.mine` : règles payées, livraisons du jour).
 * - Les conseils de Tafix et les onglets déjà ouverts.
 */
import { REMISE_MINES } from "../../config/remises.js";

/** Les familles de succès mesurées sur la sauvegarde de la mine. */
export const FAMILLES_MINES = ["strate", "effondrements", "faveurs"];
const deLaMine = (id) => FAMILLES_MINES.some((f) => String(id).startsWith(f + "@"));

/**
 * La partie a-t-elle joué aux Mines depuis le lancement ? On ne voit pas la
 * mine d'ici (elle se sauvegarde à part) : on lit ce qu'elle a laissé dans
 * la partie.
 *
 * Un bêta-testeur pas encore revenu passe par le format 11 dans la même
 * lecture : sa partie vient d'être remise, mais les conseils de Tafix de la
 * bêta y restent. Pour lui, seuls comptent ce que la remise du lancement
 * efface — succès et compteurs — : s'il en a, c'est qu'il a joué depuis, sur
 * un autre appareil, et la fusion avec le compte les apporte.
 */
export function aJoueAuxMines(d) {
  if (!d || typeof d !== "object") return false;
  if (Object.keys(d.succes || {}).some(deLaMine)) return true;
  const stats = d.stats || {};
  if ((stats.commandes || 0) > 0 || (stats.poMine || 0) > 0) return true;
  const beta = d.lancement && typeof d.lancement === "object" && d.lancement.beta === true;
  const vus = Array.isArray(d.tafix?.vus) ? d.tafix.vus : [];
  return !beta && vus.includes("filon1");
}

/** Partie du jeu, format 11 → 12. */
export function remiseJeuAzel(d) {
  if (!d || typeof d !== "object") return d;
  const joue = aJoueAuxMines(d);
  const succes = Object.fromEntries(Object.entries(d.succes || {}).filter(([id]) => !deLaMine(id)));
  const profil = d.profil && typeof d.profil === "object" ? { ...d.profil } : d.profil;
  if (profil && deLaMine(profil.titre)) delete profil.titre;
  const sortie = { ...d, succes };
  if (profil !== undefined) sortie.profil = profil;
  if (joue) sortie.azel = { ...(d.azel && typeof d.azel === "object" ? d.azel : {}), [REMISE_MINES]: "a-lire" };
  return sortie;
}

/** Mine des Mines de Kazim, format 11 → 12 : une galerie neuve, sans solde. */
export function remiseMineAzel() {
  return {};
}
