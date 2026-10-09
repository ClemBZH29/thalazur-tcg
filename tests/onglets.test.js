/**
 * Plusieurs onglets sur le même navigateur : numéro d'écriture de la partie,
 * gain passif d'un onglet caché, mine en retard (src/lib/storage.js,
 * src/jeu/onglets.js). Signalé le 09/10/2026 : un booster ouvert
 * disparaissait, ses PO revenaient, parce qu'un autre onglet avait réécrit
 * une copie plus ancienne de la partie.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { mineMoinsAvancee, seuleLaBourse } from "../src/jeu/onglets.js";
import { signature } from "../src/lib/nuage/fusion.js";
import { SCHEMA } from "../src/lib/sauvegarde/schema.js";

function stockageFactice() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

let S;
beforeEach(async () => {
  globalThis.localStorage = stockageFactice();
  vi.resetModules();
  S = await import("../src/lib/storage.js");
});

describe("numéro d'écriture", () => {
  test("chaque écriture monte, et une copie plus ancienne n'est pas plus récente", () => {
    const e = S.etatVide();
    S.sauver({ ...e, boosters: { t: 1 } });
    const premiere = S.lireEcriture(localStorage.getItem(S.CLE_PARTIE));
    S.sauver({ ...e, boosters: { t: 2 } });
    const seconde = S.lireEcriture(localStorage.getItem(S.CLE_PARTIE));
    expect(seconde.n).toBe(premiere.n + 1);
    // L'onglet en retard réécrit sa copie avec le numéro qu'il avait lu.
    expect(S.plusRecente(premiere)).toBe(false);
    expect(S.plusRecente(seconde)).toBe(false); // la nôtre, déjà vue
    expect(S.plusRecente({ n: seconde.n + 1, onglet: "zz" })).toBe(true);
  });

  test("une écriture sans numéro (ancien code) n'est jamais adoptée", () => {
    expect(S.plusRecente(null)).toBe(false);
    expect(S.lireEcriture(JSON.stringify({ schema: 9, boosters: {} }))).toBe(null);
  });

  test("le chargement retient le numéro : la prochaine écriture le dépasse", () => {
    localStorage.setItem(S.CLE_PARTIE, JSON.stringify({ ...S.etatVide(), ecriture: { n: 41, onglet: "a" } }));
    S.charger();
    expect(S.plusRecente({ n: 41, onglet: "a" })).toBe(false); // la copie qu'on a lue
    S.sauver({ ...S.etatVide(), boosters: { t: 1 } });
    expect(S.lireEcriture(localStorage.getItem(S.CLE_PARTIE)).n).toBe(42);
  });

  test("à numéro égal, exactement un des deux onglets cède", () => {
    const a = { n: 7, onglet: "aaa" }, b = { n: 7, onglet: "bbb" };
    // Vu de A (qui a écrit a) : adopte b ? Vu de B : adopte a ?
    const aAdopte = S.plusRecente(b, a, "aaa");
    const bAdopte = S.plusRecente(a, b, "bbb");
    expect(aAdopte !== bAdopte).toBe(true);
  });

  test("la réécriture d'une partie adoptée telle quelle ne crée pas d'écriture", () => {
    const texte = JSON.stringify({ ...S.etatVide(), schema: SCHEMA, ecriture: { n: 3, onglet: "x" } });
    localStorage.setItem(S.CLE_PARTIE, texte);
    S.sauver(JSON.parse(texte), texte);
    expect(localStorage.getItem(S.CLE_PARTIE)).toBe(texte);
  });

  test("un onglet qui adopte la partie d'un autre ne la réécrit pas (pas de va-et-vient)", async () => {
    S.sauver({ ...S.etatVide(), boosters: { t: 3 }, collections: { t: { a: { normale: 2, rainbow: 1 } } } });
    const texte = localStorage.getItem(S.CLE_PARTIE);
    vi.resetModules();
    const B = await import("../src/lib/storage.js"); // l'autre onglet
    expect(B.plusRecente(B.lireEcriture(texte))).toBe(true);
    B.noterEcriture(B.lireEcriture(texte));
    B.sauver(B.relireJeu(JSON.parse(texte)), texte);
    expect(localStorage.getItem(B.CLE_PARTIE)).toBe(texte);
  });

  test("le numéro ne compte pas pour la synchronisation", () => {
    const e = S.etatVide();
    expect(signature({ ...e, ecriture: { n: 1, onglet: "a" } }, null)).toBe(signature({ ...e, ecriture: { n: 9, onglet: "b" } }, null));
  });
});

describe("onglet caché, mine en retard", () => {
  test("seul le gain passif a changé", () => {
    const e = { bourse: { po: 1 }, collections: {}, boosters: {} };
    expect(seuleLaBourse(e, { ...e, bourse: { po: 2 } })).toBe(true);
    expect(seuleLaBourse(e, { ...e, boosters: { t: 1 } })).toBe(false);
  });

  test("une mine moins avancée que celle qu'elle recouvre", () => {
    const m = (brises) => JSON.stringify({ regles: 3, effondrements: 0, brisesTotal: brises, etoileTotale: 0 });
    expect(mineMoinsAvancee(m(10), m(50))).toBe(true);
    expect(mineMoinsAvancee(m(60), m(50))).toBe(false);
    expect(mineMoinsAvancee(m(10), null)).toBe(false);
  });
});

describe("écritures concurrentes", () => {
  test("une écriture numérote au-dessus de ce qui est stocké, même sans l'avoir vu", async () => {
    // Un autre onglet a écrit n = 5 ; l'événement n'est pas encore arrivé ici.
    localStorage.setItem(S.CLE_PARTIE, JSON.stringify({ ...S.etatVide(), schema: SCHEMA, ecriture: { n: 5, onglet: "zz" } }));
    S.sauver({ ...S.etatVide(), boosters: { t: 1 } });
    expect(S.lireEcriture(localStorage.getItem(S.CLE_PARTIE)).n).toBe(6);
  });
});

describe("Donjon : une copie plus ancienne de la descente", () => {
  test("ne la fait pas reculer et ne se la fait pas payer", async () => {
    const { sauver, terminer } = await import("../src/jeu/donjon.js");
    const jour = new Date().toLocaleDateString("sv");
    const avancee = { id: "d1", pas: 5, etage: 3, sac: 500 };
    const e = { ...S.etatVide(), donjon: { jour, tentatives: 1, partie: avancee } };
    // L'onglet resté à l'étage 1 sauve sa copie : refusée.
    expect(sauver(e, { id: "d1", pas: 2, etage: 1, sac: 20 })).toBe(e);
    // L'onglet à jour avance : acceptée.
    expect(sauver(e, { ...avancee, pas: 6, etage: 4 }).donjon.partie.etage).toBe(4);
    // Terminer depuis la vieille copie : rien n'est payé, la descente reste.
    const resume = { id: "d1", pas: 2, mode: "jour", etage: 1, gardiens: 0 };
    expect(terminer(e, { butin: { po: 20 }, resume })).toBe(e);
  });

  test("l'entrée de l'infini ne se paie pas avec une bourse insuffisante", async () => {
    const { commencer } = await import("../src/jeu/donjon.js");
    const e = { ...S.etatVide(), bourse: { po: 10, credite: 0, gagne: 0 } };
    expect(commencer(e, { id: "i1", mode: "infini" }, 50)).toBe(e);
  });
});

describe("Comptoir : le marché ne partage plus ses tables avec l'état", () => {
  test("une vente après la sauvegarde ne modifie pas la sauvegarde", async () => {
    const { Marche } = await import("../src/comptoir/marche.js");
    const M = new Marche([], null, 300);
    const sauve = M.serialiser();
    M.achats.lise = 4;
    M.journal.unshift({ t: "vente" });
    expect(sauve.achats.lise).toBeUndefined();
    expect(sauve.journal).toHaveLength(0);
    const N = new Marche([], sauve, 300);
    N.achats.lise = 7;
    expect(sauve.achats.lise).toBeUndefined();
  });
});
