/**
 * Une tactique sous forme de génome : une suite de nombres que l'évolution
 * fait varier, et la façon de jouer qu'elle décrit.
 *
 * Le pilote automatique du jeu (`choixAuto`) a quatre stratégies écrites à
 * la main. Ici, chaque décision est réglée par des gènes :
 *
 * - **la cible** : chaque adversaire reçoit une note, somme pondérée de ce
 *   qu'on voit de lui (PV, ATQ, menace, gardien, élite, achevable d'un coup,
 *   marqué, soigneur, mage, saigne) ; on frappe la mieux notée ;
 * - **les techniques** : un seuil par famille (soigner sous tant de PV,
 *   provoquer quand un allié tombe sous tant, frapper de zone à partir de
 *   tant d'adversaires, garder une grosse frappe pour une cible solide…) ;
 * - **le chemin** : une préférence par genre de salle, et ce qu'elle devient
 *   quand l'équipe est blessée ;
 * - **les rencontres** : pour chacune, accepter ou refuser selon la santé de
 *   l'équipe et la profondeur (les pièges du coffre et de l'écho blessent
 *   en proportion de l'étage) : une règle linéaire à trois gènes.
 *
 * Une tactique ne voit que ce que voit le joueur à l'écran : elle pourrait
 * devenir une stratégie du jeu telle quelle.
 */
import * as R from "../../src/donjon/regles.js";

const GENRES = ["combat", "elite", "tresor", "evenement", "repos"];
const IDS_RENCONTRES = R.RENCONTRES.map((e) => e.id);

/** Les gènes : identifiant, bornes, et le libellé qui sert au rapport. */
export const GENES = [
  // La cible : poids de −1 à 1.
  { id: "c.pvFrac", min: -1, max: 1, nom: "PV restants (en %)" },
  { id: "c.pv", min: -1, max: 1, nom: "PV restants (en valeur)" },
  { id: "c.atq", min: -1, max: 1, nom: "ATQ" },
  { id: "c.menace", min: -1, max: 1, nom: "menace (ATQ pour ses PV)" },
  { id: "c.boss", min: -1, max: 1, nom: "c'est le gardien" },
  { id: "c.elite", min: -1, max: 1, nom: "c'est une élite" },
  { id: "c.achevable", min: -1, max: 1, nom: "achevable d'un coup" },
  { id: "c.marque", min: -1, max: 1, nom: "marquée" },
  { id: "c.soigneur", min: -1, max: 1, nom: "soigne les siens" },
  { id: "c.mage", min: -1, max: 1, nom: "frappe de zone (mage)" },
  { id: "c.saigne", min: -1, max: 1, nom: "saigne déjà" },
  // Les techniques : seuils de 0 à 1.
  { id: "t.soin", min: 0, max: 1, nom: "Soin, Voile : un allié sous" },
  { id: "t.souffle", min: 0, max: 1, nom: "Second souffle : un allié sous (ou un tombé)" },
  { id: "t.ravit", min: 0, max: 1, nom: "Ravitaillement : PV manquants de l'équipe au-delà de" },
  { id: "t.provoc", min: 0, max: 1, nom: "Provocation : un autre allié sous" },
  { id: "t.soutien", min: 0, max: 1, nom: "Galvaniser, Ralliement, Rempart : adversaires d'au moins" },
  { id: "t.zone", min: 0, max: 1, nom: "Vague, Tempête : adversaires d'au moins" },
  { id: "t.frappe", min: 0, max: 1, nom: "grosse frappe gardée pour une cible d'au moins (× l'ATQ)" },
  // Le chemin : préférence de base, et ce qu'ajoute une équipe blessée.
  ...GENRES.flatMap((g) => [
    { id: `s.${g}`, min: -1, max: 1, nom: `salle ${R.GENRES[g].nom}` },
    { id: `s.${g}.blesse`, min: -1, max: 1, nom: `salle ${R.GENRES[g].nom}, équipe blessée` },
  ]),
  // Les rencontres : premier choix si a × santé + b × étage / 10 + c ≥ 0.
  ...IDS_RENCONTRES.flatMap((id) => [
    { id: `r.${id}.sante`, min: -1, max: 1, nom: `${id} : poids de la santé` },
    { id: `r.${id}.etage`, min: -1, max: 1, nom: `${id} : poids de l'étage` },
    { id: `r.${id}`, min: -1, max: 1, nom: `${id} : biais` },
  ]),
];
export const IDX = Object.fromEntries(GENES.map((g, i) => [g.id, i]));
export const borner = (i, v) => Math.max(GENES[i].min, Math.min(GENES[i].max, v));

/**
 * Une tactique de départ proche de la stratégie Prudence du jeu : viser la
 * menace, soigner sous 60 %, provoquer sous 50 %, zone dès deux adversaires.
 * Elle sert à amorcer une partie de la population, pas à la contraindre.
 */
export function tactiquePrudence() {
  const g = GENES.map((x) => (x.min + x.max) / 2);
  const p = { "c.menace": 1, "t.soin": 0.6, "t.souffle": 0.4, "t.ravit": 0.15, "t.provoc": 0.5, "t.soutien": 0, "t.zone": 0.34, "t.frappe": 0,
    // Le chemin : le jeu le tire au hasard ; ici, un léger goût pour les trésors et le repos quand on saigne.
    "s.tresor": 0.3, "s.evenement": 0.1, "s.repos": 0.1, "s.repos.blesse": 0.8, "s.elite": -0.2, "s.elite.blesse": -0.6,
    // Les rencontres, comme la règle « malin » de moteur.mjs : prudence qui grandit avec l'étage.
    "r.mirko.sante": -1, "r.mirko": 0.7, "r.coffre.sante": 1, "r.coffre.etage": -1, "r.coffre": -0.2,
    "r.autel.sante": 1, "r.autel.etage": -0.2, "r.autel": -0.6, "r.blesse": 1,
    "r.source.sante": -1, "r.source": 0.9, "r.echo.sante": 1, "r.echo.etage": -1, "r.echo": -0.4 };
  for (const [k, v] of Object.entries(p)) if (k in IDX) g[IDX[k]] = v;
  return g;
}
export const tactiqueAleatoire = (r) => GENES.map((x) => x.min + r() * (x.max - x.min));

const frac = (u) => u.pv / u.pvMax;
const santeEquipe = (p) => { const v = R.vivants(p.equipe); return v.reduce((s, u) => s + frac(u), 0) / Math.max(1, v.length); };
const nAdv = (t) => 1 + Math.round(3 * t); // un seuil de 0 à 1 devient 1 à 4 adversaires

/** Le geste et la cible d'un compagnon, selon la tactique `g`. */
export function choixTactique(g, partie, C, u) {
  const G = (id) => g[IDX[id]];
  const ennemis = R.ciblesPossibles(partie, C, "a");
  const allies = R.vivants(partie.equipe);
  const atqU = R.atqDe(partie, u);
  const maxPv = Math.max(1, ...ennemis.map((e) => e.pv));
  const atqs = ennemis.map((e) => R.atqDe(partie, e));
  const maxAtq = Math.max(1, ...atqs);
  const menaces = ennemis.map((e, i) => atqs[i] / Math.max(1, e.pv));
  const maxMen = Math.max(1e-9, ...menaces);
  let cible = ennemis[0], best = -Infinity;
  ennemis.forEach((e, i) => {
    const s = G("c.pvFrac") * frac(e) + G("c.pv") * (e.pv / maxPv) + G("c.atq") * (atqs[i] / maxAtq) + G("c.menace") * (menaces[i] / maxMen)
      + G("c.boss") * (e.boss ? 1 : 0) + G("c.elite") * (e.elite ? 1 : 0) + G("c.achevable") * (e.pv <= atqU ? 1 : 0)
      + G("c.marque") * (e.marque > 0 ? 1 : 0) + G("c.soigneur") * (e.role === "soigneur" || e.role === "intendant" ? 1 : 0)
      + G("c.mage") * (e.role === "mage" ? 1 : 0) + G("c.saigne") * (e.saigne > 0 ? 1 : 0);
    if (s > best) { best = s; cible = e; }
  });
  const frappe = { geste: R.gesteDe(u), cible };
  const T = R.techDe(u);
  if (!T || u.cd > 0) return frappe;
  const blesse = [...allies].sort((a, b) => frac(a) - frac(b))[0];
  const autres = allies.filter((a) => a !== u);
  switch (T) {
    case "soin": return blesse && frac(blesse) < G("t.soin") ? { geste: T, cible: blesse } : frappe;
    case "voile": return blesse && frac(blesse) < G("t.soin") && !blesse.voile ? { geste: T, cible: blesse } : frappe;
    case "souffle": {
      const tombe = partie.equipe.some((a) => a.ko && !a.recrue);
      return tombe || (blesse && frac(blesse) < G("t.souffle")) ? { geste: T, cible: null } : frappe;
    }
    case "ravit": {
      const manque = allies.reduce((s, a) => s + (1 - frac(a)), 0) / Math.max(1, allies.length);
      return manque > G("t.ravit") ? { geste: T, cible: null } : frappe;
    }
    case "provoc": return G("t.provoc") >= 0.99 || autres.some((a) => frac(a) < G("t.provoc")) ? { geste: T, cible: null } : frappe;
    case "galva": case "ralliement": return ennemis.length >= nAdv(G("t.soutien")) ? { geste: T, cible: null } : frappe;
    case "rempart": return ennemis.length >= nAdv(G("t.soutien")) && allies.some((a) => !a.rempart) ? { geste: T, cible: null } : frappe;
    case "vague": case "tempete": return ennemis.length >= nAdv(G("t.zone")) ? { geste: T, cible: null } : frappe;
    case "execution": {
      const x = ennemis.filter((e) => frac(e) < 0.35).sort((a, b) => b.pv - a.pv)[0];
      return x ? { geste: T, cible: x } : frappe;
    }
    case "piege": {
      const x = !cible.boss && !cible.etourdi ? cible : ennemis.find((e) => !e.boss && !e.etourdi);
      return x && x.pv >= G("t.frappe") * 3 * atqU ? { geste: T, cible: x } : frappe;
    }
    case "marque": {
      const x = cible.marque ? ennemis.find((e) => !e.marque) : cible;
      return x && x.pv >= G("t.frappe") * 3 * atqU ? { geste: T, cible: x } : frappe;
    }
    default: // lourde, vise, coupbas, drain : on garde la grosse frappe pour une cible qui la vaut
      return cible.pv >= G("t.frappe") * 3 * atqU ? { geste: T, cible } : frappe;
  }
}

/** La salle suivante, parmi celles qui s'ouvrent. */
export function salleTactique(g, partie, ouverts) {
  if (ouverts.length === 1) return ouverts[0];
  const blessure = 1 - santeEquipe(partie);
  let id = ouverts[0], best = -Infinity;
  for (const o of ouverts) {
    const genre = partie.plan.noeuds[o].genre;
    if (!(`s.${genre}` in IDX)) continue;
    const s = g[IDX[`s.${genre}`]] + g[IDX[`s.${genre}.blesse`]] * blessure;
    if (s > best) { best = s; id = o; }
  }
  return id;
}

/** Le choix d'une rencontre : le premier si la règle linéaire le dit, sinon le second. */
const accepte = (g, id, sante, etage) => g[IDX[`r.${id}.sante`]] * sante + g[IDX[`r.${id}.etage`]] * (etage / 10) + g[IDX[`r.${id}`]] >= 0;
export function rencontreTactique(g, ev, choix, partie) {
  const premier = accepte(g, ev.id, santeEquipe(partie), partie.etage);
  const c = choix[premier ? 0 : 1];
  return c && c.ok !== false ? c : choix.find((x) => x.ok !== false);
}

/* ── La tactique en clair, pour le rapport ───────────────────────────── */

const pc = (v) => `${Math.round(v * 100)} %`;
export function decrire(g) {
  const G = (id) => g[IDX[id]];
  const L = [];
  const cibles = GENES.filter((x) => x.id.startsWith("c.")).map((x) => [x.nom, G(x.id)]).filter(([, v]) => Math.abs(v) >= 0.15)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  L.push(`- **Cible** : ${cibles.length ? cibles.map(([n, v]) => `${v > 0 ? "préfère" : "évite"} ${n} (${v > 0 ? "+" : ""}${v.toFixed(2).replace(".", ",")})`).join(" ; ") : "au hasard (aucun critère net)"}.`);
  L.push(`- **Soin et Voile** sous ${pc(G("t.soin"))} de PV ; **Second souffle** sous ${pc(G("t.souffle"))} ou s'il y a un tombé ; **Ravitaillement** quand il manque plus de ${pc(G("t.ravit"))} des PV de l'équipe.`);
  L.push(`- **Provocation** ${G("t.provoc") >= 0.99 ? "dès qu'elle est prête" : `quand un autre allié passe sous ${pc(G("t.provoc"))}`}.`);
  L.push(`- **Soutiens** (Galvaniser, Ralliement, Rempart) face à ${nAdv(G("t.soutien"))} adversaire(s) ou plus ; **zone** (Vague, Tempête) face à ${nAdv(G("t.zone"))} ou plus.`);
  L.push(`- **Grosses frappes** gardées pour une cible d'au moins ${(G("t.frappe") * 3).toFixed(1).replace(".", ",")} fois l'ATQ du frappeur${G("t.frappe") < 0.1 ? " (autant dire : dès qu'elles sont prêtes)" : ""}.`);
  const salles = GENRES.map((x) => [R.GENRES[x].nom, G(`s.${x}`), G(`s.${x}.blesse`)]).sort((a, b) => b[1] - a[1]);
  L.push(`- **Chemin**, équipe en forme : ${salles.map(([n]) => n).join(" > ")}. Blessée, elle se tourne vers : ${[...salles].sort((a, b) => (b[1] + b[2]) - (a[1] + a[2])).map(([n]) => n).join(" > ")}.`);
  // On la décrit par son comportement : à quels étages, et à quelle santé, elle accepte.
  const R0 = R.RENCONTRES.map((e) => {
    const zones = [1, 5, 10, 20].map((et) => {
      const oui = [0.25, 0.5, 0.75, 1].filter((sa) => accepte(g, e.id, sa, et));
      return oui.length === 4 ? `étage ${et} : toujours` : !oui.length ? `étage ${et} : jamais` : `étage ${et} : à ${oui.map((x) => pc(x)).join(", ")} de santé`;
    });
    return `  - ${e.titre} : ${zones.join(" ; ")}`;
  });
  L.push("- **Rencontres**, quand elle prend le premier choix (acheter, ouvrir, offrir son sang, emmener, boire, suivre la voix) :", ...R0);
  return L.join("\n");
}
