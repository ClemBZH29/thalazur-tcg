import { useCallback, useEffect, useRef, useState } from "react";
import Sachet from "./Sachet.jsx";
import Colporteur from "./Colporteur.jsx";
import Carte from "./Carte.jsx";
import DosCarte from "./DosCarte.jsx";
import { CLIP_BAS } from "../lib/dechirure.js";
import { TIER_INFO, TIER_ORDER, ECONOMIE } from "../config/tiers.js";
import { ouvrirBooster } from "../lib/draw.js";
import { meilleur } from "../lib/roster.js";
import { attenteAvantAchat, formatDuree } from "../lib/economie.js";

export default function Ouverture({
  booster, pool, speciales, taux, test, gratuit, bourse, garantirLegendaire,
  cfgImage, fichiers, sfx, ouverts, enCours, collection, mouvementReduit,
  onRecolte, onLoupe, onRetour, onBibliotheque, onProgres, onFini,
  onColporteur, onAffaire,
}) {
  /**
   * Une ouverture laissée en plan est reprise là où elle s'était arrêtée. Les
   * cartes étaient déjà acquises et débitées au moment de la déchirure : seul
   * l'affichage manquait, il n'y a donc rien à retirer.
   */
  const reprise = enCours && enCours.boosterId === booster.id ? enCours : null;

  const [phase, setPhase] = useState(reprise ? "revelation" : "sachet");
  const [tirage, setTirage] = useState(reprise ? reprise.tirage : null);
  const [index, setIndex] = useState(reprise ? reprise.index : 0);
  const [etat, setEtat] = useState("dos"); // dos | montee | retournement | face
  const [nouvelles, setNouvelles] = useState(
    () => new Set(reprise ? reprise.nouvelles : [])
  );
  /**
   * Le colporteur. `visite` est décidée une seule fois par ouverture, à
   * l'entrée du bilan et non au tirage : ses affaires portent sur la
   * collection telle qu'elle est *après* récolte, doublons du sachet compris.
   *
   * `botte` est le sachet qu'il vend sous le manteau : un prix qui remplace
   * celui de l'étagère pour la seule ouverture suivante.
   */
  const [visite, setVisite] = useState(null);
  const [botte, setBotte] = useState(null);
  const visiteFaite = useRef(false);

  const prixCourant = botte ?? ECONOMIE.prix;
  const peutOuvrir = gratuit || bourse.po >= prixCourant;

  /** Un roster vide ne peut rien produire : on l'annonce au lieu de bloquer. */
  const videPool = TIER_ORDER.every((k) => !pool[k] || pool[k].length === 0);

  /** Clé d'une case : une carte a une case normale et une case Rainbow. */
  const cle = (c) => `${c.id}:${c.rainbow ? "rainbow" : "normale"}`;
  const estNouvelle = (c) => nouvelles.has(cle(c));

  const minuteurs = useRef([]);
  const differer = (fn, ms) => { const id = setTimeout(fn, ms); minuteurs.current.push(id); return id; };
  const purger = () => { minuteurs.current.forEach(clearTimeout); minuteurs.current = []; };
  useEffect(() => () => purger(), []);

  const ouvrir = useCallback((direct = false) => {
    if (videPool) return;
    const t = ouvrirBooster(pool, taux, {
      taille: test.actif ? test.taille : 5,
      speciales,
      palierForce: test.actif && test.palier !== "auto" ? test.palier : null,
      rainbowForce: test.actif ? test.rainbow : "auto",
      garantirLegendaire,
    });
    if (!t.cards.length) return;
    setTirage(t);
    setBotte(null);
    setIndex(0);
    setEtat("dos");
    setPhase("sortie");
    setNouvelles(onRecolte(t, prixCourant) || new Set());
    sfx.deroule();
    // Un frottement par carte, calé sur sa sortie du sachet.
    t.cards.forEach((_, i) => differer(() => sfx.glisse(), 240 + i * 72));
    if (t.appel) differer(() => sfx.appel(), 300);

    if (direct) {
      // Pas de révélation carte par carte : on saute à l'éventail, avec le
      // timbre du meilleur palier pour que le résultat s'entende quand même.
      differer(() => {
        const top = meilleur(t.cards);
        sfx.revele(top.tier);
        if (top.rainbow) sfx.rainbow();
        setPhase("bilan");
        // La révélation carte par carte close l'ouverture en arrivant à la
        // dernière ; ce raccourci l'oubliait. L'étagère annonçait donc une
        // reprise pour un booster déjà vu, et cliquer dessus ramenait son
        // bilan au lieu d'un sachet neuf.
        onFini();
      }, 980);
    } else {
      differer(() => setPhase("revelation"), 1060);
    }
  }, [pool, videPool, speciales, taux, test, garantirLegendaire, onRecolte, sfx, onFini, prixCourant]);

  /**
   * L'arrivée du colporteur, une fois par ouverture. Le garde par référence
   * couvre les deux chemins d'entrée au bilan — la dernière carte dégagée et
   * le raccourci « Tout ouvrir » — ainsi que le double montage des effets en
   * mode strict.
   */
  useEffect(() => {
    if (phase !== "bilan" || visiteFaite.current || !onColporteur) return;
    visiteFaite.current = true;
    setVisite(onColporteur());
  }, [phase, onColporteur]);

  const courant = tirage ? tirage.cards[index] : null;
  const info = courant ? TIER_INFO[courant.tier] : null;

  const reveler = useCallback(() => {
    if (etat !== "dos" || !courant) return;
    const t = TIER_INFO[courant.tier];
    setEtat("montee");
    sfx.touche();
    sfx.montee(courant.tier);
    differer(() => {
      setEtat("retournement");
      sfx.retourne();
      differer(() => {
        setEtat("face");
        sfx.revele(courant.tier);
        if (courant.rainbow) sfx.rainbow();
      }, t.flip * 0.55);
    }, t.tele);
  }, [etat, courant, sfx]);

  const degager = useCallback(() => {
    if (!tirage) return;
    sfx.glisse();
    differer(() => {
      if (index < tirage.cards.length - 1) {
        setIndex((i) => i + 1);
        setEtat("dos");
        onProgres(index + 1);
      } else {
        setPhase("bilan");
        onFini();
      }
    }, 240);
  }, [tirage, index, sfx, onProgres, onFini]);

  /**
   * Sauter la révélation en cours. Les cartes sont déjà acquises et débitées
   * depuis la déchirure : il n'y a rien à tirer, seulement l'éventail à
   * montrer. On joue quand même le timbre du meilleur palier, pour que le
   * résultat s'entende même quand on a coupé la cérémonie.
   */
  const toutReveler = useCallback(() => {
    if (!tirage) return;
    purger();
    const top = meilleur(tirage.cards);
    sfx.revele(top.tier);
    if (top.rainbow) sfx.rainbow();
    setIndex(tirage.cards.length - 1);
    setEtat("face");
    setPhase("bilan");
    onFini();
  }, [tirage, sfx, onFini]);

  const relancer = () => {
    purger();
    onFini();
    setTirage(null);
    setNouvelles(new Set());
    setVisite(null);
    visiteFaite.current = false;
    setPhase("sachet");
  };

  /** Il sort un sachet du ballot : on repart au sachet, à son prix. */
  const prendreBotte = (prix) => {
    setBotte(prix);
    relancer();
  };

  useEffect(() => {
    const k = (e) => {
      if (phase !== "revelation") return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (etat === "dos") reveler();
        else if (etat === "face") degager();
      }
      if (e.key === "ArrowRight" && etat === "face") { e.preventDefault(); degager(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [phase, etat, reveler, degager]);

  const restants = tirage ? tirage.cards.length - index - 1 : 0;
  const aide =
    etat === "dos" ? "Touche la carte pour la retourner"
    : etat === "face" ? "Glisse pour dégager · touche pour agrandir"
    : "\u00a0";
  const commun = { cfgImage, fichiers };

  return (
    <main className="view" id="contenu" style={{ "--sachet-r": booster.ratio }}>
      <div className="section-titre">
        <h2>{booster.titre}</h2>
        {/* Pendant la révélation, ce bouton sert à l'écourter — c'est ce qu'on
            cherche à cet instant, pas la sortie. L'étagère reste à un clic
            dans la navigation du site, juste au-dessus. */}
        {phase === "revelation" ? (
          <button className="btn quiet sm" onClick={toutReveler}>
            Tout ouvrir{restants > 0 ? ` · ${restants + 1} cartes` : ""}
          </button>
        ) : (
          <button className="btn quiet sm" onClick={onRetour}>Retour aux boosters</button>
        )}
      </div>

      {phase === "sachet" && (
        <div className="scene">
          {videPool ? (
            <div className="vide">
              <p>Aucune carte dans ce set.</p>
              <p className="muted">
                Le roster chargé est vide ou toutes ses lignes ont été écartées. Charge un
                fichier valide depuis les réglages avant d'ouvrir un booster.
              </p>
              <button className="btn quiet" onClick={onRetour}>Retour aux boosters</button>
            </div>
          ) : peutOuvrir ? (
            <>
              {botte && (
                <p className="colp-bandeau" role="status">
                  Le sachet du colporteur — {botte} PO au lieu de {ECONOMIE.prix}.
                </p>
              )}
              <Sachet
                booster={booster} sfx={sfx} ouverts={ouverts}
                prix={gratuit ? null : prixCourant}
                onRupture={() => ouvrir(false)}
                onToutOuvrir={() => ouvrir(true)}
              />
            </>
          ) : (
            <div className="vide">
              <p>Il te manque {Math.ceil(prixCourant - bourse.po)} PO pour ce booster.</p>
              <p className="muted">
                Prochain booster dans {formatDuree(attenteAvantAchat(bourse))} — {ECONOMIE.parHeure} PO
                sont créditées chaque heure, même fenêtre fermée.
              </p>
              <button className="btn quiet" onClick={onBibliotheque}>Voir la bibliothèque</button>
            </div>
          )}
        </div>
      )}

      {phase === "sortie" && (
        <div className="scene">
          <div className="deroule">
            {tirage && tirage.cards.map((_, i) => (
              <span key={i} className="carte-sortante" style={{ "--i": i, "--n": tirage.cards.length }}>
                <DosCarte />
              </span>
            ))}
            <img
              className="sachet-vide"
              src={`${import.meta.env.BASE_URL}${booster.sachet}`}
              alt="" draggable="false"
              style={{ clipPath: CLIP_BAS, WebkitClipPath: CLIP_BAS }}
            />
          </div>
          <p className="scene-aide">
            {tirage && tirage.appel ? "Le sachet porte la marque de Valéran." : "Les cartes glissent hors du sachet."}
          </p>
        </div>
      )}

      {phase === "revelation" && courant && (
        <div className="scene">
          {info.ombre > 0 && (etat === "montee" || etat === "retournement") && (
            <div className="ombre-scene" style={{ "--d": info.ombre, "--gd": `${info.tele}ms` }} aria-hidden="true" />
          )}
          <p className="bandeau-appel">
            {tirage.appel && index === 0 ? "Appel de Valéran" : "\u00a0"}
          </p>

          <div className="pile">
            {[3, 2, 1].filter((o) => o <= restants).map((o) => (
              <div key={o} className="dos-empile" style={{ "--o": o }} aria-hidden="true">
                <DosCarte />
              </div>
            ))}

            {etat !== "dos" && (
              <div
                className={`lueur ${etat === "montee" ? "monte" : "retombe"}`}
                style={{ "--gc": info.lueur, "--gd": `${info.tele}ms` }}
                aria-hidden="true"
              />
            )}
            {info.motes > 0 && etat === "montee" && (
              <div className="motes" aria-hidden="true">
                {Array.from({ length: info.motes }, (_, i) => (
                  <span key={i} style={{
                    "--gc": info.lueur,
                    "--a": `${(i / info.motes) * 360}deg`,
                    "--dl": `${(i % 7) * 42}ms`,
                    "--ds": `${0.55 + ((i * 37) % 60) / 100}`,
                  }} />
                ))}
              </div>
            )}

            <div className="avance" key={`av-${ouverts}-${index}`}>
              <Carte
                c={courant}
                taille="plein"
                retourne={etat === "retournement" || etat === "face"}
                dureeFlip={info.flip}
                onBalayage={etat === "face" ? degager : null}
                onToucher={etat === "dos" ? reveler : etat === "face" ? () => onLoupe(courant) : null}
                etiquette={
                  etat === "dos"
                    ? "Retourner la carte"
                    : `Agrandir ${courant.nom}, ${info.nom}`
                }
                badge={
                  etat === "face" && estNouvelle(courant) ? (
                    <span className="badge-fondu">
                      <span className={`badge-new${courant.rainbow ? " arc" : ""}`}>New</span>
                    </span>
                  ) : null
                }
                {...commun}
              />
            </div>
          </div>

          <div className="jauge">
            <div className="pips" aria-hidden="true">
              {tirage.cards.map((_, i) => (
                <i key={i} className={i < index ? "fait" : i === index ? "actif" : ""} />
              ))}
            </div>
            <span className="restants">
              {restants > 0 ? `${restants} restant${restants > 1 ? "s" : ""}` : "dernière carte"}
            </span>
          </div>
          <p className="annonce" role="status" aria-live="polite">
            {etat === "face"
              ? `${courant.nom}, ${info.nom}${courant.rainbow ? ", Rainbow" : ""}` +
                `${estNouvelle(courant) ? ", nouvelle carte" : ""}` +
                `, ${restants > 0 ? `${restants} restantes` : "dernière carte"}`
              : ""}
          </p>
          <p className="scene-aide">{aide}</p>
          <div className="place-bouton">
            <button
              className="btn quiet sm"
              onClick={degager}
              style={{ visibility: etat === "face" ? "visible" : "hidden" }}
              tabIndex={etat === "face" ? 0 : -1}
              aria-hidden={etat !== "face"}
            >
              Suivante
            </button>
          </div>
        </div>
      )}

      {phase === "bilan" && tirage && (
        <div className="scene">
          <div className="eventail">
            {tirage.cards.map((c, i) => (
              <div key={i} className={meilleur(tirage.cards) === c ? "ev premier" : "ev"} style={{ "--i": i }}>
                <Carte
                  c={c} taille="petit" onToucher={() => onLoupe(c)}
                  etiquette={`Agrandir ${c.nom}, ${TIER_INFO[c.tier].nom}`}
                  {...commun}
                />
                {estNouvelle(c) && (
                  <span className="badge-fondu">
                    <span className={`badge-new${c.rainbow ? " arc" : ""}`}>New</span>
                  </span>
                )}
              </div>
            ))}
          </div>
          {tirage.speciale === "pj" && <p className="bandeau-appel">Carte PJ</p>}
          {tirage.speciale === "fullart" && <p className="bandeau-appel">Pleine illustration</p>}
          {tirage.garanti && (
            <p className="scene-aide">Un légendaire a été garanti sur ce booster.</p>
          )}
          {/* Le colporteur s'installe sous l'éventail : les cartes d'abord,
              l'affaire ensuite. Il ne remplace pas les actions du bilan — on
              peut l'ignorer et rouvrir un booster, il aura simplement passé. */}
          {visite && (
            <Colporteur
              visite={visite} pool={pool} collection={collection}
              sfx={sfx} cfgImage={cfgImage} fichiers={fichiers}
              mouvementReduit={mouvementReduit}
              onAffaire={onAffaire} onBotte={prendreBotte} onLoupe={onLoupe}
            />
          )}
          <div className="actions">
            <button className="btn" onClick={relancer}>
              {gratuit ? "Ouvrir un autre booster" : `Ouvrir un autre booster · ${ECONOMIE.prix} PO`}
            </button>
            <button className="btn quiet" onClick={onBibliotheque}>Voir la bibliothèque</button>
          </div>
        </div>
      )}
    </main>
  );
}
