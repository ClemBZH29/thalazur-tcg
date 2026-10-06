/** Le son du Donjon : chaque identifiant appelé dans src/donjon/ existe dans la banque. */
import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { BANQUE, NAPPES, RARETE, FORCES } from "../src/son/banque.js";
import { familleArtefact, forceDe, milieuDe, rareteDe } from "../src/son/index.js";
import { ROLES } from "../src/donjon/regles.js";
import { lireSon, SON_DEFAUT } from "../src/config/son.js";

const dossier = new URL("../src/donjon/", import.meta.url);
const sources = readdirSync(dossier).filter((f) => /\.(js|jsx)$/.test(f)).map((f) => readFileSync(new URL(f, dossier), "utf8")).join("\n");

describe("les identifiants du Donjon", () => {
  test("chaque identifiant littéral appelé existe dans la banque", () => {
    const ids = [...new Set(sources.match(/"donjon\.[a-z.]+"/g) || [])].map((x) => x.slice(1, -1));
    expect(ids.length).toBeGreaterThan(30);
    for (const id of ids) expect(BANQUE[id], id).toBeTruthy();
  });
  test("les identifiants composés existent : capacité de chaque rôle, famille d'artéfact", () => {
    for (const r of Object.keys(ROLES)) expect(BANQUE[`donjon.capacite.${r}`], r).toBeTruthy();
    for (const mec of ["crit", "armure", "soin", "butin", undefined]) expect(BANQUE[`donjon.artefact.${familleArtefact([{ mec }])}`]).toBeTruthy();
  });
  test("milieux, raretés et forces existent", () => {
    for (const l of [null, { rep3: "Capitale", nom: "Éklénor" }, { rep3: "Biome", nom: "Mines d'Azar" }, { rep3: "Camp Cotier", nom: "Tente" }])
      expect(NAPPES[milieuDe(l)]).toBeTruthy();
    for (const t of ["commun", "peucommun", "rare", "legendaire"]) expect(RARETE[rareteDe(t)]).toBeTruthy();
    for (const d of [1, 3, 9]) expect(FORCES[forceDe(d)]).toBeTruthy();
  });
});

describe("le réglage du son", () => {
  test("défauts et bornes", () => {
    expect(lireSon(undefined)).toEqual(SON_DEFAUT);
    expect(lireSon({ musique: -4, effets: "x", coupe: 1 })).toEqual({ coupe: true, musique: 0, effets: 50 });
  });
});
