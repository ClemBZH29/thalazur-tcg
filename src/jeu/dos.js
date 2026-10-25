import { useSyncExternalStore } from "react";
import { DOS_DEFAUT, DOS_PAR_ID } from "../config/dos.js";

/**
 * Le dos affiché, tenu hors de l'état React : il sert à des composants qui
 * n'ont pas l'état du jeu sous la main (scènes animées des Missions et du
 * grimoire, style des dos du Comptoir). `Jeu.jsx` le pose à chaque
 * changement ; la page d'attente et les tests gardent le dos commun.
 */
let actuel = DOS_PAR_ID[DOS_DEFAUT];
const suiveurs = new Set();

export function poserDos(dos) {
  if (!dos || dos === actuel) return;
  actuel = dos;
  suiveurs.forEach((f) => { try { f(); } catch { /* sans importance */ } });
}

/** L'adresse de l'image du dos affiché. */
export const urlDos = (d = actuel) => `${import.meta.env.BASE_URL}${d.fichier}`;

/** Pour React : le dos affiché, `{ id, nom, fichier, fond }`. */
export function useDos() {
  return useSyncExternalStore(
    (f) => { suiveurs.add(f); return () => suiveurs.delete(f); },
    () => actuel,
  );
}
