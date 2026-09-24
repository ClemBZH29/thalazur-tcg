# Charte graphique — La Brume de Thalazur

Document de référence du projet. Toute valeur ci-dessous existe dans
`src/styles/tokens.css` ou `src/config/tiers.js` : ce fichier les explique, il ne
les duplique pas. En cas de divergence, le code fait foi.

---

## 1. Principe directeur

**Sol froid, lumière chaude.** L'interface est une brume de nuit sur l'eau, et la
seule source chaude est la lampe à huile d'un camp. Les cartes sont la lumière de
l'écran ; l'interface reste dans l'ombre.

Ce n'est pas un parti pris décoratif. Les irisations de l'effet Rainbow reposent
sur `mix-blend-mode: color-dodge` et `screen`, qui ne produisent rien sur un fond
clair. Un fond sombre est une contrainte technique autant qu'une intention.

**Ce qu'il faut éviter.** La première version du projet employait un fond crème
proche de `#F4F1EA`, un accent turquoise, des micro-libellés en monospace et des
capitales espacées au-dessus de chaque bloc. Cet assemblage est une signature par
défaut, pas un choix. Il a été abandonné pour cette raison.

---

## 2. Palette

### Surfaces

| Jeton | Valeur | Rôle |
|-------|--------|------|
| `--ground` | `#0d1417` | fond |
| `--ground2` | `#131e22` | champ |
| `--panel` | `#1a272c` | panneau |
| `--panel2` | `#223136` | panneau clair |
| `--edge` | `#2c3d43` | séparation décorative |
| `--edge-hi` | `#3d5259` | séparation appuyée |

### Encre et accents

Le ratio indiqué est le **pire cas** parmi les quatre surfaces ci-dessus.

| Jeton | Valeur | Usage | Ratio | Seuil | Verdict |
|-------|--------|-------|-------|-------|---------|
| `--ink` | `#ece3d2` | texte principal, titres | 10.56 | 4.5 | conforme |
| `--ink2` | `#b7b2a4` | corps de texte | 6.36 | 4.5 | conforme |
| `--ink3` | `#8c989a` | texte secondaire, aide | 4.53 | 4.5 | conforme |
| `--ink4` | `#88999e` | libellés, compteurs | 4.55 | 4.5 | conforme |
| `--lamp` | `#e8a33d` | accent, prix, états actifs | 6.24 | 4.5 | conforme |
| `--ember` | `#e5774b` | alerte | 4.53 | 4.5 | conforme |
| `--edge-ui` | `#687a80` | bordure d'élément interactif | 3.00 | 3.0 | conforme |

`--edge` et `--edge-hi` (1,6 et 2,3) sont réservés aux **séparations
décoratives**. Toute bordure qui délimite un élément actionnable — puce de
filtre, champ, sélecteur — prend `--edge-ui`, que WCAG 1.4.11 exige à 3:1.

### Couleurs de rareté

| Palier | Lueur | Teinte du cadre | Opacité |
|--------|-------|-----------------|---------|
| Commun | `#8fb8d8` | aucune, bleu d'origine | — |
| Peu commun | `#4e8c7e` | `#3f9c86` | 0,50 |
| Rare | `#d19a3c` | `#d19a3c` | 0,68 |
| Légendaire | `#b33049` | `#b33049` | 0,70 |
| Full art | `#b33049` | `#b33049` | 0,74 |
| Carte PJ | `#e3ecf4` | filtre de désaturation | — |

### Le semis d'étoile d'un filon

Le bloc de roche des Mines porte cinq à huit éclats d'étoile, tirés au hasard à
chaque filon. Deux contraintes s'ajoutent au hasard, sans quoi il se voit pour ce
qu'il est.

**Le recouvrement est constant.** Le nombre d'éclats et leur taille étaient tirés
indépendamment : l'aire totale allait du simple au décuple, et un filon sur trois
paraissait vide quand le suivant était constellé. Les tailles sont tirées en
valeurs relatives puis mises à l'échelle pour que la somme des aires vaille
toujours **3,6 %** de l'ellipse de roche. La variété des tailles est conservée,
c'est leur total qui est fixé.

**Les positions sont réparties, pas seulement aléatoires.** Un tirage uniforme
sur si peu de points produit des grappes et des vides. Chaque éclat est choisi
parmi douze candidats, celui qui s'éloigne le plus de ses voisins déjà posés —
tirage « meilleur candidat » de Mitchell, qui donne un bruit bleu : imprévisible,
mais sans agglutinement. L'écart minimal mesuré entre deux éclats est passé de
quasi nul à vingt-cinq unités de gabarit.

La teinte est appliquée en `mix-blend-mode: color` à travers un masque tiré du
cadre lui-même : seuls ses traits changent de couleur, jamais le portrait.

**Le noir n'a pas de teinte.** Un aplat noir en mode `color` ne produit rien. Le
cadre des cartes PJ est désaturé et assombri par un filtre
(`saturate(0) brightness(.34) contrast(1.3)`), pas par un masque coloré.

---

## 3. Typographie

| Rôle | Police | Réglage |
|------|--------|---------|
| Affichage — titres, noms de carte | Fraunces | `font-variation-settings: "SOFT" 24, "WONK" 1` |
| Interface — tout le reste | Archivo | 400, 500, 600, 700 |

L'axe `WONK` de Fraunces donne sa coupe légèrement gravée : c'est lui qui
rattache la typographie au cadre. Il est appliqué par la variable `--wonk`, à
n'utiliser que sur les éléments d'affichage.

**Aucune monospace dans le projet.** Les micro-libellés en chasse fixe font
partie de la signature par défaut évoquée plus haut. Pour les chiffres, employer
`font-variant-numeric: tabular-nums` sur Archivo.

**Capitales espacées : une seule occurrence tolérée**, le bandeau d'unité en tête
de carte, parce qu'il imite une gravure. Nulle part ailleurs.

### Typographie de carte

Toute la typographie de carte est exprimée en **`cqw`**, pas en pixels. La boîte
de carte porte `container-type: inline-size`, donc les corps suivent sa largeur :
une vignette de bibliothèque, une carte révélée et un plein écran affichent
exactement les mêmes proportions.

| Élément | Taille |
|---------|--------|
| Nom | `7.4cqw` |
| Ligne de repères | `3.3cqw`, semi-gras |
| Citation | `2.9cqw`, italique, deux lignes maximum |
| Pied — palier et encoches | `2.75cqw` |

Un crochet d'ajustement (`src/lib/ajuste.js`) réduit le corps jusqu'à ce qu'un
nom long tienne dans sa plaque, et repasse une fois les polices chargées.

---

## 4. Dimensions

Cinq variables portent toutes les tailles ; le reste en dérive. Ne jamais écrire
une dimension de carte ou de scène en dur.

| Jeton | Valeur | Ce qui en dérive |
|-------|--------|------------------|
| `--carte-plein` | `clamp(228px, 72vw, 306px)` | hauteur de la pile, taille de la lueur, dos empilés |
| `--carte-petit` | `clamp(132px, 38vw, 186px)` | colonnes de la grille de bibliothèque |
| `--carte-zoom` | `min(76vw, 396px)` | plein écran |
| `--sachet` | `clamp(188px, 52vw, 248px)` | toute la scène d'ouverture |
| `--sachet-marge` | `calc(var(--sachet) * .24)` | espace au-dessus du sachet, avant et après déchirure |

Rayons : `--r-sm` 3px, `--r-md` 6px, `--r-lg` 10px.
Ombres : `--shadow-lift` pour les cartes, `--shadow-flat` pour les panneaux.

### Géométrie de la scène d'ouverture

Tout s'exprime en fraction de `--sachet`, avec `--sachet-r` le rapport du visuel,
propre à chaque extension.

| Élément | Formule |
|---------|---------|
| Hauteur du conteneur | `--sachet / --sachet-r + --sachet-marge` |
| Ligne de déchirure | `--sachet-marge + (--sachet / --sachet-r) × 0,25` |
| Largeur d'une carte | `--sachet × 0,538` |
| Montée d'une carte | `--sachet × 0,6295` |
| Écartement en éventail | `--sachet × 0,13` |

Ces coefficients donnent un recouvrement final de **78 %** de la carte par le
papier, quels que soient la taille et le rapport. C'est ce recouvrement qui
produit la lecture « elles sortent du sachet ».

---

## 5. Mouvement

Le tempo porte l'information autant que la couleur. Avant chaque retournement,
une lueur du palier monte sous la carte : on sait qu'il y a un coup avant de
pouvoir lire quoi que ce soit.

| Palier | Lueur | Retournement | Particules | Assombrissement |
|--------|-------|--------------|------------|-----------------|
| Commun | 150 ms | 430 ms | — | — |
| Peu commun | 230 ms | 470 ms | 8 | — |
| Rare | 470 ms | 640 ms | 16 | 24 % |
| Légendaire | 820 ms | 840 ms | 28 | 56 % |
| Full art | 1150 ms | 1000 ms | 42 | 72 % |
| Carte PJ | 1550 ms | 1150 ms | 58 | 84 % |

Courbes usuelles : `cubic-bezier(.2,.8,.3,1)` pour une entrée, `.34,.85,.36,1`
pour le retournement, `.2,1.3,.4,1` pour un retour en ressort.

**Le réglage « moins d'animations » coupe toutes les animations d'ambiance et
de révélation** (profil : « Jamais animer », ou « Suivre le système » quand le
système le demande ; le défaut est « Toujours animer »). Une règle absolue l'accompagne : une animation supprimée doit voir
sa **position finale posée explicitement**. Les cartes sortant du sachet
démarrent cachées derrière le papier ; sans transformation finale de repli, la
scène était entièrement vide pour qui a désactivé les animations.

---

## 6. Accessibilité

Ce que le projet garantit, et pourquoi.

### Contrastes

Tout texte atteint 4,5:1 sur la surface la plus claire où il apparaît, toute
bordure d'élément actionnable atteint 3:1. Les valeurs mesurées figurent au
chapitre 2. **Vérifier au calcul, jamais à l'œil** : `--ink4` paraissait
convenable et tombait à 2,55:1 sur les panneaux.

### Clavier

Toute carte est un `role="button"` avec index de tabulation, nom accessible
explicite — « Retourner la carte », « Agrandir Gorven Tasq, Rare » — et gestion
d'Entrée et Espace. Une carte n'est jamais un `div` à écouteurs de pointeur.

Le plein écran est un dialogue complet : `aria-modal`, piège à focus, focus rendu
à l'élément d'origine à la fermeture, fermeture par Échap.

Un lien d'évitement précède le bandeau, chaque vue porte un repère `<main>`.

**Limite connue et assumée** : le geste de déchirure du sachet n'est pas
reproductible au clavier. Deux boutons juste en dessous donnent le même résultat.

**Une cible de focus non interactive ne porte pas de cerne.** Au changement
d'adresse, le focus est déplacé sur le `h1` de la page — sans quoi un lecteur
d'écran ne sait pas où l'on vient d'arriver, et la tabulation reprend là où
elle était. Mais le titre reçoit alors le contour ambré du focus visible, et un
cadre autour de « La Brume de Thalazur » à chaque arrivée annonce une commande
qui n'existe pas. On garde le déplacement, on retire le contour :
`h1[tabindex="-1"]:focus, h1[tabindex="-1"]:focus-visible { outline: none }`.
La règle ne vaut que pour ces cibles-là ; tout ce avec quoi on interagit garde
son cerne.

### Lecteurs d'écran

Une région `aria-live="polite"` annonce chaque carte révélée : nom, palier,
mention Rainbow, nouveauté, nombre de cartes restantes. Sans elle, l'ouverture se
déroulait dans un silence complet.

Les bascules portent `aria-pressed` : version affichée, filtres de rareté,
sélecteur d'extension. Tout sélecteur sans libellé visible porte un
`aria-label`.

### Tactile

`touch-action: pan-y` sur les cartes et le sachet. **Jamais `none`** : le doigt
tombe forcément sur une carte dans la bibliothèque, et `none` y supprimait tout
défilement. `pan-y` laisse le navigateur gérer le vertical et ne réserve que
l'horizontal, ce dont le balayage a besoin.

`onPointerCancel` est obligatoire partout où un geste est suivi : le navigateur
reprend la main dès qu'un glissement devient un défilement, et l'événement de fin
n'arrive jamais.

Au doigt il n'y a pas de survol : remettre l'inclinaison à plat au relâchement,
sinon la carte reste figée dans l'angle où le doigt l'a quittée.

Cibles de 44 px minimum sous `@media (pointer: coarse)`.

### Encoches et zones sûres

`viewport-fit=cover` est déclaré, donc `env(safe-area-inset-*)` doit être
appliqué à tout ce qui touche les bords : bandeau, vue, plein écran.

### Agrandissement du texte

**Ne jamais poser `overflow: hidden` sur un conteneur pleine hauteur.** Le zoom
navigateur réduit la largeur CSS et désactive les mises en page fixes, mais
quelqu'un qui augmente uniquement la taille du texte garde une fenêtre
inchangée : le débordement devient irrécupérable. Utiliser `overflow: auto`, qui
ne change rien tant que tout tient. C'est le critère WCAG 1.4.4.

---

## 7. La coque du site

Le projet est passé de trois vues à six pages. Ce que cela impose.

### Le bandeau a deux étages

Identité et bourse au-dessus, sections en dessous. Ce n'est pas d'abord un choix
de composition : le bandeau porte un flou d'arrière-plan, et **`backdrop-filter`
fait de l'élément un bloc conteneur pour ses descendants en position fixe**. La
barre d'onglets, fixée en bas de l'écran au doigt, se retrouvait collée en haut
du bandeau. Les deux étages sont frères sous une coquille collante sans filtre.

Deux étages se lisent d'ailleurs mieux à six entrées qu'un rang unique, et le
passage au mobile devient direct : le second étage descend sous le pouce.

### La navigation descend sous 860 px

Six entrées à quarante-quatre pixels ne tiennent pas sur un rang en haut. En
barre fixe basse, chaque entrée prend une icône, une étiquette courte et une
zone de quarante-quatre pixels au moins. Le nom complet reste dans le flux, hors
écran, pour le nom accessible du lien : seul l'affichage prend la version
courte. La vue réserve la hauteur de la barre en bas de page.

### Toutes les pages partagent un gabarit

Changer d'onglet ne doit rien faire bouger d'autre que le contenu. Toutes les
pages ont la même largeur (`--page-max`, 1 420 px) et le même en-tête : même
marge haute, titre de même taille (`--page-titre`), aligné en haut quelle que
soit la hauteur de ce qui l’accompagne à droite (un bouton, au plus). Le tout
vit dans `src/styles/gabarit.css`, chargé en dernier : une page ne redéfinit
ni sa largeur ni son titre. Seuls l'accueil et la page 404, centrés, font
exception.

### Le focus suit l'adresse

Sur un site en une seule page, le navigateur ne remet ni le défilement ni le
focus au changement d'adresse. Le titre de la page le reçoit, avec quelques
images d'attente pour les pages chargées à la demande, dont le titre n'existe
pas encore quand l'adresse change. **Un seul `h1` par page** : c'est lui la
cible, et c'est le plan du document.

### Les liens sont des liens

La navigation, l'étagère et les entrées de module sont des `<a href>`, pas des
boutons : le clic du milieu, l'ouverture dans un nouvel onglet et la copie du
lien doivent fonctionner comme sur un site. La remise à zéro de `a` est donc
globale, et tout élément qui doit *se lire* comme un lien le déclare.

### L'accueil ne répète pas le menu

L'accueil a porté un moment l'avancement de la collection et quatre entrées de
module, ce qui en faisait un tableau de bord. Or la navigation est en haut de
chaque page et l'avancement est le sujet de la bibliothèque : un écran d'accueil
qui répète le menu ne dit rien de plus, il dit moins fort. Il reste le titre, la
promesse et par où entrer, centré dans la fenêtre.

### La fenêtre de négoce se mesure sur son portrait

C'est le portrait qui fixe la hauteur du cadre, et sa largeur en découle. Les
onze portraits sont découpés en **4:5** dans la planche d'origine, la colonne de
scène fait donc quatre cinquièmes de la hauteur du cadre et l'image la remplit
au pixel, sans aucun recadrage.

| Jeton | Valeur | Ce qui en dérive |
|-------|--------|------------------|
| `--neg-h` | `clamp(452px, 74vh, 588px)` | hauteur du cadre, largeur de la scène, largeur totale |
| `--neg-ratio` | `0.8` | le 4:5 de la planche |

Le plancher garantit au panneau de quoi tenir ses trois zones ; le plafond
empêche un grand écran de transformer le portrait en affiche. Le cadre est ainsi
passé d'un carré de 1040 × 811, où le portrait mangeait 52 % de la largeur, à un
paysage de 1010 × 588 où il en occupe 46 %.

Le panneau a du mou, puisque ce n'est pas lui qui commande la hauteur. Ce mou se
répartit **au-dessus et au-dessous du rang de chiffres** (`margin-block: auto`),
ce qui centre l'argent dans la colonne — au lieu de laisser un trou de cent
quatre-vingt-dix pixels entre les boutons et le pied de page.

### Trois zones, pas sept boîtes

Bordure, fond, rayon et ombre disent chacun « objet séparé ». Le panneau de
négoce en dépensait sept pour trois informations : les puces, la carte, l'offre,
les actions, l'encadré du pari, ses deux issues, deux paragraphes de mentions.
Il en reste trois — la carte et sa quantité sur un rang, les trois chiffres sur
un rang séparé par des **filets** et non enfermés dans des cadres, les actions —
plus une ligne de pied derrière laquelle une bulle porte la règle complète. Le
séparateur vertical des chiffres est celui de la ligne de repères des cartes.

Une place est réservée au verdict, occupée ou non : la fenêtre ne doit pas
grandir au moment où le résultat tombe.

### Les portraits sont des découpes, pas des photographies

La planche d'origine est en RVBA : les personnages y sont détourés, fond
transparent. **C'est la propriété la plus utile de ces images, et elle a été
ignorée trois fois de suite.**

- Première version : fenêtre 4:5 centrée sur le visage, image aplatie sur un
  fond opaque. Le personnage perdait ses épaules, coupées à gauche et à droite
  par une fenêtre plus étroite que lui.
- Deuxième : un plafond de hauteur sur la vignette, et un voile opaque sur son
  tiers bas pour masquer la coupe. On voyait la chevelure et les yeux.
- Troisième : la même chose, cadrage descendu de dix pour cent. Le visage
  entier, et rien d'autre.

Chaque correction traitait le symptôme — le rognage — en gardant la cause : une
vignette *photographique*, c'est-à-dire un cadre rempli par une image qu'il faut
bien couper quelque part.

**La règle.** Un portrait détouré se pose sur l'interface, il ne s'enferme pas
dans un cadre. Concrètement : `object-fit: contain`, `object-position: 50% 100%`
pour que le personnage tienne debout sur ce qui le suit, aucun fond propre à la
vignette, aucun voile. La lueur de lampe passe *derrière* (`z-index: 0`) ; sans
elle, une découpe flotte au-dessus du panneau au lieu d'y reposer. Et l'ombre se
met dans `filter` en `drop-shadow`, jamais en `box-shadow` : elle suit alors la
silhouette et non le rectangle.

Deux conséquences pratiques :

- **La taille se règle sans jamais rogner.** Avec `contain`, réduire la vignette
  réduit le personnage ; il reste entier. C'est l'inverse de `cover`, où chaque
  pixel de hauteur gagné est un pixel de sujet perdu.
- **Le bas de l'art est une coupe nette** — la planche s'arrête au milieu du
  torse. Sept pour cent de fondu appliqués *à l'image*
  (`mask-image: linear-gradient(to top, transparent 0, #000 7%)`) la dissolvent
  sans rien voiler d'autre. Un dégradé posé sur le panneau, lui, masque tout ce
  qui passe dessous.

L'exception est la case du colporteur, qui est un cadre revendiqué — gouttière,
lueur tournante, plaque gravée. Là `cover` est juste : une bande vide à
l'intérieur d'un cadre orné sonne creux, et le rognage se prend sur les côtés,
loin du visage.

Un dernier réflexe hérité de la vignette photographique : le bloc de texte
remontait de vingt-deux pixels pour mordre le dégradé de l'image. Avec une
découpe posée au bas de la scène, ce chevauchement écrit le nom dans les mains
du personnage.

### Découper une planche de portraits

Les onze portraits viennent d'une planche unique de 1448 × 1086, en trois
rangées de tuiles carrées de 362 pixels. **On exporte la boîte englobante
complète de l'art, alpha compris** — jamais une fenêtre de rapport fixe centrée
sur le visage, qui coupe le personnage à la largeur. Les découpes obtenues sont
presque carrées — rapports mesurés de 0,97 à 1,02 — et pèsent une cinquantaine
de kilo-octets chacune en WebP avec transparence.

Deuxième piège, indépendant du premier : **l'art de chaque tuile déborde dans la
tuile du dessous** — six pixels pour la rangée du haut. Une découpe qui prend la
tuile telle quelle, puis cadre sur la boîte englobante alpha, hérite donc d'un
bandeau parasite collé en haut du portrait : un fragment du personnage
précédent, bien visible dans la fiche du Comptoir. C'est arrivé à quatre
portraits sur onze.

Le débord se reconnaît à sa forme : une bande **pleine largeur** en tête de
tuile — plus de soixante pour cent de la largeur —, suivie d'une chute brutale
de couverture. Un vrai portrait commence par quelques pixels de cheveux ou de
chapeau, jamais par une ligne pleine. Le script de découpe saute donc cette
bande, puis cherche le premier départ franc : trois lignes consécutives de
contenu, pour ne pas s'arrêter sur un pixel isolé. Le reste de la boîte
englobante se lit ensuite sur l'alpha, sans autre contrainte de forme.

Le script est dans l'historique de `scripts/` ; il se relance en une trentaine
de lignes si la planche change.

### Les couleurs du Comptoir

Les teintes de rareté du chapitre 2 sont des teintes de cadre. **En texte, elles
ne tiennent pas le seuil.** Les encres du Comptoir, dans
`src/comptoir/teintes.js`, sont des variantes éclaircies vérifiées à 4,5:1 sur
`--panel2` :

| Palier | Teinte de cadre | Encre du Comptoir | Ratio sur `--panel2` |
|--------|-----------------|-------------------|---------------------:|
| Commun | `#8fb8d8` | `#8fb8d8` | 6,42 |
| Peu commun | `#3f9c86` | `#78c2b0` | 6,50 |
| Rare | `#d19a3c` | `#d19a3c` | 5,38 |
| Légendaire | `#b33049` | `#e8899a` | 5,43 |
| Carte PJ | — | `#e3ecf4` | 11,26 |

Le vert `--m-chene` a été employé une fois en texte dans la Régie et mesuré à
**4,35:1** : sous le seuil. Il paraissait convenable. C'est exactement le piège
du chapitre 2 — vérifier au calcul, jamais à l'œil.

### Le colporteur est la seule surface éclairée du site

Le principe du chapitre 1 est une terre froide et une lumière chaude ponctuelle
— la lampe éclaire, elle ne baigne pas. **Une exception, et une seule** : la
case de Mirko, au bilan d'une ouverture. Son panneau porte un fond tiède
(`#1d2a2c` vers `#182226`), une bordure ambrée, un halo, et une lueur qui fait
le tour du cadre.

C'est délibéré et cela ne doit pas s'étendre. L'évènement est rare — un passage
tous les trois jours au rythme nominal — et il doit se voir avant d'être lu.
Une seconde surface chaude sur la même page annulerait exactement l'effet que
celle-ci produit : le tiède ne se remarque que sur du froid.

Toutes ses encres ont été mesurées sur son propre fond, et non sur `--panel` :

| Élément | Encre | Ratio |
|---------|-------|------:|
| Nom, titre d'affaire | `--ink` | 11,15 |
| Réplique, citation | `--ink2` | 6,71 |
| Détail chiffré, règle du bas | `--ink3` | 4,79 |
| Verdict, chronomètre de la route | `--lamp` | 6,86 |

Le `--ink3` à 4,79 est le point le plus serré du panneau : il ne reste pas de
marge pour assombrir le fond tiède.

---

## 8. Pièges vérifiés

Chacun de ces points a causé une régression réelle dans le projet.

**Trois façons de disparaître sans rien casser.** Le sélecteur orphelin
ci-dessous en est une ; les deux autres se sont manifestées le même jour, dans
la bibliothèque.

- **`hidden` perd contre une classe de mise en page.** L'attribut ne pose qu'un
  `display: none` de feuille utilisateur : la moindre règle de classe avec
  `display: flex` ou `grid` le bat en spécificité. La rangée des raretés était
  masquée dans le code et bien visible à l'écran. Le remède tient en une ligne,
  posée une fois pour toutes dans `base.css` :
  `[hidden] { display: none !important; }`.
- **Un `z-index` trop bas peint l'élément sous la carte.** La pastille des
  exemplaires montait à 3 ; la carte, elle, monte à 6 (`.cardbox`) et son reflet
  à 7. La pastille était dans le document, mesurable au pixel près par un test —
  et invisible. Tout ce qui se pose sur une carte doit passer au-dessus de 7.

Le point commun des trois : aucune erreur, aucun test rouge, rien dans la
console. **Ce qui ne lève pas d'erreur se vérifie à l'œil, ou ne se vérifie
pas.**

**Un sélecteur orphelin ne casse rien — il cesse simplement d'agir.** Le
panneau de négoce a été refondu en trois zones, et l'encadré du montant a
changé de nom : `.neg-offre` est devenu `.neg-chiffres`. Les trois règles qui
portaient l'éclat du marchandage — vert quand l'offre monte, tressaillement
ambre-brûlé quand elle tombe — visaient encore l'ancien nom. Elles sont restées
dans la feuille, valides, colorées, et n'ont plus jamais rien animé. Aucune
erreur en console, aucun test rouge : la seule façon de s'en apercevoir est de
regarder, ou de chercher.

Dans le même mouvement, `.neg-verdict` a perdu ses deux variantes `.ok` et
`.ko` et gardé un `border: 1px solid` sans couleur : réussite et échec
s'affichaient dans le même encadré gris, la phrase seule les distinguant.

Le contrôle tient en quelques lignes et vaut d'être relancé après toute refonte
de gabarit — il extrait les classes des feuilles et cherche chacune dans le
code :

```bash
python3 - <<'EOF'
import re
from pathlib import Path
css = "\n".join(f.read_text() for f in sorted(Path("src/styles").glob("*.css")))
code = "\n".join(f.read_text() for f in list(Path("src").rglob("*.jsx")) + list(Path("src").rglob("*.js")))
for c in sorted(set(re.findall(r"\.([a-z][a-z0-9-]{2,})", css))):
    if c not in code: print(c)
EOF
```

Il rend aussi des faux positifs — toute classe construite à la volée
(`` `c-${tier}` ``, `"eclat-" + issue`) apparaît comme inutilisée. C'est au
lecteur de trancher ; l'important est que la liste soit courte et relue.

**`container-type` casse `backface-visibility`.** Le confinement empêche
d'honorer la face arrière : les deux faces se peignent l'une sur l'autre et l'on
voit l'avant en miroir. Le conteneur de requêtes doit être posé **hors du
contexte 3D**, sur la boîte, jamais sur une face.

**Un conteneur confiné doit porter une largeur explicite.** Le confinement en
ligne rend la largeur indépendante du contenu : `width: max-content` y vaut zéro,
et toutes les tailles en `cqw` avec.

**Une animation CSS écrase les styles en ligne.** Une entrée animée posée sur
l'élément que le glissement transforme casse le glissement. Séparer : conteneur
animé, élément transformé.

**Une bascule d'opacité calée sur la moitié d'un retournement est fausse.** Avec
`cubic-bezier(.34,.85,.36,1)`, les 90° sont atteints à **20 %** de la durée.
Calculer, ne pas supposer.

**Une barre de défilement qui apparaît décale toute la page.** Poser
`scrollbar-gutter: stable` et réserver la place des éléments qui apparaissent et
disparaissent, plutôt que de les monter et démonter.

**Deux variables pour un même objet finissent par diverger.** Le sachet intact et
sa partie conservée avaient deux largeurs : il rétrécissait au moment précis de
la déchirure.

**Un nom de classe générique se collisionne en silence.** Deux fois en une
journée, sur la même feuille partagée par cinq pages. `.vide`, employé pour le
tiret d'une offre absente, héritait de l'état vide de page d'`app.css` — avec
`display: flex` et un empilement centré : le tiret prenait cent quarante pixels
de haut et triplait la ligne. `.dos`, employé pour une vignette de carte de
trente-deux pixels, héritait de la face arrière de `cards.css` — largeur de
100 %, rapport 2/3 et rotation de 180 degrés : la vignette sortait de sa case.
Aucun des deux ne produit d'erreur ni d'avertissement. Les noms génériques d'une
page sont cantonnés sous la classe racine de cette page, et ce qui doit vivre
partout — une bascule, par exemple — est posé dans `site.css`, pas dans la
feuille d'un module chargé à la demande.

**Une règle de mouvement réduit dans une feuille chargée à la demande ne
s'applique qu'à sa page.** La veilleuse de la bourse, coupée dans la feuille du
Comptoir, continuait de battre sur les cinq autres pages.

**Une même feuille de style en deux exemplaires est le même piège que deux
variables.** Le projet portait `CHARTE.md` et `docs/charte-graphique.md`, déjà
divergents. Il n'en reste qu'un.

**Une accolade orpheline avale la règle suivante, sans un mot.** Une réécriture
de bloc a laissé un `}` en trop au niveau supérieur de `site.css`. Le navigateur
récupère l'erreur en consommant tout jusqu'au prochain bloc — c'est-à-dire la
règle d'après, qui disparaît. Aucun message, aucune ligne barrée dans l'onglet
des styles : simplement une règle qui ne s'applique pas. Après toute chirurgie
sur une feuille, compter les accolades.

**Un pourcentage de hauteur se résout contre la rangée, pas contre la boîte.**
La vignette d'un booster est une grille à rangée automatique. `height: 100%` sur
l'image s'y résolvait donc en `auto` : l'image reprenait sa taille intrinsèque,
bornée par `max-width`, et débordait de quatre-vingt-seize pixels
qu'`overflow: hidden` coupait net — le bas du sachet, avec son bandeau
« 5 cartes par booster », disparaissait. En flex, le pourcentage se résout contre
la hauteur définie du conteneur.

**Une animation gardée derrière `prefers-reduced-motion` disparaît sans dire
pourquoi.** Sur un site où l'animation porte l'information, la préférence du
système ne peut pas avoir le dernier mot. Le garde est un attribut de la racine,
réglable, et son effet est annoncé là où il se voit. Suivre le système a été le
défaut ; il ne l'est plus depuis septembre 2026 : Windows réduit les effets
visuels sur bien des postes sans que leur utilisateur l'ait demandé, et
l'ouverture des boosters se trouvait vidée chez eux. Le défaut est « Toujours
animer », et le choix reste dans le profil.

---

### Un module ne pose pas son propre fond

Une section d'une page n'a pas de fond à elle. Le module de la mine peignait un
`--ground` opaque et deux dégradés radiaux par-dessus celui de la page : trois
couches pour reproduire, à un ton près, ce qui était déjà là — et ce ton d'écart
se voyait comme une couture, un rectangle plus clair posé sur la page. Un module
autonome hérite du fond ; il peint la lumière qu'il produit (un fanal, une lueur
de vente), pas le noir sur lequel elle porte.

### Une image qu'on vient d'afficher ne s'anime pas en transformation

La loupe faisait surgir la carte d'un `scale(.9)`. Pendant une animation de
transformation, le navigateur dessine l'élément à sa position exacte,
fractionnaire ; à la fin, il le recale au pixel entier. Centrée dans une
largeur quelconque, la carte tombait sur un demi-pixel, et le portrait sautait
visiblement vers la droite à l'instant où l'animation s'achevait. Pour une
apparition, un fondu d'opacité suffit et ne déplace rien.

### Une interface de jeu ne change pas de taille pendant qu'on joue

Une mise en page dimensionnée par son contenu grandit au moment exact où le
joueur regarde ailleurs : il achète, et la page bouge sous le curseur. Les blocs
d'un module de jeu reçoivent leur hauteur de la fenêtre (`height: clamp(...)`,
`align-items: stretch`), le contenu défile à l'intérieur, et **toute zone qui
n'apparaît qu'à partir d'un certain état est rendue dès le début, vide, à sa
hauteur définitive** — avec une ligne qui dit ce qui l'occupera. Attention au
`box-sizing: border-box` en réservant : le filet compte dans le `min-height`.
Même règle pour les panneaux d'aide, qui s'ouvrent en surimpression et jamais
dans le flux.

### Une liste ne garde que ce sur quoi il reste à décider

Un catalogue d'achats qui conserve ses lignes acquises grossit sans fin et
repousse hors de l'écran les deux qui demandent encore un choix. Ce qui est
acquis sort de la liste et va se ranger là où on en fait l'inventaire — ici la
rangée de jetons de l'en-tête — avec l'information qui l'accompagnait, en
infobulle. Ce qui n'est pas encore accessible reste visible, à part et en
sourdine, mais seulement à partir du moment où l'atteindre devient une décision :
une liste d'objectifs lointains est du bruit, un objectif à mi-chemin est un but.

Une infobulle de survol attend **une seconde** : un curseur de passage traverse
six éléments sans vouloir en lire aucun. Au clavier elle est immédiate — tabuler
jusqu'à un élément est délibéré. Et elle sort hors flux, d'un parent qui ne
défile pas, sinon elle se fait rogner par le conteneur qu'elle documente.

### Un composant ne se définit pas dans le corps d'un rendu

Il change d'identité à chaque image. Sur une page ordinaire cela passe inaperçu ;
dans une boucle de jeu qui rend neuf fois par seconde, React démonte et remonte
tout le sous-arbre à chaque tour — le focus saute, un survol n'atteint jamais son
délai, les images repartent en chargement. Une fonction qui renvoie du JSX
produit des éléments d'un type stable, que React réconcilie.

### Une récompense aléatoire s'annonce avant, pas après

Un tirage qui se joue au moment de la récompense est invisible : le joueur voit
un gain sans cause, et le talent qui gouverne la fréquence de ces gains ne se
voit nulle part. Le tirage se fait à la naissance de l'objet, qui porte alors sa
nature — ici la couleur de la roche — et la probabilité reste identique au
millième près. Ce qui change est qu'on peut réagir.

Trois états doivent se distinguer par **trois signaux différents**, pas par trois
intensités du même : deux rouges voisins ne se séparent pas d'un coup d'œil. Ici
c'est la roche qui se teinte, puis les éclats qui s'allument, puis le halo qui
respire. Et la couleur est toujours doublée d'un mot écrit — une teinte seule ne
dit rien à qui les distingue mal.

Une **variable CSS unique** porte la teinte (`--kz-teinte`), posée par le
composant à partir de l'état du jeu ; toutes les couleurs du bloc en dérivent en
`hsl()`. Une ligne de JavaScript déplace alors l'ensemble de la famille — pierre,
lueur, halo, bordure, cartouche — au lieu de dix déclarations à tenir en accord.

### Une barre fixe dans une colonne flex doit refuser de rétrécir

Le défaut d'un enfant de flex est `flex-shrink: 1`. Une rangée d'onglets, un
en-tête, un pied : tout ce qui doit garder sa hauteur dans une colonne flex dont
un enfant déborde le déclare (`flex: 0 0 auto`), faute de quoi il se fait
comprimer puis rogner par l'`overflow` du conteneur — on lit la moitié basse des
libellés et aucune règle n'a échoué. C'est le quatrième échec silencieux du
projet, avec le sélecteur orphelin, le `[hidden]` battu par une classe et le
`z-index` passé sous une couche.

### Un mot d'ambiance qui porte une mécanique se définit quelque part

Un jeu a le droit d'avoir son vocabulaire — « le filon cède » dit ce que « le
compteur atteint zéro » ne dit pas. La contrepartie est double : le mot doit
tenir en une phrase de définition, et cette phrase doit être accessible depuis
l'écran où le mot s'affiche (un lexique, qui ne montre que les mots déjà
rencontrés). Ce qui n'est pas du vocabulaire mais de la **formule recopiée** —
« une frappe vaut 0,12 s de production de plus par point » est la définition
exacte d'une fonction du code — n'a rien à faire dans l'interface : on écrit ce
que la chose fait, pas comment elle est calculée.

### Ce qui ne sert pas encore ne s'affiche pas encore

Cinq onglets dont quatre sont inertes, c'est un tableau de bord d'usine pour un
seul geste possible. Chaque zone s'ouvre au moment où elle devient utile, dans
l'ordre de l'apprentissage, et le prédicat lit l'état courant plutôt qu'un champ
sauvegardé — une partie ancienne retrouve tout au chargement. Une zone qui vient
de s'ouvrir se signale une fois (un point, une annonce vocale) et se tait dès
qu'on l'a regardée.

## 9. Règles d'écriture

Pas de tiret cadratin, banni du projet. Le séparateur de la ligne de repères est
une barre verticale, posée par CSS (`--sep`) et non écrite dans le texte : à
2,75 cqw, elle se distingue des lettres là où un point médian se perdrait dans
les empattements.

Une citation tient sur deux lignes de carte, soit environ **90 caractères**.
Au-delà, elle est tronquée sur la carte et reste entière en plein écran.

Vocabulaire arrêté : une **carte**, jamais un jeton. Un **sachet** est
l'emballage physique qu'on déchire ; un **booster** est le produit. Une
**extension** est un set de cartes.

La version brillante d'une carte s'appelle **rainbow**, partout et sans
exception : à l'écran, dans le code (`version: "rainbow"`, `traits.rainbow`,
`.marque-rainbow`, l'affaire `lustrage` du colporteur) et dans la documentation.
Le mot **irisation** ne désigne plus que l'effet optique qui la produit — la
couche `.iris` de `cards.css` — jamais la version elle-même. Ce nettoyage a été
fait après coup, et il a laissé une leçon : renommer une classe CSS sans passer
la feuille au peigne fin laisse des sélecteurs orphelins qui n'échouent pas, ils
se taisent (voir § 8).

Une **case** n'est pas une carte. Une carte a deux cases, normale et rainbow, et
la bibliothèque les compte séparément : « 314 cases · 226 cartes du set et 88
rainbow ». Tout chiffre qui parle de complétion — l'avancement, les barres de
palier, la pastille de navigation — compte les **cases normales remplies**, hors
PJ. Un seul critère, pour que deux coins du même écran ne racontent pas deux
histoires.
