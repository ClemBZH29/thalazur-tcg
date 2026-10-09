/** Les deux donjons (06/10/2026) : composition imposée du jour, infini payant sans retour. */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import extension from "../src/extensions/troupe-valeran/extension.js";
import {
  IMPOSES, ROLES, allie, cartesDonjon, modsEquipe, prendreRelique, compositionDuJour, convalescences, fuir, creerPartie, demarrerCombat, gainsXP, impositionTenable, manqueSource, peutFuir, rapporte, roleCarte, tirage,
} from "../src/donjon/regles.js";
import { DONJON, poDuButin } from "../src/config/tiers.js";

const roster = JSON.parse(readFileSync(new URL("../src/extensions/troupe-valeran/roster.json", import.meta.url), "utf8"));
const POOLS = cartesDonjon([{ ...extension, roster }]);
const equipe = POOLS.allies.slice(0, 4);
const partie = (mode) => creerPartie({ equipe, graine: 5, jour: "x", pools: POOLS, mode });

describe("le donjon du jour", () => {
  test("quatre rôles, deux fois le même au plus, et un lieu de la collection", () => {
    const allies = POOLS.allies.slice(0, 40), lieux = POOLS.lieux.slice(0, 6);
    for (const jour of ["2026-10-06", "2026-10-07", "2026-11-20"]) {
      const i = compositionDuJour(jour, allies, lieux);
      expect(Object.values(i.roles).reduce((s, k) => s + k, 0)).toBe(4);
      for (const [r, k] of Object.entries(i.roles)) {
        expect(ROLES[r]).toBeTruthy();
        expect(k).toBeLessThanOrEqual(2);
        expect(allies.filter((c) => roleCarte(c) === r).length).toBeGreaterThanOrEqual(k);
      }
      expect(lieux.map((l) => `${l.ext}:${l.id}`)).toContain(i.lieu);
    }
  });
  test("le même jour, la même collection : la même composition", () => {
    const a = compositionDuJour("2026-10-06", POOLS.allies, POOLS.lieux);
    expect(compositionDuJour("2026-10-06", [...POOLS.allies].reverse(), [...POOLS.lieux].reverse())).toEqual(a);
  });
  test("toujours faisable, même avec une collection étroite", () => {
    const deuxRoles = POOLS.allies.filter((c) => ["garde", "frappeur"].includes(roleCarte(c))).slice(0, 4);
    const i = compositionDuJour("2026-10-06", deuxRoles, []);
    for (const [r, k] of Object.entries(i.roles)) expect(deuxRoles.filter((c) => roleCarte(c) === r).length).toBeGreaterThanOrEqual(k);
    expect(i.lieu).toBeNull();
    expect(compositionDuJour("2026-10-06", POOLS.allies.slice(0, 3))).toBeNull();
  });
});

describe("le donjon infini", () => {
  test("on n'y fuit pas", () => {
    const p = partie("infini");
    expect(peutFuir(p, demarrerCombat(p, "combat", tirage(1), POOLS))).toBe(false);
    const q = partie("jour");
    expect(peutFuir(q, demarrerCombat(q, "combat", tirage(1), POOLS))).toBe(true);
  });
  test("la chute rapporte tout le sac, et toute l'expérience du mode", () => {
    const p = partie("infini"); p.sac = 400;
    expect(rapporte(p, "defaite")).toBe(400);
    const q = partie("jour"); q.sac = 400;
    expect(rapporte(q, "defaite")).toBe(100);
    for (const u of p.equipe) u.xp = 20;
    expect(gainsXP(p, "defaite")[0].xp).toBe(20);
  });
  test("le sac se convertit en PO par une courbe concave, sans plafond", () => {
    expect(poDuButin(0, "infini")).toBe(0);
    const a = poDuButin(500, "infini"), b = poDuButin(5000, "infini");
    expect(b).toBeGreaterThan(a);
    expect(b / a).toBeLessThan(10);
    expect(poDuButin(100, "jour")).toBe(Math.round(100 * DONJON.multiplicateur));
    expect(DONJON.modes.infini.entree).toBe(100);
  });
});

describe("les rôles imposés à la main (roles-cartes.json)", () => {
  test("chaque entrée désigne une carte du roster et un rôle connu", () => {
    const cles = new Set(POOLS.allies.map((c) => `${c.ext}:${c.id}`));
    for (const [k, r] of Object.entries(IMPOSES)) {
      expect(cles.has(k), k).toBe(true);
      expect(ROLES[r], `${k} → ${r}`).toBeTruthy();
    }
  });
  test("sans entrée, le rôle vient de l'archétype", () => {
    const c = POOLS.allies.find((x) => !IMPOSES[`${x.ext}:${x.id}`]);
    expect(roleCarte(c)).toBe(roleCarte({ rep1: c.rep1 }));
  });
});

describe("la source au départ", () => {
  const lieux = POOLS.lieux.slice(0, 3);
  const cle = (c) => `${c.ext}:${c.id}`;
  test("tous les lieux en expédition : l'infini descend sans source", () => {
    expect(manqueSource({ lieux, cle: null, enExpedition: () => true })).toBeNull();
    expect(manqueSource({ lieux, cle: cle(lieux[0]), enExpedition: () => true })).toBeNull();
  });
  test("un lieu disponible : il faut le choisir", () => {
    const enExp = (l) => l !== lieux[2];
    expect(manqueSource({ lieux, cle: null, enExpedition: enExp })).toBe("choisir");
    expect(manqueSource({ lieux, cle: cle(lieux[0]), enExpedition: enExp })).toBe("choisir");
    expect(manqueSource({ lieux, cle: cle(lieux[2]), enExpedition: enExp })).toBeNull();
  });
  test("au donjon du jour, le lieu imposé : en expédition, ou perdu", () => {
    const impose = { roles: {}, lieu: cle(lieux[0]) };
    expect(manqueSource({ impose, lieux, enExpedition: (l) => l === lieux[0] })).toBe("expedition");
    expect(manqueSource({ impose, lieux: lieux.slice(1) })).toBe("perdu");
    expect(manqueSource({ impose, lieux })).toBeNull();
    expect(manqueSource({ impose: { roles: {}, lieu: null }, lieux })).toBeNull();
  });
});

describe("l'imposition du jour, quand la collection change", () => {
  const allies = POOLS.allies.slice(0, 40), lieux = POOLS.lieux.slice(0, 6);
  const i = compositionDuJour("2026-10-06", allies, lieux);
  test("elle tient tant que ses cartes sont là", () => {
    expect(impositionTenable(i, allies, lieux)).toBe(true);
  });
  test("le lieu imposé sorti de la collection (STAR RESET) : elle ne tient plus", () => {
    expect(impositionTenable(i, allies, lieux.filter((l) => `${l.ext}:${l.id}` !== i.lieu))).toBe(false);
  });
  test("plus assez de compagnons d'un rôle imposé : elle ne tient plus", () => {
    const [role] = Object.keys(i.roles);
    expect(impositionTenable(i, allies.filter((c) => roleCarte(c) !== role), lieux)).toBe(false);
  });
  test("retirée au sort sur ce qui reste, elle tient de nouveau", () => {
    const reste = lieux.filter((l) => `${l.ext}:${l.id}` !== i.lieu);
    const j = compositionDuJour("2026-10-06", allies, reste);
    expect(impositionTenable(j, allies, reste)).toBe(true);
  });
});

describe("la recrue, à la fuite", () => {
  const avecRecrue = () => {
    const p = partie("jour");
    const u = allie(p, POOLS.allies[10]); u.recrue = true; u.pv = Math.ceil(u.pvMax * 0.5);
    p.equipe.push(u);
    for (const x of p.equipe) x.xp = 12;
    return { p, u };
  };
  test("le compagnon laissé derrière n'est jamais la recrue", () => {
    const { p, u } = avecRecrue();
    fuir(p);
    expect(p.equipe).toContain(u);
    expect(p.perdus.map((c) => c.id)).not.toContain(u.c.id);
  });
  test("la recrue ne reçoit ni repos ni expérience", () => {
    const { p, u } = avecRecrue();
    fuir(p);
    const cle = `${u.c.ext}:${u.c.id}`;
    for (const iss of ["sortie", "defaite"]) {
      expect(convalescences(p, iss).map((x) => x.cle)).not.toContain(cle);
      expect(gainsXP(p, iss).map((x) => `${x.c.ext}:${x.c.id}`)).not.toContain(cle);
    }
  });
});

describe("l'initiative des reliques", () => {
  test("quatre Sceaux de Valéran : la plus forte seulement, pas la somme", () => {
    const sceau = POOLS.artefacts.find((a) => a.nom.startsWith("Sceau de Val"));
    expect(sceau).toBeTruthy();
    const p = partie("jour");
    const avant = p.equipe.map((u) => u.ini);
    for (let i = 0; i < 4; i++) prendreRelique(p, sceau);
    const gain = modsEquipe(p).ini || 0;
    expect(gain).toBeGreaterThan(0);
    expect(p.equipe.map((u) => u.ini)).toEqual(avant.map((x) => x + gain));
  });
});
