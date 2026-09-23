import { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * Routeur par fragment, sans dépendance.
 *
 * Le fragment plutôt que l'historique : le site est publié sur GitHub Pages
 * dans un sous-chemin et servi en fichiers statiques. Une URL d'historique
 * comme /brume/comptoir renverrait un 404 au rechargement, faute de serveur
 * pour réécrire vers index.html. Le fragment ne quitte jamais index.html.
 */

const Ctx = createContext(null);

const lire = () => {
  const h = decodeURI(window.location.hash.replace(/^#/, ""));
  return h.startsWith("/") ? h : "/";
};

export function Routeur({ children }) {
  const [chemin, setChemin] = useState(lire);

  useEffect(() => {
    // Une entrée sans fragment doit se poser sur l'accueil : sinon le premier
    // « retour » du navigateur sort du site au lieu de remonter d'une page.
    if (!window.location.hash) window.history.replaceState(null, "", "#/");
    const suivre = () => setChemin(lire());
    window.addEventListener("hashchange", suivre);
    return () => window.removeEventListener("hashchange", suivre);
  }, []);

  const valeur = useMemo(
    () => ({
      chemin,
      aller: (c) => {
        if (c === chemin) return;
        window.location.hash = c;
      },
      remplacer: (c) => {
        window.history.replaceState(null, "", "#" + c);
        setChemin(c);
      },
    }),
    [chemin]
  );

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export const useRoute = () => useContext(Ctx);

/**
 * Un vrai `<a href>`, pas un bouton : le clic du milieu, « ouvrir dans un
 * nouvel onglet » et la copie du lien doivent fonctionner comme sur un site.
 */
export function Lien({ vers, className = "", actif, children, ...reste }) {
  const { chemin } = useRoute();
  const on = actif === undefined ? chemin === vers : actif;
  return (
    <a
      href={"#" + vers}
      className={`${className}${on ? " on" : ""}`}
      aria-current={on ? "page" : undefined}
      {...reste}
    >
      {children}
    </a>
  );
}
