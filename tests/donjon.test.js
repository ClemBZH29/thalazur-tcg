/** Le Donjon : carte, combat, descente complète au pilote automatique. */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import extension from "../src/extensions/troupe-valeran/extension.js";
import {
  RANGS, RENCONTRES, cartesDonjon, choixAuto, choixIA, ciblesPossibles, convalescences, creerPartie, demarrerCombat,
  descendre, entrer, fuir, gainsXP, genererEtage, monstre, peutFuir, apprentissage, brume, BRUME_TOUR, atqDe, allie,
  graineDuJour, issue, ouverts, parUid, prochain, rapporte, repos, resoudre, roleDe, tirage, tresor, trouverRelique, victoire,
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
        if (!u) { fin = issue(partie, C); break; }
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
    expect(roleDe("Gueux")).toBe("debrouillard");
    expect(roleDe("Artisan")).toBe("artificier");
    expect(roleDe("Forgeronne")).toBe("artificier");
    expect(roleDe("Cuisinière")).toBe("intendant");
    expect(roleDe("Aubergiste")).toBe("intendant");
    // Le moine de D&D frappe, il ne soigne pas.
    expect(roleDe("Moine")).toBe("frappeur");
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

describe("rôles et états", () => {
  const partieDe = () => creerPartie({ equipe: POOLS.allies.slice(0, 4), artefact: null, graine: 3, jour: "x", pools: POOLS });
  test("le rempart arme toute l'équipe, et l'armure retient les coups", () => {
    const p = partieDe();
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    const artisan = POOLS.allies.find((c) => roleDe(c.rep1) === "artificier");
    const u = allie(p, artisan); p.equipe[0] = u;
    resoudre(p, C, u, "rempart", null, tirage(2));
    expect(p.equipe.every((a) => a.rempart === 2)).toBe(true);
    const cible = p.equipe[1], avant = cible.pv;
    const m = C.ennemis[0];
    m.atq = 3;
    resoudre(p, C, m, "attaque", cible, tirage(3));
    expect(avant - cible.pv).toBe(1); // 3 ± 15 % − 3 d'armure : le coup minimal
  });
  test("le ravitaillement soigne toute l'équipe, sans dépasser le maximum", () => {
    const p = partieDe();
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    const u = allie(p, POOLS.allies.find((c) => roleDe(c.rep1) === "intendant")); p.equipe[0] = u;
    for (const a of p.equipe) a.pv = Math.max(1, a.pvMax - 2);
    resoudre(p, C, u, "ravit", null, tirage(2));
    expect(p.equipe.every((a) => a.pv === a.pvMax)).toBe(true);
  });
  test("le meneur galvanise de +3 ATQ", () => {
    const p = partieDe();
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    const a = p.equipe[1], base = atqDe(p, a);
    resoudre(p, C, p.equipe[0], "galva", null, tirage(2));
    expect(atqDe(p, a)).toBe(base + 3);
  });
  test("passé le tour de la brume, les coups portent plus fort", () => {
    expect(brume({ round: BRUME_TOUR })).toBe(1);
    expect(brume({ round: BRUME_TOUR + 2 })).toBeCloseTo(1.4);
  });
  test("un soigneur resté seul ne fait plus durer le combat toujours", () => {
    const p = creerPartie({ equipe: POOLS.allies.filter((c) => roleDe(c.rep1) === "soigneur" && c.tier === "commun").slice(0, 4),
      artefact: null, graine: 5, jour: "x", pools: POOLS });
    const r = tirage(9);
    const C = demarrerCombat(p, "combat", r, POOLS);
    for (const u of p.equipe.slice(1)) { u.pv = 0; u.ko = true; }
    C.ennemis = [monstre(p, POOLS.monstres.find((c) => c.rep1 === "Créature"), 1)];
    let fin = null, t = 0;
    for (; t < 600 && !fin; t++) {
      const u = prochain(p, C);
      if (!u) { fin = issue(p, C); break; }
      const { geste, cible } = u.camp === "e" ? choixIA(p, C, u, r) : choixAuto(p, C, u, "prudence");
      resoudre(p, C, u, geste, cible, r);
      fin = issue(p, C);
    }
    expect(fin).not.toBeNull();
  });
  test("un même combat, une même graine : mêmes adversaires, même issue", () => {
    const jouer = () => {
      const p = partieDe(); const r = tirage(1234);
      const C = demarrerCombat(p, "elite", r, POOLS);
      let fin = null;
      for (let t = 0; t < 600 && !fin; t++) {
        const u = prochain(p, C);
        if (!u) { fin = issue(p, C); break; }
        const { geste, cible } = u.camp === "e" ? choixIA(p, C, u, r) : choixAuto(p, C, u, "concentrer");
        resoudre(p, C, u, geste, cible, r);
        fin = issue(p, C);
      }
      return [C.ennemis.map((e) => e.c.id).join(), fin, p.equipe.map((u) => u.pv).join()];
    };
    expect(jouer()).toEqual(jouer());
  });
  test("la recrue n'est jamais une carte déjà dans l'équipe", () => {
    const blesse = RENCONTRES.find((x) => x.id === "blesse");
    for (let g = 0; g < 60; g++) {
      const p = partieDe();
      blesse.choix(p, { r: tirage(g), pools: POOLS })[0].f();
      const ids = p.equipe.map((u) => u.c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("apprentissage", () => {
  const cfg = { jusqua: 30, difficulte: 0.75, gain: 0.5 };
  test("adouci au départ, normal au bout, en ligne droite", () => {
    expect(apprentissage(0, cfg)).toMatchObject({ difficulte: 0.75, gain: 0.5, restant: 30 });
    expect(apprentissage(15, cfg)).toMatchObject({ difficulte: 0.88, gain: 0.75, restant: 15 });
    expect(apprentissage(30, cfg)).toMatchObject({ difficulte: 1, gain: 1, restant: 0 });
    expect(apprentissage(500, cfg).difficulte).toBe(1);
    expect(apprentissage(0, null).difficulte).toBe(1);
  });
  test("il affaiblit les adversaires et réduit le butin de la descente", () => {
    const c = POOLS.monstres.find((x) => x.tier === "rare");
    const normal = creerPartie({ equipe: POOLS.allies.slice(0, 4), artefact: null, graine: 3, jour: "x", pools: POOLS });
    const doux = creerPartie({ equipe: POOLS.allies.slice(0, 4), artefact: null, graine: 3, jour: "x", pools: POOLS, apprenti: apprentissage(0, cfg) });
    expect(monstre(doux, c, 2).pvMax).toBeLessThan(monstre(normal, c, 2).pvMax);
    expect(monstre(doux, c, 2).atq).toBeLessThan(monstre(normal, c, 2).atq);
    const r = tirage(4); const r2 = tirage(4);
    expect(tresor(doux, r, []).po).toBeLessThan(tresor(normal, r2, []).po);
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

describe("expérience d'une descente", () => {
  test("toute l'équipe apprend ; tomber n'en laisse que la moitié", () => {
    const res = Array.from({ length: 40 }, (_, i) => descente(300 + i, "concentrer"));
    for (const { issue: iss, partie } of res) {
      const g = gainsXP(partie, iss);
      expect(g.length).toBeGreaterThan(0);
      for (const x of g) expect(x.xp).toBeGreaterThan(0);
    }
    const moy = res.reduce((s, x) => s + gainsXP(x.partie, x.issue)[0].xp, 0) / res.length;
    const completes = res.filter((x) => x.issue === "sortie");
    const moyC = completes.reduce((s, x) => s + gainsXP(x.partie, x.issue)[0].xp, 0) / Math.max(1, completes.length);
    // Ordres de grandeur annoncés dans experience.js : une quarantaine en
    // moyenne, une centaine pour une descente complète.
    expect(moy).toBeGreaterThan(20);
    expect(moy).toBeLessThan(80);
    expect(moyC).toBeGreaterThan(70);
    expect(moyC).toBeLessThan(160);
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

describe("deux donjons et soins réduits", () => {
  const equipe = (r) => equipeTiree(r);
  const partieDe = (mode, graine = 5) => creerPartie({ equipe: equipe(tirage(graine)), artefact: null, graine, jour: "2026-09-30", pools: POOLS, mode });

  test("le donjon du jour a trois étages, l'infini n'en a pas de dernier", async () => {
    const { etagesDe } = await import("../src/donjon/regles.js");
    expect(etagesDe(partieDe("jour"))).toBe(3);
    expect(etagesDe(partieDe("infini"))).toBe(Infinity);
    expect(etagesDe({})).toBe(3); // une partie d'avant les modes reste au donjon du jour
  });

  test("l'infini se durcit sans plafond : les adversaires montent avec l'étage", () => {
    const p = partieDe("infini");
    const c = POOLS.monstres[0];
    const a = monstre(p, c, 3), b = monstre(p, c, 10);
    expect(b.pvMax).toBeGreaterThan(a.pvMax * 2);
    expect(b.atq).toBeGreaterThan(a.atq);
    for (let e = 2; e <= 8; e++) descendre(p, POOLS);
    expect(p.etage).toBe(8);
    expect(Object.keys(p.plan.noeuds).length).toBeGreaterThan(5);
  });

  test("à l'infini, une défaite ne coûte qu'un jour de repos", () => {
    const p = partieDe("infini");
    p.etage = 9;
    expect(convalescences(p, "defaite").every((x) => x.jours === 1)).toBe(true);
    const q = partieDe("jour");
    q.etage = 3;
    expect(convalescences(q, "defaite").every((x) => x.jours === 3)).toBe(true);
  });

  test("le butin et l'expérience suivent le mode", () => {
    const p = creerPartie({ equipe: equipe(tirage(2)), artefact: null, graine: 2, jour: "2026-09-30", pools: POOLS, mode: "infini", gainMode: 0.4, xpMode: 0.5 });
    expect(p.gain).toBeCloseTo(0.4);
    p.equipe.forEach((u) => { u.xp = 10; });
    expect(gainsXP(p, "sortie").every((x) => x.xp === 5)).toBe(true);
  });

  test("moins de soins : repos à 30 %, la halte ne soigne plus que les tombés", () => {
    const p = partieDe("jour");
    const [a, b] = p.equipe;
    a.pv = 1; b.pv = 0; b.ko = true;
    descendre(p, POOLS);
    expect(a.pv).toBe(1);
    expect(b.ko).toBe(false);
    expect(b.pv).toBe(Math.ceil(b.pvMax * 0.15));
    a.pv = 1;
    repos(p);
    expect(a.pv).toBe(1 + Math.ceil(a.pvMax * 0.3 * (p.equipe.some((u) => u.role === "intendant") ? 1.25 : 1)));
  });
});

describe("reliques", () => {
  test("une relique trouvée vaut tout de suite pour toute l'équipe, tombés et recrue compris", () => {
    const p = creerPartie({ equipe: POOLS.allies.slice(0, 4), artefact: null, graine: 1, jour: "x", pools: POOLS });
    const avant = p.equipe.map((u) => ({ pvMax: u.pvMax, atq: atqDe(p, u) }));
    p.equipe[1].pv = 0; p.equipe[1].ko = true;
    const a = trouverRelique(p, () => 0.99, POOLS.artefacts); // légendaire : +2 ATQ, +5 PV
    expect(a.tier).toBe("legendaire");
    p.equipe.forEach((u, i) => {
      expect(u.pvMax).toBe(avant[i].pvMax + 5);
      expect(atqDe(p, u)).toBe(avant[i].atq + 2);
    });
    expect(p.equipe[1].pv).toBe(0); // un tombé gagne le maximum, pas des PV
    const ch = RENCONTRES.find((x) => x.id === "blesse").choix(p, { r: tirage(3), pools: POOLS });
    ch[0].f();
    const rec = p.equipe.at(-1);
    expect(rec.pvMax).toBe(allie({ uid: 0 }, rec.c).pvMax + 5);
    expect(atqDe(p, rec)).toBe(rec.atq + 2);
    const q = JSON.parse(JSON.stringify(p));
    expect(q.equipe.map((u) => atqDe(q, u))).toEqual(p.equipe.map((u) => atqDe(p, u)));
  });
});
