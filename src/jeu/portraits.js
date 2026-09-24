import { useEffect, useState } from "react";
import { INVENTAIRE_EN_COURS } from "../lib/images.js";

/**
 * L'inventaire des portraits publiés, lu une fois au démarrage.
 *
 * Il vit à côté des images (et non dans le dépôt) : publier une illustration
 * ne demande ni commit ni redéploiement du site, les joueurs la voient au
 * chargement suivant. `no-cache` force une revalidation à chaque visite ;
 * tant que rien n'a changé, le serveur répond 304 et rien n'est retéléchargé.
 *
 * Sans inventaire (fichier absent, réseau coupé, JSON illisible), la valeur
 * passe à null : les cartes tentent leur image comme avant, et le monogramme
 * rattrape celles qui n'en ont pas.
 */
export function useInventaire(base) {
  const [inventaire, setInventaire] = useState(INVENTAIRE_EN_COURS);

  useEffect(() => {
    if (!base) {
      setInventaire(null);
      return undefined;
    }
    let actif = true;
    setInventaire(INVENTAIRE_EN_COURS);
    fetch(`${base.replace(/\/+$/, "")}/inventaire.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((inv) => { if (actif) setInventaire(inv && typeof inv.portraits === "object" ? inv : null); })
      .catch(() => { if (actif) setInventaire(null); });
    return () => { actif = false; };
  }, [base]);

  return inventaire;
}
