/** Portraits : adresse d'une carte (src/lib/images.js) et noms de fichiers
 *  reconnus par le script de publication (scripts/portraits.mjs). */
import { test } from "vitest";
import assert from "node:assert/strict";
import { INVENTAIRE_EN_COURS, focalDe, resoudreImage } from "../src/lib/images.js";
import { carteNommee, identifier, lireCadrages } from "../scripts/portraits.mjs";
import { originePortraits } from "../vite.config.js";
import { FORME_CODE_EXTENSION, codeCarte, lireCodeCarte } from "../src/lib/code-carte.js";
import { BOOSTERS, BOOSTER_PAR_ID } from "../src/extensions/index.js";

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

test("cadrages forcés : une clé par code de carte, toutes extensions dans le même fichier", () => {
  const codes = new Map([["TRO", "troupe-valeran"], ["NAK", "nakova"]]);
  const { parDossier, rejets } = lireCadrages(
    '{ "_notice": "…", "TRO-164": 5, "tro-073": 42.4, "NAK-1": 60, "TRO-12": 140, "164": 3, "ZZZ-1": 4 }',
    codes
  );
  assert.deepEqual([...parDossier.get("troupe-valeran")], [[164, 5], [73, 42]]);
  assert.deepEqual([...parDossier.get("nakova")], [[1, 60]]);
  assert.equal(rejets.length, 3);
});

test("code d'une carte", () => {
  assert.equal(codeCarte("TRO", "164"), "TRO-164");
  assert.equal(codeCarte("TRO", "7"), "TRO-007");
  assert.equal(codeCarte("TRO", "pj-hida"), null);
  assert.equal(codeCarte(undefined, "164"), null);
  assert.deepEqual(lireCodeCarte(" tro-0164 "), { code: "TRO", num: 164 });
  assert.equal(lireCodeCarte("164"), null);
});

test("chaque extension déclare un code unique de trois lettres", () => {
  const vus = new Set();
  for (const b of BOOSTERS) {
    assert.match(b.code, FORME_CODE_EXTENSION, b.id);
    assert.ok(!vus.has(b.code), b.code);
    vus.add(b.code);
  }
  assert.equal(BOOSTER_PAR_ID["troupe-valeran"].code, "TRO");
});

test("un texte libre après le numéro ne désigne une autre carte que s'il en porte le nom", () => {
  const roster = new Map([[73, { num: "073", nom: "Scarabée des ruines" }], [164, { num: "164", nom: "Hida" }]]);
  assert.equal(carteNommee(roster, "hida").num, "164");
  assert.equal(carteNommee(roster, "samourai-dans-la-brume-au-crepuscule"), null);
});
