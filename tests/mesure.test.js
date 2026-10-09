/** Consentement à la mesure d'audience : un refus rapide l'emporte sur un accord en cours de chargement. */
import { expect, test, vi } from "vitest";

const appels = [];
let libererModule;
vi.mock("../src/lib/nuage/firebase.js", () => ({
  mesureConfiguree: true,
  chargerApp: () => Promise.resolve({}),
}));
vi.mock("firebase/analytics", async () => {
  // Le module arrive quand le test le décide : c'est la fenêtre de l'accident.
  await new Promise((r) => { libererModule = r; });
  return {
    isSupported: async () => true,
    setConsent: () => {},
    initializeAnalytics: () => ({}),
    setAnalyticsCollectionEnabled: (_i, oui) => appels.push(oui),
    logEvent: () => {},
  };
});

const m = new Map();
globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
globalThis.window = { location: { hash: "#/", hostname: "thalazur.io", origin: "https://thalazur.io" } };
globalThis.document = { cookie: "", title: "" };

test("accepter puis refuser avant l'arrivée du module : la collecte reste coupée", async () => {
  const { choisir } = await import("../src/lib/mesure.js");
  choisir(true);
  choisir(false);
  while (!libererModule) await new Promise((r) => setTimeout(r, 1));
  libererModule();
  await new Promise((r) => setTimeout(r, 20));
  expect(appels.at(-1) ?? false).toBe(false);
});
