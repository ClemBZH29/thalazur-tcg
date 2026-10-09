# Expéditions et Reliquaire

Deux modules légers, pensés ensemble : les Expéditions occupent les cartes que
le Donjon n'emmène pas, le Reliquaire transforme les doublons en cartes qui
manquent. Les mesures sont dans [l'audit](../audit-expeditions-reliquaire.md).

| Ce qu'on veut changer | Où |
|---|---|
| Places, durées, rendement, plafond d'or, XP, trouvailles | `src/config/expeditions.js` |
| Dissolution, forge, conditions d'une légendaire | `src/config/reliquaire.js` |
| Règles (pures, testées) | `src/expeditions/regles.js`, `src/reliquaire/regles.js` |
| Branchement sur l'état du jeu | `src/jeu/expeditions.js` |
| Pages | `src/routes/PageExpeditions.jsx`, `src/routes/PageReliquaire.jsx` |
| Fenêtre de retour | `src/components/RetourExpeditions.jsx` |

---

## Expéditions

**Beaucoup de monde, peu par carte.** Une expédition part vers un Lieu que le
joueur possède, avec 6 à 12 compagnons selon le palier du Lieu, et une place de
plus tous les 20 niveaux du Lieu (5 au plus). Trois expéditions en même temps,
un Lieu à la fois. Durées réelles : 4, 12 ou 24 heures, avec un rendement
horaire un peu moindre pour les longues (×1,0, ×0,9, ×0,8).

**Tout se mesure en effort** : puissance des compagnons (palier, niveau,
×1,2 d'affinité) × heures × rendement × multiplicateur du Lieu. L'effort donne :

- des PO, 0,1 par point, dans la limite de **100 PO par jour pour toutes les
  expéditions** (remise à zéro à minuit local) ;
- des vestiges, 0,05 par point, pour le Reliquaire ;
- une carte trouvée toutes les 12 heures, commune à rare, jamais légendaire ;
- de l'expérience : 0,5 XP par heure pour chaque compagnon, quelle que soit sa
  rareté, et 2 XP par heure pour le Lieu (moitié moins si l'équipe est incomplète).

**L'affinité** relie la faction d'un PNJ (troisième repère) à la province du Lieu
(premier repère). « Plans extérieurs » et « Plan Extérieur » se reconnaissent.

**Le Lieu progresse comme une carte du Donjon.** Son expérience passe par
`crediterXP` (`src/donjon/experience.js`), dans la même réserve `etat.xp` : même
courbe, mêmes paliers. Au palier (20, 30, 40 ou 50 selon la rareté), le Lieu
passe en rainbow, ou rend des PO s'il l'était déjà ; au niveau 100, un booster
offert. L'expérience des compagnons s'ajoute à celle du Donjon : une commune
peut atteindre son rainbow sans descendre, une dizaine de fois plus lentement.

**États exclusifs.** Une carte en expédition ne descend pas au Donjon (grisée à
la préparation, mode test compris) ; une carte au repos ou engagée dans une
descente ne part pas. « Compléter l'équipe » prend les cartes libres affines,
puis les plus puissantes ; aucune carte n'est réservée d'office au Donjon.

**Le butin est fixé au départ** : estimation et trouvailles sont calculées et
tirées (graine : Lieu, heure de départ, équipe) quand l'équipe part, et sauvées
dans la route. Recharger ne change rien. Un rappel fait rentrer l'équipe sans
rien ; il est **refusé pour une route déjà rentrée** (`rappeler` compare à
l'heure du geste, 09/10/2026) : la page ne relit l'heure que toutes les 20 s,
et un « Rappeler » cliqué juste après la fin effaçait tout le butin. La route
passe alors par la fenêtre de retour.

**La fenêtre de retour** vit dans la coque du site : elle s'ouvre d'elle-même
quand une route est rentrée, sur n'importe quelle page, et regroupe les retours
arrivés ensemble. Elle attend si le joueur est **occupé** : ouverture de booster
en cours (`etat.enCours`), page d'ouverture (cérémonie et bilan, où passe le
colporteur), ou page du Donjon avec une descente en cours. Le guetteur regarde
toutes les 30 secondes, au retour sur l'onglet, et à la fin exacte de la
prochaine route (un minuteur réglé dessus). Le crédit se fait une fois, à
l'annonce ; « Renvoyer la même équipe » relance la route d'un clic.

---

## Reliquaire

**Scellé jusqu'à 60 %.** Le Reliquaire n'apparaît ni dans la navigation ni à
l'écran tant qu'aucune extension n'est complétée à 60 % (`RELIQUAIRE.ouverture`) :
avant, les boosters complètent mieux que lui. Le seuil franchi, une fenêtre
l'annonce (`src/components/AnnonceReliquaire.jsx`), avec les mêmes égards que le
retour d'expédition : jamais pendant une ouverture ni un combat, jamais par-dessus
une autre fenêtre. Tant qu'une route est rentrée et pas encore accueillie,
l'annonce attend la fenêtre de retour : les deux se décidaient dans le même
rendu, où aucune n'était encore ouverte, et s'empilaient (09/10/2026).
L'annonce note `reliquaire.ouvert` : il ne se referme plus.

**Refonte du 30/09/2026 : une carte par jour.** L'étal tenait deux listes de
deux cents lignes (dissoudre, forger), avec recherche et filtres, et l'on y
choisissait sa carte manquante parmi toutes. Il ne reste qu'une carte :

- **La carte du jour** (`offreDuJour`, `src/reliquaire/regles.js`), la même pour
  tous : la graine est faite de l'extension et de la date, rien ne dépend de la
  collection. Elle est tirée **comme dans un booster** : chaque carte pèse la
  fréquence de son palier par sachet (3 communes, 1,71 peu commune, 0,24 rare,
  0,05 légendaire, lues dans `SLOTS`), partagée entre les cartes du palier ;
  puis elle est irisée au taux du booster (3 %). Forger et retourner
  revérifient le jour au geste (`jour` de `forgerOffre`, `reveler`) : juste
  après minuit, la page tend encore l'offre de la veille (elle relit le jour
  toutes les 30 s) ; elle est refusée, et la page relit l'heure.
- **Prix relevés** de deux fois et demie : 50, 100, 250, 1 000 vestiges ; une
  version irisée coûte cinq fois plus. On peut la forger même si on la possède
  (elle s'ajoute aux exemplaires) : la dissoudre ne rend qu'un dixième. Face
  cachée, elle se forge au prix moyen (voir plus bas).
- **Une forge par jour et par extension** (`reliquaire.achats`).
- **La dissolution a quitté la page** : elle se fait depuis la bibliothèque, dans
  le volet Reliquaire de la carte agrandie (voir `bibliotheque.md`), au même
  barème qu'avant (5, 10, 25, 100). Le dernier exemplaire n'est jamais proposé.
- **Hors Reliquaire** : cartes de personnage et full art.

**Ce que ça change**, mesuré par `node scripts/audit-reliquaire.mjs 40` : une
carte tirée comme dans un booster est presque toujours une commune, que le
joueur a déjà à 60 % de complétion. Le Reliquaire ne complète plus la
collection — deux à quatre cartes forgées sur toute la course, 100 % atteint
en 153 jours au lieu de 157 pour un joueur occasionnel (115 en vendant ses
doublons au Comptoir). C'est devenu un rendez-vous quotidien et un débouché
pour les doublons, plus un raccourci vers la fin de la collection.

Le Reliquaire travaille sur l'extension courante de la boutique.

**Face cachée, depuis le 06/10/2026.** La carte du jour se présente de dos.
Deux gestes, chacun confirmé d'un second toucher :

- **Forger à l'aveugle**, au prix moyen de la carte du jour : l'espérance de
  son prix (60 % de communes à 50, 34,2 % de peu communes à 100, 4,8 % de
  rares à 250, 1 % de légendaires à 1 000, rainbow ×5 trois fois sur cent),
  soit 96,9, relevée au multiple de 5 supérieur : **100 vestiges**
  (`prixAveugle`, réglage `RELIQUAIRE.aveugle`). Perdant sur une commune, juste
  sur une peu commune, gagnant au-delà. La carte se retourne ensuite au tempo de
  sa rareté et la page dit ce qu'elle valait.
- **Retourner la carte** : gratuit, montre la carte et son vrai prix, mais
  renonce au prix moyen pour la journée (`reliquaire.reveles`). Elle se forge
  alors à son prix, ou pas du tout.

Pourquoi ce n'est pas un faux choix : à prix moyen égal à l'espérance, un joueur
qui forgerait de toute façon paie en moyenne la même chose dans les deux cas.
Ce que le pari achète, c'est **l'accès** : avec 193 vestiges, une légendaire
retournée à 1 000 est hors de portée, la même forgée à l'aveugle coûte 100. Le
joueur riche est indifférent ; le joueur modeste tente sa chance ; et retourner
la carte pour voir, c'est perdre ce billet. Tant qu'elle est cachée, la page ne
dit rien d'elle : ni nom, ni palier, ni exemplaires détenus, ni loupe (la face
n'est pas montée). La carte reste calculable par qui lit le code : le site n'a
pas de serveur, l'enjeu ne justifie pas d'en ajouter un.

**Audit du prix à l'aveugle (06/10/2026, `node scripts/audit-aveugle.mjs`).**
Compté au prix de forge, le pari est neutre (espérance 96,9 pour 100). Compté
pour un collectionneur, qui ne tire que 5 vestiges d'une commune déjà
possédée, il rend 50 à 23 vestiges pour 100 selon l'avancement : forger à
l'aveugle chaque jour coûte 1 760 vestiges par carte nouvelle, contre 170 à
190 en retournant. Il ne devient gagnant qu'avec l'information : un joueur
qui sait quelle est la carte (un autre l'a retournée) ne la forge que si elle
vaut plus de 100 et reçoit 3,4 fois ce qu'il paie. **Décision : le partage
entre joueurs est voulu**, c'est un mini-jeu de petite communauté ; le prix
reste à 100 (le relever ne réduirait presque pas ce gain et ne punirait que
le pari honnête).

**Texte allégé (06/10/2026)**, mêmes principes que le Donjon : plus de
paragraphe d'introduction, montants en icône de vestige et chiffre, chances en
pastilles, possession en « ×N » ou « Manquante », verdict « 100 → 1 000 +900 »,
règles dans « Comment ça marche » (ouvert tant qu'on n'a rien forgé). 37 mots à
l'écran hors règles. La refonte de la mise en page et de l'animation de forge
est confiée à Claude Design (`brief-reliquaire-design.md`) ; ses effets seront
en code et remplaceront les planches de `public/reliquaire/`.

**La scène (07/10/2026, maquette Claude Design).** La page n'est plus un
bandeau et un étal : la crypte est la scène, plein cadre sous la navigation,
sans défilement ni pied de page (`PLEIN`, `src/App.jsx`). La carte repose sur
l'autel du décor, le gardien se tient à sa gauche (au téléphone, coupé par
l'autel), le panneau de décision est à droite (au téléphone, dessous), avec des
places réservées pour que rien ne bouge à l'arrivée du verdict. « Comment ça
marche » est une bulle ouverte par le « ? ».

| Fichier | Rôle |
|---|---|
| `src/reliquaire/scene.js` | Mise en page (`disposer`) et chronologie (`chronologie`, `evenements`), pures et testées |
| `src/reliquaire/forge.js` | L'image à l'instant t : carte, lueur, voile, éclats, particules, braises, anneaux, étincelles, compteur, verdict |
| `src/reliquaire/sons.js` | Les sons, synthétisés comme ceux de l'ouverture (`lib/audio.js`), au volume « effets » du profil |
| `src/styles/reliquaire.css` | L'apparence ; les positions viennent de `disposer` |

**La forge à l'aveugle**, en ms depuis le second toucher (lueur et
retournement : `tele` et `flip` de `tiers.js`) : paiement 0–400 (dix éclats
de vestige vers le dos de la carte, compteur qui décompte) ; éveil (lueur du
palier, scène assombrie de `ombre`) ; retournement (face à 20 %, particules) ;
fissure du cadre (520 ms, 700 pour une grande carte) puis éclat, et pour une
légendaire ou une rainbow deux anneaux et 26 braises ; compte du prix réel
(f₀ + 150, 550 ms) puis écart (f₀ + 700, 450 ms). Fin : 2 130 ms pour une
commune, 3 705 pour une légendaire. Retourner : éveil et retournement
seulement. Forger après avoir retourné : paiement, fissure, éclat. Un toucher
sur la scène pose l'état final (seul le son final joue) ; en « moins
d'animations », rien ne joue. Le geste est enregistré dans le jeu au premier
instant : fermer la page pendant la séquence ne perd rien.

Les planches d'effet générées (`forge`, `forge-legendaire`, `dissolution`) sont
retirées de `public/reliquaire/` : les effets sont dans le code (charte, § 5).

**Reste à produire (Sora, images fixes)** : la crypte à l'autel vide en 3:2
(2 400 × 1 600 au moins, autel vers 55 % de la largeur, bord avant du plateau
à 73 % de la hauteur, tiers droit calme), le plateau d'autel détouré (2:1),
le gardien à mi-corps détouré (4:5, tourné vers l'autel). Le décor actuel
(`bandeau.webp`) sert en attendant : la carte masque son coffret.

**Les vestiges ont un second usage** depuis le 01/10/2026 : la fiche de combat
des cartes (rangs d'ATQ et d'INI, changement de geste ou de technique), dans
le volet « Combat » de la carte agrandie. Voir `donjon.md`, « La fiche de
combat ». C'est le débouché que la forge du jour, une carte par jour, ne
suffisait plus à offrir.

---

## Sauvegarde et comptes

Deux champs nouveaux dans `etatVide()`, sans changement de `SCHEMA` :

- `expeditions` : `{ routes, orJour, seq }`. Une **valeur** pour la fusion entre
  appareils : l'appareil qui l'a changée depuis la base l'emporte ;
- `reliquaire` : `{ vestiges, achats, reveles, ouvert }`. Les vestiges sont un
  **compteur** (`fusionnerReliquaire`, `src/lib/nuage/fusion.js`) ; pour chaque
  extension, le jour de la dernière forge et celui du dernier retournement
  gardent le plus récent des deux côtés.
  L'ancien `derniereForgeL` des sauvegardes est ignoré.

Limite connue : une même route accueillie sur deux appareils avant qu'ils se
synchronisent est payée deux fois (XP et PO s'additionnent). Les montants sont
faibles et le cas demande de jouer hors ligne sur deux appareils à la fois.

## Illustrations et préchargement

Les illustrations des pages chargées à la demande sont préchargées au repos, par
vagues (`src/lib/prechargement.js`) : cadres et sachets, puis bandeaux et
portraits, puis Comptoir, Mines, et les planches d'effet en dernier. Rien ne
part en données restreintes ou en 2G. La liste est tenue à la main ;
`tests/prechargement.test.js` vérifie qu'elle suit les dossiers de `public/`.



`public/expeditions/` (bandeau, camp vide, maîtresse de route, marqueur de piste),
`public/reliquaire/` (bandeau, gardien, reliquaire, vestige, planches d'effet),
`public/icones/`. Les planches d'effet sont neuf images en bande, lues en
`steps(8)`, noir rendu transparent. Prompts d'origine : projet Claude,
`assets-sora-expeditions-reliquaire.json`.
