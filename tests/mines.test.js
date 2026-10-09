/**
 * Règles des Mines de Kazim. Ces tests ne figent pas l'équilibrage — l'audit
 * d'économie (npm run audit) est là pour ça — mais les propriétés sur
 * lesquelles l'interface compte : des coûts cohérents, une progression qui
 * ne recule pas, une mine neuve qui ne produit rien.
 */
import { describe, expect, test } from "vitest";
import { COMPAGNONS } from "../src/mines/donnees.js";
import * as R from "../src/mines/regles.js";
import * as F from "../src/mines/faveur.js";
import { etatNeuf } from "../src/mines/sauvegarde.js";
import { fmt, fmtEnt } from "../src/mines/format.js";
import { soldeRemise } from "../src/mines/remise.js";
import { crediterLivraison, crediterSolde } from "../src/jeu/mine.js";

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
  });

  test("l'arrondi qui atteint mille passe au suffixe suivant", () => {
    expect(fmt(999999)).toBe("1 M");
    expect(fmt(999.6e6)).toBe("1 Md");
  });

  test("au-delà du dernier suffixe, la notation scientifique", () => {
    expect(fmt(1e25)).toBe("1e25");
    expect(fmt(1.234e300)).toBe("1,23e300");
    expect(fmt(999.9999e21)).toBe("1e24");
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

describe("éclats", () => {
  test("un éclat augmente les dégâts, pas la récolte", () => {
    const sans = partie({ compagnons: { [COMPAGNONS[0].id]: 10 } });
    const avec = partie({ compagnons: { [COMPAGNONS[0].id]: 10 }, eclats: 100 });
    expect(R.dps(avec) / R.dps(sans)).toBeCloseTo(1 + 100 * R.ECLAT_BONUS);
    expect(R.multRecolte(avec)).toBe(R.multRecolte(sans));
  });

  test("un éclat par strate atteinte au-delà de la quatrième, quelle que soit l'étoile", () => {
    expect(R.eclatsDispo(partie({ etoileTotale: 1e30, profondeurMax: 4 }))).toBe(0);
    expect(R.eclatsDispo(partie({ profondeurMax: 5 }))).toBe(1);
    expect(R.eclatsDispo(partie({ profondeurMax: 12 }))).toBe(8);
  });
});

describe("effondrement", () => {
  test("rien à gagner avant la cinquième strate", () => {
    expect(R.effondrer(partie({ profondeurMax: 4 }), etatNeuf)).toBeNull();
  });

  test("on garde éclats, faveurs et compteurs ; le reste repart de zéro", () => {
    const S = partie({ profondeur: 9, profondeurMax: 9, etoile: 5e9, eclats: 10, eclatsDepenses: 3,
      faveurs: ["plans"], effondrements: 2, compagnons: { fanal: 80 }, talents: { force: 4, echo: 0, discipline: 0, fortune: 0 } });
    const { mine, gain } = R.effondrer(S, etatNeuf);
    expect(gain).toBe(5);
    expect(mine.eclats).toBe(15);
    expect(mine.eclatsDepenses).toBe(3);
    expect(mine.effondrements).toBe(3);
    expect(mine.etoile).toBe(0);
    expect(mine.profondeurMax).toBe(1);
    expect(mine.compagnons).toEqual({});
    expect(mine.talents.force).toBe(0);
    // Plans du chantier : la pioche de fer et le fanal restent.
    expect(mine.equipement).toEqual(["p1", "l1"]);
  });

  test("l'Héritage : équipe de départ, talents gardés avec leur niveau, puits de reprise", () => {
    const S = partie({ profondeurMax: 8, niveau: 9, points: 1, talents: { force: 3, echo: 2, discipline: 2, fortune: 0 },
      eclats: 200, faveurs: ["plans", "equipe", "memoire", "puits"] });
    const { mine } = R.effondrer(S, etatNeuf);
    expect(mine.compagnons).toEqual({ fanal: 10, nain: 5 });
    expect(mine.talents.force).toBe(3);
    expect(mine.niveau).toBe(9);
    expect(mine.profondeur).toBe(3);
  });
});

describe("Faveur du Fossoyeur", () => {
  test("une faveur s'offre dans l'ordre de sa branche, si l'on a les éclats", () => {
    const S = partie({ eclats: 10 });
    expect(F.offrir(S, "equipe")).toBe(false);          // la précédente manque
    expect(F.offrir(S, "plans")).toBe(true);
    expect(F.eclatsLibres(S)).toBe(10 - F.FAVEUR_PAR_ID.plans.cout);
    expect(F.offrir(S, "plans")).toBe(false);           // déjà acquise
    expect(F.offrir(S, "puits")).toBe(false);
  });

  test("offrir ne retire pas les dégâts des éclats", () => {
    const S = partie({ eclats: 50, compagnons: { fanal: 10 } });
    const avant = R.dps(S);
    F.offrir(S, "plans");
    expect(R.dps(S)).toBe(avant);
  });

  test("les effets : absence, critiques, Fortune", () => {
    expect(R.rendementAbsence(partie())).toBe(R.RENDEMENT_ABSENCE);
    expect(R.rendementAbsence(partie({ faveurs: ["lanterne"] }))).toBe(0.5);
    expect(R.absenceMax(partie({ faveurs: ["lanterne", "releve"] }))).toBe(12 * 3600000);
    expect(R.critMult(partie({ faveurs: ["echoprofond"] }))).toBe(7.5);
    expect(R.critMult(partie({ faveurs: ["echoprofond"], equipement: ["l2"] }))).toBe(10);
    expect(R.fortune(partie({ faveurs: ["oeil"] }))).toBe(1);
  });

  test("l'arbre complet coûte ce que la simulation a calé", () => {
    expect(F.COUT_ARBRE).toBe(257);
  });
});

describe("commandes de Tafix", () => {
  const jour = "2026-10-08";
  test("trois commandes par jour, quatre avec la faveur, à paie fixe", () => {
    const S = partie();
    R.majCommandes(S, jour);
    expect(S.commandes.liste.map((c) => c.po)).toEqual([40, 70, 120]);
    const T = partie({ faveurs: ["quatrieme"] });
    R.majCommandes(T, jour);
    expect(T.commandes.liste).toHaveLength(4);
  });

  test("le jour change, les commandes aussi ; le même jour, rien ne bouge", () => {
    const S = partie();
    expect(R.majCommandes(S, jour)).toBe(true);
    expect(R.majCommandes(S, jour)).toBe(false);
    expect(R.majCommandes(S, "2026-10-09")).toBe(true);
  });

  test("reculer l'horloge ne rend pas de commandes neuves (audit 09/10/2026)", () => {
    const S = partie();
    R.majCommandes(S, jour);
    S.commandes.liste.forEach((c) => { c.livree = true; });
    // Avancer d'un jour donne les commandes de ce jour-là…
    expect(R.majCommandes(S, "2026-10-09")).toBe(true);
    S.commandes.liste.forEach((c) => { c.livree = true; });
    // … mais revenir à la vraie date ne les renouvelle pas une seconde fois.
    expect(R.majCommandes(S, jour)).toBe(false);
    expect(S.commandes.jour).toBe("2026-10-09");
    expect(S.commandes.liste.every((c) => c.livree)).toBe(true);
  });

  test("une frénésie posée dans le futur (horloge reculée) ne dure pas plus que sa durée", () => {
    const t = 1_000_000_000;
    expect(R.enFrenesie(t + R.FRENESIE.duree, t)).toBe(true);
    expect(R.enFrenesie(t - 1, t)).toBe(false);
    expect(R.enFrenesie(t + 86_400_000, t)).toBe(false);
  });

  test("la demande suit la production de l'équipe, avec un plancher", () => {
    const vide = partie();
    R.majCommandes(vide, jour);
    expect(vide.commandes.liste[0].demande).toBeGreaterThan(0);
    const equipe = partie({ compagnons: { fanal: 50, nain: 20 } });
    R.majCommandes(equipe, jour);
    expect(equipe.commandes.liste[0].demande).toBeGreaterThan(vide.commandes.liste[0].demande);
  });

  test("livrer retire l'étoile et paie une fois", () => {
    const S = partie();
    R.majCommandes(S, jour);
    const c = S.commandes.liste[0];
    S.etoile = c.demande * 2;
    expect(R.livrer(S, c.id)).toBe(40);
    expect(S.etoile).toBe(c.demande);
    expect(R.livrer(S, c.id)).toBe(0);
  });

  test("la grosse commande demande un quart d'heure de mine, page ouverte", () => {
    const S = partie();
    R.majCommandes(S, jour);
    const g = S.commandes.liste.find((c) => c.presence);
    S.etoile = g.demande * 10;              // une nuit d'absence : du stock, pas de présence
    expect(R.livrable(S, g)).toBe(false);
    S.presence += g.presence * 60;          // un quart d'heure page ouverte
    expect(R.livrable(S, g)).toBe(true);
  });

  test("après un effondrement, les commandes restantes suivent la nouvelle mine", () => {
    const S = partie({ profondeurMax: 6, compagnons: { fanal: 200, nain: 100, foreuse: 40 } });
    R.majCommandes(S, jour);
    const avant = S.commandes.liste.map((c) => c.demande);
    S.commandes.liste[0].livree = true;
    const { mine } = R.effondrer(S, etatNeuf);
    expect(mine.commandes.liste[0].demande).toBe(avant[0]);          // livrée : rien ne bouge
    expect(mine.commandes.liste[1].demande).toBeLessThan(avant[1]);  // à faire : à la mesure de la mine neuve
  });
});

describe("solde de la remise à zéro", () => {
  test("une étoile absente ou nulle ne paie rien ; seule une étoile infinie paie le maximum", () => {
    const ancienne = { brisesTotal: 10, profondeurMax: 3, etoileTotale: 1e6 };
    expect(soldeRemise({ ...ancienne }).etoile).toBe(0);
    expect(soldeRemise({ ...ancienne, etoile: null }).etoile).toBe(0);
    expect(soldeRemise({ ...ancienne, etoile: Infinity }).etoile).toBe(240);
    // JSON écrit l'infini « null » : une étoile et un cumul tous deux nuls sont l'infini débordé.
    expect(soldeRemise({ ...ancienne, etoile: null, etoileTotale: null }).etoile).toBe(240);
  });
});

describe("ce que l'application crédite (src/jeu/mine.js)", () => {
  const etat = () => ({ bourse: { po: 0, credite: 0, gagne: 0 }, stats: {}, mine: { regles: R.REGLES_VERSION } });

  test("jamais plus par jour que ce que les commandes d'un jour peuvent payer", () => {
    let e = etat();
    for (let i = 0; i < 10; i++) e = crediterLivraison(e, 120, "2026-10-09");
    expect(e.bourse.po).toBe(R.PO_COMMANDES_JOUR);
    expect(e.mine.regles).toBe(R.REGLES_VERSION);            // la marque de remise est gardée
    // Le lendemain, le compteur repart.
    e = crediterLivraison(e, 40, "2026-10-10");
    expect(e.bourse.po).toBe(R.PO_COMMANDES_JOUR + 40);
    expect(e.stats.commandes).toBe(Math.ceil(R.PO_COMMANDES_JOUR / 120) + 1);
  });

  test("le solde de remise se verse une fois, et la marque le retient", () => {
    let e = { ...etat(), mine: null };
    e = crediterSolde(e, 150);
    e = crediterSolde(e, 150);
    expect(e.bourse.po).toBe(150);
    expect(e.mine).toEqual({ regles: R.REGLES_VERSION, solde: 150 });
  });
});

test("un jour de commandes venu d'une horloge en avance ne bloque pas les commandes", () => {
  expect(R.lendemain("2026-12-31")).toBe("2027-01-01");
  const S = { ...etatNeuf(), commandes: { jour: "2027-01-01", liste: [{ id: "petite", livree: true }] } };
  expect(R.majCommandes(S, "2026-10-10")).toBe(false); // pas de commandes neuves pour autant
  expect(S.commandes.jour).toBe("2026-10-10");
  expect(R.majCommandes(S, "2026-10-11")).toBe(true); // le lendemain, elles reviennent
});

test("une commande de la veille livrée après minuit n'entame pas le plafond du jour", () => {
  let e = { bourse: { po: 0, credite: 0, gagne: 0 }, stats: {}, mine: null };
  e = crediterLivraison(e, R.PO_COMMANDES_JOUR, "2026-10-10");
  e = crediterLivraison(e, 120, "2026-10-09");
  expect(e.bourse.po).toBe(R.PO_COMMANDES_JOUR + 120);
  expect(e.mine.livre.jour).toBe("2026-10-10");
});
