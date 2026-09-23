import { useCallback } from "react";
import MinesDeKazim from "../mines/MinesDeKazim.jsx";
import { useJeu } from "../jeu/Jeu.jsx";
import { magasinKazim } from "../lib/storage.js";
import AvisMouvement from "../components/AvisMouvement.jsx";

/**
 * Les Mines de Kazim.
 *
 * La page ne fait plus que porter le module. Elle a porté, un temps, tout un
 * appareil comptable : la pesée du jour, la conversion « une pièce kobolde en
 * vaut quinze ici », le quota de 480 PO et sa jauge. L'intention était de ne
 * pas laisser le plafond se découvrir en silence — mais l'effet était
 * l'inverse : deux monnaies homonymes, un compteur à zéro tant qu'on n'a rien
 * vendu, et un rapprochement avec le gain passif de la boutique, qui n'a rien
 * à faire ici. La mine est du jeu ; les pièces d'or sont l'affaire de la
 * boutique.
 *
 * Le plafond quotidien demeure — il vit dans `crediterMine`, avec la
 * conversion — mais il ne s'annonce plus que le jour où il mord.
 */
export default function PageMines() {
  const { crediterMine, mineJour, versionMine, test } = useJeu();

  const surPO = useCallback((brut) => crediterMine(brut), [crediterMine]);
  const plafondAtteint = mineJour.credite >= mineJour.plafond;

  return (
    <main className="view large mines" id="contenu">
      <div className="section-titre">
        <h1>Les Mines de Kazim</h1>
      </div>

      {/* La seule phrase que la page se réserve, et seulement le jour où les
          kobolds ont soldé leurs comptes : sans elle, la mine cesserait de
          payer sans un mot, ce qui serait déloyal. */}
      {plafondAtteint && (
        <p className="mine-plafond" role="status">
          Les kobolds ont soldé leurs comptes pour aujourd'hui. La mine tourne
          toujours, ils paieront demain.
        </p>
      )}

      <AvisMouvement quoi="les éclats et les secousses du filon" />

      <MinesDeKazim
        key={versionMine}
        onPO={surPO}
        storage={magasinKazim}
        godPioche={test.actif && test.godPioche}
        spritesBase={`${import.meta.env.BASE_URL}kazim/`}
      />

    </main>
  );
}
