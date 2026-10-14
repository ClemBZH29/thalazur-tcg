import { useEffect, useState } from "react";
import "../styles/lancement.css";

const BASE = import.meta.env.BASE_URL;

/** La phase de la version publiée, lue dans son index.html (voir vite.config.js). */
async function phasePubliee() {
  const r = await fetch(`${BASE}index.html?v=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) return null;
  return (await r.text()).match(/<meta name="phase-site" content="([a-z]+)"/)?.[1] || null;
}

/**
 * La page d'attente : Bodégué endormi sur son comptoir, le nom du jeu, et
 * rien d'autre. Ni compte, ni mesure d'audience, ni stockage.
 *
 * Elle relit la version publiée toutes les minutes (et au retour sur
 * l'onglet) : à l'ouverture, ou quand le build fermé remplace la bêta, la
 * page se recharge d'elle-même. Les joueurs qui attendaient devant arrivent
 * directement sur le site.
 */
export default function PageAttente() {
  // L'illustration Sora n'est peut-être pas encore livrée : on se rabat sur
  // le décor des Missions et Bodégué serein, les yeux clos.
  const [repli, setRepli] = useState(false);

  useEffect(() => {
    const ici = document.querySelector('meta[name="phase-site"]')?.content;
    if (!ici) return undefined;
    let annule = false;
    const verifier = async () => {
      try {
        const la = await phasePubliee();
        if (!annule && la && la !== ici) window.location.reload();
      } catch { /* hors ligne : on réessaiera */ }
    };
    const iv = setInterval(verifier, 60000);
    const vu = () => { if (!document.hidden) verifier(); };
    document.addEventListener("visibilitychange", vu);
    return () => { annule = true; clearInterval(iv); document.removeEventListener("visibilitychange", vu); };
  }, []);

  return (
    <main className="attente" id="contenu">
      <div className="attente-scene" aria-hidden="true">
        {repli ? (
          <>
            <img className="attente-fond" src={`${BASE}missions/decor-mur.webp`} alt="" />
            <img className="attente-perso" src={`${BASE}missions/bodegue-serein.webp`} alt="" />
          </>
        ) : (
          <picture>
            <source media="(max-aspect-ratio: 4/5)" srcSet={`${BASE}lancement/bodegue-endormi-tel.webp`} />
            <img className="attente-fond" src={`${BASE}lancement/bodegue-endormi.webp`} alt=""
              onError={() => setRepli(true)} />
          </picture>
        )}
        <div className="attente-voile" />
        <span className="attente-z z1">z</span>
        <span className="attente-z z2">z</span>
        <span className="attente-z z3">Z</span>
      </div>
      <div className="attente-texte">
        <h1>La Brume de Thalazur</h1>
        <p>Le site arrive bientôt</p>
      </div>
      <p className="sr">Bodégué s'est endormi sur son comptoir en attendant l'ouverture.</p>
    </main>
  );
}
