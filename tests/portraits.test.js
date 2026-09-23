/** Portraits : adresse d'une carte (src/lib/images.js) et noms de fichiers
 *  reconnus par le script de publication (scripts/portraits.mjs). */
import { test } from "vitest";
import assert from "node:assert/strict";
import { INVENTAIRE_EN_COURS, resoudreImage } from "../src/lib/images.js";
import { identifier } from "../scripts/portraits.mjs";
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
