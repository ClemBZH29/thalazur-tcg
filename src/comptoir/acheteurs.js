/**
 * Les acheteurs du Comptoir.
 *
 * Les onze personnages, leurs portraits, leurs répliques et leurs coefficients
 * de marchandage viennent du module d'origine et sont conservés tels quels :
 * ce sont eux qui donnent au marché son visage. Ce qui change, c'est ce à quoi
 * ils s'intéressent. Le module travaillait sur un set inventé et des étiquettes
 * abstraites ; ici les affinités se lisent sur les vrais repères du roster —
 * archétype, race, faction, province, palier — donc Hector reconnaît un
 * sergent d'infanterie et Nassim un lieu de Thalazur.
 *
 * `mult`   multiplicateur appliqué au prix de rachat de l'échoppe
 * `chance` probabilité de réussite d'un marchandage
 * `up`     bonification en cas de réussite
 * `down`   pénalité en cas d'échec, réellement appliquée jusqu'au lendemain
 */

/** Un mot-clé de repère, sans accent ni ponctuation. */
export const norm = (s) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/* ── Familles lexicales ────────────────────────────────────────────────────
   Volontairement large : un roster de campagne n'a pas de vocabulaire imposé,
   et une famille qui ne reconnaît rien vaut un acheteur inutile. Les mots sont
   comparés au repère entier et à chacun de ses mots, ce qui rattrape
   « Sergente » comme « Camp de Thalazur ». */

const MARTIAL = ["soldat", "soldate", "sergent", "sergente", "caporal", "caporale",
  "veteran", "veterane", "lieutenant", "lieutenante", "officier", "officiere",
  "capitaine", "commandant", "commandante", "garde", "sentinelle", "milicien",
  "infanterie", "archer", "archers", "cavalerie", "eclaireur", "eclaireurs",
  "etat-major", "major", "arme", "armes", "lame", "epee", "bouclier", "arc",
  "dague", "hallebarde", "banniere", "rempart", "mercenaire", "chasseur"];

const ARCANE = ["mage", "magicien", "magicienne", "sorcier", "sorciere", "ensorceleur",
  "pretre", "pretresse", "clerc", "druide", "barde", "guerisseur", "guerisseuse",
  "infirmerie", "conseiller", "conseillere", "erudit", "erudite", "savant", "savante",
  "scribe", "arcane", "arcanique", "relique", "reliquaire", "sceau", "grimoire",
  "litanie", "prisme", "amulette", "talisman", "artefact", "baguette", "anneau"];

const LABEUR = ["cuisinier", "cuisiniere", "intendance", "intendant", "intendante",
  "genie", "batisseur", "batisseuse", "aide", "camp", "forge", "forgeron", "charpentier",
  "vivres", "grain", "quartier-maitre", "palefrenier", "messager", "porteur",
  "tavernier", "aubergiste", "marchand", "marchande", "artisan"];

const REGION = ["thalazur", "eleon", "nakova", "krapecaas", "odiana", "mugania",
  "region", "province", "camp", "batiment", "ville", "cite", "bourg", "port",
  "col", "vallee", "foret", "marais", "tour", "fort", "donjon", "route", "gue",
  "halte", "faubourg", "quai", "temple", "ruine", "ruines", "lieu"];

const SAUVAGE = ["bete", "fauve", "loup", "ours", "dragon", "dragonne", "gobelin",
  "kobold", "orc", "troll", "geant", "geante", "araignee", "meute", "croc", "couvee",
  "esprit", "spectre", "elementaire", "golem", "monstre", "creature", "familier"];

/** Toute race qui n'est pas humaine : ce qui fascine un enfant de la capitale. */
const estExotique = (t) => !!t.race && !norm(t.race).startsWith("humain");

/* ── Fabriques de prédicats ───────────────────────────────────────────────── */

const mot = (liste) => (t) => liste.some((m) => t.mots.has(m));
const palier = (...l) => (t) => l.includes(t.tier);
const genre = (...l) => (t) => l.includes(t.type);
const meta = (t) => t.meta;
const hausse = (t) => t.hausse;
const rainbow = (t) => t.rainbow;
const cite = (t) => t.citation;

/**
 * Affinité à deux étages.
 *
 * `entree` : au moins une doit passer, sinon l'acheteur ne regarde pas la
 *            carte. C'est là que se joue le caractère du personnage.
 * `primes` : chacune ajoute une prime, jamais l'entrée.
 *
 * La distinction est venue d'un essai raté. Avec une seule liste mise en OU,
 * un palier suffisait à ouvrir la porte : « rare ou légendaire » cumulé à
 * « désirable » faisait qu'Ysée s'intéressait à trois quarts du set et que
 * plus aucun acheteur n'avait de goût. Les paliers et la cote sont des
 * modulateurs, pas des portes d'entrée.
 */
export const ACHETEURS = [
  {
    id: "lise", portrait: "lise",
    nom: "Lise", sub: "Collectionneuse débutante",
    spec: "Cartes courantes de la Troupe",
    icon: "▤", quote: "« Je cherche surtout les cartes qui me manquent encore. »",
    entree: [palier("commun", "peucommun")],
    primes: [genre("pnj"), mot(LABEUR)],
    mult: 1.14, chance: 0.82, up: 0.13, down: 0.08,
  },
  {
    id: "hector", portrait: "hector",
    nom: "Hector", sub: "Vétéran de la garde",
    spec: "Gradés, troupe et pièces d'armement",
    icon: "⚔", quote: "« Une bonne carte doit être aussi fiable qu'une bonne lame. »",
    entree: [mot(MARTIAL)],
    primes: [genre("pnj"), palier("peucommun", "rare")],
    mult: 1.34, chance: 0.68, up: 0.23, down: 0.18,
  },
  {
    id: "oriane", portrait: "oriane",
    nom: "Maîtresse Oriane", sub: "Érudite de Soldestin",
    spec: "Magie, savoir et artéfacts",
    icon: "✦", quote: "« La rareté n'est rien sans l'intérêt de la pièce. »",
    entree: [mot(ARCANE), genre("artefact")],
    primes: [palier("rare", "legendaire"), rainbow],
    mult: 1.42, chance: 0.57, up: 0.31, down: 0.16,
  },
  {
    id: "sorelle", portrait: "sorelle",
    nom: "Dame Sorelle", sub: "Noble collectionneuse",
    spec: "Rares, légendaires et rainbow",
    icon: "◆", quote: "« L'exceptionnel m'intéresse toujours. »",
    entree: [palier("rare", "legendaire", "fullart", "pj"), rainbow],
    primes: [mot(ARCANE), genre("artefact")],
    mult: 1.55, chance: 0.49, up: 0.39, down: 0.27,
  },
  {
    id: "gaspard", portrait: "gaspard",
    nom: "Gaspard", sub: "Brocanteur du quai",
    spec: "Lots communs et gens de métier",
    icon: "▥", quote: "« Des cartes en trop ? J'en fais mon affaire ! »",
    entree: [palier("commun"), mot(LABEUR)],
    primes: [genre("pnj", "artefact")],
    mult: 1.18, chance: 0.77, up: 0.16, down: 0.12,
  },
  {
    id: "ysee", portrait: "ysee",
    nom: "Ysée", sub: "Joueuse compétitive",
    spec: "Cartes recherchées et pièces de tête",
    icon: "♜", quote: "« Je paie pour ce qui gagne, pas pour ce qui brille. »",
    entree: [meta],
    primes: [palier("rare", "legendaire"), mot(MARTIAL), hausse],
    mult: 1.48, chance: 0.61, up: 0.28, down: 0.22,
  },
  {
    id: "nassim", portrait: "nassim",
    nom: "Nassim", sub: "Marchand étranger",
    spec: "Lieux, provinces et pièces de région",
    icon: "◈", quote: "« Chaque province a ses trésors. Il suffit de savoir lesquels. »",
    entree: [genre("lieu"), mot(REGION)],
    primes: [palier("peucommun", "rare"), estExotique],
    mult: 1.37, chance: 0.64, up: 0.25, down: 0.19,
  },
  {
    id: "eloi", portrait: "eloi",
    nom: "Éloi", sub: "Enfant de bonne famille",
    spec: "Créatures, peuples et cartes qui racontent",
    icon: "♢", quote: "« J'aime surtout les cartes qui racontent une histoire ! »",
    entree: [mot(SAUVAGE), estExotique],
    primes: [palier("commun", "peucommun"), cite],
    mult: 1.30, chance: 0.85, up: 0.12, down: 0.07,
  },
  {
    id: "voren", portrait: "voren",
    nom: "Voren", sub: "Spéculateur",
    spec: "Cartes dont la cote monte",
    icon: "↗", quote: "« Je n'achète pas une carte. J'achète ce qu'elle vaudra demain. »",
    entree: [hausse, rainbow],
    primes: [meta, palier("rare", "legendaire")],
    mult: 1.68, chance: 0.41, up: 0.48, down: 0.36,
  },
];

/* Mirko a quitté ce tableau. Il tenait la onzième ligne des acheteurs, ce qui
   en faisait un habitué du Comptoir un jour sur trois — or c'est un colporteur.
   Il apparaît désormais au bilan d'une ouverture, rarement, avec ses propres
   affaires : voir src/config/colporteur.js. Le pas de 7 du trio du jour porte
   de nouveau sur dix acheteurs, comme son commentaire l'a toujours dit. */

/** Il ne passe qu'un jour sur dix, et il paie ce que personne ne paie. */
export const CONSERVATEUR = {
  id: "conservateur", portrait: "conservateur",
  nom: "Le Conservateur Royal", sub: "Conservateur des Archives royales",
  spec: "Pièces d'archive, rares et ensembles thématiques",
  icon: "♛",
  quote: "« Une collection n'a de valeur que lorsqu'elle raconte quelque chose de complet. »",
  entree: [palier("rare", "legendaire", "fullart", "pj"), genre("artefact", "lieu"), rainbow],
  primes: [mot(ARCANE), meta],
  mult: 1.92, chance: 0.43, up: 0.36, down: 0.30,
  exceptionnel: true,
};

export const ACHETEUR_PAR_ID = Object.fromEntries(
  [...ACHETEURS, CONSERVATEUR].map((b) => [b.id, b])
);

/**
 * Le trio du jour. Le pas de 7 sur dix acheteurs fait un cycle de dix jours
 * sans répétition immédiate, et les décalages de 3 et 5 évitent que deux
 * voisins du tableau se présentent toujours ensemble.
 */
export const trioDuJour = (jour) => {
  const n = ACHETEURS.length;
  const d = ((jour % n) + n) % n;
  const s = (d * 7) % n;
  return [s, (s + 3) % n, (s + 5) % n].map((i) => ACHETEURS[i]);
};

export const conservateurPresent = (jour) => (((jour * 29) % 100) + 100) % 100 < 10;

export const acheteursDuJour = (jour) =>
  conservateurPresent(jour) ? [...trioDuJour(jour), CONSERVATEUR] : trioDuJour(jour);

/** Celui de demain qui n'est pas déjà là : l'annonce n'a d'intérêt que neuve. */
export function acheteurDeDemain(jour) {
  const aujourdhui = trioDuJour(jour);
  const demain = trioDuJour(jour + 1);
  return demain.find((b) => !aujourdhui.some((a) => a.id === b.id)) || demain[0];
}

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
