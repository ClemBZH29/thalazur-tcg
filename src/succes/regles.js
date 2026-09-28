/**
 * Les succès : le catalogue construit à partir des extensions, ce que la
 * partie mesure, ce qui est atteint, et la réclamation.
 *
 * Rien ici ne touche au navigateur ni au catalogue des extensions (qui passe
 * par `import.meta.glob`) : les extensions arrivent en paramètre. C'est ce qui
 * permet aux tests et à `scripts/audit-succes.mjs` de rejouer exactement les
 * formules du site.
 *
 * ── Ce qu'un succès réclamé laisse dans la partie ─────────────────────────
 *   etat.succes[id] = { t, po, n, cle }
 * La date de réclamation, et ce qu'il a rapporté. Garder la récompense avec la
 * réclamation rend la fusion entre appareils autonome : si deux appareils
 * réclament le même palier chacun de leur côté, `fusion.js` sait ce qu'il faut
 * reprendre sans relire le barème (voir `fusionnerSucces`).
 */
import { construirePool, deduireGrades } from "../lib/roster.js";
import { specialesPour } from "../config/speciales.js";
import { crediterGain } from "../lib/economie.js";
import { COLLECTION, GLOBAL, POIDS_SCORE, SACHET_LIBRE } from "../config/succes.js";

const PALIERS = ["commun", "peucommun", "rare", "legendaire"];

const avecN = (texte, n) => texte.replaceAll("{n}", String(n)).replaceAll("{s}", n > 1 ? "s" : "");

/** Les cartes d'une extension qui comptent pour les succès : le roster, et ses full art. */
export function cartesExtension(ext) {
  const lignes = ext.roster?.lignes || [];
  const pool = construirePool(lignes, deduireGrades(lignes));
  return {
    roster: PALIERS.flatMap((t) => pool[t] || []),
    fullart: specialesPour(ext).fullart,
  };
}

function famille(id, categorie, def, paliers, extension = null) {
  return {
    id, categorie, extension, nom: def.nom, mesure: def.mesure,
    paliers: paliers.map((p) => ({ ...p, id: `${id}@${p.seuil}` })),
  };
}

/**
 * Le catalogue complet : familles globales, puis les familles de collection
 * de chaque extension ouverte. Une extension « bientôt » n'a pas de roster
 * publié ; elle n'a donc pas encore de succès, et rien n'en est dévoilé.
 */
export function construireCatalogue(extensions) {
  const global = GLOBAL.map((f) => famille(f.id, "global", f,
    f.paliers.map((p) => ({ ...p, quoi: avecN(f.quoi, p.seuil) }))));

  const parExtension = extensions
    .filter((e) => e.statut === "ouvert" && e.roster)
    .map((ext) => {
      const { roster, fullart } = cartesExtension(ext);
      const x = (t) => (t ? t.replaceAll("{ext}", ext.titre) : undefined);
      const C = COLLECTION;
      const familles = [];
      const ajouter = (cle, def, paliers) =>
        familles.push(famille(`${ext.id}:${cle}`, "collection", def,
          paliers.map((p) => ({ ...p, quoi: x(p.quoi), titre: x(p.titre) })), ext.id));

      ajouter("completion", { nom: C.completion.nom, mesure: "pct" },
        C.completion.paliers.map((p) => ({ ...p, quoi: avecN(C.completion.quoi, p.seuil) })));

      for (const [type, def] of Object.entries(C.type.types)) {
        const n = roster.filter((c) => c.type === type).length;
        if (!n) continue;
        const paliers = C.type.seuils.filter((s) => s < n).map((s) => ({
          seuil: s, recompense: { po: C.type.po[s] }, quoi: avecN(def.quoi, s),
        }));
        paliers.push({ seuil: n, recompense: C.type.tous, quoi: `Posséder ${def.tous}`, titre: def.titre });
        ajouter(`type-${type}`, { nom: def.nom, mesure: `type.${type}` }, paliers);
      }

      const nLeg = roster.filter((c) => c.tier === "legendaire").length;
      if (nLeg) {
        const seuils = [...new Set([1, Math.ceil(nLeg / 2), nLeg])];
        const recs = C.legendaires.recompenses.slice(-seuils.length);
        ajouter("legendaires", { nom: C.legendaires.nom, mesure: "legendaires" },
          seuils.map((s, i) => ({
            seuil: s, recompense: recs[i], quoi: avecN(C.legendaires.quoi, s),
            titre: i === seuils.length - 1 ? C.legendaires.titre : undefined,
          })));
      }

      const irisables = roster.length + fullart.length;
      ajouter("irisees", { nom: C.irisees.nom, mesure: "irisees" },
        C.irisees.paliers.filter((p) => p.seuil <= irisables)
          .map((p) => ({ ...p, quoi: avecN(C.irisees.quoi, p.seuil) })));

      if (fullart.length) {
        ajouter("fullart", { nom: C.fullart.nom, mesure: "fullart" },
          C.fullart.paliers.map((p) => ({ ...p, quoi: avecN(C.fullart.quoi, p.seuil) })));
      }

      return { id: ext.id, titre: ext.titre, roster, fullart, familles };
    });

  const parId = new Map();
  for (const f of [...global, ...parExtension.flatMap((e) => e.familles)]) {
    for (const p of f.paliers) parId.set(p.id, { famille: f, palier: p });
  }
  return { global, extensions: parExtension, parId };
}

/* ── Ce que la partie mesure ─────────────────────────────────────────────── */

const somme = (o) => Object.values(o || {}).reduce((n, v) => n + (Number(v) || 0), 0);

/** Mesures globales. `mine` est la sauvegarde des Mines déjà relue, ou null. */
export function mesuresGlobales(etat, mine) {
  const pj = new Set();
  for (const coll of Object.values(etat.collections || {})) {
    for (const [id, e] of Object.entries(coll || {})) {
      if (id.startsWith("pj-") && ((e?.normale || 0) > 0 || (e?.rainbow || 0) > 0)) pj.add(id);
    }
  }
  return {
    boosters: somme(etat.boosters),
    strate: mine?.profondeurMax || 0,
    effondrements: mine?.effondrements || 0,
    ventes: etat.stats?.ventes || 0,
    affaires: etat.stats?.affaires || 0,
    pj: pj.size,
  };
}

/**
 * Mesures de collection d'une extension. « Posséder », c'est avoir la case
 * normale remplie — le critère de la bibliothèque. La complétion ne compte
 * que le roster : les full art, à une chance sur 4096, rendraient les 100 %
 * inatteignables ; ils ont leur propre famille.
 */
export function mesuresExtension(ext, collection = {}) {
  const a = (c, v) => (collection[c.id]?.[v] || 0) > 0;
  const possedees = ext.roster.filter((c) => a(c, "normale"));
  const type = {};
  for (const c of possedees) type[c.type] = (type[c.type] || 0) + 1;
  return {
    nb: possedees.length,
    total: ext.roster.length,
    // Arrondi par défaut : 100 veut dire toutes, jamais 219 sur 220.
    pct: ext.roster.length ? Math.floor((possedees.length * 100) / ext.roster.length) : 0,
    type,
    legendaires: possedees.filter((c) => c.tier === "legendaire").length,
    irisees: [...ext.roster, ...ext.fullart].filter((c) => a(c, "rainbow")).length,
    fullart: ext.fullart.filter((c) => a(c, "normale") || a(c, "rainbow")).length,
  };
}

const lire = (mesures, chemin) => chemin.split(".").reduce((o, k) => (o ? o[k] : 0), mesures) || 0;

/**
 * Tout le catalogue, confronté à la partie : pour chaque famille sa valeur
 * courante, et pour chaque palier s'il est atteint et s'il a été réclamé.
 */
export function evaluer(catalogue, etat, mine) {
  const reclames = etat.succes || {};
  const g = mesuresGlobales(etat, mine);
  const juger = (f, mesures) => {
    const valeur = lire(mesures, f.mesure);
    return {
      ...f, valeur,
      paliers: f.paliers.map((p) => ({ ...p, atteint: valeur >= p.seuil, reclame: Boolean(reclames[p.id]) })),
    };
  };
  const global = catalogue.global.map((f) => juger(f, g));
  const extensions = catalogue.extensions.map((e) => {
    const m = mesuresExtension(e, (etat.collections || {})[e.id]);
    return { id: e.id, titre: e.titre, mesures: m, familles: e.familles.map((f) => juger(f, m)) };
  });
  const tous = [...global, ...extensions.flatMap((e) => e.familles)];
  const aReclamer = tous.flatMap((f) => f.paliers.filter((p) => p.atteint && !p.reclame).map((p) => p.id));
  return { global, extensions, aReclamer };
}

/** Où va un sachet offert : l'extension de la famille, ou un sachet au choix. */
export const cleSachet = (f) => f.extension || SACHET_LIBRE;

/**
 * Réclame des paliers. Chaque identifiant est revérifié sur la partie telle
 * qu'elle est : un palier inconnu, déjà réclamé ou pas encore atteint est
 * ignoré. Deux clics rapides ne paient donc qu'une fois.
 */
export function reclamer(catalogue, etat, ids, mine, maintenant = Date.now()) {
  const ouverts = new Set(evaluer(catalogue, etat, mine).aReclamer);
  const succes = { ...(etat.succes || {}) };
  const sachets = { ...(etat.sachets || {}) };
  let po = 0;
  const gagnes = [];
  for (const id of new Set(ids)) {
    if (!ouverts.has(id)) continue;
    const { famille: f, palier: p } = catalogue.parId.get(id);
    const r = p.recompense || {};
    const cle = cleSachet(f);
    succes[id] = { t: maintenant, po: r.po || 0, n: r.sachets || 0, cle };
    po += r.po || 0;
    if (r.sachets) sachets[cle] = (sachets[cle] || 0) + r.sachets;
    gagnes.push(id);
  }
  if (!gagnes.length) return { etat, gagnes, po: 0 };
  return { etat: { ...etat, succes, sachets, bourse: crediterGain(etat.bourse, po) }, gagnes, po };
}

/** Les titres gagnés, dans l'ordre du catalogue. */
export function titresObtenus(catalogue, etat) {
  const reclames = etat.succes || {};
  const sortie = [];
  for (const [id, { palier }] of catalogue.parId) {
    if (palier.titre && reclames[id]) sortie.push({ id, titre: palier.titre });
  }
  return sortie;
}

/* ── Classement ──────────────────────────────────────────────────────────── */

/**
 * Le résumé public d'une partie, tel qu'il part dans `classement/{uid}`.
 *
 * Le score est la complétion pondérée de tout le catalogue ouvert, sur dix
 * mille : une légendaire pèse huit communes. Il récompense le collectionneur
 * plutôt que qui a ouvert le plus de sachets — les boosters ont leur colonne.
 */
export function resumeClassement(catalogue, etat, mine) {
  const g = mesuresGlobales(etat, mine);
  const reclames = etat.succes || {};
  let tenu = 0, total = 0;
  const extensions = {};
  const premiers = {};
  for (const e of catalogue.extensions) {
    const coll = (etat.collections || {})[e.id] || {};
    for (const c of e.roster) {
      const w = POIDS_SCORE[c.tier] || 1;
      total += w;
      if ((coll[c.id]?.normale || 0) > 0) tenu += w;
    }
    const m = mesuresExtension(e, coll);
    extensions[e.id] = { pct: m.pct, irisees: m.irisees };
    const complet = reclames[`${e.id}:completion@100`];
    if (complet) premiers[e.id] = complet.t;
  }
  return {
    score: total ? Math.round((tenu * 10000) / total) : 0,
    extensions,
    boosters: g.boosters,
    strate: g.strate,
    succes: Object.keys(reclames).filter((id) => catalogue.parId.has(id)).length,
    premiers,
  };
}

/**
 * Titres de primauté : pour chaque extension, le joueur qui a réclamé ses
 * 100 % le premier. Calculé à la lecture du classement, pas stocké : il n'y a
 * rien à attribuer ni à retirer, seulement une date à comparer.
 */
export function primautes(catalogue, lignes) {
  const sortie = {};
  for (const e of catalogue.extensions) {
    let meilleur = null;
    for (const l of lignes) {
      const t = l.premiers?.[e.id];
      if (typeof t === "number" && (!meilleur || t < meilleur.t)) meilleur = { uid: l.uid, t };
    }
    if (meilleur) sortie[e.id] = { ...meilleur, titre: `Première complétion de ${e.titre}` };
  }
  return sortie;
}
