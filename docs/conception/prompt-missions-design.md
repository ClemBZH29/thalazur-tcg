# Prompt pour Claude Design : la page des Missions

À coller dans Claude Design avec le dossier `brief-missions/` (voir `brief-missions-design.md`, § 13).

---

Bonjour. Je te confie une nouvelle page de mon jeu de cartes à collectionner, La Brume de Thalazur : les Missions, tenues par un personnage, Bodégué. Tout est dans BRIEF.md (joint), avec la charte graphique du site (elle prime sur le brief), les styles, les pictogrammes, l'illustration de Bodégué et des captures de la page de travail actuelle.

En résumé : chaque jour, Bodégué confie trois missions dans trois modes différents du site (vendre au Comptoir, rapporter des PO des Mines, descendre au Donjon…), payées en PO ; une mission de la semaine, plus longue, paie deux boosters au choix. Une mission se remplace une fois par jour, se réclame d'un geste, et « Y aller » mène à la page où elle se remplit. C'est le rendez-vous quotidien du site : la page doit se lire d'un coup d'œil, et réclamer doit être un petit plaisir, sans écran de récompense.

Ce que j'attends, par ordre d'importance :

1. Une scène plutôt qu'une liste (§ 5) : Bodégué ancré derrière sa table, coupé à mi-corps, sa réplique en bulle ; les trois missions du jour comme des billets posés devant lui, la mission de la semaine comme un pli scellé à part. Bureau 1 440 × 900 (contrôle à 1 280 × 720) et téléphone 390 × 844, sans défilement au bureau.
2. Un prototype HTML cliquable avec les animations en code (§ 7) : le sceau et les pièces qui filent vers la bourse quand on réclame, les boosters qui partent vers la boutique pour la semaine, le billet repris et reposé quand on remplace. Avec des boutons pour faire avancer, remplir, réclamer, remplacer, passer à minuit, et un interrupteur « moins d'animations ».
3. Les états E1 à E8 du brief aux deux largeurs, et l'entrée de navigation « Missions » avec sa pastille.
4. Peu de texte (§ 8) : environ 45 mots aujourd'hui, ne pas en ajouter ; pictogrammes de mode et chiffres plutôt que phrases.
5. Une note courte : chronologie des animations en millisecondes (étape, durée, courbe), jetons et dimensions ajoutés, dans le vocabulaire de la charte.
6. La liste des images fixes à générer dans Sora (la table ou le décor, au plus deux poses de Bodégué dans le style de l'illustration jointe), avec leur ratio.

Contraintes à ne pas perdre : sol froid et une seule lumière chaude (la lampe, réservée aux récompenses et aux états actifs) ; la robe rose et sarcelle de Bodégué reste dans l'illustration, jamais dans l'interface ; la semaine prend l'accent rainbow ; Fraunces pour les titres, Archivo pour le reste, aucune monospace ni capitale espacée ; aucun personnage posé dans le vide ; pas de fenêtre modale ; mouvement réduit respecté ; aucune ressource chargée depuis un domaine tiers ; « booster » et « rainbow » à l'écran. Ne lui invente pas de titre : son rôle dans la campagne viendra plus tard. Commence par deux pistes de composition de la scène en vignettes, puis pousse la plus forte jusqu'au prototype.
