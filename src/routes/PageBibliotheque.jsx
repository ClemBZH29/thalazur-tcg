import Bibliotheque from "../components/Bibliotheque.jsx";
import { useJeu } from "../jeu/Jeu.jsx";
import { useRoute } from "../lib/routeur.jsx";

export default function PageBibliotheque() {
  const jeu = useJeu();
  const { aller } = useRoute();
  return (
    <Bibliotheque
      etat={jeu.etat}
      boosterId={jeu.boosterId}
      jeuComplet={jeu.jeuComplet}
      onSet={jeu.setBoosterId}
      cfgImage={jeu.cfgImage}
      fichiers={jeu.fichiers}
      onLoupe={jeu.setLoupe}
      onOuvrir={() => aller("/boutique")}
      onEtat={jeu.setEtat}
      onAvis={jeu.setAvis}
    />
  );
}
