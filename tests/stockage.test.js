/**
 * Le stockage local : relecture des types, format futur (gel), copie de
 * secours. Node n'a pas de `localStorage` : une Map en tient lieu.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SCHEMA } from "../src/lib/sauvegarde/schema.js";

function stockageFactice() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    get length() { return m.size; },
  };
}

let S; // module storage.js, rechargé à chaque test (le gel est un état de module)
let G;
beforeEach(async () => {
  globalThis.localStorage = stockageFactice();
  vi.resetModules();
  S = await import("../src/lib/storage.js");
  G = await import("../src/lib/gel.js");
});

const partie = (cartes, extra = {}) => ({
  ...S.etatVide(),
  collections: { "troupe-valeran": Object.fromEntries(Object.entries(cartes).map(([id, n]) => [id, { normale: n, rainbow: 0 }])) },
  ...extra,
});

describe("relireJeu : types", () => {
  test("une collection null reprend sa valeur par défaut", () => {
    const j = S.relireJeu({ schema: SCHEMA, collections: null, boosters: "x", enCours: 3 });
    expect(j.collections).toEqual({});
    expect(j.boosters).toEqual({});
    expect(j.enCours).toBe(null);
  });

  test("un champ nul par défaut accepte un objet ou null", () => {
    const j = S.relireJeu({ schema: SCHEMA, donjon: { jour: "2026-10-09" }, missions: null });
    expect(j.donjon).toEqual({ jour: "2026-10-09" });
    expect(j.missions).toBe(null);
  });

  test("un tableau n'est pas pris pour un objet", () => {
    expect(S.relireJeu({ schema: SCHEMA, collections: [] }).collections).toEqual({});
  });

  test("la bourse ne garde que des nombres finis", () => {
    const j = S.relireJeu({ schema: SCHEMA, bourse: { po: "100", credite: null, gagne: Infinity } });
    expect(j.bourse.po).toBe(100);
    expect(Number.isFinite(j.bourse.credite)).toBe(true);
    expect(j.bourse.gagne).toBe(0);
    expect(S.relireJeu({ schema: SCHEMA, bourse: { po: "abc" } }).bourse.po).toBe(S.etatVide().bourse.po);
    expect(S.relireJeu({ schema: SCHEMA, bourse: 12 }).bourse.po).toBe(S.etatVide().bourse.po);
  });
});

describe("format futur : l'onglet en retard ne réécrit plus", () => {
  test("classerTexte distingue ancien, courant et futur", () => {
    expect(S.classerTexte(null)).toBe("absent");
    expect(S.classerTexte("{")).toBe("illisible");
    expect(S.classerTexte(JSON.stringify({ schema: SCHEMA - 1 }))).toBe("ancien");
    expect(S.classerTexte(JSON.stringify({ schema: SCHEMA }))).toBe("courant");
    expect(S.classerTexte(JSON.stringify({ schema: SCHEMA + 1 }))).toBe("futur");
  });

  test("charger() sur une partie future ne l'écrase pas et gèle l'onglet", () => {
    const futur = JSON.stringify({ ...partie({ a: 5 }), schema: SCHEMA + 1 });
    localStorage.setItem(S.CLE_PARTIE, futur);
    const etat = S.charger();
    expect(G.estGele()).toBe(true);
    S.sauver(etat);
    expect(localStorage.getItem(S.CLE_PARTIE)).toBe(futur);
  });

  test("charger() sur une mine future gèle aussi", () => {
    localStorage.setItem(S.CLE_MINE, JSON.stringify({ schema: SCHEMA + 1 }));
    S.charger();
    expect(G.estGele()).toBe(true);
  });

  test("gelé, ni la partie ni la mine ne s'écrivent", async () => {
    G.geler("onglet");
    S.sauver(partie({ a: 1 }));
    await S.magasinKazim.set("{}");
    S.ecrireMine("{}");
    expect(localStorage.getItem(S.CLE_PARTIE)).toBe(null);
    expect(localStorage.getItem(S.CLE_MINE)).toBe(null);
  });

  test("une partie courante ne gèle pas", () => {
    localStorage.setItem(S.CLE_PARTIE, JSON.stringify(partie({ a: 2 })));
    expect(S.charger().collections["troupe-valeran"].a.normale).toBe(2);
    expect(G.estGele()).toBe(false);
  });
});

describe("copie de secours", () => {
  test("effacer() emporte la copie de secours", () => {
    localStorage.setItem(S.CLE_SECOURS, JSON.stringify({ jeu: partie({ a: 3 }) }));
    S.effacer();
    expect(localStorage.getItem(S.CLE_SECOURS)).toBe(null);
  });

  test("restaurer la copie prend le maximum carte par carte, puis l'efface", () => {
    const actuel = partie({ a: 9, b: 1 }, { boosters: { "troupe-valeran": 4 } });
    const copie = { format: "brume-thalazur", schema: SCHEMA, jeu: partie({ a: 10, c: 2 }, { boosters: { "troupe-valeran": 5 } }), mine: null };
    localStorage.setItem(S.CLE_SECOURS, JSON.stringify(copie));
    const { jeu } = S.restaurerSecours(actuel, S.lireSecours());
    const coll = jeu.collections["troupe-valeran"];
    expect(coll.a.normale).toBe(10);
    expect(coll.b.normale).toBe(1);
    expect(coll.c.normale).toBe(2);
    expect(jeu.boosters["troupe-valeran"]).toBe(5);
    expect(S.lireSecours()).toBe(null);
    // Un second clic n'a plus rien à restaurer : pas de 10 + 10.
    expect(S.restaurerSecours(jeu, S.lireSecours())).toBe(null);
  });

  test("restaurer garde la mine la plus avancée", () => {
    localStorage.setItem(S.CLE_MINE, JSON.stringify({ schema: SCHEMA, regles: 2, effondrements: 3 }));
    const copie = { jeu: partie({ a: 1 }), mine: { schema: SCHEMA, regles: 2, effondrements: 1 } };
    const { mine } = S.restaurerSecours(partie({}), copie);
    expect(mine).toBe(null); // la mine en cours est plus avancée : rien à écrire
  });
});

describe("import de fichier en fusion", () => {
  const fichier = (o) => ({ text: async () => JSON.stringify(o) });

  test("les exemplaires s'additionnent (sens voulu de l'import)", async () => {
    const f = fichier({ format: "brume-thalazur", schema: SCHEMA, jeu: partie({ a: 2 }), mine: null });
    const j = await S.importer(f, partie({ a: 3 }), "fusion");
    expect(j.collections["troupe-valeran"].a.normale).toBe(5);
  });

  test("la mine du fichier n'écrase pas une mine plus avancée", async () => {
    const enCours = JSON.stringify({ schema: SCHEMA, regles: 2, effondrements: 4 });
    localStorage.setItem(S.CLE_MINE, enCours);
    const f = fichier({ format: "brume-thalazur", schema: SCHEMA, jeu: partie({}), mine: { schema: SCHEMA, regles: 2, effondrements: 1 } });
    await S.importer(f, partie({}), "fusion");
    expect(JSON.parse(S.magasinKazim.voir()).effondrements).toBe(4);
  });

  test("en remplacement, la mine du fichier s'impose", async () => {
    localStorage.setItem(S.CLE_MINE, JSON.stringify({ schema: SCHEMA, regles: 2, effondrements: 4 }));
    const f = fichier({ format: "brume-thalazur", schema: SCHEMA, jeu: partie({}), mine: { schema: SCHEMA, regles: 2, effondrements: 1 } });
    await S.importer(f, partie({}), "remplacement");
    expect(JSON.parse(S.magasinKazim.voir()).effondrements).toBe(1);
  });
});
