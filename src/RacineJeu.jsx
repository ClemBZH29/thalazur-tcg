import { useEffect, useState } from "react";
import App from "./App.jsx";
import LimiteErreur from "./components/LimiteErreur.jsx";
import PageAttente from "./lancement/PageAttente.jsx";
import { pageAttente } from "./config/lancement.js";
import { charger, exporter } from "./lib/storage.js";
/* Polices servies par le site : aucune requête vers Google à l'affichage.
   L'ordre est celui de l'ancien main.jsx, après l'application : il fait la
   cascade CSS, et le bouger change l'affichage (le menu du téléphone
   s'ouvrait quand base.css passait après site.css). */
import "@fontsource-variable/fraunces/full.css";
import "@fontsource/archivo/400.css";
import "@fontsource/archivo/500.css";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/site.css";
import "./styles/cards.css";
import "./styles/app.css";
import "./styles/ceremonies.css";
import "./styles/colporteur.css";
import "./styles/compte.css";
import "./styles/succes.css";
import "./styles/gabarit.css";

/**
 * Le site entier. Le build de la bêta porte aussi la page d'attente : à
 * minuit le 25/10/2026, un onglet resté ouvert bascule dessus de lui-même,
 * sans attendre que le build fermé soit publié (le cron de GitHub peut avoir
 * du retard). Le jeu est alors démonté : plus d'envoi vers le compte.
 */
export default function RacineJeu() {
  // En développement, `?attente` dans l'adresse montre la page d'attente
  // (outil « Simuler le lancement » des réglages MJ).
  const [attente, setAttente] = useState(() => pageAttente()
    || (import.meta.env.DEV && new URLSearchParams(window.location.search).has("attente")));
  useEffect(() => {
    if (attente) return undefined;
    const iv = setInterval(() => { if (pageAttente()) setAttente(true); }, 15000);
    return () => clearInterval(iv);
  }, [attente]);

  if (attente) return <PageAttente />;
  return (
    /* Dernier filet, si la coque elle-même tombe (l'état du jeu compris) :
       l'export relit alors la partie dans le stockage. */
    <LimiteErreur exporter={() => exporter(charger())}>
      <App />
    </LimiteErreur>
  );
}
