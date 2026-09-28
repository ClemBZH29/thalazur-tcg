import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useJeu } from "./Jeu.jsx";
import { chargerFirebase, nuageConfigure, sessionMemorisee } from "../lib/nuage/firebase.js";
import { empreinte, fusionner3, fusionnerMine, signature } from "../lib/nuage/fusion.js";
import { ligneClassement, pseudoValide } from "../succes/classement.js";
import { effacer, ecrireMine, etatVide, lireMine, relireJeu, suivreMine } from "../lib/storage.js";
import { SCHEMA } from "../lib/sauvegarde/schema.js";
import { LEGAL } from "../config/legal.js";

/**
 * Le compte du joueur, et la copie de sa partie qui l'accompagne.
 *
 * ── Ce qui est stocké ──────────────────────────────────────────────────────
 * Un document par joueur, `joueurs/{uid}` :
 *   donnees  — l'état du jeu, en JSON (collection, bourse, réglages, pseudo…)
 *   mine     — la sauvegarde des Mines de Kazim, telle que le module l'écrit
 *   revision — compteur, +1 à chaque écriture ; les règles l'exigent
 *   maj      — horodatage serveur de la dernière écriture
 *   schema   — version du format, commune au jeu et à la mine (sauvegarde/schema.js)
 *   expire   — échéance de conservation (maintenant + 5 ans), purge TTL
 *
 * Et, seulement si le joueur l'a demandé, une ligne publique
 * `classement/{uid}` : pseudo, titre affiché, progression (voir
 * `src/succes/classement.js`). Elle est lisible par tout joueur connecté,
 * republiée après chaque envoi réussi quand elle a changé, et effacée dès
 * que le joueur se retire du classement ou supprime son compte.
 *
 * L'état part en chaîne JSON plutôt qu'en carte Firestore : Firestore refuse
 * les tableaux de tableaux et les valeurs `undefined`, et la forme de l'état
 * n'a jamais été pensée pour lui. Une chaîne passe telle quelle, et le jour où
 * le format change, la migration reste celle de `storage.js`.
 *
 * ── Local d'abord ──────────────────────────────────────────────────────────
 * Le navigateur garde la partie comme avant ; le compte en reçoit une copie
 * une demi-minute après le dernier changement, et aussitôt que l'onglet passe
 * en arrière-plan. Hors ligne, on joue et l'envoi attend.
 *
 * ── Deux appareils ─────────────────────────────────────────────────────────
 * Chaque appareil retient la révision qu'il a vue en dernier et la copie qui
 * allait avec (la « base »). Si le compte a bougé entre-temps, on ne jette
 * rien : `fusionner3` rejoue sur la copie du compte ce que cet appareil a fait
 * depuis sa base. Les règles Firestore refusent toute écriture qui ne part pas
 * de la dernière révision : deux envois simultanés ne s'écrasent jamais.
 */

const CLE_COMPTE = "brume-thalazur:compte";      // { uid, revision }
const CLE_BASE = "brume-thalazur:compte-base";   // { etat, mine } vus en dernier
const CLE_CLASSEMENT = "brume-thalazur:classement"; // { uid, empreinte, t } publiés en dernier
const DELAI_ENVOI = 30000;
/**
 * Échéance de conservation, repoussée à chaque écriture. Firestore supprime
 * le document une fois la date passée (politique TTL sur le champ `expire`) :
 * un compte laissé cinq ans sans servir disparaît sans intervention.
 */
const CONSERVATION = LEGAL.conservationAns * 365.25 * 24 * 3600000;
/** Une échéance plus proche que ceci est rafraîchie à l'ouverture de session. */
const RAFRAICHIR = 30 * 24 * 3600000;
/** Au-delà, les rosters chargés à la main restent sur l'appareil. */
const TAILLE_MAX = 900000;

const Ctx = createContext(null);
export const useCompte = () => useContext(Ctx);

const lireJSON = (cle) => { try { return JSON.parse(localStorage.getItem(cle)); } catch { return null; } };
const ecrireJSON = (cle, v) => {
  try { if (v == null) localStorage.removeItem(cle); else localStorage.setItem(cle, JSON.stringify(v)); }
  catch { /* quota : la synchronisation repartira de zéro */ }
};

/**
 * La copie du compte, remise à la forme que le jeu attend. Un document d'un
 * format trop ancien se lit comme une partie vide : l'appareil y réécrira la
 * sienne, en gardant la révision pour que les règles acceptent l'écriture.
 */
function lireCompte(doc) {
  let brut = null;
  try { brut = JSON.parse(doc.donnees); } catch { /* illisible : partie vide */ }
  const jeu = doc.schema === SCHEMA ? relireJeu(brut) : null;
  return { jeu: jeu || etatVide(), mine: jeu ? doc.mine ?? null : null };
}

function serialiser(etat) {
  const complet = JSON.stringify(etat);
  if (complet.length <= TAILLE_MAX) return complet;
  const { rosters, ...leger } = etat;
  return JSON.stringify({ ...leger, rosters: {} });
}

class Conflit extends Error {
  constructor(donnees) { super("revision"); this.donnees = donnees; }
}

/** Messages lisibles pour les erreurs qu'un joueur peut rencontrer. */
function expliquer(e) {
  const code = e?.code || "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return null;
  if (code === "auth/popup-blocked") return "Le navigateur a bloqué la fenêtre de connexion. Autorisez les fenêtres surgissantes pour ce site, puis réessayez.";
  if (code === "auth/network-request-failed" || code === "unavailable") return "Connexion au serveur impossible. La partie continue sur cet appareil ; la copie du compte suivra.";
  if (code === "auth/unauthorized-domain") return "Ce domaine n'est pas autorisé dans la configuration Firebase (Authentication → Paramètres → Domaines autorisés).";
  if (code === "permission-denied") return "Le serveur a refusé l'écriture. Rechargez la page ; si cela persiste, les règles Firestore sont à vérifier.";
  return "Une erreur est survenue avec le compte" + (code ? ` (${code})` : "") + ".";
}

export function Compte({ children }) {
  const { etat, setEtat, rechargerMine, succes } = useJeu();

  // inactif : pas de Firebase dans ce build · invite : personne n'est connecté
  // ouverture : le SDK arrive ou la session se rétablit · connecte
  const [statut, setStatut] = useState(() =>
    !nuageConfigure ? "inactif" : lireJSON(CLE_COMPTE) ? "ouverture" : "invite");
  const [utilisateur, setUtilisateur] = useState(null);
  // a-jour · en-attente · envoi · hors-ligne · erreur
  const [sync, setSync] = useState("a-jour");
  const [derniere, setDerniere] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [annonce, setAnnonce] = useState(null);
  // Vrai une fois la première rencontre avec le compte terminée : avant, la
  // partie locale n'est pas encore celle du compte (le pseudo peut manquer
  // ici et exister là-bas).
  const [sessionPrete, setSessionPrete] = useState(false);

  const fb = useRef(null);
  const user = useRef(null);
  const etatRef = useRef(etat);
  const base = useRef(lireJSON(CLE_BASE));
  const marque = useRef(lireJSON(CLE_COMPTE));
  const minuteur = useRef(null);
  const enVol = useRef(false);
  const relancer = useRef(false);
  const ecoute = useRef(null);

  useEffect(() => { etatRef.current = etat; }, [etat]);
  const succesRef = useRef(succes);
  useEffect(() => { succesRef.current = succes; }, [succes]);
  const publie = useRef(lireJSON(CLE_CLASSEMENT));

  const refDoc = useCallback(() => fb.current.F.doc(fb.current.db, "joueurs", user.current.uid), []);

  const retenir = useCallback((revision, etatBase, mineBase) => {
    marque.current = { uid: user.current.uid, revision };
    base.current = { etat: etatBase, mine: mineBase };
    ecrireJSON(CLE_COMPTE, marque.current);
    ecrireJSON(CLE_BASE, base.current);
  }, []);

  /** Remplace l'état local par une version réconciliée. */
  const adopter = useCallback((nouvel, mine) => {
    setEtat(nouvel);
    etatRef.current = nouvel;
    if ((mine || null) !== (lireMine() || null)) {
      ecrireMine(mine);
      rechargerMine();
    }
  }, [setEtat, rechargerMine]);

  const aChange = useCallback(() => {
    const b = base.current;
    return !b || signature(etatRef.current, lireMine()) !== signature(b.etat, b.mine);
  }, []);

  /**
   * Intègre une copie du compte plus récente que celle que l'appareil
   * connaît. Renvoie vrai si l'appareil a encore quelque chose à envoyer.
   */
  const reconcilier = useCallback((doc) => {
    const { jeu: la, mine: laMine } = lireCompte(doc);
    const b = base.current;
    if (!aChange()) {
      adopter(la, laMine);
      retenir(doc.revision, la, laMine);
      return false;
    }
    const ici = etatRef.current;
    const fusion = fusionner3(b ? b.etat : null, ici, la, etatVide());
    const mine = fusionnerMine(lireMine(), laMine);
    adopter(fusion, mine);
    retenir(doc.revision, la, laMine);
    return signature(fusion, mine) !== signature(la, laMine);
  }, [adopter, aChange, retenir]);

  /**
   * Met à jour la ligne publique du classement, ou la retire.
   *
   * Appelée après chaque envoi réussi de la partie, et quand le joueur change
   * son pseudo, son titre ou son choix d'y figurer. Rien ne part si la ligne
   * n'a pas bougé depuis la dernière publication — sauf pour repousser son
   * échéance de conservation, une fois par mois. Un échec n'a pas de
   * conséquence : la prochaine synchronisation réessaiera.
   */
  const publierClassement = useCallback(async () => {
    if (!user.current || !fb.current) return;
    const { F, db } = fb.current;
    const uid = user.current.uid;
    const e = etatRef.current;
    const s = succesRef.current;
    const ref = F.doc(db, "classement", uid);
    const avant = publie.current?.uid === uid ? publie.current : null;
    const retenirPublie = (v) => { publie.current = v; ecrireJSON(CLE_CLASSEMENT, v); };
    try {
      if (!e.profil?.classement || !pseudoValide(e.profil?.pseudo)) {
        // Un autre appareil a pu publier : on efface même sans trace locale,
        // mais une seule fois.
        if (avant?.empreinte !== "retire") {
          await F.deleteDoc(ref);
          retenirPublie({ uid, empreinte: "retire", t: Date.now() });
        }
        return;
      }
      const ligne = ligneClassement(s.catalogue, e, s.mine, s.titres);
      const emp = empreinte(JSON.stringify(ligne));
      if (avant?.empreinte === emp && Date.now() - avant.t < RAFRAICHIR) return;
      await F.setDoc(ref, {
        ...ligne,
        maj: F.serverTimestamp(),
        expire: F.Timestamp.fromMillis(Date.now() + CONSERVATION),
      });
      retenirPublie({ uid, empreinte: emp, t: Date.now() });
    } catch { /* le classement suivra au prochain envoi */ }
  }, []);

  /** Le classement entier. Réservé aux joueurs connectés (règles Firestore). */
  const lireClassement = useCallback(async () => {
    if (!user.current || !fb.current) throw new Error("non connecté");
    const { F, db } = fb.current;
    const snap = await F.getDocs(F.collection(db, "classement"));
    return snap.docs.map((d) => {
      const x = d.data();
      return { ...x, uid: d.id, maj: x.maj?.toMillis ? x.maj.toMillis() : 0, expire: undefined };
    });
  }, []);

  /** Envoie l'état local sur le compte, si quelque chose a changé. */
  const envoyer = useCallback(async (force = false) => {
    if (!user.current || !fb.current) return;
    clearTimeout(minuteur.current); minuteur.current = null;
    if (enVol.current) { relancer.current = true; return; }
    if (!force && !aChange()) { setSync("a-jour"); return; }
    enVol.current = true;
    setSync("envoi");
    const { F, db } = fb.current;
    try {
      for (let essai = 0; essai < 3; essai++) {
        const ici = etatRef.current;
        const mine = lireMine();
        const connue = marque.current?.uid === user.current.uid ? marque.current.revision : 0;
        try {
          const revision = await F.runTransaction(db, async (tx) => {
            const snap = await tx.get(refDoc());
            const actuelle = snap.exists() ? snap.data().revision : 0;
            if (snap.exists() && actuelle !== connue) throw new Conflit(snap.data());
            tx.set(refDoc(), {
              schema: SCHEMA,
              revision: actuelle + 1,
              donnees: serialiser({ ...ici, schema: SCHEMA }),
              mine: mine ?? null,
              maj: F.serverTimestamp(),
              expire: F.Timestamp.fromMillis(Date.now() + CONSERVATION),
            });
            return actuelle + 1;
          });
          retenir(revision, ici, mine);
          setDerniere(new Date());
          setErreur(null);
          setSync(aChange() ? "en-attente" : "a-jour");
          publierClassement();
          return;
        } catch (e) {
          if (!(e instanceof Conflit)) throw e;
          // Le compte a bougé ailleurs : on intègre, puis on retente.
          if (!reconcilier(e.donnees)) { setSync("a-jour"); setDerniere(new Date()); return; }
        }
      }
      throw new Error("Trop de conflits successifs");
    } catch (e) {
      const horsLigne = e?.code === "unavailable" || (typeof navigator !== "undefined" && !navigator.onLine);
      setSync(horsLigne ? "hors-ligne" : "erreur");
      if (!horsLigne) setErreur(expliquer(e));
      clearTimeout(minuteur.current);
      minuteur.current = setTimeout(() => envoyer(), horsLigne ? 60000 : 120000);
    } finally {
      enVol.current = false;
      if (relancer.current) { relancer.current = false; envoyer(); }
    }
  }, [aChange, reconcilier, refDoc, retenir, publierClassement]);

  const planifier = useCallback(() => {
    if (!user.current) return;
    if (!aChange()) return;
    setSync((s) => (s === "envoi" ? s : "en-attente"));
    if (!minuteur.current) minuteur.current = setTimeout(() => envoyer(), DELAI_ENVOI);
  }, [aChange, envoyer]);

  /** Première rencontre entre cet appareil et le compte, à chaque ouverture de session. */
  const ouvrirSession = useCallback(async (u) => {
    const { F } = fb.current;
    // Une partie locale laissée par un autre compte ne se mélange pas à celle-ci.
    if (marque.current && marque.current.uid !== u.uid) {
      effacer();
      ecrireJSON(CLE_BASE, null);
      base.current = null;
      marque.current = null;
      adopter(etatVide(), null);
    }
    const premiere = !marque.current;
    user.current = u;
    setSync("envoi");
    try {
      const snap = await F.getDoc(refDoc());
      if (!snap.exists()) {
        // Compte neuf : il reçoit ce que l'appareil avait déjà, s'il y avait quelque chose.
        marque.current = { uid: u.uid, revision: 0 };
        base.current = null;
        await envoyer(true);
        if (Object.values(etatRef.current.boosters || {}).some((n) => n > 0)) {
          setAnnonce("Votre partie est maintenant enregistrée sur votre compte.");
        }
      } else {
        const doc = snap.data();
        // Un joueur qui revient sans rien changer utilise quand même son
        // compte : l'échéance de conservation doit repartir de ce jour.
        const echeance = doc.expire?.toMillis ? doc.expire.toMillis() : 0;
        const vieillie = echeance < Date.now() + CONSERVATION - RAFRAICHIR;
        if (premiere) {
          const avait = Object.values(etatRef.current.boosters || {}).some((n) => n > 0)
            || Boolean(lireMine());
          if (!avait) {
            // Appareil vierge : on prend le compte tel quel. Le fusionner
            // ferait gagner la bourse de départ d'une partie jamais jouée.
            const { jeu: la, mine: laMine } = lireCompte(doc);
            adopter(la, laMine);
            retenir(doc.revision, la, laMine);
            if (vieillie) await envoyer(true); else setSync("a-jour");
          } else {
            reconcilier(doc);
            setAnnonce("La partie jouée sur cet appareil avant la connexion a été ajoutée à votre compte.");
            await envoyer();
          }
        } else if (doc.revision !== marque.current.revision) {
          if (reconcilier(doc) || vieillie) await envoyer(true); else setSync("a-jour");
        } else {
          await envoyer(vieillie);
        }
      }
    } catch (e) {
      setSync(e?.code === "unavailable" ? "hors-ligne" : "erreur");
      setErreur(expliquer(e));
    }
    setSessionPrete(true);
    publierClassement();

    // Les écritures d'un autre appareil arrivent d'elles-mêmes.
    ecoute.current?.();
    ecoute.current = F.onSnapshot(refDoc(), (s) => {
      if (!s.exists() || s.metadata.hasPendingWrites) return;
      const d = s.data();
      if (marque.current && d.revision > marque.current.revision && !enVol.current) {
        if (reconcilier(d)) planifier();
        setDerniere(new Date());
      }
    }, () => { /* hors ligne : on réessaiera à l'envoi */ });
  }, [adopter, envoyer, planifier, reconcilier, refDoc, retenir, publierClassement]);

  const brancher = useCallback(async () => {
    if (fb.current) return fb.current;
    const f = await chargerFirebase();
    fb.current = f;
    f.A.onAuthStateChanged(f.auth, (u) => {
      if (u) {
        setUtilisateur({
          uid: u.uid, nom: u.displayName, email: u.email, photo: u.photoURL,
          depuis: u.metadata?.creationTime ? new Date(u.metadata.creationTime) : null,
        });
        setStatut("connecte");
        ouvrirSession(u);
      } else {
        ecoute.current?.(); ecoute.current = null;
        user.current = null;
        setUtilisateur(null);
        setSessionPrete(false);
        setStatut("invite");
      }
    });
    return f;
  }, [ouvrirSession]);

  // Une session ouverte lors d'une visite précédente se rétablit seule : la
  // marque de l'appareil suffit, et à défaut on regarde si Firebase en garde une.
  useEffect(() => {
    const retablir = () => brancher().catch((e) => { setErreur(expliquer(e)); setStatut("invite"); });
    if (statut === "ouverture") { retablir(); return; }
    if (statut !== "invite") return;
    let vivant = true;
    sessionMemorisee().then((oui) => {
      if (!vivant || !oui || fb.current) return;
      setStatut("ouverture");
      retablir();
    });
    return () => { vivant = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Se montrer ou se retirer du classement n'attend pas le prochain envoi.
  const profil = etat.profil || {};
  useEffect(() => {
    if (sessionPrete) publierClassement();
  }, [sessionPrete, profil.classement, profil.pseudo, profil.titre, publierClassement]);

  // Chaque changement de partie, et chaque sauvegarde de la mine, programme un envoi.
  useEffect(() => { planifier(); }, [etat, planifier]);
  useEffect(() => suivreMine(() => planifier()), [planifier]);

  // L'onglet qui passe en arrière-plan est souvent le dernier signe de vie.
  // On n'attend pas le délai d'envoi, et on ne compte pas sur un envoi déjà
  // programmé : la mine se sauve sur ce même événement, parfois après nous.
  // Le `setTimeout` laisse passer les autres écouteurs avant de comparer.
  useEffect(() => {
    const partir = () => setTimeout(() => { if (user.current && aChange()) envoyer(); }, 0);
    const cacher = () => { if (document.visibilityState === "hidden") partir(); };
    const retour = () => { if (sync === "hors-ligne") envoyer(); };
    document.addEventListener("visibilitychange", cacher);
    window.addEventListener("pagehide", partir);
    window.addEventListener("online", retour);
    return () => {
      document.removeEventListener("visibilitychange", cacher);
      window.removeEventListener("pagehide", partir);
      window.removeEventListener("online", retour);
    };
  }, [aChange, envoyer, sync]);

  /* ── Actions offertes à l'interface ──────────────────────────────────── */

  const connecter = useCallback(async () => {
    setErreur(null);
    try {
      const f = await brancher();
      setStatut("ouverture");
      await f.A.signInWithPopup(f.auth, new f.A.GoogleAuthProvider());
    } catch (e) {
      setStatut(user.current ? "connecte" : "invite");
      setErreur(expliquer(e));
    }
  }, [brancher]);

  /** Oublie tout ce que cet appareil savait du compte, et la partie avec. */
  const oublierAppareil = useCallback(() => {
    ecoute.current?.(); ecoute.current = null;
    clearTimeout(minuteur.current); minuteur.current = null;
    effacer();
    ecrireJSON(CLE_COMPTE, null);
    ecrireJSON(CLE_BASE, null);
    ecrireJSON(CLE_CLASSEMENT, null);
    publie.current = null;
    marque.current = null;
    base.current = null;
    user.current = null;
    adopter(etatVide(), null);
    setSync("a-jour");
    setDerniere(null);
  }, [adopter]);

  /**
   * La déconnexion vide l'appareil : la partie est sur le compte, et un
   * ordinateur partagé ne doit pas montrer la collection du précédent joueur.
   * On envoie d'abord ce qui attendait.
   */
  const deconnecter = useCallback(async () => {
    if (!fb.current) return;
    if (aChange()) await envoyer();
    if (aChange() && !window.confirm("Les derniers changements n'ont pas pu être envoyés sur votre compte et seront perdus sur cet appareil. Se déconnecter quand même ?")) return;
    oublierAppareil();
    await fb.current.A.signOut(fb.current.auth);
    setAnnonce("Vous êtes déconnecté. Votre partie vous attend sur votre compte.");
  }, [aChange, envoyer, oublierAppareil]);

  /**
   * Suppression du compte : le document de jeu, puis l'identité elle-même.
   * Firebase exige une connexion récente pour supprimer un utilisateur ; on la
   * redemande d'emblée, ce qui vaut aussi confirmation.
   */
  const supprimerCompte = useCallback(async () => {
    if (!fb.current?.auth.currentUser) return false;
    const { A, F, auth } = fb.current;
    setErreur(null);
    try {
      const u = auth.currentUser;
      await A.reauthenticateWithPopup(u, new A.GoogleAuthProvider());
      ecoute.current?.(); ecoute.current = null;
      await F.deleteDoc(F.doc(fb.current.db, "classement", u.uid));
      await F.deleteDoc(refDoc());
      await A.deleteUser(u);
      oublierAppareil();
      setAnnonce("Votre compte et votre partie ont été supprimés.");
      return true;
    } catch (e) {
      setErreur(expliquer(e) || "Suppression annulée.");
      return false;
    }
  }, [oublierAppareil, refDoc]);

  const valeur = useMemo(() => ({
    disponible: nuageConfigure,
    statut, utilisateur, sync, derniere, erreur, annonce, sessionPrete,
    connecter, deconnecter, supprimerCompte, lireClassement,
    synchroniser: () => envoyer(true),
    oublierAnnonce: () => setAnnonce(null),
    oublierErreur: () => setErreur(null),
  }), [statut, utilisateur, sync, derniere, erreur, annonce, sessionPrete, connecter, deconnecter,
    supprimerCompte, lireClassement, envoyer]);

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}
