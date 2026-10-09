import { useCallback, useState } from "react";
import { crediterGain } from "../lib/economie.js";
import { PO_COMMANDES_JOUR, REGLES_VERSION, jourLocal } from "../mines/regles.js";

/**
 * Une commande livrée, versée à l'état du jeu. Pure, pour les tests.
 *
 * Plafond quotidien (audit du 09/10/2026) : jamais plus que ce que les
 * commandes d'un jour peuvent payer (`PO_COMMANDES_JOUR`). La mine ne renouvelle
 * plus ses commandes quand l'horloge recule ; ce plafond ferme les autres
 * portes — une vieille copie de la mine réimportée avec ses commandes du
 * matin, par exemple. Le compte du jour vit dans la marque des Mines
 * (`etat.mine.livre`), à côté de la remise payée.
 */
export function crediterLivraison(e, po, jour = jourLocal()) {
  if (!(po > 0)) return e;
  const marque = e.mine || {};
  // Une commande d'un jour déjà passé (livrée juste après minuit) n'efface pas
  // le compte du jour en cours : elle est versée, dans la limite d'un jour.
  const ancienne = marque.livre?.jour && jour < marque.livre.jour;
  const deja = !ancienne && marque.livre?.jour === jour ? marque.livre.po || 0 : 0;
  const verse = Math.min(po, Math.max(0, PO_COMMANDES_JOUR - deja));
  if (!(verse > 0)) return e;
  const stats = e.stats || {};
  return {
    ...e,
    bourse: crediterGain(e.bourse, verse),
    stats: { ...stats, poMine: (stats.poMine || 0) + verse, commandes: (stats.commandes || 0) + 1 },
    mine: ancienne ? marque : { ...marque, livre: { jour, po: deja + verse } },
  };
}

/**
 * Le solde de la remise à zéro, versé une fois. La marque garde la version
 * des règles payée et le solde versé : deux appareils qui rouvrent la mine
 * avant de s'être synchronisés ont chacun versé le solde, et la fusion
 * (`fusionner3`) en reprend un, comme un succès réclamé des deux côtés.
 */
export function crediterSolde(e, po) {
  if ((e.mine?.regles || 0) >= REGLES_VERSION) return e;
  const solde = po > 0 ? po : 0;
  return {
    ...e,
    bourse: solde > 0 ? crediterGain(e.bourse, solde) : e.bourse,
    mine: { ...(e.mine || {}), regles: REGLES_VERSION, solde },
  };
}

/**
 * Ce que l'application sait des Mines de Kazim : les commandes livrées, le
 * solde de la remise à zéro, les conseils de Tafix, et la relecture de la
 * sauvegarde.
 *
 * Plus de conversion ici (refonte du 07/10/2026) : les commandes de Tafix
 * paient en PO du site, à prix fixe, trois par jour (quatre avec la Faveur).
 * L'économie se règle dans `src/mines/donnees.js` (`COMMANDES`) ; le seul
 * plafond, garde-fou, est ce qu'un jour de commandes peut payer.
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
  const crediterCommande = useCallback((po, jour) => {
    if (!(po > 0)) return;
    setEtat((e) => crediterLivraison(e, po, jour || undefined));
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
    setEtat((e) => crediterSolde(e, po));
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
