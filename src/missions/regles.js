/**
 * Les missions : le tirage du jour et de la semaine, la progression, la
 * réclamation et le remplacement. Formules pures, sans navigateur : les
 * tests et `scripts/audit-missions.mjs` les rejouent telles quelles.
 *
 * ── Ce que la partie garde ────────────────────────────────────────────────
 *   etat.missions = {
 *     jour: "AAAA-MM-JJ", remplacees: n,
 *     quotidiennes: [{ type, n, po, depart, reclamee }],
 *     semaine: "AAAA-Sss",
 *     hebdo: { type, n, depart, reclamee } | null,
 *   }
 * `depart` est la valeur du compteur quand la mission a été confiée : la
 * progression est l'écart, et rien de ce qui précède ne compte.
 */
import { QUOTIDIENNES, RECOMPENSE_SEMAINE, REMPLACEMENTS, TYPES } from "../config/missions.js";
import { crediterGain } from "../lib/economie.js";
import { descentesJouees } from "../lib/compteurs.js";

export const TYPE_PAR_ID = Object.fromEntries(TYPES.map((t) => [t.id, t]));

const avecN = (texte, n) => texte.replaceAll("{n}", n.toLocaleString("fr-FR")).replaceAll("{s}", n > 1 ? "s" : "");

/* ── Le calendrier, en heure locale ──────────────────────────────────────── */

/** « 2026-10-07 », le jour local. */
export const jourLocal = (d = new Date()) => d.toLocaleDateString("sv");

/** « 2026-S41 », la semaine ISO locale : elle commence le lundi. */
export function semaineLocale(d = new Date()) {
  const j = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (j.getDay() + 6) % 7;            // lundi 0 … dimanche 6
  j.setDate(j.getDate() - dow + 3);              // le jeudi de la semaine
  const an = j.getFullYear();
  const premierJeudi = new Date(an, 0, 4);
  const n = 1 + Math.round(((j - premierJeudi) / 86400000 - 3 + ((premierJeudi.getDay() + 6) % 7)) / 7);
  return `${an}-S${String(n).padStart(2, "0")}`;
}

/** Millisecondes jusqu'à minuit, et jusqu'au lundi suivant à minuit. */
export function echeances(d = new Date()) {
  const minuit = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  const lundi = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (7 - ((d.getDay() + 6) % 7)));
  return { jour: minuit - d, semaine: lundi - d };
}

/* ── Ce que la partie mesure ─────────────────────────────────────────────── */

/** Les compteurs que les missions suivent. Aucun ne recule. */
export function mesuresMissions(etat) {
  const s = etat.stats || {};
  let possedees = 0;
  for (const coll of Object.values(etat.collections || {})) {
    for (const e of Object.values(coll || {})) if ((e?.normale || 0) > 0) possedees++;
  }
  return {
    boosters: Object.values(etat.boosters || {}).reduce((n, v) => n + (Number(v) || 0), 0),
    possedees,
    ventes: s.ventes || 0,
    poMine: s.poMine || 0,
    descentes: descentesJouees(s),
    gardiens: s.gardiens || 0,
    expeditions: s.expeditions || 0,
    dissous: s.dissous || 0,
    forges: s.forges || 0,
  };
}

/**
 * Ce que le joueur a sous la main, pour ne confier que des missions
 * possibles. `totalRoster` : nombre de cartes des extensions ouvertes.
 */
export function contexte(etat, totalRoster = 0) {
  let surplus = 0, pnj = 0, lieux = 0, possedees = 0;
  for (const coll of Object.values(etat.collections || {})) {
    for (const e of Object.values(coll || {})) {
      surplus += Math.max(0, (e?.normale || 0) - 1) + Math.max(0, (e?.rainbow || 0) - 1);
      if ((e?.normale || 0) > 0) {
        possedees++;
        if (e.carte?.type === "pnj") pnj++;
        if (e.carte?.type === "lieu") lieux++;
      }
    }
  }
  return {
    surplus, pnj, lieux,
    manquantes: Math.max(0, totalRoster - possedees),
    descentes: descentesJouees(etat.stats || {}),
    reliquaire: !!etat.reliquaire?.ouvert,
  };
}

const possible = (t, ctx) => !t.dispo || t.dispo(ctx);

/* ── Le tirage ───────────────────────────────────────────────────────────── */

/** Générateur déterministe (mulberry32) sur une graine texte. */
function alea(graine) {
  let h = 0x811c9dc5;
  for (let i = 0; i < graine.length; i++) { h ^= graine.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const melanger = (liste, r) => {
  const l = [...liste];
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
};

/**
 * Les missions du jour : trois types de trois modes différents, parmi ceux
 * que le joueur peut remplir. La graine est le jour : deux joueurs qui ont
 * les mêmes modes ouverts reçoivent les mêmes missions, de quoi en parler.
 * `exclus` : types à écarter (au remplacement, ceux déjà confiés).
 */
export function tirerQuotidiennes(graine, ctx, mesures, combien = QUOTIDIENNES, exclus = [], modesPris = []) {
  const r = alea(graine);
  const ordre = melanger(TYPES.filter((t) => t.jour && possible(t, ctx) && !exclus.includes(t.id)), r);
  const choix = [];
  const modes = new Set(modesPris);
  const prendre = (t) => {
    modes.add(t.mode);
    choix.push({ type: t.id, n: t.jour.n, po: t.jour.po, depart: mesures[t.mesure] || 0, reclamee: false });
  };
  for (const t of ordre) if (choix.length < combien && !modes.has(t.mode)) prendre(t);
  // Un joueur qui débute n'a pas encore trois modes ouverts : on complète
  // dans un mode déjà pris plutôt que de lui laisser une case vide.
  for (const t of ordre) if (choix.length < combien && !choix.some((c) => c.type === t.id)) prendre(t);
  return choix;
}

/** La mission de la semaine, parmi celles que le joueur peut remplir. */
export function tirerHebdo(graine, ctx, mesures) {
  const r = alea(graine);
  const t = melanger(TYPES.filter((t) => t.semaine && possible(t, ctx)), r)[0];
  return t ? { type: t.id, n: t.semaine.n, depart: mesures[t.mesure] || 0, reclamee: false } : null;
}

/* ── Progression ─────────────────────────────────────────────────────────── */

/** Une mission confrontée aux compteurs du moment. */
export function juger(m, mesures, semaine = false) {
  const t = TYPE_PAR_ID[m.type];
  const valeur = Math.max(0, Math.min(m.n, (mesures[t.mesure] || 0) - (m.depart || 0)));
  return {
    ...m,
    semaine,
    quoi: avecN(t.quoi, m.n),
    mode: t.mode,
    valeur,
    atteinte: valeur >= m.n,
    recompense: semaine ? RECOMPENSE_SEMAINE : { po: m.po },
  };
}

/** Toutes les missions en cours, jugées. */
export function evaluerMissions(etat, mesures) {
  const M = etat.missions;
  if (!M) return { quotidiennes: [], hebdo: null, aReclamer: 0, remplacements: REMPLACEMENTS };
  const quotidiennes = (M.quotidiennes || []).map((m) => juger(m, mesures));
  const hebdo = M.hebdo ? juger(M.hebdo, mesures, true) : null;
  const aReclamer = [...quotidiennes, ...(hebdo ? [hebdo] : [])].filter((m) => m.atteinte && !m.reclamee).length;
  return { quotidiennes, hebdo, aReclamer, remplacements: Math.max(0, REMPLACEMENTS - (M.remplacees || 0)) };
}

/* ── Ce qui fait bouger la partie ────────────────────────────────────────── */

/** Paie une mission jugée. */
function payer(etat, m) {
  if (m.semaine) {
    const s = { ...(etat.sachets || {}) };
    s["*"] = (s["*"] || 0) + (RECOMPENSE_SEMAINE.sachets || 0);
    return { ...etat, sachets: s };
  }
  return { ...etat, bourse: crediterGain(etat.bourse, m.po || 0) };
}

/**
 * Le passage au jour ou à la semaine suivants. Une mission remplie et pas
 * réclamée est payée au passage : rien de gagné ne se perd parce qu'on a
 * fermé l'onglet avant minuit. Rend l'état tel quel si rien n'a changé,
 * pour que React n'ait rien à refaire.
 */
export function mettreAJour(etat, { mesures, ctx, maintenant = new Date() }) {
  const jour = jourLocal(maintenant), semaine = semaineLocale(maintenant);
  const M = etat.missions || {};
  if (M.jour === jour && M.semaine === semaine) return etat;
  let e = etat;
  const ev = evaluerMissions(etat, mesures);
  const suite = { ...M };
  if (M.jour !== jour) {
    for (const m of ev.quotidiennes) if (m.atteinte && !m.reclamee) e = payer(e, m);
    suite.jour = jour;
    suite.remplacees = 0;
    suite.quotidiennes = tirerQuotidiennes(jour, ctx, mesures);
  }
  if (M.semaine !== semaine) {
    if (ev.hebdo?.atteinte && !ev.hebdo.reclamee) e = payer(e, ev.hebdo);
    suite.semaine = semaine;
    suite.hebdo = tirerHebdo(semaine, ctx, mesures);
  }
  return { ...e, missions: suite };
}

/**
 * Réclame une mission remplie : `index` 0 à 2 pour celles du jour, "hebdo"
 * pour celle de la semaine. Revérifiée sur la partie du moment : deux clics
 * rapides ne paient qu'une fois.
 */
export function reclamerMission(etat, index, mesures) {
  const M = etat.missions;
  if (!M) return etat;
  if (index === "hebdo") {
    if (!M.hebdo) return etat;
    const m = juger(M.hebdo, mesures, true);
    if (!m.atteinte || m.reclamee) return etat;
    return { ...payer(etat, m), missions: { ...M, hebdo: { ...M.hebdo, reclamee: true } } };
  }
  const brute = M.quotidiennes?.[index];
  if (!brute) return etat;
  const m = juger(brute, mesures);
  if (!m.atteinte || m.reclamee) return etat;
  const quotidiennes = M.quotidiennes.map((q, i) => (i === index ? { ...q, reclamee: true } : q));
  return { ...payer(etat, m), missions: { ...M, quotidiennes } };
}

/**
 * Remplace une mission du jour pas encore remplie, une fois par jour, par
 * une mission d'un autre mode que les deux qui restent. Rend l'état tel
 * quel si ce n'est pas permis ou si rien d'autre n'est possible.
 */
export function remplacerMission(etat, index, { mesures, ctx }) {
  const M = etat.missions;
  const brute = M?.quotidiennes?.[index];
  if (!brute || (M.remplacees || 0) >= REMPLACEMENTS) return etat;
  if (juger(brute, mesures).atteinte) return etat;
  const autres = M.quotidiennes.filter((_, i) => i !== index);
  const [neuve] = tirerQuotidiennes(
    `${M.jour}#${(M.remplacees || 0) + 1}`, ctx, mesures, 1,
    M.quotidiennes.map((q) => q.type),
    autres.map((q) => TYPE_PAR_ID[q.type].mode),
  );
  if (!neuve) return etat;
  const quotidiennes = M.quotidiennes.map((q, i) => (i === index ? neuve : q));
  return { ...etat, missions: { ...M, quotidiennes, remplacees: (M.remplacees || 0) + 1 } };
}
