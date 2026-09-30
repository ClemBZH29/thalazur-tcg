import { useCallback } from "react";
import { DONJON } from "../config/tiers.js";
import { crediterGain } from "../lib/economie.js";
import { crediterXP, niveauDe } from "../donjon/experience.js";

const aujourdhui = () => new Date().toLocaleDateString("sv"); // AAAA-MM-JJ, local

/** Le jour, `n` jours plus tard (AAAA-MM-JJ, local). */
export function plusJours(jour, n) {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(a, m - 1, j + n).toLocaleDateString("sv");
}

/**
 * Ce que l'application sait du Donjon : les tentatives du jour, la
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
  const MJ = DONJON.modes.jour, MI = DONJON.modes.infini;
  // `tentatives` compte les descentes du donjon du jour ; l'infini n'en prend
  // pas. `poInfini` : les PO déjà versées par l'infini aujourd'hui.
  const restantes = illimite ? Infinity : Math.max(0, MJ.tentatives - (brut.tentatives || 0));
  const poInfiniRestant = Math.max(0, MI.plafondPOJour - (brut.poInfini || 0));

  const majDonjon = useCallback((champs) => {
    setEtat((e) => {
      const j = aujourdhui();
      const d = e.donjon && e.donjon.jour === j ? e.donjon : { ...(e.donjon || {}), jour: j, tentatives: 0, poInfini: 0 };
      return { ...e, donjon: { ...d, ...(typeof champs === "function" ? champs(d) : champs) } };
    });
  }, [setEtat]);

  /** Une tentative est prise à la descente, pas à la remontée : abandonner ne la rend pas. */
  const commencerDonjon = useCallback((partie) => {
    majDonjon((d) => (partie.mode === "infini" ? { partie } : { tentatives: (d.tentatives || 0) + 1, partie }));
  }, [majDonjon]);

  const sauverPartie = useCallback((partie) => majDonjon({ partie }), [majDonjon]);

  /**
   * Fin de descente : le butin rapporté part à la bourse, converti, et la
   * partie se referme. Rend les PO créditées.
   */
  const terminerDonjon = useCallback((butin, resume, repos = [], gains = []) => {
    const infini = resume.mode === "infini";
    // L'infini verse ses PO jusqu'au plafond du jour ; le reste du sac est
    // compté, mais n'entre pas à la bourse.
    const po = Math.min(Math.round(butin * DONJON.multiplicateur), infini ? poInfiniRestant : Infinity);
    // Le bilan d'expérience se lit sur l'état du moment ; le setter le refait
    // sur l'état le plus frais, qui est le même au clic près.
    const { bilan, po: poXP } = crediterXP(etat, gains);
    setEtat((e0) => {
      const { etat: e, po: bonus } = crediterXP(e0, gains);
      const d = e.donjon || { jour: aujourdhui(), tentatives: 0 };
      const stats = { ...(e.stats || {}) };
      stats.gardiens = (stats.gardiens || 0) + (resume.gardiens || 0);
      if (resume.complete) stats.remontees = (stats.remontees || 0) + 1;
      // Convalescences : la carte revient le jour indiqué. Les échéances
      // passées sont retirées au passage, pour que la liste ne grossisse pas.
      const j = aujourdhui();
      const convalescence = Object.fromEntries(Object.entries(d.convalescence || {}).filter(([, fin]) => fin > j));
      for (const { cle, jours } of repos) {
        const fin = plusJours(j, jours);
        if (!convalescence[cle] || convalescence[cle] < fin) convalescence[cle] = fin;
      }
      const suite = { ...d, partie: null, convalescence, dernier: { ...resume, jour: j, butin, po, repos: repos.length } };
      if (infini) {
        suite.poInfini = (d.jour === j ? d.poInfini || 0 : 0) + po;
        suite.recordInfini = Math.max(d.recordInfini || 0, resume.gardiens || 0);
      }
      return { ...e, bourse: crediterGain(e.bourse, po + bonus), stats, donjon: suite };
    });
    return { po, bilan, poXP };
  }, [setEtat, etat, poInfiniRestant]);

  /** Le niveau d'une carte, et la table des niveaux pour une descente. */
  const niveauCarte = (c) => niveauDe(etat.xp?.[`${c.ext}:${c.id}`]?.xp || 0);

  /** Jusqu'à quand une carte est au repos, ou null si elle est disponible. */
  const convalescence = (c) => {
    const fin = (etat.donjon?.convalescence || {})[`${c.ext}:${c.id}`];
    return fin && fin > aujourdhui() ? fin : null;
  };

  return {
    donjon: brut, convalescence, niveauCarte, tentativesRestantes: restantes, tentativesParJour: MJ.tentatives, illimite,
    poInfiniRestant, recordInfini: etat.donjon?.recordInfini || 0,
    commencerDonjon, sauverPartie, terminerDonjon,
  };
}
