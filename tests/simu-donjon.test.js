import { describe, expect, it } from "vitest";
import { ROLES, carte, competencesPermises, descente, PROFILS, LIEUX } from "../scripts/simu-donjon/moteur.mjs";
import { roleCarte } from "../src/donjon/regles.js";

// Le moteur des simulations (scripts/simu-donjon) : ses cartes fictives
// doivent porter le rôle voulu, et une descente doit être reproductible,
// sans quoi les comparaisons sur graines communes ne valent rien.
describe("simulations du Donjon", () => {
  it("chaque carte fictive a le rôle demandé", () => {
    for (const r of ROLES) expect(roleCarte(carte(r, "rare", 0))).toBe(r);
  });
  it("les soins restent réservés à leurs rôles", () => {
    expect(competencesPermises("frappeur", "tech")).not.toContain("soin");
    expect(competencesPermises("soigneur", "tech")).toContain("soin");
  });
  it("une descente est reproductible sur sa graine", () => {
    const cfg = { roles: ["garde", "frappeur", "soigneur", "mage"], source: Object.keys(LIEUX)[0], strategie: "prudence" };
    const a = descente(3, cfg, PROFILS.debutant), b = descente(3, cfg, PROFILS.debutant);
    expect(a).toEqual(b);
    expect(a.gardiens).toBeGreaterThanOrEqual(0);
  });
});
