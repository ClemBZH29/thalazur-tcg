import MinesDeKazim from "../mines/MinesDeKazim.jsx";
import { useJeu } from "../jeu/Jeu.jsx";
import { magasinKazim } from "../lib/storage.js";
import AvisMouvement from "../components/AvisMouvement.jsx";
import { useEffect, useState } from "react";
import { finBlocage } from "../jeu/mine.js";

const heure = (t) => new Date(t).toLocaleString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * La mine fermée par Tafix (contrôle des autoclickers, 1.1.0) : la page ne
 * porte plus le module, rien ne tourne ni ne s'accumule jusqu'à la
 * réouverture, que la page guette pour rouvrir d'elle-même.
 */
function MineFermee({ jusqua, onRouvrir }) {
  useEffect(() => {
    const delai = Math.min(jusqua - Date.now() + 500, 2 ** 31 - 1);
    const t = setTimeout(onRouvrir, Math.max(1000, delai));
    return () => clearTimeout(t);
  }, [jusqua, onRouvrir]);
  return (
    <section className="kz-fermee bloc" role="status">
      <img src={`${import.meta.env.BASE_URL}kazim/tafix-panique.webp`} alt="" className="kz-fermee-tafix" draggable="false" />
      <div>
        <h2>Tafix a fermé la mine</h2>
        <p>« Personne ne frappe aussi vite, aussi longtemps ! Pas comme ça, pas chez moi. Le filon se repose jusqu&apos;à demain. »</p>
        <p className="muted">Une pioche a tenu la cadence maximale dix secondes d&apos;affilée : c&apos;est la marque d&apos;un clic automatique. La mine rouvre {heure(jusqua)}, et ce temps-là ne compte pas comme une absence.</p>
      </div>
    </section>
  );
}

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
    etat, signalerAutoclic, repriseMine,
  } = useJeu();
  // Relu à la réouverture : `finBlocage` dépend de l'heure, pas de l'état.
  const [, relire] = useState(0);
  const fermee = finBlocage(etat);

  return (
    <main className="view large mines" id="contenu">
      <div className="section-titre">
        <h1>Les Mines de Kazim</h1>
      </div>

      <AvisMouvement quoi="les éclats et les secousses du filon" />

      {fermee ? <MineFermee jusqua={fermee} onRouvrir={() => relire((n) => n + 1)} /> : (
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
        // Le mode test des outils MJ frappe à volonté.
        onAutoclic={test.actif ? null : signalerAutoclic}
        reprise={repriseMine}
      />
      )}

    </main>
  );
}
