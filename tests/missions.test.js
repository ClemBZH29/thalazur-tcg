/** Les missions de Bodégué : tirage, progression, réclamation, remplacement. */
import { describe, expect, test } from "vitest";
import {
  contexte, evaluerMissions, mesuresMissions, mettreAJour, reclamerMission, remplacerMission,
  semaineLocale, tirerQuotidiennes, TYPE_PAR_ID,
} from "../src/missions/regles.js";
import { QUOTIDIENNES, RECOMPENSE_SEMAINE, REMPLACEMENTS, TYPES } from "../src/config/missions.js";
import { etatVide } from "../src/lib/storage.js";

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
const TOTAL = 220;
const autour = (e) => ({ mesures: mesuresMissions(e), ctx: contexte(e, TOTAL) });
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
    const q = tirerQuotidiennes("x", contexte(joueur(), TOTAL), mesuresMissions(joueur()));
    expect(q.every((m) => m.depart >= 0)).toBe(true);
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
