import { useCallback } from "react";
import { DONJON } from "../config/tiers.js";
import { crediterGain } from "../lib/economie.js";

const aujourdhui = () => new Date().toLocaleDateString("sv"); // AAAA-MM-JJ, local

/**
 * Ce que l'application sait des Profondeurs : les tentatives du jour, la
 * partie en cours, et le crédit du butin.
 *
 * Le module décide de tout ce qui se passe sous terre ; il remet ici le
 * butin rapporté, et c'est ici qu'on décide ce qu'il vaut dans la bourse —
 * la même frontière que pour les Mines.
 */
export function useDonjon(etat, setEtat, test) {
  const brut = etat.donjon && etat.donjon.jour === aujourdhui()
    ? etat.donjon
    : { jour: aujourdhui(), tentatives: 0, partie: etat.donjon?.partie ?? null, dernier: etat.donjon?.dernier ?? null };
  const illimite = test.actif;
  const restantes = illimite ? Infinity : Math.max(0, DONJON.tentativesParJour - brut.tentatives);

  const majDonjon = useCallback((champs) => {
    setEtat((e) => {
      const j = aujourdhui();
      const d = e.donjon && e.donjon.jour === j ? e.donjon : { ...(e.donjon || {}), jour: j, tentatives: 0 };
      return { ...e, donjon: { ...d, ...(typeof champs === "function" ? champs(d) : champs) } };
    });
  }, [setEtat]);

  /** Une tentative est prise à la descente, pas à la remontée : abandonner ne la rend pas. */
  const commencerDonjon = useCallback((partie) => {
    majDonjon((d) => ({ tentatives: (d.tentatives || 0) + 1, partie }));
  }, [majDonjon]);

  const sauverPartie = useCallback((partie) => majDonjon({ partie }), [majDonjon]);

  /**
   * Fin de descente : le butin rapporté part à la bourse, converti, et la
   * partie se referme. Rend les PO créditées.
   */
  const terminerDonjon = useCallback((butin, resume) => {
    const po = Math.round(butin * DONJON.multiplicateur);
    setEtat((e) => {
      const d = e.donjon || { jour: aujourdhui(), tentatives: 0 };
      const stats = { ...(e.stats || {}) };
      stats.gardiens = (stats.gardiens || 0) + (resume.gardiens || 0);
      if (resume.complete) stats.remontees = (stats.remontees || 0) + 1;
      return {
        ...e,
        bourse: crediterGain(e.bourse, po),
        stats,
        donjon: { ...d, partie: null, dernier: { ...resume, jour: aujourdhui(), butin, po } },
      };
    });
    return po;
  }, [setEtat]);

  return {
    donjon: brut, tentativesRestantes: restantes, tentativesParJour: DONJON.tentativesParJour, illimite,
    commencerDonjon, sauverPartie, terminerDonjon,
  };
}
