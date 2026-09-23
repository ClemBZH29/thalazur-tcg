#!/usr/bin/env node
/**
 * Convertit le classeur d'une extension en JSON exploitable par l'application.
 *
 *   npm run roster -- "La_Troupe.xlsx" troupe-valeran
 *
 * ── Le classeur ───────────────────────────────────────────────────────────
 * Un onglet par type de carte, chacun avec ses propres colonnes :
 *
 *   PNJ        N° · Identifiant · Palier · Génération OK · Nom · Faction ·
 *              Archétype · Race · Citation · Style · …
 *   Lieux      N° · Identifiant · Palier · Génération OK · Nom · Localisation ·
 *              Type · Citation · Style · …
 *   Artéfacts  N° · Identifiant · Palier · Nom · Possesseur ou Localisation ·
 *              Type · Citation · Style · …
 *
 * Le type de la carte est porté par l'onglet, jamais par une colonne — c'est
 * la règle posée dans la notice du classeur, et c'est elle qui permet aux
 * trois onglets d'avoir des en-têtes différents sans ambiguïté.
 *
 * ── Le JSON ───────────────────────────────────────────────────────────────
 * L'application lit des lignes à colonnes fixes (voir COL dans
 * src/lib/roster.js), dans l'ordre où les repères s'affichent sur la carte :
 *
 *   0 numéro · 1 nom · 2 type · 3 palier
 *   4 repère 1 — archétype (PNJ) · localisation (Lieu) · type (Artéfact)
 *   5 race — PNJ seulement
 *   6 repère 3 — faction (PNJ) · type de lieu (Lieu) · possesseur (Artéfact)
 *   7 genre · 8 citation
 *
 * Le classeur ne porte pas le genre : la colonne reste vide, et la carte
 * n'affiche simplement pas cette mention.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import * as XLSX from "xlsx";

const [entree, id] = process.argv.slice(2);
if (!entree) {
  console.error("Usage : npm run roster -- <fichier.xlsx> [identifiant]");
  process.exit(1);
}

const chemin = resolve(entree);
const wb = XLSX.read(readFileSync(chemin), { type: "buffer" });

/** Les trois onglets, et ce que chacun met dans les colonnes de repères. */
const ONGLETS = [
  { feuille: "PNJ", type: "pnj", rep1: "Archétype", race: "Race", rep3: "Faction" },
  { feuille: "Lieux", type: "lieu", rep1: "Localisation", race: null, rep3: "Type" },
  { feuille: "Artéfacts", type: "artefact", rep1: "Type", race: null,
    rep3: "Possesseur ou Localisation" },
];

const propre = (v) => String(v ?? "").trim();

/** Lit un onglet et rend ses lignes au format de l'application. */
function lireOnglet({ feuille, type, rep1, race, rep3 }) {
  const ws = wb.Sheets[feuille];
  if (!ws) {
    console.warn(`  onglet « ${feuille} » absent, ignoré`);
    return [];
  }
  const brut = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
  if (!brut.length) return [];

  // L'en-tête donne la position de chaque colonne : le classeur peut gagner
  // une colonne sans que ce script ait à être retouché.
  const entetes = brut[0].map(propre);
  const col = (nom) => {
    const i = entetes.indexOf(nom);
    if (i < 0) throw new Error(`colonne « ${nom} » introuvable dans l'onglet ${feuille}`);
    return i;
  };
  const iNum = col("N°"), iPalier = col("Palier"), iNom = col("Nom");
  const iRep1 = col(rep1), iRep3 = col(rep3);
  const iRace = race ? col(race) : -1;
  const iCitation = entetes.indexOf("Citation");

  return brut.slice(1)
    .filter((r) => propre(r[iNom]))
    .map((r) => [
      propre(r[iNum]),
      propre(r[iNom]),
      type,
      propre(r[iPalier]),
      propre(r[iRep1]),
      iRace >= 0 ? propre(r[iRace]) : "",
      propre(r[iRep3]),
      "",                                   // genre : absent du classeur
      iCitation >= 0 ? propre(r[iCitation]) : "",
    ]);
}

const lignes = ONGLETS.flatMap(lireOnglet);
if (!lignes.length) {
  console.error("Aucune carte lue : vérifiez les noms d'onglets.");
  process.exit(1);
}

const cible = `data/${id || basename(chemin).replace(/\.[^.]+$/, "").toLowerCase()}.json`;
writeFileSync(
  cible,
  JSON.stringify({
    source: basename(chemin),
    note: "Produit par npm run roster. Colonnes : 0 numéro · 1 nom · 2 type "
        + "(pnj|lieu|artefact) · 3 palier · 4 repère 1 · 5 race · 6 repère 3 · "
        + "7 genre · 8 citation.",
    lignes,
  }, null, 2) + "\n",
  "utf8"
);

/* ── Contrôle ─────────────────────────────────────────────────────────────
   Un roster qui manque un palier n'échoue pas : le tirage glisse vers le
   palier voisin, en silence. Autant compter ici. */
const compter = (f) => {
  const m = new Map();
  lignes.forEach((r) => m.set(f(r), (m.get(f(r)) || 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const liste = (e) => e.map(([k, n]) => `${k || "(vide)"} ${n}`).join(" · ");

console.log(`${lignes.length} cartes écrites dans ${cible}`);
console.log("Types   :", liste(compter((r) => r[2])));
console.log("Paliers :", liste(compter((r) => r[3].toLowerCase())));
console.log("Citations remplies :", lignes.filter((r) => r[8]).length);

const doublons = compter((r) => r[1]).filter(([, n]) => n > 1);
if (doublons.length) console.warn("Noms en double :", liste(doublons));
const sansPalier = lignes.filter((r) => !r[3]).length;
if (sansPalier) console.warn(`${sansPalier} cartes sans palier : elles seront déduites du repère.`);

console.log("\nRepères 1, du plus rare au plus courant :");
compter((r) => r[4]).reverse().forEach(([g, n]) => console.log(`  ${String(n).padStart(4)}  ${g}`));
