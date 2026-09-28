import { useEffect, useRef, useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import { rentrees } from "../expeditions/regles.js";
import "../styles/expeditions.css";

const IMG = `${import.meta.env.BASE_URL}expeditions/`;
const ICONE_VESTIGE = `${import.meta.env.BASE_URL}reliquaire/vestige.webp`;

/**
 * La fenêtre de retour des expéditions.
 *
 * Elle vit dans la coque du site, pas dans la page des Expéditions : une
 * expédition rentre pendant qu'on fait autre chose, et c'est là qu'on doit
 * l'apprendre. Elle ne s'ouvre jamais par-dessus un combat du Donjon ni une
 * ouverture de booster (`occupe`, calculé par la coque) : le retour attend la
 * fin, puis s'annonce. Plusieurs retours arrivés ensemble tiennent dans une
 * seule fenêtre.
 *
 * Le crédit se fait à l'annonce, une fois : la route quitte l'état au moment
 * où son bilan s'affiche.
 */
export default function RetourExpeditions({ occupe }) {
  const jeu = useJeu();
  const { etat, accueillirExpeditions, partirExpedition, indexCartes } = jeu;
  const [bilans, setBilans] = useState(null);
  const [relances, setRelances] = useState({});
  const dlg = useRef(null);
  const [tic, setTic] = useState(0);

  // Le temps passe même sans qu'on touche à rien : on regarde toutes les 30 s
  // et au retour sur l'onglet.
  useEffect(() => {
    const iv = setInterval(() => setTic((t) => t + 1), 30000);
    const vu = () => { if (!document.hidden) setTic((t) => t + 1); };
    document.addEventListener("visibilitychange", vu);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", vu); };
  }, []);

  const dues = rentrees(etat).length;
  useEffect(() => {
    if (occupe || bilans || !dues) return;
    const b = accueillirExpeditions();
    if (b.length) { setRelances({}); setBilans(b); }
  }, [occupe, bilans, dues, tic, accueillirExpeditions]);

  useEffect(() => {
    const d = dlg.current;
    if (bilans && d && !d.open) d.showModal();
  }, [bilans]);

  if (!bilans) return null;
  const fermer = () => { dlg.current?.close(); setBilans(null); };
  const relancer = (b) => {
    const cartes = b.route.cartes.map((k) => indexCartes[k]).filter(Boolean);
    const ok = partirExpedition(b.lieu, cartes, b.route.heures);
    setRelances((r) => ({ ...r, [b.route.id]: ok ? "ok" : "ko" }));
  };
  const titre = bilans.length > 1 ? `${bilans.length} expéditions sont rentrées` : `Retour de ${bilans[0].lieu?.nom || "la route"}`;

  return (
    <dialog className="exp-retour" ref={dlg} aria-labelledby="exp-retour-titre" onClose={() => setBilans(null)}>
      <div className="exp-retour-tete">
        <img src={`${IMG}maitre-route.webp`} alt="" className="exp-retour-portrait" draggable="false" />
        <div>
          <h2 id="exp-retour-titre">{titre}</h2>
          <p className="muted">La maîtresse de route range le butin. Les compagnons sont de nouveau libres pour le Donjon.</p>
        </div>
      </div>
      {bilans.map((b) => (
        <section key={b.route.id} className="exp-retour-bloc">
          <h3>{b.lieu?.nom}<small>{b.route.cartes.length} compagnons · {b.route.heures} h</small></h3>
          <ul>
            <li><span>Pièces d'or</span><b>+ {b.or} PO{b.orPlafonne ? " (plafond du jour atteint)" : ""}</b></li>
            <li><span><img src={ICONE_VESTIGE} alt="" className="exp-ico" />Vestiges</span><b>+ {b.vestiges}</b></li>
            <li><span>Compagnons</span><b>+ {b.xpCarte} XP chacun{b.montees ? ` · ${b.montees} niveau${b.montees > 1 ? "x" : ""} gagné${b.montees > 1 ? "s" : ""}` : ""}</b></li>
            {b.rainbows.map((c) => (
              <li key={c.id} className="arc"><span>{c.nom}</span><b>version rainbow obtenue</b></li>
            ))}
            {b.lieuNiveau && (
              <li><span>{b.lieu.nom}</span><b>+ {b.xpLieu} XP{b.lieuNiveau[1] > b.lieuNiveau[0] ? ` · niv. ${b.lieuNiveau[0]} → ${b.lieuNiveau[1]}` : ""}</b></li>
            )}
            {b.lieuRainbow && <li className="arc"><span>{b.lieu.nom}</span><b>le Lieu passe en rainbow</b></li>}
            {b.lieuPO > 0 && <li><span>{b.lieu.nom}</span><b>palier rainbow · + {b.lieuPO} PO</b></li>}
            {b.lieuSachet && <li><span>{b.lieu.nom}</span><b>niveau 100 · un booster offert</b></li>}
            {b.poXP > b.lieuPO && <li><span>Paliers rainbow déjà acquis</span><b>+ {b.poXP - b.lieuPO} PO</b></li>}
            {b.trouvees.map(({ c, nouvelle }, i) => (
              <li key={`${c.id}-${i}`}><span>{c.nom}</span><b>{nouvelle ? "nouvelle carte trouvée" : "un exemplaire trouvé"}</b></li>
            ))}
          </ul>
          <button type="button" className="btn quiet sm" disabled={!!relances[b.route.id]} onClick={() => relancer(b)}>
            {relances[b.route.id] === "ok" ? "Repartie"
              : relances[b.route.id] === "ko" ? "Impossible : plus de place ou carte occupée"
                : `Renvoyer la même équipe (${b.route.heures} h)`}
          </button>
        </section>
      ))}
      <div className="exp-retour-pied">
        <button type="button" className="btn" onClick={fermer} autoFocus>Ranger le butin</button>
      </div>
    </dialog>
  );
}
