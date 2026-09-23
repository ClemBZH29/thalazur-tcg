import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BOOSTER_DEFAUT, BOOSTER_PAR_ID } from "../extensions/index.js";
import { specialesPour } from "../config/speciales.js";
import { ECONOMIE, GARANTIES, TIER_ORDER, TIERS_ROSTER } from "../config/tiers.js";
import { construirePool, deduireGrades } from "../lib/roster.js";
import { charger, sauver } from "../lib/storage.js";
import { crediter, crediterGain, debiterLibre, peutAcheter, valeurRevente } from "../lib/economie.js";
import { useReglages } from "./reglages.js";
import { useMine } from "./mine.js";
import { useMouvements } from "./marche.js";
import { useColporteur } from "./colporteur.js";
import { useInventaire } from "./portraits.js";
const DEFAUT = BOOSTER_DEFAUT;


/**
 * L'état du jeu, en un seul endroit.
 *
 * Il vivait dans App.jsx tant que l'application avait trois vues et un seul
 * arbre. Avec six pages, chacune ayant besoin d'un morceau différent — la
 * bourse partout, la collection au Comptoir, le tirage à l'ouverture — le
 * passage par accessoires obligeait à traverser trois composants pour amener
 * une valeur à destination.
 */
const Ctx = createContext(null);

export const useJeu = () => useContext(Ctx);

/** La clé d'une case de collection : normale et rainbow sont deux cases. */
export const CASE = { normale: "normale", rainbow: "rainbow" };

export { TEST_DEFAUT } from "./reglages.js";

export function Jeu({ children }) {
  const [etat, setEtat] = useState(charger);
  const [boosterId, setBoosterId] = useState(DEFAUT);
  const [loupe, setLoupe] = useState(null);
  const [avis, setAvis] = useState(null);
  const [fichiers, setFichiers] = useState(new Map());
  const [nbImages, setNbImages] = useState(0);
  const [stockageKo, setStockageKo] = useState(false);

  useEffect(() => { setStockageKo(!sauver(etat)); }, [etat]);

  // Gain passif : crédité au chargement puis toutes les vingt secondes.
  useEffect(() => {
    const tic = () => setEtat((e) => ({ ...e, bourse: crediter(e.bourse) }));
    tic();
    const iv = setInterval(tic, 20000);
    return () => clearInterval(iv);
  }, []);

  const {
    reglages, son, animations, reventeAuto, MJ, taux, cfgImage: cfgImageBase, test, gratuit,
    sobreSysteme, mouvementReduit, sfx, majReglages,
  } = useReglages(etat, setEtat);
  const inventaire = useInventaire(cfgImageBase.base);
  // Les portraits se rangent par extension : la carte a besoin de savoir où
  // chercher, et si l'image existe (inventaire publié avec les portraits).
  const cfgImage = { ...cfgImageBase, extension: boosterId, inventaire };
  const { crediterMine, mineJour, versionMine, rechargerMine } = useMine(etat, setEtat);

  const donnees = MJ ? etat.rosters[boosterId] : null;
  const roster = BOOSTER_PAR_ID[boosterId]?.roster;
  const rows = donnees ? donnees.lignes : (roster?.lignes ?? []);
  const source = donnees ? donnees.source : (roster?.source ?? "aucune");

  const grades = useMemo(
    () => (MJ && etat.grades[boosterId]) || deduireGrades(rows),
    [etat.grades, boosterId, rows]
  );
  const pool = useMemo(() => construirePool(rows, grades), [rows, grades]);
  const speciales = useMemo(() => specialesPour(BOOSTER_PAR_ID[boosterId]), [boosterId]);

  /** L'ensemble du set, obtenu ou non : la bibliothèque affiche les manques. */
  const jeuComplet = useMemo(
    () => [...TIER_ORDER.flatMap((t) => pool[t] || []), ...speciales.fullart, ...speciales.pj],
    [pool, speciales]
  );
  const carteParId = useMemo(
    () => Object.fromEntries(jeuComplet.map((c) => [c.id, c])),
    [jeuComplet]
  );

  /**
   * Paliers du roster restés vides.
   *
   * `draw.js` glisse vers le palier voisin quand celui demandé n'a aucune
   * carte — c'est ce qui permet à un roster partiel de fonctionner. Mais le
   * repli était muet : un roster sans commun envoie les trois emplacements
   * garantis sur peu commun, et l'on ouvre cinq peu communs booster après
   * booster en croyant les tables déréglées. Elles ne le sont pas ; c'est le
   * roster qui manque d'un palier, et cela doit se lire.
   */
  const paliersVides = useMemo(
    () => TIERS_ROSTER.filter((t) => !pool[t.id] || pool[t.id].length === 0),
    [pool]
  );

  const ouverts = etat.boosters[boosterId] || 0;
  const pity = etat.pity[boosterId] || { depuis: 0, vu: false };

  /**
   * Le filet de sécurité, décidé avant le tirage. Sans la première condition,
   * un roster dépourvu de légendaire déclencherait la garantie à chaque booster
   * sans jamais pouvoir la satisfaire.
   */
  const aDesLegendaires = pool.legendaire.length > 0;
  const garantirLegendaire =
    aDesLegendaires &&
    ((!pity.vu && ouverts + 1 >= GARANTIES.premierLegendaire) ||
      pity.depuis + 1 >= GARANTIES.intervalle);

  /**
   * Renvoie l'ensemble des cases nouvellement remplies, calculé sur la
   * collection telle qu'elle est *avant* la mise à jour — c'est ce qui permet
   * d'afficher le badge « New » au moment de la révélation.
   */
  const recolter = useCallback(
    (booster, prix = ECONOMIE.prix) => {
      const avant = etat.collections[boosterId] || {};
      const nouvelles = new Set();
      booster.cards.forEach((c) => {
        const cle = c.rainbow ? "rainbow" : "normale";
        if (!(avant[c.id] && avant[c.id][cle])) nouvelles.add(`${c.id}:${cle}`);
      });

      setEtat((e) => {
        const coll = { ...(e.collections[boosterId] || {}) };
        let revente = 0;
        booster.cards.forEach((c) => {
          const { rainbow, slot, ...carte } = c;
          const cle = rainbow ? "rainbow" : "normale";
          const a = coll[c.id];
          const dejaLa = a && a[cle] > 0;
          if (dejaLa && reventeAuto) {
            // Réglage éteint par défaut : le doublon partait à l'échoppe pour
            // deux PO alors qu'il vaut le double au Comptoir.
            revente += valeurRevente(c.tier);
            return;
          }
          coll[c.id] = {
            normale: 0, rainbow: 0, ...(a || {}),
            [cle]: ((a && a[cle]) || 0) + 1,
            carte,
          };
        });
        const leg = booster.cards.some((c) => c.tier === "legendaire");
        const p = e.pity[boosterId] || { depuis: 0, vu: false };
        return {
          ...e,
          collections: { ...e.collections, [boosterId]: coll },
          boosters: { ...e.boosters, [boosterId]: (e.boosters[boosterId] || 0) + 1 },
          pity: { ...e.pity, [boosterId]: { depuis: leg ? 0 : p.depuis + 1, vu: p.vu || leg } },
          // `debiterLibre` et non `debiter` : le prix n'est plus une constante
          // depuis que le colporteur vend un sachet sous le manteau.
          bourse: crediterGain(debiterLibre(e.bourse, gratuit ? 0 : prix), revente),
          enCours: {
            boosterId,
            tirage: booster,
            index: 0,
            nouvelles: Array.from(nouvelles),
          },
        };
      });

      return nouvelles;
    },
    [etat, boosterId, gratuit, reventeAuto]
  );

  const majProgres = useCallback(
    (i) => setEtat((e) => (e.enCours ? { ...e, enCours: { ...e.enCours, index: i } } : e)),
    []
  );
  const finirOuverture = useCallback(() => setEtat((e) => ({ ...e, enCours: null })), []);

  const collection = etat.collections[boosterId] || {};

  /**
   * Cartes du set obtenues dans l'extension courante — le chiffre de la
   * pastille de navigation.
   *
   * Il a été recompté deux fois, et le critère retenu est celui de la
   * bibliothèque : la **case normale** remplie, hors PJ. C'est la seule façon
   * de faire dire la même chose aux deux coins de l'écran. Une rainbow ne
   * remplace pas la carte standard depuis que les deux cases sont séparées :
   * la posséder seule laisse la case normale vide, et la bibliothèque affiche
   * bien cette case comme manquante. La compter ici ferait dire à la pastille
   * qu'on a une carte que la grille montre encore à obtenir. Les rainbow ont
   * leur propre chiffre, sous le titre de la bibliothèque, et les PJ leur
   * propre onglet.
   */
  const collecte = Object.entries(collection).reduce(
    (n, [id, e]) => n + (!id.startsWith("pj-") && carteParId[id] && e.normale > 0 ? 1 : 0), 0
  );
  /**
   * Exemplaires au delà de la case remplie : la matière première du Comptoir.
   *
   * Les deux compteurs écartent les entrées que le roster courant ne connaît
   * plus. Le passage du roster de démonstration au vrai set a changé tous les
   * identifiants ; sans ce filtre, une vieille sauvegarde annonçait un surplus
   * et une collecte que ni la bibliothèque ni le Comptoir — qui travaillent sur
   * `jeuComplet` — n'auraient su montrer. Les entrées orphelines restent dans le
   * stockage, intactes : charger un roster partiel un après-midi ne doit pas
   * effacer une collection.
   */
  const surplusTotal = Object.entries(collection).reduce(
    (n, [id, e]) => (carteParId[id]
      ? n + Math.max(0, (e.normale || 0) - 1) + Math.max(0, (e.rainbow || 0) - 1)
      : n), 0
  );

  const exemplaires = useCallback(
    (carteId, version) => (collection[carteId]?.[version] || 0),
    [collection]
  );
  const surplus = useCallback(
    (carteId, version) => Math.max(0, (collection[carteId]?.[version] || 0) - 1),
    [collection]
  );


  const { vendreExemplaires, acheterExemplaire, appliquerMarche, majComptoir } =
    useMouvements(setEtat, boosterId);
  const tirerVisiteColporteur = useColporteur({ etat, setEtat, boosterId, pool, ouverts, test });

  const booster = BOOSTER_PAR_ID[boosterId];
  const achetable = peutAcheter(etat.bourse, gratuit);

  const valeur = {
    etat, setEtat, stockageKo, versionMine, rechargerMine,
    boosterId, setBoosterId, booster,
    reglages, son, reventeAuto, taux, cfgImage, test, gratuit, majReglages,
    animations, sobreSysteme, mouvementReduit,
    rows, source, grades, pool, speciales, jeuComplet, carteParId, paliersVides,
    ouverts, pity, garantirLegendaire,
    collection, collecte, surplusTotal, exemplaires, surplus,
    bourse: etat.bourse, achetable, prixBooster: ECONOMIE.prix,
    recolter, majProgres, finirOuverture,
    vendreExemplaires, acheterExemplaire, appliquerMarche, crediterMine, mineJour,
    tirerVisiteColporteur,
    comptoirSauve: (etat.comptoir || {})[boosterId] || null, majComptoir,
    sfx, fichiers, setFichiers, nbImages, setNbImages,
    loupe, setLoupe, avis, setAvis,
  };

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}
