import { useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import { useCompte } from "../jeu/Compte.jsx";
import { ecrireMine } from "../lib/storage.js";
import { lireSimulation, restaurerSimulation, simulerRemise } from "./simulation.js";

/**
 * Réglages MJ (développement seulement) : simuler la remise à zéro du
 * lancement sur la partie de ce navigateur, voir la page d'attente, puis
 * tout remettre comme avant. Voir docs/conception/lancement.md.
 *
 * Bloqué quand un compte est connecté : `.env.local` pointe sur la base de
 * production, et la partie remise y serait envoyée.
 */
export default function SimulationLancement() {
  const { etat, setEtat, rechargerMine } = useJeu();
  const { statut } = useCompte();
  const [, rafraichir] = useState(0);
  const connecte = statut === "connecte";
  const sauvegarde = lireSimulation();

  const simuler = () => {
    setEtat(simulerRemise(etat));
    ecrireMine(null); // galerie neuve, comme la migration 11
    rechargerMine();
    rafraichir((n) => n + 1);
  };

  const restaurer = () => {
    const r = restaurerSimulation();
    if (!r) return;
    setEtat(r.jeu);
    ecrireMine(r.mine);
    rechargerMine();
    rafraichir((n) => n + 1);
  };

  return (
    <section className="panneau" style={{ marginTop: 22 }}>
      <div className="bloc">
        <h3>Simuler le lancement</h3>
        <p className="muted">
          Applique à la partie de ce navigateur la remise à zéro des bêta-testeurs :
          avis obligatoire, Dos de l'Éclaireur, collection et Mines vidées. La partie
          actuelle est gardée de côté et se restaure ici.
        </p>
        {connecte && (
          <p className="avis ko">
            Déconnectez-vous d'abord : connecté, la partie remise partirait sur votre compte.
          </p>
        )}
        <div className="actions gauche">
          <button className="btn sm" onClick={simuler} disabled={connecte}>
            {sauvegarde ? "Rejouer la remise" : "Simuler la remise à zéro"}
          </button>
          {sauvegarde && (
            <button className="btn quiet sm" onClick={restaurer} disabled={connecte}>
              Restaurer la partie du {new Date(sauvegarde.t).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
            </button>
          )}
          <a className="btn quiet sm" href="?attente#/">Voir la page d'attente</a>
        </div>
      </div>
    </section>
  );
}
