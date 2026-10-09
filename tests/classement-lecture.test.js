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
      extensions: { troupe: { pct: 42, irisees: 3 } }, premiers: {} };
    expect(assainirLigne(x)).toEqual(x);
  });

  test("rien de lisible : une ligne vide mais rendable", () => {
    expect(assainirLigne(null)).toMatchObject({ pseudo: "", score: 0, extensions: {}, premiers: {} });
  });
});
