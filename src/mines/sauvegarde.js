import { SCHEMA, migrer } from "../lib/sauvegarde/schema.js";

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
  n.schema = SCHEMA;
  return n;
}
