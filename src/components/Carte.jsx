import { useRef, useState } from "react";
import DosCarte from "./DosCarte.jsx";
import FaceCarte from "./FaceCarte.jsx";

/**
 * Une carte complète : inclinaison au survol, retournement 3D, balayage avec
 * inertie, et toucher simple pour agrandir. La position du pointeur alimente
 * aussi bien la rotation que l'irisation, ce qui donne le comportement d'une
 * vraie surface métallisée.
 */
/** Au-delà de cette amplitude, le relâchement dégage la carte. */
export const SEUIL_BALAYAGE = 92;

export default function Carte({
  c,
  badge = null,
  etiquette,
  taille = "plein",
  retourne = true,
  dureeFlip = 0,
  cfgImage,
  fichiers,
  onBalayage,
  onToucher,
  vivant = true,
}) {
  const boite = useRef(null);
  const inclin = useRef(null);
  const geste = useRef(null);
  const [parti, setParti] = useState(null);

  const poser = (rx, ry, mx, my) => {
    const el = inclin.current;
    if (!el) return;
    el.style.setProperty("--rx", `${rx}deg`);
    el.style.setProperty("--ry", `${ry}deg`);
    el.style.setProperty("--mx", `${mx}%`);
    el.style.setProperty("--my", `${my}%`);
  };

  const decaler = (dx, ressort) => {
    const el = boite.current;
    if (!el) return;
    el.style.transition = ressort ? "transform .32s cubic-bezier(.2,1.3,.4,1)" : "none";
    el.style.transform = `translateX(${dx}px) rotate(${dx * 0.035}deg)`;
    // Amplitude normalisée du geste : le badge s'efface en même temps que la
    // carte s'en va. Pas de transition pendant le glissement, sinon le badge
    // traîne derrière le doigt ; on n'en met qu'au retour en ressort.
    el.style.setProperty("--swipe", String(Math.min(1, Math.abs(dx) / SEUIL_BALAYAGE)));
    el.style.setProperty("--swipe-t", ressort ? ".32s" : "0s");
  };

  const survol = (e) => {
    if (!vivant || !inclin.current) return;
    const r = inclin.current.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    poser((0.5 - py) * 15, (px - 0.5) * 18, px * 100, py * 100);
  };

  const debut = (e) => {
    if (!vivant) return;
    boite.current.setPointerCapture(e.pointerId);
    geste.current = { x0: e.clientX, x: e.clientX, t: performance.now(), v: 0, ampli: 0 };
  };

  const bouge = (e) => {
    if (!vivant) return;
    if (!geste.current) return survol(e);
    const g = geste.current;
    const t = performance.now();
    g.v = (e.clientX - g.x) / Math.max(1, t - g.t);
    g.x = e.clientX;
    g.t = t;
    const dx = e.clientX - g.x0;
    g.ampli = Math.max(g.ampli, Math.abs(dx));
    if (onBalayage && retourne) decaler(dx, false);
    survol(e);
  };

  /** Le navigateur reprend la main dès que le geste devient un défilement
   *  vertical : sans ça, l'état de glissement resterait figé. */
  const annuler = () => {
    if (!geste.current) return;
    geste.current = null;
    decaler(0, true);
    poser(0, 0, 50, 50);
  };

  const fin = (e) => {
    if (!vivant) return;
    const g = geste.current;
    geste.current = null;
    // Au doigt il n'y a pas de survol : sans remise à plat, la carte resterait
    // inclinée dans la position où le doigt l'a quittée.
    if (e.pointerType !== "mouse") poser(0, 0, 50, 50);
    if (!g) return;
    const dx = e.clientX - g.x0;
    if (g.ampli < 9) {
      decaler(0, true);
      if (onToucher) onToucher();
      return;
    }
    if (!onBalayage || !retourne) return decaler(0, true);
    // Au-delà de 92 px de déplacement ou 0,55 px/ms, la carte part.
    if (Math.abs(dx) > SEUIL_BALAYAGE || Math.abs(g.v) > 0.55) {
      const sens = (dx || g.v) > 0 ? 1 : -1;
      boite.current.style.setProperty("--swipe", "1");
      setParti({ sens, dist: Math.max(560, Math.abs(g.v) * 620) });
      onBalayage();
    } else {
      decaler(0, true);
    }
  };

  const cls = taille === "plein" ? "cb-plein" : taille === "zoom" ? "cb-zoom" : "cb-petit";

  /* Une carte n'était qu'un div à écouteurs de pointeur : impossible à
     atteindre à la tabulation, invisible pour un lecteur d'écran. */
  const actionnable = Boolean(onToucher);

  return (
    <div
      ref={boite}
      className={`cardbox ${cls}${parti ? " partie" : ""}${vivant ? " live" : ""}`}
      style={parti ? { "--gx": `${parti.sens * parti.dist}px`, "--gr": `${parti.sens * 26}deg` } : undefined}
      role={actionnable ? "button" : undefined}
      tabIndex={actionnable ? 0 : undefined}
      aria-label={actionnable ? etiquette : undefined}
      onKeyDown={
        actionnable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToucher(); }
            }
          : undefined
      }
      onPointerMove={bouge}
      onPointerDown={debut}
      onPointerUp={fin}
      onPointerCancel={annuler}
      onPointerLeave={() => { if (!geste.current) poser(0, 0, 50, 50); }}
    >
      <div className="persp">
        <div ref={inclin} className="tilt">
          <div
            className={`flipper${retourne ? " face" : ""}`}
            style={dureeFlip ? { "--fd": `${dureeFlip}ms` } : undefined}
          >
            <DosCarte />
            <FaceCarte c={c} cfgImage={cfgImage} fichiers={fichiers} vignette={taille === "petit"} />
          </div>
        </div>
      </div>
      {badge}
    </div>
  );
}
