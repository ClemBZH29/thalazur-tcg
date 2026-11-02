/**
 * L'aperçu des testeurs (`npm run apercu`, 1.1.0).
 *
 * Construit en mode « apercu » (`vite build --mode apercu`), le site sert à
 * faire tester : chaque nouveau visiteur reçoit d'office toutes les cartes des
 * extensions ouvertes (ni full art ni PJ) et de quoi forger au Reliquaire,
 * pour essayer le Donjon, les Expéditions, le Comptoir et le Reliquaire sans
 * des semaines de boosters.
 *
 * L'aperçu parle à la même base Firebase que la production : une partie
 * dotée ainsi ne doit jamais rejoindre un vrai compte. Le compte et la mesure
 * d'audience y sont donc coupés (`nuageConfigure`, src/lib/nuage/firebase.js) :
 * l'aperçu est entièrement local, sur sa propre adresse, et le classement y
 * reste vide.
 */
export const APERCU = import.meta.env?.MODE === "apercu";

/** Ce que reçoit un testeur : exemplaires de chaque carte (doublons compris), vestiges. */
export const DOTATION_APERCU = { exemplaires: 3, vestiges: 10000 };
