import { useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import { ENTRAINEMENT, RELIQUAIRE } from "../config/reliquaire.js";
import { avancement, doublonsPourNiveau, NIVEAU_MAX, niveauDe, PALIER_IRISEE, xpDe } from "../donjon/experience.js";
import { eligible } from "../reliquaire/regles.js";

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/**
 * Les deux volets de la carte agrandie, ouverte depuis la bibliothèque.
 *
 * - **Entraîner** : sacrifier des doublons pour faire monter la carte de
 *   niveau, comme au Donjon ou en Expédition.
 * - **Reliquaire** : les dissoudre en vestiges. N'apparaît qu'une fois le
 *   Reliquaire ouvert (une extension à 60 %).
 *
 * Les doublons se décident ici, sur la carte qu'on regarde, et non dans une
 * liste de deux cents lignes. Le dernier exemplaire n'est jamais proposé.
 */
export default function VoletsCarte({ c }) {
  const { etat, entrainerCarte, dissoudreCarte, reliquaireOuvert } = useJeu();
  const [confirme, setConfirme] = useState(null);
  const [annonce, setAnnonce] = useState("");
  if (!eligible(c)) return null;

  const k = etat.collections?.[c.ext]?.[c.id]?.normale || 0;
  const doublons = Math.max(0, k - 1);
  const xp = xpDe(etat, c);
  const niveau = niveauDe(xp);
  const gain = ENTRAINEMENT.xp[c.tier] || 0;
  const auMax = niveau >= NIVEAU_MAX;
  const pourSuivant = Math.min(doublons, doublonsPourNiveau(etat, c, gain));
  const vestigesParDoublon = RELIQUAIRE.dissolution[c.tier] || 0;
  // Le palier d'irisation n'est annoncé que tant qu'il reste à franchir.
  const irise = etat.xp?.[`${c.ext}:${c.id}`]?.irisee ? null : PALIER_IRISEE[c.tier];

  const entrainer = (n) => {
    const r = entrainerCarte(c.ext, c, n);
    const l = r?.bilan?.[0];
    if (!l) return;
    let txt = `Niveau ${l.avant} → ${l.apres}.`;
    if (l.irisee) txt += " La carte gagne sa version irisée.";
    if (l.po) txt += ` ${l.po} PO pour le palier d'irisation.`;
    if (l.sachet) txt += " Un sachet offert.";
    setAnnonce(txt);
  };
  const dissoudre = (n) => {
    const cle = `d${n}`;
    if (c.tier === "legendaire" && confirme !== cle) { setConfirme(cle); return; }
    setConfirme(null);
    dissoudreCarte(c.ext, c, n);
    setAnnonce(`${pluriel(n, "exemplaire")} dissous : + ${n * vestigesParDoublon} vestiges.`);
  };

  return (
    <aside className="volets" aria-label="Doublons de cette carte" onClick={(e) => e.stopPropagation()}>
      <section className="volet">
        <h3>Entraîner</h3>
        <p className="volet-niveau">
          <b>Niveau {niveau}</b>
          <span className="volet-jauge" aria-hidden="true"><i style={{ width: `${Math.round(avancement(xp) * 100)}%` }} /></span>
        </p>
        <p className="muted">
          {auMax ? "Niveau maximal atteint."
            : `+${gain} points par doublon. Le niveau sert au Donjon et aux Expéditions${irise ? ` ; au niveau ${irise}, la carte s'irise` : ""}.`}
        </p>
        {!auMax && (
          <div className="volet-actions">
            <button type="button" className="btn sm" disabled={doublons < 1} onClick={() => entrainer(1)}>1 doublon</button>
            {pourSuivant > 1 && (
              <button type="button" className="btn quiet sm" onClick={() => entrainer(pourSuivant)}>
                {pourSuivant} → niveau {niveau + 1}
              </button>
            )}
            {doublons > 1 && doublons !== pourSuivant && (
              <button type="button" className="btn quiet sm" onClick={() => entrainer(doublons)}>Tous ({doublons})</button>
            )}
          </div>
        )}
      </section>

      {reliquaireOuvert && (
        <section className="volet">
          <h3>Reliquaire</h3>
          <p className="muted">+{vestigesParDoublon} vestiges par doublon, pour forger la carte du jour.</p>
          <div className="volet-actions">
            <button type="button" className="btn sm" disabled={doublons < 1} onClick={() => dissoudre(1)} onBlur={() => setConfirme(null)}>
              {confirme === "d1" ? "Confirmer" : "Dissoudre 1"}
            </button>
            {doublons > 1 && (
              <button type="button" className="btn quiet sm" onClick={() => dissoudre(doublons)} onBlur={() => setConfirme(null)}>
                {confirme === `d${doublons}` ? "Confirmer" : `Tous (${doublons})`}
              </button>
            )}
          </div>
        </section>
      )}

      <p className="volet-compte muted">
        {doublons > 0 ? `${pluriel(doublons, "doublon")} · le dernier exemplaire reste toujours.` : "Aucun doublon de cette carte."}
      </p>
      <p className="sr" role="status" aria-live="polite">{annonce}</p>
      {annonce && <p className="volet-annonce" aria-hidden="true">{annonce}</p>}
    </aside>
  );
}
