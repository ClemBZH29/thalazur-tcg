import { useSyncExternalStore } from "react";
import { chargerApp, mesureConfiguree } from "./nuage/firebase.js";

/**
 * Mesure d'audience (Google Analytics via Firebase), soumise à consentement.
 *
 * Rien n'est chargé ni déposé avant l'accord : pas de SDK Analytics, pas de
 * requête vers Google, pas de cookie `_ga`. Le choix se garde six mois, puis
 * le bandeau revient — la durée que la CNIL recommande pour ne pas redemander
 * trop souvent à qui a refusé. Il se change à tout moment depuis le pied de
 * page, le profil ou la page Confidentialité ; retirer son accord coupe la
 * collecte et efface les cookies déjà posés.
 *
 * Ce que la mesure ne fait pas, par configuration : aucun stockage
 * publicitaire (`ad_storage` refusé), aucune personnalisation publicitaire,
 * cookies limités à treize mois. Les signaux Google et le partage de données
 * se désactivent côté console Google Analytics (voir README).
 */

const CLE = "brume-thalazur:consentement";
const VERSION = 1;
const VALIDITE = 182 * 24 * 3600 * 1000;        // six mois
const DUREE_COOKIE = 395 * 24 * 3600;            // treize mois, en secondes

const lire = () => {
  try {
    const c = JSON.parse(localStorage.getItem(CLE));
    if (!c || c.version !== VERSION || Date.now() - c.date > VALIDITE) return null;
    return c;
  } catch { return null; }
};

let etat = { choix: lire(), ouvert: false };
const suiveurs = new Set();
const publier = (patch) => { etat = { ...etat, ...patch }; suiveurs.forEach((f) => f()); };

/** L'état du consentement, pour React : `{ choix, ouvert }`. */
export function useConsentement() {
  return useSyncExternalStore(
    (f) => { suiveurs.add(f); return () => suiveurs.delete(f); },
    () => etat,
  );
}

export const mesureDisponible = mesureConfiguree;

/** Le bandeau doit-il s'afficher ? Seulement si la mesure existe dans ce build. */
export const bandeauVisible = (e) => mesureConfiguree && (e.ouvert || !e.choix);

export const rouvrirBandeau = () => publier({ ouvert: true });

export function choisir(mesure) {
  const choix = { version: VERSION, mesure: Boolean(mesure), date: Date.now() };
  try { localStorage.setItem(CLE, JSON.stringify(choix)); } catch { /* le choix vaudra pour la session */ }
  publier({ choix, ouvert: false });
  if (choix.mesure) activer(); else desactiver();
}

/* ── Le module Analytics, chargé une fois et seulement après accord ─────── */

let analytics = null;
let promesse = null;

function charger() {
  if (!promesse) {
    promesse = Promise.all([chargerApp(), import("firebase/analytics")])
      .then(async ([app, A]) => {
        if (!(await A.isSupported())) return null;
        A.setConsent({
          analytics_storage: "granted",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
        });
        const instance = A.initializeAnalytics(app, {
          config: {
            send_page_view: false,         // les pages sont annoncées à la main, routeur par fragment
            cookie_expires: DUREE_COOKIE,
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
          },
        });
        analytics = { A, instance };
        return analytics;
      })
      .catch((e) => { promesse = null; console.warn("[mesure]", e); return null; });
  }
  return promesse;
}

async function activer() {
  if (!mesureConfiguree) return;
  const m = await charger();
  if (!m) return;
  m.A.setAnalyticsCollectionEnabled(m.instance, true);
  // La page en cours a été affichée avant que le module n'arrive.
  const h = window.location.hash.replace(/^#/, "");
  pageVue(h.startsWith("/") ? h : "/");
}

/** Retrait de l'accord : collecte coupée, cookies `_ga` effacés. */
function desactiver() {
  if (analytics) analytics.A.setAnalyticsCollectionEnabled(analytics.instance, false);
  effacerCookies();
}

function effacerCookies() {
  const hote = window.location.hostname;
  const domaines = ["", hote, "." + hote, "." + hote.split(".").slice(-2).join(".")];
  document.cookie.split(";").map((c) => c.split("=")[0].trim())
    .filter((nom) => nom === "_ga" || nom.startsWith("_ga_") || nom === "_gid")
    .forEach((nom) => domaines.forEach((d) => {
      document.cookie = `${nom}=; Max-Age=0; path=/${d ? `; domain=${d}` : ""}`;
    }));
}

/** Au démarrage : reprend la mesure si l'accord donné est encore valable. */
export function demarrerMesure() {
  if (etat.choix?.mesure) activer();
}

/**
 * Une page vue. Le routeur vit dans le fragment (`#/comptoir`), que Google
 * Analytics ignore : on lui présente une adresse lisible, `/comptoir`.
 */
export function pageVue(chemin) {
  if (!analytics || !etat.choix?.mesure) return;
  analytics.A.logEvent(analytics.instance, "page_view", {
    page_location: window.location.origin + chemin,
    page_path: chemin,
    page_title: document.title,
  });
}
