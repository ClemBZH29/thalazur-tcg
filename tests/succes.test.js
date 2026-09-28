/** Succès, sachets offerts, fusion des réclamations et ligne du classement. */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import extension from "../src/extensions/troupe-valeran/extension.js";
import {
  construireCatalogue, evaluer, mesuresExtension, reclamer, resumeClassement, primautes, titresObtenus,
} from "../src/succes/regles.js";
import { ligneClassement, nettoyerPseudo, pseudoValide } from "../src/succes/classement.js";
import { fusionner3, fusionnerSucces } from "../src/lib/nuage/fusion.js";
import { etatVide, fusionner } from "../src/lib/storage.js";

const roster = JSON.parse(readFileSync(new URL("../src/extensions/troupe-valeran/roster.json", import.meta.url), "utf8"));
const TROUPE = { ...extension, roster };
const BIENTOT = { id: "nakova", titre: "Nakova", statut: "bientot", roster: null };
const CAT = construireCatalogue([TROUPE, BIENTOT]);
const EXT = CAT.extensions[0];

/** Une partie qui possède les `n` premières cartes du roster. */
function partie(n, champs = {}) {
  const coll = {};
  for (const c of EXT.roster.slice(0, n)) coll[c.id] = { normale: 1, rainbow: 0, carte: { id: c.id } };
  return { ...etatVide(), collections: { [TROUPE.id]: coll }, ...champs };
}

describe("catalogue", () => {
  test("une extension à venir n'a pas de succès, rien n'en est dévoilé", () => {
    expect(CAT.extensions.map((e) => e.id)).toEqual([TROUPE.id]);
    expect([...CAT.parId.keys()].some((id) => id.startsWith("nakova"))).toBe(false);
  });

  test("les identifiants sont uniques et chaque famille de type finit sur « toutes »", () => {
    const ids = [...CAT.parId.keys()];
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of EXT.familles.filter((x) => x.id.includes(":type-"))) {
      const type = f.id.split("type-")[1];
      const n = EXT.roster.filter((c) => c.type === type).length;
      expect(f.paliers.at(-1).seuil).toBe(n);
      expect(f.paliers.at(-1).titre).toBeTruthy();
    }
  });

  test("les seuils croissent dans chaque famille", () => {
    for (const { famille } of CAT.parId.values()) {
      const s = famille.paliers.map((p) => p.seuil);
      expect([...s].sort((a, b) => a - b)).toEqual(s);
    }
  });
});

describe("mesures", () => {
  test("la complétion arrondit par défaut : 100 % veut dire toutes", () => {
    const n = EXT.roster.length;
    expect(mesuresExtension(EXT, partie(n - 1).collections[TROUPE.id]).pct).toBe(99);
    expect(mesuresExtension(EXT, partie(n).collections[TROUPE.id]).pct).toBe(100);
  });

  test("une irisée seule ne compte pas comme possédée", () => {
    const c = EXT.roster[0];
    const m = mesuresExtension(EXT, { [c.id]: { normale: 0, rainbow: 1 } });
    expect(m.nb).toBe(0);
    expect(m.irisees).toBe(1);
  });
});

describe("réclamation", () => {
  test("un palier atteint se réclame une fois, et paie", () => {
    const e = partie(0, { boosters: { [TROUPE.id]: 12 } });
    const ev = evaluer(CAT, e, null);
    expect(ev.aReclamer).toContain("boosters@10");
    const r = reclamer(CAT, e, ["boosters@10", "boosters@10"], null, 1000);
    expect(r.gagnes).toEqual(["boosters@10"]);
    expect(r.etat.sachets["*"]).toBe(1);
    expect(r.etat.succes["boosters@10"]).toEqual({ t: 1000, po: 0, n: 1, cle: "*" });
    // Réclamé : plus rien à réclamer, un second passage ne paie rien.
    expect(reclamer(CAT, r.etat, ["boosters@10"], null).gagnes).toEqual([]);
  });

  test("un palier non atteint ou inconnu est ignoré", () => {
    const e = partie(0);
    expect(reclamer(CAT, e, ["boosters@10", "rien@1"], null).gagnes).toEqual([]);
  });

  test("les PO passent hors plafond, les sachets de collection vont à l'extension", () => {
    const n = Math.ceil(EXT.roster.length / 4);
    const e = partie(n, { stats: { ventes: 10 } });
    const r = reclamer(CAT, e, [`${TROUPE.id}:completion@25`, "ventes@10"], null);
    expect(r.etat.sachets[TROUPE.id]).toBe(1);
    expect(r.po).toBe(60);
    expect(r.etat.bourse.po).toBe(e.bourse.po + 60);
  });

  test("les mesures de la mine viennent de sa sauvegarde", () => {
    const ev = evaluer(CAT, partie(0), { profondeurMax: 5, effondrements: 1 });
    expect(ev.aReclamer).toEqual(expect.arrayContaining(["strate@3", "strate@5", "effondrements@1"]));
  });

  test("un titre se gagne en réclamant son palier", () => {
    const e = partie(EXT.roster.length);
    expect(titresObtenus(CAT, e)).toEqual([]);
    const r = reclamer(CAT, e, evaluer(CAT, e, null).aReclamer, null);
    const titres = titresObtenus(CAT, r.etat).map((t) => t.titre);
    expect(titres).toContain(`Archiviste de ${TROUPE.titre}`);
  });
});

describe("fusion entre appareils", () => {
  const S = (t, po, n = 0, cle = "*") => ({ t, po, n, cle });

  test("union des réclamations, la date la plus ancienne l'emporte", () => {
    const { succes } = fusionnerSucces({}, { a: S(5, 0), b: S(3, 0) }, { a: S(2, 0), c: S(9, 0) });
    expect(Object.keys(succes).sort()).toEqual(["a", "b", "c"]);
    expect(succes.a.t).toBe(2);
    expect(succes.b.t).toBe(3);
  });

  test("un palier réclamé des deux côtés n'est payé qu'une fois", () => {
    const vide = etatVide();
    const base = { ...vide, bourse: { po: 100, credite: 0, gagne: 0 } };
    const ici = { ...base, succes: { x: S(1, 60, 2, "*") }, sachets: { "*": 2 },
      bourse: { po: 160, credite: 0, gagne: 60 } };
    const la = { ...base, succes: { x: S(2, 60, 2, "*") }, sachets: { "*": 2 },
      bourse: { po: 160, credite: 0, gagne: 60 } };
    const f = fusionner3(base, ici, la, vide);
    expect(f.bourse.po).toBe(160);
    expect(f.sachets["*"]).toBe(2);
    expect(f.succes.x.t).toBe(1);
  });

  test("un sachet ouvert sur un appareil se retire du compte", () => {
    const vide = etatVide();
    const base = { ...vide, sachets: { t: 3 } };
    const f = fusionner3(base, { ...base, sachets: { t: 2 } }, { ...base, sachets: { t: 3 } }, vide);
    expect(f.sachets.t).toBe(2);
  });

  test("un import ne rend pas deux fois les sachets", () => {
    const a = { ...etatVide(), sachets: { "*": 1 }, succes: { x: S(1, 0) } };
    const b = { ...etatVide(), sachets: { "*": 4 }, succes: { y: S(2, 0) }, stats: { ventes: 7 } };
    const f = fusionner(a, b);
    expect(f.sachets["*"]).toBe(1);
    expect(Object.keys(f.succes).sort()).toEqual(["x", "y"]);
    expect(f.stats.ventes).toBe(7);
  });
});

describe("classement", () => {
  test("pseudo : espaces resserrés, invisibles retirés, bornes", () => {
    expect(nettoyerPseudo("  Kaze​da   la  Brave ")).toBe("Kazeda la Brave");
    expect(pseudoValide("a")).toBe(false);
    expect(pseudoValide("Lo")).toBe(true);
    expect(nettoyerPseudo("x".repeat(40))).toHaveLength(24);
  });

  test("la ligne publique ne contient que pseudo, titre et progression", () => {
    const e = partie(EXT.roster.length, { profil: { pseudo: "Siobhan", titre: "absent" } });
    const r = reclamer(CAT, e, evaluer(CAT, e, null).aReclamer, null, 42).etat;
    const titres = titresObtenus(CAT, r);
    const l = ligneClassement(CAT, { ...r, profil: { pseudo: "Siobhan", titre: titres[0].id } }, null, titres);
    expect(Object.keys(l).sort()).toEqual(
      ["boosters", "extensions", "premiers", "pseudo", "score", "strate", "succes", "titre"]);
    expect(l.score).toBe(10000);
    expect(l.premiers[TROUPE.id]).toBe(42);
    expect(l.titre).toBe(titres[0].titre);
    // Un titre non obtenu n'est pas publié.
    expect(ligneClassement(CAT, e, null, []).titre).toBe("");
  });

  test("le score pondère la rareté", () => {
    const leg = EXT.roster.filter((c) => c.tier === "legendaire");
    const com = EXT.roster.filter((c) => c.tier === "commun").slice(0, leg.length);
    const avec = (cartes) => resumeClassement(CAT, {
      ...etatVide(),
      collections: { [TROUPE.id]: Object.fromEntries(cartes.map((c) => [c.id, { normale: 1 }])) },
    }, null).score;
    expect(avec(leg)).toBeGreaterThan(avec(com) * 7);
  });

  test("la première complétion revient à la date la plus ancienne", () => {
    const p = primautes(CAT, [
      { uid: "a", premiers: { [TROUPE.id]: 50 } },
      { uid: "b", premiers: { [TROUPE.id]: 20 } },
      { uid: "c", premiers: {} },
    ]);
    expect(p[TROUPE.id].uid).toBe("b");
  });
});
