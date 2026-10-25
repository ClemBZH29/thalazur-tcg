import { useEffect, useRef, useState } from "react";
import Curseur from "../components/Curseur.jsx";
import { temoinEffets, temoinMusique } from "../son/index.js";
import { compterCartes, useCompte } from "../jeu/Compte.jsx";
import { useJeu } from "../jeu/Jeu.jsx";
import { Lien } from "../lib/routeur.jsx";
import { ecrireMine, effacer, etatVide, exporter, importer, lireSecours, restaurerSecours, sauver } from "../lib/storage.js";
import { REVENTE } from "../config/tiers.js";
import { mesureDisponible, rouvrirBandeau, useConsentement } from "../lib/mesure.js";
import { LEGAL } from "../config/legal.js";
import { PSEUDO_MAX, nettoyerPseudo, pseudoValide } from "../succes/classement.js";
import ChoixCartePreferee from "../components/ChoixCartePreferee.jsx";
import Icone from "../components/Icone.jsx";
import { dosChoisi, dosDisponibles } from "../config/dos.js";

const ETAT_SYNC = {
  "a-jour": ["Partie à jour sur votre compte", "ok"],
  "en-attente": ["Changements en attente — envoi dans quelques secondes", "attente"],
  envoi: ["Envoi en cours…", "attente"],
  "hors-ligne": ["Hors ligne — la partie sera envoyée au retour du réseau", "attente"],
  erreur: ["La dernière synchronisation a échoué", "ko"],
};

/** Les onglets du profil, chacun à son adresse (#/profil/dos…). */
const ONGLETS = [
  { id: "", nom: "Profil" },
  { id: "dos", nom: "Dos de cartes" },
  { id: "preferences", nom: "Préférences" },
  { id: "compte", nom: "Compte et données" },
];

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
          est enregistrée sur un serveur de Google (Firebase). Rien n'est montré
          aux autres joueurs sans votre accord, rien n'est revendu, aucun
          traceur publicitaire n'est déposé.{" "}
          <Lien vers="/confidentialite" actif={false} className="lien">Le détail</Lien>.
        </p>
      </div>
    </section>
  );
}

/**
 * L'en-tête du profil : qui l'on est, ce qu'on montre. Le dos choisi y est
 * posé en vignette, comme une carte qu'on tient à la main.
 */
function EnTete() {
  const compte = useCompte();
  const { etat, bourse, succes } = useJeu();
  const u = compte.statut === "connecte" ? compte.utilisateur : null;
  const nom = etat.profil?.pseudo || u?.nom || "Aventurier";
  const titre = succes.titres.find((t) => t.id === etat.profil?.titre)?.titre;
  const dos = dosChoisi(etat);
  const boosters = Object.values(etat.boosters || {}).reduce((n, v) => n + v, 0);
  const cartes = Object.values(etat.collections || {}).reduce(
    (n, coll) => n + Object.values(coll).filter((e) => e.normale > 0 || e.rainbow > 0).length, 0);

  return (
    <section className="profil-tete">
      <span className="profil-avatar" aria-hidden="true">
        {u?.photo
          ? <img src={u.photo} alt="" referrerPolicy="no-referrer" />
          : nom.charAt(0).toUpperCase()}
      </span>
      <div className="profil-tete-nom">
        <h2>{nom}</h2>
        {titre && <p className="profil-titre">{titre}</p>}
        <div className="compteurs">
          <span className="compteur">Cartes <b>{cartes}</b></span>
          <span className="compteur">Boosters <b>{boosters}</b></span>
          <span className="compteur">Bourse <b>{Math.floor(bourse.po)} PO</b></span>
        </div>
      </div>
      <Lien vers="/profil/dos" actif={false} className="profil-tete-dos" title={`Dos de cartes : ${dos.nom}`}>
        <span className="profil-mini-dos" style={{ background: dos.fond }}>
          <img src={`${import.meta.env.BASE_URL}${dos.fichier}`} alt="" />
        </span>
        <span className="sr">Changer de dos de cartes</span>
      </Lien>
    </section>
  );
}

/** Onglet Profil : pseudo, classement, titre, carte préférée. */
function OngletProfil() {
  const compte = useCompte();
  const { etat, setEtat, succes } = useJeu();
  const profil = etat.profil || {};
  const majProfil = (champs) => setEtat((s) => ({ ...s, profil: { ...(s.profil || {}), ...champs } }));
  const [pseudo, setPseudo] = useState(etat.profil?.pseudo || "");
  useEffect(() => { setPseudo(etat.profil?.pseudo || ""); }, [etat.profil?.pseudo]);

  if (compte.statut !== "connecte" || !compte.utilisateur) {
    return compte.statut === "inactif" ? <ComptesIndisponibles /> : <Invite />;
  }

  const enregistrerPseudo = (e) => {
    e.preventDefault();
    const net = nettoyerPseudo(pseudo);
    // Vide ou trop court, il ne s'enregistre pas : un pseudo d'une lettre
    // n'identifie personne au classement.
    if (net && !pseudoValide(net)) return;
    majProfil({ pseudo: net || undefined, pseudoReporte: true });
  };

  return (
    <section className="panneau">
      <div className="bloc">
        <h3>Pseudo</h3>
        <p className="muted">
          Votre nom au classement. Il n'a pas à être votre vrai nom ; vide, c'est
          votre nom Google qui s'affiche ici, et nulle part ailleurs.
        </p>
        <form className="profil-pseudo" onSubmit={enregistrerPseudo}>
          <label className="sr" htmlFor="pseudo">Pseudo</label>
          <input id="pseudo" type="text" value={pseudo} maxLength={PSEUDO_MAX}
            placeholder="Votre pseudo" autoComplete="nickname" spellCheck={false}
            onChange={(e) => setPseudo(e.target.value)} />
          <button className="btn quiet sm" type="submit"
            disabled={nettoyerPseudo(pseudo) === (profil.pseudo || "")
              || (nettoyerPseudo(pseudo) !== "" && !pseudoValide(pseudo))}>Enregistrer</button>
        </form>
      </div>

      <div className="bloc">
        <h3>Classement</h3>
        <p className="muted">
          Les joueurs connectés voient au <Lien vers="/succes/classement" actif={false} className="lien">classement</Lien> votre
          pseudo, votre titre, votre carte préférée et votre progression. Ni votre
          nom Google, ni votre photo, ni votre adresse.
        </p>
        <label className="bascule" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={profil.classement === true}
            disabled={!pseudoValide(profil.pseudo)}
            onChange={(e) => majProfil({ classement: e.target.checked })} />
          <span>Apparaître au classement des joueurs</span>
        </label>
        {!pseudoValide(profil.pseudo) && (
          <p className="muted petit">Choisissez d'abord un pseudo : c'est lui qui apparaît au classement.</p>
        )}
        <div className="champ" style={{ marginTop: 16 }}>
          <label htmlFor="titre" className="champ-titre">Titre affiché</label>
          <select id="titre" value={profil.titre || ""}
            onChange={(e) => majProfil({ titre: e.target.value || undefined })}>
            <option value="">Aucun</option>
            {succes.titres.map((t) => <option key={t.id} value={t.id}>{t.titre}</option>)}
          </select>
          {succes.titres.length === 0 && (
            <p className="muted petit">
              Les titres se gagnent avec certains <Lien vers="/succes" actif={false} className="lien">succès</Lien>.
            </p>
          )}
        </div>
        <div className="champ" style={{ marginTop: 16 }}>
          <span className="champ-titre">Carte préférée</span>
          <p className="muted petit">Son illustration orne votre ligne du classement.</p>
          <ChoixCartePreferee />
        </div>
      </div>
    </section>
  );
}

function ComptesIndisponibles() {
  return (
    <section className="panneau">
      <div className="bloc">
        <h3>Comptes indisponibles</h3>
        <p className="muted">
          Cette version du site n'est reliée à aucun service de connexion : la
          partie est conservée dans ce navigateur uniquement, et s'exporte depuis
          l'onglet Compte et données.
        </p>
      </div>
    </section>
  );
}

/**
 * Onglet Dos de cartes : les dos que le joueur possède, et eux seuls. Un dos
 * exclusif ne s'affiche pas à qui ne l'a pas : ce serait montrer une
 * récompense qu'il ne pourra jamais obtenir.
 */
function OngletDos() {
  const { etat, setEtat } = useJeu();
  const choisi = dosChoisi(etat);
  const possedes = dosDisponibles(etat);
  const choisir = (id) => setEtat((s) => ({ ...s, dos: { gagnes: s.dos?.gagnes || [], choisi: id } }));

  return (
    <section className="panneau">
      <div className="bloc">
        <h3>Dos de cartes</h3>
        <p className="muted">Le dos choisi habille toutes vos cartes encore face cachée.</p>
        <ul className="dos-galerie" role="list">
          {possedes.map((d) => {
            const on = choisi.id === d.id;
            return (
              <li key={d.id}>
                <button type="button" className={`dos-tuile${on ? " on" : ""}`}
                  aria-pressed={on} onClick={() => choisir(d.id)}>
                  <span className="dos-tuile-carte" style={{ background: d.fond }}>
                    <img src={`${import.meta.env.BASE_URL}${d.fichier}`} alt="" loading="lazy" draggable="false" />
                    {on && <span className="dos-tuile-coche" aria-hidden="true"><Icone nom="coche" taille={16} /></span>}
                    {d.puce && <span className="dos-puce">{d.puce}</span>}
                  </span>
                  <span className="dos-tuile-nom">{d.nom}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** Onglet Compte et données : synchronisation, fichiers, suppression. */
function OngletCompte() {
  const compte = useCompte();
  const { etat } = useJeu();
  const { statut, sync, derniere } = compte;
  const connecte = statut === "connecte" && compte.utilisateur;
  const [suppression, setSuppression] = useState(false);
  const [libelle, ton] = ETAT_SYNC[sync] || ETAT_SYNC["a-jour"];

  return (
    <>
      {connecte && (
        <section className="panneau">
          <div className="bloc">
            <h3>Compte Google</h3>
            <p className="muted">
              {compte.utilisateur.email}
              {compte.utilisateur.depuis ? ` · compte créé le ${date(compte.utilisateur.depuis)}` : ""}
            </p>
            <p className={`profil-sync ${ton}`} role="status" style={{ marginTop: 12 }}>
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
              La déconnexion vide cet appareil : la partie reste sur votre compte.
            </p>
          </div>
        </section>
      )}
      {!connecte && statut !== "inactif" && <Invite />}

      <section className="panneau">
        <Sauvegarde />
        <div className="bloc">
          <h3>Mes données</h3>
          <p className="muted">
            Récupérez toute votre partie dans un fichier{connecte ? ", ou supprimez votre compte : la suppression efface votre partie du serveur et votre identité du service de connexion, définitivement" : ""}.
            Sans utilisation pendant {LEGAL.conservationAns} ans, un compte est
            supprimé. <Lien vers="/confidentialite" actif={false} className="lien">Politique de confidentialité</Lien>.
          </p>
          <div className="actions gauche">
            <button className="btn quiet sm" onClick={() => exporter(etat)}>Télécharger mes données</button>
            {connecte && !suppression && (
              <button className="btn quiet sm danger" onClick={() => setSuppression(true)}>
                Supprimer mon compte…
              </button>
            )}
          </div>
          {suppression && (
            <div className="profil-danger" role="alertdialog" aria-labelledby="supp-titre">
              <p id="supp-titre">
                <b>Supprimer le compte et la partie ?</b> Collection, bourse, Mines de
                Kazim, dos de cartes : tout disparaît, sur le serveur comme sur cet
                appareil. Google vous demandera de confirmer votre identité.
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
        <ToutEffacer />
      </section>
    </>
  );
}

/**
 * Sauvegarde dans un fichier : exporter la partie, ou en importer une.
 * Le choix fusion / remplacement se fait dans la page (plus de fenêtre
 * `confirm` du navigateur, où « Annuler » voulait dire « remplacer »).
 */
function Sauvegarde() {
  const { etat, setEtat, rechargerMine } = useJeu();
  const fichierRef = useRef(null);
  const [message, setMessage] = useState(null);
  const [fichier, setFichier] = useState(null);

  // La copie gardée par l'appareil avant qu'une synchronisation ne lui retire
  // des cartes (voir `adopter`, src/jeu/Compte.jsx).
  const secours = lireSecours();
  const nSecours = secours ? compterCartes(secours.jeu) : 0;

  // Restaurer, pas importer : la copie est une version antérieure de cette
  // même partie. L'import en fusion additionnait (10 et 9 → 19, puis 29 au
  // second clic) ; ici chaque compteur garde le plus grand des deux, et la
  // copie s'efface une fois reprise.
  const restaurer = () => {
    const r = restaurerSecours(etat, secours);
    if (!r) { setMessage({ ok: false, texte: "La copie de secours est illisible." }); return; }
    setEtat(r.jeu);
    if (r.mine) { ecrireMine(r.mine); rechargerMine(); }
    setMessage({ ok: true, texte: "Copie de secours restaurée : ce qu'elle avait de plus a rejoint la partie." });
  };

  const charger = async (mode) => {
    const f = fichier;
    setFichier(null);
    try {
      setEtat(await importer(f, etat, mode));
      setMessage({ ok: true, texte: mode === "fusion" ? "Sauvegarde fusionnée avec la partie en cours." : "Sauvegarde importée." });
    } catch (err) {
      setMessage({ ok: false, texte: `Import impossible : ${err.message}` });
    }
  };

  return (
    <div className="bloc">
      <h3>Sauvegarde dans un fichier</h3>
      <p className="muted">Un fichier contient toute la partie : collection, bourse, Mines.</p>
      <div className="actions gauche">
        <button className="btn quiet sm" onClick={() => exporter(etat)}>Exporter</button>
        <button className="btn quiet sm" onClick={() => fichierRef.current?.click()}>Importer…</button>
        <input
          ref={fichierRef} type="file" accept="application/json" className="cache"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { setFichier(f); setMessage(null); }
            e.target.value = "";
          }}
        />
      </div>
      {fichier && (
        <div className="profil-choix" role="group" aria-labelledby="import-titre">
          <p id="import-titre"><b>{fichier.name}</b> : que faire de la partie en cours ?</p>
          <div className="actions gauche">
            <button className="btn sm" onClick={() => charger("fusion")}>Fusionner les deux</button>
            <button className="btn quiet sm" onClick={() => charger("remplacement")}>Remplacer par le fichier</button>
            <button className="btn quiet sm" onClick={() => setFichier(null)}>Annuler</button>
          </div>
        </div>
      )}
      {nSecours > 0 && (
        <p className="avis">
          Copie de secours du {new Date(secours.t).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} :
          {" "}{nSecours} exemplaire{nSecours > 1 ? "s" : ""}, gardée par cet appareil avant qu'une synchronisation ne lui retire des cartes.
          {" "}<button type="button" className="lien lien-bouton" onClick={restaurer}>
            La restaurer dans la partie
          </button>
        </p>
      )}
      {message && (
        <p className={`avis${message.ok ? "" : " ko"}`} role="status">{message.texte}</p>
      )}
    </div>
  );
}

/**
 * Tout effacer : la partie repart de zéro, sur l'appareil et sur le compte.
 * Les dos de cartes gagnés restent : celui des bêta-testeurs ne se regagne pas.
 */
function ToutEffacer() {
  const compte = useCompte();
  const { etat } = useJeu();
  const [ouvert, setOuvert] = useState(false);
  const connecte = compte.statut === "connecte";

  const effacerTout = () => {
    const garde = { dos: etat.dos, lancement: etat.lancement };
    effacer();
    if ((etat.dos?.gagnes || []).length) sauver({ ...etatVide(), ...garde });
    window.location.reload();
  };

  return (
    <div className="bloc">
      <h3>Repartir de zéro</h3>
      {!ouvert ? (
        <div className="actions gauche" style={{ marginTop: 6 }}>
          <button className="btn quiet sm danger" onClick={() => setOuvert(true)}>Tout effacer…</button>
        </div>
      ) : (
        <div className="profil-danger" role="alertdialog" aria-labelledby="effacer-titre">
          <p id="effacer-titre">
            <b>Effacer la bibliothèque, les boosters, la bourse et les Mines
            {connecte ? ", sur cet appareil et sur votre compte" : ""} ?</b> C'est
            définitif. Vos dos de cartes sont conservés.
            {connecte ? " Pour vider seulement cet appareil, déconnectez-vous." : ""}
          </p>
          <div className="actions gauche">
            <button className="btn sm danger-plein" onClick={effacerTout}>Tout effacer</button>
            <button className="btn quiet sm" onClick={() => setOuvert(false)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Préférences de joueur. Elles vivaient dans la page Réglages, au milieu des
 * outils de meneur (roster, taux, mode test) ; ceux-ci ne sont plus publics,
 * et ce qui concerne le joueur a rejoint son profil.
 */
function Preferences() {
  const jeu = useJeu();
  const consentement = useConsentement();
  const { animations, sobreSysteme, reventeAuto, reglageSon, majReglages } = jeu;

  return (
    <section className="panneau" aria-labelledby="pref-titre">
      <div className="bloc">
        <h3 id="pref-titre">Animations</h3>
        <p className="muted">
          Ici l'animation porte l'information : le booster qui se déchire, la lueur
          qui annonce le palier, la carte qui se retourne. Le site est animé par
          défaut ; vous pouvez suivre la préférence de votre système
          {sobreSysteme ? ", qui demande actuellement moins d'animations," : ""} ou tout couper.
        </p>
        <div className="segments" role="group" aria-label="Animations" style={{ marginTop: 12 }}>
          {[["pleines", "Toujours animer"], ["systeme", "Suivre le système"], ["reduites", "Jamais animer"]]
            .map(([v, libelle]) => (
              <button key={v} className={animations === v ? "on" : ""} aria-pressed={animations === v}
                onClick={() => majReglages({ animations: v })}>{libelle}</button>
            ))}
        </div>
      </div>

      <div className="bloc">
        <h3>Doublons</h3>
        <p className="muted">
          Par défaut, un doublon reste dans votre inventaire pour être vendu au
          Comptoir, où il vaut plus que le rachat immédiat
          ({REVENTE.commun} PO une commune, {REVENTE.legendaire} une légendaire).
        </p>
        <label className="bascule" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={reventeAuto === true}
            onChange={(e) => majReglages({ reventeAuto: e.target.checked })} />
          <span>Revendre les doublons automatiquement à la révélation</span>
        </label>
      </div>

      {/* Le son avait un bouton dans le bandeau de toutes les pages ; il vit
          ici, avec les autres préférences, en bascule qui dit son état. */}
      <div className="bloc">
        <h3>Son</h3>
        <label className="bascule" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={reglageSon.coupe}
            onChange={(e) => majReglages({ son: { ...reglageSon, coupe: e.target.checked } })} />
          <span>Couper le son</span>
        </label>
        {[["musique", "Musique", temoinMusique], ["effets", "Effets", temoinEffets]].map(([cle, libelle, temoin]) => (
          <div key={cle} className={`reglage-son${reglageSon.coupe ? " coupe" : ""}`}>
            <label id={`son-${cle}`}>{libelle}</label>
            <Curseur etiquette={libelle} valeur={reglageSon[cle]} onChange={(v) => majReglages({ son: { ...reglageSon, [cle]: v } })} />
            <output aria-hidden="true">{reglageSon[cle]} %</output>
            <button type="button" className="btn quiet sm" onClick={temoin} disabled={reglageSon.coupe}>Écouter</button>
          </div>
        ))}
      </div>

      {mesureDisponible && (
        <div className="bloc">
          <h3>Cookies</h3>
          <div className="actions gauche" style={{ marginTop: 6 }}>
            <button className="btn quiet sm" onClick={rouvrirBandeau}>
              Mesure d'audience : {consentement.choix ? (consentement.choix.mesure ? "acceptée" : "refusée") : "à choisir"} — modifier
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function PageProfil({ onglet = "" }) {
  const compte = useCompte();
  const { annonce } = compte;
  const ici = ONGLETS.some((o) => o.id === onglet) ? onglet : "";

  return (
    <main className="view profil" id="contenu">
      <div className="section-titre"><h1>Profil</h1></div>

      {annonce && (
        <p className="avis" role="status">
          {annonce}{" "}
          <button type="button" className="avis-fermer" onClick={compte.oublierAnnonce}>Compris</button>
        </p>
      )}

      <EnTete />

      <nav className="profil-onglets" aria-label="Sections du profil">
        {ONGLETS.map((o) => (
          <Lien key={o.id} vers={o.id ? `/profil/${o.id}` : "/profil"} actif={ici === o.id}>
            {o.nom}
          </Lien>
        ))}
      </nav>

      {ici === "" && <OngletProfil />}
      {ici === "dos" && <OngletDos />}
      {ici === "preferences" && <Preferences />}
      {ici === "compte" && <OngletCompte />}
    </main>
  );
}
