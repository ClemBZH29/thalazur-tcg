# Succès, titres et classement

Raisonnement de conception : ce que fait cette partie du site, et pourquoi elle le fait ainsi. Pour travailler sur le projet, voir le [README](../../README.md).

## Les succès

Une page, `#/succes`, et une entrée de navigation partagée avec le
classement. La pastille ambrée compte les paliers atteints qui attendent
d'être réclamés.

**Des chapitres** (`CHAPITRES`, 09/10/2026), un par module, puis un par
extension ouverte — la table des matières du futur grimoire :

| Chapitre | Familles |
|---|---|
| La Boutique | boosters ouverts, cartes PJ (exploit caché) |
| Les Mines de Kazim | strate, effondrements, commandes de Tafix, faveurs du Fossoyeur |
| Le Donjon | gardiens, donjon du jour mené au bout, record de l'infini |
| Les Routes | expéditions, Lieux passés en rainbow |
| Le Négoce | ventes et achats au Comptoir, affaires de Mirko |
| Le Reliquaire | dissolutions, forges |
| Les Missions | missions du jour, missions de la semaine |
| Les Cartes | niveau le plus haut, paliers rainbow par l'expérience, centenaires |
| *Une extension* | complétion, types, légendaires, rainbow jusqu'au set complet, pleine illustration, provinces |

Les **provinces** reprennent les regroupements de Gaspard au Comptoir, plus
la Troupe et le Bestiaire : un palier, toutes les cartes de la province, et
son titre. Une province de moins de huit cartes dans l'extension n'a pas de
famille.

Un palier **caché** (`cache`) ne montre ni son seuil ni sa récompense avant
d'être atteint : cartes PJ, full art, douze gardiens en une descente
infinie. Ce sont des exploits — de la chance ou une équipe hors norme —, pas
des objectifs.

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
- un palier dont le seuil a bougé sous un palier **réclamé sous l'ancien
  barème** de la même famille compte comme réclamé (`seuilsAnciens`) :
  personne ne se fait repayer un chemin déjà fait sous un autre nom. Une
  réclamation est « de l'ancien barème » quand son palier n'est plus au
  catalogue, ou quand la récompense qu'elle a enregistrée n'est plus celle du
  palier. Une réclamation du barème actuel ne couvre qu'elle-même : réclamer
  « 100 boosters » avant « 25 » laisse « 25 » à réclamer (09/10/2026 ; un
  joueur que l'ancienne règle en avait privé le retrouve en attente).
- les paliers de type et de légendaires sont des parts du roster : quand le
  roster grandit, « la moitié des PNJ » glisse de 100 à 102 et change
  d'identifiant. Un ancien seuil couvre donc aussi un palier à peine
  au-dessus de lui (un dixième du seuil, une carte au moins) : le même palier
  ne se paie pas deux fois, et son titre reste acquis.

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

### Le barème refait en chapitres (09/10/2026)

L'audit du 09/10/2026 (`claude/audit-succes.md` dans le projet) a rejoué le
barème du 07/10 sur trois habitudes de jeu, avec les rythmes mesurés par les
autres audits (`scripts/audit-succes.mjs`, partie 3). Trois défauts :

- **un stock vidé en un mois** : un joueur d'une heure par jour prenait
  58 paliers sur 80 dans son premier mois, et il ne lui en restait que cinq
  au-delà du troisième. Les missions donnent une raison de revenir chaque
  jour ; les succès n'en donnaient plus aucune de viser loin ;
- **un palier inatteignable** : la strate 16. La pente des Mines plafonne
  vers la quinzième, quel que soit le temps de jeu (`audit-strates.mjs`) ;
- **des modules absents** : rien pour les missions, les commandes de Tafix,
  la Faveur du Fossoyeur, le donjon infini, les achats au Comptoir ; rien
  par province ; les rainbow s'arrêtaient à 25 cartes sur 220.

**Ce qui change** (`src/config/succes.js`) :

- chaque famille a une **queue** de six mois à un an (2 500 boosters,
  400 gardiens, 4 000 ventes, 1 000 missions…), les premiers paliers paient
  en PO, les sachets viennent aux paliers qui demandent des semaines ;
- strate : 5, 8, 11, 13, 15 ;
- familles nouvelles : commandes de Tafix, faveurs du Fossoyeur, record du
  donjon infini (le seul succès qui mesure la force de l'équipe), achats au
  Comptoir, missions du jour et de la semaine, provinces, rainbow à la
  moitié puis au set complet (le « master set » des TCG), toutes les full art ;
- le palier de 10 % par type et le premier palier de province sont partis :
  ils tombaient au premier booster ;
- complétion : 120 PO à 25 %, puis 1, 3, 6 + 240 PO, 12 + 600 PO.

Les missions accomplies se comptent dans `stats.missions` et
`stats.semaines` (`payer`, `src/missions/regles.js`). Une mission payée sur
deux appareils n'y compte qu'une fois : la fusion retire le doublon qu'elle
reprend déjà en PO (`fusionnerMissions`).

Chaque palier porte des **points de renommée** (`pointsDe`) : dix par booster
d'équivalent qu'il rapporte, cinq au moins. La récompense grossit déjà avec
la difficulté ; les points suivent sans second barème à tenir. Ils serviront
au classement.

| Habitude | 1er jour | 1re semaine | 1er mois | 3 mois | 1 an | au-delà |
|---|---:|---:|---:|---:|---:|---:|
| Régulier (1 h/j), avant | 13 | 22 | 23 | 17 | 2 | 3 |
| Régulier (1 h/j), après | 11 | 24 | 25 | 34 | 21 | 3 |

Paliers tombés dans chaque période (Global et La Troupe). Le barème rend
288 boosters d'équivalent en Global et 110 par extension, dont les trois
quarts après le premier mois. L'audit échoue si le joueur régulier prend
plus de la moitié des paliers ou plus du quart de la valeur le premier mois,
si sa première semaine rend plus d'un tiers des boosters qu'il ouvre, s'il
lui reste moins d'un cinquième du barème après trois mois, ou si un palier
visible est hors d'atteinte même d'un joueur assidu.

Un palier déjà réclamé sous l'ancien barème couvre toujours les paliers
nouveaux à son niveau (`seuilsAnciens`) : qui avait la strate 12 ne se fait
pas repayer 11 ni 13. Un titre dont le palier a disparu (« Pourfendeur de
gardiens » était à 15 gardiens, il est à 50) reste à qui l'avait gagné, sous
son ancien identifiant (`TITRES_ANCIENS`).

### Prochaine étape proposée : un flux plutôt qu'un stock

*Fait : les missions de Bodégué (`missions.md`).*

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

Tricher ne doit pas, en revanche, casser la page des autres. Les règles ne
savent pas typer les valeurs des tables `extensions` et `premiers` : une
ligne où `pct` était un objet faisait tomber le classement chez tous les
joueurs (écran blanc). Chaque ligne lue passe donc par `assainirLigne`
(`src/succes/classement.js`) : nombres finis et bornés, chaînes, 40 entrées
au plus — le reste est remis à zéro ou écarté (09/10/2026).

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
