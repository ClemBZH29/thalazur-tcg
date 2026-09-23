/** Fusion à trois voies de deux copies d'une partie (src/lib/nuage/fusion.js). */
import { test } from "vitest";
import assert from "node:assert/strict";
import { fusionner3, fusionnerMine, signature } from "../src/lib/nuage/fusion.js";
import { ECONOMIE } from "../src/config/tiers.js";

const P = ECONOMIE.parHeure;

const H = 3600000;
const vide = { collections: {}, boosters: {}, bourse: { po: 100, credite: 0, gagne: 0 }, reglages: {}, mine: null, profil: {} };
const carte = (id, normale, rainbow = 0) => ({ normale, rainbow, carte: { id } });

const base = {
  ...vide,
  collections: { t: { a: carte("a", 1) } },
  boosters: { t: 2 },
  bourse: { po: 50, credite: 0, gagne: 10 },
  reglages: { son: true },
};
// Cet appareil : un booster (a en double, b neuf), 20 PO dépensées, 5 gagnées, 1 h de passif.
const ici = {
  ...base,
  collections: { t: { a: carte("a", 2), b: carte("b", 1) } },
  boosters: { t: 3 },
  bourse: { po: 50 - 20 + 5 + P, credite: H, gagne: 15 },
  reglages: { son: false },
};
// Le compte : un booster ailleurs (c avec rainbow), 2 h de passif.
const la = {
  ...base,
  collections: { t: { a: carte("a", 1), c: carte("c", 1, 1) } },
  boosters: { t: 3 },
  bourse: { po: 50 + 2 * P - 20, credite: 2 * H, gagne: 10 },
  reglages: { son: true, x: 1 },
};

test("les exemplaires des deux côtés s'additionnent", () => {
  const f = fusionner3(base, ici, la, vide);
  assert.equal(f.collections.t.a.normale, 2);
  assert.equal(f.collections.t.b.normale, 1);
  assert.equal(f.collections.t.c.rainbow, 1);
  assert.equal(f.boosters.t, 4);
});

test("une valeur changée ici gagne, sinon celle du compte", () => {
  const f = fusionner3(base, ici, la, vide);
  assert.equal(f.reglages.son, false);
  const g = fusionner3(base, base, la, vide);
  assert.deepEqual(g.reglages, la.reglages);
});

test("le gain passif commun n'est pas payé deux fois", () => {
  const f = fusionner3(base, ici, la, vide);
  // Le compte, plus ce que l'appareil a réellement fait : −20 + 5.
  assert.equal(Math.round(f.bourse.po), la.bourse.po - 15);
  assert.equal(f.bourse.gagne, 15);
  assert.equal(f.bourse.credite, 2 * H);
});

test("sans rien joué ici, on reçoit le compte tel quel", () => {
  const f = fusionner3(base, base, la, vide);
  assert.deepEqual(f.collections, la.collections);
  assert.equal(f.bourse.po, la.bourse.po);
});

test("une vente ici retire l'exemplaire du compte", () => {
  const vend = { ...base, collections: { t: { a: carte("a", 0) } } };
  assert.equal(fusionner3(base, vend, la, vide).collections.t.a.normale, 0);
});

test("première connexion : la partie locale s'ajoute", () => {
  const f = fusionner3(null, ici, la, vide);
  assert.equal(f.collections.t.a.normale, 3);
  assert.equal(f.boosters.t, 6);
});

test("la mine la plus récemment jouée l'emporte", () => {
  assert.equal(fusionnerMine('{"dernierTick":5}', '{"dernierTick":9}'), '{"dernierTick":9}');
  assert.equal(fusionnerMine(null, '{"dernierTick":9}'), '{"dernierTick":9}');
});

test("le gain passif seul ne compte pas comme un changement", () => {
  assert.equal(signature({ ...base, bourse: { po: 1 } }, null), signature(base, null));
  assert.notEqual(signature(ici, null), signature(base, null));
});

test("une clé __proto__ venue de l'extérieur ne touche pas au prototype", () => {
  const piege = JSON.parse('{"collections":{"__proto__":{"pollue":{"normale":1}}},"boosters":{"__proto__":5}}');
  const f = fusionner3(base, { ...ici, ...piege }, la, vide);
  assert.equal({}.pollue, undefined);
  assert.equal(Object.getPrototypeOf(f.collections), Object.prototype);
});

