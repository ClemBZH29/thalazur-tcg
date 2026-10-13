import { useCallback, useMemo } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import { useRoute } from "../lib/routeur.jsx";
import { BOOSTER_PAR_ID } from "../extensions/index.js";
import { SACHET_LIBRE } from "../config/succes.js";
import { renommeeDe, renommeeTotale } from "../succes/regles.js";
import Grimoire from "../succes/grimoire/Grimoire.jsx";
import Classement from "../succes/Classement.jsx";

/**
 * Les succès : le grimoire (`#/succes`, `#/succes/<chapitre>/<page>`) et le
 * classement (`#/succes/classement`).
 *
 * Ouvrir un chapitre depuis le sommaire empile une entrée d'historique ;
 * tourner les pages ensuite la remplace. Le retour du navigateur ramène
 * donc au sommaire, pas page par page.
 */
export default function PageSucces({ onglet, page }) {
  const { aller, remplacer } = useRoute();
  const { etat, setEtat, succes, mouvementReduit } = useJeu();
  const classement = onglet === "classement";
  const { catalogue, evaluation } = succes;

  const route = useMemo(() => ({
    chapitre: classement ? null : onglet || null,
    page: Math.max(1, Number.parseInt(page, 10) || 1),
  }), [classement, onglet, page]);

  const onRoute = useCallback((chapitre, p) => {
    const vers = chapitre ? `/succes/${chapitre}${p > 1 ? `/${p}` : ""}` : "/succes";
    if (!route.chapitre && chapitre) aller(vers);
    else remplacer(vers);
  }, [route.chapitre, aller, remplacer]);

  const profil = etat.profil || {};
  const tous = [...evaluation.global, ...evaluation.extensions.flatMap((e) => e.familles)];
  const sachets = etat.sachets || {};
  const joueur = {
    pseudo: profil.pseudo || "Aventurier",
    titreId: profil.titre || "",
    titre: succes.titres.find((t) => t.id === profil.titre)?.titre || "",
    titres: succes.titres,
    renommee: renommeeDe(catalogue, etat),
    renommeeTotale: renommeeTotale(catalogue),
    reclames: tous.reduce((n, f) => n + f.paliers.filter((p) => p.reclame).length, 0),
    total: tous.reduce((n, f) => n + f.paliers.length, 0),
    offerts: {
      choix: sachets[SACHET_LIBRE] || 0,
      extensions: Object.entries(sachets).filter(([cle, n]) => cle !== SACHET_LIBRE && n > 0)
        .map(([id, n]) => ({ id, titre: BOOSTER_PAR_ID[id]?.titre || id, n })),
    },
  };

  const choisirTitre = useCallback((id) => {
    setEtat((s) => ({ ...s, profil: { ...(s.profil || {}), titre: id || undefined } }));
  }, [setEtat]);

  return (
    <main className={`view succes${classement ? "" : " succes-grimoire"}`} id="contenu">
      <div className="section-titre">
        <h1>{classement ? "Classement" : "Succès"}</h1>
        <div className="segments" role="group" aria-label="Onglets">
          <button className={!classement ? "on" : ""} aria-pressed={!classement}
            onClick={() => aller("/succes")}>Grimoire</button>
          <button className={classement ? "on" : ""} aria-pressed={classement}
            onClick={() => aller("/succes/classement")}>Classement</button>
        </div>
      </div>
      {classement ? <Classement /> : (
        <Grimoire
          chapitres={catalogue.chapitres}
          evaluation={evaluation}
          joueur={joueur}
          route={route}
          onRoute={onRoute}
          onReclamer={succes.reclamerAvecGains}
          onChoisirTitre={choisirTitre}
          onClassement={() => aller("/succes/classement")}
          mouvementReduit={mouvementReduit}
        />
      )}
    </main>
  );
}
