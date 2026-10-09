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
    const texte = JSON.stringify({ ...S.etatVide(), schema: 9, ecriture: { n: 3, onglet: "x" } });
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
