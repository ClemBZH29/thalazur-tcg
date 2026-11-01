/**
 * Le moteur des simulations du Donjon : une descente au donjon infini,
 * jouée avec les vraies règles (src/donjon/regles.js), rien n'est recopié.
 *
 * Tout ce qui décrit une équipe est sérialisable (`cfg`), pour partir dans
 * un worker : quatre rôles, une source de pouvoir (clé « ext:id » d'un
 * lieu, ou null), une stratégie du pilote automatique, et pour chaque carte
 * le geste et la technique choisis. Le profil (palier, niveau, rangs,
 * étoiles) est commun aux quatre cartes : on compare des décisions, pas des
 * collections.
 *
 * Les cartes sont fictives : un palier et un archétype qui donne le rôle
 * voulu. Un rôle n'existe pas à tous les paliers dans La Troupe ; ici, il
 * existe partout, pour que la comparaison des rôles soit à armes égales.
 */
import { readFileSync } from "node:fs";
import extension from "../../src/extensions/troupe-valeran/extension.js";
import * as R from "../../src/donjon/regles.js";
import { permise } from "../../src/donjon/fiches.js";
import { DONJON, poDuButin } from "../../src/config/tiers.js";
import { choixTactique, rencontreTactique, salleTactique } from "./tactique.mjs";

const roster = JSON.parse(readFileSync(new URL("../../src/extensions/troupe-valeran/roster.json", import.meta.url), "utf8"));
export const POOLS = R.cartesDonjon([{ ...extension, roster }]);
export const ROLES = Object.keys(R.ROLES);
export const STRATEGIES = ["concentrer", "menace", "prudence"];
export const cleCarte = (c) => `${c.ext}:${c.id}`;
export const LIEUX = Object.fromEntries(POOLS.lieux.map((l) => [cleCarte(l), l]));
/** Les vraies cartes alliées de La Troupe, par clé « ext:id ». */
export const ALLIES = Object.fromEntries(POOLS.allies.map((c) => [cleCarte(c), c]));

/** Un archétype du roster par rôle : `roleDe` le reconnaît (vérifié au chargement). */
const ARCHETYPE = { garde: "Paladin", frappeur: "Guerrier", tireur: "Archer", soigneur: "Clerc", mage: "Sorcier",
  meneur: "Barde", debrouillard: "Voleur", artificier: "Forgeron", intendant: "Cuisinier" };
for (const r of ROLES) if (R.roleDe(ARCHETYPE[r]) !== r) throw new Error(`L'archétype de simulation du rôle ${r} ne donne plus ce rôle : revoir ARCHETYPE.`);

/** La carte fictive n° `i` de l'équipe : identifiants distincts, pour que l'expérience et les fiches ne se mélangent pas. */
export const carte = (role, palier, i) => ({ id: `sim-${i}-${role}`, num: i, nom: `${R.ROLES[role].nom} ${i + 1}`, type: "pnj",
  tier: palier, rep1: ARCHETYPE[role], rep3: "Troupe", ext: "simulation" });

/** Les compétences qu'un rôle peut prendre sur un emplacement (« geste » ou « tech »). */
export function competencesPermises(role, place, palier = "rare") {
  return competencesCarte(carte(role, palier, 0), place);
}
/** Les compétences qu'une carte (vraie ou fictive) peut prendre sur un emplacement. */
export function competencesCarte(c, place) {
  return Object.values(R.COMPETENCES).filter((k) => k.place === place && permise(c, k.id)).map((k) => k.id);
}

/**
 * Les profils de collection. `etoiles` : les lignes étoilées sur chaque
 * carte ; `rangs` : rangs d'ATQ et d'INI achetés (0 à 3).
 */
export const PROFILS = {
  debutant: { nom: "Débutant", palier: "commun", niveau: 1, niveauSource: 1, rangs: 0, etoiles: [], etoileSource: false },
  moyen: { nom: "Moyen", palier: "rare", niveau: 50, niveauSource: 50, rangs: 0, etoiles: [], etoileSource: false },
  fort: { nom: "Fort", palier: "legendaire", niveau: 100, niveauSource: 100, rangs: 3, etoiles: [], etoileSource: true },
  max: { nom: "Maximum", palier: "legendaire", niveau: 100, niveauSource: 100, rangs: 3, etoiles: ["atq", "ini", "geste", "tech"], etoileSource: true },
};

/**
 * Les choix des rencontres. « premier » : le premier choix possible, comme
 * scripts/audit-donjon.mjs (un plancher). « malin » : ce que ferait un
 * joueur attentif, sans tricher (il ne connaît pas l'issue du tirage).
 */
const santé = (p) => { const v = R.vivants(p.equipe); return v.reduce((s, u) => s + u.pv / u.pvMax, 0) / Math.max(1, v.length); };
const plusFaible = (p) => Math.min(...R.vivants(p.equipe).map((u) => u.pv));
const MALIN = {
  mirko: (p) => (santé(p) < 0.7 ? 0 : 1),
  coffre: (p) => (plusFaible(p) > 3 * p.etage + 4 ? 0 : 1),
  autel: (p) => (plusFaible(p) > 8 && santé(p) > 0.6 ? 0 : 1),
  blesse: () => 0,
  source: (p) => (santé(p) < 0.9 ? 0 : 1),
  echo: (p) => (plusFaible(p) > 4 * p.etage + 4 ? 0 : 1),
};
function choisirRencontre(mode, ev, choix, partie) {
  if (mode === "malin" && MALIN[ev.id]) {
    const c = choix[MALIN[ev.id](partie)];
    if (c && c.ok !== false) return c;
  }
  return choix.find((c) => c.ok !== false);
}

/** La fiche d'une carte : le profil (rangs, étoiles) et les compétences choisies. */
function ficheDe(profil, choix = {}) {
  const f = { atq: profil.rangs || 0, ini: profil.rangs || 0, etoiles: Object.fromEntries((profil.etoiles || []).map((l) => [l, true])) };
  if (choix.geste) f.geste = choix.geste;
  if (choix.tech) f.tech = choix.tech;
  return f;
}

/**
 * Les choix forcés (`cfg.regles`), pour mesurer ce que vaut une décision en
 * la prenant toujours, ou jamais, toutes choses égales par ailleurs :
 *
 * - `rencontres.<id>` (mirko, coffre, autel, blesse, source, echo) : le
 *   premier choix (acheter, ouvrir, offrir son sang, emmener, boire, suivre)
 *   « oui », « non », `{ jusqua: n }` (oui jusqu'à l'étage n), `{ des: n }`
 *   (oui à partir de l'étage n) ou `{ max: n }` (oui les n premières fois) ;
 * - `chemin` : « hasard », ou un genre de salle à prendre dès qu'il s'offre
 *   (« elite », « repos », « evenement », « tresor », « combat »), ou
 *   « sansElite » (éviter les élites tant qu'on peut) ;
 * - `sansReliques` : aucune relique dans le donjon, ni pour l'équipe ni pour
 *   les adversaires qui en gardent ;
 * - `reliqueDepart` : la clé d'un artéfact que l'équipe porte dès l'entrée.
 *
 * Ce qui n'est pas forcé suit la tactique (`cfg.tactique`) ou, à défaut,
 * les règles du pilote automatique.
 */
const POOLS_SANS_RELIQUES = { ...POOLS, artefacts: [] };
export const ARTEFACTS = Object.fromEntries(POOLS.artefacts.map((a) => [cleCarte(a), a]));
function regleRencontre(regle, etage, prises) {
  if (regle == null) return null;
  if (regle === "oui" || regle === "non") return regle === "oui";
  if (regle.jusqua != null) return etage <= regle.jusqua;
  if (regle.des != null) return etage >= regle.des;
  if (regle.max != null) return prises < regle.max;
  return null;
}
function salleForcee(regle, partie, ouverts, defaut) {
  if (!regle || ouverts.length === 1) return defaut();
  if (regle === "hasard") return null;
  const genre = (o) => partie.plan.noeuds[o].genre;
  if (regle === "sansElite") {
    const sures = ouverts.filter((o) => genre(o) !== "elite");
    const d = defaut();
    return sures.includes(d) || !sures.length ? d : sures[0];
  }
  return ouverts.find((o) => genre(o) === regle) ?? defaut();
}

/**
 * Une descente au donjon infini, jusqu'à la chute. `graine` fixe tout le
 * hasard : deux équipes jouées sur la même graine voient la même suite de
 * tirages tant que leurs choix ne la font pas diverger (nombres aléatoires
 * communs : les écarts entre équipes en sont plus nets).
 *
 * Avec `opts.journal`, la descente rend aussi ce qui s'y est passé : reliques
 * ramassées, autels, recrue, pièges subis, salles traversées, et où l'équipe
 * est tombée.
 */
export function descente(graine, cfg, profil, opts = {}) {
  const r = R.tirage(graine * 7919 + 17);
  const eq = equipeDe(cfg, profil);
  const T = cfg.tactique || null;
  const RG = cfg.regles || {};
  const pools = RG.sansReliques ? POOLS_SANS_RELIQUES : POOLS;
  const niveaux = Object.fromEntries(eq.map((c) => [cleCarte(c), profil.niveau]));
  const fiches = Object.fromEntries(eq.map((c, i) => [cleCarte(c), ficheDe(profil, cfg.fiches?.[i])]));
  const lieu = cfg.source ? LIEUX[cfg.source] : null;
  const partie = R.creerPartie({ equipe: eq, source: lieu ? { c: lieu, niveau: profil.niveauSource, etoile: profil.etoileSource } : null,
    graine: graine * 104729, jour: "2026-10-31", pools, niveaux, fiches, mode: "infini", gainMode: 1, xpMode: DONJON.modes.infini.xp });
  if (RG.reliqueDepart && ARTEFACTS[RG.reliqueDepart]) R.prendreRelique(partie, ARTEFACTS[RG.reliqueDepart]);
  const j = { salles: {}, rencontres: {}, pris: {}, pieges: { coffre: 0, echo: 0 }, recrue: 0, chute: null };
  let fin = "defaite", genre = null;
  boucle: for (let pas = 0; pas < 50000; pas++) {
    const o = R.ouverts(partie.plan);
    const parDefaut = () => (T ? salleTactique(T, partie, o) : o[Math.floor(r() * o.length)]);
    const forcee = salleForcee(RG.chemin, partie, o, parDefaut);
    const n = R.entrer(partie, forcee ?? o[Math.floor(r() * o.length)]);
    genre = n.genre;
    j.salles[genre] = (j.salles[genre] || 0) + 1;
    if (genre === "tresor") R.tresor(partie, r, pools.artefacts);
    if (genre === "repos") R.repos(partie);
    if (genre === "evenement") {
      const ev = R.RENCONTRES[Math.floor(r() * R.RENCONTRES.length)];
      const choix = ev.choix(partie, { r, pools });
      j.rencontres[ev.id] = (j.rencontres[ev.id] || 0) + 1;
      const force = regleRencontre(RG.rencontres?.[ev.id], partie.etage, j.pris[ev.id] || 0);
      let c = force == null ? (T ? rencontreTactique(T, ev, choix, partie) : choisirRencontre(opts.rencontres || "malin", ev, choix, partie)) : choix[force ? 0 : 1];
      if (!c || c.ok === false) c = choix.find((x) => x.ok !== false);
      if (c === choix[0]) j.pris[ev.id] = (j.pris[ev.id] || 0) + 1;
      const recrues = partie.equipe.filter((u) => u.recrue).length;
      const texte = c.f();
      if (ev.id === "coffre" && /aiguille/i.test(texte)) j.pieges.coffre++;
      if (ev.id === "echo" && /piège/i.test(texte)) j.pieges.echo++;
      j.recrue += partie.equipe.filter((u) => u.recrue).length - recrues;
      if (!R.vivants(partie.equipe).length) break;
    }
    if (genre === "combat" || genre === "elite" || genre === "boss") {
      const C = R.demarrerCombat(partie, genre, r, pools);
      let f = null;
      for (let t = 0; t < 1500 && !f; t++) {
        const u = R.prochain(partie, C);
        if (!u) { f = R.issue(partie, C); break; }
        const { geste, cible } = u.camp === "e" ? R.choixIA(partie, C, u, r) : T ? choixTactique(T, partie, C, u) : R.choixAuto(partie, C, u, cfg.strategie || "prudence");
        R.resoudre(partie, C, u, geste, cible, r);
        f = R.issue(partie, C);
      }
      if (f !== "victoire") { fin = f ? "defaite" : "blocage"; break boucle; }
      R.victoire(partie, C, r, pools.artefacts);
      if (genre === "boss") R.descendre(partie, pools);
    }
  }
  const butin = R.rapporte(partie, "defaite");
  const d = { gardiens: partie.stats.gardiens, butin, po: poDuButin(butin, "infini") - DONJON.modes.infini.entree, blocage: fin === "blocage" };
  if (opts.journal) {
    j.chute = { genre, etage: partie.etage };
    j.reliques = partie.reliques.map((a) => cleCarte(a));
    j.autels = partie.benediction;
    d.journal = j;
  }
  return d;
}

/**
 * L'équipe d'une configuration : quatre vraies cartes (`cfg.cartes`, clés
 * « ext:id ») ou quatre cartes fictives d'un rôle (`cfg.roles`).
 */
export const equipeDe = (cfg, profil) => (cfg.cartes ? cfg.cartes.map((k) => ALLIES[k]) : cfg.roles.map((role, i) => carte(role, profil.palier, i)));

const PALIER_COURT = { commun: "C", peucommun: "PC", rare: "R", legendaire: "L" };
/** Une étiquette lisible d'une équipe. */
export function etiquette(cfg) {
  const eq = equipeDe(cfg, { palier: "rare" });
  return eq.map((c, i) => {
    const f = cfg.fiches?.[i] || {};
    const k = [f.geste, f.tech].filter((id) => id && R.COMPETENCES[id]).map((id) => R.COMPETENCES[id].nom);
    const role = R.ROLES[R.roleCarte(c)].nom;
    const nom = cfg.cartes ? `${c.nom} (${role}, ${PALIER_COURT[c.tier]})` : role;
    return `${nom}${k.length ? ` [${k.join(", ")}]` : ""}`;
  }).join(" · ");
}
export const nomSource = (cle) => (cle ? `${LIEUX[cle].nom} (${PALIER_COURT[LIEUX[cle].tier]})` : "Aucune");
export const nomStrategie = (s) => R.STRATEGIES[s]?.nom || s;
