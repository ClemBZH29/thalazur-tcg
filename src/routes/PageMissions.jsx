import { useJeu } from "../jeu/Jeu.jsx";
import { Lien } from "../lib/routeur.jsx";
import Icone from "../components/Icone.jsx";
import { formatDuree } from "../lib/economie.js";
import { replique } from "../missions/voix.js";
import { RECOMPENSE_SEMAINE } from "../config/missions.js";
import "../styles/missions.css";

const IMG = `${import.meta.env.BASE_URL}missions/`;
const nombre = (n) => Math.floor(n).toLocaleString("fr-FR");

/** Où se remplit une mission : la page, et son pictogramme. */
const MODES = {
  boutique: { vers: "/boutique", ico: "boutique", nom: "Boutique" },
  comptoir: { vers: "/comptoir", ico: "comptoir", nom: "Comptoir" },
  mines: { vers: "/mines", ico: "mines", nom: "Mines" },
  donjon: { vers: "/donjon", ico: "donjon", nom: "Donjon" },
  expeditions: { vers: "/expeditions", ico: "expeditions", nom: "Expéditions" },
  reliquaire: { vers: "/reliquaire", ico: "reliquaire", nom: "Reliquaire" },
};

/** « 3 j 4 h » au-delà d'un jour, « 7 h 22 » en deçà. */
function delai(ms) {
  if (ms < 86400000) return formatDuree(ms);
  const h = Math.floor(ms / 3600000);
  return `${Math.floor(h / 24)} j ${h % 24} h`;
}

function Mission({ m, index, peutRemplacer, onReclamer, onRemplacer }) {
  const mode = MODES[m.mode] || MODES.boutique;
  const etat = m.reclamee ? "faite" : m.atteinte ? "prete" : "en-cours";
  const gain = m.semaine
    ? `${RECOMPENSE_SEMAINE.sachets} boosters au choix`
    : `${nombre(m.po)} PO`;
  return (
    <li className={`msn-carte ${etat}${m.semaine ? " hebdo" : ""}`}>
      <span className="msn-mode" title={mode.nom}><Icone nom={mode.ico} taille={22} /></span>
      <div className="msn-corps">
        <p className="msn-quoi">{m.quoi}</p>
        <div className="msn-jauge" role="progressbar" aria-label={m.quoi}
          aria-valuemin={0} aria-valuemax={m.n} aria-valuenow={m.valeur}>
          <span style={{ width: `${(m.valeur / m.n) * 100}%` }} />
        </div>
        <span className="msn-compte">{nombre(m.valeur)} / {nombre(m.n)}</span>
      </div>
      <span className="msn-gain">{gain}</span>
      <div className="msn-actions">
        {m.reclamee ? (
          <span className="msn-fait" aria-label="Réclamée">✓</span>
        ) : m.atteinte ? (
          <button className="btn sm" onClick={() => onReclamer(index)}>Réclamer</button>
        ) : (
          <Lien vers={mode.vers} className="btn quiet sm" actif={false}>Y aller</Lien>
        )}
        {peutRemplacer && !m.atteinte && !m.reclamee && (
          <button type="button" className="msn-remplacer" onClick={() => onRemplacer(index)}
            title="Remplacer cette mission (une fois par jour)" aria-label={`Remplacer : ${m.quoi}`}>
            <Icone nom="remplacer" taille={18} />
          </button>
        )}
      </div>
    </li>
  );
}

export default function PageMissions() {
  const { missions, etat } = useJeu();
  const { quotidiennes, hebdo, aReclamer, remplacements, echeances, reclamer, remplacer } = missions;
  const jour = etat.missions?.jour || "";
  const toutes = [...quotidiennes, ...(hebdo ? [hebdo] : [])];
  const humeur = aReclamer > 0 ? "pret"
    : quotidiennes.length && quotidiennes.every((m) => m.reclamee) ? "fini"
    : (etat.missions?.remplacees || 0) > 0 && toutes.every((m) => !m.atteinte) ? "remplacee"
    : "accueil";

  return (
    <main className="view missions" id="contenu">
      <section className="msn-scene" aria-label="Bodégué">
        <div className="msn-personnage">
          <span className="msn-lueur" aria-hidden="true" />
          <img className="msn-portrait" src={`${IMG}bodegue.webp`} alt="" draggable="false" />
        </div>
        <p className="msn-bulle" aria-live="polite">{replique(humeur, jour)}</p>
        <p className="msn-nom">Bodégué</p>
      </section>

      <section className="msn-tableau">
        <header className="msn-tete">
          <h1>Missions</h1>
          <span className="msn-echeance" title="Les missions du jour changent à minuit">
            <Icone nom="horloge" taille={16} /> {delai(echeances.jour)}
          </span>
        </header>
        <ol className="msn-liste">
          {quotidiennes.map((m, i) => (
            <Mission key={`${jour}-${m.type}`} m={m} index={i} peutRemplacer={remplacements > 0}
              onReclamer={reclamer} onRemplacer={remplacer} />
          ))}
        </ol>

        {hebdo && (
          <>
            <header className="msn-tete sous">
              <h2>Cette semaine</h2>
              <span className="msn-echeance" title="La mission de la semaine change le lundi">
                <Icone nom="horloge" taille={16} /> {delai(echeances.semaine)}
              </span>
            </header>
            <ol className="msn-liste">
              <Mission m={hebdo} index="hebdo" peutRemplacer={false} onReclamer={reclamer} onRemplacer={() => {}} />
            </ol>
          </>
        )}

        <details className="msn-regles">
          <summary>Comment ça marche</summary>
          <p>
            Trois missions par jour, une par semaine. Une mission du jour se
            remplace une fois par jour. Une mission remplie et oubliée est
            payée au changement de jour.
          </p>
        </details>
      </section>
    </main>
  );
}
