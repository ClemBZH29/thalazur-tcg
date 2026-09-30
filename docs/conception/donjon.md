# Le Donjon

Raisonnement de conception : ce que fait cette partie du site, et pourquoi elle le fait ainsi. Pour travailler sur le projet, voir le [README](../../README.md).

## Le module

`#/donjon`. Deux donjons depuis le 30/09/2026 (`MODES`, `src/donjon/regles.js`) :

- **le donjon du jour** : trois étages, la même carte pour tous, **une
  descente par jour** ; son butin compte double ;
- **le donjon infini** : une graine neuve à chaque descente, des étages sans
  fin, de plus en plus durs (les PV et l'ATQ des adversaires montent avec
  l'étage, sans plafond ; la part des élites plafonne à l'étage 12). Autant de
  descentes qu'on veut, mais butin ×0,4, expérience ×0,5, et 100 PO par jour
  au plus versées à la bourse. Une défaite n'y coûte qu'un jour de repos : un
  jour par étage aurait immobilisé l'équipe neuf jours après l'étage 9. Le
  plus grand nombre de gardiens vaincus fait le record (`donjon.recordInfini`).

Dans les deux cas, On y descend avec quatre compagnons de sa collection et un artéfact ;
on en remonte avec du butin, que la bourse convertit en PO. Deux prototypes
autonomes ont précédé l'intégration (hors dépôt, dans `Claude outputs`).

Les règles sont dans `src/donjon/regles.js`, sans React ni navigateur ;
`src/donjon/Donjon.jsx` affiche et anime. Les tests
(`tests/donjon.test.js`) rejouent des descentes entières au pilote
automatique.

### Ce que la collection y apporte

- **Les alliés** sont les PNJ possédés (case normale remplie) dont le premier
  repère n'est ni Créature, ni Animal, ni Criminel.
- **Le rôle vient de l'archétype** (`roleDe`) : Paladin, Lancier, Infantrie
  lourde font un garde ; Archère, Éclaireur, Rôdeur un tireur ; Médecin,
  Clerc, Shaman un soigneur ; Sorcier, Magicien un mage ; Souverain, Prince,
  Barde un meneur ; Guerrier, Assassin, Barbare, Moine un frappeur — les
  classes de D&D gardent leur emploi, le moine frappe et ne soigne pas.
  Ceux qui bâtissent (Forgeronne, Ingénieur, Artisan, Charpentier,
  Architecte…) font un **artificier**, qui dresse un rempart devant l'équipe ;
  ceux qui nourrissent (Cuisinier, Aubergiste, Intendant, Brasseur, Porteur)
  un **intendant**, qui ravitaille tout le monde et rend les repos meilleurs.
  Le reste — gueux, marins, voyageurs, scribes — devient **débrouillard**, qui
  augmente le butin : aucune carte n'est inutile.
- **Le palier fixe les PV et l'ATQ**, et ajoute à l'initiative.
- **Les adversaires** sont les Créatures, Animaux et Criminels du roster, et,
  pour deux sur cinq, des **PNJ rivaux** : ceux des factions qui ne sont pas du
  côté des joueurs (`FACTIONS_AMIES` : Troupe, Caravane, Aventurier). Un rival
  porte le rôle et la capacité de son archétype, comme un compagnon — un
  médecin adverse soigne les siens, un garde adverse provoque — et joue comme
  le pilote automatique. Jamais une carte de l'équipe en face d'elle-même.
- Les salles sont les **Lieux** du roster, les reliques ses **Artéfacts**. Une
  extension qui ouvre peuple le donjon sans une ligne de code.

Le classement par repère est mécanique : un PNJ légendaire du camp d'en face
dans la campagne peut se retrouver allié s'il n'est pas classé Criminel. C'est
le roster qui fait foi ; pour exclure une carte, la reclasser.

### La préparation, et le lexique

Chaque vignette porte la carte, puis deux lignes de hauteur fixe : le
mot-clé du rôle et les chiffres (PV, ATQ, INI). Le texte des capacités n'y
figure plus : sa longueur variait d'une carte à l'autre et désalignait la
grille. Il est au **lexique**, que le bouton Lexique ouvre en préparation comme en
combat : chiffres, rôles et capacités, traits des adversaires, états.

### La carte d'un étage

Inspirée de Slay the Spire : sept rangs, quatre sentiers qui descendent en
dérivant d'une colonne au plus et se rejoignent là où ils se croisent. Le
premier rang est un combat, le quatrième surtout des trésors, le dernier un
repos avant le gardien. On voit le genre et le lieu de chaque salle, jamais
ce qu'elle cache. Tirée d'une graine faite de la date : deux joueurs ont le
même étage, et peuvent en parler.

### Le combat

- **Initiative** : chaque unité a la sienne (rôle + palier). La frise du haut
  donne l'ordre du tour ; à égalité, l'équipe passe devant.
- **À son tour**, un compagnon attaque ou emploie la capacité de son rôle —
  provocation, frappe lourde, tir visé, soin, vague de brume, galvaniser,
  coup bas, rempart, ravitaillement — qui se recharge ensuite quelques tours.
  Le joueur choisit le geste, puis la cible.
- **La brume qui monte** : passé le dixième tour, chaque tour ajoute 20 % aux
  dégâts des deux camps (`brume`, `BRUME_TOUR`). Un soigneur resté seul se
  soignait plus vite qu'on ne le frappait ; comme on ne fuit pas seul, le
  combat ne finissait jamais. Aucun combat ne dure plus longtemps que la
  brume ne le permet ; une pastille violette l'annonce dans la frise.
- **Adversaires** : le fourbe achève le plus faible, le rapide agit tôt, le
  coriace encaisse. Le gardien balaie toute l'équipe tous les trois tours.
- **Combat automatique** : trois stratégies (concentrer, abattre la menace,
  prudence), et trois vitesses. On reprend la main en repassant en Manuel.
- **Fiches** : survoler une carte (la toucher, au téléphone ; la focaliser, au
  clavier) ouvre sa fiche : PV, ATQ, initiative, rôle ou trait, capacité et
  recharge. Sous chaque carte, l'étiquette nomme déjà la capacité.
- **Animations** : l'attaque de base fond sur sa cible ; chaque capacité a la
  sienne — la frappe lourde prend son élan et fait trembler l'arène, le tir
  visé part en trait, le soin en orbe qui décrit un arc, la vague de brume
  balaie toute la rangée, la provocation et le galvanisme en anneaux, le
  balayage du gardien en vague rouge. Web Animations, sans bibliothèque.
  Coupées quand les animations sont réduites ; le jeu reste lisible par la
  frise et le journal.
- **Hauteurs fixes** : consigne, journal et gestes gardent la même place d'un
  tour à l'autre, l'arène ne bouge plus.

### Les rôles, rééquilibrés

L'audit du 28/09/2026 (`scripts/audit-donjon.mjs`, section « Ce que vaut un
rôle ») mesurait de 13 % (meneur) à 30 % (soigneur) de descentes complètes
pour trois peu communes et une carte du rôle ; le débrouillard ramassait
40 % des alliés sans identité. Après retouche, l'écart tient entre 20 et
29 % :

| Rôle | Avant | Après | Ce qui a changé |
|---|---:|---:|---|
| Meneur | 13 % | 20 % | Galvaniser : +3 ATQ (au lieu de +2), trois tours, recharge 2 |
| Mage | 14 % | 21 % | Vague de brume : ×1 (au lieu de ×0,75), recharge 1 |
| Débrouillard | 17 % | 21 % | Coup bas ×1,4 ; les artisans et les intendants en sortent |
| Soigneur | 30 % | 29 % | Soin : ATQ + 2 (au lieu de + 3) |
| Artificier | — | 21 % | Nouveau : Rempart, armure +3 à toute l'équipe, deux tours |
| Intendant | — | 29 % | Nouveau : Ravitaillement, rend ATQ PV à toute l'équipe ; repos +25 % |

Les PNJ rivaux ont les mêmes rôles et s'en servent contre l'équipe.

### L'apprentissage

Une collection jeune n'a que des communes, et quatre communes tombaient une
fois sur deux dès l'étage 1 : le pire accueil possible. Tant que le joueur a
ouvert moins de `DONJON.apprentissage.jusqua` boosters (30), la descente est
adoucie : adversaires à 75 % de leurs PV et de leur ATQ, butin à 40 %. Les
deux remontent en ligne droite jusqu'au jeu normal (`apprentissage` dans
`regles.js`). Le facteur est figé à la descente, et l'expérience des cartes
n'est pas réduite : c'est le moment où une commune s'irise le plus vite.

| Collection de 8 cartes | Trois gardiens | PO créditées | XP par carte |
|---|---:|---:|---:|
| 0 booster (apprentissage) | 66 % | 57 | 76 |
| 30 boosters (normal) | 29 % | 73 | 42 |

Le butin reste sous le jeu normal malgré des descentes deux fois plus souvent
menées au bout : on apprend, on ne s'enrichit pas. L'écran de préparation
le dit, avec le nombre de boosters restant ; l'en-tête de la descente aussi.

### Au téléphone

Même seuil que le menu burger (720 px et moins, ou téléphone en paysage),
repris par `useDoigt()` dans `Donjon.jsx` et par la requête média de
`donjon.css`.

- **La carte est l'écran de base.** Le panneau latéral (aperçu, équipe,
  reliques) disparaît ; un bouton « Équipe x / y · n reliques » au-dessus de
  la carte ouvre une feuille avec l'équipe et les reliques. L'écran défile
  jusqu'à la prochaine salle accessible.
- **Un toucher sur une salle ouvre sa bulle** (genre, lieu, aide) avec un
  bouton « Y aller ». Un second toucher sur la même salle, ou sur le fond de
  la carte, la referme. Rien ne se lance sans le bouton : plus de salle
  prise par erreur.
- **Au combat, deux chiffres par carte** : l'attaque en ambre, les PV en vert
  (rouge sous un tiers). Badges, statuts et étiquettes sont masqués ; un point
  ambre signale un état en cours (provocation, galvanisation). Toucher une
  carte ouvre sa fiche complète, la toucher encore la ferme.
- **L'arène d'abord** : la frise, les adversaires, la consigne et l'équipe
  remplissent l'écran sous l'en-tête et y sont centrés ; l'écran s'y place à
  l'entrée du combat. Le combat automatique, la vitesse, le lexique et la
  fuite sont en dessous, en faisant défiler.

### Les soins, réduits (30/09/2026)

Chaque étage se terminait sur un repos à +50 %, la halte entre deux étages
rendait encore un quart des PV, et un repos de hasard s'ajoutait sur un chemin
sur quatre : l'usure ne comptait plus. Désormais (`SOINS`) :

| Soin | Avant | Après |
|---|---:|---:|
| Repos (avant le gardien, et de hasard) | +50 %, tombés à 35 % | +30 %, tombés à 25 % |
| Repos de hasard (poids du tirage) | 8 | 4 |
| Halte entre étages | +25 %, tombés à 25 % | tombés à 15 %, rien pour les autres |
| Source « Boire » | +40 % | +25 % |

Mesuré (`node scripts/audit-donjon.mjs 800`, équipe type, Concentrer) : trois
gardiens dans 30 % des descentes au lieu de 42 %, 76 pièces de base par
descente au lieu de 99.

### Remonter ou descendre

Après chaque gardien, on remonte avec tout le sac, ou l'on descend. On peut
aussi remonter après n'importe quelle salle. Avant de descendre, l'équipe
souffle : les tombés se relèvent à un quart de leurs PV.

**Fuir coûte cher** : deux cinquièmes du sac, un sixième des PV de chacun, et
le compagnon le plus mal en point reste derrière pour couvrir la retraite — il
quitte l'expédition. On ne fuit ni un gardien, ni seul.

**Convalescence**, à la manière de Darkest Dungeon. Si l'équipe tombe, il ne
reste qu'un quart du sac, et ses cartes restent au repos **un jour par étage
atteint** ; un compagnon laissé derrière dans une fuite, un jour. Une carte au
repos ne peut pas redescendre avant la date affichée sur sa vignette
(`etat.donjon.convalescence`, « extension:carte » → date de retour). La recrue
ramassée en chemin n'est pas au joueur, elle n'est pas comptée. Le mode test
affiche la convalescence sans l'appliquer.

## L'expérience des cartes

Pour ne pas toujours emmener ses légendaires : chaque carte qui descend
gagne de l'expérience et monte de niveau (`src/donjon/experience.js`,
`etat.xp`, « extension:carte » → `{ xp, irisee, cent }`).

- **Gain** : à chaque combat remporté, toute l'équipe — tombés compris —
  reçoit un point par adversaire et par étage, trois pour une élite, cinq par
  étage pour le gardien. Une défaite n'en laisse que la moitié ; le compagnon
  laissé derrière dans une fuite garde ce qu'il avait appris ; la recrue
  ramassée en route n'est pas à nous.
- **Courbe** : passer du niveau n à n + 1 coûte 5 + n points. Une descente
  rapporte en moyenne 45 points à chaque compagnon, 104 si elle va au bout.

  | Niveau | Points cumulés | Descentes moyennes |
  |---:|---:|---:|
  | 20 | 285 | ~6 |
  | 30 | 580 | ~13 |
  | 40 | 975 | ~22 |
  | 50 | 1 470 | ~33 |
  | 100 | 5 445 | ~120 |

- **Palier d'irisation**, d'autant plus bas que la carte est modeste :
  niveau 20 pour une commune, 30 une peu commune, 40 une rare, 50 une
  légendaire. La carte gagne sa version irisée ; si on la possède déjà, des PO
  (60, 120, 240, 480 selon le palier). Une commune s'irise en trois jours de
  deux descentes, une légendaire en deux semaines : c'est l'incitation à
  varier.
- **Niveau 100** : un sachet offert de l'extension de la carte, environ deux
  mois de jeu régulier avec elle.
- **En combat**, un niveau ajoute un peu : +1 PV tous les 10 niveaux, +1 ATQ
  tous les 25. Une commune au niveau 100 (+10 PV, +4 ATQ) rattrape une
  légendaire neuve sans la dépasser de beaucoup.
- **Deux appareils** : les points s'additionnent comme des compteurs, les
  paliers payés restent acquis dès qu'un côté les a notés.

Le niveau se lit sous chaque vignette de la préparation, avec une fine barre
vers le niveau suivant ; le bilan de fin de descente détaille les points
gagnés, les niveaux franchis et les récompenses.

## L'économie

Le module rapporte des **pièces de butin** ; `src/jeu/donjon.js` les convertit
à la frontière, comme pour les Mines (`DONJON` dans `src/config/tiers.js`) :

| Levier | Valeur |
|---|---:|
| PO par pièce de butin | 0,6 |
| Donjon du jour | 1 descente par jour, butin ×2 |
| Donjon infini | illimité, butin ×0,4, expérience ×0,5, 100 PO par jour au plus |

La descente du jour est prise au départ et non à la remontée : abandonner ne
la rend pas. Le mode test des outils MJ la rend illimitée.

Mesure du 30/09/2026 (800 descentes par cas) : ~150 PO par jour pour le
donjon du jour, ~60 pour trois descentes infinies, soit ×1,6 le gain passif
pour qui joue les deux — le même ordre qu'avant la refonte, où deux
descentes du jour faisaient ~200 PO. Au donjon infini, la moitié des
descentes s'arrêtent avant le troisième gardien ; le meilleur des 800 en a
vaincu quatorze. Les tableaux plus bas datent d'avant les modes.

Les chiffres ci-dessous sont ceux de l'intégration ; les mesures à jour sont
dans `claude/audit-donjon.md` (projet) et se refont avec
`node scripts/audit-donjon.mjs`. Le Donjon est le **mode de jeu principal** :
il rapporte environ une fois et demie le gain passif, plus que les Mines, et
c'est voulu.

Mesures sur 40 descentes par stratégie (collection de dix-huit alliés tirée
comme au sortir des boosters, les quatre meilleurs emmenés, chemins au
hasard, on descend toujours) :

| Stratégie | Descentes complètes | Butin moyen | Butin d'une descente complète |
|---|---:|---:|---:|
| Concentrer | 19 / 40 | 205 | 373 |
| Abattre la menace | 18 / 40 | 196 | 369 |
| Prudence | 20 / 40 | 211 | 368 |

Les PNJ rivaux n'ont pas déplacé ces chiffres (19, 18 et 20 descentes
complètes après leur arrivée). Soit environ 120 PO par tentative en moyenne, 220 pour une descente complète :
deux tentatives valent un à quatre boosters par jour. C'est dans l'ordre de
grandeur des Mines (480 PO de plafond quotidien) ; les deux s'ajoutent, et le
jour où un troisième module arrive, l'enveloppe commune des modules devra
être fixée.

## Sauvegarde

`etat.donjon = { jour, tentatives, poInfini, recordInfini, partie, dernier, convalescence }`
(`tentatives` : descentes du donjon du jour ; `poInfini` : PO versées par
l'infini aujourd'hui ; la partie porte son `mode`, une partie d'avant les
modes est un donjon du jour). La partie est un objet
simple, sauvé à chaque changement d'écran : un onglet fermé ne coûte pas la
tentative. Entre deux appareils, `donjon` est une valeur : celle de l'appareil
qui l'a changée l'emporte.

**Recharger ne sert à rien.** Un combat est sauvé à son entrée, avant le
premier coup, avec sa graine (`partie.combat = { genre, graine }`) ; tous
ses tirages — adversaires, dégâts, choix adverses, relique — viennent de
`tirage(graine)`. Rechargé au milieu, il reprend à son premier tour, mêmes
adversaires, mêmes dés : au pilote automatique, même issue. Une rencontre
de même (`partie.rencontre = { id, graine }`). Avant, la partie revenait à
la carte *après* la salle, PV intacts : recharger effaçait une défaite, et
chez le gardien — qui n'a pas de suite — bloquait le Donjon pour de bon.
En filet, « Remonter » est aussi sur la carte dès la première salle, et se
confirme d'un second appui partout où il côtoie un autre bouton.

Les champs `difficulte`, `gain`, `combat` et `rencontre` de la partie ont une
valeur par défaut à la lecture (`?? 1`, absents = rien en cours) : une partie
sauvée avant eux se reprend telle quelle.

Deux succès globaux s'y rattachent (`gardiens`, `remontees`), comptés à la
remontée dans `etat.stats`.
