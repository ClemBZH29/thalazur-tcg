/** La scène du Reliquaire : chronologie de la forge et mise en page. */
import { describe, expect, test } from "vitest";
import { chronologie, disposer, evenements, palier } from "../src/reliquaire/scene.js";

describe("chronologie de la forge", () => {
  // Durées de la note de Claude Design (06/10/2026), tirées du tempo de tiers.js.
  test.each([
    ["commun", false, 2130], ["peucommun", false, 2250], ["rare", false, 2660],
    ["legendaire", false, 3705], ["legendaire", true, 3705],
    // Une rainbow commune garde le tempo d'une commune, avec la frappe d'une grande carte.
    ["commun", true, 2625],
  ])("à l'aveugle, %s (rainbow : %s) : %i ms", (tier, rainbow, fin) => {
    const tl = chronologie("aveugle", palier(tier, rainbow), 100);
    expect(Math.round(tl.fin)).toBe(fin);
  });

  test("retourner : éveil puis retournement, rien à payer", () => {
    const tl = chronologie("reveler", palier("commun"), 0);
    expect(tl.paie).toBeUndefined();
    expect(tl.fin).toBe(150 + 430 + 500);
    expect(evenements("reveler", tl)).toEqual([[150 + 430 * 0.2, "contenuRevele"]]);
  });

  test("forger une carte retournée : paiement, fissure, éclat", () => {
    const tl = chronologie("forger", palier("legendaire"), 1000);
    expect(tl.cout).toBe(1000);
    expect(Math.round(tl.fin)).toBe(2045);
    expect(evenements("forger", tl)[0][1]).toBe("forgeeLigne");
  });

  test("le verdict arrive après la face, la ligne « Forgée » avec l'écart", () => {
    const tl = chronologie("aveugle", palier("rare"), 100);
    const [[face], [forgee]] = evenements("aveugle", tl);
    expect(face).toBeLessThan(tl.compte[0]);
    expect(forgee).toBe(tl.ecart[0]);
  });
});

describe("mise en page", () => {
  test.each([[1440, 788], [1280, 608], [1024, 568]])("bureau %i × %i : carte, gardien et panneau ne se chevauchent pas", (W, H) => {
    const L = disposer(W, H);
    expect(L.mob).toBe(false);
    expect(L.cy).toBeGreaterThanOrEqual(0);
    expect(L.Yb).toBeLessThanOrEqual(H);
    expect(L.px).toBeGreaterThanOrEqual(L.cx + L.cw + 64);
    expect(L.px + L.pw).toBeLessThanOrEqual(W - 32);
    expect(L.gx + L.gs).toBeLessThanOrEqual(L.cx);
    // Le décor couvre toute la scène.
    expect(L.bgX).toBeLessThanOrEqual(0);
    expect(L.bgY).toBeLessThanOrEqual(0);
    expect(L.bgX + L.bgW).toBeGreaterThanOrEqual(W);
    expect(L.bgY + L.bgH).toBeGreaterThanOrEqual(H);
  });

  test("téléphone 390 × 784 : la carte laisse la place au panneau du bas", () => {
    const L = disposer(390, 784);
    expect(L.mob).toBe(true);
    expect(L.Yb + 300).toBeLessThanOrEqual(784 + 20);
    expect(L.cx).toBeGreaterThan(0);
  });
});
