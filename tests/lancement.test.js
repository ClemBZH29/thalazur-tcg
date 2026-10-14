/**
 * Le lancement du site : phases, remise à zéro de la bêta (format 11), dos
 * de cartes. Les tests tournent en bêta (vite.config.js) ; ceux qui ont
 * besoin du site ouvert le demandent avec `vi.stubEnv` puis rechargent les
 * modules, le format étant une constante de module.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FERMETURE, attenteAffichee, phaseDuBuild } from "../src/config/phases.js";
import { partieJouee, remiseLancement } from "../src/lib/sauvegarde/lancement.js";
import { DOS_DEFAUT, dosChoisi, dosDisponibles, fusionnerDos, gagnerDos } from "../src/config/dos.js";

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

/** Une partie de la bêta, au format 10, bien jouée. */
const beta = () => ({
  schema: 10,
  collections: { "troupe-valeran": { "219-hida": { normale: 3, rainbow: 1 } } },
  boosters: { "troupe-valeran": 42 },
  bourse: { po: 9000, gagne: 12000 },
  profil: { pseudo: "Selsy", classement: true, titre: "maitre-mineur", carte: { ext: "troupe-valeran", id: "219-hida" } },
  reglages: { animations: "reduites", son: { coupe: true, musique: 20, effets: 50 } },
  tafix: { vus: ["accueil"], onglets: [], muet: true },
  succes: { "boosters-10": { t: 1 } },
  donjon: { jour: "2026-10-20", tentatives: 2 },
  mine: { regles: 3, solde: 0 },
});

describe("phases du site", () => {
  test("sans valeur explicite, la phase suit la fermeture", () => {
    expect(phaseDuBuild(undefined, FERMETURE - 1)).toBe("beta");
    expect(phaseDuBuild(undefined, FERMETURE)).toBe("ouvert");
    expect(phaseDuBuild("ferme", 0)).toBe("ferme");
    expect(phaseDuBuild("n'importe", 0)).toBe("beta");
  });

  test("la bêta bascule sur la page d'attente à minuit, le site ouvert jamais", () => {
    expect(attenteAffichee("beta", FERMETURE - 1000)).toBe(false);
    expect(attenteAffichee("beta", FERMETURE)).toBe(true);
    expect(attenteAffichee("ferme", 0)).toBe(true);
    expect(attenteAffichee("ouvert", FERMETURE + 1e9)).toBe(false);
  });

  test("le 25/10/2026 à minuit, heure de Paris", () => {
    expect(new Date(FERMETURE).toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });
});

describe("remise à zéro de la bêta", () => {
  test("une partie jouée repart de zéro avec le dos de l'Éclaireur et l'avis à lire", () => {
    const r = remiseLancement(beta());
    expect(r.collections).toBeUndefined();
    expect(r.boosters).toBeUndefined();
    expect(r.bourse).toBeUndefined();
    expect(r.succes).toBeUndefined();
    expect(r.donjon).toBeUndefined();
    expect(r.mine).toBeUndefined();
    expect(r.dos).toEqual({ gagnes: ["eclaireur"], choisi: "eclaireur" });
    expect(r.lancement).toEqual({ beta: true, avis: "a-lire" });
  });

  test("le pseudo, le classement et les préférences restent ; titre et carte préférée partent", () => {
    const r = remiseLancement(beta());
    expect(r.profil).toEqual({ pseudo: "Selsy", classement: true });
    expect(r.reglages.animations).toBe("reduites");
    expect(r.tafix.muet).toBe(true);
  });

  test("une visite sans booster ni carte ne vaut ni dos ni avis", () => {
    const vide = { schema: 10, collections: {}, boosters: { "troupe-valeran": 0 }, profil: {} };
    expect(partieJouee(vide)).toBe(false);
    const r = remiseLancement(vide);
    expect(r.dos).toBeUndefined();
    expect(r.lancement).toBeUndefined();
  });
});

describe("site ouvert (format 11)", () => {
  let S;
  beforeEach(async () => {
    vi.stubEnv("VITE_SITE_ETAT", "ouvert");
    globalThis.localStorage = stockageFactice();
    vi.resetModules();
    S = await import("../src/lib/storage.js");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  test("le format monte à 11", async () => {
    const { SCHEMA } = await import("../src/lib/sauvegarde/schema.js");
    expect(SCHEMA).toBe(11);
  });

  test("une partie de la bêta lue au chargement est remise, dos compris", () => {
    localStorage.setItem("brume-thalazur:partie", JSON.stringify(beta()));
    const e = S.charger();
    expect(e.schema).toBe(11);
    expect(e.collections).toEqual({});
    expect(Object.keys(e.boosters)).toHaveLength(0);
    expect(e.bourse.po).toBeLessThan(9000);
    expect(e.dos.gagnes).toContain("eclaireur");
    expect(e.lancement.avis).toBe("a-lire");
    expect(e.profil.pseudo).toBe("Selsy");
  });

  test("une partie d'un format plus ancien encore (6) est remise aussi", () => {
    const vieille = { ...beta(), schema: 6 };
    const e = S.relireJeu(vieille);
    expect(e.collections).toEqual({});
    expect(e.dos.gagnes).toEqual(["eclaireur"]);
  });

  test("une partie du format 11 n'est pas touchée", () => {
    const neuve = { ...S.etatVide(), boosters: { "troupe-valeran": 3 }, lancement: { beta: true, avis: "lu" } };
    const e = S.relireJeu(neuve);
    expect(e.boosters["troupe-valeran"]).toBe(3);
    expect(e.lancement.avis).toBe("lu");
  });

  test("la mine et la copie de secours de la bêta qui dorment à côté sont effacées", () => {
    localStorage.setItem("brume-thalazur:mine", JSON.stringify({ schema: 10, regles: 3, brisesTotal: 900 }));
    localStorage.setItem("brume-thalazur:secours", JSON.stringify({ t: 1, jeu: beta() }));
    localStorage.setItem("brume-thalazur:compte-base", JSON.stringify({ etat: beta(), mine: null }));
    S.charger();
    expect(localStorage.getItem("brume-thalazur:mine")).toBe(null);
    expect(localStorage.getItem("brume-thalazur:secours")).toBe(null);
    // La base reste : relue migrée, elle sert à la fusion de l'avis.
    expect(localStorage.getItem("brume-thalazur:compte-base")).not.toBe(null);
  });

  test("une mine de la bêta relue est une galerie neuve, sans solde", async () => {
    const { relireMine } = await import("../src/mines/sauvegarde.js");
    const m = relireMine(JSON.stringify({ schema: 10, regles: 99, brisesTotal: 900, profondeurMax: 40, effondrements: 5, eclats: 300 }));
    expect(m.schema).toBe(11);
    expect(m.brisesTotal).toBe(0);
    expect(m.eclats).toBe(0);
    expect(m.remise).toBe(null);
  });

  test("une mine du format 11 l'emporte sur une mine de la bêta plus avancée", async () => {
    const { comparerMines } = await import("../src/lib/nuage/fusion.js");
    expect(comparerMines({ schema: 11, regles: 3 }, { schema: 10, regles: 3, effondrements: 9, brisesTotal: 900 })).toBeGreaterThan(0);
  });

  test("la copie du compte encore au format 10 se lit remise", async () => {
    const { lireCompte } = await import("../src/jeu/Compte.jsx");
    const doc = { schema: 10, revision: 7, donnees: JSON.stringify(beta()),
      mine: JSON.stringify({ schema: 10, regles: 3, brisesTotal: 900 }) };
    const lu = lireCompte(doc);
    expect(lu.lisible).toBe(true);
    expect(lu.jeu.collections).toEqual({});
    expect(lu.jeu.dos.gagnes).toEqual(["eclaireur"]);
    expect(JSON.parse(lu.mine).brisesTotal ?? 0).toBe(0);
  });

  test("un fichier exporté pendant la bêta s'importe remis : il n'apporte que le dos", async () => {
    const fichier = { text: async () => JSON.stringify({ format: "brume-thalazur", schema: 10, jeu: beta(), mine: null }) };
    const actuel = { ...S.etatVide(), boosters: { "troupe-valeran": 2 } };
    const e = await S.importer(fichier, actuel, "fusion");
    expect(e.boosters["troupe-valeran"]).toBe(2);
    expect(e.collections).toEqual({});
    expect(e.dos.gagnes).toEqual(["eclaireur"]);
  });

  test("fusion de deux appareils : le dos reste gagné, l'avis lu d'un côté l'est", async () => {
    const { fusionner3 } = await import("../src/lib/nuage/fusion.js");
    const base = S.relireJeu(beta());
    const ici = { ...base, lancement: { beta: true, avis: "lu" } };
    const la = S.relireJeu(beta());
    const f = fusionner3(base, ici, la, S.etatVide());
    expect(f.lancement.avis).toBe("lu");
    expect(f.dos.gagnes).toEqual(["eclaireur"]);
  });
});

describe("dos de cartes", () => {
  test("le dos commun est toujours là ; un dos non gagné ne se choisit pas", () => {
    expect(dosChoisi({}).id).toBe(DOS_DEFAUT);
    expect(dosChoisi({ dos: { gagnes: [], choisi: "eclaireur" } }).id).toBe(DOS_DEFAUT);
    expect(dosDisponibles({ dos: { gagnes: ["eclaireur"] } }).map((d) => d.id)).toEqual(["brumes", "eclaireur"]);
  });

  test("gagner un dos ne le double pas, et peut le choisir", () => {
    const e = gagnerDos(gagnerDos({}, "eclaireur"), "eclaireur", { choisir: true });
    expect(e.dos).toEqual({ gagnes: ["eclaireur"], choisi: "eclaireur" });
  });

  test("fusion : union des dos gagnés, le choix changé ici l'emporte", () => {
    const base = { gagnes: [], choisi: null };
    expect(fusionnerDos(base, { gagnes: ["eclaireur"], choisi: "eclaireur" }, { gagnes: [], choisi: null }))
      .toEqual({ gagnes: ["eclaireur"], choisi: "eclaireur" });
    expect(fusionnerDos(base, base, { gagnes: ["eclaireur"], choisi: "brumes" }))
      .toEqual({ gagnes: ["eclaireur"], choisi: "brumes" });
  });
});
