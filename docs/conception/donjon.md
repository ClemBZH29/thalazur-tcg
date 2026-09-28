# Les Profondeurs

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
  Barde un meneur ; Guerrier, Assassin, Barbare un frappeur. Tout le reste —
  artisans, fonctionnaires, marins — devient **débrouillard**, qui augmente le
  butin : aucune carte n'est inutile.
- **Le palier fixe les PV et l'ATQ**, et ajoute à l'initiative.
- **Les adversaires sont les Créatures, Animaux et Criminels du roster**, les
  salles sont ses **Lieux**, les reliques ses **Artéfacts**. Une extension qui
  ouvre peuple le donjon sans une ligne de code.

Le classement par repère est mécanique : un PNJ légendaire du camp d'en face
dans la campagne peut se retrouver allié s'il n'est pas classé Criminel. C'est
le roster qui fait foi ; pour exclure une carte, la reclasser.

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
- **Animation** : l'attaquant fond sur sa cible (Web Animations, sans
  bibliothèque), la cible encaisse, le chiffre s'élève. Coupée quand les
  animations sont réduites ; le jeu reste lisible par la frise et le journal.

### Remonter ou descendre

Après chaque gardien, on remonte avec tout le sac, ou l'on descend. On peut
aussi remonter après n'importe quelle salle. Si l'équipe tombe, il ne reste
qu'un quart du sac. Avant de descendre, l'équipe souffle : les tombés se
relèvent à un quart de leurs PV.

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

Soit environ 120 PO par tentative en moyenne, 220 pour une descente complète :
deux tentatives valent un à quatre boosters par jour. C'est dans l'ordre de
grandeur des Mines (480 PO de plafond quotidien) ; les deux s'ajoutent, et le
jour où un troisième module arrive, l'enveloppe commune des modules devra
être fixée.

## Sauvegarde

`etat.donjon = { jour, tentatives, partie, dernier }`. La partie est un objet
simple, sauvé à chaque changement d'écran : un onglet fermé ne coûte pas la
tentative. Le combat n'est pas sauvé en cours de route : rechargé au milieu,
on revient à la carte et la salle se rejoue depuis le premier tour, équipe
comprise. Entre deux appareils, `donjon` est une valeur : celle de l'appareil
qui l'a changée l'emporte.

Deux succès globaux s'y rattachent (`gardiens`, `remontees`), comptés à la
remontée dans `etat.stats`.
