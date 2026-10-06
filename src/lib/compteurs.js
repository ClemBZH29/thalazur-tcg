/**
 * Compteurs de la partie lus à plusieurs endroits (Donjon, missions).
 *
 * Ils vivent ici plutôt que dans les règles d'un module : la coque du site
 * les lit à chaque rendu, et importer `src/donjon/regles.js` pour une ligne
 * ferait entrer tout le moteur du Donjon dans le paquet principal, que la
 * page du Donjon charge pourtant à la demande.
 */

/**
 * Les descentes jouées au Donjon. Le compteur date du 07/10/2026 ; avant
 * lui, seules les remontées étaient comptées, et c'est d'elles que part une
 * partie plus ancienne — qui n'a jamais remonté rejoue donc l'apprentissage.
 */
export const descentesJouees = (stats = {}) => stats?.descentes ?? stats?.remontees ?? 0;
