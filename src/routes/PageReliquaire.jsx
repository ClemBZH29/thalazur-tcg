import { useEffect, useMemo, useRef, useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import Carte from "../components/Carte.jsx";
import { Lien } from "../lib/routeur.jsx";
import Icone from "../components/Icone.jsx";
import { RELIQUAIRE } from "../config/reliquaire.js";
import { SLOTS, TAUX_DEFAUT, TIER_INFO } from "../config/tiers.js";
import { PALIERS, completion, eligible, frequences, jourDe, offreDuJour, offrePrise, offreRevelee, peutForgerOffre } from "../reliquaire/regles.js";
import "../styles/expeditions.css";

const IMG = `${import.meta.env.BASE_URL}reliquaire/`;

/**
 * L'effet joué par-dessus la page : une planche de neuf images, lue en
 * `steps`, au noir rendu transparent. Coupé en mouvement réduit.
 */
function Effet({ genre, onFin }) {
  const fin = useRef(onFin);
  fin.current = onFin;
  useEffect(() => { const t = setTimeout(() => fin.current(), 1300); return () => clearTimeout(t); }, []);
  return <div className={`rel-effet rel-effet-${genre}`} style={{ backgroundImage: `url(${IMG}${genre}.webp)` }} aria-hidden="true" />;
}

/** Temps restant jusqu'à minuit, heure locale : la carte change alors. */
function avantMinuit(t) {
  const m = new Date(t); m.setHours(24, 0, 0, 0);
  const min = Math.max(0, Math.ceil((m - t) / 60000));
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

/** Ce que porte la carte tant qu'elle est face cachée. */
const CACHEE = { id: "cachee", nom: "?", tier: "commun" };

const fmt = (n) => n.toLocaleString("fr-FR");

/** Les chances de la carte du jour, lues dans la table du booster : [palier, « 60 % »]. */
function chances() {
  const f = frequences(SLOTS);
  const total = PALIERS.reduce((s, t) => s + f[t], 0);
  const pct = (v) => `${String(v >= 10 ? Math.round(v) : Math.round(v * 10) / 10).replace(".", ",")} %`;
  return [
    ...PALIERS.map((t) => [TIER_INFO[t].nom, pct((f[t] / total) * 100), t]),
    ["✦ Rainbow", pct(TAUX_DEFAUT.rainbow * 100), "rainbow"],
  ];
}

/** Un montant en vestiges : l'icône et le chiffre, sans le mot. */
function Vestiges({ n, className = "" }) {
  return (
    <span className={`rel-v ${className}`}>
      <img src={`${IMG}vestige.webp`} alt="" />{fmt(n)}<span className="sr"> vestiges</span>
    </span>
  );
}

/** Les règles, lues une fois : ouvertes d'office tant qu'on n'a rien forgé. */
function Regles({ ouvert }) {
  return (
    <details className="dj-regles rel-regles" open={ouvert}>
      <summary>Comment ça marche</summary>
      <ul>
        <li><b>Une carte par jour</b>, la même pour tous, tirée comme dans un booster. Elle change à minuit.</li>
        <li><b>À l'aveugle</b> : forgée sans la voir, au prix moyen. Perdant sur une commune, gagnant sur une rare ou mieux.</li>
        <li><b>Retourner</b> : gratuit, montre la carte et son prix. Le prix à l'aveugle est alors perdu pour la journée.</li>
        <li><b>Prix</b> : commune {fmt(RELIQUAIRE.forge.commun)}, peu commune {fmt(RELIQUAIRE.forge.peucommun)},
          rare {fmt(RELIQUAIRE.forge.rare)}, légendaire {fmt(RELIQUAIRE.forge.legendaire)} ; rainbow ×{RELIQUAIRE.multRainbow}.</li>
        <li><b>Vestiges</b> : on les tire de ses doublons, dans la{" "}
          <Lien vers="/bibliotheque" actif={false} className="lien">bibliothèque</Lien> (volet Reliquaire d'une carte en double).
          Cartes de personnage et full art n'y entrent pas.</li>
      </ul>
    </details>
  );
}

/**
 * Le Reliquaire, réduit à son étal : une carte par jour, la même pour tous,
 * forgée avec des vestiges.
 *
 * Il tenait deux listes de deux cents lignes — dissoudre, forger — avec
 * recherche et filtres. La dissolution est passée dans la bibliothèque, sur la
 * carte agrandie, là où l'on regarde déjà ses doublons ; la forge n'offre plus
 * qu'une carte, tirée comme dans un booster, et plus chère qu'avant. Choisir
 * sa carte manquante parmi toutes rendait le Reliquaire meilleur que les
 * boosters dès l'ouverture ; une carte du jour en fait un rendez-vous.
 *
 * Depuis le 06/10/2026, elle se présente face cachée. Deux gestes : la
 * forger à l'aveugle, au prix moyen, ou la retourner, ce qui montre la carte
 * et son vrai prix mais renonce au prix moyen pour la journée (voir
 * `RELIQUAIRE.aveugle`). Rien de la carte n'est annoncé tant qu'elle est
 * cachée : ni nom, ni palier, ni exemplaires détenus, ni loupe.
 */
export default function PageReliquaire() {
  const { etat, boosterId, booster, jeuComplet, vestiges, forgerOffre, revelerOffre, mouvementReduit, reliquaireOuvert,
    cfgImage, fichiers, setLoupe } = useJeu();
  // Le bouton qui attend sa confirmation : "aveugle", "retourner" ou "forger".
  const [confirme, setConfirme] = useState(null);
  // Après une forge à l'aveugle : ce qu'on a payé, pour le verdict.
  const [bilan, setBilan] = useState(null);
  // Durée du retournement en cours (0 : la carte se montre sans tourner).
  const [flip, setFlip] = useState(0);
  const minuteur = useRef(null);
  useEffect(() => () => clearTimeout(minuteur.current), []);
  const [effet, setEffet] = useState(null);
  const [annonce, setAnnonce] = useState("");
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setMaintenant(Date.now()), 30000); return () => clearInterval(iv); }, []);

  const jour = jourDe(maintenant);
  const cartes = useMemo(() => jeuComplet.filter(eligible), [jeuComplet]);
  const offre = useMemo(
    () => offreDuJour(boosterId, cartes, jour, { slots: SLOTS, tauxRainbow: TAUX_DEFAUT.rainbow }),
    [boosterId, cartes, jour]);
  const pct = completion(etat, boosterId, cartes);

  if (!reliquaireOuvert) {
    return (
      <main className="view large exp-page rel-page" id="contenu">
        <header className="exp-bandeau rel-bandeau" style={{ backgroundImage: `url(${IMG}bandeau.webp)` }}>
          <div className="exp-bandeau-texte">
            <h1>Reliquaire scellé</h1>
            <p className="rel-scelle">
              <span className="pastille">{booster?.titre || "Collection"} <b>{Math.round(pct * 100)} %</b></span>
              <span className="muted">s'ouvre à {Math.round(RELIQUAIRE.ouverture * 100)} %</span>
            </p>
          </div>
        </header>
      </main>
    );
  }

  const prise = offrePrise(etat, offre);
  const revelee = offreRevelee(etat, offre);
  const possible = peutForgerOffre(etat, offre);
  const possibleAveugle = peutForgerOffre(etat, offre, { aveugle: true });
  const ex = offre ? etat.collections?.[boosterId]?.[offre.c.id] : null;
  const detenus = offre ? (offre.rainbow ? ex?.rainbow : ex?.normale) || 0 : 0;
  const carte = offre ? { ...offre.c, rainbow: offre.rainbow } : null;
  const grande = offre && (offre.c.tier === "legendaire" || offre.rainbow);

  /** Premier toucher : le bouton demande confirmation ; second : il agit. */
  const armer = (quoi, agir) => () => {
    if (confirme !== quoi) { setConfirme(quoi); return; }
    setConfirme(null);
    agir();
  };

  // Le retournement prend le tempo de la rareté, comme à l'ouverture d'un
  // booster : une légendaire tourne lentement. L'effet de forge suit.
  const retourner = (puis) => {
    const d = mouvementReduit ? 0 : TIER_INFO[offre.c.tier]?.flip || 500;
    setFlip(d);
    clearTimeout(minuteur.current);
    if (puis) minuteur.current = setTimeout(puis, d);
  };

  const forgerAveugle = armer("aveugle", () => {
    if (!forgerOffre(offre, { aveugle: true })) return;
    setBilan({ paye: offre.prixAveugle, vaut: offre.prix });
    retourner(() => { if (!mouvementReduit) setEffet(grande ? "forge-legendaire" : "forge"); });
    setAnnonce(`Forgée à l'aveugle : ${offre.c.nom}, ${TIER_INFO[offre.c.tier]?.nom}${offre.rainbow ? " rainbow" : ""}. `
      + `Payée ${fmt(offre.prixAveugle)} vestiges, elle en vaut ${fmt(offre.prix)}.`);
  });

  const revelerCarte = armer("retourner", () => {
    revelerOffre(offre);
    retourner();
    setAnnonce(`La carte du jour est ${offre.c.nom}, ${TIER_INFO[offre.c.tier]?.nom}${offre.rainbow ? " rainbow" : ""}, `
      + `à ${fmt(offre.prix)} vestiges.`);
  });

  const forger = armer("forger", () => {
    if (forgerOffre(offre)) {
      if (!mouvementReduit) setEffet(grande ? "forge-legendaire" : "forge");
      setAnnonce(`${offre.c.nom} forgée et rangée dans la bibliothèque.`);
    }
  });

  const ecart = bilan ? bilan.vaut - bilan.paye : 0;
  const prochaine = <span className="rel-prochaine">Nouvelle carte : {avantMinuit(maintenant)}</span>;

  return (
    <main className="view large exp-page rel-page" id="contenu">
      <header className="exp-bandeau rel-bandeau" style={{ backgroundImage: `url(${IMG}bandeau.webp)` }}>
        <div className="exp-bandeau-texte"><h1>Reliquaire</h1></div>
      </header>

      <p className="sr" role="status" aria-live="polite">{annonce}</p>

      {offre && (
        <section className="rel-jour" aria-labelledby="rel-jour-titre">
          <img className="rel-gardien" src={`${IMG}gardien.webp`} alt="" draggable="false" />

          <div className="rel-jour-carte">
            {/* Une seule carte, qui reste montée : retournée, elle tourne sur
                place. Face cachée, elle porte une carte vide : rien de la carte
                du jour ne passe dans la page tant qu'elle n'est pas retournée. */}
            <Carte c={revelee ? carte : CACHEE} taille="plein" retourne={revelee} dureeFlip={flip}
              cfgImage={cfgImage} fichiers={fichiers}
              onToucher={revelee ? () => setLoupe(carte) : undefined}
              etiquette={revelee ? `Agrandir ${offre.c.nom}` : undefined} />
          </div>

          <div className="rel-jour-fiche">
            <h2 id="rel-jour-titre" className="rel-jour-nom">
              {revelee ? offre.c.nom : "Carte du jour"}
              {revelee && (
                <span>
                  {TIER_INFO[offre.c.tier]?.nom}{offre.rainbow && " · ✦ Rainbow"}
                  {" · "}{detenus > 0 ? `×${detenus}` : <b className="rel-manque">Manquante</b>}
                </span>
              )}
            </h2>

            {!revelee && (
              <ul className="rel-chances" aria-label="Chances">
                {chances().map(([nom, p, t]) => <li key={t} className={`ch-${t}`}>{nom} <b>{p}</b></li>)}
              </ul>
            )}

            <p className="rel-reserve" title="Vos vestiges"><Vestiges n={vestiges} /></p>

            {prise ? (
              <>
                {bilan && (
                  <p className={`rel-verdict ${ecart > 0 ? "gain" : ecart < 0 ? "perte" : ""}`}>
                    <Vestiges n={bilan.paye} /> <span aria-hidden="true">→</span><span className="sr">, elle en vaut</span> <Vestiges n={bilan.vaut} />
                    {ecart !== 0 && <b>{ecart > 0 ? "+" : "−"}{fmt(Math.abs(ecart))}</b>}
                  </p>
                )}
                <p className="rel-jour-etat"><Icone nom="fait" taille={15} /> Forgée · {prochaine}</p>
              </>
            ) : !revelee ? (
              <>
                <div className="rel-gestes">
                  <button type="button" className="btn" disabled={!possibleAveugle} onClick={forgerAveugle}
                    onBlur={() => setConfirme(null)}>
                    {confirme === "aveugle" ? "Confirmer" : "À l'aveugle"} <Vestiges n={offre.prixAveugle} />
                  </button>
                  <button type="button" className="btn quiet" onClick={revelerCarte} onBlur={() => setConfirme(null)}
                    title="Montre la carte et son prix. Le prix à l'aveugle est perdu pour aujourd'hui.">
                    {confirme === "retourner" ? "Renoncer à l'aveugle ?" : "Retourner"}
                  </button>
                </div>
                <p className="rel-jour-etat">
                  {!possibleAveugle && <span className="rel-manque">Manque {fmt(offre.prixAveugle - vestiges)} · </span>}
                  {prochaine}
                </p>
              </>
            ) : (
              <>
                <button type="button" className="btn" disabled={!possible} onClick={forger}
                  onBlur={() => setConfirme(null)}>
                  {confirme === "forger" ? "Confirmer" : "Forger"} <Vestiges n={offre.prix} />
                </button>
                <p className="rel-jour-etat">
                  {!possible && <span className="rel-manque">Manque {fmt(offre.prix - vestiges)} · </span>}
                  {prochaine}
                </p>
              </>
            )}
          </div>
        </section>
      )}

      <Regles ouvert={!(etat.stats?.forges > 0)} />

      {effet && <Effet key={effet} genre={effet} onFin={() => setEffet(null)} />}
    </main>
  );
}
