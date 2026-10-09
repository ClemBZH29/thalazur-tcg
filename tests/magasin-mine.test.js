/**
 * Le magasin de la mine (`magasinKazim`, src/lib/storage.js) entre plusieurs
 * onglets. Pas de navigateur : un `localStorage` de quelques lignes suffit.
 */
import { beforeEach, expect, test } from "vitest";

const memoire = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoire.has(k) ? memoire.get(k) : null),
  setItem: (k, v) => memoire.set(k, String(v)),
  removeItem: (k) => memoire.delete(k),
};
const { ecrireMine, magasinKazim } = await import("../src/lib/storage.js");

const mine = (brisesTotal) => JSON.stringify({ regles: 3, brisesTotal });

beforeEach(() => memoire.clear());

test("une adoption plus ancienne que ce qu'un autre onglet a écrit depuis ne l'emporte pas (audit 09/10/2026)", async () => {
  // Onglet caché : il adopte la partie d'un autre onglet…
  ecrireMine(mine(10));
  // … puis, redevenu visible, ne l'adopte plus quand l'autre onglet écrit plus avancé.
  localStorage.setItem("brume-thalazur:mine", mine(40));
  expect(JSON.parse(magasinKazim.voir()).brisesTotal).toBe(40);
  expect(JSON.parse(await magasinKazim.get()).brisesTotal).toBe(40);
});

test("une adoption plus avancée reste servie", async () => {
  localStorage.setItem("brume-thalazur:mine", mine(5));
  ecrireMine(mine(30));
  expect(JSON.parse(await magasinKazim.get()).brisesTotal).toBe(30);
});

test("une mine effacée (déconnexion) reste effacée", async () => {
  ecrireMine(null);
  expect(await magasinKazim.get()).toBeNull();
});
