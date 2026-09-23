import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Marche, construireMarche, jourCourant } from "./marche.js";
import { acheteursDuJour } from "./acheteurs.js";
import { useJeu } from "../jeu/Jeu.jsx";

/**
 * Le marché, monté une fois par extension et par journée.
 *
 * L'objet `Marche` est délibérément mutable et tenu dans une référence plutôt
 * que dans un état React : un rayon de huit cents articles recopié à chaque
 * vente coûterait cher pour rien, et rien dans l'affichage ne dépend de
 * l'identité de l'objet. Les rendus sont demandés à la main par `rafraichir`.
 */
export function useMarche() {
  const { jeuComplet, taux, boosterId, comptoirSauve, majComptoir } = useJeu();
  const [, forcer] = useReducer((n) => n + 1, 0);
  const [jour, setJour] = useState(() => jourCourant());

  const articles = useMemo(() => construireMarche(jeuComplet, taux), [jeuComplet, taux]);

  const ref = useRef(null);
  const cle = `${boosterId}|${jour}|${articles.length}`;
  const cleMontee = useRef(null);

  if (cleMontee.current !== cle) {
    ref.current = new Marche(articles, comptoirSauve, jour);
    cleMontee.current = cle;
  }

  /* La page peut rester ouverte au passage de minuit : sans cette veille, les
     acheteurs de la veille resteraient au comptoir jusqu'au rechargement. */
  useEffect(() => {
    const iv = setInterval(() => {
      const j = jourCourant();
      setJour((prec) => (j === prec ? prec : j));
    }, 60000);
    return () => clearInterval(iv);
  }, []);

  const M = ref.current;

  /* Le rattrapage des jours écoulés se fait dans le constructeur : il faut
     l'écrire, sinon la dérive du rayon serait rejouée à chaque visite. */
  const jourSauve = comptoirSauve?.jour;
  useEffect(() => {
    if (jourSauve !== jour) majComptoir(M.serialiser());
  }, [jour, jourSauve, M]);

  const rafraichir = useCallback((ecrire = true) => {
    if (ecrire) majComptoir(M.serialiser());
    forcer();
  }, [M, majComptoir]);

  const acheteurs = useMemo(() => acheteursDuJour(jour), [jour]);

  return { M, jour, acheteurs, articles, rafraichir };
}
