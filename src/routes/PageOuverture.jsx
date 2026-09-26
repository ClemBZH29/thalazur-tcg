import { useEffect } from "react";
import Ouverture from "../components/Ouverture.jsx";
import { BOOSTER_PAR_ID } from "../extensions/index.js";
import { useJeu } from "../jeu/Jeu.jsx";
import { useRoute } from "../lib/routeur.jsx";

/**
 * L'ouverture a sa propre adresse : « /boutique/troupe-valeran ». Un rechargement
 * pendant la cérémonie y revient, et le bouton « retour » du navigateur ramène
 * à l'étagère au lieu de sortir du site.
 */
export default function PageOuverture({ id }) {
  const jeu = useJeu();
  const { aller, remplacer } = useRoute();
  const booster = BOOSTER_PAR_ID[id];
  const ouvrable = booster && booster.statut === "ouvert";

  // L'extension de l'adresse est celle qui pilote tout le reste : le pool, les
  // spéciales, la collection. Elle doit être posée avant le premier rendu utile.
  useEffect(() => {
    if (ouvrable && jeu.boosterId !== id) jeu.setBoosterId(id);
  }, [ouvrable, id, jeu.boosterId]);

  useEffect(() => {
    if (!ouvrable) remplacer("/boutique");
  }, [ouvrable]);

  if (!ouvrable || jeu.boosterId !== id) {
    return (
      <main className="view" id="contenu">
        <p className="muted" role="status">Ouverture du sachet…</p>
      </main>
    );
  }

  return (
    <Ouverture
      booster={booster}
      pool={jeu.pool}
      speciales={jeu.speciales}
      taux={jeu.taux}
      test={jeu.test}
      gratuit={jeu.gratuit}
      bourse={jeu.bourse}
      collection={jeu.collection}
      mouvementReduit={jeu.mouvementReduit}
      garantirLegendaire={jeu.garantirLegendaire}
      enCours={jeu.etat.enCours}
      onProgres={jeu.majProgres}
      onFini={jeu.finirOuverture}
      cfgImage={jeu.cfgImage}
      fichiers={jeu.fichiers}
      sfx={jeu.sfx}
      ouverts={jeu.ouverts}
      onRecolte={jeu.recolter}
      onLoupe={jeu.setLoupe}
      onColporteur={jeu.tirerVisiteColporteur}
      onAffaire={(deal, extra) => jeu.appliquerMarche(extra.effet)}
      onBotte={() => jeu.compter("affaires")}
      sachet={jeu.sachetOffert}
      onRetour={() => aller("/boutique")}
      onBibliotheque={() => aller("/bibliotheque")}
    />
  );
}
