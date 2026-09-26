import { LEGAL } from "../config/legal.js";
import { Lien } from "../lib/routeur.jsx";
import { mesureDisponible, rouvrirBandeau, useConsentement } from "../lib/mesure.js";
import { BASE_PORTRAITS } from "../lib/images.js";

/** Le domaine des portraits quand ils sont servis à part, sinon null : la page
 *  ne mentionne un second hébergeur que s'il existe vraiment. */
const PORTRAITS_A_PART = /^https?:\/\//.test(BASE_PORTRAITS) ? new URL(BASE_PORTRAITS).host : null;

/** Un champ laissé vide dans `config/legal.js` doit se voir, pas disparaître. */
const A = ({ v }) => (v ? <>{v}</> : <span className="a-completer">[à compléter]</span>);

/**
 * Confidentialité, traceurs et mentions légales, sur une seule page.
 *
 * Un seul traceur est soumis à consentement : la mesure d'audience (Google
 * Analytics), qui ne se charge qu'après « Accepter » dans le bandeau. Le reste
 * — la partie dans le navigateur, la session de connexion — sert à faire
 * fonctionner ce que le joueur a demandé, et relève de l'exemption de
 * l'article 82 de la loi Informatique et Libertés. Cette page doit dire vrai :
 * tout nouveau traceur ou contenu tiers s'y ajoute, et passe par le bandeau.
 */
export default function PageConfidentialite() {
  return (
    <main className="view legal" id="contenu">
      <div className="section-titre"><h1>Confidentialité</h1></div>
      <p className="lede">
        La Brume de Thalazur est un site de loisir, sans publicité. Cette page
        dit ce qu'il enregistre, où, pourquoi, et comment le reprendre.
      </p>

      <section className="panneau">
        <div className="bloc">
          <h2>Sans compte</h2>
          <p>
            Votre partie (collection, bourse, réglages, Mines de Kazim) est
            enregistrée <b>dans votre navigateur uniquement</b>, dans son stockage
            local, sous des clés commençant par <code>brume-thalazur:</code>. Elle ne
            quitte pas votre appareil et personne d'autre n'y a accès. Vous pouvez
            l'exporter depuis la bibliothèque et l'effacer depuis les réglages ou
            en vidant les données du site dans votre navigateur.
          </p>
          {PORTRAITS_A_PART ? (
            <p>
              Les polices et les images du site sont servies par le site lui-même ;
              les illustrations des cartes viennent de <code>{PORTRAITS_A_PART}</code>,
              hébergé par Firebase Hosting. Sauf si vous acceptez la mesure
              d'audience, afficher une page ne transmet votre adresse IP qu'à ces
              deux hébergeurs, sans cookie ni traceur.
            </p>
          ) : (
            <p>
              Les polices et les images sont servies par le site lui-même : sauf si
              vous acceptez la mesure d'audience, afficher une page ne transmet votre
              adresse IP qu'à l'hébergeur du site.
            </p>
          )}
        </div>

        <div className="bloc">
          <h2>Avec un compte</h2>
          <p>La connexion est facultative et passe par votre compte Google.</p>
          <table className="table-legal">
            <thead>
              <tr><th scope="col">Donnée</th><th scope="col">Pourquoi</th><th scope="col">Où</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Identifiant Google, nom, adresse e-mail, photo de profil</td>
                <td>Vous reconnaître d'un appareil à l'autre, vous afficher dans le profil</td>
                <td>Firebase Authentication</td>
              </tr>
              <tr>
                <td>Votre partie : collection, bourse, réglages, Mines de Kazim, succès, pseudo</td>
                <td>La sauvegarder et la synchroniser entre vos appareils</td>
                <td>Cloud Firestore, un document à votre seul nom</td>
              </tr>
              <tr>
                <td>Date de dernière synchronisation et échéance de conservation</td>
                <td>Réconcilier deux appareils qui ont joué chacun de leur côté ; supprimer les comptes inutilisés</td>
                <td>Cloud Firestore</td>
              </tr>
              <tr>
                <td>
                  Seulement si vous choisissez d'apparaître au classement : pseudo,
                  titre affiché, progression (complétion, boosters ouverts, strate
                  des Mines, succès et dates de complétion)
                </td>
                <td>Vous faire figurer au classement des joueurs</td>
                <td>Cloud Firestore, lisible par les autres joueurs connectés</td>
              </tr>
            </tbody>
          </table>
          <p>
            <b>Base légale :</b> l'exécution du service que vous demandez en créant
            un compte (article 6.1.b du RGPD). <b>Destinataires :</b> l'éditeur du
            site, pour l'administration technique uniquement, et Google en tant que
            sous-traitant. Rien n'est vendu ni utilisé à des fins publicitaires,
            et rien n'est montré aux autres joueurs sans votre accord.
            <b>Classement :</b> il repose sur votre consentement (article 6.1.a),
            donné en cochant « apparaître au classement » et retiré en décochant
            la case au profil, ce qui efface aussitôt votre ligne. Votre nom
            Google, votre photo et votre adresse n'y figurent jamais : le pseudo
            est saisi à la main, et n'a pas à être votre vrai nom. <b>Durée :</b> tant que vous utilisez le compte. Un compte
            resté {LEGAL.conservationAns} ans sans aucune connexion ni partie jouée est
            supprimé, avec la partie qui l’accompagne. La
            suppression demandée depuis le profil efface tout sans délai.
          </p>
          <p>
            Google peut traiter ces données hors de l'Union européenne ; ces
            transferts sont encadrés par le cadre de protection des données UE –
            États-Unis et les clauses contractuelles types de la Commission
            européenne. Votre partie est stockée dans une région européenne.
          </p>
        </div>

        {mesureDisponible && <BlocMesure />}

        <div className="bloc">
          <h2>Vos droits</h2>
          <p>
            Vous pouvez accéder à vos données, les rectifier, les emporter ou les
            effacer. Depuis le <Lien vers="/profil" actif={false} className="lien">profil</Lien> :
            « Télécharger mes données » fournit l'intégralité de votre partie en
            JSON, « Supprimer mon compte » efface tout. Pour toute autre demande,
            écrivez à <A v={LEGAL.contact} />. Si la réponse ne vous satisfait pas,
            vous pouvez saisir la CNIL (cnil.fr).
          </p>
        </div>

        <div className="bloc">
          <h2>Cookies et stockage</h2>
          <p>
            Le site ne dépose <b>aucun cookie publicitaire</b>. Les stockages
            suivants sont nécessaires à son fonctionnement et exemptés de
            consentement :
          </p>
          <table className="table-legal">
            <thead>
              <tr><th scope="col">Nom</th><th scope="col">Rôle</th><th scope="col">Durée</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><code>brume-thalazur:*</code> (stockage local)</td>
                <td>Votre partie et vos réglages sur cet appareil</td>
                <td>Jusqu'à effacement ou déconnexion</td>
              </tr>
              <tr>
                <td><code>firebaseLocalStorageDb</code>, <code>firebase-heartbeat-database</code> (IndexedDB)</td>
                <td>Votre session de connexion et son fonctionnement technique, seulement si vous vous connectez</td>
                <td>Jusqu'à la déconnexion</td>
              </tr>
              {mesureDisponible && (
                <tr>
                  <td><code>brume-thalazur:consentement</code> (stockage local)</td>
                  <td>Retenir votre choix sur la mesure d'audience</td>
                  <td>6 mois</td>
                </tr>
              )}
            </tbody>
          </table>
          {mesureDisponible && (
            <>
              <p>Soumis à votre accord :</p>
              <table className="table-legal">
                <thead>
                  <tr><th scope="col">Nom</th><th scope="col">Rôle</th><th scope="col">Durée</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>_ga</code>, <code>_ga_*</code> (cookies), <code>firebase-installations-database</code> (IndexedDB)</td>
                    <td>Mesure d'audience Google Analytics : distinguer les visites, compter les pages vues</td>
                    <td>13 mois au plus</td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
          <p>
            La fenêtre de connexion est celle de Google : ce qui s'y passe relève
            des <a className="lien" href="https://policies.google.com/privacy?hl=fr" target="_blank" rel="noopener noreferrer">règles de confidentialité de Google</a>.
          </p>
        </div>
      </section>

      <section className="panneau" id="mentions">
        <div className="bloc">
          <h2>Mentions légales</h2>
          <dl className="mentions">
            <dt>Site</dt><dd>{LEGAL.site}</dd>
            <dt>Éditeur</dt><dd><A v={LEGAL.editeur} />, à titre personnel et non professionnel</dd>
            <dt>Contact</dt><dd><A v={LEGAL.contact} /></dd>
            <dt>Hébergement</dt><dd>{LEGAL.hebergeur.nom} — {LEGAL.hebergeur.adresse}</dd>
            {PORTRAITS_A_PART && (
              <><dt>Illustrations</dt><dd>{LEGAL.hebergeurImages.nom} — {LEGAL.hebergeurImages.adresse}</dd></>
            )}
            <dt>Comptes et sauvegardes</dt><dd>{LEGAL.sousTraitant.nom} — {LEGAL.sousTraitant.adresse}</dd>
          </dl>
          <p className="muted">
            L'univers, les personnages et les illustrations sont issus de la
            campagne La Brume de Thalazur. Politique mise à jour le {LEGAL.miseAJour}.
          </p>
        </div>
      </section>
    </main>
  );
}

/** La mesure d'audience : ce qu'elle fait, sur quelle base, et le choix en cours. */
function BlocMesure() {
  const { choix } = useConsentement();
  const etat = !choix ? "aucun choix enregistré" : choix.mesure ? "acceptée" : "refusée";
  return (
    <div className="bloc">
      <h2>Mesure d'audience</h2>
      <p>
        Si vous l'acceptez, le site utilise <b>Google Analytics</b> (fourni par
        Google Ireland Limited) pour compter ses visites : pages vues, durée,
        type d'appareil, pays approximatif. Ces statistiques servent uniquement
        à savoir quelles parties du jeu sont utilisées. Elles ne sont pas
        reliées à votre compte, et aucun usage publicitaire n'en est fait :
        le stockage publicitaire et les signaux Google sont désactivés.
      </p>
      <p>
        <b>Base légale :</b> votre consentement (article 82 de la loi
        Informatique et Libertés, article 6.1.a du RGPD). <b>Durée :</b> cookies
        de 13 mois au plus ; statistiques conservées 14 mois dans Google
        Analytics. Google peut traiter ces données hors de l'Union européenne,
        dans le cadre de protection des données UE – États-Unis. Refuser n'a
        aucune conséquence sur le jeu.
      </p>
      <p>
        Votre choix actuel : <b>{etat}</b>.{" "}
        <button type="button" className="lien lien-bouton" onClick={rouvrirBandeau}>Modifier mon choix</button>
      </p>
    </div>
  );
}
