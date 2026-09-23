/**
 * Audit du mélange « mine + gain passif ».
 *
 * Combien de boosters par jour, selon la façon de jouer ? La question n'a pas
 * de réponse analytique : la mine mêle une production exponentielle des
 * compagnons à un cours kobold qui s'effondre en exponentielle inverse, et le
 * joueur arbitre en permanence entre embaucher, descendre et vendre. On simule.
 *
 * Le script lit les formules directement dans src/mines/MinesDeKazim.jsx — la
 * tranche entre les bannières DONNÉES et COMPOSANT, qui ne dépend ni de React
 * ni du navigateur. Aucune formule n'est recopiée ici : un audit qui duplique
 * le code qu'il mesure ne mesure plus rien.
 *
 * Ce qui est réimplémenté, faute d'être extractible du composant, c'est la
 * boucle : dégâts → filon brisé → récolte → descente. Elle suit `briserFilon`
 * et `appliquerDegats` ligne pour ligne, y compris le fait que la récolte vaut
 * les points de vie du filon et non une valeur propre — donc que descendre
 * n'augmente pas la récolte, seulement l'ancre du cours et l'expérience.
 *
 *   node scripts/audit-economie.mjs
 */
import { ECONOMIE, MINE } from "../src/config/tiers.js";
import * as donnees from "../src/mines/donnees.js";
import * as regles from "../src/mines/regles.js";
import * as format from "../src/mines/format.js";
import { etatNeuf } from "../src/mines/sauvegarde.js";

/* Les règles du module, importées telles quelles : l'audit rejoue exactement
   les formules que le jeu applique. */
const K = { ...donnees, ...regles, ...format, etatNeuf };

/* ── La boucle du module ──────────────────────────────────────────────────── */

/** Espérance du multiplicateur d'événement : poche ×12, éventail ×4. */
const multEvenement = (S) => {
  const seuil = K.chanceEvenement(S);
  return (1 - seuil) + 0.4 * seuil * 12 + 0.6 * seuil * 4;
};

/** `briserFilon`, en espérance sur l'événement plutôt qu'en tirage. */
function briser(S) {
  S.etoile += S.pvMax * 0.24 * K.multRecolte(S) * multEvenement(S);
  S.etoileTotale += S.pvMax * 0.24 * K.multRecolte(S) * multEvenement(S);
  S.brises[S.profondeur] = (S.brises[S.profondeur] || 0) + 1;
  S.brisesTotal++;
  S.xp += Math.round(5 * Math.pow(S.profondeur, 1.25));
  while (S.xp >= K.xpRequis(S)) {
    S.xp -= K.xpRequis(S);
    S.niveau++;
    S.points++;
  }
  if (S.brises[S.profondeur] >= K.FILONS_PAR_STRATE && S.profondeur === S.profondeurMax) {
    S.profondeur++;
    S.profondeurMax = S.profondeur;
  }
  S.pvMax = K.pvFilon(S.profondeur, S.brises[S.profondeur] || 0);
  S.pv = S.pvMax;
}

/** `appliquerDegats`, sans la bride de cinq cents tours du rendu. */
function appliquerDegats(S, d) {
  let garde = 0;
  while (d > 0 && garde < 400000) {
    if (d >= S.pv) { d -= S.pv; S.pv = 0; briser(S); }
    else { S.pv -= d; d = 0; }
    garde++;
  }
}

/* ── Le joueur simulé ─────────────────────────────────────────────────────── */

/**
 * Une politique simple, celle que prend n'importe qui : embaucher tant que
 * c'est abordable en gardant de quoi vendre, installer tout l'équipement
 * accessible, placer les talents, vendre une fois par jour. Un pilotage fin
 * ferait mieux : les chiffres sont un plancher, pas un plafond.
 */
function simuler({ jours, minutesActives, clicsParMinute = 150, effondrer = true }) {
  const S = K.etatNeuf();
  S.profondeur = 1;
  S.pvMax = K.pvFilon(1, 0);
  S.pv = S.pvMax;
  const parJour = [];

  for (let jour = 0; jour < jours; jour++) {
    let poJour = 0;
    const actives = minutesActives * 60;
    const inactives = 86400 - actives;

    /* Présence : la production de l'équipe et les frappes du joueur passent
       toutes les deux par les dégâts. */
    if (actives > 0) {
      const pas = 60;
      for (let t = 0; t < actives; t += pas) {
        const dt = Math.min(pas, actives - t);
        let d = K.dps(S) * dt;
        const clics = (clicsParMinute / 60) * dt;
        const pCrit = Math.min(75, K.critChance(S)) / 100;
        d += clics * K.degatsClic(S) * (1 + pCrit * (K.critMult(S) - 1));
        S.resonance = Math.min(K.RESONANCE_MAX / 0.004, (S.resonance || 0) + clics * pCrit);
        appliquerDegats(S, d);
      }
    }

    /* Absence : le module crédite en étoile directe, à 35 % du rendement et
       plafonnée à huit heures. Ni expérience ni descente. */
    const absence = Math.min(8 * 3600, inactives);
    const hors = K.dps(S) * absence * 0.35 * 0.24 * K.multRecolte(S);
    if (hors > 0) { S.etoile += hors; S.etoileTotale += hors; }

    /* Chantier, puis compagnons du plus gros au plus petit. */
    for (const e of K.EQUIPEMENT) {
      if (S.equipement.includes(e.id)) continue;
      if (S.profondeurMax < e.req + 1) continue;
      if (S.etoile < e.cout) continue;
      S.etoile -= e.cout;
      S.equipement.push(e.id);
    }
    for (let passe = 0; passe < 4; passe++) {
      for (const c of [...K.COMPAGNONS].reverse()) {
        const n = Math.min(K.nbAbordable(S, c), 25);
        if (n < 1) continue;
        const cout = K.coutN(S, c, n);
        if (cout > S.etoile * 0.6) continue;
        S.etoile -= cout;
        S.compagnons[c.id] = (S.compagnons[c.id] || 0) + n;
      }
    }
    /* Talents : Force paie la présence, Discipline paie l'absence. */
    while (S.points > 0) {
      const id = minutesActives >= 10
        ? ["force", "discipline", "echo", "force"][S.points % 4]
        : "discipline";
      S.talents[id]++;
      S.points--;
    }

    /* Vente du jour. Le cours propre tourne entre 0,82 et 1,22 : on prend la
       moyenne, la variance ne change pas l'ordre de grandeur. */
    S.cours = 1.02;
    const { po, depense } = K.poPourMise(S, S.etoile);
    if (po >= 1) {
      S.etoile -= Math.min(S.etoile, depense);
      S.poGagnes += po;
      S.poRun += po;
      S.resonance = 0;
      S.echanges++;
      poJour += po;
    }

    /* Effondrement : le cours kobold est divisé par e tous les trente-deux PO
       versés. Passé un facteur d'un tiers, tout remettre à zéro rapporte plus
       que continuer à vendre à un cours mort. */
    if (effondrer) {
      const gain = K.eclatsDispo(S);
      if (gain > 0 && Math.exp(-S.poRun / K.FATIGUE_PO) < 0.34) {
        const garde = {
          poGagnes: S.poGagnes, eclats: S.eclats + gain, echanges: S.echanges,
          effondrements: S.effondrements + 1, etoileTotale: S.etoileTotale,
        };
        Object.assign(S, K.etatNeuf(), garde);
        S.profondeur = 1;
        S.pvMax = K.pvFilon(1, 0);
        S.pv = S.pvMax;
      }
    }
    parJour.push(poJour);
  }
  return { parJour, S };
}

/* ── Profils ──────────────────────────────────────────────────────────────── */

const PROFILS = [
  { nom: "Ne joue pas la mine", minutes: 0 },
  { nom: "Trois minutes par jour", minutes: 3 },
  { nom: "Dix minutes par jour", minutes: 10 },
  { nom: "Trente minutes par jour", minutes: 30 },
  { nom: "Deux heures par jour", minutes: 120 },
];

const JOURS = 90;
const passifJour = ECONOMIE.parHeure * 24;

console.log("\nAUDIT DU MÉLANGE MINE + GAIN PASSIF");
console.log(`Booster ${ECONOMIE.prix} PO · gain passif ${ECONOMIE.parHeure} PO/h, plafonné à ${ECONOMIE.plafond} PO`);
console.log(`Gain passif seul : ${passifJour} PO/j, soit ${(passifJour / ECONOMIE.prix).toFixed(1)} boosters par jour.`);
console.log(`Simulation sur ${JOURS} jours ; moyenne du régime établi, du 15ᵉ au 90ᵉ jour.\n`);

console.log(`Conversion de l'application : × ${MINE.multiplicateur}, plafonnée à ${MINE.plafondJour} PO par jour.\n`);

const L = [26, 11, 11, 11, 11, 9];
const ligne = (c) => c.map((v, i) => String(v).padEnd(L[i])).join(" ");
console.log(ligne(["Profil", "PO kobold", "× conv.", "créditées", "PO/j total", "boosters"]));
console.log("─".repeat(L.reduce((a, b) => a + b + 1, 0)));

const res = [];
for (const p of PROFILS) {
  const r = simuler({ jours: JOURS, minutesActives: p.minutes });
  const etabli = r.parJour.slice(14);
  const brut = etabli.reduce((a, b) => a + b, 0) / etabli.length;
  const converti = brut * MINE.multiplicateur;
  const credite = Math.min(converti, MINE.plafondJour);
  const total = passifJour + credite;
  res.push({ ...p, brut, credite, total, S: r.S, parJour: r.parJour });
  console.log(ligne([
    p.nom, Math.round(brut), Math.round(converti),
    Math.round(credite) + (converti > MINE.plafondJour ? " plaf." : ""),
    Math.round(total),
    (total / ECONOMIE.prix).toFixed(1) + "  × " + (total / passifJour).toFixed(2),
  ]));
}

console.log("\nMontée, en PO par jour et par semaine");
for (const p of res.filter((r) => r.minutes === 3 || r.minutes === 10 || r.minutes === 30)) {
  const sem = [];
  for (let s = 0; s < 12; s++) {
    const t = p.parJour.slice(s * 7, s * 7 + 7);
    sem.push(Math.round(t.reduce((a, b) => a + b, 0) / t.length));
  }
  console.log(`  ${p.nom.padEnd(24)} ${sem.map((v, i) => `S${i + 1} ${v}`).join(" · ")}`);
  console.log(`  ${"".padEnd(24)} strate ${p.S.profondeurMax} · ${p.S.effondrements} effondrements · ${p.S.eclats} éclats`);
}
console.log("");
