/** La mise en page du grimoire des Succès (src/succes/grimoire/mise-en-page.js). */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import extension from "../src/extensions/troupe-valeran/extension.js";
import { construireCatalogue, evaluer } from "../src/succes/regles.js";
import { etatVide } from "../src/lib/storage.js";
import {
  GEO_BUREAU, blocsChapitre, construireChapitres, construirePositions, disposerFamille, disposerPage, etatsFamille,
  geoTelephone, hauteurBloc, indexPosition, legendeAttente, libellesRecompense, paginerChapitre, paliersEnAttente,
  texteSeuil, texteValeur, folio,
} from "../src/succes/grimoire/mise-en-page.js";

const roster = JSON.parse(readFileSync(new URL("../src/extensions/troupe-valeran/roster.json", import.meta.url), "utf8"));
const TROUPE = { ...extension, roster };
const CAT = construireCatalogue([TROUPE]);

/** Une réclamation au barème actuel, telle que `reclamer()` l'écrit. */
const reclame = (id) => {
  const p = CAT.parId.get(id).palier;
  return { t: 1, po: p.recompense?.po || 0, n: p.recompense?.sachets || 0 };
};

/** Une partie : des statistiques, la sauvegarde des Mines, des paliers réclamés. */
function etat({ stats = {}, donjon = {}, succes = [], cartes = 0 } = {}) {
  const coll = {};
  for (const c of CAT.extensions[0].roster.slice(0, cartes)) coll[c.id] = { normale: 1, rainbow: 0 };
  return {
    ...etatVide(), stats: { ...etatVide().stats, ...stats }, donjon,
    collections: { [TROUPE.id]: coll },
    succes: Object.fromEntries(succes.map((id) => [id, reclame(id)])),
  };
}
const chapitresDe = (e, mine = { profondeurMax: 13, effondrements: 14 }) =>
  construireChapitres(CAT.chapitres, evaluer(CAT, e, mine));

const MILIEU = etat({
  stats: { gardiens: 61, commandes: 52, expeditions: 72, ventes: 214 },
  donjon: { recordInfini: 4 },
  succes: ["strate@5", "strate@8", "strate@11", "effondrements@1", "gardiens@1", "gardiens@10"],
  cartes: 120,
});

const tousLesPaliers = (chapitres) => chapitres.flatMap((c) => c.familles.flatMap((f) => f.paliers.map((p) => p.id)));
const paliersDesPages = (pages) => pages.flatMap((p) => p.blocs.flatMap((b) =>
  b.famille ? b.famille.paliers.map((x) => x.id) : b.familles.flatMap((f) => f.paliers.map((x) => x.id))));
const GEOS = [GEO_BUREAU, geoTelephone(366, 662), geoTelephone(296, 470), geoTelephone(406, 860)];

describe("chapitres", () => {
  const chapitres = chapitresDe(MILIEU);

  test("les huit chapitres du site, puis un par extension, dans l'ordre du sommaire", () => {
    const ids = chapitres.map((c) => c.id);
    expect(ids.slice(0, -1)).toEqual(CAT.chapitres.map((c) => c.id).filter((id) => CAT.global.some((f) => f.chapitre === id)));
    expect(ids.at(-1)).toBe(TROUPE.id);
  });

  test("le chapitre d'une extension porte son titre et sa nuance", () => {
    const ext = chapitres.at(-1);
    expect(ext.nom).toBe(TROUPE.titre);
    expect(ext.extension).toBe(true);
    expect(ext.picto).toBe("cartes");
    expect(chapitres.filter((c) => c.extension)).toHaveLength(1);
  });

  test("aucun palier perdu, aucun en double", () => {
    const ids = tousLesPaliers(chapitres);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual([...CAT.parId.keys()].sort());
  });

  test("une famille au chapitre inconnu ouvre le sien plutôt que de disparaître", () => {
    const ev = evaluer(CAT, MILIEU, null);
    const egaree = { ...ev.global[0], id: "egaree", chapitre: "inconnu", paliers: ev.global[0].paliers.map((p) => ({ ...p, id: `egaree@${p.seuil}` })) };
    const c = construireChapitres(CAT.chapitres, { ...ev, global: [...ev.global, egaree] });
    expect(c.find((x) => x.id === "inconnu")?.familles).toHaveLength(1);
  });

  test("avancement d'un chapitre, et sourdine d'un module jamais ouvert", () => {
    const mines = chapitres.find((c) => c.id === "mines");
    expect(mines.stats.reclames).toBe(4);
    expect(mines.stats.attente).toBeGreaterThan(0);
    const debutant = chapitresDe(etat(), null);
    expect(debutant.find((c) => c.id === "reliquaire").stats.sourdine).toBe(true);
    expect(chapitres.find((c) => c.id === "mines").stats.sourdine).toBe(false);
  });

  test("les paliers en attente, et la légende qui dit où", () => {
    const att = paliersEnAttente(chapitres);
    expect(att.length).toBe(evaluer(CAT, MILIEU, { profondeurMax: 13, effondrements: 14 }).aReclamer.length);
    expect(legendeAttente(chapitres)).toMatch(/Mines ×\d/);
    const exemple = [{ id: "a", court: "Mines", familles: [{ paliers: [{ id: "1", atteint: true, reclame: false }] }] },
      { id: "b", court: "La Troupe", familles: [{ paliers: [{ id: "2", atteint: true }, { id: "3", atteint: true }] }] }];
    expect(legendeAttente(exemple)).toBe("Mines · La Troupe ×2");
  });
});

describe("récompenses et seuils", () => {
  test("le vocabulaire de l'écran : PO, booster au choix, boosters de l'extension", () => {
    expect(libellesRecompense({ po: 60 }, { extension: false })).toEqual(["60 PO"]);
    expect(libellesRecompense({ sachets: 1 }, { extension: false })).toEqual(["1 booster au choix"]);
    expect(libellesRecompense({ sachets: 3 }, { extension: true, nom: "La Troupe" })).toEqual(["3 boosters de La Troupe"]);
    expect(libellesRecompense({ po: 1200, sachets: 2 }, { extension: false })).toEqual(["1 200 PO", "2 boosters au choix"]);
    expect(libellesRecompense({ sachets: 1 }, {}).join(" ")).not.toMatch(/sachet/);
  });

  test("états d'une famille : sceau, prêt, proche, puis loin", () => {
    const f = { valeur: 52, paliers: [
      { seuil: 10, atteint: true, reclame: true }, { seuil: 50, atteint: true, reclame: false },
      { seuil: 200, atteint: false }, { seuil: 500, atteint: false },
    ] };
    expect(etatsFamille(f)).toEqual(["scelle", "pret", "proche", "loin"]);
  });
});

describe("exploits cachés", () => {
  const infini = (record) => chapitresDe(etat({ donjon: { recordInfini: record } }))
    .find((c) => c.id === "donjon").familles.find((f) => f.id === "infini");

  test("non atteint : ni seuil, ni place sur le chemin, jamais « proche »", () => {
    const f = infini(9);
    const cache = f.paliers.find((p) => p.cache);
    expect(etatsFamille(f).at(-1)).toBe("cache");
    expect(texteSeuil(cache, f)).toBe("");
    const rang = disposerFamille({ type: "famille", famille: f }, GEO_BUREAU.texte, GEO_BUREAU);
    expect(rang.medaillons.at(-1).texte).toBe("");
    expect(rang.medaillons.at(-1).porteTitre).toBe(false);
    // Le trait d'encre s'arrête au dernier palier visible, pas au-delà.
    const avantDernier = rang.medaillons.at(-2).cx;
    expect(rang.chemin.x0 + rang.chemin.frac * rang.chemin.longueur).toBeLessThanOrEqual(avantDernier + 0.01);
    expect(rang.chemin.marque).toBeNull();
  });

  test("une famille entièrement voilée ne montre pas sa valeur", () => {
    const pj = chapitresDe(etat()).find((c) => c.id === "boutique").familles.find((f) => f.id === "pj");
    expect(texteValeur(pj)).toBe("?");
    expect(etatsFamille(pj).every((e) => e === "cache")).toBe(true);
  });

  test("atteint, il se lit comme les autres et se réclame", () => {
    const f = infini(12);
    const cache = f.paliers.find((p) => p.cache);
    expect(etatsFamille(f).at(-1)).toBe("pret");
    expect(texteSeuil(cache, f)).toBe("12");
    expect(texteValeur(f)).toBe("12");
  });
});

describe("familles repliées et provinces", () => {
  const strate = CAT.global.find((f) => f.id === "strate").paliers.map((p) => p.id);
  const fini = etat({ succes: strate });
  const mines = chapitresDe(fini, { profondeurMax: 15 }).find((c) => c.id === "mines");

  test("une famille terminée se replie en une ligne", () => {
    const blocs = blocsChapitre(mines);
    expect(blocs[0]).toMatchObject({ type: "repliee" });
    expect(hauteurBloc(blocs[0], GEO_BUREAU)).toBe(GEO_BUREAU.repliee);
    expect(blocs.slice(1).every((b) => b.type === "famille")).toBe(true);
  });

  test("sauf celle que le joueur vient de finir sous ses yeux", () => {
    expect(blocsChapitre(mines, new Set(["strate"]))[0].type).toBe("famille");
  });

  test("les provinces d'une extension font une seule rangée, repliée quand tout est réclamé", () => {
    const troupe = chapitresDe(MILIEU).at(-1);
    const blocs = blocsChapitre(troupe);
    const prov = blocs.filter((b) => b.type === "provinces");
    expect(prov).toHaveLength(1);
    expect(prov[0].familles.length).toBe(troupe.familles.filter((f) => f.id.includes(":province-")).length);
    const rang = disposerFamille(prov[0], GEO_BUREAU.texte, GEO_BUREAU);
    expect(rang.medaillons.every((m) => m.b >= 44)).toBe(true);
    expect(rang.medaillons.every((m) => m.label.length > 0)).toBe(true);

    const ids = troupe.familles.filter((f) => f.id.includes(":province-")).flatMap((f) => f.paliers.map((p) => p.id));
    const toutes = chapitresDe(etat({ succes: ids, cartes: 120 })).at(-1);
    expect(blocsChapitre(toutes).some((b) => b.type === "provinces-repliee")).toBe(true);
  });
});

describe("pagination", () => {
  const cas = [MILIEU, etat(), etat({ succes: [...CAT.parId.keys()], cartes: 300 })];

  test("chaque palier sur exactement une page, à toutes les tailles d'écran", () => {
    for (const e of cas) {
      for (const geo of GEOS) {
        for (const c of chapitresDe(e)) {
          const pages = paginerChapitre(c, geo);
          const ids = paliersDesPages(pages);
          expect(new Set(ids).size).toBe(ids.length);
          expect(ids.sort()).toEqual(c.familles.flatMap((f) => f.paliers.map((p) => p.id)).sort());
        }
      }
    }
  });

  test("rien ne déborde du bas de la page", () => {
    for (const e of cas) {
      for (const geo of GEOS) {
        for (const c of chapitresDe(e)) {
          for (const page of paginerChapitre(c, geo)) {
            const blocs = disposerPage(page, geo);
            const fond = blocs.length ? Math.max(...blocs.map((b) => b.y + b.h)) : 0;
            expect(fond).toBeLessThanOrEqual(geo.bas + 1);
            const rangs = blocs.filter((b) => b.type === "famille" || b.type === "provinces")
              .map((b) => disposerFamille(b, geo.texte, geo));
            for (const r of rangs) for (const m of r.medaillons) {
              expect(m.cx - m.b / 2).toBeGreaterThanOrEqual(0);
              expect(m.cx + m.b / 2).toBeLessThanOrEqual(geo.texte + 0.01);
            }
          }
        }
      }
    }
  });

  test("au bureau, les pages vont par deux ; le chapitre long en prend plusieurs", () => {
    for (const c of chapitresDe(MILIEU)) {
      const pages = paginerChapitre(c, GEO_BUREAU);
      expect(pages.length % 2).toBe(0);
      expect(pages.every((p) => p.n === pages.length)).toBe(true);
    }
    const troupe = paginerChapitre(chapitresDe(MILIEU).at(-1), GEO_BUREAU);
    expect(troupe.length).toBeGreaterThanOrEqual(4);
    expect(folio(troupe[1])).toBe(`2 / ${troupe.length}`);
  });

  test("un chapitre achevé : ses lignes repliées, et la page de fin en regard", () => {
    const ids = CAT.global.filter((f) => f.chapitre === "routes").flatMap((f) => f.paliers.map((p) => p.id));
    const routes = chapitresDe(etat({ succes: ids })).find((c) => c.id === "routes");
    expect(routes.stats.acheve).toBe(true);
    const pages = paginerChapitre(routes, GEO_BUREAU);
    expect(pages.map((p) => p.type)).toEqual(["chapitre", "fin"]);
    expect(pages[0].blocs.every((b) => b.type === "repliee")).toBe(true);
  });

  test("stable : mêmes entrées, mêmes pages ; un palier réclamé sous les yeux ne fait rien bouger", () => {
    const avant = chapitresDe(MILIEU);
    expect(construirePositions(avant, GEO_BUREAU)).toEqual(construirePositions(chapitresDe(MILIEU), GEO_BUREAU));

    // On finit « commandes » pendant qu'on lit les Mines : la famille reste dépliée.
    const commandes = CAT.global.find((f) => f.id === "commandes").paliers.map((p) => p.id);
    const apres = chapitresDe(etat({
      stats: { gardiens: 61, commandes: 900, expeditions: 72, ventes: 214 }, donjon: { recordInfini: 4 },
      succes: ["strate@5", "strate@8", "strate@11", "effondrements@1", "gardiens@1", "gardiens@10", ...commandes], cartes: 120,
    }));
    const garde = new Set(avant.find((c) => c.id === "mines").familles.map((f) => f.id));
    const forme = (chs, g) => paginerChapitre(chs.find((c) => c.id === "mines"), GEO_BUREAU, g)
      .map((p) => p.blocs.map((b) => `${b.type}:${b.famille?.id}`));
    expect(forme(apres, garde)).toEqual(forme(avant, garde));
    expect(forme(apres, new Set()).flat()).toContain("repliee:commandes");
  });
});

describe("positions du livre et adresse", () => {
  const chapitres = chapitresDe(MILIEU);

  test("le sommaire d'abord, puis chaque chapitre ; au bureau, des doubles pages", () => {
    const pos = construirePositions(chapitres, GEO_BUREAU);
    expect(pos[0]).toMatchObject({ loc: { chapitre: null, page: 1 }, gauche: { type: "sommaire" }, droite: { type: "exlibris" } });
    expect(pos.filter((p) => p.loc.page === 1).map((p) => p.loc.chapitre)).toEqual([null, ...chapitres.map((c) => c.id)]);
    const tel = construirePositions(chapitres, geoTelephone(366, 662));
    expect(tel[0].page.type).toBe("sommaire-tel");
    expect(tel.length).toBeGreaterThanOrEqual(pos.length);
  });

  test("une adresse de page vaut au bureau comme au téléphone", () => {
    const bureau = construirePositions(chapitres, GEO_BUREAU);
    const tel = construirePositions(chapitres, geoTelephone(366, 662));
    const i = indexPosition(bureau, { chapitre: TROUPE.id, page: 4 });
    expect(bureau[i].loc).toEqual({ chapitre: TROUPE.id, page: 3 });
    expect(bureau[indexPosition(bureau, { chapitre: TROUPE.id, page: 3 })].loc.page).toBe(3);
    expect(tel[indexPosition(tel, { chapitre: "mines", page: 1 })].loc).toEqual({ chapitre: "mines", page: 1 });
  });

  test("une adresse hors du livre retombe sur ses pieds", () => {
    const pos = construirePositions(chapitres, GEO_BUREAU);
    expect(indexPosition(pos, { chapitre: null, page: 1 })).toBe(0);
    expect(indexPosition(pos, { chapitre: "nulle-part", page: 2 })).toBe(0);
    const dernier = pos.map((p, i) => [p, i]).filter(([p]) => p.loc.chapitre === "mines").at(-1)[1];
    expect(indexPosition(pos, { chapitre: "mines", page: 99 })).toBe(dernier);
    expect(pos[indexPosition(pos, { chapitre: "mines", page: 0 })].loc.page).toBe(1);
  });
});
