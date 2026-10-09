import { useEffect, useMemo, useRef, useState } from "react";
import { TIER_INFO } from "../config/tiers.js";
import { encre } from "./teintes.js";
import { MANIERES, FIN_DE_JOURNEE, replique } from "./voix.js";
import Carte from "../components/Carte.jsx";

const fmt = (n) => Math.round(n).toLocaleString("fr-FR");
const PO = (n) => `${fmt(n)} PO`;
const pli = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * La jauge du quota : un rail et ce qu'il reste à racheter aujourd'hui.
 * Épuisée, elle s'efface et laisse la phrase.
 */
export function Jauge({ restant, quota, large = false }) {
  if (!quota || !Number.isFinite(quota)) return null;
  return (
    <div className={`jauge${large ? " large" : ""}`}>
      {restant > 0 && (
        <span className="jauge-rail" aria-hidden="true">
          <span style={{ width: `${(restant / quota) * 100}%` }} />
        </span>
      )}
      <span className={restant > 0 ? "jauge-texte" : "jauge-texte fini"}>
        {restant > 0
          ? `Encore ${restant} achat${restant > 1 ? "s" : ""} aujourd'hui`
          : "Il a fini sa journée. Revenez demain."}
      </span>
    </div>
  );
}

/**
 * Le négoce, en deux écrans.
 *
 * L'ancienne fenêtre mêlait le choix de la carte (des pastilles tronquées) et
 * le marchandage, et faisait doublon avec le tableau du surplus. L'écran A
 * montre les cartes qui intéressent l'acheteur, en vraies vignettes avec leur
 * prix ; l'écran B marchande une carte. « Retour à ses cartes » ramène de B à
 * A sans fermer.
 *
 * Un dialogue complet : `aria-modal`, piège à focus, fermeture par Échap,
 * focus rendu à l'appelant par la page.
 */
export default function Negoce({ M, acheteur, articles, surplus, cfgImage, fichiers, onVendre, onMarchander, onFermer }) {
  const [carte, setCarte] = useState(null);      // id de l'article en marchandage (écran B)
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState("prix");
  const [qte, setQte] = useState(1);
  const [maniere, setManiere] = useState(null);
  const [pese, setPese] = useState(false);
  const [eclat, setEclat] = useState(null);
  const [conclue, setConclue] = useState(null);  // { vendus, gain } après une vente
  const [caisseVide, setCaisseVide] = useState(false); // vente refusée : le Comptoir n'a plus de quoi payer
  const boite = useRef(null);
  const chrono = useRef([]);
  const venteRef = useRef(null);

  useEffect(() => () => chrono.current.forEach(clearTimeout), []);

  /* Piège à focus et Échap. */
  useEffect(() => {
    boite.current?.querySelector("button, input")?.focus();
    const surTouche = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onFermer(); return; }
      if (e.key !== "Tab") return;
      const cibles = boite.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!cibles || !cibles.length) return;
      const debut = cibles[0];
      const fin = cibles[cibles.length - 1];
      if (e.shiftKey && document.activeElement === debut) { e.preventDefault(); fin.focus(); }
      else if (!e.shiftKey && document.activeElement === fin) { e.preventDefault(); debut.focus(); }
    };
    document.addEventListener("keydown", surTouche, true);
    return () => document.removeEventListener("keydown", surTouche, true);
  }, [onFermer]);

  const restant = M.restant(acheteur);
  const prenom = acheteur.nom.split(" ").pop();

  const visibles = useMemo(() => {
    const q = pli(recherche).trim();
    const l = q ? articles.filter((a) => pli(a.carte.nom).includes(q)) : articles.slice();
    if (tri === "nom") l.sort((x, y) => x.carte.nom.localeCompare(y.carte.nom, "fr"));
    return l;
  }, [articles, recherche, tri]);

  const article = carte ? M.parId[carte] : null;

  const ouvrirCarte = (a) => {
    if (restant === 0) return;
    setCarte(a.id);
    setQte(Math.max(1, Math.min(surplus(a), restant)));
    setManiere(M.marchandage(acheteur.id, a.id)?.maniere || null);
    setPese(false); setEclat(null); setConclue(null); setCaisseVide(false);
  };
  const retourA = () => { setCarte(null); setConclue(null); setCaisseVide(false); };

  /* ── La réplique de la colonne du portrait ─────────────────────────── */
  const marche = article ? M.marchandage(acheteur.id, article.id) : null;
  const voix = conclue ? replique(acheteur, "merci")
    : restant === 0 ? FIN_DE_JOURNEE
      : !article ? acheteur.quote
        : marche ? replique(acheteur, marche.ok ? "ok" : "ko")
          : replique(acheteur, "indice");
  const humeur = conclue || marche?.ok ? "content" : marche && !marche.ok ? "decu" : "";

  return (
    <div className="neg-fond" onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <section className={`neg${article ? " ecran-b" : " ecran-a"}`} role="dialog" aria-modal="true"
               aria-labelledby="neg-titre" ref={boite}>
        <div className={`neg-scene ${humeur}`}>
          <span className="neg-lueur" aria-hidden="true" />
          <img className="neg-portrait" alt=""
               src={`${import.meta.env.BASE_URL}comptoir/${acheteur.portrait}.webp`} />
        </div>
        {/* Hors de la scène : au bureau elle se pose par-dessus le haut du
            portrait, au téléphone elle passe sous le bandeau du portrait. */}
        <div className="neg-identite">
          <p className="neg-nom">{acheteur.nom}</p>
          <p className="neg-sub">{acheteur.sub}, {acheteur.spec.charAt(0).toLowerCase() + acheteur.spec.slice(1)}</p>
          <p className="neg-voix" aria-live="polite">{voix}</p>
        </div>

        <div className="neg-panneau">
          <div className="neg-tete">
            {article ? (
              <button type="button" className="neg-retour" onClick={retourA}>
                <span aria-hidden="true">←</span> <span id="neg-titre">Retour à ses cartes</span>
              </button>
            ) : (
              <h2 id="neg-titre">Ce qui intéresse {prenom}</h2>
            )}
            <button type="button" className="neg-fermer" onClick={onFermer} aria-label="Fermer le négoce">×</button>
          </div>
          <Jauge restant={restant} quota={acheteur.quota} large />

          {!article ? (
            <EcranA
              visibles={visibles} total={articles.length} M={M} acheteur={acheteur} surplus={surplus}
              restant={restant} recherche={recherche} setRecherche={setRecherche} tri={tri} setTri={setTri}
              cfgImage={cfgImage} fichiers={fichiers} onOuvrir={ouvrirCarte} prenom={prenom}
            />
          ) : (
            <EcranB
              M={M} acheteur={acheteur} article={article} surplus={surplus} restant={restant}
              qte={qte} setQte={setQte} maniere={maniere} setManiere={setManiere}
              pese={pese} eclat={eclat} conclue={conclue} caisseVide={caisseVide} venteRef={venteRef}
              cfgImage={cfgImage} fichiers={fichiers} prenom={prenom}
              onRetour={retourA}
              onMarchander={() => {
                if (marche || pese || !maniere) return;
                setPese(true);
                // Une demi-seconde de pesée : le temps que la proposition soit
                // examinée. Sans elle, rien ne signalait qu'un dé était jeté.
                chrono.current.push(setTimeout(() => {
                  const r = M.marchander(acheteur, article, maniere);
                  setPese(false);
                  setEclat(r.ok ? "ok" : "ko");
                  chrono.current.push(setTimeout(() => setEclat(null), 900));
                  onMarchander();
                }, 520));
              }}
              onVendre={(q, facteur) => {
                const r = onVendre(article, acheteur, q, facteur, venteRef.current);
                if (r?.caisseVide) setCaisseVide(true);
                else if (r) setConclue(r);
              }}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function EcranA({ visibles, total, M, acheteur, surplus, restant, recherche, setRecherche, tri, setTri, cfgImage, fichiers, onOuvrir, prenom }) {
  return (
    <>
      <div className="neg-outils">
        <input type="search" className="neg-recherche" value={recherche}
               onChange={(e) => setRecherche(e.target.value)}
               placeholder="Chercher parmi ses cartes" aria-label="Chercher parmi ses cartes" />
        <div className="cmp-puces" role="group" aria-label="Trier">
          {[["prix", "Par prix"], ["nom", "Par nom"]].map(([k, nom]) => (
            <button key={k} type="button" className="puce" aria-pressed={tri === k} onClick={() => setTri(k)}>{nom}</button>
          ))}
        </div>
      </div>
      <div className="neg-grille-zone">
        <div className={`neg-grille${restant === 0 ? " eteinte" : ""}`}>
          {visibles.map((a) => {
            const n = surplus(a);
            const prix = M.offreUnitaire(a, acheteur);
            return (
              <div key={a.id} className="neg-case">
                <div className="cmp-vignette">
                  <Carte
                    c={{ ...a.carte, rainbow: a.rainbow }} taille="petit" cfgImage={cfgImage} fichiers={fichiers}
                    vivant={restant > 0}
                    onToucher={restant > 0 ? () => onOuvrir(a) : undefined}
                    etiquette={`${a.carte.nom}${a.rainbow ? " rainbow" : ""}, ${n} en trop, ${PO(prix)} l'unité. Marchander`}
                  />
                  <span className="cmp-nb">×{n}</span>
                </div>
                <span className="cmp-prix">{PO(prix)} <span className="muted">l'unité</span></span>
              </div>
            );
          })}
        </div>
        {visibles.length === 0 && <p className="muted">Aucune de ses cartes ne porte ce nom.</p>}
      </div>
      <p className="neg-pied">
        {restant === 0
          ? `${prenom} a fini sa journée : ses cartes restent ici jusqu'à demain.`
          : `${total} carte${total > 1 ? "s" : ""}, triée${total > 1 ? "s" : ""} par ${tri === "prix" ? "prix" : "nom"}. Touchez une carte pour la marchander.`}
      </p>
    </>
  );
}

function EcranB({ M, acheteur, article, surplus, restant, qte, setQte, maniere, setManiere, pese, eclat, conclue, caisseVide, venteRef, cfgImage, fichiers, prenom, onRetour, onMarchander, onVendre }) {
  const dispo = surplus(article);
  const max = Math.max(0, Math.min(dispo, restant));
  const q = Math.max(1, Math.min(qte, max || 1));
  const marche = M.marchandage(acheteur.id, article.id);
  const facteur = marche ? marche.facteur : 1;
  const total = M.offreLot(article, acheteur, q, facteur);
  const base = M.offreLot(article, acheteur, q, 1);
  const echoppe = M.rachatLot(article, q);
  const borne = restant < dispo ? `au plus ${max}, son quota du jour` : `au plus ${max}, vos exemplaires en trop`;
  const palier = TIER_INFO[article.tier]?.nom || article.tier;

  let verdict = "Choisissez comment présenter la carte, puis marchandez. Ou vendez au prix affiché.";
  let ton = "";
  if (pese) { verdict = `${prenom} réfléchit…`; ton = "pese"; }
  else if (conclue) { verdict = `Vente conclue : +${PO(conclue.gain)}.`; ton = "conclue"; }
  else if (caisseVide) { verdict = "La caisse du Comptoir est vide pour aujourd'hui."; ton = "ko"; }
  else if (marche?.ok) { verdict = `Offre relevée : ${PO(total)} au lieu de ${PO(base)}.`; ton = "ok"; }
  else if (marche && total <= echoppe) { verdict = `${prenom} ne paiera pas plus que l'échoppe aujourd'hui.`; ton = "ko"; }
  else if (marche) { verdict = `Offre baissée jusqu'à demain : ${PO(total)} au lieu de ${PO(base)}.`; ton = "ko"; }

  const fini = !!conclue || max === 0;

  return (
    <>
      <div className="neg-carte">
        <div className="cmp-vignette neg-carte-vignette">
          <Carte c={{ ...article.carte, rainbow: article.rainbow }} taille="petit" cfgImage={cfgImage} fichiers={fichiers} />
        </div>
        <div className="neg-carte-infos">
          <div>
            <p className="neg-carte-nom">{article.carte.nom}</p>
            <p style={{ color: article.rainbow ? "var(--m-rainbow)" : encre(article.tier) }}>
              {palier}{article.rainbow ? " · Rainbow" : ""}
            </p>
            <p className="muted">
              {dispo > 0 ? `Vous en avez ${dispo} en trop.` : "Vous n'en avez plus en trop."}
            </p>
            {article.rainbow && <p className="cmp-mention-rainbow">✦ Une rainbow en trop améliore vos cartes pour le Donjon.</p>}
          </div>
          <dl className="neg-chiffres">
            {/* Après une vente, les chiffres sont ceux de la vente : l'offre
                recalculée sur le stock suivant affichait un autre montant que
                celui qu'on venait d'encaisser. */}
            <div>
              <dt>Son offre</dt>
              <dd className={`neg-offre${eclat ? " eclat-" + eclat : ""}`}>
                {pese ? "…" : PO(conclue ? conclue.gain : total)}
              </dd>
              <dd className="muted">
                {conclue
                  ? `${conclue.vendus} vendue${conclue.vendus > 1 ? "s" : ""}, ${PO(conclue.gain / conclue.vendus)} l'unité`
                  : `${PO(total / q)} l'unité`}
              </dd>
            </div>
            {!conclue && (
              <div>
                <dt>L'échoppe paie</dt>
                <dd className="neg-echoppe">{PO(echoppe)}</dd>
              </div>
            )}
          </dl>
          {!fini && (
            <div className="neg-quantite">
              <span className="muted">Quantité</span>
              <button type="button" onClick={() => setQte(Math.max(1, q - 1))} disabled={q <= 1} aria-label="Une de moins">−</button>
              <span className="neg-qte" aria-live="polite">{q}</span>
              <button type="button" onClick={() => setQte(Math.min(max, q + 1))} disabled={q >= max} aria-label="Une de plus">+</button>
              <span className="muted">{borne}</span>
            </div>
          )}
        </div>
      </div>

      <div className="neg-actions-zone">
        {!fini && (
          <div className="cmp-puces" role="radiogroup" aria-label="Présenter la carte">
            <span className="muted">Présenter</span>
            {MANIERES.map((m) => (
              <button key={m.id} type="button" role="radio" className="puce"
                      aria-checked={maniere === m.id} disabled={!!marche || pese}
                      onClick={() => setManiere(m.id)}>
                {m.nom}
              </button>
            ))}
          </div>
        )}
        <div className="neg-actions">
          {fini ? (
            <button type="button" className="btn neg-vendre" onClick={onRetour} ref={venteRef}>Retour à ses cartes</button>
          ) : (
            <>
              <button type="button" className="btn neg-vendre" ref={venteRef} disabled={pese}
                      onClick={() => onVendre(q, facteur)}>
                Vendre {q} à {acheteur.nom.startsWith("Le ") ? "au " + acheteur.nom.slice(3) : acheteur.nom}, {PO(total)}
              </button>
              <button type="button" className="neg-marchander" onClick={onMarchander}
                      disabled={!!marche || pese || !maniere}>
                {marche ? "Essai utilisé" : pese ? `${prenom} réfléchit…` : "Marchander"}
              </button>
            </>
          )}
        </div>
        <p className={`neg-verdict ${ton}`} aria-live="polite">{verdict}</p>
      </div>
      <p className="neg-pied" title="Chaque acheteur préfère une manière de présenter la carte, et sa réplique le laisse deviner. Bien présentée, la carte se paie plus cher ; mal présentée, l'offre baisse jusqu'à demain, sans jamais passer sous le prix de l'échoppe. Un essai par carte et par jour. Chaque acheteur rachète un nombre limité d'exemplaires par jour.">
        Un essai par carte et par jour. Survolez pour la règle complète.
      </p>
    </>
  );
}
