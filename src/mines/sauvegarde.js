import { SCHEMA, migrer } from "../lib/sauvegarde/schema.js";
import { REGLES_VERSION } from "./regles.js";
import { soldeRemise } from "./remise.js";

/**
 * Mines de Kazim — la partie sauvegardée.
 *
 * Le format suit le schéma commun du site (`src/lib/sauvegarde/schema.js`) :
 * un champ qui change de sens passe par une migration là-bas, un champ
 * ajouté reçoit simplement sa valeur par défaut ici.
 */
export function etatNeuf() {
  return {
    schema: SCHEMA,
    etoile: 0, etoileTotale: 0, poGagnes: 0,
    profondeur: 1, profondeurMax: 1, brises: {}, brisesTotal: 0,
    /* 0 ordinaire · 1 généreux (×4) · 2 exceptionnel (×12). Tiré à la
       naissance du filon et non à sa rupture : voir `nouveauFilon`. */
    pv: 0, pvMax: 0, filonRang: 0,
    niveau: 1, xp: 0, points: 0,
    talents: { force: 0, echo: 0, discipline: 0, fortune: 0 },
    compagnons: {}, equipement: [],
    eclats: 0, echanges: 0, effondrements: 0,
    /* La Faveur du Fossoyeur (voir faveur.js) : les éclats déjà offerts, et
       les faveurs acquises. Gardés à l'effondrement. */
    eclatsDepenses: 0, faveurs: [],
    /* Les commandes de Tafix du jour, et les secondes passées page ouverte
       et visible depuis toujours (la grosse commande en lit l'écart). */
    commandes: null, presence: 0,
    dernierTick: Date.now(),
    regles: REGLES_VERSION,
    /* Partie ancienne remise à zéro au chargement : ce qu'on en dit au joueur
       et ce qu'on lui verse, jusqu'à ce qu'il l'ait lu. */
    remise: null,
  };
}

/**
 * La sauvegarde vient-elle d'une version plus récente du site — schéma ou
 * règles au-delà de ce que ce code connaît ? `relireMine` la rend `null`
 * comme une illisible, mais l'appelant ne doit surtout pas la remplacer :
 * un vieil onglet qui repartait d'une mine neuve et la sauvait par-dessus
 * effaçait la partie (audit du 09/10/2026). Le module se fige et demande de
 * recharger la page.
 */
export function estFuture(brut) {
  let d = null;
  try { d = brut ? JSON.parse(brut) : null; } catch { return false; }
  if (!d || typeof d !== "object") return false;
  return Number(d.schema) > SCHEMA || Number(d.regles) > REGLES_VERSION;
}

/**
 * Relit une sauvegarde (chaîne JSON) : migrée, complétée des champs ajoutés
 * depuis, ou `null` si elle est illisible, d'un format incompatible ou d'une
 * version future (voir `estFuture`).
 * Seuls les champs connus sont repris : une clé inattendue est ignorée.
 */
export function relireMine(brut) {
  let d = null;
  try { d = brut ? JSON.parse(brut) : null; } catch { return null; }
  d = migrer("mine", d);
  if (!d) return null;
  const n = etatNeuf();
  Object.keys(n).forEach((k) => { if (d[k] !== undefined && d[k] !== null) n[k] = d[k]; });
  if (!Number.isFinite(n.etoileTotale)) n.etoileTotale = 0;
  if (!Number.isFinite(n.eclats)) n.eclats = 0;
  if (!Array.isArray(n.faveurs)) n.faveurs = [];
  /* Les règles ont changé le 07/10/2026 (commandes de Tafix, éclats comptés
     en strates, Faveur du Fossoyeur). Une partie jouée sous les anciennes
     repart de zéro, éclats compris — décision de Clément, pour que tout le
     monde reparte de la même galerie d'entrée —, et reçoit un solde en PO
     (`remise.js`). Seul le cumul des PO versés est repris.

     La remise se fait à la lecture, et pas une fois pour toutes : une copie
     ancienne venue d'un autre appareil est remise à zéro à son tour en la
     relisant. Le solde, lui, n'est versé qu'une fois par compte : la marque
     vit dans l'état principal du jeu (`etat.mine.regles`, src/jeu/mine.js),
     qu'une vieille copie de la mine ne peut pas écraser. */
  /* Des règles futures ne se lisent pas ici, et surtout ne se remettent pas
     à zéro : la remise ne concerne que les règles antérieures. */
  if (Number(d.regles) > REGLES_VERSION) return null;
  if (!(d.regles >= REGLES_VERSION)) {
    const joue = (d.brisesTotal || 0) > 0 || (d.effondrements || 0) > 0;
    const remise = joue ? { ...soldeRemise(d), profondeurMax: d.profondeurMax || 1 } : null;
    const neuve = etatNeuf();
    neuve.poGagnes = Number.isFinite(d.poGagnes) ? d.poGagnes : 0;
    neuve.remise = remise;
    neuve.schema = SCHEMA;
    return neuve;
  }
  n.schema = SCHEMA;
  return n;
}
