/** Le contrôle des autoclickers des Mines (1.1.0, révisé en 1.1.1). */
import { describe, expect, test } from "vitest";
import { AUTOCLIC, autoclicSuspect, cadenceSoutenue, frappesMecaniques } from "../src/mines/regles.js";
import { bloquerMine, blocageValable, finBlocage } from "../src/jeu/mine.js";
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

/** Un générateur pseudo-aléatoire fixe, pour des mains humaines reproductibles. */
const alea = (g) => () => { g = (g * 16807) % 2147483647; return g / 2147483647; };

describe("machine ou main humaine (1.1.1)", () => {
  /** Un autoclicker : même point, intervalles fixes. */
  const machine = (cps, s, fin = 100000) => serie(cps, s, fin).map((t) => ({ t, x: 200, y: 300 }));
  test("un autoclicker au même point, à intervalles fixes : repéré", () => {
    expect(autoclicSuspect(machine(10, 10.2), 100000)).toBe(true);
    expect(autoclicSuspect(machine(30, 10.2), 100000)).toBe(true);
  });
  test("deux doigts qui alternent, même à douze frappes par seconde : pas repéré", () => {
    const deuxDoigts = serie(12, 10.2).map((t, i) => ({ t, x: i % 2 ? 120 : 260, y: i % 2 ? 340 : 310 }));
    expect(cadenceSoutenue(deuxDoigts, 100000)).toBe(true);
    expect(autoclicSuspect(deuxDoigts, 100000)).toBe(false);
  });
  test("un seul doigt rapide mais humain (rythme irrégulier) : pas repéré", () => {
    const r = alea(7);
    let t = 89500;
    const l = [];
    while (t < 100000) { l.push({ t, x: 200 + r() * 8, y: 300 + r() * 8 }); t += 60 + r() * 50; }
    expect(cadenceSoutenue(l, 100000)).toBe(true);
    expect(frappesMecaniques(l, 100000)).toBe(false);
  });
  test("au clavier, sans position : la régularité seule départage", () => {
    expect(autoclicSuspect(serie(12, 10.2).map((t) => ({ t })), 100000)).toBe(true);
    const r = alea(3);
    let t = 89500;
    const l = [];
    while (t < 100000) { l.push({ t }); t += 50 + r() * 70; }
    expect(cadenceSoutenue(l, 100000)).toBe(true);
    expect(autoclicSuspect(l, 100000)).toBe(false);
  });
});

describe("la fermeture de la mine", () => {
  test("vingt-quatre heures, sans prolongation par un second signalement", () => {
    const e = bloquerMine(etatVide(), 1000);
    expect(finBlocage(e, 2000)).toBe(1000 + AUTOCLIC.blocage);
    expect(bloquerMine(e, 5000)).toBe(e);
    expect(finBlocage(e, 1000 + AUTOCLIC.blocage + 1)).toBeNull();
  });
  test("les fermetures de la première règle sont levées", () => {
    const ancienne = { ...etatVide(), mine: { blocage: { le: 1000, jusqua: 1000 + AUTOCLIC.blocage } } };
    expect(blocageValable(ancienne)).toBe(false);
    expect(finBlocage(ancienne, 2000)).toBeNull();
    // Un nouveau signalement ferme bien la mine, malgré l'ancienne fermeture.
    expect(finBlocage(bloquerMine(ancienne, 5000), 6000)).toBe(5000 + AUTOCLIC.blocage);
  });
  test("elle suit le compte : la plus tardive l'emporte à la fusion", () => {
    const base = etatVide();
    const ici = bloquerMine(base, 1000);
    const fusion = fusionner3(base, ici, base, etatVide());
    expect(fusion.mine.blocage.jusqua).toBe(1000 + AUTOCLIC.blocage);
  });
});
