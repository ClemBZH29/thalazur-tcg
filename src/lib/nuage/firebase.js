/**
 * Accès à Firebase, chargé à la demande.
 *
 * Le SDK pèse plus lourd que tout le jeu. Un visiteur qui ne se connecte
 * jamais ne le télécharge jamais, et ne contacte jamais Google : c'est aussi
 * ce qui permet au site de se passer de bandeau de consentement (voir la page
 * Confidentialité). Le chargement a lieu au clic sur « Se connecter », ou au
 * démarrage si ce navigateur a déjà une session ouverte.
 *
 * La configuration vient des variables d'environnement `VITE_FIREBASE_*`,
 * lues au build (fichier `.env.local` en développement, variables du dépôt
 * dans GitHub Actions). Ces valeurs ne sont pas des secrets : elles figurent
 * dans le JavaScript servi à tout le monde. Ce qui protège les données, ce
 * sont les règles Firestore (`firestore.rules`).
 */

const env = import.meta.env;

export const CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/** Sans configuration, le site reste entièrement local et le bouton se tait. */
export const nuageConfigure = Boolean(CONFIG.apiKey && CONFIG.projectId && CONFIG.appId);

let promesse = null;

export function chargerFirebase() {
  if (!nuageConfigure) return Promise.reject(new Error("Firebase non configuré"));
  if (!promesse) {
    promesse = Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
      import("firebase/firestore"),
    ]).then(([app, auth, fs]) => {
      const appli = app.initializeApp(CONFIG);
      const a = auth.getAuth(appli);
      a.languageCode = "fr";
      const db = fs.getFirestore(appli);
      return { auth: a, db, A: auth, F: fs };
    }).catch((e) => { promesse = null; throw e; });
  }
  return promesse;
}
