import { useCallback } from "react";
import { jourLocal, passeAujourdhui, propositions } from "../config/colporteur.js";

export function useColporteur({ etat, setEtat, boosterId, pool, ouverts, test }) {
  /**
   * Le passage du colporteur, décidé une fois par booster ouvert.
   *
   * La décision et les propositions vivent au même endroit parce qu'elles
   * dépendent des mêmes choses : la date locale, le compteur de boosters
   * depuis sa dernière visite, et l'état de la collection *après* récolte —
   * c'est ce qui lui permet de proposer d'emporter les doublons qui viennent
   * tout juste de sortir du sachet.
   */
  const tirerVisiteColporteur = useCallback(() => {
    if (test.actif && test.colporteur === "jamais") return null;
    const jour = jourLocal();
    const memoire = etat.colporteur;
    const force = test.actif && test.colporteur === "toujours";
    const vient = force || passeAujourdhui(memoire, ouverts, Math.random, jour);

    if (!vient) {
      setEtat((e) => ({
        ...e,
        colporteur: { jour: (e.colporteur && e.colporteur.jour) || null,
                      depuis: ((e.colporteur && e.colporteur.depuis) || 0) + 1 },
      }));
      return null;
    }

    const deals = propositions(
      { collection: etat.collections[boosterId] || {}, pool, bourse: etat.bourse },
      // Graine stable pour la journée et le rang du booster : rouvrir la page
      // pendant la visite ne rebat pas les prix.
      Number(jour.replaceAll("-", "")) + ouverts
    );
    if (!deals.length) return null;

    if (!force) setEtat((e) => ({ ...e, colporteur: { jour, depuis: 0 } }));
    return { jour, deals };
  }, [etat, setEtat, boosterId, pool, ouverts, test]);


  return tirerVisiteColporteur;
}
