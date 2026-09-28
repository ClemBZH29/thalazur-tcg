import Donjon from "../donjon/Donjon.jsx";
import { useJeu } from "../jeu/Jeu.jsx";
import AvisMouvement from "../components/AvisMouvement.jsx";

/**
 * Le Donjon. La page porte le module et lui passe le jeu : collection,
 * images, tentatives du jour et crédit du butin (voir src/jeu/donjon.js).
 */
export default function PageDonjon() {
  const jeu = useJeu();
  return (
    <main className="view large donjon" id="contenu">
      <div className="section-titre">
        <h1>Le Donjon</h1>
      </div>
      <AvisMouvement quoi="les charges et les coups des combats" />
      <Donjon jeu={jeu} />
    </main>
  );
}
