/** Fusion à trois voies de deux copies d'une partie (src/lib/nuage/fusion.js). */
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  fusionner3, fusionnerDonjon, fusionnerExpeditions, fusionnerMine, fusionnerMissions, fusionnerParCle,
  fusionnerPity, fusionnerReliquaire, signature,
} from "../src/lib/nuage/fusion.js";
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
  // Une vieille partie sauvée plus tard ne l'emporte pas sur une partie plus avancée.
  const avancee = '{"brisesTotal":40,"etoileTotale":900,"dernierTick":5}';
  const vieille = '{"brisesTotal":31,"etoileTotale":700,"dernierTick":9}';
  assert.equal(fusionnerMine(vieille, avancee), avancee);
  assert.equal(fusionnerMine(avancee, vieille), avancee);
  // Un effondrement remet les filons à zéro mais reste le plus avancé.
  assert.equal(fusionnerMine('{"effondrements":1,"brisesTotal":2}', '{"brisesTotal":500}'), '{"effondrements":1,"brisesTotal":2}');
  // Une mine des règles courantes l'emporte sur une copie d'avant la refonte,
  // même beaucoup plus avancée : sinon la relecture la remettrait à zéro.
  assert.equal(fusionnerMine('{"regles":3,"brisesTotal":2}', '{"effondrements":9,"brisesTotal":5000}'), '{"regles":3,"brisesTotal":2}');
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


test("Reliquaire : la carte retournée sur un appareil l'est aussi sur l'autre", () => {
  const base = { vestiges: 100, achats: {}, reveles: {} };
  const ici = { vestiges: 100, achats: {}, reveles: { x: "2026-10-06" } };
  const la = { vestiges: 130, achats: {}, reveles: { x: "2026-10-05", y: "2026-10-06" } };
  const f = fusionnerReliquaire(base, ici, la);
  assert.deepEqual(f.reveles, { x: "2026-10-06", y: "2026-10-06" });
  assert.equal(f.vestiges, 130);
});

test("la remise à zéro payée et les conseils de Tafix ne se perdent pas d'un appareil à l'autre", () => {
  const base = { ...vide, tafix: { vus: [], onglets: [], muet: false } };
  const ici = { ...base, mine: { regles: 3 }, tafix: { vus: ["arrivee"], onglets: ["commandes"], muet: true } };
  const la = { ...base, mine: { jour: "2026-10-06", credite: 120 }, tafix: { vus: ["filon1"], onglets: [], muet: false } };
  const f = fusionner3(base, ici, la, vide);
  assert.deepEqual(f.mine, { regles: 3 });
  assert.deepEqual(f.tafix.vus.sort(), ["arrivee", "filon1"]);
  assert.deepEqual(f.tafix.onglets, ["commandes"]);
  assert.equal(f.tafix.muet, true);
});

/* ── Missions et expéditions entre deux appareils (signalé le 09/10/2026) ── */

const mission = (type, depart, reclamee = false, po = 50) => ({ type, n: 3, po, depart, reclamee });
const missionsDu = (jour, quotidiennes, hebdo = null) => ({ jour, remplacees: 0, quotidiennes, semaine: "2026-S41", hebdo });

test("missions : le téléphone resté à la veille n'efface pas celles faites sur l'ordinateur", () => {
  // Base : les missions du 08/10. L'ordinateur passe au 09/10 et réclame la
  // première ; le téléphone, ouvert ensuite, tire le 09/10 sur sa partie en
  // retard (départs plus bas, rien de réclamé).
  const b = missionsDu("2026-10-08", [mission("boosters", 0), mission("ventes", 0), mission("mine", 0)]);
  const la = missionsDu("2026-10-09", [mission("boosters", 10, true), mission("ventes", 4), mission("dissous", 2)]);
  const ici = missionsDu("2026-10-09", [mission("boosters", 6), mission("ventes", 1), mission("dissous", 0)]);
  const { missions } = fusionnerMissions(b, ici, la, null);
  assert.equal(missions.quotidiennes[0].reclamee, true);
  assert.equal(missions.quotidiennes[0].depart, 10, "le tirage du compte fait foi");
  assert.equal(missions.quotidiennes[1].depart, 4);
});

test("missions : un appareil encore à la veille ne ramène pas l'ancien jour", () => {
  const b = missionsDu("2026-10-08", [mission("boosters", 0)]);
  const la = missionsDu("2026-10-09", [mission("ventes", 4, true)]);
  const { missions } = fusionnerMissions(b, b, la, null);
  assert.equal(missions.jour, "2026-10-09");
  assert.equal(missions.quotidiennes[0].type, "ventes");
  assert.equal(missions.quotidiennes[0].reclamee, true);
});

test("missions : même tirage, réclamées de part et d'autre, une mission remplacée ici", () => {
  const b = missionsDu("2026-10-09", [mission("boosters", 0), mission("ventes", 0), mission("mine", 0)]);
  const ici = missionsDu("2026-10-09", [mission("boosters", 0, true), mission("ventes", 0), mission("forges", 0)]);
  ici.remplacees = 1;
  const la = missionsDu("2026-10-09", [mission("boosters", 0), mission("ventes", 0, true), mission("mine", 0)]);
  const { missions, doublons } = fusionnerMissions(b, ici, la, null);
  assert.deepEqual(missions.quotidiennes.map((m) => [m.type, m.reclamee]),
    [["boosters", true], ["ventes", true], ["forges", false]]);
  assert.equal(missions.remplacees, 1);
  assert.equal(doublons.po, 0);
});

test("missions : réclamée sur les deux appareils, la récompense est reprise une fois", () => {
  const b = missionsDu("2026-10-09", [mission("boosters", 0)], mission("ventes", 0));
  const ici = missionsDu("2026-10-09", [mission("boosters", 0, true, 80)], { ...mission("ventes", 0), reclamee: true });
  const la = missionsDu("2026-10-09", [mission("boosters", 0, true, 80)], { ...mission("ventes", 0), reclamee: true });
  const { doublons } = fusionnerMissions(b, ici, la, null);
  assert.equal(doublons.po, 80);
  assert.equal(doublons.sachets, 2);
});

test("missions : dans la fusion complète, la bourse rend le doublon", () => {
  const m = missionsDu("2026-10-09", [mission("boosters", 0)]);
  const reclame = missionsDu("2026-10-09", [mission("boosters", 0, true, 80)]);
  const b0 = { ...vide, missions: m, bourse: { po: 500, credite: 0, gagne: 0 } };
  const paye = { ...b0, missions: reclame, bourse: { po: 580, credite: 0, gagne: 80 } };
  const f = fusionner3(b0, paye, paye, vide);
  assert.equal(f.bourse.po, 580);
  assert.equal(f.missions.quotidiennes[0].reclamee, true);
});

const route = (lieu, depart, cartes, id) => ({ id, lieu, cartes, depart, fin: depart + 1, heures: 1, est: { or: 10 }, trouvees: [] });

test("expéditions : une route rentrée d'un côté ne revient pas, une route partie de l'autre s'ajoute", () => {
  const r1 = route("t:l1", 100, ["t:a"], 1);
  const b = { routes: [r1], seq: 2, orJour: { jour: "2026-10-09", credite: 10 } };
  const la = { routes: [route("t:l2", 200, ["t:b"], 2)], seq: 3, orJour: { jour: "2026-10-09", credite: 30 } }; // r1 créditée là-bas
  const ici = { routes: [r1, route("t:l3", 300, ["t:c"], 2)], seq: 3, orJour: { jour: "2026-10-09", credite: 15 } };
  const f = fusionnerExpeditions(b, ici, la);
  assert.deepEqual(f.routes.map((r) => r.lieu).sort(), ["t:l2", "t:l3"]);
  assert.equal(new Set(f.routes.map((r) => r.id)).size, 2, "les numéros ne se chevauchent pas");
  assert.ok(f.seq > Math.max(...f.routes.map((r) => r.id)));
  assert.equal(f.orJour.credite, 35);
});

test("expéditions : la même carte partie des deux côtés, la route du compte reste", () => {
  const la = { routes: [route("t:l1", 100, ["t:a"], 1)], seq: 2 };
  const ici = { routes: [route("t:l2", 150, ["t:a"], 1)], seq: 2 };
  const f = fusionnerExpeditions({ routes: [], seq: 1 }, ici, la);
  assert.deepEqual(f.routes.map((r) => r.lieu), ["t:l1"]);
});

/* ── Donjon, Comptoir, garantie de légendaire ─────────────────────────────── */

test("donjon : les tentatives du jour s'additionnent, la composition du compte reste", () => {
  const b = { jour: "2026-10-09", tentatives: 1, imposition: { jour: "2026-10-09", x: 1 } };
  const ici = { ...b, tentatives: 2 };
  const la = { ...b, tentatives: 3 };
  assert.equal(fusionnerDonjon(b, ici, la).tentatives, 4);
  const hier = { jour: "2026-10-08", tentatives: 3 };
  const f = fusionnerDonjon(hier, { jour: "2026-10-09", tentatives: 1, imposition: { a: 1 } },
    { jour: "2026-10-09", tentatives: 2, imposition: { b: 2 } });
  assert.equal(f.tentatives, 3);
  assert.deepEqual(f.imposition, { b: 2 });
});

test("donjon : une descente terminée sur le compte ne se rejoue pas ici", () => {
  const p = { salle: 2 };
  const b = { jour: "2026-10-09", tentatives: 1, partie: p };
  const ici = { ...b, partie: { salle: 3 } };           // avancée ici
  const la = { ...b, partie: null, dernier: { po: 40 } }; // terminée là-bas
  assert.equal(fusionnerDonjon(b, ici, la).partie, null);
  assert.deepEqual(fusionnerDonjon(b, ici, b).partie, { salle: 3 }, "avancée ici seulement : elle suit");
});

test("donjon : les convalescences s'unissent", () => {
  const f = fusionnerDonjon({}, { convalescence: { a: "2026-10-11", b: "2026-10-10" } },
    { convalescence: { b: "2026-10-12", c: "2026-10-10" } });
  assert.deepEqual(f.convalescence, { a: "2026-10-11", b: "2026-10-12", c: "2026-10-10" });
});

test("comptoir : chaque extension suit le côté qui l'a touchée", () => {
  const b = { tro: { v: 1 }, nak: { v: 1 } };
  const f = fusionnerParCle(b, { ...b, tro: { v: 2 } }, { ...b, nak: { v: 3 } });
  assert.deepEqual(f, { tro: { v: 2 }, nak: { v: 3 } });
});

test("garantie de légendaire : les boosters des deux côtés comptent, une légendaire remet à zéro", () => {
  const b = { t: { depuis: 10, vu: false } };
  assert.equal(fusionnerPity(b, { t: { depuis: 12, vu: false } }, { t: { depuis: 13, vu: false } }).t.depuis, 15);
  const f = fusionnerPity(b, { t: { depuis: 1, vu: true } }, { t: { depuis: 13, vu: false } });
  assert.equal(f.t.depuis, 1);
  assert.equal(f.t.vu, true);
});
