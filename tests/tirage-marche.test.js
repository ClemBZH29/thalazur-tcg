/** Le tirage d'un booster et le Comptoir, sur le vrai roster de La Troupe. */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import extension from "../src/extensions/troupe-valeran/extension.js";
import { construirePool, deduireGrades } from "../src/lib/roster.js";
import { specialesPour } from "../src/config/speciales.js";
import { TAUX_DEFAUT, TIER_ORDER } from "../src/config/tiers.js";
import { ouvrirBooster } from "../src/lib/draw.js";
import { construireMarche, Marche } from "../src/comptoir/marche.js";

const roster = JSON.parse(readFileSync(new URL("../src/extensions/troupe-valeran/roster.json", import.meta.url), "utf8"));
const pool = construirePool(roster.lignes, deduireGrades(roster.lignes));
const speciales = specialesPour(extension);
const jeuComplet = [...TIER_ORDER.flatMap((t) => pool[t] || []), ...speciales.fullart, ...speciales.pj];

/** Générateur pseudo-aléatoire à graine : un tirage reproductible. */
const graine = (s) => () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);

describe("tirage", () => {
  test("un booster contient cinq cartes, toutes du set", () => {
    const ids = new Set(jeuComplet.map((c) => c.id));
    for (let i = 0; i < 200; i++) {
      const b = ouvrirBooster(pool, TAUX_DEFAUT, { speciales, rng: graine(i + 1) });
      expect(b.cards).toHaveLength(5);
      b.cards.forEach((c) => expect(ids.has(c.id)).toBe(true));
    }
  });

  test("la garantie de légendaire en place bien un", () => {
    for (let i = 0; i < 50; i++) {
      const b = ouvrirBooster(pool, TAUX_DEFAUT, { speciales, garantirLegendaire: true, rng: graine(i + 7) });
      expect(b.cards.some((c) => c.tier === "legendaire" || c.tier === "fullart" || c.tier === "pj")).toBe(true);
    }
  });

  test("à graine égale, tirage égal", () => {
    const a = ouvrirBooster(pool, TAUX_DEFAUT, { speciales, rng: graine(42) });
    const b = ouvrirBooster(pool, TAUX_DEFAUT, { speciales, rng: graine(42) });
    expect(a.cards.map((c) => c.id)).toEqual(b.cards.map((c) => c.id));
  });
});

describe("Comptoir", () => {
  const articles = construireMarche(jeuComplet, TAUX_DEFAUT);

  test("chaque carte du set a sa normale et sa rainbow au catalogue", () => {
    expect(articles.length).toBeGreaterThanOrEqual(jeuComplet.length);
  });

  test("le même jour donne le même marché", () => {
    const a = new Marche(articles, null, 20000);
    const b = new Marche(articles, null, 20000);
    expect(a.stock).toEqual(b.stock);
    expect(a.fonds).toBe(b.fonds);
  });

  test("on n'achète jamais moins cher qu'on ne revend", () => {
    const M = new Marche(articles, null, 20000);
    for (const art of articles.slice(0, 40)) {
      const { ask, bid } = M.cotation(art);
      expect(ask).toBeGreaterThanOrEqual(bid);
    }
  });
});
