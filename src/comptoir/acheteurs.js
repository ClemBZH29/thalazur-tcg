/**
 * Les acheteurs du Comptoir.
 *
 * Les dix personnages, leurs portraits, leurs répliques et leurs coefficients
 * de marchandage viennent du module d'origine. Ce sont des figures propres
 * au jeu, hors campagne : c'est un choix, pas un oubli.
 *
 * Ce qui a changé, c'est ce qui les intéresse. Le module d'origine les
 * faisait choisir par familles de mots (« soldat », « mage », « camp »…) :
 * le vocabulaire réel du roster passait au travers, Hector ne reconnaissait
 * que onze cartes et aucune faction n'intéressait personne. Chacun regarde
 * maintenant **un seul axe**, lisible sur la carte elle-même : la rareté, le
 * type, la faction, la version rainbow ou le Bestiaire. Voir
 * docs/audit-comptoir.md, § 7, pour les mesures qui ont fixé la répartition.
 *
 * `mult`   multiplicateur appliqué au prix de rachat de l'échoppe
 * `chance` probabilité de réussite d'un marchandage
 * `up`     bonification en cas de réussite
 * `down`   pénalité en cas d'échec, réellement appliquée jusqu'au lendemain
 */
import { roleCarte as roleDonjon } from "../donjon/regles.js";
import { VOIX } from "./voix.js";
import { conservateurPresent, JOUR_UN } from "./jour.js";

/** Un mot de repère, sans accent ni ponctuation. */
export const norm = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * La faction d'une carte. Un Lieu porte sa province en premier repère, un
 * PNJ ou un artéfact en troisième. La comparaison se fait sans accents, ce
 * qui réunit « Säab » (PNJ) et « Saäb » (artéfacts) du classeur.
 */
export const factionDe = (carte) => norm(carte.type === "lieu" ? carte.rep1 : carte.rep3);

/** Les rôles du Donjon qui se battent en première ligne ou à distance. */
const ROLES_COMBAT = new Set(["garde", "frappeur", "tireur", "mage"]);
export const roleCarte = (carte) => (carte.type === "pnj" ? roleDonjon(carte) : null);

/* ── Fabriques de prédicats ───────────────────────────────────────────────── */

const palier = (...l) => (t) => l.includes(t.tier);
const genre = (...l) => (t) => l.includes(t.type);
const faction = (...l) => (t) => l.includes(t.faction);
const normale = (f) => (t) => !t.rainbow && f(t);
const rainbow = (t) => t.rainbow;
const hausse = (t) => t.hausse;
const cite = (t) => t.citation;
const combattant = (t) => ROLES_COMBAT.has(t.role);
const bestiaire = (t) => t.faction === "bestiaire" || ["creature", "animal"].includes(t.archetype);
const exotique = (t) => !!t.race && !norm(t.race).startsWith("humain");

/**
 * Affinité à deux étages.
 *
 * `entree` : au moins une doit passer, sinon l'acheteur ne regarde pas la
 *            carte. C'est son axe, et il n'en a qu'un.
 * `primes` : chacune ajoute une prime, jamais l'entrée.
 *
 * Les paliers et la cote restent des modulateurs pour tous ceux dont
 * l'axe n'est pas la rareté : mis en OU avec l'axe, ils ouvraient la porte à
 * trois quarts du set et effaçaient le goût de chacun.
 */

/** Lise tient le comptoir tous les jours : voir `acheteursDuJour`. */
export const HABITUEE = {
  id: "lise", portrait: "lise",
  nom: "Lise", sub: "Collectionneuse débutante",
  spec: "Communes et peu communes",
  icon: "▤", quote: VOIX.lise.quote,
  entree: [normale(palier("commun", "peucommun"))],
  primes: [genre("pnj"), cite],
  mult: 1.14, chance: 0.82, up: 0.13, down: 0.08,
  // Exemplaires rachetés par jour. On vend à l'unité, et chacun a fini sa
  // journée une fois son quota atteint : c'est ce qui remplace les lots, que
  // personne ne lisait (« 147 autres cartes, comprises dans… »).
  quota: 20,
  habituee: true,
};

/**
 * Les provinces de Gaspard, une par passage, dans cet ordre. Les plus petites
 * sont regroupées pour qu'aucun passage ne tombe sous une quinzaine de cartes.
 */
export const PROVINCES = [
  { id: "nakova", nom: "Nakova", factions: ["nakova"] },
  { id: "pronolo", nom: "Pronolo", factions: ["pronolo"] },
  { id: "saab", nom: "Säab et la Caravane", factions: ["saab", "caravane"] },
  { id: "cornalie", nom: "Cornalie", factions: ["cornalie"] },
  { id: "odiana", nom: "Odiana, Éléon et Inarva", factions: ["odiana", "eleon", "inarva"] },
];

/** Les spécialistes : deux d'entre eux passent chaque jour. */
export const SPECIALISTES = [
  {
    id: "sorelle", portrait: "sorelle",
    nom: "Dame Sorelle", sub: "Noble collectionneuse",
    spec: "Rares, légendaires, full art et cartes PJ",
    icon: "◆", quote: VOIX.sorelle.quote,
    entree: [palier("rare", "legendaire", "fullart", "pj")],
    primes: [rainbow, genre("artefact")],
    mult: 1.55, chance: 0.49, up: 0.39, down: 0.27,
    quota: 10,
  },
  {
    id: "hector", portrait: "hector",
    nom: "Hector", sub: "Vétéran de la garde",
    spec: "La Troupe, la GRC et les aventuriers",
    icon: "⚔", quote: VOIX.hector.quote,
    entree: [faction("troupe", "grc", "aventurier")],
    primes: [combattant, palier("peucommun", "rare")],
    mult: 1.34, chance: 0.68, up: 0.23, down: 0.18,
    quota: 10,
  },
  {
    id: "oriane", portrait: "oriane",
    nom: "Maîtresse Oriane", sub: "Érudite de Soldestin",
    spec: "Artéfacts",
    icon: "✦", quote: VOIX.oriane.quote,
    entree: [genre("artefact")],
    primes: [palier("rare", "legendaire"), rainbow],
    mult: 1.42, chance: 0.57, up: 0.31, down: 0.16,
    quota: 10,
  },
  {
    id: "gaspard", portrait: "gaspard",
    nom: "Gaspard", sub: "Brocanteur du quai",
    // Spécialité, entrée et annonce sont posées par `gaspardDuJour`.
    spec: "Une province à chaque passage",
    icon: "▥", quote: VOIX.gaspard.quote,
    entree: [],
    primes: [genre("pnj"), palier("commun")],
    mult: 1.18, chance: 0.77, up: 0.16, down: 0.12,
    quota: 10,
  },
  {
    id: "ysee", portrait: "ysee",
    nom: "Ysée", sub: "Joueuse compétitive",
    spec: "PNJ combattants du Donjon",
    icon: "♜", quote: VOIX.ysee.quote,
    entree: [(t) => t.type === "pnj" && combattant(t)],
    primes: [palier("rare", "legendaire"), hausse],
    mult: 1.48, chance: 0.61, up: 0.28, down: 0.22,
    quota: 10,
  },
  {
    id: "nassim", portrait: "nassim",
    nom: "Nassim", sub: "Marchand étranger",
    spec: "Lieux de toutes les provinces",
    icon: "◈", quote: VOIX.nassim.quote,
    entree: [genre("lieu")],
    primes: [palier("peucommun", "rare"), faction("saab", "caravane")],
    mult: 1.37, chance: 0.64, up: 0.25, down: 0.19,
    quota: 10,
  },
  {
    id: "eloi", portrait: "eloi",
    nom: "Éloi", sub: "Enfant de bonne famille",
    spec: "Le Bestiaire, créatures et animaux",
    icon: "♢", quote: VOIX.eloi.quote,
    entree: [bestiaire],
    primes: [exotique, cite],
    mult: 1.30, chance: 0.85, up: 0.12, down: 0.07,
    quota: 10,
  },
  {
    id: "voren", portrait: "voren",
    nom: "Voren", sub: "Spéculateur",
    spec: "Toutes les rainbow",
    icon: "↗", quote: VOIX.voren.quote,
    entree: [rainbow],
    primes: [palier("rare", "legendaire"), hausse],
    mult: 1.68, chance: 0.41, up: 0.48, down: 0.36,
    quota: 10,
  },
];

/* Mirko a quitté ce tableau : c'est un colporteur, il apparaît au bilan d'une
   ouverture avec ses propres affaires. Voir src/config/colporteur.js. */

/** Il ne passe qu'un jour sur dix, et il paie ce que personne ne paie. */
export const CONSERVATEUR = {
  id: "conservateur", portrait: "conservateur",
  nom: "Le Conservateur Royal", sub: "Conservateur des Archives royales",
  spec: "Pièces d'archive, rares et au-delà",
  icon: "♛",
  quote: VOIX.conservateur.quote,
  entree: [palier("rare", "legendaire", "fullart", "pj"), genre("artefact", "lieu"), rainbow],
  primes: [palier("legendaire", "fullart", "pj")],
  // ×1,92 tant qu'un plafond commun rabotait tout le monde ; avec un plafond
  // par acheteur, ce multiple faisait passer le pire jour au-dessus de 100 %
  // (scripts/audit-marche.mjs). Il reste celui qui paie le mieux.
  mult: 1.80, chance: 0.43, up: 0.36, down: 0.30,
  quota: 3,
  exceptionnel: true,
};

/** Tous les personnages, pour le calibrage : Gaspard y figure avec sa première province. */
export const TOUS_ACHETEURS = () => [HABITUEE, ...SPECIALISTES.map((b) => (b.id === "gaspard" ? gaspardEn(0) : b)), CONSERVATEUR];

/* ── Le calendrier ────────────────────────────────────────────────────────── */

/**
 * Les paires de spécialistes, toutes, dans un ordre fixe. Huit spécialistes
 * font vingt-huit paires : un cycle de vingt-huit jours où chaque paire passe
 * une fois et chacun revient tous les quatre jours en moyenne. L'ordre est
 * tiré une fois, sans hasard : à chaque jour, la paire disponible dont les
 * deux membres sont absents depuis le plus longtemps, jamais un acheteur deux
 * jours de suite. L'ancien trio, un pas de 7 sur dix, ne garantissait pas la
 * présence de qui achète les communes, soit 91 % des doublons.
 */
export const CYCLE = (() => {
  const n = SPECIALISTES.length;
  const restantes = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) restantes.push([i, j]);
  const vu = Array(n).fill(-99);
  const cycle = [];
  let veille = [];
  for (let jour = 0; restantes.length; jour++) {
    let meilleure = -1;
    let score = -Infinity;
    restantes.forEach(([i, j], k) => {
      if (veille.includes(i) || veille.includes(j)) return;
      const s = Math.min(jour - vu[i], jour - vu[j]) * 100 + (jour - vu[i]) + (jour - vu[j]);
      if (s > score) { score = s; meilleure = k; }
    });
    // Les dernières paires peuvent toutes croiser la veille : on prend la plus ancienne.
    if (meilleure < 0) meilleure = 0;
    const [i, j] = restantes.splice(meilleure, 1)[0];
    vu[i] = vu[j] = jour;
    veille = [i, j];
    cycle.push([i, j]);
  }
  return cycle;
})();

const indice = (jour) => {
  const L = CYCLE.length;
  return (((jour - JOUR_UN) % L) + L) % L;
};
const paireDuJour = (jour) => CYCLE[indice(jour)];

const ID_GASPARD = SPECIALISTES.findIndex((b) => b.id === "gaspard");

/**
 * Le rang du passage de Gaspard ce jour-là, compté depuis le jour un. Le même
 * pour tous les joueurs, et rien ne le relance : sa province suit le
 * calendrier, comme le reste du Comptoir.
 */
export function passageDeGaspard(jour) {
  const L = CYCLE.length;
  const parCycle = CYCLE.filter((p) => p.includes(ID_GASPARD)).length;
  const d = jour - JOUR_UN;
  const tours = Math.floor(d / L);
  const reste = indice(jour);
  let n = tours * parCycle;
  for (let k = 0; k < reste; k++) if (CYCLE[k].includes(ID_GASPARD)) n++;
  return n;
}

/** Gaspard et le chargement de son passage n° `rang`. */
export function gaspardEn(rang) {
  const base = SPECIALISTES[ID_GASPARD];
  const P = PROVINCES.length;
  const province = PROVINCES[((rang % P) + P) % P];
  return {
    ...base,
    province,
    spec: `Chargement de ${province.nom}`,
    quote: base.quote.replace("{province}", province.nom),
    entree: [faction(...province.factions)],
  };
}

const specialiste = (i, jour) => (i === ID_GASPARD ? gaspardEn(passageDeGaspard(jour)) : SPECIALISTES[i]);

export const specialistesDuJour = (jour) => paireDuJour(jour).map((i) => specialiste(i, jour));

export { conservateurPresent };

/** Lise, deux spécialistes, et le Conservateur un jour sur dix. */
export const acheteursDuJour = (jour) => {
  const l = [HABITUEE, ...specialistesDuJour(jour)];
  return conservateurPresent(jour) ? [...l, CONSERVATEUR] : l;
};

/** Celui de demain qui n'est pas déjà là : l'annonce n'a d'intérêt que neuve. */
export function acheteurDeDemain(jour) {
  const ici = specialistesDuJour(jour).map((b) => b.id);
  const demain = specialistesDuJour(jour + 1);
  return demain.find((b) => !ici.includes(b.id)) || demain[0];
}

/** La phrase de l'annonce : Gaspard dit ce qu'il apporte. */
export const annonceDe = (b) =>
  b.province ? `Gaspard revient, avec un chargement de ${b.province.nom}.` : `${b.nom}, ${b.sub.toLowerCase()}.`;

/**
 * Affinité : 0 quand l'acheteur ne regarde pas la carte, puis une prime
 * modeste par famille supplémentaire. La courbe est celle du module d'origine.
 */
export function affinite(traits, acheteur) {
  if (!acheteur.entree.some((f) => f(traits))) return 0;
  let n = 0;
  for (const f of acheteur.primes) if (f(traits)) n++;
  return n === 0 ? 1 : n === 1 ? 1.08 : 1.15;
}
