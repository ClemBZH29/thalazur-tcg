import { useEffect, useRef } from "react";
import { Lien } from "../lib/routeur.jsx";
import { bandeauVisible, choisir, useConsentement } from "../lib/mesure.js";

/**
 * Le bandeau de consentement.
 *
 * Deux boutons de même poids, au même endroit, dès le premier écran : refuser
 * doit être aussi simple qu'accepter (CNIL, lignes directrices du 17/09/2020).
 * Tant qu'aucun choix n'est fait, rien n'est mesuré. Le bandeau ne bloque pas
 * la page : on peut jouer sans répondre, ce qui vaut refus provisoire.
 */
export default function BandeauCookies() {
  const e = useConsentement();
  const ref = useRef(null);
  const visible = bandeauVisible(e);

  // Rouvert à la demande : le focus y va, pour le clavier et le lecteur d'écran.
  useEffect(() => { if (visible && e.ouvert) ref.current?.focus(); }, [visible, e.ouvert]);

  if (!visible) return null;
  return (
    <section className="bandeau-cookies" role="region" aria-labelledby="cookies-titre"
      tabIndex={-1} ref={ref}>
      <div className="bandeau-cookies-texte">
        <h2 id="cookies-titre">Mesure d'audience</h2>
        <p>
          Avec votre accord, le site compte ses visites avec Google Analytics
          (cookies <code>_ga</code>, 13 mois au plus) pour savoir quelles pages
          servent. Aucune publicité, aucun profilage. Sans accord, rien n'est
          mesuré et le jeu fonctionne à l'identique.{" "}
          <Lien vers="/confidentialite" actif={false} className="lien">En savoir plus</Lien>
        </p>
      </div>
      <div className="bandeau-cookies-actions">
        <button type="button" className="btn sm choix" onClick={() => choisir(false)}>Refuser</button>
        <button type="button" className="btn sm choix" onClick={() => choisir(true)}>Accepter</button>
      </div>
    </section>
  );
}
