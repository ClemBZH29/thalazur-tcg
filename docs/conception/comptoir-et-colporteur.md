# Le Comptoir et le colporteur

Raisonnement de conception : ce que fait cette partie du site, et pourquoi elle le fait ainsi. Pour travailler sur le projet, voir le [README](../../README.md).

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
