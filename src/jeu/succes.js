import { useCallback, useEffect, useMemo, useState } from "react";
import { CATALOGUE } from "../succes/catalogue.js";
import { evaluer, reclamer as reclamerPur, titresObtenus } from "../succes/regles.js";
import { lireMine, suivreMine } from "../lib/storage.js";

/**
 * Ce que les succès et le classement lisent de la mine : des compteurs qui
 * ne reculent jamais (strate la plus profonde, effondrements, faveurs du
 * Fossoyeur reçues, éclats gagnés).
 * La mine vit hors de l'état React et se sauve toutes les quinze secondes ;
 * on n'en retient que ces deux nombres, et l'état ne change que s'ils bougent.
 */
function lireProgresMine(brut) {
  try {
    const m = JSON.parse(brut);
    return m ? {
      profondeurMax: m.profondeurMax || 0,
      effondrements: m.effondrements || 0,
      faveurs: Array.isArray(m.faveurs) ? m.faveurs.length : 0,
      // Les éclats gagnés au total : offrir au Fossoyeur ne les retire pas.
      eclats: Math.floor(m.eclats || 0),
    } : null;
  } catch { return null; }
}

const memeMine = (a, b) =>
  (a?.profondeurMax || 0) === (b?.profondeurMax || 0) && (a?.effondrements || 0) === (b?.effondrements || 0)
  && (a?.faveurs || 0) === (b?.faveurs || 0) && (a?.eclats || 0) === (b?.eclats || 0);

export function useSucces(etat, setEtat, versionMine) {
  const [mine, setMine] = useState(() => lireProgresMine(lireMine()));

  // Sauvegarde du module, ou mine adoptée depuis le compte (versionMine).
  useEffect(() => {
    const relire = (brut) => {
      const m = lireProgresMine(brut ?? lireMine());
      setMine((avant) => (memeMine(avant, m) ? avant : m));
    };
    relire();
    return suivreMine(relire);
  }, [versionMine]);

  const evaluation = useMemo(() => evaluer(CATALOGUE, etat, mine), [etat, mine]);
  const titres = useMemo(() => titresObtenus(CATALOGUE, etat), [etat.succes]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Réclame des paliers. Le calcul se refait dans le setter, sur l'état du
   * moment : c'est lui qui refuse un palier déjà payé.
   */
  const reclamer = useCallback((ids) => {
    setEtat((e) => reclamerPur(CATALOGUE, e, ids, mine).etat);
  }, [setEtat, mine]);

  /**
   * Réclame et rend aussitôt ce qui a été gagné ({ po, sachets: { clé: n } }),
   * pour les pièces et les boosters qui volent dans le grimoire. Le calcul
   * sur `etat` ne sert qu'à l'annonce : le setter refait la réclamation sur
   * l'état du moment, et c'est lui qui paie.
   */
  const reclamerAvecGains = useCallback((ids) => {
    const r = reclamerPur(CATALOGUE, etat, ids, mine);
    const sachets = {};
    for (const [cle, n] of Object.entries(r.etat.sachets || {})) {
      const d = n - ((etat.sachets || {})[cle] || 0);
      if (d > 0) sachets[cle] = d;
    }
    setEtat((e) => reclamerPur(CATALOGUE, e, ids, mine).etat);
    return { po: r.po, sachets };
  }, [etat, setEtat, mine]);

  return { catalogue: CATALOGUE, evaluation, aReclamer: evaluation.aReclamer, titres, mine, reclamer, reclamerAvecGains };
}
