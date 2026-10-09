/**
 * Réconciliation de deux copies d'une même partie.
 *
 * Un joueur connecté peut jouer sur deux appareils, et l'un des deux peut
 * avoir joué hors ligne. Quand la copie du compte a bougé depuis la dernière
 * synchronisation de cet appareil, on ne choisit pas « l'une ou l'autre » :
 * on rejoue sur la copie du compte ce que cet appareil a fait depuis.
 *
 * C'est une fusion à trois voies. La **base** est la dernière copie que cet
 * appareil a vue sur le compte ; **ici** est l'état local ; **là** est la copie
 * du compte aujourd'hui. Ce que l'appareil a fait, c'est `ici − base`.
 *
 * - Exemplaires et boosters ouverts sont des compteurs : on ajoute l'écart.
 *   Deux cartes tirées ici et trois là donnent cinq, pas trois.
 * - La bourse aussi, sauf le gain passif : il court sur l'horloge, pas sur
 *   l'appareil, et l'additionner deux fois paierait double les mêmes heures.
 * - Tout le reste (réglages, colporteur, ouverture en cours…) est une
 *   valeur : si l'appareil l'a changée, sa version gagne, sinon celle du compte.
 *
 * Aucune fonction ici ne touche au réseau ni au stockage : on les teste à nu.
 */
import { ECONOMIE } from "../../config/tiers.js";
import { RECOMPENSE_SEMAINE } from "../../config/missions.js";
import { evaluerMissions, mesuresMissions } from "../../missions/regles.js";

/** Empreinte courte d'une chaîne (FNV-1a 32 bits) : de quoi voir qu'elle a bougé. */
export function empreinte(texte) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Ce qui compte comme « l'appareil a joué ». La bourse en est exclue : le gain
 * passif la fait bouger toutes les vingt secondes, et chaque onglet ouvert
 * aurait l'air d'avoir quelque chose à envoyer. Toute dépense ou recette qui
 * compte passe de toute façon par une autre clé (collection, mine, marché).
 */
export function signature(etat, mine) {
  const { bourse, ...reste } = etat || {};
  return empreinte(JSON.stringify(reste) + "|" + (mine || ""));
}

/**
 * Clés refusées partout où l'on recopie des clés venues de l'extérieur
 * (fichier importé, copie du compte) : les affecter changerait le prototype
 * de l'objet cible au lieu d'y ranger une valeur.
 */
const INTERDITES = new Set(["__proto__", "constructor", "prototype"]);
export const cles = (...objets) =>
  [...new Set(objets.flatMap((o) => Object.keys(o || {})))].filter((k) => !INTERDITES.has(k));

const meme = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Exemplaires : compteurs à trois voies, avec un plancher. Une case (normale
 * ou rainbow) présente dans la base, ici ET là ne descend pas sous 1 : deux
 * appareils qui vendent chacun les deux doublons d'une carte à trois
 * exemplaires donnaient 1 + 1 − 3 = 0, et la dernière carte disparaissait.
 * Aucune action ne retire le dernier exemplaire d'une case en gardant
 * l'autre côté à 1 ou plus : Comptoir, colporteur, Reliquaire, entraînement
 * et étoile du Donjon ne prennent que des doublons. Seul le STAR RESET vide
 * la case — elle est alors à 0 de ce côté, et le plancher ne s'applique pas.
 */
function fusionnerCollections(base = {}, ici = {}, la = {}) {
  const sortie = {};
  const boosters = cles(ici, la);
  for (const bid of boosters) {
    const b = base[bid] || {}, i = ici[bid] || {}, l = la[bid] || {};
    const cartes = cles(i, l);
    const coll = {};
    for (const cid of cartes) {
      const eb = b[cid] || {}, ei = i[cid] || {}, el = l[cid] || {};
      const compte = (v) => {
        const plancher = (eb[v] || 0) >= 1 && (ei[v] || 0) >= 1 && (el[v] || 0) >= 1 ? 1 : 0;
        return Math.max(plancher, (el[v] || 0) + (ei[v] || 0) - (eb[v] || 0));
      };
      coll[cid] = {
        ...el, ...ei,
        normale: compte("normale"),
        rainbow: compte("rainbow"),
        carte: ei.carte || el.carte || eb.carte,
      };
    }
    sortie[bid] = coll;
  }
  return sortie;
}

function fusionnerCompteurs(base = {}, ici = {}, la = {}) {
  const sortie = {};
  for (const k of cles(ici, la)) {
    sortie[k] = Math.max(0, (la[k] || 0) + (ici[k] || 0) - (base[k] || 0));
  }
  return sortie;
}

function fusionnerBourse(base, ici, la) {
  if (!la) return ici;
  if (!ici) return la;
  const b = base || la;
  // Mouvement de l'appareil depuis la base : ventes, mine, achats… et gain
  // passif. La copie du compte a couru sur la même horloge pendant le temps
  // où les deux appareils ont crédité : ce gain-là est déjà chez elle, on le
  // retire pour ne pas payer deux fois les mêmes heures.
  const ecart = (ici.po || 0) - (b.po || 0);
  const debut = b.credite || 0;
  const communes = Math.max(0, Math.min(ici.credite || 0, la.credite || 0) - debut) / 3600000;
  const marge = Math.max(0, ECONOMIE.plafond - (b.po || 0)); // le passif ne dépasse pas le plafond
  const passifCommun = Math.min(communes * ECONOMIE.parHeure, marge);
  const net = ecart - passifCommun;
  return {
    ...la,
    po: Math.max(0, (la.po || 0) + net),
    gagne: (la.gagne || 0) + Math.max(0, (ici.gagne || 0) - (b.gagne || 0)),
    credite: Math.max(la.credite || 0, ici.credite || 0),
  };
}

/**
 * Ce que le jeu retient des Mines, hors de la partie : la version des règles
 * dont la remise à zéro est déjà payée (`regles`) et le solde versé alors
 * (`solde`) ; le compte des PO de commandes du jour (`livre`, plafond
 * quotidien, src/jeu/mine.js).
 *
 * `regles` ne fait que monter : on garde la plus haute, sinon le solde serait
 * versé une seconde fois. Le solde suit la marque gardée. `livre` : le jour le
 * plus récent ; le même jour, le plus haut des deux — c'est un garde-fou, les
 * commandes elles-mêmes se fusionnent dans la mine (`fusionnerMine`).
 * (Le champ portait jusqu'au 07/10/2026 le plafond quotidien, `{ jour,
 * credite }`, parti avec la vente aux kobolds.)
 */
function fusionnerMarqueMine(ici, la) {
  const ri = ici?.regles || 0, rl = la?.regles || 0;
  const r = Math.max(ri, rl);
  const sortie = {};
  if (r) {
    sortie.regles = r;
    const solde = ri >= rl ? ici?.solde : la?.solde;
    if (Number.isFinite(solde)) sortie.solde = solde;
  }
  const li = ici?.livre, ll = la?.livre;
  if (li || ll) {
    sortie.livre = !ll || (li && li.jour > ll.jour) ? li
      : !li || ll.jour > li.jour ? ll
        : { jour: li.jour, po: Math.max(li.po || 0, ll.po || 0) };
  }
  return Object.keys(sortie).length ? sortie : null;
}

/**
 * Le solde de remise payé des deux côtés depuis la base : chaque appareil a
 * crédité sa bourse, et la fusion de la bourse additionne les deux. Rend ce
 * qu'il faut reprendre (lu dans la marque, comme un succès réclamé deux fois).
 */
function soldeEnDouble(base, ici, la) {
  const rb = base?.regles || 0, ri = ici?.regles || 0, rl = la?.regles || 0;
  if (!(ri > rb) || ri !== rl) return 0;
  return Number.isFinite(ici?.solde) ? ici.solde : 0;
}

/**
 * Tafix : les conseils déjà vus et les onglets déjà ouverts s'unissent — ce
 * qu'on a vu sur un appareil, on l'a vu. Le silence suit le dernier choix de
 * cet appareil.
 */
export function fusionnerTafix(ici, la) {
  if (!ici) return la || null;
  if (!la) return ici;
  const union = (x, y) => [...new Set([...(x || []), ...(y || [])])];
  return { vus: union(ici.vus, la.vus), onglets: union(ici.onglets, la.onglets), muet: !!ici.muet };
}

/**
 * Compare l'avancement de deux parties de mine (objets déjà lus) : positif si
 * `a` est plus avancée. Effondrements, puis filons brisés, puis étoile sortie
 * au total — trois compteurs qui ne reculent jamais, contrairement à l'étoile
 * en poche qu'un achat fait baisser. L'horodatage ne départage qu'à égalité.
 */
export function comparerMines(a, b) {
  /* La version des règles d'abord : une copie d'avant la refonte du
     07/10/2026 a toujours plus de filons brisés que la mine remise à zéro, et
     l'emporterait sinon — chaque relecture la remettrait à zéro, et la
     partie nouvelle disparaîtrait avec. */
  const cle = (m) => [m?.regles || 0, m?.effondrements || 0, m?.brisesTotal || 0, m?.etoileTotale || 0, m?.dernierTick || 0];
  const x = cle(a), y = cle(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/**
 * La sauvegarde du module de la mine : la plus avancée l'emporte, entière —
 * sauf ses commandes du jour, fusionnées à part (`fusionnerCommandes`).
 *
 * C'était la plus récemment sauvegardée. Or un onglet oublié en arrière-plan
 * — ou le site ouvert à deux adresses, qui partagent le compte — sauvait sa
 * vieille partie avec l'heure du moment, et effaçait sur le compte les achats
 * faits ailleurs entre-temps : des talents et une foreuse qui disparaissent.
 *
 * Les commandes à part (audit du 09/10/2026) : la bourse additionne les
 * livraisons des deux appareils, mais la partie gardée entière gardait aussi
 * ses commandes non livrées — une commande livrée sur l'appareil le moins
 * avancé se livrait une seconde fois sur l'autre.
 */
export function fusionnerMine(ici, la) {
  if (!ici) return la || null;
  if (!la) return ici;
  const lire = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const a = lire(ici), b = lire(la);
  const [gagnante, brut, autre] = comparerMines(a, b) >= 0 ? [a, ici, b] : [b, la, a];
  if (!gagnante || !autre) return brut;
  const commandes = fusionnerCommandes(gagnante.commandes, autre.commandes);
  if (JSON.stringify(commandes ?? null) === JSON.stringify(gagnante.commandes ?? null)) return brut;
  return JSON.stringify({ ...gagnante, commandes });
}

/**
 * Les commandes de Tafix de deux copies : le jour le plus récent l'emporte ;
 * le même jour, une commande livrée d'un côté l'est des deux (elle a été
 * payée, la bourse l'a comptée).
 */
export function fusionnerCommandes(x, y) {
  if (!x?.liste) return y?.liste ? y : x ?? null;
  if (!y?.liste) return x;
  if (x.jour !== y.jour) return x.jour > y.jour ? x : y;
  const livrees = new Set(y.liste.filter((c) => c.livree).map((c) => c.id));
  return { ...x, liste: x.liste.map((c) => (!c.livree && livrees.has(c.id) ? { ...c, livree: true } : c)) };
}

/**
 * Succès réclamés : l'union des deux côtés, en gardant la date la plus
 * ancienne — c'est elle que départage la primauté du classement.
 *
 * Un palier réclamé sur les deux appareils depuis la base a été payé deux
 * fois : chaque réclamation a crédité la bourse et les sachets, et ces
 * compteurs s'additionnent. `doublons` rend ce qu'il faut reprendre, lu dans
 * la réclamation elle-même.
 */
export function fusionnerSucces(base = {}, ici = {}, la = {}) {
  const succes = { ...la };
  const doublons = { po: 0, sachets: {} };
  for (const id of cles(ici)) {
    const i = ici[id], l = la[id];
    if (!l) { succes[id] = i; continue; }
    if ((i?.t || 0) < (l?.t || 0)) succes[id] = i;
    if (!base[id]) {
      doublons.po += i?.po || 0;
      if (i?.n) doublons.sachets[i.cle] = (doublons.sachets[i.cle] || 0) + i.n;
    }
  }
  return { succes, doublons };
}

/**
 * Expérience des cartes : les points s'additionnent comme des compteurs, les
 * paliers payés (`irisee`, `cent`) sont acquis dès qu'un côté les a notés.
 * Une remise à zéro (STAR RESET) faite depuis la base l'emporte.
 */
export function fusionnerXP(base = {}, ici = {}, la = {}) {
  const sortie = {};
  for (const k of cles(ici, la)) {
    const b = base[k] || {}, i = ici[k] || {}, l = la[k] || {};
    // STAR RESET (`remise`, voir fiches.js) fait depuis la base : l'expérience
    // repart de ce côté-là, paliers compris ; sinon ils reviendraient de l'autre.
    const ri = (i.remise || 0) > (b.remise || 0) ? i.remise : 0;
    const rl = (l.remise || 0) > (b.remise || 0) ? l.remise : 0;
    if (ri || rl) { sortie[k] = ri >= rl ? i : l; continue; }
    sortie[k] = {
      xp: Math.max(0, (l.xp || 0) + (i.xp || 0) - (b.xp || 0)),
      ...((i.irisee || l.irisee) ? { irisee: true } : {}),
      ...((i.cent || l.cent) ? { cent: true } : {}),
      ...(b.remise ? { remise: b.remise } : {}),
    };
  }
  return sortie;
}

/**
 * Reliquaire : les vestiges sont un compteur (dissous ici et là s'additionnent),
 * la date de la dernière légendaire forgée garde la plus récente.
 */
/** Par extension, le jour le plus récent des deux côtés (AAAA-MM-JJ se trie en texte). */
const plusRecents = (a = {}, b = {}) =>
  Object.fromEntries([...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])]
    .filter((k) => k !== "__proto__")
    .map((k) => [k, [a?.[k], b?.[k]].filter(Boolean).sort().pop()]));

export function fusionnerReliquaire(base, ici, la) {
  if (!ici) return la || null;
  if (!la) return ici;
  const b = base || {};
  return {
    ...la, ...ici,
    vestiges: Math.max(0, (la.vestiges || 0) + (ici.vestiges || 0) - (b.vestiges || 0)),
    // Le jour de la dernière forge, par extension : le plus récent des deux
    // côtés, pour qu'une carte du jour forgée ailleurs ne se reforge pas ici.
    achats: plusRecents(la.achats, ici.achats),
    // Le jour où la carte du jour a été retournée : même règle, pour que le
    // prix moyen perdu sur un appareil ne revienne pas sur l'autre.
    reveles: plusRecents(la.reveles, ici.reveles),
    ouvert: ici.ouvert || la.ouvert || null,
  };
}

/**
 * Fiches de combat. Les rangs sont des compteurs plafonnés : un rang acheté
 * ici et un autre là, payés deux fois en vestiges, font deux rangs. Une
 * étoile, posée d'un côté, est acquise (sa rainbow est déjà sortie de la
 * collection). Une compétence suit l'appareil qui l'a changée ; une ligne
 * étoilée garde la compétence du côté qui l'a étoilée. Un STAR RESET
 * (`remise`) fait depuis la base remplace la fiche entière.
 */
export function fusionnerFiches(base = {}, ici = {}, la = {}, rangMax = 3) {
  const sortie = {};
  for (const k of cles(ici, la)) {
    const b = base[k] || {}, i = ici[k] || {}, l = la[k] || {};
    // STAR RESET : la remise la plus récente, faite depuis la base, l'emporte
    // entière ; sinon les rangs et les étoiles de l'autre côté reviendraient.
    const ri = (i.remise || 0) > (b.remise || 0) ? i.remise : 0;
    const rl = (l.remise || 0) > (b.remise || 0) ? l.remise : 0;
    if (ri || rl) { sortie[k] = ri >= rl ? i : l; continue; }
    const f = {};
    for (const r of ["atq", "ini"]) {
      const n = Math.min(rangMax, (l[r] || 0) + Math.max(0, (i[r] || 0) - (b[r] || 0)));
      if (n) f[r] = n;
    }
    const etoiles = {};
    for (const e of ["atq", "ini", "geste", "tech", "source"]) if (i.etoiles?.[e] || l.etoiles?.[e]) etoiles[e] = true;
    for (const place of ["geste", "tech"]) {
      const v = l.etoiles?.[place] ? l[place] : i.etoiles?.[place] ? i[place] : i[place] !== b[place] ? i[place] : l[place];
      if (v) f[place] = v;
    }
    if (Object.keys(etoiles).length) f.etoiles = etoiles;
    if (b.remise) f.remise = b.remise;
    sortie[k] = f;
  }
  return sortie;
}

/**
 * Missions de Bodégué. Elles étaient traitées comme une valeur : « l'appareil
 * l'a changée, sa version gagne ». Or un appareil qui s'ouvre un autre jour
 * tire aussitôt ses missions du jour — il a donc « changé » les missions, et
 * sa version, tirée sur une partie en retard et sans rien de réclamé,
 * effaçait celles jouées ailleurs (signalé par les testeurs, 09/10/2026).
 *
 * Le jour et la semaine se fusionnent à part, chacun selon sa période :
 * - périodes différentes : la plus récente l'emporte (l'autre côté n'a pas
 *   encore changé de jour) ;
 * - même période, tirage commun (la base l'avait déjà) : mission par
 *   mission, « réclamée » d'un côté l'est pour les deux ; une mission
 *   remplacée suit le côté qui l'a remplacée ;
 * - même période, deux tirages séparés (les deux appareils ont changé de jour
 *   chacun de leur côté) : la copie du compte fait foi — elle a été tirée la
 *   première, sur la partie la plus à jour —, et ce que cet appareil a
 *   réclamé sur la même mission s'y ajoute.
 *
 * Une mission réclamée des deux côtés a été payée deux fois ; une mission
 * remplie et non réclamée, payée au changement de jour par chacun des deux
 * appareils, aussi. `doublons` rend ce qu'il faut reprendre, comme pour les
 * succès.
 */
export function fusionnerMissions(base, ici, la, etatBase) {
  const doublons = { po: 0, sachets: 0 };
  if (!ici) return { missions: la || null, doublons };
  if (!la) return { missions: ici, doublons };
  const b = base || {};
  const evBase = etatBase && base ? evaluerMissions(etatBase, mesuresMissions(etatBase)) : null;

  /** Une période : `cle` (jour ou semaine), et les missions qu'elle porte. */
  const periode = (cle, lire, ecrire, payeeBase, prix) => {
    const ki = ici[cle] || "", kl = la[cle] || "", kb = b[cle] || "";
    if (ki !== kl) return ki > kl ? lire(ici) : lire(la);
    // Les deux ont changé de période chacun de leur côté : chacun a payé, en
    // passant, ce qui était rempli et pas réclamé dans la base.
    if (kb !== kl && kb && evBase) doublons[prix.cle] += payeeBase();
    const commun = kb === kl;
    const li = lire(ici), ll = lire(la), lb = commun ? lire(b) : { liste: [] };
    const liste = ll.liste.map((ml, n) => {
      const mi = li.liste[n], mb = lb.liste[n];
      if (!ml) return mi || null;
      if (!mi) return ml;
      if (mi.type !== ml.type) {
        // Remplacée ici depuis le tirage commun : la version d'ici.
        return commun && mb && mb.type === ml.type ? mi : ml;
      }
      const depuisBase = (m) => m.reclamee && !(commun && mb?.type === m.type && mb.reclamee);
      if (depuisBase(mi) && depuisBase(ml)) doublons[prix.cle] += prix.de(ml);
      return { ...ml, reclamee: !!(ml.reclamee || mi.reclamee) };
    });
    return ecrire(ll, liste, li);
  };

  const jour = periode("jour",
    (m) => ({ jour: m.jour, remplacees: m.remplacees || 0, liste: m.quotidiennes || [] }),
    (ll, liste, li) => ({ jour: ll.jour, remplacees: Math.max(ll.remplacees, li.remplacees), quotidiennes: liste }),
    () => evBase.quotidiennes.filter((m) => m.atteinte && !m.reclamee).reduce((s, m) => s + (m.po || 0), 0),
    { cle: "po", de: (m) => m.po || 0 });
  const semaine = periode("semaine",
    (m) => ({ semaine: m.semaine, liste: [m.hebdo] }),
    (ll, liste) => ({ semaine: ll.semaine, hebdo: liste[0] || null }),
    () => (evBase.hebdo?.atteinte && !evBase.hebdo.reclamee ? RECOMPENSE_SEMAINE.sachets || 0 : 0),
    { cle: "sachets", de: () => RECOMPENSE_SEMAINE.sachets || 0 });

  // `vu` ne sert qu'à animer la progression : celui de l'appareil, il se
  // recalera de lui-même (il porte son jour et sa semaine).
  const missions = { ...la, ...jour, ...semaine };
  if (ici.vu) missions.vu = ici.vu;
  return { missions, doublons };
}

/**
 * Expéditions. Une route se reconnaît à son Lieu et à son heure de départ.
 * Fusion d'ensemble à trois voies : une route de la base absente d'un côté
 * est rentrée (créditée ou rappelée) — elle ne revient pas, sinon elle se
 * paierait deux fois ; une route partie d'un côté depuis la base s'ajoute.
 * Deux routes parties chacune de son côté avec le même Lieu ou la même carte :
 * celle du compte reste. L'or du jour s'additionne comme un compteur.
 */
export function fusionnerExpeditions(base, ici, la) {
  if (!ici) return la || null;
  if (!la) return ici;
  const b = base || {};
  const cle = (r) => `${r.lieu}|${r.depart}`;
  const dansBase = new Set((b.routes || []).map(cle));
  const dansIci = new Set((ici.routes || []).map(cle));
  // Ce qui reste du compte : ses routes, moins celles rentrées ici.
  const routes = (la.routes || []).filter((r) => !dansBase.has(cle(r)) || dansIci.has(cle(r)));
  const prises = new Set(routes.flatMap((r) => [r.lieu, ...r.cartes]));
  let seq = Math.max(la.seq || 1, ici.seq || 1);
  const ids = new Set(routes.map((r) => r.id));
  for (const r of ici.routes || []) {
    if (dansBase.has(cle(r)) || routes.some((x) => cle(x) === cle(r))) continue;
    if ([r.lieu, ...r.cartes].some((k) => prises.has(k))) continue;
    // Les deux appareils numérotent à partir du même compteur.
    const route = ids.has(r.id) ? { ...r, id: seq++ } : r;
    ids.add(route.id);
    [route.lieu, ...route.cartes].forEach((k) => prises.add(k));
    routes.push(route);
  }
  seq = Math.max(seq, ...[...ids].map((id) => id + 1));

  const oi = ici.orJour, ol = la.orJour, ob = b.orJour;
  let orJour = ol || oi || null;
  if (oi && ol) {
    if (oi.jour !== ol.jour) orJour = oi.jour > ol.jour ? oi : ol;
    else {
      const depuis = ob?.jour === oi.jour ? ob.credite || 0 : 0;
      orJour = { jour: ol.jour, credite: (ol.credite || 0) + Math.max(0, (oi.credite || 0) - depuis) };
    }
  }
  return { ...la, ...ici, routes, seq, orJour };
}

/**
 * Le Donjon. Traité comme une valeur, le côté qui l'avait touché l'emportait
 * entier : les tentatives du jour prises ailleurs revenaient, une descente
 * terminée ailleurs pouvait se rejouer (et payer son butin une seconde fois),
 * une convalescence disparaissait.
 * - Le jour le plus récent porte les tentatives et la composition imposée ;
 *   au même jour, les tentatives s'additionnent comme un compteur et la
 *   composition tirée la première (celle du compte) reste.
 * - La partie en cours suit le côté qui l'a fait avancer. Avancée des deux
 *   côtés, et terminée sur le compte : terminée.
 * - Convalescences : l'union, la date la plus lointaine.
 */
export function fusionnerDonjon(base, ici, la) {
  if (!ici) return la || null;
  if (!la) return ici;
  const b = base || {};
  const sortie = { ...la };
  if ((ici.jour || "") > (la.jour || "")) {
    Object.assign(sortie, { jour: ici.jour, tentatives: ici.tentatives || 0, imposition: ici.imposition || null });
  } else if (ici.jour === la.jour) {
    const depuis = b.jour === ici.jour ? b.tentatives || 0 : 0;
    sortie.tentatives = (la.tentatives || 0) + Math.max(0, (ici.tentatives || 0) - depuis);
    sortie.imposition = la.imposition || ici.imposition || null;
  }
  const changeIci = !meme(ici.partie, b.partie), changeLa = !meme(la.partie, b.partie);
  // Avancée des deux côtés : celle du compte (terminée là-bas, elle le reste).
  sortie.partie = (changeIci && !changeLa ? ici.partie : la.partie) ?? null;
  if (!meme(ici.dernier, b.dernier) && meme(la.dernier, b.dernier)) sortie.dernier = ici.dernier;
  const conv = { ...(la.convalescence || {}) };
  for (const [k, fin] of Object.entries(ici.convalescence || {})) {
    if (!INTERDITES.has(k) && (!conv[k] || conv[k] < fin)) conv[k] = fin;
  }
  sortie.convalescence = conv;
  const record = Math.max(ici.recordInfini || 0, la.recordInfini || 0);
  if (record) sortie.recordInfini = record;
  return sortie;
}

/**
 * Garantie de légendaire, par extension. `depuis` compte les boosters
 * ouverts depuis la dernière légendaire : les boosters ouverts des deux
 * côtés s'ajoutent ; une légendaire tirée d'un côté (le compteur est
 * redescendu) remet ce côté-là à sa valeur. `vu` est acquis dès qu'un côté
 * l'a.
 */
export function fusionnerPity(base = {}, ici = {}, la = {}) {
  const sortie = {};
  for (const k of cles(ici, la)) {
    const b = base?.[k] || { depuis: 0 }, i = ici?.[k], l = la?.[k];
    if (!i || !l) { sortie[k] = i || l; continue; }
    const di = (i.depuis || 0) - (b.depuis || 0), dl = (l.depuis || 0) - (b.depuis || 0);
    const depuis = di < 0 ? i.depuis : dl < 0 ? l.depuis : (b.depuis || 0) + di + dl;
    sortie[k] = { ...l, depuis, vu: !!(i.vu || l.vu) };
  }
  return sortie;
}

/**
 * Le marché d'une extension (voir `Marche.serialiser`). Traité comme une
 * valeur, le côté qui l'avait touché l'emportait entier : le même jour, deux
 * appareils vendaient chacun vingt cartes à Lise, et la fusion gardait
 * `achats: { lise: 20 }` — le quota valait par appareil.
 * - Un côté inchangé depuis la base suit l'autre.
 * - Jours différents : le plus récent l'emporte (l'autre n'a pas encore
 *   changé de jour, ses ventes de la veille sont déjà payées).
 * - Même jour : les quotas s'additionnent (l'écart depuis la base si elle
 *   est du même jour, tout le quota d'ici sinon) ; marchandages et achats au
 *   rayon s'unissent, un marchandage déjà tiré sur le compte restant le sien.
 *   Si la base est du même jour, la caisse et le rayon reçoivent aussi
 *   l'écart d'ici : la caisse ne se vide pas deux fois en entier. Sinon les
 *   deux côtés ont rejoué la nuit chacun de leur côté, et ceux du compte
 *   font foi.
 */
function fusionnerMarche(b, i, l) {
  if (!i) return l;
  if (!l || meme(l, b)) return i;
  if (meme(i, b)) return l;
  if ((i.jour || 0) !== (l.jour || 0)) return (i.jour || 0) > (l.jour || 0) ? i : l;
  const memeJour = !!b && b.jour === i.jour;
  const bb = memeJour ? b : {};
  const achats = { ...(l.achats || {}) };
  for (const k of cles(i.achats)) {
    achats[k] = (achats[k] || 0) + Math.max(0, (i.achats[k] || 0) - ((bb.achats || {})[k] || 0));
  }
  const sortie = {
    ...l,
    achats,
    marchandages: { ...(i.marchandages || {}), ...(l.marchandages || {}) },
    achatsJoueur: { ...(i.achatsJoueur || {}), ...(l.achatsJoueur || {}) },
  };
  if (memeJour) {
    const ecart = (k) => (i[k] || 0) - (b[k] || 0);
    sortie.fonds = Math.max(0, (l.fonds || 0) + ecart("fonds"));
    sortie.verses = Math.max(0, (l.verses || 0) + ecart("verses"));
    sortie.encaisses = Math.max(0, (l.encaisses || 0) + ecart("encaisses"));
    const stock = { ...(l.stock || {}) };
    for (const k of cles(i.stock)) {
      if (!(k in stock)) continue;
      stock[k] = Math.max(0, stock[k] + (i.stock[k] || 0) - ((b.stock || {})[k] ?? i.stock[k]));
    }
    sortie.stock = stock;
  }
  return sortie;
}

/** Le Comptoir, extension par extension (voir `fusionnerMarche`). */
export function fusionnerComptoir(base = {}, ici = {}, la = {}) {
  const sortie = {};
  for (const k of cles(ici, la)) {
    const v = fusionnerMarche(base?.[k], ici?.[k], la?.[k]);
    if (v !== undefined) sortie[k] = v;
  }
  return sortie;
}

const COMPTEURS = new Set([
  "collections", "boosters", "bourse", "mine", "tafix", "schema", "succes", "sachets", "stats", "xp", "reliquaire", "fiches",
  "missions", "expeditions", "donjon", "comptoir", "pity",
]);

/**
 * Fusion à trois voies. `base` peut manquer : c'est le cas d'un joueur qui
 * avait joué sans compte et se connecte pour la première fois — tout ce qu'il
 * a fait ici s'ajoute alors à ce que le compte contenait.
 */
export function fusionner3(base, ici, la, vide) {
  const b = base || vide;
  const sortie = { ...la };
  sortie.collections = fusionnerCollections(b.collections, ici.collections, la.collections);
  sortie.boosters = fusionnerCompteurs(b.boosters, ici.boosters, la.boosters);
  sortie.bourse = base ? fusionnerBourse(b.bourse, ici.bourse, la.bourse)
    // Première connexion : on garde le plus garni, comme à l'import.
    : ((ici.bourse?.po || 0) > (la.bourse?.po || 0) ? ici.bourse : la.bourse);
  sortie.mine = fusionnerMarqueMine(ici.mine, la.mine);
  sortie.tafix = fusionnerTafix(ici.tafix, la.tafix);
  sortie.sachets = fusionnerCompteurs(b.sachets, ici.sachets, la.sachets);
  sortie.stats = fusionnerCompteurs(b.stats, ici.stats, la.stats);
  sortie.xp = fusionnerXP(b.xp, ici.xp, la.xp);
  sortie.reliquaire = fusionnerReliquaire(b.reliquaire, ici.reliquaire, la.reliquaire);
  sortie.fiches = fusionnerFiches(b.fiches, ici.fiches, la.fiches);
  sortie.expeditions = fusionnerExpeditions(b.expeditions, ici.expeditions, la.expeditions);
  sortie.donjon = fusionnerDonjon(b.donjon, ici.donjon, la.donjon);
  sortie.comptoir = fusionnerComptoir(b.comptoir, ici.comptoir, la.comptoir);
  sortie.pity = fusionnerPity(b.pity, ici.pity, la.pity);
  const { succes, doublons } = fusionnerSucces(b.succes, ici.succes, la.succes);
  sortie.succes = succes;
  doublons.po += soldeEnDouble(b.mine, ici.mine, la.mine);
  const m = fusionnerMissions(b.missions, ici.missions, la.missions, base ? b : null);
  sortie.missions = m.missions;
  doublons.po += m.doublons.po;
  if (m.doublons.sachets) doublons.sachets["*"] = (doublons.sachets["*"] || 0) + m.doublons.sachets;
  // Les sachets s'additionnent toujours, y compris à la première connexion :
  // un doublon s'y reprend toujours. La bourse, elle, n'est additionnée
  // qu'avec une base ; sans base on garde la plus garnie, il n'y a rien à
  // reprendre.
  for (const [cle, n] of Object.entries(doublons.sachets)) {
    sortie.sachets[cle] = Math.max(0, (sortie.sachets[cle] || 0) - n);
  }
  if (base && doublons.po > 0 && sortie.bourse) {
    sortie.bourse = { ...sortie.bourse, po: Math.max(0, sortie.bourse.po - doublons.po),
      gagne: Math.max(0, (sortie.bourse.gagne || 0) - doublons.po) };
  }
  for (const k of cles(ici, la)) {
    if (COMPTEURS.has(k)) continue;
    // Valeur : l'appareil l'a changée depuis la base → la sienne.
    sortie[k] = !meme(ici[k], b[k]) ? ici[k] : la[k];
  }
  return sortie;
}
