import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Politique de sécurité du contenu (CSP), posée dans index.html au build.
 *
 * GitHub Pages ne permet pas d'ajouter des en-têtes HTTP : la balise <meta>
 * est le seul moyen. Elle n'est posée qu'au build, parce que le serveur de
 * développement de Vite injecte ses propres scripts en ligne.
 *
 * Chaque origine a sa raison :
 *   script-src   googletagmanager.com — le script Google Analytics (après accord)
 *                apis.google.com      — chargé par Firebase Auth pour la fenêtre de connexion
 *   connect-src  *.googleapis.com     — Firestore, Identity Toolkit, jetons, installations
 *                google-analytics.com — envoi des mesures (après accord)
 *   frame-src    le domaine d'authentification Firebase et accounts.google.com
 *   img-src      googleusercontent.com — la photo de profil Google
 *   img-src et connect-src : l'origine de VITE_PORTRAITS_BASE, quand les
 *                portraits sont servis ailleurs que par le site (images et
 *                inventaire.json, lu par fetch)
 *
 * Une origine qui manque se voit tout de suite : la console du navigateur
 * signale « Refused to … because it violates the Content Security Policy ».
 */
/** « https://images.thalazur.io » pour une base absolue ; rien pour une base
 *  relative, déjà couverte par 'self'. Une base mal formée fait échouer le
 *  build plutôt que de publier un site dont les images seraient bloquées. */
export function originePortraits(base) {
  if (!base || !/^https?:\/\//.test(base)) return "";
  return ` ${new URL(base).origin}`;
}

function csp(env) {
  const auth = env.VITE_FIREBASE_AUTH_DOMAIN ? `https://${env.VITE_FIREBASE_AUTH_DOMAIN}` : "";
  const portraits = originePortraits(env.VITE_PORTRAITS_BASE);
  const regles = [
    "default-src 'self'",
    "script-src 'self' https://www.googletagmanager.com https://apis.google.com",
    // Les attributs style={{…}} de React exigent 'unsafe-inline' pour les styles.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://*.googleusercontent.com https://*.google-analytics.com https://*.googletagmanager.com${portraits}`,
    "font-src 'self'",
    `connect-src 'self' https://*.googleapis.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com${portraits}`,
    `frame-src ${auth} https://accounts.google.com`.replace("  ", " "),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  return regles.join("; ");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [
      react(),
      {
        name: "securite-en-tetes",
        apply: "build",
        transformIndexHtml: (html) => html.replace(
          /<meta charset="UTF-8" \/>/,
          `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp({ ...env, ...process.env })}" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />`
        ),
      },
    ],
    base: "./",
    build: {
      // Les SDK Firebase dépassent 500 Ko, mais ne se chargent qu'à la demande.
      chunkSizeWarningLimit: 700,
    },
  };
});
