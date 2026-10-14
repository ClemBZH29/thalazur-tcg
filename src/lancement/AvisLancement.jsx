import { useEffect, useRef } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import { DOS_PAR_ID } from "../config/dos.js";
import { DOS_BETA } from "../lib/sauvegarde/dos-beta.js";
import { effacerSecours } from "../lib/storage.js";
import "../styles/lancement.css";

const BASE = import.meta.env.BASE_URL;

/** L'avis attend-il sa validation ? */
export const avisEnAttente = (etat) => etat?.lancement?.avis === "a-lire";

/**
 * L'avis du lancement, montré à qui avait une partie pendant la bêta.
 *
 * Il prend la place du site, il ne se pose pas par-dessus : tant qu'il n'est
 * pas validé, `App.jsx` ne monte pas la coque. Il ne se ferme ni par Échap
 * ni par un clic à côté, et le supprimer avec l'inspecteur laisse une page
 * vide. Surtout, la partie est déjà remise à zéro quand il s'affiche
 * (migration 11, src/lib/sauvegarde/lancement.js) : il n'y a rien à
 * récupérer en le contournant.
 */
export default function AvisLancement() {
  const { setEtat } = useJeu();
  const bouton = useRef(null);
  const dos = DOS_PAR_ID[DOS_BETA];

  useEffect(() => { bouton.current?.focus(); }, []);

  const valider = () => {
    // La copie de secours de l'appareil date de la bêta : elle part aussi.
    effacerSecours();
    setEtat((s) => ({ ...s, lancement: { ...(s.lancement || {}), avis: "lu", t: Date.now() } }));
  };

  return (
    <main className="avis-lancement" id="contenu">
      <section className="al-carte" role="alertdialog" aria-modal="true"
        aria-labelledby="al-titre" aria-describedby="al-texte">
        <div className="al-dos" aria-hidden="true">
          <div className="al-dos-carte" style={{ background: dos.fond }}>
            <img src={`${BASE}${dos.fichier}`} alt="" draggable="false" />
          </div>
        </div>
        <div className="al-corps">
          <p className="al-sur">Le site ouvre ses portes</p>
          <h1 id="al-titre">Merci, éclaireur.</h1>
          <div id="al-texte">
            <p>
              Vous avez arpenté Thalazur pendant la bêta. Pour que tout le monde
              parte de la même ligne, <b>votre partie de test repart de zéro</b> :
              collection, PO, Mines, Donjon, expéditions, succès.
            </p>
            <p>
              En remerciement, le <b>{dos.nom}</b> est à vous. Il habille déjà vos
              cartes, et seuls les bêta-testeurs l'auront jamais. Votre pseudo et
              vos préférences sont conservés.
            </p>
          </div>
          <button ref={bouton} type="button" className="btn al-ok" onClick={valider}>
            J'ai compris, commencer l'aventure
          </button>
        </div>
      </section>
    </main>
  );
}
