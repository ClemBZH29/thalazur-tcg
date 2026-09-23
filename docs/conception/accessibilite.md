# Accessibilité

Raisonnement de conception : ce que fait cette partie du site, et pourquoi elle le fait ainsi. Pour travailler sur le projet, voir le [README](../../README.md).

## Accessibilité


Ce qui a été vérifié et corrigé :

- **Contrastes** mesurés puis relevés. `--ink4` tombait à 2,55:1 sur les panneaux
  et `--ink3` à 4,31 ; les deux atteignent maintenant 4,5:1 sur la surface la
  plus claire de l'interface. Un jeton `--edge-ui` distinct a été introduit pour
  les bordures d'éléments interactifs, que WCAG 1.4.11 exige à 3:1 — les
  bordures décoratives plafonnaient à 1,6.
- **Cartes opérables au clavier** : elles n'étaient que des `div` à écouteurs de
  pointeur, donc hors du parcours de tabulation et muettes. Elles portent
  maintenant `role="button"`, un index de tabulation, une étiquette explicite et
  la gestion d'Entrée et Espace.
- **Plein écran** : `aria-modal`, piège à focus, focus rendu à l'élément
  d'origine à la fermeture, fermeture par Échap.
- **Annonce vocale de la révélation** : sans elle, un lecteur d'écran ne recevait
  rien pendant toute l'ouverture. Une région discrète annonce le nom, le palier,
  la mention Rainbow, la nouveauté et le nombre de cartes restantes.
- **Repère principal** (`<main>`) sur chaque vue et **lien d'évitement** vers le
  contenu — la navigation défile horizontalement sur mobile et était longue à
  franchir à la tabulation.
- **États ARIA** sur les bascules : `aria-pressed` sur la version affichée, les
  filtres de rareté et le sélecteur de set. Étiquette sur chaque sélecteur de
  palier de grade, qui n'était identifié que visuellement.
- **Mouvement réduit** respecté partout, y compris la sortie des cartes du
  sachet, qui restait vide sans transformation finale explicite.

Ajouté avec les pages et les deux modules :

- **Le focus suit le changement de page.** Sur un site en une seule page, le
  navigateur ne remet ni le défilement ni le focus : on arrivait au Comptoir au
  milieu de la page et la tabulation reprenait là où elle était. Le titre de la
  page reçoit maintenant le focus, avec quelques images d'attente pour les deux
  pages chargées à la demande, dont le titre n'existe pas encore au moment où
  l'adresse change.
- **Un seul `h1` par page.** « Bibliothèque » et « Réglages » portaient un `h2`
  du temps où elles étaient des vues ; le titre interne des Mines faisait
  doublon avec celui de la page.
- **Le cadre du filon répond à Entrée et à Espace.** Il portait `role="button"`
  et n'écoutait que le pointeur.
- **La fenêtre de négoce est un dialogue complet** : `aria-modal`, piège à
  focus, focus rendu à l'élément d'origine, fermeture par Échap. Le module
  d'origine n'avait qu'un fond cliquable, donc la tabulation sortait derrière la
  fenêtre et l'on marchandait à l'aveugle.
- **La navigation descend sous le pouce en dessous de 860 px**, en barre fixe à
  six entrées. Le nom complet reste dans le flux pour le nom accessible du lien,
  seul l'affichage prend une version courte.
- **Contrastes des nouvelles couleurs mesurés.** Un échec trouvé et corrigé :
  `--m-chene` en texte tombait à 4,35:1. Le piège est celui que la charte
  signale déjà — une teinte de palier n'est pas une encre.
- **Mouvement réduit respecté sur les six pages.** La règle vivait dans la
  feuille du Comptoir, qui n'est chargée qu'avec sa page : la veilleuse de la
  bourse continuait de battre partout ailleurs.

Ce qui reste imparfait : le geste de déchirure n'est pas reproductible au
clavier, mais deux boutons offrent le même résultat juste en dessous.
