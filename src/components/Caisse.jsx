import { useEffect, useState } from "react";
import { ECONOMIE } from "../config/tiers.js";
import { attenteAvantAchat, formatDuree } from "../lib/economie.js";
import { useJeu } from "../jeu/Jeu.jsx";

/**
 * La caisse de la boutique : une bande sous l'étagère.
 *
 * Elle a longtemps tenu dans l'en-tête, à droite du titre, où elle faisait de
 * la Boutique la seule page dont l'en-tête changeait de hauteur. Elle dit
 * trois choses : ce qu'on a en poche, combien de boosters cela paie, et où en
 * est le gain passif.
 *
 * Le gain passif ne tombe pas par paquets : `crediter()` l'accumule au prorata
 * du temps écoulé et l'état n'est rafraîchi que toutes les vingt secondes. Le
 * minuteur se recalcule donc ici depuis `bourse.credite`, l'horodatage du
 * dernier crédit, ce qui donne une seconde vraie — et reste juste après un
 * onglet resté fermé.
 *
 * Le plafond borne le gain passif, pas la bourse : les ventes et la mine
 * peuvent la porter au-delà. D'où « en pause au-delà de 720 PO », et non
 * « réserve pleine, 720 PO » qui contredisait la pastille du bandeau.
 */
export default function Caisse() {
  const { bourse, gratuit } = useJeu();
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    if (gratuit) return;
    const iv = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [gratuit]);

  if (gratuit) {
    return (
      <section className="caisse libre" aria-label="Caisse">
        <div className="caisse-bloc">
          <span className="caisse-quoi">Mode test</span>
          <b className="caisse-valeur">Pièces d'or désactivées</b>
        </div>
      </section>
    );
  }

  const { prix, plafond, parHeure: pas } = ECONOMIE;
  const enPoche = Math.floor(bourse.po);
  const abordables = Math.floor(bourse.po / prix);
  const attente = attenteAvantAchat(bourse);

  const depuis = Math.min(bourse.credite || maintenant, maintenant);
  const po = bourse.po >= plafond
    ? bourse.po
    : Math.min(plafond, bourse.po + (Math.max(0, maintenant - depuis) / 3600000) * pas);
  const enPause = po >= plafond;
  const remplissage = Math.min(100, (po / plafond) * 100);

  let minuteur = null;
  if (!enPause) {
    const prochain = Math.min(plafond, Math.floor(po / pas) * pas + pas);
    const secondes = Math.ceil((Math.max(0, prochain - po) / pas) * 3600);
    const mm = String(Math.floor(secondes / 60)).padStart(2, "0");
    const ss = String(secondes % 60).padStart(2, "0");
    minuteur = <time dateTime={`PT${secondes}S`}>{mm}:{ss}</time>;
  }

  return (
    <section className="caisse" aria-label="Caisse">
      <div className="caisse-bloc">
        <span className="caisse-quoi">Bourse</span>
        <b className="caisse-valeur or">{enPoche} PO</b>
      </div>

      <div className="caisse-bloc">
        <span className="caisse-quoi">Boosters abordables</span>
        {abordables > 0
          ? <b className="caisse-valeur">{abordables}</b>
          : <b className="caisse-valeur petit">prochain dans {formatDuree(attente)}</b>}
      </div>

      <div className="caisse-bloc caisse-passif">
        <span className="caisse-quoi">Gain passif · {pas} PO par heure</span>
        <span
          className={`caisse-jauge${enPause ? " pause" : ""}`}
          role="meter" aria-valuemin={0} aria-valuemax={plafond} aria-valuenow={Math.min(plafond, Math.floor(po))}
          aria-label={`Gain passif, ${Math.min(plafond, Math.floor(po))} PO sur ${plafond}`}
        >
          <span style={{ width: `${remplissage}%` }} />
        </span>
        {enPause ? (
          <span className="caisse-note">
            <b>En pause au-delà de {plafond} PO</b> · dépensez pour le relancer
          </span>
        ) : (
          <span className="caisse-note">
            <b className="caisse-minuteur">+{pas} PO dans {minuteur}</b> · s'arrête à {plafond} PO
          </span>
        )}
      </div>
    </section>
  );
}
