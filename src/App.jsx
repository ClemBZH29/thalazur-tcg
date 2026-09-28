import { Suspense, lazy, useEffect, useRef, useState } from "react";
import Icone from "./components/Icone.jsx";
import Brume from "./components/Brume.jsx";
import Loupe from "./components/Loupe.jsx";
import { Jeu, useJeu } from "./jeu/Jeu.jsx";
import { Lien, Routeur, useRoute } from "./lib/routeur.jsx";
import { ECONOMIE } from "./config/tiers.js";

import PageAccueil from "./routes/PageAccueil.jsx";
import PageBoutique from "./routes/PageBoutique.jsx";
import PageOuverture from "./routes/PageOuverture.jsx";
import PageBibliotheque from "./routes/PageBibliotheque.jsx";
import PageProfil from "./routes/PageProfil.jsx";
import PageConfidentialite from "./routes/PageConfidentialite.jsx";
import BoutonCompte from "./components/BoutonCompte.jsx";
import { Compte } from "./jeu/Compte.jsx";
import BandeauCookies from "./components/BandeauCookies.jsx";
import ChoixPseudo from "./components/ChoixPseudo.jsx";
import PageSucces from "./routes/PageSucces.jsx";
import RetourExpeditions from "./components/RetourExpeditions.jsx";
import { demarrerMesure, mesureDisponible, pageVue, rouvrirBandeau } from "./lib/mesure.js";

/* Les deux modules pèsent chacun plus que tout le reste de l'application :
   le Comptoir porte son moteur de marché, la mine son gréement d'animation.
   Un visiteur qui vient regarder sa bibliothèque n'a aucune raison de les
   télécharger. */
const chargerComptoir = () => import("./routes/PageComptoir.jsx");
const chargerMines = () => import("./routes/PageMines.jsx");
const chargerDonjon = () => import("./routes/PageDonjon.jsx");
const chargerExpeditions = () => import("./routes/PageExpeditions.jsx");
const chargerReliquaire = () => import("./routes/PageReliquaire.jsx");
const PageDonjon = lazy(chargerDonjon);
const PageExpeditions = lazy(chargerExpeditions);
const PageReliquaire = lazy(chargerReliquaire);
const PageComptoir = lazy(chargerComptoir);
const PageMines = lazy(chargerMines);

/* Les réglages de meneur (roster, portraits, taux, mode test) ne sont plus
   une page du site : ils n'existent qu'en développement (`npm run dev`).
   En production, la condition est fausse à la compilation et le module —
   avec la lecture de classeurs .xlsx — ne figure même pas dans le build.
   Les réglages de joueur (animations, doublons) sont passés au profil. */
const PageReglages = import.meta.env.DEV ? lazy(() => import("./routes/PageReglages.jsx")) : null;

/** Les entrées de navigation, dans l'ordre où elles se lisent. */
const PAGES = [
  { vers: "/", nom: "Accueil", court: "Accueil", ico: "accueil" },
  { vers: "/boutique", nom: "Boutique", court: "Boutique", ico: "boutique" },
  // « Bibliothèque » tronqué en « Bibliothè… » dans une barre à six entrées
  // sur trois cent quatre-vingt-dix pixels : le mot court existe pour ça.
  { vers: "/bibliotheque", nom: "Bibliothèque", court: "Cartes", ico: "cartes" },
  { vers: "/comptoir", nom: "Comptoir", court: "Comptoir", ico: "comptoir" },
  { vers: "/mines", nom: "Mines", court: "Mines", ico: "mines" },
  // Succès et classement partagent une entrée : la barre en compte déjà six
  // en développement, et le classement n'a de sens qu'à côté des titres.
  { vers: "/donjon", nom: "Donjon", court: "Donjon", ico: "donjon" },
  { vers: "/expeditions", nom: "Expéditions", court: "Routes", ico: "expeditions" },
  { vers: "/reliquaire", nom: "Reliquaire", court: "Reliques", ico: "reliquaire" },
  { vers: "/succes", nom: "Succès", court: "Succès", ico: "succes" },
  ...(import.meta.env.DEV ? [{ vers: "/reglages", nom: "Réglages MJ", court: "MJ", ico: "reglages" }] : []),
];

/** Pages dessinées pour tenir sur un écran, sans défilement ni pied. */
const PLEIN = new Set(["/", "/boutique", "/mines"]);

/** Racine d'une page : « /boutique/troupe » appartient à « /boutique ». */
const racine = (chemin) => "/" + (chemin.split("/")[1] || "");

function Attente() {
  return (
    <main className="view" id="contenu">
      <p className="muted" role="status">Chargement du module…</p>
    </main>
  );
}

function Route() {
  const { chemin, remplacer } = useRoute();
  // Ancienne adresse des réglages : les préférences de joueur sont au profil.
  const ancienne = !PageReglages && chemin === "/reglages";
  useEffect(() => { if (ancienne) remplacer("/profil"); }, [ancienne, remplacer]);
  const segments = chemin.split("/").filter(Boolean);

  if (segments[0] === "boutique" && segments[1]) return <PageOuverture id={segments[1]} />;
  switch (segments[0]) {
    case undefined: return <PageAccueil />;
    case "boutique": return <PageBoutique />;
    case "bibliotheque": return <PageBibliotheque />;
    case "comptoir": return <Suspense fallback={<Attente />}><PageComptoir /></Suspense>;
    case "mines": return <Suspense fallback={<Attente />}><PageMines /></Suspense>;
    case "reglages": return PageReglages
      ? <Suspense fallback={<Attente />}><PageReglages /></Suspense>
      : <Attente />;
    case "donjon": return <Suspense fallback={<Attente />}><PageDonjon /></Suspense>;
    case "expeditions": return <Suspense fallback={<Attente />}><PageExpeditions /></Suspense>;
    case "reliquaire": return <Suspense fallback={<Attente />}><PageReliquaire /></Suspense>;
    case "succes": return <PageSucces onglet={segments[1]} />;
    case "profil": return <PageProfil />;
    case "confidentialite": return <PageConfidentialite />;
    default: return <Introuvable chemin={chemin} />;
  }
}

function Introuvable({ chemin }) {
  return (
    <main className="view introuvable" id="contenu">
      <section className="perdu">
        <p className="perdu-code" aria-hidden="true">404</p>
        <h1>Perdu dans la brume</h1>
        <p className="lede">
          Aucun sentier ne mène à <code>{chemin}</code>. La carte a peut-être
          changé, ou le brouillard a mangé la fin de l'adresse.
        </p>
        <div className="hero-actions">
          <Lien vers="/" className="btn" actif={false}>Revenir au camp</Lien>
          <Lien vers="/boutique" className="btn quiet" actif={false}>Voir la boutique</Lien>
        </div>
      </section>
    </main>
  );
}

/**
 * Coque du site. Le bandeau et la navigation restent en place d'une page à
 * l'autre : les modules sont des pages du même lieu, pas des applications
 * juxtaposées.
 */
function Coque() {
  const { chemin } = useRoute();
  const jeu = useJeu();
  const premier = useRef(true);
  const zone = useRef(null);
  const tete = useRef(null);
  const nav = useRef(null);
  const burger = useRef(null);
  // Au doigt, la navigation n'est plus une barre d'onglets : sept sections n'y
  // tenaient plus. Elle se replie dans un menu, ouvert par le bouton en bas à
  // droite, là où tombe le pouce. Sur grand écran, rien ne change.
  const [menu, setMenu] = useState(false);
  useEffect(() => { setMenu(false); }, [chemin]);
  useEffect(() => {
    if (!menu) return;
    nav.current?.querySelector("a.on, a")?.focus();
    const k = (e) => { if (e.key === "Escape") { setMenu(false); burger.current?.focus(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [menu]);

  /* Hauteur du bandeau collant, pour ce qui se colle dessous (la barre de
     recherche de la bibliothèque). Elle change avec l'encoche, la connexion
     (le bouton de compte s'élargit) et l'orientation ; en paysage bas le
     bandeau n'est plus collant et la valeur retombe à zéro. */
  useEffect(() => {
    const el = tete.current;
    if (!el) return;
    const racineDoc = document.documentElement;
    const poser = () => {
      const collant = getComputedStyle(el).position === "sticky";
      racineDoc.style.setProperty("--tete-h", `${collant ? el.offsetHeight : 0}px`);
    };
    poser();
    const obs = typeof ResizeObserver === "function" ? new ResizeObserver(poser) : null;
    obs?.observe(el);
    window.addEventListener("resize", poser);
    return () => { obs?.disconnect(); window.removeEventListener("resize", poser); };
  }, []);
  const ici = racine(chemin);

  /**
   * Préchargement des deux pages lourdes, dès que le navigateur n'a plus rien
   * à faire.
   *
   * Le Comptoir et les Mines sont chargés à la demande : c'est juste pour qui
   * vient regarder sa bibliothèque, et pénible pour qui va aux Mines — le clic
   * déclenche le téléchargement du module, de sa feuille de style et, en
   * développement, sa compilation. Sur une machine modeste cela fait plusieurs
   * secondes d'attente, au moment précis où l'on a demandé quelque chose.
   *
   * On déplace donc ce travail là où il ne coûte rien : après le premier
   * rendu, pendant que le visiteur lit l'accueil. Le navigateur nous prévient
   * quand il est libre ; à défaut, on attend deux secondes, ce qui laisse
   * passer tout ce qui compte vraiment. Le clic, lui, ne trouve plus qu'un
   * module déjà en cache.
   */
  // Mesure d'audience : reprise si l'accord est encore valable, puis une
  // page vue à chaque changement d'adresse (sans effet tant qu'il n'y a pas
  // d'accord).
  useEffect(() => { demarrerMesure(); }, []);
  useEffect(() => { pageVue(chemin); }, [chemin]);

  useEffect(() => {
    let annule = false;
    const precharger = () => {
      if (annule) return;
      chargerComptoir();
      chargerMines();
      chargerDonjon();
      chargerExpeditions();
      chargerReliquaire();
    };
    const libre = typeof window.requestIdleCallback === "function";
    const id = libre
      ? window.requestIdleCallback(precharger, { timeout: 3000 })
      : window.setTimeout(precharger, 2000);
    return () => {
      annule = true;
      if (libre) window.cancelIdleCallback(id); else window.clearTimeout(id);
    };
  }, []);

  /* Sur un site en une seule page, le navigateur ne remet ni le défilement ni
     le focus au changement d'adresse : sans cela on arrive au Comptoir au
     milieu de la page et la tabulation reprend là où elle était. */
  useEffect(() => {
    if (premier.current) { premier.current = false; return; }
    window.scrollTo({ top: 0, behavior: "auto" });

    /* Le titre d'une page chargée à la demande n'existe pas encore quand
       l'adresse change : viser la zone entière faisait lire toute la page au
       lecteur d'écran. On réessaie sur quelques images, puis on se rabat sur
       la zone. */
    let restant = 8;
    let image = 0;
    const viser = () => {
      const h1 = zone.current?.querySelector("h1");
      const cible = h1 || (restant-- > 0 ? null : zone.current);
      if (!cible) { image = requestAnimationFrame(viser); return; }
      cible.setAttribute("tabindex", "-1");
      cible.focus({ preventScroll: true });
    };
    image = requestAnimationFrame(viser);
    return () => cancelAnimationFrame(image);
  }, [chemin]);

  const { bourse, gratuit, collecte, surplusTotal, stockageKo, loupe,
    setLoupe, cfgImage, fichiers, succes, etat } = jeu;

  /* Le retour d'une expédition attend : jamais par-dessus une ouverture de
     booster (cérémonie et bilan, où passe le colporteur), ni par-dessus une
     descente du Donjon en cours tant qu'on est sur sa page. */
  const segments = chemin.split("/").filter(Boolean);
  const occupe = !!etat.enCours || (segments[0] === "boutique" && !!segments[1])
    || (segments[0] === "donjon" && !!etat.donjon?.partie);

  return (
    <>
      <Brume />
      <a className="saut" href="#contenu">Aller au contenu</a>
      {/* L'étagère « sur un seul écran » d'app.css suit l'étagère, qui a
          déménagé de l'accueil vers la boutique. L'accueil est devenu une
          vitrine à quatre sections : elle défile, et le traitement pleine
          hauteur y écrasait les marges de tous les titres. */}
      <div className={`shell${chemin === "/boutique" || chemin === "/" ? " plein" : ""}${chemin === "/mines" ? " mines-plein" : ""}`}>
        {/* Le bandeau et la barre d'onglets sont frères, pas imbriqués. Le
            bandeau porte un flou d'arrière-plan, et un `backdrop-filter`
            devient bloc conteneur de ses descendants en position fixe : la
            barre d'onglets, fixée en bas de l'écran au doigt, se retrouvait
            collée en haut du bandeau. Deux étages règlent la question et se
            lisent mieux : identité et bourse au-dessus, sections en dessous. */}
        <div className="tete" ref={tete}>
        <header className="masthead">
          {/* Sous 420 px, le titre entier était coupé en « La Brume de
              Thala… ». Il reste le nom accessible du lien ; l'écran n'en
              montre que le dernier mot. */}
          <Lien vers="/" className="brand" actif={false}>
            <b>
              <span className="brand-long">La Brume de Thalazur</span>
              <span className="brand-court" aria-hidden="true">Thalazur</span>
            </b>
          </Lien>

          <div className="masthead-droite">
            {stockageKo && (
              <span
                className="alerte"
                role="status"
                title="Le navigateur refuse d'écrire : quota dépassé ou navigation privée. La progression de cette session ne sera pas conservée."
              >
                Sauvegarde impossible
              </span>
            )}
            <span
              className={`bourse${gratuit ? " libre" : ""}`}
              title={`Gain passif de ${ECONOMIE.parHeure} PO par heure, plafonné à ${ECONOMIE.plafond}`}
            >
              <span className="bourse-veille" aria-hidden="true" />
              {gratuit ? "PO désactivées" : `${Math.floor(bourse.po)} PO`}
            </span>
            {/* Le son se règle au profil, avec les autres préférences : il
                prenait un bouton du bandeau, sur chaque page, pour un réglage
                qu'on touche une fois. */}
            <BoutonCompte />
          </div>
        </header>

          <nav className={`nav${menu ? " ouverte" : ""}`} id="nav-site" aria-label="Pages du site" ref={nav}>
            {PAGES.map((p) => (
              <Lien key={p.vers} vers={p.vers} actif={ici === p.vers}>
                <Icone nom={p.ico} className="nav-ico" />
                <span className="nav-nom">{p.nom}</span>
                <span className="nav-court" aria-hidden="true">{p.court}</span>
                {p.vers === "/bibliotheque" && collecte > 0 && (
                  <span className="count">{collecte}</span>
                )}
                {p.vers === "/succes" && succes.aReclamer.length > 0 && (
                  <span className="count pastille" title={`${succes.aReclamer.length} succès à réclamer`}>
                    {succes.aReclamer.length}
                  </span>
                )}
                {p.vers === "/comptoir" && surplusTotal > 0 && (
                  <span className="count pastille" title={`${surplusTotal} exemplaires en surplus`}>
                    {surplusTotal}
                  </span>
                )}
              </Lien>
            ))}
          </nav>
          {menu && <div className="nav-voile" aria-hidden="true" onClick={() => setMenu(false)} />}
          <button type="button" ref={burger} className={`burger${menu ? " ouvert" : ""}`}
            aria-expanded={menu} aria-controls="nav-site" aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMenu((m) => !m)}>
            <Icone nom={menu ? "fermer" : "menu"} taille={24} />
            {!menu && succes.aReclamer.length + (surplusTotal > 0 ? 1 : 0) > 0 && (
              <span className="burger-pastille" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="zone" ref={zone}>
          <Route />
          {/* Les pages tenues sur un seul écran n'ont pas de pied : la
              confidentialité y reste à un clic, depuis le profil et les
              réglages. */}
          {!PLEIN.has(racine(chemin)) && (
            <footer className="pied-legal">
              <Lien vers="/confidentialite" actif={false}>Confidentialité et mentions légales</Lien>
              {mesureDisponible && (
                <>{" · "}<button type="button" onClick={rouvrirBandeau}>Gérer les cookies</button></>
              )}
            </footer>
          )}
        </div>
      </div>

      <RetourExpeditions occupe={occupe} />
      <BandeauCookies />
      <ChoixPseudo />

      {loupe && (
        <Loupe c={loupe} cfgImage={cfgImage} fichiers={fichiers} onFermer={() => setLoupe(null)} />
      )}
    </>
  );
}

export default function App() {
  return (
    <Routeur>
      <Jeu>
        <Compte>
          <Coque />
        </Compte>
      </Jeu>
    </Routeur>
  );
}
