/**
 * Audit de résistance des Mines de Kazim — les stratégies extrêmes.
 *
 *   node scripts/audit-stress-mines.mjs
 *
 * Les autres audits rejouent des joueurs raisonnables. Celui-ci rejoue ceux
 * qui cherchent la faille, et chaque cas vient de l'audit du 27/10/2026
 * (`claude/audit-mines-gameplay.md`), après la partie de Mormegil : 258 éclats
 * et le niveau 101 en un peu plus d'une journée. Il échoue si l'une de ces
 * portes se rouvre :
 *  - la boucle courte (effondrer dès que la mine stagne) rapporte plus qu'une
 *    heure par jour pendant un mois ;
 *  - remonter dans une mine neuve pour briser des filons tendres rapporte des
 *    niveaux ;
 *  - remonter puis redescendre change le rang du filon ;
 *  - une frappe au-delà de la cadence comptée accélère la descente ;
 *  - un objet du chantier n'a aucun effet au moment où il s'achète ;
 *  - un point de talent peut se placer sans effet.
 */
import * as R from "../src/mines/regles.js";
import { EQUIPEMENT } from "../src/mines/donnees.js";
import { etatNeuf } from "../src/mines/sauvegarde.js";
import { joueur, present, absent } from "./joueur-mine.mjs";

const resultats = [];
const borne = (quoi, ok, detail) => resultats.push([quoi, ok, detail]);
const copie = (S) => JSON.parse(JSON.stringify(S));
console.log("\nAUDIT DE RÉSISTANCE — Mines de Kazim\n");

/* 1. La boucle courte, contre un mois à une heure par jour. */
{
  const court = joueur();
  for (let m = 1; m <= 20 * 60; m++) present(court, 60, 1, { frappesMinute: 300, boucleCourte: true });
  const sage = joueur();
  for (let n = 1; n <= 30; n++) { present(sage, 3600, n); absent(sage, 7 * 3600); absent(sage, 8 * 3600); }
  console.log(`Boucle courte, 20 h de jeu à 5 frappes/s : ${court.S.eclats} éclats, strate ${court.strate}, ${court.S.effondrements} effondrements`);
  console.log(`Une heure par jour pendant un mois       : ${sage.S.eclats} éclats, strate ${sage.strate}`);
  borne("la boucle courte ne rapporte pas plus qu'un mois à une heure par jour",
    court.S.eclats <= sage.S.eclats, `${court.S.eclats} contre ${sage.S.eclats}`);
}

/* 2. Le farm d'expérience : une mine neuve d'un joueur de fin de partie. */
{
  const S = Object.assign(etatNeuf(), {
    profondeur: 15, profondeurMax: 15, eclats: 220, niveau: 90,
    talents: { force: 37, echo: 8, discipline: 35, fortune: 10 },
    compagnons: { fanal: 100, nain: 100, foreuse: 100, golem: 100, deser: 100, sourc: 100, elem: 90, titan: 80 },
    equipement: EQUIPEMENT.map((e) => e.id),
  });
  R.naitreFilon(S, () => 0.99);
  const frappe = R.degatsClic(S);
  const niveau = S.niveau;
  for (let p = 1; p < 15; p++) {
    S.profondeur = p;
    R.naitreFilon(S, () => 0.99);
    for (let k = 0; k < 200; k++) R.infliger(S, frappe, null, () => 0.99);
  }
  console.log(`Farm d'expérience, 2 800 frappes dans les strates 1 à 14 : +${S.niveau - niveau} niveau(x)`);
  borne("remonter briser des filons tendres ne rapporte pas de niveau", S.niveau - niveau < 1, `+${S.niveau - niveau}`);
}

/* 3. Le reroll des filons riches. */
{
  const S = Object.assign(etatNeuf(), { profondeur: 10, profondeurMax: 10, brises: { 10: 5 },
    talents: { force: 0, echo: 0, discipline: 0, fortune: 10 } });
  R.naitreFilon(S);
  const rang = S.filonRang;
  let change = 0;
  for (let i = 0; i < 200; i++) {
    S.profondeur = 9; R.naitreFilon(S);
    S.profondeur = 10; R.naitreFilon(S);
    if (S.filonRang !== rang) change++;
  }
  console.log(`Reroll, 200 allers-retours Remonter / Descendre : ${change} changement(s) de rang`);
  borne("remonter puis redescendre ne change pas le rang du filon", change === 0, `${change}`);
}

/* 4. La cadence : au-delà de FRAPPES_MAX, rien ne va plus vite. */
{
  const temps = (frappesSeconde) => {
    const j = joueur();
    const comptees = Math.min(frappesSeconde, R.FRAPPES_MAX);
    for (let m = 1; m <= 600; m++) {
      present(j, 60, 1, { frappesMinute: comptees * 60 });
      if (j.strate >= 13) return m;
    }
    return Infinity;
  };
  const t15 = temps(R.FRAPPES_MAX), t100 = temps(100);
  const f = (m) => (m === Infinity ? "plus de 10 h" : Math.floor(m / 60) + " h " + (m % 60) + " min");
  console.log(`Cadence : strate 13 en ${f(t15)} à ${R.FRAPPES_MAX} frappes/s, ${f(t100)} à 100 frappes/s`);
  borne("cent frappes par seconde ne descendent pas plus vite que la cadence comptée", t100 >= t15, `${t100} min contre ${t15}`);
  // Le plafond met l'autoclicker au rythme d'un joueur très rapide, pas plus.
  borne("à la cadence comptée, la strate 13 demande au moins une heure", t15 >= 60, f(t15));
}

/* 5. Chaque objet du chantier agit au moment où il s'achète. */
{
  const mEv = (S) => { const c = R.chanceEvenement(S); return (1 - c) + c * (0.4 * 12 + 0.6 * 4); };
  const clic = (S) => R.degatsClic(S) * (1 + (R.critChance(S) / 100) * (R.critMult(S) - 1));
  const production = (S) => (R.dps(S) + 5 * clic(S)) * R.RECOLTE * R.multRecolte(S) * mEv(S);
  const j = joueur();
  const etats = {};
  for (let m = 0; m < 3000 && Object.keys(etats).length < EQUIPEMENT.length; m++) {
    present(j, 60, 1, { frappesMinute: 300, effondrer: false });
    // L'état où l'objet devient achetable : débloqué, et l'étoile pour le payer.
    for (const e of EQUIPEMENT) {
      if (!etats[e.id] && j.S.profondeurMax >= e.req + 1 && j.S.etoileTotale >= e.cout) etats[e.id] = copie(j.S);
    }
  }
  const morts = [];
  for (const e of EQUIPEMENT) {
    const S = etats[e.id];
    if (!S) { morts.push(e.nom + " (jamais atteint)"); continue; }
    const sans = copie(S); sans.equipement = sans.equipement.filter((x) => x !== e.id);
    const avec = copie(sans); avec.equipement.push(e.id);
    const gain = production(avec) / production(sans) - 1;
    if (!(gain > 0.005)) morts.push(`${e.nom} (${(gain * 100).toFixed(1)} %)`);
  }
  console.log(`Chantier : ${EQUIPEMENT.length - morts.length} objets sur ${EQUIPEMENT.length} agissent à leur déblocage`
    + (morts.length ? ` — sans effet : ${morts.join(", ")}` : ""));
  borne("chaque objet du chantier agit au moment où il s'achète", morts.length === 0, morts.join(", "));
}

/* 6. Aucun point de talent sans effet. */
{
  const vides = [];
  for (const faveurs of [[], ["oeil"]]) {
    for (const t of ["force", "echo", "discipline", "fortune"]) {
      const S = Object.assign(etatNeuf(), { faveurs, compagnons: { fanal: 50, nain: 20 }, equipement: ["l1", "l2"] });
      S.talents[t] = 0;
      while (S.talents[t] < Math.min(40, R.talentMax(S, t))) {
        const avant = { c: R.critChance(S), r: R.chanceEvenement(S), d: R.dps(S), f: R.degatsClic(S) };
        S.talents[t]++;
        const apres = { c: R.critChance(S), r: R.chanceEvenement(S), d: R.dps(S), f: R.degatsClic(S) };
        if (Object.keys(avant).every((k) => apres[k] === avant[k])) vides.push(`${t} ${S.talents[t]}${faveurs.length ? " (Œil)" : ""}`);
      }
    }
  }
  console.log(`Talents : ${vides.length ? "points sans effet — " + vides.join(", ") : "chaque point plaçable agit"}`);
  borne("aucun point de talent plaçable n'est sans effet", vides.length === 0, vides.join(", "));
}

console.log("");
let echec = false;
for (const [quoi, ok, detail] of resultats) {
  console.log((ok ? "  ok     " : "  ÉCHEC  ") + quoi + (ok ? "" : ` (${detail})`));
  if (!ok) echec = true;
}
console.log("");
if (echec) process.exit(1);
