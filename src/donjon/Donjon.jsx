import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import FaceCarte from "../components/FaceCarte.jsx";
import Icone from "../components/Icone.jsx";
import { BOOSTERS } from "../extensions/index.js";
import { DONJON } from "../config/tiers.js";
import { resoudreImage } from "../lib/images.js";
import {
  BONUS_ARTEFACT, ETAGES, GENRES, RANGS, RENCONTRES, ROLES, STRATEGIES, TRAITS,
  atqDe, cartesDonjon, choixAuto, choixIA, creerPartie, demarrerCombat, descendre, entrer, fuir,
  gestes, graineDuJour, issue, ouverts, parUid, prochain, rapporte, repos, resoudre,
  tresor, victoire, vivants, allie,
} from "./regles.js";
import "../styles/donjon.css";

/**
 * Les Profondeurs : l'interface.
 *
 * Les règles sont dans `regles.js`. Ici on affiche la partie, on anime les
 * gestes et on tient le fil du combat : à qui la main, qui attend une cible,
 * quand l'adversaire ou le pilote automatique doit jouer.
 *
 * La partie vit dans une référence et non dans l'état React : le moteur la
 * modifie sur place, et un compteur de version redessine. Elle part dans la
 * sauvegarde du jeu à chaque changement d'écran, jamais au milieu d'un
 * combat.
 */

const POOLS = cartesDonjon(BOOSTERS);
const TAILLE_EQUIPE = 4;
const ICONE_GENRE = { combat: "combat", elite: "elite", tresor: "tresor", evenement: "rencontre", repos: "repos", boss: "elite" };
const ORDRE_PALIERS = ["legendaire", "rare", "peucommun", "commun"];
const aujourdhui = () => new Date().toLocaleDateString("sv");
const dateFr = (j) => j.split("-").reverse().join("/");
const initiales = (n) => String(n).split(/[\s,'’-]+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join("");
const bonusTexte = (t) => {
  const b = BONUS_ARTEFACT[t] || BONUS_ARTEFACT.commun;
  return [b.atq && `+${b.atq} ATQ`, b.pv && `+${b.pv} PV`].filter(Boolean).join(", ") + " à l'équipe";
};

/* ── Une carte, au cadre du site, avec ce que le combat y ajoute ─────── */

function CarteDJ({ c, u = null, partie = null, cfgImage, fichiers }) {
  const cfg = useMemo(() => ({ ...cfgImage, extension: c.ext }), [cfgImage, c.ext]);
  const pct = u ? Math.max(0, (u.pv / u.pvMax) * 100) : 0;
  const statuts = [];
  if (u?.provoque) statuts.push("Provoque");
  if (u?.galva > 0) statuts.push("+2 ATQ");
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
        </div>
      )}
    </div>
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

function Plan({ partie, onEntrer, onSurvol }) {
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
            onClick={() => (ouvert ? onEntrer(n.id) : onSurvol(n.id))}
            onMouseEnter={() => onSurvol(n.id)} onFocus={() => onSurvol(n.id)}
            onKeyDown={(e) => { if (ouvert && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onEntrer(n.id); } }}>
            {ouvert && <circle className="halo" r={r} />}
            <circle className="fond" r={r} />
            <svg x={-ico / 2} y={-ico / 2} width={ico} height={ico} viewBox="0 0 20 20" className="dj-ico" aria-hidden="true">
              <Icone nom={etat === "fait" ? "succes" : ICONE_GENRE[n.genre]} taille={20} />
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
  const { etat, cfgImage, fichiers, mouvementReduit, donjon, tentativesRestantes, tentativesParJour, illimite,
    commencerDonjon, sauverPartie, terminerDonjon } = jeu;

  const partieRef = useRef(donjon.partie ? structuredClone(donjon.partie) : null);
  const combatRef = useRef(null);
  const [, redessiner] = useReducer((x) => x + 1, 0);
  // Une partie reprise revient à la carte, ou au choix de la sortie si le
  // gardien venait de tomber : les autres écrans ne se sauvent pas.
  const [ecran, setEcran] = useState(() => (!donjon.partie ? "preparation" : donjon.partie.ecran === "sortie" ? "sortie" : "carte"));
  const [choix, setChoix] = useState([]);
  const [artefact, setArtefact] = useState(null);
  const [survol, setSurvol] = useState(null);
  const [resultat, setResultat] = useState(null);
  const [rencontre, setRencontre] = useState(null);
  const [fin, setFin] = useState(null);
  const [strategie, setStrategie] = useState("manuel");
  const [vitesse, setVitesse] = useState(1);
  const [geste, setGeste] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [journal, setJournal] = useState([]);
  const zone = useRef(null);
  const minuteurs = useRef([]);
  const rnd = useRef(Math.random);
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
  const partir = () => {
    const equipe = choix.map((id) => collection.allies.find((c) => c.id === id)).filter(Boolean);
    if (equipe.length !== TAILLE_EQUIPE || tentativesRestantes <= 0) return;
    const jour = aujourdhui();
    const p = creerPartie({ equipe, artefact, graine: graineDuJour(jour), jour, pools: POOLS });
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
      const e = RENCONTRES[Math.floor(r() * RENCONTRES.length)];
      setRencontre({ e, texte: e.texte(n.lieu.nom), choix: e.choix(p, { r, pools: POOLS }) });
      return aller("rencontre");
    }
    aller("resultat");
  };

  const lancerCombat = (genre) => {
    const p = partieRef.current;
    sauverPartie(structuredClone({ ...p, ecran: "carte" }));
    combatRef.current = demarrerCombat(p, genre, rnd.current, POOLS);
    setJournal([genre === "boss" ? "Le gardien de l'étage se dresse." : `${combatRef.current.ennemis.length} adversaires.`]);
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
    if (!vivants(p.equipe).length) return terminer("defaite");
    setResultat({ titre: rencontre.e.titre, texte });
    aller("resultat");
  };

  const terminer = (iss) => {
    const p = partieRef.current;
    const butin = rapporte(p, iss);
    const complete = iss === "sortie" && p.etage >= ETAGES && p.stats.gardiens >= ETAGES;
    const po = terminerDonjon(butin, { issue: iss, etage: p.etage, gardiens: p.stats.gardiens, complete });
    setFin({ issue: iss, butin, perdu: p.sac - butin, po, stats: { ...p.stats }, etage: p.etage, debout: vivants(p.equipe).length, total: p.equipe.length, reliques: p.reliques.length });
    combatRef.current = null;
    partieRef.current = null;
    setEcran("fin");
    window.scrollTo({ top: 0 });
  };

  /* ── Combat : le fil ─────────────────────────────────────────────── */
  const el = (uid) => zone.current?.querySelector(`.dj-u[data-uid="${uid}"]`);

  const ruer = async (att, cible) => {
    const a = el(att.uid), b = el(cible.uid);
    if (!a || !b || mouvementReduit) return;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const dx = rb.left + rb.width / 2 - (ra.left + ra.width / 2), dy = rb.top + rb.height / 2 - (ra.top + ra.height / 2);
    const t = 460 / vitesseRef.current;
    a.style.zIndex = 10;
    const anim = a.animate([
      { transform: "translate(0,0) rotate(0) scale(1)" },
      { transform: `translate(${-dx * 0.06}px, ${-dy * 0.06}px) rotate(${dx > 0 ? -4 : 4}deg) scale(1.02)`, offset: 0.25 },
      { transform: `translate(${dx * 0.62}px, ${dy * 0.62}px) rotate(${dx > 0 ? 6 : -6}deg) scale(1.08)`, offset: 0.52 },
      { transform: "translate(0,0) rotate(0) scale(1)" },
    ], { duration: t, easing: "cubic-bezier(.35,.1,.3,1)" });
    setTimeout(() => {
      b.classList.remove("touche"); void b.offsetWidth; b.classList.add("touche");
      const e = document.createElement("span"); e.className = "dj-eclat"; b.appendChild(e);
      setTimeout(() => e.remove(), 400);
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
    if (["attaque", "lourde", "vise", "coupbas"].includes(g) && cible) await ruer(u, cible);
    else await pulser(u);
    const res = resoudre(p, CC, u, g, cible, rnd.current);
    setJournal((j) => [res.note, ...j].slice(0, 12));
    redessiner();
    requestAnimationFrame(() => montrer(res.effets));
    await new Promise((ok) => setTimeout(ok, 560 / vitesseRef.current));
    if (combatRef.current !== CC) return;
    const fin = issue(p, CC);
    if (fin === "victoire") {
      CC.fini = "victoire";
      const r = victoire(p, CC, rnd.current, POOLS.artefacts);
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
      const id = setTimeout(() => { const { geste: g, cible } = choixIA(p, CC, u, rnd.current); executer(u, g, cible); }, 480 / vitesse);
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
    if (occupe) return;
    combatRef.current.fini = "fuite";
    setResultat(fuir(partieRef.current));
    combatRef.current = null;
    if (!vivants(partieRef.current.equipe).length) return terminer("defaite");
    aller("resultat");
  };

  // Une partie reprise au milieu d'un combat : on revient à la carte, le
  // combat se rejouera depuis son premier tour.
  useEffect(() => { if (ecran === "combat" && !combatRef.current) setEcran("carte"); }, [ecran]);

  /* ── Rendu ───────────────────────────────────────────────────────── */
  const entete = partie && (
    <div className="dj-entete">
      <span className="pastille">Étage <b>{partie.etage}</b> / {ETAGES}</span>
      <span className="pastille or">Sac <b>{partie.sac}</b> pièces</span>
    </div>
  );

  if (ecran === "preparation" || (!partie && ecran !== "fin")) {
    const n = choix.length;
    const plus = tentativesRestantes > 0;
    return (
      <div className="dj">
        <p className="dj-intro">
          Choisissez quatre compagnons de votre collection et un artéfact. Chaque étage est une carte : vous tracez
          votre chemin, salle après salle, jusqu'au gardien. Vaincu, il vous laisse remonter avec le butin — ou
          descendre, là où il pèse plus lourd. Si l'équipe tombe, il ne reste qu'un quart du sac.
        </p>
        <p className="muted petit">
          Le donjon du {dateFr(aujourdhui())} est le même pour tous les joueurs.{" "}
          {illimite ? "Mode test : tentatives illimitées." : `Tentatives restantes aujourd'hui : ${tentativesRestantes} sur ${tentativesParJour}.`}
          {" "}Le butin rapporté est versé à la bourse ({String(DONJON.multiplicateur).replace(".", ",")} PO par pièce).
        </p>
        {donjon.dernier && donjon.dernier.jour === aujourdhui() && (
          <p className="avis">Dernière descente : {donjon.dernier.issue === "defaite" ? "l'équipe est tombée" : "remontée"} à l'étage {donjon.dernier.etage}, {donjon.dernier.po} PO versées à la bourse.</p>
        )}

        {collection.allies.length < TAILLE_EQUIPE ? (
          <section className="panneau"><h3>Pas encore d'équipe</h3>
            <p className="muted">Il faut au moins {TAILLE_EQUIPE} PNJ alliés dans votre collection pour descendre. Les créatures, les animaux et les criminels sont dans l'autre camp.</p></section>
        ) : (
          <>
            <div className="section-titre sous-titre"><h2>Vos compagnons <span className="muted petit">({n} / {TAILLE_EQUIPE})</span></h2></div>
            <p className="muted petit dj-aide">Le rôle vient de l'archétype de la carte ; l'initiative, du rôle et du palier.</p>
            <div className="dj-grille">
              {collection.allies.map((c) => {
                const pris = choix.includes(c.id);
                const u = allie({ uid: 0 }, c), R = ROLES[u.role];
                return (
                  <button key={`${c.ext}:${c.id}`} type="button" aria-pressed={pris}
                    className={`dj-choix${pris ? " pris" : ""}${n >= TAILLE_EQUIPE && !pris ? " grise" : ""}`}
                    onClick={() => setChoix((l) => (l.includes(c.id) ? l.filter((x) => x !== c.id) : l.length < TAILLE_EQUIPE ? [...l, c.id] : l))}>
                    {pris && <span className="dj-coche" aria-hidden="true">✓</span>}
                    <CarteDJ c={c} cfgImage={cfgImage} fichiers={fichiers} />
                    <span className="dj-role"><b>{R.nom}</b> · {u.pvMax} PV · {u.atq} ATQ · INI {u.ini}
                      <span className="muted">{R.cap.nom} : {R.cap.aide}</span></span>
                  </button>
                );
              })}
            </div>
            <div className="section-titre sous-titre"><h2>Un artéfact <span className="muted petit">(facultatif)</span></h2></div>
            {collection.artefacts.length === 0 ? <p className="muted petit">Aucun artéfact dans votre collection.</p> : (
              <div className="dj-grille">
                {collection.artefacts.map((a) => (
                  <button key={`${a.ext}:${a.id}`} type="button" aria-pressed={artefact?.id === a.id}
                    className={`dj-choix${artefact?.id === a.id ? " pris" : ""}`} onClick={() => setArtefact((x) => (x?.id === a.id ? null : a))}>
                    {artefact?.id === a.id && <span className="dj-coche" aria-hidden="true">✓</span>}
                    <CarteDJ c={a} cfgImage={cfgImage} fichiers={fichiers} />
                    <span className="dj-role">{bonusTexte(a.tier)}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="actions gauche dj-partir">
              <button className="btn" type="button" onClick={partir} disabled={n !== TAILLE_EQUIPE || !plus}>
                {plus ? "Descendre avec cette équipe" : "Plus de tentative aujourd'hui"}
              </button>
            </div>
          </>
        )}
        <Regles />
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
          <table className="dj-tableau"><tbody>
            <tr><td>Étage atteint</td><td>{fin.etage} / {ETAGES}</td></tr>
            <tr><td>Salles traversées</td><td>{fin.stats.salles}</td></tr>
            <tr><td>Adversaires vaincus</td><td>{fin.stats.ennemis}</td></tr>
            <tr><td>Gardiens</td><td>{fin.stats.gardiens}</td></tr>
            <tr><td>Reliques</td><td>{fin.reliques}</td></tr>
            <tr><td>Compagnons debout</td><td>{fin.debout} / {fin.total}</td></tr>
          </tbody></table>
          <div className="actions gauche">
            <button className="btn" type="button" onClick={() => { setFin(null); setChoix([]); setEcran("preparation"); }}>
              {tentativesRestantes > 0 ? "Préparer une autre descente" : "Retour"}
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
    return (
      <div className="dj">
        {entete}
        <div className="dj-etage">
          <div className="dj-planbox">
            <h2>Étage {partie.etage}</h2>
            <p className="muted petit">{partie.plan.pos ? "Choisissez la salle suivante" : "Choisissez par où entrer"} — les passages lumineux sont accessibles.</p>
            <Plan partie={partie} onEntrer={entrerSalle} onSurvol={setSurvol} />
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
      </div>
    );
  }

  if (ecran === "combat" && C) {
    const actif = C.actif ? parUid(partie, C, C.actif) : null;
    const monTour = actif && actif.camp === "a" && strategie === "manuel" && !occupe && !C.fini;
    const liste = monTour ? gestes(partie, actif) : [];
    const def = monTour && geste ? liste.find((x) => x.id === geste) : null;
    const ordre = C.ordre.map((uid, i) => ({ u: parUid(partie, C, uid), i })).filter((x) => x.u && !x.u.ko);
    const unite = (u) => {
      const ciblable = def && !u.ko && ((def.cible === "e") === (u.camp === "e"));
      return (
        <div key={u.uid} data-uid={u.uid}
          className={`dj-u${u.uid === C.actif ? " actif" : ""}${u.ko ? " ko" : ""}${ciblable ? ` ciblable${u.camp === "a" ? " allie" : ""}` : ""}${u.boss ? " boss" : ""}`}
          {...(ciblable ? { role: "button", tabIndex: 0, "aria-label": `Cibler ${u.nomAffiche || u.c.nom}`,
            onClick: () => cibler(u), onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cibler(u); } } } : {})}>
          <CarteDJ c={u.c} u={u} partie={partie} cfgImage={cfgImage} fichiers={fichiers} />
          <span className="dj-etiquette">{u.camp === "a" ? ROLES[u.role].nom : u.boss ? "Gardien" : u.elite ? `Élite · ${TRAITS[u.role]}` : TRAITS[u.role]}</span>
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
          <div className="dj-frise" aria-label="Ordre d'initiative du tour">
            <span className="tour">Tour {C.round}</span>
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
          <div className="dj-rang">{partie.equipe.map(unite)}</div>
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
              {C.genre !== "boss" && <button className="btn quiet sm" type="button" onClick={seReplier} disabled={occupe || !!C.fini}>Fuir (−20 % du sac)</button>}
            </div>
          </div>
          <p className="muted petit">{STRATEGIES[strategie].aide}</p>
        </div>
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
    const dernier = partie.etage >= ETAGES;
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
                : "Remonter maintenant, c'est tout garder. Descendre, c'est des adversaires plus durs et des bourses plus lourdes — mais si l'équipe tombe, il ne restera qu'un quart du sac. L'équipe souffle un peu avant de descendre."}</p>
            )}
            <MiniEquipe partie={partie} />
            <div className="actions gauche">
              {ecran === "sortie" ? (
                <>
                  <button className="btn" type="button" onClick={() => terminer("sortie")}>Remonter avec {partie.sac} pièces</button>
                  {!dernier && <button className="btn quiet" type="button" onClick={() => { descendre(partie, POOLS); setSurvol(null); setResultat(null); aller("carte"); }}>Descendre à l'étage {partie.etage + 1}</button>}
                </>
              ) : (
                <>
                  <button className="btn" type="button" onClick={() => aller("carte")}>Retour à la carte</button>
                  <button className="btn quiet" type="button" onClick={() => terminer("sortie")}>Remonter avec {partie.sac} pièces</button>
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
        <li><b>Défaite</b> : il ne reste qu'un quart du sac.</li>
      </ul>
    </details>
  );
}

