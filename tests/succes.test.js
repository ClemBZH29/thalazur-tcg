/** Succès, sachets offerts, fusion des réclamations et ligne du classement. */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import extension from "../src/extensions/troupe-valeran/extension.js";
import {
  construireCatalogue, evaluer, mesuresExtension, reclamer, resumeClassement, primautes, titresObtenus,
  renommeeDe, cartePreferee, carteDuCatalogue,
} from "../src/succes/regles.js";
import { ligneClassement, nettoyerPseudo, pseudoValide } from "../src/succes/classement.js";
import { fusionner3, fusionnerSucces } from "../src/lib/nuage/fusion.js";
import { etatVide, fusionner } from "../src/lib/storage.js";
import { PJ } from "../src/config/speciales.js";
import { FAVEURS } from "../src/mines/faveur.js";

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
    const e = partie(0, { boosters: { [TROUPE.id]: 27 } });
    const ev = evaluer(CAT, e, null);
    expect(ev.aReclamer).toContain("boosters@25");
    const r = reclamer(CAT, e, ["boosters@25", "boosters@25"], null, 1000);
    expect(r.gagnes).toEqual(["boosters@25"]);
    expect(r.po).toBe(60);
    expect(r.etat.succes["boosters@25"]).toEqual({ t: 1000, po: 60, n: 0, cle: "*" });
    // Réclamé : plus rien à réclamer, un second passage ne paie rien.
    expect(reclamer(CAT, r.etat, ["boosters@25"], null).gagnes).toEqual([]);
  });

  test("un palier non atteint ou inconnu est ignoré", () => {
    const e = partie(0);
    expect(reclamer(CAT, e, ["boosters@25", "rien@1"], null).gagnes).toEqual([]);
  });

  test("les PO passent hors plafond, les sachets de collection vont à l'extension", () => {
    const n = Math.ceil(EXT.roster.length / 2);
    const e = partie(n, { stats: { ventes: 10 } });
    const r = reclamer(CAT, e, [`${TROUPE.id}:completion@50`, "ventes@10"], null);
    expect(r.etat.sachets[TROUPE.id]).toBe(1);
    expect(r.po).toBe(30);
    expect(r.etat.bourse.po).toBe(e.bourse.po + 30);
  });

  test("les mesures de la mine viennent de sa sauvegarde", () => {
    const ev = evaluer(CAT, partie(0), { profondeurMax: 5, effondrements: 1 });
    expect(ev.aReclamer).toEqual(expect.arrayContaining(["strate@5", "effondrements@1"]));
  });

  test("un seuil déplacé sous un palier déjà payé ne se repaie pas", () => {
    // Réclamé sous l'ancien barème : la strate 12 couvre les nouveaux 5, 8,
    // 11, et 13 qui n'est qu'à une strate au-dessus.
    const e = partie(0, { succes: { "strate@12": { t: 1, po: 720, n: 0, cle: "*" } } });
    const ev = evaluer(CAT, e, { profondeurMax: 16 });
    expect(ev.aReclamer).toContain("strate@15");
    for (const s of [5, 8, 11, 13]) expect(ev.aReclamer).not.toContain(`strate@${s}`);
  });

  test("réclamer un palier haut avant le bas laisse le bas à réclamer", () => {
    // Les deux seuils sont au barème actuel : réclamer 100 ne doit pas
    // marquer 25 comme payé sans l'avoir payé.
    const e = partie(0, { boosters: { [TROUPE.id]: 120 } });
    const r = reclamer(CAT, e, ["boosters@100"], null);
    expect(r.gagnes).toEqual(["boosters@100"]);
    expect(evaluer(CAT, r.etat, null).aReclamer).toContain("boosters@25");
    const r2 = reclamer(CAT, r.etat, ["boosters@25"], null);
    expect(r2.gagnes).toEqual(["boosters@25"]);
    expect(r2.etat.sachets["*"]).toBe(1);
    expect(r2.po).toBe(60);
  });

  test("un roster qui grandit ne repaie pas un palier de type déjà réclamé", () => {
    // Quatre PNJ de plus : les seuils en part du type glissent d'une carte
    // ou deux, et l'identifiant du palier change avec eux.
    const plus = [901, 902, 903, 904].map((n) => [String(n), `Ajout ${n}`, "", "Commune", "Ajout", "", "", "", ""]);
    const GRAND = { ...TROUPE, roster: { ...roster, lignes: [...roster.lignes, ...plus] } };
    const CAT2 = construireCatalogue([GRAND]);
    const fam = (cat) => cat.extensions[0].familles.find((f) => f.id === `${TROUPE.id}:type-pnj`);
    const avant = fam(CAT).paliers[2], apres = fam(CAT2).paliers[2];
    expect(apres.id).not.toBe(avant.id);
    // Une partie qui possède assez de PNJ pour les deux seuils.
    const pnj = EXT.roster.filter((c) => c.type === "pnj").slice(0, apres.seuil);
    const coll = Object.fromEntries(pnj.map((c) => [c.id, { normale: 1, rainbow: 0 }]));
    const e = { ...etatVide(), collections: { [TROUPE.id]: coll } };
    const r = reclamer(CAT, e, evaluer(CAT, e, null).aReclamer, null);
    expect(r.gagnes).toContain(avant.id);
    expect(evaluer(CAT2, r.etat, null).aReclamer).not.toContain(apres.id);
  });

  test("le titre d'un palier « tous » survit à la croissance du roster", () => {
    const plus = [["901", "Ajout", "", "Commune", "Ajout", "", "", "", ""]];
    const GRAND = { ...TROUPE, roster: { ...roster, lignes: [...roster.lignes, ...plus] } };
    const CAT2 = construireCatalogue([GRAND]);
    const e = partie(EXT.roster.length);
    const r = reclamer(CAT, e, evaluer(CAT, e, null).aReclamer, null).etat;
    const titres = titresObtenus(CAT2, r).map((t) => t.titre);
    expect(titres).toContain(`Physionomiste de ${TROUPE.titre}`);
  });

  test("un titre se gagne en réclamant son palier", () => {
    const e = partie(EXT.roster.length);
    expect(titresObtenus(CAT, e)).toEqual([]);
    const r = reclamer(CAT, e, evaluer(CAT, e, null).aReclamer, null);
    const titres = titresObtenus(CAT, r.etat).map((t) => t.titre);
    expect(titres).toContain(`Archiviste de ${TROUPE.titre}`);
  });
});

describe("barème du 09/10/2026", () => {
  test("chaque famille globale appartient à un chapitre du grimoire", () => {
    const ids = new Set(CAT.chapitres.map((c) => c.id));
    for (const f of CAT.global) expect(ids.has(f.chapitre)).toBe(true);
    for (const f of EXT.familles) expect(f.chapitre).toBe(TROUPE.id);
  });

  test("« tous » suit les PJ et l'arbre du Fossoyeur", () => {
    const pj = CAT.global.find((f) => f.id === "pj").paliers.at(-1);
    const fav = CAT.global.find((f) => f.id === "faveurs").paliers.at(-1);
    expect(pj.seuil).toBe(PJ.length);
    expect(fav.seuil).toBe(FAVEURS.length);
    expect(pj.cache).toBe(true);
  });

  test("chaque palier porte des points de renommée qui suivent sa récompense", () => {
    const p = CAT.parId.get("boosters@2500").palier;
    expect(p.points).toBe(150);
    expect(CAT.parId.get("ventes@10").palier.points).toBe(5);
  });

  test("les mesures nouvelles : commandes, faveurs, record infini, achats, missions", () => {
    const e = partie(0, {
      stats: { commandes: 10, achats: 1, missions: 10, semaines: 4 },
      donjon: { recordInfini: 3 },
    });
    const ev = evaluer(CAT, e, { profondeurMax: 1, effondrements: 0, faveurs: 1 });
    expect(ev.aReclamer).toEqual(expect.arrayContaining([
      "commandes@10", "achats@1", "missions@10", "semaines@4", "infini@3", "faveurs@1",
    ]));
  });

  test("une province se complète avec toutes ses cartes", () => {
    const nakova = EXT.provinces.find((p) => p.id === "nakova");
    expect(nakova.cartes.length).toBeGreaterThanOrEqual(8);
    const coll = Object.fromEntries(nakova.cartes.map((id) => [id, { normale: 1, rainbow: 0 }]));
    const e = { ...etatVide(), collections: { [TROUPE.id]: coll } };
    expect(evaluer(CAT, e, null).aReclamer).toContain(`${TROUPE.id}:province-nakova@${nakova.cartes.length}`);
  });

  test("un titre retiré du barème reste à qui l'avait gagné", () => {
    const e = partie(0, { succes: { "gardiens@15": { t: 1, po: 0, n: 2, cle: "*" } } });
    expect(titresObtenus(CAT, e)).toContainEqual({ id: "gardiens@15", titre: "Pourfendeur de gardiens" });
  });

  test("le set rainbow complet est le dernier palier rainbow", () => {
    const f = EXT.familles.find((x) => x.id === `${TROUPE.id}:irisees`);
    expect(f.paliers.at(-1).seuil).toBe(EXT.roster.length);
    expect(f.paliers.at(-2).seuil).toBe(Math.ceil(EXT.roster.length / 2));
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
      ["boosters", "carte", "eclats", "etage", "extensions", "heures", "premiers", "pseudo", "renommee",
        "score", "strate", "succes", "titre", "ventes"]);
    expect(l.renommee).toBeGreaterThan(0);
    expect(l.carte).toBeNull();
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

  test("les colonnes du classement : éclats, ventes, heures de route, étage de l'infini", () => {
    const e = partie(0, {
      stats: { ventes: 214, heuresExpedition: 96 },
      donjon: { recordInfini: 4, etageMax: 6 },
    });
    const r = resumeClassement(CAT, e, { eclats: 120 });
    expect(r).toMatchObject({ eclats: 120, ventes: 214, heures: 96, etage: 6 });
    // Une partie d'avant le compteur d'étages repart de son record de gardiens.
    expect(resumeClassement(CAT, partie(0, { donjon: { recordInfini: 4 } }), null).etage).toBe(4);
  });

  test("la renommée additionne les points des paliers réclamés", () => {
    const e = partie(0, { boosters: { [TROUPE.id]: 120 } });
    const r = reclamer(CAT, e, ["boosters@25", "boosters@100"], null).etat;
    expect(renommeeDe(CAT, r)).toBe(CAT.parId.get("boosters@25").palier.points + CAT.parId.get("boosters@100").palier.points);
  });

  test("la carte préférée n'est publiée que si elle est encore dans la collection", () => {
    const c = EXT.roster[0];
    const avec = partie(1, { profil: { carte: { ext: TROUPE.id, id: c.id, rainbow: false } } });
    expect(cartePreferee(avec)).toEqual({ ext: TROUPE.id, id: c.id, rainbow: false });
    // Version rainbow demandée sans exemplaire rainbow : rien.
    expect(cartePreferee({ ...avec, profil: { carte: { ext: TROUPE.id, id: c.id, rainbow: true } } })).toBeNull();
    // Vendue depuis : rien.
    expect(cartePreferee(partie(0, { profil: { carte: { ext: TROUPE.id, id: c.id } } }))).toBeNull();
    expect(carteDuCatalogue(CAT, TROUPE.id, c.id).nom).toBe(c.nom);
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
