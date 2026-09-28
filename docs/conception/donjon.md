# Le Donjon

Raisonnement de conception : ce que fait cette partie du site, et pourquoi elle le fait ainsi. Pour travailler sur le projet, voir le [README](../../README.md).

## Le module

`#/donjon`. Un donjon de trois étages, un par jour et le même pour tous les
joueurs. On y descend avec quatre compagnons de sa collection et un artéfact ;
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
  classes de D&D gardent leur emploi, le moine frappe et ne soigne pas. Tout le reste —
  artisans, fonctionnaires, marins — devient **débrouillard**, qui augmente le
  butin : aucune carte n'est inutile.
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
  coup bas — qui se recharge ensuite quelques tours. Le joueur choisit le
  geste, puis la cible.
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
| Tentatives par jour | 2 |

Une tentative est prise à la descente et non à la remontée : abandonner ne la
rend pas. Le mode test des outils MJ les rend illimitées.

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

`etat.donjon = { jour, tentatives, partie, dernier, convalescence }`. La partie est un objet
simple, sauvé à chaque changement d'écran : un onglet fermé ne coûte pas la
tentative. Le combat n'est pas sauvé en cours de route : rechargé au milieu,
on revient à la carte et la salle se rejoue depuis le premier tour, équipe
comprise. Entre deux appareils, `donjon` est une valeur : celle de l'appareil
qui l'a changée l'emporte.

Deux succès globaux s'y rattachent (`gardiens`, `remontees`), comptés à la
remontée dans `etat.stats`.
