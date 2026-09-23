import { useMemo, useRef, useState } from "react";
import Carte from "./Carte.jsx";
import DosCarte from "./DosCarte.jsx";
import { TIERS, TIER_ORDER, TIER_INFO } from "../config/tiers.js";
import { BOOSTERS, BOOSTER_PAR_ID } from "../extensions/index.js";
import { nomComplet } from "../config/speciales.js";
import { exporter, importer } from "../lib/storage.js";

/** Une case manquante : le dos, grisé, sans interaction ni nom. */
function Manquante() {
  return (
    <div className="case-carte manquante" role="img" aria-label="Carte non obtenue">
      <div className="cardbox cb-petit">
        <div className="persp"><div className="tilt"><div className="flipper">
          <DosCarte />
        </div></div></div>
      </div>
    </div>
  );
}

/**
 * L'ouverture du volet des statistiques est une commodité d'affichage propre à
 * cet appareil : elle ne part pas sur le compte, et un stockage refusé la
 * laisse simplement fermée.
 */
const CLE_STATS = "brume-thalazur:biblio-stats";
const lireStats = () => { try { return localStorage.getItem(CLE_STATS) === "1"; } catch { return false; } };
const ecrireStats = (v) => { try { localStorage.setItem(CLE_STATS, v ? "1" : "0"); } catch { /* sans importance */ } };

const pli = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * La bibliothèque.
 * ------------------------------------------------------------------
 *
 * Deux cases possibles par carte — la normale et la rainbow — mais une seule
 * obligatoire.
 *
 * La bibliothèque a montré deux grilles complètes, l'une par version, avec une
 * bascule : c'était compter deux fois le même set, et afficher deux cent vingt
 * dos gris pour dire qu'on n'avait pas la rainbow, alors qu'elle sort trois
 * fois sur cent. Elle a ensuite fondu les deux en une case unique : la rainbow
 * y cachait la normale, et posséder les deux ne se voyait plus.
 *
 * La règle est donc : **la case normale existe toujours**, pleine ou de dos,
 * et **la case rainbow n'apparaît que lorsqu'on la possède**. Une collection
 * complète de deux cent vingt cartes en affiche deux cent vingt ; qui les a
 * toutes en rainbow aussi en affiche quatre cent quarante. Ce que compte
 * l'avancement, en revanche, reste la carte — la rainbow est une couche de
 * chasse, pas un second set à finir.
 *
 * Les cartes PJ forment leur propre onglet. Elles ne sont pas d'une extension —
 * elles tombent dans toutes — et les compter dans le set de la Troupe faisait
 * un dénominateur faux et une complétion impossible à atteindre ailleurs. Leurs
 * exemplaires s'additionnent d'une extension à l'autre.
 */
export default function Bibliotheque({
  etat, boosterId, jeuComplet, cfgImage, fichiers, onLoupe, onOuvrir, onSet, onEtat, onAvis,
}) {
  const fichierRef = useRef(null);
  /** L'onglet PJ est local : il ne change pas l'extension courante de l'app. */
  const [ongletPJ, setOngletPJ] = useState(false);
  const [filtre, setFiltre] = useState("toutes");
  const [etatCarte, setEtatCarte] = useState("tout");
  const [recherche, setRecherche] = useState("");
  const [statsOuvertes, setStatsOuvertes] = useState(lireStats);
  const basculerStats = () => setStatsOuvertes((v) => { ecrireStats(!v); return !v; });

  const booster = BOOSTER_PAR_ID[boosterId];
  const cartesPJ = useMemo(() => jeuComplet.filter((c) => c.tier === "pj"), [jeuComplet]);
  const cartesSet = useMemo(() => jeuComplet.filter((c) => c.tier !== "pj"), [jeuComplet]);

  /**
   * Les exemplaires de PJ, toutes extensions confondues. Le stockage les range
   * sous l'extension où ils sont sortis ; c'est cohérent pour le Comptoir, qui
   * négocie par extension, et faux pour la bibliothèque, qui parle de la carte.
   */
  const collectionPJ = useMemo(() => {
    const m = {};
    for (const coll of Object.values(etat.collections || {})) {
      for (const [id, e] of Object.entries(coll)) {
        if (!id.startsWith("pj-")) continue;
        const a = m[id] || { normale: 0, rainbow: 0, carte: null };
        m[id] = {
          normale: a.normale + (e.normale || 0),
          rainbow: a.rainbow + (e.rainbow || 0),
          carte: e.carte || a.carte,
        };
      }
    }
    return m;
  }, [etat.collections]);

  const collection = ongletPJ ? collectionPJ : (etat.collections[boosterId] || {});
  const cartes = ongletPJ ? cartesPJ : cartesSet;

  /** Exemplaires détenus dans une version donnée. */
  const nb = (c, version) => (collection[c.id]?.[version] || 0);
  const rainbow = (c) => nb(c, "rainbow") > 0;
  const acquise = (c) => nb(c, "normale") > 0;

  /** Comptes par palier : cartes obtenues, rainbow détenues, total du set. */
  const stats = useMemo(() => {
    const s = {};
    TIER_ORDER.forEach((t) => { s[t] = { total: 0, obtenues: 0, rainbow: 0 }; });
    cartes.forEach((c) => {
      const e = s[c.tier];
      if (!e) return;
      e.total++;
      if (acquise(c)) e.obtenues++;
      if (rainbow(c)) e.rainbow++;
    });
    const somme = (k) => TIER_ORDER.reduce((n, t) => n + s[t][k], 0);
    return {
      paliers: s,
      total: somme("total"),
      obtenues: somme("obtenues"),
      rainbow: somme("rainbow"),
    };
  }, [cartes, collection]);

  /**
   * Les cases à afficher : la normale de chaque carte, et la rainbow quand
   * elle est là. Les deux cases d'une même carte restent voisines — le tri se
   * fait sur la possession de la *normale*, pour qu'une rainbow orpheline ne
   * se retrouve pas à l'autre bout de la grille que son dos gris.
   */
  const cases = useMemo(() => cartes.flatMap((c) => {
    const liste = [{ c, version: "normale", n: nb(c, "normale") }];
    const r = nb(c, "rainbow");
    if (r > 0) liste.push({ c, version: "rainbow", n: r });
    return liste;
  }), [cartes, collection]);

  const q = pli(recherche).trim();
  const visibles = useMemo(() => {
    const garde = ({ c, version, n }) => {
      if (filtre !== "toutes" && c.tier !== filtre) return false;
      if (etatCarte === "obtenues" && n === 0) return false;
      if (etatCarte === "rainbow" && version !== "rainbow") return false;
      if (etatCarte === "doubles" && n < 2) return false;
      if (q && !pli(nomComplet(c)).includes(q)) return false;
      return true;
    };
    return cases.filter(garde).sort(
      (x, y) =>
        TIER_ORDER.indexOf(y.c.tier) - TIER_ORDER.indexOf(x.c.tier) ||
        Number(acquise(y.c)) - Number(acquise(x.c)) ||
        x.c.nom.localeCompare(y.c.nom, "fr") ||
        (x.version === "rainbow" ? 1 : 0) - (y.version === "rainbow" ? 1 : 0)
    );
  }, [cases, filtre, etatCarte, q, collection]);

  const charger = async (f, mode) => {
    try {
      onEtat(await importer(f, etat, mode));
      onAvis("Import réussi.");
    } catch (err) {
      onAvis(`Import impossible : ${err.message}`);
    }
  };

  const paliersPresents = TIERS.filter((t) => stats.paliers[t.id]?.total > 0);
  const part = (n, t) => (t ? Math.round((100 * n) / t) : 0);
  const nDoubles = cases.filter((x) => x.n >= 2).length;
  const nPJ = cartesPJ.filter((c) => (collectionPJ[c.id]?.normale || 0) > 0).length;

  const etats = [
    ["tout", "Toutes", cases.length],
    ["obtenues", "Obtenues", cases.filter((x) => x.n > 0).length],
    ["doubles", "En double", nDoubles],
    ["rainbow", "Rainbow", stats.rainbow],
  ];

  return (
    <main className="view" id="contenu">
      <div className="section-titre">
        <h1>Bibliothèque</h1>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="btn quiet sm" onClick={() => exporter(etat)}>Exporter</button>
          <button className="btn quiet sm" onClick={() => fichierRef.current?.click()}>Importer</button>
          <input
            ref={fichierRef} type="file" accept="application/json" className="cache"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const mode = window.confirm(
                "Fusionner avec la bibliothèque actuelle ?\n\nOK = fusion\nAnnuler = remplacement complet"
              ) ? "fusion" : "remplacement";
              charger(f, mode);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* --- Choix du set, et l'onglet des PJ --- */}
      <div className="sets">
        {BOOSTERS.map((b) => {
          const ouvert = b.statut === "ouvert";
          const coll = etat.collections[b.id] || {};
          // Des cartes distinctes, comme partout ailleurs : une rainbow n'est
          // pas une carte de plus, et les PJ ont leur propre onglet.
          const acquises = Object.entries(coll).reduce(
            (n, [id, e]) => n + (!id.startsWith("pj-") && e.normale ? 1 : 0), 0
          );
          const actif = !ongletPJ && b.id === boosterId;
          return (
            <button
              key={b.id}
              className={`set${actif ? " on" : ""}${ouvert ? "" : " verrou"}`}
              aria-pressed={ouvert ? actif : undefined}
              onClick={ouvert ? () => { setOngletPJ(false); onSet(b.id); } : undefined}
              disabled={!ouvert}
            >
              <span className="set-nom">{b.titre}</span>
              <span className="set-sous">
                {ouvert ? `${acquises} carte${acquises > 1 ? "s" : ""}` : "Bientôt"}
              </span>
            </button>
          );
        })}
        {/* Les PJ ne sont d'aucune extension : ils tombent dans toutes. */}
        <button
          className={`set set-pj${ongletPJ ? " on" : ""}`}
          aria-pressed={ongletPJ}
          onClick={() => setOngletPJ(true)}
        >
          <span className="set-nom">Cartes PJ</span>
          <span className="set-sous">{nPJ} sur {cartesPJ.length} · toutes extensions</span>
        </button>
        {/* L'avancement se consulte, il ne sert pas à chaque visite : replié
            par défaut, pour que la grille arrive tout de suite. */}
        <button
          className={`set stats-bascule${statsOuvertes ? " on" : ""}`}
          aria-expanded={statsOuvertes}
          aria-controls="stats-collection"
          onClick={basculerStats}
        >
          <span className="set-nom">Statistiques de ma collection</span>
          <span className="set-sous">
            {statsOuvertes ? "Masquer" : "Afficher"}
          </span>
          <span className="stats-chevron" aria-hidden="true" />
        </button>
      </div>

      {/* --- Avancement : un chiffre, et le détail par palier --- */}
      <div
        id="stats-collection"
        className={`stats-repli${statsOuvertes ? " ouvert" : ""}`}
        {...(statsOuvertes ? {} : { inert: "" })}
      >
      <div className="avancement">
        <div className="avc-tete">
          <p className="avc-chiffre"
             aria-label={`${stats.obtenues} cartes sur ${stats.total}, ${ongletPJ ? "cartes PJ" : booster ? booster.titre : boosterId}`}>
            <b>{stats.obtenues}</b><span>/ {stats.total}</span>
          </p>
        </div>
        {/* Un seul palier — l'onglet PJ — et la liste répète le chiffre de
            gauche : on la tait. */}
        <ul className="avc-paliers" hidden={paliersPresents.length < 2}>
          {paliersPresents.map((t) => {
            const p = stats.paliers[t.id];
            return (
              <li key={t.id} className={`avc-${t.id}`}>
                <span className="avc-nom">{t.nom}</span>
                <span className="avc-jauge" aria-hidden="true">
                  <i style={{ width: `${part(p.obtenues, p.total)}%` }} />
                </span>
                <span className="avc-compte">
                  {p.obtenues}<span className="avc-sur">/{p.total}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      </div>

      {/* --- Filtres : l'état d'abord, la rareté ensuite --- */}
      <div className="barre-filtres">
        <div className="segments" role="group" aria-label="Cartes affichées">
          {etats.map(([id, libelle, n]) => (
            <button
              key={id}
              className={etatCarte === id ? "on" : ""}
              aria-pressed={etatCarte === id}
              onClick={() => setEtatCarte(id)}
            >
              {libelle} <b>{n}</b>
            </button>
          ))}
        </div>

        <input
          type="search"
          className="biblio-recherche"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un nom…"
          aria-label="Chercher une carte par son nom"
        />
      </div>

      <div className="filtres" role="group" aria-label="Filtre de rareté"
           hidden={paliersPresents.length < 2}>
        <button className={filtre === "toutes" ? "on" : ""} aria-pressed={filtre === "toutes"}
          onClick={() => setFiltre("toutes")}>
          Toutes raretés
        </button>
        {paliersPresents.map((t) => (
          <button
            key={t.id}
            className={`f-${t.id}${filtre === t.id ? " on" : ""}`}
            aria-pressed={filtre === t.id}
            onClick={() => setFiltre(t.id)}
          >
            {t.nom} <b>{stats.paliers[t.id].obtenues}/{stats.paliers[t.id].total}</b>
          </button>
        ))}
      </div>

      {paliersPresents.length < 2 && <div className="filtres-filet" aria-hidden="true" />}

      <p className="muted resume-filtre" role="status" aria-live="polite">
        {visibles.length} case{visibles.length > 1 ? "s" : ""} affichée{visibles.length > 1 ? "s" : ""}
        {stats.rainbow > 0 && etatCarte === "tout" && filtre === "toutes" && !q
          && ` · ${stats.total} cartes du set et ${stats.rainbow} rainbow`}
        {q && ` · « ${recherche.trim()} »`}
      </p>

      <div className="grille">
        {visibles.map(({ c, version, n }) => {
          const cle = `${c.id}:${version}`;
          if (n === 0) return <Manquante key={cle} />;
          const carte = { ...c, rainbow: version === "rainbow" };
          return (
            <div className="case-carte" key={cle}>
              <Carte
                c={carte} taille="petit" cfgImage={cfgImage} fichiers={fichiers}
                onToucher={() => onLoupe(carte)}
                etiquette={`Agrandir ${c.nom}, ${TIER_INFO[c.tier].nom}${carte.rainbow ? ", rainbow" : ""}, ${n} exemplaire${n > 1 ? "s" : ""}`}
              />
              {/* Le nombre d'exemplaires de *cette* version : une case pleine
                  ne dit pas à elle seule s'il y a de quoi négocier au
                  Comptoir, et une rainbow ne se négocie pas comme une
                  normale. */}
              <span
                className={`pastille-nb${n > 1 ? " multiple" : ""}`}
                title={`${n} exemplaire${n > 1 ? "s" : ""} ${version === "rainbow" ? "rainbow" : "normale"}`}
              >
                ×{n}
              </span>
              {TIER_INFO[c.tier]?.pleine && (
                <span className="legende-carte">{nomComplet(c)}</span>
              )}
            </div>
          );
        })}
      </div>

      {visibles.length === 0 && (
        <div className="vide">
          <p>
            {stats.obtenues === 0
              ? "Aucune carte obtenue pour l'instant."
              : "Aucune carte ne correspond à ce filtre."}
          </p>
          {stats.obtenues === 0
            ? <button className="btn" onClick={onOuvrir}>Ouvrir un booster</button>
            : <button className="btn quiet" onClick={() => { setFiltre("toutes"); setEtatCarte("tout"); setRecherche(""); }}>
                Tout afficher
              </button>}
        </div>
      )}
    </main>
  );
}
