import { TIER_ORDER } from "../config/tiers.js";
import { normaliserType } from "../config/cartes.js";

/**
 * Ordre des colonnes de la feuille « Liste ».
 * Les trois repères sont à des positions fixes, dans l'ordre d'affichage.
 */
export const COL = {
  num: 0, nom: 1,
  type: 2,      // pnj | artefact | lieu — vide vaut pnj
  palier: 3,    // commun | peu commun | rare | légendaire
  rep1: 4,      // archétype · rareté · province
  race: 5,      // PNJ seulement
  rep3: 6,      // faction · porteur ou localisation · type de lieu
  genre: 7,
  citation: 8,
};

/** Accepte les graphies courantes du palier saisi à la main. */
export function normaliserPalier(v) {
  const s = String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return null;
  if (s.startsWith("leg")) return "legendaire";
  if (s.startsWith("rar")) return "rare";
  if (s.startsWith("peu")) return "peucommun";
  if (s.startsWith("com")) return "commun";
  return null;
}

/** Repères qui valent légendaire quelle que soit leur fréquence. */
export const HAUTS_GRADES = ["commandant", "bras droit", "conseiller", "conseillère",
  "capitaine", "souverain"];

export const slug = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function urlDansLigne(r) {
  for (const cell of r) {
    const v = String(cell ?? "").trim();
    if (/^https?:\/\//i.test(v)) return v;
  }
  return null;
}

/**
 * Déduit le palier de chaque grade depuis sa fréquence dans le roster.
 * Un grade porté par moins de 2 % de la troupe est rare, moins de 12 %
 * peu commun, le reste commun. Les hauts grades sont forcés en légendaire.
 * Corrigeable à la main dans les réglages.
 */
export function deduireGrades(rows) {
  const counts = new Map();
  rows.forEach((r) => {
    const g = String(r[COL.rep1] ?? "").trim() || "Sans repère";
    counts.set(g, (counts.get(g) || 0) + 1);
  });
  const total = rows.length || 1;
  const map = {};
  for (const [grade, n] of counts) {
    const low = grade.toLowerCase().trim();
    if (HAUTS_GRADES.some((h) => low.startsWith(h))) {
      map[grade] = "legendaire";
      continue;
    }
    const part = n / total;
    map[grade] = part < 0.02 ? "rare" : part < 0.12 ? "peucommun" : "commun";
  }
  return map;
}

export function construirePool(rows, gradeTiers) {
  const pool = { commun: [], peucommun: [], rare: [], legendaire: [] };
  rows.forEach((r, i) => {
    const grade = String(r[COL.rep1] ?? "").trim() || "Sans grade";
    const tier = normaliserPalier(r[COL.palier]) || gradeTiers[grade] || "commun";
    const nom = String(r[COL.nom] ?? "Sans nom").trim();
    pool[tier].push({
      id: `${r[COL.num] ?? i}-${slug(nom)}`,
      num: r[COL.num] ?? i + 1,
      nom,
      slug: slug(nom),
      race: String(r[COL.race] ?? "").trim(),
      genre: String(r[COL.genre] ?? "").trim(),
      type: normaliserType(r[COL.type]),
      rep1: grade,
      rep3: String(r[COL.rep3] ?? "").trim(),
      citation: String(r[COL.citation] ?? "").trim(),
      urlLigne: urlDansLigne(r),
      tier,
    });
  });
  return pool;
}

export function compterGrades(rows) {
  const m = new Map();
  rows.forEach((r) => {
    const g = String(r[COL.rep1] ?? "").trim() || "Sans repère";
    m.set(g, (m.get(g) || 0) + 1);
  });
  return Array.from(m.entries()).sort((a, b) => a[1] - b[1]);
}

export const meilleur = (cards) =>
  cards.reduce((a, b) => (TIER_ORDER.indexOf(b.tier) > TIER_ORDER.indexOf(a.tier) ? b : a));
