import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import FaceCarte from "../components/FaceCarte.jsx";
import Icone from "../components/Icone.jsx";
import { BOOSTERS } from "../extensions/index.js";
import { DONJON } from "../config/tiers.js";
import { resoudreImage } from "../lib/images.js";
import {
  BONUS_ARTEFACT, GENRES, MODES, etagesDe, graineInfinie, RANGS, RENCONTRES, ROLES, STRATEGIES, TRAITS,
  atqDe, cartesDonjon, choixAuto, choixIA, creerPartie, demarrerCombat, descendre, entrer, fuir,
  gestes, graineDuJour, issue, ouverts, parUid, prochain, rapporte, repos, resoudre,
  tresor, victoire, vivants, allie, ciblesPossibles, convalescences, fiche, peutFuir, gainsXP,
  apprentissage, brume, tirage, BRUME_TOUR,
} from "./regles.js";
import { NIVEAU_MAX, PALIER_IRISEE, avancement, xpDe } from "./experience.js";
import "../styles/donjon.css";

/**
 * Le Donjon : l'interface.
 *
 * Les règles sont dans `regles.js`. Ici on affiche la partie, on anime les
 * gestes et on tient le fil du combat : à qui la main, qui attend une cible,
 * quand l'adversaire ou le pilote automatique doit jouer.
 *
 * La partie vit dans une référence et non dans l'état React : le moteur la
 * modifie sur place, et un compteur de version redessine. Elle part dans la
 * sauvegarde du jeu à chaque changement d'écran. Un combat ou une rencontre
 * est sauvé à l'entrée, avec sa graine : rechargé, il reprend au début, avec
 * les mêmes adversaires et les mêmes tirages. Recharger ne sert donc ni à
 * sauter une salle, ni à effacer une défaite.
 */

const POOLS = cartesDonjon(BOOSTERS);
const TAILLE_EQUIPE = 4;
const ICONE_GENRE = { combat: "combat", elite: "elite", tresor: "tresor", evenement: "rencontre", repos: "repos", boss: "elite" };
const ORDRE_PALIERS = ["legendaire", "rare", "peucommun", "commun"];
const aujourdhui = () => new Date().toLocaleDateString("sv");
const dateFr = (j) => j.split("-").reverse().join("/");
const pieces = (n) => `${n} pièce${n > 1 ? "s" : ""}`;
const initiales = (n) => String(n).split(/[\s,'’-]+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join("");
const nouvelleGraine = () => Math.floor(Math.random() * 4294967296) >>> 0;
const pourcent = (x) => `${Math.round(x * 100)} %`;
/** La rencontre d'une salle, rebâtie de sa graine : même texte, mêmes choix, mêmes issues. */
function monterRencontre(p) {
  const { id, graine } = p.rencontre;
  const e = RENCONTRES.find((x) => x.id === id);
  const n = p.plan.noeuds[p.noeud];
  if (!e || !n) return null;
  return { e, texte: e.texte(n.lieu.nom), choix: e.choix(p, { r: tirage(graine), pools: POOLS }) };
}
const bonusTexte = (t) => {
  const b = BONUS_ARTEFACT[t] || BONUS_ARTEFACT.commun;
  return [b.atq && `+${b.atq} ATQ`, b.pv && `+${b.pv} PV`].filter(Boolean).join(", ") + " à l'équipe";
};

/** Au doigt : la même requête que la navigation du site (site.css). */
const REQUETE_DOIGT = "(max-width: 720px), (max-width: 860px) and (max-height: 500px)";
function useDoigt() {
  const [oui, setOui] = useState(() => typeof matchMedia === "function" && matchMedia(REQUETE_DOIGT).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const m = matchMedia(REQUETE_DOIGT);
    const maj = () => setOui(m.matches);
    m.addEventListener?.("change", maj);
    return () => m.removeEventListener?.("change", maj);
  }, []);
  return oui;
}

/* ── Une carte, au cadre du site, avec ce que le combat y ajoute ─────── */

function CarteDJ({ c, u = null, partie = null, cfgImage, fichiers }) {
  const cfg = useMemo(() => ({ ...cfgImage, extension: c.ext }), [cfgImage, c.ext]);
  const pct = u ? Math.max(0, (u.pv / u.pvMax) * 100) : 0;
  const statuts = [];
  if (u?.provoque) statuts.push("Provoque");
  if (u?.galva > 0) statuts.push("+3 ATQ");
  if (u?.rempart > 0) statuts.push("Rempart");
  if (u?.camp === "a" && u.cd > 0) statuts.push(`Recharge ${u.cd}`);
  return (
    <div className="dj-carte cardbox">
      <div className="dj-face"><FaceCarte c={c} cfgImage={cfg} fichiers={fichiers} vignette /></div>
      {u && (
        <div className="dj-sur" aria-hidden="true">
          <span className="dj-badges">
            <b className="atq">ATQ {atqDe(partie, u)}</b>
            <b className="ini">INI {u.ini}</b>
          </span>
          {statuts.length > 0 && <span className="dj-statuts">{statuts.map((s) => <i key={s}>{s}</i>)}</span>}
          <span className={`dj-pv${pct < 35 ? " bas" : ""}`}><span style={{ width: `${pct}%` }} /></span>
          <span className="dj-pvtxt">{u.ko ? "à terre" : `${u.pv} / ${u.pvMax}`}</span>
          {/* Au doigt, les pastilles cèdent la place à deux chiffres en couleur :
              l'attaque et les PV. Le reste est dans la fiche, d'un toucher. */}
          <span className="dj-nums">
            <b className="atq">{atqDe(partie, u)}</b>
            <b className={`pv${pct < 35 ? " bas" : ""}`}>{u.ko ? "×" : u.pv}</b>
          </span>
          {(u.provoque > 0 || u.galva > 0 || u.rempart > 0) && <span className="dj-etat-point" />}
        </div>
      )}
    </div>
  );
}

/**
 * Remonter termine la descente : on le demande deux fois. Le premier appui
 * arme le bouton, le second remonte ; sans suite, il se désarme.
 */
function BoutonRemonter({ sac, onRemonter, className = "btn quiet" }) {
  const [arme, setArme] = useState(false);
  useEffect(() => {
    if (!arme) return;
    const id = setTimeout(() => setArme(false), 4000);
    return () => clearTimeout(id);
  }, [arme]);
  return (
    <button type="button" className={`${className}${arme ? " dj-arme" : ""}`} onClick={() => (arme ? onRemonter() : setArme(true))}>
      {arme ? `Confirmer : remonter avec ${pieces(sac)}` : `Remonter avec ${pieces(sac)}`}
    </button>
  );
}

function Jeton({ u, cls = "", cfgImage, fichiers }) {
  const src = resoudreImage(u.c, { ...cfgImage, extension: u.c.ext }, fichiers, { vignette: true });
  const [rate, setRate] = useState(false);
  return (
    <span className={`dj-jeton ${u.camp} ${cls}`} title={`${u.nomAffiche || u.c.nom} — initiative ${u.ini}`}>
      {src && !rate ? <img src={src} alt="" onError={() => setRate(true)} /> : initiales(u.c.nom)}
      <span className="ini">{u.ini}</span>
    </span>
  );
}

function MiniEquipe({ partie }) {
  return (
    <ul className="dj-mini">
      {partie.equipe.map((u) => {
        const pct = (u.pv / u.pvMax) * 100;
        return (
          <li key={u.uid} data-palier={u.c.tier} className={u.ko ? "ko" : ""}>
            <span className="dj-mini-nom"><b>{u.c.nom}</b> <span className="muted">{ROLES[u.role].nom}</span></span>
            <span className={`dj-mini-barre${pct < 35 ? " bas" : ""}`}><span style={{ width: `${pct}%` }} /></span>
            <span className="dj-mini-pv">{u.ko ? "à terre" : `${u.pv} / ${u.pvMax}`}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Reliques({ partie }) {
  const l = [partie.artefact, ...partie.reliques].filter(Boolean);
  if (!l.length && !partie.benediction) return <p className="muted petit">Aucune relique.</p>;
  return (
    <div className="dj-reliques">
      {l.map((a, i) => <span key={i} data-palier={a.tier} title={bonusTexte(a.tier)}>{a.nom}</span>)}
      {partie.benediction > 0 && <span data-palier="legendaire">Autel +{partie.benediction} ATQ</span>}
    </div>
  );
}

/* ── La carte d'un étage ─────────────────────────────────────────────── */

function Plan({ partie, onEntrer, onSurvol, doigt, bulle, onBulle }) {
  const P = partie.plan;
  const dispo = new Set(ouverts(P));
  const pris = new Set(P.pris);
  const passes = new Set([P.pos, ...P.pris.map((a) => a.split(">")[0])].filter(Boolean));
  const rangActuel = P.pos ? P.noeuds[P.pos].r : -1;
  const H = 60 + RANGS * 84 + 70;
  const noeuds = Object.values(P.noeuds);
  return (
    <svg className="dj-plan" viewBox={`0 0 400 ${H}`} role="group" aria-label={`Carte de l'étage ${partie.etage}`}>
      {noeuds.flatMap((n1) => n1.vers.map((v) => {
        const n2 = P.noeuds[v], a = `${n1.id}>${v}`, my = (n1.y + n2.y) / 2;
        const cls = pris.has(a) ? "prise" : n1.id === P.pos && dispo.has(v) ? "ouverte" : "";
        return <path key={a} className={`dj-arete ${cls}`} d={`M${n1.x},${n1.y + 18} C${n1.x},${my} ${n2.x},${my} ${n2.x},${n2.y - 18}`} />;
      }))}
      {noeuds.map((n) => {
        const etat = n.id === P.pos ? "ici" : passes.has(n.id) ? "fait" : dispo.has(n.id) ? "ouvert" : n.r <= rangActuel ? "ferme" : "";
        const r = n.genre === "boss" ? 30 : 19, ico = n.genre === "boss" ? 34 : 22;
        const ouvert = etat === "ouvert";
        return (
          <g key={n.id} className={`dj-noeud ${etat}${n.genre === "boss" ? " boss" : ""}`} transform={`translate(${n.x},${n.y})`}
            data-noeud={n.id}
            {...(ouvert ? { tabIndex: 0, role: "button", "aria-label": `${GENRES[n.genre].nom}, ${n.lieu.nom}` } : {})}
            // Au doigt, un toucher ouvre la bulle de la salle ; on y va depuis la
            // bulle. À la souris, le survol renseigne et le clic entre.
            onClick={(e) => { e.stopPropagation(); if (doigt) onBulle(bulle === n.id ? null : n.id); else if (ouvert) onEntrer(n.id); else onSurvol(n.id); }}
            onMouseEnter={() => !doigt && onSurvol(n.id)} onFocus={() => onSurvol(n.id)}
            onKeyDown={(e) => { if (ouvert && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onEntrer(n.id); } }}>
            {bulle === n.id && <circle className="vise" r={r + 7} />}
            {ouvert && <circle className="halo" r={r} />}
            <circle className="fond" r={r} />
            <svg x={-ico / 2} y={-ico / 2} width={ico} height={ico} viewBox="0 0 20 20" className="dj-ico" aria-hidden="true">
              <Icone nom={etat === "fait" ? "fait" : ICONE_GENRE[n.genre]} taille={20} />
            </svg>
          </g>
        );
      })}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Le module
   ════════════════════════════════════════════════════════════════════ */

export default function Donjon({ jeu }) {
  const { etat, cfgImage, fichiers, mouvementReduit, donjon, tentativesRestantes, illimite,
    poInfiniRestant, recordInfini, commencerDonjon, sauverPartie, terminerDonjon, convalescence, niveauCarte, enExpedition } = jeu;

  const partieRef = useRef(donjon.partie ? structuredClone(donjon.partie) : null);
  const combatRef = useRef(null);
  const [, redessiner] = useReducer((x) => x + 1, 0);
  // Une partie reprise revient à la carte, ou au choix de la sortie si le
  // gardien venait de tomber : les autres écrans ne se sauvent pas.
  const [ecran, setEcran] = useState(() => {
    const p = donjon.partie;
    if (!p) return "preparation";
    if (p.ecran === "sortie") return "sortie";
    if (p.combat) return "combat";
    if (p.rencontre) return "rencontre";
    return "carte";
  });
  const [choix, setChoix] = useState([]);
  // Le donjon du jour d'abord, tant qu'il reste sa descente.
  const [mode, setMode] = useState(() => (tentativesRestantes > 0 ? "jour" : "infini"));
  const [artefact, setArtefact] = useState(null);
  const [survol, setSurvol] = useState(null);
  const [resultat, setResultat] = useState(null);
  const [rencontre, setRencontre] = useState(() => (partieRef.current?.rencontre ? monterRencontre(partieRef.current) : null));
  const [fin, setFin] = useState(null);
  const [strategie, setStrategie] = useState("manuel");
  const [vitesse, setVitesse] = useState(1);
  const [geste, setGeste] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [journal, setJournal] = useState([]);
  const [inspecte, setInspecte] = useState(null);
  // null : fermé ; "" : ouvert en entier ; un rôle : ouvert sur ce rôle.
  const [lexique, setLexique] = useState(null);
  const doigt = useDoigt();
  const [bulle, setBulle] = useState(null);
  const [feuille, setFeuille] = useState(false);
  const zone = useRef(null);
  const minuteurs = useRef([]);
  const rnd = useRef(Math.random);
  // Le tirage du combat en cours, tiré de sa graine : c'est lui qui rend un
  // rechargement inutile.
  const rngCombat = useRef(Math.random);
  const vitesseRef = useRef(vitesse); vitesseRef.current = vitesse;
  const stratRef = useRef(strategie); stratRef.current = strategie;

  const partie = partieRef.current;
  const C = combatRef.current;
  const differer = (fn, ms) => { const id = setTimeout(fn, ms); minuteurs.current.push(id); };
  useEffect(() => () => minuteurs.current.forEach(clearTimeout), []);

  const aller = useCallback((e) => {
    setEcran(e);
    const p = partieRef.current;
    if (p) { p.ecran = e === "combat" ? "carte" : e; sauverPartie(structuredClone(p)); }
    window.scrollTo({ top: 0 });
  }, [sauverPartie]);

  /* ── Collection : les alliés et artéfacts que le joueur possède ─────── */
  const collection = useMemo(() => {
    const possede = (c) => (etat.collections?.[c.ext]?.[c.id]?.normale || 0) > 0;
    const tri = (a, b) => ORDRE_PALIERS.indexOf(a.tier) - ORDRE_PALIERS.indexOf(b.tier) || a.nom.localeCompare(b.nom);
    return { allies: POOLS.allies.filter(possede).sort(tri), artefacts: POOLS.artefacts.filter(possede).sort(tri) };
  }, [etat.collections]);

  /* ── Déroulé ─────────────────────────────────────────────────────── */
  const ouvertsTotal = Object.values(etat.boosters || {}).reduce((s, n) => s + (n || 0), 0);
  const apprenti = apprentissage(ouvertsTotal, DONJON.apprentissage);
  const partir = () => {
    const equipe = choix.map((id) => collection.allies.find((c) => c.id === id)).filter((c) => c && !enExpedition?.(c));
    if (equipe.length !== TAILLE_EQUIPE || (mode === "jour" && tentativesRestantes <= 0)) return;
    const jour = aujourdhui();
    const niveaux = Object.fromEntries(equipe.map((c) => [`${c.ext}:${c.id}`, niveauCarte(c)]));
    const M = DONJON.modes[mode];
    const graine = mode === "infini" ? graineInfinie() : graineDuJour(jour);
    const p = creerPartie({ equipe, artefact, graine, jour, pools: POOLS, niveaux, apprenti, mode, gainMode: M.gain, xpMode: M.xp });
    partieRef.current = p;
    commencerDonjon(structuredClone(p));
    setEcran("carte");
    window.scrollTo({ top: 0 });
  };

  const entrerSalle = (id) => {
    const p = partieRef.current;
    const n = entrer(p, id);
    if (!n) return;
    const r = rnd.current;
    if (n.genre === "combat" || n.genre === "elite" || n.genre === "boss") return lancerCombat(n.genre);
    if (n.genre === "tresor") setResultat(tresor(p, r, POOLS.artefacts));
    else if (n.genre === "repos") setResultat(repos(p));
    else {
      p.rencontre = { id: RENCONTRES[Math.floor(r() * RENCONTRES.length)].id, graine: nouvelleGraine() };
      setRencontre(monterRencontre(p));
      return aller("rencontre");
    }
    aller("resultat");
  };

  /**
   * Entre en combat, ou y revient après un rechargement : la partie est sauvée
   * telle qu'avant le premier coup, avec la graine du combat.
   */
  const lancerCombat = (genre, reprise = null) => {
    const p = partieRef.current;
    p.combat = reprise || { genre, graine: nouvelleGraine() };
    sauverPartie(structuredClone({ ...p, ecran: "combat" }));
    rngCombat.current = tirage(p.combat.graine);
    combatRef.current = demarrerCombat(p, p.combat.genre, rngCombat.current, POOLS);
    setJournal([reprise ? "Le combat reprend à son premier tour." : p.combat.genre === "boss" ? "Le gardien de l'étage se dresse." : `${combatRef.current.ennemis.length} adversaires.`]);
    setGeste(null); setOccupe(true);
    setEcran("combat");
    window.scrollTo({ top: 0 });
    differer(() => { prochain(p, combatRef.current); setOccupe(false); redessiner(); }, 500);
  };

  const choisirRencontre = (i) => {
    const ch = rencontre.choix[i];
    if (!ch || ch.ok === false) return;
    const texte = ch.f();
    const p = partieRef.current;
    p.rencontre = null;
    if (!vivants(p.equipe).length) return terminer("defaite");
    setResultat({ titre: rencontre.e.titre, texte });
    aller("resultat");
  };

  const terminer = (iss) => {
    const p = partieRef.current;
    const butin = rapporte(p, iss);
    const complete = p.mode !== "infini" && iss === "sortie" && p.etage >= etagesDe(p) && p.stats.gardiens >= etagesDe(p);
    const repos = convalescences(p, iss);
    const infini = p.mode === "infini";
    const record = infini && p.stats.gardiens > recordInfini;
    const { po, bilan } = terminerDonjon(butin, { issue: iss, etage: p.etage, gardiens: p.stats.gardiens, complete, mode: p.mode || "jour" }, repos, gainsXP(p, iss));
    const noms = new Map([...p.equipe.map((u) => u.c), ...p.perdus].map((c) => [`${c.ext}:${c.id}`, c.nom]));
    setFin({ issue: iss, butin, perdu: p.sac - butin, po, stats: { ...p.stats }, etage: p.etage, debout: vivants(p.equipe).length,
      mode: p.mode || "jour", record, plafonne: infini && po < Math.round(butin * DONJON.multiplicateur),
      total: p.equipe.length, reliques: p.reliques.length, repos: repos.map((x) => ({ nom: noms.get(x.cle), jours: x.jours })), xp: bilan });
    combatRef.current = null;
    partieRef.current = null;
    setEcran("fin");
    window.scrollTo({ top: 0 });
  };

  /* ── Combat : le fil ─────────────────────────────────────────────── */
  const el = (uid) => zone.current?.querySelector(`.dj-u[data-uid="${uid}"]`);

  const ruer = async (att, cible, { vite = false, lourd = false } = {}) => {
    const a = el(att.uid), b = el(cible.uid);
    if (!a || !b || mouvementReduit) return;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const dx = rb.left + rb.width / 2 - (ra.left + ra.width / 2), dy = rb.top + rb.height / 2 - (ra.top + ra.height / 2);
    const t = (vite ? 300 : 460) / vitesseRef.current;
    a.style.zIndex = 10;
    const anim = a.animate([
      { transform: "translate(0,0) rotate(0) scale(1)" },
      { transform: `translate(${-dx * 0.06}px, ${-dy * 0.06}px) rotate(${dx > 0 ? -4 : 4}deg) scale(1.02)`, offset: 0.25 },
      { transform: `translate(${dx * 0.62}px, ${dy * 0.62}px) rotate(${dx > 0 ? 6 : -6}deg) scale(1.08)`, offset: 0.52 },
      { transform: "translate(0,0) rotate(0) scale(1)" },
    ], { duration: t, easing: "cubic-bezier(.35,.1,.3,1)" });
    setTimeout(() => {
      eclater(b, lourd ? "lourd" : "");
    }, t * 0.5);
    await anim.finished.catch(() => {});
    a.style.zIndex = "";
  };
  const pulser = async (u) => {
    const a = el(u.uid);
    if (!a || mouvementReduit) return;
    await a.animate([{ transform: "scale(1)" }, { transform: "translateY(-8px) scale(1.07)" }, { transform: "scale(1)" }],
      { duration: 380 / vitesseRef.current, easing: "ease-out" }).finished.catch(() => {});
  };
  /* Chaque capacité a son geste : la frappe de base fond sur la cible, les
     autres se distinguent au premier coup d'œil. Tout passe par l'API Web
     Animations et des éléments posés le temps de l'effet dans l'arène. */
  const arene = () => zone.current?.querySelector(".dj-arene");
  const centre = (e) => {
    const a = arene().getBoundingClientRect(), r = e.getBoundingClientRect();
    return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height * 0.4 };
  };
  const poser = (cls, style = {}) => {
    const d = document.createElement("span");
    d.className = cls; Object.assign(d.style, style);
    arene().appendChild(d);
    return d;
  };
  const secouer = (force = 6) => arene()?.animate(
    [{ transform: "translate(0,0)" }, { transform: `translate(${-force}px, ${force / 2}px)` }, { transform: `translate(${force}px, ${-force / 2}px)` },
      { transform: `translate(${-force / 2}px, 0)` }, { transform: "translate(0,0)" }], { duration: 320 / vitesseRef.current });
  const eclater = (b, cls = "") => {
    b.classList.remove("touche"); void b.offsetWidth; b.classList.add("touche");
    const e = document.createElement("span"); e.className = `dj-eclat ${cls}`; b.appendChild(e);
    setTimeout(() => e.remove(), 450);
  };
  const projectile = async (de, vers, cls, { arc = 0, duree = 380 } = {}) => {
    const a = centre(de), b = centre(vers);
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    const p = poser(`dj-proj ${cls}`, { left: `${a.x}px`, top: `${a.y}px` });
    const mx = (b.x - a.x) / 2, my = (b.y - a.y) / 2 - arc;
    await p.animate([
      { transform: `translate(-50%,-50%) rotate(${ang}deg)`, opacity: 0.2 },
      { transform: `translate(calc(-50% + ${mx}px), calc(-50% + ${my}px)) rotate(${ang}deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) rotate(${ang}deg)`, opacity: 1 },
    ], { duration: duree / vitesseRef.current, easing: "ease-in" }).finished.catch(() => {});
    p.remove();
  };
  const balayer = async (rang, cls) => {
    const r = rang.getBoundingClientRect(), a = arene().getBoundingClientRect();
    const v = poser(`dj-vague ${cls}`, { left: `${r.left - a.left}px`, top: `${r.top - a.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    await v.animate([{ backgroundPosition: "-120% 0", opacity: 0 }, { opacity: 1, offset: 0.3 }, { backgroundPosition: "220% 0", opacity: 0 }],
      { duration: 620 / vitesseRef.current, easing: "ease-in-out" }).finished.catch(() => {});
    v.remove();
  };
  const anneau = (e, cls) => {
    const c = centre(e);
    const d = poser(`dj-anneau ${cls}`, { left: `${c.x}px`, top: `${c.y}px` });
    return d.animate([{ transform: "translate(-50%,-50%) scale(.3)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(1.6)", opacity: 0 }],
      { duration: 620 / vitesseRef.current, easing: "ease-out" }).finished.catch(() => {}).then(() => d.remove());
  };
  const animerGeste = async (u, g, cible) => {
    const a = el(u.uid), b = cible ? el(cible.uid) : null;
    if (!a || mouvementReduit || !arene()) return;
    const t = (ms) => ms / vitesseRef.current;
    const rangEnFace = zone.current.querySelector(u.camp === "a" ? ".dj-rang.ennemis" : ".dj-rang.equipe");
    if (g === "attaque" && b) return ruer(u, cible);
    if (g === "lourde" && b) {
      // Il prend son élan, lève haut, et abat : l'arène tremble.
      await a.animate([{ transform: "translateY(-10px)" }, { transform: "translateY(-30px) rotate(-6deg) scale(1.1)" }],
        { duration: t(260), easing: "ease-out", fill: "forwards" }).finished.catch(() => {});
      a.getAnimations().forEach((x) => x.cancel());
      await ruer(u, cible, { vite: true, lourd: true });
      secouer(9);
      return;
    }
    if (g === "coupbas" && b) { await ruer(u, cible, { vite: true }); return; }
    if (g === "vise" && b) {
      a.animate([{ transform: "translateY(-10px)" }, { transform: "translateY(-6px) scale(.96)" }, { transform: "translateY(-10px)" }], { duration: t(240) });
      await projectile(a, b, "fleche", { duree: 300 });
      eclater(b);
      return;
    }
    if (g === "soin" && b) {
      a.animate([{ filter: "none" }, { filter: "drop-shadow(0 0 14px rgba(127,209,185,.9))" }, { filter: "none" }], { duration: t(420) });
      await projectile(a, b, "orbe", { arc: 70, duree: 480 });
      anneau(b, "soin");
      return;
    }
    if (g === "vague") {
      await pulser(u);
      if (rangEnFace) await balayer(rangEnFace, "brume");
      secouer(4);
      return;
    }
    if (g === "balayage") {
      await a.animate([{ transform: "scale(1)" }, { transform: "translateY(10px) scale(1.12)" }, { transform: "scale(1)" }], { duration: t(360) }).finished.catch(() => {});
      if (rangEnFace) await balayer(rangEnFace, "sang");
      secouer(11);
      return;
    }
    if (g === "provoc") { anneau(a, "garde"); await pulser(u); return; }
    if (g === "rempart" || g === "ravit") {
      const siens = zone.current.querySelectorAll(u.camp === "a" ? ".dj-rang.equipe .dj-u:not(.ko)" : ".dj-rang.ennemis .dj-u:not(.ko)");
      siens.forEach((x) => anneau(x, g === "rempart" ? "garde" : "soin"));
      await pulser(u);
      return;
    }
    if (g === "galva") {
      const siens = zone.current.querySelectorAll(u.camp === "a" ? ".dj-rang.equipe .dj-u:not(.ko)" : ".dj-rang.ennemis .dj-u:not(.ko)");
      siens.forEach((x) => anneau(x, "galva"));
      await pulser(u);
      return;
    }
    await pulser(u);
  };

  const montrer = (effets) => {
    for (const f of effets) {
      const e = el(f.uid); if (!e) continue;
      if (f.anim) { e.classList.remove(f.anim); void e.offsetWidth; e.classList.add(f.anim); }
      const s = document.createElement("span");
      s.className = `dj-flottant ${f.cls || ""}`; s.textContent = f.txt;
      e.appendChild(s);
      setTimeout(() => s.remove(), 1100);
    }
  };

  const executer = useCallback(async (u, g, cible) => {
    const p = partieRef.current, CC = combatRef.current;
    if (!p || !CC || CC.fini) return;
    setOccupe(true); setGeste(null);
    await animerGeste(u, g, cible);
    const res = resoudre(p, CC, u, g, cible, rngCombat.current);
    setJournal((j) => [res.note, ...j].slice(0, 12));
    redessiner();
    requestAnimationFrame(() => montrer(res.effets));
    await new Promise((ok) => setTimeout(ok, 560 / vitesseRef.current));
    if (combatRef.current !== CC) return;
    const fin = issue(p, CC);
    if (fin === "victoire") {
      CC.fini = "victoire";
      p.combat = null;
      const r = victoire(p, CC, rngCombat.current, POOLS.artefacts);
      setResultat(r);
      setOccupe(false);
      differer(() => { combatRef.current = null; aller(CC.genre === "boss" ? "sortie" : "resultat"); }, 450 / vitesseRef.current);
      return;
    }
    if (fin === "defaite") { CC.fini = "defaite"; differer(() => terminer("defaite"), 700); return; }
    prochain(p, CC);
    setOccupe(false);
    redessiner();
  }, [aller]); // eslint-disable-line react-hooks/exhaustive-deps

  // À chaque passage de main : l'adversaire joue seul, le pilote automatique
  // aussi ; sinon on attend le joueur.
  const actifUid = C?.actif;
  useEffect(() => {
    const p = partieRef.current, CC = combatRef.current;
    if (ecran !== "combat" || !CC || CC.fini || occupe || !actifUid) return;
    const u = parUid(p, CC, actifUid);
    if (!u) return;
    if (u.camp === "e") {
      const id = setTimeout(() => { const { geste: g, cible } = choixIA(p, CC, u, rngCombat.current); executer(u, g, cible); }, 480 / vitesse);
      return () => clearTimeout(id);
    }
    if (strategie !== "manuel") {
      const id = setTimeout(() => { const { geste: g, cible } = choixAuto(p, CC, u, strategie); executer(u, g, cible); }, 420 / vitesse);
      return () => clearTimeout(id);
    }
  }, [ecran, actifUid, occupe, strategie, vitesse, executer, C?.round, C?.idx]);

  const choisirGeste = (g) => {
    const p = partieRef.current, CC = combatRef.current, u = parUid(p, CC, CC.actif);
    if (occupe || u.camp !== "a") return;
    const def = gestes(p, u).find((x) => x.id === g);
    if (!def || !def.pret) return;
    if (!def.cible) return executer(u, g, null);
    setGeste(g === geste ? null : g);
  };
  const cibler = (cible) => {
    const p = partieRef.current, CC = combatRef.current, u = parUid(p, CC, CC.actif);
    const def = gestes(p, u).find((x) => x.id === geste);
    if (!def || cible.ko) return;
    if ((def.cible === "e") !== (cible.camp === "e")) return;
    executer(u, geste, cible);
  };
  const seReplier = () => {
    if (occupe || !peutFuir(partieRef.current, combatRef.current)) return;
    combatRef.current.fini = "fuite";
    partieRef.current.combat = null;
    setResultat(fuir(partieRef.current));
    combatRef.current = null;
    if (!vivants(partieRef.current.equipe).length) return terminer("defaite");
    aller("resultat");
  };

  // Un tour qui passe referme la fiche ouverte d'un toucher.
  useEffect(() => { setInspecte(null); }, [actifUid]);

  // Une partie reprise au milieu d'un combat : il se rejoue depuis son premier
  // tour, mêmes adversaires, mêmes tirages. Sans combat sauvé, retour à la carte.
  useEffect(() => {
    if (ecran !== "combat" || combatRef.current) return;
    const p = partieRef.current;
    if (p?.combat) lancerCombat(p.combat.genre, p.combat);
    else setEcran("carte");
  }, [ecran]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ecran === "rencontre" && !rencontre) setEcran("carte"); }, [ecran, rencontre]);
  // Au téléphone, chaque écran s'ouvre sur ce qui compte : l'arène centrée au combat, la prochaine salle sur la carte.
  useEffect(() => {
    if (!doigt) return;
    const id = requestAnimationFrame(() => {
      const racine = document.querySelector(".dj");
      const cible = ecran === "combat" ? racine?.querySelector(".dj-coeur")
        : ecran === "carte" ? racine?.querySelector(".dj-noeud.ouvert") : null;
      cible?.scrollIntoView({ block: ecran === "combat" ? "start" : "center", behavior: "auto" });
    });
    return () => cancelAnimationFrame(id);
  }, [ecran, doigt, partie?.etage]);
  useEffect(() => { setBulle(null); setFeuille(false); }, [ecran]);

  /* ── Rendu ───────────────────────────────────────────────────────── */
  const entete = partie && (
    <div className="dj-entete">
      <span className="pastille">{partie.mode === "infini"
        ? <>Infini · étage <b>{partie.etage}</b></>
        : <>Étage <b>{partie.etage}</b> / {etagesDe(partie)}</>}</span>
      <span className="pastille or">Sac <b>{pieces(partie.sac)}</b> <span className="muted">≈ {Math.round(partie.sac * DONJON.multiplicateur)} PO</span></span>
      {(partie.difficulte ?? 1) < 1 && (
        <span className="pastille" title="Adversaires affaiblis et butin réduit, jusqu'au jeu normal au fil des boosters ouverts.">
          Apprentissage · adversaires {pourcent(partie.difficulte)}
        </span>
      )}
    </div>
  );

  if (ecran === "preparation" || (!partie && ecran !== "fin")) {
    const n = choix.length;
    const plus = mode === "infini" || tentativesRestantes > 0;
    const MJ = DONJON.modes.jour, MI = DONJON.modes.infini;
    return (
      <div className="dj">
        <p className="dj-intro">
          Choisissez quatre compagnons de votre collection et un artéfact. Chaque étage est une carte : vous tracez
          votre chemin, salle après salle, jusqu'au gardien. Vaincu, il vous laisse remonter avec le butin — ou
          descendre, là où il pèse plus lourd. Si l'équipe tombe, il ne reste qu'un quart du sac, et les
          compagnons restent au repos.
        </p>

        {/* Deux donjons. Le choix se fait avant l'équipe : il change ce que
            rapporte la descente et combien de fois on peut la tenter. */}
        <div className="dj-modes" role="radiogroup" aria-label="Quel donjon">
          <button type="button" role="radio" aria-checked={mode === "jour"} className={`dj-mode${mode === "jour" ? " on" : ""}`}
            onClick={() => setMode("jour")}>
            <b>{MODES.jour.nom}</b>
            <span>Trois étages, la même carte pour tous le {dateFr(aujourdhui())}. Une descente par jour, butin ×{MJ.gain}.</span>
            <span className="dj-mode-etat">
              {illimite ? "Mode test : illimité" : tentativesRestantes > 0 ? "Descente disponible" : "Déjà tentée aujourd'hui"}
            </span>
          </button>
          <button type="button" role="radio" aria-checked={mode === "infini"} className={`dj-mode${mode === "infini" ? " on" : ""}`}
            onClick={() => setMode("infini")}>
            <b>{MODES.infini.nom}</b>
            <span>Des étages sans fin, de plus en plus durs, une carte neuve à chaque descente. Autant de descentes qu'on veut ; butin et expérience réduits, un jour de repos en cas de défaite.</span>
            <span className="dj-mode-etat">
              {recordInfini > 0 ? `Record : ${recordInfini} gardien${recordInfini > 1 ? "s" : ""}` : "Pas encore de record"}
              {" · "}{poInfiniRestant > 0 ? `encore ${poInfiniRestant} PO aujourd'hui` : "PO du jour versées"}
            </span>
          </button>
        </div>
        <p className="muted petit">
          Le butin rapporté est versé à la bourse ({String(DONJON.multiplicateur).replace(".", ",")} PO par pièce{mode === "infini" ? `, ${MI.plafondPOJour} PO par jour au plus pour le donjon infini` : ""}).
        </p>
        {apprenti.avance < 1 && (
          <p className="avis dj-apprenti">
            <b>Donjon d'apprentissage.</b> Tant que votre collection est jeune, les adversaires sont affaiblis
            ({pourcent(apprenti.difficulte)} de leur force) et le butin réduit ({pourcent(apprenti.gain)}). Tout revient
            à la normale au fil des boosters ouverts : encore {apprenti.restant} booster{apprenti.restant > 1 ? "s" : ""}.
            L'expérience des cartes, elle, est entière.
          </p>
        )}
        {donjon.dernier && donjon.dernier.jour === aujourdhui() && (
          <p className="avis">Dernière descente : {donjon.dernier.issue === "defaite" ? "l'équipe est tombée" : "remontée"} à l'étage {donjon.dernier.etage}, {donjon.dernier.po} PO versées à la bourse.</p>
        )}

        {collection.allies.length < TAILLE_EQUIPE ? (
          <section className="panneau"><h3>Pas encore d'équipe</h3>
            <p className="muted">Il faut au moins {TAILLE_EQUIPE} PNJ alliés dans votre collection pour descendre. Les créatures, les animaux et les criminels sont dans l'autre camp.</p></section>
        ) : (
          <>
            <div className="section-titre sous-titre">
              <h2>Vos compagnons <span className="muted petit">({n} / {TAILLE_EQUIPE})</span></h2>
              <button type="button" className="dj-lex-bouton" onClick={() => setLexique("")}><Icone nom="lexique" taille={16} /> Lexique</button>
            </div>
            <p className="muted petit dj-aide">Le rôle vient de l'archétype de la carte ; l'initiative, du rôle et du palier. Le détail des rôles est au lexique.</p>
            <div className="dj-grille">
              {collection.allies.map((c) => {
                const pris = choix.includes(c.id);
                const niv = niveauCarte(c);
                const u = allie({ uid: 0 }, c, niv), R = ROLES[u.role];
                const palier = PALIER_IRISEE[c.tier] || 20;
                // Mode test : la convalescence s'affiche mais n'empêche rien.
                const repos = convalescence(c);
                // Partie en expédition : elle ne descend pas avant son retour, mode test compris.
                const partie = enExpedition?.(c);
                const bloque = partie || (repos && !illimite);
                // Sous la carte, deux lignes de hauteur fixe : le mot-clé du rôle
                // et les chiffres. Le détail est au lexique : le texte complet
                // des capacités, variable d'une carte à l'autre, désalignait la grille.
                return (
                  <div key={`${c.ext}:${c.id}`}
                    className={`dj-choix${pris ? " pris" : ""}${(n >= TAILLE_EQUIPE && !pris) || bloque ? " grise" : ""}${repos || partie ? " repos" : ""}`}>
                    <button type="button" className="dj-choix-carte" aria-pressed={pris} disabled={bloque && !pris}
                      aria-label={`${c.nom}, ${R.nom}${partie ? ", en expédition" : repos ? `, au repos jusqu'au ${dateFr(repos)}` : ""}`}
                      onClick={() => setChoix((l) => (l.includes(c.id) ? l.filter((x) => x !== c.id) : l.length < TAILLE_EQUIPE ? [...l, c.id] : l))}>
                      {pris && <span className="dj-coche" aria-hidden="true">✓</span>}
                      {partie ? <span className="dj-repos">En expédition</span>
                        : repos && <span className="dj-repos">Au repos jusqu'au {dateFr(repos).slice(0, 5)}</span>}
                      <CarteDJ c={c} cfgImage={cfgImage} fichiers={fichiers} />
                    </button>
                    <div className="dj-choix-pied">
                      <span className="dj-ligne1">
                        <span className={`dj-mot r-${u.role}`}>{R.nom}</span>
                        <span className="dj-niv" title={niv < palier ? `Irisée au niveau ${palier}` : niv < NIVEAU_MAX ? `Sachet offert au niveau ${NIVEAU_MAX}` : "Niveau maximal"}>
                          Niv. {niv}
                        </span>
                      </span>
                      <span className="dj-chiffres"><span>{u.pvMax} PV</span><span>{u.atq} ATQ</span><span>INI {u.ini}</span></span>
                      <span className="dj-xp" aria-hidden="true"><span style={{ width: `${Math.round(avancement(xpDe(etat, c)) * 100)}%` }} /></span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="section-titre sous-titre"><h2>Un artéfact <span className="muted petit">(facultatif)</span></h2></div>
            {collection.artefacts.length === 0 ? <p className="muted petit">Aucun artéfact dans votre collection.</p> : (
              <div className="dj-grille">
                {collection.artefacts.map((a) => (
                  <div key={`${a.ext}:${a.id}`} className={`dj-choix${artefact?.id === a.id ? " pris" : ""}`}>
                    <button type="button" className="dj-choix-carte" aria-pressed={artefact?.id === a.id} aria-label={`${a.nom}, ${bonusTexte(a.tier)}`}
                      onClick={() => setArtefact((x) => (x?.id === a.id ? null : a))}>
                      {artefact?.id === a.id && <span className="dj-coche" aria-hidden="true">✓</span>}
                      <CarteDJ c={a} cfgImage={cfgImage} fichiers={fichiers} />
                    </button>
                    <div className="dj-choix-pied">
                      <span className="dj-mot r-artefact">Artéfact</span>
                      <span className="dj-chiffres"><span>{bonusTexte(a.tier).replace(" à l'équipe", "")}</span><span>à l'équipe</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="actions gauche dj-partir">
              <button className="btn" type="button" onClick={partir} disabled={n !== TAILLE_EQUIPE || !plus}>
                {!plus ? "Donjon du jour déjà tenté" : mode === "infini" ? "Descendre dans l'infini" : "Descendre avec cette équipe"}
              </button>
            </div>
          </>
        )}
        <Regles />
        {lexique !== null && <Lexique focus={lexique} onFermer={() => setLexique(null)} />}
      </div>
    );
  }

  if (ecran === "fin" && fin) {
    const echec = fin.issue === "defaite";
    return (
      <div className="dj">
        <section className="panneau dj-panneau">
          <h2>{echec ? "L'équipe est tombée" : "De retour à la surface"}</h2>
          <p>{echec ? "Les derniers compagnons sont ramenés au camp par des mains inconnues. Du sac, il ne reste que ce qui tenait dans les poches."
            : "La brume se referme derrière vous. Au camp, on compte les pièces."}</p>
          <p><span className="dj-butin">+{fin.po} PO</span> <span className="muted">versées à la bourse ({fin.butin} pièces rapportées{echec ? `, ${fin.perdu} perdues en bas` : ""})</span></p>
          {fin.plafonne && <p className="muted petit">Le donjon infini a versé ses {DONJON.modes.infini.plafondPOJour} PO du jour : le reste du butin ne va pas à la bourse. L'expérience, elle, est acquise.</p>}
          {fin.record && <p className="avis">Nouveau record du donjon infini : {fin.stats.gardiens} gardien{fin.stats.gardiens > 1 ? "s" : ""} vaincu{fin.stats.gardiens > 1 ? "s" : ""}.</p>}
          <table className="dj-tableau"><tbody>
            <tr><td>Étage atteint</td><td>{fin.mode === "infini" ? fin.etage : `${fin.etage} / ${MODES.jour.etages}`}</td></tr>
            <tr><td>Salles traversées</td><td>{fin.stats.salles}</td></tr>
            <tr><td>Adversaires vaincus</td><td>{fin.stats.ennemis}</td></tr>
            <tr><td>Gardiens</td><td>{fin.stats.gardiens}</td></tr>
            <tr><td>Reliques</td><td>{fin.reliques}</td></tr>
            <tr><td>Compagnons debout</td><td>{fin.debout} / {fin.total}</td></tr>
          </tbody></table>
          {fin.xp.length > 0 && (
            <div className="dj-bilan-xp">
              <h3>Expérience</h3>
              <ul>
                {fin.xp.map((l) => (
                  <li key={`${l.c.ext}:${l.c.id}`}>
                    <b>{l.c.nom}</b> <span className="muted">+{l.gain} XP</span>
                    {l.apres > l.avant ? <span className="monte"> · niveau {l.avant} → {l.apres}</span> : <span className="muted"> · niveau {l.apres}</span>}
                    {l.irisee && <span className="gain"> · version irisée gagnée !</span>}
                    {l.po > 0 && <span className="gain"> · déjà irisée : +{l.po} PO</span>}
                    {l.sachet && <span className="gain"> · niveau 100 : un sachet offert</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {fin.repos.length > 0 && (
            <p className="dj-convalescence">
              Au repos : {fin.repos.map((x) => `${x.nom} (${x.jours} jour${x.jours > 1 ? "s" : ""})`).join(", ")}.
              {" "}Ces cartes ne pourront pas redescendre avant.
            </p>
          )}
          <div className="actions gauche">
            <button className="btn" type="button" onClick={() => { setFin(null); setChoix([]); setEcran("preparation"); }}>
              Préparer une autre descente
            </button>
          </div>
        </section>
      </div>
    );
  }

  const n = partie.noeud ? partie.plan.noeuds[partie.noeud] : null;
  const lieu = n?.lieu;

  if (ecran === "carte") {
    const dispo = ouverts(partie.plan);
    const vu = partie.plan.noeuds[survol] ? partie.plan.noeuds[survol] : partie.plan.noeuds[dispo[0]];
    const H = 60 + RANGS * 84 + 70;
    const nb = bulle ? partie.plan.noeuds[bulle] : null;
    const debout = vivants(partie.equipe).length;
    return (
      <div className="dj">
        {entete}
        <div className="dj-etage">
          <div className="dj-planbox">
            <h2>Étage {partie.etage}</h2>
            <p className="muted petit">{partie.plan.pos ? "Choisissez la salle suivante" : "Choisissez par où entrer"} — les passages lumineux sont accessibles.</p>
            {(doigt || partie.plan.pos) && (
              <div className="dj-barre-carte">
                {doigt && (
                  <button type="button" className="dj-lex-bouton" onClick={() => setFeuille(true)}>
                    Équipe {debout} / {partie.equipe.length}{partie.reliques.length + (partie.artefact ? 1 : 0) > 0 ? ` · ${partie.reliques.length + (partie.artefact ? 1 : 0)} relique${partie.reliques.length + (partie.artefact ? 1 : 0) > 1 ? "s" : ""}` : ""}
                  </button>
                )}
                {/* On peut toujours sortir : même revenu d'un rechargement, même chez un gardien. */}
                {partie.plan.pos && <BoutonRemonter sac={partie.sac} onRemonter={() => terminer("sortie")} className="btn quiet sm" />}
              </div>
            )}
            <div className="dj-plan-zone" onClick={() => setBulle(null)}>
              <Plan partie={partie} onEntrer={entrerSalle} onSurvol={setSurvol} doigt={doigt} bulle={bulle} onBulle={setBulle} />
              {doigt && nb && (
                <div className={`dj-bulle${nb.y / H < 0.28 ? " dessous" : ""}`} role="dialog" aria-label={nb.lieu.nom}
                  style={{ left: `clamp(112px, ${(nb.x / 400) * 100}%, calc(100% - 112px))`, top: `${(nb.y / H) * 100}%` }}
                  onClick={(e) => e.stopPropagation()}>
                  <span className="genre"><Icone nom={ICONE_GENRE[nb.genre]} taille={14} /> {GENRES[nb.genre].nom}</span>
                  <b className="lieu">{nb.lieu.nom}</b>
                  <span className="aide">{GENRES[nb.genre].aide}</span>
                  {dispo.includes(nb.id)
                    ? <button className="btn sm" type="button" onClick={() => { setBulle(null); entrerSalle(nb.id); }}>Y aller</button>
                    : <span className="muted petit">{partie.plan.pos === nb.id || nb.r <= (partie.plan.noeuds[partie.plan.pos]?.r ?? -1) ? "Déjà derrière vous." : "Pas encore accessible d'ici."}</span>}
                </div>
              )}
            </div>
            <div className="dj-legende">
              {["combat", "elite", "tresor", "evenement", "repos"].map((g) => (
                <span key={g}><Icone nom={ICONE_GENRE[g]} taille={15} /> {GENRES[g].nom}</span>
              ))}
            </div>
          </div>
          <aside className="dj-cote">
            {vu && (
              <div className="bloc dj-apercu">
                <div className="dj-apercu-carte"><CarteDJ c={vu.lieu} cfgImage={cfgImage} fichiers={fichiers} /></div>
                <div>
                  <span className="genre"><Icone nom={ICONE_GENRE[vu.genre]} taille={14} /> {GENRES[vu.genre].nom}</span>
                  <h3>{vu.lieu.nom}</h3>
                  <p className="muted petit">{GENRES[vu.genre].aide}</p>
                  {dispo.includes(vu.id) && <button className="btn sm" type="button" onClick={() => entrerSalle(vu.id)}>Y aller</button>}
                </div>
              </div>
            )}
            <div className="bloc"><h3>L'équipe</h3><MiniEquipe partie={partie} /></div>
            <div className="bloc"><h3>Reliques</h3><Reliques partie={partie} /></div>
          </aside>
        </div>
        {doigt && feuille && (
          <div className="dj-voile" onClick={() => setFeuille(false)}>
            <section className="dj-lexique dj-feuille" role="dialog" aria-modal="true" aria-label="L'équipe" onClick={(e) => e.stopPropagation()}>
              <header><h2>L'équipe</h2><button type="button" className="btn quiet sm" onClick={() => setFeuille(false)}>Fermer</button></header>
              <MiniEquipe partie={partie} />
              <h3>Reliques</h3>
              <Reliques partie={partie} />
            </section>
          </div>
        )}
      </div>
    );
  }

  if (ecran === "combat" && C) {
    const actif = C.actif ? parUid(partie, C, C.actif) : null;
    const monTour = actif && actif.camp === "a" && strategie === "manuel" && !occupe && !C.fini;
    const liste = monTour ? gestes(partie, actif) : [];
    const def = monTour && geste ? liste.find((x) => x.id === geste) : null;
    const ordre = C.ordre.map((uid, i) => ({ u: parUid(partie, C, uid), i })).filter((x) => x.u && !x.u.ko);
    const frappables = new Set(ciblesPossibles(partie, C, "a").map((x) => x.uid));
    const unite = (u) => {
      const ciblable = def && !u.ko && ((def.cible === "e") ? frappables.has(u.uid) : u.camp === "a");
      const f = inspecte === u.uid ? fiche(partie, u) : null;
      const R = ROLES[u.role];
      const etiquette = u.boss ? "Gardien · Balayage" : R ? `${R.nom} · ${R.cap.nom}` : `${u.elite ? "Élite · " : ""}${TRAITS[u.role].nom}`;
      return (
        <div key={u.uid} data-uid={u.uid}
          className={`dj-u${u.uid === C.actif ? " actif" : ""}${u.ko ? " ko" : ""}${ciblable ? ` ciblable${u.camp === "a" ? " allie" : ""}` : ""}${u.boss ? " boss" : ""}`}
          {...(doigt ? {} : { onMouseEnter: () => setInspecte(u.uid), onMouseLeave: () => setInspecte((x) => (x === u.uid ? null : x)) })}
          {...(ciblable ? { role: "button", tabIndex: 0, "aria-label": `Cibler ${u.nomAffiche || u.c.nom}`,
            onClick: () => cibler(u), onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cibler(u); } } }
            : { tabIndex: 0, "aria-label": `${u.nomAffiche || u.c.nom} — voir la fiche`, onClick: () => setInspecte((x) => (doigt && x === u.uid ? null : u.uid)),
              ...(doigt ? {} : { onFocus: () => setInspecte(u.uid), onBlur: () => setInspecte((x) => (x === u.uid ? null : x)) }) })}>
          <CarteDJ c={u.c} u={u} partie={partie} cfgImage={cfgImage} fichiers={fichiers} />
          <span className="dj-etiquette">{etiquette}</span>
          {f && (
            <div className={`dj-fiche ${u.camp === "e" ? "bas" : "haut"}`} role="tooltip">
              <b className="t">{f.nom}</b>
              <span className="s">{f.stats}</span>
              {f.lignes.map((l, i) => <span key={i} className="l"><b>{l.t}</b>{l.d ? ` — ${l.d}` : ""}</span>)}
            </div>
          )}
        </div>
      );
    };
    let consigne;
    if (C.fini === "victoire") consigne = <b>Victoire.</b>;
    else if (!actif) consigne = <span className="muted">La brume se déchire…</span>;
    else if (actif.camp === "e") consigne = <><b>{actif.nomAffiche || actif.c.nom}</b> passe à l'attaque…</>;
    else if (!monTour) consigne = <><b>{actif.c.nom}</b> agit{strategie !== "manuel" ? ` — ${STRATEGIES[strategie].nom}` : ""}…</>;
    else consigne = <>À <b>{actif.c.nom}</b> de jouer.<br /><span className="muted">{def ? (def.cible === "e" ? "Choisissez l'adversaire à frapper." : "Choisissez l'allié à soigner.") : "Choisissez un geste."}</span></>;

    return (
      <div className="dj" ref={zone}>
        {entete}
        <div className="dj-arene">
          <div className="dj-coeur">
          <div className="dj-frise" aria-label="Ordre d'initiative du tour">
            <span className="tour">Tour {C.round}</span>
            {brume(C) > 1 && <span className="dj-brume" title={`Passé le tour ${BRUME_TOUR}, la brume se referme : +20 % de dégâts par tour, des deux côtés.`}>Brume +{Math.round((brume(C) - 1) * 100)} %</span>}
            {ordre.map(({ u, i }) => (
              <Jeton key={u.uid} u={u} cls={u.uid === C.actif ? "actif" : i < C.idx ? "passe" : ""} cfgImage={cfgImage} fichiers={fichiers} />
            ))}
          </div>
          <div className="dj-rang ennemis">{C.ennemis.map(unite)}</div>
          <div className="dj-milieu">
            <div className="dj-consigne" aria-live="polite">{consigne}
              <div className="dj-journal">{journal.slice(0, 3).map((t, i) => <div key={i}>{t}</div>)}</div>
            </div>
            <div className="dj-gestes">
              {liste.map((x) => (
                <button key={x.id} type="button" className={`dj-geste${geste === x.id ? " on" : ""}`} disabled={!x.pret} onClick={() => choisirGeste(x.id)}>
                  <b>{x.nom}</b><span>{x.aide}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="dj-rang equipe">{partie.equipe.map(unite)}</div>
          </div>
          <div className="dj-pilote">
            <div className="groupe"><span className="lib">Combat automatique</span>
              <span className="segments" role="group" aria-label="Stratégie">
                {Object.entries(STRATEGIES).map(([k, v]) => (
                  <button key={k} type="button" className={strategie === k ? "on" : ""} aria-pressed={strategie === k} title={v.aide} onClick={() => setStrategie(k)}>{v.nom}</button>
                ))}
              </span></div>
            <div className="groupe"><span className="lib">Vitesse</span>
              <span className="segments" role="group" aria-label="Vitesse">
                {[1, 2, 4].map((v) => <button key={v} type="button" className={vitesse === v ? "on" : ""} aria-pressed={vitesse === v} onClick={() => setVitesse(v)}>×{v}</button>)}
              </span>
              <button type="button" className="dj-lex-bouton" onClick={() => setLexique("")}><Icone nom="lexique" taille={16} /> Lexique</button>
              {C.genre !== "boss" && (
                <button className="btn quiet sm" type="button" onClick={seReplier} disabled={occupe || !!C.fini || !peutFuir(partie, C)}
                  title="Deux cinquièmes du sac perdus, chacun blessé, et le compagnon le plus mal en point reste derrière : absent jusqu'à demain.">
                  Fuir
                </button>
              )}
            </div>
          </div>
          <p className="muted petit">{STRATEGIES[strategie].aide}</p>
        </div>
        {lexique !== null && <Lexique focus={lexique} onFermer={() => setLexique(null)} />}
      </div>
    );
  }

  if (ecran === "rencontre" && rencontre) {
    return (
      <div className="dj">
        {entete}
        <div className="dj-scene">
          {lieu && <div className="dj-scene-carte"><CarteDJ c={lieu} cfgImage={cfgImage} fichiers={fichiers} /></div>}
          <section className="panneau dj-panneau">
            <h2>{rencontre.e.titre}</h2>
            <p>{rencontre.texte}</p>
            <div className="actions gauche">
              {rencontre.choix.map((c, i) => (
                <button key={i} type="button" className={`btn${i ? " quiet" : ""}`} disabled={c.ok === false} onClick={() => choisirRencontre(i)}>{c.lib}</button>
              ))}
            </div>
            <MiniEquipe partie={partie} />
          </section>
        </div>
      </div>
    );
  }

  if (ecran === "sortie" || (ecran === "resultat" && resultat)) {
    const dernier = partie.etage >= etagesDe(partie);
    const R = resultat || { titre: `Étage ${partie.etage} nettoyé`, texte: "Le gardien est tombé." };
    return (
      <div className="dj">
        {entete}
        <div className="dj-scene">
          {lieu && <div className="dj-scene-carte"><CarteDJ c={lieu} cfgImage={cfgImage} fichiers={fichiers} /></div>}
          <section className="panneau dj-panneau">
            <h2>{R.titre}</h2>
            <p>{R.texte}</p>
            {R.po > 0 && <p><span className="dj-butin">+{R.po}</span> <span className="muted">pièces au sac</span></p>}
            {R.relique && <p>Relique : <b>{R.relique.nom}</b> <span className="muted">— {bonusTexte(R.relique.tier)} jusqu'à la sortie.</span></p>}
            {ecran === "sortie" && (
              <p>{dernier ? "C'était le dernier étage. Il ne reste qu'à remonter."
                : "Remonter maintenant, c'est tout garder. Descendre, c'est des adversaires plus durs et des bourses plus lourdes — mais si l'équipe tombe, il ne restera qu'un quart du sac. Les tombés se relèvent à peine avant de descendre ; les autres gardent leurs blessures."}</p>
            )}
            <MiniEquipe partie={partie} />
            <div className="actions gauche">
              {ecran === "sortie" ? (
                <>
                  <button className="btn" type="button" onClick={() => terminer("sortie")}>Remonter avec {pieces(partie.sac)}</button>
                  {!dernier && <button className="btn quiet" type="button" onClick={() => { descendre(partie, POOLS); setSurvol(null); setResultat(null); aller("carte"); }}>Descendre à l'étage {partie.etage + 1}</button>}
                </>
              ) : (
                <>
                  <button className="btn" type="button" onClick={() => aller("carte")}>Retour à la carte</button>
                  <BoutonRemonter sac={partie.sac} onRemonter={() => terminer("sortie")} />
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // Écran inattendu (partie reprise sur un résultat perdu) : retour à la carte.
  return (
    <div className="dj">
      {entete}
      <div className="actions gauche"><button className="btn" type="button" onClick={() => aller("carte")}>Reprendre la descente</button></div>
    </div>
  );
}

/**
 * Le lexique : tout ce que les mots-clés des cartes veulent dire. `focus`
 * met une entrée en avant ; le bouton Lexique l'ouvre en entier.
 */
function Lexique({ focus, onFermer }) {
  const boite = useRef(null);
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  // Une seule fois à l'ouverture : en combat la page se redessine à chaque
  // coup, et l'on ne doit ni reprendre le focus ni refaire défiler.
  useEffect(() => {
    const el = focus ? boite.current?.querySelector(`[data-lex="${focus}"]`) : null;
    boite.current?.focus();
    el?.scrollIntoView?.({ block: "center" });
    const k = (e) => { if (e.key === "Escape") fermer.current(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [focus]);
  const entree = (id, titre, texte, sous = null) => (
    <div key={id} data-lex={id} className={`dj-lex-entree${focus === id ? " vise" : ""}`}>
      <dt>{titre}</dt>
      <dd>{texte}{sous && <span className="sous">{sous}</span>}</dd>
    </div>
  );
  return (
    <div className="dj-voile" onClick={onFermer}>
      <section className="dj-lexique" role="dialog" aria-modal="true" aria-labelledby="dj-lex-titre" tabIndex={-1} ref={boite}
        onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="dj-lex-titre"><Icone nom="lexique" taille={20} /> Lexique du Donjon</h2>
          <button type="button" className="btn quiet sm" onClick={onFermer}>Fermer</button>
        </header>
        <h3>Chiffres</h3>
        <dl>
          {entree("pv", "PV", "Points de vie. À zéro, la carte est à terre pour le reste du combat ; un repos la relève.")}
          {entree("atq", "ATQ", "Dégâts d'une attaque, à peu près : chaque coup varie de 15 % autour.")}
          {entree("ini", "INI", "Initiative : l'ordre de passage dans le tour. À égalité, l'équipe passe devant.")}
          {entree("niveau", "Niveau", `Chaque combat remporté donne de l'expérience à toute l'équipe (la moitié seulement si elle tombe). Un niveau ajoute un peu de solidité : +1 PV tous les 10 niveaux, +1 ATQ tous les 25. Au niveau ${PALIER_IRISEE.commun} pour une commune, ${PALIER_IRISEE.peucommun} une peu commune, ${PALIER_IRISEE.rare} une rare et ${PALIER_IRISEE.legendaire} une légendaire, la carte gagne sa version irisée — ou des PO si vous l'avez déjà. Au niveau ${NIVEAU_MAX}, un sachet offert de son extension.`)}
        </dl>
        <h3>Rôles et capacités</h3>
        <p className="muted petit">Le rôle d'un PNJ vient de son archétype. Les PNJ rivaux ont les mêmes, et s'en servent contre vous.</p>
        <dl>
          {Object.entries(ROLES).map(([id, R]) => entree(id, R.nom,
            <><b>{R.cap.nom}</b> — {R.cap.aide}.</>,
            `${R.passif ? `${R.passif}. ` : ""}Recharge : ${R.cap.cd ? `${R.cap.cd} tour${R.cap.cd > 1 ? "s" : ""}` : "aucune"}. Initiative de base ${R.ini}.`))}
        </dl>
        <h3>Adversaires</h3>
        <dl>
          {Object.entries(TRAITS).map(([id, T]) => entree(id, T.nom, `${T.aide}.`, id === "rapide" ? "Les Animaux." : id === "fourbe" ? "Les Criminels." : "Les Créatures."))}
          {entree("elite", "Élite", "Un adversaire renforcé, au milieu des salles d'élite. Butin plus gros, relique probable.")}
          {entree("gardien", "Gardien", "Au bout de chaque étage. Balaie toute l'équipe tous les trois tours. On ne le fuit pas.")}
        </dl>
        <h3>États</h3>
        <dl>
          {entree("provoc", "Provoque", "Seule cible possible pour le camp d'en face, armure +2, jusqu'à son prochain tour.")}
          {entree("galva", "+3 ATQ", "Galvanisé par un meneur, pour trois tours.")}
          {entree("rempart", "Rempart", "Armure +3, posée par un artificier sur toute l'équipe, pour deux tours.")}
          {entree("brume", "Brume", `Passé le tour ${BRUME_TOUR}, la brume se referme : chaque tour ajoute 20 % aux dégâts des deux camps. Aucun combat ne dure toujours.`)}
          {entree("recharge", "Recharge", "Tours avant que la capacité serve à nouveau.")}
          {entree("repos", "Au repos", "Convalescence après une défaite (un jour par étage atteint) ou une fuite (un jour) : la carte ne peut pas redescendre avant.")}
          {entree("artefact", "Artéfact", "Emporté au départ ou trouvé en route (relique) : son bonus vaut pour toute l'équipe jusqu'à la sortie. Commun +2 PV, peu commun +1 ATQ, rare +1 ATQ et +3 PV, légendaire +2 ATQ et +5 PV.")}
        </dl>
      </section>
    </div>
  );
}

function Regles() {
  return (
    <details className="dj-regles">
      <summary>Comment ça marche</summary>
      <ul>
        <li><b>La carte</b> : chaque étage est un réseau de salles. D'une salle, on ne va qu'aux salles reliées plus bas. On voit leur genre et leur lieu, pas ce qu'elles cachent.</li>
        <li><b>L'initiative</b> : chaque carte et chaque adversaire a la sienne. La frise du combat donne l'ordre du tour.</li>
        <li><b>À votre tour</b> : un geste — attaquer, ou la capacité du rôle — puis sa cible. Les capacités se rechargent en quelques tours.</li>
        <li><b>Combat automatique</b> : une stratégie, et l'équipe joue seule. Repassez en Manuel à tout moment.</li>
        <li><b>Gardien</b> : vaincu, il donne une relique, et le choix de remonter avec tout ou de descendre. On peut aussi remonter après n'importe quelle salle.</li>
        <li><b>Fuir</b> : deux cinquièmes du sac tombent, chacun est blessé, et le compagnon le plus mal en point reste derrière pour couvrir la retraite — il quitte l'expédition et reste au repos jusqu'au lendemain. On ne fuit pas un gardien, ni seul.</li>
        <li><b>Défaite</b> : il ne reste qu'un quart du sac, et les compagnons restent au repos un jour par étage atteint (un jour au donjon infini).</li>
        <li><b>Soins</b> : le repos avant chaque gardien rend 30 % des PV et relève les tombés ; les autres repos sont rares. Entre deux étages, seuls les tombés se relèvent.</li>
        <li><b>Fiches</b> : survolez ou touchez une carte en combat pour lire son rôle, sa capacité et son état.</li>
      </ul>
    </details>
  );
}

