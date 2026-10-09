import { useCallback } from "react";
import { DONJON, poDuButin } from "../config/tiers.js";
import { crediterGain, debiterLibre } from "../lib/economie.js";
import { crediterXP, niveauDe } from "../donjon/experience.js";
import { descentesJouees } from "../lib/compteurs.js";

const aujourdhui = () => new Date().toLocaleDateString("sv"); // AAAA-MM-JJ, local

/** Le jour, `n` jours plus tard (AAAA-MM-JJ, local). */
export function plusJours(jour, n) {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(a, m - 1, j + n).toLocaleDateString("sv");
}

/**
 * L'identité d'une partie : son `id`, tiré au départ. Une partie sauvée
 * avant lui garde sa graine, qui ne change pas en chemin.
 */
export const idPartie = (p) => (p ? (p.id ?? `graine:${p.graine}`) : null);

/** La partie enregistrée est-elle bien celle-là ? */
const enCours = (e, id) => !!e.donjon?.partie && idPartie(e.donjon.partie) === id;

/** Le donjon du jour : la veille, les tentatives et l'imposition repartent de zéro. */
function avecDonjon(e, champs) {
  const j = aujourdhui();
  const d = e.donjon && e.donjon.jour === j ? e.donjon : { ...(e.donjon || {}), jour: j, tentatives: 0, imposition: null };
  return { ...e, donjon: { ...d, ...(typeof champs === "function" ? champs(d) : champs) } };
}

/*
 * Les règles d'état de la partie en cours, pures : chacune s'applique sur
 * l'état le plus frais, celui que d'autres onglets ou la synchronisation du
 * compte ont pu changer depuis que la page a lu le sien. Un onglet resté sur
 * une descente close ailleurs ne peut donc ni la reprendre, ni la sauver
 * par-dessus une autre, ni se la faire payer une seconde fois.
 */

/** Commence une descente, sauf si une autre est en cours. */
export function commencer(e, partie, entree = 0) {
  if (e.donjon?.partie) return e;
  if (partie.mode === "infini") return avecDonjon({ ...e, bourse: debiterLibre(e.bourse, entree) }, { partie });
  return avecDonjon(e, (d) => ({ tentatives: (d.tentatives || 0) + 1, partie }));
}

/** Sauve la partie, si c'est bien elle qui est en cours. */
export const sauver = (e, partie) => (enCours(e, idPartie(partie)) ? avecDonjon(e, { partie }) : e);

/** Clôt la partie `resume.id` et crédite son butin ; rien si elle n'est plus en cours. */
export function terminer(e0, { butin, resume, repos = [], gains = [] }) {
  if (!enCours(e0, resume.id)) return e0;
  const { id: _id, ...res } = resume;
  const infini = res.mode === "infini";
  const po = poDuButin(butin, res.mode || "jour");
  const { etat: e, po: bonus } = crediterXP(e0, gains);
  const d = e.donjon || { jour: aujourdhui(), tentatives: 0 };
  const stats = { ...(e.stats || {}) };
  // Toute descente compte, victoire ou chute : c'est elle qui efface
  // l'apprentissage (voir DONJON.apprentissage).
  stats.descentes = descentesJouees(stats) + 1;
  stats.gardiens = (stats.gardiens || 0) + (res.gardiens || 0);
  if (res.complete) stats.remontees = (stats.remontees || 0) + 1;
  // Convalescences : la carte revient le jour indiqué. Les échéances
  // passées sont retirées au passage, pour que la liste ne grossisse pas.
  const j = aujourdhui();
  const convalescence = Object.fromEntries(Object.entries(d.convalescence || {}).filter(([, fin]) => fin > j));
  for (const { cle, jours } of repos) {
    const fin = plusJours(j, jours);
    if (!convalescence[cle] || convalescence[cle] < fin) convalescence[cle] = fin;
  }
  const suite = { ...d, partie: null, convalescence, dernier: { ...res, jour: j, butin, po, repos: repos.length } };
  if (infini) suite.recordInfini = Math.max(d.recordInfini || 0, res.gardiens || 0);
  return { ...e, bourse: crediterGain(e.bourse, po + bonus), stats, donjon: suite };
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
  const gratuit = test.actif && test.sansPO;
  const MJ = DONJON.modes.jour, MI = DONJON.modes.infini;
  // `tentatives` compte les descentes du donjon du jour ; l'infini n'en prend
  // pas, il se paie à l'entrée.
  const restantes = illimite ? Infinity : Math.max(0, MJ.tentatives - (brut.tentatives || 0));
  const entreeInfini = gratuit ? 0 : MI.entree;
  const peutPayerInfini = (etat.bourse?.po || 0) >= entreeInfini;
  // La composition et la source imposées du donjon du jour : tirées une fois
  // par jour, à la première visite, puis figées (voir compositionDuJour).
  const imposition = brut.imposition?.jour === brut.jour ? brut.imposition : null;

  const majDonjon = useCallback((champs) => setEtat((e) => avecDonjon(e, champs)), [setEtat]);

  /**
   * Une tentative est prise à la descente, pas à la remontée : abandonner ne
   * la rend pas. L'entrée de l'infini est payée au même moment. Refusée (rend
   * false) si une descente est déjà en cours, ici ou dans un autre onglet.
   */
  const commencerDonjon = useCallback((partie) => {
    if (etat.donjon?.partie) return false;
    setEtat((e) => commencer(e, partie, entreeInfini));
    return true;
  }, [setEtat, entreeInfini, etat]);

  const fixerImposition = useCallback((i) => majDonjon((d) => ({ imposition: { ...i, jour: d.jour } })), [majDonjon]);

  const sauverPartie = useCallback((partie) => setEtat((e) => sauver(e, partie)), [setEtat]);

  /**
   * Fin de descente : le butin rapporté part à la bourse, converti, et la
   * partie se referme. Rend les PO créditées. `resume.id` : l'identité de la
   * partie close ; si la partie enregistrée n'est plus celle-là, rien n'est
   * payé (voir `terminer`).
   */
  const terminerDonjon = useCallback((butin, resume, repos = [], gains = []) => {
    // Le bilan d'expérience se lit sur l'état du moment ; le setter le refait
    // sur l'état le plus frais, qui est le même au clic près.
    if (!enCours(etat, resume.id)) return { po: 0, bilan: [], poXP: 0, refusee: true };
    const po = poDuButin(butin, resume.mode || "jour");
    const { bilan, po: poXP } = crediterXP(etat, gains);
    setEtat((e0) => terminer(e0, { butin, resume, repos, gains }));
    return { po, bilan, poXP };
  }, [setEtat, etat]);

  /** Le niveau d'une carte, et la table des niveaux pour une descente. */
  const niveauCarte = (c) => niveauDe(etat.xp?.[`${c.ext}:${c.id}`]?.xp || 0);

  /** Jusqu'à quand une carte est au repos, ou null si elle est disponible. */
  const convalescence = (c) => {
    const fin = (etat.donjon?.convalescence || {})[`${c.ext}:${c.id}`];
    return fin && fin > aujourdhui() ? fin : null;
  };

  return {
    donjon: brut, convalescence, niveauCarte, tentativesRestantes: restantes, tentativesParJour: MJ.tentatives, illimite,
    entreeInfini, peutPayerInfini, imposition, recordInfini: etat.donjon?.recordInfini || 0,
    commencerDonjon, sauverPartie, terminerDonjon, fixerImposition,
  };
}
