/** Les deux donjons (06/10/2026) : composition imposée du jour, infini payant sans retour. */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import extension from "../src/extensions/troupe-valeran/extension.js";
import {
  IMPOSES, ROLES, cartesDonjon, compositionDuJour, creerPartie, demarrerCombat, gainsXP, peutFuir, rapporte, roleCarte, tirage,
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
