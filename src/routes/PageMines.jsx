import MinesDeKazim from "../mines/MinesDeKazim.jsx";
import { useJeu } from "../jeu/Jeu.jsx";
import { magasinKazim } from "../lib/storage.js";
import AvisMouvement from "../components/AvisMouvement.jsx";

/**
 * Les Mines de Kazim.
 *
 * La page ne fait que porter le module. Elle a porté un temps tout un appareil
 * comptable (la pesée du jour, la conversion « une pièce kobolde en vaut quinze
 * ici », le quota de 480 PO), puis la seule phrase du plafond quotidien. Les
 * deux sont partis avec la vente aux kobolds (07/10/2026) : les commandes de
 * Tafix paient en PO du site, à prix fixe, et c'est le module qui le dit.
 */
export default function PageMines() {
  const {
    crediterCommande, crediterRemise, remisePayee, majTafix, tafix, versionMine, test,
  } = useJeu();

  return (
    <main className="view large mines" id="contenu">
      <div className="section-titre">
        <h1>Les Mines de Kazim</h1>
      </div>

      <AvisMouvement quoi="les éclats et les secousses du filon" />

      <MinesDeKazim
        key={versionMine}
        onCommande={crediterCommande}
        onRemise={crediterRemise}
        remisePayee={remisePayee}
        tafix={tafix}
        onTafix={majTafix}
        storage={magasinKazim}
        godPioche={test.actif && test.godPioche}
        spritesBase={`${import.meta.env.BASE_URL}kazim/`}
      />

    </main>
  );
}
