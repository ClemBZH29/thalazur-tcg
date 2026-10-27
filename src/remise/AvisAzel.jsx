import { useEffect, useRef, useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import "../styles/azel.css";

const BASE = import.meta.env.BASE_URL;

/**
 * Azel le Destructeur annonce une remise à zéro (`src/config/remises.js`).
 *
 * Même principe que l'avis du lancement : l'écran prend la place du site,
 * `App.jsx` ne monte pas la coque tant qu'il n'est pas validé, il ne se ferme
 * ni par Échap ni par un clic à côté. Et la partie est déjà remise quand il
 * s'affiche (migration 12, src/lib/sauvegarde/azel.js) : le retirer avec
 * l'inspecteur laisse une page vide, et rien à récupérer.
 *
 * L'illustration (`public/azel/azel.webp`, 16:9, et `azel-tel.webp`, 9:16) :
 * tant qu'elle manque, la scène compose les ténèbres et les deux yeux bleus.
 */
export default function AvisAzel({ remise }) {
  const { setEtat } = useJeu();
  const bouton = useRef(null);
  const [image, setImage] = useState(true);

  // Le focus va au bouton sans faire défiler : au téléphone, le texte est
  // plus haut que l'écran, et Azel doit être la première chose qu'on voit.
  useEffect(() => { bouton.current?.focus({ preventScroll: true }); }, []);

  const valider = () => {
    setEtat((s) => ({
      ...s,
      azel: { ...(s.azel && typeof s.azel === "object" ? s.azel : {}), [remise.id]: "lu" },
    }));
    if (remise.apres) window.location.hash = remise.apres;
  };

  return (
    <main className="azel" id="contenu">
      <div className="azel-scene" aria-hidden="true">
        {image ? (
          <picture>
            <source media="(max-aspect-ratio: 4/5)" srcSet={`${BASE}azel/azel-tel.webp`} />
            <img className="azel-fond" src={`${BASE}azel/azel.webp`} alt="" draggable="false"
              onError={() => setImage(false)} />
          </picture>
        ) : (
          <div className="azel-repli">
            <span className="azel-oeil g" /><span className="azel-oeil d" />
          </div>
        )}
        <div className="azel-voile" />
      </div>

      <section className="azel-carte" role="alertdialog" aria-modal="true"
        aria-labelledby="azel-titre" aria-describedby="azel-texte">
        <p className="azel-sur">{remise.sur}</p>
        <h1 id="azel-titre">{remise.titre}</h1>
        <div id="azel-texte">
          {remise.parle.map((t) => <p key={t} className="azel-voix">{"« " + t + " »"}</p>)}
          {remise.texte.map((t) => <p key={t}>{t}</p>)}
          <div className="azel-listes">
            <div>
              <h2>Ce qui part</h2>
              <ul>{remise.part.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <div>
              <h2>Ce qui reste</h2>
              <ul>{remise.reste.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          </div>
        </div>
        <button ref={bouton} type="button" className="btn azel-ok" onClick={valider}>
          {remise.bouton}
        </button>
      </section>
    </main>
  );
}
