/** La fiche de combat : achats, étoiles, fusion, et les compétences en combat. */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import extension from "../src/extensions/troupe-valeran/extension.js";
import {
  COMPETENCES, ETOILE, ROLES, allie, cartesDonjon, choixAuto, choixIA, creerPartie, demarrerCombat, issue, parUid,
  prochain, resoudre, roleDe, tirage, victoire,
} from "../src/donjon/regles.js";
import {
  acheterRang, catalogue, changerCompetence, coutCompetence, coutRang, etoilee, etoiler, ficheDe, modifiee, origine, rainbowEnTrop, resetStar,
} from "../src/donjon/fiches.js";
import { PERSONNALISATION } from "../src/config/reliquaire.js";
import { fusionner3, fusionnerFiches, fusionnerXP } from "../src/lib/nuage/fusion.js";
import { etatVide } from "../src/lib/storage.js";

const roster = JSON.parse(readFileSync(new URL("../src/extensions/troupe-valeran/roster.json", import.meta.url), "utf8"));
const POOLS = cartesDonjon([{ ...extension, roster }]);
const frappeur = POOLS.allies.find((c) => roleDe(c.rep1) === "frappeur");
const mage = POOLS.allies.find((c) => roleDe(c.rep1) === "mage");
const cle = (c) => `${c.ext}:${c.id}`;

/** Un joueur qui possède la carte, avec des vestiges et des rainbow. */
function etatAvec(c, { vestiges = 1000, normale = 1, rainbow = 0 } = {}) {
  return { ...etatVide(), collections: { [c.ext]: { [c.id]: { normale, rainbow } } }, reliquaire: { vestiges, achats: {}, ouvert: 1 } };
}

describe("fiche : achats", () => {
  test("trois rangs d'ATQ, aux prix de la grille, puis plus rien", () => {
    let e = etatAvec(frappeur);
    for (const prix of PERSONNALISATION.rangs) {
      expect(coutRang(ficheDe(e, frappeur), "atq")).toBe(prix);
      e = acheterRang(e, frappeur, "atq");
    }
    expect(ficheDe(e, frappeur).atq).toBe(3);
    expect(e.reliquaire.vestiges).toBe(1000 - PERSONNALISATION.rangs.reduce((s, x) => s + x, 0));
    expect(coutRang(ficheDe(e, frappeur), "atq")).toBeNull();
    expect(acheterRang(e, frappeur, "atq")).toBeNull();
  });
  test("pas de vestiges, pas d'achat ; pas de carte, pas d'achat", () => {
    expect(acheterRang(etatAvec(frappeur, { vestiges: 10 }), frappeur, "ini")).toBeNull();
    expect(acheterRang(etatAvec(frappeur, { normale: 0, rainbow: 1 }), frappeur, "ini")).toBeNull();
  });
  test("compétence du rôle à moitié prix, retour à l'origine gratuit", () => {
    expect(coutCompetence(frappeur, "execution")).toBe(PERSONNALISATION.tech * PERSONNALISATION.affinite);
    expect(coutCompetence(frappeur, "tempete")).toBe(PERSONNALISATION.tech);
    expect(coutCompetence(frappeur, "estoc")).toBe(PERSONNALISATION.geste * PERSONNALISATION.affinite);
    expect(coutCompetence(frappeur, "lourde")).toBe(0);
    let e = changerCompetence(etatAvec(frappeur), frappeur, "tempete");
    expect(ficheDe(e, frappeur).tech).toBe("tempete");
    expect(e.reliquaire.vestiges).toBe(1000 - PERSONNALISATION.tech);
    e = changerCompetence(e, frappeur, "lourde");
    expect(ficheDe(e, frappeur).tech).toBeUndefined();
    expect(e.reliquaire.vestiges).toBe(1000 - PERSONNALISATION.tech);
    expect(changerCompetence(e, frappeur, "lourde")).toBeNull(); // déjà la sienne
  });
  test("le catalogue met l'origine puis le rôle en tête, et sépare gestes et techniques", () => {
    const l = catalogue(frappeur, "tech");
    expect(l[0].id).toBe(origine(frappeur, "tech"));
    expect(l.every((k) => k.place === "tech")).toBe(true);
    expect(catalogue(frappeur, "geste")[0].id).toBe("attaque");
  });
});

describe("fiche : étoiles", () => {
  test("une rainbow en trop par étoile ; la dernière reste", () => {
    let e = etatAvec(frappeur, { rainbow: 1 });
    expect(rainbowEnTrop(e, frappeur)).toBe(0);
    expect(etoiler(e, frappeur, "atq")).toBeNull();
    e = etatAvec(frappeur, { rainbow: 5 });
    for (const l of ["atq", "ini", "geste", "tech"]) e = etoiler(e, frappeur, l);
    expect(e.collections[frappeur.ext][frappeur.id].rainbow).toBe(1);
    expect(etoilee(ficheDe(e, frappeur))).toBe(true);
    expect(etoiler(e, frappeur, "atq")).toBeNull();
  });
  test("une ligne étoilée est figée", () => {
    let e = etatAvec(frappeur, { rainbow: 3 });
    e = etoiler(e, frappeur, "tech");
    expect(changerCompetence(e, frappeur, "execution")).toBeNull();
    e = etoiler(e, frappeur, "atq");
    expect(acheterRang(e, frappeur, "atq")).toBeNull();
    expect(acheterRang(e, frappeur, "ini")).not.toBeNull();
  });
});

describe("fiche : au combat", () => {
  test("sans fiche, la carte se bat comme avant", () => {
    const a = allie({ uid: 0 }, frappeur, 1), b = allie({ uid: 0 }, frappeur, 1, {});
    expect(b).toEqual(a);
    expect(a.geste).toBeUndefined();
    expect(a.tech).toBeUndefined();
  });
  test("rangs et étoiles changent ATQ et INI", () => {
    const base = allie({ uid: 0 }, frappeur, 1);
    const u = allie({ uid: 0 }, frappeur, 1, { atq: 2, ini: 1, etoiles: { atq: true, ini: true } });
    expect(u.atq).toBe(Math.round((base.atq + 2) * ETOILE.atq));
    expect(u.ini).toBe(base.ini + 1 + ETOILE.ini);
  });
  test("l'INI étoilée joue deux fois au premier tour", () => {
    const fiches = { [cle(frappeur)]: { etoiles: { ini: true } } };
    const p = creerPartie({ equipe: [frappeur, ...POOLS.allies.filter((c) => c !== frappeur).slice(0, 3)], artefact: null, graine: 3, jour: "x", pools: POOLS, fiches });
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    prochain(p, C);
    const u = p.equipe[0];
    expect(C.ordre.filter((x) => x === u.uid)).toHaveLength(2);
    expect(C.ordre[0]).toBe(u.uid);
  });
  test("une technique étoilée frappe plus fort et se recharge plus vite", () => {
    const essai = (etoiles) => {
      const p = creerPartie({ equipe: [frappeur], artefact: null, graine: 3, jour: "x", pools: POOLS, fiches: { [cle(frappeur)]: { etoiles } } });
      const C = demarrerCombat(p, "combat", tirage(1), POOLS);
      const cible = C.ennemis[0];
      cible.pv = cible.pvMax = 999;
      resoudre(p, C, p.equipe[0], "lourde", cible, tirage(7));
      return { degats: 999 - cible.pv, cd: p.equipe[0].cd };
    };
    const a = essai({}), b = essai({ tech: true });
    expect(b.degats).toBeGreaterThan(a.degats * 1.4);
    expect(b.cd).toBe(a.cd - 1);
  });
  test("saignement, piège, voile, marque", () => {
    const fiches = { [cle(frappeur)]: { geste: "entaille" } };
    const p = creerPartie({ equipe: [frappeur, mage], artefact: null, graine: 3, jour: "x", pools: POOLS, fiches });
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    const [m1, m2] = C.ennemis;
    m1.pv = m1.pvMax = 200; m2.pv = m2.pvMax = 200;
    resoudre(p, C, p.equipe[0], "entaille", m1, tirage(2));
    expect(m1.saigne).toBe(2);
    resoudre(p, C, p.equipe[0], "piege", m2, tirage(2));
    expect(m2.etourdi).toBe(1);
    // Au tour suivant, le saignement mord et le piégé passe son tour.
    C.round = 1; C.ordre = [m1.uid, m2.uid, p.equipe[0].uid]; C.idx = -1;
    const avant = m1.pv;
    const u = prochain(p, C);
    expect(m1.pv).toBeLessThan(avant);
    expect(u).toBe(m1);
    expect(prochain(p, C)).toBe(p.equipe[0]); // m2 a perdu son tour
    expect(C.notes.length).toBe(1);
    // Voile : aucun coup ne passe.
    resoudre(p, C, p.equipe[1], "voile", p.equipe[0], tirage(3));
    const pv = p.equipe[0].pv;
    resoudre(p, C, m1, "attaque", p.equipe[0], tirage(3));
    expect(p.equipe[0].pv).toBe(pv);
    // Marque : +50 % de dégâts subis.
    p.equipe[0].atq = 40;
    const coup = (marque) => { const x = { ...m2, pv: 500, pvMax: 500, marque, marqueVal: 0.5, etourdi: 0 }; resoudre(p, C, p.equipe[0], "attaque", x, tirage(9)); return 500 - x.pv; };
    expect(coup(2)).toBeGreaterThan(coup(0) * 1.3);
  });
  test("un saignement qui achève le dernier adversaire clôt le combat", () => {
    const p = creerPartie({ equipe: [frappeur], artefact: null, graine: 3, jour: "x", pools: POOLS });
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    C.ennemis.forEach((e, i) => { if (i) e.ko = true; });
    const m = C.ennemis[0];
    m.pv = 1; m.saigne = 1; m.saigneD = 5;
    C.round = 1; C.ordre = [m.uid, p.equipe[0].uid]; C.idx = -1;
    expect(prochain(p, C)).toBeNull();
    expect(issue(p, C)).toBe("victoire");
  });
  test("toutes les compétences, étoilées ou non, finissent leurs combats au pilote", () => {
    const gestes = Object.values(COMPETENCES).filter((k) => k.place === "geste").map((k) => k.id);
    const techs = Object.values(COMPETENCES).filter((k) => k.place === "tech").map((k) => k.id);
    const r = tirage(42);
    for (let n = 0; n < 120; n++) {
      const equipe = POOLS.allies.slice(n % 20, (n % 20) + 4);
      const fiches = Object.fromEntries(equipe.map((c, i) => [cle(c), {
        geste: gestes[(n + i) % gestes.length], tech: techs[(n * 3 + i) % techs.length],
        atq: n % 4, ini: (n + i) % 4, etoiles: n % 2 ? { atq: true, ini: i % 2 === 0, geste: true, tech: true } : {},
      }]));
      const p = creerPartie({ equipe, artefact: null, graine: n, jour: "x", pools: POOLS, fiches });
      const C = demarrerCombat(p, ["combat", "elite", "boss"][n % 3], r, POOLS);
      let fin = null;
      for (let t = 0; t < 800 && !fin; t++) {
        const u = prochain(p, C);
        if (!u) { fin = issue(p, C); break; }
        const { geste, cible } = u.camp === "e" ? choixIA(p, C, u, r) : choixAuto(p, C, u, ["concentrer", "menace", "prudence"][n % 3]);
        resoudre(p, C, u, geste, cible, r);
        fin = issue(p, C);
      }
      expect(fin).toBeTruthy();
      if (fin === "victoire") victoire(p, C, r, POOLS.artefacts);
      expect(JSON.parse(JSON.stringify(p))).toEqual(p);
    }
  });
  test("une partie d'avant (unités sans geste ni technique) se joue encore", () => {
    const p = creerPartie({ equipe: POOLS.allies.slice(0, 4), artefact: null, graine: 3, jour: "x", pools: POOLS });
    for (const u of p.equipe) { delete u.geste; delete u.tech; delete u.parade; delete u.voile; }
    const C = demarrerCombat(p, "combat", tirage(1), POOLS);
    const u = prochain(p, C);
    const ch = u.camp === "e" ? choixIA(p, C, u, tirage(2)) : choixAuto(p, C, u, "menace");
    expect(() => resoudre(p, C, u, ch.geste, ch.cible, tirage(2))).not.toThrow();
    expect(parUid(p, C, u.uid)).toBe(u);
  });
  test("chaque rôle garde sa technique d'origine", () => {
    for (const [id, R] of Object.entries(ROLES)) {
      expect(COMPETENCES[R.tech].place).toBe("tech");
      expect(COMPETENCES[R.tech].roles).toContain(id);
    }
  });
});

describe("fiche : fusion entre appareils", () => {
  test("rangs additionnés et plafonnés, étoiles acquises, compétence de l'appareil qui l'a changée", () => {
    const k = cle(frappeur);
    const base = { [k]: { atq: 1 } };
    const ici = { [k]: { atq: 2, tech: "execution" } };
    const la = { [k]: { atq: 2, ini: 1, etoiles: { geste: true } } };
    expect(fusionnerFiches(base, ici, la)[k]).toEqual({ atq: 3, ini: 1, tech: "execution", etoiles: { geste: true } });
    expect(fusionnerFiches({}, { [k]: { atq: 3 } }, { [k]: { atq: 3 } })[k].atq).toBe(3);
  });
  test("une ligne étoilée garde la compétence du côté qui l'a étoilée", () => {
    const k = cle(frappeur);
    const r = fusionnerFiches({}, { [k]: { tech: "drain" } }, { [k]: { tech: "execution", etoiles: { tech: true } } });
    expect(r[k].tech).toBe("execution");
  });
  test("fusionner3 passe par la règle des fiches", () => {
    const k = cle(frappeur);
    const vide = etatVide();
    const b = { ...vide, fiches: {} }, i = { ...vide, fiches: { [k]: { ini: 1 } } }, l = { ...vide, fiches: { [k]: { ini: 1 } } };
    expect(fusionner3(b, i, l, vide).fiches[k].ini).toBe(2);
  });
});

describe("STAR RESET", () => {
  test("l'expérience remise à zéro ne revient pas de l'autre appareil", () => {
    const k = cle(mage);
    const base = { [k]: { xp: 500, irisee: true } };
    expect(fusionnerXP(base, { [k]: { xp: 0, remise: 9 } }, { [k]: { xp: 560, irisee: true } })[k]).toEqual({ xp: 0, remise: 9 });
    expect(fusionnerXP({ [k]: { xp: 0, remise: 9 } }, { [k]: { xp: 40, remise: 9 } }, { [k]: { xp: 0, remise: 9 } })[k]).toEqual({ xp: 40, remise: 9 });
  });
  test("fiche remise à l'origine, tous les exemplaires perdus, niveau remis à 1", () => {
    let e = etatAvec(mage, { normale: 9, rainbow: 2 });
    e = { ...e, xp: { [cle(mage)]: { xp: 300 } } };
    e = etoiler(acheterRang(e, mage, "atq"), mage, "tech");
    const r = resetStar(e, mage, 1234);
    expect(r.collections[mage.ext][mage.id]).toMatchObject({ normale: 0, rainbow: 0 });
    expect(ficheDe(r, mage)).toEqual({ remise: 1234 });
    expect(modifiee(ficheDe(r, mage))).toBe(false);
    expect(r.xp[cle(mage)]).toEqual({ xp: 0, remise: 1234 });
    expect(r.reliquaire.vestiges).toBe(e.reliquaire.vestiges);
    expect(resetStar(r, mage)).toBeNull(); // plus de carte
  });
  test("toute carte possédée se remet à zéro, même d'origine ; sans exemplaire, refusé", () => {
    const r = resetStar(etatAvec(mage, { normale: 3 }), mage, 7);
    expect(r.collections[mage.ext][mage.id]).toMatchObject({ normale: 0, rainbow: 0 });
    expect(resetStar(etatAvec(mage, { normale: 0, rainbow: 0 }), mage)).toBeNull();
  });
  test("la fusion garde la remise, les rangs et étoiles de l'autre côté ne reviennent pas", () => {
    const k = cle(mage);
    const base = { [k]: { atq: 2, etoiles: { tech: true } } };
    const ici = { [k]: { remise: 50 } };
    const la = { [k]: { atq: 3, etoiles: { tech: true, ini: true } } };
    expect(fusionnerFiches(base, ici, la)[k]).toEqual({ remise: 50 });
    expect(fusionnerFiches(base, la, ici)[k]).toEqual({ remise: 50 });
    // Après la remise, on rachète : la remise vue des deux côtés n'efface plus rien.
    expect(fusionnerFiches({ [k]: { remise: 50 } }, { [k]: { remise: 50, atq: 1 } }, { [k]: { remise: 50 } })[k]).toEqual({ atq: 1, remise: 50 });
  });
});
