import { useCallback, useEffect, useRef, useState } from "react";
import { AFFICHES } from "../config/vitrine.js";
import { NOTES } from "../config/notes-version.js";
import { Lien } from "../lib/routeur.jsx";
import "../styles/vitrine.css";

const BASE = import.meta.env.BASE_URL;
/** Le temps d'une affiche, en défilement automatique. */
const DUREE = 7000;

/**
 * Une affiche : l'image, ou tant qu'elle manque, un fond teinté et le
 * personnage du module. Le texte est toujours posé par la page.
 */
function Affiche({ a }) {
  const [ratee, setRatee] = useState(false);
  return (
    <span className="vt-affiche" style={{ "--vt-teinte": a.teinte }}>
      {!ratee
        ? <img className="vt-image" src={`${BASE}${a.image}`} alt="" draggable="false" loading="lazy" onError={() => setRatee(true)} />
        : <img className="vt-repli" src={`${BASE}${a.repli}`} alt="" draggable="false" loading="lazy" />}
      <span className="vt-texte">
        <span className="vt-etiquette">{a.etiquette}</span>
        <b className="vt-titre">{a.titre}</b>
        <span className="vt-ligne">{a.texte}</span>
      </span>
    </span>
  );
}

/** La note de version, dans une fenêtre. */
export function NoteVersion({ note = NOTES[0], ouverte, onFermer }) {
  const dlg = useRef(null);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (ouverte && !d.open) d.showModal();
    if (!ouverte && d.open) d.close();
  }, [ouverte]);
  return (
    <dialog ref={dlg} className="vt-note" aria-labelledby="vt-note-titre" onClose={onFermer}
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      {/* Le focus entre en haut de la note, pas sur « Fermer » tout en bas :
          sinon la fenêtre s'ouvre déroulée jusqu'à la fin. */}
      <div className="vt-note-corps" tabIndex={-1} autoFocus>
        <p className="vt-etiquette">Version {note.version}</p>
        <h2 id="vt-note-titre">{note.titre}</h2>
        <p className="lede">{note.intro}</p>
        {note.sections.map((s) => (
          <section key={s.titre}>
            <h3>{s.titre}</h3>
            <ul>
              {s.lignes.map(([gras, suite], i) => <li key={i}><b>{gras}</b> {suite}</li>)}
            </ul>
          </section>
        ))}
        <div className="vt-note-pied">
          <button type="button" className="btn" onClick={onFermer}>Fermer</button>
        </div>
      </div>
    </dialog>
  );
}

/**
 * La vitrine de l'accueil : un carrousel d'affiches (1.1.0). Défilement
 * natif à défilement aimanté — le doigt la fait glisser sans code —, points
 * et flèches pour la souris et le clavier. Elle avance seule toutes les
 * sept secondes, sauf survolée, au clavier, ou en mouvement réduit.
 */
export default function Vitrine({ mouvementReduit = false }) {
  const piste = useRef(null);
  const [actif, setActif] = useState(0);
  const [pause, setPause] = useState(false);
  const [note, setNote] = useState(false);

  const aller = useCallback((i) => {
    const el = piste.current;
    if (!el) return;
    const n = AFFICHES.length;
    const k = ((i % n) + n) % n;
    el.scrollTo({ left: k * el.clientWidth, behavior: mouvementReduit ? "auto" : "smooth" });
  }, [mouvementReduit]);

  // L'affiche visible suit le défilement, au doigt comme au bouton.
  const suivre = () => {
    const el = piste.current;
    if (el) setActif(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };

  useEffect(() => {
    if (pause || mouvementReduit || note) return undefined;
    const t = setTimeout(() => aller(actif + 1), DUREE);
    return () => clearTimeout(t);
  }, [actif, pause, mouvementReduit, note, aller]);

  return (
    <section className="vitrine" aria-roledescription="carrousel" aria-label="À la une"
      onMouseEnter={() => setPause(true)} onMouseLeave={() => setPause(false)}
      onFocus={() => setPause(true)} onBlur={() => setPause(false)}>
      <div className="vt-piste" ref={piste} onScroll={suivre}>
        {AFFICHES.map((a, i) => (
          <div key={a.id} className="vt-case" role="group" aria-roledescription="affiche"
            aria-label={`${i + 1} sur ${AFFICHES.length} : ${a.etiquette}`} aria-hidden={i !== actif || undefined}>
            {a.note
              ? <button type="button" className="vt-lien" tabIndex={i === actif ? 0 : -1} onClick={() => setNote(true)}><Affiche a={a} /></button>
              : a.lien
                ? <a href={a.lien} className="vt-lien" target="_blank" rel="noopener noreferrer" tabIndex={i === actif ? 0 : -1}><Affiche a={a} /></a>
                : <Lien vers={a.vers} className="vt-lien" actif={false} tabIndex={i === actif ? 0 : -1}><Affiche a={a} /></Lien>}
          </div>
        ))}
      </div>
      <div className="vt-commandes">
        <button type="button" className="vt-fleche" aria-label="Affiche précédente" onClick={() => aller(actif - 1)}>‹</button>
        <div className="vt-points">
          {AFFICHES.map((a, i) => (
            <button key={a.id} type="button" className={`vt-point${i === actif ? " on" : ""}`}
              aria-label={`Afficher : ${a.etiquette}`} aria-current={i === actif || undefined} onClick={() => aller(i)} />
          ))}
        </div>
        <button type="button" className="vt-fleche" aria-label="Affiche suivante" onClick={() => aller(actif + 1)}>›</button>
      </div>
      <NoteVersion ouverte={note} onFermer={() => setNote(false)} />
    </section>
  );
}
