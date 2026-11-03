/** La dotation de l'aperçu des testeurs (1.1.0). */
import { describe, expect, test } from "vitest";
import { BOOSTERS } from "../src/extensions/index.js";
import { doterApercu } from "../src/lib/sauvegarde/apercu.js";
import { etatVide } from "../src/lib/storage.js";

describe("l'aperçu des testeurs", () => {
  test("toutes les cartes des extensions ouvertes, sans full art ni PJ, et 10 000 vestiges", () => {
    const e = doterApercu(etatVide());
    const troupe = BOOSTERS.find((b) => b.statut === "ouvert");
    const coll = e.collections[troupe.id];
    expect(Object.keys(coll).length).toBe(troupe.roster.lignes.length);
    expect(Object.values(coll).every((x) => x.normale === 3 && ["commun", "peucommun", "rare", "legendaire"].includes(x.carte.tier))).toBe(true);
    expect(Object.keys(coll).some((id) => id.startsWith("pj-"))).toBe(false);
    expect(e.reliquaire.vestiges).toBe(10000);
  });
  test("une seule fois par partie", () => {
    const e = doterApercu(etatVide());
    const joue = { ...e, reliquaire: { ...e.reliquaire, vestiges: 12 } };
    expect(doterApercu(joue)).toBe(joue);
  });
});
