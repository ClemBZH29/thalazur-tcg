# Brief : refonte du Reliquaire et animation de forge

**Projet** : La Brume de Thalazur, page `#/reliquaire`.
**Demandé par** : Clément, 06/10/2026.
**Pour** : Claude Design.
**Pièces jointes** : le dossier `brief-reliquaire/` (liste au § 12), dont les
captures de la page avant et après l'allègement du texte.
**À lire avec** : `charte-graphique.md` (règles visuelles, qui priment sur ce
brief) et `expeditions-et-reliquaire.md` (la mécanique, section Reliquaire).

---

## 1. Le site en deux phrases

Un jeu de cartes à collectionner tiré d'une campagne de Donjons et Dragons :
on ouvre des boosters, on complète une collection de 220 cartes (PNJ, Lieux,
Artéfacts, quatre raretés plus les full art), on joue aux Mines, au Donjon et
aux Expéditions. Tout est en français, sombre, et les cartes sont la seule
lumière de l'écran.

## 2. Le Reliquaire et ce qui change

Le Reliquaire est une crypte tenue par un gardien. On y apporte des
**vestiges**, tirés de ses doublons (depuis la bibliothèque), et le gardien
**forge chaque jour une seule carte, la même pour tous les joueurs**.

**Nouveau (06/10/2026, déjà codé)** : la carte du jour se présente **face
cachée**. Le joueur a deux gestes :

- **Forger à l'aveugle** au prix moyen, **100 vestiges**, sans savoir ce qu'il
  obtient. C'est perdant sur une commune (qui vaut 50), juste sur une peu
  commune (100), gagnant sur une rare (250), une légendaire (1 000) ou une
  rainbow (cinq fois le prix).
- **Retourner la carte** : gratuit. On voit la carte et son vrai prix, mais on
  **renonce au prix moyen pour la journée**. On peut alors la forger à son
  prix, ou pas.

Le cœur du jeu est ce dilemme : avec 193 vestiges, une légendaire retournée à
1 000 est hors de portée, la même forgée à l'aveugle coûte 100. Regarder, c'est
perdre son billet. La page doit faire **sentir ce pari**, et la forge à
l'aveugle doit devenir **le moment fort** de la page.

## 3. Ce qui ne va pas aujourd'hui (voir la capture)

1. **Elle ne tient pas sur un écran.** Le bandeau, puis l'étal en dessous, puis
   les règles : à 1 440 × 900, la page fait 1 120 px de haut, 1 474 px au
   téléphone.
2. **Le gardien flotte.** Une découpe détourée posée dans le vide à gauche de
   la carte : pas de sol, pas de lumière derrière lui, la coupe nette du torse
   visible. La charte (§ 7, « Les portraits sont des découpes ») explique
   pourquoi c'est faux.
3. **Trois colonnes inertes.** Gardien, carte, fiche : rien ne relie les trois,
   la crypte du bandeau et la scène de forge sont deux mondes séparés.
4. **Aucune mise en scène de la forge.** Une planche d'images générée (Sora)
   joue par-dessus la page ; la carte ne bouge pas, les vestiges ne vont nulle
   part. **Ces planches sont abandonnées** : les animations du site se font
   désormais en code, par Claude Design (§ 6).

Le texte a déjà été allégé (06/10/2026, captures `reliquaire-allege-*.png`) :
voir § 7. La refonte part de cet état, pas de la capture d'origine.

## 4. Le principe : une seule scène, l'autel

Plus de bandeau ni de paragraphe d'introduction. **La crypte est la page** :
une scène unique, plein cadre, sous la navigation du site.

- **Au centre, l'autel** (ou le reliquaire ouvert) sur lequel repose la carte
  du jour, de dos. C'est le seul point vraiment éclairé de l'écran, avec la
  carte elle-même.
- **Le gardien** se tient derrière l'autel ou à côté, **ancré** : posé sur le
  sol de la scène ou coupé par l'autel au niveau de la taille, la lueur de
  lampe derrière lui, fondu de 7 % au bas de l'image. S'il ne trouve pas sa
  place, le proposer en vignette de dialogue (sa voix porte les textes
  d'ambiance) plutôt que de le laisser flotter.
- **Le panneau de décision**, sobre, à droite au bureau et sous la carte au
  téléphone : la réserve de vestiges, les deux gestes, les chances en
  pastilles, le compte à rebours.
- **Aucun texte d'introduction.** Les règles vivent dans « Comment ça
  marche », replié (ouvert d'office tant que le joueur n'a rien forgé), ou
  dans une bulle « ? » ; le proposer sans qu'il pousse la scène sous le pli.

**Tenue à l'écran** : aucune barre de défilement au bureau dès 1 024 × 680
(palier « Bureau » de la charte), maquettes à **1 440 × 900** et **1 280 ×
720** ; au téléphone **390 × 844**, la carte, le bouton principal et la
réserve tiennent au-dessus de la barre de navigation basse, sans défiler.

## 5. Les états à produire

Libellés : ceux de la page actuelle (§ 7), à reprendre tels quels sauf
meilleure idée **plus courte**.

| # | État | Ce qu'on voit |
|---|---|---|
| E1 | Face cachée, assez de vestiges | Carte de dos sur l'autel. « Carte du jour ». Pastilles de chances : Commun 60 %, Peu commun 34 %, Rare 4,8 %, Légendaire 1 %, ✦ Rainbow 3 %. Réserve [vestige] 193. Boutons « À l'aveugle [vestige] 100 » (principal) et « Retourner » (secondaire). « Nouvelle carte : 7 h 22 ». |
| E2 | Face cachée, pas assez | Bouton principal éteint, « Manque 27 » en ambre brûlé. Retourner reste possible. |
| E3 | Confirmation | Second toucher sur le même bouton : « Confirmer [vestige] 100 », « Renoncer à l'aveugle ? ». Sans fenêtre modale. Montrer comment le bouton armé se distingue. |
| E4 | Forge à l'aveugle | L'animation du § 6, en 6 à 8 vignettes clés. |
| E5 | Verdict | « [vestige] 100 → [vestige] 1 000 +900 » : gagnant (vert), perdant (« 100 → 50 −50 », ambre brûlé), juste (sans écart). Aucune phrase. |
| E6 | Retournée, pas encore forgée | Nom ; « Rare · ×3 » ou « Rare · Manquante » ; « Forger [vestige] 250 » ; variante trop chère (« Manque 807 »). |
| E7 | Forgée aujourd'hui | Carte face visible, « ✓ Forgée · Nouvelle carte : 7 h 22 ». La page doit rester belle dans cet état, c'est celui qu'on voit le plus. |
| E8 | Scellé | Moins de 60 % de la collection : crypte fermée, « Reliquaire scellé », pastille « La Troupe 48 % », « s'ouvre à 60 % ». |

Une **légendaire rainbow** dans E5 gagnant, pour vérifier que la scène supporte
le cas le plus spectaculaire.

## 6. L'animation de forge (livrable principal)

Un prototype HTML de cette séquence est la pièce la plus attendue. Elle
réutilise le langage déjà en place à l'ouverture des boosters (charte, § 5) :
**le tempo porte l'information**.

**Tout en code, aucune image animée.** Les planches générées (`forge.webp`,
`forge-legendaire.webp`, `dissolution.webp`) sont retirées. Éclats, lueurs,
particules, braises : CSS (`@keyframes`, variables), SVG ou `<canvas>`,
éventuellement l'API Web Animations, sans bibliothèque ni ressource tierce.
N'animer que `transform`, `opacity` et `filter` ; fluide sur un téléphone
moyen ; les particules en nombre borné (tableau ci-dessous). Les couleurs
viennent des jetons et des lueurs de palier, pour que l'effet change avec la
rareté sans nouvel asset. Le code livré doit pouvoir être repris tel quel dans
le site (React, une feuille CSS) : structure et noms de classes lisibles.

### 6.1 Forger à l'aveugle

1. **Le paiement** (≈ 400 ms). Le compteur de vestiges décompte de 193 à 93 ;
   des éclats de vestige quittent la réserve et filent vers la carte, absorbés
   par son dos.
2. **L'éveil** : une lueur monte sous la carte, **à la couleur et à la durée
   de son palier** (tableau ci-dessous). On sait qu'il y a un coup avant de
   lire quoi que ce soit. Pour une rare ou mieux, la scène s'assombrit autour
   de l'autel.
3. **Le retournement**, à la durée du palier, courbe
   `cubic-bezier(.34,.85,.36,1)`. Particules pour peu commune et au-delà.
4. **La forge** : un éclat bref sur la carte retournée, dessiné en code
   (braises, fissure de lumière, onde : à proposer), plus ample pour une
   légendaire ou une rainbow.
5. **Le verdict** : le prix réel apparaît à côté du prix payé (« 100 → 1 000 »)
   et compte jusqu'à sa valeur, puis l'écart s'affiche (« +900 »). Gagnant : le chiffre éclate en vert (`--vert-encre`, déjà employé
   au Comptoir) ; perdant : il tressaille en ambre brûlé (`--ember`). Aucun
   écran de victoire : une ligne, à sa place réservée.

| Palier | Lueur | Retournement | Particules | Assombrissement |
|---|---|---|---|---|
| Commune | 150 ms | 430 ms | aucune | aucun |
| Peu commune | 230 ms | 470 ms | 8 | aucun |
| Rare | 470 ms | 640 ms | 16 | 24 % |
| Légendaire | 820 ms | 840 ms | 28 | 56 % |

Durée totale visée : moins de 2,5 s pour une commune, 4 s au plus pour une
légendaire. **Un toucher passe à l'état final.**

### 6.2 Retourner sans forger

Étapes 2 et 3 seulement : lueur du palier, retournement, puis le vrai prix
s'inscrit sur le bouton. Pas de vestiges, pas d'éclat de forge : c'est une
révélation, pas une récompense.

### 6.3 Forger après avoir retourné

Étapes 1 et 4 : les vestiges filent vers la carte déjà visible, éclat de
forge, la ligne « Forgée aujourd'hui » prend la place du bouton.

### 6.4 Mouvement réduit

Réglage « moins d'animations » du profil : aucune animation, **chaque élément
posé directement à sa position finale** (carte face visible, compteur au bon
chiffre, verdict affiché). Le verdict reste annoncé aux lecteurs d'écran.

### 6.5 Repères pour le son (facultatif)

Le site a un moteur de sons (`src/son/`). Indiquer dans la note les instants où
un son se poserait : paiement, éveil, retournement, verdict gagnant, verdict
perdant.

## 7. Le texte : montrer plutôt que dire

Même règle que la refonte du Donjon (audit de lisibilité du 06/10/2026) :

- **Un joueur ne lit pas, il reconnaît** des formes, des couleurs, des
  chiffres. Un montant s'écrit icône de vestige + chiffre, jamais « 100
  vestiges » ; une possession « ×3 » ; un écart « +900 ».
- **Une information, un seul endroit.** Les chances ne s'écrivent qu'une
  fois (pastilles), le prix une fois (dans le bouton).
- **Les règles se révèlent une fois** : « Comment ça marche » et bulles au
  survol, pas de paragraphe permanent.
- **Pas d'écran sans décision** : le verdict s'inscrit dans la page, pas dans
  une fenêtre.
- **Budget** : la page actuelle affiche **37 mots** hors règles repliées. La
  refonte ne doit pas en ajouter ; chaque mot de plus se justifie.

## 8. Contenu réel pour la maquette

- Joueur : **193 vestiges**, 78 PO. Extension : La Troupe.
- Carte du jour d'exemple : **Tisseuse de Tian**, commune, TRO-094 (Nomade,
  Elfe, Pronolo), 3 exemplaires déjà possédés. Pour le cas gagnant : **Dénatar,
  Gardien du désert**, rare, TRO-190, prix réel 250 ; pour la légendaire
  rainbow, prix réel 5 000.
- Prix réels : 50, 100, 250, 1 000 vestiges ; rainbow ×5. Prix à l'aveugle :
  100.
- Compte à rebours : « Nouvelle carte dans 7 h 22 » (la carte change à minuit).
- Nombres entiers, séparateur de milliers par espace fine (« 1 000 »).

## 9. Contraintes visuelles (la charte fait foi)

- **Palette** : `tokens.css` joint. Sol froid (`--ground` `#0d1417`, `--panel`
  `#1a272c`), une seule lumière chaude, la lampe `--lamp` `#e8a33d`, réservée
  aux prix et aux états actifs. Pas de nouvelle surface chaude.
- **Rareté** : couleurs de lueur de `tiers.js` pour la lueur et les
  particules ; en texte, les encres vérifiées (contraste 4,5:1). Rainbow :
  `--m-rainbow` `#9d7cf0` et la marque ✦.
- **Typographie** : Fraunces (axe `WONK`) pour les titres et noms de carte,
  Archivo pour le reste, chiffres en `tabular-nums`. Aucune monospace, aucune
  capitale espacée.
- **Carte** : le composant existant (`Carte.jsx`, `FaceCarte.jsx`,
  `DosCarte.jsx`, `cards.css`) : proportions 2:3, dos `carte-dos.webp`,
  retournement 3D déjà en place (classe `.flipper`, variable `--fd`). Taille
  dérivée de `--carte-plein`.
- **Rien de la carte cachée ne s'affiche** : ni nom, ni rareté, ni nombre
  d'exemplaires, ni loupe. Le dos est le même pour toutes.
- **Stabilité** : rien ne change de taille pendant l'animation ; places
  réservées pour le verdict et pour la ligne d'état.
- **Accessibilité** : cibles de 44 px, focus visible, bordure d'élément
  actionnable `--edge-ui`, annonce du verdict en région `aria-live`.
- **Écriture** : « booster », « rainbow » (jamais « sachet », « irisé ») ; pas
  de tiret cadratin ; le moins de mots possible (§ 7).
- **Icônes** : tracés SVG de `Icone.jsx` (grille de 20, trait 1,6,
  `currentColor`) ; une icône manquante (horloge du compte à rebours,
  vestige en tracé si l'image ne tient pas aux petites tailles) se dessine
  dans le même style.
- Aucune police, image ou script chargé depuis un domaine tiers.

## 10. Ce qu'il ne faut pas faire

- Pas de bandeau-titre avec paragraphe au-dessus de la scène.
- Pas de découpe de personnage posée dans le vide.
- Pas de fenêtre modale pour confirmer ou pour le verdict.
- Pas de fond crème, d'accent turquoise, de micro-libellés.
- Pas de faux suspense sur le verdict (pas de roue, pas de compteur qui
  hésite) : la lueur du palier annonce, le retournement montre.
- Pas d'image générée pour une animation (planche, GIF, vidéo).
- Pas de phrase là où un chiffre ou une icône suffit.

## 11. Livrables attendus

1. Maquettes **bureau 1 440 × 900** et **téléphone 390 × 844** des états E1 à
   E8, plus le contrôle à 1 280 × 720.
2. **Un prototype HTML cliquable** de la page avec l'animation du § 6, **en
   code** (CSS, SVG ou canvas), un sélecteur pour choisir le palier tiré
   (commune, peu commune, rare, légendaire, légendaire rainbow) et un
   interrupteur « moins d'animations ».
3. Une note courte : jetons ajoutés, dimensions, **chronologie de l'animation
   en millisecondes** (étape, durée, courbe), dans le vocabulaire de la charte.
4. La liste des **images fixes** à produire pour Sora, avec leur ratio : la
   crypte en plein cadre (sans texte, zone calme à droite pour le panneau),
   l'autel ou le reliquaire seul en découpe, le gardien en pied ou à mi-corps
   détouré. Aucune image d'effet : les effets sont dans le code.

## 12. Pièces jointes (dossier `brief-reliquaire/`)

| Fichier | Pour quoi |
|---|---|
| `reliquaire-actuel.png` | La page d'origine, avant la face cachée |
| `reliquaire-allege-bureau.png`, `reliquaire-allege-verdict.png`, `reliquaire-allege-telephone.png` | La page actuelle : face cachée, texte allégé, verdict |
| `charte-graphique.md` | Les règles visuelles du site |
| `expeditions-et-reliquaire.md` | La mécanique du Reliquaire |
| `tokens.css`, `site.css`, `expeditions.css`, `cards.css` | Styles actuels |
| `PageReliquaire.jsx` | La page, face cachée et texte allégé déjà branchés |
| `regles.js`, `reliquaire.js`, `tiers.js` | Règles, prix, tempo des paliers |
| `Carte.jsx`, `FaceCarte.jsx`, `DosCarte.jsx` | Le rendu d'une carte et son retournement |
| `carte-cadre.webp`, `carte-dos.webp` | Cadre et dos de carte |
| `reliquaire/*.webp` | Bandeau (crypte), gardien, reliquaire, vestige ; les planches d'effet, pour mémoire seulement (abandonnées) |
| `Icone.jsx` | Les pictogrammes du site, style à suivre |
| `cartes/*.png` | Illustrations de cartes pour les états |
