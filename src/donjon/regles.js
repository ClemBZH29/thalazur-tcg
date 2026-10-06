/**
 * Le Donjon : les règles du donjon, sans React ni navigateur.
 *
 * Tout ce qui décide — la carte d'un étage, les unités, l'ordre
 * d'initiative, les dégâts, l'intelligence des adversaires, les stratégies
 * du combat automatique, les rencontres et le butin — vit ici, en fonctions
 * qu'on appelle avec un tirage (`rng`) en paramètre. L'interface
 * (`Donjon.jsx`) ne fait qu'afficher et animer ; les tests rejouent des
 * descentes entières sans navigateur.
 *
 * La partie est un objet simple, sérialisable tel quel : elle part dans la
 * sauvegarde du jeu entre deux salles, pour qu'un onglet fermé ne coûte pas
 * la tentative du jour. Le combat, lui, n'est pas sauvé en cours de route :
 * rechargé au milieu, il reprend à son premier tour, équipe comprise.
 */
import { construirePool, deduireGrades } from "../lib/roster.js";
import { bonusNiveau } from "./experience.js";
import { cumuler, effetsArtefact, effetsSource } from "./pouvoirs.js";
import ROLES_CARTES from "./roles-cartes.json" with { type: "json" };

/* ── Tirage reproductible ────────────────────────────────────────────── */

export function tirage(graine) {
  let a = graine >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return r;
}
export const hacher = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
/** Le donjon du jour : même carte pour tous les joueurs, tirée de la date locale. */
// Le préfixe garde l'ancien nom du module : le changer changerait le donjon
// de tous les joueurs au milieu de la journée. Il n'apparaît nulle part.
export const graineDuJour = (jour) => hacher(`profondeurs-${jour}`);

/**
 * Deux donjons :
 *
 * - **le donjon du jour** : trois étages, la même carte pour tous, une
 *   descente par jour. C'est lui qui paie le mieux ;
 * - **le donjon infini** : une graine neuve à chaque descente, des étages sans
 *   fin, de plus en plus durs (les adversaires montent avec l'étage, sans
 *   plafond). On y revient autant qu'on veut, mais il paie moins, en butin
 *   comme en expérience. Le plus profond étage nettoyé fait le record.
 */
export const MODES = {
  jour: { nom: "Donjon du jour", etages: 3 },
  infini: { nom: "Donjon infini", etages: Infinity },
};
export const etagesDe = (partie) => (MODES[partie.mode] || MODES.jour).etages;
/** Une graine pour une descente infinie : jamais deux fois la même. */
export const graineInfinie = (t = Date.now(), r = Math.random) => hacher(`infini-${t}-${Math.floor(r() * 1e9)}`);

const choisir = (r, l) => l[Math.floor(r() * l.length)];
const entre = (r, a, b) => a + Math.floor(r() * (b - a + 1));
function tirer(r, poids) {
  const e = Object.entries(poids).filter(([, v]) => v > 0);
  let x = r() * e.reduce((s, [, v]) => s + v, 0);
  for (const [k, v] of e) { x -= v; if (x <= 0) return k; }
  return e[e.length - 1][0];
}
const parmiPalier = (r, l, tier) => { const f = l.filter((c) => c.tier === tier); return choisir(r, f.length ? f : l); };

/* ── Les cartes ─────────────────────────────────────────────────────── */

/** Repères qui font d'un PNJ un adversaire : le bestiaire et la pègre. */
export const HOSTILES = new Set(["Créature", "Animal", "Criminel"]);

/**
 * Factions qui ne se battent jamais contre l'équipe : celles de la
 * campagne, du côté des joueurs. Les PNJ des autres factions peuvent se
 * dresser en travers du chemin, avec le rôle et la capacité de leur
 * archétype — un médecin ennemi soigne les siens, un sorcier balaie
 * l'équipe. À ajuster ici si une faction change de camp.
 */
export const FACTIONS_AMIES = new Set(["Troupe", "Caravane", "Aventurier"]);

/**
 * Les cartes des extensions ouvertes, rangées pour le donjon : les alliés
 * possibles, les adversaires, les lieux (les salles) et les artéfacts
 * (les reliques). Chaque carte garde son extension : c'est elle qui dit où
 * chercher le portrait.
 */
export function cartesDonjon(extensions) {
  const toutes = [];
  for (const ext of extensions) {
    if (ext.statut !== "ouvert" || !ext.roster) continue;
    const pool = construirePool(ext.roster.lignes, deduireGrades(ext.roster.lignes));
    for (const t of ["commun", "peucommun", "rare", "legendaire"]) {
      for (const c of pool[t] || []) toutes.push({ ...c, ext: ext.id });
    }
  }
  return {
    toutes,
    allies: toutes.filter((c) => c.type === "pnj" && !HOSTILES.has(c.rep1)),
    monstres: toutes.filter((c) => c.type === "pnj" && HOSTILES.has(c.rep1)),
    rivaux: toutes.filter((c) => c.type === "pnj" && !HOSTILES.has(c.rep1) && !FACTIONS_AMIES.has(c.rep3)),
    lieux: toutes.filter((c) => c.type === "lieu"),
    artefacts: toutes.filter((c) => c.type === "artefact"),
  };
}

/* ── Rôles et unités ─────────────────────────────────────────────────── */

const BASE = { commun: { pv: 10, atq: 3 }, peucommun: { pv: 13, atq: 4 }, rare: { pv: 17, atq: 5 }, legendaire: { pv: 23, atq: 7 } };
const INI_PALIER = { commun: 0, peucommun: 1, rare: 2, legendaire: 3 };

/**
 * Les rôles. Chacun donne un passif, une initiative de base et sa technique
 * d'origine (`tech`, une clé de COMPETENCES). Le geste d'origine est
 * l'attaque, pour tous.
 */
export const ROLES = {
  garde: { nom: "Garde", ini: 2, passif: "Armure 1", tech: "provoc" },
  frappeur: { nom: "Frappeur", ini: 5, passif: "+1 ATQ", tech: "lourde" },
  tireur: { nom: "Tireur", ini: 7, passif: "Agit tôt", tech: "vise" },
  soigneur: { nom: "Soigneur", ini: 3, passif: "", tech: "soin" },
  mage: { nom: "Mage", ini: 4, passif: "", tech: "vague" },
  meneur: { nom: "Meneur", ini: 4, passif: "", tech: "galva" },
  debrouillard: { nom: "Débrouillard", ini: 5, passif: "+10 % de butin", tech: "coupbas" },
  artificier: { nom: "Artificier", ini: 3, passif: "", tech: "rempart" },
  intendant: { nom: "Intendant", ini: 3, passif: "Repos +25 %", tech: "ravit" },
};

/**
 * Les compétences. Une carte en porte deux : un **geste** (compétence 1, sans
 * recharge, ce qu'elle fait quand elle ne fait rien d'autre) et une
 * **technique** (compétence 2, avec sa recharge). Les deux se changent contre
 * des vestiges depuis la bibliothèque (voir fiches.js).
 *
 * - `cd` : tours de l'unité à attendre avant de la rejouer ;
 * - `cible` : "e" un adversaire, "a" un allié, null personne à désigner ;
 * - `roles` : ceux pour qui elle est naturelle, à moitié prix ;
 * - `reservee` : elle n'est ouverte qu'à ces rôles-là. Ce sont les soins :
 *   ouverts à tous, chaque équipe prenait trois soigneurs, et un soin donné
 *   à la meilleure carte faisait passer les trois gardiens de 29 % à 56 %
 *   (scripts/audit-donjon.mjs) ;
 * - `etoile` : ce qu'elle devient une fois étoilée (voir ETOILE).
 *
 * Les neuf techniques d'origine gardent leurs chiffres d'avant : une carte
 * qu'on ne touche pas se bat exactement comme avant.
 */
export const COMPETENCES = {
  /* Gestes */
  attaque: { place: "geste", nom: "Attaquer", cd: 0, cible: "e", roles: [],
    aide: "Dégâts ×1 sur une cible", etoile: "Dégâts ×1,45" },
  estoc: { place: "geste", nom: "Estoc", cd: 0, cible: "e", roles: ["tireur", "debrouillard", "frappeur"],
    aide: "Dégâts ×0,85 qui ignorent l'armure", etoile: "Dégâts ×1,25 qui ignorent l'armure" },
  entaille: { place: "geste", nom: "Entaille", cd: 0, cible: "e", roles: ["debrouillard", "frappeur"],
    aide: "Dégâts ×0,6, et la cible saigne deux tours (40 % de l'ATQ à chacun de ses tours)", etoile: "Dégâts ×0,85, saignement de trois tours à 65 %" },
  bouclier: { place: "geste", nom: "Coup de bouclier", cd: 0, cible: "e", roles: ["garde", "artificier"],
    aide: "Dégâts ×0,7, et armure +2 jusqu'à son prochain tour", etoile: "Dégâts ×1, et armure +4" },
  double: { place: "geste", nom: "Double frappe", cd: 0, cible: "e", roles: ["frappeur", "tireur"],
    aide: "Deux coups ×0,55 sur la même cible", etoile: "Deux coups ×0,8" },
  secours: { place: "geste", nom: "Main secourable", cd: 0, cible: "e", roles: ["soigneur", "intendant", "meneur"], reservee: true,
    aide: "Dégâts ×0,5, et l'allié le plus blessé reprend le tiers de l'ATQ en PV", etoile: "Dégâts ×0,7, et soin de la moitié de l'ATQ" },
  ripostee: { place: "geste", nom: "Garde haute", cd: 0, cible: "e", roles: ["garde", "frappeur"],
    aide: "Dégâts ×0,8 ; jusqu'à son prochain tour, rend son ATQ à qui le frappe", etoile: "Dégâts ×1,15, et rend 1,5 fois son ATQ" },
  trait: { place: "geste", nom: "Trait de brume", cd: 0, cible: "e", roles: ["mage", "tireur"],
    aide: "Dégâts ×0,7 sur la cible et sur un autre adversaire", etoile: "Dégâts ×1 sur les deux" },

  /* Techniques d'origine */
  provoc: { place: "tech", nom: "Provocation", cd: 3, cible: null, roles: ["garde"],
    aide: "Attire tous les coups jusqu'à son prochain tour, armure +2", etoile: "Armure +5, recharge 2" },
  lourde: { place: "tech", nom: "Frappe lourde", cd: 2, cible: "e", roles: ["frappeur"],
    aide: "Dégâts ×1,9 sur une cible", etoile: "Dégâts ×2,75, recharge 1" },
  vise: { place: "tech", nom: "Tir visé", cd: 2, cible: "e", roles: ["tireur"],
    aide: "Dégâts ×1,6, ignore l'armure", etoile: "Dégâts ×2,3, ignore l'armure, recharge 1" },
  soin: { place: "tech", nom: "Soin", cd: 0, cible: "a", roles: ["soigneur"], reservee: true,
    aide: "Rend ATQ + 2 PV à un allié", etoile: "Rend 1,45 × (ATQ + 2) PV" },
  vague: { place: "tech", nom: "Vague de brume", cd: 1, cible: null, roles: ["mage"],
    aide: "Frappe tous les adversaires", etoile: "Dégâts ×1,45 sur tous, sans recharge" },
  galva: { place: "tech", nom: "Galvaniser", cd: 2, cible: null, roles: ["meneur"],
    aide: "+3 ATQ à toute l'équipe pendant trois tours", etoile: "+5 ATQ, recharge 1" },
  coupbas: { place: "tech", nom: "Coup bas", cd: 2, cible: "e", roles: ["debrouillard"],
    aide: "Dégâts ×1,4, et chaparde quelques PO", etoile: "Dégâts ×2, butin doublé, recharge 1" },
  rempart: { place: "tech", nom: "Rempart", cd: 2, cible: null, roles: ["artificier"],
    aide: "Armure +3 à toute l'équipe pendant deux tours", etoile: "Armure +5, recharge 1" },
  ravit: { place: "tech", nom: "Ravitaillement", cd: 2, cible: null, roles: ["intendant"], reservee: true,
    aide: "Rend ATQ PV à toute l'équipe", etoile: "Rend 1,45 × ATQ PV, recharge 1" },

  /* Techniques nouvelles */
  execution: { place: "tech", nom: "Exécution", cd: 3, cible: "e", roles: ["frappeur", "debrouillard"],
    aide: "Dégâts ×1,4, triplés si la cible a moins de 35 % de ses PV", etoile: "Dégâts ×2 (×6 sous 35 %), recharge 2" },
  marque: { place: "tech", nom: "Marque du chasseur", cd: 3, cible: "e", roles: ["tireur", "meneur"],
    aide: "Dégâts ×1 ; la cible prend +60 % de dégâts pendant deux tours", etoile: "Dégâts ×1,45, +90 % de dégâts subis, recharge 2" },
  souffle: { place: "tech", nom: "Second souffle", cd: 4, cible: null, roles: ["soigneur", "intendant"], reservee: true,
    aide: "Relève le compagnon à terre le plus solide à 40 % de ses PV ; sinon, soigne le plus blessé de 40 %", etoile: "65 % au lieu de 40 %, recharge 3" },
  tempete: { place: "tech", nom: "Tempête", cd: 4, cible: null, roles: ["mage"],
    aide: "Dégâts ×1,25 sur tous les adversaires", etoile: "Dégâts ×1,8 sur tous, recharge 3" },
  ralliement: { place: "tech", nom: "Cri de ralliement", cd: 3, cible: null, roles: ["meneur"],
    aide: "+2 ATQ à toute l'équipe pendant deux tours, et les recharges des autres baissent de deux tours", etoile: "+3 ATQ, et toutes les recharges remises à zéro, recharge 2" },
  piege: { place: "tech", nom: "Piège à mâchoires", cd: 3, cible: "e", roles: ["artificier", "debrouillard"],
    aide: "Dégâts ×0,8 ; la cible perd son prochain tour (un gardien y résiste)", etoile: "Dégâts ×1,15, recharge 2" },
  voile: { place: "tech", nom: "Voile de brume", cd: 3, cible: "a", roles: ["mage", "garde"],
    aide: "Un allié ne peut plus être touché jusqu'à son prochain tour", etoile: "Le voile soigne aussi 30 % des PV, recharge 2" },
  drain: { place: "tech", nom: "Lame vampire", cd: 2, cible: "e", roles: ["frappeur", "mage"],
    aide: "Dégâts ×1,3, et rend la moitié des dégâts en PV", etoile: "Dégâts ×1,9, recharge 1" },
};
for (const [id, k] of Object.entries(COMPETENCES)) k.id = id;
// `cap` : la technique d'origine, telle que l'appelaient les versions d'avant.
for (const R of Object.values(ROLES)) R.cap = COMPETENCES[R.tech];

/**
 * L'étoile. Une ligne étoilée est figée — on ne la modifie plus — et gagne :
 * ATQ ×1,35 ; INI +3 et un tour de plus au premier tour de chaque combat ;
 * une compétence ×1,45 en puissance (dégâts, soins) et un tour de recharge en
 * moins. Mesuré (audit du Donjon) : une étoile seule porte les trois gardiens
 * de 29 % à 35-40 % ; quatre sur la même carte, autour de 60 %. Elle coûte un exemplaire rainbow en trop de la carte (voir fiches.js).
 */
export const ETOILE = { puissance: 1.45, atq: 1.35, ini: 3 };

/** Le geste et la technique d'une unité ; les parties d'avant n'en portaient pas. */
export const gesteDe = (u) => (COMPETENCES[u.geste]?.place === "geste" ? u.geste : "attaque");
export const techDe = (u) => (COMPETENCES[u.tech]?.place === "tech" ? u.tech : ROLES[u.role]?.tech || null);
const etoileSur = (u, id) => (id === gesteDe(u) && !!u.etoiles?.geste) || (id === techDe(u) && !!u.etoiles?.tech);
/** La recharge réelle d'une technique pour cette unité, étoile comprise. */
export const rechargeDe = (u, id) => Math.max(0, (COMPETENCES[id]?.cd || 0) - (etoileSur(u, id) ? 1 : 0));

export const TRAITS = {
  rapide: { nom: "Rapide", aide: "Agit tôt dans le tour" },
  fourbe: { nom: "Fourbe", aide: "25 % de coup critique, achève le plus faible" },
  brute: { nom: "Coriace", aide: "PV augmentés de 20 %" },
};

/**
 * Le rôle d'un allié vient de son premier repère (l'archétype du roster).
 * Les classes de D&D gardent leur emploi : le moine se bat à mains nues, il
 * frappe ; il ne soigne pas.
 */
export function roleDe(rep1) {
  const s = String(rep1 || "").toLowerCase();
  if (/infantrie|infanterie|paladin|lancier|chef de clan/.test(s)) return "garde";
  if (/guerrier|combattant|barbare|champion|cavalerie|assassin|roublard|sportif|mineur|moine/.test(s)) return "frappeur";
  if (/archer|archère|éclaireur|rodeur|rôdeur|explorateur|coursi/.test(s)) return "tireur";
  if (/médecin|clerc|infirm|herbor|shaman|chaman|druide/.test(s)) return "soigneur";
  if (/sorcier|magicien|scorceleur|enchanteresse/.test(s)) return "mage";
  if (/souverain|prince|noble|conseiller|ambassadeur|barde/.test(s)) return "meneur";
  // Ceux qui bâtissent protègent ; ceux qui nourrissent requinquent.
  if (/forgeron|ingénieur|ingenieur|bricol|charpentier|architecte|artisan|géologue|geologue/.test(s)) return "artificier";
  if (/cuisini|aubergiste|intendant|brasseu|porteu/.test(s)) return "intendant";
  return "debrouillard";
}

/**
 * Le rôle d'une carte : celui que `roles-cartes.json` lui impose, sinon celui
 * de son archétype. Le fichier se modifie à la main ; le roster, lui, est
 * produit par `npm run roster` et serait écrasé.
 */
export const IMPOSES = ROLES_CARTES.roles || {};
export const roleCarte = (c) => {
  const r = c && IMPOSES[`${c.ext}:${c.id}`];
  return r && ROLES[r] ? r : roleDe(c?.rep1);
};

/** Une carte, sans ce dont le donjon n'a pas besoin : c'est ce qui part dans la sauvegarde. */
const legere = (c) => ({ id: c.id, num: c.num, nom: c.nom, type: c.type, tier: c.tier, rep1: c.rep1, race: c.race, rep3: c.rep3, citation: c.citation, ext: c.ext });

/** Les états qu'un combat pose sur une unité, remis à zéro au suivant. */
const ETATS = { provoque: 0, galva: 0, galvaVal: 0, rempart: 0, rempartVal: 0, armureProvoc: 0, parade: 0, riposte: 0,
  voile: 0, marque: 0, marqueVal: 0, saigne: 0, saigneD: 0, etourdi: 0, vengeance: 0, elan: 0 };

/**
 * Un compagnon. `niveau` vient de son expérience (voir experience.js) ;
 * `fiche`, de ce que le joueur a acheté pour la carte (voir fiches.js) :
 * rangs d'ATQ et d'INI, geste et technique choisis, lignes étoilées.
 */
export function allie(partie, c, niveau = 1, fiche = null) {
  const b = BASE[c.tier] || BASE.commun, role = roleCarte(c);
  const bn = bonusNiveau(niveau);
  const f = fiche || {}, et = f.etoiles || {};
  let pv = b.pv + bn.pv, atq = b.atq + bn.atq;
  if (role === "garde") pv = Math.round(pv * 1.3);
  if (role === "frappeur") atq += 1;
  if (["soigneur", "debrouillard", "mage", "intendant"].includes(role)) pv = Math.round(pv * 0.9);
  atq += f.atq || 0;
  if (et.atq) atq = Math.round(atq * ETOILE.atq);
  let ini = ROLES[role].ini + (INI_PALIER[c.tier] || 0) + (f.ini || 0);
  if (et.ini) ini += ETOILE.ini;
  const u = { uid: partie.uid++, c: legere(c), camp: "a", role, pvMax: pv, pv, atq, niveau, xp: 0,
    ini, ko: false, cd: 0, ...ETATS };
  if (COMPETENCES[f.geste]?.place === "geste" && f.geste !== "attaque") u.geste = f.geste;
  if (COMPETENCES[f.tech]?.place === "tech" && f.tech !== ROLES[role].tech) u.tech = f.tech;
  const etoiles = Object.fromEntries(Object.entries(et).filter(([, v]) => v));
  if (Object.keys(etoiles).length) u.etoiles = etoiles;
  return u;
}
/**
 * Un adversaire. Le bestiaire et la pègre portent un trait (rapide, fourbe,
 * coriace) ; un PNJ d'une faction rivale porte le rôle de son archétype, et
 * sa capacité, comme un compagnon.
 */
export function monstre(partie, c, etage, mult = 1) {
  const dif = partie.difficulte ?? 1;
  const b = BASE[c.tier] || BASE.commun;
  const hostile = HOSTILES.has(c.rep1);
  const role = hostile ? (c.rep1 === "Animal" ? "rapide" : c.rep1 === "Criminel" ? "fourbe" : "brute") : roleCarte(c);
  let pvMax = Math.round(b.pv * (0.9 + 0.4 * etage) * (role === "brute" || role === "garde" ? 1.2 : 1) * mult * dif);
  if (!hostile && ["soigneur", "mage", "debrouillard", "intendant"].includes(role)) pvMax = Math.round(pvMax * 0.9);
  const atq = Math.max(1, Math.round((Math.round(b.atq * 0.85) + Math.round((etage - 1) * 1.4) + (mult > 1.5 ? 2 : mult > 1 ? 1 : 0) + (role === "frappeur" ? 1 : 0)) * dif));
  const ini = (hostile ? { rapide: 7, fourbe: 5, brute: 3 }[role] : ROLES[role].ini) + (INI_PALIER[c.tier] || 0);
  return { uid: partie.uid++, c: legere(c), camp: "e", role, pvMax, pv: pvMax, atq, ini, ko: false, cd: 0, ...ETATS };
}

export const vivants = (l) => l.filter((u) => !u.ko);

/** Ce que les artéfacts, les reliques et l'autel donnent à toute l'équipe. */
export const BONUS_ARTEFACT = { commun: { pv: 2, atq: 0 }, peucommun: { pv: 0, atq: 1 }, rare: { pv: 3, atq: 1 }, legendaire: { pv: 5, atq: 2 } };
export function bonusEquipe(partie) {
  let atq = partie.benediction || 0, pv = 0;
  for (const a of [partie.artefact, ...partie.reliques].filter(Boolean)) {
    const b = BONUS_ARTEFACT[a.tier] || BONUS_ARTEFACT.commun;
    atq += b.atq; pv += b.pv;
  }
  return { atq, pv };
}
/* ── Pouvoirs : source de pouvoir et artéfacts (voir pouvoirs.js) ─────── */

/** Les effets d'un camp : l'équipe a sa source et ses reliques ; l'adversaire, la relique qu'il porte. */
export function effetsCamp(partie, C, camp) {
  if (camp === "a") return [...(partie.source?.effets || []), ...meilleursEffets([partie.artefact, ...partie.reliques].filter(Boolean).flatMap(effetsArtefact))];
  return C?.relique ? effetsArtefact(C.relique) : [];
}
/**
 * Les reliques ne s'additionnent pas entre elles sur une même mécanique :
 * seule la plus forte compte (leurs PV et leur ATQ, eux, s'additionnent comme
 * avant). Additionnées, deux douzaines de reliques au donjon infini mettaient
 * tous les effets au plafond vers l'étage 20, et l'équipe ne tombait plus.
 */
function meilleursEffets(effets) {
  const m = {};
  for (const e of effets) if (!m[e.mec] || e.val > m[e.mec].val) m[e.mec] = e;
  return Object.values(m);
}
// L'équipe change de pouvoirs quand elle trouve une relique, pas plus souvent :
// on garde la somme tant que la liste des reliques n'a pas bougé.
const memoEquipe = new WeakMap();
export function modsEquipe(partie) {
  const cle = `${partie.reliques.length}|${partie.artefact?.id || ""}|${partie.source?.c?.id || ""}`;
  const m = memoEquipe.get(partie);
  if (m && m.cle === cle) return m.val;
  const val = cumuler(effetsCamp(partie, null, "a"), "a");
  memoEquipe.set(partie, { cle, val });
  return val;
}
/**
 * Les pouvoirs qui jouent, pour l'interface (animations) : chacun est un
 * événement { mec, camp, origine, uid, cible?, valeur? }. `origine` dit d'où
 * vient le pouvoir : « source » (le lieu de l'équipe) ou « relique ». Ils
 * s'accumulent dans `C.pouvoirs` pendant un geste, et `resoudre` les rend.
 */
export function origineDe(partie, camp, mec) {
  return camp === "a" && (partie.source?.effets || []).some((e) => e.mec === mec) ? "source" : "relique";
}
function signaler(partie, C, camp, mec, e) {
  if (C) (C.pouvoirs ||= []).push({ mec, camp, origine: origineDe(partie, camp, mec), ...e });
}

/** Les pouvoirs d'un camp en combat ; hors combat, ceux de l'équipe. */
export const mods = (partie, C, camp) => (camp === "a" ? modsEquipe(partie) : C?.mods?.e || {});

/**
 * Ce qui vaut pour toute la descente se pose sur l'unité à son arrivée : PV
 * des reliques et de la source, INI de la source. Une recrue ramassée en
 * route le reçoit aussi.
 */
function equiper(partie, u) {
  const m = modsEquipe(partie);
  u.pvMax += bonusEquipe(partie).pv + (m.pv || 0);
  u.pv = u.pvMax;
  u.ini += m.ini || 0;
}

export const atqDe = (partie, u) =>
  u.atq + (u.camp === "a" ? bonusEquipe(partie).atq + (modsEquipe(partie).atq || 0) : 0) + (u.galva > 0 ? u.galvaVal || 3 : 0) + (u.vengeance || 0);
const multButin = (partie) => (1 + 0.1 * partie.equipe.filter((u) => u.role === "debrouillard").length) * (partie.gain ?? 1) * (1 + (modsEquipe(partie).butin || 0));
export function gagner(partie, po) {
  const n = Math.round(po * multButin(partie));
  partie.sac += n;
  return n;
}

/* ── La carte d'un étage ─────────────────────────────────────────────── */

export const ETAGES = 3;
export const RANGS = 7;
const COLONNES = 4;

export const GENRES = {
  combat: { nom: "Combat", aide: "Des adversaires. Du butin." },
  elite: { nom: "Élite", aide: "Adversaires redoutables : butin plus gros, relique probable." },
  tresor: { nom: "Trésor", aide: "Un butin sans garde… en apparence." },
  evenement: { nom: "Rencontre", aide: "Quelque chose bouge dans la brume." },
  repos: { nom: "Repos", aide: "Soins, et les tombés se relèvent." },
  boss: { nom: "Gardien", aide: "Le gardien de l'étage. Il n'y a pas d'autre chemin." },
};

/**
 * Quatre sentiers descendent du haut de l'étage, en dérivant d'une colonne au
 * plus à chaque rang ; là où ils se croisent, les chemins se rejoignent. Le
 * premier rang est un combat, le quatrième une halte (trésor surtout), le
 * dernier un repos avant le gardien. Les coordonnées sont celles du dessin,
 * dans un repère de 400 de large.
 */
export function genererEtage(etage, r, lieux) {
  const noeuds = {};
  const cle = (rg, c) => `${rg}:${c}`;
  const ajouter = (rg, c) => (noeuds[cle(rg, c)] ||= { id: cle(rg, c), r: rg, c, vers: [] });
  const departs = [0, 1, 2, 3].map((c) => [c, r()]).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([c]) => c);
  departs.push(entre(r, 0, COLONNES - 1));
  for (const d of departs) {
    let c = d;
    for (let rg = 0; rg < RANGS; rg++) {
      const n = ajouter(rg, c);
      if (rg < RANGS - 1) {
        const suiv = Math.max(0, Math.min(COLONNES - 1, c + choisir(r, [-1, 0, 1])));
        if (!n.vers.includes(cle(rg + 1, suiv))) n.vers.push(cle(rg + 1, suiv));
        c = suiv;
      } else if (!n.vers.includes("boss")) n.vers.push("boss");
    }
  }
  for (const n of Object.values(noeuds)) {
    n.genre = n.r === 0 ? "combat"
      : n.r === RANGS - 1 ? "repos"
      : n.r === 3 ? choisir(r, ["tresor", "tresor", "evenement"])
      : tirer(r, { combat: 44, evenement: 24, elite: n.r >= 2 ? 12 + Math.min(etage, 12) * 2 : 0, repos: n.r >= 2 ? SOINS.poidsRepos : 0, tresor: 8 });
    n.lieu = legere(choisir(r, lieux));
    n.x = Math.round(62 + n.c * 92 + (r() * 22 - 11));
    n.y = Math.round(60 + n.r * 84 + (r() * 14 - 7));
  }
  noeuds.boss = { id: "boss", r: RANGS, c: 1.5, genre: "boss", vers: [], x: 200, y: 60 + RANGS * 84 + 20, lieu: legere(choisir(r, lieux)) };
  return { noeuds, pos: null, pris: [] };
}
/** Les salles où l'on peut aller : le premier rang au départ, puis les suites de la salle actuelle. */
export function ouverts(plan) {
  if (!plan.pos) return Object.values(plan.noeuds).filter((n) => n.r === 0).map((n) => n.id);
  return [...plan.noeuds[plan.pos].vers];
}

/* ── La partie ───────────────────────────────────────────────────────── */

export function creerPartie({ equipe, artefact = null, source = null, graine, jour, pools, niveaux = {}, fiches = {}, apprenti = null, mode = "jour", gainMode = 1, xpMode = 1 }) {
  // `apprenti` : l'adoucissement des débuts (voir `apprentissage`). Il est
  // figé pour toute la descente : la difficulté ne bouge pas en chemin.
  // `gainMode` et `xpMode` : ce que le mode ajoute ou retire au butin et à
  // l'expérience (`DONJON.modes`, src/config/tiers.js).
  const partie = { jour, graine, mode, uid: 1, etage: 1, sac: 0, benediction: 0, reliques: [], perdus: [], xpPerdus: {},
    difficulte: apprenti?.difficulte ?? 1, gain: (apprenti?.gain ?? 1) * gainMode, xpMode, combat: null, rencontre: null,
    artefact: artefact ? legere(artefact) : null, equipe: [], ecran: "carte", noeud: null,
    // La source de pouvoir : un lieu, ses effets figés pour la descente (niveau et étoile du départ).
    source: source?.c ? { c: legere(source.c), niveau: source.niveau || 1, etoile: !!source.etoile,
      effets: effetsSource(source.c, source.niveau || 1, !!source.etoile) } : null,
    stats: { salles: 0, combats: 0, ennemis: 0, gardiens: 0 } };
  partie.equipe = equipe.map((c) => allie(partie, c, niveaux[`${c.ext}:${c.id}`] || 1, fiches[`${c.ext}:${c.id}`]));
  for (const u of partie.equipe) equiper(partie, u);
  partie.plan = genererEtage(1, tirage(graine + 1), pools.lieux);
  return partie;
}
export function entrer(partie, id) {
  const P = partie.plan;
  if (!ouverts(P).includes(id)) return null;
  if (P.pos) P.pris.push(`${P.pos}>${id}`);
  P.pos = id;
  partie.noeud = id;
  partie.stats.salles++;
  return P.noeuds[id];
}
export function descendre(partie, pools) {
  // Une halte avant de descendre : les tombés se relèvent, à peine. Les
  // autres ne soufflent plus — le repos avant le gardien est le seul soin
  // sûr de l'étage (voir SOINS).
  for (const u of partie.equipe) {
    if (u.ko) { u.ko = false; u.pv = Math.ceil(u.pvMax * SOINS.releveHalte); }
  }
  partie.etage++;
  partie.plan = genererEtage(partie.etage, tirage(partie.graine + partie.etage), pools.lieux);
  partie.noeud = null;
}

/** Une relique au hasard, pondérée par palier. */
export const tirerRelique = (r, artefacts) =>
  artefacts.length ? legere(parmiPalier(r, artefacts, tirer(r, { commun: 45, peucommun: 33, rare: 17, legendaire: 5 }))) : null;
/**
 * Huit reliques au plus. Au-delà, elles partent au sac, en pièces : sans
 * limite, le donjon infini en empilait des centaines, leurs PV et leur ATQ
 * dépassaient la montée des adversaires, et une descente ne finissait plus.
 */
export const RELIQUES_MAX = 8;
const PRIX_RELIQUE = { commun: 6, peucommun: 9, rare: 14, legendaire: 22 };

/** L'équipe prend une relique : ses PV et son INI comptent tout de suite pour chacun. */
export function prendreRelique(partie, a) {
  if (!a) return null;
  if (partie.reliques.length >= RELIQUES_MAX) {
    return { ...a, vendue: gagner(partie, (PRIX_RELIQUE[a.tier] || 6) * partie.etage) };
  }
  partie.reliques.push(a);
  const b = BONUS_ARTEFACT[a.tier] || BONUS_ARTEFACT.commun;
  const ini = effetsArtefact(a).filter((e) => e.mec === "ini").reduce((x, e) => x + e.val, 0);
  for (const u of partie.equipe) { u.pvMax += b.pv; if (!u.ko) u.pv += b.pv; u.ini += ini; }
  return a;
}
export function trouverRelique(partie, r, artefacts) {
  return prendreRelique(partie, tirerRelique(r, artefacts));
}
export function tresor(partie, r, artefacts) {
  const po = gagner(partie, entre(r, 5, 8) * partie.etage);
  const relique = r() < 0.35 + (modsEquipe(partie).fortune || 0) ? trouverRelique(partie, r, artefacts) : null;
  return { titre: "Un trésor", texte: "Sous les pierres, une bourse oubliée.", po, relique };
}
/**
 * Les soins, réduits le 30/09/2026 : chaque étage se terminait sur un repos à
 * +50 %, la halte entre étages rendait encore un quart, et un repos sur quatre
 * chemins environ s'ajoutait en route. L'usure ne comptait plus. Le repos
 * avant le gardien demeure, plus court ; les repos de hasard sont deux fois
 * plus rares ; la halte ne fait plus que relever les tombés.
 */
export const SOINS = { repos: 0.3, releveRepos: 0.25, releveHalte: 0.15, poidsRepos: 4 };

export function repos(partie) {
  let releves = 0;
  // Un intendant dans l'équipe, et le repas est meilleur.
  const bonus = (partie.equipe.some((u) => u.role === "intendant" && !u.ko) ? 1.25 : 1) * (1 + (modsEquipe(partie).soinRepos || 0));
  for (const u of partie.equipe) {
    if (u.ko) { u.ko = false; u.pv = Math.ceil(u.pvMax * SOINS.releveRepos * bonus); releves++; }
    else u.pv = Math.min(u.pvMax, u.pv + Math.ceil(u.pvMax * SOINS.repos * bonus));
  }
  return { titre: "Un abri", texte: `Un peu de répit. L'équipe panse ses plaies${releves ? ` et ${releves} compagnon${releves > 1 ? "s" : ""} se relève${releves > 1 ? "nt" : ""}` : ""}.` };
}

/* ── Rencontres ──────────────────────────────────────────────────────── */

const blesser = (u, d) => { u.pv = Math.max(0, u.pv - d); if (u.pv === 0) u.ko = true; };

/**
 * Chaque rencontre propose deux choix. `choix(partie, ctx)` rend leur
 * libellé, leur disponibilité et leur effet ; l'effet rend le texte du
 * dénouement. `ctx` porte le tirage et les cartes.
 */
export const RENCONTRES = [
  { id: "mirko", titre: "Un colporteur égaré",
    texte: (lieu) => `Mirko, sa clochette et son ballot, s'est perdu dans ${lieu}. Il a des onguents, pour qui paie.`,
    choix: (p) => [
      { lib: `Acheter des onguents (${6 * p.etage} PO du sac)`, ok: p.sac >= 6 * p.etage, f: () => {
        p.sac -= 6 * p.etage;
        for (const u of vivants(p.equipe)) u.pv = Math.min(u.pvMax, u.pv + Math.ceil(u.pvMax * 0.6));
        return "Les onguents sentent la menthe et le goudron. L'équipe reprend des forces."; } },
      { lib: "Lui souhaiter bonne route", f: () => "Il vous salue d'un coup de clochette et disparaît dans la brume." }] },
  { id: "coffre", titre: "Un coffre moussu",
    texte: (lieu) => `Au fond de ${lieu}, un coffre couvert de mousse. La serrure a l'air neuve.`,
    choix: (p, { r }) => [
      { lib: "L'ouvrir", f: () => {
        if (r() < 0.65) return `Il est plein. +${gagner(p, entre(r, 6, 9) * p.etage)} PO.`;
        const d = 3 * p.etage;
        for (const u of vivants(p.equipe)) blesser(u, d);
        return `Une aiguille empoisonnée ! Chaque compagnon perd ${d} PV.`; } },
      { lib: "Passer son chemin", f: () => "Mieux vaut ne pas tenter le sort." }] },
  { id: "autel", titre: "Un autel dans la brume",
    texte: () => "Une pierre levée, tiède sous la main. Elle réclame du sang et promet de la force.",
    choix: (p) => [
      { lib: "Offrir du sang (−3 PV à chacun)", f: () => {
        for (const u of vivants(p.equipe)) u.pv = Math.max(1, u.pv - 3);
        p.benediction++;
        return "La pierre boit. +1 ATQ à toute l'équipe jusqu'à la sortie."; } },
      { lib: "S'éloigner", f: () => "La pierre refroidit derrière vous." }] },
  { id: "blesse", titre: "Quelqu'un au bord du chemin",
    texte: () => "Un voyageur blessé, adossé à la roche. Il demande à vous suivre jusqu'à la sortie.",
    choix: (p, { r, pools }) => {
      // Jamais une carte déjà dans l'équipe.
      const deja = new Set(p.equipe.map((u) => `${u.c.ext}:${u.c.id}`));
      const libres = pools.allies.filter((c) => !deja.has(`${c.ext}:${c.id}`));
      const recrue = parmiPalier(r, libres.length ? libres : pools.allies, tirer(r, { commun: 70, peucommun: 25, rare: 5 }));
      return [
        { lib: p.equipe.length < 5 ? `L'emmener (${recrue.nom} rejoint l'équipe)` : "L'équipe est au complet", ok: p.equipe.length < 5, f: () => {
          const u = allie(p, recrue); u.recrue = true; equiper(p, u); u.pv = Math.ceil(u.pvMax * 0.5); p.equipe.push(u);
          return `${recrue.nom} vous suit, clopin-clopant, et se battra à vos côtés.`; } },
        { lib: "Lui laisser des vivres", f: () => `Il vous remercie et vous glisse quelques pièces. +${gagner(p, 2 * p.etage)} PO.` }];
    } },
  { id: "source", titre: "Une source claire",
    texte: (lieu) => `Au milieu de ${lieu}, une eau qui ne connaît pas la brume.`,
    choix: (p) => [
      { lib: "Boire", f: () => { for (const u of vivants(p.equipe)) u.pv = Math.min(u.pvMax, u.pv + Math.ceil(u.pvMax * 0.25)); return "L'eau est glacée. L'équipe se sent mieux."; } },
      { lib: "Fouiller le bassin", f: () => `Au fond, des pièces jetées par d'autres. +${gagner(p, 3 * p.etage)} PO.` }] },
  { id: "echo", titre: "Un écho dans la brume",
    texte: () => "Une voix répète vos pas, un temps trop tard. Elle vient d'un passage étroit.",
    choix: (p, { r, pools }) => [
      { lib: "Suivre la voix", f: () => {
        if (r() < 0.5) { const a = trouverRelique(p, r, pools.artefacts); if (a) return `Au bout du passage, un objet posé là pour vous : ${a.nom}.`; }
        const u = choisir(r, vivants(p.equipe)); blesser(u, 4 * p.etage);
        return `C'était un piège. ${u.c.nom} perd ${4 * p.etage} PV.`; } },
      { lib: "Boucher ses oreilles", f: () => "La voix se tait quand vous passez." }] },
];

/* ── Combat ──────────────────────────────────────────────────────────── */

function composer(partie, genre, r, pools) {
  const e = partie.etage;
  const poids = { commun: 72 - e * 13, peucommun: 24 + e * 7, rare: 4 + e * 6 };
  // Deux adversaires sur cinq sont des PNJ rivaux, jamais un compagnon de l'équipe.
  const pris = new Set(partie.equipe.map((u) => `${u.c.ext}:${u.c.id}`));
  const rivaux = (pools.rivaux || []).filter((c) => !pris.has(`${c.ext}:${c.id}`));
  const source = () => (rivaux.length && r() < 0.4 ? rivaux : pools.monstres);
  const m = (tier, mult) => monstre(partie, parmiPalier(r, source(), tier), e, mult);
  if (genre === "boss") {
    const b = monstre(partie, parmiPalier(r, pools.monstres, "rare"), e, 2.6);
    b.boss = true; b.ini = 4;
    b.nomAffiche = `${b.c.nom}, alpha`;
    return [m(tirer(r, poids)), b, ...(e >= 2 ? [m(tirer(r, poids))] : [])];
  }
  const n = genre === "elite" ? entre(r, 2, 3) : entre(r, 2, 2 + Math.min(e, 2));
  const l = Array.from({ length: n }, () => m(tirer(r, poids)));
  if (genre === "elite") { const i = Math.floor(n / 2); l[i] = m("rare", 1.4); l[i].elite = true; }
  return l;
}
/**
 * Un combat. Une salle d'élite (une fois sur deux, davantage avec la bonne
 * fortune) et chaque gardien gardent une relique : **les adversaires s'en
 * servent** — ses PV, son ATQ, son effet —, et la victoire la rend à
 * l'équipe. On voit ce qu'on va gagner, et ce qu'il en coûte.
 */
export function demarrerCombat(partie, genre, r, pools) {
  for (const u of partie.equipe) Object.assign(u, { cd: 0 }, ETATS);
  partie.stats.combats++;
  const ennemis = composer(partie, genre, r, pools);
  const chance = genre === "boss" ? 1 : genre === "elite" ? 0.55 + (modsEquipe(partie).fortune || 0) : 0;
  const relique = chance && r() < chance ? tirerRelique(r, pools.artefacts || []) : null;
  const C = { genre, ennemis, relique, round: 0, ordre: [], idx: -1, actif: null, compteBoss: 0, fini: null, notes: [], ouverture: [], marquePose: {} };
  if (relique) {
    const b = BONUS_ARTEFACT[relique.tier] || BONUS_ARTEFACT.commun;
    const ini = effetsArtefact(relique).filter((e) => e.mec === "ini").reduce((x, e) => x + e.val, 0);
    for (const m of ennemis) { m.pvMax += b.pv; m.pv = m.pvMax; m.atq += b.atq; m.ini += ini; }
  }
  C.mods = { a: modsEquipe(partie), e: cumuler(effetsCamp(partie, C, "e"), "e") };
  C.brumeTour = BRUME_TOUR + (C.mods.a.brume || 0);
  // Première salve : chaque camp qui en a une frappe l'autre avant le premier tour.
  for (const [camp, cibles] of [["a", ennemis], ["e", partie.equipe]]) {
    const v = C.mods[camp].ouverture;
    if (!v) continue;
    const effets = [];
    for (const x of cibles.filter((y) => !y.ko)) { x.pv = Math.max(0, x.pv - v); if (x.pv === 0) x.ko = true; effets.push({ uid: x.uid, txt: `−${v}`, anim: "touche" }); }
    C.ouverture.push({ note: camp === "a" ? `Première salve : −${v} à chaque adversaire.` : `Ils ouvrent le feu : −${v} à chaque compagnon.`, effets,
      pouvoir: { mec: "ouverture", camp, origine: origineDe(partie, camp, "ouverture"), cibles: cibles.map((x) => x.uid), valeur: v } });
  }
  return C;
}
export const unites = (partie, C) => [...partie.equipe, ...C.ennemis];
export const parUid = (partie, C, uid) => unites(partie, C).find((u) => u.uid === uid);

/**
 * Ce qui arrive à une unité quand vient son tour : ses postures tombent
 * (provocation, garde, voile), sa recharge baisse, elle saigne, ou elle
 * reste étourdie. Rend faux si elle ne joue pas ce tour-ci ; ce qui s'est
 * passé part dans `C.notes`, pour le journal.
 */
function debutDeTour(partie, C, u) {
  const m = mods(partie, C, u.camp);
  if (u.cd > 0) u.cd--;
  // Second souffle (pouvoir) : la fraction s'accumule, un tour de recharge tombe à chaque unité pleine.
  if (m.recharge && u.cd > 0) {
    u.elan = (u.elan || 0) + m.recharge;
    if (u.elan >= 1) {
      u.elan -= 1; u.cd--;
      (C.notes ||= []).push({ evt: "pouvoir", uid: u.uid, note: null, effets: [], pouvoir: { mec: "recharge", camp: u.camp, origine: origineDe(partie, u.camp, "recharge"), uid: u.uid } });
    }
  }
  if (m.regen && !u.ko && u.pv < u.pvMax) {
    const g = Math.min(u.pvMax - u.pv, Math.max(1, Math.round(u.pvMax * m.regen)));
    u.pv += g;
    (C.notes ||= []).push({ evt: "pouvoir", uid: u.uid, note: null, effets: [{ uid: u.uid, txt: `+${g}`, cls: "soin" }],
      pouvoir: { mec: "regen", camp: u.camp, origine: origineDe(partie, u.camp, "regen"), uid: u.uid, valeur: g } });
  }
  u.provoque = 0;                   // la provocation court jusqu'à son prochain tour
  u.parade = 0; u.riposte = 0; u.voile = 0; u.armureProvoc = 0;
  const nom = u.nomAffiche || u.c.nom;
  if (u.saigne > 0) {
    u.saigne--;
    const d = Math.max(1, u.saigneD || 1);
    u.pv = Math.max(0, u.pv - d);
    if (u.pv === 0) u.ko = true;
    (C.notes ||= []).push({ evt: "saignement", uid: u.uid, note: `${nom} saigne : −${d}${u.ko ? " — à terre" : ""}`, effets: [{ uid: u.uid, txt: `−${d}`, anim: "touche" }] });
    if (u.ko) return false;
  }
  if (u.etourdi > 0) {
    u.etourdi--;
    (C.notes ||= []).push({ evt: "piege", uid: u.uid, note: `${nom} se dégage du piège et perd son tour.`, effets: [{ uid: u.uid, txt: "Étourdi", cls: "info" }] });
    return false;
  }
  return true;
}

/**
 * Passe la main à l'unité suivante et la rend, ou ouvre un nouveau tour.
 * À initiative égale, l'équipe passe devant : on joue chez soi. Rend null si
 * le combat s'est joué entre deux mains (un saignement achève le dernier).
 */
export function prochain(partie, C) {
  C.notes = [];
  // Une première salve peut avoir fini le combat avant le premier tour.
  if (issue(partie, C)) { C.actif = null; return null; }
  for (let garde = 0; garde < 4; garde++) {
    C.idx++;
    while (C.idx < C.ordre.length) {
      const u = parUid(partie, C, C.ordre[C.idx]);
      if (!u.ko && debutDeTour(partie, C, u)) break;
      if (issue(partie, C)) { C.actif = null; return null; }
      C.idx++;
    }
    if (C.idx < C.ordre.length) {
      const u = parUid(partie, C, C.ordre[C.idx]);
      C.actif = u.uid;
      return u;
    }
    C.round++;
    C.ordre = vivants(unites(partie, C)).sort((a, b) => (b.ini - a.ini) || (a.camp === "a" ? -1 : 1)).map((u) => u.uid);
    // INI étoilée : un tour de plus, en tête, au premier tour du combat.
    if (C.round === 1) {
      const vifs = C.ordre.filter((uid) => parUid(partie, C, uid).etoiles?.ini);
      if (vifs.length) C.ordre = [...vifs, ...C.ordre];
    }
    C.idx = -1;
    for (const u of unites(partie, C)) { if (u.galva > 0) u.galva--; if (u.rempart > 0) u.rempart--; if (u.marque > 0) u.marque--; }
  }
  return null;
}

/** Les deux gestes possibles de l'unité qui joue : son geste, et sa technique. */
export function gestes(partie, u) {
  const g = COMPETENCES[gesteDe(u)], t = COMPETENCES[techDe(u)];
  const l = [{ id: g.id, nom: g.nom, cible: g.cible, pret: true, etoile: !!u.etoiles?.geste,
    aide: g.id === "attaque" ? `${Math.round(atqDe(partie, u) * (u.etoiles?.geste ? ETOILE.puissance : 1))} dégâts sur une cible` : (u.etoiles?.geste ? g.etoile : g.aide) }];
  if (t) l.push({ id: t.id, nom: t.nom, cible: t.cible, pret: u.cd === 0, etoile: !!u.etoiles?.tech,
    aide: u.cd > 0 ? `Prêt dans ${u.cd} tour${u.cd > 1 ? "s" : ""}` : (u.etoiles?.tech ? t.etoile : t.aide) });
  return l;
}

/**
 * La brume qui monte : passé le tour BRUME_TOUR, chaque tour ajoute 20 % aux
 * dégâts des deux camps. Aucun combat ne peut durer toujours — un soigneur
 * resté seul se soignait plus vite qu'on ne le frappait, et on ne fuit pas
 * seul.
 */
export const BRUME_TOUR = 10;
export const brume = (C) => {
  const t = C?.brumeTour ?? BRUME_TOUR;
  return C && C.round > t ? 1 + 0.2 * (C.round - t) : 1;
};

function frapper(partie, att, cible, mult, r, perce = false, C = null) {
  if (cible.voile) return { reel: 0, crit: false, voile: true, renvoi: 0 };
  const ma = mods(partie, C, att.camp), mc = mods(partie, C, cible.camp);
  // Les pouvoirs ne tirent au sort que s'ils existent : sans eux, les dés tombent comme avant.
  if (mc.esquive && r() < mc.esquive) {
    signaler(partie, C, cible.camp, "esquive", { uid: cible.uid, cible: att.uid });
    return { reel: 0, crit: false, voile: true, esquive: true, renvoi: 0 };
  }
  let d = atqDe(partie, att) * mult * brume(C) * (0.85 + r() * 0.3);
  let crit = false;
  if (att.role === "fourbe" && r() < 0.25) { d *= 2; crit = true; }
  else if (ma.crit && r() < ma.crit) { d *= 2; crit = true; signaler(partie, C, att.camp, "crit", { uid: att.uid, cible: cible.uid }); }
  if (cible.marque > 0) d *= 1 + (cible.marqueVal || 0.5);
  // Les bonus de dégâts conditionnels : chacun se signale quand il joue.
  const bonus = (mec, ok) => { if (ok && ma[mec]) { d *= 1 + ma[mec]; signaler(partie, C, att.camp, mec, { uid: att.uid, cible: cible.uid }); } };
  bonus("tempo", C?.round === 1);
  bonus("chasseur", cible.boss || cible.elite);
  bonus("execution", cible.pv / cible.pvMax < 0.35);
  bonus("dernierRempart", C && vivants(att.camp === "a" ? partie.equipe : C.ennemis).length === 1);
  if (mc.resistance) d *= 1 - mc.resistance;
  if (mc.gardien && att.boss) { d *= 1 - mc.gardien; signaler(partie, C, cible.camp, "gardien", { uid: cible.uid, cible: att.uid }); }
  if (C?.round === 1 && mc.rempartDebut) signaler(partie, C, cible.camp, "rempartDebut", { uid: cible.uid });
  const armure = perce ? 0 : (cible.role === "garde" ? 1 : 0) + (cible.provoque ? cible.armureProvoc || 2 : 0)
    + (cible.rempart > 0 ? cible.rempartVal || 3 : 0) + (cible.parade || 0)
    + (mc.armure || 0) + (C?.round === 1 ? mc.rempartDebut || 0 : 0);
  const reel = Math.max(1, Math.round(d) - armure);
  cible.pv = Math.max(0, cible.pv - reel);
  if (cible.pv === 0) {
    cible.ko = true;
    // Vengeance : les autres du camp du tombé frappent plus fort jusqu'à la fin du combat.
    if (mc.vengeance && C) for (const x of vivants(cible.camp === "a" ? partie.equipe : C.ennemis)) {
      x.vengeance = (x.vengeance || 0) + mc.vengeance;
      signaler(partie, C, x.camp, "vengeance", { uid: x.uid, cible: cible.uid, valeur: mc.vengeance });
    }
  }
  // Garde haute, et épines (pouvoir) : qui frappe prend un retour.
  let renvoi = 0;
  if (cible.riposte && !cible.ko && !att.ko) renvoi += Math.max(1, Math.round(atqDe(partie, cible) * cible.riposte));
  if (mc.epines && !att.ko) {
    const ep = Math.max(1, Math.round(reel * mc.epines));
    renvoi += ep;
    signaler(partie, C, cible.camp, "epines", { uid: cible.uid, cible: att.uid, valeur: ep });
  }
  if (renvoi) { att.pv = Math.max(0, att.pv - renvoi); if (att.pv === 0) att.ko = true; }
  // Soif de sang : une part des dégâts revient en PV.
  let draine = 0;
  if (ma.drain && !att.ko) {
    draine = Math.min(att.pvMax - att.pv, Math.round(reel * ma.drain)); att.pv += draine;
    if (draine) signaler(partie, C, att.camp, "drain", { uid: att.uid, cible: cible.uid, valeur: draine });
  }
  if (!cible.ko && ma.saignement && r() < ma.saignement) {
    cible.saigne = Math.max(cible.saigne || 0, 2);
    cible.saigneD = Math.max(cible.saigneD || 0, Math.max(1, Math.round(atqDe(partie, att) * 0.4)));
    signaler(partie, C, att.camp, "saignement", { uid: att.uid, cible: cible.uid });
  }
  // Repérage : le premier coup du camp, dans ce combat, marque sa cible.
  if (ma.marque && C && !C.marquePose?.[att.camp] && !cible.ko) {
    (C.marquePose ||= {})[att.camp] = true;
    cible.marque = Math.max(cible.marque || 0, 2); cible.marqueVal = Math.max(cible.marqueVal || 0, ma.marque);
    signaler(partie, C, att.camp, "marque", { uid: att.uid, cible: cible.uid });
  }
  return { reel, crit, renvoi, draine };
}

/** Les compétences qui frappent une cible : multiplicateur, et l'armure qu'elles ignorent. */
const FRAPPES = {
  attaque: { mult: 1 }, estoc: { mult: 0.85, perce: true }, entaille: { mult: 0.6 }, bouclier: { mult: 0.7 },
  double: { mult: 0.55, coups: 2 }, secours: { mult: 0.5 }, ripostee: { mult: 0.8 }, trait: { mult: 0.7 },
  lourde: { mult: 1.9 }, vise: { mult: 1.6, perce: true }, coupbas: { mult: 1.4 }, execution: { mult: 1.4 },
  marque: { mult: 1 }, piege: { mult: 0.8 }, drain: { mult: 1.3 },
};

/**
 * Résout un geste. Rend ce que l'interface doit montrer : le mouvement
 * (`anim` : « ruer » vers une cible, ou « pulser » sur place), les effets
 * sur chaque unité touchée, et la ligne du journal.
 */
export function resoudre(partie, C, u, geste, cible, r) {
  const nom = (x) => x.nomAffiche || x.c.nom;
  const effets = [];
  let note = "", anim = "pulser";
  const K = COMPETENCES[geste];
  const etoile = K && etoileSur(u, geste);
  const p = etoile ? ETOILE.puissance : 1;
  C.pouvoirs = [];
  const siens = vivants(u.camp === "a" ? partie.equipe : C.ennemis);
  const enFace = vivants(u.camp === "a" ? C.ennemis : partie.equipe);
  let renvoiTotal = 0;
  const coup = (x, mult, perce = false, cls = "") => {
    const { reel, crit, renvoi, voile, draine } = frapper(partie, u, x, mult, r, perce, C);
    renvoiTotal += renvoi || 0;
    effets.push({ uid: x.uid, txt: voile ? "Esquive" : `−${reel}`, cls: crit ? "crit" : cls, anim: voile ? undefined : "touche" });
    if (renvoi) effets.push({ uid: u.uid, txt: `−${renvoi}`, anim: "touche" });
    if (draine) effets.push({ uid: u.uid, txt: `+${draine}`, cls: "soin" });
    return { reel, crit, renvoi, voile };
  };
  const bonusSoin = 1 + (mods(partie, C, u.camp).soin || 0);
  const soigner = (a, n) => {
    const g = Math.min(a.pvMax - a.pv, Math.max(0, Math.round(n * bonusSoin)));
    if (g && bonusSoin > 1) signaler(partie, C, u.camp, "soin", { uid: u.uid, cible: a.uid, valeur: g });
    a.pv += g;
    if (g) effets.push({ uid: a.uid, txt: `+${g}`, cls: "soin", anim: "soigne" });
    return g;
  };
  const plusBlesse = () => [...siens].sort((a, b) => a.pv / a.pvMax - b.pv / b.pvMax)[0];

  if (FRAPPES[geste]) {
    anim = "ruer";
    const F = FRAPPES[geste];
    let mult = F.mult * p;
    if (geste === "execution" && cible.pv / cible.pvMax < 0.35) mult *= 3;
    let total = 0, crit = false, renvoi = 0;
    for (let i = 0; i < (F.coups || 1) && !cible.ko; i++) {
      const res = coup(cible, mult, !!F.perce, geste !== "attaque" ? "crit" : "");
      total += res.reel; crit ||= res.crit; renvoi += res.renvoi;
    }
    note = geste === "attaque"
      ? `${nom(u)} frappe ${nom(cible)} : −${total}${crit ? " (critique)" : ""}`
      : `${nom(u)} — ${K.nom} sur ${nom(cible)} : −${total}`;
    if (renvoi) note += ` (renvoi : −${renvoi})`;
    if (cible.ko) note += " — à terre";
    else if (geste === "entaille") { cible.saigne = etoile ? 3 : 2; cible.saigneD = Math.max(1, Math.round(atqDe(partie, u) * (etoile ? 0.65 : 0.4))); note += ", qui saigne"; }
    else if (geste === "marque") { cible.marque = 2; cible.marqueVal = etoile ? 0.9 : 0.6; effets.push({ uid: cible.uid, txt: "Marqué", cls: "info" }); }
    else if (geste === "piege") {
      if (cible.boss) note += " (le gardien s'en dégage)";
      else { cible.etourdi = 1; effets.push({ uid: cible.uid, txt: "Piégé", cls: "info" }); note += ", qui perdra son tour"; }
    }
    if (geste === "trait") {
      const autre = enFace.filter((x) => x !== cible && !x.ko);
      if (autre.length) { const x = choisir(r, autre); const res = coup(x, mult); note += `, et −${res.reel} à ${nom(x)}`; }
    }
    if (geste === "bouclier") { u.parade = etoile ? 4 : 2; effets.push({ uid: u.uid, txt: `Armure +${u.parade}`, cls: "info" }); }
    if (geste === "ripostee") { u.riposte = etoile ? 1.5 : 1; effets.push({ uid: u.uid, txt: "Garde haute", cls: "info" }); }
    if (geste === "secours") { const b = plusBlesse(); if (b) { const g = soigner(b, Math.ceil(atqDe(partie, u) * (etoile ? 0.5 : 1 / 3))); if (g) note += `, ${nom(b)} +${g}`; } }
    if (geste === "drain" && total) { const g = soigner(u, total / 2); if (g) note += `, +${g} PV`; }
    if (geste === "coupbas" && u.camp === "a") { const po = gagner(partie, entre(r, 1, 3) * partie.etage * (etoile ? 2 : 1)); effets.push({ uid: u.uid, txt: `+${po} PO`, cls: "info" }); note += `, +${po} PO`; }
  } else if (geste === "soin") {
    const s = soigner(cible, (atqDe(partie, u) + 2) * p);
    note = `${nom(u)} soigne ${nom(cible)} : +${s}`;
  } else if (geste === "vague" || geste === "tempete") {
    const mult = (geste === "tempete" ? 1.25 : 1) * p;
    for (const e of enFace) coup(e, mult);
    note = geste === "vague"
      ? `${nom(u)} déchaîne la brume sur ${u.camp === "a" ? "tous les adversaires" : "toute l'équipe"}.`
      : `${nom(u)} lève une tempête sur ${u.camp === "a" ? "tous les adversaires" : "toute l'équipe"}.`;
  } else if (geste === "provoc") {
    u.provoque = 1; u.armureProvoc = etoile ? 5 : 2;
    effets.push({ uid: u.uid, txt: "Provocation", cls: "info" });
    note = `${nom(u)} attire les coups sur lui.`;
  } else if (geste === "galva") {
    // Décompté à chaque nouveau tour : 3, c'est la fin de celui-ci et deux tours pleins.
    const v = etoile ? 5 : 3;
    for (const a of siens) { a.galva = 3; a.galvaVal = v; effets.push({ uid: a.uid, txt: `+${v} ATQ`, cls: "info" }); }
    note = `${nom(u)} galvanise ${u.camp === "a" ? "l'équipe" : "les siens"}.`;
  } else if (geste === "balayage") {
    for (const a of vivants(partie.equipe)) coup(a, 0.6);
    note = `${nom(u)} balaie toute l'équipe.`;
  } else if (geste === "rempart") {
    const v = etoile ? 5 : 3;
    for (const a of siens) { a.rempart = 2; a.rempartVal = v; effets.push({ uid: a.uid, txt: "Rempart", cls: "info" }); }
    note = `${nom(u)} dresse un rempart devant ${u.camp === "a" ? "l'équipe" : "les siens"}.`;
  } else if (geste === "ravit") {
    const s = atqDe(partie, u) * p;
    for (const a of siens) soigner(a, s);
    note = `${nom(u)} ravitaille ${u.camp === "a" ? "l'équipe" : "les siens"}.`;
  } else if (geste === "souffle") {
    const part = etoile ? 0.65 : 0.4;
    const tombes = (u.camp === "a" ? partie.equipe : C.ennemis).filter((a) => a.ko).sort((a, b) => b.pvMax - a.pvMax);
    if (tombes.length) {
      const a = tombes[0]; a.ko = false; a.pv = Math.max(1, Math.ceil(a.pvMax * part));
      effets.push({ uid: a.uid, txt: `+${a.pv}`, cls: "soin", anim: "soigne" });
      note = `${nom(u)} relève ${nom(a)}.`;
    } else {
      const b = plusBlesse(); const g = b ? soigner(b, b.pvMax * part) : 0;
      note = g ? `${nom(u)} rend son souffle à ${nom(b)} : +${g}` : `${nom(u)} reprend son souffle.`;
    }
  } else if (geste === "ralliement") {
    // Le +ATQ passe par le galvanisé (deux tours pleins), sans écraser un plus fort.
    const v = etoile ? 3 : 2;
    for (const a of siens) {
      if (a !== u) a.cd = etoile ? 0 : Math.max(0, a.cd - 2);
      const actif = a.galva > 0 ? a.galvaVal || 3 : 0;
      if (actif <= v) { a.galva = Math.max(a.galva, 2); a.galvaVal = v; }
      effets.push({ uid: a.uid, txt: `Rallié +${v}`, cls: "info" });
    }
    note = `${nom(u)} rallie ${u.camp === "a" ? "l'équipe" : "les siens"}.`;
  } else if (geste === "voile") {
    cible.voile = 1;
    effets.push({ uid: cible.uid, txt: "Voilé", cls: "info" });
    if (etoile) soigner(cible, cible.pvMax * 0.3);
    note = `${nom(u)} enveloppe ${nom(cible)} de brume.`;
  }
  // Recharge : comptée en tours de l'unité, le sien compris, d'où le +1.
  if (K?.place === "tech") { const cd = rechargeDe(u, geste); u.cd = cd ? cd + 1 : 0; }
  return { anim, cible: cible?.uid ?? null, effets, note, renvoi: renvoiTotal, pouvoirs: C.pouvoirs.splice(0) };
}

export function issue(partie, C) {
  // Les deux camps à terre (un renvoi ou des épines achèvent le dernier qui
  // frappe) : c'est une défaite, l'équipe ne peut pas continuer.
  if (!vivants(partie.equipe).length) return "defaite";
  if (!vivants(C.ennemis).length) return "victoire";
  return null;
}

/**
 * Les cibles qu'un camp peut frapper : s'il y a un provocateur en face, lui
 * seul. Vaut pour l'équipe comme pour les adversaires.
 */
export function ciblesPossibles(partie, C, camp) {
  const en_face = vivants(camp === "a" ? C.ennemis : partie.equipe);
  const provoc = en_face.filter((x) => x.provoque);
  return provoc.length ? provoc : en_face;
}

/**
 * Les adversaires. Un PNJ rival joue comme le pilote automatique joue pour
 * l'équipe, capacités comprises. Le bestiaire frappe : le fourbe achève, les
 * autres au hasard. Le gardien balaie toute l'équipe tous les trois tours.
 */
export function choixIA(partie, C, m, r) {
  if (m.boss) { C.compteBoss++; if (C.compteBoss % 3 === 0) return { geste: "balayage", cible: null }; }
  if (ROLES[m.role]) return choixAuto(partie, C, m, "menace");
  const cibles = ciblesPossibles(partie, C, "e");
  if (cibles.some((a) => a.provoque)) return { geste: "attaque", cible: cibles[0] };
  if (m.role === "fourbe") return { geste: "attaque", cible: [...cibles].sort((a, b) => a.pv - b.pv)[0] };
  const garde = cibles.find((a) => a.role === "garde");
  return { geste: "attaque", cible: garde && r() < 0.3 ? garde : choisir(r, cibles) };
}

export const STRATEGIES = {
  manuel: { nom: "Manuel", aide: "Vous choisissez chaque geste et chaque cible." },
  concentrer: { nom: "Concentrer", aide: "Tous sur l'adversaire le plus faible, capacités dès qu'elles sont prêtes." },
  menace: { nom: "Abattre la menace", aide: "Tous sur l'adversaire qui frappe le plus fort pour ce qu'il lui reste de PV." },
  prudence: { nom: "Prudence", aide: "Soigner et protéger d'abord, frapper ensuite la menace." },
};
export function choixAuto(partie, C, u, strategie) {
  const ennemis = ciblesPossibles(partie, C, u.camp);
  const allies = vivants(u.camp === "a" ? partie.equipe : C.ennemis);
  const faible = [...ennemis].sort((a, b) => a.pv - b.pv)[0];
  const menace = [...ennemis].sort((a, b) => atqDe(partie, b) / b.pv - atqDe(partie, a) / a.pv)[0];
  const cible = strategie === "concentrer" ? faible : menace;
  const blesse = [...allies].sort((a, b) => a.pv / a.pvMax - b.pv / b.pvMax)[0];
  const pret = u.cd === 0;
  const T = techDe(u);
  const frappe = { geste: gesteDe(u), cible };
  if (T === "soin" && blesse && blesse.pv / blesse.pvMax < (strategie === "prudence" ? 0.6 : 0.45)) return { geste: "soin", cible: blesse };
  if (!pret || !T) return frappe;
  switch (T) {
    case "provoc": return strategie === "prudence" || allies.some((a) => a !== u && a.pv / a.pvMax < 0.5) ? { geste: T, cible: null } : frappe;
    case "galva": return { geste: T, cible: null };
    case "ravit": return allies.reduce((s, a) => s + (a.pvMax - a.pv), 0) >= allies.length * 3 ? { geste: T, cible: null } : frappe;
    case "rempart": return allies.some((a) => !a.rempart) ? { geste: T, cible: null } : frappe;
    case "vague": case "tempete": return ennemis.length >= 2 ? { geste: T, cible: null } : frappe;
    case "lourde": case "vise": case "coupbas": case "drain": return { geste: T, cible };
    case "marque": { const x = cible?.marque ? ennemis.find((e) => !e.marque) : cible; return x ? { geste: T, cible: x } : frappe; }
    case "piege": { const x = cible && !cible.boss && !cible.etourdi ? cible : ennemis.find((e) => !e.boss && !e.etourdi); return x ? { geste: T, cible: x } : frappe; }
    case "execution": { const x = ennemis.filter((e) => e.pv / e.pvMax < 0.35).sort((a, b) => b.pv - a.pv)[0]; return x ? { geste: T, cible: x } : frappe; }
    case "souffle": {
      const tombe = (u.camp === "a" ? partie.equipe : C.ennemis).some((a) => a.ko && !a.recrue);
      return tombe || (blesse && blesse.pv / blesse.pvMax < 0.4) ? { geste: T, cible: null } : frappe;
    }
    case "voile": return blesse && blesse.pv / blesse.pvMax < 0.5 && !blesse.voile ? { geste: T, cible: blesse } : frappe;
    case "ralliement": return allies.reduce((s, a) => s + (a === u ? 0 : a.cd), 0) >= 2 || allies.every((a) => !(a.galva > 0)) ? { geste: T, cible: null } : frappe;
    default: return frappe;
  }
}

export function victoire(partie, C, r, _artefacts) {
  const base = C.ennemis.reduce((s, m) => s + (m.boss ? 12 : m.elite ? 4 : 1.5) * partie.etage + entre(r, 0, 2), 0);
  const po = gagner(partie, Math.round(C.genre === "elite" ? base * 1.5 : base));
  partie.stats.ennemis += C.ennemis.length;
  if (C.genre === "boss") partie.stats.gardiens++;
  // Expérience : un point par adversaire et par étage, trois pour une élite,
  // cinq par étage pour le gardien. Toute l'équipe la reçoit, tombés compris :
  // ils étaient de l'expédition.
  const xp = C.ennemis.reduce((s, m) => s + (m.boss ? 5 : m.elite ? 3 : 1) * partie.etage, 0);
  for (const u of partie.equipe) { Object.assign(u, { cd: 0 }, ETATS); u.xp = (u.xp || 0) + xp; }
  // La relique que gardaient les adversaires change de camp.
  const relique = prendreRelique(partie, C.relique || null);
  // Bivouac et relève (pouvoirs) : l'équipe souffle après la victoire.
  const m = modsEquipe(partie);
  const pouvoirs = [];
  for (const u of partie.equipe) {
    if (u.ko && m.releve) {
      u.ko = false; u.pv = Math.max(1, Math.ceil(u.pvMax * m.releve));
      pouvoirs.push({ mec: "releve", camp: "a", origine: origineDe(partie, "a", "releve"), uid: u.uid, valeur: u.pv });
    } else if (!u.ko && m.finCombat && u.pv < u.pvMax) {
      const g = Math.min(u.pvMax - u.pv, Math.ceil(u.pvMax * m.finCombat)); u.pv += g;
      pouvoirs.push({ mec: "finCombat", camp: "a", origine: origineDe(partie, "a", "finCombat"), uid: u.uid, valeur: g });
    }
  }
  return C.genre === "boss"
    ? { titre: `Étage ${partie.etage} nettoyé`, texte: "Le gardien tombe. Plus bas, la brume est plus épaisse — et les bourses plus lourdes.", po, relique, pouvoirs }
    : { titre: "Victoire", texte: `${C.ennemis.length} adversaires à terre.`, po, relique, pouvoirs };
}
/** On ne fuit ni un gardien, ni seul, ni au donjon infini : là, on tient jusqu'au bout. */
export const peutFuir = (partie, C) => partie.mode !== "infini" && C.genre !== "boss" && vivants(partie.equipe).length >= 2;

/**
 * La retraite coûte cher. Deux cinquièmes du sac tombent dans la débandade,
 * chacun y laisse un sixième de ses PV, et le compagnon le plus mal en point
 * reste derrière pour couvrir les autres : il quitte l'expédition, et sa
 * carte part en convalescence un jour (voir `convalescences`).
 */
export function fuir(partie) {
  const perte = Math.round(partie.sac * 0.4);
  partie.sac -= perte;
  for (const u of vivants(partie.equipe)) u.pv = Math.max(1, u.pv - Math.ceil(u.pvMax / 6));
  const reste = [...vivants(partie.equipe)].sort((a, b) => a.pv / a.pvMax - b.pv / b.pvMax)[0];
  partie.equipe = partie.equipe.filter((u) => u !== reste);
  partie.perdus.push(reste.c);
  // Le compagnon resté derrière garde ce qu'il a appris jusque-là.
  partie.xpPerdus = { ...(partie.xpPerdus || {}), [`${reste.c.ext}:${reste.c.id}`]: reste.xp || 0 };
  partie.stats.fuites = (partie.stats.fuites || 0) + 1;
  return { titre: "Repli", texte: `Vous battez en retraite. ${perte} pièce${perte > 1 ? "s" : ""} glisse${perte > 1 ? "nt" : ""} du sac dans la débandade, chacun y laisse des plumes, et ${reste.c.nom} reste derrière pour couvrir les autres : retour au camp demain.` };
}

/**
 * Les cartes que l'expédition met au repos, et pour combien de jours, à la
 * manière de Darkest Dungeon. Une défaite immobilise toute l'équipe un jour
 * par étage atteint ; un compagnon laissé derrière dans une fuite, un jour.
 * Le recrue ramassée en route n'est pas à nous : elle n'est pas comptée.
 */
export function convalescences(partie, iss) {
  const l = new Map();
  const mettre = (c, j) => { const k = `${c.ext}:${c.id}`; l.set(k, Math.max(l.get(k) || 0, j)); };
  for (const c of partie.perdus || []) mettre(c, 1);
  // Au donjon infini, l'étage n'a pas de fin : le repos est d'un jour.
  const jours = partie.mode === "infini" ? 1 : partie.etage;
  if (iss === "defaite") for (const u of partie.equipe) if (!u.recrue) mettre(u.c, jours);
  return [...l.entries()].map(([cle, jours]) => ({ cle, jours }));
}

/**
 * L'expérience que rapporte une descente, carte par carte. Remonter la garde
 * entière ; tomber n'en laisse que la moitié. La recrue n'est pas à nous.
 */
export function gainsXP(partie, iss) {
  // Au donjon infini, on ne remonte pas : la chute est la fin normale, elle ne coûte rien.
  const f = (iss === "defaite" && partie.mode !== "infini" ? 0.5 : 1) * (partie.xpMode ?? 1) * (1 + (modsEquipe(partie).xp || 0));
  const l = partie.equipe.filter((u) => !u.recrue).map((u) => ({ c: u.c, xp: Math.round((u.xp || 0) * f) }));
  // La source de pouvoir apprend avec l'équipe : la moyenne de ce qu'ont gagné les compagnons.
  if (partie.source?.c && l.length) l.push({ c: partie.source.c, xp: Math.round(l.reduce((s, x) => s + x.xp, 0) / l.length) });
  for (const c of partie.perdus || []) l.push({ c, xp: Math.round(((partie.xpPerdus || {})[`${c.ext}:${c.id}`] || 0) * (partie.xpMode ?? 1)) });
  return l.filter((x) => x.xp > 0);
}

/** Ce qu'une fiche d'unité doit dire : rôle ou trait, compétences, et son état. */
export function fiche(partie, u) {
  const R = ROLES[u.role];
  const lignes = [];
  const pourEux = (t) => (u.camp === "e" ? t.replace("un allié", "un des siens").replace("toute l'équipe", "tous les siens").replace("tous les adversaires", "toute votre équipe") : t);
  if (u.boss) lignes.push({ t: "Gardien", d: "Balaie toute l'équipe tous les trois tours (×0,6)." });
  if (u.elite) lignes.push({ t: "Élite", d: "PV et ATQ renforcés." });
  if (R) {
    lignes.push({ t: R.nom, d: R.passif || "" });
    const g = COMPETENCES[gesteDe(u)], t = COMPETENCES[techDe(u)];
    if (g.id !== "attaque" || u.etoiles?.geste) lignes.push({ t: `${g.nom}${u.etoiles?.geste ? " ★" : ""}`, d: pourEux(u.etoiles?.geste ? g.etoile : g.aide) });
    lignes.push({ t: `${t.nom}${u.etoiles?.tech ? " ★" : ""}`, d: `${pourEux(u.etoiles?.tech ? t.etoile : t.aide)}${u.cd > 0 ? ` — prêt dans ${u.cd} tour${u.cd > 1 ? "s" : ""}` : " — prêt"}` });
  } else if (TRAITS[u.role]) lignes.push({ t: TRAITS[u.role].nom, d: TRAITS[u.role].aide });
  if (u.provoque) lignes.push({ t: "Provocation", d: `Attire tous les coups, armure +${u.armureProvoc || 2}.` });
  if (u.galva > 0) lignes.push({ t: "Galvanisé", d: `+${u.galvaVal || 3} ATQ.` });
  if (u.rempart > 0) lignes.push({ t: "Rempart", d: `Armure +${u.rempartVal || 3}.` });
  if (u.parade > 0) lignes.push({ t: "Bouclier levé", d: `Armure +${u.parade}.` });
  if (u.riposte > 0) lignes.push({ t: "Garde haute", d: "Rend une partie des coups reçus." });
  if (u.voile) lignes.push({ t: "Voilé", d: "Ne peut pas être touché." });
  if (u.marque > 0) lignes.push({ t: "Marqué", d: `+${Math.round((u.marqueVal || 0.5) * 100)} % de dégâts subis.` });
  if (u.saigne > 0) lignes.push({ t: "Saigne", d: `−${u.saigneD} à chacun de ses tours, encore ${u.saigne}.` });
  if (u.etourdi > 0) lignes.push({ t: "Piégé", d: "Perd son prochain tour." });
  return { nom: u.nomAffiche || u.c.nom, stats: `${u.camp === "a" ? `Niveau ${u.niveau || 1} · ` : ""}${u.pv} / ${u.pvMax} PV · ATQ ${atqDe(partie, u)} · INI ${u.ini}`, lignes };
}
/** Ce que l'on rapporte : tout le sac en remontant, un quart si l'équipe tombe. */
export const rapporte = (partie, iss) => (iss === "defaite" && partie.mode !== "infini" ? Math.round(partie.sac * 0.25) : partie.sac);

/**
 * Le donjon du jour impose sa composition et sa source : quatre rôles (deux
 * fois le même au plus) et un lieu, tirés chaque jour parmi les cartes que
 * le joueur peut emmener. La graine est la même pour tous ; le résultat
 * dépend de la collection. Rend null s'il n'y a pas quatre compagnons.
 */
export function compositionDuJour(jour, allies, lieux = []) {
  if (allies.length < 4) return null;
  const r = tirage(hacher(`composition-${jour}`));
  const dispo = {};
  for (const c of allies) { const k = roleCarte(c); dispo[k] = (dispo[k] || 0) + 1; }
  const ordre = Object.keys(ROLES).filter((k) => dispo[k]);
  const roles = {};
  for (let i = 0; i < 4; i++) {
    const libres = ordre.filter((k) => (roles[k] || 0) < dispo[k]);
    const varies = libres.filter((k) => (roles[k] || 0) < 2);
    const k = choisir(r, varies.length ? varies : libres);
    roles[k] = (roles[k] || 0) + 1;
  }
  const tri = [...lieux].sort((a, b) => `${a.ext}:${a.id}`.localeCompare(`${b.ext}:${b.id}`));
  const lieu = tri.length ? tri[Math.floor(r() * tri.length)] : null;
  return { roles, lieu: lieu ? `${lieu.ext}:${lieu.id}` : null };
}

/**
 * L'apprentissage : un Donjon adouci pour qui commence sa collection. Les
 * adversaires sont affaiblis, le butin aussi, et les deux remontent en ligne
 * droite jusqu'au jeu normal au `jusqua`-ième booster ouvert. `cfg` vient de
 * `DONJON.apprentissage` (src/config/tiers.js).
 */
export function apprentissage(boosters, cfg) {
  if (!cfg || !cfg.jusqua) return { difficulte: 1, gain: 1, avance: 1, restant: 0 };
  const a = Math.max(0, Math.min(1, boosters / cfg.jusqua));
  const lisse = (x0) => Math.round((x0 + (1 - x0) * a) * 100) / 100;
  return { difficulte: lisse(cfg.difficulte), gain: lisse(cfg.gain), avance: a, restant: Math.max(0, Math.ceil(cfg.jusqua - boosters)) };
}
