import { useEffect, useRef, useState } from "react";
import { TIER_INFO } from "../config/tiers.js";
import { CFG } from "./marche.js";
import { dos, encre } from "./teintes.js";

const fmt = (n) => Math.round(n).toLocaleString("fr-FR");

/**
 * La fenêtre de négoce.
 *
 * Un dialogue complet, comme le plein écran d'une carte : `aria-modal`, piège
 * à focus, focus rendu à l'appelant, fermeture par Échap. Le module d'origine
 * n'avait qu'un fond cliquable et l'écoute d'Échap ; sans piège, la tabulation
 * sortait derrière la fenêtre et on marchandait à l'aveugle.
 */
export default function Negoce({ M, acheteur, article, articles, surplus, onArticle, onVendre, onFermer }) {
  const [qte, setQte] = useState(1);
  /**
   * Le marchandage se jouait sans rien annoncer : l'offre changeait de chiffre,
   * le verdict s'ajoutait en bas et la fenêtre grandissait d'un coup. Deux
   * corrections : une brève pesée avant le résultat, puis un éclat sur le
   * montant — vert s'il monte, ambre-brûlé s'il tombe. `pese` porte l'attente,
   * `eclat` porte l'issue le temps de l'animation.
   */
  const [pese, setPese] = useState(false);
  const [aide, setAide] = useState(false);
  /**
   * Filtre de la liste des cartes.
   *
   * La liste était une seule rangée qui défilait à l'horizontale. Passé une
   * dizaine de doublons, choisir revenait à tirer un tapis roulant sans savoir
   * ce qui restait derrière le bord — et une collection avancée en propose
   * cinquante. Elle passe en grille de pastilles, sur trois rangs au plus, avec
   * un champ de filtre et le prix unitaire écrit sur chaque pastille : la liste
   * devient un tarif trié, pas un tourniquet.
   */
  const [filtre, setFiltre] = useState("");
  const [eclat, setEclat] = useState(null);
  const chrono = useRef([]);
  const boite = useRef(null);
  const rendu = useRef(null);
  const choisi = useRef(null);

  useEffect(() => { setQte(1); setPese(false); setEclat(null); setAide(false); }, [article?.id]);
  // Le filtre se vide quand on change d'acheteur, pas quand on change de carte.
  useEffect(() => { setFiltre(""); }, [acheteur?.id]);
  useEffect(() => () => chrono.current.forEach(clearTimeout), []);

  /* La liste des cartes qui l'intéressent défile : sans ceci, ouvrir un négoce
     depuis une ligne du tableau montrait le début de la liste et pas la carte
     sur laquelle on venait de cliquer. */
  useEffect(() => {
    choisi.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [article?.id]);

  useEffect(() => {
    rendu.current = document.activeElement;
    const premier = boite.current?.querySelector("button, input");
    premier?.focus();
    const surTouche = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onFermer(); return; }
      if (e.key !== "Tab") return;
      const cibles = boite.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!cibles || !cibles.length) return;
      const debut = cibles[0];
      const fin = cibles[cibles.length - 1];
      if (e.shiftKey && document.activeElement === debut) { e.preventDefault(); fin.focus(); }
      else if (!e.shiftKey && document.activeElement === fin) { e.preventDefault(); debut.focus(); }
    };
    document.addEventListener("keydown", surTouche, true);
    const rendre = rendu.current;
    return () => {
      document.removeEventListener("keydown", surTouche, true);
      if (rendre && rendre.focus) rendre.focus();
    };
  }, [onFermer]);

  if (!article || !acheteur) return null;

  const dispo = surplus(article);
  const q = Math.max(1, Math.min(Math.max(dispo, 1), parseInt(qte, 10) || 1));
  const marche = M.marchandage(acheteur.id, article.id);
  const facteur = marche ? marche.facteur : 1;
  const total = M.offreLot(article, acheteur, q, facteur);
  const rapide = q * M.cotation(article).bid;
  const aff = M.affinite(article, acheteur);
  const palier = TIER_INFO[article.tier]?.nom || article.tier;

  /** Les cartes retenues par le filtre. Accents et casse ignorés. */
  const pli = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const q_filtre = pli(filtre).trim();
  const visibles = q_filtre
    ? articles.filter((a) => pli(a.carte.nom).includes(q_filtre))
    : articles;

  const marchander = () => {
    if (marche || pese) return;
    setPese(true);
    // Une demi-seconde de pesée : le temps que la proposition soit examinée.
    // Sans elle, le chiffre changeait dans le même souffle que le clic et rien
    // ne signalait qu'un dé venait d'être jeté.
    chrono.current.push(setTimeout(() => {
      const r = M.marchander(acheteur, article);
      setPese(false);
      setEclat(r.ok ? "ok" : "ko");
      chrono.current.push(setTimeout(() => setEclat(null), 900));
      onArticle(article, { rafraichir: true });
    }, 520));
  };

  return (
    <div
      className="neg-fond"
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}
    >
      <section
        className="neg"
        role="dialog"
        aria-modal="true"
        aria-label={`Négoce avec ${acheteur.nom}`}
        ref={boite}
      >
        <div className="neg-scene">
          <div className="neg-halo" aria-hidden="true" />
          <img
            className="neg-portrait"
            src={`${import.meta.env.BASE_URL}comptoir/${acheteur.portrait}.webp`}
            alt=""
            loading="lazy"
          />
          <div className="neg-identite">
            <h2>{acheteur.nom}</h2>
            <p className="neg-sub">{acheteur.sub}</p>
            <p className="neg-spec">
              <span aria-hidden="true">{acheteur.icon}</span> {acheteur.spec}
            </p>
          </div>
          <blockquote className="neg-quote">{acheteur.quote}</blockquote>
        </div>

        <div className="neg-panneau">
          <div className="neg-tete">
            {/* « Proposez un exemplaire en trop à X » : le titre le dit, le
                portrait le montre, et la grille juste dessous ne laisse aucun
                doute. */}
            <h3>Négoce</h3>
            <button type="button" className="neg-fermer" onClick={onFermer} aria-label="Fermer le négoce">×</button>
          </div>

          {articles.length > 1 && (
            <div className="neg-liste">
              {articles.length > 8 && (
                <div className="neg-liste-tete">
                  <input
                    type="search"
                    className="neg-filtre"
                    value={filtre}
                    onChange={(e) => setFiltre(e.target.value)}
                    placeholder="Filtrer par nom…"
                    aria-label="Filtrer les cartes qui l'intéressent"
                  />
                  <span className="neg-compte">
                    {visibles.length === articles.length
                      ? `${articles.length} cartes`
                      : `${visibles.length} sur ${articles.length}`}
                  </span>
                </div>
              )}
              <div className="neg-choix" role="group" aria-label="Cartes qui l'intéressent">
                {visibles.map((a) => (
                  <button
                    key={a.id}
                    ref={a.id === article.id ? choisi : null}
                    type="button"
                    className={a.id === article.id ? "on" : ""}
                    aria-pressed={a.id === article.id}
                    onClick={() => onArticle(a)}
                  >
                    <span className="neg-puce-nom">
                      {a.carte.nom}
                      {a.rainbow && <span className="marque-rainbow" title="Version rainbow"> ✦</span>}
                    </span>
                    <b>×{surplus(a)}</b>
                    {/* Le prix sur la pastille : c'est lui qu'on cherche en
                        parcourant la liste, et la liste est triée dessus. */}
                    <em>{fmt(M.offreUnitaire(a, acheteur))} PO</em>
                  </button>
                ))}
                {visibles.length === 0 && (
                  <p className="neg-rien">Aucune de ces cartes ne porte ce nom.</p>
                )}
              </div>
            </div>
          )}

          {/* La carte et la quantité sur un rang : c'était une boîte de plus. */}
          <div className="neg-carte">
            <span className="cp-dos" aria-hidden="true" style={dos(article.tier)} />
            <div className="neg-carte-nom">
              <p className="neg-nom">
                {article.carte.nom}
                {article.rainbow && <span className="marque-rainbow" title="Version rainbow"> ✦</span>}
              </p>
              <p className="neg-palier" style={{ color: encre(article.tier) }}>
                {palier}
                {aff > 1 && " · double affinité"}
                {M.hausse(article) && " · en hausse"}
                {` · ${dispo} en surplus`}
              </p>
            </div>
            <div className="pas">
              <button type="button" onClick={() => setQte(Math.max(1, q - 1))} aria-label="Réduire la quantité">−</button>
              <input
                value={q}
                onChange={(e) => setQte(e.target.value)}
                inputMode="numeric"
                aria-label="Quantité à vendre"
              />
              <button type="button" onClick={() => setQte(Math.min(Math.max(dispo, 1), q + 1))} aria-label="Augmenter la quantité">+</button>
            </div>
          </div>

          {/* Trois chiffres sur un rang, séparés par des filets — le séparateur
              est celui de la ligne de repères des cartes. Ils vivaient dans
              quatre encadrés dont deux ne servaient qu'à border un nombre. */}
          <dl className="neg-chiffres">
            <div>
              <dt>Offre de {acheteur.nom.split(" ").pop()}</dt>
              <dd>
                <b className={`montant${eclat ? " eclat-" + eclat : ""}`}>
                  {pese ? "…" : `${fmt(total)} PO`}
                </b>
              </dd>
            </div>
            <div>
              <dt>Échoppe</dt>
              <dd><span className="second">{fmt(rapide)} PO</span></dd>
            </div>
            <div>
              <dt>Chance</dt>
              <dd><span className="second">{Math.round(acheteur.chance * 100)} %</span></dd>
            </div>
          </dl>

          <div className="neg-actions">
            <button type="button" className="btn" onClick={() => onVendre(article, acheteur, q, facteur)}>
              Vendre
            </button>
            {marche ? (
              <span className="neg-fait">Déjà marchandé</span>
            ) : (
              <button type="button" className="btn quiet" onClick={marchander} disabled={pese}>
                {pese ? "Il examine…" : "Marchander"}
              </button>
            )}
          </div>

          {/* Emplacement réservé : la fenêtre ne doit pas grandir au moment où
              le verdict tombe. */}
          <div className="neg-issue" aria-live="polite">
            {marche && (
              <p className={`neg-verdict ${marche.ok ? "ok" : "ko"}`}>
                {marche.ok
                  ? `Marchandage réussi : ${acheteur.nom} monte à ${fmt(total)} PO.`
                  : `Échec : ${acheteur.nom} a revu son offre à la baisse. Vous pouvez vendre quand même, ou revenir demain.`}
              </p>
            )}
          </div>

          <p className="neg-pied">
            Réussite {fmt(M.offreLot(article, acheteur, q, facteur * (1 + acheteur.up)))} PO ·
            échec {fmt(M.offreLot(article, acheteur, q, facteur * (1 - acheteur.down)))} PO ·
            un jet par jour et par carte
            <button
              type="button"
              className="neg-aide"
              aria-expanded={aide}
              aria-label="Comment fonctionne le marchandage"
              onClick={() => setAide((v) => !v)}
            >?</button>
          </p>
          {aide && (
            <div className="neg-bulle" role="status">
              Un seul marchandage par acheteur et par carte dans la journée. En cas
              d'échec l'offre baisse réellement, et le résultat reste verrouillé
              jusqu'à demain même si vous fermez la fenêtre. L'échoppe ne paie jamais
              plus de{" "}
              {CFG.plafondRachat.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} fois
              l'ancrage d'une carte, et sa bourse du jour n'est pas sans fond.
              <button type="button" className="neg-bulle-fermer" onClick={() => setAide(false)}
                      aria-label="Fermer l'aide">×</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
