# La bibliothèque

Raisonnement de conception : ce que fait cette partie du site, et pourquoi elle le fait ainsi. Pour travailler sur le projet, voir le [README](../../README.md).

## La bibliothèque


Elle affiche **le set entier**, obtenu ou non. Les cartes manquantes apparaissent
de dos, désaturées et sans nom — on voit ce qui manque, pas ce qu'on va obtenir.

**Normale et rainbow sont deux possessions distinctes, et la grille le montre.**
Il y a eu trois états successifs, et il vaut la peine de dire pourquoi.

D'abord deux grilles, l'une pour les normales, l'autre pour les rainbow, avec une
bascule : c'était compter deux fois le même set, et afficher une grille entière
de dos gris pour dire qu'on n'avait pas l'écaille — qui sort trois fois sur cent
et que personne ne « complète ». Ensuite une case unique par carte, montrant la
rainbow dès qu'on l'avait : plus court, mais la rainbow *cachait* alors la carte
standard, et rien ne disait plus si on possédait celle-ci.

La règle tenue aujourd'hui : **chaque carte a sa case normale, toujours ; sa case
rainbow n'apparaît que si on la détient.** Les deux cases d'une même carte sont
voisines dans la grille — le tri les garde collées.

**Ordre et vue d'ouverture.** La grille est rangée par **numéro de carte
décroissant**. Les numéros suivent le palier puis le type — communes 001-110,
peu communes 111-176, rares 177-209, légendaires 210-220, et dans chaque palier
les artéfacts, les lieux puis les PNJ — : la grille montre donc les full art
(rangés après tous les numéros), puis les légendaires, et ainsi de suite, chaque
palier des PNJ aux artéfacts. La rainbow suit sa normale ; les PJ, sans numéro,
se rangent par nom ; il remplace l'ancien tri par palier puis par possession. La vue
s'ouvre sur les **cartes obtenues** — on vient d'abord voir ce qu'on a ; la
grille complète, dos gris compris, est à un bouton, et « Réinitialiser »
ramène aux obtenues. Un set de cinquante cartes
affiche donc cinquante cases sur une collection vierge, et jusqu'à cent quand on
a tout en double version. Sur La Troupe, 226 cartes de set et 314 cases pour
88 rainbow détenues.

Conséquence assumée : posséder une carte *seulement* en rainbow laisse sa case
normale marquée manquante. C'est exact — la carte standard n'est pas là — et
c'est ce que comptent l'avancement et la pastille de navigation, qui disent tous
deux le même chiffre parce qu'ils appliquent le même critère : la case normale
remplie, hors PJ.

**Une pastille dit combien d'exemplaires on détient de cette case-là** — pas de
la carte, de la case : « ×1 » en sourdine, « ×3 » en ambre dès qu'il y a de quoi
négocier au Comptoir. Elle remplaçait un compteur de surplus qui n'apparaissait
qu'au delà du premier exemplaire et disait « +2 » pour trois. Elle porte un
`z-index` de 8 : à 3 elle passait sous `.cardbox`, qui est à 6, et restait
invisible sans qu'aucune règle n'échoue.

**Le niveau de la carte, en miroir, en haut à gauche** (« Niv. 11 »), en vert de
l'expérience pour ne pas se lire comme un nombre d'exemplaires. Il n'apparaît
qu'à partir du niveau 2, sur la case normale seulement : une grille couverte de
« Niv. 1 » ne dirait rien.

**Les doublons se décident sur la carte agrandie.** Ouverte depuis la
bibliothèque, la loupe porte deux volets à droite de la carte, hors du flux
(la carte reste exactement au centre) ; sous la carte quand la largeur manque
(moins de 1 100 px, depuis l'arrivée du volet de gauche) :

- **Entraîner** : un doublon devient de l'expérience pour sa carte — 15, 30,
  75, 250 points selon le palier (`ENTRAINEMENT`, `src/config/reliquaire.js`),
  la même expérience qu'au Donjon et en Expédition (`entrainer`,
  `src/donjon/experience.js`). Un doublon commun vaut le tiers d'une descente.
  Les paliers paient comme au Donjon : irisation, PO si déjà irisée, sachet au
  niveau 100. Boutons : un doublon, juste assez pour le niveau suivant, tous.
- **Reliquaire** : un doublon devient des vestiges, pour la carte du jour.
  N'apparaît qu'une fois le Reliquaire ouvert (une extension à 60 %).

Le dernier exemplaire n'est jamais proposé ; une légendaire se dissout avec
confirmation. Pas de volets de doublons sur une version irisée ni sur l'onglet PJ.

**À gauche, la fiche de combat** (volet « Combat », 01/10/2026) : PV, ATQ,
INI et les deux compétences de la carte, avec ce qu'on peut y changer contre
des vestiges, et l'étoile de chaque ligne contre une rainbow en trop. Il ne
s'affiche que pour les PNJ alliés, les seuls qui descendent, et aussi sur la
version irisée : la fiche est celle de la carte. Voir `donjon.md`, « La fiche
de combat ».

**Pour un Lieu, le volet de gauche est sa source de pouvoir** (01/10/2026) :
le pouvoir qu'il donne à l'équipe au Donjon, à son niveau et au niveau 100,
son étoile (une rainbow en trop du lieu) et STAR RESET. Voir `donjon.md`,
« Sources de pouvoir et artéfacts ».

**L'étoile, en bas à droite**, sous le nombre d'exemplaires : les quatre
lignes de la fiche sont étoilées. Elle s'affiche sur les deux versions.

**Les cartes PJ ont leur propre onglet**, à côté des extensions. Elles ne sont
d'aucune d'entre elles — elles tombent dans toutes — et les compter dans le set
de la Troupe donnait un dénominateur faux et une complétion impossible à
atteindre ailleurs. Leurs exemplaires s'additionnent d'une extension à l'autre,
là où le stockage les range sous celle qui les a sorties.

### Avancement et filtres

L'avancement tenait en quatre grands nombres et une barre plate : « 43 / 48
normales », « 14 / 48 rainbow », « 90 % du set », « 224 PO de revente
automatique ». Le troisième répétait le premier, le quatrième mesurait un
réglage éteint par défaut, et aucun ne disait ce qu'on vient chercher ici :
**ce qu'il reste à trouver, et dans quel palier**. Un seul chiffre désormais, et
le détail palier par palier en barres — la teinte de rareté sur la barre, jamais
sur le texte, où elle ne tiendrait pas le seuil de contraste.

Cet avancement se consulte plus qu'il ne sert à chaque visite : il est replié
derrière « Statistiques de ma collection », un onglet rangé à droite des
extensions, pour que la grille arrive tout de suite. Ouvert, il montre le
chiffre seul, en grand (`5 / 226`), puis les barres. L'appareil retient s'il
était ouvert (`brume-thalazur:biblio-stats`), sans l'envoyer sur le compte.

Les filtres se lisent en deux rangs : l'**état** de la case — toutes, obtenues,
en double, rainbow — puis la **rareté**, avec son avancement. Ils
portent sur les cases, pas sur les cartes : « en double » compte les cases à deux
exemplaires ou plus, « rainbow » isole les cases rainbow. Un champ de recherche
par nom complète l'ensemble, insensible aux accents et à la casse ; il ne servait
à rien sur quarante-huit cartes, il est indispensable sur trois cent quatorze. La rangée des raretés et les barres se taisent quand il n'y a
qu'un palier à montrer, c'est-à-dire sur l'onglet des PJ. Le filtre « manquantes » a été retiré : la grille montre
déjà les dos gris, et isoler deux cents dos identiques n'apprenait rien.

Un badge **New** apparaît à la révélation quand la carte remplit une case vide,
en pastille ambre pour une case normale et en dégradé arc-en-ciel pour une case
Rainbow. Il est calculé sur l'état de la collection *avant* la mise à jour,
sinon toute carte paraîtrait déjà possédée au moment de l'affichage.

Le badge est rendu à l'intérieur de l'élément qui glisse, et son opacité suit
l'amplitude du geste : à mi-course vers le seuil de dégagement il est à moitié
effacé. La transition n'est active qu'au retour en ressort — pendant le
glissement elle ferait traîner le badge derrière le doigt.

Un ordre de grandeur pour calibrer tes attentes : l'irisation sort à 3 %, donc
compléter les 240 communs en rainbow demanderait environ seize mille boosters.
C'est une couche de chasse, pas un objectif de complétion — comme les full art,
et c'est exactement pour cela qu'elle ne compte plus dans l'avancement.

## Export, import


La bibliothèque vit dans `localStorage` sous la clé `brume-thalazur:v1` :
collections par booster, compteurs d'ouverture, réglages, rosters chargés à la
main et corrections de palier.

**Exporter** produit un fichier JSON daté. **Importer** propose deux modes :
fusion (les doublons s'additionnent, l'état rainbow est conservé dès qu'il
apparaît d'un côté) ou remplacement complet.

Les deux boutons sont au **profil**, dans les préférences (« Sauvegarde dans un
fichier »). Ils étaient en tête de la bibliothèque, où ils prenaient une ligne
d'écran au téléphone pour un geste qu'on fait une fois. Le résultat de l'import
s'affiche sur place : l'avis général du jeu n'est montré que par la page des
réglages, qui n'est plus publique, si bien qu'importer depuis la bibliothèque
ne disait rien.

Le bouton « Tout effacer » du profil vide la clé et recharge la page.

## Au téléphone

L'audit mobile du 28/09/2026 a mesuré la première carte à 770 px sur un écran
de 844 : tout le premier écran était de la commande. Sous 720 px :

- **Extensions et PJ sur une seule ligne qui défile** ; la bascule des
  statistiques passe dessous, en pleine largeur. Sur grand écran le conteneur
  de défilement s'efface (`display: contents`) et rien ne change.
- **Une barre collée sous le bandeau** : la recherche, un bouton « Filtrer » qui
  dit combien de filtres sont actifs, et la bascule de densité. La barre suit
  la hauteur réelle du bandeau (`--tete-h`, mesurée par la coque) ; en paysage
  bas, où le bandeau n'est plus collant, elle se colle au bord de l'écran.
- **Les filtres dans une feuille** qui monte du bas : un `<dialog>` natif ouvert
  par `showModal()`, qui apporte le piège à focus, Échap, l'arrière-plan inerte
  et le retour du focus au bouton. Les filtres s'appliquent au toucher ; le
  bouton du bas dit combien de cases resteront et referme.
- **Trois colonnes au lieu de deux** sous 560 px, par défaut. On vient survoler
  sa collection ; le nom devient petit, mais la loupe est à un toucher. La
  bascule rend les grandes cartes, et l'appareil s'en souvient
  (`brume-thalazur:biblio-densite`), comme du volet des statistiques.

Les deux groupes de filtres sont rendus deux fois — en ligne sur grand écran,
dans la feuille au téléphone — et un seul est affiché : l'autre est en
`display: none`, donc absent de l'arbre d'accessibilité.
