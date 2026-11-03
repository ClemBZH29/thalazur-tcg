import { BOOSTERS } from "../../extensions/index.js";
import { DOTATION_APERCU } from "../../config/apercu.js";
import { TIERS_ROSTER } from "../../config/tiers.js";
import { construirePool, deduireGrades } from "../roster.js";

/**
 * La dotation de l'aperçu (voir src/config/apercu.js) : une seule fois par
 * partie, marquée par `apercuDote`. Pure : rend un nouvel état.
 * `boosters` : les extensions (par défaut celles du site), pour les tests.
 */
export function doterApercu(etat, { exemplaires, vestiges } = DOTATION_APERCU, boosters = BOOSTERS) {
  if (etat.apercuDote) return etat;
  const collections = { ...(etat.collections || {}) };
  for (const b of boosters) {
    if (b.statut !== "ouvert" || !b.roster) continue;
    const pool = construirePool(b.roster.lignes, deduireGrades(b.roster.lignes));
    const coll = { ...(collections[b.id] || {}) };
    for (const t of TIERS_ROSTER) {
      for (const c of pool[t.id] || []) {
        const a = coll[c.id] || { normale: 0, rainbow: 0 };
        coll[c.id] = { ...a, normale: Math.max(a.normale || 0, exemplaires), carte: a.carte || c };
      }
    }
    collections[b.id] = coll;
  }
  const reliquaire = { vestiges: 0, ...(etat.reliquaire || {}) };
  return {
    ...etat,
    collections,
    reliquaire: { ...reliquaire, vestiges: Math.max(reliquaire.vestiges || 0, vestiges) },
    apercuDote: true,
  };
}
