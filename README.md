# La Brume de Thalazur

Ouverture de boosters pour la campagne **La Brume de Thalazur** (province
d'Éléon, empire de Mugania). Chaque booster tire cinq PNJ au hasard dans un roster
de faction et les révèle un par un, comme un booster de jeu de cartes.

Le site compte six pages : une **vitrine**, une **boutique** où l'on ouvre les
sachets, une **bibliothèque** qui montre le set entier, un **Comptoir** où
s'écoulent les exemplaires en trop, les **Mines de Kazim** qui financent la
suite, et les **réglages**. La bourse est commune aux quatre lieux.

La partie est conservée dans le navigateur et s'exporte en JSON. Un compte
Google **facultatif** la recopie sur Firebase pour la retrouver d'un appareil à
l'autre (voir « Comptes et synchronisation »). Sans connexion, le site ne fait
aucune requête hors de son propre hébergement.

---

## Les pages

| Adresse | Page | Ce qu'on y fait |
|---------|------|-----------------|
| `#/` | Accueil | Écran de présentation de la campagne, et par où entrer |
| `#/boutique` | Boutique | L'étagère des extensions |
| `#/boutique/<id>` | Ouverture | Le sachet se déchire, les cartes montent une par une |
| `#/bibliotheque` | Bibliothèque | Le set entier, obtenu ou non, et les exemplaires en trop |
| `#/comptoir` | Le Comptoir | Marché de l'occasion : vendre ses doublons, acheter au rayon du jour |
| `#/mines` | Les Mines de Kazim | Module idle : frapper le filon, embaucher, vendre l'étoile |
| `#/profil` | Profil | Connexion Google, pseudo, synchronisation, export et suppression du compte, préférences (animations, doublons, son, cookies) |
| `#/reglages` | Réglages MJ | **Développement seulement** (`npm run dev`) : roster, portraits, taux, mode test. Absente du site publié ; l'ancienne adresse renvoie au profil |
| `#/confidentialite` | Confidentialité | Données, stockages, droits, mentions légales |

**Le routage passe par le fragment**, pas par l'historique. Le site est publié
sur GitHub Pages en fichiers statiques : une adresse comme `/brume/comptoir`
renverrait un 404 au rechargement, faute de serveur pour réécrire vers
`index.html`. Le fragment ne quitte jamais `index.html`. Le routeur tient en
soixante lignes dans `src/lib/routeur.jsx` — aucune dépendance ajoutée.

Le Comptoir et les Mines sont **chargés à la demande**, puis **préchargés dès
que le navigateur est libre**. Le chargement à la demande seul avait un défaut :
le clic sur « Mines » déclenchait le téléchargement du module, de sa feuille de
style et, en développement, sa compilation — plusieurs secondes d'attente sur
une machine modeste, au moment précis où l'on demandait quelque chose. Le
travail se fait maintenant pendant qu'on lit l'accueil (`requestIdleCallback`,
repli à deux secondes), et le clic ne trouve qu'un module déjà en cache. Mesuré
sur le site construit : 142 ms avant, 82 ms après — et l'écart est bien plus
large là où la compilation compte.

L'accueil et la boutique tiennent chacun sur un écran et ne défilent pas
au-dessus de 1024 × 680 ; les Mines font de même au-dessus de 1024 × 700.

---

## Comptes et synchronisation

- **Firebase Authentication** (Google) pour l'identité, **Cloud Firestore** pour
  la copie de la partie : un document `joueurs/{uid}` par joueur, lisible par
  lui seul (`firestore.rules`).
- **Local d'abord.** Le navigateur garde la partie ; le compte en reçoit une
  copie trente secondes après le dernier changement et dès que l'onglet passe
  en arrière-plan. Hors ligne, on joue, l'envoi attend.
- **Deux appareils.** Chaque écriture porte une révision ; les règles refusent
  celle qui ne part pas de la dernière. L'appareil refusé intègre la copie du
  compte par une fusion à trois voies (`src/lib/nuage/fusion.js`, testée par
  `npm run test:fusion`) : les exemplaires et boosters des deux côtés
  s'additionnent, le gain passif n'est pas payé deux fois.
- **Première connexion** : la partie jouée sans compte s'ajoute au compte.
  **Déconnexion** : l'appareil est vidé, la partie reste sur le compte.
- **Le SDK n'est chargé qu'au besoin** (clic sur « Se connecter », ou session
  déjà ouverte) : un visiteur sans compte ne contacte jamais Google. Les
  polices sont servies par le site (`@fontsource`), pour la même raison. C'est
  ce qui dispense de bandeau de consentement : aucun traceur hors stockage
  strictement nécessaire.

La configuration passe par `VITE_FIREBASE_*` (voir `.env.example`) :
`.env.local` en développement, variables du dépôt GitHub pour le déploiement.
Sans elles, le build sort un site entièrement local, sans bouton de connexion.
Les mentions légales se tiennent dans `src/config/legal.js`.

**Mesure d'audience.** Google Analytics (via Firebase) ne se charge qu'après
« Accepter » dans le bandeau (`src/lib/mesure.js`) : ni script, ni requête,
ni cookie avant. Refuser est aussi simple qu'accepter, le choix se garde six
mois et se change depuis le pied de page, le profil ou la page
Confidentialité ; retirer l'accord coupe la collecte et efface les cookies
`_ga`. Stockage publicitaire refusé, signaux Google coupés, cookies à 13 mois.
Sans `VITE_FIREBASE_MEASUREMENT_ID`, ni bandeau ni mesure.

**Sécurité.** Politique CSP posée au build dans `index.html`
(`vite.config.js`, GitHub Pages ne permettant pas d'en-têtes HTTP). Règles
Firestore : un document par joueur, lisible et modifiable par lui seul,
forme et taille vérifiées, écriture refusée si elle ne part pas de la
dernière révision. Les leviers de meneur (taux, mode test, roster) sont
ignorés en production. `public/404.html` renvoie `/comptoir` vers
`/#/comptoir` et affiche une page d'erreur pour le reste.

**Conservation : cinq ans sans utilisation.** `scripts/purge-comptes.mjs`,
lancé une fois par an, supprime les comptes sans connexion depuis cinq ans,
partie comprise (simulation par défaut, `--effacer` pour agir). Chaque
écriture porte aussi un champ `expire` (maintenant + cinq ans) : la
suppression automatique par TTL Firestore exige la facturation (offre Blaze)
et n'est pas active ; le jour où elle l'est, une règle TTL sur `joueurs.expire`
suffit, sans toucher au code.

---

## Les animations

Ici l'animation porte l'information : le sachet se déchire proportionnellement
au geste, une lueur du palier monte sous la carte avant qu'on puisse lire quoi
que ce soit, la carte se retourne d'autant plus lentement qu'elle est rare, le
filon vole en éclats, une lanterne s'annonce sur la route avant que le
colporteur n'arrive.

Tout cela était gardé derrière `prefers-reduced-motion`, ce qui est juste par
défaut et malheureux ici : un système réglé sur « moins d'animations » vidait
l'ouverture et la mine de leur substance, sans rien dire et sans recours.

Le garde est donc devenu un attribut de la racine du document,
`data-mouvement="reduit"` ou `"plein"`, posé par l'application depuis
**Réglages → Animations**, à trois états :

| État | Effet |
|------|-------|
| Suivre le système | valeur par défaut : `prefers-reduced-motion` décide |
| Toujours animer | passe outre la préférence du système |
| Jamais animer | coupe tout, même si le système ne demande rien |

Quand le système demande moins d'animations et que le réglage le suit, la
boutique et les Mines l'annoncent en une ligne, avec un bouton pour passer
outre : une animation absente doit se lire comme une préférence respectée, pas
comme une application cassée.

**Ce réglage est le seul.** La mine portait sa propre bascule « Effets » en
haut à droite : deux commandes pour un même réglage, dont l'une qu'il fallait
aller chercher dans un coin du module. Elle a été retirée ; les effets du filon
suivent Réglages → Animations, comme tout le reste du site.

---

## Démarrer

```bash
npm install
npm run dev
```

L'application se lance avec le roster de **La Troupe de Valéran** : 220 cartes —
165 PNJ, 37 lieux, 18 artéfacts — plus les six pleines illustrations et les cinq
PJ posés dans `src/config/speciales.js`, soit 226 cases de set. Pour la
construire :

```bash
npm run build      # sort dans dist/
npm run preview
```

Un workflow GitHub Pages est fourni dans `.github/workflows/deploy.yml` : il se
déclenche sur `main` et publie `dist/`. Activer Pages en mode « GitHub Actions »
dans les réglages du dépôt.

---

## Charger le vrai roster

Deux chemins, selon l'usage.

**Permanent** — conversion en JSON versionné dans le dépôt :

```bash
npm run roster -- La_Troupe.xlsx troupe-valeran
```

Le classeur porte **un onglet par type de carte**, et c'est l'onglet qui donne le
type : `PNJ`, `Lieux`, `Artéfacts`. Chacun a ses propres en-têtes, ce qui est tout
l'intérêt de la règle — un lieu n'a pas de race, un artéfact n'a pas de faction,
et aucune colonne « type » n'a besoin d'être tenue à jour à la main.

Le script repère chaque colonne **par son intitulé**, pas par son rang : le
classeur peut gagner une colonne (Style, Génération OK, Identifiant…) sans qu'il
soit retouché. Il écrit `data/troupe-valeran.json`, puis compte ce qu'il a lu —
types, paliers, citations remplies, noms en double, lignes sans palier. Un roster
à qui il manque un palier ne casse rien : le tirage glisse vers le palier voisin,
en silence. D'où ce décompte à la sortie, qui est la seule occasion de le voir.

```
220 cartes écrites dans data/troupe-valeran.json
Types   : pnj 165 · lieu 37 · artefact 18
Paliers : commune 110 · peu commune 66 · rare 33 · légendaire 11
```

Le genre ne figure pas dans le classeur : la colonne reste vide et la carte
n'affiche simplement pas cette mention.

**Ponctuel** — l'onglet Réglages accepte un `.xlsx` déposé à la volée. Le roster
est alors conservé dans le stockage local et prend le pas sur le fichier livré
dans `data/`.

Ordre des colonnes attendu :

| Col | Contenu | PNJ | Artéfact | Lieu |
|-----|---------|-----|----------|------|
| A | numéro | | | |
| B | nom | | | |
| C | type | `pnj` ou vide | `artefact` | `lieu` |
| D | palier | `commun` · `peu commun` · `rare` · `légendaire` | | |
| E | premier repère | archétype | rareté de l'objet | province |
| F | race | race | vide | vide |
| G | troisième repère | faction | porteur ou localisation | type de lieu |
| H | genre (`M` / `F`) | genre | vide | vide |
| I | citation | | | |

Les trois repères occupent des colonnes fixes, **dans l'ordre où ils s'affichent**.
D'où une règle unique de rendu : lire E, F, G et écarter les vides. Un PNJ donne
trois segments, un artéfact et un lieu en donnent deux.

| Type | Ligne affichée |
|------|----------------|
| PNJ | Archétype `|` Race `|` Faction |
| Artéfact | Rareté `|` Porteur ou localisation |
| Lieu | Province `|` Type de lieu |

Le séparateur est posé par CSS (`--sep` dans `cards.css`), pas écrit dans le
texte : à 2,75 cqw, une barre verticale se distingue des lettres là où un point
médian se perdrait dans les empattements.

**La colonne D l'emporte sur tout.** Sans elle, la rareté se déduit de la
fréquence du premier repère, ce qui convient à un roster brut mais détruirait la
répartition d'un set composé à la main. Le tableau des réglages ne concerne donc
que les lignes dépourvues de palier explicite.

**Un palier vide déforme tous les boosters.** `draw.js` glisse vers le palier
voisin quand celui demandé n'a aucune carte — c'est ce qui permet à un roster
partiel de fonctionner. Mais un roster sans commun envoie les trois
emplacements garantis sur peu commun, et l'on ouvre cinq peu communs booster
après booster en croyant les tables déréglées. C'était le cas du roster de démonstration
livré au début du projet, dont la colonne de palier ne contenait que légendaire,
rare et peu commun. La boutique le signale en tête de page au lieu de laisser ce
repli muet ; avec les 110 communs de La Troupe, l'avertissement ne paraît plus.

Sous les repères vient la **citation**, en guillemets et en italique, tronquée à
deux lignes — environ 90 caractères. Elle n'apparaît qu'au-dessus de 250 px de
largeur de carte : sur une vignette de bibliothèque, deux lignes d'italique
seraient illisibles. Le plein écran l'affiche en entier.

---

## Portraits

Trois sources en cascade, la première qui répond gagne :

1. **Fichiers montés depuis le disque** (Réglages → Dossier local). Appariés par
   le numéro contenu dans le nom de fichier, ou par le nom translittéré :
   `17.jpg`, `ysoline-barq.png`. Ces URL sont éphémères, elles disparaissent au
   rechargement.
2. **URL trouvée dans la ligne** du roster.
3. **Motif construit sur une base** : `./portraits` + `{num}.jpg`. Les cartes
   disponibles sont `{num}`, `{slug}` et `{nom}`. Pour une installation fixe,
   déposer les images dans `public/portraits/` et laisser la base à `./portraits`.

Le portrait couvre la fenêtre d'art. Avec une bibliothèque hétérogène — bustes
carrés et illustrations pleines mélangés — le réglage **point focal vertical**
choisit la hauteur retenue au recadrage ; 30 % garde la tête visible dans les
deux cas.

Sans portrait, la carte affiche un monogramme gravé plutôt qu'une image cassée.

---

## Le modèle de rareté

La rareté est une **matière**, pas une étoile.

| Palier | Teinte du cadre | Origine |
|--------|-----------------|---------|
| Commun | bleu d'origine | grade porté par plus de 12 % de la troupe |
| Peu commun | vert-de-gris | entre 2 % et 12 % |
| Rare | or | moins de 2 % |
| Légendaire | rouge laqué | Commandant, Bras droit, Conseiller, Capitaine |

Par-dessus, indépendamment du palier : la version **rainbow**, une incrustation
d'écaille de dragon qui irise la carte. Le taux se règle dans l'application ;
au-delà de 8 % les joueurs cessent de réagir.

C'est le mot du jeu, et il est le même partout : dans l'interface, dans le code
(`version: "rainbow"`, `traits.rainbow`, `.marque-rainbow`) et dans cette
documentation. « Irisé » ne désigne plus que l'effet optique lui-même — la
couche `.iris` de `cards.css` — jamais la version d'une carte.

L'heuristique de fréquence n'est qu'un point de départ. L'onglet Réglages liste
tous les grades avec leur effectif et permet de corriger chaque palier à la main.

### Structure du booster

Chaque emplacement a sa propre table — c'est cela qui produit la montée, pas la
distribution globale.

| Emplacement | Table |
|-------------|-------|
| 1 à 3 | Commun garanti |
| 4 | 95,5 % peu commun · 3,8 % rare · 0,7 % légendaire |
| 5 | 75,5 % peu commun · 20 % rare · 4,5 % légendaire |

Le calibrage est aligné sur Hearthstone : **27,9 %** de chances d'un rare ou
mieux par booster, et un légendaire **tous les dix-neuf boosters**. À titre de
repère, Pokémon TCG Pocket est à 21,1 % pour une 1-Étoile et 1 sur 500 pour une
Couronne — une rareté taillée pour des millions de joueurs et une monétisation,
qui rendrait le palier légendaire invisible sur une table de cinq personnes.

Un **Appel de Valéran** (0,6 % par défaut) remplace les cinq tables par
70 % rare / 30 % légendaire.

Deux filets de sécurité, sur le modèle de Hearthstone : un légendaire est
garanti dans les **huit premiers boosters**, puis forcé **tous les vingt-cinq**
si aucun n'est sorti. Sans le premier, quatre visiteurs sur cinq découvriraient
le site sans jamais croiser le palier qui justifie tout le dispositif.

Aucun doublon à l'intérieur d'un même booster. Entre deux boosters, les doublons
sont permis, comptés dans la bibliothèque, et revendus automatiquement.

---

## L'économie

Tout se joue en pièces d'or, en local.

| Paramètre | Valeur |
|-----------|--------|
| Solde de départ | 600 PO |
| Prix d'un booster | 120 PO |
| Gain passif | 15 PO par heure, soit 360 par jour |
| Plafond d'accumulation | 720 PO — 48 h, on peut sauter un jour sans rien perdre |
| Revente garantie d'un exemplaire en trop | 2 / 5 / 15 / 50 PO selon le palier |
| Gain de la mine | × 15 sur ce que paient les kobolds, plafonné à 480 PO par jour |

Ces valeurs forment un point fixe. Un booster contient en moyenne 3 communs,
1,71 peu commun, 0,24 rare et 0,052 légendaire, soit 20,7 PO de revente quand la
collection est avancée — un coût net de 99 PO, donc 3,6 boosters par jour.

Au démarrage presque rien n'est doublon, la revente rapporte donc peu et le
rythme réel part de 3,0 pour monter vers 3,6 à mesure que le roster se remplit.
L'économie s'accélère toute seule au moment où les nouvelles cartes se raréfient.
En simulation sur 300 parties : 3,4 boosters par jour, premier légendaire au
6ᵉ booster en moyenne, roster complet en quatre mois environ.

Le plafond ne s'applique qu'à l'accumulation passive : ce que le joueur est allé
chercher lui-même — une vente au Comptoir, une pesée d'étoile chez les kobolds —
se cumule sans limite. Le crédit passif se calcule sur un horodatage, donc il
continue de courir fenêtre fermée.

### Les doublons s'accumulent

Un exemplaire tombant dans une case déjà remplie **reste dans l'inventaire**.
C'est la matière première du Comptoir, où un acheteur du jour paie à peu près le
double du rachat garanti. La collection, elle, ne compte toujours qu'un
exemplaire par case : le surplus est ce qui dépasse, il se voit en pastille
ambre sur la vignette de la bibliothèque et se négocie au Comptoir.

La revente automatique d'origine reste disponible, éteinte par défaut, dans
Réglages → Doublons. La rallumer rend le comportement historique — le doublon
part sur-le-champ pour deux à cinquante PO — et plus aucun surplus n'atteint le
Comptoir.

### Les Mines de Kazim

Le module annonce ce que les kobolds ont payé ; l'application convertit. Une
pièce d'or kobolde en vaut quinze dans la bourse, dans la limite de 480 PO par
jour, remise à zéro à minuit. Le rapport et le plafond sont dans `MINE`
(`src/config/tiers.js`).

Mesuré : le joueur assidu double son rythme de boosters, l'occasionnel gagne un
sixième, le forcené est borné à deux fois et un tiers. La méthode, les
alternatives écartées et les réserves sont dans **`docs/audit-economie.md`**.

```bash
node scripts/audit-economie.mjs   # boosters par jour, par profil de jeu
node scripts/audit-marche.mjs     # prix par palier et garde-fous du Comptoir
```

Le porte-monnaie vit dans `localStorage` : quiconque avance l'horloge de sa
machine ou édite le stockage se donne autant de pièces qu'il veut. Pour un site
de campagne entre gens qui se connaissent, c'est sans importance. Rendre ça
inviolable demanderait des comptes et un serveur.

---

## Mode test

Réglages → Mode test. Rien n'a d'effet tant que l'interrupteur principal est
éteint, et les cartes obtenues rejoignent la bibliothèque comme les autres.

| Réglage | Effet |
|---------|-------|
| Pièces d'or | supprime le coût des boosters |
| Cartes par booster | de 1 à 10, la montée sur les deux derniers emplacements est conservée |
| Palier forcé | met toutes les cartes sur un palier, full art et PJ compris |
| Rainbow | force ou supprime l'irisation |

---

## Le tempo

Le rythme porte l'information autant que la couleur. Avant chaque retournement,
une lueur du palier monte sous le carte : on sait qu'il y a un coup avant de
pouvoir lire quoi que ce soit.

| Palier | Lueur | Retournement | Particules | Assombrissement |
|--------|-------|--------------|------------|-----------------|
| Commun | 150 ms | 430 ms | — | — |
| Peu commun | 230 ms | 470 ms | 8 | — |
| Rare | 470 ms | 640 ms | 16 | 24 % |
| Légendaire | 820 ms | 840 ms | 28 | 56 % |

Ces valeurs sont dans `src/config/tiers.js`.

---

## Gestes

| Geste | Effet |
|-------|-------|
| Glisser en travers du sachet | déchire le papier, proportionnellement à la distance |
| Bouton « Tout ouvrir d'un coup » | saute la révélation et affiche les cinq cartes |
| Toucher une carte face cachée | déclenche la lueur puis le retournement |
| Glisser une carte face visible | le dégage, avec inertie |
| Toucher une carte face visible | l'ouvre en plein écran |
| Bouger la souris sur une carte | incline la plaque et déplace l'irisation |
| Espace / Entrée / Flèche droite | équivalents clavier |
| Échap | ferme le plein écran |

L'irisation n'est pas une animation en boucle : la position des dégradés est
calculée depuis les mêmes variables CSS que la rotation 3D. Rien ne bouge tant
que la main ne bouge pas.

---

## Ajouter un booster

1. Convertir le roster : `npm run roster -- <fichier.xlsx> <identifiant>`
2. Importer le JSON dans l'objet `ROSTERS` de `src/App.jsx`
3. Déclarer l'entrée dans `src/config/boosters.js` avec `statut: "ouvert"`

Les boosters en `statut: "bientot"` apparaissent sur l'étagère, grisés et non
cliquables. Trois sont déjà déclarés en attente : Nakova, Rendez-vous à Odiana et Kobolds et Dragons.

---

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

Les filtres se lisent en deux rangs : l'**état** de la case — toutes, obtenues,
manquantes, en double, rainbow — puis la **rareté**, avec son avancement. Ils
portent sur les cases, pas sur les cartes : « en double » compte les cases à deux
exemplaires ou plus, « rainbow » isole les cases rainbow. Un champ de recherche
par nom complète l'ensemble, insensible aux accents et à la casse ; il ne servait
à rien sur quarante-huit cartes, il est indispensable sur trois cent quatorze. La rangée des raretés et les barres se taisent quand il n'y a
qu'un palier à montrer, c'est-à-dire sur l'onglet des PJ.

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

---

## Le Comptoir

Marché de l'occasion, à `#/comptoir`. Dix acheteurs, trois par jour plus le
Conservateur une fois sur dix, rachètent les exemplaires en trop — chacun avec
son goût, son prix et sa capacité à se laisser marchander.

**L'ordre de la page suit l'argent.** Les acheteurs du jour, puis les deux
mouvements immédiats côte à côte — le rayon et la vente rapide, alignés sur la
même ligne — et enfin le tri du surplus, carte par carte, qui demande de la
lecture. Le Registre a disparu : vingt lignes d'historique qu'on ne relit pas.
La Régie, elle, est passée derrière le point d'interrogation du titre.

### Le jour est la date réelle

Les acheteurs tournent avec le calendrier, pas avec un bouton. On revient
demain, on ne rejoue pas la journée. Le pas de sept sur dix acheteurs donne un
cycle de dix jours sans répétition immédiate ; le Conservateur Royal passe un
jour sur dix. Un marchandage ne survit pas à la nuit, ce qui est exactement ce
qui empêche de relancer le dé jusqu'à obtenir la bonne offre.

L'annonce du lendemain se lit en haut de page : elle ne nomme que l'acheteur qui
n'est pas déjà là.

### Ce à quoi ils s'intéressent

Les personnages, leurs portraits, leurs répliques et leurs coefficients viennent
du module d'origine et sont conservés tels quels. Ce qui change, c'est la
lecture : le module travaillait sur un set inventé et des étiquettes abstraites,
le Comptoir lit **les vrais repères du roster** — archétype, race, faction,
province, palier. Hector reconnaît donc un sergent d'infanterie, Nassim un lieu
de Thalazur, Oriane une conseillère ou un artéfact.

L'affinité a deux étages, dans `src/comptoir/acheteurs.js` :

- **`entree`** — au moins une famille doit passer, sinon l'acheteur ne regarde
  pas la carte. C'est là que se joue le caractère du personnage.
- **`primes`** — chacune ajoute une prime, jamais l'entrée.

La distinction vient d'un essai raté. Avec une seule liste mise en OU, un palier
suffisait à ouvrir la porte : « rare ou légendaire » cumulé à « désirable »
faisait qu'Ysée s'intéressait à trois quarts du set et qu'aucun acheteur n'avait
plus de goût. Les paliers et la cote sont des modulateurs, pas des portes
d'entrée.

### Comment un prix se forme

L'ancrage part du **prix de revente garanti par l'application**, pas d'une
échelle inventée : `REVENTE[palier] × 2,4`, corrigé de la désirabilité propre de
la carte et, pour une rainbow, du fait qu'elle tombe une fois sur trente-trois.
La conséquence tient en une phrase : le Comptoir paie toujours au moins ce que
l'échoppe automatique payait, sinon y aller serait une punition.

Autour de cet ancrage, le prix suit le remplissage du rayon. Chaque article a un
stock d'équilibre déduit de sa probabilité de tirage — une commune circule
soixante fois plus qu'une légendaire, son rayon est donc soixante fois plus
garni et son prix d'autant plus bas. Le rayon dérive vers cet équilibre jour
après jour, avec un bruit tiré d'une graine : deux visiteurs du même jour voient
le même marché.

Le module simulait cent vingt collectionneurs pour faire bouger les prix. Ils
ont été remplacés par ce flux agrégé, et ce n'est pas un raccourci de paresse :
cent vingt collectionneurs, il fallait les écrire dans le stockage local et les
rejouer à chaque jour écoulé, là où le flux tient en deux tableaux, se rattrape
en une passe et produit à l'écran exactement ce que le joueur percevait — des
prix qui montent, des rayons qui se vident, une bourse qui s'épuise.

### Le rayon du jour

L'échoppe vend aussi. Elle ne déballe pas ses huit cents cases : elle sort six
pièces, tirées de la graine du jour et pondérées par le rayon — donc surtout des
cartes courantes et une légendaire de loin en loin. Six et non huit : deux rangs
de trois tiennent exactement la hauteur de la vente rapide, à côté, et un rang
orphelin de deux se voyait.

Sans cette limite, le marché complet cassait la collection : une peu commune à
vingt-huit PO signifiait quatre cartes choisies pour le prix d'un booster, et
plus personne n'ouvrait de sachet. L'échoppe vend par ailleurs 2,6 fois ce
qu'elle rachète ; c'est sa marge sur les pièces à l'unité qui garde le booster
intéressant.

### La fenêtre de négoce

Le portrait fixe la hauteur du cadre. Les onze portraits sont des **découpes à
fond transparent** : le personnage est posé au bas de la scène, entier, sans
recadrage — ni ici, ni sur les fiches d'acheteur. Voir la charte graphique,
« Les portraits sont des découpes, pas des photographies ». Le panneau tient en trois zones — la carte et sa
quantité, les trois chiffres sur un rang séparé par des filets, les actions — et
la règle du marchandage vit dans une bulle d'aide.

**La liste des cartes qui l'intéressent est une grille, pas un tapis roulant.**
C'était une rangée unique défilant à l'horizontale sous un fondu : le fondu
disait bien qu'il y avait autre chose derrière le bord, mais avec cinquante
doublons il fallait le faire glisser à l'aveugle. Elle montre maintenant trois
rangs de pastilles à la fois, se filtre par le nom — accents et casse ignorés —
et **chaque pastille porte son prix unitaire**, l'information sur laquelle la
liste est triée. Le cadre prend les quelques dizaines de pixels que la grille
demande plutôt que de comprimer ses trois zones. Le
marchandage annonce son résultat : une demi-seconde de pesée pendant laquelle le
montant devient « … » et le bouton dit « Il examine… », puis le montant éclate
en vert ou tressaille en ambre brûlé, et le verdict s'ouvre dans un encadré de
la couleur de l'issue — le tout à place réservée, pour que la fenêtre ne
grandisse pas au moment du résultat. Les mesures et le raisonnement sont dans la charte
graphique.

### Les garde-fous

Deux ratios disent ce qu'un booster rapporte s'il est intégralement liquidé, en
part de son prix ; le second est le pire cas — meilleur acheteur, affinité
maximale, marchandage réussi. Tant qu'ils restent sous 100 %, le Comptoir n'est
pas une machine à pièces d'or.

Ils tiennent en une ligne au bas de la bulle du titre. **Le reste de la bulle
est pour le joueur** : quatre phrases, une idée par phrase, aucun mot de métier
— qui passe, quand ils changent, pourquoi ils paient mieux que l'échoppe, et ce
qu'on risque à marchander. La version précédente expliquait la calibration du
marché avant d'avoir dit ce qu'on fait ici ; elle était juste et illisible.

La Régie était un dépliant en bas de page : trois blocs, deux tableaux, et une
bascule qui doublait un réglage déjà présent dans les Réglages. C'est devenu ce
que sont le cours kobold et la règle du marchandage — une bulle qu'on lit une
fois. Les prix médians par palier, qui étaient de la curiosité de calibration,
se relisent avec `node scripts/audit-marche.mjs`. Mesures et méthode dans
`docs/audit-economie.md`.

---

## Le colporteur

**Mirko passe rarement.** Il s'arrête au bilan d'une ouverture, une fois par
jour au plus, avec une lanterne, un ballot et trois affaires dont **une seule**
peut être prise. Puis il reprend la route et ne repassera pas ce jour-là.

Une lanterne s'annonce sur la route, sa case arrive par la droite, le cadre
s'allume et tourne, il tangue au pas du marcheur, ses breloques accrochent la
lumière. C'est le seul endroit du site où la lumière chaude porte un fond : la
terre est froide partout ailleurs, et l'évènement doit se voir avant d'être lu.

### Ses affaires

Elles sont composées à partir de l'état réel de la collection — c'est ce qui
donne le sentiment qu'il a regardé dans le ballot. Une affaire impossible n'est
pas grisée, elle n'est pas proposée.

| Affaire | Ce qu'il fait | Prix |
|---------|---------------|------|
| **Le lot** | Il emporte tout le surplus d'un palier, sans trier | il paie ×2,2 la revente |
| **Le troc** | Trois doublons contre une carte manquante du palier au-dessus | rien |
| **Le pari** | Une carte scellée, peu commune au minimum, tirée devant vous | 55 PO |
| **La botte** | Un sachet sous le manteau, ouvert sur-le-champ | 70 PO au lieu de 120 |
| **L'irisation** | Il lustre un doublon jusqu'à l'écaille | 120 PO |

Le lot et le troc passent en tête quand ils sont possibles : ce sont les deux
qui répondent à un état de collection précis. La troisième place se tire au
sort parmi les autres, avec une graine stable pour la journée — rouvrir la page
pendant sa visite ne rebat pas les prix.

**Il ne remplace pas le Comptoir.** Le lot paie ×2,2 la revente là où un
acheteur affine paie ≈ ×3 : vendre à Mirko une carte qui a preneur au Comptoir
fait perdre un quart du prix. Ce qu'il apporte, c'est le volume et l'absence de
porte d'entrée — un commun qu'aucun acheteur du jour ne reconnaît ne se vend
nulle part ailleurs. Mesures dans `docs/audit-economie.md`, chapitre 8 :
son passage vaut **+0,07 booster par jour** au rythme nominal.

Aucune affaire n'est jamais grisée : celles que la bourse ne peut pas payer et
celles que la collection ne permet pas ne sont pas déballées. Un menu à moitié
inerte aurait été plus simple à écrire et bien moins bon à jouer.

**Il n'attend pas.** Sa visite vit dans l'état du composant, pas dans le
stockage : recharger la page pendant qu'il est là le fait repartir, et il ne
repassera pas ce jour-là. C'est cohérent avec le bilan, qui ne survit pas
davantage à un rechargement — seule une révélation interrompue est reprise.

Fréquence, tarifs et table du pari sont dans `src/config/colporteur.js`. Le
mode test a un levier « Colporteur » pour le faire passer à chaque booster.

---

## Les Mines de Kazim

Module idle, à `#/mines`. On frappe le filon, on embauche du monde, on descend,
on vend l'étoile aux kobolds. Le cadre cliquable, les vingt vignettes, les huit
strates, les compagnons, les talents et l'effondrement sont ceux du module
d'origine.

Ce qui a changé à l'intégration :

- **Les sprites sont des fichiers.** Le module les portait en base64 dans un
  second fichier : deux cents kilo-octets qui traversaient le bundle à chaque
  chargement de l'application, pour vingt vignettes de sept kilo-octets qu'un
  navigateur met en cache. Elles vivent dans `public/kazim/` et ne se chargent
  que si l'onglet est ouvert. Même traitement pour les onze portraits taillés
  dans la planche — dix acheteurs, le Conservateur, et Mirko qui a quitté le
  Comptoir pour la route : 3,4 Mo de base64 devenus 472 Ko de fichiers.
- **Les styles sont une feuille.** Ils vivaient dans un gabarit injecté par
  `dangerouslySetInnerHTML` à chaque montage ; ils sont dans
  `src/styles/kazim.css`, analysés une fois et mis en cache.
- **Le module ne touche jamais au porte-monnaie.** Il annonce un gain par
  `onPO`, l'application convertit et crédite.
- **La page ne tient plus de comptabilité.** Elle a porté un temps le quota du
  jour, sa jauge, la pesée et la conversion « une pièce kobolde en vaut quinze
  ici ». L'intention était de ne pas laisser le plafond se découvrir en
  silence ; l'effet était l'inverse — deux monnaies du même nom sur un écran, un
  compteur à zéro tant qu'on n'a rien vendu, et un rapprochement avec le gain
  passif de la boutique, qui n'a rien à faire dans un module de jeu. **La mine
  est du jeu ; les pièces d'or sont l'affaire de la boutique.** Le plafond
  existe toujours et ne s'annonce plus que le jour où il mord, en une phrase.
  Reste un mot : la plaque dit « PO kobold », pas « PO versés », parce que le
  bandeau du site affiche sa propre bourse en PO au même moment.
- **Son titre est un `h2`**, et masqué sur sa page, qui porte déjà le `h1`.
- **Plus un seul sous-titre.** Le journal de cinq lignes était devenu une ligne
  d'état dans l'en-tête ; il n'y a plus rien à l'écran, et la phrase d'ambiance
  de chaque strate — « le schiste grince, l'étoile y perle en grains » — est
  partie avec. Ce qu'elles annonçaient se lit là où on en a besoin : les points
  de talent sur une pastille de leur onglet, l'étoile et l'or sur leurs
  plaques. La région vocale demeure, hors écran, parce qu'un lecteur d'écran n'a
  pas ces plaques sous les yeux.
- **Le module ne pose plus son propre fond.** Il portait un `--ground` opaque
  par-dessus celui de la page, et deux dégradés radiaux par-dessus encore —
  trois couches pour reproduire, à un ton près, ce que la page affichait déjà.
  À un ton près, justement : d'où la couture visible, un rectangle plus clair
  posé sur la page. La mine est une section de la page, pas une fenêtre dans la
  page. (Le voile chaud du coin haut-gauche était parti avant, pour la même
  raison : il lavait le bandeau des plaques d'un jaune pâle sans rien
  signifier. La lumière chaude reste là où elle est produite — le fanal du
  filon, la lueur des ventes.)

### Ce qui s'ouvre, et quand

Les cinq onglets étaient là dès la première seconde, et quatre d'entre eux ne
voulaient rien dire : l'Échoppe sans étoile à vendre, le Chantier sans étoile
pour acheter, les Talents sans point à placer, l'Effondrement qui exige la
profondeur 5. On arrivait devant un tableau de bord d'usine pour un seul geste
possible — frapper.

| Onglet | S'ouvre | Ce qu'il apporte |
|--------|---------|------------------|
| Compagnons | d'emblée | quelqu'un creuse à votre place |
| Échoppe kobolde | 1ᵉʳ filon brisé | l'étoile devient des pièces d'or |
| Chantier | 4 filons | du matériel, acheté une fois pour toutes |
| Talents | niveau 2 | un point par niveau |
| Effondrement | profondeur 5 | tout recommencer, en plus fort |

Le prédicat lit l'état, rien n'est stocké : une sauvegarde ancienne retrouve
tous ses onglets au chargement. Un onglet qui vient de s'ouvrir porte un point
ambre jusqu'à ce qu'on l'ouvre, et son ouverture est annoncée dans la région
vocale. L'ordre du tableau est l'ordre d'ouverture, donc l'ordre d'affichage :
la rangée se lit de gauche à droite comme une progression.

Et parce que rien, dans une roche dessinée, ne dit qu'elle se frappe : **une
ligne « Frappez la roche » le temps du premier filon**, puis plus jamais.

### Le vocabulaire, et le lexique

Un jeu de mine a son vocabulaire, et il vaut mieux qu'il en ait un : « le filon
cède » dit quelque chose que « le compteur atteint zéro » ne dit pas. Mais un
mot d'ambiance qui porte une mécanique doit être définissable en une phrase, et
cette phrase doit être quelque part.

Deux mouvements, donc. D'abord **ce qui n'était pas du vocabulaire mais de la
formule recopiée** a été réécrit. « Une frappe vaut 0,12 s de production de plus
par point » est la définition exacte de `secondesParFrappe` : le joueur n'a pas
à lire le code pour savoir s'il doit dépenser son point. « Poche d'étoile pure »
et « filon en éventail » nommaient deux fois la même chose — un filon qui rend
plus — sans dire combien.

| avant | après |
|-------|-------|
| une frappe vaut 0,12 s de production de plus | vos coups de pioche font plus mal |
| charge la résonance, qui bonifie votre prochaine vente | fait monter le prix de votre prochaine vente |
| poche d'étoile pure · filon en éventail | filon exceptionnel · filon généreux |
| points de roche | résistance du filon |
| cours kobold | prix de rachat |
| Fatigue de la run | Ils se lassent |
| Dette d'effondrement | Mines déjà abandonnées |
| Versé sur cette run | Versé dans cette mine |

Ensuite, **le lexique**, derrière un bouton de l'en-tête. Dix mots, une phrase
chacun, et il ne montre que ceux déjà rencontrés : lire la définition de
l'effondrement au premier coup de pioche n'apprend rien à personne. Il s'ouvre
en surimpression, jamais dans le flux — ouvert ou fermé, la mine garde la même
hauteur, ce qui est la règle de la section suivante.

### Les filons qui rendent plus se voient

Un filon sur trois pouvait rendre quatre ou douze fois plus, et **rien ne le
disait avant qu'il ne cède** : la récompense arrivait après coup, sans cause
visible, et douze points placés dans Fortune ne se voyaient donc nulle part.

Le sort se joue maintenant **à la naissance du bloc** et non à sa rupture — la
probabilité n'a pas bougé d'un millième, mais on voit le filon riche avant de le
casser, et on se jette dessus. La roche prend sa couleur en conséquence :

| rang | roche | éclats | halo | cartouche |
|------|-------|--------|------|-----------|
| ordinaire | schiste froid | étoile bleue | — | — |
| généreux (×4) | teintée | **restent froids** | — | « Filon généreux ×4 » |
| exceptionnel (×12) | saturée | teintés, allumés | respire | « Filon exceptionnel ×12 » |

Le rang 2 n'est pas « le rang 1 en plus saturé » : à douze points de Fortune la
teinte vire au rouge pour les deux, et deux rouges voisins ne se distinguent
pas. Ce sont les éclats — froids sur pierre chaude, allumés sur pierre chargée —
et le souffle du halo qui les séparent.

**La teinte dit jusqu'où on a poussé Fortune.** Une variable, `--kz-teinte`,
posée par le composant : 40° (ambre) sans un point, 0° (rouge franc) à dix. Tout
le bloc CSS en dérive — la pierre, la lueur, le halo, la bordure, le cartouche —
donc une seule ligne de JavaScript déplace l'ensemble. Le talent gouverne la
fréquence ; la couleur dit l'investissement, ce qu'aucun chiffre ne disait. Le
cartouche écrit le multiplicateur, parce qu'une teinte seule ne dit rien à qui
les distingue mal, et l'onglet des talents affiche « un filon sur *n* ».

### La mine ne change plus de taille

Elle mesurait ce que son contenu mesurait. Le premier compagnon embauché
faisait apparaître la rangée de jetons et poussait le panneau de gauche de
vingt-cinq pixels ; un onglet un peu long faisait grandir celui de droite. On
jouait sur une page qui changeait de taille à chaque achat — c'est-à-dire au
moment précis où le regard était ailleurs.

La grille pose sa hauteur une fois, en fonction de la fenêtre et non du
contenu : `height: clamp(560px, 72vh, 780px)`, `align-items: stretch`. Les deux
panneaux la remplissent, et ce qui dépasse défile à l'intérieur — le filon se
dilate pour prendre ce qui reste, la liste d'onglet glisse.

**La rangée de ce qu'on a acheté a déménagé dans l'en-tête.** Elle vivait au
pied de la colonne de gauche, où elle prenait soixante pixels de roche et
poussait le panneau à chaque embauche ; l'en-tête avait, lui, une bande vide de
neuf cents pixels entre les plaques et le lexique. Les deux problèmes se
résolvaient l'un l'autre. Elle tient sur une seule ligne, `flex-wrap: nowrap` :
vingt jetons de quarante pixels entrent dans la bande, et au-delà elle glisse
latéralement plutôt que de passer à la ligne — l'en-tête doit garder la hauteur
des plaques quoi qu'on achète, sinon toute la mine redescend au moment d'un
achat, ce qu'on venait précisément de corriger en bas de colonne.

**Et une barre fixe dans une colonne flex doit refuser de rétrécir.** La rangée
d'onglets n'avait pas de `flex` déclaré, donc `flex-shrink: 1` par défaut : dès
qu'un onglet un peu long faisait déborder le corps, elle se laissait comprimer
par ce débordement et se faisait rogner par l'`overflow: hidden` du panneau. On
lisait la moitié basse des libellés, sans qu'aucune règle n'échoue. `flex: 0 0
auto` — c'est la quatrième variété d'échec silencieux de feuille de style
rencontrée sur ce projet, après le sélecteur orphelin, le `[hidden]` battu par
une classe et le `z-index` sous une couche.

Au-dessus de 1024 × 700, la page reprend la main et donne au module toute la
hauteur de la fenêtre (`.mines .kz-grid { flex: 1 }`) : la hauteur fixe ne sert
que sous ce seuil.
- **L'explication du cours kobold est passée derrière un point
  d'interrogation.** Quatre lignes à lire une fois et à subir ensuite,
  au-dessus des boutons de vente.
- **Le semis d'étoile couvre toujours la même part de la roche** (voir la charte
  graphique) : il variait du simple au décuple d'un filon à l'autre.
- **Le cadre du filon répond au clavier.** Il portait `role="button"` et
  n'écoutait que le pointeur, ce que la charte du projet interdit
  explicitement — Entrée et Espace frappent maintenant le filon.

---

## Export, import

La bibliothèque vit dans `localStorage` sous la clé `brume-thalazur:v1` :
collections par booster, compteurs d'ouverture, réglages, rosters chargés à la
main et corrections de palier.

**Exporter** produit un fichier JSON daté. **Importer** propose deux modes :
fusion (les doublons s'additionnent, l'état rainbow est conservé dès qu'il
apparaît d'un côté) ou remplacement complet.

Le bouton « Tout effacer » des réglages vide la clé et recharge la page.

---

## Structure

```
src/
  App.jsx           coque du site : bandeau, navigation, aiguillage
  jeu/
    Jeu.jsx         l'état du jeu, partagé par les six pages
  routes/
    PageAccueil.jsx      vitrine : campagne, avancement, les quatre lieux
    PageBoutique.jsx     étagère des extensions
    PageOuverture.jsx    /boutique/<id> : la cérémonie du sachet
    PageBibliotheque.jsx
    PageComptoir.jsx     chargée à la demande
    PageMines.jsx        chargée à la demande
    PageReglages.jsx
  comptoir/
    marche.js       cotations, rayon, échoppe, jour réel, garde-fous
    acheteurs.js    les dix acheteurs, le Conservateur, et leurs affinités
    useMarche.js    le marché monté une fois par extension et par journée
    Negoce.jsx      la fenêtre de négociation
    teintes.js      encres de rareté vérifiées, dos de carte
  mines/
    MinesDeKazim.jsx  le module idle, porté en module ES
  config/
    tiers.js        paliers, teintes, tables d'emplacement, tempo, économie, mine
    boosters.js     catalogue des extensions
    colporteur.js   passage de Mirko, ses cinq affaires, leur arithmétique
    cadre.js        géométrie du cadre et ligne de découpe du sachet
  lib/
    routeur.jsx     routeur par fragment, sans dépendance
    roster.js       lecture des colonnes, déduction des paliers, pool
    draw.js         tirage d'un booster
    images.js       cascade de résolution des portraits
    ajuste.js       réduction du corps jusqu'à ce que le texte tienne
    dechirure.js    clip-path du bord déchiré
    audio.js        synthèse Web Audio, aucun fichier son
    economie.js     porte-monnaie, gain passif, crédits hors plafond
    storage.js      persistance locale v5, export, import
  components/
    Etagere.jsx     l'étagère des extensions
    Chrono.jsx      compte à rebours des 15 PO suivantes
    Ouverture.jsx   sachet → sortie des cartes → révélation → bilan
    Colporteur.jsx  l'évènement rare du bilan : sa case, son arrivée, ses affaires
    Sachet.jsx      déchirure au premier quart, au glissement
    Carte.jsx       inclinaison, retournement, balayage, plein écran
    FaceCarte.jsx   face avant, zones de texte, teinte de rareté, irisation
    DosCarte.jsx    dos commun à tous les paliers
    Bibliotheque.jsx
    Reglages.jsx
    Loupe.jsx
    Brume.jsx
  styles/
    tokens.css      palette et typographie
    base.css        chrome de l'application
    site.css        coque, navigation, accueil
    cards.css       les cartes
    app.css         brume, étagère, ouverture, bibliothèque
    colporteur.css  la case animée de Mirko
    comptoir.css    le Comptoir et le négoce
    kazim.css       les Mines
scripts/
  xlsx-to-json.mjs      conversion d'un roster
  audit-economie.mjs    boosters par jour, par profil de jeu
  audit-marche.mjs      prix par palier et garde-fous du Comptoir
  audit-colporteur.mjs  fréquence de passage et injection de PO du colporteur
data/
  troupe-valeran.json
public/
  carte-cadre.webp  carte-dos.webp  sachet-troupe.webp
  portraits/
  comptoir/         les onze portraits taillés dans la planche, en WebP
  kazim/            les vingt vignettes de la mine, en WebP
docs/
  charte-graphique.md
  audit-economie.md
```

---

## Charte graphique

`docs/charte-graphique.md` fait référence pour la palette, la typographie, les
dimensions, le mouvement, l'accessibilité et les pièges vérifiés. Les valeurs y
sont extraites du code, pas recopiées : en cas de divergence, `tokens.css` et
`tiers.js` font foi.

---

## Accessibilité

Ce qui a été vérifié et corrigé :

- **Contrastes** mesurés puis relevés. `--ink4` tombait à 2,55:1 sur les panneaux
  et `--ink3` à 4,31 ; les deux atteignent maintenant 4,5:1 sur la surface la
  plus claire de l'interface. Un jeton `--edge-ui` distinct a été introduit pour
  les bordures d'éléments interactifs, que WCAG 1.4.11 exige à 3:1 — les
  bordures décoratives plafonnaient à 1,6.
- **Cartes opérables au clavier** : elles n'étaient que des `div` à écouteurs de
  pointeur, donc hors du parcours de tabulation et muettes. Elles portent
  maintenant `role="button"`, un index de tabulation, une étiquette explicite et
  la gestion d'Entrée et Espace.
- **Plein écran** : `aria-modal`, piège à focus, focus rendu à l'élément
  d'origine à la fermeture, fermeture par Échap.
- **Annonce vocale de la révélation** : sans elle, un lecteur d'écran ne recevait
  rien pendant toute l'ouverture. Une région discrète annonce le nom, le palier,
  la mention Rainbow, la nouveauté et le nombre de cartes restantes.
- **Repère principal** (`<main>`) sur chaque vue et **lien d'évitement** vers le
  contenu — la navigation défile horizontalement sur mobile et était longue à
  franchir à la tabulation.
- **États ARIA** sur les bascules : `aria-pressed` sur la version affichée, les
  filtres de rareté et le sélecteur de set. Étiquette sur chaque sélecteur de
  palier de grade, qui n'était identifié que visuellement.
- **Mouvement réduit** respecté partout, y compris la sortie des cartes du
  sachet, qui restait vide sans transformation finale explicite.

Ajouté avec les pages et les deux modules :

- **Le focus suit le changement de page.** Sur un site en une seule page, le
  navigateur ne remet ni le défilement ni le focus : on arrivait au Comptoir au
  milieu de la page et la tabulation reprenait là où elle était. Le titre de la
  page reçoit maintenant le focus, avec quelques images d'attente pour les deux
  pages chargées à la demande, dont le titre n'existe pas encore au moment où
  l'adresse change.
- **Un seul `h1` par page.** « Bibliothèque » et « Réglages » portaient un `h2`
  du temps où elles étaient des vues ; le titre interne des Mines faisait
  doublon avec celui de la page.
- **Le cadre du filon répond à Entrée et à Espace.** Il portait `role="button"`
  et n'écoutait que le pointeur.
- **La fenêtre de négoce est un dialogue complet** : `aria-modal`, piège à
  focus, focus rendu à l'élément d'origine, fermeture par Échap. Le module
  d'origine n'avait qu'un fond cliquable, donc la tabulation sortait derrière la
  fenêtre et l'on marchandait à l'aveugle.
- **La navigation descend sous le pouce en dessous de 860 px**, en barre fixe à
  six entrées. Le nom complet reste dans le flux pour le nom accessible du lien,
  seul l'affichage prend une version courte.
- **Contrastes des nouvelles couleurs mesurés.** Un échec trouvé et corrigé :
  `--m-chene` en texte tombait à 4,35:1. Le piège est celui que la charte
  signale déjà — une teinte de palier n'est pas une encre.
- **Mouvement réduit respecté sur les six pages.** La règle vivait dans la
  feuille du Comptoir, qui n'est chargée qu'avec sa page : la veilleuse de la
  bourse continuait de battre partout ailleurs.

Ce qui reste imparfait : le geste de déchirure n'est pas reproductible au
clavier, mais deux boutons offrent le même résultat juste en dessous.

---

## Notes de conception

Le sol de l'interface est froid — brume de nuit sur l'eau — et la lumière est
chaude, celle d'une lampe à huile de camp. Les cartes sont la seule source
lumineuse de l'écran ; c'est aussi ce qui permet aux modes de fusion `color-dodge`
et `screen` de l'irisation de fonctionner, ce qu'un fond clair rendait impossible.
Le bleu du cadre trouve naturellement sa place sur ce sol.

Les deux faces sont dessinées au même format, 1024 × 1536, et leurs angles
peints ont un rayon voisin — 33 px pour le cadre, 35 px pour le dos, soit un peu
plus de 3,2 % de la largeur. Le `border-radius` CSS est réglé à 3,7 % / 2,47 %,
juste au-dessus, pour découper sans laisser passer les angles noirs des PNG et
sans arrondir davantage que le dessin.

Typographie : Fraunces pour l'affichage, avec l'axe `WONK` activé qui donne sa
coupe légèrement gravée, et Archivo pour l'interface.

Le son est intégralement synthétisé — bruit blanc filtré pour les matières,
oscillateurs pour les paliers. Le contexte audio ne s'ouvre qu'au premier geste,
ce qui satisfait les règles d'autoplay des navigateurs.

Les préférences `prefers-reduced-motion` sont respectées : les animations
d'ambiance et de révélation sont coupées, la lueur reste affichée en statique
pour ne pas perdre l'information de rareté.
