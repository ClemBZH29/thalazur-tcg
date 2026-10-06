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

/**
 * La famille sonore d'un artéfact, d'après la mécanique de son premier
 * effet (voir pouvoirs.js) : offensif, protecteur, soin ou utilitaire.
 */
const FAMILLES = {
  offensif: ["atq", "crit", "execution", "chasseur", "ouverture", "saignement", "marque", "epines", "vengeance", "tempo"],
  protecteur: ["pv", "armure", "rempartDebut", "esquive", "gardien", "dernierRempart"],
  soin: ["soin", "drain", "regen", "finCombat", "releve"],
};
export function familleArtefact(effets = []) {
  const mec = effets[0]?.mec;
  return Object.keys(FAMILLES).find((f) => FAMILLES[f].includes(mec)) || "utilitaire";
}

/**
 * Le milieu d'un lieu, pour sa nappe : lu dans son type (troisième repère)
 * et son nom. Ce que les données ne disent pas reste « neutre ».
 */
export function milieuDe(lieu) {
  if (!lieu) return "neutre";
  const s = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const type = s(lieu.rep3), nom = s(lieu.nom);
  if (/mine|grotte|caverne|gouffre|prison|cachot|souterrain|crypte/.test(nom)) return "souterrain";
  if (/port|plage|lac|riviere|fleuve|mer\b|cote|rivage|quai|anse/.test(nom) || type.includes("cotier")) return "cote";
  if (/desert|steppe|dune|sable/.test(nom)) return "desert";
  if (/foret|bois|marais|jungle|sylve|bosquet/.test(nom)) return "foret";
  if (/capitale|palais|temple|village|verne|militaire|service|cite|ville/.test(type)) return "cite";
  return "neutre";
}
