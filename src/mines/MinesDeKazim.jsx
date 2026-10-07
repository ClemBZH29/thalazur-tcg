/**
 * MINES DE KAZIM — l'interface.
 *
 * Le module est réparti en cinq fichiers :
 *   donnees.js     strates, compagnons, équipement, talents, commandes, lexique, Tafix
 *   regles.js      constantes d'économie et formules pures (testées)
 *   faveur.js      la Faveur du Fossoyeur : l'arbre, ses prix, ses effets
 *   remise.js      la remise à zéro du 07/10/2026 et son solde
 *   Personnages.jsx  Tafix, le Fossoyeur et la grotte (images, ou dessins en attendant)
 *   sauvegarde.js  la partie sauvegardée, son format et sa relecture
 *   format.js      nombres et durées à la française
 *   ce fichier     l'état vivant, les gestes et l'affichage
 *
 *   <MinesDeKazim
 *     onCommande={(po) => crediter(po)}    // une commande de Tafix livrée
 *     onRemise={(po) => solder(po)}        // la partie ancienne remise à zéro
 *     remisePayee={false}                  // le solde a déjà été versé (autre appareil)
 *     tafix={{ vus, onglets, muet }}       // tenu par l'application, pour le compte
 *     onTafix={(patch) => …}               // { vu } · { onglets } · { muet } · { oublier }
 *     storage={{ get: () => Promise<string|null>, set: (json) => Promise }}
 *     spritesBase="/kazim/"
 *     godPioche={false}                    // outil MJ : chaque frappe brise le filon
 *   />
 *
 * Le module n'écrit jamais le solde du joueur : il annonce ce qu'il doit.
 * Aucune couleur en dur : tout passe par les jetons de tokens.css.
 */

import { Fragment, useState, useRef, useEffect, useReducer, useCallback } from "react";
import { createPortal } from "react-dom";
import "../styles/kazim.css";
import {
  COMPAGNONS, EQUIPEMENT, AMELIORATIONS, RANGS, TALENTS, ONGLETS, LEXIQUE,
  SALLE_OUVRE, TAFIX, REPLIQUES_COMMANDES,
} from "./donnees.js";
import {
  FILONS_PAR_STRATE, PIOCHES, equipA, degatsClic, critChance, critMult,
  multCompagnon, dpsUn, dps, unFilonSur, mEclats,
  teinteFortune, xpRequis, brisesIci, eclatsDispo, ECLAT_BONUS, coutUn,
  coutN, nbAbordable, genererEclats, strate,
  naitreFilon, briser, simulerAbsence, rendementAbsence, absenceMax,
  majCommandes, livrer, livrable, manque, presencePour, effondrer as effondrerMine,
} from "./regles.js";
import {
  BRANCHES, FAVEUR_PAR_ID, offrir, eclatsLibres, faveurAbordable, faveurOuverte,
  faveurAOffrir, aFaveur, frappesAuto, etoileFilante,
} from "./faveur.js";
import { Tafix, Fossoyeur, Grotte } from "./Personnages.jsx";
import { fmt, fmtEnt, fmtDuree } from "./format.js";
import { etatNeuf, relireMine } from "./sauvegarde.js";
import { comparerMines } from "../lib/nuage/fusion.js";

/** Au-delà, la boucle n'a pas tourné : le navigateur avait suspendu l'onglet. */
const TROU = 3000;
const TAFIX_VIDE = { vus: [], onglets: [], muet: false };
const auHasard = (liste) => liste[Math.floor(Math.random() * liste.length)];
/** Une étoile filante toutes les trois à six minutes de présence, quinze secondes de frénésie. */
const FILANTE_ECART = [180000, 360000];
const FRENESIE = { duree: 15000, mult: 7 };

/**
 * Effets actifs par défaut ?
 *
 * L'attribut de la racine d'abord : c'est le réglage Animations de
 * l'application, qui peut passer outre la préférence du système. Le repli sur
 * `prefers-reduced-motion` garde le module autonome hors de l'application.
 */
function sobreParDefaut() {
  if (typeof document !== "undefined") {
    const m = document.documentElement.dataset.mouvement;
    if (m === "reduit") return true;
    if (m === "plein") return false;
  }
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

/* ══════════════════════════════════════════════════════════════════════
   COMPOSANT
   ══════════════════════════════════════════════════════════════════════ */

function MinesDeKazim({
  onCommande, onRemise, remisePayee = false, tafix = TAFIX_VIDE, onTafix,
  storage, spritesBase, godPioche = false,
}) {
  const S = useRef(etatNeuf());
  const [, forcer] = useReducer((n) => n + 1, 0);

  const [onglet, setOnglet] = useState("compagnons");
  /* La salle du Fossoyeur prend la place du front de taille et des onglets ;
     la mine continue de tourner derrière. */
  const [salle, setSalle] = useState(false);
  const [bulleTafix, setBulleTafix] = useState(null);
  const [replique, setReplique] = useState(() => auHasard(REPLIQUES_COMMANDES.accueil));
  const [eveille, setEveille] = useState(false);
  const [filante, setFilante] = useState(null);
  const frenesieRef = useRef(0);
  const prochaineFilante = useRef(Date.now() + FILANTE_ECART[0]);
  const tafixRef = useRef(tafix);
  tafixRef.current = tafix || TAFIX_VIDE;
  const signaler = useCallback((patch) => { if (typeof onTafix === "function") onTafix(patch); }, [onTafix]);
  const titreRemise = useRef(null);
  const titreSalle = useRef(null);
  const jourVu = useRef(0);
  const [lot, setLot] = useState(1);
  /**
   * Les effets suivent le réglage Animations de l'application, sans bascule
   * propre. Le module en portait une, en haut à droite : deux commandes pour
   * un seul réglage, dont l'une invisible depuis la page où l'on va la
   * chercher. Profil → Préférences → Animations décide, ici comme partout ailleurs.
   */
  const [effets, setEffets] = useState(() => !sobreParDefaut());
  const mouvementApp = typeof document !== "undefined"
    ? document.documentElement.dataset.mouvement : undefined;
  useEffect(() => { setEffets(!sobreParDefaut()); }, [mouvementApp]);
  const [journal, setJournal] = useState(["Le fanal est allumé. Le filon attend."]);
  const [neuf, setNeuf] = useState(null);
  const [lexique, setLexique] = useState(false);
  /* Onglets ouverts pendant cette visite et pas encore consultés : ils portent
     une pastille. Ce n'est pas sauvegardé — un onglet ouvert la semaine passée
     n'est plus une nouvelle, et rien ne justifie un champ de plus en mémoire. */
  const [aVoir, setAVoir] = useState(() => new Set());
  const ouvertsRef = useRef(null);
  /* La sauvegarde arrive de façon asynchrone : au premier rendu la partie est
     neuve, donc un seul onglet ouvert, et les quatre autres paraissaient
     « nouveaux » à chaque chargement d'une partie avancée. La détection n'est
     armée qu'une fois la lecture du magasin terminée. */
  const [charge, setCharge] = useState(false);
  /* L'infobulle des jetons. Une seconde d'attente, parce qu'un survol de
     passage en traverse six sans vouloir en lire aucun. */
  const [survol, setSurvol] = useState(null);
  const minuteurSurvol = useRef(null);

  const veinRef = useRef(null);
  const calqueRef = useRef(null);
  const xpRef = useRef(null);
  const effetsRef = useRef(effets);
  const minuteurs = useRef({});
  const compteurs = useRef({ particules: 0, derniereRupture: 0, derniereForme: 0, chute: false });
  const formeRef = useRef(genererEclats());

  effetsRef.current = effets;

  const src = useCallback(
    (nom) => spritesBase + nom + ".webp",
    [spritesBase]
  );

  const noter = useCallback((txt) => setJournal((j) => [txt, ...j].slice(0, 5)), []);

  /* ---------- effets ---------- */

  const point = useCallback((ev) => {
    const el = veinRef.current;
    if (!el) return { x: 0, y: 0, l: 0, h: 0 };
    const r = el.getBoundingClientRect();
    if (ev && typeof ev.clientX === "number" && ev.clientX) {
      return { x: ev.clientX - r.left, y: ev.clientY - r.top, l: r.width, h: r.height };
    }
    return { x: r.width / 2, y: r.height * 0.52, l: r.width, h: r.height };
  }, []);

  const rejouer = useCallback((classe, duree) => {
    const el = veinRef.current;
    if (!el || !effetsRef.current) return;
    el.classList.remove(classe);
    void el.offsetWidth;                       // force le navigateur à rejouer l'animation
    el.classList.add(classe);
    clearTimeout(minuteurs.current[classe]);
    minuteurs.current[classe] = setTimeout(() => el.classList.remove(classe), duree);
  }, []);

  const ephemere = useCallback((el, vie) => {
    calqueRef.current.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, vie);
  }, []);

  const particules = useCallback((x, y, n, o = {}) => {
    if (!effetsRef.current || !calqueRef.current) return;
    n = Math.min(n, Math.max(0, 110 - compteurs.current.particules));
    for (let i = 0; i < n; i++) {
      const angle = o.chute ? Math.PI / 2 + (Math.random() - 0.5) * 0.9 : Math.random() * Math.PI * 2;
      const portee = (o.portee || 64) * (0.4 + Math.random() * 0.8);
      const vie = (o.vie || 540) + Math.round(Math.random() * 260);
      const taille = 3 + Math.random() * (o.taille || 5);
      const p = document.createElement("span");
      p.className = "kz-part" + (o.classe ? " " + o.classe : "");
      p.style.left = x + "px";
      p.style.top = y + "px";
      p.style.width = p.style.height = taille.toFixed(1) + "px";
      p.style.setProperty("--kz-dx", Math.round(Math.cos(angle) * portee) + "px");
      p.style.setProperty("--kz-dy", Math.round(Math.sin(angle) * portee + (o.gravite || 22)) + "px");
      p.style.setProperty("--kz-rot", Math.round((Math.random() * 2 - 1) * 260) + "deg");
      p.style.setProperty("--kz-vie", vie + "ms");
      compteurs.current.particules++;
      calqueRef.current.appendChild(p);
      setTimeout(() => {
        if (p.parentNode) p.parentNode.removeChild(p);
        compteurs.current.particules--;
      }, vie + 120);
    }
  }, []);

  const onde = useCallback((x, y, chaude, taille) => {
    if (!effetsRef.current || !calqueRef.current) return;
    const o = document.createElement("div");
    o.className = "kz-onde" + (chaude ? " kz-chaude" : "");
    o.style.left = x + "px";
    o.style.top = y + "px";
    if (taille) o.style.width = o.style.height = taille + "px";
    ephemere(o, 700);
  }, [ephemere]);

  const bulle = useCallback((p, d, crit) => {
    if (!effetsRef.current || !calqueRef.current) return;
    const e = document.createElement("div");
    e.className = "kz-pop" + (crit ? " kz-crit" : "");
    e.textContent = (crit ? "\u2726 " : "") + fmt(d);
    e.style.left = p.x + "px";
    e.style.top = p.y + "px";
    ephemere(e, 1020);
  }, [ephemere]);

  const swing = useCallback((p, crit) => {
    if (!effetsRef.current || !calqueRef.current) return;
    // La God-Pioche est la pioche de fer, dorée : on la reconnaît au premier coup.
    const id = godPioche ? "p1" : PIOCHES.find((i) => equipA(S.current, i)) || "p1";
    const piece = EQUIPEMENT.find((e) => e.id === id);
    const url = src(piece.sprite);
    if (!url) return;
    const img = document.createElement("img");
    img.className = "kz-swing" + (crit ? " kz-crit" : "") + (godPioche ? " kz-god" : "");
    img.alt = "";
    img.src = url;
    img.style.left = p.x + "px";
    img.style.top = p.y + "px";
    ephemere(img, crit ? 440 : 320);
  }, [ephemere, src, godPioche]);

  const pulseNiveau = useCallback(() => {
    const el = xpRef.current;
    if (!el || !effetsRef.current) return;
    el.classList.remove("kz-pulse");
    void el.offsetWidth;
    el.classList.add("kz-pulse");
    clearTimeout(minuteurs.current.pulse);
    minuteurs.current.pulse = setTimeout(() => el.classList.remove("kz-pulse"), 660);
  }, []);

  const rupture = useCallback(() => {
    if (!effetsRef.current || compteurs.current.chute) return;
    const t = Date.now();
    if (t - compteurs.current.derniereRupture < 130) return;  // à haut débit, on ne rejoue pas chaque filon
    compteurs.current.derniereRupture = t;
    const c = point(null);
    rejouer("kz-brise", 90);
    rejouer("kz-rupture", 450);
    onde(c.x, c.y, false, 40);
    particules(c.x, c.y, 16, { portee: 130, taille: 7, vie: 640 });
  }, [point, rejouer, onde, particules]);

  /* ---------- moteur ---------- */

  const nouveauFilon = useCallback(() => {
    /* Le sort du filon se joue à sa naissance (voir `naitreFilon`) : le bloc
       prend sa couleur en conséquence, on voit le filon riche avant de le
       casser. */
    naitreFilon(S.current);
    /* Même bride que la rupture : à trois cents filons par seconde, la roche ne
       doit pas se recomposer à chaque image. */
    const t = Date.now();
    if (t - compteurs.current.derniereForme > 130) {
      compteurs.current.derniereForme = t;
      formeRef.current = genererEclats();
    }
  }, []);

  const briserFilon = useCallback(() => {
    const r = briser(S.current);
    for (let i = 0; i < r.niveaux; i++) {
      noter("Niveau " + (S.current.niveau - r.niveaux + i + 1) + " atteint. Un point de talent à placer.");
    }
    if (r.niveaux) pulseNiveau();
    if (r.rang === 2) noter("Filon exceptionnel : douze fois plus d'étoile. Vous sortez " + fmt(r.recolte) + " d'étoile.");
    else if (r.rang === 1) noter("Filon généreux : quatre fois plus d'étoile. Vous sortez " + fmt(r.recolte) + " d'étoile.");
    /* La strate épuisée, on descend tout seul : rester en haut n'a aucun intérêt
       mécanique, et la descente manuelle n'était qu'un clic de péage. */
    if (r.descente) noter("La strate cède. Vous descendez dans " + strate(S.current.profondeur).nom + ".");
    // `briser` a déjà fait naître le suivant ; il reste à lui donner sa forme.
    const t = Date.now();
    if (t - compteurs.current.derniereForme > 130) {
      compteurs.current.derniereForme = t;
      formeRef.current = genererEclats();
    }
    rupture();
  }, [noter, pulseNiveau, rupture]);

  const appliquerDegats = useCallback((d) => {
    const s = S.current;
    let securite = 0;
    while (d > 0 && securite < 500) {
      if (d >= s.pv) { d -= s.pv; s.pv = 0; briserFilon(); }
      else { s.pv -= d; d = 0; }
      securite++;
    }
  }, [briserFilon]);

  const frapper = useCallback((ev) => {
    if (compteurs.current.chute) return;
    const s = S.current;
    const crit = Math.random() * 100 < critChance(s);
    // God-Pioche : exactement ce qui reste au filon, pour qu'il se brise sans
    // que le surplus ne file dans les suivants.
    const frenesie = frenesieRef.current > Date.now() ? FRENESIE.mult : 1;
    const d = godPioche ? Math.max(1, s.pv) : degatsClic(s) * (crit ? critMult(s) : 1) * frenesie;
    appliquerDegats(d);
    if (effetsRef.current) {
      const p = point(ev);
      swing(p, crit);
      bulle(p, d, crit);
      onde(p.x, p.y, crit, crit ? 30 : 20);
      particules(p.x, p.y, crit ? 22 : 9, {
        portee: crit ? 120 : 68, taille: crit ? 7 : 5, classe: crit ? "kz-chaude" : "",
      });
      rejouer(crit ? "kz-secousse-fort" : "kz-secousse", crit ? 410 : 210);
      const el = veinRef.current;
      el.classList.add("kz-hit");
      clearTimeout(minuteurs.current.hit);
      minuteurs.current.hit = setTimeout(() => el.classList.remove("kz-hit"), 100);
    }
    forcer();
  }, [appliquerDegats, point, swing, bulle, onde, particules, rejouer, godPioche]);

  /* ---------- boucle ---------- */

  /**
   * Rejoue un laps de temps où la boucle n'a pas tourné, et le raconte. Sert
   * au retour d'une absence (page quittée, rendement réduit) comme au retour
   * d'un onglet resté en arrière-plan (plein rendement : la page était
   * ouverte, seul le navigateur avait suspendu l'animation).
   */
  const rattraper = useCallback((ms, rendement, pourquoi) => {
    const b = simulerAbsence(S.current, ms, rendement);
    if (pourquoi && (b.filons > 0 || b.etoile > 0)) {
      const morceaux = [];
      if (b.filons > 0) morceaux.push(b.filons + " filon" + (b.filons > 1 ? "s" : "") + " brisé" + (b.filons > 1 ? "s" : ""));
      if (b.strates > 0) morceaux.push("descente de " + b.strates + " strate" + (b.strates > 1 ? "s" : ""));
      if (b.niveaux > 0) morceaux.push("+" + b.niveaux + " niveau" + (b.niveaux > 1 ? "x" : ""));
      noter(pourquoi + " " + fmtDuree(Math.min(ms, absenceMax(S.current))) + " : "
        + (morceaux.length ? morceaux.join(", ") + ", " : "")
        + fmt(b.etoile) + " d'étoile" + (rendement < 1 ? ", à rendement réduit." : "."));
      if (b.niveaux) pulseNiveau();
      formeRef.current = genererEclats();
    }
    return b;
  }, [noter, pulseNiveau]);

  const tick = useCallback(() => {
    const s = S.current;
    const t = Date.now();
    const ecart = Math.max(0, t - s.dernierTick);
    s.dernierTick = t;
    if (ecart > TROU) {
      rattraper(ecart, 1, ecart > 60000 ? "Onglet en arrière-plan pendant" : null);
    } else {
      /* L'équipe, et la Pioche enchantée qui frappe seule (sans critique). */
      const auto = frappesAuto(s) * degatsClic(s) * (frenesieRef.current > t ? FRENESIE.mult : 1);
      const p = dps(s) + auto;
      if (p > 0) appliquerDegats(p * (ecart / 1000));
      // Le temps de mine, page ouverte et visible : la grosse commande le lit.
      if (!document.hidden) s.presence = (s.presence || 0) + ecart / 1000;
    }
    /* Le jour change pendant qu'on joue : de nouvelles commandes. Vérifié
       toutes les dix secondes, pas à chaque image. */
    if (t - jourVu.current > 10000) {
      jourVu.current = t;
      if (majCommandes(s)) setReplique(auHasard(REPLIQUES_COMMANDES.accueil));
    }
    /* L'étoile filante, si le Fossoyeur l'a accordée. Seulement page ouverte
       et salle fermée : elle traverse le filon. */
    if (etoileFilante(s) && t > prochaineFilante.current && !document.hidden) {
      prochaineFilante.current = t + FILANTE_ECART[0] + Math.random() * (FILANTE_ECART[1] - FILANTE_ECART[0]);
      setFilante({ id: t, haut: 12 + Math.random() * 40 });
    }
  }, [appliquerDegats, rattraper]);

  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    let brut = null, dernier = 0;
    const pas = () => {
      tickRef.current();
      const t = Date.now();
      if (t - dernier > 110) { dernier = t; forcer(); }
      brut = requestAnimationFrame(pas);
    };
    brut = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(brut);
  }, []);

  /* ---------- persistance ---------- */

  /* Rien ne s'écrit tant que la sauvegarde n'a pas été relue. Sans ce garde,
     un démontage survenu avant la fin de la lecture — quitter la page tout de
     suite, ou le double montage de React en développement — enregistrait la
     mine neuve du montage par-dessus la vraie partie. */
  const relue = useRef(false);

  /* `dernierTick` n'est touché que par la boucle : c'est l'instant jusqu'où
     le temps a été joué. La sauvegarde le posait à « maintenant », ce qui
     effaçait tout le temps passé onglet caché — le navigateur suspend alors
     l'animation, mais pas la sauvegarde périodique. Le temps non joué reste
     donc en attente dans la sauvegarde, et se rattrape au retour. */
  /* Un onglet caché ne sauve plus rien de lui-même : sa partie est figée, et
     ses sauvegardes périodiques écrasaient celle de l'onglet où l'on jouait —
     des achats qui disparaissaient. Il sauve une fois en se cachant (`force`),
     et reprend au retour la partie la plus avancée (voir `reprendre`). */
  const sauver = useCallback((force = false) => {
    if (!relue.current) return;
    if (!force && document.hidden) return;
    try { storage.set(JSON.stringify(S.current)); } catch { /* la partie continue */ }
  }, [storage]);

  useEffect(() => {
    let vivant = true;
    Promise.resolve()
      .then(() => storage.get())
      .then((brut) => {
      if (!vivant) return;
      const d = relireMine(brut);
      if (d) {
        const avant = d.dernierTick;
        S.current = d;
        const t = Date.now();
        const absence = Math.max(0, t - (typeof avant === "number" ? avant : t));
        S.current.dernierTick = t;
        // L'équipe a continué sans vous : mêmes règles qu'en direct, filons
        // brisés et strates descendues compris, au rendement d'absence.
        // Une absence de quelques secondes se rejoue aussi, sans message.
        if (absence > 3000) {
          if (!S.current.pvMax) nouveauFilon();
          rattraper(absence, rendementAbsence(S.current), absence > 60000 ? "Absence de" : null);
        }
      }
      if (!S.current.pvMax) nouveauFilon();
      majCommandes(S.current);
      relue.current = true;
      setCharge(true);
      forcer();
    })
      /* Une sauvegarde illisible ou un magasin capricieux ne doit jamais faire
         tomber l'arbre React : on repart d'une mine neuve. */
      .catch((err) => {
        console.warn("[Kazim] chargement ignoré", err);
        if (!S.current.pvMax) nouveauFilon();
        relue.current = true;
        setCharge(true);
        forcer();
      });
    const horloge = setInterval(() => sauver(), 5000);
    /* Au retour, une autre fenêtre a pu jouer entre-temps : sa partie, plus
       avancée, remplace celle qu'on avait laissée. */
    const reprendre = () => {
      if (!relue.current || !storage.voir) return;
      const d = relireMine(storage.voir());
      if (!d || comparerMines(d, S.current) <= 0) return;
      S.current = d;
      if (!S.current.pvMax) nouveauFilon();
      formeRef.current = genererEclats();
      forcer();
    };
    const surVisibilite = () => { if (document.hidden) sauver(true); else reprendre(); };
    document.addEventListener("visibilitychange", surVisibilite);
    return () => {
      vivant = false;
      clearInterval(horloge);
      document.removeEventListener("visibilitychange", surVisibilite);
      Object.keys(minuteurs.current).forEach((k) => clearTimeout(minuteurs.current[k]));
      sauver(true);
      // Le prochain montage relira la sauvegarde avant d'avoir le droit d'écrire.
      relue.current = false;
    };
  }, [storage, sauver, rattraper, nouveauFilon]);

  /* ---------- actions ---------- */

  const lotDe = (c) => (lot === "max" ? Math.max(1, nbAbordable(S.current, c)) : lot);

  const embaucher = (c) => {
    const s = S.current;
    const n = lotDe(c);
    let pris = 0;
    for (let i = 0; i < n; i++) {
      const cout = coutUn(s, c);
      if (s.etoile < cout) break;
      s.etoile -= cout;
      s.compagnons[c.id] = (s.compagnons[c.id] || 0) + 1;
      pris++;
    }
    if (pris) {
      setNeuf(c.id);
      setTimeout(() => setNeuf(null), 640);
    }
    forcer();
  };

  const installer = (e) => {
    const s = S.current;
    if (s.etoile < e.cout || equipA(s, e.id)) return;
    s.etoile -= e.cout;
    s.equipement.push(e.id);
    /* Une amélioration n'a plus de jeton à elle : c'est celui du compagnon
       qu'elle sert qui salue l'achat. */
    setNeuf(e.compagnon || e.id);
    setTimeout(() => setNeuf(null), 640);
    noter(e.nom + " : installé.");
    forcer();
  };

  const placerTalent = (id) => {
    const s = S.current;
    if (s.points <= 0) return;
    s.points--;
    s.talents[id]++;
    forcer();
  };

  /* Une commande livrée : l'étoile part, les PO sont annoncés à
     l'application, qui crédite la bourse (src/jeu/mine.js). */
  const livrerCommande = (id) => {
    const s = S.current;
    const po = livrer(s, id);
    if (!po) return;
    noter("Commande livrée. La tribu de Tafix vous verse " + fmtEnt(po) + " PO.");
    setReplique(auHasard(s.commandes.liste.every((c) => c.livree)
      ? REPLIQUES_COMMANDES.fini : REPLIQUES_COMMANDES.livree));
    if (typeof onCommande === "function") {
      try { onCommande(po); } catch (err) { console.error("[Kazim] onCommande", err); }
    }
    sauver();
    forcer();
  };

  /* Le Fossoyeur fait sauter les étais. L'animation de la roche ne se voit
     pas depuis la salle : c'est lui qui s'éveille. */
  const effondrer = () => {
    const r = effondrerMine(S.current, etatNeuf);
    if (!r) return;
    S.current = r.mine;
    nouveauFilon();
    noter("Effondrement. Vous récupérez " + fmtEnt(r.gain) + " éclat" + (r.gain > 1 ? "s" : "") + " de Kazim dans les gravats.");
    reveiller();
    sauver();
    forcer();
  };

  const reveiller = () => {
    setEveille(true);
    clearTimeout(minuteurs.current.eveil);
    minuteurs.current.eveil = setTimeout(() => setEveille(false), 2600);
  };

  const offrirFaveur = (id) => {
    if (!offrir(S.current, id)) return;
    noter("Le Fossoyeur accepte votre offrande : " + FAVEUR_PAR_ID[id].nom + ".");
    reveiller();
    sauver();
    forcer();
  };

  const attraperFilante = () => {
    frenesieRef.current = Date.now() + FRENESIE.duree;
    setFilante(null);
    noter("Étoile filante attrapée : frappes multipliées par sept pendant quinze secondes.");
    forcer();
  };

  /* La partie ancienne a été remise à zéro à la lecture : le joueur a lu
     l'écran, on verse le solde (une fois par compte, voir src/jeu/mine.js)
     et Tafix ne lui présente plus que les nouveautés. */
  const rouvrir = () => {
    const s = S.current;
    const r = s.remise;
    s.remise = null;
    if (r && typeof onRemise === "function") {
      try { onRemise(r.total); } catch (err) { console.error("[Kazim] onRemise", err); }
    }
    signaler({ onglets: ["compagnons", "commandes", "equipement", "talents", "fossoyeur"] });
    ["arrivee", "filon1", "compagnon", "chantier", "talents", "riche", "fossoyeur"]
      .forEach((vu) => signaler({ vu }));
    setOnglet("commandes");
    sauver(true);
    forcer();
  };

  const descendre = () => {
    const s = S.current;
    if (s.profondeur >= s.profondeurMax) return;   // la strate suivante s'ouvre d'elle-même
    s.profondeur++;
    s.profondeurMax = Math.max(s.profondeurMax, s.profondeur);
    nouveauFilon();
    noter("Vous descendez dans " + strate(s.profondeur).nom + ".");
    forcer();
  };

  const remonter = () => {
    const s = S.current;
    if (s.profondeur <= 1) return;
    s.profondeur--;
    nouveauFilon();
    forcer();
  };

  /* ---------- vues ---------- */

  const s = S.current;

  /* Les onglets ouverts. Un onglet ouvert l'est pour le compte, pas pour la
     mine (retour de maquette, 07/10/2026) : ils se lisaient sur l'état de la
     mine, et un effondrement refermait Commandes, Chantier et Talents au
     moment même où la salle du Fossoyeur s'ouvrait. Le prédicat de `ONGLETS`
     ne sert plus qu'à la première ouverture ; la liste vit dans l'état du
     jeu (`tafix.onglets`). La clé est une chaîne : la liste se recalcule
     neuf fois par seconde, comparer deux tableaux serait du travail pour
     rien. */
  const connus = (tafix || TAFIX_VIDE).onglets || [];
  const ongletsOuverts = ONGLETS.filter(([id, , ouvert]) => connus.includes(id) || ouvert(s));
  const cleOuverts = ongletsOuverts.map(([id]) => id).join(",");
  const salleConnue = connus.includes("fossoyeur") || SALLE_OUVRE(s);
  useEffect(() => {
    if (!charge || s.remise) return;
    const ids = cleOuverts ? cleOuverts.split(",") : [];
    const aRetenir = ids.filter((id) => !connus.includes(id));
    if (salleConnue && !connus.includes("fossoyeur")) aRetenir.push("fossoyeur");
    if (aRetenir.length) signaler({ onglets: aRetenir });
    if (ouvertsRef.current === null) { ouvertsRef.current = new Set(ids); return; }
    const nouveaux = ids.filter((id) => !ouvertsRef.current.has(id));
    if (!nouveaux.length) return;
    nouveaux.forEach((id) => ouvertsRef.current.add(id));
    setAVoir((v) => {
      const n = new Set(v);
      nouveaux.forEach((id) => n.add(id));
      return n;
    });
    const o = ONGLETS.find((x) => x[0] === nouveaux[0]);
    if (o) noter("Nouveau : " + o[1] + ". " + o[3]);
  // `connus` se relit à chaque rendu ; la clé suffit à décider.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleOuverts, salleConnue, noter, charge, signaler]);

  useEffect(() => {
    if (!cleOuverts.split(",").includes(onglet)) setOnglet("compagnons");
  }, [cleOuverts, onglet]);

  /* Les conseils de Tafix : une bulle par étape, une seule fois par compte,
     jamais pendant l'écran de remise à zéro. Une seconde et demie après
     l'évènement, pour ne pas couper un geste en cours. */
  const vus = (tafix || TAFIX_VIDE).vus || [];
  const muet = !!(tafix || TAFIX_VIDE).muet;
  const prochainConseil = !charge || muet || bulleTafix || s.remise ? null
    : TAFIX.find((c) => !vus.includes(c.id) && c.quand(s));
  const idConseil = prochainConseil ? prochainConseil.id : null;
  useEffect(() => {
    if (!idConseil) return undefined;
    const t = setTimeout(() => {
      const c = TAFIX.find((x) => x.id === idConseil);
      setBulleTafix(c);
      signaler({ vu: c.id });
      if (c.onglet) setAVoir((v) => new Set(v).add(c.onglet));
      noter("Tafix : " + c.dit);
    }, 1500);
    return () => clearTimeout(t);
  }, [idConseil, signaler, noter]);
  useEffect(() => {
    if (!bulleTafix) return undefined;
    const surTouche = (e) => { if (e.key === "Escape") setBulleTafix(null); };
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [bulleTafix]);
  /* Le focus suit ce qui s'ouvre : le titre de l'écran de remise à zéro, le
     titre de la salle ; et revient au bouton du Fossoyeur quand elle se ferme. */
  const remiseOuverte = !!s.remise && charge;
  useEffect(() => { if (remiseOuverte && titreRemise.current) titreRemise.current.focus(); }, [remiseOuverte]);
  const boutonFossoyeur = useRef(null);
  const salleAvant = useRef(false);
  useEffect(() => {
    if (salle && titreSalle.current) titreSalle.current.focus();
    else if (!salle && salleAvant.current && boutonFossoyeur.current) boutonFossoyeur.current.focus();
    salleAvant.current = salle;
  }, [salle]);
  useEffect(() => {
    if (!salle) return undefined;
    const surTouche = (e) => { if (e.key === "Escape" && !bulleTafix) setSalle(false); };
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [salle, bulleTafix]);

  const motsConnus = LEXIQUE.filter((m) => m.des(s));

  const st = strate(s.profondeur);
  const ratio = s.pvMax > 0 ? Math.max(0, s.pv / s.pvMax) : 0;
  const gainEclats = eclatsDispo(s);
  const equipePosee = COMPAGNONS.filter((c) => s.compagnons[c.id]);
  const chantierPose = EQUIPEMENT.filter((e) => equipA(s, e.id));

  /* Ce qui s'installe maintenant : matériel atteint et non posé, améliorations
     dont le seuil est franchi. Trié par prix — c'est l'ordre dans lequel on
     les prendra, et il mélange volontiers le matériel et les équipes. */
  const chantierDispo = [
    ...EQUIPEMENT.filter((e) => s.profondeurMax >= e.req + 1 && !equipA(s, e.id)),
    ...AMELIORATIONS.filter((a) => (s.compagnons[a.compagnon] || 0) >= a.seuil && !equipA(s, a.id)),
  ].sort((x, y) => x.cout - y.cout);

  /* Et la prochaine amélioration de chaque compagnon, dès la moitié du seuil. */
  const verrouilles = COMPAGNONS.map((c) => {
    const possede = s.compagnons[c.id] || 0;
    const a = AMELIORATIONS.find((x) => x.compagnon === c.id && !equipA(s, x.id) && possede < x.seuil);
    return a && possede >= a.seuil / 2 ? { a, possede } : null;
  }).filter(Boolean).sort((x, y) => x.a.cout - y.a.cout);

  /* Ce que dit la bulle, selon la nature du jeton survolé. */
  const bulleSurvol = (() => {
    if (!survol) return null;
    const c = COMPAGNONS.find((x) => x.id === survol.cle);
    if (c) {
      const m = multCompagnon(s, c.id);
      /* Le rang atteint se lit dans la bulle plutôt qu'en jetons : quatre
         rangs par compagnon, c'était jusqu'à vingt-quatre vignettes presque
         identiques qui chassaient le chantier hors de la bande. On affiche le
         plus haut rang tenu : rien n'oblige à prendre le II avant le I quand
         les deux seuils sont franchis, donc le compte n'y suffirait pas. */
      const rang = AMELIORATIONS.reduce((r, a, i) => (a.compagnon === c.id
        && equipA(s, a.id) ? Math.max(r, (i % RANGS.length) + 1) : r), 0);
      return { gauche: survol.gauche,
        titre: c.nom + " ×" + (s.compagnons[c.id] || 0)
          + (rang > 0 ? " · Niv. " + RANGS[rang - 1] : ""),
        texte: c.desc + " " + fmt(dpsUn(s, c)) + " étoile par seconde chacun"
          + (m > 1 ? ", améliorations comprises (×" + m + ")." : ".") };
    }
    const e = EQUIPEMENT.find((x) => x.id === survol.cle);
    if (e) return { gauche: survol.gauche, titre: e.nom, texte: e.desc };
    return null;
  })();

  /* ── Le jeton et son infobulle ──────────────────────────────────────────
     L'attribut `title` faisait déjà le travail, mal : une à deux secondes
     d'attente selon le navigateur, un cadre système qui ignore la charte, et
     rien d'autre que le nom. La bulle dit ce que fait l'objet — c'est cette
     phrase-là qui a quitté la liste du chantier en même temps que les lignes
     « installé ». Une seconde d'attente à la souris, immédiat au clavier :
     qui tabule jusqu'à un jeton l'a fait exprès. */
  const montrer = (cle, el) => {
    const haut = el.closest(".kz-top");
    if (!haut) return;
    const r = el.getBoundingClientRect(), h = haut.getBoundingClientRect();
    setSurvol({ cle, gauche: Math.max(0, Math.min(r.left - h.left, h.width - 260)) });
  };
  /* Une fonction, pas un composant. Un composant défini dans le corps du
     rendu change d'identité à chaque image — et le rendu tourne neuf fois par
     seconde avec la boucle de jeu. React démonterait puis remonterait chaque
     jeton à chaque tour : le focus sauterait, le survol se perdrait avant
     d'avoir atteint sa seconde, et l'image se rechargerait. Une fonction qui
     renvoie du JSX produit des `span`, un type stable, donc réconciliés. */
  const jeton = (cle, sprite, nom, nb) => (
    <span className={"kz-jeton" + (neuf === cle ? " kz-neuf" : "")} key={cle}
          tabIndex={0} aria-label={nom + (nb ? ", " + nb + " employés" : "")}
          onPointerEnter={(e) => {
            const el = e.currentTarget;
            clearTimeout(minuteurSurvol.current);
            minuteurSurvol.current = setTimeout(() => montrer(cle, el), 1000);
          }}
          onPointerLeave={() => { clearTimeout(minuteurSurvol.current); setSurvol(null); }}
          onFocus={(e) => montrer(cle, e.currentTarget)}
          onBlur={() => setSurvol(null)}>
      <img src={src(sprite)} alt="" loading="lazy" />
      {nb ? <b>{nb}</b> : null}
    </span>
  );

  /* Même raison : `Vignette` était un composant local, et les soixante-deux
     pixels de sprite de chaque ligne repartaient en chargement à chaque
     image. */
  const vignette = (nom, eteinte) => (
    <span className={"kz-vignette" + (eteinte ? " kz-eteinte" : "")}>
      <img src={src(nom)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.opacity = 0; }} />
    </span>
  );

  const corps = {
    compagnons: (
      <>
        <p className="kz-note">Leur production s'ajoute à vos dégâts de pioche.</p>
        <div className="kz-lots">
          {[[1, "\u00d71"], [10, "\u00d710"], ["max", "Maximum"]].map(([v, libelle]) => (
            <button key={String(v)} type="button" className="kz-btn kz-mini"
                    aria-pressed={lot === v} onClick={() => setLot(v)}>{libelle}</button>
          ))}
        </div>
        {COMPAGNONS.map((c, i) => {
          const possede = s.compagnons[c.id] || 0;
          const precedent = i === 0 || (s.compagnons[COMPAGNONS[i - 1].id] || 0) > 0;
          if (!possede && !precedent && coutUn(s, c) > s.etoileTotale * 0.5) return null;
          const n = lotDe(c);
          const cout = coutN(s, c, n);
          return (
            <div className="kz-row" key={c.id}>
              {vignette(c.sprite, !possede)}
              <div className="kz-grow">
                <h3>{c.nom}{possede > 0 && <span className="kz-tenu">{"\u00d7" + possede}</span>}</h3>
                <p>
                  <span>{c.desc}</span>
                  <span className="kz-sep" />
                  <span>{fmt(dpsUn(s, c)) + " étoile par seconde"}</span>
                  {multCompagnon(s, c.id) > 1 && (
                    <>
                      <span className="kz-sep" />
                      <span className="kz-tenu">{"×" + multCompagnon(s, c.id)}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="kz-actions">
                <button type="button" className="kz-btn" disabled={s.etoile < cout} onClick={() => embaucher(c)}>
                  {n > 1 ? "Embaucher \u00d7" + n : "Embaucher"}
                </button>
                <span className="kz-cout">{fmt(cout) + " étoile"}</span>
              </div>
            </div>
          );
        })}
      </>
    ),

    equipement: (
      <>
        <p className="kz-note">
          Achats définitifs. Un effondrement remet le chantier à zéro.
          {chantierDispo.length === 0 && verrouilles.length === 0
            && " Rien à installer pour l'instant : descendez, ou étoffez une équipe."}
        </p>
        {chantierDispo.map((e) => (
          <div className="kz-row" key={e.id}>
            {vignette(e.sprite, true)}
            <div className="kz-grow">
              <h3>{e.nom}</h3>
              <p>{e.desc}</p>
            </div>
            <div className="kz-actions">
              <button type="button" className="kz-btn" disabled={s.etoile < e.cout}
                      onClick={() => installer(e)}>Installer</button>
              <span className="kz-cout">{fmt(e.cout) + " étoile"}</span>
            </div>
          </div>
        ))}

        {/* Ce qui est déjà posé a quitté la liste : il n'y avait plus rien à
            décider dessus, et douze lignes « installé » repoussaient hors de
            l'écran les deux seules qui demandaient un choix. On les retrouve
            sur leur jeton, en haut de la mine, au survol.

            Restent les améliorations à portée : elles ne s'achètent pas encore,
            mais sans elles personne ne découvrirait qu'une équipe de dix
            porte-fanaux vaut d'être poussée à vingt-cinq. Elles n'apparaissent
            qu'à mi-chemin du seuil, c'est-à-dire au moment où viser devient
            une décision. */}
        {verrouilles.length > 0 && (
          <>
            <p className="kz-note kz-titre-liste">À portée</p>
            {verrouilles.map(({ a, possede }) => (
              <div className="kz-row kz-verrouille" key={a.id}>
                {vignette(a.sprite, true)}
                <div className="kz-grow">
                  <h3>{a.nom}</h3>
                  <p>{"Production doublée. Vous en avez " + possede + " sur " + a.seuil + "."}</p>
                </div>
                <div className="kz-actions">
                  <span className="kz-cout">{fmt(a.cout) + " étoile"}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </>
    ),

    talents: (
      <>
        <p className="kz-note">
          {s.points
            ? "Vous avez " + s.points + " point" + (s.points > 1 ? "s" : "") + " à placer."
            : "Brisez des filons pour gagner de l'expérience. Un point de talent par niveau."}
        </p>
        {TALENTS.map((t) => (
          <div className="kz-row" key={t.id}>
            <div className="kz-grow">
              <h3>{t.nom}</h3>
              <p>{t.desc}</p>
            </div>
            <div className="kz-actions kz-talent">
              <span className="kz-pastille">{s.talents[t.id]}</span>
              <button type="button" className="kz-btn" disabled={s.points <= 0}
                      aria-label={"Placer un point dans " + t.nom} onClick={() => placerTalent(t.id)}>+</button>
            </div>
          </div>
        ))}
        <p className="kz-note">
          {"Coup critique : " + critChance(s).toFixed(0) + " % de chance, dégâts multipliés par "
            + String(critMult(s)).replace(".", ",") + ". "}
          {"Filon qui rend plus : un sur " + unFilonSur(s) + ", reconnaissable à sa couleur."}
        </p>
      </>
    ),

    commandes: (
      <>
        <div className="kz-tafix-tete">
          <Tafix expr={replique[0]} base={spritesBase} />
          <p className="kz-dit">{replique[1]}<small>Tafix</small></p>
        </div>
        {(s.commandes ? s.commandes.liste : []).map((c) => {
          const reste = manque(s, c);
          const pret = livrable(s, c);
          const tps = c.presence ? Math.min(1, presencePour(s, c) / c.presence) : 1;
          const ratioC = c.livree ? 1 : Math.max(0, Math.min(1 - reste / c.demande, tps));
          return (
            <div key={c.id} className={"kz-commande" + (c.livree ? " kz-livree" : pret ? " kz-prete" : "")}>
              <div className="kz-commande-tete">
                <h3>{c.taille === "petite" ? "Petite commande" : c.taille === "moyenne" ? "Commande moyenne" : "Grosse commande"}</h3>
                <span className="kz-paie kz-n">{c.po + " PO"}</span>
              </div>
              <div className="kz-commande-barre" role="progressbar" aria-label={"Avancement de la commande"}
                   aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratioC * 100)}>
                <i style={{ width: (ratioC * 100).toFixed(1) + "%" }} />
              </div>
              <div className="kz-commande-pied">
                <span className="kz-n">
                  {c.livree ? "Livrée"
                    : fmt(Math.min(s.etoile, c.demande)) + " / " + fmt(c.demande) + " étoile"
                      + (c.presence ? " · " + Math.min(c.presence, Math.floor(presencePour(s, c))) + " / " + c.presence + " min de mine" : "")}
                </span>
                {!c.livree && (
                  <button type="button" className={"kz-btn kz-mini" + (pret ? " kz-or-bouton" : "")}
                          disabled={!pret} onClick={() => livrerCommande(c.id)}>Livrer</button>
                )}
              </div>
              {c.presence > 0 && !c.livree && (
                <p className="kz-note kz-fraiche">
                  {"Étoile fraîche : la tribu attend " + c.presence + " minutes de mine, page ouverte. L'étoile de la nuit ne compte pas."}
                </p>
              )}
            </div>
          );
        })}
        <p className="kz-note">Tafix rapporte de nouvelles commandes chaque jour à minuit.</p>
      </>
    ),
  };

  return (
    <div className={"kz" + (effets ? "" : " kz-sobre")}
         style={{ "--kz-teinte": teinteFortune(s) }}>
      <div className="kz-wrap">

      <div className="kz-top">
        <div className="kz-titre">
          {/* Titre de section et non de page : la page qui accueille le module
              porte son propre h1, et deux h1 cassent le plan du document. */}
          <h2>Mines de Kazim<span>On creuse. Les kobolds comptent.</span></h2>
        </div>
        {/* Le journal a fini de rétrécir : cinq lignes en bas de page, puis
            une ligne dans l'en-tête, et maintenant plus rien à l'écran. Ce
            qu'il annonçait se lit ailleurs — les points de talent sur leur
            onglet, l'étoile et l'or sur leurs plaques. La région reste, muette
            et hors flux, parce qu'un lecteur d'écran n'a pas ces plaques sous
            les yeux : sans elle, gagner un niveau ne s'annoncerait plus. */}
        <p className="kz-annonce" role="status" aria-live="polite">{journal[0]}</p>
        <div className="kz-bourse">
          <div className="kz-plaque">
            <b className="kz-etoile kz-n">{fmt(s.etoile)}</b>
            <small>étoile en réserve</small>
          </div>
          {/* La plaque « PO kobold » est partie avec la vente aux kobolds : les
              commandes paient en PO du site, que le bandeau affiche déjà. */}
          {salleConnue && (
            <div className="kz-plaque">
              <b className="kz-eclats-n kz-n">{fmtEnt(s.eclats)}</b>
              <small>éclats de Kazim</small>
            </div>
          )}
        </div>
        {/* La salle du Fossoyeur : l'effondrement et la Faveur, ensemble. Un
            bouton plutôt qu'un onglet — six onglets à la suite, c'était trop.
            Sa ligne dit ce qu'il y a à faire, le point ambre qu'il y a quelque
            chose à faire. */}
        {salleConnue && (
          <button type="button" ref={boutonFossoyeur} className={"kz-fossoyeur-bouton" + (gainEclats > 0 || faveurAOffrir(s) ? " kz-appel" : "")}
                  aria-expanded={salle} onClick={() => setSalle((v) => !v)}>
            <Fossoyeur base={spritesBase} />
            <span>
              <b>Le Fossoyeur</b>
              <small>
                {eclatsLibres(s) > 0 ? fmtEnt(eclatsLibres(s)) + " éclat" + (eclatsLibres(s) > 1 ? "s" : "") + " à offrir"
                  : gainEclats > 0 ? fmtEnt(gainEclats) + " éclat" + (gainEclats > 1 ? "s" : "") + " dans les étais"
                    : "Effondrement et faveurs"}
              </small>
            </span>
          </button>
        )}
        {/* La rangée de ce qu'on a acheté. Elle vivait au pied de la colonne de
            gauche, où elle prenait soixante pixels de roche et poussait le
            panneau à chaque embauche. L'en-tête avait, lui, une bande vide de
            neuf cents pixels entre les plaques et le lexique. Les deux
            problèmes se résolvaient l'un l'autre.

            Une seule ligne, sans retour : vingt jetons de quarante pixels
            tiennent dans la bande, et au-delà elle glisse latéralement plutôt
            que de passer à la ligne — l'en-tête doit garder la hauteur des
            plaques, quoi qu'on achète. */}
        <div className="kz-equipe">
          {equipePosee.length === 0 && chantierPose.length === 0 ? (
            <p className="kz-note">Personne ne creuse encore pour vous.</p>
          ) : (
            <>
            {equipePosee.map((c) => (
              jeton(c.id, c.sprite, c.nom, s.compagnons[c.id])
            ))}
            {chantierPose.map((e) => (
              jeton(e.id, e.sprite, e.nom)
            ))}
            </>
          )}
        </div>
        {bulleSurvol && (
          <div className="kz-infobulle" role="tooltip" style={{ left: bulleSurvol.gauche + "px" }}>
            <strong>{bulleSurvol.titre}</strong>
            <span>{bulleSurvol.texte}</span>
          </div>
        )}

        {/* Le lexique n'est pas une aide en ligne, c'est la contrepartie du
            vocabulaire : le jeu a le droit de dire « le filon cède » à
            condition de dire une fois ce qu'est un filon.

            Il est posé ici et non près du titre du module : la page des Mines
            masque ce titre, qui ferait doublon avec le sien, et le bouton
            serait parti avec lui. Une commande ne se range pas dans un bloc
            qu'une autre feuille a le droit d'éteindre. */}
        <button type="button" className="kz-btn kz-mini kz-lexique-bouton"
                aria-expanded={lexique} onClick={() => setLexique((v) => !v)}>
          Lexique
        </button>
      </div>



      {lexique && (
        <div className="kz-lexique" role="dialog" aria-label="Lexique de la mine">
          <div className="kz-lexique-tete">
            <h3>Lexique</h3>
            <button type="button" className="kz-bulle-fermer" aria-label="Fermer le lexique"
                    onClick={() => setLexique(false)}>×</button>
          </div>
          <dl>
            {motsConnus.map((m) => (
              <Fragment key={m.mot}>
                <dt>{m.mot}</dt><dd>{m.def}</dd>
              </Fragment>
            ))}
          </dl>
          {motsConnus.length < LEXIQUE.length && (
            <p className="kz-note">D'autres mots s'ajouteront à mesure que vous descendrez.</p>
          )}
        </div>
      )}

      {salle && (
        <section className="kz-salle" aria-labelledby="kz-salle-titre">
          <Grotte base={spritesBase} />
          <div className="kz-salle-barre">
            <button type="button" className="kz-btn kz-mini" onClick={() => setSalle(false)}>{"\u2190 Retour à la mine"}</button>
            <h2 id="kz-salle-titre" tabIndex={-1} ref={titreSalle}>La Faveur du Fossoyeur</h2>
            <span className="kz-note">La mine continue de creuser pendant ce temps.</span>
          </div>
          <div className="kz-salle-corps">
            <div className="kz-salle-gauche">
              <Fossoyeur base={spritesBase} eveille={eveille} />
              <div className="kz-offrande">
                <p className="kz-solde">
                  <b className="kz-n">{fmtEnt(eclatsLibres(s))}</b>
                  {" éclat" + (eclatsLibres(s) > 1 ? "s" : "") + " à offrir · " + fmtEnt(s.eclats) + " au total, +"
                    + Math.round(s.eclats * ECLAT_BONUS * 100) + " % de dégâts"}
                </p>
                <p className="kz-prochaine">
                  {s.profondeurMax < 5
                    ? "Il faut atteindre le Cœur Résonant, à la profondeur 5, avant qu'un effondrement rapporte quoi que ce soit."
                    : "Prochaine mine : dégâts ×" + mEclats(s).toFixed(2).replace(".", ",") + " → ×"
                      + (mEclats(s) + gainEclats * ECLAT_BONUS).toFixed(2).replace(".", ",")
                      + " · " + fmtEnt(gainEclats) + " éclat" + (gainEclats > 1 ? "s" : "") + " de plus"}
                </p>
                <button type="button" className="kz-btn kz-danger" disabled={gainEclats < 1} onClick={effondrer}>
                  {gainEclats > 0 ? "Faire sauter les étais" : "Rien à récupérer pour l'instant"}
                </button>
                <p className="kz-note kz-effondrement-note">
                  La mine repart de zéro. Vos éclats et vos faveurs restent.
                </p>
              </div>
            </div>
            <div className="kz-salle-droite">
              <div className="kz-branches">
                {BRANCHES.map((b) => (
                  <div className="kz-branche" key={b.id}>
                    <h3>{b.nom}</h3>
                    {b.faveurs.map((f) => {
                      const pris = aFaveur(s, f.id);
                      const ouverte = faveurOuverte(s, f.id);
                      const ok = faveurAbordable(s, f.id);
                      return (
                        <button key={f.id} type="button" disabled={!ok}
                                className={"kz-faveur" + (pris ? " kz-prise" : !ouverte ? " kz-verrou" : ok ? " kz-abordable" : "")}
                                aria-label={f.nom + ", " + f.cout + " éclats" + (pris ? ", acquise" : !ouverte ? ", verrouillée" : "")}
                                onClick={() => offrirFaveur(f.id)}>
                          <span className="kz-gemme" aria-hidden="true" />
                          <span className="kz-faveur-txt"><b>{f.nom}</b><span>{f.desc}</span></span>
                          <span className="kz-faveur-prix kz-n">{pris ? "acquise" : f.cout + " \u25c6"}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="kz-grid" hidden={salle}>
        <section className="kz-panneau kz-face">
          {/* Le nom de la strate suffit. Sa phrase d'ambiance — « le schiste
              grince, l'étoile y perle en grains » — était une ligne de plus à
              lire à chaque descente, au-dessus de l'information utile. */}
          <div className="kz-strate" key={s.profondeur}>
            <h2>{st.nom}</h2>
          </div>

          <div className="kz-profondeur">
            <button type="button" className="kz-btn" disabled={s.profondeur <= 1} onClick={remonter}>Remonter</button>
            <span className="kz-n">
              {"Profondeur " + s.profondeur + ", " + Math.min(brisesIci(s), FILONS_PAR_STRATE)
                + " filons sur " + FILONS_PAR_STRATE}
            </span>
            <button type="button" className="kz-btn"
                    disabled={s.profondeur >= s.profondeurMax}
                    onClick={descendre}>Descendre</button>
          </div>

          <div className="kz-encoches" aria-hidden="true">
            {Array.from({ length: FILONS_PAR_STRATE }, (v, i) => (
              <i key={i} className={i < Math.min(brisesIci(s), FILONS_PAR_STRATE) ? "kz-on" : ""} />
            ))}
          </div>

          <div className="kz-vein" ref={veinRef} role="button" tabIndex={0}
               data-filon={s.filonRang ? String(s.filonRang) : undefined}
               aria-label={"Frapper le filon"
                 + (s.filonRang === 2 ? ", exceptionnel : douze fois plus d'étoile"
                  : s.filonRang === 1 ? ", généreux : quatre fois plus d'étoile" : "")}
               onPointerDown={frapper}
               onPointerUp={() => veinRef.current && veinRef.current.classList.remove("kz-hit")}
               onPointerCancel={() => veinRef.current && veinRef.current.classList.remove("kz-hit")}
               onKeyDown={(e) => {
                 if (e.key === " " || e.key === "Enter") { e.preventDefault(); frapper(null); }
               }}>
            <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
              <defs>
                <radialGradient id="kz-lueur" cx="50%" cy="52%">
                  <stop offset="0%" className="kz-lueur-dedans" />
                  <stop offset="100%" className="kz-lueur-dehors" />
                </radialGradient>
                <linearGradient id="kz-pierre" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" className="kz-pierre-haut" />
                  <stop offset="100%" className="kz-pierre-bas" />
                </linearGradient>
              </defs>
              <ellipse className="kz-lampe" cx="200" cy="156" rx="168" ry="136" strokeWidth="1" />
              <ellipse cx="200" cy="156" rx="152" ry="122" fill="url(#kz-lueur)" />
              <ellipse className="kz-ombre" cx="200" cy="272" rx="118" ry="16" />
              <ellipse className="kz-flash" cx="200" cy="156" rx="152" ry="122" />
              <g className="kz-scene"><g className="kz-noyau"><g className="kz-roche">
                <path className="kz-bloc" strokeWidth="2"
                      d="M64 216 L46 128 L96 62 L184 40 L268 54 L336 108 L348 190 L302 254 L196 272 L106 258 Z" />
                <path className="kz-facette" d="M64 216 L46 128 L96 62 L184 40 L150 132 Z" />
                <path className="kz-facette" d="M268 54 L336 108 L348 190 L232 140 Z" />
                <path className="kz-fissure" strokeWidth="3" opacity=".75" d="M96 62 L150 132 L106 258" />
                <path className="kz-fissure" strokeWidth="3" opacity=".75" d="M268 54 L232 140 L302 254" />
                <path className="kz-fissure" strokeWidth="2" opacity=".55" d="M150 132 L232 140 L196 272" />
                <g>
                  {formeRef.current.map((e, i, tab) => (
                    <path key={i} className="kz-eclat"
                          d={"M" + e.x.toFixed(1) + " " + (e.y - e.t).toFixed(1)
                            + " L" + (e.x + e.t * 0.58).toFixed(1) + " " + e.y.toFixed(1)
                            + " L" + e.x.toFixed(1) + " " + (e.y + e.t).toFixed(1)
                            + " L" + (e.x - e.t * 0.58).toFixed(1) + " " + e.y.toFixed(1) + " Z"}
                          transform={"rotate(" + e.rot + " " + e.x.toFixed(1) + " " + e.y.toFixed(1) + ")"}
                          style={{ opacity: ratio > i / tab.length ? 1 : 0.1 }} />
                  ))}
                </g>
              </g></g></g>
            </svg>
            <div className="kz-voile" />
            <div className="kz-calque" ref={calqueRef} aria-hidden="true" />
            {/* Rien, dans une roche dessinée, ne dit qu'elle se frappe. Une
                ligne, le temps du premier filon, et plus jamais ensuite. */}
            {s.brisesTotal === 0 && muet && (
              <p className="kz-amorce" aria-hidden="true">Frappez la roche</p>
            )}
            {filante && (
              <button key={filante.id} type="button" className="kz-filante"
                      style={{ top: filante.haut + "%" }}
                      aria-label="Attraper l'étoile filante"
                      onPointerDown={(e) => { e.stopPropagation(); attraperFilante(); }}
                      onKeyDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); if (e.detail === 0) attraperFilante(); }}
                      onAnimationEnd={() => setFilante(null)}>
                <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
                  <path d="M20 2 l4.7 12 12.8.8-9.9 8.1 3.2 12.5L20 28.5l-10.8 6.9 3.2-12.5L2.5 14.8l12.8-.8z" />
                </svg>
              </button>
            )}
            {frenesieRef.current > Date.now() && (
              <p className="kz-frenesie" aria-hidden="true">
                {"Frénésie \u00d7" + FRENESIE.mult + " \u00b7 " + Math.ceil((frenesieRef.current - Date.now()) / 1000) + " s"}
              </p>
            )}
            {/* La couleur seule dirait qu'il se passe quelque chose sans dire
                quoi, et ne dirait rien à qui distingue mal les teintes. Le
                multiplicateur est écrit. */}
            {s.filonRang > 0 && (
              <p className="kz-filon-marque" aria-hidden="true">
                {s.filonRang === 2 ? "Filon exceptionnel" : "Filon généreux"}
                <b>{s.filonRang === 2 ? "×12" : "×4"}</b>
              </p>
            )}
          </div>

          <div className="kz-jauge" role="progressbar" aria-label="Résistance du filon"
               aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
            <i style={{ width: (ratio * 100).toFixed(1) + "%" }} />
          </div>
          <div className="kz-jauge-txt">
            <span className="kz-n">{fmt(Math.max(0, s.pv)) + " sur " + fmt(s.pvMax)}</span>
            <span>résistance du filon</span>
          </div>

          <div className="kz-stats">
            <div>par frappe<b className={"kz-n" + (godPioche ? " kz-or-god" : "")}>{godPioche ? "God-Pioche" : fmt(degatsClic(s))}</b></div>
            <div>par seconde<b className="kz-n">{fmt(dps(s))}</b></div>
            <div>
              niveau<b className="kz-n">{s.niveau + (s.points ? " (+" + s.points + ")" : "")}</b>
              <div className="kz-xp" ref={xpRef}>
                <i style={{ width: Math.min(100, (s.xp / xpRequis(s)) * 100).toFixed(1) + "%" }} />
              </div>
            </div>
          </div>

        </section>

        <section className="kz-panneau kz-side">
          <div className="kz-tabs" role="tablist" aria-label="Gestion de la mine">
            {ongletsOuverts.map(([id, libelle], i) => (
              <button key={id} type="button" role="tab" aria-selected={onglet === id}
                      className={aVoir.has(id) ? "kz-tab-neuf" : undefined}
                      tabIndex={onglet === id ? 0 : -1}
                      onClick={() => {
                        setOnglet(id);
                        if (aVoir.has(id)) setAVoir((v) => {
                          const n = new Set(v); n.delete(id); return n;
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                        e.preventDefault();
                        const L = ongletsOuverts.length;
                        const j = (i + (e.key === "ArrowRight" ? 1 : L - 1)) % L;
                        setOnglet(ongletsOuverts[j][0]);
                      }}>
                {libelle}
                {/* Le point de talent était annoncé par une phrase dans
                    l'en-tête ; il l'est maintenant là où on va le dépenser. */}
                {id === "talents" && s.points > 0 && (
                  <em className="kz-tab-pastille" aria-label={
                    s.points + " point" + (s.points > 1 ? "s" : "") + " de talent à placer"
                  }>{s.points}</em>
                )}
                {aVoir.has(id) && !(id === "talents" && s.points > 0) && (
                  <em className="kz-tab-point" aria-label="vient de s'ouvrir" />
                )}
              </button>
            ))}
          </div>
          <div className="kz-corps" role="tabpanel">{corps[onglet]}</div>
        </section>
      </div>

      {/* La bulle et l'écran de remise à zéro sortent du module par un portail :
          `.kz` isole son contexte d'empilement, et l'en-tête du site (z-index
          30) et son menu (45) passaient par-dessus, au téléphone surtout. */}
      {bulleTafix && createPortal(
        <div className={"kz kz-portail" + (effets ? "" : " kz-sobre")}>
        <div className="kz-bulle-tafix" role="status">
          <Tafix expr={bulleTafix.expr} base={spritesBase} />
          <div>
            <p className="kz-qui">Tafix</p>
            <p>{bulleTafix.dit}</p>
            <div className="kz-bulle-actions">
              <button type="button" className="kz-btn kz-mini kz-or-bouton" onClick={() => setBulleTafix(null)}>Compris</button>
              <button type="button" className="kz-taire"
                      onClick={() => { setBulleTafix(null); signaler({ muet: true }); }}>Tafix, tais-toi</button>
            </div>
          </div>
        </div>
        </div>, document.body
      )}

      {s.remise && charge && createPortal(
        <div className="kz kz-portail">
        <div className="kz-voile-remise">
          <div className="kz-remise" role="dialog" aria-modal="true" aria-labelledby="kz-remise-titre">
            <div className="kz-remise-tete">
              <Tafix expr="panique" base={spritesBase} />
              <div>
                <h2 id="kz-remise-titre" tabIndex={-1} ref={titreRemise}>Les Mines changent</h2>
                <p>« Les miens ont changé les règles. Tout le monde repart de la galerie d'entrée. Tafix aussi. »</p>
              </div>
            </div>
            <div className="kz-remise-bloc">
              <h3>Ce qui change</h3>
              <ul>
                <li>Tafix vous apporte des commandes : vous livrez de l'étoile, la tribu paie en or.</li>
                <li>Vos éclats s'offriront au Fossoyeur, contre des faveurs qui durent d'une mine à l'autre.</li>
                <li>Plus de dette quand on fait tout sauter.</li>
                <li>Les strates sont plus longues à descendre.</li>
              </ul>
            </div>
            <div className="kz-remise-bloc">
              <h3>Tout repart de zéro</h3>
              <ul>
                <li>Étoile, compagnons, chantier, talents, profondeur et éclats : pour tous les joueurs, la même galerie d'entrée.</li>
                <li>Restent acquis : vos PO déjà versés et vos succès déjà réclamés.</li>
              </ul>
            </div>
            <div className="kz-remise-bloc">
              <h3>Pour solde de tout compte</h3>
              {remisePayee ? (
                <p>Votre solde a déjà été versé sur un autre appareil.</p>
              ) : (
                <div className="kz-remise-solde">
                  <span><b className="kz-n">{fmtEnt(s.remise.total) + " PO"}</b>versés dans votre bourse</span>
                  <small>
                    {fmtEnt(s.remise.etoile) + " PO pour l'étoile en stock"}
                    {s.remise.effondrements > 0 && <><br />{"+ " + fmtEnt(s.remise.partEffondrements) + " PO pour vos " + s.remise.effondrements + " effondrement" + (s.remise.effondrements > 1 ? "s" : "")}</>}
                  </small>
                </div>
              )}
            </div>
            <button type="button" className="kz-btn kz-or-bouton kz-rouvrir" onClick={rouvrir}>Rouvrir la mine</button>
          </div>
        </div>
        </div>, document.body
      )}

      </div>
    </div>
  );
}


export default MinesDeKazim;
export { MinesDeKazim };
