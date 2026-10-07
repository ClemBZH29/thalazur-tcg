/**
 * Le joueur simulé des Mines de Kazim, partagé par `audit-eclats.mjs` et
 * `audit-economie.mjs`. Il ne recopie aucune formule : il joue avec les
 * règles du module (`src/mines/regles.js`, `faveur.js`), comme le composant.
 *
 * Ce qu'il fait, à chaque séance :
 *  - il livre ce que l'absence a rempli (petite et moyenne commandes) ;
 *  - il frappe à `frappesMinute` et achète toutes les dix secondes, en gardant
 *    de côté l'étoile de la grosse commande tant qu'elle n'est pas livrée ;
 *  - il effondre quand le gain dépasse une fois et demie le précédent, ou
 *    quand la mine n'a pas gagné de strate depuis trente minutes de jeu ;
 *  - il offre ses éclats au Fossoyeur, la faveur la moins chère d'abord.
 * Entre deux séances, deux absences au rendement du jeu, faveurs comprises.
 *
 * Les filons riches sont pris en espérance, pas tirés : deux joueurs simulés
 * identiques donnent le même résultat.
 */
import * as R from "../src/mines/regles.js";
import * as F from "../src/mines/faveur.js";
import { COMPAGNONS, EQUIPEMENT, AMELIORATIONS } from "../src/mines/donnees.js";
import { etatNeuf } from "../src/mines/sauvegarde.js";

/* L'espérance du rang : `briser` reçoit un tirage qui donne l'ordinaire, et la
   récolte est corrigée de l'espérance du multiplicateur. */
const multEvenement = (S) => {
  const c = R.chanceEvenement(S);
  return (1 - c) + 0.4 * c * 12 + 0.6 * c * 4;
};
function briser(S) {
  const avant = S.etoile;
  R.briser(S, () => 0.99);
  const gain = (S.etoile - avant) * (multEvenement(S) - 1);
  S.etoile += gain;
  S.etoileTotale += gain;
}
function degats(S, d) {
  let garde = 0;
  while (d > 0 && garde++ < 300000) {
    if (d >= S.pv) { d -= S.pv; S.pv = 0; briser(S); } else { S.pv -= d; d = 0; }
  }
}

function acheter(S, reserve) {
  const budget = () => S.etoile - reserve;
  for (const e of [...EQUIPEMENT, ...AMELIORATIONS]) {
    if (S.equipement.includes(e.id) || budget() < e.cout) continue;
    if (e.compagnon ? (S.compagnons[e.compagnon] || 0) < e.seuil : S.profondeurMax < e.req + 1) continue;
    S.etoile -= e.cout;
    S.equipement.push(e.id);
  }
  for (let passe = 0; passe < 3; passe++) {
    for (const c of [...COMPAGNONS].reverse()) {
      const T = { ...S, etoile: Math.max(0, budget()) };
      const n = Math.min(R.nbAbordable(T, c), 25);
      if (n < 1) continue;
      const cout = R.coutN(S, c, n);
      if (cout > budget()) continue;
      S.etoile -= cout;
      S.compagnons[c.id] = (S.compagnons[c.id] || 0) + n;
    }
  }
  while (S.points > 0) { S.talents[["force", "discipline", "echo", "fortune"][S.points % 4]]++; S.points--; }
}

function offrirTout(j, jour) {
  for (;;) {
    const f = F.FAVEURS.filter((x) => F.faveurAbordable(j.S, x.id)).sort((a, b) => a.cout - b.cout)[0];
    if (!f) return;
    F.offrir(j.S, f.id);
    j.faveurs.push([f.id, jour]);
  }
}

function livrerTout(j) {
  if (!j.S.commandes) return;
  for (const c of j.S.commandes.liste) {
    const po = R.livrer(j.S, c.id);
    if (po) { j.po += po; j.commandes++; }
  }
}

export function joueur() {
  const S = etatNeuf();
  R.naitreFilon(S, () => 0.99);
  return { S, po: 0, commandes: 0, faveurs: [], strate: 1, dernierGain: 0, joue: 0, descente: 0, pm: 1 };
}

/** `sec` secondes de présence, le `n`-ième jour de la simulation. */
export function present(j, sec, n, { frappesMinute = 90, effondrer = true } = {}) {
  const jour = n;
  R.majCommandes(j.S, jourN(n));
  livrerTout(j);
  for (let t = 0; t < sec; t += 10) {
    const S = j.S;
    const crit = 1 + (Math.min(75, R.critChance(S)) / 100) * (R.critMult(S) - 1);
    const d = R.dps(S) * 10 + (frappesMinute / 60) * 10 * R.degatsClic(S) * crit
      + F.frappesAuto(S) * 10 * R.degatsClic(S)
      // Étoile filante : une frénésie ×7 de quinze secondes toutes les 4 min 30 en moyenne.
      + (F.etoileFilante(S) ? (frappesMinute / 60) * 10 * R.degatsClic(S) * crit * 6 * 15 / 270 : 0);
    degats(S, d);
    S.presence = (S.presence || 0) + 10;
    j.joue += 10;
    if (S.profondeurMax > j.pm) { j.pm = S.profondeurMax; j.descente = j.joue; }
    livrerTout(j);
    // Il ne met de côté l'étoile de la grosse commande qu'une fois le quart
    // d'heure de mine passé : avant, il préfère investir.
    const grosse = S.commandes && S.commandes.liste.find((c) => c.presence && !c.livree);
    acheter(S, grosse && R.presencePour(S, grosse) >= grosse.presence ? grosse.demande : 0);
    const g = R.eclatsDispo(S);
    const stagne = j.joue - j.descente > 1800;
    if (effondrer && g >= 1 && (g >= Math.ceil(j.dernierGain * 1.5) || (g >= j.dernierGain && stagne))) {
      j.dernierGain = g;
      j.S = R.effondrer(S, etatNeuf).mine;
      R.naitreFilon(j.S, () => 0.99);
      j.pm = j.S.profondeurMax;
      j.descente = j.joue;
      offrirTout(j, jour);
    }
    j.strate = Math.max(j.strate, j.S.profondeurMax);
  }
}

/** Une absence, au rendement et au plafond du jeu. Le joueur n'achète pas : il n'est pas là. */
export function absent(j, sec) {
  const b = R.simulerAbsence(j.S, sec * 1000, R.rendementAbsence(j.S), () => 0.99);
  const gain = b.etoile * (multEvenement(j.S) - 1);
  j.S.etoile += gain;
  j.S.etoileTotale += gain;
  j.strate = Math.max(j.strate, j.S.profondeurMax);
}

/** Le jour n de la simulation, à la française. */
export const jourN = (n) => {
  const d = new Date(2026, 9, 8 + n);
  return d.toLocaleDateString("sv");
};
