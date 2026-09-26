import { useEffect, useRef, useState } from "react";
import { useCompte } from "../jeu/Compte.jsx";
import { useJeu } from "../jeu/Jeu.jsx";
import { PSEUDO_MAX, nettoyerPseudo, pseudoValide } from "../succes/classement.js";

/**
 * Le pseudo, demandé à la première connexion.
 *
 * Il est demandé tout de suite, et non enfoui dans le profil, pour que la
 * question se pose avant que quoi que ce soit ne s'affiche aux autres : le
 * joueur apprend ici qu'il n'a pas à donner son vrai nom. Le champ ne propose
 * rien : préremplir avec le nom Google ferait de lui la réponse par défaut.
 *
 * « Plus tard » ferme la fenêtre pour de bon ; le pseudo reste modifiable au
 * profil. Le choix du classement est décoché : figurer au classement se
 * demande, cela ne se suppose pas.
 */
export default function ChoixPseudo() {
  const { statut, sessionPrete } = useCompte();
  const { etat, setEtat } = useJeu();
  const profil = etat.profil || {};
  const [pseudo, setPseudo] = useState("");
  const [classement, setClassement] = useState(false);
  const champ = useRef(null);

  const ouvert = statut === "connecte" && sessionPrete
    && !pseudoValide(profil.pseudo) && !profil.pseudoReporte;

  useEffect(() => { if (ouvert) champ.current?.focus(); }, [ouvert]);

  if (!ouvert) return null;

  const valider = (e) => {
    e.preventDefault();
    if (!pseudoValide(pseudo)) return;
    setEtat((s) => ({
      ...s,
      profil: { ...(s.profil || {}), pseudo: nettoyerPseudo(pseudo), classement, pseudoReporte: true },
    }));
  };
  const reporter = () =>
    setEtat((s) => ({ ...s, profil: { ...(s.profil || {}), pseudoReporte: true } }));

  return (
    <div className="voile" onKeyDown={(e) => { if (e.key === "Escape") reporter(); }}>
      <form className="dialogue panneau" role="dialog" aria-modal="true"
        aria-labelledby="pseudo-titre" aria-describedby="pseudo-aide" onSubmit={valider}>
        <h2 id="pseudo-titre">Votre nom d'aventurier</h2>
        <p id="pseudo-aide" className="muted">
          C'est le nom sous lequel le site vous salue. <b>Il n'a pas à être votre
          vrai nom</b> : un surnom, le nom de votre personnage, ce qui vous plaît.
          C'est lui, et lui seul, que les autres joueurs verront si vous
          choisissez d'apparaître au classement.
        </p>
        <label className="champ large">
          <span>Pseudo ({PSEUDO_MAX} caractères au plus)</span>
          <input ref={champ} type="text" value={pseudo} maxLength={PSEUDO_MAX}
            autoComplete="nickname" spellCheck={false}
            onChange={(e) => setPseudo(e.target.value)} />
        </label>
        <label className="bascule">
          <input type="checkbox" checked={classement} onChange={(e) => setClassement(e.target.checked)} />
          <span>Apparaître au classement des joueurs</span>
        </label>
        <p className="muted petit">
          Votre pseudo, votre titre et votre progression seront visibles des
          autres joueurs connectés — rien d'autre, ni votre nom Google ni votre
          photo. Vous pourrez changer d'avis à tout moment depuis le profil.
        </p>
        <div className="actions gauche">
          <button className="btn" type="submit" disabled={!pseudoValide(pseudo)}>Valider</button>
          <button className="btn quiet" type="button" onClick={reporter}>Plus tard</button>
        </div>
      </form>
    </div>
  );
}
