import { useCallback, useEffect, useRef, useState } from "react";
import Carte from "./Carte.jsx";
import { COLPORTEUR, TARIFS, palierPari } from "../config/colporteur.js";
import { TIER_INFO, TIERS_ROSTER } from "../config/tiers.js";

const ECHELLE = TIERS_ROSTER.map((t) => t.id);

/** Une carte du palier demandé, en préférant celles qui manquent encore. */
function carteDuPalier(pool, collection, tier) {
  const liste = pool[tier] || [];
  if (!liste.length) return null;
  const absentes = liste.filter((c) => !(collection[c.id] && collection[c.id].normale));
  const source = absentes.length ? absentes : liste;
  return source[Math.floor(Math.random() * source.length)];
}

/** Le palier effectivement servable : on glisse vers le bas si le roster est creux. */
function palierServable(pool, tier) {
  const i = ECHELLE.indexOf(tier);
  for (let d = 0; d < ECHELLE.length; d++) {
    const bas = ECHELLE[i - d];
    if (bas && (pool[bas] || []).length) return bas;
    const haut = ECHELLE[i + d];
    if (haut && (pool[haut] || []).length) return haut;
  }
  return null;
}

/**
 * Le colporteur — évènement rare de l'ouverture.
 * ------------------------------------------------------------------
 *
 * Il s'installe au bilan, après les cartes, et jamais pendant la révélation :
 * ses affaires portent sur ce qui vient de sortir du sachet, il faut donc que
 * ce soit déjà su. Il ne bloque rien — le bilan reste utilisable derrière lui,
 * et l'on peut le renvoyer d'un mot.
 *
 * Une seule affaire par passage. C'est ce qui fait qu'on hésite, et c'est
 * aussi ce qui borne son effet sur l'économie : voir src/config/colporteur.js.
 *
 * Aucune affaire n'est jamais grisée ici. Les générateurs de
 * src/config/colporteur.js écartent d'emblée celles que la bourse ne peut pas
 * payer et celles que la collection ne permet pas : Mirko ne déballe que ce
 * qui est prenable. Un menu à moitié inerte aurait été plus simple à écrire et
 * bien moins bon à jouer.
 *
 * L'apparition se joue en trois temps — la lanterne sur la route, le cadre qui
 * arrive avec son ballot, les affaires qui se déballent — et se réduit à un
 * simple affichage quand les animations sont coupées.
 */
export default function Colporteur({
  visite, pool, collection, sfx, cfgImage, fichiers,
  mouvementReduit, onAffaire, onBotte, onLoupe,
}) {
  const [phase, setPhase] = useState(mouvementReduit ? "ici" : "approche");
  const [resultat, setResultat] = useState(null);
  const [parti, setParti] = useState(false);
  const minuteurs = useRef([]);
  const differer = (fn, ms) => { minuteurs.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => minuteurs.current.forEach(clearTimeout), []);

  // L'arrivée : clochette d'abord, cadre ensuite. Le son précède l'image d'un
  // quart de seconde, comme on entend un colporteur avant de le voir.
  useEffect(() => {
    sfx.clochette();
    if (mouvementReduit) return;
    differer(() => setPhase("ici"), 820);
  }, []);

  const conclure = useCallback((deal, extra) => {
    sfx.pieces();
    onAffaire(deal, extra);
    setResultat({ deal, ...extra });
    differer(() => { sfx.depart(); setParti(true); }, 2600);
  }, [onAffaire, sfx]);

  const accepter = useCallback((deal) => {
    if (deal.id === "botte") {
      sfx.pieces();
      onBotte(TARIFS.botte);
      return;
    }
    if (deal.id === "pari") {
      const tier = palierServable(pool, palierPari());
      const carte = tier ? carteDuPalier(pool, collection, tier) : null;
      if (!carte) return;
      const neuve = !(collection[carte.id] && collection[carte.id].normale);
      conclure(deal, {
        gagnee: { ...carte, rainbow: false }, neuve,
        effet: { ajoute: [{ carte, version: "normale", n: 1 }], po: -TARIFS.pari },
      });
      return;
    }
    if (deal.id === "troc") {
      const tier = palierServable(pool, deal.effet.troc);
      const carte = tier ? carteDuPalier(pool, collection, tier) : null;
      if (!carte) return;
      const neuve = !(collection[carte.id] && collection[carte.id].normale);
      conclure(deal, {
        gagnee: { ...carte, rainbow: false }, neuve,
        effet: { retire: deal.effet.retire, ajoute: [{ carte, version: "normale", n: 1 }] },
      });
      return;
    }
    if (deal.id === "lustrage") {
      const carte = deal.effet.ajoute[0].carte;
      conclure(deal, {
        gagnee: { ...carte, rainbow: true }, neuve: true,
        effet: deal.effet,
      });
      return;
    }
    // Le lot : rien à révéler, seulement des pièces.
    conclure(deal, { effet: deal.effet });
  }, [pool, collection, conclure, onBotte, sfx]);

  const renvoyer = useCallback(() => {
    sfx.depart();
    setParti(true);
  }, [sfx]);

  if (parti) {
    return (
      <p className="colp-adieu" role="status">
        Mirko remet son ballot sur l'épaule et reprend la route.
      </p>
    );
  }

  return (
    <aside
      className={`colp${phase === "approche" ? " approche" : ""}`}
      aria-label="Un colporteur s'arrête"
    >
      <span className="colp-halo" aria-hidden="true" />

      {phase === "approche" ? (
        <p className="colp-route" role="status">Une lanterne s'approche sur la route…</p>
      ) : (
        <div className="colp-corps">
          {/* La case du colporteur : cadre lanterné, portrait qui tangue au pas
              du marcheur, trois éclats sur ses breloques. */}
          <div className="colp-case">
            <span className="colp-lueur" aria-hidden="true" />
            <img
              className="colp-portrait"
              src={`${import.meta.env.BASE_URL}comptoir/${COLPORTEUR.portrait}.webp`}
              alt={`${COLPORTEUR.nom}, ${COLPORTEUR.sub}`}
              draggable="false"
            />
            {[0, 1, 2].map((i) => (
              <span key={i} className={`colp-eclat e${i}`} aria-hidden="true" />
            ))}
            <div className="colp-plaque">
              <h3>{COLPORTEUR.nom}</h3>
              <span>{COLPORTEUR.sub}</span>
            </div>
          </div>

          <div className="colp-etal">
            {/* Sans cette annonce, un lecteur d'écran ne reçoit rien de
                l'arrivée : le panneau apparaît en silence au milieu du bilan.
                Le nombre d'affaires est dit tout de suite, parce que la règle
                — une seule — change la façon de les écouter. */}
            <p className="annonce" role="status">
              {COLPORTEUR.nom} le colporteur s'arrête à ton étal.
              {` ${visite.deals.length} affaire${visite.deals.length > 1 ? "s" : ""}, `}
              une seule au choix.
            </p>
            <p className="colp-cite">{COLPORTEUR.quote}</p>

            {resultat ? (
              <div className="colp-issue" role="status">
                <p className="colp-conclu">
                  Affaire conclue — {resultat.deal.titre.toLowerCase()}.
                  {resultat.deal.gain
                    ? ` Il te compte ${resultat.deal.gain} PO.`
                    : resultat.deal.cout
                      ? ` Tu lui laisses ${resultat.deal.cout} PO.`
                      : ""}
                </p>
                {resultat.gagnee && (
                  <div className="colp-gain">
                    <Carte
                      c={resultat.gagnee} taille="petit" cfgImage={cfgImage} fichiers={fichiers}
                      onToucher={() => onLoupe(resultat.gagnee)}
                      etiquette={`Agrandir ${resultat.gagnee.nom}, ${TIER_INFO[resultat.gagnee.tier].nom}`}
                    />
                    <span className="colp-gain-mot">
                      {resultat.neuve ? "Nouvelle case remplie." : "Un exemplaire de plus."}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <>
                <ul className="colp-deals">
                  {visite.deals.map((d) => (
                    <li key={d.id} className="colp-deal">
                      <div className="colp-deal-texte">
                        <strong>{d.titre}</strong>
                        <p className="colp-phrase">{d.phrase}</p>
                        <p className="colp-detail">{d.detail}</p>
                      </div>
                      {/* Le libellé visible est un prix ; seul, il ne dit
                          pas de quelle affaire il s'agit. */}
                      <button
                        type="button"
                        className={d.gain ? "btn sm" : "btn quiet sm"}
                        onClick={() => accepter(d)}
                        aria-label={
                          d.gain ? `${d.titre} — il te compte ${d.gain} PO`
                          : d.cout ? `${d.titre} — ${d.cout} PO`
                          : `${d.titre} — échanger`
                        }
                      >
                        {d.gain ? `+${d.gain} PO` : d.cout ? `${d.cout} PO` : "Échanger"}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="colp-pied">
                  <span className="colp-regle">
                    Une seule affaire, et il repart. Il ne repassera pas aujourd'hui.
                  </span>
                  <button type="button" className="btn quiet sm" onClick={renvoyer}>
                    Le laisser passer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
