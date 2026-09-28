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
rien.

**La fenêtre de retour** vit dans la coque du site : elle s'ouvre d'elle-même
quand une route est rentrée, sur n'importe quelle page, et regroupe les retours
arrivés ensemble. Elle attend si le joueur est **occupé** : ouverture de booster
en cours (`etat.enCours`), page d'ouverture (cérémonie et bilan, où passe le
colporteur), ou page du Donjon avec une descente en cours. Le guetteur regarde
toutes les 30 secondes et au retour sur l'onglet. Le crédit se fait une fois, à
l'annonce ; « Renvoyer la même équipe » relance la route d'un clic.

---

## Reliquaire

- **Dissoudre** : un exemplaire en trop contre des vestiges (5, 10, 25, 100 selon
  le palier). Le dernier exemplaire n'est jamais proposé. Le geste groupé ne
  touche que les communes et peu communes ; une légendaire se dissout une par
  une, avec confirmation.
- **Forger** : une carte manquante contre des vestiges (20, 40, 100, 400).
  Jamais une carte déjà possédée : aucun cycle forge puis revente.
- **Légendaire** : collection de l'extension à 60 % au moins, et une par
  7 jours.
- **Hors Reliquaire** : cartes de personnage, full art, versions rainbow.

Un vestige vaut à peu près une PO de rachat au Comptoir, et la forge coûte
quatre dissolutions. Dissoudre puis forger rend environ trois quarts de ce que
rend vendre puis racheter au Comptoir : un peu moins, mais le Reliquaire a
toujours la carte voulue.

Le Reliquaire travaille sur l'extension courante de la boutique.

---

## Sauvegarde et comptes

Deux champs nouveaux dans `etatVide()`, sans changement de `SCHEMA` :

- `expeditions` : `{ routes, orJour, seq }`. Une **valeur** pour la fusion entre
  appareils : l'appareil qui l'a changée depuis la base l'emporte ;
- `reliquaire` : `{ vestiges, derniereForgeL }`. Les vestiges sont un
  **compteur** (`fusionnerReliquaire`, `src/lib/nuage/fusion.js`) ; la date garde
  la plus récente.

Limite connue : une même route accueillie sur deux appareils avant qu'ils se
synchronisent est payée deux fois (XP et PO s'additionnent). Les montants sont
faibles et le cas demande de jouer hors ligne sur deux appareils à la fois.

## Illustrations

`public/expeditions/` (bandeau, camp vide, maîtresse de route, marqueur de piste),
`public/reliquaire/` (bandeau, gardien, reliquaire, vestige, planches d'effet),
`public/icones/`. Les planches d'effet sont neuf images en bande, lues en
`steps(8)`, noir rendu transparent. Prompts d'origine : projet Claude,
`assets-sora-expeditions-reliquaire.json`.
