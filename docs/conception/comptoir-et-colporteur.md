# Le Comptoir et le colporteur

Raisonnement de conception : ce que fait cette partie du site, et pourquoi elle le fait ainsi. Pour travailler sur le projet, voir le [README](../../README.md).

## Le Comptoir


Marché de l'occasion, à `#/comptoir`. Dix acheteurs rachètent les exemplaires
en trop, chacun avec son goût, son prix et sa capacité à se laisser
marchander : Lise tous les jours, deux spécialistes qui tournent, et le
Conservateur une fois sur dix. Ce sont des personnages propres au jeu, hors
campagne. L'audit du 05/10/2026 (`docs/audit-comptoir.md`) a fixé leurs goûts
et ce calendrier.

**L'ordre de la page suit l'argent.** Les acheteurs du jour, puis le rayon
et l'échoppe côte à côte. Le Registre a disparu : vingt lignes d'historique
qu'on ne relit pas. La Régie, elle, est passée derrière le point d'interrogation du titre.

### La page, depuis la refonte d'octobre 2026

La page suivait un tableur : trois portraits-affiches, un tableau de
soixante lignes de surplus, une fenêtre de négoce à pastilles tronquées, et
aucune carte montrée. À 884 doublons, elle était fade et la vente une corvée.
La refonte suit la maquette Claude Design « Comptoir de Thalazur » v2, après
une première version corrigée (`docs/audit-comptoir.md`, et les corrections 1
du dossier de brief).

- **Le bandeau du jour** : le titre, la date, la caisse du Comptoir, et
  l'acheteur de demain avec sa vignette.
- **La scène** : les acheteurs du jour debout derrière une planche de
  comptoir. Une bulle ne porte que **la réplique**, à la voix du personnage ;
  les faits (ce qu'il achète, combien de vos cartes l'intéressent, son
  quota) se lisent sous son nom. Un acheteur sans intérêt pour vos cartes
  passe en retrait, désaturé, et sa réplique dit pourquoi. Bulle, portrait et
  plaque ont chacun leur hauteur réservée : rien ne bouge quand une réplique
  change. Au téléphone, une rangée d'onglets-visages, et la bulle et la
  plaque de l'acheteur choisi dessous.
- **Le rayon** et **l'échoppe**, côte à côte au bureau.

**On vend à l'unité, avec un quota.** Les lots (« Tout lui vendre », « 147
autres cartes, comprises dans… ») ont été abandonnés : personne ne lisait ces
phrases et l'écran ne pouvait pas les montrer. Chaque acheteur rachète un
nombre limité d'exemplaires par jour (Lise 20, un spécialiste 10, le
Conservateur 3), puis il a fini sa journée. Le quota se lit sur une jauge et
repart à zéro avec les acheteurs du lendemain (`achats`, dans la sauvegarde
du marché).

**Le négoce a deux écrans.** A, « Ce qui intéresse Lise » : ses cartes en
vraies vignettes, avec le nombre en trop et le prix à l'unité, une recherche
et un tri. B, le marchandage d'une carte, ouvert d'un toucher sur une
vignette : la carte, son offre, ce que paie l'échoppe, la quantité bornée par
le surplus et par le quota, et « Retour à ses cartes ». Après une vente, les
chiffres sont ceux de la vente, et le bouton principal ramène à A.

**Le marchandage se lit.** Le pile ou face a laissé place à trois manières de
présenter la carte : le prix ferme, l'histoire de la carte, sa rareté. Chaque
acheteur en préfère une et en déteste une (`src/comptoir/voix.js`), et sa
réplique d'indice le laisse deviner (« Dites-moi votre prix, franchement »).
Bien choisie, la chance monte à 80 à 90 % ; mal choisie, elle tombe au tiers
de son tempérament ; sinon, c'est son tempérament. Les garde-fous supposaient
déjà un marchandage réussi : mieux réussir ne casse pas l'économie.

**Le point de navigation** ne s'allume plus que les jours du Conservateur
Royal. Le nombre d'exemplaires en trop ne faisait que grossir : un stock, pas
une action.

**Les pièces filent vers la bourse** après une vente, en arc, puis la bourse
pulse. Avec le mouvement réduit du profil, rien ne vole.

### Le jour est la date réelle

Les acheteurs tournent avec le calendrier, pas avec un bouton. On revient
demain, on ne rejoue pas la journée. Un marchandage ne survit pas à la nuit, ce
qui est exactement ce qui empêche de relancer le dé jusqu'à obtenir la bonne
offre.

**Lise est là tous les jours.** Les communes et peu communes font 91 % des
doublons : celui qui les achète porte le Comptoir à lui seul. L'ancien trio,
trois acheteurs tirés parmi neuf par un pas de sept, laissait des jours où
seulement 15 à 42 % du surplus trouvait preneur, d'où une page de lignes
« Attendre ». Lise paie peu au-dessus de l'échoppe (×1,14) ; attendre un
spécialiste garde donc son intérêt.

**Deux spécialistes par jour, sur un cycle de vingt-huit jours.** Huit
spécialistes font vingt-huit paires ; chacune passe une fois par cycle, et
personne ne revient deux jours de suite. L'ordre est calculé une fois, sans
hasard (`CYCLE`, `src/comptoir/acheteurs.js`) : chaque jour, la paire dont les
membres sont absents depuis le plus longtemps. Le Conservateur Royal passe un
jour sur dix, en plus. Couverture mesurée : au moins 93 % du surplus a preneur
chaque jour, 96 % en moyenne.

L'annonce du lendemain se lit en haut de page : elle ne nomme que le
spécialiste qui n'est pas déjà là, et Gaspard y dit ce qu'il apporte.

### Ce à quoi ils s'intéressent

Les portraits, les répliques et les coefficients de marchandage viennent du
module d'origine. Les goûts, eux, ont été refaits deux fois.

Le module travaillait sur un set inventé ; la première adaptation a lu le
roster par **familles de mots** (« soldat », « mage », « camp »…). Le
vocabulaire réel passait au travers : Hector ne reconnaissait que onze cartes
(ni « Guerrier », ni « Lancier », ni « Paladin »), et aucune faction
n'intéressait personne, alors que c'est l'axe le plus riche de La Troupe.

Chaque acheteur regarde maintenant **un seul axe, lisible sur la carte** :

| Acheteur | Axe | Porte d'entrée |
|---|---|---|
| Lise | rareté basse | communes et peu communes normales |
| Dame Sorelle | rareté haute | rares, légendaires, full art, cartes PJ |
| Voren | rainbow | toute rainbow |
| Maîtresse Oriane | type | artéfacts |
| Nassim | type | Lieux |
| Ysée | type | PNJ combattants du Donjon (rôles garde, frappeur, tireur, mage) |
| Hector | faction | Troupe, GRC, Aventurier |
| Gaspard | faction tournante | une province par passage |
| Éloi | Bestiaire | faction Bestiaire, archétypes Créature et Animal |
| Le Conservateur | haut de gamme | rares et au-delà, artéfacts, Lieux, rainbow |

La faction se lit sur le premier repère d'un Lieu et le troisième des autres
cartes, sans accents : « Säab » (PNJ) et « Saäb » (artéfacts) se rejoignent.
Le rôle d'Ysée est celui que le Donjon donne à la carte (`roleDe`) : « je paie
pour ce qui gagne » est vrai, et vérifiable au Donjon. Ses goûts tirés d'un
hachage de l'identifiant (`meta`) ont disparu.

L'affinité garde ses deux étages, dans `src/comptoir/acheteurs.js` :

- **`entree`** — l'axe : s'il ne passe pas, l'acheteur ne regarde pas la carte ;
- **`primes`** — chacune ajoute une prime, jamais l'entrée.

La distinction vient d'un essai raté. Avec une seule liste mise en OU, un palier
suffisait à ouvrir la porte : « rare ou légendaire » cumulé à « désirable »
faisait qu'Ysée s'intéressait à trois quarts du set et qu'aucun acheteur n'avait
plus de goût. Les paliers et la cote sont des modulateurs, pas des portes
d'entrée, sauf pour les deux acheteurs dont la rareté est l'axe.

**Gaspard change de province à chaque passage.** Brocanteur du quai, il
débarque chaque fois d'un autre chargement : Nakova, Pronolo, Säab et la
Caravane, Cornalie, puis Odiana, Éléon et Inarva, et le cycle reprend. Les
petites provinces sont regroupées pour qu'aucun passage ne tombe sous une
quinzaine de cartes. La province suit le rang de son passage depuis le jour
un du site (`passageDeGaspard`) : la même pour tous, et rien ne la relance.

### Comment un prix se forme

L'ancrage part du **prix de revente garanti par l'application**, pas d'une
échelle inventée : `REVENTE[palier] × 2,4`, corrigé de la désirabilité propre de
la carte et, pour une rainbow, du fait qu'elle tombe une fois sur trente-trois.
La conséquence tient en une phrase : le Comptoir paie toujours au moins ce que
l'échoppe automatique payait, sinon y aller serait une punition.

**Chaque acheteur a son plafond.** Il n'y en avait qu'un, celui de l'échoppe
(1,80 fois l'ancrage). Or le rachat de l'échoppe monte déjà à 1,71 fois
l'ancrage quand le rayon est maigre, ce qui est le cas de toutes les rainbow :
il restait 5 % pour la prime, et Sorelle et Voren offraient le même prix au
centime. Le plafond d'un acheteur est maintenant celui de l'échoppe multiplié
par son `mult`, borné à ×1,6 (`plafondMult`). Pour que le pire jour reste sous
100 %, le Conservateur est passé de ×1,92 à ×1,80 ; il reste celui qui paie le
mieux.

**Le prix annoncé est le prix payé.** `prixAcheteur` calcule l'offre,
marchandage compris, avec son plafond, et `payer` ne rabote plus rien. Avant,
le paiement repassait par le plafond de l'échoppe : un marchandage réussi
s'annonçait à 88 PO et en payait 63, sur la plupart des articles de Sorelle et
de Voren.

**Un acheteur ne paie jamais moins que l'échoppe**, même après un échec : son
offre s'arrête au prix de l'échoppe, et le verdict le dit.

**Des PO entières.** Le rachat et la vente sont arrondis à la pièce : « 8,76 PO »
dans le tableau et « 63 PO » dans le négoce, pour la même carte, ne se
comparaient pas.

**Full art et cartes PJ n'ont qu'une version.** Elles sont rainbow par nature
et le tirage les range en case normale ; le marché leur créait une fausse
rainbow, cotée vingt mille PO et jamais vendable. Elle a disparu du catalogue,
et des sauvegardes au chargement suivant.

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

L'échoppe vend aussi. Elle ne déballe pas ses huit cents cases : elle sort
cinq cartes courantes, tirées de la graine du jour et pondérées par le rayon,
et une **pièce du jour**.

- **Les cartes qui vous manquent pèsent quatre fois plus** et passent devant,
  marquées « Manquante ». À deux cents cartes possédées, le rayon ne montrait
  plus que des cartes déjà en collection.
- **La pièce du jour** est une rare, une légendaire ou une rainbow, tirée de
  la graine du jour et pondérée par sa rareté. Elle ne passerait jamais par
  le rayon ordinaire : une rainbow n'a qu'un tiers d'exemplaire en rayon. Elle
  se vend à son prix de marché, sans remise. Une rare rainbow vaut environ
  1 230 PO, une dizaine de boosters, et c'est voulu : la valeur d'une rainbow
  se voit à l'achat comme à la revente.
- **La vitrine est figée pour la journée** (`vitrineDuJour`) : une vente
  garnit le rayon et un achat complète la collection, et sans ce gel les
  cases changeaient sous les doigts. **Chaque case ne se vend qu'une fois**
  dans la journée.

Sans ces limites, le marché complet cassait la collection : une peu commune à
vingt-huit PO signifiait quatre cartes choisies pour le prix d'un booster, et
plus personne n'ouvrait de booster. L'échoppe vend par ailleurs 2,6 fois ce
qu'elle rachète ; c'est sa marge sur les pièces à l'unité qui garde le
booster intéressant.

### L'échoppe

La sortie pour tout ce que les acheteurs n'ont pas pris : elle rachète tout,
tout de suite, au prix de rachat. Trois puces disent ce que la vente inclut :
les communes et peu communes, actives par défaut ; les rares et au-delà ; les
rainbow, qui améliorent vos cartes pour le Donjon. Les deux dernières
commencent éteintes. Le premier appui arme la vente (« Confirmer : 3 463
PO »), le second la fait.

### La fenêtre de négoce

Le portrait fixe la hauteur du cadre (`--neg-h`, voir la charte). Les onze
portraits sont des **découpes à fond transparent**, posées au bas de la
scène, sans recadrage. Le nom et la réplique se posent par-dessus le haut du
portrait au bureau, et passent sous son bandeau au téléphone, où le négoce
occupe tout l'écran. Le marchandage annonce son résultat : une demi-seconde
de pesée (« Lise réfléchit… »), puis le montant éclate en vert ou tressaille
en ambre brûlé, et la réplique et l'expression du portrait suivent l'issue.

### Les garde-fous

Deux ratios disent ce qu'un booster rapporte s'il est intégralement liquidé, en
part de son prix ; le second est le pire cas — meilleur acheteur, affinité
maximale, marchandage réussi. Tant qu'ils restent sous 100 %, le Comptoir n'est
pas une machine à pièces d'or. `node scripts/audit-marche.mjs` mesure aussi
le **pire jour du cycle** : chaque journée des vingt-huit, le Conservateur
ajouté d'office. Il est à 97 % ; un test le garde sous 100 %.

**La vente rapide ne prend par défaut que les normales communes et peu
communes.** Elle liquidait tout au prix de l'échoppe, rainbow comprises ; or
une rainbow en trop étoile une fiche du Donjon, et une rare se vend bien mieux
à son acheteur. Deux cases à cocher ajoutent les rares et au-delà, et les
rainbow. Le choix entre le Donjon et la vente reste au joueur.

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
