import { Lien, useRoute } from "../lib/routeur.jsx";
import { useCompte } from "../jeu/Compte.jsx";

const LIBELLE_SYNC = {
  "a-jour": "Partie à jour sur votre compte",
  "en-attente": "Changements en attente d'envoi",
  envoi: "Envoi en cours",
  "hors-ligne": "Hors ligne : la partie sera envoyée au retour du réseau",
  erreur: "La dernière synchronisation a échoué",
};

/**
 * L'entrée du compte, dans le bandeau. Connecté, elle montre l'initiale (ou la
 * photo) du joueur et une veilleuse d'état de synchronisation ; sinon, un mot.
 */
export default function BoutonCompte() {
  const { disponible, statut, utilisateur, sync } = useCompte();
  const { chemin } = useRoute();
  const ici = chemin === "/profil";
  // Sans Firebase, le profil reste l'entrée des préférences de joueur.
  if (!disponible) {
    return (
      <Lien vers="/profil" className="compte-bouton invite" actif={ici} title="Profil et préférences">
        <span className="compte-ico" aria-hidden="true">◌</span>
        <span className="compte-mot">Profil</span>
      </Lien>
    );
  }

  if (statut !== "connecte" || !utilisateur) {
    return (
      <Lien vers="/profil" className="compte-bouton invite" actif={ici}
        title={statut === "ouverture" ? "Ouverture de la session…" : "Se connecter pour garder sa collection sur tous ses appareils"}>
        <span className="compte-ico" aria-hidden="true">◌</span>
        <span className="compte-mot">{statut === "ouverture" ? "…" : "Connexion"}</span>
      </Lien>
    );
  }

  const initiale = (utilisateur.nom || utilisateur.email || "?").trim().charAt(0).toUpperCase();
  return (
    <Lien vers="/profil" className="compte-bouton" actif={ici} title={`Profil — ${LIBELLE_SYNC[sync]}`}>
      <span className="compte-avatar" aria-hidden="true">
        {utilisateur.photo
          ? <img src={utilisateur.photo} alt="" referrerPolicy="no-referrer" />
          : initiale}
      </span>
      <span className={`compte-sync ${sync}`} aria-hidden="true" />
      <span className="sr">Profil. {LIBELLE_SYNC[sync]}</span>
    </Lien>
  );
}
