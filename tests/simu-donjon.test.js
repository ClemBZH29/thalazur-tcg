import { describe, expect, it } from "vitest";
import { ALLIES, ROLES, carte, competencesCarte, competencesPermises, descente, PROFILS, LIEUX } from "../scripts/simu-donjon/moteur.mjs";
import { GENES, decrire, tactiqueAleatoire, tactiquePrudence } from "../scripts/simu-donjon/tactique.mjs";
import { tirage } from "../src/donjon/regles.js";
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

  it("une descente sur les vraies cartes, avec une tactique, est reproductible", () => {
    const cartes = Object.keys(ALLIES).slice(0, 4);
    const fiches = cartes.map((k) => ({ tech: competencesCarte(ALLIES[k], "tech")[0] }));
    const cfg = { cartes, source: null, fiches, tactique: tactiquePrudence() };
    expect(descente(5, cfg, PROFILS.moyen)).toEqual(descente(5, cfg, PROFILS.moyen));
  });
  it("une tactique tirée au hasard joue sans planter et se décrit", () => {
    const t = tactiqueAleatoire(tirage(1));
    expect(t).toHaveLength(GENES.length);
    for (const [i, v] of t.entries()) { expect(v).toBeGreaterThanOrEqual(GENES[i].min); expect(v).toBeLessThanOrEqual(GENES[i].max); }
    const d = descente(2, { roles: ["garde", "mage", "soigneur", "intendant"], source: null, tactique: t }, PROFILS.debutant);
    expect(d.gardiens).toBeGreaterThanOrEqual(0);
    expect(decrire(t)).toContain("Cible");
  });
});
