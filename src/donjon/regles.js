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

export const ROLES = {
  garde: { nom: "Garde", ini: 2, passif: "Armure 1",
    cap: { id: "provoc", nom: "Provocation", cd: 3, aide: "Attire tous les coups jusqu'à son prochain tour, armure +2" } },
  frappeur: { nom: "Frappeur", ini: 5, passif: "+1 ATQ",
    cap: { id: "lourde", nom: "Frappe lourde", cd: 2, cible: "e", aide: "Dégâts ×1,9 sur une cible" } },
  tireur: { nom: "Tireur", ini: 7, passif: "Agit tôt",
    cap: { id: "vise", nom: "Tir visé", cd: 2, cible: "e", aide: "Dégâts ×1,6, ignore l'armure" } },
  soigneur: { nom: "Soigneur", ini: 3, passif: "",
    cap: { id: "soin", nom: "Soin", cd: 0, cible: "a", aide: "Rend ATQ + 2 PV à un allié" } },
  mage: { nom: "Mage", ini: 4, passif: "",
    cap: { id: "vague", nom: "Vague de brume", cd: 1, aide: "Frappe tous les adversaires" } },
  meneur: { nom: "Meneur", ini: 4, passif: "",
    cap: { id: "galva", nom: "Galvaniser", cd: 2, aide: "+3 ATQ à toute l'équipe pendant trois tours" } },
  debrouillard: { nom: "Débrouillard", ini: 5, passif: "+10 % de butin",
    cap: { id: "coupbas", nom: "Coup bas", cd: 2, cible: "e", aide: "Dégâts ×1,4, et chaparde quelques PO" } },
  artificier: { nom: "Artificier", ini: 3, passif: "",
    cap: { id: "rempart", nom: "Rempart", cd: 2, aide: "Armure +3 à toute l'équipe pendant deux tours" } },
  intendant: { nom: "Intendant", ini: 3, passif: "Repos +25 %",
    cap: { id: "ravit", nom: "Ravitaillement", cd: 2, aide: "Rend ATQ PV à toute l'équipe" } },
};
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

/** Une carte, sans ce dont le donjon n'a pas besoin : c'est ce qui part dans la sauvegarde. */
const legere = (c) => ({ id: c.id, num: c.num, nom: c.nom, type: c.type, tier: c.tier, rep1: c.rep1, race: c.race, rep3: c.rep3, citation: c.citation, ext: c.ext });

/** Un compagnon. `niveau` vient de son expérience (voir experience.js). */
export function allie(partie, c, niveau = 1) {
  const b = BASE[c.tier] || BASE.commun, role = roleDe(c.rep1);
  const bn = bonusNiveau(niveau);
  let pv = b.pv + bn.pv, atq = b.atq + bn.atq;
  if (role === "garde") pv = Math.round(pv * 1.3);
  if (role === "frappeur") atq += 1;
  if (["soigneur", "debrouillard", "mage", "intendant"].includes(role)) pv = Math.round(pv * 0.9);
  return { uid: partie.uid++, c: legere(c), camp: "a", role, pvMax: pv, pv, atq, niveau, xp: 0,
    ini: ROLES[role].ini + (INI_PALIER[c.tier] || 0), ko: false, cd: 0, provoque: 0, galva: 0, rempart: 0 };
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
  const role = hostile ? (c.rep1 === "Animal" ? "rapide" : c.rep1 === "Criminel" ? "fourbe" : "brute") : roleDe(c.rep1);
  let pvMax = Math.round(b.pv * (0.9 + 0.4 * etage) * (role === "brute" || role === "garde" ? 1.2 : 1) * mult * dif);
  if (!hostile && ["soigneur", "mage", "debrouillard", "intendant"].includes(role)) pvMax = Math.round(pvMax * 0.9);
  const atq = Math.max(1, Math.round((Math.round(b.atq * 0.85) + Math.round((etage - 1) * 1.4) + (mult > 1.5 ? 2 : mult > 1 ? 1 : 0) + (role === "frappeur" ? 1 : 0)) * dif));
  const ini = (hostile ? { rapide: 7, fourbe: 5, brute: 3 }[role] : ROLES[role].ini) + (INI_PALIER[c.tier] || 0);
  return { uid: partie.uid++, c: legere(c), camp: "e", role, pvMax, pv: pvMax, atq, ini, ko: false, cd: 0, provoque: 0, galva: 0, rempart: 0 };
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
export const atqDe = (partie, u) =>
  u.atq + (u.camp === "a" ? bonusEquipe(partie).atq : 0) + (u.galva > 0 ? 3 : 0);
const multButin = (partie) => (1 + 0.1 * partie.equipe.filter((u) => u.role === "debrouillard").length) * (partie.gain ?? 1);
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
      : tirer(r, { combat: 44, evenement: 24, elite: n.r >= 2 ? 12 + etage * 2 : 0, repos: n.r >= 2 ? 8 : 0, tresor: 8 });
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

export function creerPartie({ equipe, artefact, graine, jour, pools, niveaux = {}, apprenti = null }) {
  // `apprenti` : l'adoucissement des débuts (voir `apprentissage`). Il est
  // figé pour toute la descente : la difficulté ne bouge pas en chemin.
  const partie = { jour, graine, uid: 1, etage: 1, sac: 0, benediction: 0, reliques: [], perdus: [], xpPerdus: {},
    difficulte: apprenti?.difficulte ?? 1, gain: apprenti?.gain ?? 1, combat: null, rencontre: null,
    artefact: artefact ? legere(artefact) : null, equipe: [], ecran: "carte", noeud: null,
    stats: { salles: 0, combats: 0, ennemis: 0, gardiens: 0 } };
  partie.equipe = equipe.map((c) => allie(partie, c, niveaux[`${c.ext}:${c.id}`] || 1));
  const b = bonusEquipe(partie);
  for (const u of partie.equipe) { u.pvMax += b.pv; u.pv = u.pvMax; }
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
  // Une halte avant de descendre : les tombés se relèvent, les autres soufflent.
  for (const u of partie.equipe) {
    if (u.ko) { u.ko = false; u.pv = Math.ceil(u.pvMax * 0.25); }
    else u.pv = Math.min(u.pvMax, u.pv + Math.ceil(u.pvMax * 0.25));
  }
  partie.etage++;
  partie.plan = genererEtage(partie.etage, tirage(partie.graine + partie.etage), pools.lieux);
  partie.noeud = null;
}

export function trouverRelique(partie, r, artefacts) {
  if (!artefacts.length) return null;
  const a = legere(parmiPalier(r, artefacts, tirer(r, { commun: 45, peucommun: 33, rare: 17, legendaire: 5 })));
  partie.reliques.push(a);
  const b = BONUS_ARTEFACT[a.tier];
  if (b.pv) for (const u of partie.equipe) { u.pvMax += b.pv; if (!u.ko) u.pv += b.pv; }
  return a;
}
export function tresor(partie, r, artefacts) {
  const po = gagner(partie, entre(r, 5, 8) * partie.etage);
  const relique = r() < 0.35 ? trouverRelique(partie, r, artefacts) : null;
  return { titre: "Un trésor", texte: "Sous les pierres, une bourse oubliée.", po, relique };
}
export function repos(partie) {
  let releves = 0;
  // Un intendant dans l'équipe, et le repas est meilleur.
  const bonus = partie.equipe.some((u) => u.role === "intendant" && !u.ko) ? 1.25 : 1;
  for (const u of partie.equipe) {
    if (u.ko) { u.ko = false; u.pv = Math.ceil(u.pvMax * 0.35 * bonus); releves++; }
    else u.pv = Math.min(u.pvMax, u.pv + Math.ceil(u.pvMax * 0.5 * bonus));
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
          const u = allie(p, recrue); u.recrue = true; u.pvMax += bonusEquipe(p).pv; u.pv = Math.ceil(u.pvMax * 0.5); p.equipe.push(u);
          return `${recrue.nom} vous suit, clopin-clopant, et se battra à vos côtés.`; } },
        { lib: "Lui laisser des vivres", f: () => `Il vous remercie et vous glisse quelques pièces. +${gagner(p, 2 * p.etage)} PO.` }];
    } },
  { id: "source", titre: "Une source claire",
    texte: (lieu) => `Au milieu de ${lieu}, une eau qui ne connaît pas la brume.`,
    choix: (p) => [
      { lib: "Boire", f: () => { for (const u of vivants(p.equipe)) u.pv = Math.min(u.pvMax, u.pv + Math.ceil(u.pvMax * 0.4)); return "L'eau est glacée. L'équipe se sent mieux."; } },
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
export function demarrerCombat(partie, genre, r, pools) {
  for (const u of partie.equipe) { u.cd = 0; u.provoque = 0; u.galva = 0; u.rempart = 0; }
  partie.stats.combats++;
  return { genre, ennemis: composer(partie, genre, r, pools), round: 0, ordre: [], idx: -1, actif: null, compteBoss: 0, fini: null };
}
export const unites = (partie, C) => [...partie.equipe, ...C.ennemis];
export const parUid = (partie, C, uid) => unites(partie, C).find((u) => u.uid === uid);

/**
 * Passe la main à l'unité suivante et la rend, ou ouvre un nouveau tour.
 * À initiative égale, l'équipe passe devant : on joue chez soi.
 */
export function prochain(partie, C) {
  for (let garde = 0; garde < 4; garde++) {
    C.idx++;
    while (C.idx < C.ordre.length && parUid(partie, C, C.ordre[C.idx]).ko) C.idx++;
    if (C.idx < C.ordre.length) {
      const u = parUid(partie, C, C.ordre[C.idx]);
      C.actif = u.uid;
      if (u.cd > 0) u.cd--;
      u.provoque = 0;                   // la provocation court jusqu'à son prochain tour
      return u;
    }
    C.round++;
    C.ordre = vivants(unites(partie, C)).sort((a, b) => (b.ini - a.ini) || (a.camp === "a" ? -1 : 1)).map((u) => u.uid);
    C.idx = -1;
    for (const u of unites(partie, C)) { if (u.galva > 0) u.galva--; if (u.rempart > 0) u.rempart--; }
  }
  return null;
}

export function gestes(partie, u) {
  const cap = ROLES[u.role].cap;
  return [
    { id: "attaque", nom: "Attaquer", cible: "e", pret: true, aide: `${atqDe(partie, u)} dégâts sur une cible` },
    { ...cap, pret: u.cd === 0, aide: u.cd > 0 ? `Prêt dans ${u.cd} tour${u.cd > 1 ? "s" : ""}` : cap.aide },
  ];
}

/**
 * La brume qui monte : passé le tour BRUME_TOUR, chaque tour ajoute 20 % aux
 * dégâts des deux camps. Aucun combat ne peut durer toujours — un soigneur
 * resté seul se soignait plus vite qu'on ne le frappait, et on ne fuit pas
 * seul.
 */
export const BRUME_TOUR = 10;
export const brume = (C) => (C && C.round > BRUME_TOUR ? 1 + 0.2 * (C.round - BRUME_TOUR) : 1);

function frapper(partie, att, cible, mult, r, perce = false, C = null) {
  let d = atqDe(partie, att) * mult * brume(C) * (0.85 + r() * 0.3);
  let crit = false;
  if (att.role === "fourbe" && r() < 0.25) { d *= 2; crit = true; }
  const armure = perce ? 0 : (cible.role === "garde" ? 1 : 0) + (cible.provoque ? 2 : 0) + (cible.rempart > 0 ? 3 : 0);
  const reel = Math.max(1, Math.round(d) - armure);
  cible.pv = Math.max(0, cible.pv - reel);
  if (cible.pv === 0) cible.ko = true;
  return { reel, crit };
}

/**
 * Résout un geste. Rend ce que l'interface doit montrer : le mouvement
 * (`anim` : « ruer » vers une cible, ou « pulser » sur place), les effets
 * sur chaque unité touchée, et la ligne du journal.
 */
export function resoudre(partie, C, u, geste, cible, r) {
  const nom = (x) => x.nomAffiche || x.c.nom;
  const effets = [];
  let note = "", anim = "pulser";
  if (["attaque", "lourde", "vise", "coupbas"].includes(geste)) {
    anim = "ruer";
    const mult = { attaque: 1, lourde: 1.9, vise: 1.6, coupbas: 1.4 }[geste];
    const { reel, crit } = frapper(partie, u, cible, mult, r, geste === "vise", C);
    effets.push({ uid: cible.uid, txt: `−${reel}`, cls: crit || geste !== "attaque" ? "crit" : "", anim: "touche" });
    note = geste === "attaque"
      ? `${nom(u)} frappe ${nom(cible)} : −${reel}${crit ? " (critique)" : ""}`
      : `${nom(u)} — ${ROLES[u.role].cap.nom} sur ${nom(cible)} : −${reel}`;
    if (geste === "coupbas" && u.camp === "a") { const po = gagner(partie, entre(r, 1, 3) * partie.etage); effets.push({ uid: u.uid, txt: `+${po} PO`, cls: "info" }); note += `, +${po} PO`; }
    if (cible.ko) note += " — à terre";
  } else if (geste === "soin") {
    const s = Math.min(cible.pvMax - cible.pv, atqDe(partie, u) + 2);
    cible.pv += s;
    effets.push({ uid: cible.uid, txt: `+${s}`, cls: "soin", anim: "soigne" });
    note = `${nom(u)} soigne ${nom(cible)} : +${s}`;
  } else if (geste === "vague") {
    for (const e of vivants(u.camp === "a" ? C.ennemis : partie.equipe)) { const { reel } = frapper(partie, u, e, 1, r, false, C); effets.push({ uid: e.uid, txt: `−${reel}`, anim: "touche" }); }
    note = `${nom(u)} déchaîne la brume sur ${u.camp === "a" ? "tous les adversaires" : "toute l'équipe"}.`;
  } else if (geste === "provoc") {
    u.provoque = 1;
    effets.push({ uid: u.uid, txt: "Provocation", cls: "info" });
    note = `${nom(u)} attire les coups sur lui.`;
  } else if (geste === "galva") {
    // Décompté à chaque nouveau tour : 3, c'est la fin de celui-ci et deux tours pleins.
    for (const a of vivants(u.camp === "a" ? partie.equipe : C.ennemis)) { a.galva = 3; effets.push({ uid: a.uid, txt: "+3 ATQ", cls: "info" }); }
    note = `${nom(u)} galvanise ${u.camp === "a" ? "l'équipe" : "les siens"}.`;
  } else if (geste === "balayage") {
    for (const a of vivants(partie.equipe)) { const { reel } = frapper(partie, u, a, 0.6, r, false, C); effets.push({ uid: a.uid, txt: `−${reel}`, anim: "touche" }); }
    note = `${nom(u)} balaie toute l'équipe.`;
  } else if (geste === "rempart") {
    for (const a of vivants(u.camp === "a" ? partie.equipe : C.ennemis)) { a.rempart = 2; effets.push({ uid: a.uid, txt: "Rempart", cls: "info" }); }
    note = `${nom(u)} dresse un rempart devant ${u.camp === "a" ? "l'équipe" : "les siens"}.`;
  } else if (geste === "ravit") {
    const s = atqDe(partie, u);
    for (const a of vivants(u.camp === "a" ? partie.equipe : C.ennemis)) {
      const g = Math.min(a.pvMax - a.pv, s); a.pv += g;
      if (g) effets.push({ uid: a.uid, txt: `+${g}`, cls: "soin", anim: "soigne" });
    }
    note = `${nom(u)} ravitaille ${u.camp === "a" ? "l'équipe" : "les siens"}.`;
  }
  // Recharge : comptée en tours de l'unité, le sien compris, d'où le +1.
  if (ROLES[u.role] && geste !== "attaque" && geste !== "balayage") { const cd = ROLES[u.role].cap.cd; u.cd = cd ? cd + 1 : 0; }
  return { anim, cible: cible?.uid ?? null, effets, note };
}

export function issue(partie, C) {
  if (!vivants(C.ennemis).length) return "victoire";
  if (!vivants(partie.equipe).length) return "defaite";
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
  if (u.role === "soigneur" && blesse && blesse.pv / blesse.pvMax < (strategie === "prudence" ? 0.6 : 0.45)) return { geste: "soin", cible: blesse };
  if (pret && u.role === "garde" && (strategie === "prudence" || allies.some((a) => a !== u && a.pv / a.pvMax < 0.5))) return { geste: "provoc", cible: null };
  if (pret && u.role === "meneur") return { geste: "galva", cible: null };
  if (pret && u.role === "intendant" && allies.reduce((s, a) => s + (a.pvMax - a.pv), 0) >= allies.length * 3) return { geste: "ravit", cible: null };
  if (pret && u.role === "artificier" && allies.some((a) => !a.rempart)) return { geste: "rempart", cible: null };
  if (pret && u.role === "mage" && ennemis.length >= 2) return { geste: "vague", cible: null };
  if (pret && u.role === "frappeur") return { geste: "lourde", cible };
  if (pret && u.role === "tireur") return { geste: "vise", cible };
  if (pret && u.role === "debrouillard") return { geste: "coupbas", cible };
  return { geste: "attaque", cible };
}

export function victoire(partie, C, r, artefacts) {
  const base = C.ennemis.reduce((s, m) => s + (m.boss ? 12 : m.elite ? 4 : 1.5) * partie.etage + entre(r, 0, 2), 0);
  const po = gagner(partie, Math.round(C.genre === "elite" ? base * 1.5 : base));
  partie.stats.ennemis += C.ennemis.length;
  if (C.genre === "boss") partie.stats.gardiens++;
  // Expérience : un point par adversaire et par étage, trois pour une élite,
  // cinq par étage pour le gardien. Toute l'équipe la reçoit, tombés compris :
  // ils étaient de l'expédition.
  const xp = C.ennemis.reduce((s, m) => s + (m.boss ? 5 : m.elite ? 3 : 1) * partie.etage, 0);
  for (const u of partie.equipe) { u.provoque = 0; u.galva = 0; u.rempart = 0; u.cd = 0; u.xp = (u.xp || 0) + xp; }
  let relique = null;
  if (C.genre === "elite" && r() < 0.55) relique = trouverRelique(partie, r, artefacts);
  if (C.genre === "boss") relique = trouverRelique(partie, r, artefacts);
  return C.genre === "boss"
    ? { titre: `Étage ${partie.etage} nettoyé`, texte: "Le gardien tombe. Plus bas, la brume est plus épaisse — et les bourses plus lourdes.", po, relique }
    : { titre: "Victoire", texte: `${C.ennemis.length} adversaires à terre.`, po, relique };
}
/** On ne fuit pas seul : il faut quelqu'un pour couvrir la retraite. */
export const peutFuir = (partie, C) => C.genre !== "boss" && vivants(partie.equipe).length >= 2;

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
  if (iss === "defaite") for (const u of partie.equipe) if (!u.recrue) mettre(u.c, partie.etage);
  return [...l.entries()].map(([cle, jours]) => ({ cle, jours }));
}

/**
 * L'expérience que rapporte une descente, carte par carte. Remonter la garde
 * entière ; tomber n'en laisse que la moitié. La recrue n'est pas à nous.
 */
export function gainsXP(partie, iss) {
  const f = iss === "defaite" ? 0.5 : 1;
  const l = partie.equipe.filter((u) => !u.recrue).map((u) => ({ c: u.c, xp: Math.round((u.xp || 0) * f) }));
  for (const c of partie.perdus || []) l.push({ c, xp: (partie.xpPerdus || {})[`${c.ext}:${c.id}`] || 0 });
  return l.filter((x) => x.xp > 0);
}

/** Ce qu'une fiche d'unité doit dire : rôle ou trait, capacité, et son état. */
export function fiche(partie, u) {
  const R = ROLES[u.role];
  const lignes = [];
  if (u.boss) lignes.push({ t: "Gardien", d: "Balaie toute l'équipe tous les trois tours (×0,6)." });
  if (u.elite) lignes.push({ t: "Élite", d: "PV et ATQ renforcés." });
  if (R) {
    if (R.passif) lignes.push({ t: R.nom, d: R.passif });
    else lignes.push({ t: R.nom, d: "" });
    lignes.push({ t: R.cap.nom, d: `${u.camp === "e" ? R.cap.aide.replace("un allié", "un des siens").replace("toute l'équipe", "tous les siens").replace("tous les adversaires", "toute votre équipe") : R.cap.aide}${u.cd > 0 ? ` — prêt dans ${u.cd} tour${u.cd > 1 ? "s" : ""}` : " — prêt"}` });
  } else if (TRAITS[u.role]) lignes.push({ t: TRAITS[u.role].nom, d: TRAITS[u.role].aide });
  if (u.provoque) lignes.push({ t: "Provocation", d: "Attire tous les coups, armure +2." });
  if (u.galva > 0) lignes.push({ t: "Galvanisé", d: "+3 ATQ." });
  if (u.rempart > 0) lignes.push({ t: "Rempart", d: "Armure +3." });
  return { nom: u.nomAffiche || u.c.nom, stats: `${u.camp === "a" ? `Niveau ${u.niveau || 1} · ` : ""}${u.pv} / ${u.pvMax} PV · ATQ ${atqDe(partie, u)} · INI ${u.ini}`, lignes };
}
/** Ce que l'on rapporte : tout le sac en remontant, un quart si l'équipe tombe. */
export const rapporte = (partie, iss) => (iss === "defaite" ? Math.round(partie.sac * 0.25) : partie.sac);

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
