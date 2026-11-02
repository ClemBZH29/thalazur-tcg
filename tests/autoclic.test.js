/** Le contrôle des autoclickers des Mines (1.1.0). */
import { describe, expect, test } from "vitest";
import { AUTOCLIC, cadenceSoutenue } from "../src/mines/regles.js";
import { bloquerMine, finBlocage } from "../src/jeu/mine.js";
import { fusionner3 } from "../src/lib/nuage/fusion.js";
import { etatVide } from "../src/lib/storage.js";

/** Des frappes régulières à `cps` par seconde pendant `s` secondes, finissant à `fin`. */
const serie = (cps, s, fin = 100000) => Array.from({ length: Math.round(cps * s) }, (_, i) => fin - s * 1000 + (i * 1000) / cps);

describe("la cadence soutenue", () => {
  test("dix frappes par seconde pendant dix secondes : repéré", () => {
    expect(cadenceSoutenue(serie(10, 10.2), 100000)).toBe(true);
    expect(cadenceSoutenue(serie(40, 10.2), 100000)).toBe(true);
  });
  test("une rafale, même très rapide, ne suffit pas", () => {
    expect(cadenceSoutenue(serie(50, 3), 100000)).toBe(false);
    expect(cadenceSoutenue(serie(10, 9), 100000)).toBe(false);
  });
  test("un joueur rapide qui respire une seconde n'est pas repéré", () => {
    const l = [...serie(12, 5, 94000), ...serie(12, 5, 100000).filter((t) => t > 95000)];
    expect(cadenceSoutenue(l.filter((t) => t < 94000 || t > 95000), 100000)).toBe(false);
    expect(cadenceSoutenue(serie(8, 30), 100000)).toBe(false);
  });
});

describe("la fermeture de la mine", () => {
  test("vingt-quatre heures, sans prolongation par un second signalement", () => {
    const e = bloquerMine(etatVide(), 1000);
    expect(finBlocage(e, 2000)).toBe(1000 + AUTOCLIC.blocage);
    expect(bloquerMine(e, 5000)).toBe(e);
    expect(finBlocage(e, 1000 + AUTOCLIC.blocage + 1)).toBeNull();
  });
  test("elle suit le compte : la plus tardive l'emporte à la fusion", () => {
    const base = etatVide();
    const ici = bloquerMine(base, 1000);
    const fusion = fusionner3(base, ici, base, etatVide());
    expect(fusion.mine.blocage.jusqua).toBe(1000 + AUTOCLIC.blocage);
  });
});
