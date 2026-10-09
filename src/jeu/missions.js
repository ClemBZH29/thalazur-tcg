import { useCallback, useEffect, useMemo, useState } from "react";
import { CATALOGUE } from "../succes/catalogue.js";
import {
  contexte, delaiControle, echeances, evaluerMissions, mesuresMissions, mettreAJour, noterVu, reclamerMission, remplacerMission,
} from "../missions/regles.js";

/** Les extensions ouvertes et leurs cartes : de quoi savoir ce qui manque encore. */
const EXTENSIONS = CATALOGUE.extensions.map((e) => ({ id: e.id, roster: e.roster }));

const autour = (e) => ({ mesures: mesuresMissions(e), ctx: contexte(e, EXTENSIONS) });

/** Le passage du jour ou de la semaine, s'il est dû. */
const passer = (e) => mettreAJour(e, { ...autour(e), maintenant: new Date() });

/**
 * Les missions de Bodégué, vues de l'application. Le tirage se fait au
 * premier rendu du jour, puis au passage de minuit pour une page restée
 * ouverte : un rendez-vous réglé sur minuit (`delaiControle`), une
 * vérification chaque minute, et au retour sur l'onglet. Tout se recalcule
 * dans le setter, sur l'état du moment.
 *
 * Limite qui reste : un geste qui fait bouger un compteur (ouvrir un booster,
 * vendre…) dans le quart de seconde qui suit minuit, ou au réveil d'un
 * ordinateur avant que le minuteur ne repasse, compte encore pour la veille.
 * Réclamer et remplacer, eux, font toujours passer le jour d'abord.
 */
export function useMissions(etat, setEtat, pret = true) {
  const [horloge, setHorloge] = useState(() => Date.now());
  useEffect(() => {
    // Un minuteur à la fois, refait à chaque tic : il tombe à minuit pile
    // quand minuit vient avant la minute suivante.
    const t = setTimeout(() => setHorloge(Date.now()), delaiControle(new Date()));
    return () => clearTimeout(t);
  }, [horloge]);
  useEffect(() => {
    // Les minuteurs dorment avec l'onglet caché ou l'ordinateur en veille.
    const vu = () => { if (!document.hidden) setHorloge(Date.now()); };
    document.addEventListener("visibilitychange", vu);
    window.addEventListener("focus", vu);
    return () => { document.removeEventListener("visibilitychange", vu); window.removeEventListener("focus", vu); };
  }, []);
  // `pret` : la copie du compte est lue (voir `compteLu` dans Jeu.jsx). Avant,
  // ni tirage ni réclamation : ils porteraient sur une partie en retard.
  useEffect(() => {
    if (!pret) return;
    setEtat((e) => passer(e));
  }, [horloge, pret, setEtat]);

  const evaluation = useMemo(() => evaluerMissions(etat, mesuresMissions(etat)), [etat]);

  // Le jour passe d'abord : juste après minuit, un clic sur une mission de la
  // veille la paie par le passage (si elle était remplie) au lieu de viser la
  // mission du même rang du nouveau jour.
  const reclamer = useCallback((index) => {
    if (pret) setEtat((e0) => { const e = passer(e0); return reclamerMission(e, index, mesuresMissions(e)); });
  }, [pret, setEtat]);
  /** `jour` : celui des missions affichées quand le joueur a demandé le remplacement. */
  const remplacer = useCallback((index, jour) => {
    if (pret) setEtat((e0) => { const e = passer(e0); return remplacerMission(e, index, { ...autour(e), jour }); });
  }, [pret, setEtat]);

  /** Retient la progression affichée, pour l'animer au retour sur la page. */
  const noter = useCallback(() => {
    setEtat((e) => noterVu(e, mesuresMissions(e)));
  }, [setEtat]);

  return {
    ...evaluation, echeances: echeances(new Date(horloge)), reclamer, remplacer, noterVu: noter,
    jour: etat.missions?.jour || "", remplacees: etat.missions?.remplacees || 0,
  };
}
