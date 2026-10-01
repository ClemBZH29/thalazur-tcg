/**
 * Les pouvoirs du Donjon : la source de pouvoir (un Lieu choisi au départ)
 * et les artéfacts (trouvés en route, ou portés par les adversaires).
 *
 * Tout passe par des **mécaniques** (MECANIQUES) : un bonus d'ATQ, une
 * chance de critique, un vol de vie… Chaque lieu en porte une à lui
 * (deux pour un rare, trois pour un légendaire) : aucun lieu n'a le même
 * effet qu'un autre. Chaque artéfact en porte une aussi, en plus du bonus
 * de PV et d'ATQ qu'il donnait déjà (BONUS_ARTEFACT, regles.js).
 *
 * La force d'un effet :
 *   valeur = base de la mécanique × palier × niveau × étoile
 * - palier : commune 1, peu commune 1,5, rare 2, légendaire 2,5 ; un effet
 *   double ou triple partage sa force (× 0,7 chacun) ;
 * - niveau de la carte (son expérience) : ×1 au niveau 1, ×2 au niveau 100 ;
 * - étoile (une rainbow en trop du lieu, voir fiches.js) : ×1,5.
 * Les artéfacts n'ont ni niveau ni étoile : palier seul.
 *
 * Fonctions pures, sans React : regles.js les applique en combat.
 */

export const PALIER_FORCE = { commun: 1, peucommun: 1.5, rare: 2, legendaire: 2.5 };
export const PARTAGE = 0.7;
export const ETOILE_SOURCE = 1.5;

/**
 * Les mécaniques. `base` : la valeur d'une commune au niveau 1 ; `entier` :
 * arrondie à l'unité (au moins 1) ; sinon une fraction (0,06 = 6 %).
 * `plafond` : au-delà, plus rien — sur la somme de tous les effets du camp.
 * Sans plafond, le donjon infini empilait des centaines de reliques et une
 * armure qui rendait l'équipe intouchable (étage 376 mesuré). `pour` : l'équipe seulement (« a ») — un
 * adversaire qui porte l'artéfact n'en tire rien (il ne ramasse pas de butin).
 * `texte(v)` : la phrase de l'effet, pour une valeur donnée.
 */
const pct = (v) => `${Math.round(v * 100)} %`;
export const MECANIQUES = {
  atq: { nom: "Force", base: 1, entier: true, texte: (v) => `+${v} ATQ` },
  pv: { nom: "Endurance", base: 2, entier: true, texte: (v) => `+${v} PV max` },
  ini: { nom: "Vivacité", base: 1, entier: true, plafond: 6, texte: (v) => `+${v} INI` },
  armure: { nom: "Cuirasse", base: 0.6, entier: true, plafond: 5, texte: (v) => `armure +${v}` },
  crit: { nom: "Coup critique", base: 0.1, plafond: 0.5, texte: (v) => `${pct(v)} de coups critiques (dégâts ×2)` },
  soin: { nom: "Bénédiction", base: 0.25, plafond: 1, texte: (v) => `soins +${pct(v)}` },
  drain: { nom: "Soif de sang", base: 0.06, plafond: 0.25, texte: (v) => `rend ${pct(v)} des dégâts infligés en PV` },
  epines: { nom: "Épines", base: 0.3, plafond: 0.6, texte: (v) => `renvoie ${pct(v)} des dégâts reçus` },
  execution: { nom: "Coup de grâce", base: 1, plafond: 2.5, texte: (v) => `+${pct(v)} de dégâts sur une cible sous 35 % de PV` },
  chasseur: { nom: "Chasse au gros", base: 0.25, plafond: 1, texte: (v) => `+${pct(v)} de dégâts sur les élites et les gardiens` },
  regen: { nom: "Régénération", base: 0.015, plafond: 0.1, texte: (v) => `rend ${pct(v)} des PV max à chaque tour` },
  finCombat: { nom: "Bivouac", base: 0.05, pour: "a", plafond: 0.3, texte: (v) => `rend ${pct(v)} des PV max après chaque victoire` },
  releve: { nom: "Relève", base: 0.07, pour: "a", plafond: 0.4, texte: (v) => `après une victoire, les tombés se relèvent à ${pct(v)} de leurs PV` },
  butin: { nom: "Contrebande", base: 0.1, pour: "a", texte: (v) => `butin +${pct(v)}` },
  xp: { nom: "Apprentissage", base: 0.15, pour: "a", texte: (v) => `expérience +${pct(v)}` },
  ouverture: { nom: "Première salve", base: 2, entier: true, plafond: 10, texte: (v) => `en début de combat, ${v} dégâts à chaque adversaire` },
  rempartDebut: { nom: "Retranchement", base: 1.4, entier: true, plafond: 8, texte: (v) => `armure +${v} au premier tour de chaque combat` },
  brume: { nom: "Brume familière", base: 3, entier: true, pour: "a", plafond: 6, texte: (v) => `la brume se referme ${v} tour${v > 1 ? "s" : ""} plus tard` },
  saignement: { nom: "Lames ébréchées", base: 0.2, plafond: 0.6, texte: (v) => `${pct(v)} de chances de faire saigner (2 tours)` },
  esquive: { nom: "Mirage", base: 0.08, plafond: 0.3, texte: (v) => `${pct(v)} de chances d'esquiver un coup` },
  recharge: { nom: "Second souffle", base: 0.5, plafond: 0.75, texte: (v) => `les recharges baissent ${pct(v)} plus vite` },
  marque: { nom: "Repérage", base: 0.6, plafond: 1, texte: (v) => `le premier coup de chaque combat marque sa cible (+${pct(v)} de dégâts, 2 tours)` },
  vengeance: { nom: "Vengeance", base: 1, entier: true, plafond: 4, texte: (v) => `+${v} ATQ aux autres chaque fois qu'un des leurs tombe` },
  dernierRempart: { nom: "Dernier carré", base: 1.2, plafond: 3, texte: (v) => `le dernier debout frappe +${pct(v)} plus fort` },
  tempo: { nom: "Charge", base: 0.25, plafond: 1.5, texte: (v) => `+${pct(v)} de dégâts au premier tour de chaque combat` },
  fortune: { nom: "Bonne fortune", base: 0.1, pour: "a", plafond: 0.4, texte: (v) => `+${pct(v)} de chances de trouver une relique` },
  soinRepos: { nom: "Bonne table", base: 0.4, pour: "a", texte: (v) => `les repos soignent +${pct(v)}` },
  gardien: { nom: "Défi", base: 0.2, plafond: 0.5, texte: (v) => `−${pct(v)} de dégâts reçus des gardiens` },
  resistance: { nom: "Endurci", base: 0.05, plafond: 0.35, texte: (v) => `−${pct(v)} de dégâts reçus` },
};

/**
 * La source de chaque lieu de La Troupe. Le nom est celui du pouvoir ; la
 * liste, ses mécaniques (une, deux ou trois selon le palier).
 */
export const SOURCES = {
  // Communes : une mécanique chacune, jamais la même.
  "troupe-valeran:008-le-squale-gris": { nom: "Cale de contrebande", m: ["butin"] },
  "troupe-valeran:009-tente-militaire": { nom: "Retranchement", m: ["rempartDebut"] },
  "troupe-valeran:010-restaurant-militaire": { nom: "Gamelle chaude", m: ["finCombat"] },
  "troupe-valeran:011-yourte-de-la-steppe": { nom: "Hospitalité des steppes", m: ["soinRepos"] },
  "troupe-valeran:012-camp-de-mercenaires": { nom: "Lames à louer", m: ["atq"] },
  "troupe-valeran:013-foret-rongee": { nom: "Épines rongées", m: ["saignement"] },
  "troupe-valeran:014-port-du-nord": { nom: "Vent du large", m: ["ini"] },
  "troupe-valeran:015-ruelle-sombre": { nom: "Coup dans le dos", m: ["crit"] },
  "troupe-valeran:016-chez-trabin": { nom: "Tournée de Brazuk", m: ["pv"] },
  "troupe-valeran:017-poste-de-garde-du-desert": { nom: "Boucliers du poste", m: ["armure"] },
  "troupe-valeran:018-collines-des-geants": { nom: "Chasse aux géants", m: ["chasseur"] },
  "troupe-valeran:019-plage-de-l-arrivee": { nom: "Rescapés", m: ["releve"] },
  "troupe-valeran:020-mines-d-azar": { nom: "Filon de reliques", m: ["fortune"] },
  "troupe-valeran:021-arene-de-riddobo": { nom: "Clameur de l'arène", m: ["tempo"] },
  "troupe-valeran:022-fumerie-de-kramach": { nom: "Volutes apaisantes", m: ["regen"] },
  "troupe-valeran:023-desert-des-cauchemars": { nom: "Cauchemars", m: ["ouverture"] },
  "troupe-valeran:024-poste-frontiere-du-col": { nom: "Vétérans du col", m: ["resistance"] },
  "troupe-valeran:025-lac-suurin": { nom: "Eaux du Süurin", m: ["soin"] },
  "troupe-valeran:026-salle-de-jeux-kobold": { nom: "Coups de dés", m: ["xp"] },
  // Peu communes : une mécanique, plus forte.
  "troupe-valeran:117-observatoire-sud": { nom: "Lunettes de l'observatoire", m: ["marque"] },
  "troupe-valeran:118-bastion-de-l-ordre": { nom: "Discipline de Vorsak", m: ["gardien"] },
  "troupe-valeran:119-triple-socle": { nom: "Trois appuis", m: ["recharge"] },
  "troupe-valeran:120-grand-marais": { nom: "Enfants du marais", m: ["brume"] },
  "troupe-valeran:121-foret-de-nakova": { nom: "La forêt est la forêt", m: ["esquive"] },
  "troupe-valeran:122-site-en-construction": { nom: "Fondations", m: ["dernierRempart"] },
  "troupe-valeran:123-cabinet-du-dr-deutenik": { nom: "Transfusion", m: ["drain"] },
  "troupe-valeran:124-azar": { nom: "Sang d'Azar", m: ["vengeance"] },
  "troupe-valeran:125-olionde": { nom: "Ronces d'Olionde", m: ["epines"] },
  "troupe-valeran:126-tente-du-haut-commandement": { nom: "Ordre d'achever", m: ["execution"] },
  // Rares : deux mécaniques.
  "troupe-valeran:180-prison-secrete": { nom: "Interrogatoire", m: ["saignement", "execution"] },
  "troupe-valeran:181-soldestin": { nom: "Soleil de Soldestin", m: ["regen", "soin"] },
  "troupe-valeran:182-eklenor": { nom: "Garde d'Éklénor", m: ["atq", "ini"] },
  "troupe-valeran:183-grandes-ruines-centrales": { nom: "Mémoire des ruines", m: ["fortune", "xp"] },
  "troupe-valeran:184-temple-de-la-paix": { nom: "Paix du temple", m: ["finCombat", "releve"] },
  "troupe-valeran:185-valkarth": { nom: "Remparts de Valkarth", m: ["armure", "epines"] },
  // Légendaires : trois mécaniques.
  "troupe-valeran:212-temple-pantheonique": { nom: "Tous les cultes", m: ["soin", "resistance", "releve"] },
  "troupe-valeran:213-palais-de-dispater": { nom: "Faveur de Dispater", m: ["crit", "drain", "ouverture"] },
};

/**
 * Un lieu d'une autre extension, sans entrée : une mécanique tirée de son
 * identifiant (toujours la même pour la même carte), autant qu'il en faut
 * pour son palier.
 */
const NB_PALIER = { commun: 1, peucommun: 1, rare: 2, legendaire: 3 };
function sourceParDefaut(lieu) {
  const l = Object.keys(MECANIQUES);
  let h = 2166136261;
  for (const ch of `${lieu.ext}:${lieu.id}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const m = [];
  for (let i = 0; m.length < (NB_PALIER[lieu.tier] || 1); i++) {
    const k = l[((h >>> 0) + i * 7) % l.length];
    if (!m.includes(k)) m.push(k);
  }
  return { nom: lieu.nom, m };
}
export const sourceDe = (lieu) => SOURCES[`${lieu.ext}:${lieu.id}`] || sourceParDefaut(lieu);

/** La valeur d'une mécanique pour une force donnée (palier × niveau × étoile). */
export function valeur(mec, force) {
  const M = MECANIQUES[mec];
  if (!M) return 0;
  const v = M.base * force;
  if (M.entier) return Math.min(M.plafond ?? Infinity, Math.max(1, Math.round(v)));
  return Math.min(M.plafond ?? Infinity, Math.round(v * 1000) / 1000);
}

export const forceNiveau = (niveau = 1) => 1 + (Math.max(1, Math.min(100, niveau)) - 1) / 99;

/**
 * Les effets d'une source de pouvoir : [{ mec, val, texte }].
 * `niveau` : celui du lieu ; `etoile` : la ligne « source » étoilée.
 */
export function effetsSource(lieu, niveau = 1, etoile = false) {
  const S = sourceDe(lieu);
  const force = (PALIER_FORCE[lieu.tier] || 1) * (S.m.length > 1 ? PARTAGE : 1) * forceNiveau(niveau) * (etoile ? ETOILE_SOURCE : 1);
  return S.m.map((mec) => { const val = valeur(mec, force); return { mec, val, texte: MECANIQUES[mec].texte(val) }; });
}

/** L'effet d'un artéfact, au-delà de ses PV et de son ATQ. */
export const EFFETS_ARTEFACT = {
  "troupe-valeran:sacoche-de-bille": "butin",
  "troupe-valeran:poignee-de-skarn": "crit",
  "troupe-valeran:brazuk-ai-kazuk": "regen",
  "troupe-valeran:pochon-de-kramach": "esquive",
  "troupe-valeran:tian": "resistance",
  "troupe-valeran:rune-goliath": "armure",
  "troupe-valeran:ecaille-de-ver-pourpre": "epines",
  "troupe-valeran:sceau-de-valeran": "ini",
  "troupe-valeran:carte-de-thalazur": "fortune",
  "troupe-valeran:coutille-de-geant-du-feu": "ouverture",
  "troupe-valeran:medaille-de-dompteur-d-auroch": "chasseur",
  "troupe-valeran:relique-des-profondeurs": "drain",
  "troupe-valeran:marque-de-vorsak": "marque",
  "troupe-valeran:laelsileth": "execution",
  "troupe-valeran:tete-mecanique": "rempartDebut",
  "troupe-valeran:vif-ecaille": "tempo",
  "troupe-valeran:duo-de-larme": ["soin", "releve"],
  "troupe-valeran:hakaihane": ["saignement", "crit"],
};
/** La clé d'un artéfact : son nom sans accent ni numéro, l'identifiant changeant avec la numérotation. */
export const cleArtefact = (a) => `${a.ext}:${String(a.nom || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

export function effetsArtefact(a) {
  if (!a) return [];
  const brut = EFFETS_ARTEFACT[cleArtefact(a)] || sourceParDefaut(a).m;
  const m = Array.isArray(brut) ? brut : [brut];
  const force = (PALIER_FORCE[a.tier] || 1) * (m.length > 1 ? PARTAGE : 1);
  return m.map((mec) => { const val = valeur(mec, force); return { mec, val, texte: MECANIQUES[mec].texte(val) }; });
}

/**
 * La somme des effets d'une liste, pour un camp : { mec: valeur }. Les
 * mécaniques réservées à l'équipe (`pour: "a"`) ne comptent pas chez
 * l'adversaire ; les plafonds s'appliquent à la somme.
 */
export function cumuler(effets, camp = "a") {
  const s = {};
  for (const e of effets) {
    const M = MECANIQUES[e.mec];
    if (!M || (M.pour && M.pour !== camp)) continue;
    s[e.mec] = (s[e.mec] || 0) + e.val;
  }
  for (const [k, v] of Object.entries(s)) if (MECANIQUES[k].plafond != null) s[k] = Math.min(MECANIQUES[k].plafond, v);
  return s;
}

export const texteEffets = (effets) => effets.map((e) => e.texte).join(" ; ");
