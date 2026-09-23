# La boutique, le tirage et l'économie

Raisonnement de conception : ce que fait cette partie du site, et pourquoi elle le fait ainsi. Pour travailler sur le projet, voir le [README](../../README.md).

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
**Profil → Préférences → Animations**, à trois états :

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
suivent Profil → Préférences → Animations, comme tout le reste du site.

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

L'heuristique de fréquence n'est qu'un point de départ. La page Réglages MJ (`npm run dev`) liste
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
Profil → Préférences → Doublons. La rallumer rend le comportement historique — le doublon
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

## Mode test


Réglages MJ → Mode test (`npm run dev` seulement ; ignoré sur le site publié). Rien n'a d'effet tant que l'interrupteur principal est
éteint, et les cartes obtenues rejoignent la bibliothèque comme les autres.

| Réglage | Effet |
|---------|-------|
| Pièces d'or | supprime le coût des boosters |
| Cartes par booster | de 1 à 10, la montée sur les deux derniers emplacements est conservée |
| Palier forcé | met toutes les cartes sur un palier, full art et PJ compris |
| Rainbow | force ou supprime l'irisation |

## La caisse

La bourse, le nombre de boosters qu'elle paie et le gain passif tiennent dans
une bande sous l'étagère (`src/components/Caisse.jsx`). Ils vivaient à droite
du titre, ce qui donnait à la Boutique un en-tête plus haut que celui des
autres pages ; le gabarit commun l'interdit désormais. Sur téléphone, la bande
passe au-dessus des vignettes, qu'on ne verrait jamais sous quatre sachets
empilés.

Le délai avant le prochain booster n'est plus répété sur la vignette : la caisse
le donne, une fois.

Le plafond de 720 PO borne le **gain passif**, pas la bourse : ventes et mine
peuvent la porter au-delà. L'ancien libellé « Réserve pleine, 720 PO »
contredisait alors la pastille du bandeau ; la caisse dit « en pause au-delà
de 720 PO ».
