/** Les Profondeurs : carte, combat, descente complète au pilote automatique. */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import extension from "../src/extensions/troupe-valeran/extension.js";
import {
  RANGS, RENCONTRES, cartesDonjon, choixAuto, choixIA, ciblesPossibles, convalescences, creerPartie, demarrerCombat,
  descendre, entrer, fuir, genererEtage, monstre, peutFuir,
  graineDuJour, issue, ouverts, parUid, prochain, rapporte, repos, resoudre, roleDe, tirage, tresor, victoire,
} from "../src/donjon/regles.js";

const roster = JSON.parse(readFileSync(new URL("../src/extensions/troupe-valeran/roster.json", import.meta.url), "utf8"));
const POOLS = cartesDonjon([{ ...extension, roster }]);

const ORDRE = ["legendaire", "rare", "peucommun", "commun"];
/**
 * Le joueur simulé : une collection de dix-huit alliés tirée comme au sortir
 * des boosters, dont il emmène les quatre meilleurs, et un artéfact.
 */
function equipeTiree(r) {
  const poids = [["commun", 58], ["peucommun", 28], ["rare", 11], ["legendaire", 3]];
  const coll = new Set();
  while (coll.size < 18) {
    let x = r() * 100, t = "commun";
    for (const [k, v] of poids) { x -= v; if (x <= 0) { t = k; break; } }
    const l = POOLS.allies.filter((c) => c.tier === t);
    coll.add(l[Math.floor(r() * l.length)]);
  }
  return [...coll].sort((a, b) => ORDRE.indexOf(a.tier) - ORDRE.indexOf(b.tier)).slice(0, 4);
}

/** Une descente entière, stratégie fixée, chemins au hasard, on descend toujours. */
function descente(graine, strategie = "concentrer") {
  const r = tirage(graine * 7 + 3);
  const artefact = POOLS.artefacts[Math.floor(r() * POOLS.artefacts.length)];
  const partie = creerPartie({ equipe: equipeTiree(r), artefact, graine, jour: "2026-09-28", pools: POOLS });
  for (let pas = 0; pas < 200; pas++) {
    const o = ouverts(partie.plan);
    const n = entrer(partie, o[Math.floor(r() * o.length)]);
    if (n.genre === "tresor") tresor(partie, r, POOLS.artefacts);
    if (n.genre === "repos") repos(partie);
    if (n.genre === "evenement") {
      const ch = RENCONTRES[Math.floor(r() * RENCONTRES.length)].choix(partie, { r, pools: POOLS });
      ch.find((c) => c.ok !== false).f();
      if (!partie.equipe.some((u) => !u.ko)) return { issue: "defaite", partie };
    }
    if (["combat", "elite", "boss"].includes(n.genre)) {
      const C = demarrerCombat(partie, n.genre, r, POOLS);
      let fin = null;
      for (let t = 0; t < 500 && !fin; t++) {
        const u = prochain(partie, C);
        const { geste, cible } = u.camp === "e" ? choixIA(partie, C, u, r) : choixAuto(partie, C, u, strategie);
        resoudre(partie, C, u, geste, cible, r);
        fin = issue(partie, C);
      }
      if (fin === "defaite") return { issue: "defaite", partie };
      if (!fin) throw new Error("combat sans fin");
      victoire(partie, C, r, POOLS.artefacts);
      if (n.genre === "boss") {
        if (partie.etage === 3) return { issue: "sortie", partie };
        descendre(partie, POOLS);
      }
    }
  }
  throw new Error("descente sans fin");
}

describe("cartes", () => {
  test("alliés et adversaires sont séparés par le repère", () => {
    expect(POOLS.monstres.length).toBeGreaterThan(10);
    expect(POOLS.allies.every((c) => !["Créature", "Animal", "Criminel"].includes(c.rep1))).toBe(true);
  });
  test("chaque archétype du roster reçoit un rôle", () => {
    expect(roleDe("Infantrie lourde")).toBe("garde");
    expect(roleDe("Archère")).toBe("tireur");
    expect(roleDe("Médecin")).toBe("soigneur");
    expect(roleDe("Souverain")).toBe("meneur");
    expect(roleDe("Artisan")).toBe("debrouillard");
  });
});

describe("carte d'un étage", () => {
  test("tout chemin mène au gardien, et la carte du jour est la même pour tous", () => {
    const a = genererEtage(1, tirage(graineDuJour("2026-09-28")), POOLS.lieux);
    const b = genererEtage(1, tirage(graineDuJour("2026-09-28")), POOLS.lieux);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    for (const n of Object.values(a.noeuds)) {
      if (n.id === "boss") continue;
      expect(n.vers.length).toBeGreaterThan(0);
      for (const v of n.vers) expect(a.noeuds[v].r).toBe(n.r + 1);
    }
    expect(Object.values(a.noeuds).filter((n) => n.r === RANGS - 1).every((n) => n.genre === "repos")).toBe(true);
  });
  test("on ne va que vers une salle reliée", () => {
    const p = creerPartie({ equipe: POOLS.allies.slice(0, 4), artefact: null, graine: 5, jour: "x", pools: POOLS });
    const [premier] = ouverts(p.plan);
    expect(entrer(p, "boss")).toBeNull();
    expect(entrer(p, premier)).toBeTruthy();
    expect(ouverts(p.plan)).toEqual(p.plan.noeuds[premier].vers);
  });
  test("la partie se sérialise telle quelle", () => {
    const p = creerPartie({ equipe: POOLS.allies.slice(0, 4), artefact: POOLS.artefacts[0], graine: 9, jour: "x", pools: POOLS });
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });
});

describe("combat", () => {
  test("l'ordre suit l'initiative, l'équipe passe devant à égalité", () => {
    const p = creerPartie({ equipe: POOLS.allies.slice(0, 4), artefact: null, graine: 3, jour: "x", pools: POOLS });
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    prochain(p, C);
    const ini = C.ordre.map((uid) => parUid(p, C, uid).ini);
    expect([...ini].sort((a, b) => b - a)).toEqual(ini);
  });
  test("la provocation attire les coups", () => {
    const p = creerPartie({ equipe: POOLS.allies.slice(0, 4), artefact: null, graine: 3, jour: "x", pools: POOLS });
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    p.equipe[2].provoque = 1;
    const m = C.ennemis.find((e) => !e.boss);
    expect(choixIA(p, C, m, tirage(2)).cible).toBe(p.equipe[2]);
  });
  test("une capacité se recharge", () => {
    const p = creerPartie({ equipe: POOLS.allies.slice(0, 4), artefact: null, graine: 3, jour: "x", pools: POOLS });
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    const u = p.equipe.find((x) => x.role !== "soigneur") || p.equipe[0];
    resoudre(p, C, u, "galva", null, tirage(4));
    expect(u.cd).toBeGreaterThan(0);
  });
});

describe("adversaires", () => {
  test("des PNJ rivaux se mêlent au bestiaire, jamais un compagnon ni une faction amie", () => {
    expect(POOLS.rivaux.length).toBeGreaterThan(10);
    expect(POOLS.rivaux.some((c) => c.rep3 === "Troupe")).toBe(false);
    const p = creerPartie({ equipe: POOLS.allies.slice(0, 4), artefact: null, graine: 3, jour: "x", pools: POOLS });
    const r = tirage(8);
    const vus = Array.from({ length: 40 }, () => demarrerCombat(p, "combat", r, POOLS).ennemis).flat();
    expect(vus.some((u) => u.role === "brute" || u.role === "rapide" || u.role === "fourbe")).toBe(true);
    expect(vus.some((u) => ["garde", "frappeur", "tireur", "soigneur", "mage", "meneur", "debrouillard"].includes(u.role))).toBe(true);
    const ids = new Set(p.equipe.map((u) => u.c.id));
    expect(vus.some((u) => ids.has(u.c.id))).toBe(false);
  });
  test("un soigneur rival soigne les siens", () => {
    const p = creerPartie({ equipe: POOLS.allies.slice(0, 4), artefact: null, graine: 3, jour: "x", pools: POOLS });
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    const medecin = POOLS.rivaux.find((c) => /médecin|clerc|shaman|druide/i.test(c.rep1));
    const m = monstre(p, medecin, 1);
    C.ennemis.push(m);
    C.ennemis[0].pv = 1;
    const { geste, cible } = choixIA(p, C, m, tirage(2));
    expect(geste).toBe("soin");
    expect(cible.camp).toBe("e");
  });
  test("un provocateur adverse est la seule cible possible", () => {
    const p = creerPartie({ equipe: POOLS.allies.slice(0, 4), artefact: null, graine: 3, jour: "x", pools: POOLS });
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    C.ennemis[1].provoque = 1;
    expect(ciblesPossibles(p, C, "a")).toEqual([C.ennemis[1]]);
  });
});

describe("retraite et convalescence", () => {
  test("fuir coûte deux cinquièmes du sac et un compagnon, jamais le dernier", () => {
    const p = creerPartie({ equipe: POOLS.allies.slice(0, 4), artefact: null, graine: 3, jour: "x", pools: POOLS });
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    p.sac = 100;
    p.equipe[1].pv = 2;
    const laisse = p.equipe[1].c;
    fuir(p);
    expect(p.sac).toBe(60);
    expect(p.equipe).toHaveLength(3);
    expect(p.perdus).toEqual([laisse]);
    p.equipe.slice(1).forEach((u) => { u.ko = true; });
    expect(peutFuir(p, C)).toBe(false);
  });
  test("une défaite immobilise l'équipe un jour par étage, la recrue exceptée", () => {
    const p = creerPartie({ equipe: POOLS.allies.slice(0, 4), artefact: null, graine: 3, jour: "x", pools: POOLS });
    p.etage = 2;
    p.perdus.push(POOLS.allies[10]);
    const l = convalescences(p, "defaite");
    expect(l).toHaveLength(5);
    expect(l.filter((x) => x.jours === 2)).toHaveLength(4);
    expect(convalescences(p, "sortie")).toEqual([{ cle: `${POOLS.allies[10].ext}:${POOLS.allies[10].id}`, jours: 1 }]);
  });
});

describe("descentes complètes", () => {
  for (const s of ["concentrer", "menace", "prudence"]) {
    test(`${s} : chaque descente se termine, le butin reste borné`, () => {
      const res = Array.from({ length: 40 }, (_, i) => descente(100 + i, s));
      for (const { issue: iss, partie } of res) {
        expect(["sortie", "defaite"]).toContain(iss);
        expect(rapporte(partie, iss)).toBeLessThan(1500);
      }
      // Ni promenade ni mur : une part des descentes doit aller au bout, une part échouer.
      const reussites = res.filter((x) => x.issue === "sortie").length;
      expect(reussites).toBeGreaterThan(2);
      expect(reussites).toBeLessThan(38);
    });
  }
});
