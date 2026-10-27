/**
 * La remise des Mines par Azel le Destructeur (format 12). Comme
 * `lancement.test.js`, ces tests demandent le site ouvert (`vi.stubEnv`) puis
 * rechargent les modules : le format est une constante de module.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { aJoueAuxMines, remiseJeuAzel } from "../src/lib/sauvegarde/azel.js";
import { REMISE_MINES, remiseEnAttente } from "../src/config/remises.js";

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

/** Une partie du site ouvert (format 11) qui a joué aux Mines. */
const mineur = () => ({
  schema: 11,
  boosters: { "troupe-valeran": 40 },
  bourse: { po: 720, gagne: 3027 },
  profil: { pseudo: "Mormegil", classement: true, titre: "strate@16" },
  tafix: { vus: ["arrivee", "filon1", "commandes"], onglets: ["compagnons", "commandes"], muet: false },
  succes: {
    "strate@5": { t: 1, po: 60, n: 0, cle: "*" },
    "effondrements@1": { t: 2, po: 60, n: 0, cle: "*" },
    "faveurs@6": { t: 3, po: 0, n: 2, cle: "*" },
    "commandes@1": { t: 4, po: 30, n: 0, cle: "*" },
    "boosters@25": { t: 5, po: 60, n: 0, cle: "*" },
  },
  stats: { commandes: 6, poMine: 460, descentes: 4 },
  mine: { regles: 3, livre: { jour: "2026-10-26", po: 230 } },
  lancement: { beta: true, avis: "lu", t: 1 },
});

/** Une partie de la bêta (format 10), jamais revenue depuis le lancement. */
const beta = () => ({
  schema: 10,
  collections: { "troupe-valeran": { "219-hida": { normale: 3, rainbow: 1 } } },
  boosters: { "troupe-valeran": 42 },
  bourse: { po: 9000, gagne: 12000 },
  profil: { pseudo: "Selsy", classement: true },
  tafix: { vus: ["arrivee", "filon1", "commandes"], onglets: [], muet: false },
  succes: { "strate@8": { t: 1 } },
  stats: { commandes: 30 },
});

describe("ce que la remise d'Azel retire (fonctions pures)", () => {
  test("les succès de strate, d'effondrement et de faveurs partent ; commandes et le reste restent", () => {
    const r = remiseJeuAzel(mineur());
    expect(Object.keys(r.succes).sort()).toEqual(["boosters@25", "commandes@1"]);
    expect(r.stats).toEqual({ commandes: 6, poMine: 460, descentes: 4 });
    expect(r.bourse.po).toBe(720);
    expect(r.mine).toEqual({ regles: 3, livre: { jour: "2026-10-26", po: 230 } });
  });

  test("le titre tiré d'un succès des Mines part, un autre reste", () => {
    expect(remiseJeuAzel(mineur()).profil.titre).toBeUndefined();
    const autre = { ...mineur(), profil: { pseudo: "M", titre: "boosters@25" } };
    expect(remiseJeuAzel(autre).profil.titre).toBe("boosters@25");
  });

  test("Azel ne se montre qu'à qui a joué aux Mines", () => {
    expect(remiseJeuAzel(mineur()).azel).toEqual({ [REMISE_MINES]: "a-lire" });
    const jamais = { schema: 11, boosters: { "troupe-valeran": 3 }, tafix: { vus: ["arrivee"] } };
    expect(remiseJeuAzel(jamais).azel).toBeUndefined();
    // Un filon brisé suffit, sans succès ni commande.
    expect(aJoueAuxMines({ tafix: { vus: ["filon1"] } })).toBe(true);
  });

  test("bêta-testeur : les conseils de Tafix de la bêta ne comptent pas, ses succès d'après le lancement si", () => {
    const revenu = { schema: 11, lancement: { beta: true, avis: "lu" }, tafix: { vus: ["filon1"] } };
    expect(aJoueAuxMines(revenu)).toBe(false);
    expect(aJoueAuxMines({ ...revenu, succes: { "strate@5": { t: 1 } } })).toBe(true);
    expect(aJoueAuxMines({ ...revenu, stats: { commandes: 1 } })).toBe(true);
  });

  test("l'écran en attente est la première remise à lire", () => {
    expect(remiseEnAttente({ azel: { [REMISE_MINES]: "a-lire" } })?.id).toBe(REMISE_MINES);
    expect(remiseEnAttente({ azel: { [REMISE_MINES]: "lu" } })).toBe(null);
    expect(remiseEnAttente({})).toBe(null);
  });
});

describe("site ouvert (format 12)", () => {
  let S;
  beforeEach(async () => {
    vi.stubEnv("VITE_SITE_ETAT", "ouvert");
    globalThis.localStorage = stockageFactice();
    vi.resetModules();
    S = await import("../src/lib/storage.js");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  test("le format monte à 12", async () => {
    const { SCHEMA } = await import("../src/lib/sauvegarde/schema.js");
    expect(SCHEMA).toBe(12);
  });

  test("une partie du format 11 qui a joué aux Mines est remise au chargement, écran à lire", () => {
    localStorage.setItem("brume-thalazur:partie", JSON.stringify(mineur()));
    const e = S.charger();
    expect(e.schema).toBe(12);
    expect(e.azel[REMISE_MINES]).toBe("a-lire");
    expect(e.succes["strate@5"]).toBeUndefined();
    expect(e.succes["boosters@25"]).toBeDefined();
    expect(e.boosters["troupe-valeran"]).toBe(40);
  });

  test("relue une seconde fois, une partie remise ne bouge plus ; un écran lu ne revient pas", () => {
    const une = S.relireJeu(mineur());
    const lue = { ...une, azel: { [REMISE_MINES]: "lu" }, succes: { ...une.succes, "strate@5": { t: 9 } } };
    const deux = S.relireJeu(lue);
    expect(deux.azel[REMISE_MINES]).toBe("lu");
    // Un succès regagné après la remise reste : la remise ne se rejoue pas.
    expect(deux.succes["strate@5"]).toEqual({ t: 9 });
  });

  test("bêta-testeur pas encore reconnecté : l'avis du lancement seul, et une galerie neuve", async () => {
    localStorage.setItem("brume-thalazur:partie", JSON.stringify(beta()));
    localStorage.setItem("brume-thalazur:mine", JSON.stringify({ schema: 10, regles: 3, brisesTotal: 900 }));
    const e = S.charger();
    expect(e.schema).toBe(12);
    expect(e.lancement.avis).toBe("a-lire");
    expect(e.azel).toBe(null);
    expect(e.succes).toEqual({});
    expect(localStorage.getItem("brume-thalazur:mine")).toBe(null);
    const { relireMine } = await import("../src/mines/sauvegarde.js");
    const m = relireMine(JSON.stringify({ schema: 10, regles: 3, brisesTotal: 900, eclats: 300 }));
    expect(m.brisesTotal).toBe(0);
    expect(m.eclats).toBe(0);
    expect(m.remise).toBe(null);
  });

  test("bêta-testeur pas reconnecté qui a joué aux Mines ailleurs depuis : les deux écrans, l'un après l'autre", async () => {
    const { fusionner3 } = await import("../src/lib/nuage/fusion.js");
    // Cet appareil : la partie de la bêta et la dernière copie du compte qu'il a vue, toutes deux de la bêta.
    const ici = S.relireJeu(beta());
    const base = S.relireJeu(beta());
    // Le compte aujourd'hui : la partie jouée depuis sur un autre appareil, au format 11.
    const la = S.relireJeu(mineur());
    const f = fusionner3(base, ici, la, S.etatVide());
    expect(f.lancement.avis).toBe("lu");
    expect(f.azel[REMISE_MINES]).toBe("a-lire");
    expect(f.succes["strate@5"]).toBeUndefined();
  });

  test("une mine du format 11 relue est une galerie neuve, sans écran de Tafix", async () => {
    const { relireMine } = await import("../src/mines/sauvegarde.js");
    const m = relireMine(JSON.stringify({ schema: 11, regles: 3, brisesTotal: 1445, profondeurMax: 15, effondrements: 24, eclats: 211, faveurs: ["plans"] }));
    expect(m.schema).toBe(12);
    expect(m.brisesTotal).toBe(0);
    expect(m.eclats).toBe(0);
    expect(m.faveurs).toEqual([]);
    expect(m.remise).toBe(null);
  });

  test("une mine remise l'emporte sur toute mine d'avant, si avancée soit-elle", async () => {
    const { comparerMines } = await import("../src/lib/nuage/fusion.js");
    const avant = { schema: 11, regles: 3, effondrements: 24, brisesTotal: 1445, etoileTotale: 6e16 };
    expect(comparerMines({ schema: 12, regles: 3 }, avant)).toBeGreaterThan(0);
    expect(comparerMines(avant, { schema: 12, regles: 3 })).toBeLessThan(0);
  });

  test("la mine d'avant qui dort dans le navigateur est effacée au chargement", () => {
    localStorage.setItem("brume-thalazur:partie", JSON.stringify(mineur()));
    localStorage.setItem("brume-thalazur:mine", JSON.stringify({ schema: 11, regles: 3, brisesTotal: 1445 }));
    S.charger();
    expect(localStorage.getItem("brume-thalazur:mine")).toBe(null);
  });

  test("la copie du compte encore au format 11 se lit remise, mine comprise", async () => {
    const { lireCompte } = await import("../src/jeu/Compte.jsx");
    const doc = { schema: 11, revision: 3, donnees: JSON.stringify(mineur()),
      mine: JSON.stringify({ schema: 11, regles: 3, brisesTotal: 1445, eclats: 211 }) };
    const lu = lireCompte(doc);
    expect(lu.lisible).toBe(true);
    expect(lu.jeu.azel[REMISE_MINES]).toBe("a-lire");
    expect(JSON.parse(lu.mine).eclats ?? 0).toBe(0);
  });

  test("deux appareils : l'écran lu sur l'un ne revient pas sur l'autre", async () => {
    const { fusionner3 } = await import("../src/lib/nuage/fusion.js");
    const base = S.relireJeu(mineur());
    const ici = { ...base, azel: { [REMISE_MINES]: "lu" } };
    const la = S.relireJeu(mineur());
    expect(fusionner3(base, ici, la, S.etatVide()).azel[REMISE_MINES]).toBe("lu");
    expect(fusionner3(base, la, ici, S.etatVide()).azel[REMISE_MINES]).toBe("lu");
  });
});
