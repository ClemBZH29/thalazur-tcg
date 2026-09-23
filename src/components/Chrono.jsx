import { useEffect, useState } from "react";
import { ECONOMIE } from "../config/tiers.js";
import { useJeu } from "../jeu/Jeu.jsx";

/**
 * Compte à rebours des prochaines pièces d'or.
 *
 * Le gain passif ne tombe pas par paquets : `crediter()` l'accumule au prorata
 * du temps écoulé et l'état n'est rafraîchi que toutes les vingt secondes. Un
 * décompte lu sur `bourse.po` avancerait donc par sauts de vingt secondes.
 * On le recalcule ici depuis `bourse.credite`, l'horodatage du dernier crédit,
 * ce qui donne une seconde vraie — et reste juste après un onglet resté
 * fermé, puisque l'horodatage court aussi hors de la fenêtre.
 */
export default function Chrono() {
  const { bourse, gratuit } = useJeu();
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    if (gratuit) return;
    const iv = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [gratuit]);

  if (gratuit) {
    return (
      <p className="chrono libre">
        <span className="chrono-quoi">Mode test</span>
        <b>Pièces d'or désactivées</b>
      </p>
    );
  }

  const depuis = Math.min(bourse.credite || maintenant, maintenant);
  const po = Math.min(
    ECONOMIE.plafond,
    bourse.po + (Math.max(0, maintenant - depuis) / 3600000) * ECONOMIE.parHeure
  );

  if (po >= ECONOMIE.plafond) {
    return (
      <p className="chrono pleine">
        <span className="chrono-quoi">Réserve pleine</span>
        <b>{ECONOMIE.plafond} PO</b>
        <span className="chrono-note">
          le gain passif est en attente, dépensez pour le relancer
        </span>
      </p>
    );
  }

  // Le prochain palier de quinze, jamais au delà du plafond.
  const pas = ECONOMIE.parHeure;
  const prochain = Math.min(ECONOMIE.plafond, Math.floor(po / pas) * pas + pas);
  const manque = Math.max(0, prochain - po);
  const secondes = Math.ceil((manque / pas) * 3600);
  const mm = String(Math.floor(secondes / 60)).padStart(2, "0");
  const ss = String(secondes % 60).padStart(2, "0");
  const part = Math.min(100, Math.max(0, (1 - manque / pas) * 100));

  return (
    <p className="chrono">
      <span className="chrono-quoi">Prochaines {pas} PO</span>
      <b className="chrono-temps">
        <time dateTime={`PT${secondes}S`}>{mm}:{ss}</time>
      </b>
      <span className="chrono-jauge" aria-hidden="true">
        <span style={{ width: `${part}%` }} />
      </span>
      <span className="chrono-note">
        {Math.floor(po)} PO en réserve sur {ECONOMIE.plafond}
      </span>
    </p>
  );
}
