import { useCallback, useMemo, useState } from "react";
import { TIER_INFO, TIER_ORDER, REVENTE } from "../config/tiers.js";
import { useJeu } from "../jeu/Jeu.jsx";
import { Lien } from "../lib/routeur.jsx";
import { useMarche } from "../comptoir/useMarche.js";
import { acheteurDeDemain, conservateurPresent } from "../comptoir/acheteurs.js";
import { dos, encre } from "../comptoir/teintes.js";
import Negoce from "../comptoir/Negoce.jsx";
import "../styles/comptoir.css";

const fmt = (n) => Math.round(n).toLocaleString("fr-FR");
const nb = (x) => (x >= 100 ? fmt(x) : x >= 10 ? x.toFixed(1).replace(".", ",") : x.toFixed(2).replace(".", ","));

/** Le portrait d'un acheteur, ou son initiale gravée si l'image manque. */
function Portrait({ acheteur, classe }) {
  const [rate, setRate] = useState(false);
  if (rate) return <span className={`${classe} sans-image`} aria-hidden="true">{acheteur.nom[0]}</span>;
  return (
    <img
      className={classe}
      src={`${import.meta.env.BASE_URL}comptoir/${acheteur.portrait}.webp`}
      alt=""
      loading="lazy"
      onError={() => setRate(true)}
    />
  );
}

export default function PageComptoir() {
  const jeu = useJeu();
  const { M, jour, acheteurs, articles, rafraichir } = useMarche();
  const { bourse, surplus: surplusJeu, vendreExemplaires, acheterExemplaire } = jeu;

  const [neg, setNeg] = useState(null);   // { acheteurId, articleId }
  const [avis, setAvis] = useState("");
  const [annonce, setAnnonce] = useState(false);
  // La Régie était un dépliant en bas de page ; c'est une bulle d'aide en tête.
  const [regie, setRegie] = useState(false);

  const dire = useCallback((m) => setAvis(m), []);

  /** Le surplus d'un article, lu sur la collection réelle. */
  const surplus = useCallback((a) => surplusJeu(a.carteId, a.version), [surplusJeu]);

  /* ── Ce que le joueur peut vendre ──────────────────────────────────────── */

  const vendables = useMemo(
    () => articles
      .filter((a) => surplus(a) > 0)
      .map((a) => {
        const acheteur = M.meilleurAcheteur(a, acheteurs);
        return {
          a, acheteur,
          offre: acheteur ? M.offreUnitaire(a, acheteur) : 0,
          rachat: M.cotation(a).bid,
          n: surplus(a),
        };
      })
      .sort((x, y) => (y.offre || y.rachat) * y.n - (x.offre || x.rachat) * x.n),
    [articles, surplus, M, acheteurs]
  );

  const nSurplus = vendables.reduce((s, v) => s + v.n, 0);
  const totalRapide = vendables.reduce((s, v) => s + v.n * v.rachat, 0);

  /* ── Le rayon du jour ──────────────────────────────────────────────────── */

  const rayon = useMemo(() => M.rayonDuJour().map((a) => ({
    a,
    prix: M.cotation(a).ask,
    possede: jeu.exemplaires(a.carteId, a.version) > 0,
  })), [M, jour, jeu.collection]);

  /* ── Actions ───────────────────────────────────────────────────────────── */

  const vendre = (a, acheteur, qte, facteur) => {
    const q = Math.min(qte, surplus(a));
    let gain = 0;
    let vendus = 0;
    for (let k = 0; k < q; k++) {
      const paye = M.payer(a, M.offreUnitaire(a, acheteur, M.stock[a.id]) * facteur);
      if (paye === null) { dire("La bourse du Comptoir est vide pour aujourd'hui."); break; }
      gain += paye;
      vendus++;
    }
    if (vendus) {
      vendreExemplaires(a.carteId, a.version, vendus, gain);
      M.noter(`${vendus} × ${a.carte.nom}${a.rainbow ? " (rainbow)" : ""} vendu${vendus > 1 ? "s" : ""} à ${acheteur.nom}`, gain);
      dire(`Marché conclu : +${fmt(gain)} PO.`);
    }
    rafraichir();
    if (surplus(a) - vendus < 1) setNeg(null);
  };

  const liquider = () => {
    let gain = 0;
    let n = 0;
    for (const v of vendables) {
      for (let k = 0; k < v.n; k++) {
        const paye = M.payer(v.a, M.cotation(v.a).bid);
        if (paye === null) break;
        gain += paye;
        n++;
        vendreExemplaires(v.a.carteId, v.a.version, 1, paye);
      }
    }
    if (!n) return dire("La bourse du Comptoir ne peut rien racheter aujourd'hui.");
    M.noter(`${n} exemplaire${n > 1 ? "s" : ""} liquidé${n > 1 ? "s" : ""} à l'échoppe`, gain);
    dire(`${n} exemplaire${n > 1 ? "s" : ""} liquidé${n > 1 ? "s" : ""} : +${fmt(gain)} PO.`);
    rafraichir();
  };

  const acheter = (a) => {
    const prix = M.cotation(a).ask;
    if (bourse.po < prix) return dire(`Il vous manque ${fmt(prix - bourse.po)} PO pour cette carte.`);
    const paye = M.vendreAuJoueur(a);
    if (paye === null) return dire("Cette pièce vient de partir.");
    acheterExemplaire(a.carte, a.version, paye);
    M.noter(`${a.carte.nom}${a.rainbow ? " (rainbow)" : ""} acheté à l'échoppe`, 0);
    dire(`${a.carte.nom} rejoint votre collection pour ${fmt(paye)} PO.`);
    rafraichir();
  };

  const ouvrirNegoce = (acheteur, article) => {
    const choix = articles.filter((a) => surplus(a) > 0 && M.affinite(a, acheteur) > 0);
    if (!choix.length) return dire(`${acheteur.nom} ne recherche aucun de vos surplus aujourd'hui.`);
    const a = article && choix.some((c) => c.id === article.id) ? article : choix[0];
    setNeg({ acheteurId: acheteur.id, articleId: a.id });
  };

  const negActeurs = useMemo(() => {
    if (!neg) return null;
    const acheteur = acheteurs.find((b) => b.id === neg.acheteurId);
    if (!acheteur) return null;
    const choix = articles.filter((a) => surplus(a) > 0 && M.affinite(a, acheteur) > 0);
    const article = choix.find((a) => a.id === neg.articleId) || choix[0];
    if (!article) return null;
    return { acheteur, article, choix };
  }, [neg, acheteurs, articles, surplus, M]);

  const demain = acheteurDeDemain(jour);
  const garde = M.gardeFous(acheteurs);
  const dateDuJour = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <main className="view large comptoir" id="contenu">
      <div className="section-titre comptoir-tete">
        <div className="comptoir-hote">
          <h1>Le Comptoir</h1>
          {/* La date, et rien d'autre. « Marché de l'occasion » redisait le
              titre, « les acheteurs changent à minuit » est une règle : elle
              est passée dans la bulle, où on la lit une fois. */}
          <p className="muted">
            {dateDuJour}
            <button
              type="button"
              className="aide-bouton"
              aria-expanded={regie}
              aria-label="Calibration du marché"
              onClick={() => setRegie((v) => !v)}
            >?</button>
          </p>
          {regie && (
            <div className="comptoir-bulle" role="status">
              <button type="button" className="bulle-fermer" aria-label="Fermer"
                      onClick={() => setRegie(false)}>×</button>
              {/* Écrit pour quelqu'un qui arrive : quatre phrases, une idée
                  par phrase, aucun mot de métier. La version précédente
                  expliquait la calibration du marché avant d'avoir dit ce
                  qu'on fait ici. */}
              <p className="bulle-titre">Comment ça marche</p>
              <ul className="bulle-liste">
                <li>
                  <b>Trois acheteurs passent chaque jour</b>, et changent à
                  minuit. Chacun n'achète que ce qui l'intéresse.
                </li>
                <li>
                  <b>Ils paient mieux que l'échoppe</b>, mais il faut tomber sur
                  le bon jour. L'échoppe, elle, rachète tout, tout de suite, à
                  petit prix.
                </li>
                <li>
                  <b>Marchander est un pari</b> : une seule tentative par carte
                  et par acheteur. Réussi, il monte son offre ; raté, il la
                  baisse. Le lendemain remet les compteurs à zéro.
                </li>
                <li>
                  <b>Le rayon du jour</b> est ce que l'échoppe vend. Six pièces,
                  renouvelées chaque nuit.
                </li>
              </ul>
              <p className="bulle-hors-jeu">
                Hors jeu — un booster entièrement revendu rapporte{" "}
                <b className={garde.liq < 1 ? "ok" : "ko"}>{(garde.liq * 100).toFixed(0)} %</b> de
                son prix à l'échoppe, <b className={garde.liqMax < 1 ? "ok" : "ko"}>{(garde.liqMax * 100).toFixed(0)} %</b>{" "}
                au meilleur acheteur. Au-dessus de 100 %, l'économie se casse.
                Détail : <code>node scripts/audit-marche.mjs</code>.
              </p>
            </div>
          )}
        </div>
        <div className="comptoir-annonce">
          <button
            type="button"
            className="btn quiet sm"
            onClick={() => setAnnonce((v) => !v)}
            aria-expanded={annonce}
          >
            Annonce de demain
          </button>
          {annonce && (
            <div className="annonce-bulle" role="status">
              <p className="annonce-nom">{demain.nom}</p>
              <p className="muted">{demain.sub}</p>
              {conservateurPresent(jour + 1) && (
                <p className="annonce-rare">Le Conservateur Royal passera.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {avis && (
        <p className="comptoir-avis" role="status" aria-live="polite">{avis}</p>
      )}

      {/* ── Acheteurs du jour ─────────────────────────────────────────── */}
      <section aria-labelledby="t-acheteurs">
        <div className="section-titre">
          <h2 id="t-acheteurs">Acheteurs du jour</h2>
          <span className="jeton">{acheteurs.length} présents</span>
        </div>
        <div className="acheteurs">
          {acheteurs.map((b) => {
            const interesse = articles.filter((a) => surplus(a) > 0 && M.affinite(a, b) > 0)
              .sort((x, y) => M.offreUnitaire(y, b) - M.offreUnitaire(x, b));
            const actif = interesse.length > 0;
            return (
              <button
                key={b.id}
                type="button"
                className={`acheteur${b.exceptionnel ? " exceptionnel" : ""}${actif ? "" : " inerte"}`}
                onClick={() => ouvrirNegoce(b, interesse[0])}
                aria-label={actif
                  ? `Négocier avec ${b.nom}, intéressé par ${interesse[0].carte.nom}`
                  : `${b.nom} ne recherche aucun de vos surplus aujourd'hui`}
              >
                {/* Le portrait en bandeau haut, ancré en haut. En colonne
                    latérale, un carré de 384 pixels rogné dans une boîte deux
                    fois plus haute que large perdait la moitié du visage.
                    Ancré en haut sur toute la largeur, il garde le regard. */}
                <span className="acheteur-vignette">
                  <Portrait acheteur={b} classe="acheteur-portrait" />
                  {b.exceptionnel && <span className="acheteur-sceau">Exceptionnel</span>}
                </span>
                <span className="acheteur-corps">
                  <span className="acheteur-nom">{b.nom}</span>
                  <span className="acheteur-sub">{b.sub}</span>
                  <span className="acheteur-spec">
                    <span aria-hidden="true" className="acheteur-ico">{b.icon}</span>
                    <span>{b.spec}</span>
                  </span>
                  <span className="acheteur-quote">{b.quote}</span>
                  <span className="acheteur-pied">
                    {actif ? (
                      <>Votre <b>{interesse[0].carte.nom}</b>{interesse[0].rainbow ? " rainbow" : ""} l'intéresse
                        {" "}— <b className="or">{nb(M.offreUnitaire(interesse[0], b))} PO</b></>
                    ) : (
                      <span className="muted">Aucun de vos surplus ne l'intéresse aujourd'hui.</span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Le rayon du jour et la vente rapide ───────────────────────────
          Les deux mouvements d'argent immédiats, côte à côte et en tête :
          acheter une pièce, ou liquider tout le surplus. Le rayon passe de huit
          à six pièces pour tenir sur deux rangs de trois à côté de la vente
          rapide, alignés sur la même ligne. Le tri du surplus, qui demande de
          la lecture, vient après. */}
      <div className="comptoir-colonnes">
        <section className="panneau" aria-labelledby="t-rayon">
          <div className="panneau-tete">
            <h2 id="t-rayon">Le rayon du jour</h2>
            <span className="jeton">{fmt(bourse.po)} PO en poche</span>
          </div>
          {rayon.length === 0 ? (
            <p className="panneau-vide">Le rayon est vide aujourd'hui.</p>
          ) : (
            <div className="rayon">
              {rayon.map(({ a, prix, possede }) => (
                <article key={a.id} className={`piece${possede ? " deja" : ""}`}>
                  <span className="cp-dos" aria-hidden="true" style={dos(a.tier)} />
                  <div className="piece-corps">
                    <p className="piece-nom">
                      {a.carte.nom}
                      {a.rainbow && <span className="marque-rainbow" title="Version rainbow"> ✦</span>}
                    </p>
                    <p className="piece-palier" style={{ color: encre(a.tier) }}>
                      {TIER_INFO[a.tier]?.nom}
                      {possede && <span className="muted"> · déjà en collection</span>}
                    </p>
                    <p className="piece-repere muted">
                      {[a.carte.rep1, a.carte.race, a.carte.rep3].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`btn sm${bourse.po < prix ? " quiet" : ""}`}
                    onClick={() => acheter(a)}
                    disabled={bourse.po < prix}
                    aria-label={`Acheter ${a.carte.nom} pour ${fmt(prix)} pièces d'or`}
                  >
                    {fmt(prix)} PO
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="panneau rapide" aria-labelledby="t-rapide">
          <h2 id="t-rapide">Vente rapide</h2>
          <p className="rapide-montant">{fmt(totalRapide)} PO</p>
          <p className="muted">
            {nSurplus} exemplaire{nSurplus > 1 ? "s" : ""} au prix de rachat garanti
            ({TIER_ORDER.filter((t) => REVENTE[t]).slice(0, 4).map((t) => `${REVENTE[t]}`).join(" / ")} PO
            par palier) — moins qu'un bon acheteur, sans attendre le bon jour.
          </p>
          <button type="button" className="btn" onClick={liquider} disabled={nSurplus === 0}>
            {nSurplus === 0 ? "Rien à liquider" : "Liquider mes doublons"}
          </button>
          <p className="muted fine">
            Bourse du Comptoir : {fmt(M.fonds)} PO, renflouée chaque nuit.
          </p>
        </aside>
      </div>

      {/* ── Le surplus, carte par carte ───────────────────────────────── */}
      <section className="panneau" aria-labelledby="t-vendre">
        <div className="panneau-tete">
          <h2 id="t-vendre">Vos exemplaires en trop</h2>
          <span className="jeton">{nSurplus} en surplus</span>
        </div>

        {vendables.length === 0 ? (
          <p className="panneau-vide">
            Aucun surplus pour l'instant. Les doublons arrivent vite :{" "}
            <Lien vers="/boutique" actif={false}>ouvrez un booster</Lien>.
          </p>
        ) : (
          <ul className="lignes">
            {vendables.slice(0, 60).map(({ a, acheteur, offre, rachat, n }) => (
              <li key={a.id}>
                <div className="ligne-carte">
                  <span className="cp-dos" aria-hidden="true" style={dos(a.tier)} />
                  <div>
                    <p className="ligne-nom">
                      {a.carte.nom}
                      {a.rainbow && <span className="marque-rainbow" title="Version rainbow"> ✦</span>}
                    </p>
                    <p className="ligne-palier" style={{ color: encre(a.tier) }}>
                      {TIER_INFO[a.tier]?.nom}
                      {M.hausse(a) && <span className="hausse"> ↗ en hausse</span>}
                    </p>
                  </div>
                </div>
                <dl className="ligne-chiffres">
                  <div><dt>Surplus</dt><dd>×{n}</dd></div>
                  <div><dt>Acheteur</dt><dd>{acheteur ? acheteur.nom : <span className="muted">aucun</span>}</dd></div>
                  <div><dt>Son offre</dt><dd className={acheteur ? "or" : "sans-offre"}>{acheteur ? `${nb(offre)} PO` : "—"}</dd></div>
                  <div><dt>Échoppe</dt><dd>{nb(rachat)} PO</dd></div>
                </dl>
                {acheteur ? (
                  <button type="button" className="btn quiet sm" onClick={() => ouvrirNegoce(acheteur, a)}>
                    Négocier
                  </button>
                ) : (
                  <span className="muted attendre">Attendre</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {negActeurs && (
        <Negoce
          M={M}
          acheteur={negActeurs.acheteur}
          article={negActeurs.article}
          articles={negActeurs.choix}
          surplus={surplus}
          onArticle={(a, o) => {
            setNeg({ acheteurId: negActeurs.acheteur.id, articleId: a.id });
            if (o?.rafraichir) rafraichir();
          }}
          onVendre={vendre}
          onFermer={() => setNeg(null)}
        />
      )}
    </main>
  );
}
