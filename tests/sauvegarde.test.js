/** Le format des sauvegardes : lecture, rejet des formats inconnus, relecture de la mine. */
import { describe, expect, test } from "vitest";
import { SCHEMA, SCHEMA_MIN, migrer } from "../src/lib/sauvegarde/schema.js";
import { etatVide, fusionner, relireJeu } from "../src/lib/storage.js";
import { etatNeuf, relireMine } from "../src/mines/sauvegarde.js";

describe("schéma", () => {
  test("une sauvegarde du schéma courant passe telle quelle", () => {
    expect(migrer("jeu", { schema: SCHEMA, x: 1 })).toEqual({ schema: SCHEMA, x: 1 });
  });

  test("trop ancienne, future, sans numéro ou illisible : rejetée", () => {
    expect(migrer("jeu", { schema: SCHEMA_MIN - 1 })).toBeNull();
    expect(migrer("jeu", { schema: SCHEMA + 1 })).toBeNull();
    expect(migrer("jeu", { version: 5 })).toBeNull();
    expect(migrer("jeu", null)).toBeNull();
    expect(migrer("jeu", "texte")).toBeNull();
  });
});

describe("état du jeu", () => {
  test("un état vide se relit à l'identique", () => {
    const vide = etatVide();
    const relu = relireJeu(JSON.parse(JSON.stringify(vide)));
    expect(relu).toEqual(vide);
  });

  test("un champ absent reçoit sa valeur par défaut", () => {
    const { profil, colporteur, ...ancien } = etatVide();
    const relu = relireJeu(ancien);
    expect(relu.profil).toEqual({});
    expect(relu.colporteur).toBeNull();
  });

  test("la bourse relue est complète même si la sauvegarde n'en a qu'une partie", () => {
    const relu = relireJeu({ ...etatVide(), bourse: { po: 42 } });
    expect(relu.bourse.po).toBe(42);
    expect(typeof relu.bourse.credite).toBe("number");
  });

  test("l'ancien format v5 n'est pas repris", () => {
    expect(relireJeu({ version: 5, collections: {} })).toBeNull();
  });

  test("fusionner additionne les exemplaires et garde la bourse la plus garnie", () => {
    const a = { ...etatVide(), collections: { t: { x: { normale: 1, rainbow: 0 } } }, bourse: { po: 10 } };
    const b = { ...etatVide(), collections: { t: { x: { normale: 2, rainbow: 1 } } }, bourse: { po: 90 } };
    const f = fusionner(a, b);
    expect(f.collections.t.x).toMatchObject({ normale: 3, rainbow: 1 });
    expect(f.bourse.po).toBe(90);
  });
});

describe("mine", () => {
  test("une partie sauvegardée se relit", () => {
    const S = { ...etatNeuf(), etoile: 1234, niveau: 7 };
    const relu = relireMine(JSON.stringify(S));
    expect(relu.etoile).toBe(1234);
    expect(relu.niveau).toBe(7);
    expect(relu.schema).toBe(SCHEMA);
  });

  test("un champ ajouté depuis la sauvegarde reçoit sa valeur par défaut", () => {
    const { talents, ...ancien } = etatNeuf();
    const relu = relireMine(JSON.stringify(ancien));
    expect(relu.talents).toEqual(etatNeuf().talents);
  });

  test("des éclats gagnés sous l'ancienne règle sont ramenés à la nouvelle", () => {
    // 1 814 éclats pour 1,4e13 d'étoile : la racine carrée les donnait,
    // la racine cubique en autorise 327.
    const relu = relireMine(JSON.stringify({ ...etatNeuf(), eclats: 1814, etoileTotale: 1.4e13 }));
    expect(relu.eclats).toBe(327);
  });

  test("des éclats conformes à la règle ne bougent pas", () => {
    const relu = relireMine(JSON.stringify({ ...etatNeuf(), eclats: 12, etoileTotale: 1e13 }));
    expect(relu.eclats).toBe(12);
  });

  test("une étoile cumulée infinie ne donne droit à aucun éclat", () => {
    const relu = relireMine(JSON.stringify({ ...etatNeuf(), eclats: 5e9, etoileTotale: Infinity }));
    expect(relu.etoileTotale).toBe(0);
    expect(relu.eclats).toBe(0);
  });

  test("une clé inconnue est ignorée", () => {
    const relu = relireMine(JSON.stringify({ ...etatNeuf(), piege: 1 }));
    expect(relu).not.toHaveProperty("piege");
  });

  test("l'ancien format v: 1 et le texte illisible repartent de zéro", () => {
    expect(relireMine(JSON.stringify({ v: 1, etoile: 5 }))).toBeNull();
    expect(relireMine("{pas du json")).toBeNull();
    expect(relireMine(null)).toBeNull();
  });
});
