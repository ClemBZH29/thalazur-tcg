import { SCHEMA, migrer } from "../lib/sauvegarde/schema.js";
import { eclatsMerites } from "./regles.js";

/**
 * Mines de Kazim — la partie sauvegardée.
 *
 * Le format suit le schéma commun du site (`src/lib/sauvegarde/schema.js`) :
 * un champ qui change de sens passe par une migration là-bas, un champ
 * ajouté reçoit simplement sa valeur par défaut ici.
 */
export function etatNeuf() {
  return {
    schema: SCHEMA,
    etoile: 0, etoileTotale: 0, poGagnes: 0,
    profondeur: 1, profondeurMax: 1, brises: {}, brisesTotal: 0,
    /* 0 ordinaire · 1 généreux (×4) · 2 exceptionnel (×12). Tiré à la
       naissance du filon et non à sa rupture : voir `nouveauFilon`. */
    pv: 0, pvMax: 0, filonRang: 0,
    niveau: 1, xp: 0, points: 0,
    talents: { force: 0, echo: 0, discipline: 0, fortune: 0 },
    compagnons: {}, equipement: [],
    eclats: 0, echanges: 0, effondrements: 0,
    poRun: 0, resonance: 0, poJour: 0, jourT: Date.now(),
    cours: 1, coursT: 0,
    dernierTick: Date.now(),
  };
}

/**
 * Relit une sauvegarde (chaîne JSON) : migrée, complétée des champs ajoutés
 * depuis, ou `null` si elle est illisible ou d'un format incompatible.
 * Seuls les champs connus sont repris : une clé inattendue est ignorée.
 */
export function relireMine(brut) {
  let d = null;
  try { d = brut ? JSON.parse(brut) : null; } catch { return null; }
  d = migrer("mine", d);
  if (!d) return null;
  const n = etatNeuf();
  Object.keys(n).forEach((k) => { if (d[k] !== undefined && d[k] !== null) n[k] = d[k]; });
  /* Les éclats ne dépassent jamais ce que l'étoile cumulée autorise. Sous la
     règle en vigueur c'est vrai par construction, et cette ligne ne touche à
     rien ; elle ramène les parties jouées sous l'ancienne règle (racine carrée,
     voir `regles.js`) à ce que la nouvelle leur aurait donné. C'est un
     invariant, pas une migration : le sens du champ n'a pas changé, et monter
     `SCHEMA` ferait lire comme vide toute copie de compte encore au n° 6
     (`lireCompte` exige l'égalité stricte). Une étoile cumulée infinie sort du
     JSON en `null`, reprend sa valeur par défaut, et ne donne droit à rien. */
  if (!Number.isFinite(n.etoileTotale)) n.etoileTotale = 0;
  n.eclats = Math.min(Number.isFinite(n.eclats) ? n.eclats : 0, eclatsMerites(n));
  n.schema = SCHEMA;
  return n;
}
