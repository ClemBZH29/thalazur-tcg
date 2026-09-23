# Roster et portraits

Raisonnement de conception : ce que fait cette partie du site, et pourquoi elle le fait ainsi. Pour travailler sur le projet, voir le [README](../../README.md).

## Charger le vrai roster


Deux chemins, selon l'usage.

**Permanent** — conversion en JSON versionné dans le dépôt :

```bash
npm run roster -- La_Troupe.xlsx troupe-valeran
```

Le classeur porte **un onglet par type de carte**, et c'est l'onglet qui donne le
type : `PNJ`, `Lieux`, `Artéfacts`. Chacun a ses propres en-têtes, ce qui est tout
l'intérêt de la règle — un lieu n'a pas de race, un artéfact n'a pas de faction,
et aucune colonne « type » n'a besoin d'être tenue à jour à la main.

Le script repère chaque colonne **par son intitulé**, pas par son rang : le
classeur peut gagner une colonne (Style, Génération OK, Identifiant…) sans qu'il
soit retouché. Il écrit `src/extensions/troupe-valeran/roster.json`, puis compte ce qu'il a lu —
types, paliers, citations remplies, noms en double, lignes sans palier. Un roster
à qui il manque un palier ne casse rien : le tirage glisse vers le palier voisin,
en silence. D'où ce décompte à la sortie, qui est la seule occasion de le voir.

```
220 cartes écrites dans src/extensions/troupe-valeran/roster.json
Types   : pnj 165 · lieu 37 · artefact 18
Paliers : commune 110 · peu commune 66 · rare 33 · légendaire 11
```

Le genre ne figure pas dans le classeur : la colonne reste vide et la carte
n'affiche simplement pas cette mention.

**Ponctuel** — la page Réglages MJ (`npm run dev` seulement) accepte un `.xlsx` déposé à la volée. Le roster
est alors conservé dans le stockage local et prend le pas sur le fichier livré
dans `src/extensions/<id>/`.

Ordre des colonnes attendu :

| Col | Contenu | PNJ | Artéfact | Lieu |
|-----|---------|-----|----------|------|
| A | numéro | | | |
| B | nom | | | |
| C | type | `pnj` ou vide | `artefact` | `lieu` |
| D | palier | `commun` · `peu commun` · `rare` · `légendaire` | | |
| E | premier repère | archétype | rareté de l'objet | province |
| F | race | race | vide | vide |
| G | troisième repère | faction | porteur ou localisation | type de lieu |
| H | genre (`M` / `F`) | genre | vide | vide |
| I | citation | | | |

Les trois repères occupent des colonnes fixes, **dans l'ordre où ils s'affichent**.
D'où une règle unique de rendu : lire E, F, G et écarter les vides. Un PNJ donne
trois segments, un artéfact et un lieu en donnent deux.

| Type | Ligne affichée |
|------|----------------|
| PNJ | Archétype `|` Race `|` Faction |
| Artéfact | Rareté `|` Porteur ou localisation |
| Lieu | Province `|` Type de lieu |

Le séparateur est posé par CSS (`--sep` dans `cards.css`), pas écrit dans le
texte : à 2,75 cqw, une barre verticale se distingue des lettres là où un point
médian se perdrait dans les empattements.

**La colonne D l'emporte sur tout.** Sans elle, la rareté se déduit de la
fréquence du premier repère, ce qui convient à un roster brut mais détruirait la
répartition d'un set composé à la main. Le tableau des réglages ne concerne donc
que les lignes dépourvues de palier explicite.

**Un palier vide déforme tous les boosters.** `draw.js` glisse vers le palier
voisin quand celui demandé n'a aucune carte — c'est ce qui permet à un roster
partiel de fonctionner. Mais un roster sans commun envoie les trois
emplacements garantis sur peu commun, et l'on ouvre cinq peu communs booster
après booster en croyant les tables déréglées. C'était le cas du roster de démonstration
livré au début du projet, dont la colonne de palier ne contenait que légendaire,
rare et peu commun. La boutique le signale en tête de page au lieu de laisser ce
repli muet ; avec les 110 communs de La Troupe, l'avertissement ne paraît plus.

Sous les repères vient la **citation**, en guillemets et en italique, tronquée à
deux lignes — environ 90 caractères. Elle n'apparaît qu'au-dessus de 250 px de
largeur de carte : sur une vignette de bibliothèque, deux lignes d'italique
seraient illisibles. Le plein écran l'affiche en entier.

## Portraits


Trois sources en cascade, la première qui répond gagne :

1. **Fichiers montés depuis le disque** (Réglages MJ → Dossier local, en développement). Appariés par
   le numéro contenu dans le nom de fichier, ou par le nom translittéré :
   `17.jpg`, `ysoline-barq.png`. Ces URL sont éphémères, elles disparaissent au
   rechargement.
2. **URL trouvée dans la ligne** du roster.
3. **Motif construit sur une base** : `./portraits` + `{num}.jpg`. Les cartes
   disponibles sont `{num}`, `{slug}` et `{nom}`. Pour une installation fixe,
   déposer les images dans `public/portraits/` et laisser la base à `./portraits`.

Le portrait couvre la fenêtre d'art. Avec une bibliothèque hétérogène — bustes
carrés et illustrations pleines mélangés — le réglage **point focal vertical**
choisit la hauteur retenue au recadrage ; 30 % garde la tête visible dans les
deux cas.

Sans portrait, la carte affiche un monogramme gravé plutôt qu'une image cassée.

## Ajouter ou ouvrir une extension

Une extension est un dossier de `src/extensions/` :

```
src/extensions/<id>/
  extension.js   titre, statut, couleurs, résumé, full art
  sachet.webp    le visuel du sachet
  roster.json    les cartes (seulement pour une extension ouverte)
```

1. **Annoncer** une extension : créer le dossier avec `extension.js`
   (`statut: "bientot"`) et `sachet.webp`. Elle apparaît sur l'étagère,
   grisée et non cliquable.
2. **L'ouvrir** : `npm run roster -- <fichier.xlsx> <id>` écrit
   `src/extensions/<id>/roster.json`, puis passer `statut` à `"ouvert"`.

Le catalogue (`src/extensions/index.js`) trouve les dossiers tout seul ; le
build échoue si une extension ouverte n'a pas de roster ou si l'identifiant du
dossier ne correspond pas à celui de `extension.js`. Le roster d'une extension
« bientôt » n'est jamais publié.
