import { useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import { focalDe, resoudreImage } from "../lib/images.js";
import { styleCadrage } from "../lib/cadrage.js";

/**
 * L'illustration seule d'une carte, sans cadre ni texte : la carte préférée
 * au classement et dans son choix au profil.
 *
 * Même résolution que la face de carte (`resoudreImage`, point focal de
 * l'inventaire). Sans image publiée, ou si elle échoue, l'initiale de la
 * carte tient la place : une ligne de classement ne montre jamais une
 * image cassée.
 */
export default function Artwork({ carte, ext, vignette = false, rainbow = false, cadre = null, className = "", onLoad }) {
  const { cfgImage, fichiers } = useJeu();
  const cfg = { ...cfgImage, extension: ext };
  const voulue = carte ? resoudreImage(carte, cfg, fichiers, { vignette }) : null;
  const [ratee, setRatee] = useState(null);
  const src = voulue && voulue !== ratee ? voulue : null;
  const classes = `artwork${rainbow ? " rainbow" : ""} ${className}`.trim();
  if (!src) {
    return (
      <span className={`${classes} sans-image`} aria-hidden="true">
        <b>{(carte?.nom || "?").charAt(0)}</b>
      </span>
    );
  }
  return (
    <span className={classes} aria-hidden="true">
      <img src={src} alt="" draggable="false" loading="lazy" decoding="async"
        style={cadre ? styleCadrage(cadre) : { objectPosition: `50% ${focalDe(carte, cfg)}%` }}
        onLoad={onLoad} onError={() => setRatee(voulue)} />
    </span>
  );
}
