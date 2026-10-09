/**
 * Les Expéditions : règles pures.
 *
 * Rien ici ne touche au navigateur ni à React : tout se teste à nu
 * (tests/expeditions.test.js). L'état du jeu entre et sort entier, comme
 * pour `crediterXP`.
 *
 * Une route : { id, lieu, cartes, heures, depart, fin, est, trouvees }.
 * `lieu`, `cartes` et `trouvees` sont des clés « extension:carte », celles
 * de `etat.xp`. Le butin est estimé et tiré au départ, avec une graine : un
 * rechargement ne change rien à ce qui reviendra.
 */
import { EXPEDITION } from "../config/expeditions.js";
import { cleXP, crediterXP, niveauDe } from "../donjon/experience.js";
import { hacher, tirage } from "../donjon/regles.js";

export const H = 3600e3;

/** Le jour local, AAAA-MM-JJ : le plafond d'or se remet à zéro à minuit. */
export const jourDe = (t) => new Date(t).toLocaleDateString("sv");

/** « Plans extérieurs » et « Plan Extérieur » désignent le même endroit. */
const normal = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().split(/\s+/).map((m) => m.replace(/s$/, "")).join(" ").trim();

/** Une carte est affine à un Lieu quand sa faction est la province du Lieu. */
export const affine = (c, lieu) => !!c.rep3 && normal(c.rep3) === normal(lieu.rep1);

export const etatExpeditions = (etat) => ({ routes: [], orJour: null, seq: 1, ...(etat.expeditions || {}) });

export const niveau = (etat, c) => niveauDe(etat.xp?.[cleXP(c)]?.xp || 0);

export const capacite = (etat, lieu) =>
  (EXPEDITION.capacite[lieu.tier] || EXPEDITION.capacite.commun)
  + Math.min(EXPEDITION.placesBonusMax, Math.floor(niveau(etat, lieu) / EXPEDITION.placeTousLesNiveaux));

export const multLieu = (etat, lieu) =>
  (EXPEDITION.lieu[lieu.tier] || 1) * (1 + EXPEDITION.bonusNiveauLieu * (niveau(etat, lieu) - 1));

export const puissance = (etat, c, lieu) =>
  (EXPEDITION.puissance[c.tier] || 1) * (1 + niveau(etat, c) / 100) * (lieu && affine(c, lieu) ? EXPEDITION.affinite : 1);

/** Ce qu'une équipe rapportera. `null` si rien n'est choisi. */
export function estimer(etat, lieu, cartes, heures) {
  const R = EXPEDITION.durees[heures];
  if (!lieu || !cartes.length || !R) return null;
  const P = cartes.reduce((s, c) => s + puissance(etat, c, lieu), 0);
  const LM = multLieu(etat, lieu);
  const effort = P * heures * R * LM;
  const remplissage = Math.min(1, cartes.length / capacite(etat, lieu));
  return {
    effort,
    or: Math.round(effort * EXPEDITION.or.parEffort),
    vestiges: Math.round(effort * EXPEDITION.vestiges.parEffort),
    xpCarte: Math.round(EXPEDITION.xpCarte.parHeure * heures * R * LM),
    xpLieu: Math.round(EXPEDITION.xpLieu.parHeure * heures * (0.5 + 0.5 * remplissage)),
    trouvailles: Math.floor(heures / EXPEDITION.trouvailles.toutesLes),
  };
}

/** Clés de toutes les cartes occupées par une route. */
export const enRoute = (etat) => new Set(etatExpeditions(etat).routes.flatMap((r) => [...r.cartes, r.lieu]));

/**
 * Cartes engagées dans la descente en cours du Donjon : l'équipe, la source
 * de pouvoir et les compagnons laissés derrière, qui tous gagnent de
 * l'expérience (ou un repos) à la fin. La recrue ramassée en route n'en
 * gagne pas : la carte du joueur, si elle l'a, reste libre.
 */
export function auDonjon(etat) {
  const p = etat.donjon?.partie;
  if (!p) return new Set();
  return new Set([
    ...(p.equipe || []).filter((u) => !u.recrue).map((u) => u.c),
    ...(p.source?.c ? [p.source.c] : []),
    ...(p.perdus || []),
  ].map(cleXP));
}

/** Pourquoi une carte ne peut pas partir, ou null. */
export function empechement(etat, c, maintenant = Date.now()) {
  const cle = cleXP(c);
  if (enRoute(etat).has(cle)) return "expedition";
  if (auDonjon(etat).has(cle)) return "donjon";
  const fin = etat.donjon?.convalescence?.[cle];
  if (fin && fin > jourDe(maintenant)) return "repos";
  return null;
}

/**
 * Prépare une route. Rend `{ etat, route }`, ou `{ erreur }` si le départ est
 * impossible : trop d'expéditions, Lieu déjà parti, carte occupée, équipe trop
 * grande. `pool` : les cartes où puiser les trouvailles.
 */
export function partir(etat, { lieu, cartes, heures, pool = [], maintenant = Date.now() }) {
  const ex = etatExpeditions(etat);
  if (ex.routes.length >= EXPEDITION.simultanees) return { erreur: "pleines" };
  if (!EXPEDITION.durees[heures]) return { erreur: "duree" };
  if (!cartes.length) return { erreur: "vide" };
  if (ex.routes.some((r) => r.lieu === cleXP(lieu))) return { erreur: "lieu" };
  // Le Lieu aussi peut être pris ailleurs : source de la descente en cours.
  if (empechement(etat, lieu, maintenant)) return { erreur: "lieu" };
  if (cartes.length > capacite(etat, lieu)) return { erreur: "capacite" };
  if (new Set(cartes.map(cleXP)).size !== cartes.length) return { erreur: "doublon" };
  if (cartes.some((c) => empechement(etat, c, maintenant))) return { erreur: "occupee" };

  const est = estimer(etat, lieu, cartes, heures);
  const r = tirage(hacher(`${cleXP(lieu)}|${maintenant}|${cartes.map(cleXP).join(",")}`));
  const poids = EXPEDITION.trouvailles.poids;
  const source = pool.filter((c) => poids[c.tier]);
  const trouvees = [];
  for (let i = 0; i < est.trouvailles && source.length; i++) {
    const tot = source.reduce((s, c) => s + poids[c.tier], 0);
    let x = r() * tot;
    const c = source.find((k) => (x -= poids[k.tier]) <= 0) || source[source.length - 1];
    trouvees.push(cleXP(c));
  }
  const route = {
    id: ex.seq, lieu: cleXP(lieu), cartes: cartes.map(cleXP), heures,
    depart: maintenant, fin: maintenant + heures * H, est, trouvees,
  };
  return { route, etat: { ...etat, expeditions: { ...ex, seq: ex.seq + 1, routes: [...ex.routes, route] } } };
}

/**
 * Rappel : les cartes rentrent, sans rien rapporter. Refusé (état rendu tel
 * quel) pour une route déjà rentrée : la page ne relit l'heure que toutes les
 * 20 s, et un « Rappeler » cliqué juste après la fin effaçait tout le butin.
 * Une route rentrée passe par l'accueil (`crediterRoute`).
 */
export function rappeler(etat, id, maintenant = Date.now()) {
  const ex = etatExpeditions(etat);
  const route = ex.routes.find((r) => r.id === id);
  if (!route || route.fin <= maintenant) return etat;
  return { ...etat, expeditions: { ...ex, routes: ex.routes.filter((r) => r.id !== id) } };
}

export const rentrees = (etat, maintenant = Date.now()) =>
  etatExpeditions(etat).routes.filter((r) => r.fin <= maintenant);

/**
 * Crédite une route rentrée. `index` : clé → carte. Rend le nouvel état et le
 * bilan de la fenêtre de retour. Une route inconnue (déjà créditée ailleurs)
 * laisse l'état tel quel et rend un bilan nul.
 */
export function crediterRoute(etat, id, index, maintenant = Date.now()) {
  const ex = etatExpeditions(etat);
  const route = ex.routes.find((r) => r.id === id);
  if (!route || route.fin > maintenant) return { etat, bilan: null };
  const lieu = index[route.lieu];
  const cartes = route.cartes.map((k) => index[k]).filter(Boolean);

  // L'or, dans la limite du jour.
  const jour = jourDe(maintenant);
  const dejaJour = ex.orJour?.jour === jour ? ex.orJour.credite : 0;
  const or = Math.max(0, Math.min(route.est.or, EXPEDITION.or.plafondJour - dejaJour));

  // L'expérience : les compagnons et le Lieu, par la même porte que le Donjon.
  const gains = [...cartes.map((c) => ({ c, xp: route.est.xpCarte })), ...(lieu ? [{ c: lieu, xp: route.est.xpLieu }] : [])];
  const { etat: e1, bilan: bilanXP, po: poXP } = crediterXP(etat, gains);

  // Les trouvailles.
  const collections = { ...e1.collections };
  const trouvees = [];
  for (const k of route.trouvees) {
    const c = index[k];
    if (!c) continue;
    const coll = { ...(collections[c.ext] || {}) };
    const a = coll[c.id] || { normale: 0, rainbow: 0 };
    const { ext, ...carte } = c;
    coll[c.id] = { ...a, normale: (a.normale || 0) + 1, carte: a.carte || carte };
    collections[c.ext] = coll;
    trouvees.push({ c, nouvelle: !(a.normale > 0) });
  }

  const bourse = { ...e1.bourse, po: e1.bourse.po + or + poXP, gagne: (e1.bourse.gagne || 0) + or + poXP };
  const reliquaire = { vestiges: 0, ...(e1.reliquaire || {}) };
  const ligneLieu = lieu ? bilanXP.find((b) => b.c === lieu) : null;
  const lignesCartes = bilanXP.filter((b) => b.c !== lieu);
  const e2 = {
    ...e1,
    collections,
    bourse,
    reliquaire: { ...reliquaire, vestiges: reliquaire.vestiges + route.est.vestiges },
    stats: {
      ...(e1.stats || {}),
      expeditions: ((e1.stats || {}).expeditions || 0) + 1,
      lieuxRainbow: ((e1.stats || {}).lieuxRainbow || 0) + (ligneLieu?.irisee ? 1 : 0),
    },
    expeditions: {
      ...ex,
      orJour: { jour, credite: dejaJour + or },
      routes: ex.routes.filter((r) => r.id !== id),
    },
  };
  return {
    etat: e2,
    bilan: {
      route, lieu, or, orPlafonne: or < route.est.or, vestiges: route.est.vestiges, poXP,
      xpCarte: route.est.xpCarte, montees: lignesCartes.filter((b) => b.apres > b.avant).length,
      rainbows: lignesCartes.filter((b) => b.irisee).map((b) => b.c),
      lieuNiveau: ligneLieu ? [ligneLieu.avant, ligneLieu.apres] : null,
      lieuRainbow: !!ligneLieu?.irisee, lieuPO: ligneLieu?.po || 0, lieuSachet: !!ligneLieu?.sachet,
      xpLieu: route.est.xpLieu, trouvees,
    },
  };
}
