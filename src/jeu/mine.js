import { useCallback, useState } from "react";
import { crediterGain } from "../lib/economie.js";
import { REGLES_VERSION } from "../mines/regles.js";

/**
 * Ce que l'application sait des Mines de Kazim : les commandes livrées, le
 * solde de la remise à zéro, les conseils de Tafix, et la relecture de la
 * sauvegarde.
 *
 * Plus de conversion ni de plafond ici (refonte du 07/10/2026) : les
 * commandes de Tafix paient en PO du site, à prix fixe, trois par jour au
 * plus. L'économie se règle dans `src/mines/donnees.js` (`COMMANDES`).
 */
export function useMine(etat, setEtat) {
  // Monte de un quand la sauvegarde de la mine a été remplacée de l'extérieur
  // (copie du compte adoptée) : la page des Mines s'en sert de clé, et le
  // module relit sa sauvegarde au lieu d'écraser la nouvelle avec l'ancienne.
  const [versionMine, setVersionMine] = useState(0);
  const rechargerMine = useCallback(() => setVersionMine((v) => v + 1), []);

  /**
   * Une commande livrée. Le crédit passe par la même porte que la revente
   * d'un doublon, donc hors du plafond d'accumulation passive. Deux compteurs
   * pour les missions de Bodégué : les PO rapportées des Mines, et les
   * commandes livrées.
   */
  const crediterCommande = useCallback((po) => {
    if (!(po > 0)) return;
    setEtat((e) => {
      const stats = e.stats || {};
      return {
        ...e,
        bourse: crediterGain(e.bourse, po),
        stats: { ...stats, poMine: (stats.poMine || 0) + po, commandes: (stats.commandes || 0) + 1 },
      };
    });
  }, [setEtat]);

  /**
   * Le solde d'une partie remise à zéro (voir src/mines/remise.js). Versé une
   * seule fois par compte : la marque vit ici, dans l'état du jeu, et non dans
   * la mine — une vieille copie de la mine venue d'un autre appareil se remet
   * à zéro à la relecture et rouvre l'écran, mais ne paie pas deux fois. Il
   * ne compte pas pour les missions : sinon la mission du jour se remplirait
   * toute seule le jour de la mise en production.
   */
  const crediterRemise = useCallback((po) => {
    setEtat((e) => {
      if ((e.mine?.regles || 0) >= REGLES_VERSION) return e;
      return {
        ...e,
        bourse: po > 0 ? crediterGain(e.bourse, po) : e.bourse,
        mine: { regles: REGLES_VERSION },
      };
    });
  }, [setEtat]);
  const remisePayee = (etat.mine?.regles || 0) >= REGLES_VERSION;

  /** Tafix : un conseil vu, un onglet ouvert, ou le silence. */
  const majTafix = useCallback((patch) => {
    setEtat((e) => {
      const t = { vus: [], onglets: [], muet: false, ...(e.tafix || {}) };
      const n = {
        vus: patch.vu && !t.vus.includes(patch.vu) ? [...t.vus, patch.vu] : t.vus,
        onglets: (patch.onglets || []).some((o) => !t.onglets.includes(o))
          ? [...new Set([...t.onglets, ...patch.onglets])] : t.onglets,
        muet: patch.muet !== undefined ? patch.muet : t.muet,
      };
      if (patch.oublier) n.vus = [];
      if (n.vus === t.vus && n.onglets === t.onglets && n.muet === t.muet && !patch.oublier) return e;
      return { ...e, tafix: n };
    });
  }, [setEtat]);

  return { crediterCommande, crediterRemise, remisePayee, majTafix, versionMine, rechargerMine };
}
