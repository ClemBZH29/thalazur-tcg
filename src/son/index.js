/**
 * Le son du Donjon, pour le reste du site : une seule instance du moteur,
 * créée à la demande.
 *
 * Le contexte audio ne naît qu'au premier geste dans le Donjon (`activer`,
 * appelé sur un clic ou une touche) : avant, `jouer` et `musique` ne font
 * rien, et un navigateur qui refuse l'audio ne casse rien. Le réglage du
 * profil est retenu dès qu'il arrive, et appliqué à la création du contexte.
 */
import { BANQUE, FORCES } from "./banque.js";
import { SON_DEFAUT, creerMoteur } from "./moteur.js";

export { BANQUE, SON_DEFAUT };

let moteur = null, arme = false, musiqueVoulue = null;
let reglage = { ...SON_DEFAUT }, vit = 1, etg = 1;

const dossier = () => `${import.meta.env.BASE_URL || "/"}son/orchestre/`;
function m() {
  if (!moteur) {
    try {
      moteur = creerMoteur({ dossier: dossier() });
      moteur.regler(reglage); moteur.vitesse(vit); moteur.etage(etg);
    } catch { moteur = null; }
  }
  return moteur;
}
const sur = (f) => { try { return f(); } catch (e) { console.warn("Son indisponible", e); return 0; } };

/** Premier geste dans le Donjon : le contexte audio peut naître. */
export function activer() {
  if (typeof window === "undefined") return;
  arme = true;
  sur(() => { if (m()?.assurer() && musiqueVoulue) moteur.musique(musiqueVoulue); });
}

/**
 * Joue un bruitage de la banque. Options : `camp` ("adverse"), `force`
 * ("legere", "moyenne", "lourde"), `rarete` ("commune", "rare",
 * "legendaire") et `rainbow`, `densite`, `tr` (demi-tons), `revX`, `tour`
 * (brume), `arret` (nappe).
 */
export function jouer(id, options = {}) {
  if (!arme || reglage.coupe) return 0;
  const { force, ...o } = options;
  return sur(() => m()?.jouer(id, force ? { ...FORCES[force], ...o } : o) || 0);
}

/** La musique : "carte", "combat", "gardien", ou null pour l'arrêter. */
export function musique(cible, options = {}) {
  musiqueVoulue = cible || null;
  if (!arme) return;
  sur(() => m()?.musique(cible || null, options));
}

export const vitesse = (v) => { vit = v; sur(() => moteur?.vitesse(v)); };
export const etage = (e) => { etg = e; sur(() => moteur?.etage(e)); };
export const brume = (tour) => { if (arme) sur(() => m()?.brume(tour)); };
export const nappe = (milieu) => { if (arme) sur(() => m()?.nappe(milieu)); };

/** Le réglage du profil : { coupe, musique, effets } (pourcentages). */
export function regler(r = {}) {
  reglage = { ...SON_DEFAUT, ...reglage, ...r };
  sur(() => moteur?.regler(reglage));
}

export function arreterTout() {
  musiqueVoulue = null;
  sur(() => moteur?.arreterTout());
}

/** Les boutons « Écouter » du profil : un geste, donc le contexte peut naître. */
export function temoinMusique() { arme = true; sur(() => m()?.temoinMusique()); }
export function temoinEffets() { arme = true; return sur(() => m()?.jouer("donjon.capacite.soigneur")); }

/* ── Petits traducteurs, du jeu vers les options de la banque ─────────── */

/** La force d'une frappe, d'après ses dégâts (seuils de la table d'écoute). */
export const forceDe = (degats) => (degats <= 2 ? "legere" : degats <= 4 ? "moyenne" : "lourde");
/** La couche de rareté d'un palier de carte. */
export const rareteDe = (tier) => (tier === "legendaire" ? "legendaire" : tier === "rare" ? "rare" : "commune");
