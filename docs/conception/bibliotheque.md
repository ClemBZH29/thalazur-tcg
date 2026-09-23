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
voisines dans la grille — le tri les garde collées. Un set de cinquante cartes
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

Le bouton « Tout effacer » des réglages vide la clé et recharge la page.
