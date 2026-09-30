/** Portraits : adresse d'une carte (src/lib/images.js) et noms de fichiers
 *  reconnus par le script de publication (scripts/portraits.mjs). */
import { test } from "vitest";
import assert from "node:assert/strict";
import { INVENTAIRE_EN_COURS, focalDe, resoudreImage } from "../src/lib/images.js";
import { HAUTEUR_FENETRE, carteNommee, focalPour, identifier, lireCadrages } from "../scripts/portraits.mjs";
import { originePortraits } from "../vite.config.js";

const carte = { num: "073", nom: "Scarabée des ruines", slug: "scarabee-des-ruines", urlLigne: null };
const pj = { num: "pj-hida", nom: "Hida", slug: "hida", urlLigne: null };
const cfg = (inventaire) => ({
  base: "https://images.thalazur.io/",
  motif: "{dossier}/{num}{taille}.webp",
  extension: "troupe-valeran",
  inventaire,
});
const inv = { portraits: { "troupe-valeran": { "073": "abc" }, pj: { "pj-hida": "def" } } };

test("une carte de l'inventaire pointe sur son image, versionnée", () => {
  assert.equal(resoudreImage(carte, cfg(inv)), "https://images.thalazur.io/troupe-valeran/073.webp?v=abc");
  assert.equal(
    resoudreImage(carte, cfg(inv), null, { vignette: true }),
    "https://images.thalazur.io/troupe-valeran/073-v.webp?v=abc"
  );
});

test("une carte absente de l'inventaire n'émet aucune requête", () => {
  assert.equal(resoudreImage({ ...carte, num: "074" }, cfg(inv)), null);
});

test("tant que l'inventaire charge, on attend", () => {
  assert.equal(resoudreImage(carte, cfg(INVENTAIRE_EN_COURS)), null);
});

test("sans inventaire, on tente l'image comme avant", () => {
  assert.equal(resoudreImage(carte, cfg(null)), "https://images.thalazur.io/troupe-valeran/073.webp");
});

test("les PJ ont leur dossier, commun aux extensions", () => {
  assert.equal(resoudreImage(pj, cfg(inv)), "https://images.thalazur.io/pj/pj-hida.webp?v=def");
});

test("un fichier monté ou une URL du roster passent avant tout", () => {
  assert.equal(resoudreImage(carte, cfg(inv), new Map([["073", "blob:x"]])), "blob:x");
  assert.equal(resoudreImage({ ...carte, urlLigne: "https://a/b.png" }, cfg(inv)), "https://a/b.png");
});

test("noms de fichiers reconnus", () => {
  assert.deepEqual(identifier("073-Scarabée des ruines.png"), { num: 73, nom: "scarabee-des-ruines" });
  assert.deepEqual(identifier("73.jpg"), { num: 73, nom: "" });
  assert.deepEqual(identifier("fa-Vyrin.png"), { special: "fa-vyrin" });
  assert.equal(identifier("ChatGPT Image 23 sept. 2026, 20_25_58.png"), null);
});

test("la CSP n'ajoute que l'origine d'une base absolue", () => {
  assert.equal(originePortraits("https://images.thalazur.io/sous/dossier"), " https://images.thalazur.io");
  assert.equal(originePortraits("./portraits"), "");
  assert.equal(originePortraits(undefined), "");
});

test("le point focal publié l'emporte sur le réglage général", () => {
  const avecFocal = { ...inv, focal: { "troupe-valeran": { "073": 5 } } };
  assert.equal(focalDe(carte, { ...cfg(avecFocal), focal: 30 }), 5);
  assert.equal(focalDe({ ...carte, num: "074" }, { ...cfg(avecFocal), focal: 45 }), 45);
  assert.equal(focalDe(carte, cfg(INVENTAIRE_EN_COURS)), 30);
  assert.equal(focalDe(carte, cfg(null)), 30);
});

test("la fenêtre d'art garde environ 72 % de la hauteur d'une image 2:3", () => {
  assert.ok(Math.abs(HAUTEUR_FENETRE / 1.5 - 0.718) < 0.01);
});

test("le point saillant est amené un peu au-dessus du milieu de la fenêtre, borné aux bords", () => {
  // Image 720 × 1080, fenêtre de 775 px : 305 px de jeu.
  assert.equal(focalPour(0, 1080, 775), 0);
  assert.equal(focalPour(1080, 1080, 775), 100);
  assert.equal(focalPour(100 + 0.4 * 775, 1080, 775), 33);
  assert.equal(focalPour(152.5 + 0.4 * 775, 1080, 775), 50);
});

test("cadrages forcés : clés au numéro, valeurs de 0 à 100", () => {
  const { cadrages, rejets } = lireCadrages('{ "164": 5, "073": 42.4, "12": 140, "x": 3 }');
  assert.deepEqual([...cadrages], [[164, 5], [73, 42]]);
  assert.equal(rejets.length, 2);
});

test("un texte libre après le numéro ne désigne une autre carte que s'il en porte le nom", () => {
  const roster = new Map([[73, { num: "073", nom: "Scarabée des ruines" }], [164, { num: "164", nom: "Hida" }]]);
  assert.equal(carteNommee(roster, "hida").num, "164");
  assert.equal(carteNommee(roster, "samourai-dans-la-brume-au-crepuscule"), null);
});
