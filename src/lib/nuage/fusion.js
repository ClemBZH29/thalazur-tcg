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
 * - Tout le reste (réglages, marché, colporteur, ouverture en cours…) est une
 *   valeur : si l'appareil l'a changée, sa version gagne, sinon celle du compte.
 *
 * Aucune fonction ici ne touche au réseau ni au stockage : on les teste à nu.
 */
import { ECONOMIE } from "../../config/tiers.js";

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

function fusionnerCollections(base = {}, ici = {}, la = {}) {
  const sortie = {};
  const boosters = cles(ici, la);
  for (const bid of boosters) {
    const b = base[bid] || {}, i = ici[bid] || {}, l = la[bid] || {};
    const cartes = cles(i, l);
    const coll = {};
    for (const cid of cartes) {
      const eb = b[cid] || {}, ei = i[cid] || {}, el = l[cid] || {};
      const compte = (v) => Math.max(0, (el[v] || 0) + (ei[v] || 0) - (eb[v] || 0));
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

/** Journée de la mine : on garde la plus récente, et le plus gros crédit du jour. */
function fusionnerJourMine(ici, la) {
  if (!ici) return la || null;
  if (!la) return ici;
  if (ici.jour !== la.jour) return ici.jour > la.jour ? ici : la;
  return { jour: ici.jour, credite: Math.max(ici.credite || 0, la.credite || 0) };
}

/**
 * Compare l'avancement de deux parties de mine (objets déjà lus) : positif si
 * `a` est plus avancée. Effondrements, puis filons brisés, puis étoile sortie
 * au total — trois compteurs qui ne reculent jamais, contrairement à l'étoile
 * en poche qu'un achat fait baisser. L'horodatage ne départage qu'à égalité.
 */
export function comparerMines(a, b) {
  const cle = (m) => [m?.effondrements || 0, m?.brisesTotal || 0, m?.etoileTotale || 0, m?.dernierTick || 0];
  const x = cle(a), y = cle(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/**
 * La sauvegarde du module de la mine : la plus avancée l'emporte, entière.
 *
 * C'était la plus récemment sauvegardée. Or un onglet oublié en arrière-plan
 * — ou le site ouvert à deux adresses, qui partagent le compte — sauvait sa
 * vieille partie avec l'heure du moment, et effaçait sur le compte les achats
 * faits ailleurs entre-temps : des talents et une foreuse qui disparaissent.
 */
export function fusionnerMine(ici, la) {
  if (!ici) return la || null;
  if (!la) return ici;
  const lire = (s) => { try { return JSON.parse(s); } catch { return null; } };
  return comparerMines(lire(ici), lire(la)) >= 0 ? ici : la;
}

const COMPTEURS = new Set(["collections", "boosters", "bourse", "mine", "schema"]);

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
  sortie.mine = fusionnerJourMine(ici.mine, la.mine);
  for (const k of cles(ici, la)) {
    if (COMPTEURS.has(k)) continue;
    // Valeur : l'appareil l'a changée depuis la base → la sienne.
    sortie[k] = !meme(ici[k], b[k]) ? ici[k] : la[k];
  }
  return sortie;
}
