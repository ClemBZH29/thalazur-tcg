/**
 * Purge des comptes inutilisés depuis plus de cinq ans.
 *
 * La politique TTL de Firestore efface déjà les parties dont l'échéance
 * (`expire`) est passée. Elle ne touche pas aux identités de Firebase
 * Authentication (uid, nom, e-mail, photo) : c'est le rôle de ce script.
 * À lancer une fois par an, à la main :
 *
 *   npm i --no-save firebase-admin
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\chemin\vers\cle-compte-de-service.json
 *   node scripts/purge-comptes.mjs            (simulation : liste sans rien effacer)
 *   node scripts/purge-comptes.mjs --effacer  (suppression effective)
 *
 * La clé de compte de service se télécharge dans la console Firebase
 * (Paramètres du projet → Comptes de service). Elle donne tous les droits sur
 * le projet : ne jamais la placer dans le dépôt, la supprimer après usage.
 */
import { LEGAL } from "../src/config/legal.js";

const { initializeApp, applicationDefault } = await import("firebase-admin/app");
const { getAuth } = await import("firebase-admin/auth");
const { getFirestore } = await import("firebase-admin/firestore");

const effacer = process.argv.includes("--effacer");
const limite = Date.now() - LEGAL.conservationAns * 365.25 * 24 * 3600000;

initializeApp({ credential: applicationDefault() });
const auth = getAuth();
const db = getFirestore();

const dernierUsage = (u) => Math.max(
  Date.parse(u.metadata.lastRefreshTime || 0) || 0,
  Date.parse(u.metadata.lastSignInTime || 0) || 0,
  Date.parse(u.metadata.creationTime || 0) || 0,
);

let vus = 0, perimes = 0, page;
do {
  const lot = await auth.listUsers(1000, page);
  for (const u of lot.users) {
    vus++;
    const usage = dernierUsage(u);
    if (usage >= limite) continue;
    // Une partie écrite récemment compte comme une utilisation.
    const doc = await db.doc(`joueurs/${u.uid}`).get();
    const maj = doc.exists ? doc.get("maj")?.toMillis?.() || 0 : 0;
    if (maj >= limite) continue;
    perimes++;
    const quand = new Date(Math.max(usage, maj)).toLocaleDateString("fr-FR");
    console.log(`${effacer ? "suppression" : "à supprimer"} : ${u.uid} (dernier usage le ${quand})`);
    if (effacer) {
      if (doc.exists) await doc.ref.delete();
      await auth.deleteUser(u.uid);
    }
  }
  page = lot.pageToken;
} while (page);

console.log(`${vus} comptes examinés, ${perimes} inutilisés depuis plus de ${LEGAL.conservationAns} ans` +
  (effacer ? " — supprimés." : " — rien n'a été effacé (ajouter --effacer)."));
