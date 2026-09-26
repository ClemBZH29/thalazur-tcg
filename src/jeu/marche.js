import { useCallback } from "react";
import { crediterGain, debiterLibre } from "../lib/economie.js";

/** Ajoute `n` à un compteur de `etat.stats` (les succès les lisent). */
export const compte = (e, cle, n = 1) => ({ ...(e.stats || {}), [cle]: ((e.stats || {})[cle] || 0) + n });

/**
 * Les mouvements d'inventaire et de bourse du Comptoir et du colporteur,
 * sur l'extension courante.
 */
export function useMouvements(setEtat, boosterId) {
  /** Vente au Comptoir : n exemplaires quittent l'inventaire, les PO entrent. */
  const vendreExemplaires = useCallback((carteId, version, n, po) => {
    setEtat((e) => {
      const coll = { ...(e.collections[boosterId] || {}) };
      const a = coll[carteId];
      if (!a) return e;
      coll[carteId] = { ...a, [version]: Math.max(0, (a[version] || 0) - n) };
      return {
        ...e,
        collections: { ...e.collections, [boosterId]: coll },
        bourse: crediterGain(e.bourse, po),
        stats: compte(e, "ventes", n),
      };
    });
  }, [setEtat, boosterId]);

  /** Achat d'une carte à l'échoppe : les PO sortent, l'exemplaire entre. */
  const acheterExemplaire = useCallback((carte, version, po) => {
    setEtat((e) => {
      const coll = { ...(e.collections[boosterId] || {}) };
      const a = coll[carte.id];
      coll[carte.id] = {
        normale: 0, rainbow: 0, ...(a || {}),
        [version]: ((a && a[version]) || 0) + 1,
        carte,
      };
      return {
        ...e,
        collections: { ...e.collections, [boosterId]: coll },
        bourse: debiterLibre(e.bourse, po),
        stats: compte(e, "achats"),
      };
    });
  }, [setEtat, boosterId]);

  /**
   * Un échange du colporteur, appliqué d'un bloc.
   *
   * Le Comptoir n'avait besoin que de vendre ou d'acheter un exemplaire à la
   * fois. Les affaires de Mirko déplacent plusieurs lignes à la fois — trois
   * doublons contre une carte neuve, tout un lot contre des pièces — et cela
   * doit tomber en une seule écriture : un troc appliqué en deux temps
   * laisserait, si le rendu s'intercale, une collection allégée sans sa
   * contrepartie.
   */
  const appliquerMarche = useCallback(({ retire = [], ajoute = [], po = 0 }) => {
    setEtat((e) => {
      const coll = { ...(e.collections[boosterId] || {}) };
      for (const r of retire) {
        const a = coll[r.carteId];
        if (!a) continue;
        coll[r.carteId] = { ...a, [r.version]: Math.max(0, (a[r.version] || 0) - r.n) };
      }
      for (const j of ajoute) {
        const a = coll[j.carte.id];
        coll[j.carte.id] = {
          normale: 0, rainbow: 0, ...(a || {}),
          [j.version]: ((a && a[j.version]) || 0) + (j.n || 1),
          carte: j.carte,
        };
      }
      const bourse = po >= 0 ? crediterGain(e.bourse, po) : debiterLibre(e.bourse, -po);
      return {
        ...e, collections: { ...e.collections, [boosterId]: coll }, bourse,
        stats: compte(e, "affaires"),
      };
    });
  }, [setEtat, boosterId]);

  const majComptoir = useCallback((sauve) => {
    setEtat((e) => ({ ...e, comptoir: { ...(e.comptoir || {}), [boosterId]: sauve } }));
  }, [setEtat, boosterId]);

  /** Compteur seul, pour ce qui ne passe pas par un mouvement (la botte de Mirko). */
  const compter = useCallback((cle, n = 1) => {
    setEtat((e) => ({ ...e, stats: compte(e, cle, n) }));
  }, [setEtat]);

  return { vendreExemplaires, acheterExemplaire, appliquerMarche, majComptoir, compter };
}
