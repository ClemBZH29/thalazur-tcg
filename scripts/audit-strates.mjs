/**
 * Audit des strates — à quelle vitesse descend-on ?
 *
 * Au premier retour bêta (06/10/2026), un joueur était à la strate 12 en
 * vingt-six minutes, et Clément à la strate 25 en moins d'une semaine. Aucun
 * audit ne le voyait : `audit-economie.mjs` mesure des PO, `audit-eclats.mjs`
 * la boucle d'effondrement. Celui-ci rejoue des profils de joueur réels —
 * présent, puis absent avec le rendement d'absence du jeu — et échoue si les
 * huit strates nommées redeviennent l'affaire d'une seule soirée.
 *
 *   node scripts/audit-strates.mjs
 *
 * Joueur simulé : 90 frappes par minute, achats toutes les dix secondes,
 * effondre dès que ses éclats doubleraient, deux absences de huit heures par
 * jour. Ses chiffres ont été recoupés avec deux parties réelles sous
 * l'ancienne pente (strate 13 à une heure, strate 28 à une semaine).
 */
import * as donnees from "../src/mines/donnees.js";
import * as regles from "../src/mines/regles.js";
import { etatNeuf } from "../src/mines/sauvegarde.js";

const K = { ...donnees, ...regles, etatNeuf };

const multEvenement = (S) => {
  const s = K.chanceEvenement(S);
  return (1 - s) + 0.4 * s * 12 + 0.6 * s * 4;
};

function briser(S) {
  const r = S.pvMax * K.RECOLTE * K.multRecolte(S) * multEvenement(S);
  S.etoile += r;
  S.etoileTotale += r;
  S.brises[S.profondeur] = (S.brises[S.profondeur] || 0) + 1;
  S.xp += Math.round(5 * Math.pow(S.profondeur, 1.25));
  while (S.xp >= K.xpRequis(S)) { S.xp -= K.xpRequis(S); S.niveau++; S.points++; }
  if (S.brises[S.profondeur] >= K.FILONS_PAR_STRATE && S.profondeur === S.profondeurMax) {
    S.profondeur++;
    S.profondeurMax = S.profondeur;
  }
  S.pvMax = K.pvFilon(S.profondeur, S.brises[S.profondeur] || 0);
  S.pv = S.pvMax;
}

function degats(S, d) {
  let garde = 0;
  while (d > 0 && garde++ < 400000) {
    if (d >= S.pv) { d -= S.pv; S.pv = 0; briser(S); } else { S.pv -= d; d = 0; }
  }
}

function neuve(garde = {}) {
  const S = Object.assign(K.etatNeuf(), garde);
  S.profondeur = 1;
  S.pvMax = K.pvFilon(1, 0);
  S.pv = S.pvMax;
  return S;
}

function acheter(S) {
  for (const e of [...K.EQUIPEMENT, ...K.AMELIORATIONS]) {
    if (S.equipement.includes(e.id) || S.etoile < e.cout) continue;
    if (e.compagnon ? (S.compagnons[e.compagnon] || 0) < e.seuil : S.profondeurMax < e.req + 1) continue;
    S.etoile -= e.cout;
    S.equipement.push(e.id);
  }
  for (let passe = 0; passe < 3; passe++) {
    for (const c of [...K.COMPAGNONS].reverse()) {
      const n = Math.min(K.nbAbordable(S, c), 25);
      if (n < 1) continue;
      const cout = K.coutN(S, c, n);
      if (cout > S.etoile) continue;
      S.etoile -= cout;
      S.compagnons[c.id] = (S.compagnons[c.id] || 0) + n;
    }
  }
  while (S.points > 0) { S.talents[["force", "discipline", "echo", "force"][S.points % 4]]++; S.points--; }
}

/** `sec` secondes de présence. */
function present(j, sec, frappesMinute = 90) {
  for (let t = 0; t < sec; t += 10) {
    const S = j.S;
    const pc = Math.min(75, K.critChance(S)) / 100;
    degats(S, K.dps(S) * 10 + (frappesMinute / 60) * 10 * K.degatsClic(S) * (1 + pc * (K.critMult(S) - 1)));
    acheter(S);
    const gain = K.eclatsDispo(S);
    if (gain > 0 && S.eclats + gain >= Math.max(1, S.eclats) * 2) {
      j.effondrements++;
      j.S = neuve({ eclats: S.eclats + gain, effondrements: S.effondrements + 1, etoileTotale: S.etoileTotale });
    }
    j.strate = Math.max(j.strate, j.S.profondeurMax);
  }
}

/** Une absence, au rendement et au plafond du jeu. */
function absent(j, sec) {
  degats(j.S, K.dps(j.S) * Math.min(sec, K.ABSENCE_MAX / 1000) * K.RENDEMENT_ABSENCE);
  acheter(j.S);
  j.strate = Math.max(j.strate, j.S.profondeurMax);
}

const joueur = () => ({ S: neuve(), effondrements: 0, strate: 1 });
const releves = {};

console.log("\nAUDIT DES STRATES — strate la plus profonde atteinte\n");

/* Une seule soirée, sans quitter la page. */
{
  const j = joueur();
  const ligne = [];
  let avant = 0;
  for (const m of [15, 30, 60, 120, 240]) {
    present(j, (m - avant) * 60);
    avant = m;
    ligne.push(`${m} min : ${j.strate}`);
    releves[`soiree-${m}`] = j.strate;
  }
  console.log("Une soirée continue      " + ligne.join(" · "));
}

/* Des habitudes, sur deux mois. */
for (const [nom, cle, minutes] of [["20 min par jour", "court", 20], ["1 h par jour", "moyen", 60], ["3 h par jour", "long", 180]]) {
  const j = joueur();
  const ligne = [];
  for (let jour = 1; jour <= 60; jour++) {
    present(j, minutes * 60);
    absent(j, 8 * 3600);
    absent(j, 8 * 3600);
    if ([1, 3, 7, 14, 30, 60].includes(jour)) {
      ligne.push(`j${jour} : ${j.strate}`);
      releves[`${cle}-j${jour}`] = j.strate;
    }
  }
  console.log(nom.padEnd(25) + ligne.join(" · "));
}

/* Les bornes. Les huit strates nommées ne tiennent pas dans la première
   heure ; l'Abîme (strate 8) se gagne en jours, pas en minutes ; et
   personne ne passe la strate 20 en deux mois. */
const bornes = [
  ["la première heure s'arrête avant l'Abîme", releves["soiree-60"] < 8],
  ["une heure par jour n'a pas l'Abîme au premier soir", releves["moyen-j1"] < 8],
  ["une heure par jour reste sous la strate 16 à une semaine", releves["moyen-j7"] < 16],
  ["trois heures par jour restent sous la strate 20 à deux mois", releves["long-j60"] < 20],
  ["vingt minutes par jour atteignent l'Abîme en un mois", releves["court-j30"] >= 8],
];
console.log("");
let echec = false;
for (const [quoi, ok] of bornes) {
  console.log(`  ${ok ? "ok    " : "ÉCHEC "} ${quoi}`);
  if (!ok) echec = true;
}
console.log("");
if (echec) process.exit(1);
