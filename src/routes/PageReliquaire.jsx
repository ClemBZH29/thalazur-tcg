import { useEffect, useMemo, useRef, useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import Carte from "../components/Carte.jsx";
import { Lien } from "../lib/routeur.jsx";
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

/** Les chances de la carte du jour, lues dans la table du booster : « 60 % de communes… ». */
function chances() {
  const f = frequences(SLOTS);
  const total = PALIERS.reduce((s, t) => s + f[t], 0);
  const pct = (t) => { const v = (f[t] / total) * 100; return v >= 10 ? Math.round(v) : Math.round(v * 10) / 10; };
  return `${pct("commun")} % commune, ${pct("peucommun")} % peu commune, ${String(pct("rare")).replace(".", ",")} % rare, `
    + `${String(pct("legendaire")).replace(".", ",")} % légendaire ; rainbow ${Math.round(TAUX_DEFAUT.rainbow * 100)} fois sur cent`;
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
        <header className="exp-bandeau" style={{ backgroundImage: `url(${IMG}bandeau.webp)` }}>
          <div className="exp-bandeau-texte">
            <h1>Le Reliquaire est scellé</h1>
            <p className="lede">
              Le gardien ouvre sa crypte aux collectionneurs qui ont complété une extension à
              {" "}{Math.round(RELIQUAIRE.ouverture * 100)} % au moins. {booster?.titre || "Cette extension"} : {Math.round(pct * 100)} %.
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

  const verdict = bilan && (bilan.vaut > bilan.paye
    ? `Belle affaire : ${fmt(bilan.vaut - bilan.paye)} vestiges d'économisés.`
    : bilan.vaut < bilan.paye ? "Le pari ne paie pas cette fois." : "Le compte est juste.");

  return (
    <main className="view large exp-page rel-page" id="contenu">
      <header className="exp-bandeau" style={{ backgroundImage: `url(${IMG}bandeau.webp)` }}>
        <div className="exp-bandeau-texte">
          <h1>Reliquaire</h1>
          <p className="lede">
            Chaque jour, le gardien forge une seule carte, la même pour tous les collectionneurs.
            Elle se paie en vestiges, qu'il tire de vos doublons : dans la bibliothèque, touchez une
            carte en double et ouvrez son volet Reliquaire.
          </p>
        </div>
      </header>

      <p className="sr" role="status" aria-live="polite">{annonce}</p>

      {offre && (
        <section className="rel-jour" aria-labelledby="rel-jour-titre">
          <img className="rel-gardien" src={`${IMG}gardien.webp`} alt="Le gardien du Reliquaire" draggable="false" />

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
            <h2 id="rel-jour-titre">La carte du jour</h2>
            {revelee ? (
              <>
                <p className="rel-jour-nom">
                  {offre.c.nom}
                  <span>{TIER_INFO[offre.c.tier]?.nom}{offre.rainbow && " · Rainbow"}</span>
                </p>
                <p className="muted">
                  {detenus > 0
                    ? `Vous en avez ${detenus} exemplaire${detenus > 1 ? "s" : ""}${offre.rainbow ? " rainbow" : ""} : celui-ci s'y ajoutera.`
                    : offre.rainbow ? "Vous n'avez pas encore sa version rainbow." : "Elle manque à votre collection."}
                </p>
              </>
            ) : (
              <>
                <p className="rel-jour-nom">
                  Face cachée
                  <span>La même pour tous les collectionneurs</span>
                </p>
                <p className="muted">
                  Forgez-la sans la voir au prix moyen, ou retournez-la pour connaître la carte et son
                  prix : il ne sera plus question du prix moyen aujourd'hui. Elle sort comme dans un
                  booster : {chances()}.
                </p>
              </>
            )}

            <div className="rel-reserve">
              <img src={`${IMG}vestige.webp`} alt="" className="rel-vestige" />
              <p><b>{fmt(vestiges)}</b> vestiges</p>
            </div>

            {prise ? (
              <>
                {bilan && (
                  <p className="rel-jour-verdict">
                    Payée {fmt(bilan.paye)} vestiges à l'aveugle, elle en vaut {fmt(bilan.vaut)}. {verdict}
                  </p>
                )}
                <p className="rel-jour-etat">Forgée aujourd'hui. Prochaine carte dans {avantMinuit(maintenant)}.</p>
              </>
            ) : !revelee ? (
              <>
                <div className="rel-gestes">
                  <button type="button" className="btn" disabled={!possibleAveugle} onClick={forgerAveugle}
                    onBlur={() => setConfirme(null)}>
                    {confirme === "aveugle" ? `Confirmer : ${fmt(offre.prixAveugle)} vestiges` : `Forger à l'aveugle · ${fmt(offre.prixAveugle)} vestiges`}
                  </button>
                  <button type="button" className="btn quiet" onClick={revelerCarte} onBlur={() => setConfirme(null)}>
                    {confirme === "retourner" ? "Confirmer : renoncer au prix moyen" : "Retourner la carte"}
                  </button>
                </div>
                <p className="muted rel-jour-etat">
                  {!possibleAveugle && `Il vous manque ${fmt(offre.prixAveugle - vestiges)} vestiges pour la forger à l'aveugle. `}
                  Nouvelle carte dans {avantMinuit(maintenant)}.
                </p>
              </>
            ) : (
              <>
                <button type="button" className="btn" disabled={!possible} onClick={forger}
                  onBlur={() => setConfirme(null)}>
                  {confirme === "forger" ? `Confirmer : ${fmt(offre.prix)} vestiges` : `Forger · ${fmt(offre.prix)} vestiges`}
                </button>
                <p className="muted rel-jour-etat">
                  {!possible && `Il vous manque ${fmt(offre.prix - vestiges)} vestiges. `}
                  Face cachée, elle coûtait {fmt(offre.prixAveugle)}. Nouvelle carte dans {avantMinuit(maintenant)}.
                </p>
              </>
            )}
          </div>
        </section>
      )}

      <p className="muted rel-hors">
        Les cartes de personnage et les full art restent hors du Reliquaire. Les vestiges se tirent des
        doublons, depuis la bibliothèque.
        {" "}<Lien vers="/bibliotheque" actif={false} className="lien">Aller à la bibliothèque</Lien>
      </p>

      {effet && <Effet key={effet} genre={effet} onFin={() => setEffet(null)} />}
    </main>
  );
}
