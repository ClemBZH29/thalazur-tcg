import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BOOSTER_PAR_ID } from "../config/boosters.js";
import { specialesPour } from "../config/speciales.js";
import { TAUX_DEFAUT, ECONOMIE, GARANTIES, MINE, TIER_ORDER, TIERS_ROSTER } from "../config/tiers.js";
import { jourLocal, passeAujourdhui, propositions } from "../config/colporteur.js";
import { CFG_IMAGE_DEFAUT } from "../lib/images.js";
import { construirePool, deduireGrades } from "../lib/roster.js";
import { useAudio } from "../lib/audio.js";
import { charger, sauver } from "../lib/storage.js";
import {
  crediter, crediterGain, debiterLibre, peutAcheter, valeurRevente,
} from "../lib/economie.js";
import rosterValeran from "../../data/troupe-valeran.json";

const ROSTERS = { "troupe-valeran": rosterValeran };
const DEFAUT = "troupe-valeran";

export const TEST_DEFAUT = {
  actif: false,
  sansPO: false,
  taille: 5,
  palier: "auto",
  rainbow: "auto",
  // Le colporteur passe huit fois sur cent : sans ce levier, le vérifier
  // demandait d'ouvrir une douzaine de boosters à chaque retouche.
  colporteur: "auto", // auto | toujours | jamais
};

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

export function Jeu({ children }) {
  const [etat, setEtat] = useState(charger);
  const [boosterId, setBoosterId] = useState(DEFAUT);
  const [loupe, setLoupe] = useState(null);
  const [avis, setAvis] = useState(null);
  const [fichiers, setFichiers] = useState(new Map());
  const [nbImages, setNbImages] = useState(0);
  const [stockageKo, setStockageKo] = useState(false);
  // Monte de un quand la sauvegarde de la mine a été remplacée de l'extérieur
  // (copie du compte adoptée) : la page des Mines s'en sert de clé, et le
  // module relit sa sauvegarde au lieu d'écraser la nouvelle avec l'ancienne.
  const [versionMine, setVersionMine] = useState(0);
  const rechargerMine = useCallback(() => setVersionMine((v) => v + 1), []);

  useEffect(() => { setStockageKo(!sauver(etat)); }, [etat]);

  // Gain passif : crédité au chargement puis toutes les vingt secondes.
  useEffect(() => {
    const tic = () => setEtat((e) => ({ ...e, bourse: crediter(e.bourse) }));
    tic();
    const iv = setInterval(tic, 20000);
    return () => clearInterval(iv);
  }, []);

  const reglages = etat.reglages || {};
  const son = reglages.son !== false;
  /**
   * Animations : « systeme » (défaut), « pleines » ou « reduites ».
   *
   * Les feuilles de style gardaient leurs animations derrière
   * `prefers-reduced-motion`, ce qui est juste par défaut et malheureux ici :
   * sur ce site l'animation est le contenu — le sachet qui se déchire, la lueur
   * qui annonce le palier, la carte qui se retourne. Un système réglé sur
   * « moins d'animations » vidait donc l'ouverture et la mine de leur
   * substance, sans rien dire et sans recours. Le garde est devenu un attribut
   * de la racine, et ce réglage le gouverne.
   */
  const animations = reglages.animations || "systeme";
  // La revente automatique était le comportement unique de l'app ; elle est
  // devenue une option, parce que le Comptoir a besoin d'exemplaires à écouler.
  const reventeAuto = reglages.reventeAuto === true;
  /* Les leviers de meneur — taux de tirage, cadrage des portraits, mode test,
     roster chargé à la main — ne se règlent qu'en développement. En
     production, des valeurs laissées par une ancienne version du site (où la
     page Réglages était publique) sont ignorées : tout le monde joue avec les
     mêmes tables, et le mode test ne peut pas servir à ouvrir sans payer. */
  const MJ = import.meta.env.DEV;
  const taux = { ...TAUX_DEFAUT, ...(MJ ? reglages.taux || {} : {}) };
  const cfgImage = { ...CFG_IMAGE_DEFAUT, ...(MJ ? reglages.image || {} : {}) };
  const test = { ...TEST_DEFAUT, ...(MJ ? reglages.test || {} : {}) };
  const gratuit = test.actif && test.sansPO;

  /** La préférence du système, suivie en direct : elle peut changer en session. */
  const [sobreSysteme, setSobreSysteme] = useState(
    () => typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const suivre = (e) => setSobreSysteme(e.matches);
    mq.addEventListener("change", suivre);
    return () => mq.removeEventListener("change", suivre);
  }, []);

  const mouvementReduit =
    animations === "reduites" || (animations === "systeme" && sobreSysteme);

  useEffect(() => {
    document.documentElement.dataset.mouvement = mouvementReduit ? "reduit" : "plein";
  }, [mouvementReduit]);

  const sonRef = useRef(son);
  useEffect(() => { sonRef.current = son; }, [son]);
  const sfx = useAudio(sonRef);

  const majReglages = useCallback(
    (patch) => setEtat((e) => ({ ...e, reglages: { ...e.reglages, ...patch } })),
    []
  );

  const donnees = MJ ? etat.rosters[boosterId] : null;
  const rows = donnees ? donnees.lignes : (ROSTERS[boosterId]?.lignes ?? []);
  const source = donnees ? donnees.source : (ROSTERS[boosterId]?.source ?? "aucune");

  const grades = useMemo(
    () => (MJ && etat.grades[boosterId]) || deduireGrades(rows),
    [etat.grades, boosterId, rows]
  );
  const pool = useMemo(() => construirePool(rows, grades), [rows, grades]);
  const speciales = useMemo(() => specialesPour(boosterId), [boosterId]);

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

  /* ── Mouvements d'inventaire et de bourse ──────────────────────────────── */

  /** Vente au Comptoir : n exemplaires quittent l'inventaire, les PO entrent. */
  const vendreExemplaires = useCallback((carteId, version, n, po) => {
    setEtat((e) => {
      const coll = { ...(e.collections[boosterId] || {}) };
      const a = coll[carteId];
      if (!a) return e;
      coll[carteId] = { ...a, [version]: Math.max(0, (a[version] || 0) - n) };
      return {
        ...e,
        collections: { ...e.collections, [boosterId]: coll },
        bourse: crediterGain(e.bourse, po),
      };
    });
  }, [boosterId]);

  /** Achat d'une carte à l'échoppe : les PO sortent, l'exemplaire entre. */
  const acheterExemplaire = useCallback((carte, version, po) => {
    setEtat((e) => {
      const coll = { ...(e.collections[boosterId] || {}) };
      const a = coll[carte.id];
      coll[carte.id] = {
        normale: 0, rainbow: 0, ...(a || {}),
        [version]: ((a && a[version]) || 0) + 1,
        carte,
      };
      return {
        ...e,
        collections: { ...e.collections, [boosterId]: coll },
        bourse: debiterLibre(e.bourse, po),
      };
    });
  }, [boosterId]);

  /**
   * Un échange du colporteur, appliqué d'un bloc.
   *
   * Le Comptoir n'avait besoin que de vendre ou d'acheter un exemplaire à la
   * fois. Les affaires de Mirko déplacent plusieurs lignes à la fois — trois
   * doublons contre une carte neuve, tout un lot contre des pièces — et cela
   * doit tomber en une seule écriture : un troc appliqué en deux temps
   * laisserait, si le rendu s'intercale, une collection allégée sans sa
   * contrepartie.
   */
  const appliquerMarche = useCallback(({ retire = [], ajoute = [], po = 0 }) => {
    setEtat((e) => {
      const coll = { ...(e.collections[boosterId] || {}) };
      for (const r of retire) {
        const a = coll[r.carteId];
        if (!a) continue;
        coll[r.carteId] = { ...a, [r.version]: Math.max(0, (a[r.version] || 0) - r.n) };
      }
      for (const j of ajoute) {
        const a = coll[j.carte.id];
        coll[j.carte.id] = {
          normale: 0, rainbow: 0, ...(a || {}),
          [j.version]: ((a && a[j.version]) || 0) + (j.n || 1),
          carte: j.carte,
        };
      }
      const bourse = po >= 0 ? crediterGain(e.bourse, po) : debiterLibre(e.bourse, -po);
      return { ...e, collections: { ...e.collections, [boosterId]: coll }, bourse };
    });
  }, [boosterId]);

  /**
   * Le passage du colporteur, décidé une fois par booster ouvert.
   *
   * La décision et les propositions vivent au même endroit parce qu'elles
   * dépendent des mêmes choses : la date locale, le compteur de boosters
   * depuis sa dernière visite, et l'état de la collection *après* récolte —
   * c'est ce qui lui permet de proposer d'emporter les doublons qui viennent
   * tout juste de sortir du sachet.
   */
  const tirerVisiteColporteur = useCallback(() => {
    if (test.actif && test.colporteur === "jamais") return null;
    const jour = jourLocal();
    const memoire = etat.colporteur;
    const force = test.actif && test.colporteur === "toujours";
    const vient = force || passeAujourdhui(memoire, ouverts, Math.random, jour);

    if (!vient) {
      setEtat((e) => ({
        ...e,
        colporteur: { jour: (e.colporteur && e.colporteur.jour) || null,
                      depuis: ((e.colporteur && e.colporteur.depuis) || 0) + 1 },
      }));
      return null;
    }

    const deals = propositions(
      { collection: etat.collections[boosterId] || {}, pool, bourse: etat.bourse },
      // Graine stable pour la journée et le rang du booster : rouvrir la page
      // pendant la visite ne rebat pas les prix.
      Number(jour.replaceAll("-", "")) + ouverts
    );
    if (!deals.length) return null;

    if (!force) setEtat((e) => ({ ...e, colporteur: { jour, depuis: 0 } }));
    return { jour, deals };
  }, [etat, boosterId, pool, ouverts, test]);

  /**
   * Les kobolds de Kazim paient. Le crédit passe par la même porte que la
   * revente d'un doublon, donc hors du plafond d'accumulation passive : borner
   * ce que le joueur est allé chercher lui-même n'aurait aucun sens.
   *
   * Deux choses se passent ici et pas dans le module. La conversion, parce que
   * c'est l'application qui sait ce qu'un PO vaut chez elle. Et le plafond
   * quotidien, indexé sur la date locale : sans lui, deux heures de frappe par
   * jour rapportaient cinq fois trente minutes, la mine devenant le jeu et les
   * boosters un accessoire.
   */
  const crediterMine = useCallback((poBrut) => {
    const aujourdhui = new Date().toLocaleDateString("sv");  // AAAA-MM-JJ, local
    setEtat((e) => {
      const jour = e.mine && e.mine.jour === aujourdhui ? e.mine : { jour: aujourdhui, credite: 0 };
      const reste = Math.max(0, MINE.plafondJour - jour.credite);
      const po = Math.min(Math.round(poBrut * MINE.multiplicateur), reste);
      if (po <= 0) return { ...e, mine: jour };
      return {
        ...e,
        bourse: crediterGain(e.bourse, po),
        mine: { jour: aujourdhui, credite: jour.credite + po },
      };
    });
  }, []);

  const mineJour = (() => {
    const aujourdhui = new Date().toLocaleDateString("sv");
    const m = etat.mine && etat.mine.jour === aujourdhui ? etat.mine : null;
    return { credite: m ? m.credite : 0, plafond: MINE.plafondJour };
  })();

  const majComptoir = useCallback((sauve) => {
    setEtat((e) => ({ ...e, comptoir: { ...(e.comptoir || {}), [boosterId]: sauve } }));
  }, [boosterId]);

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
