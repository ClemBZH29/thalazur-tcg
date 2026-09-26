/**
 * Vérification des règles Firestore contre l'émulateur, avant publication.
 *
 * Les règles ne se testent pas dans `npm test` : il faut l'émulateur
 * Firestore (Java). À lancer à la main, depuis le dossier du dépôt :
 *
 *   npm i --no-save firebase-tools @firebase/rules-unit-testing
 *   npx firebase-tools emulators:exec --only firestore --project demo-thalazur "node scripts/verifier-regles.mjs"
 *
 * Le projet « demo-… » est un projet fictif : rien ne touche à la production.
 * Chaque ligne affiche OK ou ÉCHEC ; le code de sortie vaut 1 au moindre échec.
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-thalazur",
  firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
});

const echeance = () => Timestamp.fromMillis(Date.now() + 1825 * 86400000);
const ligne = (champs = {}) => ({
  pseudo: "Siobhan", titre: "", score: 1200, extensions: { t: { pct: 12, irisees: 0 } },
  boosters: 30, strate: 4, succes: 3, premiers: {}, maj: serverTimestamp(), expire: echeance(),
  ...champs,
});

const alice = env.authenticatedContext("alice").firestore();
const bob = env.authenticatedContext("bob").firestore();
const anonyme = env.unauthenticatedContext().firestore();

let echecs = 0;
const verifier = async (nom, attendu, promesse) => {
  try {
    await (attendu ? assertSucceeds(promesse) : assertFails(promesse));
    console.log("OK    ", nom);
  } catch (e) {
    echecs++;
    console.log("ÉCHEC ", nom, "—", e.message);
  }
};

await verifier("écrire sa propre ligne", true, setDoc(doc(alice, "classement/alice"), ligne()));
await verifier("écrire la ligne d'un autre", false, setDoc(doc(bob, "classement/alice"), ligne()));
await verifier("champ inconnu (e-mail)", false, setDoc(doc(alice, "classement/alice"), ligne({ email: "x@y" })));
await verifier("pseudo d'un caractère", false, setDoc(doc(alice, "classement/alice"), ligne({ pseudo: "a" })));
await verifier("pseudo de 25 caractères", false, setDoc(doc(alice, "classement/alice"), ligne({ pseudo: "x".repeat(25) })));
await verifier("score hors borne", false, setDoc(doc(alice, "classement/alice"), ligne({ score: 10001 })));
await verifier("score non entier", false, setDoc(doc(alice, "classement/alice"), ligne({ score: 12.5 })));
await verifier("horodatage fourni par l'appareil", false, setDoc(doc(alice, "classement/alice"), ligne({ maj: Timestamp.now() })));
await verifier("échéance trop courte", false, setDoc(doc(alice, "classement/alice"), ligne({ expire: Timestamp.now() })));
await verifier("lire le classement connecté", true, getDocs(collection(bob, "classement")));
await verifier("lire le classement sans compte", false, getDocs(collection(anonyme, "classement")));
await verifier("effacer la ligne d'un autre", false, deleteDoc(doc(bob, "classement/alice")));
await verifier("effacer sa propre ligne", true, deleteDoc(doc(alice, "classement/alice")));
await verifier("effacer sa ligne inexistante", true, deleteDoc(doc(bob, "classement/bob")));
await verifier("lire la partie d'un autre", false, getDocs(collection(bob, "joueurs")));

await env.cleanup();
console.log(echecs ? `\n${echecs} échec(s).` : "\nToutes les règles se comportent comme prévu.");
process.exit(echecs ? 1 : 0);
