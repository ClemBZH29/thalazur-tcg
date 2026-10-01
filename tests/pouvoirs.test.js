/** Sources de pouvoir (lieux) et artéfacts : les effets, et ce qu'ils font en combat. */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import extension from "../src/extensions/troupe-valeran/extension.js";
import {
  atqDe, cartesDonjon, creerPartie, demarrerCombat, gainsXP, issue, mods, prochain, resoudre, tirage, victoire,
} from "../src/donjon/regles.js";
import { EFFETS_ARTEFACT, MECANIQUES, SOURCES, cleArtefact, cumuler, effetsArtefact, effetsSource, sourceDe } from "../src/donjon/pouvoirs.js";

const roster = JSON.parse(readFileSync(new URL("../src/extensions/troupe-valeran/roster.json", import.meta.url), "utf8"));
const POOLS = cartesDonjon([{ ...extension, roster }]);
const lieu = (id) => POOLS.lieux.find((l) => l.id.endsWith(id));
const equipe = POOLS.allies.slice(0, 4);
const partie = (source, extra = {}) => creerPartie({ equipe, graine: 3, jour: "x", pools: POOLS, source, ...extra });

describe("les tables", () => {
  test("chaque lieu a sa source, et aucune n'est la même", () => {
    const sig = POOLS.lieux.map((l) => {
      expect(SOURCES[`${l.ext}:${l.id}`]).toBeTruthy();
      return sourceDe(l).m.join("+");
    });
    expect(new Set(sig).size).toBe(POOLS.lieux.length);
  });
  test("une, deux ou trois mécaniques selon le palier, toutes connues", () => {
    const nb = { commun: 1, peucommun: 1, rare: 2, legendaire: 3 };
    for (const l of POOLS.lieux) {
      const m = sourceDe(l).m;
      expect(m).toHaveLength(nb[l.tier]);
      for (const k of m) expect(MECANIQUES[k]).toBeTruthy();
    }
  });
  test("chaque artéfact a son effet", () => {
    for (const a of POOLS.artefacts) expect(EFFETS_ARTEFACT[cleArtefact(a)]).toBeTruthy();
  });
  test("la force monte avec le palier, le niveau et l'étoile", () => {
    const l = lieu("015-ruelle-sombre"); // critique
    const v = (n, e) => effetsSource(l, n, e)[0].val;
    expect(v(100, false)).toBeGreaterThan(v(1, false));
    expect(v(100, true)).toBeGreaterThan(v(100, false));
    expect(v(1, false)).toBeCloseTo(MECANIQUES.crit.base);
    const peu = effetsSource(lieu("125-olionde"), 1)[0];
    expect(peu.val).toBeCloseTo(MECANIQUES.epines.base * 1.5);
  });
  test("les effets de butin ou d'expérience ne servent à rien chez l'adversaire", () => {
    expect(cumuler([{ mec: "butin", val: 0.2 }, { mec: "crit", val: 0.1 }], "e")).toEqual({ crit: 0.1 });
    expect(cumuler([{ mec: "crit", val: 0.4 }, { mec: "crit", val: 0.4 }], "a").crit).toBe(MECANIQUES.crit.plafond);
  });
});

describe("la source de pouvoir", () => {
  test("ATQ, PV et INI comptent pour toute l'équipe dès le départ", () => {
    const sans = partie(null);
    const atq = partie({ c: lieu("012-camp-de-mercenaires"), niveau: 1 });
    const pv = partie({ c: lieu("016-chez-trabin"), niveau: 1 });
    const ini = partie({ c: lieu("014-port-du-nord"), niveau: 1 });
    sans.equipe.forEach((u, i) => {
      expect(atqDe(atq, atq.equipe[i])).toBe(atqDe(sans, u) + 1);
      expect(pv.equipe[i].pvMax).toBe(u.pvMax + 2);
      expect(ini.equipe[i].ini).toBe(u.ini + 1);
    });
  });
  test("la source est figée dans la partie, et se sérialise", () => {
    const p = partie({ c: lieu("213-palais-de-dispater"), niveau: 40, etoile: true });
    expect(p.source.effets).toHaveLength(3);
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });
  test("première salve : les adversaires sont touchés avant le premier tour", () => {
    const p = partie({ c: lieu("023-desert-des-cauchemars"), niveau: 1 });
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    expect(C.ouverture).toHaveLength(1);
    for (const m of C.ennemis) expect(m.pv).toBe(m.pvMax - 2);
  });
  test("régénération : chaque tour rend des PV", () => {
    const p = partie({ c: lieu("022-fumerie-de-kramach"), niveau: 100, etoile: true });
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    for (const u of p.equipe) u.pv = 1;
    C.round = 1; C.ordre = p.equipe.map((u) => u.uid); C.idx = -1;
    const u = prochain(p, C);
    expect(u.pv).toBeGreaterThan(1);
    expect(C.notes.some((n) => n.note === null)).toBe(true);
  });
  test("bivouac et relève après une victoire", () => {
    const p = partie({ c: lieu("184-temple-de-la-paix"), niveau: 1 });
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    p.equipe[0].pv = 1; p.equipe[1].pv = 0; p.equipe[1].ko = true;
    for (const m of C.ennemis) { m.pv = 0; m.ko = true; }
    victoire(p, C, tirage(2), POOLS.artefacts);
    expect(p.equipe[0].pv).toBeGreaterThan(1);
    expect(p.equipe[1].ko).toBe(false);
  });
  test("la source apprend avec l'équipe", () => {
    const p = partie({ c: lieu("015-ruelle-sombre"), niveau: 1 });
    for (const u of p.equipe) u.xp = 20;
    const g = gainsXP(p, "sortie");
    expect(g.find((x) => x.c.id === p.source.c.id)?.xp).toBe(20);
  });
  test("épines et soif de sang", () => {
    const p = partie({ c: lieu("185-valkarth"), niveau: 100, etoile: true }); // armure + épines
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    const m = C.ennemis[0]; m.atq = 40; m.pv = m.pvMax = 999;
    const cible = p.equipe[0]; cible.pv = cible.pvMax = 999;
    resoudre(p, C, m, "attaque", cible, tirage(4));
    expect(m.pv).toBeLessThan(999);
    const q = partie({ c: lieu("123-cabinet-du-dr-deutenik"), niveau: 100, etoile: true }); // drain
    const C2 = demarrerCombat(q, "combat", tirage(1), POOLS);
    const u = q.equipe[0]; u.pv = 1; u.atq = 30;
    const e = C2.ennemis[0]; e.pv = e.pvMax = 999;
    resoudre(q, C2, u, "attaque", e, tirage(4));
    expect(u.pv).toBeGreaterThan(1);
  });
});

describe("les artéfacts", () => {
  test("ils ne se choisissent plus : une élite ou un gardien les porte, et la victoire les rend", () => {
    const p = partie(null);
    const C = demarrerCombat(p, "boss", tirage(7), POOLS);
    expect(C.relique).toBeTruthy();
    expect(mods(p, C, "e")).toEqual(cumuler(effetsArtefact(C.relique), "e"));
    for (const m of C.ennemis) { m.pv = 0; m.ko = true; }
    expect(issue(p, C)).toBe("victoire");
    const r = victoire(p, C, tirage(2), POOLS.artefacts);
    expect(r.relique).toBe(C.relique);
    expect(p.reliques).toContain(C.relique);
  });
  test("une relique portée renforce les adversaires", () => {
    const sans = demarrerCombat(partie(null), "combat", tirage(9), POOLS);
    const p = partie(null);
    const C = demarrerCombat(p, "boss", tirage(9), POOLS);
    expect(C.relique).toBeTruthy();
    // Même graine : le gardien est au milieu ; ses PV comptent le bonus de la relique.
    expect(sans.relique).toBeNull();
    const b = { commun: 2, peucommun: 0, rare: 3, legendaire: 5 }[C.relique.tier];
    const boss = C.ennemis.find((m) => m.boss);
    expect(boss.pvMax).toBeGreaterThanOrEqual(b);
  });
  test("un combat ordinaire n'en porte pas", () => {
    for (let g = 1; g < 20; g++) expect(demarrerCombat(partie(null), "combat", tirage(g), POOLS).relique).toBeNull();
  });
});

describe("l'étoile d'un lieu", () => {
  test("une rainbow en trop étoile la source ; un lieu n'a pas d'autre ligne", async () => {
    const { etoiler, etoilee, ficheDe } = await import("../src/donjon/fiches.js");
    const l = lieu("015-ruelle-sombre");
    const e0 = { collections: { [l.ext]: { [l.id]: { normale: 1, rainbow: 2 } } }, fiches: {}, reliquaire: { vestiges: 0 } };
    expect(etoiler(e0, l, "atq")).toBeNull();
    const e1 = etoiler(e0, l, "source");
    expect(etoilee(ficheDe(e1, l))).toBe(true);
    expect(e1.collections[l.ext][l.id].rainbow).toBe(1);
  });
});

describe("les événements de pouvoir (pour les animations)", () => {
  test("un coup avec épines et vol de vie les signale, avec leur origine", () => {
    const p = partie({ c: lieu("123-cabinet-du-dr-deutenik"), niveau: 100, etoile: true }); // vol de vie
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    const u = p.equipe[0]; u.pv = 1; u.atq = 30;
    const e = C.ennemis[0]; e.pv = e.pvMax = 999;
    const res = resoudre(p, C, u, "attaque", e, tirage(4));
    const ev = res.pouvoirs.find((x) => x.mec === "drain");
    expect(ev).toMatchObject({ camp: "a", origine: "source", uid: u.uid, cible: e.uid });
    expect(C.pouvoirs).toHaveLength(0);
  });
  test("la première salve et la relève se signalent", () => {
    const p = partie({ c: lieu("023-desert-des-cauchemars"), niveau: 1 });
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    expect(C.ouverture[0].pouvoir).toMatchObject({ mec: "ouverture", camp: "a", origine: "source" });
    const q = partie({ c: lieu("019-plage-de-l-arrivee"), niveau: 1 });
    const C2 = demarrerCombat(q, "combat", tirage(1), POOLS);
    q.equipe[0].pv = 0; q.equipe[0].ko = true;
    for (const m of C2.ennemis) { m.pv = 0; m.ko = true; }
    const r = victoire(q, C2, tirage(2), POOLS.artefacts);
    expect(r.pouvoirs.some((x) => x.mec === "releve" && x.uid === q.equipe[0].uid)).toBe(true);
  });
});
