/**
 * La phase du site à publier, pour le workflow de déploiement.
 *
 *   node scripts/etat-site.mjs >> "$GITHUB_ENV"
 *
 * écrit `VITE_SITE_ETAT=…` et, une fois ouvert, `VITE_SITE_OUVERTURE=…`.
 *
 * - l'étiquette Git `lancement` existe (posée par le workflow « Ouverture du
 *   site ») → ouvert, à la date de l'étiquette ;
 * - sinon, passé le 25/10/2026 à minuit → ferme (la page d'attente seule) ;
 * - sinon → beta.
 *
 * L'étiquette doit avoir été récupérée avant (`git fetch origin
 * refs/tags/lancement:refs/tags/lancement`) : le checkout n'en prend aucune.
 * Supprimer l'étiquette sur GitHub referme le site au déploiement suivant.
 */
import { execFileSync } from "node:child_process";
import { FERMETURE } from "../src/config/phases.js";

function dateEtiquette() {
  try {
    const d = execFileSync("git", ["for-each-ref", "--format=%(creatordate:iso-strict)", "refs/tags/lancement"],
      { encoding: "utf8" }).trim();
    return d || null;
  } catch { return null; }
}

const ouverture = dateEtiquette();
const etat = ouverture ? "ouvert" : Date.now() >= FERMETURE ? "ferme" : "beta";
console.log(`VITE_SITE_ETAT=${etat}`);
if (ouverture) console.log(`VITE_SITE_OUVERTURE=${ouverture}`);
console.error(`Phase publiée : ${etat}${ouverture ? ` (ouvert le ${ouverture})` : ""}`);
