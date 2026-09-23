import { useEffect, useState } from "react";
import { useCompte } from "../jeu/Compte.jsx";
import { useJeu } from "../jeu/Jeu.jsx";
import { Lien } from "../lib/routeur.jsx";
import { exporter } from "../lib/storage.js";
import { LEGAL } from "../config/legal.js";

const ETAT_SYNC = {
  "a-jour": ["Partie à jour sur votre compte", "ok"],
  "en-attente": ["Changements en attente — envoi dans quelques secondes", "attente"],
  envoi: ["Envoi en cours…", "attente"],
  "hors-ligne": ["Hors ligne — la partie sera envoyée au retour du réseau", "attente"],
  erreur: ["La dernière synchronisation a échoué", "ko"],
};

const heure = (d) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const date = (d) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Signe « G » de Google, dessiné plutôt que chargé : aucune requête avant le clic. */
function MarqueGoogle() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/>
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/>
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/>
    </svg>
  );
}

function Invite() {
  const { connecter, statut } = useCompte();
  const attente = statut === "ouverture";
  return (
    <section className="panneau profil-invite">
      <div className="bloc">
        <h3>Garder sa collection partout</h3>
        <p className="muted">
          Sans compte, la partie vit dans ce navigateur : un autre appareil, un
          autre navigateur ou un nettoyage des données du site repartent de zéro.
          Connecté, la collection, la bourse et les Mines de Kazim suivent votre
          compte Google, et se retrouvent sur votre téléphone comme sur votre
          ordinateur.
        </p>
        <p className="muted">
          Ce que vous avez déjà joué ici n'est pas perdu : à la première connexion,
          cette partie est ajoutée à votre compte.
        </p>
        <button type="button" className="btn google" onClick={connecter} disabled={attente}>
          <MarqueGoogle />
          <span>{attente ? "Ouverture…" : "Se connecter avec Google"}</span>
        </button>
        <p className="muted petit">
          En vous connectant, votre identifiant Google, votre nom, votre adresse
          e-mail et votre photo de profil sont transmis au site, et votre partie
          est enregistrée sur un serveur de Google (Firebase). Rien n'est publié,
          rien n'est revendu, aucun traceur publicitaire n'est déposé.{" "}
          <Lien vers="/confidentialite" actif={false} className="lien">Le détail</Lien>.
        </p>
      </div>
    </section>
  );
}

function Connecte() {
  const compte = useCompte();
  const { utilisateur, sync, derniere } = compte;
  const { etat, setEtat, bourse } = useJeu();
  const [pseudo, setPseudo] = useState(etat.profil?.pseudo || "");
  const [suppression, setSuppression] = useState(false);

  useEffect(() => { setPseudo(etat.profil?.pseudo || ""); }, [etat.profil?.pseudo]);

  const enregistrerPseudo = (e) => {
    e.preventDefault();
    const net = pseudo.trim().slice(0, 32);
    setEtat((s) => ({ ...s, profil: { ...(s.profil || {}), pseudo: net || undefined } }));
  };

  const boosters = Object.values(etat.boosters || {}).reduce((n, v) => n + v, 0);
  const cartes = Object.values(etat.collections || {}).reduce(
    (n, coll) => n + Object.values(coll).filter((e) => e.normale > 0 || e.rainbow > 0).length, 0);
  const [libelle, ton] = ETAT_SYNC[sync] || ETAT_SYNC["a-jour"];

  return (
    <>
      <section className="panneau">
        <div className="bloc profil-identite">
          <span className="profil-avatar" aria-hidden="true">
            {utilisateur.photo
              ? <img src={utilisateur.photo} alt="" referrerPolicy="no-referrer" />
              : (utilisateur.nom || "?").charAt(0).toUpperCase()}
          </span>
          <div>
            <h3>{etat.profil?.pseudo || utilisateur.nom || "Aventurier"}</h3>
            <p className="muted">
              {utilisateur.email}
              {utilisateur.depuis ? ` · compte créé le ${date(utilisateur.depuis)}` : ""}
            </p>
          </div>
        </div>

        <div className="bloc">
          <h3>Pseudo</h3>
          <p className="muted">
            Le nom sous lequel le site vous salue. Il reste privé pour l'instant ;
            laissé vide, c'est votre nom Google qui s'affiche.
          </p>
          <form className="profil-pseudo" onSubmit={enregistrerPseudo}>
            <label className="sr" htmlFor="pseudo">Pseudo</label>
            <input id="pseudo" type="text" value={pseudo} maxLength={32}
              placeholder={utilisateur.nom || "Votre pseudo"}
              onChange={(e) => setPseudo(e.target.value)} />
            <button className="btn quiet sm" type="submit"
              disabled={pseudo.trim() === (etat.profil?.pseudo || "")}>Enregistrer</button>
          </form>
        </div>

        <div className="bloc">
          <h3>Progression</h3>
          <div className="compteurs">
            <span className="compteur">Cartes différentes <b>{cartes}</b></span>
            <span className="compteur">Boosters ouverts <b>{boosters}</b></span>
            <span className="compteur">Bourse <b>{Math.floor(bourse.po)} PO</b></span>
          </div>
        </div>

        <div className="bloc">
          <h3>Synchronisation</h3>
          <p className={`profil-sync ${ton}`} role="status">
            <span className="compte-sync-pastille" aria-hidden="true" />
            {libelle}
            {derniere && sync === "a-jour" ? ` · dernier envoi à ${heure(derniere)}` : ""}
          </p>
          {compte.erreur && <p className="avis ko">{compte.erreur}</p>}
          <div className="actions gauche">
            <button className="btn quiet sm" onClick={compte.synchroniser} disabled={sync === "envoi"}>
              Synchroniser maintenant
            </button>
            <button className="btn quiet sm" onClick={compte.deconnecter}>Se déconnecter</button>
          </div>
          <p className="muted petit">
            La déconnexion vide cet appareil : la partie reste sur votre compte et
            revient à la prochaine connexion.
          </p>
        </div>
      </section>

      <section className="panneau">
        <div className="bloc">
          <h3>Mes données</h3>
          <p className="muted">
            Vous pouvez à tout moment récupérer l'intégralité de votre partie dans un
            fichier, ou supprimer votre compte. La suppression efface votre partie
            du serveur et votre identité du service de connexion ; elle est
            définitive. Sans aucune utilisation pendant {LEGAL.conservationAns} ans,
            le compte est supprimé. <Lien vers="/confidentialite" actif={false} className="lien">Politique de confidentialité</Lien>.
          </p>
          <div className="actions gauche">
            <button className="btn quiet sm" onClick={() => exporter(etat)}>Télécharger mes données</button>
            {!suppression && (
              <button className="btn quiet sm danger" onClick={() => setSuppression(true)}>
                Supprimer mon compte…
              </button>
            )}
          </div>
          {suppression && (
            <div className="profil-danger" role="alertdialog" aria-labelledby="supp-titre">
              <p id="supp-titre">
                <b>Supprimer le compte et la partie ?</b> Collection, bourse, Mines de
                Kazim : tout disparaît, sur le serveur comme sur cet appareil. Google
                vous demandera de confirmer votre identité.
              </p>
              <div className="actions gauche">
                <button className="btn sm danger-plein"
                  onClick={async () => { if (await compte.supprimerCompte()) setSuppression(false); }}>
                  Supprimer définitivement
                </button>
                <button className="btn quiet sm" onClick={() => setSuppression(false)}>Annuler</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export default function PageProfil() {
  const compte = useCompte();
  const { statut, annonce } = compte;

  return (
    <main className="view profil" id="contenu">
      <div className="section-titre"><h1>Profil</h1></div>

      {annonce && (
        <p className="avis" role="status">
          {annonce}{" "}
          <button type="button" className="avis-fermer" onClick={compte.oublierAnnonce}>Compris</button>
        </p>
      )}

      {statut === "inactif" && (
        <section className="panneau">
          <div className="bloc">
            <h3>Comptes indisponibles</h3>
            <p className="muted">
              Cette version du site n'est reliée à aucun service de connexion : la
              partie est conservée dans ce navigateur uniquement, et s'exporte
              depuis la bibliothèque.
            </p>
          </div>
        </section>
      )}
      {statut === "connecte" && compte.utilisateur && <Connecte />}
      {(statut === "invite" || statut === "ouverture") && (
        <>
          {compte.erreur && <p className="avis ko">{compte.erreur}</p>}
          <Invite />
        </>
      )}
    </main>
  );
}
