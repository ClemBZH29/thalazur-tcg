/**
 * Types de cartes.
 *
 * Les trois repères occupent des colonnes fixes, dans l'ordre où ils
 * s'affichent, et ne changent plus de sens selon le type :
 *
 *   E  archétype (PNJ) · rareté (Artéfact) · province (Lieu)
 *   F  race — PNJ seulement, vide ailleurs
 *   G  faction (PNJ) · porteur ou localisation (Artéfact) · type de lieu (Lieu)
 *
 * D'où une règle unique : on lit les trois colonnes et on écarte les vides.
 * PNJ donne trois segments, Artéfact et Lieu en donnent deux.
 */
export const TYPES = {
  pnj: { nom: "PNJ" },
  artefact: { nom: "Artéfact" },
  lieu: { nom: "Lieu" },
};

/** Tolérant sur l'orthographe : le fichier est saisi à la main. */
export function normaliserType(v) {
  const s = String(v ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim();
  if (!s) return "pnj";
  if (s.startsWith("art") || s.startsWith("obj")) return "artefact";
  if (s.startsWith("lieu") || s.startsWith("loc")) return "lieu";
  return "pnj";
}

export const reperesDe = (c) =>
  [c.rep1, c.race, c.rep3].map((x) => String(x ?? "").trim()).filter(Boolean);

export const nomType = (c) => (TYPES[c.type] || TYPES.pnj).nom;
