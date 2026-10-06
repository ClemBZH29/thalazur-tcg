import { useRef } from "react";

/**
 * Un curseur de pourcentage, au style du site : piste en `--edge-ui`, partie
 * remplie et pouce en lampe. Pas de `<input type="range">` brut, dont le
 * dessin change d'un navigateur à l'autre : un `role="slider"` complet,
 * pilotable au doigt (cible de 44 px au téléphone), à la souris et au
 * clavier (flèches ± pas, Pg préc./suiv. ± 2 pas, Début et Fin).
 */
export default function Curseur({ valeur, onChange, min = 0, max = 100, pas = 5, etiquette, id }) {
  const piste = useRef(null);
  const borne = (v) => Math.max(min, Math.min(max, Math.round(v / pas) * pas));
  const depuis = (x) => {
    const r = piste.current?.getBoundingClientRect();
    if (!r || !r.width) return valeur;
    return borne(min + ((x - r.left) / r.width) * (max - min));
  };
  const changer = (v) => { if (v !== valeur) onChange(v); };
  const pointer = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.currentTarget.focus();
    changer(depuis(e.clientX));
  };
  const bouge = (e) => { if (e.currentTarget.hasPointerCapture?.(e.pointerId)) changer(depuis(e.clientX)); };
  const touche = (e) => {
    const t = { ArrowRight: pas, ArrowUp: pas, ArrowLeft: -pas, ArrowDown: -pas, PageUp: 2 * pas, PageDown: -2 * pas }[e.key];
    if (t !== undefined) { e.preventDefault(); changer(borne(valeur + t)); }
    else if (e.key === "Home") { e.preventDefault(); changer(min); }
    else if (e.key === "End") { e.preventDefault(); changer(max); }
  };
  const pct = ((valeur - min) / (max - min)) * 100;
  return (
    <div className="curseur" id={id} role="slider" tabIndex={0} aria-label={etiquette}
      aria-valuemin={min} aria-valuemax={max} aria-valuenow={valeur} aria-valuetext={`${valeur} %`}
      onPointerDown={pointer} onPointerMove={bouge} onKeyDown={touche} style={{ "--pct": `${pct}%` }}>
      <span className="curseur-piste" ref={piste}><span className="curseur-plein" /><span className="curseur-pouce" /></span>
    </div>
  );
}
