import { useJeu } from "../jeu/Jeu.jsx";
import { Lien } from "../lib/routeur.jsx";

/**
 * Avis de mouvement réduit.
 *
 * Ne s'affiche que dans un cas : le réglage suit le système, et le système
 * demande moins d'animations. Alors la déchirure du sachet, la lueur qui
 * annonce le palier et les éclats du filon ne se jouent pas — et rien ne le
 * disait, ce qui donnait l'impression d'une application cassée plutôt que
 * d'une préférence respectée. Un bouton suffit à passer outre.
 */
export default function AvisMouvement({ quoi = "les animations" }) {
  const { animations, sobreSysteme, majReglages } = useJeu();
  if (animations !== "systeme" || !sobreSysteme) return null;
  return (
    <p className="avis-mouvement" role="status">
      Votre système demande moins d'animations, donc {quoi} sont coupées.
      {" "}
      <button type="button" onClick={() => majReglages({ animations: "pleines" })}>
        Les activer quand même
      </button>
      {" · "}
      <Lien vers="/reglages" actif={false}>Réglages</Lien>
    </p>
  );
}
