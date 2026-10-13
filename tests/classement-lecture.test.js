/** Lecture du classement : une ligne écrite par un autre joueur n'est jamais crue sur parole. */
import { describe, expect, test } from "vitest";
import { assainirLigne } from "../src/succes/classement.js";

describe("assainirLigne", () => {
  test("une valeur d'extension qui n'est pas un nombre devient 0", () => {
    const l = assainirLigne({ pseudo: "Mira", extensions: { troupe: { pct: { a: 1 }, irisees: "12" }, autre: "x" } });
    expect(l.extensions.troupe).toEqual({ pct: 0, irisees: 0 });
    expect(l.extensions.autre).toBeUndefined();
  });

  test("les nombres sont bornés et entiers", () => {
    const l = assainirLigne({ pseudo: "Mira", score: 1e9, boosters: -4, strate: 3.6, succes: NaN, extensions: { t: { pct: 140, irisees: 2 } } });
    expect(l).toMatchObject({ score: 10000, boosters: 0, strate: 4, succes: 0 });
    expect(l.extensions.t.pct).toBe(100);
  });

  test("pseudo, titre et premiers gardent leur forme", () => {
    const l = assainirLigne({ pseudo: { x: 1 }, titre: 42, premiers: { t: 1759000000000, u: "hier", v: { t: 1 } } });
    expect(l.pseudo).toBe("");
    expect(l.titre).toBe("");
    expect(l.premiers).toEqual({ t: 1759000000000 });
  });

  test("une ligne honnête passe intacte", () => {
    const x = { pseudo: "Mira", titre: "Fossoyeuse", score: 4200, boosters: 12, strate: 7, succes: 9,
      renommee: 345, eclats: 120, ventes: 214, heures: 96, etage: 6,
      carte: { ext: "troupe-valeran", id: "219-hida", rainbow: true },
      extensions: { troupe: { pct: 42, irisees: 3 } }, premiers: {} };
    expect(assainirLigne(x)).toEqual(x);
  });

  test("une ligne d'avant le 13/10/2026 : colonnes à zéro, pas de carte", () => {
    const l = assainirLigne({ pseudo: "Mira", score: 10 });
    expect(l).toMatchObject({ renommee: 0, eclats: 0, ventes: 0, heures: 0, etage: 0, carte: null });
  });

  test("le cadrage de la carte préférée est borné", () => {
    expect(assainirLigne({ carte: { ext: "t", id: "x", rainbow: false, x: 30, y: 140, z: 20 } }).carte)
      .toEqual({ ext: "t", id: "x", rainbow: false, x: 30, y: 100, z: 100 });
  });

  test("une carte préférée mal formée est écartée", () => {
    expect(assainirLigne({ carte: { ext: 3, id: "x" } }).carte).toBeNull();
    expect(assainirLigne({ carte: "219-hida" }).carte).toBeNull();
    expect(assainirLigne({ carte: { ext: "t", id: "x", rainbow: "oui", url: "javascript:" } }).carte)
      .toEqual({ ext: "t", id: "x", rainbow: false });
  });

  test("rien de lisible : une ligne vide mais rendable", () => {
    expect(assainirLigne(null)).toMatchObject({ pseudo: "", score: 0, extensions: {}, premiers: {} });
  });
});
