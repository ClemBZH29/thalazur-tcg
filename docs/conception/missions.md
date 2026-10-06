# Les missions de Bodégué

Raisonnement de conception : ce que fait cette partie du site, et pourquoi elle le fait ainsi. Pour travailler sur le projet, voir le [README](../../README.md).

## Pourquoi des missions

Le premier retour bêta (06/10/2026) a montré que les succès faisaient deux
métiers à la fois : accueillir le joueur et le récompenser jour après jour.
Comme un stock, ils payaient tout au début (l'équivalent de 33 boosters dans
la première heure d'un bêta-testeur) puis presque plus rien. Le barème a été
refait (voir `succes-et-classement.md`) ; le revenu régulier du joueur
assidu passe désormais par un **flux**, comme dans les TCG en ligne
(quêtes du jour de Hearthstone, de Pokémon TCG Pocket, de MTG Arena).

## Ce que voit le joueur

Une page, `#/missions`, tenue par **Bodégué**. Une pastille sur l'entrée de
navigation compte les missions remplies qui attendent d'être réclamées.

- **Trois missions du jour**, tirées dans trois modes différents (boutique,
  Comptoir, Mines, Donjon, Expéditions, Reliquaire). Elles changent à minuit,
  heure locale.
- **Une mission de la semaine**, plus longue, payée en boosters au choix. Elle
  change le lundi à minuit.
- **Un remplacement par jour** : une mission du jour pas encore remplie
  s'échange contre une autre, d'un mode que les deux restantes n'occupent pas.
- Chaque mission a un bouton « Y aller » vers la page où elle se remplit.

## Les règles (`src/missions/regles.js`, barème dans `src/config/missions.js`)

**Progression par écart.** Chaque type de mission suit un compteur de la
partie qui ne recule pas (boosters ouverts, cartes possédées, ventes, PO
rapportées des Mines, descentes et gardiens du Donjon, expéditions
accueillies, exemplaires dissous, cartes forgées). La mission garde la valeur
du compteur au moment où elle est confiée (`depart`) ; la progression est
l'écart. Rien de ce qui précède ne compte.

Deux compteurs ont été ajoutés pour elles : `stats.poMine` (cumul des PO
créditées par les Mines, dans `src/jeu/mine.js`) et `stats.descentes` (posé
avec l'apprentissage du Donjon, lu par `descentesJouees`, `src/lib/compteurs.js`).

**Le tirage est déterministe.** La graine est le jour (ou la semaine) : deux
joueurs qui ont les mêmes modes ouverts reçoivent les mêmes missions, de quoi
en parler entre amis, comme le donjon du jour. Le remplacement prend la
graine du jour suivie du numéro de remplacement.

**On ne confie que le possible.** Chaque type déclare `dispo` : pas de vente
au Comptoir sans dix doublons, pas de Donjon sans quatre PNJ, pas de
Reliquaire avant son ouverture, pas de « cartes nouvelles » quand il en
manque moins de quinze. Un débutant qui n'a pas trois modes ouverts reçoit
quand même trois missions, la troisième dans un mode déjà pris.

**Rien de gagné ne se perd.** Au changement de jour ou de semaine, une
mission remplie et pas réclamée est payée au passage. Le passage est vérifié
au premier rendu, puis chaque minute pour une page restée ouverte
(`src/jeu/missions.js`).

**Sauvegarde.** `etat.missions = { jour, remplacees, quotidiennes, semaine,
hebdo }`, valeur par défaut `null` dans `etatVide()` ; aucune montée de
schéma. Entre deux appareils, c'est une valeur : la version de l'appareil qui
l'a changée l'emporte. Une mission réclamée sur les deux appareils avant la
synchronisation serait payée deux fois ; on l'accepte, l'écart est de
quelques dizaines de PO.

## Le barème

| Mission du jour | Cible | Récompense | Possible si |
|---|---:|---:|---|
| Ouvrir des boosters | 2 | 30 PO | toujours |
| Ajouter des cartes nouvelles | 2 | 40 PO | au moins 15 cartes manquantes |
| Vendre au Comptoir | 5 | 40 PO | au moins 10 doublons |
| Rapporter des PO des Mines | 60 | 40 PO | toujours |
| Descendre au Donjon | 1 | 40 PO | au moins 4 PNJ |
| Vaincre des gardiens | 2 | 50 PO | 4 PNJ et 3 descentes jouées |
| Accueillir une expédition | 1 | 30 PO | un Lieu et 4 PNJ |
| Dissoudre au Reliquaire | 10 | 30 PO | Reliquaire ouvert, 15 doublons |

La mission de la semaine reprend les mêmes types à plus grande échelle
(15 boosters, 12 cartes nouvelles, 40 ventes, 600 PO des Mines, 5 descentes,
10 gardiens, 7 expéditions, 60 dissolutions, ou 3 forges au Reliquaire) et
rapporte **2 boosters au choix**.

`scripts/audit-missions.mjs` (dans `npm run audit`) rejoue un an de tirages
pour trois profils : environ **112 PO par jour** et 2 boosters par semaine,
soit **1,2 booster par jour** en plus, 41 % du gain passif. L'audit échoue
au-delà de la moitié : les missions complètent le rythme, elles ne le
remplacent pas.

## Bodégué

L'illustration vient de Clément (`Base Image/missions/bodegue-source.png`),
détourée pour le site (`public/missions/bodegue.webp`, 512 px de haut comme
les autres découpes). Ses répliques (`src/missions/voix.js`) sont
**provisoires**, à réécrire dans la langue de la campagne. La page actuelle
est une mise en page de travail ; la maquette est demandée à Claude Design
(`brief-missions-design.md`).
