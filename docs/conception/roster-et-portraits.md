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

## Numérotation

Le numéro d'une carte suit **son palier, puis son type** : dans La Troupe,
communes 001-110, peu communes 111-176, rares 177-209, légendaires 210-220, et
dans chaque palier les artéfacts, puis les lieux, puis les PNJ. Le classeur
garde un onglet par type ; c'est le numéro, pas l'onglet, qui porte l'ordre du
set, et la bibliothèque l'affiche à rebours.

Le numéro entre dans l'identifiant d'une carte (`219-hida`), clé de toutes les
sauvegardes. La Troupe a été numérotée d'abord par onglet, puis renumérotée
ainsi le 30/09/2026 : la migration du schéma 7
(`src/lib/sauvegarde/renumerotation-troupe.json`) remplace chaque ancien
identifiant dans les parties existantes. Une nouvelle extension se numérote
dans cet ordre dès le départ ; renuméroter une extension publiée demande la
même migration.

## Portraits


### D'où vient l'image d'une carte

Trois sources en cascade, la première qui répond gagne :

1. **Fichiers montés depuis le disque** (Réglages MJ → Dossier local, en développement). Appariés par
   le numéro contenu dans le nom de fichier, ou par le nom translittéré :
   `17.jpg`, `ysoline-barq.png`. Ces URL sont éphémères, elles disparaissent au
   rechargement.
2. **URL trouvée dans la ligne** du roster.
3. **Motif construit sur une base** : `{base}/{dossier}/{num}{taille}.webp`.
   Le dossier est l'identifiant de l'extension (`troupe-valeran`), ou `pj` pour
   les cartes PJ, communes à toutes ; la taille est vide pour la carte en grand,
   `-v` pour la vignette. La base vaut `VITE_PORTRAITS_BASE` au build, sinon
   `./portraits`.

Le portrait couvre la fenêtre d'art (environ 0,93 de large pour 1 de haut) :
une illustration 2:3 n'y montre qu'environ 72 % de sa hauteur. Le **point focal
vertical** choisit la bande retenue — 0 garde le haut de l'image, 100 le bas.

Le point focal vaut **30 % pour toutes les cartes**. Il se **force** carte
par carte quand une image est mal cadrée, dans **un seul fichier pour toutes
les extensions**, `Base Image/cadrages.json`, hors du dépôt, avec pour clé le
**code de la carte** affiché à son pied :

```json
{
  "_notice": "…",
  "TRO-164": 5,
  "NAK-012": 60
}
```

Le code tient ensemble l'extension et le numéro : un seul fichier suffit, et
une nouvelle extension n'y demande rien d'autre que son `code` dans
`extension.js`. Le script crée le fichier, vide, s'il manque ; il publie les
valeurs dans `inventaire.json` et signale une clé mal formée, un code
d'extension inconnu, une valeur hors de 0 à 100 ou une carte sans image.
Retirer une ligne rend la carte au réglage général. L'ancien emplacement, un
`cadrages.json` par dossier d'extension, n'est plus lu et le script le signale.

Un calcul automatique par zone saillante (sharp, stratégie *attention*) a été
essayé puis retiré : sur ces illustrations, il poussait la plupart des images
aux extrêmes, 0 ou 100, et cadrait moins bien que la valeur fixe.

Dix points de focal déplacent le cadre d'environ 3 % de la hauteur de l'image.
Les full art et les PJ n'en ont pas : leur fenêtre est au format de l'image.
Le curseur des Réglages MJ règle la valeur générale en développement ; un
cadrage forcé l'emporte sur lui.

Sans portrait, la carte affiche un monogramme gravé plutôt qu'une image cassée.

### Pourquoi les portraits sont publiés à part

Le dépôt est public : une illustration committée serait lisible par tous, avec
son historique. Les portraits ne passent donc **jamais par Git**
(`public/portraits/` est ignoré) et vivent sur un second site Firebase Hosting,
`images.thalazur.io`, publié à la main. Le site, lui, continue de partir de
`main` par GitHub Pages. Deux rythmes : le code au quotidien, les images quand
il y en a de nouvelles.

Ce n'est pas une protection : une image affichée est téléchargeable, et
l'adresse d'une carte se devine. C'est seulement ne pas publier les
illustrations sur GitHub.

Firebase Hosting en gratuit (Spark) sert 360 Mo par jour. Pour une table d'une
dizaine de joueurs, avec la vignette (≈ 35 Ko) dans la bibliothèque et l'image
entière (≈ 130 Ko) seulement en grand, on en reste loin. Au-delà du quota, le
site des portraits cesse de répondre jusqu'au lendemain — les cartes repassent
au monogramme, rien n'est facturé.

### L'inventaire

`npm run portraits` écrit, à côté des images, un `inventaire.json` : pour chaque
dossier, les numéros publiés et une empreinte de l'image. Le site le lit au
démarrage et :

- **ne demande que les images qui existent.** Sans lui, un set de 220 cartes
  dont 12 sont illustrées produirait 208 requêtes en 404 à chaque visite de la
  bibliothèque, et un clignotement sur chaque vignette ;
- **ajoute l'empreinte à l'adresse** (`073.webp?v=…`). Les images sont servies
  avec un cache d'un an : une illustration retouchée change d'empreinte, donc
  d'adresse, et le navigateur la recharge.

L'inventaire vit avec les images, pas dans le dépôt : publier une illustration
ne demande ni commit ni redéploiement du site. Il est servi en `no-cache`
(revalidation à chaque chargement, 304 s'il n'a pas bougé). Pendant qu'il
charge, les cartes attendent sur leur monogramme ; s'il est introuvable, elles
tentent leur image comme avant.

### Publier des portraits

```
Base Image/                    à côté de « Base App TCG », hors du dépôt
  cadrages.json                  points focaux forcés, toutes extensions (TRO-164)
  troupe-valeran/
    073-Scarabée des ruines.png  numéro en tête, le texte qui suit est libre
    164 - Samurai at dusk.png    (nom de la carte ou description du prompt)
    fa-vyrin.png                 full art : fa-<nom>
  pj/
    pj-<nom>.png
```

```bash
npm run portraits           # convertit dans public/portraits/, pour npm run dev
npm run portraits:publier   # idem, puis envoie sur images.thalazur.io
```

Le script convertit en WebP (720 × 1080 et vignette 360 × 540), ne réencode que
ce qui a changé, retire de la sortie ce qui n'est plus dans la source — la
publication remplace tout le site des portraits, elle doit donc tout contenir —
publie les cadrages forcés, et signale : fichiers sans numéro,
numéro absent du roster, texte qui est le nom d'une **autre** carte (signe
d'un numéro décalé ; un texte libre, comme une description de prompt, ne
déclenche rien), cadrage forcé sans image ou hors de 0 à 100.

On peut publier par lots, les cartes sans image gardent leur monogramme. La
seule règle : ne jamais retirer de `Base Image` une image déjà publiée avant de
lancer la publication, elle disparaîtrait du site.

**Mise en place, une seule fois :**

1. `npx firebase-tools hosting:sites:create thalazur-portraits` (le nom est
   celui de `.firebaserc`, cible `portraits`).
2. Console Firebase → Hosting → site `thalazur-portraits` → Ajouter un domaine
   personnalisé : `images.thalazur.io`, puis l'enregistrement DNS demandé chez
   le registrar.
3. Variable du dépôt GitHub `VITE_PORTRAITS_BASE` = `https://images.thalazur.io`,
   puis relancer le déploiement. La CSP et la page Confidentialité en tiennent
   compte d'elles-mêmes.

## Ajouter ou ouvrir une extension

Une extension est un dossier de `src/extensions/` :

```
src/extensions/<id>/
  extension.js   code, titre, statut, couleurs, résumé, full art
  sachet.webp    le visuel du sachet
  roster.json    les cartes (seulement pour une extension ouverte)
```

1. **Annoncer** une extension : créer le dossier avec `extension.js`
   (`statut: "bientot"`, et un `code` de trois lettres majuscules, unique,
   jamais changé après publication) et `sachet.webp`. Elle apparaît sur l'étagère,
   grisée et non cliquable.
2. **L'ouvrir** : `npm run roster -- <fichier.xlsx> <id>` écrit
   `src/extensions/<id>/roster.json`, puis passer `statut` à `"ouvert"`.

Le catalogue (`src/extensions/index.js`) trouve les dossiers tout seul ; le
build échoue si une extension ouverte n'a pas de roster ou si l'identifiant du
dossier ne correspond pas à celui de `extension.js`. Le roster d'une extension
« bientôt » n'est jamais publié.
