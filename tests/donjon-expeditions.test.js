/**
 * Une carte engagée dans la descente en cours — équipe, source de pouvoir,
 * compagnon laissé derrière — ne part pas sur les routes : elle gagnerait
 * l'expérience des deux côtés.
 */
import { describe, expect, test } from "vitest";
import * as X from "../src/expeditions/regles.js";
import { etatVide } from "../src/lib/storage.js";

const T0 = new Date(2026, 8, 28, 9, 0).getTime();
const lieu = { id: "l1", ext: "x", tier: "commun", nom: "Marais", type: "lieu", rep1: "Plan Extérieur", rep3: "Biome" };
const pnj = (id) => ({ id, ext: "x", tier: "commun", nom: `PNJ ${id}`, type: "pnj", rep1: "Garde", rep3: "Nakova" });
const enDescente = (partie) => ({ ...etatVide(), donjon: { jour: "2026-09-28", tentatives: 1, partie } });

describe("au Donjon, pas en expédition", () => {
  test("le lieu source de la descente en cours est occupé, et ne part pas", () => {
    const e = enDescente({ equipe: [{ c: pnj("a") }], source: { c: lieu }, perdus: [] });
    expect(X.empechement(e, lieu, T0)).toBe("donjon");
    expect(X.partir(e, { lieu, cartes: [pnj("b")], heures: 4, maintenant: T0 }).erreur).toBeTruthy();
  });
  test("le compagnon laissé derrière revient à la fin de la descente : occupé d'ici là", () => {
    const e = enDescente({ equipe: [{ c: pnj("a") }], source: null, perdus: [pnj("c")] });
    expect(X.empechement(e, pnj("c"), T0)).toBe("donjon");
  });
  test("la recrue n'est pas engagée : la carte du joueur reste libre", () => {
    const e = enDescente({ equipe: [{ c: pnj("a") }, { c: pnj("r"), recrue: true }], source: null, perdus: [] });
    expect(X.empechement(e, pnj("r"), T0)).toBeNull();
    expect(X.empechement(e, pnj("a"), T0)).toBe("donjon");
  });
  test("sans descente, le lieu part", () => {
    expect(X.partir(etatVide(), { lieu, cartes: [pnj("b")], heures: 4, maintenant: T0 }).erreur).toBeUndefined();
  });
});
