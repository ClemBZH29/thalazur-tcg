import { useRef, useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import Artwork from "./Artwork.jsx";
import Curseur from "./Curseur.jsx";
import { focalDe } from "../lib/images.js";
import { BANNIERES, ZOOM_MAX, ZOOM_MIN, depuisFenetre, fenetre } from "../lib/cadrage.js";

const pct = (v) => `${(v * 100).toFixed(3)}%`;

/**
 * La bulle de cadrage : l'illustration entière, et par-dessus la fenêtre
 * exacte que montrera la bannière du classement. On la fait glisser du
 * doigt ou de la souris, on zoome au curseur ; un aperçu de la ligne suit.
 *
 * Les cartes sont dessinées en portrait, la bannière est une bande très
 * large : sans cadrage, on ne voit parfois qu'un front ou un ciel. La
 * fenêtre du téléphone, plus haute, est tracée en pointillés.
 */
export default function CadrageCarte({ carte, ext, rainbow, cadre, pseudo, titre, onChange, onFermer }) {
  const { cfgImage } = useJeu();
  const defaut = { x: 50, y: focalDe(carte, { ...cfgImage, extension: ext }), z: ZOOM_MIN };
  const c = cadre || defaut;
  const [a, setA] = useState(0.75); // proportions de l'illustration, lues au chargement
  const scene = useRef(null);
  const prise = useRef(null);

  const bureau = fenetre(a, BANNIERES.bureau, c);
  const tel = fenetre(a, BANNIERES.telephone, c);

  const placer = (gauche, haut) => onChange(depuisFenetre(a, BANNIERES.bureau, c.z, gauche, haut));

  const presser = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const r = scene.current.getBoundingClientRect();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    // Un toucher hors de la fenêtre l'y amène, centrée sous le doigt.
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    const dedans = fx >= bureau.gauche && fx <= bureau.gauche + bureau.l && fy >= bureau.haut && fy <= bureau.haut + bureau.h;
    const depart = dedans ? bureau : { ...bureau, gauche: fx - bureau.l / 2, haut: fy - bureau.h / 2 };
    if (!dedans) placer(depart.gauche, depart.haut);
    prise.current = { x: e.clientX, y: e.clientY, gauche: depart.gauche, haut: depart.haut, w: r.width, h: r.height };
  };
  const glisser = (e) => {
    const p = prise.current;
    if (!p || !e.currentTarget.hasPointerCapture?.(e.pointerId)) return;
    placer(p.gauche + (e.clientX - p.x) / p.w, p.haut + (e.clientY - p.y) / p.h);
  };
  const lacher = () => { prise.current = null; };
  const touche = (e) => {
    const d = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[e.key];
    if (!d) return;
    e.preventDefault();
    onChange({ ...c, x: Math.max(0, Math.min(100, c.x + d[0])), y: Math.max(0, Math.min(100, c.y + d[1])) });
  };

  return (
    <div className="cadrage" role="group" aria-label="Cadrer l'illustration au classement">
      <div className="cadrage-scene" ref={scene} style={{ aspectRatio: `${a}` }}
        onPointerDown={presser} onPointerMove={glisser} onPointerUp={lacher} onPointerCancel={lacher}>
        <Artwork carte={carte} ext={ext} className="cadrage-image"
          onLoad={(e) => { const i = e.currentTarget; if (i.naturalWidth && i.naturalHeight) setA(i.naturalWidth / i.naturalHeight); }} />
        <span className="cadrage-tel" aria-hidden="true"
          style={{ left: pct(tel.gauche), top: pct(tel.haut), width: pct(tel.l), height: pct(tel.h) }} />
        <span className="cadrage-fenetre" tabIndex={0} onKeyDown={touche}
          aria-label="Fenêtre affichée au classement : flèches pour la déplacer"
          style={{ left: pct(bureau.gauche), top: pct(bureau.haut), width: pct(bureau.l), height: pct(bureau.h) }} />
      </div>
      <p className="muted petit cadrage-legende">Faites glisser la fenêtre. En pointillés : ce qu'on voit au téléphone.</p>

      <div className="cadrage-zoom">
        <span className="champ-titre">Zoom</span>
        <Curseur valeur={c.z} min={ZOOM_MIN} max={ZOOM_MAX} pas={10} etiquette="Zoom de l'illustration"
          onChange={(z) => onChange({ ...c, z })} />
      </div>

      {/* L'aperçu reprend la ligne du classement, à sa taille de bureau. */}
      <div className="cadrage-apercu cl-ligne illustree" aria-hidden="true">
        <Artwork carte={carte} ext={ext} rainbow={rainbow} cadre={c} className="cl-art" />
        <span className="cl-rang">1</span>
        <span className="cl-joueur">
          <span className="joueur">{pseudo}</span>
          {titre && <span className="joueur-titre">{titre}</span>}
        </span>
      </div>

      <div className="cmp-puces">
        <button type="button" className="puce" onClick={() => onChange(null)} disabled={!cadre}>Recentrer</button>
        <button type="button" className="puce" aria-pressed="true" onClick={onFermer}>Terminé</button>
      </div>
    </div>
  );
}
