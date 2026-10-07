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
Reliquaire avant son ouverture. Les « cartes nouvelles » se jugent en
espérance : ce qu'un booster apporte de cartes nouvelles (pour chaque
palier, les cartes qu'il en tire multipliées par la part qui manque,
`nouvellesParBooster`), fois les boosters que le gain passif ouvre sur la
période (3 par jour, 21 par semaine, `RYTHME`), doit couvrir la cible. Vers
85 % de complétion, il ne manque presque plus que des rares et des
légendaires : la mission sort du tirage au lieu de devenir un hasard. Un débutant qui n'a pas trois modes ouverts reçoit
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
| Ajouter des cartes nouvelles | 2 | 40 PO | un booster en apporte au moins 0,67 en espérance (jusque vers 80 % de complétion) |
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

## La page (maquette de Claude Design, 07/10/2026)

La page reprend le prototype livré par Claude Design (copie dans
`Claude outputs/missions-claude-design/`) : **la table de Bodégué**.

- **Bodégué derrière sa table**, coupé par le plateau sous les mains : l'image
  est posée de sorte que 86 % de sa hauteur dépasse (`--msn-img-h`), sans
  fondu, c'est la table qui coupe. Sa bulle porte la réplique du moment.
- **Trois billets** posés sur le plateau, légèrement de travers, coiffés du
  pictogramme du mode : la mission, sa jauge, sa récompense, « Y aller » ou
  « Réclamer ». Réclamée, la mission reçoit un **sceau** de cire.
- **Le pli de la semaine** à droite, scellé de cire rainbow ; rempli, le
  sceau se rompt et le rabat s'ouvre.
- Une ligne d'échéances : l'heure de minuit, les remplacements restants, et
  « Tout réclamer » dès deux missions prêtes. Les règles sont derrière le « ? ».

**Au bureau, la page tient sur un écran** : elle prend la hauteur sous le
bandeau et la lit en unités `cqh`/`cqw` (`container-type: size`). Une page
conteneur ne doit pas prendre sa hauteur par le flex (base nulle) : les
unités `cqh` y valent 0. Entre 721 et 1 099 px, le pli passe sous les
billets et la page défile ; au doigt, Bodégué est coupé à mi-poitrine en
haut, les billets deviennent des bandes.

**Les poses de Bodégué** (`public/missions/`, 640 px de haut, toutes au même
cadrage pour se remplacer sur place, détourées depuis les sources de
`Base Image/missions/`) suivent l'état de la journée (`humeurDe`, `voix.js`) :
il tend le billet du jour quand tout est neuf, sourit quand une mission est
remplie et un instant après chaque réclamation, lève la lettre scellée quand
la semaine est remplie, ferme les yeux quand la journée est finie, se gratte
la barbe après un remplacement. Les six images sont empilées ; on passe de
l'une à l'autre en fondu de 200 ms.

**Les effets** (`src/missions/scene.js`, API Web Animations, seulement
`transform`, `opacity` et `filter`) suivent la chronologie de la note de
Claude Design : le sceau tombe et refroidit, les pièces volent vers la bourse
du bandeau (de 3 à 8), le chiffre de la bourse attend leur arrivée puis
compte (`src/lib/bourseAffichee.js`) ; les boosters de la semaine filent vers
l'entrée « Boutique » (vers le menu, au doigt) ; un billet remplacé est repris
vers Bodégué puis un neuf est posé ; une mission qui se remplit sous les yeux
s'allume. Un toucher pendant une animation pose tout à l'état final. À
l'arrivée sur la page, les jauges montent depuis ce qui était affiché à la
dernière visite (`etat.missions.vu`, écrit en quittant la page). Mouvement
réduit : aucune animation, et la région `aria-live` annonce les gains.

**Reste à faire** : le décor peint de la table (Sora, 16:9 et 9:16, prompts
dans `claude/assets-sora-missions.json`) ; pour l'instant le plateau est un
dégradé. Remplacer le billet est un premier toucher qui arme (« Remplacer ? »,
annulé après 3,2 s ou par Échap), le second qui remplace.

## Bodégué

L'illustration vient de Clément (`Base Image/missions/bodegue-source.png`),
détourée pour le site (`public/missions/bodegue.webp`, 512 px de haut comme
les autres découpes). Ses répliques (`src/missions/voix.js`) sont
**provisoires**, à réécrire dans la langue de la campagne : l'accueil, la
journée finie, le remplacement, et **une réplique de complétion par type de
mission** (deux le plus souvent, tirées au jour), qui prend la bulle dès
qu'une mission est remplie ; la mission de la semaine a les siennes. Un test
vérifie qu'aucun type n'en manque. La page actuelle
suit la maquette de Claude Design (section précédente).
