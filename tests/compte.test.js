/** La lecture de la copie du compte : migrée, jamais prise pour une partie vide. */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { lireCompte, compterCartes } from "../src/jeu/Compte.jsx";
import { SCHEMA } from "../src/lib/sauvegarde/schema.js";

const TABLE = JSON.parse(readFileSync(new URL("../src/lib/sauvegarde/renumerotation-troupe.json", import.meta.url), "utf8")).ids;
const [ancien, nouveau] = Object.entries(TABLE)[0];

describe("copie du compte", () => {
  test("une copie au format 6 se relit, migrée, au lieu d'une partie vide", () => {
    const doc = { schema: 6, revision: 4, donnees: JSON.stringify({ schema: 6, collections: { "troupe-valeran": { [ancien]: { normale: 3 } } } }), mine: null };
    const r = lireCompte(doc);
    expect(r.lisible).toBe(true);
    expect(r.jeu.collections["troupe-valeran"][nouveau].normale).toBe(3);
    expect(compterCartes(r.jeu)).toBe(3);
  });

  test("une copie d'une version future n'est pas lue", () => {
    const r = lireCompte({ schema: SCHEMA + 1, donnees: JSON.stringify({ schema: SCHEMA + 1, collections: { x: { a: { normale: 1 } } } }) });
    expect(r.futur).toBe(true);
    expect(r.lisible).toBe(false);
  });

  test("une copie illisible est signalée comme telle", () => {
    expect(lireCompte({ schema: SCHEMA, donnees: "{" }).lisible).toBe(false);
  });
});
