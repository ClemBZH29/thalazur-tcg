import { useEffect, useRef, useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import { useRoute } from "../lib/routeur.jsx";
import { RELIQUAIRE } from "../config/reliquaire.js";
import { rentrees } from "../expeditions/regles.js";
import "../styles/expeditions.css";

const IMG = `${import.meta.env.BASE_URL}reliquaire/`;

/**
 * L'ouverture du Reliquaire, annoncée une fois.
 *
 * Le Reliquaire reste caché tant qu'aucune extension n'est complétée à 60 % :
 * c'est l'ouverture d'un booster qui fait le plus souvent franchir le seuil,
 * donc l'annonce attend, comme le retour des expéditions, que le joueur soit
 * libre, et qu'aucune autre fenêtre ne soit ouverte. Elle note l'ouverture en
 * s'affichant : le Reliquaire apparaît alors dans la navigation et n'en
 * disparaît plus.
 */
export default function AnnonceReliquaire({ occupe }) {
  const { etat, reliquaireOuvert, seuilReliquaire, ouvrirReliquaire } = useJeu();
  const { aller } = useRoute();
  const [visible, setVisible] = useState(false);
  const [tic, setTic] = useState(0);
  const dlg = useRef(null);

  // Une route rentrée et pas encore accueillie : sa fenêtre de retour va
  // s'ouvrir. Les deux effets tournent dans le même rendu, où ni l'une ni
  // l'autre n'est encore `open` : sans cette attente, elles s'empilaient.
  const retourEnAttente = rentrees(etat).length > 0;
  // Une autre fenêtre (retour d'expédition) peut être ouverte : on repasse plus tard.
  useEffect(() => {
    if (reliquaireOuvert || !seuilReliquaire || occupe || visible) return undefined;
    if (retourEnAttente || document.querySelector("dialog[open]")) {
      const t = setTimeout(() => setTic((n) => n + 1), 2000);
      return () => clearTimeout(t);
    }
    setVisible(true);
    ouvrirReliquaire();
    return undefined;
  }, [reliquaireOuvert, seuilReliquaire, occupe, visible, tic, retourEnAttente, ouvrirReliquaire]);

  useEffect(() => {
    if (visible && dlg.current && !dlg.current.open) dlg.current.showModal();
  }, [visible]);

  if (!visible) return null;
  const fermer = () => { dlg.current?.close(); setVisible(false); };
  return (
    <dialog className="exp-retour rel-annonce" ref={dlg} aria-labelledby="rel-annonce-titre" onClose={() => setVisible(false)}>
      <img className="rel-annonce-coffre" src={`${IMG}reliquaire.webp`} alt="" draggable="false" />
      <h2 id="rel-annonce-titre">Le Reliquaire s'ouvre</h2>
      <p>
        Votre collection passe {Math.round(RELIQUAIRE.ouverture * 100)} %. Le gardien vous ouvre sa crypte :
        dissolvez vos doublons en vestiges depuis la bibliothèque, et forgez avec eux la carte du jour.
      </p>
      <div className="exp-retour-pied rel-annonce-pied">
        <button type="button" className="btn quiet" onClick={fermer}>Plus tard</button>
        <button type="button" className="btn" autoFocus onClick={() => { fermer(); aller("/reliquaire"); }}>Aller au Reliquaire</button>
      </div>
    </dialog>
  );
}
