/** Les événements du Donjon revus pour la 1.1.0 : coffre piégé retiré, mimiques, Mirko qui rachète une relique. */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import extension from "../src/extensions/troupe-valeran/extension.js";
import {
  MIMIQUES, MIMIQUE, RENCONTRES, bonusEquipe, cartesDonjon, creerPartie, demarrerCombat, poidsMimiques, prendreRelique,
  prixRachat, tirage, tirerRencontre, victoire,
} from "../src/donjon/regles.js";
import { TIER_INFO, TIER_ORDER } from "../src/config/tiers.js";

const roster = JSON.parse(readFileSync(new URL("../src/extensions/troupe-valeran/roster.json", import.meta.url), "utf8"));
const POOLS = cartesDonjon([{ ...extension, roster }]);
const partie = (mode = "jour") => creerPartie({ equipe: POOLS.allies.slice(0, 4), graine: 9, jour: "x", pools: POOLS, mode });
const relique = (tier) => POOLS.artefacts.find((a) => a.tier === tier);

describe("les rencontres « ? »", () => {
  test("le coffre piégé n'en fait plus partie", () => {
    expect(RENCONTRES.some((e) => e.id === "coffre")).toBe(false);
  });
  test("Mirko ne vient racheter que s'il y a une relique, et il est rare", () => {
    const p = partie();
    const r = tirage(1);
    for (let i = 0; i < 2000; i++) expect(tirerRencontre(p, r).id).not.toBe("mirko-reliques");
    prendreRelique(p, relique("rare"));
    let n = 0;
    for (let i = 0; i < 20000; i++) if (tirerRencontre(p, r).id === "mirko-reliques") n++;
    expect(n / 20000).toBeGreaterThan(0.03);
    expect(n / 20000).toBeLessThan(0.07);
  });
  test("céder une relique : elle part, ses bonus aussi, et le prix annoncé entre au sac", () => {
    const p = partie();
    const pv0 = p.equipe.map((u) => u.pvMax);
    const a = relique("legendaire");
    prendreRelique(p, a);
    prendreRelique(p, relique("commun"));
    const mirko = RENCONTRES.find((e) => e.id === "mirko-reliques");
    const choix = mirko.choix(p, { r: tirage(4), pools: POOLS });
    expect(choix).toHaveLength(3);
    const i = choix.findIndex((c) => c.lib.includes(a.nom));
    const prix = prixRachat(p, a);
    expect(choix[i].lib).toContain(`+${prix} PO`);
    // L'écran montre la relique en carte, son prix dessous.
    expect(choix[i].carte).toBe(a);
    expect(choix[i].prix).toBe(prix);
    expect(mirko.portrait).toMatch(/mirko\.webp$/);
    const sac = p.sac;
    choix[i].f();
    expect(p.reliques).not.toContain(a);
    expect(p.sac).toBe(sac + prix);
    expect(bonusEquipe(p).atq).toBe(0);
    // Il reste la commune : +2 PV à chacun, rien de la légendaire.
    expect(p.equipe.map((u) => u.pvMax)).toEqual(pv0.map((v) => v + 2));
  });
});

describe("les mimiques", () => {
  test("hors collection : un cadre à part, invisible des boosters et de la bibliothèque", () => {
    expect(TIER_INFO.hors).toBeTruthy();
    expect(TIER_ORDER).not.toContain("hors");
    for (const d of Object.values(MIMIQUES)) expect(d.carte.tier).toBe("hors");
  });
  test("plus grosses en profondeur", () => {
    const p1 = poidsMimiques(1), p10 = poidsMimiques(10);
    expect(p1.petite).toBeGreaterThan(p1.ancienne);
    expect(p10.ancienne).toBeGreaterThan(p10.petite);
    expect(MIMIQUE.chance).toBe(0.25);
  });
  test("un combat contre une seule mimique, qui rend son butin et son expérience", () => {
    const p = partie(); p.etage = 2;
    const C = demarrerCombat(p, "mimique", tirage(7), POOLS);
    expect(C.ennemis).toHaveLength(1);
    const m = C.ennemis[0];
    expect(MIMIQUES[m.mimique]).toBeTruthy();
    expect(m.c.tier).toBe("hors");
    expect(m.c.image).toMatch(/^donjon\/mimiques\//);
    m.ko = true; m.pv = 0;
    const sac = p.sac;
    const R = victoire(p, C, tirage(8), POOLS.artefacts);
    expect(R.titre).toBe("Le coffre est à vous");
    expect(R.po).toBeGreaterThanOrEqual(Math.round(MIMIQUES[m.mimique].butin * 2 * p.taux * p.gain));
    expect(p.sac).toBe(sac + R.po);
    expect(p.equipe[0].xp).toBe(MIMIQUES[m.mimique].xp * 2);
  });
  test("la mimique ancienne porte toujours une relique", () => {
    for (let g = 1; g < 400; g++) {
      const p = partie(); p.etage = 12;
      const C = demarrerCombat(p, "mimique", tirage(g), POOLS);
      if (C.ennemis[0].mimique === "ancienne") { expect(C.relique).toBeTruthy(); return; }
    }
    throw new Error("aucune mimique ancienne en 400 tirages");
  });
});
