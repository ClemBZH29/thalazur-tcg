/**
 * Trois sources en cascade. La première qui répond gagne :
 *   1. fichiers montés depuis le disque (appariés par numéro ou par nom translittéré)
 *   2. URL trouvée dans la ligne du roster
 *   3. motif d'URL construit depuis une base
 * Sans rien, la carte retombe sur un monogramme gravé.
 *
 * Pour la troisième source, l'inventaire publié avec les portraits
 * (`inventaire.json`, écrit par `npm run portraits`) dit quelles images
 * existent : une carte absente de l'inventaire passe directement au
 * monogramme, sans requête vouée au 404. Voir docs/conception/roster-et-portraits.md.
 */

/**
 * Où vivent les portraits. En production, un site Firebase Hosting à part
 * (`VITE_PORTRAITS_BASE`), publié à la main, pour que les illustrations ne
 * passent jamais par le dépôt public ; en développement, `public/portraits/`,
 * rempli par le même script et ignoré par Git.
 */
export const BASE_PORTRAITS =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_PORTRAITS_BASE) || "./portraits";

export const CFG_IMAGE_DEFAUT = {
  focal: 30,
  base: BASE_PORTRAITS,
  motif: "{dossier}/{num}{taille}.webp",
};

/** Suffixe de la vignette : moitié de la taille, pour la bibliothèque. */
export const SUFFIXE_VIGNETTE = "-v";

/** L'inventaire n'est pas encore arrivé : on attend plutôt que de deviner. */
export const INVENTAIRE_EN_COURS = "chargement";

/**
 * Le dossier d'une carte. Les PJ sont communs à toutes les extensions : ils ont
 * le leur, pour ne pas être dessinés quatre fois.
 */
export const dossierDe = (c, extension) => (String(c.num).startsWith("pj-") ? "pj" : extension);

/**
 * @param c         la carte
 * @param cfg       { base, motif, extension, inventaire }
 *                  inventaire : objet publié, INVENTAIRE_EN_COURS, ou null si
 *                  introuvable (on tente alors l'image, le monogramme rattrape l'échec)
 * @param fichiers  images montées depuis le disque (Réglages MJ)
 * @param options   { vignette } : la version légère, pour les petites cartes
 */
export function resoudreImage(c, cfg, fichiers, { vignette = false } = {}) {
  if (fichiers && fichiers.size) {
    const hit = fichiers.get(String(c.num)) || fichiers.get(c.slug);
    if (hit) return hit;
  }
  if (c.urlLigne) return c.urlLigne;
  if (!cfg.base || !cfg.motif) return null;

  const dossier = dossierDe(c, cfg.extension || "");
  let version = null;
  if (cfg.inventaire === INVENTAIRE_EN_COURS) return null;
  if (cfg.inventaire) {
    version = cfg.inventaire.portraits?.[dossier]?.[String(c.num)];
    if (!version) return null;
  }

  const url =
    cfg.base.replace(/\/+$/, "") +
    "/" +
    cfg.motif
      .replace("{dossier}", dossier)
      .replace("{extension}", cfg.extension || "")
      .replace("{num}", String(c.num))
      .replace("{slug}", c.slug)
      .replace("{nom}", encodeURIComponent(c.nom))
      .replace("{taille}", vignette ? SUFFIXE_VIGNETTE : "");
  // La version change quand l'image change : le navigateur peut la garder un
  // an sans jamais montrer une illustration retouchée en retard.
  return version ? `${url}?v=${version}` : url;
}
