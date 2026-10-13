# Prompt pour Claude Design : les Succès en grimoire

À coller dans Claude Design avec le dossier `brief-succes/` (voir `brief-succes-design.md`, § 14).

---

Bonjour. Je te confie la page des Succès de mon jeu de cartes à collectionner, La Brume de Thalazur. Tout est dans BRIEF.md (joint), avec la charte graphique du site (elle prime sur le brief), les styles, les pictogrammes, des captures de la page actuelle, la dernière page refaite (les Missions, pour le langage du sceau et de la scène) et le contenu réel d'une partie (contenu-exemple.json).

En résumé : 124 paliers de succès, rangés en familles (« Déchireur de boosters » : 25, 100, 300, 1 000, 2 500 boosters) et en chapitres, un par module du site (Boutique, Mines, Donjon, Routes, Négoce, Reliquaire, Missions, Cartes) puis un par extension. Un palier atteint se réclame et paie des PO, des boosters offerts, parfois un titre. Aujourd'hui la page est un mur de 1 770 mots ; je la vois comme un grimoire, avec un sommaire, et chaque catégorie de succès dans un chapitre.

Ce que j'attends, par ordre d'importance :

1. Le grimoire (§ 3) : un livre ouvert dans une scène, sous la lampe ; un sommaire avec l'avancement de chaque chapitre et des sceaux en attente là où il y a à réclamer ; en regard, l'ex-libris (pseudo, titre affiché, renommée, « Tout réclamer ») ; des chapitres où chaque famille est une ligne de médaillons sur un chemin d'encre plutôt qu'une liste de phrases, la phrase se lisant au toucher dans une note en marge. Pages sombres (pense aux livres d'heures noirs : vélin teint, écriture claire), jamais de parchemin crème. Bureau 1 440 × 900 (contrôle à 1 280 × 720) sans défilement, téléphone 390 × 844 une page à la fois.
2. Un prototype HTML cliquable alimenté par contenu-exemple.json, avec les animations en code (§ 6) : tourner les pages, ouvrir une note, réclamer (le sceau tombe, les pièces filent vers la bourse, les boosters vers la boutique, le titre se déroule), tout réclamer en cascade, révéler un exploit caché, choisir son titre, et un interrupteur « moins d'animations ».
3. Les états E1 à E10 du brief aux deux largeurs, l'entrée de navigation avec sa pastille, et le passage vers l'onglet Classement.
4. Peu de texte (§ 7) : 50 mots pour le sommaire et l'ex-libris, 80 pour une double page de chapitre ; chiffres, médaillons et pictogrammes plutôt que phrases.
5. Une note courte : chronologie des animations en millisecondes (étape, durée, courbe), jetons et dimensions ajoutés, dans le vocabulaire de la charte.
6. La liste des images fixes à générer dans Sora (la scène sans livre, le livre ouvert vide vu de face, au besoin une texture de page et une reliure fermée), avec leur ratio ; ornements, lettrines, médaillons et sceaux en SVG dès que possible.

Contraintes à ne pas perdre : sol froid et une seule lumière chaude (la lampe, réservée aux récompenses et aux états actifs) ; Fraunces pour les titres, Archivo pour le reste, aucune monospace, aucune capitale espacée, pas de faux gothique ; pas de livre posé dans le vide ; pas de fenêtre modale ; rien qui change de taille quand on réclame ; mouvement réduit respecté ; aucune ressource chargée depuis un domaine tiers ; « booster » et « rainbow » à l'écran. Les noms des titres et des provinces sont provisoires. Commence par deux pistes de mise en page du sommaire et d'un chapitre en vignettes, puis pousse la plus forte jusqu'au prototype.
