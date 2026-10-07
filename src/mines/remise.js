/**
 * Mines de Kazim — la remise à zéro du 07/10/2026.
 *
 * Les commandes de Tafix, les éclats comptés en strates et la Faveur du
 * Fossoyeur changent trop de choses pour qu'une partie ancienne se convertisse
 * : avec ses éclats, un ancien joueur arriverait dans la Faveur avec l'arbre
 * déjà rempli, et le classement de strate ne voudrait plus rien dire.
 * Décision de Clément : **tout le monde repart de la galerie d'entrée, éclats
 * compris**, avec une compensation en PO seulement.
 *
 *   solde = min(480, étoile en stock au dernier cours + 30 PO par effondrement)
 *
 * L'étoile en stock est payée comme si on la vendait une dernière fois aux
 * kobolds, ×15 comme le faisait l'application, plafonnée à 240 PO. Les
 * formules de l'ancien cours sont recopiées ici, figées : elles ne servent
 * plus qu'à ce calcul, une fois par partie.
 */
import { echelle } from "./regles.js";

export const SOLDE_ETOILE_MAX = 240;
export const SOLDE_PAR_EFFONDREMENT = 30;
export const SOLDE_MAX = 480;

/* ── L'ancien cours kobold, figé ───────────────────────────────────────── */
const F = 32;                                  // FATIGUE_PO
const TAUX = { c1: 0.88, c2: 0.85 };           // anciens contrats de courtage
function ancienCours(d, mise) {
  const ancre = Math.max(3.5, 0.07 * 18 * Math.pow(echelle(Math.max(1, d.profondeurMax || 1)), 0.85) * 4);
  const taux = (d.equipement || []).reduce((m, id) => m * (TAUX[id] || 1), 1);
  const dette = Math.min(0.55, 0.06 * Math.log(1 + (d.effondrements || 0)));
  const volume = Math.min(0.75, 0.18 * Math.log2(1 + Math.max(0, mise) / ancre / 5));
  const reso = Math.min(0.25, (d.resonance || 0) * 0.004);
  const c = Math.max(0.05, (1 + volume + reso) * (1 - dette) / taux / (d.cours || 1));
  return { ancre, c };
}
/** PO kobold qu'aurait rapportés la vente de toute l'étoile en stock. */
export function derniereVente(d) {
  const mise = Math.max(0, Number(d.etoile) || 0);
  if (!(mise > 0) || !Number.isFinite(mise)) return 0;
  const { ancre, c } = ancienCours(d, mise);
  const p0 = Math.max(0, d.poRun || 0);
  const p1 = F * Math.log(Math.exp(p0 / F) + (mise * c) / (ancre * F));
  return Math.max(0, Math.floor(p1 - p0));
}

/** Ce que reçoit le joueur pour sa partie ancienne. */
export function soldeRemise(d) {
  const etoile = Number.isFinite(d.etoile) ? Math.min(SOLDE_ETOILE_MAX, derniereVente(d) * 15) : SOLDE_ETOILE_MAX;
  const eff = Math.max(0, Math.floor(d.effondrements || 0)) * SOLDE_PAR_EFFONDREMENT;
  const total = Math.min(SOLDE_MAX, etoile + eff);
  return { etoile, effondrements: Math.max(0, Math.floor(d.effondrements || 0)), partEffondrements: eff, total };
}
