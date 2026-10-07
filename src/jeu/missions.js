import { useCallback, useEffect, useMemo, useState } from "react";
import { CATALOGUE } from "../succes/catalogue.js";
import {
  contexte, echeances, evaluerMissions, mesuresMissions, mettreAJour, noterVu, reclamerMission, remplacerMission,
} from "../missions/regles.js";

/** Les extensions ouvertes et leurs cartes : de quoi savoir ce qui manque encore. */
const EXTENSIONS = CATALOGUE.extensions.map((e) => ({ id: e.id, roster: e.roster }));

const autour = (e) => ({ mesures: mesuresMissions(e), ctx: contexte(e, EXTENSIONS) });

/**
 * Les missions de Bodégué, vues de l'application. Le tirage se fait au
 * premier rendu du jour, puis au passage de minuit pour une page restée
 * ouverte (vérifié chaque minute). Tout se recalcule dans le setter, sur
 * l'état du moment.
 */
export function useMissions(etat, setEtat) {
  const [horloge, setHorloge] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setHorloge(Date.now()), 60000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    setEtat((e) => mettreAJour(e, { ...autour(e), maintenant: new Date() }));
  }, [horloge, setEtat]);

  const evaluation = useMemo(() => evaluerMissions(etat, mesuresMissions(etat)), [etat]);

  const reclamer = useCallback((index) => {
    setEtat((e) => reclamerMission(e, index, mesuresMissions(e)));
  }, [setEtat]);
  const remplacer = useCallback((index) => {
    setEtat((e) => remplacerMission(e, index, autour(e)));
  }, [setEtat]);

  /** Retient la progression affichée, pour l'animer au retour sur la page. */
  const noter = useCallback(() => {
    setEtat((e) => noterVu(e, mesuresMissions(e)));
  }, [setEtat]);

  return {
    ...evaluation, echeances: echeances(new Date(horloge)), reclamer, remplacer, noterVu: noter,
    jour: etat.missions?.jour || "", remplacees: etat.missions?.remplacees || 0,
  };
}
