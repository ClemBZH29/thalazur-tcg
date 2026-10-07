/**
 * Audit des éclats et de la Faveur du Fossoyeur.
 *
 *   node scripts/audit-eclats.mjs
 *
 * Deux fois déjà les éclats se sont emballés : en septembre (racine carrée de
 * l'étoile, l'infini en trois heures), puis à la refonte du 07/10/2026, quand
 * la Faveur raccourcissait chaque mine et rouvrait la boucle (3 000 éclats en
 * deux semaines). Ils se comptent désormais en strates ; cet audit rejoue
 * trois habitudes sur quatre-vingt-dix jours avec le joueur de
 * `joueur-mine.mjs` et **échoue** si :
 *  - à une heure par jour, la première faveur n'arrive pas dans les deux
 *    premiers jours (le premier effondrement doit se sentir) ;
 *  - à une heure par jour, l'arbre complet tombe avant trois semaines, ou
 *    n'est pas complet à deux mois ;
 *  - à trois heures par jour, l'arbre tombe avant la fin de la première semaine ;
 *  - les éclats dépassent 5 000 à trois mois, quel que soit le profil (boucle).
 */
import { joueur, present, absent } from "./joueur-mine.mjs";
import { COUT_ARBRE, FAVEURS } from "../src/mines/faveur.js";

console.log(`\nAUDIT DES ÉCLATS — Faveur du Fossoyeur (arbre complet : ${COUT_ARBRE} éclats, ${FAVEURS.length} faveurs)\n`);

const res = {};
for (const [nom, cle, minutes] of [["20 min par jour", "court", 20], ["1 h par jour", "moyen", 60], ["3 h par jour", "long", 180]]) {
  const j = joueur();
  const releves = [];
  for (let n = 1; n <= 90; n++) {
    present(j, minutes * 60, n);
    absent(j, 7 * 3600);
    absent(j, 8 * 3600);
    if ([1, 3, 7, 14, 30, 60, 90].includes(n)) {
      releves.push(`j${n} ${j.S.eclats}◆ s${j.strate} ×${(1 + j.S.eclats * 0.03).toFixed(1)}`);
    }
  }
  const premiere = j.faveurs.length ? j.faveurs[0][1] : Infinity;
  const complet = j.faveurs.length === FAVEURS.length ? j.faveurs[j.faveurs.length - 1][1] : Infinity;
  res[cle] = { premiere, complet, eclats: j.S.eclats };
  console.log(nom.padEnd(17) + releves.join(" · "));
  console.log(" ".repeat(17) + `première faveur j${premiere} · arbre complet ${complet === Infinity ? "non" : "j" + complet} · effondrements ${j.S.effondrements} · commandes ${Math.round(j.po / 90)} PO/j`);
}

const bornes = [
  ["la première faveur tombe dans les deux premiers jours (1 h/j)", res.moyen.premiere <= 2],
  ["l'arbre ne tombe pas avant trois semaines (1 h/j)", res.moyen.complet >= 21],
  ["l'arbre est complet à deux mois (1 h/j)", res.moyen.complet <= 60],
  ["l'arbre ne tombe pas dans la première semaine (3 h/j)", res.long.complet > 7],
  ["les éclats ne s'emballent pas (moins de 5 000 à trois mois)", Object.values(res).every((r) => r.eclats < 5000)],
];
console.log("");
let echec = false;
for (const [quoi, ok] of bornes) {
  console.log((ok ? "  ok     " : "  ÉCHEC  ") + quoi);
  if (!ok) echec = true;
}
console.log("");
if (echec) process.exit(1);
