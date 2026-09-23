/**
 * Accès à Firebase, chargé à la demande.
 *
 * Le SDK pèse plus lourd que tout le jeu. Un visiteur qui ne se connecte
 * jamais et refuse la mesure d'audience ne le télécharge jamais, et ne
 * contacte jamais Google. Le compte se charge au clic sur « Se connecter »,
 * ou au démarrage si ce navigateur a déjà une session ouverte ; la mesure
 * d'audience, seulement après accord (voir src/lib/mesure.js).
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
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

/** Sans configuration, le site reste entièrement local et le bouton se tait. */
export const nuageConfigure = Boolean(CONFIG.apiKey && CONFIG.projectId && CONFIG.appId);

/** La mesure d'audience demande en plus l'identifiant Google Analytics. */
export const mesureConfiguree = nuageConfigure && Boolean(CONFIG.measurementId);

let promesseApp = null;
let promesse = null;

/**
 * L'application Firebase seule, sans service. Partagée par le compte et par
 * la mesure d'audience : chacun charge ensuite son propre module, et un
 * visiteur qui refuse la mesure sans se connecter n'en télécharge aucun.
 */
export function chargerApp() {
  if (!nuageConfigure) return Promise.reject(new Error("Firebase non configuré"));
  if (!promesseApp) {
    promesseApp = import("firebase/app")
      .then((m) => m.getApps()[0] || m.initializeApp(CONFIG))
      .catch((e) => { promesseApp = null; throw e; });
  }
  return promesseApp;
}

export function chargerFirebase() {
  if (!nuageConfigure) return Promise.reject(new Error("Firebase non configuré"));
  if (!promesse) {
    promesse = Promise.all([
      chargerApp(),
      import("firebase/auth"),
      import("firebase/firestore"),
    ]).then(([appli, auth, fs]) => {
      const a = auth.getAuth(appli);
      a.languageCode = "fr";
      const db = fs.getFirestore(appli);
      return { auth: a, db, A: auth, F: fs };
    }).catch((e) => { promesse = null; throw e; });
  }
  return promesse;
}
