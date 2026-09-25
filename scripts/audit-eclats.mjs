/**
 * Audit des éclats — le joueur qui effondre en boucle.
 *
 * `audit-economie.mjs` simule un joueur qui s'effondre au plus une fois par
 * jour, quand le cours kobold est mort. Il n'a jamais vu ce que fait un joueur
 * réel dès sa première journée : jouer en continu et faire sauter les étais
 * dès que l'effondrement multiplie ses éclats. Sous l'ancienne règle, ce joueur
 * doublait ses éclats en un temps de plus en plus court et atteignait l'infini
 * en moins de trois heures. Cet audit le rejoue, et échoue si la boucle
 * s'emballe de nouveau.
 *
 *   node scripts/audit-eclats.mjs
 *
 * Même joueur que l'audit d'économie (achats, talents), mais présent sans
 * interruption, 150 frappes par minute, un achat toutes les dix secondes.
 */
import * as donnees from "../src/mines/donnees.js";
import * as regles from "../src/mines/regles.js";
import { etatNeuf } from "../src/mines/sauvegarde.js";

const K = { ...donnees, ...regles, etatNeuf };

/** Espérance du multiplicateur d'événement, comme dans l'audit d'économie. */
const multEvenement = (S) => {
  const s = K.chanceEvenement(S);
  return (1 - s) + 0.4 * s * 12 + 0.6 * s * 4;
};

function briser(S) {
  const r = S.pvMax * 0.24 * K.multRecolte(S) * multEvenement(S);
  S.etoile += r;
  S.etoileTotale += r;
  S.brises[S.profondeur] = (S.brises[S.profondeur] || 0) + 1;
  S.brisesTotal++;
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
  while (d > 0 && garde++ < 200000) {
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

/** Joue `heures` en continu ; effondre dès que les éclats seraient × `ratio`. */
function boucle(ratio, heures) {
  let S = neuve();
  const effondrements = [];
  const pas = 10;
  for (let t = 0; t < heures * 3600; t += pas) {
    const pc = Math.min(75, K.critChance(S)) / 100;
    degats(S, K.dps(S) * pas + (150 / 60) * pas * K.degatsClic(S) * (1 + pc * (K.critMult(S) - 1)));
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
    const gain = K.eclatsDispo(S);
    if (gain > 0 && S.eclats + gain >= Math.max(1, S.eclats) * ratio) {
      effondrements.push({ minute: Math.round(t / 60), strate: S.profondeurMax, eclats: S.eclats + gain });
      S = neuve({
        poGagnes: S.poGagnes, eclats: S.eclats + gain, echanges: S.echanges,
        effondrements: S.effondrements + 1, etoileTotale: S.etoileTotale,
      });
    }
  }
  return { effondrements, S };
}

const HEURES = 10;
let echec = false;
console.log(`\nAUDIT DES ÉCLATS — joueur présent ${HEURES} h d'affilée, effondre dès que ses éclats seraient multipliés\n`);
for (const ratio of [2, 3]) {
  const { effondrements, S } = boucle(ratio, HEURES);
  console.log(`Effondre à × ${ratio} :`);
  let precedent = 0, ecart = 0, raccourcis = 0;
  for (const e of effondrements) {
    const d = e.minute - precedent;
    if (ecart && d < ecart * 0.8) raccourcis++;
    console.log(`  ${String(e.minute).padStart(4)} min  (+${String(d).padStart(3)})  strate ${String(e.strate).padStart(2)}  ${e.eclats} éclats`);
    precedent = e.minute; ecart = d;
  }
  console.log(`  au bout de ${HEURES} h : ${S.eclats} éclats, soit × ${K.mEclats(S).toFixed(1)} de dégâts\n`);
  /* L'emballement se reconnaît à deux signes : un nombre qui sort des
     flottants, ou des effondrements qui se rapprochent au lieu de s'espacer. */
  if (!Number.isFinite(S.eclats) || raccourcis > 2) echec = true;
}
if (echec) {
  console.log("ÉCHEC : la boucle d'effondrement s'emballe.\n");
  process.exit(1);
}
console.log("Les effondrements s'espacent : la boucle ne s'emballe pas.\n");
