import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BOOSTER_DEFAUT, BOOSTER_PAR_ID } from "../extensions/index.js";
import { specialesPour } from "../config/speciales.js";
import { ECONOMIE, GARANTIES, TIER_ORDER, TIERS_ROSTER } from "../config/tiers.js";
import { construirePool, deduireGrades } from "../lib/roster.js";
import {
  CLE_MINE, CLE_PARTIE, charger, classerTexte, ecrireMine, etatVide, lireEcriture, noterEcriture, plusRecente,
  relireJeu, retablirMine, sauver,
} from "../lib/storage.js";
import { geler } from "../lib/gel.js";
import { mineMoinsAvancee, seuleLaBourse } from "./onglets.js";
import { crediter, peutAcheter } from "../lib/economie.js";
import { appliquerOuverture, reglementOuverture } from "./recolte.js";
import { useReglages } from "./reglages.js";
import { useMine } from "./mine.js";
import { useMouvements } from "./marche.js";
import { useColporteur } from "./colporteur.js";
import { useInventaire } from "./portraits.js";
import { useSucces } from "./succes.js";
import { useDonjon } from "./donjon.js";
import { useExpeditions } from "./expeditions.js";
import { useMissions } from "./missions.js";
import { compteSuivi } from "../lib/nuage/firebase.js";
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

  // Le texte de la partie écrit par un autre onglet, adopté ici (voir plus bas).
  const recuDAilleurs = useRef(null);
  const etatCourant = useRef(etat);
  const dernierSauve = useRef(null);
  useEffect(() => {
    etatCourant.current = etat;
    // Un onglet en arrière-plan n'écrit pas son seul gain passif : c'est
    // l'écriture qui, partie d'une copie en retard d'un instant, effaçait ce
    // que l'onglet joué venait de faire. Le gain n'est pas perdu : il court
    // sur l'horloge et sera crédité au prochain tour.
    const avant = dernierSauve.current;
    if (avant && document.hidden && seuleLaBourse(avant, etat)) return;
    dernierSauve.current = etat;
    setStockageKo(!sauver(etat, recuDAilleurs.current));
  }, [etat]);

  /*
   * Un appareil qui suit un compte ne fait rien de lui-même avant d'avoir lu
   * la copie du compte (Compte.jsx lève l'attente). Sinon, le téléphone
   * ouvert le lendemain tirait ses missions du jour sur une partie en retard,
   * et ce tirage passait pour « joué ici » : il effaçait les missions
   * réalisées sur l'ordinateur. Le gain passif, lui, continue : la fusion de
   * la bourse sait qu'il court sur l'horloge.
   */
  const [compteLu, setCompteLu] = useState(() => !compteSuivi());
  const lireCompteFait = useCallback(() => setCompteLu(true), []);
  const attendreCompte = useCallback(() => setCompteLu(false), []);

  // Gain passif : crédité au chargement puis toutes les vingt secondes.
  useEffect(() => {
    const tic = () => setEtat((e) => ({ ...e, bourse: crediter(e.bourse) }));
    tic();
    const iv = setInterval(tic, 20000);
    return () => clearInterval(iv);
  }, []);

  const {
    reglages, son, reglageSon, animations, reventeAuto, MJ, taux, cfgImage: cfgImageBase, test, gratuit,
    sobreSysteme, mouvementReduit, sfx, majReglages,
  } = useReglages(etat, setEtat);
  const inventaire = useInventaire(cfgImageBase.base);
  // Les portraits se rangent par extension : la carte a besoin de savoir où
  // chercher, et si l'image existe (inventaire publié avec les portraits).
  const cfgImage = { ...cfgImageBase, extension: boosterId, inventaire };
  const { crediterCommande, crediterRemise, remisePayee, majTafix, versionMine, rechargerMine } = useMine(etat, setEtat);

  /*
   * Plusieurs onglets ouverts sur le site partagent le même stockage, mais
   * chacun avait sa partie en mémoire. L'onglet oublié, en créditant son gain
   * passif toutes les vingt secondes, réécrivait sa vieille partie par-dessus
   * celle de l'onglet joué ; au lancement suivant, la fusion lisait cette
   * vieille partie comme des cartes vendues, et le compte les perdait. Chaque
   * onglet adopte donc ce qu'un autre vient d'écrire : ils avancent ensemble.
   * La mine, elle, n'est adoptée que par un onglet en arrière-plan : la
   * recharger sous les yeux du joueur couperait son tour.
   *
   * Sauf entre deux versions du site (après une montée de `SCHEMA`). Un onglet
   * resté sur l'ancienne ne lit pas ce qu'écrit la nouvelle, mais continuait à
   * réécrire sa vieille partie ; l'onglet à jour l'adoptait, migrée, et perdait
   * sa progression. Désormais une écriture d'un format plus ancien n'est pas
   * adoptée — l'onglet à jour réécrit la sienne pour reprendre la main — et
   * une écriture d'un format plus récent gèle cet onglet-ci (src/lib/gel.js).
   */
  useEffect(() => {
    const ecouter = (ev) => {
      if (ev.storageArea !== localStorage) return;
      if (ev.key === CLE_PARTIE) {
        const genre = classerTexte(ev.newValue);
        if (genre === "futur") { geler("onglet"); return; }
        // Plus ancienne que ce qu'on a (onglet en retard, ancien code) : on ne
        // l'adopte pas, et on réécrit la nôtre pour reprendre la main.
        if (genre === "ancien" || !plusRecente(lireEcriture(ev.newValue))) {
          recuDAilleurs.current = null;
          sauver(etatCourant.current);
          return;
        }
        noterEcriture(lireEcriture(ev.newValue));
        let suite = null;
        try { suite = ev.newValue ? relireJeu(JSON.parse(ev.newValue)) : etatVide(); } catch { /* illisible */ }
        if (!suite) return;
        recuDAilleurs.current = ev.newValue;
        setEtat(suite);
      } else if (ev.key === CLE_MINE) {
        const genre = classerTexte(ev.newValue);
        if (genre === "futur") { geler("onglet"); return; }
        // Une mine d'un onglet en retard ne s'adopte pas : on remet celle
        // qu'elle a recouverte, sans quoi les Mines la reliraient à leur
        // prochaine ouverture.
        if (genre === "ancien") {
          if (classerTexte(ev.oldValue) === "courant") retablirMine(ev.oldValue);
          return;
        }
        // Une mine moins avancée que celle qu'elle recouvre vient d'un onglet
        // en retard (les compteurs d'une mine ne reculent jamais) : on remet
        // l'autre, sinon les Mines la reliraient à leur prochaine ouverture.
        if (mineMoinsAvancee(ev.newValue, ev.oldValue)) { retablirMine(ev.oldValue); return; }
        if (!document.hidden) return;
        ecrireMine(ev.newValue);
        rechargerMine();
      }
    };
    window.addEventListener("storage", ecouter);
    return () => window.removeEventListener("storage", ecouter);
  }, [rechargerMine]);

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
   *
   * `prix` est le vrai prix (étagère ou botte), jamais zéro pour dire
   * « offert » : c'est le sachet, relu dans la partie, qui décide. Rend `null`
   * si l'ouverture n'est pas payable, pour que l'écran revienne au sachet au
   * lieu de dérouler des cartes jamais acquises. Le règlement est refait dans
   * le setter, sur la partie du moment : un double clic ou un autre onglet ne
   * consomme pas un sachet qui n'existe plus et ne débite pas une bourse vide.
   */
  const recolter = useCallback(
    (booster, prix = ECONOMIE.prix, sachet = null, botte = false) => {
      if (!reglementOuverture(etat, { prix, sachet, gratuit })) return null;
      const avant = etat.collections[boosterId] || {};
      const nouvelles = new Set();
      booster.cards.forEach((c) => {
        const cle = c.rainbow ? "rainbow" : "normale";
        if (!(avant[c.id] && avant[c.id][cle])) nouvelles.add(`${c.id}:${cle}`);
      });

      setEtat((e) => appliquerOuverture(e, {
        boosterId, booster, prix, sachet, gratuit, reventeAuto, botte, nouvelles,
      }));

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


  const { vendreExemplaires, acheterExemplaire, appliquerMarche, majComptoir, compter } =
    useMouvements(setEtat, boosterId);
  const succes = useSucces(etat, setEtat, versionMine);
  const donjon = useDonjon(etat, setEtat, test);
  const expeditions = useExpeditions(etat, setEtat, compteLu);
  const missions = useMissions(etat, setEtat, compteLu);

  /**
   * Le sachet offert que l'ouverture de cette extension consommerait : un
   * sachet de l'extension d'abord, un sachet au choix ensuite. Les premiers
   * ne servent qu'ici ; les seconds servent partout.
   */
  const sachetOffert = (() => {
    const s = etat.sachets || {};
    if ((s[boosterId] || 0) > 0) return { cle: boosterId, n: s[boosterId], libre: (s["*"] || 0) };
    if ((s["*"] || 0) > 0) return { cle: "*", n: s["*"], libre: s["*"] };
    return null;
  })();
  const tirerVisiteColporteur = useColporteur({ etat, setEtat, boosterId, pool, ouverts, test });

  const booster = BOOSTER_PAR_ID[boosterId];
  const achetable = peutAcheter(etat.bourse, gratuit);

  const valeur = {
    etat, setEtat, stockageKo, versionMine, rechargerMine, compteLu, lireCompteFait, attendreCompte,
    boosterId, setBoosterId, booster,
    reglages, son, reglageSon, reventeAuto, taux, cfgImage, test, gratuit, majReglages,
    animations, sobreSysteme, mouvementReduit,
    rows, source, grades, pool, speciales, jeuComplet, carteParId, paliersVides,
    ouverts, pity, garantirLegendaire,
    collection, collecte, surplusTotal, exemplaires, surplus,
    bourse: etat.bourse, achetable, prixBooster: ECONOMIE.prix,
    recolter, majProgres, finirOuverture,
    vendreExemplaires, acheterExemplaire, appliquerMarche, compter,
    crediterCommande, crediterRemise, remisePayee, majTafix, tafix: etat.tafix,
    succes, missions, sachetOffert, ...donjon, ...expeditions,
    tirerVisiteColporteur,
    comptoirSauve: (etat.comptoir || {})[boosterId] || null, majComptoir,
    sfx, fichiers, setFichiers, nbImages, setNbImages,
    loupe, setLoupe, avis, setAvis,
  };

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}
