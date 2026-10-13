/**
 * La mise en page du grimoire des Succès : ce qui va sur quelle page, et où.
 *
 * Fonctions pures, sans DOM ni React : le composant (`Grimoire.jsx`) les
 * appelle à chaque rendu, les tests (`tests/grimoire.test.js`) les rejouent.
 * Les dimensions sont celles de la note de Claude Design (« Le grimoire des
 * Succès : note de conception », § 2), en pixels du livre avant sa mise à
 * l'échelle : le bureau pose une double page de 1 200 × 690, le téléphone une
 * seule page à la hauteur de l'écran.
 *
 * Vocabulaire :
 *  - un **chapitre** : un module du site (Mines, Donjon…) ou une extension ;
 *  - un **bloc** : ce qu'une page empile, une famille dépliée ou repliée, ou
 *    la rangée des provinces d'une extension ;
 *  - une **position** : ce que le livre montre d'un coup, une double page au
 *    bureau, une page au téléphone. Tourner, c'est passer à la position
 *    voisine.
 */

/* ── Repères ───────────────────────────────────────────────────────────── */

/** Le pictogramme de chaque chapitre global (noms de `Icone.jsx`). */
export const PICTO = {
  boutique: "boutique", mines: "mines", donjon: "donjon", routes: "expeditions",
  negoce: "comptoir", reliquaire: "reliquaire", missions: "missions", cartes: "xp",
};
/** Une extension porte le pictogramme des cartes, dans sa nuance. */
const PICTO_EXTENSION = "cartes";

const ARTICLE = /^(?:(?:Les|La|Le)\s+|L['’]\s*)/;

/** Nombre entier à la française : espace fine insécable entre les milliers. */
export const nombre = (n) => Math.floor(Number(n) || 0).toLocaleString("fr-FR");

/** Les nombres de quatre chiffres et plus d'une phrase du barème, groupés par milliers. */
export const nombresDansTexte = (s) => String(s ?? "").replace(/\d{4,}/g, (m) => nombre(Number(m)));

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Une famille d'extension qui compte une province : elles se rangent ensemble. */
export const estProvince = (f) => String(f.id).includes(":province-");

/** Une famille mesurée en pour cent (la complétion d'une extension). */
const enPourcent = (f) => f.mesure === "pct";

/* ── États ─────────────────────────────────────────────────────────────── */

/**
 * Un exploit caché ne montre ni son seuil ni sa récompense tant qu'il n'est
 * pas atteint (barème, `cache: true`). Atteint, il se lit comme les autres.
 */
export const estVoile = (p) => Boolean(p.cache) && !p.atteint;

/**
 * L'état de chaque médaillon d'une famille, dans l'ordre des paliers :
 *  - `scelle` : réclamé, sous le sceau de cire froide ;
 *  - `pret` : atteint et pas encore réclamé, il luit ;
 *  - `cache` : exploit caché pas encore atteint, sous la tache d'encre ;
 *  - `proche` : le premier palier visible qui reste à atteindre, son anneau
 *    dit le chemin fait ;
 *  - `loin` : les suivants, à l'encre pâle.
 * Un exploit caché ne compte jamais comme « proche » : ce serait dévoiler
 * qu'il existe un but juste après.
 */
export function etatsFamille(f) {
  let proche = false;
  return f.paliers.map((p) => {
    if (p.reclame) return "scelle";
    if (p.atteint) return "pret";
    if (estVoile(p)) return "cache";
    if (!proche) { proche = true; return "proche"; }
    return "loin";
  });
}

/** Une famille dont tous les paliers sont réclamés se replie en une ligne. */
export const familleTerminee = (f) => f.paliers.length > 0 && f.paliers.every((p) => p.reclame);

/** Le seuil tel qu'il s'écrit dans le médaillon ; rien pour un exploit voilé. */
export function texteSeuil(p, f) {
  if (estVoile(p) || p.seuil == null) return "";
  return enPourcent(f) ? `${p.seuil}\u202f%` : nombre(p.seuil);
}

/** La valeur courante d'une famille, à droite de son nom ; « ? » si tout est voilé. */
export function texteValeur(f) {
  if (f.paliers.length && f.paliers.every(estVoile)) return "?";
  return nombre(f.valeur) + (enPourcent(f) ? "\u202f%" : "");
}

/**
 * Ce que rapporte un palier, en mots d'écran : « 60 PO », « 1 booster au
 * choix », « 3 boosters de La Troupe ». Un tableau, une ligne par gain.
 */
export function libellesRecompense(recompense = {}, chapitre) {
  const sortie = [];
  if (recompense.po) sortie.push(`${nombre(recompense.po)} PO`);
  if (recompense.sachets) {
    const n = recompense.sachets;
    sortie.push(chapitre?.extension ? `${pluriel(n, "booster")} de ${chapitre.nom}` : `${pluriel(n, "booster")} au choix`);
  }
  return sortie;
}

/* ── Chapitres ─────────────────────────────────────────────────────────── */

const sansArticle = (nom) => String(nom).replace(ARTICLE, "");

function statistiques(familles) {
  let total = 0, reclames = 0, attente = 0;
  for (const f of familles) {
    for (const p of f.paliers) {
      total++;
      if (p.reclame) reclames++;
      else if (p.atteint) attente++;
    }
  }
  // En sourdine : rien de fait, rien de mesuré. C'est le module que le joueur
  // n'a pas encore ouvert (le Reliquaire du débutant) : lisible, mais éteint.
  const sourdine = total > 0 && reclames === 0 && attente === 0 && familles.every((f) => !f.valeur);
  return { total, reclames, attente, frac: total ? reclames / total : 0, acheve: total > 0 && reclames === total, sourdine };
}

/**
 * Les chapitres du grimoire, dans l'ordre du sommaire : les chapitres globaux
 * du catalogue, puis un par extension ouverte. Un chapitre sans famille (son
 * module n'a pas encore de succès) n'a pas de page. Une famille dont le
 * chapitre n'est pas au catalogue n'est pas perdue : elle ouvre le sien,
 * après les autres.
 */
export function construireChapitres(chapitres = [], evaluation = {}) {
  const globales = evaluation.global || [];
  const connus = new Set(chapitres.map((c) => c.id));
  const sortie = [];
  const ajouter = (c, familles, extension) => {
    if (!familles.length) return;
    const nom = c.nom || c.id;
    sortie.push({
      id: c.id, nom, quoi: c.quoi || "", extension,
      picto: extension ? PICTO_EXTENSION : PICTO[c.id] || PICTO_EXTENSION,
      lettre: (sansArticle(nom)[0] || "?").toUpperCase(),
      // Le nom court de la légende « Mines · La Troupe ×2 » : le premier mot
      // d'un chapitre global, le titre entier d'une extension.
      court: extension ? nom : sansArticle(nom).split(/\s+/)[0],
      familles,
      stats: statistiques(familles),
    });
  };
  for (const c of chapitres) ajouter(c, globales.filter((f) => f.chapitre === c.id), false);
  const orphelins = [...new Set(globales.map((f) => f.chapitre).filter((id) => !connus.has(id)))];
  for (const id of orphelins) ajouter({ id, nom: String(id ?? "Autres") }, globales.filter((f) => f.chapitre === id), false);
  for (const e of evaluation.extensions || []) ajouter({ id: e.id, nom: e.titre }, e.familles || [], true);
  return sortie;
}

/** Les paliers à réclamer, un par sceau de l'ex-libris, avec le pictogramme de leur chapitre. */
export function paliersEnAttente(chapitres) {
  const sortie = [];
  for (const c of chapitres) {
    for (const f of c.familles) {
      for (const p of f.paliers) if (p.atteint && !p.reclame) sortie.push({ id: p.id, chapitre: c.id, picto: c.picto, extension: c.extension });
    }
  }
  return sortie;
}

/** « Mines · La Troupe ×2 » : où sont les paliers en attente, sans tourner les pages. */
export function legendeAttente(chapitres, ids) {
  const voulu = ids ? new Set(ids) : null;
  const parChapitre = [];
  for (const c of chapitres) {
    let n = 0;
    for (const f of c.familles) {
      for (const p of f.paliers) if (voulu ? voulu.has(p.id) : p.atteint && !p.reclame) n++;
    }
    if (n) parChapitre.push(n > 1 ? `${c.court} ×${n}` : c.court);
  }
  return parChapitre.join(" · ");
}

/** Le palier, sa famille et son chapitre, à partir de son identifiant. */
export function trouverPalier(chapitres, id) {
  for (const c of chapitres) {
    for (const f of c.familles) {
      for (const p of f.paliers) if (p.id === id) return { chapitre: c, famille: f, palier: p };
    }
  }
  return null;
}

/* ── Géométrie ─────────────────────────────────────────────────────────── */

/**
 * Le bureau : page de 590 × 670, texte de 376. Une famille dépliée prend 128
 * (nom 26, rang de médaillons 60, ruban 24, souffle), repliée 46 ; l'en-tête
 * du chapitre (lettrine) 100. Le texte court de 44 à 612 : sous 612 vivent le
 * folio et les flèches.
 */
export const GEO_BUREAU = Object.freeze({
  bureau: true, largeurPage: 590, hauteurPage: 670, texte: 376,
  haut: 44, bas: 612, tete: 100, famille: 128, repliee: 46,
  cible: 60, retrait: 10, nom: 26, ruban: 24, lettrine: 72, ecartMax: 34,
});

/**
 * Le téléphone : une page de la largeur de l'écran moins 24, de la hauteur
 * de la scène moins 16. Le texte garde 16 de marge ; le pied (folio,
 * flèches) occupe les 56 du bas.
 */
export function geoTelephone(largeurPage, hauteurPage) {
  const l = Math.max(280, Math.round(largeurPage));
  const h = Math.max(420, Math.round(hauteurPage));
  return {
    bureau: false, largeurPage: l, hauteurPage: h, texte: l - 32,
    haut: 14, bas: h - 56, tete: 84, famille: 114, repliee: 44,
    cible: 54, retrait: 8, nom: 24, ruban: 22, lettrine: 58, ecartMax: 18,
  };
}

/* ── Pagination ────────────────────────────────────────────────────────── */

const estReplie = (b) => b.type === "repliee" || b.type === "provinces-repliee";
export const hauteurBloc = (b, geo) => (estReplie(b) ? geo.repliee : geo.famille);

/**
 * Les blocs d'un chapitre, dans l'ordre du barème. Les provinces d'une
 * extension (sept familles d'un palier chacune) font une seule rangée, à la
 * place de la première. Une famille terminée se replie, sauf si elle figure
 * dans `garderOuvertes` : c'est celle que le joueur vient de finir sous ses
 * yeux. La replier aussitôt ferait sauter la page au moment où il la regarde
 * (charte, « une interface de jeu ne change pas de taille pendant qu'on
 * joue ») ; elle se repliera à la prochaine visite du chapitre.
 */
export function blocsChapitre(chapitre, garderOuvertes = new Set()) {
  const blocs = [];
  let provinces = null;
  for (const f of chapitre.familles) {
    if (estProvince(f)) {
      if (!provinces) { provinces = { type: "provinces", familles: [] }; blocs.push(provinces); }
      provinces.familles.push(f);
    } else {
      blocs.push({ type: familleTerminee(f) && !garderOuvertes.has(f.id) ? "repliee" : "famille", famille: f });
    }
  }
  if (provinces && provinces.familles.every(familleTerminee) && !provinces.familles.some((f) => garderOuvertes.has(f.id))) {
    provinces.type = "provinces-repliee";
  }
  return blocs;
}

/**
 * Les pages d'un chapitre. On remplit chaque page dans l'ordre, la première
 * amputée de l'en-tête. Au bureau :
 *  - un chapitre qui tient sur deux pages se partage en deux moitiés, pour que
 *    la double page ne laisse pas une page pleine en regard d'une page vide ;
 *  - un nombre impair de pages se complète d'une page de fin (`null`), qui
 *    porte le sceau du chapitre achevé, ou un simple cul-de-lampe.
 * Chaque page : `{ type: "chapitre" | "fin", chapitre, k, n, premiere, blocs }`.
 */
export function paginerChapitre(chapitre, geo, garderOuvertes) {
  const blocs = blocsChapitre(chapitre, garderOuvertes);
  const capPremiere = geo.bas - geo.haut - geo.tete, capSuite = geo.bas - geo.haut;
  const hauteur = (liste) => liste.reduce((s, b) => s + hauteurBloc(b, geo), 0);

  let pages = [[]], pris = 0, cap = capPremiere;
  for (const b of blocs) {
    const h = hauteurBloc(b, geo);
    if (pris + h > cap && pages[pages.length - 1].length) { pages.push([]); pris = 0; cap = capSuite; }
    pages[pages.length - 1].push(b);
    pris += h;
  }

  if (geo.bureau) {
    if (pages.length <= 2 && blocs.length > 1 && !blocs.every(estReplie)) {
      // Deux moitiés, la première plus fournie, seulement si chacune tient :
      // la première page porte l'en-tête et loge un bloc de moins.
      const k = Math.ceil(blocs.length / 2);
      const a = blocs.slice(0, k), b = blocs.slice(k);
      if (hauteur(a) <= capPremiere && hauteur(b) <= capSuite) pages = [a, b];
    }
    if (pages.length % 2 === 1) pages.push(null);
  }

  const n = pages.length;
  return pages.map((liste, k) => ({
    type: liste ? "chapitre" : "fin", chapitre: chapitre.id, k, n, premiere: k === 0, blocs: liste || [],
  }));
}

/**
 * La place de chaque bloc sur sa page : on répartit l'air restant entre les
 * blocs (au plus 34 au bureau, 18 au téléphone), un demi-écart en tête. Rend
 * les blocs augmentés de `y` et `h`.
 */
export function disposerPage(page, geo) {
  let y = geo.haut + (page.premiere ? geo.tete : 0);
  const pris = page.blocs.reduce((s, b) => s + hauteurBloc(b, geo), 0);
  const nb = page.blocs.length;
  const ecart = nb ? Math.max(0, Math.min(geo.ecartMax, (geo.bas - y - pris) / (nb + 0.5))) : 0;
  y += ecart * 0.5;
  return page.blocs.map((b) => {
    const h = hauteurBloc(b, geo);
    const sortie = { ...b, y: Math.round(y), h };
    y += h + ecart;
    return sortie;
  });
}

/** « Le Bestiaire » → « Bestiaire », « Säab et Pronolo » → « Säab » : sous un médaillon de province. */
export const provinceCourte = (nom) => sansArticle(nom).split(/,| et /)[0].trim();

/**
 * Les médaillons d'un bloc, placés sur la largeur du texte, et le chemin
 * d'encre qui les relie. Un médaillon a une cible `b` (le bouton, 44 au
 * moins) et un disque `d` dedans ; sept médaillons par rang au plus tiennent
 * à 51 de cible au bureau.
 *
 * Le chemin : un trait pâle sur toute la rangée, un trait d'encre jusqu'à la
 * valeur courante, interpolé entre les deux seuils qui l'encadrent, et un
 * losange pour la marquer quand il ne tombe pas sur un médaillon. Le trait
 * s'arrête au dernier palier visible : il ne montre pas où se trouve un
 * exploit caché.
 */
export function disposerFamille(bloc, largeur, geo) {
  const provinces = bloc.type === "provinces";
  const items = provinces
    ? bloc.familles.map((f) => ({ palier: f.paliers[0], famille: f, etat: etatsFamille(f)[0], label: provinceCourte(f.nom) }))
    : (() => {
      const etats = etatsFamille(bloc.famille);
      return bloc.famille.paliers.map((p, i) => ({ palier: p, famille: bloc.famille, etat: etats[i], label: "" }));
    })();
  const n = items.length;
  const b = Math.min(geo.cible, Math.floor((largeur - 14) / Math.max(1, n)));
  const d = b - (b < 52 ? 6 : geo.retrait);
  const debut = 14 + b / 2, fin = largeur - b / 2;
  const cx = items.map((_, i) => (n === 1 ? largeur / 2 : debut + (i * (fin - debut)) / (n - 1)));

  const medaillons = items.map((it, i) => {
    const t = texteSeuil(it.palier, it.famille);
    const L = t.length;
    const avance = it.palier.seuil ? Math.max(0, Math.min(1, it.famille.valeur / it.palier.seuil)) : 0;
    return {
      ...it, id: it.palier.id, cx: cx[i], b, d, texte: t,
      police: Math.round(d * (L <= 2 ? 0.38 : L === 3 ? 0.32 : L <= 5 ? 0.26 : 0.22)),
      avance,
      // Le petit ruban sous un médaillon dit « ce palier porte un titre »,
      // sans le nommer : le nom se lit dans la note.
      porteTitre: Boolean(it.palier.titre) && !estVoile(it.palier),
    };
  });

  if (provinces) {
    const faites = bloc.familles.filter((f) => f.paliers[0]?.reclame).length;
    return { medaillons, b, d, nom: "Provinces", valeur: `${faites} / ${n}`, chemin: null };
  }

  const f = bloc.famille, v = Number(f.valeur) || 0, x0 = 4;
  let px = x0, precX = x0, precS = 0, trouve = false;
  for (let i = 0; i < n; i++) {
    const p = f.paliers[i];
    if (estVoile(p) || p.seuil == null) { px = precX; trouve = true; break; }
    if (v >= p.seuil) { precX = cx[i]; precS = p.seuil; continue; }
    px = precX + ((cx[i] - precX) * (v - precS)) / Math.max(1e-9, p.seuil - precS);
    trouve = true;
    break;
  }
  if (!trouve) px = precX;
  const longueur = cx[n - 1] - x0;
  const toutVoile = f.paliers.every(estVoile);
  return {
    medaillons, b, d, nom: f.nom, valeur: texteValeur(f),
    chemin: {
      x0, longueur, frac: longueur > 0 ? Math.max(0, Math.min(1, (px - x0) / longueur)) : 0,
      marque: !toutVoile && px > x0 + 2 && !cx.some((c) => Math.abs(c - px) < b / 2) ? px : null,
    },
  };
}

/* ── Positions du livre ────────────────────────────────────────────────── */

/**
 * Tout ce que le livre peut montrer, dans l'ordre où on le feuillette : le
 * sommaire (avec l'ex-libris en regard au bureau, au-dessus au téléphone),
 * puis chaque chapitre. Chaque position porte son adresse `loc` : le
 * chapitre (null pour le sommaire) et le numéro de sa première page, compté
 * à partir de 1. Le numéro est celui d'une page, pas d'une double page : la
 * même adresse vaut au bureau et au téléphone.
 */
export function construirePositions(chapitres, geo, garderOuvertes) {
  const positions = [];
  if (geo.bureau) {
    positions.push({ loc: { chapitre: null, page: 1 }, gauche: { type: "sommaire" }, droite: { type: "exlibris" } });
    for (const c of chapitres) {
      const pages = paginerChapitre(c, geo, garderOuvertes);
      for (let i = 0; i < pages.length; i += 2) {
        positions.push({ loc: { chapitre: c.id, page: i + 1 }, gauche: pages[i], droite: pages[i + 1] });
      }
    }
  } else {
    positions.push({ loc: { chapitre: null, page: 1 }, page: { type: "sommaire-tel" } });
    for (const c of chapitres) {
      for (const p of paginerChapitre(c, geo, garderOuvertes)) positions.push({ loc: { chapitre: c.id, page: p.k + 1 }, page: p });
    }
  }
  return positions;
}

/**
 * La position qui montre une adresse. Au bureau, la page 3 est dans la
 * double page 3–4. Une page au-delà de la dernière ramène à la dernière ; un
 * chapitre inconnu, au sommaire.
 */
export function indexPosition(positions, route) {
  const chapitre = route?.chapitre ?? null;
  const page = Math.max(1, Math.floor(Number(route?.page) || 1));
  const candidats = [];
  for (let i = 0; i < positions.length; i++) if (positions[i].loc.chapitre === chapitre) candidats.push(i);
  if (!candidats.length) return 0;
  for (const i of candidats) {
    const loc = positions[i].loc;
    if (loc.page === page || (positions[i].gauche && loc.page + 1 === page)) return i;
  }
  const dernier = candidats[candidats.length - 1];
  return page > positions[dernier].loc.page ? dernier : candidats[0];
}

/** « 2 / 3 » : la page dans son chapitre. */
export const folio = (page) => `${page.k + 1} / ${page.n}`;

/** Le nom donné au lecteur d'écran après un tour de page. */
export function annoncePosition(chapitres, loc) {
  if (!loc?.chapitre) return "Sommaire";
  const c = chapitres.find((x) => x.id === loc.chapitre);
  return c ? `${c.nom}, page ${loc.page}` : "Sommaire";
}

/** L'ensemble des familles pas encore terminées d'un chapitre (voir `blocsChapitre`). */
export function famillesOuvertes(chapitres, id) {
  const c = chapitres.find((x) => x.id === id);
  return c ? c.familles.filter((f) => !familleTerminee(f)).map((f) => f.id) : [];
}

/** Le résumé d'une réclamation pour `aria-live`. */
export function annonceGain({ n, po, sachets, titres, points }) {
  const parts = [];
  if (po) parts.push(`${nombre(po)} PO`);
  if (sachets) parts.push(pluriel(sachets, "booster"));
  for (const t of titres || []) parts.push(`titre ${t}`);
  parts.push(`${nombre(points)} de renommée`);
  return `${n > 1 ? `${n} paliers réclamés` : "Palier réclamé"} : ${parts.join(", ")}.`;
}
