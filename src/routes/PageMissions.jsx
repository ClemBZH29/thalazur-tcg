import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import { Lien } from "../lib/routeur.jsx";
import Icone from "../components/Icone.jsx";
import { formatDuree } from "../lib/economie.js";
import { tenirBourse } from "../lib/bourseAffichee.js";
import { humeurDe, replique } from "../missions/voix.js";
import { dejaVu } from "../missions/regles.js";
import { RECOMPENSE_SEMAINE } from "../config/missions.js";
import * as Scene from "../missions/scene.js";
import "../styles/missions.css";

/*
 * La page des Missions : la table de Bodégué, d'après la maquette de Claude
 * Design (docs/conception/missions.md, « La page »). Bodégué se tient derrière
 * sa table, qui le coupe sous les mains ; les trois missions du jour sont des
 * billets posés sur le plateau, celle de la semaine un pli scellé. Les effets
 * (sceau, pièces, rabat, remplacement) sont dans src/missions/scene.js.
 */

const BASE = import.meta.env.BASE_URL;
const IMG = `${BASE}missions/`;
const POSES = ["neutre", "billet", "content", "malicieux", "semaine", "serein"];
const fichierPose = (p) => `${IMG}${p === "neutre" ? "bodegue" : `bodegue-${p}`}.webp`;
/** Le décor : le mur et le plateau sont deux images coupées au bord de la table,
    pour que chacune se cadre seule et que le bord tombe toujours sur --msn-table-y.
    L'adresse est rendue absolue : une url() relative passée par une variable CSS
    se lit depuis la feuille de style (assets/), pas depuis la page. */
const IMG_ABS = typeof document === "undefined" ? IMG : new URL(IMG, document.baseURI).href;
const DECOR = {
  "--msn-mur": `url(${IMG_ABS}decor-mur.webp)`,
  "--msn-plateau": `url(${IMG_ABS}decor-table.webp)`,
  "--msn-mur-tel": `url(${IMG_ABS}decor-tel-mur.webp)`,
  "--msn-plateau-tel": `url(${IMG_ABS}decor-tel-table.webp)`,
};
const nombre = (n) => Math.floor(n).toLocaleString("fr-FR");

/** Où se remplit une mission : la page, et son pictogramme. */
const MODES = {
  boutique: { vers: "/boutique", ico: "boutique" },
  comptoir: { vers: "/comptoir", ico: "comptoir" },
  mines: { vers: "/mines", ico: "mines" },
  donjon: { vers: "/donjon", ico: "donjon" },
  expeditions: { vers: "/expeditions", ico: "expeditions" },
  reliquaire: { vers: "/reliquaire", ico: "reliquaire" },
};
/** Les billets ne sont pas alignés au cordeau : ils sont posés sur une table. */
const ROTATIONS = ["-1.3deg", ".7deg", "-.5deg"];

/** « 3 j 4 h » au-delà d'un jour, « 7 h 22 » en deçà. */
function delai(ms) {
  if (ms < 86400000) return formatDuree(ms);
  const h = Math.floor(ms / 3600000);
  return `${Math.floor(h / 24)} j ${h % 24} h`;
}

function Billet({ m, i, peutRemplacer, confirme, onReclamer, onRemplacer }) {
  const mode = MODES[m.mode] || MODES.boutique;
  const etat = m.reclamee ? "faite" : m.atteinte ? "prete" : "en-cours";
  return (
    <div className="msn-place" style={{ "--rot": ROTATIONS[i % 3] }}>
      <article className={`msn-billet ${etat}`} data-billet={i}
        aria-label={`${m.quoi}. ${m.valeur} sur ${m.n}. ${m.po} PO.${m.reclamee ? " Réclamée." : m.atteinte ? " Prête." : ""}`}>
        <span className="msn-lueur-b" aria-hidden="true" />
        <span className="msn-coiffe" aria-hidden="true"><Icone nom={mode.ico} taille={20} /></span>
        {peutRemplacer && !m.atteinte && !m.reclamee && (confirme ? (
          <button type="button" className="msn-remplacer confirme" onClick={() => onRemplacer(i)}>
            <Icone nom="remplacer" taille={16} />Remplacer ?
          </button>
        ) : (
          <button type="button" className="msn-remplacer" onClick={() => onRemplacer(i)} aria-label="Remplacer cette mission">
            <Icone nom="remplacer" taille={18} />
          </button>
        ))}
        <p className="msn-quoi">{m.quoi}</p>
        <div className="msn-bas">
          <div className="msn-prog">
            <div className="msn-jauge" role="progressbar" aria-label="Progression"
              aria-valuemin={0} aria-valuemax={m.n} aria-valuenow={m.valeur}>
              <span style={{ transform: `scaleX(${Math.min(1, m.valeur / m.n)})` }} />
            </div>
            <span className="msn-compte">{nombre(m.valeur)} / {nombre(m.n)}</span>
          </div>
          <div className="msn-pied">
            <span className="msn-gain" aria-label={`${m.po} PO`}><Icone nom="piece" taille={18} />{nombre(m.po)}</span>
            <div className="msn-action">
              {m.reclamee ? (
                <span className="msn-sceau" role="img" aria-label="Réclamée">
                  <span className="msn-cire"><Icone nom="coche" taille={22} /></span>
                  <span className="msn-cire-chaude"><Icone nom="coche" taille={22} /></span>
                </span>
              ) : m.atteinte ? (
                <button type="button" className="msn-btn principal" onClick={() => onReclamer(i)}>Réclamer</button>
              ) : (
                <Lien vers={mode.vers} className="msn-btn" actif={false}>Y aller</Lien>
              )}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function Pli({ m, echeance, onReclamer }) {
  const mode = MODES[m.mode] || MODES.boutique;
  const ouvert = m.atteinte || m.reclamee;
  const etat = m.reclamee ? "faite" : m.atteinte ? "prete" : "en-cours";
  return (
    <div className="msn-place-pli">
      <article className={`msn-pli ${etat}${ouvert ? " ouvert" : ""}`} data-pli=""
        aria-label={`Mission de la semaine. ${m.quoi}. ${m.valeur} sur ${m.n}. ${RECOMPENSE_SEMAINE.sachets} boosters au choix.${m.reclamee ? " Réclamée." : m.atteinte ? " Prête." : ""}`}>
        <span className="msn-lueur-p" aria-hidden="true" />
        <span className="msn-rabat" aria-hidden="true"><span /></span>
        <span className="msn-coiffe-sem" aria-hidden="true">
          <span className="msn-coiffe-ico"><Icone nom={mode.ico} taille={18} /></span>
          <span className="msn-sceau-sem"><Icone nom="succes" taille={18} /></span>
        </span>
        <div className="msn-pli-corps">
          <p className="msn-quoi"><span className="msn-quoi-ico" aria-hidden="true"><Icone nom={mode.ico} taille={17} /></span>{m.quoi}</p>
          <div className="msn-prog">
            <div className="msn-jauge" role="progressbar" aria-label="Progression de la semaine"
              aria-valuemin={0} aria-valuemax={m.n} aria-valuenow={m.valeur}>
              <span style={{ transform: `scaleX(${Math.min(1, m.valeur / m.n)})` }} />
            </div>
            <span className="msn-compte">{nombre(m.valeur)} / {nombre(m.n)}</span>
          </div>
          <div className="msn-recompense">
            <span className="msn-pouces" aria-hidden="true">
              <img src={`${BASE}carte-dos.webp`} alt="" />
              <img src={`${BASE}carte-dos.webp`} alt="" />
            </span>
            <span className="msn-gain-sem">{RECOMPENSE_SEMAINE.sachets} boosters au choix</span>
          </div>
          <div className="msn-pli-pied">
            <span className="msn-echeance" aria-label={`Nouvelle mission de la semaine dans ${echeance}`}>
              <Icone nom="horloge" taille={15} />{echeance}
            </span>
            {m.reclamee ? (
              <Lien vers="/boutique" className="msn-btn" actif={false}><Icone nom="boutique" taille={15} />À la boutique</Lien>
            ) : m.atteinte ? (
              <button type="button" className="msn-btn principal" onClick={onReclamer}>Réclamer</button>
            ) : (
              <Lien vers={mode.vers} className="msn-btn" actif={false}>Y aller</Lien>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

export default function PageMissions() {
  const { missions, etat, mouvementReduit: reduit } = useJeu();
  const { quotidiennes, hebdo, remplacements, echeances, reclamer, remplacer, noterVu, jour } = missions;

  const racine = useRef(null);
  const couche = useRef(null);
  const lueur = useRef(null);
  const bulle = useRef(null);
  const [aide, setAide] = useState(false);
  const [confirme, setConfirme] = useState(null);
  const [remplacee, setRemplacee] = useState(false);
  const [apres, setApres] = useState(false);
  const [content, setContent] = useState(false);
  const [annonce, setAnnonce] = useState("");
  // Effets demandés pendant un clic, joués une fois le rendu à jour.
  const aJouer = useRef([]);

  const q = useCallback((sel) => racine.current?.querySelector(sel) || null, []);

  /* ── L'humeur de Bodégué ─────────────────────────────────────────────── */
  const humeur = humeurDe({ quotidiennes, hebdo, remplacee, apres, content });
  const texte = replique(humeur.voix, jour);
  const dernierTexte = useRef(texte);
  useEffect(() => {
    if (dernierTexte.current !== texte) Scene.repliquer(bulle.current, reduit);
    dernierTexte.current = texte;
  }, [texte, reduit]);

  /* ── Les effets demandés, joués après le rendu ────────────────────────── */
  useLayoutEffect(() => {
    const file = aJouer.current;
    aJouer.current = [];
    for (const f of file) f();
  });

  /* ── Arrivée sur la page : les jauges montent depuis la dernière visite ── */
  useEffect(() => {
    const M = etat.missions;
    quotidiennes.forEach((m, i) => {
      const avant = Math.min(m.valeur, dejaVu(M, i));
      if (m.valeur > avant) Scene.jauge(q(`[data-billet="${i}"] .msn-jauge span`), avant / m.n, Math.min(1, m.valeur / m.n), 250 + i * 70, reduit);
    });
    if (hebdo) {
      const avant = Math.min(hebdo.valeur, dejaVu(M, "hebdo"));
      if (hebdo.valeur > avant) Scene.jauge(q("[data-pli] .msn-jauge span"), avant / hebdo.n, Math.min(1, hebdo.valeur / hebdo.n), 460, reduit);
    }
    // En quittant la page (ou l'onglet), on retient ce qui était affiché.
    const cacher = () => { if (document.visibilityState === "hidden") noterVu(); };
    document.addEventListener("visibilitychange", cacher);
    return () => { document.removeEventListener("visibilitychange", cacher); noterVu(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Une mission se remplit pendant qu'on regarde, ou minuit passe ────── */
  const avant = useRef({ jour, pretes: quotidiennes.map((m) => m.atteinte), semaine: !!hebdo?.atteinte });
  useEffect(() => {
    const prec = avant.current;
    if (prec.jour && prec.jour !== jour) {
      [0, 1, 2].forEach((k) => Scene.poser(q(`[data-billet="${k}"]`), k * 80, reduit));
      setRemplacee(false); setApres(false);
      setAnnonce("Nouvelles missions.");
    } else {
      quotidiennes.forEach((m, i) => {
        if (m.atteinte && !m.reclamee && !prec.pretes[i]) {
          Scene.allumer(q(`[data-billet="${i}"]`), reduit);
          Scene.lampe(lueur.current, reduit);
          setAnnonce(`Mission prête : ${m.quoi}.`);
        }
      });
      if (hebdo?.atteinte && !hebdo.reclamee && !prec.semaine) {
        Scene.ouvrirPli(q("[data-pli]"), reduit);
        Scene.lampe(lueur.current, reduit);
      }
    }
    avant.current = { jour, pretes: quotidiennes.map((m) => m.atteinte), semaine: !!hebdo?.atteinte };
  }, [jour, quotidiennes, hebdo, q, reduit]);

  /* ── Réclamer ─────────────────────────────────────────────────────────── */
  const reclamerJour = useCallback((i, pieces) => {
    const m = quotidiennes[i];
    if (!m || !m.atteinte || m.reclamee) return;
    const depuis = q(`[data-billet="${i}"] .msn-action`)?.getBoundingClientRect();
    const n = pieces || Math.min(8, Math.max(3, Math.round(m.po / 6)));
    if (!reduit) tenirBourse(760);
    reclamer(i);
    setRemplacee(false); setApres(true); setContent(true); setConfirme(null);
    setAnnonce(`${m.po} PO reçues.`);
    aJouer.current.push(() => {
      Scene.sceau(q(`[data-billet="${i}"]`), reduit);
      Scene.pieces(couche.current, depuis, n, 180, reduit);
      Scene.lampe(lueur.current, reduit);
    });
  }, [quotidiennes, q, reclamer, reduit]);

  // Bodégué sourit un instant après une réclamation, puis revient.
  useEffect(() => {
    if (!content) return undefined;
    const t = setTimeout(() => setContent(false), 1500);
    return () => clearTimeout(t);
  }, [content]);

  const pretes = quotidiennes.map((m, i) => (m.atteinte && !m.reclamee ? i : -1)).filter((i) => i >= 0);
  const toutReclamer = () => {
    const parBillet = Math.max(2, Math.floor(8 / pretes.length));
    pretes.forEach((i, k) => {
      if (k === 0 || reduit) reclamerJour(i, parBillet);
      else setTimeout(() => reclamerJour(i, parBillet), k * 110);
    });
  };

  const reclamerSemaine = () => {
    if (!hebdo?.atteinte || hebdo.reclamee) return;
    const depuis = q("[data-pli] .msn-pouces")?.getBoundingClientRect();
    reclamer("hebdo");
    setRemplacee(false); setApres(true); setContent(true);
    setAnnonce(`${RECOMPENSE_SEMAINE.sachets} boosters à choisir à la boutique.`);
    Scene.boosters(couche.current, depuis, `${BASE}carte-dos.webp`, reduit);
    Scene.tasserPli(q("[data-pli]"), reduit);
    Scene.lampe(lueur.current, reduit);
  };

  /* ── Remplacer : un premier toucher arme, le second remplace ──────────── */
  useEffect(() => {
    if (confirme === null) return undefined;
    const t = setTimeout(() => setConfirme(null), 3200);
    return () => clearTimeout(t);
  }, [confirme]);

  const remplacerBillet = (i) => {
    if (confirme !== i) { setConfirme(i); return; }
    setConfirme(null);
    const art = q(`[data-billet="${i}"]`);
    const bod = q(".msn-bodegue")?.getBoundingClientRect();
    const r = art?.getBoundingClientRect();
    const versX = r && bod ? (bod.left + bod.width / 2 - (r.left + r.width / 2)) * 0.3 : 0;
    const finir = () => {
      remplacer(i);
      setRemplacee(true); setApres(false);
      aJouer.current.push(() => {
        const nouveau = q(`[data-billet="${i}"]`);
        nouveau?.getAnimations?.().forEach((a) => a.cancel());
        Scene.poser(nouveau, 0, reduit);
      });
    };
    const a = Scene.reprendre(art, versX, reduit);
    if (a) a.addEventListener("finish", finir, { once: true }); else finir();
  };

  /* ── Échap, toucher pendant une animation, clic hors de l'aide ────────── */
  useEffect(() => {
    const touche = (e) => { if (e.key === "Escape") { setAide(false); setConfirme(null); } };
    document.addEventListener("keydown", touche);
    return () => document.removeEventListener("keydown", touche);
  }, []);
  const auToucher = (e) => {
    if (Scene.enCours()) Scene.finirTout();
    if (aide && !e.target.closest?.(".msn-aide")) setAide(false);
  };

  const fini = quotidiennes.length > 0 && quotidiennes.every((m) => m.reclamee);

  return (
    <main className="view msn-page" id="contenu" ref={racine} style={DECOR} onPointerDownCapture={auToucher}>
      <div className="msn-tete">
        <h1>Missions</h1>
        <div className="msn-aide">
          <button type="button" className="msn-rond" aria-label="Comment ça marche" aria-expanded={aide} onClick={() => setAide((a) => !a)}>
            <Icone nom="aide" taille={18} />
          </button>
          {aide && (
            <div className="msn-aide-texte" role="region" aria-label="Comment ça marche">
              <p className="msn-aide-titre">Comment ça marche</p>
              <ul>
                <li>Trois missions par jour, dans trois modes différents. Elles changent à minuit.</li>
                <li>Une mission pas encore remplie se remplace une fois par jour.</li>
                <li>Remplie et oubliée, elle est payée au changement de jour.</li>
                <li>La mission de la semaine change le lundi et paie {RECOMPENSE_SEMAINE.sachets} boosters au choix.</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="msn-scene">
        <div className="msn-mur" aria-hidden="true" />
        <div className="msn-table" aria-hidden="true" />
        <div className="msn-bodegue">
          <span className="msn-lueur" ref={lueur} aria-hidden="true" />
          {POSES.map((p) => (
            <img key={p} className={`msn-pose${p === humeur.pose ? " active" : ""}`} src={fichierPose(p)}
              alt={p === humeur.pose ? "Bodégué" : ""} aria-hidden={p === humeur.pose ? undefined : true} draggable="false" />
          ))}
          <div className="msn-bulle">
            <span className="msn-bulle-pointe" aria-hidden="true" />
            <p ref={bulle}>{texte}</p>
          </div>
        </div>

        <div className="msn-jour">
          <div className="msn-ligne">
            <div className="msn-echeances">
              <span className="msn-echeance" aria-label={`Nouvelles missions dans ${delai(echeances.jour)}`}>
                <Icone nom="horloge" taille={15} />{fini && <span>Nouvelles missions :</span>}{delai(echeances.jour)}
              </span>
              <span className={`msn-echeance${remplacements > 0 ? "" : " eteint"}`}
                aria-label={remplacements > 0 ? "Un remplacement disponible aujourd'hui" : "Remplacement utilisé, de retour à minuit"}>
                <Icone nom="remplacer" taille={15} />{remplacements}
              </span>
            </div>
            {pretes.length >= 2 && (
              <button type="button" className="msn-tout" onClick={toutReclamer}>Tout réclamer</button>
            )}
          </div>
          <div className="msn-billets">
            {quotidiennes.map((m, i) => (
              <Billet key={`${jour}-${i}-${m.type}`} m={m} i={i} peutRemplacer={remplacements > 0}
                confirme={confirme === i} onReclamer={reclamerJour} onRemplacer={remplacerBillet} />
            ))}
          </div>
        </div>

        {hebdo && <Pli m={hebdo} echeance={delai(echeances.semaine)} onReclamer={reclamerSemaine} />}
      </div>

      <div className="msn-couche" ref={couche} aria-hidden="true" />
      <div className="msn-annonce" aria-live="polite">{annonce}</div>
    </main>
  );
}
