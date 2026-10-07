/**
 * Audit économique — ce que les Mines de Kazim ajoutent au gain passif.
 *
 *   node scripts/audit-economie.mjs
 *
 * Depuis le 07/10/2026, la mine ne vend plus son étoile aux kobolds : Tafix
 * apporte chaque jour trois commandes à paie fixe (40, 70, 120 PO ; une
 * quatrième petite avec la faveur du même nom). La petite et la moyenne se
 * remplissent d'une nuit d'absence ; la grosse demande de l'étoile fraîche,
 * un quart d'heure de mine page ouverte (modèle hybride, décision de Clément).
 *
 * Le joueur simulé est celui de `joueur-mine.mjs` : il joue avec les règles du
 * module, livre ce qu'il peut, effondre, offre ses éclats. L'audit **échoue**
 * si :
 *  - le simple passage quotidien (deux minutes) touche la grosse commande :
 *    elle doit demander de jouer ;
 *  - une demi-heure par jour ne la remplit pas au moins un jour sur deux ;
 *  - les Mines rapportent plus de 300 PO par jour à quelque profil que ce
 *    soit : elles complètent le gain passif, le Donjon reste le mode principal.
 */
import { ECONOMIE } from "../src/config/tiers.js";
import { COMMANDES } from "../src/mines/donnees.js";
import { joueur, present, absent } from "./joueur-mine.mjs";

const JOURS = 60;
const passif = ECONOMIE.parHeure * 24;
console.log("\nAUDIT DES COMMANDES DE TAFIX — ce que les Mines ajoutent au gain passif");
console.log(`Booster ${ECONOMIE.prix} PO · gain passif ${passif} PO/j (${(passif / ECONOMIE.prix).toFixed(1)} boosters)`);
console.log(`Commandes : ${COMMANDES.map((c) => c.po + " PO (" + c.minutes + " min de production" + (c.presence ? ", " + c.presence + " min de mine" : "") + ")").join(" · ")}`);
console.log(`${JOURS} jours, deux absences par jour (7 h et 8 h). Moyenne du 8ᵉ au ${JOURS}ᵉ jour.\n`);

const L = [24, 12, 14, 14, 12];
const ligne = (c) => c.map((v, i) => String(v).padEnd(L[i])).join(" ");
console.log(ligne(["Profil", "PO/j Mines", "grosse livrée", "× l'app seule", "strate j60"]));
console.log("─".repeat(L.reduce((a, b) => a + b + 1, 0)));

const res = {};
for (const [nom, cle, minutes] of [
  ["Passage (2 min)", "passage", 2], ["10 min par jour", "dix", 10], ["30 min par jour", "trente", 30],
  ["1 h par jour", "heure", 60], ["2 h par jour", "deux", 120],
]) {
  const j = joueur();
  let po = 0, grosses = 0, jours = 0;
  for (let n = 1; n <= JOURS; n++) {
    const avant = j.po;
    present(j, minutes * 60, n);
    absent(j, 7 * 3600);
    absent(j, 8 * 3600);
    if (n >= 8) {
      jours++;
      po += j.po - avant;
      if (j.S.commandes && j.S.commandes.liste.some((c) => c.presence && c.livree)) grosses++;
    }
  }
  res[cle] = { po: po / jours, grosses: grosses / jours };
  console.log(ligne([nom, Math.round(po / jours), Math.round((grosses / jours) * 100) + " %",
    "× " + ((passif + po / jours) / passif).toFixed(2), j.strate]));
}

const bornes = [
  ["le passage quotidien ne remplit pas la grosse commande", res.passage.grosses === 0],
  ["une demi-heure par jour la remplit au moins un jour sur deux", res.trente.grosses >= 0.5],
  ["les Mines restent sous 300 PO par jour", Object.values(res).every((r) => r.po <= 300)],
];
console.log("");
let echec = false;
for (const [quoi, ok] of bornes) {
  console.log((ok ? "  ok     " : "  ÉCHEC  ") + quoi);
  if (!ok) echec = true;
}
console.log("");
if (echec) process.exit(1);
