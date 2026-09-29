/** La liste des illustrations préchargées suit le dossier public. */
import { existsSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { DOSSIERS, RACINE, vagues } from "../src/lib/prechargement.js";

const PUBLIC = new URL("../public/", import.meta.url);

describe("préchargement", () => {
  test("chaque fichier listé existe", () => {
    for (const n of RACINE) expect(existsSync(new URL(`${n}.webp`, PUBLIC)), n).toBe(true);
    for (const [d, noms] of Object.entries(DOSSIERS)) {
      for (const n of noms) expect(existsSync(new URL(`${d}/${n}.webp`, PUBLIC)), `${d}/${n}`).toBe(true);
    }
  });

  test("chaque dossier listé l'est en entier : une image ajoutée ne s'oublie pas", () => {
    for (const [d, noms] of Object.entries(DOSSIERS)) {
      const sur = readdirSync(new URL(`${d}/`, PUBLIC)).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5));
      expect([...sur].sort(), d).toEqual([...noms].sort());
    }
  });

  test("les vagues couvrent tout, sans doublon", () => {
    const toutes = vagues("/").flat();
    const attendu = RACINE.length + Object.values(DOSSIERS).reduce((s, l) => s + l.length, 0);
    expect(toutes.length).toBe(attendu);
    expect(new Set(toutes).size).toBe(toutes.length);
  });
});
