import { LEGAL } from "../config/legal.js";
import { Lien } from "../lib/routeur.jsx";

/** Un champ laissé vide dans `config/legal.js` doit se voir, pas disparaître. */
const A = ({ v }) => (v ? <>{v}</> : <span className="a-completer">[à compléter]</span>);

/**
 * Confidentialité, traceurs et mentions légales, sur une seule page.
 *
 * Le site ne pose aucun traceur soumis à consentement : pas de mesure
 * d'audience, pas de publicité, pas de police ni de script chargé chez un
 * tiers tant qu'on ne se connecte pas. Ce qu'il écrit dans le navigateur sert
 * à faire fonctionner le jeu et la session que le joueur a lui-même ouverte —
 * c'est l'exemption de l'article 82 de la loi Informatique et Libertés. Il n'y
 * a donc pas de bandeau, mais il y a cette page, et elle doit dire vrai : si
 * un jour un outil de mesure ou un contenu tiers s'ajoute, elle change, et le
 * bandeau devient nécessaire.
 */
export default function PageConfidentialite() {
  return (
    <main className="view legal" id="contenu">
      <div className="section-titre"><h1>Confidentialité</h1></div>
      <p className="lede">
        La Brume de Thalazur est un site de loisir, sans publicité ni mesure
        d'audience. Cette page dit ce qu'il enregistre, où, pourquoi, et comment
        le reprendre.
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
          <p>
            Les polices et les images sont servies par le site lui-même : afficher
            une page ne transmet votre adresse IP qu'à l'hébergeur du site.
          </p>
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
                <td>Votre partie : collection, bourse, réglages, Mines de Kazim, pseudo</td>
                <td>La sauvegarder et la synchroniser entre vos appareils</td>
                <td>Cloud Firestore, un document à votre seul nom</td>
              </tr>
              <tr>
                <td>Date de dernière synchronisation et échéance de conservation</td>
                <td>Réconcilier deux appareils qui ont joué chacun de leur côté ; supprimer les comptes inutilisés</td>
                <td>Cloud Firestore</td>
              </tr>
            </tbody>
          </table>
          <p>
            <b>Base légale :</b> l'exécution du service que vous demandez en créant
            un compte (article 6.1.b du RGPD). <b>Destinataires :</b> l'éditeur du
            site, pour l'administration technique uniquement, et Google en tant que
            sous-traitant. Rien n'est publié, vendu ni utilisé à des fins
            publicitaires. <b>Durée :</b> tant que vous utilisez le compte. Un compte
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
            Le site ne dépose <b>aucun cookie de mesure d'audience ni de
            publicité</b>. Il n'utilise que des stockages nécessaires à son
            fonctionnement, exemptés de consentement :
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
                <td><code>firebaseLocalStorageDb</code> (IndexedDB)</td>
                <td>Votre session de connexion, seulement si vous vous connectez</td>
                <td>Jusqu'à la déconnexion</td>
              </tr>
            </tbody>
          </table>
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
