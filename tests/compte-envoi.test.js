/** L'envoi vers le compte : suppression ailleurs, envoi en cours. */
import { describe, expect, test } from "vitest";
import { attendreEnvoi, decisionEnvoi } from "../src/jeu/Compte.jsx";

describe("decisionEnvoi", () => {
  test("compte neuf : on écrit", () => {
    expect(decisionEnvoi(false, 0, 0)).toBe("ecrire");
  });

  test("document absent alors que l'appareil en connaissait une révision : compte supprimé, rien n'est recréé", () => {
    expect(decisionEnvoi(false, 0, 7)).toBe("supprime");
  });

  test("même révision : on écrit ; révision différente : conflit", () => {
    expect(decisionEnvoi(true, 7, 7)).toBe("ecrire");
    expect(decisionEnvoi(true, 8, 7)).toBe("conflit");
  });
});

describe("attendreEnvoi", () => {
  test("rend la main quand l'envoi en cours atterrit", async () => {
    const enVol = { current: true };
    setTimeout(() => { enVol.current = false; }, 30);
    const t0 = Date.now();
    await attendreEnvoi(enVol, 2000, 5);
    expect(enVol.current).toBe(false);
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  test("n'attend pas indéfiniment", async () => {
    const enVol = { current: true };
    await attendreEnvoi(enVol, 30, 5);
    expect(enVol.current).toBe(true);
  });
});
