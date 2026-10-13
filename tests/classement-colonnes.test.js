/** Les compteurs que les colonnes du classement lisent (13/10/2026). */
import { describe, expect, test } from "vitest";
const { terminer, idPartie } = await import("../src/jeu/donjon.js");
const { etatVide } = await import("../src/lib/storage.js");
const { fusionnerDonjon } = await import("../src/lib/nuage/fusion.js");
const { trier } = await import("../src/succes/Classement.jsx");

const jour = new Date().toLocaleDateString("sv");
const infini = { id: 1, graine: 3, jour, mode: "infini", etage: 7, equipe: [] };

describe("colonnes du classement", () => {
  test("l'étage le plus profond de l'infini est retenu, et ne recule pas", () => {
    const e = { ...etatVide(), donjon: { jour, tentatives: 0, partie: infini, etageMax: 4 } };
    const resume = { issue: "chute", etage: 7, gardiens: 6, complete: false, mode: "infini", id: idPartie(infini) };
    const apres = terminer(e, { butin: 10, resume });
    expect(apres.donjon.etageMax).toBe(7);
    expect(apres.donjon.recordInfini).toBe(6);
    const moins = { ...e, donjon: { ...e.donjon, etageMax: 9 } };
    expect(terminer(moins, { butin: 10, resume }).donjon.etageMax).toBe(9);
  });

  test("deux appareils : l'étage le plus profond l'emporte", () => {
    expect(fusionnerDonjon({}, { etageMax: 5 }, { etageMax: 8 }).etageMax).toBe(8);
  });

  test("le tri suit la colonne choisie, puis la renommée", () => {
    const l = [
      { pseudo: "A", renommee: 100, eclats: 5 },
      { pseudo: "B", renommee: 300, eclats: 5 },
      { pseudo: "C", renommee: 50, eclats: 90 },
    ];
    expect(trier(l, "renommee").map((x) => x.pseudo)).toEqual(["B", "A", "C"]);
    expect(trier(l, "eclats").map((x) => x.pseudo)).toEqual(["C", "B", "A"]);
  });
});
