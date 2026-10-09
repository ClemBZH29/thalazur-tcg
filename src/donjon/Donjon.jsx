import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import FaceCarte from "../components/FaceCarte.jsx";
import Icone from "../components/Icone.jsx";
import { BOOSTERS } from "../extensions/index.js";
import { DONJON, TIER_INFO, poDuButin } from "../config/tiers.js";
import { resoudreImage } from "../lib/images.js";
import {
  BONUS_ARTEFACT, bonusEquipe, GENRES, MODES, etagesDe, graineInfinie, RANGS, RENCONTRES, ROLES, STRATEGIES, TRAITS,
  atqDe, cartesDonjon, choixAuto, choixIA, creerPartie, demarrerCombat, descendre, entrer, fuir,
  gestes, graineDuJour, issue, ouverts, parUid, prochain, rapporte, repos, resoudre,
  tresor, victoire, vivants, allie, compositionDuJour, ciblesPossibles, convalescences, fiche, peutFuir, gainsXP,
  apprentissage, descentesJouees, brume, tirage, BRUME_TOUR, COMPETENCES, techDe, unites, roleCarte, RELIQUES_MAX,
  impositionTenable, manqueSource,
} from "./regles.js";
import { etoiles, ficheDe, fichesDe } from "./fiches.js";
import { effetsArtefact, effetsSource, sourceDe, texteEffets } from "./pouvoirs.js";
import { Etoile } from "../components/VoletCombat.jsx";
import { NIVEAU_MAX, PALIER_IRISEE, avancement, xpDe } from "./experience.js";
import "../styles/donjon.css";
import "../styles/donjon-animations.css";
import * as Son from "../son/index.js";
import { creerAnimationsDonjon } from "./animations.js";
import { idPartie } from "../jeu/donjon.js";

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
/** Ce que vaut en PO un gain de `n` pièces, sac déjà compté (la conversion de l'infini est concave). */
const poGagne = (p, n) => poDuButin(p.sac, p.mode) - poDuButin(Math.max(0, p.sac - (n || 0)), p.mode);
const initiales = (n) => String(n).split(/[\s,'’-]+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join("");
const nouvelleGraine = () => Math.floor(Math.random() * 4294967296) >>> 0;
const pourcent = (x) => `${Math.round(x * 100)} %`;
/**
 * L'écran où reprend une partie enregistrée : la carte, ou le choix de la
 * sortie si le gardien venait de tomber ; les autres écrans ne se sauvent pas.
 */
const ecranDe = (p) => (!p ? "preparation" : p.ecran === "sortie" ? "sortie" : p.combat ? "combat" : p.rencontre ? "rencontre" : "carte");
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
  if (u?.parade > 0) statuts.push(`Armure +${u.parade}`);
  if (u?.riposte > 0) statuts.push("Garde haute");
  if (u?.voile) statuts.push("Voilé");
  if (u?.marque > 0) statuts.push("Marqué");
  if (u?.saigne > 0) statuts.push("Saigne");
  if (u?.etourdi > 0) statuts.push("Piégé");
  if (u?.camp === "a" && u.cd > 0) statuts.push(`Recharge ${u.cd}`);
  return (
    <div className={`dj-carte cardbox${u?.etoiles ? " star" : ""}${u?.etoiles && Object.keys(u.etoiles).length === 4 ? " star-pleine" : ""}`}>
      {u?.camp === "a" && u.etoiles && <EtoilesCarte n={Object.keys(u.etoiles).length} petit />}
      <div className="dj-face"><FaceCarte c={c} cfgImage={cfg} fichiers={fichiers} vignette /></div>
      {u && (
        <span className="dj-etats" aria-hidden="true">
          <i className="e-saigne"><b /><b /><b /></i><i className="e-marque" /><i className="e-piege" /><i className="e-voile" />
          <i className="e-garde" /><i className="e-pavois" /><i className="e-provoque" /><i className="e-galva" />
        </span>
      )}
      {u && (
        <div className="dj-sur" aria-hidden="true">
          <span className="dj-badges">
            <b className={`atq${u.etoiles?.atq ? " et" : ""}`}>ATQ {atqDe(partie, u)}</b>
            <b className={`ini${u.etoiles?.ini ? " et" : ""}`}>INI {u.ini}</b>
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
          {(u.provoque > 0 || u.galva > 0 || u.rempart > 0 || u.parade > 0 || u.riposte > 0 || u.voile > 0 || u.marque > 0 || u.saigne > 0 || u.etourdi > 0) && <span className="dj-etat-point" />}
        </div>
      )}
    </div>
  );
}

/**
 * Une rangée de cartes qui défile à l'horizontale. Au doigt : on la fait
 * glisser, carte par carte (scroll-snap). À la souris : survoler un bord la
 * fait défiler en continu, cliquer dessus avance d'une page. Les bords
 * n'apparaissent que s'il reste quelque chose à voir de ce côté.
 */
function Rangee({ titre, nb, pris = 0, aide = "", classe = "", icone = null, quota = null, complet = false, children }) {
  const piste = useRef(null);
  const [bords, setBords] = useState({ g: false, d: false });
  const elan = useRef(null);
  useEffect(() => {
    const el = piste.current;
    if (!el) return;
    const maj = () => setBords({ g: el.scrollLeft > 4, d: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    maj();
    el.addEventListener("scroll", maj, { passive: true });
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(maj) : null;
    ro?.observe(el);
    return () => { el.removeEventListener("scroll", maj); ro?.disconnect(); cancelAnimationFrame(elan.current); };
  }, []);
  // L'aimantation (scroll-snap) ramènerait chaque petit pas à la carte d'avant :
  // elle est suspendue le temps du survol, et reprend à la fin.
  const glisser = (sens) => {
    cancelAnimationFrame(elan.current);
    if (piste.current) piste.current.style.scrollSnapType = "none";
    const pas = () => { const el = piste.current; if (!el) return; el.scrollLeft += sens * 9; elan.current = requestAnimationFrame(pas); };
    elan.current = requestAnimationFrame(pas);
  };
  const arreter = () => { cancelAnimationFrame(elan.current); if (piste.current) piste.current.style.scrollSnapType = ""; };
  const page = (sens) => piste.current?.scrollBy({ left: sens * piste.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className={`dj-rangee ${classe}`} aria-label={titre}>
      <header className="dj-rangee-tete">
        <h3>{icone && <Icone nom={icone} taille={17} className="dj-rangee-icone" />}{titre}
          {quota ? <span className={`dj-quota${complet ? " ok" : ""}`}>{quota}</span>
            : <span className="muted petit">{nb}{pris ? ` · ${pris} choisi${pris > 1 ? "s" : ""}` : ""}</span>}</h3>
        {aide && <span className="muted petit dj-rangee-aide">{aide}</span>}
      </header>
      <div className="dj-rangee-cadre">
        {bords.g && <button type="button" className="dj-rangee-bord g" aria-label={`Faire défiler ${titre} vers la gauche`}
          onMouseEnter={() => glisser(-1)} onMouseLeave={arreter} onClick={() => page(-1)}>‹</button>}
        <div className="dj-rangee-piste" ref={piste}>{children}</div>
        {bords.d && <button type="button" className="dj-rangee-bord d" aria-label={`Faire défiler ${titre} vers la droite`}
          onMouseEnter={() => glisser(1)} onMouseLeave={arreter} onClick={() => page(1)}>›</button>}
      </div>
    </section>
  );
}

/** La pastille STAR : le nombre de lignes étoilées, « STAR » aux quatre. */
function EtoilesCarte({ n, petit = false }) {
  return (
    <span className={`dj-star${n === 4 ? " pleine" : ""}${petit ? " petit" : ""}`} aria-hidden="true">
      <Etoile taille={petit ? 10 : 12} />{n === 4 ? "STAR" : `${n}/4`}
    </span>
  );
}

/** Une pastille de donnée : une icône, un chiffre ou un mot. */
function Puce({ icone = null, or = false, children }) {
  return <span className={`dj-puce${or ? " or" : ""}`}>{icone && <Icone nom={icone} taille={13} />}{children}</span>;
}
/** Une stat : son icône et sa valeur. */
function Stat({ icone, children }) {
  return <span className={`dj-stat s-${icone}`}><Icone nom={icone} taille={12} />{children}</span>;
}

/**
 * Remonter termine la descente : on le demande deux fois. Le premier appui
 * arme le bouton, le second remonte ; sans suite, il se désarme.
 */
function BoutonRemonter({ po, onRemonter, className = "btn quiet" }) {
  const [arme, setArme] = useState(false);
  useEffect(() => {
    if (!arme) return;
    const id = setTimeout(() => setArme(false), 4000);
    return () => clearTimeout(id);
  }, [arme]);
  return (
    <button type="button" className={`${className}${arme ? " dj-arme" : ""}`} onClick={() => (arme ? onRemonter() : (Son.jouer("donjon.carte.confirmer"), setArme(true)))}>
      {arme ? `Confirmer : remonter · ${po} PO` : `Remonter · ${po} PO`}
    </button>
  );
}

/** Les états d'une unité, en classes pour leurs calques (donjon-animations.css). */
const etatsDe = (u) => [
  u.saigne > 0 && "etat-saigne", u.marque > 0 && "etat-marque", u.etourdi > 0 && "etat-piege", u.voile && "etat-voile",
  u.riposte > 0 && "etat-garde", u.parade > 0 && "etat-bouclier", u.provoque && "etat-provoque", u.galva > 0 && "etat-galva",
].filter(Boolean).map((x) => ` ${x}`).join("");

function Jeton({ u, cls = "", cfgImage, fichiers }) {
  const src = resoudreImage(u.c, { ...cfgImage, extension: u.c.ext }, fichiers, { vignette: true });
  const [rate, setRate] = useState(false);
  return (
    <span className={`dj-jeton ${u.camp} ${cls}`} data-uid={u.uid} data-camp={u.camp} title={`${u.nomAffiche || u.c.nom} — initiative ${u.ini}`}>
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

/** Ce que toutes les reliques (et l'autel) donnent à l'équipe, en clair. */
const totalTexte = (partie) => {
  const b = bonusEquipe(partie);
  return [b.atq && `+${b.atq} ATQ`, b.pv && `+${b.pv} PV max`].filter(Boolean).join(" · ") || "aucun bonus";
};
const bonusCourt = (t) => {
  const b = BONUS_ARTEFACT[t] || BONUS_ARTEFACT.commun;
  return [b.atq && `+${b.atq} ATQ`, b.pv && `+${b.pv} PV`].filter(Boolean).join(" ");
};

/**
 * Les reliques de la descente, chacune avec son effet, et le total qu'elles
 * donnent à toute l'équipe : on voyait des noms, sans savoir ce qu'ils
 * faisaient ni s'ils comptaient.
 */
function Reliques({ partie }) {
  const l = [partie.artefact, ...partie.reliques].filter(Boolean);
  if (!l.length && !partie.benediction) return <p className="muted petit">Aucune relique.</p>;
  return (
    <>
      <p className="dj-reliques-total">
        Toute l'équipe : <b>{totalTexte(partie)}</b>
        <span className="muted"> · {partie.reliques.length} / {RELIQUES_MAX} reliques (au-delà, elles partent au sac)</span>
      </p>
      <div className="dj-reliques">
        {l.map((a, i) => (
          <span key={i} data-palier={a.tier} title={`${TIER_INFO[a.tier]?.nom || ""} — ${bonusTexte(a.tier)} ; ${texteEffets(effetsArtefact(a))}`}>
            {a.nom} <i>{bonusCourt(a.tier)}</i> <small>{texteEffets(effetsArtefact(a))}</small>
          </span>
        ))}
        {partie.benediction > 0 && <span data-palier="legendaire">Autel <i>+{partie.benediction} ATQ</i></span>}
      </div>
    </>
  );
}

/**
 * Une relique trouvée : la carte, ce qu'elle donne, et le nouveau total de
 * l'équipe. Elle s'annonçait par une ligne de texte sous le butin.
 */
function ReliqueTrouvee({ a, partie, cfgImage, fichiers }) {
  return (
    <div className="dj-trouvaille" data-palier={a.tier} role="status">
      <div className="dj-trouvaille-carte"><CarteDJ c={a} cfgImage={cfgImage} fichiers={fichiers} /></div>
      <div className="dj-trouvaille-texte">
        <span className="dj-trouvaille-titre">Relique trouvée</span>
        <b className="dj-trouvaille-nom">{a.nom}</b>
        <span className="muted petit">{TIER_INFO[a.tier]?.nom}</span>
        {a.vendue ? (
          <span className="dj-trouvaille-effet" title={`Les mains sont pleines (${RELIQUES_MAX} reliques) : elle part au sac.`}>Mains pleines · vendue +{a.vendue} pièces</span>
        ) : (
          <>
            <span className="dj-trouvaille-effet">{bonusTexte(a.tier).replace(" à l'équipe", "")}</span>
            <span className="dj-trouvaille-pouvoir">{texteEffets(effetsArtefact(a))}</span>
            <span className="muted petit" title="Une même mécanique ne compte qu'une fois, la plus forte.">Équipe : {totalTexte(partie)}</span>
          </>
        )}
      </div>
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
    entreeInfini, peutPayerInfini, imposition, fixerImposition, recordInfini, commencerDonjon, sauverPartie, terminerDonjon,
    convalescence, niveauCarte, enExpedition } = jeu;

  const partieRef = useRef(donjon.partie ? structuredClone(donjon.partie) : null);
  const combatRef = useRef(null);
  const [, redessiner] = useReducer((x) => x + 1, 0);
  const [ecran, setEcran] = useState(() => ecranDe(donjon.partie));
  // Un mot à la préparation : la descente close ou reprise dans un autre onglet.
  const [avis, setAvis] = useState(null);
  const [choix, setChoix] = useState([]);
  // Le donjon du jour d'abord, tant qu'il reste sa descente.
  const [mode, setMode] = useState(() => (tentativesRestantes > 0 ? "jour" : "infini"));
  // La source de pouvoir : la clé « extension:lieu » choisie à la préparation.
  const [sourceCle, setSourceCle] = useState(null);
  const [survol, setSurvol] = useState(null);
  const [resultat, setResultat] = useState(null);
  // Le bandeau qui remplace les écrans sans décision (victoire ordinaire, trésor, repos).
  const [bandeau, setBandeau] = useState(null);
  useEffect(() => {
    if (!bandeau) return;
    const id = setTimeout(() => setBandeau(null), 2800);
    return () => clearTimeout(id);
  }, [bandeau]);
  const [rencontre, setRencontre] = useState(() => (partieRef.current?.rencontre ? monterRencontre(partieRef.current) : null));
  const [fin, setFin] = useState(null);
  const [strategie, setStrategie] = useState("manuel");
  // La dernière stratégie automatique choisie : le bouton Auto y revient.
  const dernierAuto = useRef("concentrer");
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
  // La page est-elle encore là ? Un geste en cours (`executer`) continue ses
  // await après le départ du joueur : sans ce garde, il concluait le combat
  // après le nettoyage, et programmait une fin de descente hors de la page.
  const monte = useRef(false);
  const differer = (fn, ms) => { const id = setTimeout(() => { if (monte.current) fn(); }, ms); minuteurs.current.push(id); };
  useEffect(() => {
    monte.current = true;
    return () => { monte.current = false; minuteurs.current.forEach(clearTimeout); minuteurs.current = []; };
  }, []);
  /** Le combat `CC` est-il toujours celui de la page ? Vérifié après chaque attente. */
  const vif = (CC) => monte.current && combatRef.current === CC;

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
    const triLieu = (a, b) => ORDRE_PALIERS.indexOf(a.tier) - ORDRE_PALIERS.indexOf(b.tier) || a.nom.localeCompare(b.nom);
    return { allies: POOLS.allies.filter(possede).sort(tri), lieux: POOLS.lieux.filter(possede).sort(triLieu) };
  }, [etat.collections]);

  /* ── Déroulé ─────────────────────────────────────────────────────── */
  const apprenti = apprentissage(descentesJouees(etat.stats), DONJON.apprentissage);

  /* Le donjon du jour impose quatre rôles et sa source : tirés à la première
     visite du jour parmi les cartes disponibles, puis figés (jeu/donjon.js). */
  const disponible = (c) => !enExpedition?.(c) && (illimite || !convalescence(c));
  // Sans lieu, pas de donjon du jour : sa source est imposée parmi les lieux.
  const sansLieu = collection.lieux.length === 0;
  useEffect(() => { if (sansLieu && mode === "jour") setMode("infini"); }, [sansLieu, mode]);
  // L'imposition figée ne vaut que tant qu'elle peut être remplie : une carte
  // sortie de la collection (STAR RESET) ou partie au repos la rend caduque,
  // et elle est alors retirée au sort sur ce qui reste (voir impositionTenable).
  const imposeDuJour = imposition && impositionTenable(imposition, collection.allies.filter((c) => illimite || !convalescence(c)), collection.lieux)
    ? imposition : null;
  useEffect(() => {
    if (sansLieu || imposeDuJour || partieRef.current || tentativesRestantes <= 0) return;
    const i = compositionDuJour(aujourdhui(), collection.allies.filter(disponible), collection.lieux.filter((l) => !enExpedition?.(l)));
    if (i) fixerImposition(i);
  }, [sansLieu, imposeDuJour, tentativesRestantes, collection]); // eslint-disable-line react-hooks/exhaustive-deps
  const impose = mode === "jour" ? imposeDuJour : null;
  const quota = impose?.roles || null;
  const parRoleChoisi = (ids) => {
    const m = {};
    for (const id of ids) { const c = collection.allies.find((x) => x.id === id); if (c) m[roleCarte(c)] = (m[roleCarte(c)] || 0) + 1; }
    return m;
  };
  const composition = parRoleChoisi(choix);
  const peutPrendre = (c) => !quota || (composition[roleCarte(c)] || 0) < (quota[roleCarte(c)] || 0);
  const compoFaite = !quota || Object.entries(quota).every(([r, k]) => (composition[r] || 0) === k);
  // La source : imposée au donjon du jour, choisie à l'infini.
  const cleSource = impose ? impose.lieu : sourceCle;
  const choisirMode = (m) => {
    setMode(m);
    const q = m === "jour" ? imposeDuJour?.roles : null;
    if (!q) return;
    // On garde ce qui entre dans la composition du jour, dans l'ordre du choix.
    setChoix((l) => {
      const k = {};
      return l.filter((id) => {
        const c = collection.allies.find((x) => x.id === id), r = c && roleCarte(c);
        if (!r || (k[r] || 0) >= (q[r] || 0)) return false;
        k[r] = (k[r] || 0) + 1; return true;
      });
    });
  };

  const partir = () => {
    const equipe = choix.map((id) => collection.allies.find((c) => c.id === id)).filter((c) => c && !enExpedition?.(c));
    if (equipe.length !== TAILLE_EQUIPE || (mode === "jour" && (sansLieu || tentativesRestantes <= 0 || !impose || !compoFaite))) return;
    if (mode === "infini" && !peutPayerInfini) return;
    if (manqueSource({ impose, lieux: collection.lieux, cle: cleSource, enExpedition })) return;
    const jour = aujourdhui();
    const niveaux = Object.fromEntries(equipe.map((c) => [`${c.ext}:${c.id}`, niveauCarte(c)]));
    const fiches = fichesDe(etat, equipe);
    const M = DONJON.modes[mode];
    const graine = mode === "infini" ? graineInfinie() : graineDuJour(jour);
    const lieu = cleSource ? collection.lieux.find((l) => `${l.ext}:${l.id}` === cleSource && !enExpedition?.(l)) : null;
    const source = lieu ? { c: lieu, niveau: niveauCarte(lieu), etoile: !!ficheDe(etat, lieu).etoiles?.source } : null;
    // L'apprentissage adoucit les adversaires partout, mais ne rogne le butin qu'au
    // donjon du jour : l'infini se paie à l'entrée.
    const ap = mode === "infini" ? { ...apprenti, gain: 1 } : apprenti;
    const p = creerPartie({ equipe, source, graine, jour, pools: POOLS, niveaux, fiches, apprenti: ap, mode, gainMode: M.gain, xpMode: M.xp });
    // L'identité de la descente : la graine ne suffit pas (celle du jour est la
    // même pour toutes les descentes du jour, en mode test). C'est elle qui
    // empêche un autre onglet de la sauver par-dessus une autre, ou de se la
    // faire payer deux fois (voir jeu/donjon.js).
    p.id = `${graine.toString(36)}-${Date.now().toString(36)}-${nouvelleGraine().toString(36)}`;
    if (!commencerDonjon(structuredClone(p))) { setAvis("Une descente est déjà en cours dans un autre onglet."); return; }
    partieRef.current = p;
    setAvis(null);
    setEcran("carte");
    window.scrollTo({ top: 0 });
  };

  const entrerSalle = (id) => {
    const p = partieRef.current;
    const n = entrer(p, id);
    if (!n) return;
    const r = rnd.current;
    Son.jouer("donjon.carte.choisir");
    if (n.genre === "combat" || n.genre === "elite" || n.genre === "boss") {
      Son.jouer(n.genre === "boss" ? "donjon.carte.gardien" : "donjon.carte.combat");
      return lancerCombat(n.genre);
    }
    Son.jouer("donjon.carte.reveler");
    // Pas d'écran sans décision : un trésor sans relique et un repos se
    // lisent en bandeau sur la carte ; une relique gagnée a son écran.
    if (n.genre === "tresor" || n.genre === "repos") {
      const R = n.genre === "tresor" ? tresor(p, r, POOLS.artefacts) : repos(p);
      if (n.genre === "repos") Son.jouer("donjon.rencontre.repos");
      if (!R.relique) {
        sonPieces(R.po);
        setBandeau({ cle: Date.now(), titre: R.titre, po: poGagne(p, R.po), texte: n.genre === "repos" ? "L'équipe panse ses plaies" : null });
        return aller("carte");
      }
      setResultat(R);
    } else {
      p.rencontre = { id: RENCONTRES[Math.floor(r() * RENCONTRES.length)].id, graine: nouvelleGraine() };
      setRencontre(monterRencontre(p));
      // Autel et voyageur blessé ont leur son ; les autres rencontres, le parchemin.
      Son.jouer({ autel: "donjon.rencontre.autel", blesse: "donjon.rencontre.recrue" }[p.rencontre.id] || "donjon.rencontre.autre");
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
    const CC = combatRef.current;
    // La première salve a pu en abattre : debout à l'écran jusqu'à ce qu'elle les touche.
    koVu.current.clear();
    for (const x of CC.ennemis) if (x.ko) koVu.current.set(x.uid, false);
    cdVu.current = new Map(p.equipe.map((u) => [u.uid, u.cd || 0]));
    differer(() => Son.jouer("donjon.combat.debut"), 350);
    // Un PNJ d'une faction rivale parmi les adversaires : la tension des cordes.
    if (CC.ennemis.some((x) => x.c?.type === "pnj")) differer(() => Son.jouer("donjon.rencontre.rival"), 700);
    setJournal([
      ...CC.ouverture.map((o) => o.note).reverse(),
      ...(CC.relique ? [`Ils portent ${CC.relique.nom} : battez-les pour la prendre.`] : []),
      reprise ? "Le combat reprend à son premier tour." : p.combat.genre === "boss" ? "Le gardien de l'étage se dresse." : `${CC.ennemis.length} adversaires.`,
    ]);
    setGeste(null); setOccupe(true);
    setEcran("combat");
    window.scrollTo({ top: 0 });
    differer(async () => {
      CC.lance = true;
      // La première salve s'affiche, puis le premier tour ; elle peut avoir tout fini.
      // La source s'annonce au premier tour ; la première salve part.
      animRef.current.animerSource?.(p.source ? { ...p.source, pouvoir: sourceDe(p.source.c).nom } : null, CC);
      if (p.source) Son.jouer("donjon.lieu.pose", { rarete: Son.rareteDe(p.source.c.tier), rainbow: !!p.source.etoile });
      if (CC.relique) animRef.current.animerRelique?.(CC.relique, { moment: "porte", porteurs: CC.ennemis.filter((x) => !x.ko) });
      if (CC.relique) Son.jouer("donjon.artefact.eveil", { rarete: Son.rareteDe(CC.relique.tier), camp: "adverse" });
      animerPouvoirs(CC.ouverture.map((o) => o.pouvoir));
      if (CC.ouverture.length) {
        requestAnimationFrame(() => montrer(CC.ouverture.flatMap((o) => o.effets)));
        // Les tombés de la salve chutent quand elle arrive, pas avant.
        if (CC.ennemis.some((x) => x.ko)) await new Promise((ok) => setTimeout(ok, 480 / vitesseRef.current));
        if (!vif(CC)) return;
      }
      const fin = await passerLaMain(p, CC);
      if (!vif(CC)) return;
      if (fin) return conclure(fin, p, CC);
      setOccupe(false); redessiner();
    }, 500);
  };

  const choisirRencontre = (i) => {
    const ch = rencontre.choix[i];
    if (!ch || ch.ok === false) return;
    const p = partieRef.current;
    const avant = p.reliques.length;
    const texte = ch.f();
    p.rencontre = null;
    if (!vivants(p.equipe).length) return terminer("defaite");
    // Une rencontre peut donner une relique (l'écho) : elle s'annonce comme les autres.
    setResultat({ titre: rencontre.e.titre, texte, relique: p.reliques.length > avant ? p.reliques.at(-1) : null });
    aller("resultat");
  };

  const terminer = (iss) => {
    const p = partieRef.current;
    if (iss === "sortie") Son.jouer("donjon.carte.remonter");
    const butin = rapporte(p, iss);
    const complete = p.mode !== "infini" && iss === "sortie" && p.etage >= etagesDe(p) && p.stats.gardiens >= etagesDe(p);
    const repos = convalescences(p, iss);
    const infini = p.mode === "infini";
    const record = infini && p.stats.gardiens > recordInfini;
    const { po, bilan, refusee } = terminerDonjon(butin, { issue: iss, etage: p.etage, gardiens: p.stats.gardiens, complete, mode: p.mode || "jour", id: idPartie(p) }, repos, gainsXP(p, iss));
    // Close ou remplacée ailleurs entre-temps : rien n'est payé, pas de bilan.
    if (refusee) return fermerDescente();
    const noms = new Map([...p.equipe.map((u) => u.c), ...p.perdus].map((c) => [`${c.ext}:${c.id}`, c.nom]));
    setFin({ issue: iss, butin, perdu: p.sac - butin, po, stats: { ...p.stats }, etage: p.etage, debout: vivants(p.equipe).length,
      mode: p.mode || "jour", record,
      total: p.equipe.length, reliques: p.reliques.map((a) => a.nom), repos: repos.map((x) => ({ nom: noms.get(x.cle), cle: x.cle, jours: x.jours })), xp: bilan,
      tombes: p.equipe.filter((u) => u.ko).map((u) => `${u.c.ext}:${u.c.id}`) });
    combatRef.current = null;
    partieRef.current = null;
    setEcran("fin");
    window.scrollTo({ top: 0 });
  };

  // `executer` est figé (useCallback) et conclut par `terminer` : il le lit
  // ici, à jour, pour que le bilan d'expérience et le record se calculent sur
  // l'état du moment, pas sur celui de son premier rendu.
  const terminerRef = useRef(terminer); terminerRef.current = terminer;

  /**
   * La descente affichée a été close ou remplacée ailleurs (autre onglet,
   * synchronisation du compte) : on la referme sans rien payer ni sauver, et
   * l'on revient à la préparation.
   */
  const fermerDescente = () => {
    minuteurs.current.forEach(clearTimeout); minuteurs.current = [];
    if (combatRef.current) combatRef.current.fini = "ailleurs";
    combatRef.current = null;
    partieRef.current = null;
    setResultat(null); setRencontre(null); setFin(null); setOccupe(false); setGeste(null); setChoix([]);
    setAvis("La descente s'est poursuivie dans un autre onglet.");
    setEcran("preparation");
  };
  // La partie enregistrée change d'identité ou disparaît sans venir de cette
  // page : la nôtre est fermée. Si une descente commence ailleurs pendant
  // qu'on prépare la sienne, on la reprend, comme après un rechargement.
  const idEnregistree = idPartie(donjon.partie);
  useEffect(() => {
    if (idPartie(partieRef.current) === idEnregistree) return;
    if (partieRef.current) { fermerDescente(); return; }
    if (donjon.partie && ecran === "preparation") {
      const p = structuredClone(donjon.partie);
      partieRef.current = p;
      setRencontre(p.rencontre ? monterRencontre(p) : null);
      setEcran(ecranDe(p));
    }
  }, [idEnregistree]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Combat : le fil ─────────────────────────────────────────────── */
  const el = (uid) => zone.current?.querySelector(`.dj-u[data-uid="${uid}"]`);

  /* Les animations : src/donjon/animations.js (Claude Design). Le module lit
     l'arène, la vitesse et le mouvement réduit au moment de jouer. */
  const arene = () => zone.current?.querySelector(".dj-arene");
  const reduitRef = useRef(mouvementReduit); reduitRef.current = mouvementReduit;
  const animRef = useRef(null);
  const koVu = useRef(new Map());
  const koAffiche = (x) => (koVu.current.has(x.uid) ? koVu.current.get(x.uid) : x.ko);
  if (!animRef.current) {
    animRef.current = creerAnimationsDonjon({
      arene, el, vitesse: () => vitesseRef.current, reduit: () => reduitRef.current,
      unites: () => (partieRef.current && combatRef.current ? unites(partieRef.current, combatRef.current) : []),
      flottants: false,
      // Les annonces (source, relique) restent lisibles en vitesse ×2 et ×4.
      tenueAnnonces: () => Math.round(500 * (1 - 1 / Math.max(1, vitesseRef.current))),
    });
  }
  useEffect(() => () => animRef.current?.nettoyer(), []);

  // Le contexte audio ne naît qu'au premier geste dans le Donjon ; en quittant
  // la page, tout se tait.
  useEffect(() => {
    const geste = () => Son.activer();
    document.addEventListener("pointerdown", geste, true);
    document.addEventListener("keydown", geste, true);
    return () => {
      document.removeEventListener("pointerdown", geste, true);
      document.removeEventListener("keydown", geste, true);
      Son.arreterTout();
    };
  }, []);
  // La musique suit l'écran : la carte (rencontres et résultats compris), le
  // combat, le gardien ; rien à la préparation ni au bilan.
  const genreCombat = C?.genre;
  useEffect(() => {
    if (ecran === "combat") Son.musique(genreCombat === "boss" ? "gardien" : "combat", { delai: genreCombat === "boss" ? 1.1 : .3 });
    else if (["carte", "rencontre", "resultat", "sortie"].includes(ecran)) { Son.musique("carte", { delai: delaiMusique.current }); delaiMusique.current = .6; }
    else Son.musique(null);
  }, [ecran, genreCombat]);
  // La nappe du lieu de la salle où l'on est (neutre avant la première).
  const salle = partie?.noeud ? partie.plan.noeuds[partie.noeud]?.lieu : null;
  const dedans = !!partie && ecran !== "preparation" && ecran !== "fin";
  const milieu = dedans ? Son.milieuDe(salle) : null;
  useEffect(() => { Son.nappe(milieu); }, [milieu]);
  useEffect(() => { if (partie?.etage) Son.etage(Math.min(3, partie.etage)); }, [partie?.etage]);
  useEffect(() => { Son.vitesse(vitesse); }, [vitesse]);
  // Une relique gagnée (victoire, trésor, rencontre) s'éveille, puis sonne sa famille ; vendue, ce sont des pièces.
  useEffect(() => {
    if (!resultat) return;
    const a = resultat.relique;
    if (resultat.po > 0) sonPieces(resultat.po);
    if (!a) return;
    if (a.vendue) { sonPieces(a.vendue); return; }
    const id = setTimeout(() => {
      Son.jouer("donjon.artefact.eveil", { rarete: Son.rareteDe(a.tier) });
      setTimeout(() => Son.jouer(`donjon.artefact.${Son.familleArtefact(effetsArtefact(a))}`), 450);
    }, 500);
    return () => clearTimeout(id);
  }, [resultat]);
  // Le bilan : les PO versées, l'expérience qui compte, un niveau, une rainbow.
  useEffect(() => {
    if (!fin) return;
    const t = [];
    if (fin.po > 0) Son.jouer("donjon.butin.po");
    if (fin.xp.length) t.push(setTimeout(() => Son.jouer("donjon.xp.compteur"), 900));
    if (fin.xp.some((l) => l.apres > l.avant)) t.push(setTimeout(() => Son.jouer("donjon.xp.niveau"), 1900));
    if (fin.xp.some((l) => l.irisee)) t.push(setTimeout(() => Son.jouer("donjon.xp.rainbow"), 2800));
    return () => t.forEach(clearTimeout);
  }, [fin]);
  const animerGeste = async (u, g, cible) => {
    if (!arene()) return;
    // Un coup sur un allié voilé traverse la brume : l'esquive remplace le geste.
    if (cible && cible.camp !== u.camp && cible.voile) return animRef.current.animerEvenement("esquive", cible, { attaquant: u });
    return animRef.current.animerGeste(u, g, cible);
  };
  /** Les mises à terre et relèves d'une action, animées avant que l'état ne les fige. */
  const animerChutes = (avant) => {
    const p = partieRef.current, CC = combatRef.current;
    const liberer = () => { koVu.current.clear(); };
    if (!p || !CC || !arene()) { liberer(); return Promise.resolve(); }
    // `appliquer` : la pose à terre (ou debout) passe à l'affichage au moment
    // précis où l'animation la rejoint, ni avant ni après.
    const poser = (x) => () => { koVu.current.set(x.uid, x.ko); el(x.uid)?.classList.toggle("ko", x.ko); };
    return Promise.all(unites(p, CC).flatMap((x) => {
      if (x.ko && !avant.has(x.uid)) {
        Son.jouer(x.camp === "e" ? "donjon.combat.chute.adverse" : "donjon.combat.chute.allie");
        return [animRef.current.animerEvenement("ko", x, { appliquer: poser(x) })];
      }
      if (!x.ko && avant.has(x.uid)) return [animRef.current.animerEvenement("releve", x, { appliquer: poser(x) })];
      return [];
    })).then(liberer, liberer);
  };
  /**
   * Les pouvoirs (source de pouvoir, reliques) qui viennent de jouer : chacun
   * son animation, si le module en a une (animerPouvoir, voir le brief
   * docs/conception/brief-animations-pouvoirs.md). Sans elle, rien ne bouge.
   */
  const animerPouvoirs = (liste) => {
    if (!liste?.length || !arene()) return;
    for (const ev of liste) if (ev) animRef.current.animerPouvoir?.(ev, { unite: (uid) => parUid(partieRef.current, combatRef.current, uid) });
  };
  /**
   * Les tombés tels qu'affichés, figés jusqu'à leur animation. Les règles
   * mettent une unité à terre d'un coup ; sans ce gel, le premier rendu React
   * qui suit (journal, saignement, renvoi…) posait la carte à terre par la
   * classe .ko, puis l'animation de chute repartait de debout : la carte
   * tombait, revenait, et retombait. `aTerre` fige l'affichage de chaque
   * unité ; `animerChutes` le libère carte par carte.
   */
  const aTerre = () => {
    const s = new Set();
    for (const x of unites(partieRef.current, combatRef.current)) {
      const ko = koAffiche(x);
      koVu.current.set(x.uid, ko);
      if (ko) s.add(x.uid);
    }
    return s;
  };

  /*
   * Le sursaut d'une carte touchée ou soignée. En animation Web plutôt qu'en
   * classe : React réécrit `className` à chaque rendu, et le rendu qui suit un
   * coup (journal, mise à terre) effaçait la classe en pleine secousse — le
   * portrait revenait d'un coup en place avant la chute.
   */
  const REACTIONS = {
    touche: [".dj-face", [{ transform: "translate(0)" }, { transform: "translate(-7px, 2px)", offset: 0.2 }, { transform: "translate(6px, -2px)", offset: 0.45 },
      { transform: "translate(-3px, 0)", offset: 0.7 }, { transform: "translate(0)" }], 380, true],
    soigne: [".plaque", [{ boxShadow: "0 0 0 4px rgba(127,209,185,.8), 0 0 40px rgba(127,209,185,.6)", offset: 0.4 }], 600, false],
  };
  const reagir = (e, anim) => {
    const R = REACTIONS[anim]; const n = R && e.querySelector(R[0]);
    if (!n?.animate || (R[3] && reduitRef.current)) return;
    n.getAnimations().filter((a) => a.id === anim).forEach((a) => a.cancel());
    n.animate(R[1], { duration: R[2], easing: "ease-out", id: anim });
  };
  const montrer = (effets) => {
    for (const f of effets) {
      const e = el(f.uid); if (!e) continue;
      if (f.anim) reagir(e, f.anim);
      // Les chiffres d'une même carte s'empilent au lieu de se recouvrir, et
      // durent moins longtemps quand le combat va vite.
      const deja = e.querySelectorAll(".dj-flottant").length;
      const duree = Math.round(Math.max(380, 760 / vitesseRef.current));
      const s = document.createElement("span");
      s.className = `dj-flottant ${f.cls || ""}`; s.textContent = f.txt;
      s.style.setProperty("--rang", String(Math.min(deja, 3)));
      s.style.animationDuration = `${duree}ms`;
      e.appendChild(s);
      setTimeout(() => s.remove(), duree + 40);
    }
  };

  /* ── Le son (src/son/) : chaque évènement à l'endroit où il se produit ── */
  const cdVu = useRef(new Map());     // recharges vues au tour d'avant, pour « capacité prête »
  const delaiMusique = useRef(.6);    // la musique de la carte revient après la victoire, ou plus tard après un gardien
  const sonPieces = (n) => { if (n > 0) Son.jouer("donjon.butin.pieces", { densite: n >= 20 ? 3 : 1 }); };
  const sonEtage = (e) => {
    const k = Math.min(3, Math.max(1, e));
    Son.etage(k);
    Son.jouer("donjon.carte.etage", { tr: -3 * (k - 1), revX: 1 + .4 * (k - 1) });
  };
  const survoler = (id) => { if (id && id !== survol) Son.jouer("donjon.carte.survol"); setSurvol(id); };
  /** Les coups d'une action : frappe (sa force selon les dégâts) sur l'adversaire, l'allié encaisse, l'armure tinte. */
  const sonCoups = (effets) => {
    for (const f of effets) {
      if (f.degats == null) continue;
      if (f.par === "a") Son.jouer("donjon.combat.frappe", { force: Son.forceDe(f.degats) });
      else Son.jouer("donjon.combat.encaisser");
      if (f.amorti > 0) Son.jouer("donjon.combat.armure");
    }
  };
  /** La main passe : la frise avance, une capacité revient, la brume monte après son tour. */
  const sonTour = (p, CC) => {
    Son.jouer("donjon.combat.tour");
    for (const u of p.equipe) {
      if (!u.ko && (cdVu.current.get(u.uid) || 0) > 0 && (u.cd || 0) === 0) Son.jouer("donjon.capacite.prete");
      cdVu.current.set(u.uid, u.cd || 0);
    }
    const t = CC.brumeTour ?? BRUME_TOUR;
    if (CC.round > t) Son.brume(BRUME_TOUR + (CC.round - t));
  };

  const executer = useCallback(async (u, g, cible) => {
    const p = partieRef.current, CC = combatRef.current;
    if (!p || !CC || CC.fini) return;
    setOccupe(true); setGeste(null);
    // La capacité d'un rôle sonne avec son geste (son élan précède l'impact).
    if (COMPETENCES[g]?.place === "tech" && ROLES[u.role]) Son.jouer(`donjon.capacite.${u.role}`, u.camp === "e" ? { camp: "adverse" } : {});
    await animerGeste(u, g, cible);
    if (!vif(CC)) return;
    const avant = aTerre();
    const res = resoudre(p, CC, u, g, cible, rngCombat.current);
    setJournal((j) => [res.note, ...j].slice(0, 12));
    sonCoups(res.effets);
    montrer(res.effets);
    animerPouvoirs(res.pouvoirs);
    if (res.renvoi && cible) await animRef.current.animerEvenement("renvoi", cible, { attaquant: u });
    await animerChutes(avant);
    if (!vif(CC)) return;
    redessiner();
    await new Promise((ok) => setTimeout(ok, 560 / vitesseRef.current));
    if (!vif(CC)) return;
    let fin = issue(p, CC);
    if (!fin) fin = await passerLaMain(p, CC);
    if (!vif(CC)) return;
    if (!fin) { setOccupe(false); redessiner(); return; }
    conclure(fin, p, CC);
  }, [aller]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * La main passe. Un saignement, un piège ou une régénération jouent entre
   * deux mains : ils partent au journal, et peuvent clore le combat. Rend
   * l'issue s'il y en a une.
   */
  const passerLaMain = async (p, CC) => {
    const avant = aTerre();
    prochain(p, CC);
    sonTour(p, CC);
    const notes = CC.notes || [];
    if (notes.length) {
      const lignes = notes.map((n) => n.note).filter(Boolean).reverse();
      if (lignes.length) setJournal((j) => [...lignes, ...j].slice(0, 12));
      // Saignement qui mord, piège qui tient : chacun son animation, puis ses chiffres.
      for (const n of notes) {
        const x = n.uid ? parUid(p, CC, n.uid) : null;
        if (n.evt === "pouvoir") animerPouvoirs([n.pouvoir]);
        else if (x && n.evt) await animRef.current.animerEvenement(n.evt, x, {});
        montrer(n.effets);
      }
    }
    await animerChutes(avant);
    const fin = issue(p, CC);
    redessiner();
    return fin;
  };
  const conclure = (fin, p, CC) => {
    if (fin === "victoire") {
      CC.fini = "victoire";
      p.combat = null;
      Son.jouer(CC.genre === "boss" ? "donjon.combat.gardien.vaincu" : "donjon.combat.victoire");
      delaiMusique.current = CC.genre === "boss" ? 2 : .6;
      const avant = aTerre();
      const r = victoire(p, CC, rngCombat.current, POOLS.artefacts);
      animerChutes(avant); // la relève d'après victoire
      animerPouvoirs(r.pouvoirs);
      if (CC.relique) animRef.current.animerRelique?.(CC.relique, { moment: r.relique?.vendue ? "vendue" : "prise", equipe: vivants(p.equipe) });
      setResultat(r);
      setOccupe(false);
      // Une victoire ordinaire sans relique ne demande rien : retour à la carte, en bandeau.
      const sansEcran = CC.genre !== "boss" && !r.relique;
      differer(() => {
        combatRef.current = null;
        if (sansEcran) { setResultat(null); setBandeau({ cle: Date.now(), titre: "Victoire", po: poGagne(p, r.po) }); sonPieces(r.po); aller("carte"); }
        else aller(CC.genre === "boss" ? "sortie" : "resultat");
      }, 450 / vitesseRef.current);
      return;
    }
    if (fin === "defaite") { CC.fini = "defaite"; Son.jouer("donjon.combat.defaite"); differer(() => terminerRef.current("defaite"), 700); }
  };

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
    Son.jouer("donjon.combat.cibler");
    executer(u, geste, cible);
  };
  const seReplier = () => {
    if (occupe || !peutFuir(partieRef.current, combatRef.current)) return;
    combatRef.current.fini = "fuite";
    Son.jouer("donjon.combat.fuite");
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
    if (!p?.combat) { setEcran("carte"); return; }
    lancerCombat(p.combat.genre, p.combat);
    // En développement, StrictMode démonte et remonte aussitôt : le démontage
    // annule le premier tour programmé, et le combat restait figé. Un combat
    // qui n'a pas encore commencé est donc oublié, et se relance au remontage.
    const CC = combatRef.current;
    return () => { if (combatRef.current === CC && !CC.lance) combatRef.current = null; };
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
      <span className="pastille" title={partie.mode === "infini" ? "Donjon infini" : "Donjon du jour"}><Icone nom="etage" taille={13} /> {partie.mode === "infini"
        ? <><b>{partie.etage}</b> · ∞</>
        : <><b>{partie.etage}</b> / {etagesDe(partie)}</>}</span>
      <span className="pastille or" title={`${pieces(partie.sac)} au sac`}><Icone nom="butin" taille={13} /> <b>{poDuButin(partie.sac, partie.mode)} PO</b></span>
      {partie.source && (
        <span className={`pastille dj-source-pastille${partie.source.etoile ? " star" : ""}`} title={`${partie.source.c.nom}, niv. ${partie.source.niveau} · ${texteEffets(partie.source.effets)}`}>
          <Icone nom="source" taille={13} />{partie.source.etoile && <Etoile taille={11} />} {sourceDe(partie.source.c).nom}
        </span>
      )}
      {(partie.difficulte ?? 1) < 1 && (
        <span className="pastille" title="Adversaires affaiblis et butin réduit, jusqu'au jeu normal au fil des descentes jouées.">
          Apprentissage · {pourcent(partie.difficulte)}
        </span>
      )}
    </div>
  );

  if (ecran === "preparation" || (!partie && ecran !== "fin")) {
    const n = choix.length;
    const plus = mode === "infini" ? peutPayerInfini : tentativesRestantes > 0 && !!impose;
    const sourceManque = manqueSource({ impose, lieux: collection.lieux, cle: cleSource, enExpedition });
    // Les cartes indisponibles (en expédition, au repos) passent en fin de
    // rangée, toujours grisées : on ne fait pas défiler pour trouver qui peut descendre.
    // Une carte déjà choisie reste à sa place, même si elle est indisponible (mode test).
    const indispo = (c) => !choix.includes(c.id) && (!!enExpedition?.(c) || (!!convalescence(c) && !illimite));
    const enFin = (l) => [...l.filter((c) => !indispo(c)), ...l.filter(indispo)];
    // Au donjon du jour, seules les rangées des rôles imposés.
    const parRole = Object.keys(ROLES).filter((r) => !quota || quota[r])
      .map((r) => [r, enFin(collection.allies.filter((c) => roleCarte(c) === r))]).filter(([, l]) => l.length);
    const lieuxRangee = [...collection.lieux.filter((l) => !enExpedition?.(l)), ...collection.lieux.filter((l) => enExpedition?.(l))];
    const MJ = DONJON.modes.jour, MI = DONJON.modes.infini;
    const unite = (c) => allie({ uid: 0 }, c, niveauCarte(c), ficheDe(etat, c));
    // La barre d'équipe : quatre emplacements, marqués du rôle attendu au donjon du jour.
    const choisis = choix.map((id) => collection.allies.find((c) => c.id === id)).filter(Boolean);
    const attendus = quota ? Object.keys(ROLES).flatMap((r) => Array(quota[r] || 0).fill(r)) : Array(TAILLE_EQUIPE).fill(null);
    const reste = [...choisis];
    const emplacements = attendus.map((r) => { const i = reste.findIndex((c) => !r || roleCarte(c) === r); return { role: r, c: i >= 0 ? reste.splice(i, 1)[0] : null }; });
    const lieuSource = cleSource ? collection.lieux.find((l) => `${l.ext}:${l.id}` === cleSource) : null;
    const effSource = lieuSource ? effetsSource(lieuSource, niveauCarte(lieuSource), !!ficheDe(etat, lieuSource).etoiles?.source) : [];
    const etatJour = sansLieu ? "Découvrez un lieu dans un booster pour profiter du donjon du jour"
      : illimite ? "Mode test" : tentativesRestantes <= 0 ? "Déjà tenté" : imposeDuJour ? "Disponible" : "Pas assez de compagnons";
    const bouton = mode === "infini" && !peutPayerInfini ? `Il faut ${entreeInfini} PO`
      : !plus ? (tentativesRestantes > 0 ? "Pas assez de compagnons" : "Déjà tenté aujourd'hui")
      : n !== TAILLE_EQUIPE ? `${n} / ${TAILLE_EQUIPE}`
      : sourceManque ? { expedition: "Lieu en expédition", perdu: "Lieu indisponible", choisir: "Choisissez un lieu" }[sourceManque]
      : mode === "infini" ? `Descendre · ${entreeInfini} PO` : "Descendre";
    const premiere = !Object.keys(etat.xp || {}).length;
    return (
      <div className="dj dj-prep">
        {/* Deux donjons, en chiffres : le détail des règles est dans « Comment ça marche ». */}
        <div className="dj-modes" role="radiogroup" aria-label="Quel donjon">
          <button type="button" role="radio" aria-checked={mode === "jour"} className={`dj-mode${mode === "jour" ? " on" : ""}${sansLieu ? " ferme" : ""}`}
            disabled={sansLieu} onClick={() => choisirMode("jour")}
            title={`Trois étages, la même carte pour tous le ${dateFr(aujourdhui())}. Équipe et source imposées. Remonter garde tout ; tomber n'en laisse qu'un quart.`}>
            <span className="dj-mode-tete"><b>{MODES.jour.nom}</b><span className="dj-mode-etat">{sansLieu ? "" : etatJour}</span></span>
            {sansLieu ? <span className="dj-mode-etat">{etatJour}</span> : (
              <span className="dj-puces">
                <Puce icone="etage">{MODES.jour.etages} étages</Puce><Puce>1 / jour</Puce>
                <Puce icone="butin" or>×{String(MJ.gain).replace(".", ",")}</Puce><Puce>équipe imposée</Puce>
              </span>
            )}
          </button>
          <button type="button" role="radio" aria-checked={mode === "infini"} className={`dj-mode${mode === "infini" ? " on" : ""}`}
            onClick={() => choisirMode("infini")}
            title="Des étages sans fin, de plus en plus durs. Ni fuite ni remontée : l'équipe descend jusqu'à tomber et rapporte tout le sac. Un jour de repos ensuite ; expérience réduite.">
            <span className="dj-mode-tete"><b>{MODES.infini.nom}</b><span className="dj-mode-etat">{peutPayerInfini ? "" : `Il faut ${entreeInfini} PO`}</span></span>
            <span className="dj-puces">
              <Puce icone="etage">∞</Puce><Puce icone="butin" or>{entreeInfini ? `entrée ${entreeInfini}` : "entrée offerte"}</Puce>
              <Puce icone="tombe">sans retour</Puce><Puce icone="gardien">record {recordInfini}</Puce>
            </span>
          </button>
        </div>
        {apprenti.avance < 1 && (
          <p className="dj-bandeau" title="Tant que la collection est jeune, les adversaires sont affaiblis et le butin réduit. Tout revient à la normale au fil des descentes jouées, victoires ou chutes. L'expérience est entière.">
            <b>Apprentissage</b> · adversaires {pourcent(apprenti.difficulte)} · butin {pourcent(apprenti.gain)} · encore {apprenti.restant} descente{apprenti.restant > 1 ? "s" : ""}
          </p>
        )}
        {avis && <p className="dj-bandeau" role="status">{avis}</p>}
        {donjon.dernier && donjon.dernier.jour === aujourdhui() && (
          <p className="dj-bandeau">Dernière descente · {donjon.dernier.issue === "defaite" ? "tombée" : "remontée"} à l'étage {donjon.dernier.etage} · +{donjon.dernier.po} PO</p>
        )}

        {collection.allies.length < TAILLE_EQUIPE ? (
          <section className="panneau"><h3>Pas encore d'équipe</h3>
            <p className="muted">Il faut au moins {TAILLE_EQUIPE} PNJ alliés dans votre collection pour descendre. Les créatures, les animaux et les criminels sont dans l'autre camp.</p></section>
        ) : (
          <>
            <div className="section-titre sous-titre">
              <h2>Compagnons</h2>
              <button type="button" className="dj-lex-bouton" onClick={() => { Son.jouer("donjon.ui.dialogue"); setLexique(""); }}><Icone nom="lexique" taille={16} /> Lexique</button>
            </div>
            {/* Une rangée par rôle, qui défile à l'horizontale. Ce que partagent
                toutes ses cartes (passif, compétence, stats de base) est lu une
                fois en tête ; sous chaque carte, seulement ce qui la distingue. */}
            {parRole.map(([role, cartes]) => {
              const us = new Map(cartes.map((c) => [c.id, unite(c)]));
              const frequent = (k) => { const m = {}; for (const u of us.values()) m[u[k]] = (m[u[k]] || 0) + 1; return Number(Object.entries(m).sort((x, y) => y[1] - x[1])[0][0]); };
              const base = { pvMax: frequent("pvMax"), atq: frequent("atq"), ini: frequent("ini") };
              const pris = cartes.filter((c) => choix.includes(c.id)).length;
              return (
                <Rangee key={role} titre={ROLES[role].nom} icone={role} nb={cartes.length} pris={pris}
                  quota={quota ? `${pris} / ${quota[role]}` : null} complet={!!quota && pris >= quota[role]} classe={`r-${role}`}
                  aide={<>{ROLES[role].passif ? `${ROLES[role].passif} · ` : ""}{COMPETENCES[ROLES[role].tech].nom}
                    <span className="dj-stats-base"><Stat icone="pv">{base.pvMax}</Stat><Stat icone="atq">{base.atq}</Stat><Stat icone="ini">{base.ini}</Stat></span></>}>
                  {cartes.map((c) => {
                    const pris = choix.includes(c.id);
                    const niv = niveauCarte(c);
                    const fc = ficheDe(etat, c);
                    const u = us.get(c.id), R = ROLES[u.role], nEt = etoiles(fc);
                    const palier = PALIER_IRISEE[c.tier] || 20;
                    // Mode test : la convalescence s'affiche mais n'empêche rien.
                    const repos = convalescence(c);
                    // Partie en expédition : elle ne descend pas avant son retour, mode test compris.
                    const partie = enExpedition?.(c);
                    const bloque = partie || (repos && !illimite);
                    const ecarts = [["pv", u.pvMax, base.pvMax], ["atq", u.atq, base.atq], ["ini", u.ini, base.ini]].filter(([, v, b]) => v !== b);
                    return (
                      <div key={`${c.ext}:${c.id}`}
                        className={`dj-choix${nEt ? " star" : ""}${nEt === 4 ? " star-pleine" : ""}${pris ? " pris" : ""}${((n >= TAILLE_EQUIPE || !peutPrendre(c)) && !pris) || bloque ? " grise" : ""}${repos || partie ? " repos" : ""}`}>
                        <button type="button" className="dj-choix-carte" aria-pressed={pris} disabled={bloque && !pris}
                          title={`${c.nom} · ${u.pvMax} PV · ${u.atq} ATQ · INI ${u.ini}`}
                          aria-label={`${c.nom}, ${R.nom}, niveau ${niv}, ${u.pvMax} PV, ${u.atq} ATQ, initiative ${u.ini}${nEt ? `, ${nEt === 4 ? "STAR" : `${nEt} ligne${nEt > 1 ? "s" : ""} étoilée${nEt > 1 ? "s" : ""}`}` : ""}${partie ? ", en expédition" : repos ? `, au repos jusqu'au ${dateFr(repos)}` : ""}`}
                          onClick={() => setChoix((l) => (l.includes(c.id) ? l.filter((x) => x !== c.id) : l.length < TAILLE_EQUIPE && peutPrendre(c) ? [...l, c.id] : l))}>
                          {pris && <span className="dj-coche" aria-hidden="true">✓</span>}
                          {/* La carte STAR se voit de loin : pastille irisée et cadre irisé. */}
                          {nEt > 0 && <EtoilesCarte n={nEt} />}
                          {partie ? <span className="dj-repos">En expédition</span>
                            : repos && <span className="dj-repos"><Icone nom="repos" taille={12} /> {dateFr(repos).slice(0, 5)}</span>}
                          <CarteDJ c={c} cfgImage={cfgImage} fichiers={fichiers} />
                        </button>
                        <div className="dj-choix-pied">
                          <span className="dj-ligne1">
                            <span className="dj-niv" title={niv < palier ? `Irisée au niveau ${palier}` : niv < NIVEAU_MAX ? `Sachet offert au niveau ${NIVEAU_MAX}` : "Niveau maximal"}>Niv. {niv}</span>
                            {ecarts.length > 0 && <span className="dj-ecarts">{ecarts.map(([k, v]) => <Stat key={k} icone={k}>{v}</Stat>)}</span>}
                          </span>
                          <span className="dj-xp" aria-hidden="true"><span style={{ width: `${Math.round(avancement(xpDe(etat, c)) * 100)}%` }} /></span>
                        </div>
                      </div>
                    );
                  })}
                </Rangee>
              );
            })}
            {/* La source : choisie à l'infini ; au donjon du jour, elle est imposée
                et se lit dans la barre d'équipe. */}
            {!impose && collection.lieux.length > 0 && (
              <>
                <div className="section-titre sous-titre"><h2>Source de pouvoir</h2></div>
                <Rangee titre="Lieux" icone="source" nb={lieuxRangee.length} pris={cleSource ? 1 : 0} quota={`${cleSource ? 1 : 0} / 1`} complet={!!cleSource} classe="r-lieu"
                  aide="Un pouvoir pour toute l'équipe, selon la rareté, le niveau et l'étoile du lieu">
                  {lieuxRangee.map((l) => {
                    const cle = `${l.ext}:${l.id}`, pris = cleSource === cle;
                    const niv = niveauCarte(l), et = !!ficheDe(etat, l).etoiles?.source;
                    const S = sourceDe(l), eff = effetsSource(l, niv, et);
                    const route = enExpedition?.(l);
                    return (
                      <div key={cle} className={`dj-choix dj-source${et ? " star star-pleine" : ""}${pris ? " pris" : ""}${route ? " grise repos" : ""}`}>
                        <button type="button" className="dj-choix-carte" aria-pressed={pris} disabled={route && !pris}
                          aria-label={`${l.nom} : ${S.nom}, ${texteEffets(eff)}${route ? ", en expédition" : ""}`}
                          onClick={() => setSourceCle((x) => (x === cle ? null : cle))}>
                          {pris && <span className="dj-coche" aria-hidden="true">✓</span>}
                          {et && <EtoilesCarte n={4} />}
                          {route && <span className="dj-repos">En expédition</span>}
                          <CarteDJ c={l} cfgImage={cfgImage} fichiers={fichiers} />
                        </button>
                        <div className="dj-source-pied">
                          <span className="dj-ligne1"><b className="dj-source-nom">{S.nom}</b><span className="dj-niv">Niv. {niv}</span></span>
                          <ul>{eff.map((e) => <li key={e.mec}>{e.texte}</li>)}</ul>
                        </div>
                      </div>
                    );
                  })}
                </Rangee>
              </>
            )}

            {/* La barre d'équipe : toujours en vue, elle dit ce qui manque et lance la descente. */}
            <div className="dj-barre-equipe" role="group" aria-label="Votre équipe">
              <div className="dj-emplacements">
                {emplacements.map(({ role, c }, i) => (c ? (
                  <button key={c.id} type="button" className="dj-emp plein" title={`Retirer ${c.nom}`} aria-label={`Retirer ${c.nom}`}
                    onClick={() => setChoix((l) => l.filter((x) => x !== c.id))}>
                    <CarteDJ c={c} cfgImage={cfgImage} fichiers={fichiers} />
                  </button>
                ) : (
                  <span key={`v${i}`} className="dj-emp" title={role ? `${ROLES[role].nom} à choisir` : "Compagnon à choisir"}>
                    <Icone nom={role || "profil"} taille={20} />
                  </span>
                )))}
              </div>
              {lieuSource ? (
                <span className="dj-barre-source" title={`${lieuSource.nom}${impose ? " · imposé aujourd'hui" : ""} · ${texteEffets(effSource)}`}>
                  <Icone nom="source" taille={16} />
                  <span><b>{sourceDe(lieuSource).nom}</b><small>{effSource.map((e) => e.texte).join(" · ")}</small></span>
                </span>
              ) : impose && !impose.lieu ? <span className="dj-barre-source vide"><Icone nom="source" taille={16} /><small>sans source</small></span>
                : collection.lieux.length > 0 && <span className="dj-barre-source vide"><Icone nom="source" taille={16} /><small>source à choisir</small></span>}
              <button className="btn dj-descendre" type="button" onClick={partir} disabled={n !== TAILLE_EQUIPE || !plus || sourceManque || !compoFaite}>{bouton}</button>
            </div>
          </>
        )}
        <Regles ouvert={premiere} />
        {lexique !== null && <Lexique focus={lexique} onFermer={() => setLexique(null)} />}
      </div>
    );
  }

  if (ecran === "fin" && fin) {
    const echec = fin.issue === "defaite";
    const repos = Object.fromEntries(fin.repos.map((x) => [x.cle, x.jours]));
    const chiffres = [[fin.mode === "infini" ? fin.etage : `${fin.etage} / ${MODES.jour.etages}`, "étage", "etage"], [fin.stats.salles, "salles", "combat"],
      [fin.stats.ennemis, "adversaires", "atq"], [fin.stats.gardiens, fin.stats.gardiens > 1 ? "gardiens" : "gardien", "gardien"]];
    return (
      <div className="dj">
        <section className="panneau dj-panneau dj-fin">
          <h2>{echec ? "L'équipe est tombée" : "De retour à la surface"}</h2>
          <p className="dj-fin-ambiance">{echec && fin.mode === "infini" ? "Jusqu'au bout. Le sac revient entier."
            : echec ? "Ramenés au camp par des mains inconnues."
            : "La brume se referme derrière vous."}</p>
          <p className="dj-fin-gain"><span className="dj-butin">+{fin.po} PO</span>
            {fin.perdu > 0 && <span className="dj-puce" title={`${fin.butin} pièces rapportées`}>{fin.perdu} pièces perdues en bas</span>}
            {fin.mode === "infini" && <span className="dj-puce">entrée {DONJON.modes.infini.entree} PO</span>}
            {fin.record && <span className="dj-puce or"><Icone nom="gardien" taille={13} /> record : {fin.stats.gardiens}</span>}
          </p>
          <div className="dj-chiffres-fin">
            {chiffres.map(([v, lib, ic]) => <div key={lib}><Icone nom={ic} taille={15} /><b>{v}</b><span>{lib}</span></div>)}
          </div>
          {/* L'équipe en portraits : l'expérience en jauge, la chute et le repos en signes. */}
          {fin.xp.length > 0 && (
            <ul className="dj-portraits">
              {fin.xp.map((l) => {
                const cle = `${l.c.ext}:${l.c.id}`, tombe = fin.tombes?.includes(cle), j = repos[cle];
                const monte = l.apres > l.avant;
                return (
                  <li key={cle} className={`${tombe ? "tombe" : ""}${l.c.type === "lieu" ? " lieu" : ""}`}
                    title={`${l.c.nom} · +${l.gain} XP · niveau ${l.apres}${j ? ` · au repos ${j} jour${j > 1 ? "s" : ""}` : ""}`}>
                    <CarteDJ c={l.c} cfgImage={cfgImage} fichiers={fichiers} />
                    <span className="dj-xp" aria-hidden="true"><span style={{ width: `${Math.round(avancement(l.xp || 0) * 100)}%` }} /></span>
                    <span className="dj-portrait-l"><Icone nom="xp" taille={11} />+{l.gain}{monte && <b> niv. {l.apres}</b>}</span>
                    {j ? <span className="dj-portrait-l repos"><Icone nom="repos" taille={11} />{j} j</span>
                      : l.c.type === "lieu" ? <span className="dj-portrait-l muted"><Icone nom="source" taille={11} />source</span> : null}
                    {(l.irisee || l.po > 0 || l.sachet) && <span className="dj-portrait-l gain">{l.irisee ? "irisée !" : l.po > 0 ? `+${l.po} PO` : "sachet !"}</span>}
                  </li>
                );
              })}
            </ul>
          )}
          {fin.reliques.length > 0 && (
            <p className="dj-puces">{fin.reliques.map((r) => <Puce key={r} icone="relique" or>{r}</Puce>)}</p>
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
            <p className="muted petit">{partie.plan.pos ? "Salle suivante" : "Par où entrer"}</p>
            {bandeau && (
              <p key={bandeau.cle} className="dj-toast" role="status">
                <b>{bandeau.titre}</b>{bandeau.po > 0 && <> · <Icone nom="butin" taille={13} /> +{bandeau.po} PO</>}{bandeau.texte && <> · {bandeau.texte}</>}
              </p>
            )}
            {(doigt || partie.plan.pos) && (
              <div className="dj-barre-carte">
                {doigt && (
                  <button type="button" className="dj-lex-bouton" onClick={() => { Son.jouer("donjon.ui.dialogue"); setFeuille(true); }}>
                    Équipe {debout} / {partie.equipe.length}{partie.reliques.length + (partie.artefact ? 1 : 0) > 0 ? ` · ${partie.reliques.length + (partie.artefact ? 1 : 0)} relique${partie.reliques.length + (partie.artefact ? 1 : 0) > 1 ? "s" : ""}` : ""}
                  </button>
                )}
                {/* On peut toujours sortir : même revenu d'un rechargement, même chez un
                    gardien. Sauf au donjon infini : on y descend jusqu'à la chute. */}
                {partie.plan.pos && partie.mode !== "infini" && <BoutonRemonter po={poDuButin(partie.sac, partie.mode)} onRemonter={() => terminer("sortie")} className="btn quiet sm" />}
              </div>
            )}
            <div className="dj-plan-zone" onClick={() => setBulle(null)}>
              <Plan partie={partie} onEntrer={entrerSalle} onSurvol={survoler} doigt={doigt} bulle={bulle} onBulle={setBulle} />
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
      const etiquette = u.boss ? "Gardien · Balayage" : R ? `${R.nom} · ${COMPETENCES[techDe(u)].nom}${u.etoiles?.tech ? " ★" : ""}` : `${u.elite ? "Élite · " : ""}${TRAITS[u.role].nom}`;
      return (
        <div key={u.uid} data-uid={u.uid}
          className={`dj-u${u.uid === C.actif ? " actif" : ""}${koAffiche(u) ? " ko" : ""}${etatsDe(u)}${ciblable ? ` ciblable${u.camp === "a" ? " allie" : ""}` : ""}${u.boss ? " boss" : ""}`}
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
    // À vous : la carte active est soulevée et dorée, les cibles ont leur liseré ;
    // pas de consigne écrite. Une seule pastille dit que la main est au joueur.
    else consigne = <><b>{actif.c.nom}</b> <span className="dj-a-vous">{def ? (def.cible === "e" ? "cible ?" : "allié ?") : "à vous"}</span></>;

    return (
      <div className="dj" ref={zone}>
        {entete}
        <div className={`dj-arene${doigt ? " telephone" : ""}`}>
          <div className="dj-coeur">
          <div className="dj-frise" aria-label="Ordre d'initiative du tour">
            <span className="tour">Tour {C.round}</span>
            {brume(C) > 1 && <span className="dj-brume" title={`Passé le tour ${BRUME_TOUR}, la brume se referme : +20 % de dégâts par tour, des deux côtés.`}>Brume +{Math.round((brume(C) - 1) * 100)} %</span>}
            {ordre.map(({ u, i }) => (
              <Jeton key={`${u.uid}-${i}`} u={u} cls={u.uid === C.actif ? "actif" : i < C.idx ? "passe" : ""} cfgImage={cfgImage} fichiers={fichiers} />
            ))}
          </div>
          {C.relique && (
            <p className="dj-relique-ennemie" title={`${bonusTexte(C.relique.tier).replace(" à l'équipe", "")} ; ${texteEffets(effetsArtefact(C.relique))}`}>
              Ils portent <b data-palier={C.relique.tier}>{C.relique.nom}</b>
              <span> — {texteEffets(effetsArtefact(C.relique))}. Battez-les pour la prendre.</span>
            </p>
          )}
          <div className={`dj-rang ennemis${C.ennemis.some((x) => !x.ko && x.rempart > 0) ? " etat-rempart" : ""}${C.relique ? " porte-relique" : ""}`}><span className="dj-rempart" aria-hidden="true" />{C.ennemis.map(unite)}</div>
          <div className="dj-milieu">
            <div className="dj-consigne" aria-live="polite">{consigne}
              <div className="dj-journal">{journal.slice(0, 2).map((t, i) => <div key={i}>{t}</div>)}</div>
            </div>
            <div className="dj-gestes">
              {/* Un geste : son icône, son nom, un chiffre. La description complète est au survol. */}
              {liste.map((x) => {
                const tech = COMPETENCES[x.id]?.place === "tech";
                const degats = x.id === "attaque" ? x.aide.match(/^\d+/)?.[0] : null;
                return (
                  <button key={x.id} type="button" className={`dj-geste${geste === x.id ? " on" : ""}${x.etoile ? " etoile" : ""}`} disabled={!x.pret}
                    title={x.aide} aria-label={`${x.nom} : ${x.aide}`} onClick={() => choisirGeste(x.id)}>
                    <Icone nom={!x.pret ? "recharge" : tech ? actif.role : "atq"} taille={17} />
                    <b>{x.nom}{x.etoile && " ★"}</b>
                    {degats && <span className="dj-geste-n">{degats}</span>}
                    {!x.pret && <span className="dj-geste-n">{actif.cd}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className={`dj-rang equipe${partie.equipe.some((x) => !x.ko && x.rempart > 0) ? " etat-rempart" : ""}`}><span className="dj-rempart" aria-hidden="true" />{partie.equipe.map(unite)}</div>
          </div>
          {/* Le pilotage sur une ligne : auto et sa stratégie, vitesse, lexique, fuite. */}
          <div className="dj-pilote">
            <button type="button" className={`dj-rond dj-auto${strategie !== "manuel" ? " on" : ""}`} aria-pressed={strategie !== "manuel"}
              title={strategie === "manuel" ? "Combat automatique" : "Reprendre la main"}
              onClick={() => { Son.jouer("donjon.ui.pilote", { tr: strategie !== "manuel" ? -4 : 0 }); setStrategie((x) => (x === "manuel" ? dernierAuto.current : "manuel")); }}>
              <Icone nom="auto" taille={15} /> Auto
            </button>
            <select className="dj-strategie" aria-label="Stratégie du combat automatique" title={STRATEGIES[strategie === "manuel" ? dernierAuto.current : strategie].aide}
              value={strategie === "manuel" ? dernierAuto.current : strategie}
              onChange={(e) => { dernierAuto.current = e.target.value; setStrategie(e.target.value); }}>
              {Object.entries(STRATEGIES).filter(([k]) => k !== "manuel").map(([k, v]) => <option key={k} value={k}>{v.nom}</option>)}
            </select>
            <button type="button" className="dj-rond dj-vitesse" title="Vitesse" aria-label={`Vitesse ×${vitesse}, changer`}
              onClick={() => { const v = vitesse === 1 ? 2 : vitesse === 2 ? 4 : 1; Son.jouer("donjon.ui.vitesse", { densite: [1, 2, 4].indexOf(v) + 1 }); setVitesse(v); }}>
              <Icone nom="vitesse" taille={15} /> ×{vitesse}
            </button>
            <span className="dj-pilote-fin">
              <button type="button" className="dj-rond" title="Lexique" aria-label="Lexique" onClick={() => { Son.jouer("donjon.ui.dialogue"); setLexique(""); }}><Icone nom="aide" taille={16} /></button>
              {C.genre !== "boss" && partie.mode !== "infini" && (
                <button className="dj-rond" type="button" onClick={seReplier} disabled={occupe || !!C.fini || !peutFuir(partie, C)}
                  title="Fuir : deux cinquièmes du sac perdus, chacun blessé, et le compagnon le plus mal en point reste derrière jusqu'à demain.">
                  <Icone nom="fuir" taille={15} /> Fuir
                </button>
              )}
            </span>
          </div>
        </div>
        {lexique !== null && <Lexique focus={lexique} onFermer={() => setLexique(null)} />}
      </div>
    );
  }

  /* Au téléphone, la carte du lieu passe en vignette dans le panneau : en
     pleine largeur, elle repoussait le récit et les boutons sous le pli. */
  const vignette = lieu && <div className="dj-scene-vignette" aria-hidden="true"><CarteDJ c={lieu} cfgImage={cfgImage} fichiers={fichiers} /></div>;

  if (ecran === "rencontre" && rencontre) {
    return (
      <div className="dj">
        {entete}
        <div className="dj-scene">
          {lieu && <div className="dj-scene-carte"><CarteDJ c={lieu} cfgImage={cfgImage} fichiers={fichiers} /></div>}
          <section className="panneau dj-panneau">
            {vignette}
            <h2>{rencontre.e.titre}</h2>
            <p>{rencontre.texte}</p>
            <div className="actions gauche dj-actions-bas">
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
    const infini = partie.mode === "infini";
    const R = resultat || { titre: `Étage ${partie.etage} nettoyé`, texte: "Le gardien est tombé." };
    return (
      <div className="dj">
        {entete}
        <div className="dj-scene">
          {lieu && <div className="dj-scene-carte"><CarteDJ c={lieu} cfgImage={cfgImage} fichiers={fichiers} /></div>}
          <section className="panneau dj-panneau">
            {vignette}
            <h2>{R.titre}</h2>
            <p>{R.texte}</p>
            {R.po > 0 && <p><span className="dj-butin">+{poGagne(partie, R.po)} PO</span></p>}
            {R.relique && <ReliqueTrouvee a={R.relique} partie={partie} cfgImage={cfgImage} fichiers={fichiers} />}
            {ecran === "sortie" && (
              <p>{dernier ? "C'était le dernier étage. Il ne reste qu'à remonter."
                : infini ? <span className="dj-puces"><Puce icone="etage">plus dur, plus riche</Puce><Puce icone="tombe">sans retour</Puce></span>
                : <span className="dj-puces"><Puce icone="butin" or>remonter : tout garder</Puce><Puce icone="etage">descendre : plus dur, plus riche</Puce><Puce icone="tombe">chute : ¼ du sac</Puce></span>}</p>
            )}
            <MiniEquipe partie={partie} />
            <div className="actions gauche dj-actions-bas">
              {ecran === "sortie" ? (
                <>
                  {!infini && <button className="btn" type="button" onClick={() => terminer("sortie")}>Remonter · {poDuButin(partie.sac, partie.mode)} PO</button>}
                  {!dernier && <button className={infini ? "btn" : "btn quiet"} type="button" onClick={() => { descendre(partie, POOLS); sonEtage(partie.etage); setSurvol(null); setResultat(null); aller("carte"); }}>Descendre à l'étage {partie.etage + 1}</button>}
                </>
              ) : (
                <>
                  <button className="btn" type="button" onClick={() => aller("carte")}>Retour à la carte</button>
                  {!infini && <BoutonRemonter po={poDuButin(partie.sac, partie.mode)} onRemonter={() => terminer("sortie")} />}
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
            <><b>{COMPETENCES[R.tech].nom}</b> — {COMPETENCES[R.tech].aide}.</>,
            `${R.passif ? `${R.passif}. ` : ""}Recharge : ${COMPETENCES[R.tech].cd ? `${COMPETENCES[R.tech].cd} tour${COMPETENCES[R.tech].cd > 1 ? "s" : ""}` : "aucune"}. Initiative de base ${R.ini}.`))}
        </dl>
        <h3>Compétences</h3>
        <p className="muted petit">Chaque carte porte un geste (compétence 1, sans recharge) et une technique (compétence 2). Les deux se changent contre des vestiges, depuis la carte agrandie de la bibliothèque, comme les rangs d'ATQ et d'INI. Une rainbow en trop de la carte étoile une ligne : elle est figée, et bien plus forte.</p>
        <dl>
          {Object.values(COMPETENCES).map((K) => entree(`k-${K.id}`, `${K.nom}${K.place === "geste" ? " (geste)" : ""}`,
            `${K.aide}.`,
            `${K.place === "tech" ? `Recharge : ${K.cd ? `${K.cd} tour${K.cd > 1 ? "s" : ""}` : "aucune"}. ` : ""}Étoilée : ${K.etoile.charAt(0).toLowerCase()}${K.etoile.slice(1)}.`))}
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
          {entree("saigne", "Saigne", "Perd une part de l'ATQ de qui l'a entaillé à chacun de ses tours.")}
          {entree("marque", "Marqué", "Prend plus de dégâts, pour deux tours.")}
          {entree("piege", "Piégé", "Perd son prochain tour. Un gardien y résiste.")}
          {entree("voile", "Voilé", "Ne peut pas être touché jusqu'à son prochain tour.")}
          {entree("gardehaute", "Garde haute", "Rend une part de son ATQ à qui le frappe, jusqu'à son prochain tour.")}
          {entree("brume", "Brume", `Passé le tour ${BRUME_TOUR}, la brume se referme : chaque tour ajoute 20 % aux dégâts des deux camps. Aucun combat ne dure toujours.`)}
          {entree("recharge", "Recharge", "Tours avant que la capacité serve à nouveau.")}
          {entree("repos", "Au repos", "Convalescence après une défaite (un jour par étage atteint) ou une fuite (un jour) : la carte ne peut pas redescendre avant.")}
          {entree("artefact", "Relique", `Un artéfact trouvé en route : dans un trésor, une rencontre, ou sur les adversaires d'une élite ou d'un gardien, qui s'en servent contre vous tant qu'ils sont debout. Son bonus vaut pour toute l'équipe jusqu'à la sortie : commun +2 PV, peu commun +1 ATQ, rare +1 ATQ et +3 PV, légendaire +2 ATQ et +5 PV, et un pouvoir propre. Sur une même mécanique, seule la relique la plus forte compte. ${RELIQUES_MAX} au plus : au-delà, elles partent au sac.`)}
          {entree("source", "Source de pouvoir", "Un de vos lieux, choisi au départ. Son pouvoir vaut pour toute l'équipe toute la descente ; il grandit avec la rareté du lieu, son niveau (jusqu'au double au niveau 100) et son étoile (une rainbow en trop du lieu, ×1,5). Le lieu gagne de l'expérience avec l'équipe.")}
        </dl>
      </section>
    </div>
  );
}

function Regles({ ouvert = false }) {
  return (
    <details className="dj-regles" open={ouvert}>
      <summary>Comment ça marche</summary>
      <ul>
        <li><b>La carte</b> : chaque étage est un réseau de salles. D'une salle, on ne va qu'aux salles reliées plus bas. On voit leur genre et leur lieu, pas ce qu'elles cachent.</li>
        <li><b>L'initiative</b> : chaque carte et chaque adversaire a la sienne. La frise du combat donne l'ordre du tour.</li>
        <li><b>À votre tour</b> : un geste — attaquer, ou la capacité du rôle — puis sa cible. Les capacités se rechargent en quelques tours.</li>
        <li><b>Combat automatique</b> : une stratégie, et l'équipe joue seule. Repassez en Manuel à tout moment.</li>
        <li><b>Donjon du jour</b> : la composition de l'équipe (quatre rôles) et la source de pouvoir sont imposées, tirées chaque jour parmi vos cartes disponibles.</li>
        <li><b>Gardien</b> : vaincu, il donne une relique, et le choix de remonter avec tout ou de descendre. On peut aussi remonter après n'importe quelle salle.</li>
        <li><b>Fuir</b> : deux cinquièmes du sac tombent, chacun est blessé, et le compagnon le plus mal en point reste derrière pour couvrir la retraite — il quitte l'expédition et reste au repos jusqu'au lendemain. On ne fuit pas un gardien, ni seul.</li>
        <li><b>Défaite</b> : il ne reste qu'un quart du sac, et les compagnons restent au repos un jour par étage atteint.</li>
        <li><b>Donjon infini</b> : {DONJON.modes.infini.entree} PO l'entrée. On n'y fuit pas et on n'en remonte pas : l'équipe descend jusqu'à tomber, rapporte tout le sac, et reste au repos un jour.</li>
        <li><b>Soins</b> : le repos avant chaque gardien rend 30 % des PV et relève les tombés ; les autres repos sont rares. Entre deux étages, seuls les tombés se relèvent.</li>
        <li><b>Fiches</b> : survolez ou touchez une carte en combat pour lire son rôle, sa capacité et son état.</li>
      </ul>
    </details>
  );
}

