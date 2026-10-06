# Brief : la page des Missions, tenue par Bodégué

**Projet** : La Brume de Thalazur, page `#/missions`.
**Demandé par** : Clément, 07/10/2026.
**Pour** : Claude Design.
**Pièces jointes** : le dossier `brief-missions/` (liste au § 13), dont
l'illustration de Bodégué et les captures de la page de travail.
**À lire avec** : `charte-graphique.md` (règles visuelles, qui priment sur ce
brief) et `missions.md` (la mécanique).

---

## 1. Le site en deux phrases

Un jeu de cartes à collectionner tiré d'une campagne de Donjons et Dragons :
on ouvre des boosters, on complète une collection de 220 cartes (PNJ, Lieux,
Artéfacts, quatre raretés plus les full art), on joue aux Mines, au Donjon,
aux Expéditions, on vend au Comptoir. Tout est en français, sombre, et les
cartes sont la seule lumière de l'écran.

## 2. Les missions

Nouvelle page, **déjà codée** avec une mise en page de travail (captures
`missions-actuel-*.png`). La mécanique ne change pas ; c'est la page qu'il
faut concevoir.

- **Trois missions du jour**, chacune dans un mode différent du site
  (boutique, Comptoir, Mines, Donjon, Expéditions, Reliquaire). Elles
  changent à minuit. Exemple : « Vendre 5 cartes au Comptoir », 40 PO.
- **Une mission de la semaine**, plus longue (« Vaincre 10 gardiens du
  Donjon »), payée **2 boosters au choix**. Elle change le lundi.
- **Un remplacement par jour** : une mission pas encore remplie s'échange
  contre une autre.
- Une mission remplie se **réclame** d'un geste ; oubliée, elle est payée
  d'office au changement de jour.
- **« Y aller »** mène à la page où la mission se remplit.
- Dans la navigation, une **pastille** compte les missions à réclamer.

C'est le rendez-vous quotidien du site : on y passe chaque jour, quelques
secondes. La page doit se lire **d'un coup d'œil** et rendre le geste de
réclamer **agréable**, sans devenir un écran de récompense qui bloque.

## 3. Bodégué

Celui qui confie les missions. Illustration jointe (`bodegue-source.png`,
1 254 × 1 254, et `bodegue.webp`, détourée, 420 × 512) :

- homme d'une cinquantaine d'années, cheveux cendrés en bataille, barbe
  courte grisonnante, sourire en coin, regard tranquille et un peu malicieux ;
- **ample robe rose poudré à larges revers sarcelle**, kimono vert d'eau
  dessous ;
- debout, **mains jointes** devant lui, cadré jusqu'aux cuisses.

Son caractère, tel qu'on le lit : posé, bienveillant, il en sait plus qu'il
n'en dit. Il ne commande pas, il **propose** ; ses répliques sont courtes
(« Trois petites choses aujourd'hui. Rien d'héroïque, mais faites-les
bien. »). Son rôle exact dans la campagne sera précisé par Clément ; ne pas
lui inventer de titre à l'écran.

Sa robe rose est la seule tache de couleur chaude et saturée hors de la
lampe : elle appartient à l'illustration, comme les cartes, et ne doit pas
déteindre sur l'interface (§ 10).

## 4. Ce qui ne va pas dans la page de travail (voir les captures)

1. **Bodégué flotte.** Une découpe dans une colonne collante, sans sol ni
   décor, la coupe aux cuisses masquée par un fondu. Le défaut que la charte
   (§ 7, « Les portraits sont des découpes ») a déjà corrigé ailleurs.
2. **Une liste de tâches, pas un lieu.** Quatre bandeaux identiques ; rien ne
   dit qu'on est chez quelqu'un, ni que ces missions viennent de lui.
3. **La mission de la semaine** ne se distingue que par un liseré.
4. **Aucun moment** : réclamer change un bouton en coche. Les PO arrivent
   dans la bourse sans qu'on le voie.
5. **Le remplacement** est une icône muette à droite de chaque ligne.
6. Au téléphone, chaque mission prend deux lignes de boutons ; la mission de
   la semaine passe sous la barre de navigation.

## 5. Le principe : la table de Bodégué

Une piste, à confirmer ou à battre par une meilleure : **la page est la table
de Bodégué**.

- **Bodégué derrière sa table**, coupé par le plateau à mi-corps : ancré, la
  lueur de lampe derrière lui, fondu de 7 % au bas de l'image si besoin. Sa
  **bulle** porte la réplique du jour (une ligne).
- **Sur la table, trois billets** : un par mission du jour. Le billet dit la
  mission, sa progression (« 3 / 5 ») et sa récompense ; le pictogramme du
  mode le coiffe. Rempli, il s'allume ; réclamé, il porte un **sceau**.
- **La mission de la semaine** est une pièce à part : un pli scellé, une
  lettre plus grande, à l'accent rainbow (`--m-rainbow`) puisqu'elle paie des
  boosters au choix.
- **Les échéances** (« 7 h 22 », « 4 j 23 h ») discrètes, près de ce
  qu'elles concernent.
- **Aucun paragraphe.** Les règles vivent dans « Comment ça marche »,
  replié, ou une bulle « ? ».

**Tenue à l'écran** : aucune barre de défilement au bureau dès 1 024 × 680,
maquettes à **1 440 × 900** et **1 280 × 720** ; au téléphone **390 × 844**,
les trois missions du jour et Bodégué (au moins son visage et sa bulle)
tiennent au-dessus de la barre de navigation basse ; la mission de la semaine
peut être juste sous le pli si elle s'annonce.

## 6. Les états à produire

| # | État | Ce qu'on voit |
|---|---|---|
| E1 | Nouvelles missions | Trois billets à 0, la semaine à 4 / 15, réplique d'accueil, remplacement disponible. |
| E2 | En cours | « 3 / 5 », « 40 / 60 », « 0 / 1 » ; une jauge par billet, sans pourcentage écrit. |
| E3 | Une mission prête | Le billet s'allume (lampe), bouton « Réclamer » ; réplique « C'est fait ? Venez chercher votre dû. » ; pastille dans la navigation. |
| E4 | Réclamer | L'animation du § 7.1. |
| E5 | Journée finie | Trois billets scellés, réplique « Rien d'autre pour aujourd'hui. Revenez demain, j'aurai trouvé. », « Nouvelles missions : 7 h 22 ». **L'état qu'on voit le plus souvent** : la page doit y rester belle et calme. |
| E6 | Remplacer | Le geste, sa confirmation légère (second toucher, comme au Reliquaire), l'animation du § 7.2 ; ensuite le geste est éteint pour la journée, et cela se lit. |
| E7 | Semaine prête | Le pli scellé s'ouvre : « 2 boosters au choix », « Réclamer », puis un lien vers la boutique. |
| E8 | Débutant | Un seul booster ouvert : trois missions, dont deux de la boutique (« Ouvrir 2 boosters », « Ajouter 2 cartes nouvelles à votre collection ») et « Rapporter 60 PO des Mines de Kazim ». |

Montrer aussi **l'entrée de navigation** « Missions » avec sa pastille (barre
haute au bureau, menu au téléphone) et son pictogramme (un parchemin roulé
coché, `Icone.jsx`, à redessiner si besoin dans le même style).

## 7. Les animations (en code)

**Tout en code, aucune image animée.** CSS (`@keyframes`, variables), SVG ou
`<canvas>`, éventuellement l'API Web Animations, sans bibliothèque ni
ressource tierce. N'animer que `transform`, `opacity` et `filter`. Le code
livré doit pouvoir être repris tel quel dans le site (React, une feuille CSS).

### 7.1 Réclamer (le moment de la page)

1. Le sceau tombe sur le billet (≈ 250 ms), avec un léger tassement du
   billet.
2. Les pièces partent du billet vers la **bourse du bandeau** (en haut à
   droite), en nombre borné (8 au plus), et le chiffre de la bourse compte
   jusqu'à sa nouvelle valeur. Même langage que les ventes du Comptoir.
3. Pour la semaine : deux dos de booster sortent du pli et filent vers
   l'entrée « Boutique » de la navigation.
4. Bodégué change de réplique ; s'il le faut, une seconde pose (§ 12).

Moins de 1,2 s en tout. Un toucher passe à l'état final. Plusieurs missions
prêtes : un bouton « Tout réclamer » est-il utile ? À proposer.

### 7.2 Remplacer

Le billet est repris (il glisse vers Bodégué et s'efface), un nouveau est posé
à sa place (≈ 600 ms). Rien d'autre ne bouge.

### 7.3 L'arrivée sur la page

Si une mission a progressé depuis la dernière visite, sa jauge part de
l'ancienne valeur et monte (≈ 500 ms). Indiquer ce qu'il faut retenir pour
le savoir ; le code le branchera.

### 7.4 Mouvement réduit

Réglage « moins d'animations » du profil : rien ne bouge, tout est posé à sa
place finale, les gains annoncés aux lecteurs d'écran (`aria-live`).

### 7.5 Repères pour le son (facultatif)

Le site a un moteur de sons (`src/son/`). Indiquer les instants où un son se
poserait : sceau, pièces, boosters de la semaine, remplacement.

## 8. Le texte : montrer plutôt que dire

Même règle que les refontes du Donjon et du Reliquaire :

- **Un joueur ne lit pas, il reconnaît** : pictogramme du mode, « 3 / 5 »,
  « 40 PO ». La phrase de la mission reste, elle est le seul texte utile.
- **Une information, un seul endroit.** La récompense une fois par billet,
  l'échéance une fois par bloc.
- **Pas de paragraphe permanent** : « Comment ça marche » replié.
- **Budget** : la page de travail affiche **environ 45 mots** (titre,
  réplique, trois missions, semaine, boutons, échéances). Ne pas en ajouter.

## 9. Contenu réel pour la maquette

Missions du jour d'exemple, avec leur pictogramme de mode :

| Mission | Mode | Progression | Récompense |
|---|---|---:|---:|
| Vendre 5 cartes au Comptoir | Comptoir | 3 / 5 | 40 PO |
| Rapporter 60 PO des Mines de Kazim | Mines | 60 / 60 (prête) | 40 PO |
| Descendre 1 fois au Donjon | Donjon | 0 / 1 | 40 PO |

Semaine : « Vaincre 10 gardiens du Donjon », 4 / 10, **2 boosters au
choix**. Autres libellés possibles : « Ouvrir 2 boosters » (30 PO),
« Ajouter 2 cartes nouvelles à votre collection » (40 PO), « Vaincre 2
gardiens du Donjon » (50 PO), « Accueillir 1 expédition » (30 PO),
« Dissoudre 10 exemplaires au Reliquaire » (30 PO).

Joueur : 83 PO en bourse. Échéances : « 7 h 22 » pour le jour, « 4 j 23 h »
pour la semaine. Nombres entiers, séparateur de milliers par espace fine.

Répliques de Bodégué (provisoires, `src/missions/voix.js`) :

- accueil : « Trois petites choses aujourd'hui. Rien d'héroïque, mais
  faites-les bien. » · « J'ai noté ce qu'il faudrait faire. Le reste, je vous
  le laisse. »
- une mission prête : « C'est fait ? Venez chercher votre dû. »
- tout fait : « Rien d'autre pour aujourd'hui. Revenez demain, j'aurai
  trouvé. »
- après un remplacement : « Celle-là ne vous plaisait pas ? Soit. Essayez
  plutôt ceci. »

## 10. Contraintes visuelles (la charte fait foi)

- **Palette** : `tokens.css` joint. Sol froid (`--ground` `#0d1417`,
  `--panel` `#1a272c`), une seule lumière chaude, la lampe `--lamp`
  `#e8a33d`, réservée aux récompenses et aux états actifs (mission prête,
  bouton « Réclamer »). **La robe rose de Bodégué ne donne pas sa couleur à
  l'interface** : pas de rose ni de sarcelle dans les surfaces, les bordures
  ou les boutons. La semaine prend l'accent rainbow `--m-rainbow` `#9d7cf0`.
- **Typographie** : Fraunces (axe `WONK`) pour le titre, le nom de Bodégué et
  sa bulle si elle y gagne ; Archivo pour le reste, chiffres en
  `tabular-nums`. Aucune monospace, aucune capitale espacée.
- **Portrait** : découpe détourée, `object-fit: contain`, ancrée en bas,
  ombre en `drop-shadow`, lueur de lampe derrière. **Ancrée dans la scène**
  (coupée par la table), jamais posée dans le vide.
- **Stabilité** : rien ne change de taille quand une mission avance, se
  remplit ou se réclame ; places réservées pour le sceau et pour le bouton.
- **Accessibilité** : cibles de 44 px, focus visible, bordure d'élément
  actionnable `--edge-ui` (3:1), jauges en `role="progressbar"`, gains
  annoncés en `aria-live`.
- **Écriture** : « booster », « rainbow » (jamais « sachet », « irisé ») ;
  pas de tiret cadratin ; le moins de mots possible (§ 8).
- **Icônes** : tracés SVG de `Icone.jsx` (grille de 20, trait 1,6,
  `currentColor`) pour les modes, l'horloge, le remplacement.
- Aucune police, image ou script chargé depuis un domaine tiers.

## 11. Ce qu'il ne faut pas faire

- Pas de découpe de personnage posée dans le vide.
- Pas de liste de tâches façon gestionnaire de projet (cases à cocher,
  tableau).
- Pas de fenêtre modale pour réclamer ni pour remplacer ; pas d'écran de
  victoire.
- Pas de rose ni de sarcelle dans l'interface ; pas de fond crème.
- Pas d'image générée pour une animation (planche, GIF, vidéo).
- Pas de phrase là où un chiffre ou un pictogramme suffit.

## 12. Livrables attendus

1. Maquettes **bureau 1 440 × 900** et **téléphone 390 × 844** des états E1
   à E8, plus le contrôle à 1 280 × 720, et l'entrée de navigation.
2. **Un prototype HTML cliquable** de la page, avec les animations du § 7
   **en code** : boutons pour faire avancer une mission, la remplir, la
   réclamer, remplacer, passer à minuit, et un interrupteur « moins
   d'animations ».
3. Une note courte : jetons ajoutés, dimensions, **chronologie des
   animations en millisecondes** (étape, durée, courbe), dans le vocabulaire
   de la charte.
4. La liste des **images fixes** à produire pour Sora, avec leur ratio : la
   table (ou le décor) de Bodégué sans personnage ni texte ; les éléments
   posés si la scène en a besoin (billet, sceau, pli) quand le code ne suffit
   pas ; **au plus deux poses supplémentaires de Bodégué** dans le même style
   que l'illustration jointe (par exemple tendant un billet, satisfait), à
   fond uni pour le détourage. Aucune image d'effet.

## 13. Pièces jointes (dossier `brief-missions/`)

| Fichier | Pour quoi |
|---|---|
| `BRIEF.md` | Ce brief |
| `bodegue-source.png`, `bodegue.webp` | L'illustration de Bodégué, d'origine et détourée |
| `missions-actuel-bureau.png`, `missions-actuel-telephone.png` | La page de travail |
| `charte-graphique.md` | Les règles visuelles du site |
| `missions.md` | La mécanique des missions |
| `tokens.css`, `base.css`, `app.css`, `missions.css`, `comptoir.css` | Styles actuels (le Comptoir pour ses portraits et ses pièces) |
| `PageMissions.jsx`, `regles.js`, `missions.js`, `voix.js` | La page de travail, les règles, le barème, les répliques |
| `Icone.jsx` | Les pictogrammes du site, style à suivre |
| `carte-dos.webp` | Le dos de booster, pour l'animation de la semaine |
