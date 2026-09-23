import { ECONOMIE } from "../config/tiers.js";
import { attenteAvantAchat, formatDuree } from "../lib/economie.js";
import { useJeu } from "../jeu/Jeu.jsx";
import { Lien } from "../lib/routeur.jsx";

/**
 * L'accueil est un écran de présentation, et rien d'autre.
 *
 * Il a porté un moment l'avancement de la collection et quatre entrées de
 * module, ce qui en faisait un tableau de bord — or la navigation est déjà en
 * haut de chaque page, et l'avancement est le sujet de la bibliothèque. Un
 * écran d'accueil qui répète le menu ne dit rien de plus, il dit moins fort.
 * Il reste donc le titre, la promesse, et par où entrer.
 */
export default function PageAccueil() {
  const { bourse, gratuit } = useJeu();
  const attente = attenteAvantAchat(bourse);
  const achetable = gratuit || bourse.po >= ECONOMIE.prix;

  return (
    <main className="view accueil" id="contenu">
      <section className="hero">
        <div className="horizon" />
        <h1>La Brume de Thalazur</h1>
        <p className="sous">La campagne maintenant en jeu de cartes à collectionner</p>
        <p className="lede">
          Collectionnez les personnages, les lieux et les objets magiques de la
          campagne grâce aux extensions retraçant ses grands arcs. Ouvrez des
          boosters, écoulez vos doublons au Comptoir, creusez les Mines de Kazim
          pour financer la suite.
        </p>
        <div className="hero-actions">
          <Lien vers="/boutique" className="btn" actif={false}>
            {achetable ? "Ouvrir un booster" : "Voir la boutique"}
          </Lien>
          <Lien vers="/bibliotheque" className="btn quiet" actif={false}>
            Ma bibliothèque
          </Lien>
        </div>
        {!achetable && (
          <p className="patience hero-patience">
            Prochain booster abordable dans {formatDuree(attente)} · les Mines de
            Kazim paient plus vite
          </p>
        )}
      </section>
    </main>
  );
}
