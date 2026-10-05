# Brief : refonte du Comptoir

**Projet** : La Brume de Thalazur, page `#/comptoir` (marché de l'occasion).
**Demandé par** : Clément, 05/10/2026.
**Pour** : Claude Design.
**Pièces jointes** : le dossier `brief-comptoir/` (liste au § 9) et la vidéo
du Comptoir actuel (`comptoir-actuel.mp4`, 37 s).
**À lire avec** : `docs/audit-comptoir.md` (constats chiffrés) et
`docs/charte-graphique.md` (règles visuelles, qui priment sur ce brief).

---

## 1. Le site en deux phrases

Un jeu de cartes à collectionner tiré d'une campagne de Donjons et Dragons :
on ouvre des boosters, on complète une collection de 220 cartes (PNJ, Lieux,
Artéfacts, quatre raretés plus les full art), on joue aux Mines, au Donjon et
aux Expéditions. Tout est en français, sombre, et les cartes sont la seule
lumière de l'écran.

## 2. Le besoin

Le Comptoir est l'endroit où l'on revend ses doublons à des personnages qui
passent chaque jour, et où l'on achète quelques cartes à l'unité. Il a été
conçu quand les joueurs avaient vingt doublons. Un joueur avancé en a
aujourd'hui **884**, et la page paraît **fade** :

- le premier écran n'est fait que de trois grands portraits ; on ne peut rien
  décider sans défiler ;
- **aucune carte n'est montrée** : partout un dos générique, y compris dans
  la fenêtre de négoce ;
- la vente se fait carte par carte, dans une fenêtre, à partir d'un tableau
  de 60 lignes dont une sur deux dit « aucun acheteur / Attendre » ;
- les acheteurs sont des affiches figées : une réplique, aucune réaction.

Il faut une page qui donne l'impression d'**entrer dans une échoppe de quai
la nuit**, où l'on rencontre trois personnages et où l'on étale son ballot de
cartes sur le comptoir.

## 3. Le principe : une scène, puis un ballot

De haut en bas :

1. **Bandeau du jour** (une ligne, deux au téléphone).
2. **La scène** : les acheteurs du jour, debout derrière le comptoir.
3. **Le ballot** : vos cartes en trop, regroupées par preneur, avec une
   barre de comptoir qui récapitule la sélection.
4. **Le rayon** : ce que l'échoppe vend aujourd'hui.

Puis, par-dessus, **la fenêtre de négoce** quand on veut travailler une carte.

## 4. Écrans à produire

Deux largeurs pour chaque écran : **bureau 1 440 px** et **téléphone
390 × 844 px** (portrait). Prototype HTML cliquable apprécié, avec les états
listés.

### 4.1 Bandeau du jour

Contenu, dans cet ordre de lecture :

- « Le Comptoir » (titre) et la date (« lundi 05/10/2026 ») ;
- **la gazette du quai** : une phrase d'évènement, par ex. « Une caravane de
  Säab est arrivée au port : les cartes de Säab se paient mieux
  aujourd'hui. » ;
- la bourse du Comptoir (« 18 200 PO en caisse ») ;
- **demain** : la vignette ronde de l'acheteur qui arrivera, son nom, sans
  bouton à déplier.

Pas de bandeau d'avis qui s'insère et pousse la page : les confirmations de
vente se font dans la barre de comptoir (§ 4.3) et par l'animation des
pièces.

### 4.2 La scène des acheteurs

Trois acheteurs, parfois quatre (le Conservateur Royal, exceptionnel, un
jour sur dix). Ce sont des **découpes à fond transparent** (§ 6) posées sur
une planche de comptoir, à taille moyenne : environ 280 px de haut au
bureau. Toute la scène doit tenir dans le premier écran avec le bandeau, et
laisser voir le haut du ballot.

Pour chaque acheteur :

- nom, métier (« Dame Sorelle, noble collectionneuse ») ;
- une **bulle** courte au-dessus de lui, sa voix : sa **commande du jour**
  (« Trois PNJ de Nakova, je paie le lot 30 % de mieux ») ;
- ce qu'il veut de vous : « 16 de vos cartes l'intéressent, jusqu'à
  612 PO » ;
- sa **réputation** : cinq rangs (pastilles ou marques gravées), le rang
  courant visible ;
- action : « Lui proposer ».

États à montrer :

| État | Rendu attendu |
|---|---|
| Intéressé | au premier plan, bulle et chiffres |
| Commande remplissable | la commande signalée (un seul signal, pas d'aplat chaud) |
| Sans intérêt pour vos cartes | en retrait, plus petit, désaturé ; sa bulle dit pourquoi (« Rien de martial dans votre ballot. ») |
| Le Conservateur présent | place d'honneur, sceau « Exceptionnel » |
| Après une vente | réplique de remerciement, expression satisfaite |

Au téléphone : les trois acheteurs en rangée horizontale serrée (vignettes
d'environ 96 px, visage), la bulle passe sous la rangée et suit l'acheteur
touché. Pas de carrousel.

### 4.3 Le ballot

Les cartes en trop du joueur, en **vraies vignettes de carte** (voir
`FaceCarte.jsx`, mode vignette), avec un compteur « ×5 » sur la carte.

Regroupement par **meilleur preneur du jour** :

- « Pour Dame Sorelle : 16 cartes, 612 PO », bouton « Tout lui vendre » ;
- un groupe par acheteur présent ;
- « Sans preneur aujourd'hui : 412 cartes », replié par défaut, avec trois
  sorties : « Vendre à l'échoppe », « Dissoudre au Reliquaire (2 060
  vestiges) », « Attendre demain (Hector arrive) ».

Outils au-dessus des groupes : filtres palier, type (PNJ, Lieu, Artéfact),
faction ; tri par valeur ou par nom ; champ de recherche. Les rainbow
portent leur marque et la mention « sert au Donjon (étoiles) ».

**Sélection multiple** : toucher une carte la sélectionne, une **barre de
comptoir** se fixe en bas de l'écran : « 12 cartes sélectionnées, à Dame
Sorelle, 486 PO » et le bouton « Conclure ». Après la vente, des pièces
filent de la barre vers la bourse du bandeau du site et la barre affiche
« +486 PO » une seconde.

À 884 exemplaires, la grille doit rester fluide : prévoir l'affichage par
groupes repliables, pas de liste infinie à plat.

### 4.4 Le rayon du jour

Six cartes que l'échoppe vend, en vraies cartes. Les cartes **manquantes**
portent la marque « Manquante » et passent devant ; une **pièce du jour** est
plus grande que les autres. Prix sous la carte, bouton d'achat ; trop cher :
bouton éteint et « il manque 26 PO ».

Au bureau, le rayon peut se tenir à droite du ballot ou au-dessus ; au
téléphone, une rangée de six qui défile à l'horizontale avec un bord visible.

### 4.5 La fenêtre de négoce

On y arrive par « Lui proposer » ou par une carte du ballot. Garder ses
trois zones (voir la charte, « Trois zones, pas sept boîtes ») et la règle
de hauteur fixée par le portrait, mais :

- **la carte est montrée** en vignette réelle, entre l'acheteur et les
  chiffres ;
- les chiffres : son offre, le prix de l'échoppe (« L'échoppe paie »), la
  quantité ;
- le marchandage n'est plus un bouton unique mais **trois manières de
  présenter la carte** : « Le prix ferme », « L'histoire de la carte »,
  « Sa rareté ». La réplique de l'acheteur donne un indice sur celle qu'il
  préfère. Un essai par carte et par jour ;
- issue : l'offre éclate en vert ou tressaille en ambre brûlé (existant),
  la réplique change, l'expression du portrait aussi ;
- si l'offre tombe sous l'échoppe, le bouton principal devient « Vendre à
  l'échoppe ».

États : avant marchandage, pesée (une demi-seconde, « Il réfléchit… »),
réussite, échec, vente conclue.

### 4.6 La navigation

Aujourd'hui l'onglet porte le badge « Comptoir 884 ». À remplacer par un
**point** discret quand une commande est remplissable ou que le Conservateur
passe. Montrer l'onglet dans les deux états.

## 5. Contenu réel pour la maquette

Acheteurs (portraits joints) : Lise, Hector, Maîtresse Oriane, Dame Sorelle,
Gaspard, Ysée, Nassim, Éloi, Voren, et le Conservateur Royal. Pour la
maquette, le trio du jour : **Dame Sorelle, Nassim, Voren**.

| Acheteur | Métier | Réplique actuelle |
|---|---|---|
| Dame Sorelle | Noble collectionneuse | « L'exceptionnel m'intéresse toujours. » |
| Nassim | Marchand étranger | « Chaque province a ses trésors. Il suffit de savoir lesquels. » |
| Voren | Spéculateur | « Je n'achète pas une carte. J'achète ce qu'elle vaudra demain. » |
| Hector (demain) | Vétéran de la garde | « Une bonne carte doit être aussi fiable qu'une bonne lame. » |

Cartes (illustrations jointes, numéro du roster) :

| N° | Carte | Rareté | Repères |
|---|---|---|---|
| 003 | Brazûk ai Kazûk (rainbow) | Commune | Spécialité, Säab |
| 044 | Milicien d'Éklénor (rainbow) | Commune | Guerrier, Demi-orc, Säab |
| 037 | Carlin Beren | Commune | Lancier, Gnome, Troupe |
| 077 | Bram Deux-Prises | Commune | Artisan, Nain, Nakova |
| 103 | Batelier de la Nanmasse | Commune | Marin, Tieffelin, Pronolo |
| 114 | Médaille de dompteur d'auroch | Peu commune | Emblème, Cornalie |
| 137 | Chef Gnoll des marais | Peu commune | Créature, Humanoïde, Bestiaire |
| 180 | Prison Secrète | Rare | Cornalie, Camp côtier |
| 190 | Dénatar, Gardien du désert | Rare | Prince, Dragon noir, Cornalie |
| 209 | Sethi | Rare | Porteur, Humain, Troupe |

Ordres de grandeur : un booster coûte 120 PO ; une commune se rachète 2 à
6 PO à l'échoppe, une rare 20 à 40 PO, une rainbow commune 40 à 65 PO. Le
joueur a 101 PO en poche. **Tous les prix en PO entières**, séparateur de
milliers par espace fine (« 3 984 PO »).

## 6. Contraintes visuelles (la charte fait foi)

- **Palette** : `tokens.css` joint. Sol froid (`--ground` `#0d1417`,
  `--panel` `#1a272c`), une seule lumière chaude, la lampe `--lamp`
  `#e8a33d`, réservée aux prix et aux états actifs. Ne pas créer de nouvelle
  surface chaude : la seule autorisée est la case du colporteur Mirko, ailleurs.
- **Rareté en texte** : les encres de `teintes.js`, pas les teintes de cadre
  (contraste 4,5:1 vérifié). Rainbow : `--m-rainbow` `#9d7cf0` et la marque ✦.
- **Typographie** : Fraunces (axe `WONK`) pour les titres et noms de carte,
  Archivo pour tout le reste, chiffres en `tabular-nums`. **Aucune
  monospace. Aucune capitale espacée.**
- **Portraits** : découpes détourées posées sur l'interface,
  `object-fit: contain`, ancrées en bas, ombre en `drop-shadow`, lueur de
  lampe derrière, fondu de 7 % au bas de l'image. Jamais de vignette
  photographique rognée (la charte raconte trois échecs à ce sujet).
- **Cartes** : proportions et cadre de `carte-cadre.webp` ; les tailles
  dérivent de `--carte-petit` ; typographie de carte en `cqw`.
- **Stabilité** : rien ne change de taille pendant qu'on joue ; places
  réservées pour les verdicts et la barre de comptoir.
- **Accessibilité** : bordure d'élément actionnable `--edge-ui` (3:1), cibles
  tactiles de 44 px, focus visible, fenêtre de négoce en dialogue modal,
  `prefers-reduced-motion` respecté (les pièces ne volent pas, le total
  s'affiche).
- **Écriture** : vocabulaire « booster » et « rainbow » (jamais « sachet »
  ni « irisé ») ; **pas de tiret cadratin** ; phrases courtes, à la voix des
  personnages pour les bulles.
- Aucune police, image ou script chargé depuis un domaine tiers.

## 7. Ce qu'il ne faut pas faire

- Pas d'onglets « Vendre / Acheter » qui sépareraient la scène du ballot.
- Pas de tableau à colonnes répétées : le ballot se lit en cartes.
- Pas de fond crème, d'accent turquoise, de micro-libellés : la signature
  par défaut abandonnée par le projet (charte, chap. 1).
- Pas de chiffre géant couleur lampe pour la vente rapide : elle devient une
  sortie parmi d'autres du groupe « Sans preneur ».

## 8. Livrables attendus

1. Maquettes bureau et téléphone de la page entière, avec les états des § 4.2
   à 4.6.
2. La fenêtre de négoce dans ses cinq états.
3. Un prototype HTML cliquable si possible (sélection dans le ballot, barre
   de comptoir, négoce, animation des pièces).
4. Une courte note des jetons ajoutés (le cas échéant) et des dimensions,
   dans le vocabulaire de la charte, pour l'intégration dans le code.
5. La liste des images à produire (expressions des acheteurs, planche de
   comptoir, fond de quai), avec leur ratio, pour génération dans Sora.

## 9. Pièces jointes (dossier `brief-comptoir/`)

| Fichier | Pour quoi |
|---|---|
| `comptoir-actuel.mp4` | La page telle qu'elle est |
| `audit-comptoir.md` | Les constats chiffrés |
| `charte-graphique.md` | Les règles visuelles du site |
| `tokens.css` | Couleurs, polices, dimensions |
| `comptoir.css`, `site.css` | Styles actuels de la page et du site |
| `PageComptoir.jsx`, `Negoce.jsx` | Structure actuelle de la page et du négoce |
| `acheteurs.js` | Les dix acheteurs : noms, répliques, goûts |
| `teintes.js` | Encres de rareté vérifiées |
| `FaceCarte.jsx`, `cards.css` | Le rendu d'une carte et de sa vignette |
| `carte-cadre.webp`, `carte-dos.webp` | Cadre et dos de carte |
| `portraits/*.webp` | Les onze portraits détourés des acheteurs |
| `cartes/*.png` | Les dix illustrations du § 5 |
