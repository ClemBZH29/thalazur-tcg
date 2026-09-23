/**
 * MINES DE KAZIM — l'interface.
 *
 * Le module est réparti en cinq fichiers :
 *   donnees.js     strates, compagnons, équipement, talents, lexique
 *   regles.js      constantes d'économie et formules pures (testées)
 *   sauvegarde.js  la partie sauvegardée, son format et sa relecture
 *   format.js      nombres et durées à la française
 *   ce fichier     l'état vivant, les gestes et l'affichage
 *
 *   <MinesDeKazim
 *     onPO={(gain, totalSession) => crediterJoueur(gain)}
 *     storage={{ get: () => Promise<string|null>, set: (json) => Promise }}
 *     spritesBase="/kazim/"
 *     godPioche={false}             // outil MJ : chaque frappe brise le filon
 *   />
 *
 * Le module n'écrit jamais le solde du joueur, il annonce un gain via onPO.
 * Aucune couleur en dur : tout passe par les jetons de tokens.css.
 */

import { Fragment, useState, useRef, useEffect, useReducer, useCallback } from "react";
import "../styles/kazim.css";
import { COMPAGNONS, EQUIPEMENT, AMELIORATIONS, TALENTS, ONGLETS, LEXIQUE } from "./donnees.js";
import {
  FILONS_PAR_STRATE, FATIGUE_PO, DETTE_PAS, DETTE_MAX, RESONANCE_MAX, PLAFOND_JOUR,
  PIOCHES, equipA, equipMult, degatsClic, critChance, critMult,
  multCompagnon, dpsUn, dps, multRecolte, chanceEvenement, unFilonSur,
  teinteFortune, pvFilon, xpRequis, brisesIci, dette, bonusVolume,
  resonance, coursAffiche, poPourMise, prochainPO, eclatsDispo, coutUn,
  coutN, nbAbordable, genererEclats, strate,
} from "./regles.js";
import { fmt, signe, fmtEnt, fmtDuree } from "./format.js";
import { etatNeuf, relireMine } from "./sauvegarde.js";

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

function MinesDeKazim({ onPO, storage, spritesBase, godPioche = false }) {
  const S = useRef(etatNeuf());
  const [, forcer] = useReducer((n) => n + 1, 0);

  const [onglet, setOnglet] = useState("compagnons");
  const [aide, setAide] = useState(null);
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
  const sessionPO = useRef(0);

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
    const s = S.current;
    s.pvMax = pvFilon(s.profondeur, brisesIci(s));
    s.pv = s.pvMax;
    /* Le sort du filon se jouait à sa rupture : la récompense tombait après
       coup, sans que rien ne l'ait annoncée, et douze points placés dans
       Fortune ne se voyaient donc jamais. Il se joue maintenant à la naissance
       du bloc, qui prend sa couleur en conséquence — on voit le filon riche
       avant de le casser, et on se jette dessus. La probabilité, elle, n'a pas
       bougé d'un millième. */
    const seuil = chanceEvenement(s);
    const r = Math.random();
    s.filonRang = r < seuil * 0.4 ? 2 : r < seuil ? 1 : 0;
    /* Même bride que la rupture : à trois cents filons par seconde, la roche ne
       doit pas se recomposer à chaque image. */
    const t = Date.now();
    if (t - compteurs.current.derniereForme > 130) {
      compteurs.current.derniereForme = t;
      formeRef.current = genererEclats();
    }
  }, []);

  const briserFilon = useCallback(() => {
    const s = S.current;
    const rang = s.filonRang || 0;
    const recolte = s.pvMax * 0.24 * multRecolte(s) * (rang === 2 ? 12 : rang === 1 ? 4 : 1);
    const evenement = rang === 2 ? "Filon exceptionnel : douze fois plus d'étoile."
                    : rang === 1 ? "Filon généreux : quatre fois plus d'étoile."
                    : null;

    s.etoile += recolte;
    s.etoileTotale += recolte;
    s.brises[s.profondeur] = brisesIci(s) + 1;
    s.brisesTotal++;
    s.xp += Math.round(5 * Math.pow(s.profondeur, 1.25));

    while (s.xp >= xpRequis(s)) {
      s.xp -= xpRequis(s);
      s.niveau++;
      s.points++;
      noter("Niveau " + s.niveau + " atteint. Un point de talent à placer.");
      pulseNiveau();
    }
    if (evenement) noter(evenement + " Vous sortez " + fmt(recolte) + " d'étoile.");
    /* La strate épuisée, on descend tout seul : rester en haut n'a aucun intérêt
       mécanique, et la descente manuelle n'était qu'un clic de péage. */
    if (s.brises[s.profondeur] >= FILONS_PAR_STRATE && s.profondeur === s.profondeurMax) {
      s.profondeur++;
      s.profondeurMax = s.profondeur;
      noter("La strate cède. Vous descendez dans " + strate(s.profondeur).nom + ".");
    }
    nouveauFilon();
    rupture();
  }, [noter, nouveauFilon, pulseNiveau, rupture]);

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
    if (crit) s.resonance = Math.min(RESONANCE_MAX / 0.004, (s.resonance || 0) + 1);
    // God-Pioche : exactement ce qui reste au filon, pour qu'il se brise sans
    // que le surplus ne file dans les suivants.
    const d = godPioche ? Math.max(1, s.pv) : degatsClic(s) * (crit ? critMult(s) : 1);
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

  const tick = useCallback(() => {
    const s = S.current;
    const t = Date.now();
    const dt = Math.min(1000, Math.max(0, t - s.dernierTick)) / 1000;
    s.dernierTick = t;
    const p = dps(s);
    if (p > 0) appliquerDegats(p * dt);
    if (t - s.coursT > 150000) { s.coursT = t; s.cours = 0.82 + Math.random() * 0.4; }
  }, [appliquerDegats]);

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

  const sauver = useCallback(() => {
    if (!relue.current) return;
    S.current.dernierTick = Date.now();
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
        const absence = Math.min(8 * 3600000, t - (typeof avant === "number" ? avant : t));
        S.current.coursT = t;
        S.current.dernierTick = t;
        if (absence > 60000) {
          const gain = dps(S.current) * (absence / 1000) * 0.35 * 0.24 * multRecolte(S.current);
          if (gain > 0) {
            S.current.etoile += gain;
            S.current.etoileTotale += gain;
            noter("Absence de " + fmtDuree(absence) + ". L'équipe a sorti " + fmt(gain) + " d'étoile, à rendement réduit.");
          }
        }
      }
      if (!S.current.pvMax) nouveauFilon();
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
    const horloge = setInterval(sauver, 15000);
    const surVisibilite = () => { if (document.hidden) sauver(); };
    document.addEventListener("visibilitychange", surVisibilite);
    return () => {
      vivant = false;
      clearInterval(horloge);
      document.removeEventListener("visibilitychange", surVisibilite);
      Object.keys(minuteurs.current).forEach((k) => clearTimeout(minuteurs.current[k]));
      sauver();
      // Le prochain montage relira la sauvegarde avant d'avoir le droit d'écrire.
      relue.current = false;
    };
  }, [storage, sauver, noter, nouveauFilon]);

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
    setNeuf(e.id);
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

  const vendre = (part) => {
    const s = S.current;
    const t = Date.now();
    if (t - s.jourT > 86400000) { s.jourT = t; s.poJour = 0; }
    const mise = part === 1 ? s.etoile : Math.floor(s.etoile * part);
    let { po, depense } = poPourMise(s, mise);
    if (PLAFOND_JOUR > 0) po = Math.min(po, Math.max(0, PLAFOND_JOUR - s.poJour));
    if (po < 1) return;

    const cours = coursAffiche(s, mise);
    s.etoile -= Math.min(s.etoile, depense);
    s.poGagnes += po;
    s.poRun += po;
    s.poJour += po;
    s.resonance = 0;                 // la résonance accumulée part dans la pesée
    s.echanges++;
    sessionPO.current += po;
    noter("Les kobolds pèsent " + fmt(depense) + " d'étoile au cours de " + cours
      + " % et lâchent " + fmtEnt(po) + " PO.");
    if (typeof onPO === "function") {
      try { onPO(po, sessionPO.current); } catch (err) { console.error("[Kazim] onPO", err); }
    }
    sauver();
    forcer();
  };

  const appliquerEffondrement = (gain) => {
    const s = S.current;
    const garde = {
      poGagnes: s.poGagnes, eclats: s.eclats + gain, echanges: s.echanges,
      effondrements: s.effondrements + 1, etoileTotale: s.etoileTotale,
    };
    S.current = Object.assign(etatNeuf(), garde);
    nouveauFilon();
    sauver();
    forcer();
  };

  const effondrer = () => {
    const gain = eclatsDispo(S.current);
    if (gain < 1 || compteurs.current.chute) return;
    noter("Effondrement contrôlé. Vous récupérez " + fmtEnt(gain) + " éclats de Kazim dans les gravats.");
    if (!effetsRef.current) { appliquerEffondrement(gain); return; }

    compteurs.current.chute = true;
    const c = point(null);
    veinRef.current.classList.add("kz-chute");
    // La lueur monte d'abord, la roche cède ensuite : on sait qu'il se passe
    // quelque chose avant de pouvoir le lire.
    for (let i = 0; i < 4; i++) {
      setTimeout(() => particules(Math.random() * c.l, -6, 9, {
        chute: true, classe: "kz-poussiere", portee: 40, gravite: c.h * 0.9, vie: 1000, taille: 3,
      }), 120 + i * 180);
    }
    setTimeout(() => {
      particules(c.x, c.y, 26, { portee: 150, taille: 8, vie: 700 });
      onde(c.x, c.y, false, 60);
    }, 760);
    setTimeout(() => appliquerEffondrement(gain), 860);
    setTimeout(() => {
      onde(c.x, c.y, true, 50);
      particules(c.x, c.y, 22, { classe: "kz-chaude", portee: 130, taille: 7, vie: 760, gravite: -10 });
    }, 1080);
    setTimeout(() => {
      if (veinRef.current) veinRef.current.classList.remove("kz-chute");
      compteurs.current.chute = false;
      forcer();
    }, 1520);
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

  /* Les onglets ouverts à cet instant, et la détection de ceux qui viennent de
     s'ouvrir. La clé est une chaîne : la liste se recalcule neuf fois par
     seconde avec la boucle de jeu, et comparer deux tableaux à chaque image
     pour découvrir qu'il ne s'est rien passé serait du travail pour rien. */
  const ongletsOuverts = ONGLETS.filter(([, , ouvert]) => ouvert(s));
  const cleOuverts = ongletsOuverts.map(([id]) => id).join(",");
  useEffect(() => {
    if (!charge) return;
    const ids = cleOuverts ? cleOuverts.split(",") : [];
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
  }, [cleOuverts, noter, charge]);

  /* Si l'onglet courant se referme — un effondrement ramène la profondeur à 1 —
     on revient sur le premier, plutôt que d'afficher un panneau vide. */
  useEffect(() => {
    if (!cleOuverts.split(",").includes(onglet)) setOnglet("compagnons");
  }, [cleOuverts, onglet]);

  const motsConnus = LEXIQUE.filter((m) => m.des(s));

  const st = strate(s.profondeur);
  const ratio = s.pvMax > 0 ? Math.max(0, s.pv / s.pvMax) : 0;
  const venteTotale = poPourMise(s, s.etoile);
  const gainEclats = eclatsDispo(s);
  const equipePosee = COMPAGNONS.filter((c) => s.compagnons[c.id]);
  const chantierPose = EQUIPEMENT.filter((e) => equipA(s, e.id));
  const ameliorationsPosees = AMELIORATIONS.filter((a) => equipA(s, a.id));

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
      return { gauche: survol.gauche,
        titre: c.nom + " ×" + (s.compagnons[c.id] || 0),
        texte: c.desc + " " + fmt(dpsUn(s, c)) + " étoile par seconde chacun"
          + (m > 1 ? ", améliorations comprises (×" + m + ")." : ".") };
    }
    const e = EQUIPEMENT.find((x) => x.id === survol.cle);
    if (e) return { gauche: survol.gauche, titre: e.nom, texte: e.desc };
    const a = AMELIORATIONS.find((x) => x.id === survol.cle);
    if (a) return { gauche: survol.gauche, titre: a.nom,
      texte: "Production des " + COMPAGNONS.find((x) => x.id === a.compagnon).nom.toLowerCase()
        + " doublée." };
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
  const jeton = (cle, sprite, nom, nb, rang) => (
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
      {rang ? <i>{rang}</i> : null}
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

    echoppe: (
      <>
        <div className="kz-taux">
          <div className="kz-bourse-tete">
            <span className="kz-prix">{coursAffiche(s, s.etoile) + " %"}</span>
            <span className="kz-note">
              prix de rachat, sur la totalité de votre étoile
              {/* Le paragraphe qui expliquait la pente du cours occupait quatre
                  lignes au-dessus des boutons de vente, à lire une fois et à
                  subir ensuite. Il passe derrière un point d'interrogation. */}
              <button type="button" className="kz-aide-bouton"
                      aria-expanded={aide === "cours"}
                      aria-label="Comment se forme le prix de rachat"
                      onClick={() => setAide((a) => (a === "cours" ? null : "cours"))}>?</button>
            </span>
            {aide === "cours" && (
              <div className="kz-bulle" role="status">
                Les kobolds paient mieux les gros lots, et de moins en moins bien
                à mesure qu'ils ont déjà payé. Seul un effondrement leur redonne
                l'appétit — et encore, un peu moins à chaque fois. Le reste
                (contrats, coups critiques) ne fait que compenser cette pente :
                vos meilleurs prix sont derrière vous.
                <button type="button" className="kz-bulle-fermer" onClick={() => setAide(null)}
                        aria-label="Fermer l'aide">×</button>
              </div>
            )}
          </div>
          <div className="kz-grille">
            {[
              ["Vous vendez gros", "+" + Math.round(bonusVolume(s, s.etoile) * 100) + " %"],
              ["Vos coups critiques", "+" + Math.round(resonance(s) * 100) + " %"],
              ["Vos contrats", "+" + Math.round((1 / equipMult(s, "taux") - 1) * 100) + " %"],
              ["Leur humeur du jour", signe(Math.round((1 / s.cours - 1) * 100)) + " %"],
              ["Ils se lassent", "\u2212" + Math.round((1 - Math.exp(-s.poRun / FATIGUE_PO)) * 100)
                + " % après " + fmtEnt(s.poRun) + " PO versés"],
              ["Mines déjà abandonnées", "\u2212" + Math.round(dette(s) * 100) + " % après "
                + fmtEnt(s.effondrements) + " effondrement" + (s.effondrements > 1 ? "s" : "")],
            ].map(([libelle, valeur]) => (
              <Fragment key={libelle}>
                <span>{libelle}</span><b>{valeur}</b>
              </Fragment>
            ))}
          </div>

          <div className="kz-vendre">
            {[["Vendre le quart", 0.25], ["Vendre la moitié", 0.5], ["Tout vendre", 1]].map(([libelle, part]) => {
              const mise = part === 1 ? s.etoile : Math.floor(s.etoile * part);
              const r = poPourMise(s, mise);
              return (
                <button key={libelle} type="button" className="kz-btn" disabled={r.po < 1}
                        onClick={() => vendre(part)}>
                  {libelle}{r.po > 0 ? " \u00b7 " + fmtEnt(r.po) + " PO" : ""}
                </button>
              );
            })}
          </div>
          <p className="kz-note">
            {venteTotale.po > 0
              ? "Tout vendre maintenant rapporte " + fmtEnt(venteTotale.po) + " PO, soit un prix moyen de "
                + fmt(venteTotale.prixMoyen) + " d'étoile par PO."
              : "Il vous manque " + fmt(Math.max(0, prochainPO(s) - s.etoile)) + " d'étoile pour le prochain PO."}
          </p>
        </div>

        <div className="kz-row">
          <div className="kz-grow">
            <h3>Versé dans cette mine</h3>
            <p>{"Le prochain PO coûte " + fmt(prochainPO(s)) + " d'étoile."}</p>
          </div>
          <div className="kz-actions"><span className="kz-tenu">{fmtEnt(s.poRun) + " PO"}</span></div>
        </div>
        <div className="kz-row">
          <div className="kz-grow">
            <h3>Total versé</h3>
            <p>Toutes mines confondues, depuis le premier coup de pioche.</p>
          </div>
          <div className="kz-actions"><span className="kz-tenu">{fmtEnt(s.poGagnes) + " PO"}</span></div>
        </div>
      </>
    ),

    effondrement: (
      <>
        <p className="kz-note">
          Faire sauter les étais rouvre la mine à zéro : étoile, compagnons, chantier, niveaux et talents.
          Vos PO et vos éclats restent, et les kobolds retrouvent leur appétit. En échange, les kobolds
          retiennent un peu plus à chaque fois : la dette est de {Math.round(dette(s) * 100)} %, elle passera
          à {Math.round(Math.min(DETTE_MAX, DETTE_PAS * Math.log(2 + s.effondrements)) * 100)} %.
        </p>
        <div className="kz-row">
          <div className="kz-grow">
            <h3>Éclats de Kazim</h3>
            <p>Chaque éclat ajoute 3 % de récolte et de dégâts.</p>
          </div>
          <div className="kz-actions"><span className="kz-tenu">{fmtEnt(s.eclats)}</span></div>
        </div>
        <div className="kz-row">
          <div className="kz-grow">
            <h3>Effondrements</h3>
            <p>Mines abandonnées derrière vous.</p>
          </div>
          <div className="kz-actions"><span className="kz-tenu">{fmtEnt(s.effondrements)}</span></div>
        </div>
        <button type="button" className="kz-btn kz-danger" disabled={gainEclats < 1 || compteurs.current.chute}
                onClick={effondrer}>
          {gainEclats > 0 ? "Faire sauter les étais et gagner " + fmtEnt(gainEclats) + " éclats"
                          : "Rien à récupérer pour l'instant"}
        </button>
        {s.profondeurMax < 5 && (
          <p className="kz-note" style={{ marginTop: 13 }}>
            Il faut atteindre le Cœur Résonant, à la profondeur 5, avant qu'un effondrement rapporte quoi que ce soit.
          </p>
        )}
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
          <div className="kz-plaque">
            <b className="kz-or kz-n">{fmtEnt(s.poGagnes)}</b>
            {/* « PO kobold » et non « PO versés » : le bandeau du site affiche
                sa propre bourse en PO au même moment, et les deux échelles
                n'ont rien à voir. Un mot suffit à lever la confusion que le
                quota tentait d'expliquer en trois lignes. */}
            <small>PO kobold</small>
          </div>
        </div>
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
            {ameliorationsPosees.map((a) => (
              jeton(a.id, a.sprite, a.nom, 0, a.nom.split(" ").pop())
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

      <div className="kz-grid">
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
            {s.brisesTotal === 0 && (
              <p className="kz-amorce" aria-hidden="true">Frappez la roche</p>
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

      </div>
    </div>
  );
}


export default MinesDeKazim;
export { MinesDeKazim };
