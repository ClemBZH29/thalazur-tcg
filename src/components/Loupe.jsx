import { useEffect, useRef } from "react";
import Carte from "./Carte.jsx";
import { TIER_INFO } from "../config/tiers.js";
import { nomComplet } from "../config/speciales.js";
import { reperesDe, nomType } from "../config/cartes.js";

export default function Loupe({ c, cfgImage, fichiers, onFermer }) {
  const boite = useRef(null);
  const bouton = useRef(null);

  useEffect(() => {
    // Le focus doit entrer dans le dialogue et revenir d'où il venait à la
    // fermeture, sinon il repart au début du document.
    const precedent = document.activeElement;
    bouton.current?.focus();

    const k = (e) => {
      if (e.key === "Escape") return onFermer();
      if (e.key !== "Tab") return;
      // Piège à focus : sans lui, la tabulation ressort derrière le voile.
      const cibles = boite.current?.querySelectorAll('button, [tabindex="0"]');
      if (!cibles || !cibles.length) return;
      const [premier, dernier] = [cibles[0], cibles[cibles.length - 1]];
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    };
    window.addEventListener("keydown", k);
    return () => {
      window.removeEventListener("keydown", k);
      if (precedent instanceof HTMLElement) precedent.focus();
    };
  }, [onFermer]);

  return (
    <div
      ref={boite}
      className="loupe"
      onClick={onFermer}
      role="dialog"
      aria-modal="true"
      aria-label={`Carte de ${c.nom}, ${TIER_INFO[c.tier]?.nom}${c.rainbow ? ", version Rainbow" : ""}`}
    >
      <div className="loupe-boite" onClick={(e) => e.stopPropagation()}>
        <Carte c={c} taille="zoom" cfgImage={cfgImage} fichiers={fichiers} />
      </div>
      <div className="loupe-fiche">
        <p className="loupe-titre">
          {nomComplet(c)}
          <span>
            {TIER_INFO[c.tier]?.nom}
            {c.rainbow && " · Rainbow"}
          </span>
        </p>
        {!TIER_INFO[c.tier]?.pleine && reperesDe(c).length > 0 && (
          <p className="loupe-reperes">{reperesDe(c).join("  |  ")}</p>
        )}
        {!TIER_INFO[c.tier]?.pleine && (
          <p className="loupe-secondaire">
            {c.type === "pnj"
              ? [nomType(c), c.genre === "F" ? "femme" : c.genre === "M" ? "homme" : c.genre]
                  .filter(Boolean).join(" · ")
              : nomType(c)}
          </p>
        )}
        {c.citation && <p className="loupe-anecdote">«&nbsp;{c.citation}&nbsp;»</p>}

      </div>
      <button ref={bouton} className="btn quiet sm" onClick={onFermer}>Fermer</button>
    </div>
  );
}
