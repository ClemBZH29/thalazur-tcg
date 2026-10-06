/** Expéditions et Reliquaire : règles pures, et fusion des vestiges entre appareils. */
import { describe, expect, test } from "vitest";
import { EXPEDITION } from "../src/config/expeditions.js";
import { RELIQUAIRE } from "../src/config/reliquaire.js";
import { PALIER_IRISEE, xpPourNiveau } from "../src/donjon/experience.js";
import * as X from "../src/expeditions/regles.js";
import * as R from "../src/reliquaire/regles.js";
import { fusionner3, fusionnerReliquaire } from "../src/lib/nuage/fusion.js";
import { etatVide } from "../src/lib/storage.js";
import { mesuresGlobales } from "../src/succes/regles.js";

const H = 3600e3;
const T0 = new Date(2026, 8, 28, 9, 0).getTime();
const lieu = { id: "l1", ext: "x", tier: "commun", nom: "Marais", type: "lieu", rep1: "Plan Extérieur", rep3: "Biome" };
const pnj = (id, tier = "commun", rep3 = "Nakova") => ({ id, ext: "x", tier, nom: `PNJ ${id}`, type: "pnj", rep1: "Garde", rep3 });
const equipe = Array.from({ length: 6 }, (_, i) => pnj(`p${i}`));
const INDEX = Object.fromEntries([lieu, ...equipe].map((c) => [`${c.ext}:${c.id}`, c]));

describe("expéditions", () => {
  test("affinité : faction et province, au singulier comme au pluriel", () => {
    expect(X.affine(pnj("a", "commun", "Plans extérieurs"), lieu)).toBe(true);
    expect(X.affine(pnj("b", "commun", "Nakova"), lieu)).toBe(false);
  });

  test("capacité : le palier, puis une place tous les 20 niveaux", () => {
    const e = etatVide();
    expect(X.capacite(e, lieu)).toBe(EXPEDITION.capacite.commun);
    const e40 = { ...e, xp: { "x:l1": { xp: xpPourNiveau(40) } } };
    expect(X.capacite(e40, lieu)).toBe(EXPEDITION.capacite.commun + 2);
  });

  test("départ : une route, les cartes occupées ne repartent pas", () => {
    const { etat, route, erreur } = X.partir(etatVide(), { lieu, cartes: equipe, heures: 12, maintenant: T0 });
    expect(erreur).toBeUndefined();
    expect(route.fin).toBe(T0 + 12 * H);
    expect(X.empechement(etat, equipe[0], T0)).toBe("expedition");
    expect(X.partir(etat, { lieu, cartes: [pnj("z")], heures: 4, maintenant: T0 }).erreur).toBe("lieu");
    const autre = { ...lieu, id: "l2" };
    expect(X.partir(etat, { lieu: autre, cartes: [equipe[0]], heures: 4, maintenant: T0 }).erreur).toBe("occupee");
  });

  test("trop de monde ou trop d'expéditions : refusé", () => {
    const trop = Array.from({ length: EXPEDITION.capacite.commun + 1 }, (_, i) => pnj(`t${i}`));
    expect(X.partir(etatVide(), { lieu, cartes: trop, heures: 4, maintenant: T0 }).erreur).toBe("capacite");
    let e = etatVide();
    for (let i = 0; i < EXPEDITION.simultanees; i++) {
      e = X.partir(e, { lieu: { ...lieu, id: `L${i}` }, cartes: [pnj(`q${i}`)], heures: 4, maintenant: T0 }).etat;
    }
    expect(X.partir(e, { lieu: { ...lieu, id: "L9" }, cartes: [pnj("q9")], heures: 4, maintenant: T0 }).erreur).toBe("pleines");
  });

  test("une carte au repos du Donjon ne part pas", () => {
    const e = { ...etatVide(), donjon: { convalescence: { "x:p0": "2026-09-30" } } };
    expect(X.empechement(e, equipe[0], T0)).toBe("repos");
  });

  test("retour : or, vestiges, XP pour tous et pour le Lieu, route retirée", () => {
    const { etat } = X.partir(etatVide(), { lieu, cartes: equipe, heures: 12, maintenant: T0 });
    expect(X.crediterRoute(etat, 1, INDEX, T0 + H).bilan).toBeNull();
    const po0 = etat.bourse.po;
    const { etat: e, bilan } = X.crediterRoute(etat, 1, INDEX, T0 + 12 * H);
    expect(e.expeditions.routes).toHaveLength(0);
    expect(e.bourse.po).toBe(po0 + bilan.or);
    expect(e.reliquaire.vestiges).toBe(bilan.vestiges);
    expect(e.xp["x:p0"].xp).toBe(bilan.xpCarte);
    expect(e.xp["x:l1"].xp).toBe(bilan.xpLieu);
    // Rejouer le même crédit ne paie pas deux fois.
    expect(X.crediterRoute(e, 1, INDEX, T0 + 12 * H).bilan).toBeNull();
  });

  test("le plafond d'or du jour vaut pour toutes les expéditions", () => {
    const riche = { ...etatVide(), expeditions: { routes: [], seq: 1, orJour: { jour: X.jourDe(T0 + 12 * H), credite: EXPEDITION.or.plafondJour - 3 } } };
    const { etat } = X.partir(riche, { lieu, cartes: equipe, heures: 12, maintenant: T0 });
    const { bilan } = X.crediterRoute(etat, 1, INDEX, T0 + 12 * H);
    expect(bilan.or).toBe(3);
    expect(bilan.orPlafonne).toBe(true);
  });

  test("le Lieu passe en rainbow à son palier, comme une carte du Donjon", () => {
    const presque = { ...etatVide(), xp: { "x:l1": { xp: xpPourNiveau(PALIER_IRISEE.commun) - 1 } } };
    const { etat } = X.partir(presque, { lieu, cartes: equipe, heures: 4, maintenant: T0 });
    const { etat: e, bilan } = X.crediterRoute(etat, 1, INDEX, T0 + 4 * H);
    expect(bilan.lieuRainbow).toBe(true);
    expect(e.collections.x.l1.rainbow).toBe(1);
    expect(e.stats.lieuxRainbow).toBe(1);
  });

  test("peu par carte : une équipe complète de communes rapporte moins d'un booster par jour", () => {
    const est = X.estimer(etatVide(), lieu, equipe, 24);
    expect(est.or * EXPEDITION.simultanees).toBeLessThan(120);
  });

  test("les trouvailles sont tirées au départ et ne sont jamais légendaires", () => {
    const pool = [pnj("c1"), pnj("l9", "legendaire")];
    const { route } = X.partir(etatVide(), { lieu, cartes: equipe, heures: 24, pool, maintenant: T0 });
    expect(route.trouvees).toEqual(["x:c1", "x:c1"]);
  });
});

describe("reliquaire", () => {
  const roster = [pnj("a"), pnj("b", "rare"), pnj("c", "legendaire"), pnj("d", "legendaire")];
  const avec = (coll, vestiges = 0, derniere = null) => ({ ...etatVide(), collections: { x: coll }, reliquaire: { vestiges, derniereForgeL: derniere } });

  test("le dernier exemplaire ne se dissout jamais", () => {
    const e = avec({ a: { normale: 2 } });
    const e1 = R.dissoudre(e, "x", roster[0]);
    expect(e1.collections.x.a.normale).toBe(1);
    expect(e1.reliquaire.vestiges).toBe(RELIQUAIRE.dissolution.commun);
    expect(R.dissoudre(e1, "x", roster[0])).toBe(e1);
  });

  test("dissolution groupée : communes et peu communes seulement", () => {
    const e = R.dissoudreSurplus(avec({ a: { normale: 4 }, b: { normale: 3 } }), "x", roster);
    expect(e.collections.x.a.normale).toBe(1);
    expect(e.collections.x.b.normale).toBe(3);
    expect(e.reliquaire.vestiges).toBe(3 * RELIQUAIRE.dissolution.commun);
  });

  const SL = [{ commun: 1 }, { commun: 1 }, { commun: 1 }, { peucommun: 0.955, rare: 0.038, legendaire: 0.007 }, { peucommun: 0.755, rare: 0.2, legendaire: 0.045 }];
  const offre = (jour = "2026-09-30", tauxRainbow = 0) => R.offreDuJour("x", roster, jour, { slots: SL, tauxRainbow });

  test("carte du jour : la même pour tous, qui change avec le jour", () => {
    expect(offre().c.id).toBe(offre().c.id);
    const ids = new Set(Array.from({ length: 30 }, (_, i) => offre(`2026-10-${String(i + 1).padStart(2, "0")}`).c.id));
    expect(ids.size).toBeGreaterThan(1);
  });

  test("carte du jour : tirée comme dans un booster", () => {
    // Une commune (a) contre une rare (b) et deux légendaires : la commune sort
    // bien plus souvent, les légendaires rarement.
    const n = { commun: 0, rare: 0, legendaire: 0 };
    for (let i = 0; i < 2000; i++) n[R.offreDuJour("x", roster, `j${i}`, { slots: SL, tauxRainbow: 0 }).c.tier]++;
    expect(n.commun).toBeGreaterThan(n.rare * 5);
    expect(n.rare).toBeGreaterThan(n.legendaire);
    const arc = Array.from({ length: 4000 }, (_, i) => R.offreDuJour("x", roster, `r${i}`, { slots: SL, tauxRainbow: 0.03 }).rainbow).filter(Boolean).length;
    expect(arc / 4000).toBeGreaterThan(0.015);
    expect(arc / 4000).toBeLessThan(0.05);
  });

  test("carte du jour : une forge par jour, au prix du palier, irisée cinq fois plus chère", () => {
    const o = offre();
    const e = avec({ [o.c.id]: { normale: 1 } }, 5000);
    const e1 = R.forgerOffre(e, o);
    expect(e1.collections.x[o.c.id].normale).toBe(2);
    expect(e1.reliquaire.vestiges).toBe(5000 - RELIQUAIRE.forge[o.c.tier]);
    expect(R.forgerOffre(e1, o)).toBe(e1);
    const irisee = { ...o, rainbow: true, prix: R.prixOffre(o.c, true), jour: "2026-10-01" };
    expect(irisee.prix).toBe(RELIQUAIRE.forge[o.c.tier] * RELIQUAIRE.multRainbow);
    const e2 = R.forgerOffre(e1, irisee);
    expect(e2.collections.x[o.c.id].rainbow).toBe(1);
    expect(R.forgerOffre(avec({}, 1), o).reliquaire.vestiges).toBe(1);
  });

  test("forge à l'aveugle : le prix moyen de la carte du jour, arrondi au-dessus", () => {
    // Table du site : 60 % de communes, 34,2 % de peu communes, 4,8 % de rares,
    // 1 % de légendaires ; prix 50/100/250/1000, rainbow ×5 trois fois sur cent.
    const SITE = [{ commun: 1 }, { commun: 1 }, { commun: 1 }, { peucommun: 0.955, rare: 0.038, legendaire: 0.007 }, { peucommun: 0.755, rare: 0.2, legendaire: 0.045 }];
    expect(R.esperanceForge(SITE, 0.03)).toBeCloseTo(96.88, 1);
    expect(R.prixAveugle(SITE, 0.03)).toBe(100);
    // Le prix moyen tient la promesse : perdant sur une commune, gagnant sur une rare.
    expect(R.prixAveugle(SITE, 0.03)).toBeGreaterThan(RELIQUAIRE.forge.commun);
    expect(R.prixAveugle(SITE, 0.03)).toBeLessThan(RELIQUAIRE.forge.rare);
  });

  test("forge à l'aveugle : au prix moyen tant que la carte est cachée", () => {
    const o = { ...offre(), prix: 1000, prixAveugle: 100 };
    const e = avec({}, 150);
    expect(R.offreRevelee(e, o)).toBe(false);
    expect(R.peutForgerOffre(e, o)).toBe(false);
    expect(R.peutForgerOffre(e, o, { aveugle: true })).toBe(true);
    const e1 = R.forgerOffre(e, o, { aveugle: true });
    expect(e1.reliquaire.vestiges).toBe(50);
    expect(e1.collections.x[o.c.id].normale).toBe(1);
    expect(e1.stats.forgesAveugles).toBe(1);
    // Forgée, elle est retournée, et ne se forge plus aujourd'hui.
    expect(R.offreRevelee(e1, o)).toBe(true);
    expect(R.forgerOffre(e1, o, { aveugle: true })).toBe(e1);
  });

  test("retourner la carte : gratuit, mais le prix moyen est perdu pour la journée", () => {
    const o = { ...offre(), prix: 50, prixAveugle: 100 };
    const e = R.reveler(avec({}, 500), o);
    expect(e.reliquaire.vestiges).toBe(500);
    expect(R.offreRevelee(e, o)).toBe(true);
    expect(R.reveler(e, o)).toBe(e);
    expect(R.peutForgerOffre(e, o, { aveugle: true })).toBe(false);
    expect(R.forgerOffre(e, o).reliquaire.vestiges).toBe(450);
    // Le lendemain, une nouvelle carte se présente face cachée.
    expect(R.offreRevelee(e, { ...o, jour: "2026-10-01" })).toBe(false);
  });

  test("rainbow et cartes de personnage restent hors du Reliquaire", () => {
    expect(R.eligible({ id: "pj-1", tier: "legendaire" })).toBe(false);
    expect(R.eligible({ id: "f1", tier: "fullart" })).toBe(false);
  });
});

describe("ouverture du Reliquaire", () => {
  const roster = Array.from({ length: 10 }, (_, i) => pnj(`o${i}`));
  const avec = (n) => ({ ...etatVide(), collections: { x: Object.fromEntries(roster.slice(0, n).map((c) => [c.id, { normale: 1 }])) } });
  test("scellé sous 60 %, ouvert à 60 %", () => {
    expect(R.seuilAtteint(avec(5), { x: roster })).toBe(false);
    expect(R.seuilAtteint(avec(6), { x: roster })).toBe(true);
  });
  test("une fois ouvert, il le reste", () => {
    const e = R.ouvrir(avec(6), T0);
    expect(R.estOuvert(e)).toBe(true);
    expect(R.ouvrir(e, T0 + H).reliquaire.ouvert).toBe(T0);
    expect(fusionnerReliquaire({}, { vestiges: 0 }, e.reliquaire).ouvert).toBe(T0);
  });
});

describe("succès", () => {
  test("expéditions, Reliquaire et expérience se mesurent", () => {
    const e = { ...etatVide(), stats: { expeditions: 3, lieuxRainbow: 1, dissous: 12, forges: 2 },
      xp: { "x:a": { xp: xpPourNiveau(30), irisee: true }, "x:b": { xp: xpPourNiveau(100), irisee: true, cent: true } } };
    const m = mesuresGlobales(e, null);
    expect(m).toMatchObject({ expeditions: 3, lieuxRainbow: 1, dissous: 12, forges: 2, niveauMax: 100, rainbowXP: 2, centenaires: 1 });
  });
});

describe("fusion entre appareils", () => {
  test("les vestiges s'additionnent", () => {
    const g = fusionnerReliquaire({}, { vestiges: 0, achats: { x: "2026-09-29" } }, { vestiges: 0, achats: { x: "2026-09-30", y: "2026-09-01" } });
    expect(g.achats).toEqual({ x: "2026-09-30", y: "2026-09-01" });
    const f = fusionnerReliquaire({ vestiges: 100 }, { vestiges: 130 }, { vestiges: 150 });
    expect(f.vestiges).toBe(180);
  });
  test("fusion complète : le reliquaire passe par sa propre règle", () => {
    const base = { ...etatVide(), reliquaire: { vestiges: 10 } };
    const f = fusionner3(base, { ...base, reliquaire: { vestiges: 30 } }, { ...base, reliquaire: { vestiges: 25 } }, etatVide());
    expect(f.reliquaire.vestiges).toBe(45);
  });
});
