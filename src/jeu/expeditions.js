import { useCallback, useMemo } from "react";
import { BOOSTERS } from "../extensions/index.js";
import { cartesDonjon } from "../donjon/regles.js";
import { cleXP, entrainer } from "../donjon/experience.js";
import { ENTRAINEMENT } from "../config/reliquaire.js";
import * as F from "../donjon/fiches.js";
import { crediterGain } from "../lib/economie.js";
import * as X from "../expeditions/regles.js";
import * as R from "../reliquaire/regles.js";

/**
 * Ce que l'application sait des Expéditions et du Reliquaire.
 *
 * Les règles sont pures (src/expeditions/, src/reliquaire/) ; ici, on les
 * branche sur l'état du jeu. Les cartes viennent du même inventaire que le
 * Donjon : alliés (PNJ non hostiles), Lieux et artéfacts de toutes les
 * extensions ouvertes, chacun avec son `ext`.
 */
const POOLS = cartesDonjon(BOOSTERS);
const INDEX = Object.fromEntries(POOLS.toutes.map((c) => [cleXP(c), c]));
const TROUVAILLES = POOLS.toutes.filter((c) => c.tier !== "legendaire");
/** Les cartes de chaque extension ouverte, pour le seuil d'ouverture du Reliquaire. */
const PAR_EXTENSION = POOLS.toutes.reduce((m, c) => ({ ...m, [c.ext]: [...(m[c.ext] || []), c] }), {});

const possede = (collections, c) => (collections?.[c.ext]?.[c.id]?.normale || 0) > 0;

export function useExpeditions(etat, setEtat) {
  const ex = X.etatExpeditions(etat);

  const collections = etat.collections;
  const compagnons = useMemo(() => POOLS.allies.filter((c) => possede(collections, c)), [collections]);
  const lieux = useMemo(() => POOLS.lieux.filter((c) => possede(collections, c)), [collections]);

  const partirExpedition = useCallback((lieu, cartes, heures) => {
    const essai = X.partir(etat, { lieu, cartes, heures, pool: TROUVAILLES });
    if (essai.erreur) return false;
    // Rejoué sur l'état le plus frais : un double clic ne fait pas partir deux fois.
    setEtat((e) => { const r = X.partir(e, { lieu, cartes, heures, pool: TROUVAILLES, maintenant: essai.route.depart }); return r.erreur ? e : r.etat; });
    return true;
  }, [etat, setEtat]);

  const rappelerExpedition = useCallback((id) => setEtat((e) => X.rappeler(e, id)), [setEtat]);

  /**
   * Crédite toutes les routes rentrées et rend leurs bilans, pour la fenêtre
   * de retour. Même principe que la fin du Donjon : le bilan se lit sur l'état
   * du moment, le setter refait le crédit sur l'état le plus frais.
   */
  const accueillirExpeditions = useCallback(() => {
    const t = Date.now();
    const dues = X.rentrees(etat, t);
    if (!dues.length) return [];
    let e = etat;
    const bilans = [];
    for (const r of dues) {
      const res = X.crediterRoute(e, r.id, INDEX, t);
      e = res.etat;
      if (res.bilan) bilans.push(res.bilan);
    }
    setEtat((e0) => dues.reduce((acc, r) => X.crediterRoute(acc, r.id, INDEX, t).etat, e0));
    return bilans;
  }, [etat, setEtat]);

  const empechement = useCallback((c) => X.empechement(etat, c), [etat]);

  /* ── Reliquaire ─────────────────────────────────────────────────── */
  const dissoudreCarte = useCallback((ext, c, n = 1) => setEtat((e) => R.dissoudre(e, ext, c, n)), [setEtat]);
  const reliquaireOuvert = R.estOuvert(etat);
  const seuilReliquaire = useMemo(() => R.seuilAtteint({ collections }, PAR_EXTENSION), [collections]);
  const ouvrirReliquaire = useCallback(() => setEtat((e) => R.ouvrir(e)), [setEtat]);
  const forgerOffre = useCallback((offre) => {
    const ok = R.peutForgerOffre(etat, offre);
    if (ok) setEtat((e) => R.forgerOffre(e, offre));
    return ok;
  }, [etat, setEtat]);

  /* ── Entraînement : des doublons contre de l'expérience ─────────────── */
  /**
   * Même principe que la fin du Donjon : le bilan se lit sur l'état du
   * moment, le setter refait l'opération sur l'état le plus frais. Les PO
   * d'un palier d'irisation déjà acquis vont à la bourse.
   */
  const entrainerCarte = useCallback((ext, c, n) => {
    const carte = { ...c, ext };
    const gain = ENTRAINEMENT.xp[c.tier] || 0;
    const r = entrainer(etat, carte, n, gain);
    if (r.etat === etat) return null;
    setEtat((e0) => {
      const { etat: e, po } = entrainer(e0, carte, n, gain);
      return po ? { ...e, bourse: crediterGain(e.bourse, po) } : e;
    });
    return r;
  }, [etat, setEtat]);

  /* ── Fiche de combat : des vestiges et des rainbow contre des compétences ── */
  // Chaque opération est vérifiée sur l'état du moment (pour dire si elle a
  // eu lieu), puis rejouée sur l'état le plus frais.
  const operer = useCallback((f) => {
    if (!f(etat)) return false;
    setEtat((e) => f(e) || e);
    return true;
  }, [etat, setEtat]);
  const acheterRangCarte = useCallback((c, ligne) => operer((e) => F.acheterRang(e, c, ligne)), [operer]);
  const changerCompetenceCarte = useCallback((c, id) => operer((e) => F.changerCompetence(e, c, id)), [operer]);
  const etoilerCarte = useCallback((c, ligne) => operer((e) => F.etoiler(e, c, ligne)), [operer]);

  return {
    expeditions: ex,
    acheterRangCarte, changerCompetenceCarte, etoilerCarte,
    compagnons, lieux,
    indexCartes: INDEX,
    partirExpedition, rappelerExpedition, accueillirExpeditions,
    empechementExpedition: empechement,
    enExpedition: (c) => X.enRoute(etat).has(cleXP(c)),
    vestiges: R.vestiges(etat),
    dissoudreCarte, forgerOffre, entrainerCarte,
    reliquaireOuvert, seuilReliquaire, ouvrirReliquaire,
  };
}
