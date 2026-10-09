# Brief : les Succès, un grimoire

**Projet** : La Brume de Thalazur, page `#/succes`.
**Demandé par** : Clément, 09/10/2026.
**Pour** : Claude Design.
**Pièces jointes** : le dossier `brief-succes/` (liste au § 14), dont les
captures de la page actuelle et le contenu réel d'une partie.
**À lire avec** : `charte-graphique.md` (règles visuelles, qui priment sur ce
brief) et `succes-et-classement.md` (la mécanique).

---

## 1. Le site en deux phrases

Un jeu de cartes à collectionner tiré d'une campagne de Donjons et Dragons :
on ouvre des boosters, on complète une collection de 220 cartes (PNJ, Lieux,
Artéfacts, quatre raretés plus les full art), on joue aux Mines, au Donjon,
aux Expéditions, on vend au Comptoir. Tout est en français, sombre, et les
cartes sont la seule lumière de l'écran.

## 2. Les succès

La page existe et fonctionne (captures `succes-actuel-*.png`). Le barème
vient d'être refait (09/10/2026) ; c'est la **page** qu'il faut concevoir.

- **124 paliers aujourd'hui**, rangés en **familles** (« Déchireur de
  boosters », « Les gardiens », « Rainbow »…). Une famille mesure une seule
  chose (boosters ouverts, gardiens vaincus…) et porte trois à six paliers de
  plus en plus durs : 25, 100, 300, 1 000, 2 500 boosters.
- Les familles sont rangées en **chapitres** : huit pour tout le site, puis
  **un par extension ouverte** (aujourd'hui La Troupe ; trois autres
  viendront, chacune avec son chapitre) :

  | Chapitre | Familles | Paliers |
  |---|---|---:|
  | La Boutique | boosters ouverts, cartes PJ | 8 |
  | Les Mines de Kazim | strate, effondrements, commandes de Tafix, faveurs du Fossoyeur | 17 |
  | Le Donjon | gardiens, donjon du jour mené au bout, record de l'infini | 13 |
  | Les Routes | expéditions, Lieux passés en rainbow | 9 |
  | Le Négoce | ventes, achats au Comptoir, affaires de Mirko | 12 |
  | Le Reliquaire | dissolutions, forges | 9 |
  | Les Missions | missions du jour, missions de la semaine | 9 |
  | Les Cartes | niveau le plus haut, rainbow par l'expérience, centenaires | 12 |
  | La Troupe | complétion, types, légendaires, rainbow, pleine illustration, sept provinces | 35 |

- Un palier atteint se **réclame** (un par un, ou « Tout réclamer ») et paie
  des **PO**, des **boosters offerts** (au choix, ou de l'extension pour un
  chapitre d'extension), parfois un **titre** (« Pourfendeur de gardiens »)
  que le joueur affiche sous son pseudo au classement.
- Chaque palier vaut des **points de renommée** (5 à 200) ; leur somme est
  une mesure de la progression du joueur, qui servira au classement.
- Trois paliers sont des **exploits cachés** : ni leur seuil ni leur
  récompense ne se voient avant d'être atteints (cartes PJ, full art, douze
  gardiens en une descente).
- La navigation porte une **pastille** : le nombre de paliers à réclamer.
- L'onglet voisin, **Classement**, reste à côté du grimoire ; sa refonte
  fera l'objet d'un brief suivant. Prévoir seulement le passage de l'un à
  l'autre.

On ne passe pas tous les jours sur cette page : on y vient **quand la
pastille s'allume**, pour réclamer, et de temps en temps pour mesurer le
chemin. Elle doit donner envie de **feuilleter**, et rendre réclamer
solennel sans le rendre lent.

## 3. Le principe : un grimoire

C'est l'idée de Clément, à pousser : **un grimoire ouvert, avec un sommaire,
et chaque catégorie de succès dans un chapitre.**

- **Le sommaire** : la première double page. Un chapitre par ligne, avec son
  pictogramme, son avancement (« 9 / 17 », un fin trait d'encre qui se
  remplit), et un **signet** ou un **sceau en attente** s'il porte des paliers
  à réclamer. Toucher un chapitre y mène (la page tourne).
- **L'ex-libris**, en regard du sommaire : le pseudo, le titre affiché, la
  renommée (« 345 / 3 995 »), les boosters offerts en attente, et le lien
  « Tout réclamer » quand il y a lieu. C'est le seul endroit où le joueur
  **choisit son titre** (aujourd'hui caché dans le profil) : à proposer.
- **Un chapitre** : une enluminure de titre, puis ses familles. Une famille
  n'est **pas une liste de phrases** : c'est une ligne de **paliers en
  médaillons** sur un chemin d'encre (le seuil dans le médaillon, « 300 »),
  avec la valeur courante (« 168 »). La phrase complète, la récompense et le
  titre se lisent **au toucher** d'un médaillon (une note en marge, pas une
  fenêtre). Un palier réclamé porte le sceau ; un palier prêt luit (lampe) ;
  un palier lointain reste à l'encre pâle.
- **Les chapitres longs** (une extension : 35 paliers) **tournent sur
  plusieurs pages**, numérotées. Une famille terminée se replie en une ligne
  (« Revenir d'en bas · complète »), selon la règle de la charte : *une liste
  ne garde que ce sur quoi il reste à décider*.
- **Les exploits cachés** : une tache d'encre, ou une écriture effacée, qui
  se révèle le jour où le palier est atteint.
- **Le livre est dans une scène** : posé sur un lutrin ou une table, sous la
  lampe du camp, comme Bodégué derrière sa table (voir
  `reference-missions-bureau.png`, la dernière page refaite). Pas un livre
  flottant dans le vide.

**Les pages sont sombres.** La charte proscrit le fond crème (§ 1, « Ce qu'il
faut éviter »), et l'effet rainbow des cartes ne vit que sur fond sombre.
Référence : les **livres d'heures noirs** (Heures noires de Bruges, vers
1475), vélin teint de noir, écriture d'argent et d'or. Vélin nuit, encre
claire (`--ink`), or réservé à la lampe.

**Tenue à l'écran** : maquettes à **1 440 × 900** et **1 280 × 720** ; aucune
barre de défilement au bureau dès 1 024 × 680, une double page tient
l'écran. Au téléphone **390 × 844** : une page à la fois (le sommaire, puis
une page par chapitre), on tourne d'un balayage ou par les flèches, la
barre de navigation basse ne masque rien.

## 4. Ce qui ne va pas dans la page actuelle (voir les captures)

1. **Un mur de texte** : environ **1 770 mots** au total, chaque palier
   écrit en toutes lettres (« Ouvrir 1000 boosters, toutes extensions
   confondues »), cinq fois par famille.
2. **Aucune hiérarchie** : neuf chapitres en enfilade, il faut faire défiler
   des mètres pour trouver les Mines ; rien ne dit où réclamer.
3. **Réclamer n'a pas de moment** : le bouton devient une coche, les PO et les
   boosters arrivent sans qu'on les voie.
4. **Les titres** se perdent en italique au fond des lignes.
5. **Au téléphone**, une famille de cinq paliers fait trois écrans.

## 5. Les écrans et états à produire

| # | État | Ce qu'on voit |
|---|---|---|
| E1 | Débutant | Sommaire presque vierge : 4 paliers réclamés sur 124, aucun à réclamer ; les chapitres des modules pas encore ouverts (Reliquaire scellé avant 60 % de collection) restent lisibles mais en sourdine. |
| E2 | Milieu de partie | Le contenu de `contenu-exemple.json` : 43 réclamés, 3 à réclamer (Mines, La Troupe ×2), renommée 345. Le sommaire dit **où** sont les trois. |
| E3 | Un chapitre court | Les Mines de Kazim : quatre familles, une avec un palier prêt. |
| E4 | Un chapitre long | La Troupe sur deux ou trois pages, familles terminées repliées, sept provinces. |
| E5 | Le détail d'un palier | La note en marge : phrase, récompense, titre, points, et l'état. |
| E6 | Réclamer | L'animation du § 6.1, sur un palier qui paie des PO, puis sur un qui paie des boosters et un titre. |
| E7 | Tout réclamer | Depuis l'ex-libris : les trois sceaux tombent l'un après l'autre (§ 6.2). |
| E8 | Exploit révélé | Un palier caché atteint : l'encre apparaît, puis il se réclame comme les autres. |
| E9 | Chapitre achevé | Tous les paliers d'un chapitre réclamés : ce que devient sa page et sa ligne du sommaire. |
| E10 | Choisir son titre | Depuis l'ex-libris, parmi les titres gagnés (six dans l'exemple). |

Montrer aussi **l'entrée de navigation** « Succès » avec sa pastille, et le
passage vers l'onglet Classement.

## 6. Les animations (en code)

**Tout en code, aucune image animée.** CSS (`@keyframes`, variables), SVG ou
`<canvas>`, éventuellement l'API Web Animations, sans bibliothèque ni
ressource tierce. N'animer que `transform`, `opacity` et `filter`. Le code
livré doit pouvoir être repris tel quel dans le site (React, une feuille CSS).

### 6.1 Réclamer (le moment de la page)

1. Le sceau de cire tombe sur le médaillon (≈ 250 ms) — le **même langage**
   que les billets des Missions (`missions.css`, `.msn-sceau`).
2. Les pièces filent vers la **bourse du bandeau**, 8 au plus, et le chiffre
   compte jusqu'à sa nouvelle valeur ; des boosters offerts : leurs dos
   (`carte-dos.webp`) filent vers l'entrée « Boutique ».
3. Un titre gagné se déroule en ruban sous le médaillon, une fois.
4. La renommée de l'ex-libris et l'avancement du chapitre au sommaire
   montent.

Moins de 1,2 s par palier. Un toucher passe à l'état final.

### 6.2 Tout réclamer

Les sceaux tombent en cascade (≈ 120 ms d'écart), les gains se **cumulent**
en un seul vol de pièces et de boosters. Plafond : 2 s, quel que soit le
nombre de paliers. Si les paliers sont dans plusieurs chapitres, le dire
sans tourner toutes les pages.

### 6.3 Tourner la page

Du sommaire vers un chapitre, d'une page à la suivante : ≈ 400 ms, un
mouvement de page plausible mais sobre (pas de 3D lourde). Au clavier, les
flèches tournent ; l'adresse suit le chapitre (`#/succes/mines`) pour que le
retour du navigateur ramène au sommaire.

### 6.4 Mouvement réduit

Réglage « moins d'animations » du profil : rien ne bouge, les pages
changent sans transition, tout est posé à sa place finale, les gains
annoncés aux lecteurs d'écran (`aria-live`).

### 6.5 Repères pour le son (facultatif)

Le site a un moteur de sons (`src/son/`). Indiquer les instants où un son se
poserait : page tournée, sceau, pièces, boosters, titre.

## 7. Le texte : montrer plutôt que dire

Même règle que les refontes du Donjon, du Reliquaire et des Missions :

- **Un joueur ne lit pas, il reconnaît** : pictogramme du chapitre, seuil
  dans le médaillon, « 168 », « 60 PO », « 3 boosters ». La phrase du palier
  vit dans la note en marge.
- **Une information, un seul endroit.**
- **Budget** : le sommaire et l'ex-libris **50 mots** au plus ; une double
  page de chapitre **80 mots** au plus hors note en marge. La page actuelle
  en affiche 1 770.

## 8. Contenu réel pour la maquette

`contenu-exemple.json` : la partie d'un joueur régulier à la troisième
semaine (pseudo « Brindille », titre « Pourfendeur de gardiens »), telle que
le site la calcule — chapitres, familles, valeur courante, et pour chaque
palier sa phrase, son seuil, sa récompense, son titre, ses points et son
état (`réclamé`, `à réclamer`, `verrouillé`). Les exploits cachés y figurent
sans phrase ni seuil, comme le joueur les voit.

Vocabulaire des récompenses : « 60 PO », « 1 booster au choix »,
« 3 boosters de La Troupe ». Nombres entiers, séparateur de milliers par
espace fine.

Les noms des titres et des provinces sont **provisoires** (Clément les
remplacera par ceux de la campagne) : prévoir des titres de 8 à 32 signes.

## 9. Contraintes visuelles (la charte fait foi)

- **Palette** : `tokens.css` joint. Sol froid (`--ground` `#0d1417`,
  `--panel` `#1a272c`), une seule lumière chaude, la lampe `--lamp`
  `#e8a33d`, réservée aux récompenses et aux états actifs (palier prêt,
  sceau qui tombe, « Tout réclamer »). Les **chapitres d'extension** peuvent
  prendre une nuance de l'extension, jamais une seconde lumière. Les
  rainbow et la renommée totale peuvent prendre l'accent `--m-rainbow`
  `#9d7cf0`.
- **Typographie** : Fraunces (axe `WONK`) pour les titres, les chapitres, les
  lettrines et les titres gagnés ; Archivo pour le reste, chiffres en
  `tabular-nums`. Aucune monospace, aucune capitale espacée — pas de faux
  gothique non plus.
- **Stabilité** : rien ne change de taille quand un palier se remplit ou se
  réclame ; places réservées pour le sceau, la note en marge, le ruban.
- **Accessibilité** : cibles de 44 px (un médaillon aussi), focus visible,
  bordure d'élément actionnable `--edge-ui` (3:1), avancements en
  `role="progressbar"`, gains annoncés en `aria-live`, contraste de l'encre
  sur le vélin ≥ 4,5:1 mesuré sur l'image réelle, pas sur la couleur
  moyenne.
- **Écriture** : « booster », « rainbow » (jamais « sachet », « irisé ») ;
  pas de tiret cadratin ; le moins de mots possible (§ 7).
- **Icônes** : tracés SVG de `Icone.jsx` (grille de 20, trait 1,6,
  `currentColor`) pour les chapitres : `boutique`, `mines`, `donjon`,
  `expeditions`, `comptoir`, `reliquaire`, `missions`, `xp`, `cartes`. Le
  pictogramme `succes` de la navigation peut devenir un livre fermé.
- Aucune police, image ou script chargé depuis un domaine tiers.

## 10. Ce qu'il ne faut pas faire

- Pas de fond crème, pas de parchemin clair, pas de papier jauni en surface
  de texte.
- Pas de livre posé dans le vide ; pas de 3D lourde pour tourner les pages.
- Pas de liste de phrases ; pas de tableau ; pas de cases à cocher.
- Pas de fenêtre modale pour réclamer ni pour lire un palier ; pas d'écran de
  victoire.
- Pas d'image générée pour une animation (planche, GIF, vidéo).
- Pas de phrase là où un chiffre ou un pictogramme suffit.

## 11. Ce que le code fournira

Le composant recevra, déjà calculés (`src/succes/regles.js`, `evaluer`) :
les chapitres (`CATALOGUE.chapitres`, puis les extensions), leurs familles
(`nom`, `valeur`, `chapitre`), et pour chaque palier `id`, `quoi`, `seuil`,
`recompense`, `titre`, `points`, `cache`, `atteint`, `reclame`. Il appellera
`reclamer(ids)`. Le maquettiste n'a pas à inventer de données : tout ce qu'il
montre existe dans `contenu-exemple.json`.

## 12. Livrables attendus

1. Maquettes **bureau 1 440 × 900** et **téléphone 390 × 844** des états E1
   à E10, plus le contrôle à 1 280 × 720, l'entrée de navigation et le
   passage vers le Classement.
2. **Un prototype HTML cliquable** du grimoire, alimenté par
   `contenu-exemple.json`, avec les animations du § 6 **en code** : tourner
   les pages, ouvrir une note en marge, réclamer un palier, tout réclamer,
   révéler un exploit, choisir un titre, et un interrupteur « moins
   d'animations ».
3. Une note courte : jetons ajoutés, dimensions, **chronologie des
   animations en millisecondes** (étape, durée, courbe), dans le vocabulaire
   de la charte.
4. La liste des **images fixes** à produire pour Sora, avec leur ratio : la
   scène (le lutrin ou la table sous la lampe, sans livre ni texte), le
   livre ouvert vide (double page de vélin nuit, sans texte, vue de face
   pour que le code y pose ses pages), au besoin une texture de page seule
   et une reliure fermée. Aucune image d'effet ; ornements, lettrines,
   médaillons et sceaux **en code** (SVG) dès que c'est possible.

## 13. Pour la suite

Le brief du **Classement** suivra : score de renommée, vues par module, et
la **carte préférée** du joueur en fond de sa ligne. Rien à produire ici,
mais garder une place pour la ligne du joueur dans l'ex-libris (rang,
renommée) si elle vient naturellement.

## 14. Pièces jointes (dossier `brief-succes/`)

| Fichier | Pour quoi |
|---|---|
| `BRIEF.md`, `PROMPT.md` | Ce brief, et le message d'envoi |
| `succes-actuel-bureau.png`, `succes-actuel-telephone.png` | La page actuelle, premier écran |
| `succes-actuel-bureau-complet.png`, `succes-actuel-telephone-complet.png` | La page actuelle, en entier |
| `reference-missions-bureau.png` | La dernière page refaite : scène, sceau, langage à reprendre |
| `contenu-exemple.json` | Le contenu réel d'une partie (§ 8) |
| `charte-graphique.md` | Les règles visuelles du site |
| `succes-et-classement.md` | La mécanique des succès |
| `tokens.css`, `base.css`, `app.css`, `succes.css`, `missions.css` | Styles actuels (les Missions pour le sceau) |
| `PageSucces.jsx`, `regles.js`, `succes.js` | La page actuelle, les règles, le barème |
| `Icone.jsx` | Les pictogrammes du site, style à suivre |
| `carte-dos.webp` | Le dos de booster, pour l'animation des boosters offerts |
