/** Le cadrage de la carte préférée : la fenêtre du profil est celle du classement. */
import { describe, expect, test } from "vitest";
import { BANNIERES, cadrageValide, depuisFenetre, fenetre, partVisible } from "../src/lib/cadrage.js";

describe("cadrage", () => {
  test("une illustration en portrait dans une bannière large : toute la largeur, une tranche de la hauteur", () => {
    const v = partVisible(0.75, BANNIERES.bureau);
    expect(v.l).toBe(1);
    expect(v.h).toBeCloseTo(0.75 / BANNIERES.bureau, 5);
  });

  test("le zoom réduit la fenêtre dans les deux sens", () => {
    const v = partVisible(0.75, BANNIERES.bureau, 200);
    expect(v.l).toBeCloseTo(0.5, 5);
    expect(v.h).toBeCloseTo(0.75 / BANNIERES.bureau / 2, 5);
  });

  test("placer la fenêtre puis la relire rend le même cadrage", () => {
    const c = { x: 30, y: 70, z: 180 };
    const f = fenetre(0.75, BANNIERES.bureau, c);
    expect(depuisFenetre(0.75, BANNIERES.bureau, 180, f.gauche, f.haut)).toEqual(c);
  });

  test("un cadrage reçu d'ailleurs est borné, ou écarté", () => {
    expect(cadrageValide({ x: 140, y: -3, z: 900 })).toEqual({ x: 100, y: 0, z: 300 });
    expect(cadrageValide({ x: 50, y: 20 })).toEqual({ x: 50, y: 20, z: 100 });
    expect(cadrageValide({ x: "50", y: 20 })).toBeNull();
    expect(cadrageValide(null)).toBeNull();
  });
});
