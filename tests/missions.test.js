/** Les missions de Bodégué : tirage, progression, réclamation, remplacement. */
import { describe, expect, test } from "vitest";
import {
  contexte, evaluerMissions, nouvellesParBooster, mesuresMissions, mettreAJour, reclamerMission, remplacerMission,
  semaineLocale, tirerQuotidiennes, TYPE_PAR_ID,
} from "../src/missions/regles.js";
import { QUOTIDIENNES, RECOMPENSE_SEMAINE, REMPLACEMENTS, TYPES } from "../src/config/missions.js";
import { etatVide } from "../src/lib/storage.js";
import { replique, VOIX } from "../src/missions/voix.js";

/** Un roster à la forme de La Troupe : 110 communes, 66 peu communes, 33 rares, 11 légendaires. */
const ROSTER = [["commun", 110], ["peucommun", 66], ["rare", 33], ["legendaire", 11]]
  .flatMap(([tier, n]) => Array.from({ length: n }, (_, i) => ({ id: `${tier}-${i}`, tier })));
const EXTS = [{ id: "troupe", roster: ROSTER }];
/** Une collection qui possède les `n` premières cartes de chaque palier, dans l'ordre. */
const possede = (parPalier) => Object.fromEntries(ROSTER
  .filter((c) => Number(c.id.split("-")[1]) < (parPalier[c.tier] || 0))
  .map((c) => [c.id, { normale: 1, rainbow: 0, carte: { type: "pnj" } }]));

/** Un joueur qui a tout ouvert : quelques PNJ, un Lieu, des doublons, le Reliquaire. */
function joueur(champs = {}) {
  const coll = {};
  for (let i = 0; i < 30; i++) coll[`p${i}`] = { normale: 3, rainbow: 0, carte: { type: "pnj" } };
  coll.l0 = { normale: 2, rainbow: 0, carte: { type: "lieu" } };
  return {
    ...etatVide(),
    collections: { troupe: coll },
    boosters: { troupe: 40 },
    stats: { descentes: 6, ventes: 10 },
    reliquaire: { ouvert: 1 },
    ...champs,
  };
}
const autour = (e) => ({ mesures: mesuresMissions(e), ctx: contexte(e, EXTS) });
const lundi = new Date(2026, 9, 5, 10, 0);    // lundi 05/10/2026, 10 h
const mardi = new Date(2026, 9, 6, 10, 0);

describe("calendrier", () => {
  test("la semaine commence le lundi", () => {
    expect(semaineLocale(new Date(2026, 9, 4, 23))).toBe("2026-S40"); // dimanche
    expect(semaineLocale(lundi)).toBe("2026-S41");
    expect(semaineLocale(new Date(2026, 9, 11, 23))).toBe("2026-S41"); // dimanche suivant
    expect(semaineLocale(new Date(2027, 0, 1))).toBe("2026-S53");
  });
});

describe("tirage", () => {
  test("trois missions de trois modes différents, une hebdomadaire", () => {
    const e = mettreAJour(joueur(), { ...autour(joueur()), maintenant: lundi });
    const q = e.missions.quotidiennes;
    expect(q).toHaveLength(QUOTIDIENNES);
    expect(new Set(q.map((m) => TYPE_PAR_ID[m.type].mode)).size).toBe(QUOTIDIENNES);
    expect(e.missions.hebdo).toBeTruthy();
    expect(e.missions.jour).toBe("2026-10-05");
  });

  test("le même jour donne les mêmes missions ; rien ne bouge avant minuit", () => {
    const a = mettreAJour(joueur(), { ...autour(joueur()), maintenant: lundi });
    const b = mettreAJour(joueur(), { ...autour(joueur()), maintenant: new Date(2026, 9, 5, 22) });
    expect(b.missions.quotidiennes).toEqual(a.missions.quotidiennes);
    expect(mettreAJour(a, { ...autour(a), maintenant: new Date(2026, 9, 5, 23, 59) })).toBe(a);
  });

  test("on ne confie que ce qui est possible", () => {
    // Pas de Reliquaire, pas de doublons, pas d'équipe : ni Comptoir, ni Donjon, ni Reliquaire.
    const debutant = { ...etatVide(), boosters: { troupe: 1 } };
    for (let j = 1; j <= 28; j++) {
      const e = mettreAJour(debutant, { ...autour(debutant), maintenant: new Date(2026, 9, j, 9) });
      for (const m of e.missions.quotidiennes) {
        expect(["boosters", "nouvelles", "mine"]).toContain(m.type);
      }
      // Trois quand même : un débutant ne trouve pas de case vide.
      expect(e.missions.quotidiennes).toHaveLength(QUOTIDIENNES);
    }
  });

  test("chaque type du jour a une cible et une récompense en PO", () => {
    for (const t of TYPES.filter((t) => t.jour)) {
      expect(t.jour.n).toBeGreaterThan(0);
      expect(t.jour.po).toBeGreaterThan(0);
    }
    const q = tirerQuotidiennes("x", contexte(joueur(), EXTS), mesuresMissions(joueur()));
    expect(q.every((m) => m.depart >= 0)).toBe(true);
  });
});

describe("cartes nouvelles", () => {
  test("ce qu'un booster apporte baisse avec la collection", () => {
    const vide = nouvellesParBooster({}, ROSTER);
    expect(vide).toBeCloseTo(5, 1);
    const moitie = nouvellesParBooster(possede({ commun: 55, peucommun: 33, rare: 5, legendaire: 2 }), ROSTER);
    expect(moitie).toBeLessThan(vide);
    expect(nouvellesParBooster(possede({ commun: 110, peucommun: 66, rare: 33, legendaire: 11 }), ROSTER)).toBe(0);
  });

  test("la mission disparaît quand la collection est presque complète", () => {
    const presque = { ...etatVide(), boosters: { troupe: 200 },
      collections: { troupe: possede({ commun: 108, peucommun: 63, rare: 22, legendaire: 6 }) } };
    for (let j = 1; j <= 28; j++) {
      const e = mettreAJour(presque, { ...autour(presque), maintenant: new Date(2026, 9, j, 9) });
      expect(e.missions.quotidiennes.map((m) => m.type)).not.toContain("nouvelles");
      expect(e.missions.hebdo?.type).not.toBe("nouvelles");
    }
  });

  test("elle reste au milieu de la collection", () => {
    const milieu = { ...etatVide(), collections: { troupe: possede({ commun: 70, peucommun: 30, rare: 4, legendaire: 1 }) } };
    expect(contexte(milieu, EXTS).nouvellesParBooster * 3).toBeGreaterThanOrEqual(2);
  });
});

describe("répliques", () => {
  test("chaque type de mission a sa réplique de complétion", () => {
    for (const t of TYPES) {
      expect(VOIX.faite[t.id]?.length, t.id).toBeGreaterThan(0);
      expect(replique({ type: t.id }, "2026-10-07")).toBeTruthy();
    }
    expect(VOIX.semaine).toContain(replique({ type: "ventes", semaine: true }, "2026-10-07"));
    expect(VOIX.accueil).toContain(replique("accueil", "2026-10-07"));
  });
});

describe("progression et réclamation", () => {
  const confier = (e) => mettreAJour(e, { ...autour(e), maintenant: lundi });
  /** Fait avancer tous les compteurs bien au-delà des cibles. */
  const avancer = (e) => ({
    ...e,
    boosters: { troupe: 400 },
    stats: { ...e.stats, ventes: 500, poMine: 9000, descentes: 60, gardiens: 90, expeditions: 50, dissous: 900, forges: 20 },
    collections: { ...e.collections, troupe: { ...e.collections.troupe,
      ...Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`n${i}`, { normale: 1, rainbow: 0, carte: { type: "pnj" } }])) } },
  });

  test("seul ce qui suit la mission compte", () => {
    const e = confier(joueur());
    const ev = evaluerMissions(e, mesuresMissions(e));
    expect(ev.quotidiennes.every((m) => m.valeur === 0 && !m.atteinte)).toBe(true);
    expect(ev.aReclamer).toBe(0);
  });

  test("une mission remplie se réclame une fois, et paie", () => {
    const e = avancer(confier(joueur()));
    const mes = mesuresMissions(e);
    expect(evaluerMissions(e, mes).aReclamer).toBe(QUOTIDIENNES + 1);
    const po = e.missions.quotidiennes[0].po;
    const r = reclamerMission(e, 0, mes);
    expect(r.bourse.po).toBe(e.bourse.po + po);
    expect(reclamerMission(r, 0, mes)).toBe(r);
    const h = reclamerMission(r, "hebdo", mes);
    expect(h.sachets["*"]).toBe(RECOMPENSE_SEMAINE.sachets);
    expect(evaluerMissions(h, mes).aReclamer).toBe(QUOTIDIENNES - 1);
  });

  test("une mission pas remplie ne paie rien", () => {
    const e = confier(joueur());
    expect(reclamerMission(e, 1, mesuresMissions(e))).toBe(e);
    expect(reclamerMission(e, "hebdo", mesuresMissions(e))).toBe(e);
  });

  test("ce qui est rempli et oublié est payé au changement de jour, la semaine reste", () => {
    const e = avancer(confier(joueur()));
    const total = e.missions.quotidiennes.reduce((n, m) => n + m.po, 0);
    const lendemain = mettreAJour(e, { ...autour(e), maintenant: mardi });
    expect(lendemain.bourse.po).toBe(e.bourse.po + total);
    expect(lendemain.missions.jour).toBe("2026-10-06");
    expect(lendemain.missions.hebdo).toEqual(e.missions.hebdo);
    expect(lendemain.missions.remplacees).toBe(0);
    // Les nouvelles missions partent des compteurs du moment.
    expect(evaluerMissions(lendemain, mesuresMissions(lendemain)).quotidiennes.every((m) => m.valeur === 0)).toBe(true);
  });

  test("la semaine oubliée est payée le lundi suivant", () => {
    const e = avancer(confier(joueur()));
    const suivante = mettreAJour(e, { ...autour(e), maintenant: new Date(2026, 9, 12, 9) });
    expect(suivante.sachets["*"]).toBe(RECOMPENSE_SEMAINE.sachets);
    expect(suivante.missions.semaine).toBe("2026-S42");
  });
});

describe("remplacement", () => {
  test("une fois par jour, par un autre type d'un mode libre", () => {
    const e = mettreAJour(joueur(), { ...autour(joueur()), maintenant: lundi });
    const r = remplacerMission(e, 1, autour(e));
    expect(r).not.toBe(e);
    expect(r.missions.remplacees).toBe(1);
    const avant = e.missions.quotidiennes.map((m) => m.type);
    expect(avant).not.toContain(r.missions.quotidiennes[1].type);
    const modes = r.missions.quotidiennes.map((m) => TYPE_PAR_ID[m.type].mode);
    expect(new Set(modes).size).toBe(QUOTIDIENNES);
    expect(remplacerMission(r, 0, autour(r))).toBe(r);
    expect(evaluerMissions(r, mesuresMissions(r)).remplacements).toBe(REMPLACEMENTS - 1);
  });
});

describe("la scène", () => {
  const m = (champs) => ({ type: "ventes", valeur: 0, n: 5, atteinte: false, reclamee: false, ...champs });
  test("la pose suit l'état de la journée", async () => {
    const { humeurDe } = await import("../src/missions/voix.js");
    expect(humeurDe({ quotidiennes: [m(), m(), m()] }).pose).toBe("billet");
    expect(humeurDe({ quotidiennes: [m({ valeur: 2 }), m(), m()] }).pose).toBe("neutre");
    const prete = m({ type: "mine", valeur: 60, n: 60, atteinte: true });
    expect(humeurDe({ quotidiennes: [m(), prete, m()] })).toEqual({ voix: prete, pose: "content" });
    const faites = [m({ reclamee: true, atteinte: true }), m({ reclamee: true, atteinte: true }), m({ reclamee: true, atteinte: true })];
    expect(humeurDe({ quotidiennes: faites }).pose).toBe("serein");
    expect(humeurDe({ quotidiennes: faites, hebdo: m({ atteinte: true, semaine: true }) }).pose).toBe("semaine");
    expect(humeurDe({ quotidiennes: [m(), prete, m()], remplacee: true }).pose).toBe("malicieux");
    expect(humeurDe({ quotidiennes: faites, content: true }).pose).toBe("content");
  });

  test("la progression vue en partant sert de départ au retour, le jour même seulement", async () => {
    const { noterVu, dejaVu } = await import("../src/missions/regles.js");
    const e = mettreAJour(joueur(), { ...autour(joueur()), maintenant: lundi });
    const avance = { ...e, stats: { ...e.stats, ventes: 13, poMine: 30, descentes: 7, gardiens: 3, expeditions: 1, dissous: 4 }, boosters: { troupe: 41 } };
    const vu = noterVu(avance, mesuresMissions(avance));
    expect(vu.missions.vu.jour).toBe("2026-10-05");
    vu.missions.quotidiennes.forEach((q, i) => expect(dejaVu(vu.missions, i)).toBe(evaluerMissions(vu, mesuresMissions(vu)).quotidiennes[i].valeur));
    expect(noterVu(vu, mesuresMissions(vu))).toBe(vu);
    const lendemain = mettreAJour(vu, { ...autour(vu), maintenant: mardi });
    expect(dejaVu(lendemain.missions, 0)).toBe(0);
  });
});
