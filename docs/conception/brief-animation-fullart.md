# Brief — Ouverture d'une full art et d'une carte PJ

**Projet** : La Brume de Thalazur, ouverture des boosters.
**Demandé par** : Clément, 05/10/2026.
**Pour** : Claude Design.
**Pièces jointes** : le dossier `brief-fullart/` (code et images du site,
liste au § 8) et la vidéo d'une ouverture de full art en local.

---

## 1. Le besoin

Un booster sur 4096 contient une **full art**, un booster sur 8192 une
**carte PJ** (les personnages des joueurs de la campagne). Ce sont les deux
cartes les plus rares du jeu, au-dessus des légendaires.

Aujourd'hui, leur ouverture ne se distingue pas de celle d'une légendaire
(voir la vidéo) :

- la montée joue la même lueur cramoisie, les mêmes particules et le même
  assombrissement, juste un peu plus longtemps ;
- la carte se retourne comme les autres ;
- **le nom n'apparaît nulle part**. Ces cartes portent un cadre « pleine
  illustration » **sans aucun texte** : le joueur voit une illustration,
  sans savoir qui il vient de tirer ni de quelle série.

Il faut une **cérémonie propre à ces deux paliers**, où l'on voit à la fois :

1. **la rareté**, dès la montée, avant le retournement : le joueur doit
   comprendre que ce n'est pas une légendaire de plus ;
2. **le nom de la carte**, puis sa **série** (« Valéran — Maid Café »), qui
   apparaissent au moment de la révélation.

La full art a son code couleur ; la carte PJ reprend la même cérémonie avec
un **code couleur alternatif** (§ 4).

---

## 2. Ce qui existe (à garder en tête, pas à refaire)

Toute la scène est dans `src/components/Ouverture.jsx`. Chaque carte du
booster passe par quatre états :

| État | Ce qui se passe | Durée |
|---|---|---|
| `dos` | La carte attend, face cachée, sur la pile. Le joueur la touche. | — |
| `montee` | Lueur (`.lueur.monte`), particules qui convergent (`.motes`), assombrissement de la page (`.ombre-scene`). | `tele` ms |
| `retournement` | Retournement 3D (`.flipper`). | `flip × 0,55` ms, puis `face` |
| `face` | Carte visible. Le joueur la glisse pour passer (balayage) ou la touche pour l'agrandir. Badge « New » si elle entre en collection. | — |

Les durées et les couleurs par palier sont dans `src/config/tiers.js`
(`TIER_INFO`) :

| Palier | `lueur` | `tele` | `flip` | `motes` | `ombre` |
|---|---|---|---|---|---|
| Légendaire | `#b33049` | 820 | 840 | 28 | 0,56 |
| Full art | `#b33049` | 1150 | 1000 | 42 | 0,72 |
| PJ | `#e3ecf4` | 1550 | 1150 | 58 | 0,84 |

Le visuel des cartes, dans `src/components/FaceCarte.jsx` et
`src/styles/cards.css` :

- **Full art** : cadre `carte-cadre-fullart.webp` teinté cramoisi
  (`#b33049`), halo cramoisi, irisation légère.
- **PJ** : le même cadre, **noirci** (désaturé, assombri), halo argenté
  froid (`rgba(227,236,244,…)`).

Le son est dans `src/lib/audio.js`. `montee(tier)` et `revele(tier)` n'ont
**rien** pour `fullart` ni `pj` : ces cartes sortent aujourd'hui en silence.

---

## 3. Ce qu'on attend de la cérémonie

### La rareté, avant le retournement

La montée doit annoncer « au-delà du légendaire » d'une façon qu'une
légendaire ne fait jamais. Une piste, que tu peux remplacer par mieux :
**l'illustration déborde**. Une full art, c'est une illustration sans
marges. Pendant la montée, la lumière dessine le cadre autour du dos, ou
fend le dos sur ses bords. Au retournement, l'illustration déborde un
instant hors du cadre, puis s'y range.

Le joueur doit reconnaître la cérémonie dès la deuxième fois, sans lire.

### Le nom, à la révélation

- Le **nom** en grand, en Fraunces (`--font-display`, coupe « wonk » du
  site), puis la **série** plus petite, et le **palier** en petites
  capitales : « Pleine illustration » ou « Carte PJ ».
- Il apparaît **pendant ou juste après** le retournement : gravé, écrit à la
  lumière, déroulé… à toi de voir. Il doit se lire à coup sûr, au téléphone
  aussi.
- Il **reste affiché** tant que la carte est de face, comme un cartouche, et
  **s'efface quand le joueur glisse la carte**. Le badge « New » fait déjà
  ça avec la variable `--swipe` (de 0 à 1), posée sur `.cardbox` pendant le
  geste : fais pareil.
- **Aucun décalage de mise en page.** La pile, la jauge et le bouton
  « Suivante » ne doivent pas bouger d'un pixel. Le cartouche se pose en
  surimpression : sur le bas de la carte avec un voile, ou dans l'espace
  sous la carte, en position absolue. Au téléphone, la place est comptée
  (`--carte-plein` va de 140 à 306 px selon l'écran).
- Le nom complet est `c.nom`, la série `c.serie` (elle peut être `null`).
  Les PJ n'ont pas de série : leur nom suffit (« Siobhan », « Karhu »,
  « Jean-Claude »…).

### Le rythme

Une full art est rarissime : la cérémonie peut prendre son temps, sans
lasser au point qu'on la saute. Repère : **environ 3 s** de la touche au
nom lisible pour une full art, **environ 4 s** pour une PJ. Tu peux
proposer d'autres valeurs de `tele` et `flip` : donne-les dans ta
livraison.

---

## 4. Les deux codes couleur

| | Full art | Carte PJ |
|---|---|---|
| Idée | La pièce de collection : riche, chaude, éclatante | Un des héros de la table : grave, nocturne, solennel |
| Couleur dominante | Cramoisi `#b33049`, celui du cadre | Noir du cadre, argent froid `#e3ecf4` |
| Accent proposé | L'or du site (`--lamp` `#e8a33d`), pour la distinguer de la légendaire, qui est cramoisie seule | Lumière de lune, bleu très pâle ; le plus noir possible autour |
| Assombrissement de la page | Profond | Presque total |
| Cartouche du nom | Lettres or sur cramoisi, ou or seul | Lettres argent sur noir |

Ce sont des propositions : garde ce qui sert la lecture, et justifie ce que
tu changes. Une seule contrainte : **la full art ne doit pas ressembler à
une légendaire**, et la PJ doit se reconnaître comme une variante de la
full art, pas comme une autre famille.

Une full art ou une PJ peut aussi sortir **rainbow** (`c.rainbow`, 3 % des
tirages). L'irisation du site se pose alors sur la carte. La cérémonie doit
rester lisible par-dessus, et peut prévoir un reflet irisé en plus, discret.

---

## 5. Le contrat

Un module ES autonome, `src/ouverture/ceremonies.js`, avec sa feuille
`src/styles/ceremonies.css`. Ouverture.jsx l'appellera à chaque changement
d'état, **pour les seuls paliers `fullart` et `pj`** :

```js
import { creerCeremonie } from "../ouverture/ceremonies.js";

const cer = creerCeremonie({
  scene,          // () => l'élément .scene de la révélation
  carte,          // () => l'élément .avance (il contient la .cardbox de la carte courante)
  reduit,         // () => true si le joueur a demandé moins d'animations
});

cer.montee(c, ms);        // état « montee » : dure `ms` (tele)
cer.retournement(c, ms);  // état « retournement » : dure `ms` (flip × 0,55), puis « face »
cer.face(c);              // état « face » : le cartouche du nom s'installe et reste
cer.degager();            // le joueur glisse la carte : le cartouche s'en va avec elle
cer.nettoyer();           // « Tout ouvrir », départ de la page : tout disparaît sur-le-champ
```

`c` contient au moins `{ tier: "fullart" | "pj", nom, serie, rainbow }`.
Chaque fonction peut rendre une promesse. Ouverture.jsx garde la main sur le
tempo : elle passe d'un état à l'autre avec ses propres minuteurs (`tele`,
`flip`), et ne dépend pas de la fin de tes animations.

Tu peux **remplacer** la lueur, les particules et l'assombrissement
d'origine pour ces deux paliers. Dis-le, et Ouverture.jsx ne les jouera
plus pour eux. Tu peux aussi **animer la carte elle-même** (`.cardbox`,
`.plaque`, `.cadre`, `.fenetre img`) en Web Animations, à condition de la
rendre intacte à la fin : aucun style ni `fill` qui reste.

**Le son** (facultatif mais bienvenu) : propose des entrées `fullart` et
`pj` pour `montee(tier)` et `revele(tier)` dans `src/lib/audio.js`, avec
ses deux briques `ton(fréquence, durée, options)` et `bruit(durée,
options)`, comme pour la légendaire.

---

## 6. Les règles du site

- **Rien de tiers.** Pas de bibliothèque, de police, d'image ni de script
  chargés d'ailleurs : la CSP et la page Confidentialité l'interdisent.
  CSS, Web Animations et SVG en ligne seulement. Polices : celles du site
  (`tokens.css`).
- **Classes préfixées `cer-`**, pour ne rien écraser dans `app.css` et
  `cards.css`.
- **Rien ne bloque la carte.** Tous les calques sont en
  `pointer-events: none`. Le toucher (agrandir) et le balayage (passer)
  doivent marcher dès que la carte est de face.
- **Mouvement réduit** : `[data-mouvement="reduit"]` sur la racine, ou
  `reduit()`. Alors, des fondus seulement, pas de mouvement ni de
  particules, mais **le nom apparaît quand même** : c'est une information,
  pas un effet.
- **Téléphone d'abord.** Une scène fluide sur un téléphone moyen : peu de
  calques à la fois, `transform` et `opacity` plutôt que des filtres sur de
  grandes surfaces.
- **Accessibilité** : le cartouche est décoratif (`aria-hidden`). La
  région `.annonce` (`aria-live`) annonce déjà le nom au lecteur d'écran.
- **En français**, comme le reste du code : noms, commentaires.

---

## 7. La livraison

1. `src/ouverture/ceremonies.js` et `src/styles/ceremonies.css`, selon le
   contrat du § 5.
2. Un **prototype HTML autonome** qui rejoue l'ouverture d'une full art et
   d'une PJ, avec et sans rainbow, en mouvement normal et réduit, avec les
   images jointes.
3. Un **récapitulatif** des durées par étape, et des valeurs de `tele` et
   `flip` que tu proposes.
4. Les entrées de son, si tu en proposes (§ 5).
5. La liste de ce qu'Ouverture.jsx doit cesser de jouer pour ces deux
   paliers (lueur, particules, assombrissement), si tu les remplaces.

---

## 8. Les pièces jointes (dossier `brief-fullart/`)

| Fichier | Pour quoi |
|---|---|
| `Ouverture.jsx` | La scène et ses quatre états (§ 2) |
| `Carte.jsx` | La carte : inclinaison, retournement, balayage, `--swipe` |
| `FaceCarte.jsx` | Le rendu « pleine illustration » (sans texte) |
| `cards.css` | Cadre, teintes `t-fullart` et `t-pj`, irisation |
| `app.css` | Styles de la scène : `.lueur`, `.motes`, `.ombre-scene`, badge, mouvement réduit |
| `tokens.css` | Couleurs et polices du site |
| `tiers.js` | Les paliers et leurs durées |
| `speciales.js` | Full art et PJ : noms, séries |
| `audio.js` | Les sons de l'ouverture |
| `carte-cadre-fullart.webp`, `carte-dos.webp` | Le cadre pleine illustration et le dos |
| `fa-valeran-maid-cafe.webp`, `fa-nemelye-nuit-ecarlate.webp` | Deux illustrations de full art pour le prototype |
