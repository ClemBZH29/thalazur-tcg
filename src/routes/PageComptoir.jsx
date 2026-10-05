import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TIER_INFO } from "../config/tiers.js";
import { useJeu } from "../jeu/Jeu.jsx";
import { useMarche } from "../comptoir/useMarche.js";
import { acheteurDeDemain, annonceDe, conservateurPresent } from "../comptoir/acheteurs.js";
import { replique, FIN_DE_JOURNEE } from "../comptoir/voix.js";
import { encre } from "../comptoir/teintes.js";
import { volerVersBourse } from "../comptoir/pieces.js";
import Carte from "../components/Carte.jsx";
import Negoce, { Jauge } from "../comptoir/Negoce.jsx";
import "../styles/comptoir.css";

/* ------------------------------------------------------------------
   LE COMPTOIR — la page.

   Refonte d'octobre 2026 (docs/audit-comptoir.md, maquette Claude Design
   « Comptoir de Thalazur » v2). Trois parties : le bandeau du jour, la scène
   où les acheteurs se tiennent derrière le comptoir, puis le rayon et
   l'échoppe. Le tableau du surplus a disparu : chaque acheteur montre
   lui-même, dans le négoce, les cartes qui l'intéressent.
   ------------------------------------------------------------------ */

const fmt = (n) => Math.round(n).toLocaleString("fr-FR");
const PO = (n) => `${fmt(n)} PO`;

/** Ce que l'échoppe prend sans qu'on le lui demande. */
const BAS = new Set(["commun", "peucommun"]);

/** Le palier de téléphone de la charte. */
function useTelephone() {
  const q = "(max-width: 720px)";
  const [tel, setTel] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setTel(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return tel;
}

/** Un portrait détouré, posé sur l'interface. Son initiale si l'image manque. */
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

/** La date au format de la charte : « lundi 05/10/2026 ». */
const dateDuJour = (tel) => {
  const d = new Date();
  const jour = d.toLocaleDateString("fr-FR", { weekday: tel ? "short" : "long" });
  const jj = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return tel ? `${jour} ${jj}/${mm}` : `${jour} ${jj}/${mm}/${d.getFullYear()}`;
};

export default function PageComptoir() {
  const jeu = useJeu();
  const { M, jour, acheteurs, articles, rafraichir } = useMarche();
  const { bourse, surplus: surplusJeu, vendreExemplaires, acheterExemplaire, cfgImage, fichiers } = jeu;
  const tel = useTelephone();

  const [neg, setNeg] = useState(null);          // id de l'acheteur dont le négoce est ouvert
  const [onglet, setOnglet] = useState(null);    // acheteur affiché au téléphone
  const [merci, setMerci] = useState({});        // acheteurId -> vrai après une vente
  const [aide, setAide] = useState(false);
  const retour = useRef(null);

  const surplus = useCallback((a) => surplusJeu(a.carteId, a.version), [surplusJeu]);
  const manque = useCallback((a) => jeu.exemplaires(a.carteId, a.version) === 0, [jeu]);

  /* ── Les acheteurs, et ce qui les intéresse ──────────────────────────── */

  // Recalculé à chaque rendu : `M` est mutable, et le rendu suit déjà le
  // jour, les ventes et la collection. Quatre acheteurs sur quatre cent
  // cinquante articles, c'est peu.
  const postes = acheteurs.map((b) => {
    const interesse = articles
      .filter((a) => surplus(a) > 0 && M.affinite(a, b) > 0)
      .sort((x, y) => M.offreUnitaire(y, b) - M.offreUnitaire(x, b));
    const restant = M.restant(b);
    const etat = !interesse.length ? "inerte" : restant === 0 ? "fini" : "actif";
    const voix = merci[b.id] ? replique(b, "merci")
      : etat === "fini" ? FIN_DE_JOURNEE
        : etat === "inerte" ? replique(b, "refus")
          : b.quote;
    return { b, interesse, restant, etat, voix };
  });

  const ouvrir = (b, el) => { retour.current = el || null; setNeg(b.id); };
  const fermer = () => {
    setNeg(null);
    setTimeout(() => retour.current?.focus?.(), 0);
  };

  /** La vente, à l'unité, bornée par le surplus et par le quota du jour. */
  const vendre = (a, b, qte, facteur, depuis) => {
    const q = Math.min(qte, surplus(a), M.restant(b));
    let gain = 0;
    let vendus = 0;
    for (let k = 0; k < q; k++) {
      const paye = M.payer(a, M.prixAcheteur(a, b, M.stock[a.id], facteur));
      if (paye === null) break;
      gain += paye;
      vendus++;
    }
    if (!vendus) return null;
    M.compterAchat(b, vendus);
    vendreExemplaires(a.carteId, a.version, vendus, gain);
    M.noter(`${vendus} × ${a.carte.nom}${a.rainbow ? " (rainbow)" : ""} vendu${vendus > 1 ? "s" : ""} à ${b.nom}`, gain);
    volerVersBourse(depuis);
    setMerci((m) => ({ ...m, [b.id]: true }));
    rafraichir();
    return { vendus, gain };
  };

  const posteNeg = postes.find((p) => p.b.id === neg) || null;
  const demain = acheteurDeDemain(jour);
  const garde = M.gardeFous(acheteurs);
  const posteTel = postes.find((p) => p.b.id === onglet) || postes[0];

  return (
    <main className="view large comptoir" id="contenu">
      {/* ── Bandeau du jour ─────────────────────────────────────────── */}
      <section className="cmp-bandeau" aria-label="Le jour au Comptoir">
        <div className="cmp-titre">
          <h1>Le Comptoir</h1>
          <span className="cmp-date">{dateDuJour(tel)}</span>
          <button type="button" className="aide-bouton" aria-expanded={aide}
                  aria-label="Comment marche le Comptoir" onClick={() => setAide((v) => !v)}>?</button>
          {aide && (
            <div className="comptoir-bulle" role="status">
              <button type="button" className="bulle-fermer" aria-label="Fermer"
                      onClick={() => setAide(false)}>×</button>
              <p className="bulle-titre">Comment ça marche</p>
              <ul className="bulle-liste">
                <li><b>Lise passe tous les jours</b>, avec deux spécialistes qui changent à minuit. Chacun n'achète que ce qui l'intéresse.</li>
                <li><b>On vend à l'unité.</b> Chaque acheteur rachète un nombre limité d'exemplaires par jour, puis il a fini sa journée.</li>
                <li><b>Marchander demande de lire le personnage</b> : chacun préfère une manière de présenter la carte, et sa réplique le laisse deviner. Un essai par carte et par jour.</li>
                <li><b>L'échoppe rachète tout</b>, tout de suite, à petit prix. Son rayon vend cinq cartes et une pièce du jour.</li>
              </ul>
              <p className="bulle-hors-jeu">
                Hors jeu : un booster entièrement revendu rapporte{" "}
                <b className={garde.liq < 1 ? "ok" : "ko"}>{(garde.liq * 100).toFixed(0)} %</b> de
                son prix à l'échoppe, <b className={garde.liqMax < 1 ? "ok" : "ko"}>{(garde.liqMax * 100).toFixed(0)} %</b>{" "}
                au meilleur acheteur. Au-dessus de 100 %, l'économie se casse.
              </p>
            </div>
          )}
        </div>
        <span className="cmp-espace" />
        <p className="cmp-caisse"><b>{fmt(M.fonds)} PO</b> en caisse</p>
        <div className="cmp-demain">
          <span className="cmp-demain-vignette" aria-hidden="true">
            <Portrait acheteur={demain} classe="cmp-demain-img" />
          </span>
          <span className="cmp-demain-texte">
            <span className="muted">Demain{conservateurPresent(jour + 1) ? ", avec le Conservateur Royal" : ""}</span>
            <span>{demain.province ? annonceDe(demain) : <><b>{demain.nom}</b> revient</>}</span>
          </span>
        </div>
      </section>

      {/* ── La scène ────────────────────────────────────────────────── */}
      {tel ? (
        <section className="cmp-scene-tel" aria-label="Les acheteurs du jour">
          <div className="cmp-onglets" role="tablist" aria-label="Acheteurs">
            {postes.map((p) => (
              <button key={p.b.id} type="button" role="tab"
                      aria-selected={p === posteTel}
                      className={`cmp-onglet ${p.etat}${p.b.exceptionnel ? " honneur" : ""}`}
                      onClick={() => setOnglet(p.b.id)}>
                <span className="cmp-onglet-scene">
                  <span className="cmp-lueur" aria-hidden="true" />
                  <Portrait acheteur={p.b} classe="cmp-portrait" />
                </span>
                <span className="cmp-onglet-nom">{p.b.nom.split(" ").pop()}</span>
              </button>
            ))}
          </div>
          <div role="tabpanel" className="cmp-panneau-tel">
            <p className="cmp-bulle haut">{posteTel.voix}</p>
            <Plaque poste={posteTel} onProposer={ouvrir} />
          </div>
        </section>
      ) : (
        <section className="cmp-scene" aria-label="Les acheteurs du jour">
          <div className="cmp-planche" aria-hidden="true" />
          <div className="cmp-postes">
            {postes.map((p) => (
              <article key={p.b.id} className={`cmp-poste ${p.etat}${p.b.exceptionnel ? " honneur" : ""}${merci[p.b.id] ? " content" : ""}`}
                       aria-label={p.b.nom}>
                <p className="cmp-bulle">{p.voix}</p>
                <div className="cmp-figure" onClick={(e) => p.etat === "actif" && ouvrir(p.b, e.currentTarget)}>
                  <span className="cmp-lueur" aria-hidden="true" />
                  <Portrait acheteur={p.b} classe="cmp-portrait" />
                  {p.b.exceptionnel && <span className="cmp-sceau">Exceptionnel</span>}
                </div>
                <Plaque poste={p} onProposer={ouvrir} />
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="cmp-bas">
        <Rayon M={M} manque={manque} bourse={bourse} cfgImage={cfgImage} fichiers={fichiers}
               onAcheter={(a, el) => {
                 const prix = M.cotation(a).ask;
                 if (bourse.po < prix) return;
                 const paye = M.vendreAuJoueur(a);
                 if (paye === null) return;
                 acheterExemplaire(a.carte, a.version, paye);
                 M.noter(`${a.carte.nom}${a.rainbow ? " (rainbow)" : ""} acheté à l'échoppe`, 0);
                 el?.focus?.();
                 rafraichir();
               }} />
        <Echoppe M={M} articles={articles} surplus={surplus}
                 onVendre={(lignes, depuis) => {
                   let gain = 0;
                   let n = 0;
                   for (const a of lignes) {
                     for (let k = surplus(a); k > 0; k--) {
                       const paye = M.payer(a, M.cotation(a).bid);
                       if (paye === null) break;
                       gain += paye;
                       n++;
                       vendreExemplaires(a.carteId, a.version, 1, paye);
                     }
                   }
                   if (n) {
                     M.noter(`${n} exemplaire${n > 1 ? "s" : ""} vendu${n > 1 ? "s" : ""} à l'échoppe`, gain);
                     volerVersBourse(depuis);
                   }
                   rafraichir();
                   return { n, gain };
                 }} />
      </div>

      {posteNeg && (
        <Negoce
          M={M}
          acheteur={posteNeg.b}
          articles={posteNeg.interesse}
          surplus={surplus}
          cfgImage={cfgImage}
          fichiers={fichiers}
          onVendre={vendre}
          onMarchander={() => rafraichir()}
          onFermer={fermer}
        />
      )}
    </main>
  );
}

/** Nom, ce qu'il achète, l'intérêt, le quota, et le bouton. */
function Plaque({ poste, onProposer }) {
  const { b, interesse, restant, etat } = poste;
  return (
    <div className="cmp-plaque">
      <div className="cmp-nom">
        <h3>{b.nom}</h3>
        <span className="cmp-metier" title={b.sub}>{b.sub}</span>
      </div>
      <p className="cmp-critere">{b.spec}</p>
      <p className="cmp-interet">
        {interesse.length
          ? `${interesse.length} de vos cartes l'intéresse${interesse.length > 1 ? "nt" : ""}`
          : "Aucune de vos cartes ne l'intéresse."}
      </p>
      <Jauge restant={restant} quota={b.quota} />
      <button
        type="button"
        className="cmp-proposer"
        disabled={etat !== "actif"}
        onClick={(e) => onProposer(b, e.currentTarget)}
      >
        {etat === "inerte" ? "Rien à lui proposer" : etat === "fini" ? "Revenez demain" : "Lui proposer"}
      </button>
    </div>
  );
}

/** Le rayon : la pièce du jour, puis cinq cartes, les manquantes devant. */
function Rayon({ M, manque, bourse, cfgImage, fichiers, onAcheter }) {
  const { piece, rayon } = M.vitrineDuJour(manque);
  const autres = [...rayon].sort((x, y) => Number(manque(y)) - Number(manque(x)));
  const pieceInfo = piece && infoAchat(M, piece, bourse);
  return (
    <section className="cmp-rayon" aria-labelledby="t-rayon">
      <div className="cmp-section-tete">
        <h2 id="t-rayon">Le rayon du jour</h2>
        <span className="muted">Ce que l'échoppe vend aujourd'hui. Les cartes qui vous manquent passent devant.</span>
      </div>
      {piece && (
        <div className="cmp-piece">
          <div className="cmp-vignette">
            <Carte c={{ ...piece.carte, rainbow: piece.rainbow }} taille="petit" cfgImage={cfgImage} fichiers={fichiers} />
            {manque(piece) && <span className="cmp-manquante">Manquante</span>}
          </div>
          <div className="cmp-piece-texte">
            <span className="cmp-piece-sur">Pièce du jour</span>
            <span className="cmp-piece-nom">{piece.carte.nom}</span>
            <span style={{ color: piece.rainbow ? "var(--m-rainbow)" : encre(piece.tier) }}>
              {TIER_INFO[piece.tier]?.nom}{piece.rainbow ? " · Rainbow" : ""}
            </span>
            <span className="cmp-piece-prix">{PO(pieceInfo.prix)}</span>
            <span className="muted">
              {piece.rainbow
                ? `Une rainbow sort une fois sur trente-trois : l'échoppe la rachète déjà ${PO(M.cotation(piece).bid)}.`
                : `L'échoppe la rachète ${PO(M.cotation(piece).bid)}.`}
            </span>
            <BoutonAchat info={pieceInfo} onAcheter={(el) => onAcheter(piece, el)} grand />
          </div>
        </div>
      )}
      <div className="cmp-rayon-grille">
        {autres.map((a) => {
          const info = infoAchat(M, a, bourse);
          return (
            <div key={a.id} className="cmp-rayon-case">
              <div className="cmp-vignette">
                <Carte c={{ ...a.carte, rainbow: a.rainbow }} taille="petit" cfgImage={cfgImage} fichiers={fichiers} />
                {manque(a) && <span className="cmp-manquante">Manquante</span>}
              </div>
              <span className="cmp-prix">{PO(info.prix)}</span>
              <BoutonAchat info={info} onAcheter={(el) => onAcheter(a, el)} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

const infoAchat = (M, a, bourse) => {
  const prix = M.cotation(a).ask;
  return { prix, achete: M.dejaAchete(a), manque: Math.max(0, prix - Math.floor(bourse.po)), nom: a.carte.nom };
};

function BoutonAchat({ info, onAcheter, grand = false }) {
  const { prix, achete, manque, nom } = info;
  return (
    <div className={`cmp-achat${grand ? " grand" : ""}`}>
      <button
        type="button"
        className="cmp-acheter"
        disabled={achete || manque > 0}
        onClick={(e) => onAcheter(e.currentTarget)}
        aria-label={achete ? `${nom} : acheté aujourd'hui` : `Acheter ${nom} pour ${PO(prix)}`}
      >
        {achete ? "Acheté" : "Acheter"}
      </button>
      <span className="cmp-manque">{!achete && manque > 0 ? `il vous manque ${PO(manque)}` : ""}</span>
    </div>
  );
}

/**
 * L'échoppe : la sortie pour tout ce que les acheteurs n'ont pas pris.
 * Trois puces disent ce que la vente inclut ; le premier appui arme la
 * vente, le second la fait. Les rainbow et le haut de gamme commencent
 * éteints : une rainbow en trop améliore vos cartes pour le Donjon, et une
 * rare se vend bien mieux à son acheteur.
 */
function Echoppe({ M, articles, surplus, onVendre }) {
  const [choix, setChoix] = useState({ bas: true, haut: false, rainbow: false });
  const [arme, setArme] = useState(false);
  const [note, setNote] = useState("");
  const bouton = useRef(null);

  const familles = useMemo(() => {
    const f = { bas: [], haut: [], rainbow: [] };
    for (const a of articles) {
      if (surplus(a) < 1) continue;
      f[a.rainbow ? "rainbow" : BAS.has(a.tier) ? "bas" : "haut"].push(a);
    }
    return f;
  }, [articles, surplus]);

  const compte = (l) => l.reduce((s, a) => s + surplus(a), 0);
  const valeur = (l) => l.reduce((s, a) => s + M.rachatLot(a, surplus(a)), 0);
  const retenus = Object.entries(familles).filter(([k]) => choix[k]).flatMap(([, l]) => l);
  const n = compte(retenus);
  const total = valeur(retenus);

  useEffect(() => { setArme(false); }, [choix, n]);

  const PUCES = [
    ["bas", "Communes et peu communes"],
    ["haut", "Rares et au-delà"],
    ["rainbow", "Rainbow"],
  ];

  const agir = () => {
    if (!n) return;
    if (!arme) { setArme(true); return; }
    const r = onVendre(retenus, bouton.current);
    setArme(false);
    setNote(r.n ? `+${PO(r.gain)} pour ${fmt(r.n)} carte${r.n > 1 ? "s" : ""}.` : "La caisse du Comptoir est vide pour aujourd'hui.");
  };

  return (
    <section className="cmp-echoppe" aria-labelledby="t-echoppe">
      <div>
        <h2 id="t-echoppe">L'échoppe</h2>
        <p className="cmp-echoppe-texte">
          L'échoppe rachète tout, tout de suite, à petit prix. C'est la sortie pour ce que les acheteurs n'ont pas pris.
        </p>
      </div>
      <div className="cmp-puces colonne" role="group" aria-label="Ce que la vente inclut">
        {PUCES.map(([k, nom]) => {
          const nb = compte(familles[k]);
          return (
            <div key={k} className="cmp-puce-ligne">
              <button type="button" className="puce" aria-pressed={choix[k]} disabled={!nb}
                      onClick={() => setChoix((c) => ({ ...c, [k]: !c[k] }))}>
                {nom}<span className="puce-n">· {fmt(nb)}</span>
              </button>
              {k === "rainbow" && <span className="cmp-mention-rainbow">Améliore vos cartes pour le Donjon</span>}
            </div>
          );
        })}
      </div>
      <div className="cmp-echoppe-pied">
        <button ref={bouton} type="button" className={`cmp-tout-vendre${arme ? " arme" : ""}`}
                disabled={!n} onClick={agir}>
          {!n ? "Rien à vendre" : arme ? `Confirmer : ${PO(total)}` : `Tout vendre à l'échoppe, ${PO(total)}`}
        </button>
        <div className="cmp-echoppe-note" aria-live="polite">
          <span>{arme ? `${fmt(n)} cartes quittent votre collection.` : note || `${fmt(n)} carte${n > 1 ? "s" : ""}, payée${n > 1 ? "s" : ""} tout de suite.`}</span>
          {arme && <button type="button" className="lien" onClick={() => setArme(false)}>Annuler</button>}
        </div>
      </div>
    </section>
  );
}
