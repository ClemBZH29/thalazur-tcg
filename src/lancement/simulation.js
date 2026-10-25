/**
 * Simulation de la remise à zéro du lancement, pour le développement
 * (`npm run dev`, réglages MJ). Elle applique à la partie de ce navigateur
 * exactement ce que fera la migration 11 (`remiseLancement`), sans changer
 * de format : on voit l'avis, le dos de l'Éclaireur, le profil remis, puis
 * on restaure la partie d'avant.
 *
 * La partie, la mine et la copie de secours sont gardées avant la remise
 * dans une clé à part ; la restauration les remet telles quelles.
 */
import { remiseLancement } from "../lib/sauvegarde/lancement.js";
import { CLE_SECOURS, lireMine, relireJeu } from "../lib/storage.js";
import { SCHEMA } from "../lib/sauvegarde/schema.js";

export const CLE_SIMULATION = "brume-thalazur:simulation-lancement";

/** La sauvegarde d'avant simulation, ou `null`. */
export function lireSimulation() {
  try {
    const s = JSON.parse(localStorage.getItem(CLE_SIMULATION));
    return s && s.jeu ? s : null;
  } catch { return null; }
}

/**
 * Garde la partie puis rend la partie remise. `commeBeta` : une partie qui
 * n'a encore rien ouvert est traitée comme celle d'un bêta-testeur (sinon
 * la vraie remise ne lui donne ni dos ni avis, et il n'y aurait rien à voir).
 */
export function simulerRemise(etat, { commeBeta = true } = {}) {
  // Une simulation déjà en cours garde la partie d'origine, pas la partie remise.
  if (!lireSimulation()) {
    localStorage.setItem(CLE_SIMULATION, JSON.stringify({
      t: Date.now(), jeu: etat, mine: lireMine(), secours: localStorage.getItem(CLE_SECOURS),
    }));
  }
  const source = commeBeta && !Object.values(etat.boosters || {}).some((n) => n > 0)
    ? { ...etat, boosters: { ...(etat.boosters || {}), simulation: 1 } }
    : etat;
  return relireJeu({ ...remiseLancement(source), schema: SCHEMA });
}

/** Rend `{ jeu, mine }` d'avant la simulation et efface la sauvegarde, ou `null`. */
export function restaurerSimulation() {
  const s = lireSimulation();
  if (!s) return null;
  const jeu = relireJeu(s.jeu);
  if (!jeu) return null;
  try {
    if (s.secours) localStorage.setItem(CLE_SECOURS, s.secours);
    localStorage.removeItem(CLE_SIMULATION);
  } catch { /* stockage refusé */ }
  return { jeu, mine: s.mine ?? null };
}
