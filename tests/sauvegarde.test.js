/** Le format des sauvegardes : lecture, rejet des formats inconnus, relecture de la mine. */
import { describe, expect, test } from "vitest";
import { SCHEMA, SCHEMA_MIN, migrer, renumeroter, RENOMMAGE_FULLART } from "../src/lib/sauvegarde/schema.js";
import ROSTER from "../src/extensions/troupe-valeran/roster.json";
import TABLE from "../src/lib/sauvegarde/renumerotation-troupe.json";
import { slug } from "../src/lib/roster.js";
import { etatVide, fusionner, relireJeu } from "../src/lib/storage.js";
import { estFuture, etatNeuf, relireMine } from "../src/mines/sauvegarde.js";
import TROUPE from "../src/extensions/troupe-valeran/extension.js";
import { specialesPour } from "../src/config/speciales.js";

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

describe("schéma 9 : le réglage du son devient un objet", () => {
  const avec = (son) => migrer("jeu", { schema: 8, reglages: { animations: "pleines", ...(son === undefined ? {} : { son }) } });
  test("un ancien « son coupé » reste coupé, volumes par défaut", () => {
    expect(avec(false).reglages).toEqual({ animations: "pleines", son: { coupe: true, musique: 20, effets: 50 } });
  });
  test("un son actif ou jamais réglé : défauts, non coupé", () => {
    expect(avec(true).reglages.son).toEqual({ coupe: false, musique: 20, effets: 50 });
    expect(avec(undefined).reglages.son).toEqual({ coupe: false, musique: 20, effets: 50 });
    expect(migrer("jeu", { schema: 8 }).reglages.son).toEqual({ coupe: false, musique: 20, effets: 50 });
  });
  test("un réglage déjà en objet est gardé, borné", () => {
    expect(avec({ coupe: false, musique: 135, effets: 40 }).reglages.son).toEqual({ coupe: false, musique: 100, effets: 40 });
  });
  test("une partie neuve a le réglage par défaut", () => {
    expect(etatVide().reglages.son).toEqual({ coupe: false, musique: 20, effets: 50 });
  });
});

describe("schéma 8 : full art renommés", () => {
  const ancienne = {
    schema: 7,
    collections: {
      "troupe-valeran": {
        "fa-selssy-sable-chaud": {
          normale: 1,
          carte: { id: "fa-selssy-sable-chaud", num: "fa-selssy-sable-chaud", nom: "Selssy", serie: "Sable Chaud", slug: "selssy-sable-chaud" },
        },
        "fa-trodonak-passion-ardente": { normale: 1 },
        "fa-vyrin-maid-cafe": { normale: 1 },
      },
    },
    vitrine: ["fa-nemelye-passion-ardente", "219-hida"],
  };

  test("identifiant, numéro, nom et série suivent le nouveau nom", () => {
    const d = migrer("jeu", ancienne);
    const coll = d.collections["troupe-valeran"];
    expect(Object.keys(coll).sort()).toEqual(["fa-selsy-sable-chaud", "fa-trodonac-nuit-ecarlate", "fa-vyrin-maid-cafe"]);
    expect(coll["fa-selsy-sable-chaud"].carte).toEqual({
      id: "fa-selsy-sable-chaud",
      num: "fa-selsy-sable-chaud",
      nom: "Selsy",
      serie: "Sable Chaud",
      slug: "selsy-sable-chaud",
    });
    expect(d.vitrine).toEqual(["fa-nemelye-nuit-ecarlate", "219-hida"]);
    expect(d.schema).toBe(SCHEMA); // migrée jusqu'au bout, 8 compris
  });

  test("les nouveaux identifiants sont ceux que déclare l'extension", () => {
    const { fullart } = specialesPour(TROUPE);
    const ids = new Set(fullart.map((c) => c.id));
    for (const def of Object.values(RENOMMAGE_FULLART)) expect(ids.has(def.id)).toBe(true);
  });
});

describe("schéma 7 : renumérotation de La Troupe", () => {
  const ancienne = {
    schema: 6,
    collections: {
      "troupe-valeran": {
        "164-hida": { normale: 2, rainbow: 1, carte: { id: "164-hida", num: "164", nom: "Hida" } },
        "203-sacoche-de-bille": { normale: 1 },
        "pj-hida": { normale: 1 },
      },
    },
    expeditions: [{ equipe: ["164-hida", "001-pluie-sur-la-mousse"] }],
  };

  test("chaque ancien identifiant est remplacé, en clé comme en valeur, numéro compris", () => {
    const d = migrer("jeu", ancienne);
    const coll = d.collections["troupe-valeran"];
    expect(Object.keys(coll).sort()).toEqual(["001-sacoche-de-bille", "219-hida", "pj-hida"]);
    expect(coll["219-hida"]).toEqual({ normale: 2, rainbow: 1, carte: { id: "219-hida", num: "219", nom: "Hida" } });
    expect(d.expeditions[0].equipe).toEqual(["219-hida", "027-pluie-sur-la-mousse"]);
    expect(d.schema).toBe(SCHEMA);
  });

  test("ce qui n'est pas un identifiant de carte ne bouge pas", () => {
    expect(renumeroter({ a: "164", b: 164, c: ["x"] }, { "164-hida": "219-hida" })).toEqual({ a: "164", b: 164, c: ["x"] });
  });

  test("la table mène exactement aux cartes du roster", () => {
    const actuels = new Set(ROSTER.lignes.map((l) => `${l[0]}-${slug(l[1])}`));
    const nouveaux = Object.values(TABLE.ids);
    expect(nouveaux.filter((id) => !actuels.has(id))).toEqual([]);
    expect(new Set(nouveaux).size).toBe(nouveaux.length);
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

  test("une partie des règles courantes garde tout", () => {
    const relu = relireMine(JSON.stringify({ ...etatNeuf(), profondeur: 9, profondeurMax: 11, eclats: 40, faveurs: ["plans"] }));
    expect(relu.profondeur).toBe(9);
    expect(relu.eclats).toBe(40);
    expect(relu.faveurs).toEqual(["plans"]);
    expect(relu.remise).toBeNull();
  });

  test("une partie d'avant la refonte repart de zéro, éclats compris, avec son solde", () => {
    const { regles, ...ancien } = etatNeuf();
    const relu = relireMine(JSON.stringify({
      ...ancien, pente: 2, profondeur: 25, profondeurMax: 25, brisesTotal: 900, compagnons: { fanal: 40 },
      eclats: 2228, effondrements: 4, etoile: 1e9, etoileTotale: 1e15, poGagnes: 77,
    }));
    expect(regles).toBeDefined();
    expect(relu.regles).toBe(regles);
    expect(relu.profondeurMax).toBe(1);
    expect(relu.compagnons).toEqual({});
    expect(relu.eclats).toBe(0);
    expect(relu.effondrements).toBe(0);
    expect(relu.poGagnes).toBe(77);
    expect(relu.remise.effondrements).toBe(4);
    expect(relu.remise.partEffondrements).toBe(120);
    expect(relu.remise.total).toBeLessThanOrEqual(480);
    expect(relu.remise.etoile).toBeLessThanOrEqual(240);
  });

  test("relue deux fois, une partie remise à zéro ne change plus", () => {
    const { regles, ...ancien } = etatNeuf();
    const une = relireMine(JSON.stringify({ ...ancien, brisesTotal: 10, effondrements: 1 }));
    const deux = relireMine(JSON.stringify({ ...une, remise: null }));
    expect(regles).toBeDefined();
    expect(deux.remise).toBeNull();
    expect(deux.regles).toBe(une.regles);
  });

  test("une partie ancienne jamais jouée repart sans écran", () => {
    const { regles, ...ancien } = etatNeuf();
    expect(regles).toBeDefined();
    expect(relireMine(JSON.stringify(ancien)).remise).toBeNull();
  });

  test("une étoile infinie ne casse pas le solde", () => {
    const { regles, ...ancien } = etatNeuf();
    expect(regles).toBeDefined();
    const relu = relireMine(JSON.stringify({ ...ancien, brisesTotal: 3, etoile: null, etoileTotale: null }));
    expect(relu.remise.total).toBeLessThanOrEqual(480);
    expect(relu.etoileTotale).toBe(0);
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

  test("une mine d'un format futur se reconnaît, et n'est jamais remise à zéro (audit 09/10/2026)", () => {
    const S = { ...etatNeuf(), brisesTotal: 900, effondrements: 4 };
    // Schéma futur : illisible ici, mais reconnue comme future, pas comme cassée.
    const schemaFutur = JSON.stringify({ ...S, schema: SCHEMA + 1 });
    expect(relireMine(schemaFutur)).toBeNull();
    expect(estFuture(schemaFutur)).toBe(true);
    // Règles futures : ni lue ni remise à zéro (la remise, c'est pour les règles antérieures).
    const reglesFutures = JSON.stringify({ ...S, regles: S.regles + 1 });
    expect(relireMine(reglesFutures)).toBeNull();
    expect(estFuture(reglesFutures)).toBe(true);
    // Le courant, l'ancien et l'illisible ne sont pas futurs.
    expect(estFuture(JSON.stringify(S))).toBe(false);
    expect(estFuture(JSON.stringify({ ...S, regles: 2 }))).toBe(false);
    expect(estFuture("{pas du json")).toBe(false);
    expect(estFuture(null)).toBe(false);
  });
});
