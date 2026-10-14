# Audit du tirage — 14/10/2026

Toutes les probabilités qui font entrer une carte dans une collection, hors
full art et cartes PJ (tirage à part, au booster entier). Mesures :

```
node scripts/audit-tirage.mjs [joueurs] [boosters par jour]
```

Le script prend le tirage, les filets, le colporteur, la carte du jour du
Reliquaire et les trouvailles d'Expéditions dans le code du site ; rien n'est
recopié. Roster mesuré : La Troupe, 110 communes, 66 peu communes, 33 rares,
11 légendaires. Sept boosters par jour pour le colporteur (gain passif,
missions, Donjon, Expéditions).

## 1. Ce qui n'allait pas

**L'inversion.** La rareté se sent carte par carte : la table d'un palier se
partage entre ses cartes. L'ancienne table donnait :

| Palier | Par booster | Une carte précise | Complétion (médiane) |
|--------|-------------|-------------------|----------------------|
| Commune | 2,98 | 2,71 % | 186 boosters |
| Peu commune | 1,69 | 2,55 % | 177 |
| Rare | 0,25 | 0,77 % | 495 |
| Légendaire | 0,08 | **0,71 %** | **392** |

Deux paliers ressentis au lieu de quatre, et les légendaires complètes avant
les rares.

**Le filet.** La documentation annonçait une légendaire tous les dix-neuf
boosters ; c'était un sur 13,4, parce qu'elle oubliait le filet et l'Appel. Le
filet apportait un quart des légendaires et deux premières sur trois, et
l'écran l'annonçait à chaque fois.

**L'Appel de Valéran.** À 30 % de légendaire par emplacement, un Appel en
rendait 1,5 : un sixième des légendaires du jeu.

**Le troc de Mirko.** Trois doublons contre une carte *manquante* du palier
au-dessus, à chaque passage. Joueur qui l'accepte toujours :

| | Boosters seuls | Avec le troc |
|---|---|---|
| Rares complètes | 495 | 216 |
| Légendaires complètes | 392 | 238 |
| Extension complète | 543 | **243** |

Le troc divisait par deux le temps de complétion : il coupe la queue du
collectionneur, ces dernières cartes qu'on attend des semaines. Mirko, pas le
booster, était la vraie source des dernières légendaires.

**Le pari de Mirko.** 4 % de légendaire, plus que le meilleur emplacement d'un
booster, sur une carte choisie parmi celles qui manquent.

**Les trouvailles d'Expéditions.** Les poids 70 / 25 / 5 se lisaient comme la
part de chaque palier ; le code les appliquait carte par carte. Rendu réel :
81 % / 17 % / 1,7 % — une rare sur soixante trouvailles au lieu d'une sur vingt.

## 2. Ce qui a changé

| Levier | Avant | Après |
|--------|-------|-------|
| Emplacement 4 | 95,5 PC · 3,8 R · 0,7 L | 45 C · 52 PC · 2,8 R · 0,2 L |
| Emplacement 5 | 75,5 PC · 20 R · 4,5 L | 72 PC · 25 R · 3 L |
| Appel de Valéran | 70 R · 30 L | 80 R · 20 L |
| Filet, première légendaire | 8 boosters | 10 boosters |
| Filet, ensuite | 25 boosters | 40 boosters |
| Message « légendaire garantie » | affiché | retiré |
| Troc de Mirko | jusqu'à légendaire | jusqu'à rare |
| Pari de Mirko | 76 / 20 / 4 | 72 / 25 / 3 |
| Trouvailles d'Expéditions | poids par carte | part du palier |
| Arrondi du prix à l'aveugle | 5 | 25 (garde 100 vestiges) |

## 3. Le résultat

| Palier | Par booster | Une carte précise | Boosters seuls | Avec le troc |
|--------|-------------|-------------------|----------------|--------------|
| Commune | 3,43 | 3,12 % | 165 | 165 |
| Peu commune | 1,22 | 1,86 % | 252 | 145 |
| Rare | 0,30 | 0,90 % | 441 | 219 |
| Légendaire | 0,05 | 0,45 % | 635 | 631 |
| **Extension** | | | **678** | **631** |

La rareté double à peu près à chaque palier. Une légendaire dans un booster sur
21 ; première légendaire au 8ᵉ ou 9ᵉ booster, deux fois sur trois par le
filet ; un quart des légendaires viennent du filet. L'extension se complète en
trois mois à sept boosters par jour, avant le Comptoir et le Reliquaire. Les
légendaires sont la vraie chasse : quatre cents boosters séparent la dernière
rare de la dernière légendaire.

Effets de bord, tous mesurés par `npm run audit` :

- la revente moyenne d'un booster passe de 20,7 à 20 PO : le rythme du gain
  passif ne bouge pas ;
- la carte du jour du Reliquaire suit les tables : 69 % de communes, 0,6 % de
  légendaires ; son espérance descend à 89 vestiges, le prix à l'aveugle
  reste 100 ;
- le Comptoir et les missions lisent les tables eux-mêmes (`esperances`,
  `nouvellesParBooster`) et s'ajustent seuls.

## 4. Full art et cartes PJ

Hors de l'audit des paliers, mais retouchés le même jour à la demande de
Clément : la 4ᵉ carte tente toujours une full art (1/4 096), la 5ᵉ tente la PJ
(1/8 192) puis, sans elle, une full art (1/4 096). Une full art pour 2 048
boosters environ, deux fois plus qu'avant ; une PJ pour 8 192, inchangé. Le
Comptoir lit l'espérance par `fullartParBooster` (src/lib/draw.js).

## 5. Vérifié sans changement

| Module | Probabilités | Verdict |
|--------|--------------|---------|
| Rainbow | 3 % par carte, 14 % des boosters | inchangé |
| Colporteur | 8 % par booster, une visite par jour, forcé à 18 | inchangé |
| Comptoir | rayon pondéré par le stock, ×4 pour une carte manquante ; marchandage 41–85 %, borné 10–90 % | inchangé |
| Mines | filon généreux 5 % → 35 % avec la Fortune (2 sur 5 exceptionnels), critique plafonné à 75 % | inchangé |
| Donjon | relique : trésor 35 %, élite 55 %, gardien 100 %, Bonne fortune +40 % au plus | inchangé |

Le Donjon ne fait pas entrer de cartes : ses reliques restent dans la
descente. Les Mines non plus : elles paient en PO.
