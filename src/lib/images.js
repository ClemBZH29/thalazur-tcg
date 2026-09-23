/**
 * Trois sources en cascade. La première qui répond gagne :
 *   1. fichiers montés depuis le disque (appariés par numéro ou par nom translittéré)
 *   2. URL trouvée dans la ligne du roster
 *   3. motif d'URL construit depuis une base
 * Sans rien, la carte retombe sur un monogramme gravé.
 */
export function resoudreImage(c, cfg, fichiers) {
  if (fichiers && fichiers.size) {
    const hit = fichiers.get(String(c.num)) || fichiers.get(c.slug);
    if (hit) return hit;
  }
  if (c.urlLigne) return c.urlLigne;
  if (cfg.base && cfg.motif) {
    return (
      cfg.base.replace(/\/+$/, "") +
      "/" +
      cfg.motif
        .replace("{num}", String(c.num))
        .replace("{slug}", c.slug)
        .replace("{nom}", encodeURIComponent(c.nom))
    );
  }
  return null;
}

export const CFG_IMAGE_DEFAUT = { focal: 30, base: "./portraits", motif: "{num}.jpg" };
