/** L'expérience des cartes au Donjon : courbe, paliers, fusion. */
import { describe, expect, test } from "vitest";
import { NIVEAU_MAX, PALIER_IRISEE, PO_SI_IRISEE, crediterXP, niveauDe, xpPourNiveau, bonusNiveau } from "../src/donjon/experience.js";
import { fusionnerXP } from "../src/lib/nuage/fusion.js";
import { etatVide } from "../src/lib/storage.js";

const carte = (tier, id = "c1") => ({ id, ext: "x", tier, nom: "Carte" });

describe("courbe", () => {
  test("paliers de la doc", () => {
    expect(xpPourNiveau(1)).toBe(0);
    expect(xpPourNiveau(20)).toBe(285);
    expect(xpPourNiveau(50)).toBe(1470);
    expect(xpPourNiveau(100)).toBe(5445);
    expect(niveauDe(284)).toBe(19);
    expect(niveauDe(285)).toBe(20);
    expect(niveauDe(1e9)).toBe(NIVEAU_MAX);
  });
  test("le niveau rend plus solide, sans excès", () => {
    expect(bonusNiveau(1)).toEqual({ pv: 0, atq: 0 });
    expect(bonusNiveau(100)).toEqual({ pv: 10, atq: 4 });
  });
});

describe("paliers", () => {
  test("une commune s'irise au niveau 20, une seule fois", () => {
    const e = etatVide();
    const c = carte("commun");
    const a = crediterXP(e, [{ c, xp: xpPourNiveau(PALIER_IRISEE.commun) }]);
    expect(a.bilan[0].irisee).toBe(true);
    expect(a.etat.collections.x.c1.rainbow).toBe(1);
    const b = crediterXP(a.etat, [{ c, xp: 50 }]);
    expect(b.bilan[0].irisee).toBeUndefined();
    expect(b.etat.collections.x.c1.rainbow).toBe(1);
  });
  test("déjà irisée : des PO à la place", () => {
    const e = { ...etatVide(), collections: { x: { c1: { normale: 1, rainbow: 1 } } } };
    const r = crediterXP(e, [{ c: carte("rare"), xp: xpPourNiveau(PALIER_IRISEE.rare) }]);
    expect(r.po).toBe(PO_SI_IRISEE.rare);
    expect(r.etat.collections.x.c1.rainbow).toBe(1);
  });
  test("pas d'irisée sous le palier du palier de rareté", () => {
    const r = crediterXP(etatVide(), [{ c: carte("legendaire"), xp: xpPourNiveau(PALIER_IRISEE.legendaire - 1) }]);
    expect(r.bilan[0].irisee).toBeUndefined();
  });
  test("niveau 100 : un sachet de l'extension", () => {
    const r = crediterXP(etatVide(), [{ c: carte("commun"), xp: xpPourNiveau(100) }]);
    expect(r.bilan[0].sachet).toBe(true);
    expect(r.etat.sachets.x).toBe(1);
    expect(crediterXP(r.etat, [{ c: carte("commun"), xp: 10 }]).etat.sachets.x).toBe(1);
  });
});

describe("fusion", () => {
  test("les points s'additionnent, les paliers restent acquis", () => {
    const f = fusionnerXP({ k: { xp: 10 } }, { k: { xp: 30 } }, { k: { xp: 25, irisee: true } });
    expect(f.k).toEqual({ xp: 45, irisee: true });
  });
});
