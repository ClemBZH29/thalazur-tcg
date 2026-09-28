/**
 * Pictogrammes du site, en SVG dans la page.
 *
 * La navigation portait des caractères Unicode (◈ ◫ ▣ ⚖ ⛏ ✦). Leur dessin
 * dépend de la police du système, et ⚖ et ⛏ ont une présentation emoji : sur
 * iOS et Android, ils sortaient en couleur au milieu de glyphes monochromes.
 * Des tracés dans la page s'affichent partout pareil, héritent de la couleur du
 * texte (`currentColor`) et ne chargent rien d'un domaine tiers.
 *
 * Tracés sur une grille de 20, trait de 1,6 : lisibles à 18 px dans la barre
 * basse comme à 15 px dans la barre haute.
 */
const TRACES = {
  // Une lanterne de quai : l'accueil est le port d'où l'on part.
  accueil: (
    <>
      <path d="M7.5 5.5h5M10 2.5v3" />
      <path d="M6.5 5.5h7l-.8 9.5H7.3z" />
      <path d="M8 17.5h4" />
      <path d="M10 9v2.5" />
    </>
  ),
  // Un sachet, bord dentelé en haut.
  boutique: (
    <>
      <path d="M5 4.5l1.25-1 1.25 1 1.25-1 1.25 1 1.25-1 1.25 1 1.25-1 1.25 1V16a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 16z" />
      <path d="M7.5 9h5" />
    </>
  ),
  // Deux cartes décalées.
  cartes: (
    <>
      <rect x="7.5" y="4" width="8.5" height="12.5" rx="1.3" />
      <path d="M5.5 6.2 4.2 6.6a1.3 1.3 0 0 0-.9 1.6l2.6 8.6" />
    </>
  ),
  // Une balance.
  comptoir: (
    <>
      <path d="M10 3v14M6.5 17.5h7M4 6h12" />
      <path d="M4 6 2 11a2.2 2.2 0 0 0 4 0zM16 6l-2 5a2.2 2.2 0 0 0 4 0z" />
    </>
  ),
  // Une pioche.
  mines: (
    <>
      <path d="M3.5 7.2C6.5 3.8 11 3 15 4.5" />
      <path d="M8.5 5.2 16.5 16.5" />
    </>
  ),
  // Une étoile à quatre branches, comme les éclats des succès.
  succes: (
    <path d="M10 2.5c.5 4.2 1.8 5.9 5.5 7.5-3.7 1.6-5 3.3-5.5 7.5-.5-4.2-1.8-5.9-5.5-7.5 3.7-1.6 5-3.3 5.5-7.5z" />
  ),
  // Les réglages du meneur, en développement seulement.
  reglages: (
    <>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.8v2.4M10 14.8v2.4M2.8 10h2.4M14.8 10h2.4M4.9 4.9l1.7 1.7M13.4 13.4l1.7 1.7M4.9 15.1l1.7-1.7M13.4 6.6l1.7-1.7" />
    </>
  ),
  // Une silhouette, pour l'entrée du profil quand on n'est pas connecté.
  profil: (
    <>
      <circle cx="10" cy="7" r="3.2" />
      <path d="M3.8 17c.8-3.2 3.2-4.8 6.2-4.8s5.4 1.6 6.2 4.8" />
    </>
  ),
};

export default function Icone({ nom, taille = 20, className = "" }) {
  return (
    <svg
      className={`icone ${className}`.trim()}
      viewBox="0 0 20 20"
      width={taille}
      height={taille}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRACES[nom]}
    </svg>
  );
}
