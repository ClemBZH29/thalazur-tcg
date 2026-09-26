import { BOOSTERS } from "../extensions/index.js";
import { ECONOMIE, SLOTS } from "../config/tiers.js";
import { useJeu } from "../jeu/Jeu.jsx";
import { Lien } from "../lib/routeur.jsx";
import AvisMouvement from "./AvisMouvement.jsx";
import Caisse from "./Caisse.jsx";

function Booster({ b, ouverts, achetable, gratuit, reste, offerts }) {
  const pret = b.statut === "ouvert";
  // Une ouverture laissée en plan appartient à une extension précise : elle se
  // signale sur sa vignette plutôt que dans un bandeau qui pousse toute la page.
  const enCours = pret && reste > 0;
  const actif = pret && (enCours || gratuit || achetable || offerts > 0);
  const contenu = (
    <>
      <div className="vignette-booster">
        {enCours && (
          <span className="pastille-reprise">
            {reste} carte{reste > 1 ? "s" : ""} à révéler
          </span>
        )}
        {b.sachet ? (
          <img src={b.sachet} alt="" draggable="false" />
        ) : (
          <span
            className="cachet"
            style={{ background: `radial-gradient(circle at 38% 30%, color-mix(in srgb, ${b.cire} 72%, white), ${b.cire} 58%, color-mix(in srgb, ${b.cire} 55%, black))` }}
          >
            {b.sceau}
          </span>
        )}
      </div>

      <div className="ligne-etat">
        {enCours ? (
          <span className="prix reprendre">Reprendre l'ouverture</span>
        ) : pret ? (
          <span className="prix">
            {gratuit ? "Disponible"
              : offerts > 0 ? `${offerts} sachet${offerts > 1 ? "s" : ""} offert${offerts > 1 ? "s" : ""}`
                : `${ECONOMIE.prix} PO`}
          </span>
        ) : (
          <span className="etat attente">Bientôt</span>
        )}
        {pret && ouverts > 0 && <span className="ouverts">{ouverts} ouvert{ouverts > 1 ? "s" : ""}</span>}
      </div>

      <h3>{b.titre}</h3>
      <p className="booster-resume">{b.resume}</p>

      {/* Le délai avant le prochain booster est dans la caisse, sous l'étagère. */}
    </>
  );

  const classe = `booster-carte${pret ? "" : " verrou"}${pret && !actif ? " trop-cher" : ""}${enCours ? " en-cours" : ""}`;

  // Une extension ouvrable est un lien : elle a une adresse, on peut la
  // partager et l'ouvrir dans un onglet. Une extension à venir n'est rien
  // d'autre qu'un cadre, et n'a donc rien à annoncer au clavier.
  if (!actif) {
    return (
      <div className={classe} aria-label={pret ? `${b.titre}, pas encore abordable` : `${b.titre}, bientôt disponible`}>
        {contenu}
      </div>
    );
  }
  return (
    <Lien
      vers={`/boutique/${b.id}`}
      className={classe}
      actif={false}
      aria-label={enCours
        ? `Reprendre l'ouverture de ${b.titre}, ${reste} carte${reste > 1 ? "s" : ""} à révéler`
        : `Ouvrir un booster ${b.titre}`}
    >
      {contenu}
    </Lien>
  );
}

export default function Etagere() {
  const { etat, bourse, gratuit, paliersVides } = useJeu();
  const achetable = bourse.po >= ECONOMIE.prix;
  const enCours = etat.enCours;

  return (
    <main className="view" id="contenu">
      <div className="section-titre">
        <h1>Boutique</h1>
      </div>

      {paliersVides.length > 0 && (
        <p className="avis-roster" role="status">
          <b>Roster incomplet.</b> Aucune carte au palier{" "}
          {paliersVides.map((t) => t.nom.toLowerCase()).join(", ")} : les
          emplacements qui l'exigent se replient sur le palier voisin, ce qui
          appauvrit fortement les boosters.{" "}
          {paliersVides.some((t) => t.id === "commun") && (
            <>Les {SLOTS.filter((s) => s.commun).length} premiers emplacements
            sont des communs garantis — sans commun dans le roster, ils sortent
            en peu commun. </>
          )}
          Complétez la colonne D du roster, ou corrigez les paliers dans les
          réglages.
        </p>
      )}

      <AvisMouvement quoi="la déchirure du sachet et la révélation des cartes" />

      {/* Sur téléphone, la caisse passe au-dessus : sous quatre vignettes
          empilées, on ne la verrait jamais. */}
      <div className="boutique-corps">
      <div className="etagere">
        {BOOSTERS.map((b) => (
          <Booster
            key={b.id} b={b}
            ouverts={etat.boosters[b.id] || 0}
            reste={
              enCours && enCours.boosterId === b.id
                ? enCours.tirage.cards.length - enCours.index
                : 0
            }
            achetable={achetable} gratuit={gratuit}
            // Les sachets de l'extension, plus les sachets au choix.
            offerts={(etat.sachets?.[b.id] || 0) + (etat.sachets?.["*"] || 0)}
          />
        ))}
      </div>

      <Caisse />
      </div>
    </main>
  );
}
