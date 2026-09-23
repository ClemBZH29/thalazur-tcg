import { useCallback, useEffect, useRef, useState } from "react";
import { CLIP_HAUT, CLIP_BAS, LIGNE_COUPE } from "../lib/dechirure.js";

const ECLATS = Array.from({ length: 16 }, (_, i) => ({
  x: 6 + ((i * 37) % 88),
  a: -70 + ((i * 53) % 140),
  d: 40 + ((i * 29) % 80),
  s: 2 + ((i * 17) % 5),
  dl: (i % 6) * 22,
}));

const SEUIL = 230;

/**
 * Ouverture du sachet — l'emballage physique, par opposition au booster qui
 * est le produit. La déchirure suit le doigt : la cire d'un sceau se
 * brise, un sachet se déchire — et la coupe est alignée sur le premier quart
 * de sa hauteur, juste sous le titre.
 */
export default function Sachet({ booster, sfx, ouverts, prix, onRupture, onToutOuvrir }) {
  const [dechire, setDechire] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  const geste = useRef(null);
  const dernier = useRef(0);
  const ref = useRef(0);
  // Un clic répété sur « Ouvrir sans glisser » lançait autant d'intervalles, et
  // chacun refermait sur un `ouvert` périmé : deux boosters tirés, deux débits.
  const verrou = useRef(false);
  const minuteur = useRef(null);
  useEffect(() => () => clearInterval(minuteur.current), []);

  const declencher = useCallback((fn) => {
    if (verrou.current) return;
    verrou.current = true;
    setOuvert(true);
    fn();
  }, []);
  const src = booster.sachet;

  const pousser = useCallback(
    (v) => {
      ref.current = v;
      setDechire(v);
      if (v > dernier.current + 0.1) { dernier.current = v; sfx.fissure(); }
      if (v >= 1) declencher(() => { sfx.rupture(); setTimeout(onRupture, 640); });
    },
    [declencher, onRupture, sfx]
  );

  const forcer = () => {
    if (verrou.current || minuteur.current) return;
    minuteur.current = setInterval(() => {
      const v = Math.min(1, ref.current + 0.085);
      pousser(v);
      if (v >= 1) { clearInterval(minuteur.current); minuteur.current = null; }
    }, 26);
  };

  return (
    <div className="sachet-zone">
      <div
        className={`sachet${ouvert ? " ouvert" : ""}`}
        style={{ "--d": dechire, "--coupe": `${LIGNE_COUPE}%` }}
        onPointerDown={(e) => {
          if (ouvert) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          geste.current = { x: e.clientX, acc: ref.current * SEUIL };
        }}
        onPointerMove={(e) => {
          if (!geste.current || ouvert) return;
          geste.current.acc += Math.abs(e.clientX - geste.current.x);
          geste.current.x = e.clientX;
          pousser(Math.min(1, geste.current.acc / SEUIL));
        }}
        onPointerUp={() => { geste.current = null; }}
        onPointerCancel={() => { geste.current = null; }}
      >
        <div className="sachet-bas">
          <img src={src} alt={`Sachet ${booster.titre}`} draggable="false"
               style={{ clipPath: CLIP_BAS, WebkitClipPath: CLIP_BAS }} />
          <span className="interieur" aria-hidden="true" />
        </div>

        <div className="sachet-haut">
          <img src={src} alt="" draggable="false"
               style={{ clipPath: CLIP_HAUT, WebkitClipPath: CLIP_HAUT }} />
        </div>

        <span className="guide-dechirure" aria-hidden="true" />

        {ouvert && (
          <span className="eclats-papier" aria-hidden="true">
            {ECLATS.map((e, i) => (
              <i key={i} style={{ "--x": `${e.x}%`, "--a": `${e.a}deg`,
                                  "--dd": `${e.d}px`, "--s": `${e.s}px`, "--dl": `${e.dl}ms` }} />
            ))}
          </span>
        )}
      </div>

      <h2 className="scene-titre">Déchirer le sachet</h2>
      <p className="scene-aide">
        Glisse le doigt en travers du haut, jusqu'à ce que le papier cède.
        {prix != null && ` ${prix} PO seront débitées.`}
        {ouverts > 0 && ` ${ouverts} booster${ouverts > 1 ? "s" : ""} ouvert${ouverts > 1 ? "s" : ""} jusqu'ici.`}
      </p>
      <div className="actions">
        <button className="btn quiet sm" onClick={forcer}>Ouvrir sans glisser</button>
        <button
          className="btn quiet sm"
          onClick={() => declencher(() => { sfx.rupture(); onToutOuvrir(); })}
        >
          Tout ouvrir d'un coup
        </button>
      </div>
    </div>
  );
}
