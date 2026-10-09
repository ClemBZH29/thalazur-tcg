/** Le règlement d'une ouverture : prix, sachet offert, botte du colporteur. */
import { describe, expect, test } from "vitest";
import { etatVide } from "../src/lib/storage.js";
import { appliquerOuverture, reglementOuverture } from "../src/jeu/recolte.js";
import { attenteAvantAchat } from "../src/lib/economie.js";
import { ECONOMIE } from "../src/config/tiers.js";

const B = "troupe-valeran";
const booster = { cards: [{ id: "001-a", tier: "commun", rainbow: false, slot: 0 }] };
const partie = (po, sachets = {}) => ({ ...etatVide(), bourse: { po, credite: Date.now(), gagne: 0 }, sachets });
const ouvrir = (e, o) => appliquerOuverture(e, { boosterId: B, booster, prix: ECONOMIE.prix, ...o });

describe("règlement d'une ouverture", () => {
  test("un sachet offert passe avant la bourse", () => {
    const f = ouvrir(partie(500, { [B]: 2 }), { sachet: B });
    expect(f.sachets[B]).toBe(1);
    expect(f.bourse.po).toBe(500);
    expect(f.boosters[B]).toBe(1);
  });

  test("le sachet disparu entre-temps : le vrai prix est dû, pas zéro", () => {
    const f = ouvrir(partie(500, { [B]: 0 }), { sachet: B });
    expect(f.bourse.po).toBe(500 - ECONOMIE.prix);
    expect(f.boosters[B]).toBe(1);
  });

  test("sachet disparu et bourse insuffisante : rien ne bouge", () => {
    const e = partie(50, {});
    expect(reglementOuverture(e, { prix: ECONOMIE.prix, sachet: B })).toBeNull();
    expect(ouvrir(e, { sachet: B })).toBe(e);
  });

  test("la bourse n'est jamais débitée au-delà de ce qu'elle contient", () => {
    const e = partie(ECONOMIE.prix - 1);
    expect(ouvrir(e, {})).toBe(e);
  });

  test("mode test : gratuit, quelle que soit la bourse", () => {
    const f = ouvrir(partie(0), { gratuit: true });
    expect(f.bourse.po).toBe(0);
    expect(f.boosters[B]).toBe(1);
  });

  test("la botte du colporteur compte une affaire à l'achat, à son prix", () => {
    const f = ouvrir(partie(500), { prix: 80, botte: true });
    expect(f.bourse.po).toBe(420);
    expect(f.stats.affaires).toBe(1);
    // Achat refusé : l'affaire n'a pas eu lieu.
    expect(ouvrir(partie(10), { prix: 80, botte: true }).stats?.affaires || 0).toBe(0);
  });
});

describe("attente avant achat", () => {
  test("au prix de la botte, pas au prix de l'étagère", () => {
    const b = { po: 60 };
    expect(attenteAvantAchat(b, 80)).toBe(((80 - 60) / ECONOMIE.parHeure) * 3600000);
    expect(attenteAvantAchat(b)).toBe(((ECONOMIE.prix - 60) / ECONOMIE.parHeure) * 3600000);
    expect(attenteAvantAchat({ po: 90 }, 80)).toBe(0);
  });
});
