import { useEffect, useMemo, useRef, useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import Carte from "../components/Carte.jsx";
import { Lien } from "../lib/routeur.jsx";
import { RELIQUAIRE } from "../config/reliquaire.js";
import { SLOTS, TAUX_DEFAUT, TIER_INFO } from "../config/tiers.js";
import { completion, eligible, jourDe, offreDuJour, offrePrise, peutForgerOffre } from "../reliquaire/regles.js";
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
 */
export default function PageReliquaire() {
  const { etat, boosterId, booster, jeuComplet, vestiges, forgerOffre, mouvementReduit, reliquaireOuvert,
    cfgImage, fichiers, setLoupe } = useJeu();
  const [confirme, setConfirme] = useState(false);
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
  const possible = peutForgerOffre(etat, offre);
  const ex = offre ? etat.collections?.[boosterId]?.[offre.c.id] : null;
  const detenus = offre ? (offre.rainbow ? ex?.rainbow : ex?.normale) || 0 : 0;
  const carte = offre ? { ...offre.c, rainbow: offre.rainbow } : null;

  const forger = () => {
    if (!confirme) { setConfirme(true); return; }
    setConfirme(false);
    if (forgerOffre(offre)) {
      if (!mouvementReduit) setEffet(offre.c.tier === "legendaire" || offre.rainbow ? "forge-legendaire" : "forge");
      setAnnonce(`${offre.c.nom} forgée et rangée dans la bibliothèque.`);
    }
  };

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
            <Carte c={carte} taille="plein" cfgImage={cfgImage} fichiers={fichiers}
              onToucher={() => setLoupe(carte)} etiquette={`Agrandir ${offre.c.nom}`} />
          </div>

          <div className="rel-jour-fiche">
            <h2 id="rel-jour-titre">La carte du jour</h2>
            <p className="rel-jour-nom">
              {offre.c.nom}
              <span>{TIER_INFO[offre.c.tier]?.nom}{offre.rainbow && " · Rainbow"}</span>
            </p>
            <p className="muted">
              {detenus > 0
                ? `Vous en avez ${detenus} exemplaire${detenus > 1 ? "s" : ""}${offre.rainbow ? " irisé" + (detenus > 1 ? "s" : "") : ""} : celui-ci s'y ajoutera.`
                : offre.rainbow ? "Vous n'avez pas encore sa version irisée." : "Elle manque à votre collection."}
            </p>

            <div className="rel-reserve">
              <img src={`${IMG}vestige.webp`} alt="" className="rel-vestige" />
              <p><b>{vestiges.toLocaleString("fr-FR")}</b> vestiges</p>
            </div>

            {prise ? (
              <p className="rel-jour-etat">Forgée aujourd'hui. Prochaine carte dans {avantMinuit(maintenant)}.</p>
            ) : (
              <>
                <button type="button" className="btn" disabled={!possible} onClick={forger}
                  onBlur={() => setConfirme(false)}>
                  {confirme ? `Confirmer : ${offre.prix.toLocaleString("fr-FR")} vestiges` : `Forger · ${offre.prix.toLocaleString("fr-FR")} vestiges`}
                </button>
                <p className="muted rel-jour-etat">
                  {!possible && `Il vous manque ${(offre.prix - vestiges).toLocaleString("fr-FR")} vestiges. `}
                  Nouvelle carte dans {avantMinuit(maintenant)}.
                </p>
              </>
            )}
          </div>
        </section>
      )}

      <p className="muted rel-hors">
        La carte du jour sort comme dans un booster : une commune bien plus souvent qu'une légendaire,
        irisée trois fois sur cent. Les cartes de personnage et les full art restent hors du Reliquaire.
        {" "}<Lien vers="/bibliotheque" actif={false} className="lien">Aller à la bibliothèque</Lien>
      </p>

      {effet && <Effet key={effet} genre={effet} onFin={() => setEffet(null)} />}
    </main>
  );
}
