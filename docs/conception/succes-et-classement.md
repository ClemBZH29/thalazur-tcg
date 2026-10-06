# Succès, titres et classement

Raisonnement de conception : ce que fait cette partie du site, et pourquoi elle le fait ainsi. Pour travailler sur le projet, voir le [README](../../README.md).

## Les succès

Une page, `#/succes`, et une entrée de navigation partagée avec le
classement. La pastille ambrée compte les paliers atteints qui attendent
d'être réclamés.

**Deux catégories.**

- **Global** : ce que l'on fait sur tout le site. Boosters ouverts (toutes
  extensions), strate atteinte et effondrements aux Mines, exemplaires vendus
  au Comptoir, affaires conclues avec Mirko, gardiens et remontées du Donjon,
  expéditions accueillies et Lieux passés en rainbow par les routes,
  exemplaires dissous et cartes forgées au Reliquaire, expérience des cartes
  (niveau le plus haut, paliers rainbow atteints par l'XP, cartes au niveau
  100 — Donjon et expéditions confondus), carte PJ. Le barème Global rend
  144 boosters d'équivalent en tout, à gagner sur des mois.
- **Collection**, par extension : complétion (25, 50, 75, 90, 100 %),
  cartes par type (PNJ, artéfacts, lieux : 10, 25, 50, 75 % du type puis « tous »),
  légendaires (une, la moitié, toutes), irisées, pleine illustration.

Le barème est dans `src/config/succes.js`. Les familles de collection sont
**construites à partir du roster** (`src/succes/regles.js`) : une extension
qui ouvre apporte ses succès sans qu'on touche au code, et une extension
« bientôt » n'en a aucun — rien de son contenu n'est dévoilé.

**Posséder, c'est avoir la case normale remplie**, le critère de la
bibliothèque. La complétion ne compte que le roster : les full art, à une
chance sur 4096 par booster, rendraient les 100 % inatteignables ; ils ont
leur propre famille. Le pourcentage est arrondi par défaut : 100 % veut dire
toutes les cartes, jamais 219 sur 220.

### Les récompenses : des PO et des sachets

Pas de cosmétique : une récompense est des PO, des **sachets offerts**, ou
les deux. Un sachet offert s'ouvre sans payer depuis la boutique, et compte
comme un booster ouvert. Ceux d'une famille de collection sont des sachets de
l'extension — ils rapprochent de la complétion, leurs doublons nourrissent
le Comptoir ; ceux d'une famille globale sont **au choix**, à ouvrir dans
n'importe quelle extension. L'extension passe avant le choix, pour garder
les sachets libres pour la suivante. Les PO passent hors du plafond
d'accumulation, comme tout ce que le joueur est allé chercher lui-même.

La boucle « plus tu gagnes, plus tu gagnes » est réelle — un sachet offert
compte vers le palier suivant — et elle s'éteint d'elle-même : chaque palier
rend moins que ce qu'il a coûté, et de moins en moins.

### Le barème refait sur le retour bêta (07/10/2026)

**Ce qu'ont montré les deux premières parties.** Le premier bêta-testeur a
touché en une heure 3 300 PO et 6 sachets de succès, l'équivalent de
33 boosters — onze jours de gain passif. Les quatre paliers de strate des
Mines (1 560 PO) tombaient en vingt-six minutes, les quatre premiers paliers
de PNJ (780 PO) en même temps. Sur la partie de Clément, neuf jours, 74 des
179 boosters ouverts venaient des succès. Les deux effets secondaires étaient
visibles : le Comptoir ne servait à rien (pourquoi vendre quand les PO
pleuvent), et l'apprentissage du Donjon, indexé sur les boosters, était
consommé avant la première descente.

**Ce que font les TCG en ligne.** Hearthstone, Pokémon TCG Pocket, Marvel
Snap et MTG Arena tiennent tous la même ligne :

- l'accueil est généreux mais **borné** — les missions de débutant de Pocket,
  les premiers paliers de Hearthstone — et ne vaut jamais une semaine de jeu ;
- la récompense **grossit avec la difficulté** du palier ; les premiers
  paliers paient en petite monnaie, les paquets vont aux paliers durs ;
- la collection se mesure **en part du set** (missions de set de Pocket,
  niveau de collection de Snap), pas en nombre fixe de cartes ;
- le gros du revenu régulier vient d'un **flux** (quêtes du jour et de la
  semaine, piste de récompenses), pas du stock des succès.

**Ce qui change** (`src/config/succes.js`) :

- les premiers paliers de chaque famille globale passent à 30 ou 60 PO, les
  sachets ne viennent qu'aux paliers qui demandent des jours ou des semaines ;
- **strate** : 5, 8, 12, 16 (au lieu de 3, 5, 8, 12, 20), calés sur la
  nouvelle pente des Mines — 120 PO, puis 1, 2 et 4 sachets ;
- **boosters ouverts** : 25, 100, 300, 1 000 (le premier était à 10) ;
- **types de carte** : 10, 25, 50 et 75 % du type puis « tous », au lieu de
  5, 10, 25, 50, 100 cartes ; 30, 60, 120 PO, un sachet, trois sachets ;
- **complétion** : rééquilibrée vers la fin (1, 2, 4, 6 + 240 PO,
  12 + 600 PO) ;
- un palier dont le seuil a bougé sous un palier **déjà réclamé** de la même
  famille compte comme réclamé (`seuilsReclames`) : personne ne se fait
  repayer un chemin déjà fait sous un autre nom.

Mesuré par `scripts/audit-succes.mjs` sur le roster de La Troupe, en ouvrant
aussi les sachets offerts et sans rien acheter au Comptoir :

| Complétion | Boosters ouverts | Part offerte, avant | Part offerte, après |
|---:|---:|---:|---:|
| 25 % | 14 | 53 % | 18 % |
| 50 % | 33 | 45 % | 22 % |
| 75 % | 70 | 37 % | 20 % |
| 90 % | 133 | 29 % | 21 % |
| 100 % | 576 | 13 % | 10 % |

Le barème complet rend 144 boosters en Global (188 avant) et 67 par
extension (72). Rejouée sous le nouveau barème et la nouvelle pente des
Mines, la première heure du bêta-testeur rapporterait de l'ordre de
1 100 PO et 5 sachets, un peu plus de trois jours de gain passif, au lieu
de onze.

### Prochaine étape proposée : un flux plutôt qu'un stock

Les succès restent un stock : une fois les paliers faciles pris, ils ne
rapportent presque plus rien pendant des semaines, et le joueur n'a pas de
raison du jour de revenir. Les TCG cités comblent ce creux par des
**missions** renouvelées, sans lesquelles leurs succès seraient trop
généreux ou trop avares :

- **missions du jour** (trois, tirées parmi les modes : « ouvrir 2 boosters »,
  « vendre 3 cartes au Comptoir », « vaincre un gardien », « lancer une
  expédition »…), de l'ordre de 40 PO chacune, une remplaçable par jour ;
- **mission de la semaine**, plus longue, payée en sachet ;
- éventuellement une **piste de rang** alimentée par les missions, dont les
  paliers donnent des sachets et les titres — la « piste de récompenses » de
  Hearthstone, le niveau de collection de Snap.

C'est ce flux qui portera la récompense du joueur assidu, à la place des
gros paliers du premier jour. À chiffrer avec le même audit avant de
l'ouvrir.

### Réclamer

Un palier atteint ne paie pas tout seul : il se réclame, un par un ou tous
d'un coup. C'est ce qui rend la mise en service rétroactive sans surprise :
les joueurs actuels trouvent leurs paliers déjà atteints en attente, avec le
bouton. Les ventes au Comptoir et les affaires du colporteur, que rien ne
comptait avant, partent de zéro.

Chaque identifiant est revérifié au moment de la réclamation, sur la partie
du moment : deux clics rapides ne paient qu'une fois.

### Deux appareils

Un succès réclamé laisse dans la partie la date et ce qu'il a rapporté :
`succes[id] = { t, po, n, cle }`. La fusion (`src/lib/nuage/fusion.js`) en
fait l'union, en gardant la date la plus ancienne. Si le même palier a été
réclamé sur les deux appareils depuis la dernière synchronisation, il a été
payé deux fois — les PO et les sachets sont des compteurs qui
s'additionnent — et la fusion reprend un des deux paiements, lu dans la
réclamation elle-même, sans relire le barème. Les sachets offerts se
fusionnent comme les exemplaires : un sachet ouvert ici disparaît là-bas.

## Les titres

Certains paliers portent un titre, gagné en réclamant le palier. Le joueur en
choisit un dans son profil ; il s'affiche au classement sous son pseudo. Les
noms actuels sont **provisoires** (`src/config/succes.js`, champ `titre`) : à
remplacer par des noms de la campagne.

À part, les **titres de primauté** : « Première complétion de La Troupe »
revient à qui a réclamé ses 100 % le premier. Il n'y en a qu'un par
extension ; il n'est pas stocké, mais calculé à la lecture du classement en
comparant les dates de réclamation (`primautes()`). La date vient de
l'horloge de l'appareil : entre joueurs qui se connaissent, c'est suffisant.

## Le classement

`#/succes/classement`, réservé aux joueurs connectés. Deux vues :

- **Général** : un score de progression, la complétion de toutes les
  extensions ouvertes **pondérée par la rareté** (une légendaire compte huit
  communes, `POIDS_SCORE`). Sans pondération, le premier serait celui qui a
  ouvert le plus de sachets ; les boosters ont leur propre colonne. Le score
  baisse pour tout le monde le jour où une extension ouvre.
- **Par extension** : la complétion, puis les irisées pour départager.

### Ce qui est publié, et quand

Rien, tant que le joueur n'a pas coché « apparaître au classement » —
décoché par défaut, à la première connexion comme au profil. Figurer au
classement se demande, cela ne se suppose pas.

Coché, un document `classement/{uid}` contient le pseudo, le titre affiché,
le score, la complétion et les irisées par extension, les boosters ouverts,
la strate atteinte, le nombre de succès et les dates de complétion. **Rien du
compte Google** : ni nom, ni photo, ni adresse. Il est republié après chaque
synchronisation réussie quand il a changé (et une fois par mois pour
repousser son échéance), effacé dès que le joueur décoche, et supprimé avec
le compte. `scripts/purge-comptes.mjs` l'efface avec la partie.

Les règles Firestore le rendent lisible par tout joueur connecté, modifiable
par son seul propriétaire, et vérifient sa forme et ses bornes (pseudo de 2 à
24 caractères, score sur dix mille…). Elles ne prétendent pas empêcher la
triche : la partie vit dans le navigateur, et l'audit d'économie a déjà jugé
la chose sans importance entre amis. Un classement la rend seulement visible.

## Le pseudo, demandé à la première connexion

Une fenêtre s'ouvre à la première connexion d'un compte sans pseudo
(`src/components/ChoixPseudo.jsx`). Elle vient là, plutôt qu'enfouie dans le
profil, pour que la question se pose avant que quoi que ce soit ne se montre
aux autres : le joueur y apprend qu'**il n'a pas à donner son vrai nom**. Le
champ ne propose rien — préremplir avec le nom Google en ferait la réponse
par défaut. La même fenêtre offre la case du classement, décochée.

« Plus tard » la ferme pour de bon (`profil.pseudoReporte`) ; le pseudo et le
classement restent au profil. Un joueur qui avait déjà un pseudo ne la voit
pas : il avait choisi ce nom quand le profil le disait privé, il ne figure
donc au classement que s'il le demande.

Le pseudo est nettoyé (`nettoyerPseudo`) : espaces resserrés, caractères de
contrôle et de mise en forme invisibles retirés, 24 caractères au plus.
