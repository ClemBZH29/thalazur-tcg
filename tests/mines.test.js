/**
 * Règles des Mines de Kazim. Ces tests ne figent pas l'équilibrage — l'audit
 * d'économie (npm run audit) est là pour ça — mais les propriétés sur
 * lesquelles l'interface compte : des coûts cohérents, une progression qui
 * ne recule pas, une mine neuve qui ne produit rien.
 */
import { describe, expect, test } from "vitest";
import { COMPAGNONS } from "../src/mines/donnees.js";
import * as R from "../src/mines/regles.js";
import { etatNeuf } from "../src/mines/sauvegarde.js";
import { fmt, fmtEnt } from "../src/mines/format.js";

const partie = (patch = {}) => ({ ...etatNeuf(), ...patch });

describe("coûts", () => {
  test("acheter n compagnons d'un coup coûte la somme des achats un par un (à l'arrondi près)", () => {
    for (const c of COMPAGNONS.slice(0, 4)) {
      const S = partie({ compagnons: { [c.id]: 7 } });
      let somme = 0;
      const T = partie({ compagnons: { [c.id]: 7 } });
      for (let i = 0; i < 10; i++) { somme += c.base * Math.pow(1.15, T.compagnons[c.id]); T.compagnons[c.id]++; }
      expect(Math.abs(R.coutN(S, c, 10) - somme)).toBeLessThanOrEqual(1);
    }
  });

  test("le prix d'un compagnon monte à chaque exemplaire", () => {
    const c = COMPAGNONS[0];
    expect(R.coutUn(partie({ compagnons: { [c.id]: 5 } }), c))
      .toBeGreaterThan(R.coutUn(partie({ compagnons: { [c.id]: 4 } }), c));
  });

  test("ce qu'on peut s'offrir tient dans la bourse", () => {
    const c = COMPAGNONS[1];
    const S = partie({ etoile: 1e6, compagnons: { [c.id]: 3 } });
    const n = R.nbAbordable(S, c);
    expect(n).toBeGreaterThan(0);
    expect(R.coutN(S, c, n)).toBeLessThanOrEqual(S.etoile * 1.001);
  });
});

describe("progression", () => {
  test("une mine neuve ne produit rien toute seule", () => {
    expect(R.dps(partie())).toBe(0);
  });

  test("un compagnon de plus produit plus", () => {
    const c = COMPAGNONS[2];
    expect(R.dps(partie({ compagnons: { [c.id]: 3 } })))
      .toBeGreaterThan(R.dps(partie({ compagnons: { [c.id]: 2 } })));
  });

  test("les filons sont plus solides en profondeur et à mesure qu'on les brise", () => {
    expect(R.pvFilon(3, 0)).toBeGreaterThan(R.pvFilon(2, 0));
    expect(R.pvFilon(2, 5)).toBeGreaterThan(R.pvFilon(2, 0));
  });

  test("vendre plus d'étoile ne rapporte jamais moins de PO", () => {
    const S = partie({ profondeur: 3, profondeurMax: 3 });
    let avant = 0;
    for (const mise of [1e3, 1e4, 1e5, 1e6, 1e7, 1e9]) {
      const { po } = R.poPourMise(S, mise);
      expect(po).toBeGreaterThanOrEqual(avant);
      avant = po;
    }
    expect(avant).toBeGreaterThan(0);
  });

  test("la dette des effondrements est plafonnée", () => {
    expect(R.dette(partie({ effondrements: 1e9 }))).toBeLessThanOrEqual(R.DETTE_MAX);
  });

  test("un filon a toujours entre cinq et huit éclats", () => {
    for (let i = 0; i < 50; i++) {
      const n = R.genererEclats().length;
      expect(n).toBeGreaterThanOrEqual(5);
      expect(n).toBeLessThanOrEqual(8);
    }
  });
});

describe("format", () => {
  test("nombres à la française", () => {
    expect(fmt(999)).toBe("999");
    expect(fmt(1500)).toBe("1,5 K");
    expect(fmt(100e6)).toBe("100 M");
    expect(fmt(-2500)).toBe("−2,5 K");
    expect(fmtEnt(1234567)).toBe("1 234 567");
  });
});

describe("absence", () => {
  const equipe = () => {
    const S = partie({ compagnons: { [COMPAGNONS[0].id]: 25, [COMPAGNONS[1].id]: 10 } });
    R.naitreFilon(S, () => 0.9);
    return S;
  };

  test("une mine sans équipe ne produit rien, même après huit heures", () => {
    const S = partie();
    R.naitreFilon(S, () => 0.9);
    const b = R.simulerAbsence(S, 8 * 3600000);
    expect(b.filons).toBe(0);
    expect(S.etoile).toBe(0);
  });

  test("l'équipe brise des filons et descend, comme en direct", () => {
    const S = equipe();
    const b = R.simulerAbsence(S, 3 * 3600000, R.RENDEMENT_ABSENCE, () => 0.9);
    expect(b.filons).toBeGreaterThan(R.FILONS_PAR_STRATE);
    expect(b.strates).toBeGreaterThan(0);
    expect(S.profondeur).toBe(1 + b.strates);
    expect(S.brisesTotal).toBe(b.filons);
    expect(S.etoile).toBeCloseTo(b.etoile, 6);
  });

  test("plus longtemps absent ne rapporte jamais moins, et plafonne à huit heures", () => {
    const court = R.simulerAbsence(equipe(), 3600000, 0.35, () => 0.9);
    const long = R.simulerAbsence(equipe(), 5 * 3600000, 0.35, () => 0.9);
    const huit = R.simulerAbsence(equipe(), 8 * 3600000, 0.35, () => 0.9);
    const vingt = R.simulerAbsence(equipe(), 20 * 3600000, 0.35, () => 0.9);
    expect(long.etoile).toBeGreaterThan(court.etoile);
    expect(vingt.etoile).toBe(huit.etoile);
  });

  test("le rendement d'absence réduit le travail par rapport à la page ouverte", () => {
    const reduit = R.simulerAbsence(equipe(), 2 * 3600000, R.RENDEMENT_ABSENCE, () => 0.9);
    const plein = R.simulerAbsence(equipe(), 2 * 3600000, 1, () => 0.9);
    expect(plein.etoile).toBeGreaterThan(reduit.etoile);
  });
});
