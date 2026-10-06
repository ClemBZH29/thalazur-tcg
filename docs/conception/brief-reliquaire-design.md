# Brief : refonte du Reliquaire et animation de forge

**Projet** : La Brume de Thalazur, page `#/reliquaire`.
**Demandé par** : Clément, 06/10/2026.
**Pour** : Claude Design.
**Pièces jointes** : le dossier `brief-reliquaire/` (liste au § 10), dont la
capture de la page actuelle (`reliquaire-actuel.png`).
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

1. **Elle ne tient pas sur un écran.** Un bandeau de 340 px avec un paragraphe
   d'explication, puis l'étal en dessous : à 1 440 × 900, le bas de la carte
   et les boutons passent sous le pli.
2. **Le gardien flotte.** Une découpe détourée posée dans le vide à gauche de
   la carte : pas de sol, pas de lumière derrière lui, la coupe nette du torse
   visible. La charte (§ 7, « Les portraits sont des découpes ») explique
   pourquoi c'est faux.
3. **Trois colonnes inertes.** Gardien, carte, fiche : rien ne relie les trois,
   la crypte du bandeau et la scène de forge sont deux mondes séparés.
4. **Aucune mise en scène de la forge.** Une planche d'effet joue par-dessus la
   page ; la carte ne bouge pas, les vestiges ne vont nulle part.

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
  téléphone : la réserve de vestiges, les deux gestes, la ligne de chances,
  le compte à rebours.
- Une **phrase du gardien** remplace le paragraphe d'introduction : courte, à
  sa voix (par ex. « Elle dort encore. La réveiller vous coûtera votre
  chance. »). L'explication complète des vestiges passe dans une aide repliée
  ou un lien vers la bibliothèque.

**Tenue à l'écran** : aucune barre de défilement au bureau dès 1 024 × 680
(palier « Bureau » de la charte), maquettes à **1 440 × 900** et **1 280 ×
720** ; au téléphone **390 × 844**, la carte, le bouton principal et la
réserve tiennent au-dessus de la barre de navigation basse, sans défiler.

## 5. Les états à produire

| # | État | Ce qu'on voit |
|---|---|---|
| E1 | Face cachée, assez de vestiges | Carte de dos sur l'autel. « Forger à l'aveugle · 100 vestiges » (principal), « Retourner la carte » (secondaire). Chances : 60 % commune, 34 % peu commune, 4,8 % rare, 1 % légendaire ; rainbow 3 fois sur cent. |
| E2 | Face cachée, pas assez | Bouton principal éteint, « Il vous manque 27 vestiges pour la forger à l'aveugle ». Retourner reste possible. |
| E3 | Confirmation | Chaque geste se confirme d'un second toucher sur le même bouton : « Confirmer : 100 vestiges », « Confirmer : renoncer au prix moyen ». Montrer comment le bouton armé se distingue (sans fenêtre modale). |
| E4 | Forge à l'aveugle | L'animation du § 6, image par image (6 à 8 vignettes clés). |
| E5 | Verdict | Après la forge à l'aveugle : la carte retournée, le prix payé et le prix réel. Trois variantes : **gagnant** (« Payée 100, elle en vaut 1 000. Belle affaire : 900 vestiges d'économisés. »), **perdant** (« Payée 100, elle en vaut 50. Le pari ne paie pas cette fois. »), **juste**. |
| E6 | Retournée, pas encore forgée | Nom, rareté, « Vous en avez 3 exemplaires : celui-ci s'y ajoutera » ou « Elle manque à votre collection », bouton « Forger · 250 vestiges », et en rappel discret « Face cachée, elle coûtait 100 ». Variante : trop chère (« Il vous manque 807 vestiges »). |
| E7 | Forgée aujourd'hui | Carte face visible, « Forgée aujourd'hui. Prochaine carte dans 7 h 22. » La page doit rester belle dans cet état, c'est celui qu'on voit le plus. |
| E8 | Scellé | Moins de 60 % de la collection : la crypte fermée, « Le Reliquaire est scellé », la progression (« La Troupe : 48 % »). |

Une **légendaire rainbow** dans E5 gagnant, pour vérifier que la scène supporte
le cas le plus spectaculaire.

## 6. L'animation de forge (livrable principal)

Un prototype HTML de cette séquence est la pièce la plus attendue. Elle
réutilise le langage déjà en place à l'ouverture des boosters (charte, § 5) :
**le tempo porte l'information**.

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
4. **La forge** : un éclat bref sur la carte retournée (les planches
   `forge.webp` et `forge-legendaire.webp` existent, à reprendre ou remplacer).
5. **Le verdict** : le prix réel apparaît à côté du prix payé et compte jusqu'à
   sa valeur. Gagnant : le chiffre éclate en vert (`--vert-encre`, déjà employé
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

## 7. Contenu réel pour la maquette

- Joueur : **193 vestiges**, 78 PO. Extension : La Troupe.
- Carte du jour d'exemple : **Tisseuse de Tian**, commune, TRO-094 (Nomade,
  Elfe, Pronolo), 3 exemplaires déjà possédés. Pour le cas gagnant : **Dénatar,
  Gardien du désert**, rare, TRO-190, prix réel 250 ; pour la légendaire
  rainbow, prix réel 5 000.
- Prix réels : 50, 100, 250, 1 000 vestiges ; rainbow ×5. Prix à l'aveugle :
  100.
- Compte à rebours : « Nouvelle carte dans 7 h 22 » (la carte change à minuit).
- Nombres entiers, séparateur de milliers par espace fine (« 1 000 »).

## 8. Contraintes visuelles (la charte fait foi)

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
  de tiret cadratin ; phrases courtes ; la voix du gardien pour l'ambiance.
- Aucune police, image ou script chargé depuis un domaine tiers.

## 9. Ce qu'il ne faut pas faire

- Pas de bandeau-titre avec paragraphe au-dessus de la scène.
- Pas de découpe de personnage posée dans le vide.
- Pas de fenêtre modale pour confirmer ou pour le verdict.
- Pas de fond crème, d'accent turquoise, de micro-libellés.
- Pas de faux suspense sur le verdict (pas de roue, pas de compteur qui
  hésite) : la lueur du palier annonce, le retournement montre.

## 10. Livrables attendus

1. Maquettes **bureau 1 440 × 900** et **téléphone 390 × 844** des états E1 à
   E8, plus le contrôle à 1 280 × 720.
2. **Un prototype HTML cliquable** de la page avec l'animation du § 6, un
   sélecteur pour choisir le palier tiré (commune, peu commune, rare,
   légendaire, légendaire rainbow) et un interrupteur « moins d'animations ».
3. Une note courte : jetons ajoutés, dimensions, **chronologie de l'animation
   en millisecondes** (étape, durée, courbe), dans le vocabulaire de la charte.
4. La liste des images à produire pour Sora, avec leur ratio : la crypte en
   plein cadre (sans texte, zone calme à droite pour le panneau), l'autel ou le
   reliquaire seul en découpe, le gardien en pied ou à mi-corps détouré, et les
   planches d'effet si elles changent.

## 11. Pièces jointes (dossier `brief-reliquaire/`)

| Fichier | Pour quoi |
|---|---|
| `reliquaire-actuel.png` | La page telle qu'elle est (avant la face cachée) |
| `charte-graphique.md` | Les règles visuelles du site |
| `expeditions-et-reliquaire.md` | La mécanique du Reliquaire |
| `tokens.css`, `site.css`, `expeditions.css`, `cards.css` | Styles actuels |
| `PageReliquaire.jsx` | La page, avec la face cachée déjà branchée |
| `regles.js`, `reliquaire.js`, `tiers.js` | Règles, prix, tempo des paliers |
| `Carte.jsx`, `FaceCarte.jsx`, `DosCarte.jsx` | Le rendu d'une carte et son retournement |
| `carte-cadre.webp`, `carte-dos.webp` | Cadre et dos de carte |
| `reliquaire/*.webp` | Bandeau (crypte), gardien, reliquaire, vestige, planches d'effet |
| `cartes/*.png` | Illustrations de cartes pour les états |
