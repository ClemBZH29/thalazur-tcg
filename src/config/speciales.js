import { slug } from "../lib/roster.js";

/**
 * Cartes hors roster. Elles ne sortent pas des tables d'emplacement mais d'un
 * tirage propre au booster entier, résolu avant tout le reste.
 *
 * Les full art sont propres à une extension et déclarés dans son dossier
 * (src/extensions/<id>/extension.js) : une chance sur 4096 par booster.
 * Les PJ traversent toutes les extensions : une chance sur 8192.
 */

export const PJ = [
  { nom: "Siobhan" },
  { nom: "Karhu" },
  { nom: "Jean-Claude" },
  { nom: "Lodan" },
  { nom: "Kazeda" },
];

/**
 * Met une définition au format attendu par le reste de l'application.
 * `num` reprend l'identifiant pour que la cascade de résolution d'image
 * fonctionne à l'identique : un fichier vyrin-maid-cafe.jpg sera trouvé.
 */
function normaliser(def, tier, prefixe) {
  const complet = def.serie ? `${def.nom} ${def.serie}` : def.nom;
  const s = slug(complet);
  return {
    id: `${prefixe}-${s}`,
    num: `${prefixe}-${s}`,
    nom: def.nom,
    serie: def.serie || null,
    slug: s,
    race: "", genre: "", corps: "", grade: "", metier: "", anecdote: "",
    urlLigne: null,
    tier,
  };
}

/** Les cartes hors roster d'une extension : ses full art, et les PJ communs. */
export function specialesPour(extension) {
  return {
    fullart: (extension?.fullart || []).map((d) => normaliser(d, "fullart", "fa")),
    pj: PJ.map((d) => normaliser(d, "pj", "pj")),
  };
}

/** Nom complet, utilisé partout où la carte doit être identifiée. */
export const nomComplet = (c) => (c.serie ? `${c.nom} — ${c.serie}` : c.nom);
