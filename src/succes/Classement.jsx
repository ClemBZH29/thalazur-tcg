import { useCallback, useEffect, useMemo, useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import { useCompte } from "../jeu/Compte.jsx";
import { Lien } from "../lib/routeur.jsx";
import Artwork from "../components/Artwork.jsx";
import { carteDuCatalogue, primautes } from "./regles.js";
import { pseudoValide } from "./classement.js";

const nombre = (n) => Math.floor(n || 0).toLocaleString("fr-FR");
const pourcent = (score) =>
  `${((score || 0) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

/**
 * Les colonnes du classement, une par grand pan du site. La renommée trie
 * par défaut : elle résume tout le grimoire, chaque palier pesant ce qu'il
 * rapporte. Les autres colonnes se trient d'un toucher sur leur en-tête (au
 * téléphone, par les puces : une seule colonne s'y affiche).
 */
export const COLONNES = [
  { id: "renommee", nom: "Renommée", aide: "Les points des succès réclamés, chacun pesant ce qu'il rapporte", val: (l) => l.renommee, txt: nombre },
  { id: "collection", nom: "Collection", aide: "Complétion des extensions, une légendaire comptant huit communes", val: (l) => l.score, txt: pourcent },
  { id: "eclats", nom: "Éclats", aide: "Éclats gagnés aux Mines de Kazim", val: (l) => l.eclats, txt: nombre },
  { id: "ventes", nom: "Ventes", aide: "Exemplaires vendus au Comptoir", val: (l) => l.ventes, txt: nombre },
  { id: "heures", nom: "Expéditions", aide: "Heures de route menées au bout", val: (l) => l.heures, txt: (n) => (n ? `${nombre(n)} h` : "—") },
  { id: "etage", nom: "Donjon", aide: "Étage le plus profond du donjon infini", val: (l) => l.etage, txt: (n) => (n ? `étage ${n}` : "—") },
];

/** Trie les lignes sur une colonne ; à égalité, la renommée, puis le pseudo. */
export function trier(lignes, colonne) {
  const c = COLONNES.find((x) => x.id === colonne) || COLONNES[0];
  return [...lignes].sort((a, b) => (c.val(b) - c.val(a)) || (b.renommee - a.renommee)
    || a.pseudo.localeCompare(b.pseudo, "fr"));
}

function Ligne({ l, rang, colonne, moi, badges, catalogue }) {
  const fiche = l.carte ? carteDuCatalogue(catalogue, l.carte.ext, l.carte.id) : null;
  return (
    <div role="row" className={`cl-ligne${moi ? " moi" : ""}${rang === 1 ? " premier" : ""}${fiche ? " illustree" : ""}`}>
      {fiche && <Artwork carte={fiche} ext={l.carte.ext} rainbow={l.carte.rainbow} className="cl-art"
        cadre={typeof l.carte.x === "number" ? l.carte : null} />}
      <span role="cell" className="cl-rang">{rang}</span>
      <span role="cell" className="cl-joueur">
        <span className="joueur">{l.pseudo}</span>
        {l.titre && <span className="joueur-titre">{l.titre}</span>}
        {badges.map((b) => <span key={b} className="joueur-primaute">★ {b}</span>)}
      </span>
      {COLONNES.map((c) => (
        <span key={c.id} role="cell" className={`cl-nb${c.id === colonne ? " actif" : ""}`}>{c.txt(c.val(l))}</span>
      ))}
    </div>
  );
}

export default function Classement() {
  const compte = useCompte();
  const { etat, setEtat, succes } = useJeu();
  const { lireClassement, statut, utilisateur, sessionPrete } = compte;
  const [lignes, setLignes] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [colonne, setColonne] = useState("renommee");
  const connecte = statut === "connecte" && utilisateur;
  const profil = etat.profil || {};

  const charger = useCallback(() => {
    setErreur(null);
    lireClassement().then(setLignes).catch(() => setErreur("Le classement n'a pas pu être chargé."));
  }, [lireClassement]);

  // Après l'ouverture de session, et après l'envoi de sa propre ligne.
  useEffect(() => { if (connecte && sessionPrete) charger(); }, [connecte, sessionPrete, charger, profil.classement]);

  const prim = useMemo(() => primautes(succes.catalogue, lignes || []), [succes.catalogue, lignes]);
  const badges = (uid) => Object.values(prim).filter((p) => p.uid === uid).map((p) => p.titre);
  const triees = useMemo(() => trier(lignes || [], colonne), [lignes, colonne]);

  if (!connecte) {
    return (
      <section className="panneau">
        <div className="bloc">
          <h3>Réservé aux joueurs connectés</h3>
          <p className="muted">
            Le classement réunit les joueurs qui ont un compte et ont choisi d'y
            figurer. <Lien vers="/profil" actif={false} className="lien">Se connecter</Lien> pour le voir.
          </p>
        </div>
      </section>
    );
  }

  const present = profil.classement === true && pseudoValide(profil.pseudo);
  const active = COLONNES.find((c) => c.id === colonne);

  return (
    <div className="classement">
      {!present && (
        <p className="avis" role="status">
          Vous n'apparaissez pas au classement.{" "}
          {pseudoValide(profil.pseudo) ? (
            <button type="button" className="avis-fermer"
              onClick={() => setEtat((s) => ({ ...s, profil: { ...(s.profil || {}), classement: true } }))}>
              Y apparaître sous le nom « {profil.pseudo} »
            </button>
          ) : (
            <Lien vers="/profil" actif={false} className="lien">Choisir un pseudo</Lien>
          )}
        </p>
      )}

      <div className="barre-classement">
        {/* Au téléphone, une seule colonne s'affiche : les puces la choisissent. */}
        <div className="cmp-puces cl-puces" role="group" aria-label="Classer par">
          {COLONNES.map((c) => (
            <button key={c.id} type="button" className="puce" aria-pressed={colonne === c.id}
              onClick={() => setColonne(c.id)}>{c.nom}</button>
          ))}
        </div>
        <div className="cl-outils">
          {present && <Lien vers="/profil" actif={false} className="lien petit">Ma carte préférée</Lien>}
          <button className="btn quiet sm" onClick={charger}>Actualiser</button>
        </div>
      </div>

      {erreur && <p className="avis ko">{erreur}</p>}
      {!lignes && !erreur && <p className="muted" role="status">Chargement du classement…</p>}
      {lignes && lignes.length === 0 && <p className="muted">Personne n'y figure encore. Soyez le premier.</p>}

      {triees.length > 0 && (
        <div role="table" className="cl-table" aria-label={`Classement par ${active.nom.toLowerCase()}`}
          style={{ "--cl-col": COLONNES.findIndex((c) => c.id === colonne) }}>
          <div role="row" className="cl-tete">
            <span role="columnheader" className="cl-rang">Rang</span>
            <span role="columnheader" className="cl-joueur">Joueur</span>
            {COLONNES.map((c) => (
              <span key={c.id} role="columnheader" className={`cl-nb${c.id === colonne ? " actif" : ""}`}
                aria-sort={c.id === colonne ? "descending" : "none"}>
                <button type="button" title={c.aide} onClick={() => setColonne(c.id)}>{c.nom}</button>
              </span>
            ))}
          </div>
          {triees.map((l, i) => (
            <Ligne key={l.uid} l={l} rang={i + 1} colonne={colonne} moi={l.uid === utilisateur.uid}
              badges={badges(l.uid)} catalogue={succes.catalogue} />
          ))}
        </div>
      )}

      <p className="muted petit succes-note">
        {active.nom} : {active.aide.charAt(0).toLowerCase() + active.aide.slice(1)}. La
        « première complétion » d'une extension revient à qui a réclamé ses
        100 % le premier.
      </p>
    </div>
  );
}
