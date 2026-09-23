import { useCallback, useState } from "react";
import { MINE } from "../config/tiers.js";
import { crediterGain } from "../lib/economie.js";

/** Ce que l'application sait des Mines de Kazim : le crédit des PO et sa relecture. */
export function useMine(etat, setEtat) {
  // Monte de un quand la sauvegarde de la mine a été remplacée de l'extérieur
  // (copie du compte adoptée) : la page des Mines s'en sert de clé, et le
  // module relit sa sauvegarde au lieu d'écraser la nouvelle avec l'ancienne.
  const [versionMine, setVersionMine] = useState(0);
  const rechargerMine = useCallback(() => setVersionMine((v) => v + 1), []);
  /**
   * Les kobolds de Kazim paient. Le crédit passe par la même porte que la
   * revente d'un doublon, donc hors du plafond d'accumulation passive : borner
   * ce que le joueur est allé chercher lui-même n'aurait aucun sens.
   *
   * Deux choses se passent ici et pas dans le module. La conversion, parce que
   * c'est l'application qui sait ce qu'un PO vaut chez elle. Et le plafond
   * quotidien, indexé sur la date locale : sans lui, deux heures de frappe par
   * jour rapportaient cinq fois trente minutes, la mine devenant le jeu et les
   * boosters un accessoire.
   */
  const crediterMine = useCallback((poBrut) => {
    const aujourdhui = new Date().toLocaleDateString("sv");  // AAAA-MM-JJ, local
    setEtat((e) => {
      const jour = e.mine && e.mine.jour === aujourdhui ? e.mine : { jour: aujourdhui, credite: 0 };
      const reste = Math.max(0, MINE.plafondJour - jour.credite);
      const po = Math.min(Math.round(poBrut * MINE.multiplicateur), reste);
      if (po <= 0) return { ...e, mine: jour };
      return {
        ...e,
        bourse: crediterGain(e.bourse, po),
        mine: { jour: aujourdhui, credite: jour.credite + po },
      };
    });
  }, [setEtat]);

  const mineJour = (() => {
    const aujourdhui = new Date().toLocaleDateString("sv");
    const m = etat.mine && etat.mine.jour === aujourdhui ? etat.mine : null;
    return { credite: m ? m.credite : 0, plafond: MINE.plafondJour };
  })();


  return { crediterMine, mineJour, versionMine, rechargerMine };
}
