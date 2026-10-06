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
  // Une arche sur un escalier qui descend : le Donjon.
  donjon: (
    <>
      <path d="M4 17.5V9a6 6 0 0 1 12 0v8.5" />
      <path d="M2.5 17.5h15" />
      <path d="M7.5 17.5v-2.4h2.6v-2.4h2.6" />
    </>
  ),
  // Un bâton de marche, sa lanterne au crochet : les Expéditions.
  expeditions: (
    <>
      <path d="M6 18 11.5 4.5a2.6 2.6 0 0 1 4.3 1.7" />
      <path d="M14.2 8.8h3.2l-.4 4.6h-2.4z" />
      <path d="M15.8 6.6v2.2" />
    </>
  ),
  // Un coffret à couvercle en pointe : le Reliquaire.
  reliquaire: (
    <>
      <path d="M3.5 9.5h13v7h-13z" />
      <path d="M3.5 9.5 5.5 5h9l2 4.5" />
      <path d="M10 5V3M10 12v2" />
    </>
  ),
  // Les salles du Donjon, sur la carte d'un étage.
  combat: (
    <>
      <path d="M4 4l9.5 9.5M16 4l-9.5 9.5" />
      <path d="M11.5 15.5l4-4M8.5 15.5l-4-4M14 14l2.5 2.5M6 14l-2.5 2.5" />
    </>
  ),
  elite: (
    <>
      <path d="M5 9.5a5 5 0 0 1 10 0c0 2-1 3-2 3.6V16H7v-2.9C6 12.5 5 11.5 5 9.5z" />
      <circle cx="8" cy="9.6" r="1.1" />
      <circle cx="12" cy="9.6" r="1.1" />
      <path d="M9 16v-1.6M11 16v-1.6" />
    </>
  ),
  tresor: (
    <>
      <path d="M3.5 8.5h13v7.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" />
      <path d="M3.5 8.5 5 4.5h10l1.5 4" />
      <path d="M10 8.5v3.5" />
    </>
  ),
  rencontre: (
    <>
      <path d="M7 7.2a3 3 0 1 1 4.4 2.6c-.9.5-1.4 1.1-1.4 2.2v.5" />
      <path d="M10 15.6v.2" />
    </>
  ),
  fait: <path d="M4.5 10.5l3.5 3.5 7.5-8" />,
  // Le menu, au doigt, et sa croix.
  menu: <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" />,
  fermer: <path d="M5 5l10 10M15 5 5 15" />,
  // Un livre ouvert : le lexique.
  lexique: (
    <>
      <path d="M10 5.5C8.3 4.2 6 3.8 3 4v11c3-.2 5.3.2 7 1.5 1.7-1.3 4-1.7 7-1.5V4c-3-.2-5.3.2-7 1.5z" />
      <path d="M10 5.5v11" />
    </>
  ),
  repos: (
    <path d="M14.5 13.2A6 6 0 0 1 8.3 4.1a6.2 6.2 0 1 0 7.6 8.6 5.9 5.9 0 0 1-1.4.5z" />
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

  // ---------------------------------------------------------------
  // Donjon — les neuf rôles. Couleur posée par le CSS (braise).
  // ---------------------------------------------------------------
  // Un écu à bosse centrale : le Garde, qui encaisse.
  garde: (
    <>
      <path d="M10 2.8 16 5v4.6c0 3.9-2.6 6.6-6 7.9-3.4-1.3-6-4-6-7.9V5z" />
      <circle cx="10" cy="9.6" r="1.3" />
    </>
  ),
  // Une hache d'armes à double fer : le Frappeur.
  frappeur: (
    <>
      <path d="M10 2.5v15" />
      <path d="M10 4.5C8 3.2 5.8 2.8 3.5 3c-.9 2.6-.9 5.4 0 8 2.3.2 4.5-.2 6.5-1.5M10 4.5c2-1.3 4.2-1.7 6.5-1.5.9 2.6.9 5.4 0 8-2.3.2-4.5-.2-6.5-1.5" />
    </>
  ),
  // Un arc bandé, la flèche encochée : le Tireur.
  tireur: (
    <>
      <path d="M6.5 3C12 5 12 15 6.5 17z" />
      <path d="M3 10h13.5M14 7.5l2.5 2.5-2.5 2.5" />
    </>
  ),
  // Une fiole d'onguent, à moitié pleine : le Soigneur.
  soigneur: (
    <>
      <path d="M8.3 2.8h3.4M8.8 2.8v4.4L4.8 14a2.3 2.3 0 0 0 2 3.5h6.4a2.3 2.3 0 0 0 2-3.5l-4-6.8V2.8" />
      <path d="M6.3 12.5h7.4" />
    </>
  ),
  // Une flamme à deux langues : le Mage, qui brûle tous les adversaires.
  mage: (
    <>
      <path d="M10 17.5c-3 0-5-2-5-4.8 0-3 2.3-4.5 3-7.7 1.8 1 3 2.6 3.2 4.3.6-.6 1-1.5 1.2-2.6 1.6 1.4 2.6 3.6 2.6 6 0 2.8-2 4.8-5 4.8z" />
      <path d="M10 17.5c-1.2 0-2-.8-2-2 0-1.3 1-2 2-3.2 1 1.2 2 1.9 2 3.2 0 1.2-.8 2-2 2z" />
    </>
  ),
  // Un étendard à queue d'aronde : le Meneur.
  meneur: (
    <>
      <path d="M5 17.5V2.5" />
      <path d="M5 3.5h10l-2.5 3 2.5 3H5" />
    </>
  ),
  // Un marteau de forge, en biais : l'Artificier.
  artificier: (
    <>
      <path d="M10.1 3.5 16.4 9.9 13.9 12.4 7.6 6.1z" />
      <path d="M10.7 9.3 3.8 16.2" />
    </>
  ),
  // Une marmite qui fume : l'Intendant.
  intendant: (
    <>
      <path d="M3 8h14" />
      <path d="M4.5 8v4a4.5 4.5 0 0 0 4.5 4.5h2a4.5 4.5 0 0 0 4.5-4.5V8" />
      <path d="M8 2.5c-.7.9.7 1.9 0 2.8M12 2.5c-.7.9.7 1.9 0 2.8" />
    </>
  ),
  // Une bourse nouée : le Débrouillard, qui prend sa part.
  debrouillard: (
    <>
      <path d="M8.2 5.8C5.5 7.8 4 10.5 4 13c0 2.8 2.4 4.5 6 4.5s6-1.7 6-4.5c0-2.5-1.5-5.2-4.2-7.2" />
      <path d="M8 5.8h4M8.2 5.8 7 3h6l-1.2 2.8" />
    </>
  ),
  // ---------------------------------------------------------------
  // Donjon — ressources et stats.
  // ---------------------------------------------------------------
  // Un cœur : les points de vie.
  pv: (
    <path d="M10 16.5S3 12.3 3 7.6A3.6 3.6 0 0 1 10 6a3.6 3.6 0 0 1 7 1.6c0 4.7-7 8.9-7 8.9z" />
  ),
  // Une épée seule, en biais : l'attaque.
  atq: (
    <>
      <path d="M16.5 3.5v2.8L8.8 14 6 11.2l7.7-7.7z" />
      <path d="M4.5 10.5l5 5M6.2 13.8 3.5 16.5" />
    </>
  ),
  // Un éclair : l'initiative, qui joue en premier.
  ini: <path d="M11.5 2.5 5 11h4.5l-1 6.5L15 9h-4.5z" />,
  // Une pile de pièces : le butin, et les PO de la bourse.
  butin: (
    <>
      <path d="M4 7.5a6 2.3 0 1 0 12 0a6 2.3 0 1 0-12 0" />
      <path d="M4 7.5v6c0 1.3 2.7 2.3 6 2.3s6-1 6-2.3v-6" />
      <path d="M4 10.5c0 1.3 2.7 2.3 6 2.3s6-1 6-2.3" />
    </>
  ),
  // Une étoile à cinq branches droites : l'expérience (l'éclat des succès en a quatre, courbes).
  xp: (
    <path d="M10 3.1l1.88 4.91 5.25.27-4.09 3.31 1.37 5.08L10 13.8l-4.41 2.87 1.37-5.08-4.09-3.31 5.25-.27z" />
  ),
  // Une gemme taillée, sa table et sa culasse : la relique.
  relique: (
    <>
      <path d="M6 4h8l3 4-7 9.5L3 8z" />
      <path d="M3 8h14M7.5 8 10 17.5 12.5 8" />
    </>
  ),
  // Des marches qui montent : l'étage.
  etage: <path d="M2.5 16.5h4v-3.7h3.8V9h3.8V5.3h3.6" />,
  // Un crâne couronné : le gardien d'étage, au-dessus de l'élite.
  gardien: (
    <>
      <path d="M5.8 6.2 5.2 2.8l2.4 1.7L10 2l2.4 2.5 2.4-1.7-.6 3.4z" />
      <path d="M5.5 12a4.5 4.5 0 0 1 9 0c0 1.6-.8 2.6-1.7 3.1v2.4H7.2v-2.4C6.3 14.6 5.5 13.6 5.5 12z" />
      <circle cx="8.3" cy="12" r=".6" />
      <circle cx="11.7" cy="12" r=".6" />
    </>
  ),
  // Un phare qui éclaire : la source de pouvoir, un lieu.
  source: (
    <>
      <path d="M5 17.5h10" />
      <path d="M7.4 17.5 8.5 7.5h3l1.1 10" />
      <path d="M8.5 7.5v-2L10 3.5l1.5 2v2" />
      <path d="M4 5.5h2M14 5.5h2" />
    </>
  ),
  // Une épée plantée dans un tertre : un compagnon à terre.
  tombe: (
    <>
      <path d="M10 2.5V5M7 5h6" />
      <path d="M10 5v9.5" />
      <path d="M3.5 17.5h13M6 17.5c.9-1.6 2.3-2.4 4-2.4s3.1.8 4 2.4" />
    </>
  ),
  // ---------------------------------------------------------------
  // Donjon — commandes du combat.
  // ---------------------------------------------------------------
  // La flèche de lecture : le combat automatique.
  auto: <path d="M6.5 4.5v11l9-5.5z" />,
  // Deux chevrons : la vitesse.
  vitesse: <path d="M4.5 5l5 5-5 5M10.5 5l5 5-5 5" />,
  // Un sablier, le sable en bas : la compétence en recharge.
  recharge: (
    <>
      <path d="M5.5 2.5h9M5.5 17.5h9" />
      <path d="M6.8 2.5v1.8c0 2.5 3.2 3.4 3.2 5.7s-3.2 3.2-3.2 5.7v1.8M13.2 2.5v1.8c0 2.5-3.2 3.4-3.2 5.7s3.2 3.2 3.2 5.7v1.8" />
      <path d="M8.6 15.5h2.8" />
    </>
  ),
  // Une porte en arche, et le pas qui en sort : fuir.
  fuir: (
    <>
      <path d="M11.5 9V7.5a3.5 3.5 0 0 0-7 0v10h7V14" />
      <path d="M8 11.5h9.5M15 9l2.5 2.5L15 14" />
    </>
  ),
  // Un parchemin roulé, une coche dessus : les missions de Bodégué.
  missions: (
    <>
      <path d="M6 3.5h8.5a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H14v8a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2H6z" />
      <path d="M6 3.5a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2" />
      <path d="M7.8 11.3l1.6 1.6 2.8-3.2" />
    </>
  ),
  // Deux flèches en boucle : remplacer une mission.
  remplacer: (
    <>
      <path d="M15.5 8A5.8 5.8 0 0 0 5 6.2L3.8 7.5" />
      <path d="M3.5 4v3.5H7" />
      <path d="M4.5 12a5.8 5.8 0 0 0 10.5 1.8l1.2-1.3" />
      <path d="M16.5 16v-3.5H13" />
    </>
  ),
  // Une horloge : le temps avant la prochaine carte du jour (Reliquaire).
  horloge: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6v4.2l2.8 1.8" />
    </>
  ),
  // Un point d'interrogation cerclé : la règle détaillée, au survol.
  aide: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M7.9 8.1a2.1 2.1 0 1 1 3.1 1.8c-.6.3-1 .8-1 1.5v.3" />
      <path d="M10 13.9v.1" />
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
