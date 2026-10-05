# Audit du Comptoir, 05/10/2026

Périmètre : la manière de vendre et d'acheter, le rôle des acheteurs (PNJ),
l'interface et l'expérience. Sources : la capture vidéo du 05/10/2026
(compte de Clément, 202 cartes possédées, 884 exemplaires en surplus, 101 PO
en poche), le code de `main` au commit `f98becd`, et des mesures faites avec
le marché réel (`construireMarche` sur le roster de La Troupe, 462 articles).

Le Comptoir est un bon moteur de prix enfermé dans une interface de tableur.
Ses acheteurs sont des filtres, pas des personnages. Tant que le joueur avait
une vingtaine de doublons, cela passait ; à 884 exemplaires, trois défauts
dominent :

1. **Vendre est une corvée** : une carte à la fois, dans une fenêtre, sur une
   liste tronquée à 60 lignes.
2. **Les acheteurs se ressemblent** : un plafond de prix efface leur
   caractère, et leurs goûts ne lisent presque pas le vocabulaire du roster.
3. **On ne voit aucune carte** : partout le dos générique, sur la page d'un
   jeu de cartes.

---

## 1. Mesures

| Mesure | Valeur | Où |
|---|---|---|
| Surplus du joueur | 884 exemplaires | badge de navigation |
| Valeur de la vente rapide | 3 984 PO, soit 33 boosters | vidéo |
| Lignes affichées dans « Vos exemplaires en trop » | 60 au plus | `vendables.slice(0, 60)` |
| Offres de Dame Sorelle bloquées au plafond | 240 sur 286 articles | mesure |
| Offres de Voren bloquées au plafond | 231 sur 237 | mesure |
| Succès de marchandage affiché puis rogné au paiement (Sorelle) | 242 sur 286 | mesure |
| Échec de marchandage qui paie moins que l'échoppe (Voren) | 230 sur 237 | mesure |
| Espérance d'un marchandage, 8 acheteurs sur 10 | +5 % à +11 % | `chance × up − (1 − chance) × down` |
| Espérance d'un marchandage, Voren et le Conservateur | −1,6 % | idem |
| Articles qui intéressent Hector | 22 (11 cartes) | mesure |
| Articles qui intéressent Lise | 352 | mesure |
| Part du surplus qui a preneur, selon le jour | de 27 % à 100 % | cycle de 10 jours, pondéré par le tirage |
| Part du surplus qui a preneur, le jour de la vidéo | 46 % | Sorelle, Nassim, Voren |
| Une full art PJ rainbow chez Dame Sorelle | jusqu'à 20 023 PO | `audit-marche.mjs` |

Le cycle de dix jours, pour la part du surplus qui trouve preneur :

| Trio | Part avec preneur |
|---|---:|
| Sorelle, Nassim, Voren | 46 % |
| Hector, Gaspard, Nassim | 76 % |
| Voren, Oriane, Gaspard | 72 % |
| Nassim, Lise, Oriane | 97 % |
| Gaspard, Éloi, Lise | 97 % |
| Oriane, Ysée, Éloi | 77 % |
| Lise, Sorelle, Ysée | 100 % |
| Éloi, Hector, Sorelle | 66 % |
| Ysée, Voren, Hector | 27 % |
| Sorelle, Nassim, Voren, Conservateur | 50 % |

---

## 2. Le négoce et les acheteurs : constats

### C1. Le plafond efface le caractère des acheteurs

`offreUnitaire` borne toute offre à `plafondRachat × ancrage` (1,80). Or le
prix de rachat de l'échoppe monte déjà jusqu'à 1,71 fois l'ancrage quand le
rayon est maigre, ce qui est le cas de **toutes les rainbow** (rayon
d'équilibre 0,3). Il reste alors 5 % de marge pour la prime de l'acheteur, et
tous les acheteurs paient le même prix : dans la vidéo, Sorelle et Voren
offrent chacun 63,4 PO pour le même Brazûk ai Kazûk rainbow. Le
multiplicateur propre à chaque personnage (`mult` de 1,14 à 1,92) ne joue
plus que sur les communes et peu communes normales.

### C2. Le marchandage ment, et ne pose pas de choix

- **Le succès est affiché puis rogné.** La fenêtre annonce « Réussite 88 PO »
  pour le Brazûk ; `vendre` passe `offre × facteur` à `M.payer`, qui rabote au
  même plafond : le joueur touche 63 PO. Un succès ne rapporte rien sur 242
  des 286 articles de Sorelle, alors qu'un échec, lui, coûte vraiment.
  C'est un défaut de code, pas de calibrage.
- **L'échec passe sous l'échoppe.** Chez Voren, un échec fait tomber l'offre
  sous le prix de l'échoppe dans 230 cas sur 237. Le bouton principal reste
  « Vendre » : le joueur qui clique perd de l'argent sans le savoir.
- **Pas de décision.** Pour huit acheteurs l'espérance est positive (+5 % à
  +11 %) : il faut toujours marchander, c'est un clic obligatoire. Pour Voren
  et le Conservateur elle est négative : il ne faut jamais marchander. Dans
  les deux cas la réponse est connue d'avance, le geste n'a pas d'intérêt.

### C3. Les goûts ne lisent pas le roster

Les familles lexicales (`MARTIAL`, `LABEUR`, `REGION`…) viennent du module
d'origine. Elles passent à côté du vocabulaire réel :

- Hector ne reconnaît que **11 cartes**. Manquent « Guerrier » (8),
  « Combattant » (5), « Paladin » (3), « Lancier », « Champion »,
  « Barbare », « Assassin », et « Infantrie lourde » (orthographe du roster).
- **Les factions ne servent à rien.** La faction (`rep3`) est l'axe le plus
  riche de La Troupe : Bestiaire 30, Nakova 28, Troupe 25, Pronolo 16,
  Säab 15, Caravane 11. Seuls Nakova, Odiana et Éléon figurent dans `REGION`,
  et seulement pour Nassim. Pronolo, Säab, Cornalie, Inarva, la GRC ou
  l'Inquisition n'intéressent personne.
- Le déséquilibre est fort : Lise regarde 352 articles (toutes les communes
  et peu communes), Hector 22. D'où des jours à 27 % de preneurs.

### C4. Deux goûts sont du bruit

- **Ysée** « paie pour ce qui gagne », mais `meta` est un hachage de
  l'identifiant de la carte. Le Donjon a de vraies statistiques (attaque,
  initiative, fiches) ; Ysée les ignore.
- **Voren** achète « ce qui monte » : `hausse` est le bruit quotidien du
  rayon. Rien à l'écran ne permet de l'anticiper.

### C5. Le Comptoir mange les ressources du Donjon et du Reliquaire

- Les **rainbow en trop servent à étoiler les fiches du Donjon**
  (`etoiler`, `src/donjon/fiches.js`). Le Comptoir les met en vitrine : le
  jour de la vidéo, les trois fiches d'acheteur proposent une rainbow. Et
  « Liquider mes doublons » vend les rainbow au prix de l'échoppe, sans
  avertissement.
- Les **normales en trop deviennent des vestiges** (5 pour une commune,
  forge à 50). Le Comptoir n'en dit rien : le joueur ne peut pas comparer.

### C6. Des PNJ génériques

Dix personnages sans attache dans Thalazur, une réplique fixe chacun, aucune
réaction à une vente, à un marchandage ou à une carte, aucune mémoire d'un
jour à l'autre. Lise dit chercher « les cartes qui me manquent » : le jeu ne
le traduit pas. Mirko, à côté, est bien plus vivant : il compose ses affaires
d'après la collection. C'est lui le modèle.

### C7. Le rayon ne sert plus

Le rayon est pondéré par le stock : il sort surtout des communes. À 202
cartes possédées, il propose presque toujours des cartes déjà en collection
(les trois pièces visibles dans la vidéo). Il n'aide plus à compléter.

### C8. Le cas des full art

Sorelle et le Conservateur acceptent les full art et les cartes PJ. Une PJ
rainbow peut se revendre 20 000 PO, soit 167 boosters. Les garde-fous restent
justes en moyenne (40 % et 88 %), mais la variance est extrême. À trancher :
les exclure du Comptoir, comme le Reliquaire le fait, ou demander une
confirmation explicite.

---

## 3. Le négoce et les acheteurs : propositions

Classées par ordre de réalisation. Toute proposition qui touche aux prix
repasse par `node scripts/audit-marche.mjs` : `liqMax` doit rester sous 100 %.

### Lot 1. Corrections (aucun choix de conception)

1. **Un seul plafond, appliqué au même endroit.** Le prix affiché est le prix
   payé. Proposition : borner le rachat de l'échoppe à 1,80 × ancrage comme
   aujourd'hui, puis donner à chaque acheteur son propre plafond,
   `1,80 × mult × ancrage`, sur lequel s'applique le marchandage. Les
   personnages retrouvent leur écart. Revérifier `liqMax`.
2. **Un acheteur ne paie jamais moins que l'échoppe.** Après un échec, l'offre
   est bornée au prix de l'échoppe, ou bien l'interface bascule le bouton
   principal sur « Vendre à l'échoppe ».
3. **La liste du surplus n'est plus tronquée en silence** (voir le lot 3).
4. **La vente rapide protège les rainbow et le haut de gamme.** Par défaut
   elle ne prend que les normales commune et peu commune ; les autres
   paliers se cochent, et les rainbow n'y entrent qu'avec la mention de leur
   usage au Donjon.
5. **Des PO entières partout**, et plus de tiret cadratin (charte, chap. 9).

### Lot 2. Des goûts lus sur le roster

- Réécrire les familles à partir des valeurs réelles de `rep1`, `rep3` et
  `race` (la liste est dans ce rapport, section C3), et ajouter un **axe
  faction**.
- Donner à chaque acheteur **une porte d'archétype et une faction de coeur** :
  Hector, la GRC et les gens d'armes ; Nassim, Säab et les caravanes ;
  Oriane, Odiana et le savoir ; Éloi, le Bestiaire ; Gaspard, la Troupe et
  les métiers, etc. Le rattachement est un choix de Clément ; il ancre les
  dix personnages dans la campagne.
- Cible mesurable, ajoutée à `audit-marche.mjs` : chaque acheteur regarde
  entre 60 et 160 articles, et chaque trio couvre au moins 65 % du surplus.
- Ysée lit les statistiques du Donjon. Voren lit la gazette (lot 5).

### Lot 3. Vendre par acheteur, pas par carte

C'est le changement qui retire la corvée. La décision du joueur est « qu'est-ce
que je donne à Sorelle aujourd'hui », pas « que fais-je de Milicien
d'Éklénor ». Le surplus se range donc **par meilleur preneur** :

- « Pour Dame Sorelle : 16 cartes, 612 PO », avec « Tout lui vendre » ;
- un groupe par acheteur présent ;
- « Sans preneur aujourd'hui » : échoppe, Reliquaire (en vestiges) ou
  attendre, avec l'annonce de demain si elle change la donne.

La fenêtre de négoce reste pour la carte qu'on veut travailler (marchandage),
pas pour chaque vente.

### Lot 4. Commandes et réputation

- **La commande du jour.** Chaque acheteur arrive avec une demande composée
  sur les repères du roster, tirée de la graine du jour : « trois PNJ de
  Nakova », « un Lieu de Cornalie et un artéfact », « cinq cartes du
  Bestiaire ». La remplir paie une prime (à calibrer, de l'ordre de +30 %
  sur le lot) et des points de réputation. Une commande impossible avec la
  collection n'est pas proposée, comme les affaires de Mirko.
- **La réputation par acheteur.** Chaque vente l'augmente ; cinq rangs. Elle
  améliore la chance de marchandage, débloque des répliques (une petite
  histoire par personnage, trois ou quatre lignes, à écrire dans la
  campagne), et au rang 3 l'acheteur **met de côté au rayon une carte qui
  vous manque**. Au rang 5, un titre pour le classement.
- Sauvegarde : un champ `etat.comptoir.reputation`, valeur par défaut `{}`
  dans `etatNeuf()`, sans montée de schéma.

### Lot 5. Un marchandage qui se lit

Remplacer le pile ou face par **trois manières de présenter la carte**, par
exemple « le prix ferme », « l'histoire de la carte », « la rareté ». Chaque
acheteur en apprécie une et en déteste une, et sa réplique le laisse deviner
(Éloi veut l'histoire, Voren la cote, Hector la franchise). Un bon choix
monte la chance à environ 80 %, un mauvais la descend à 30 %. On garde un
essai par carte et par jour. Le geste redevient une décision, et lire les
personnages devient utile.

Avec cela, **la gazette du quai** : un évènement par jour, nommé et lié à une
faction (« une caravane de Säab arrive au port : cartes de Säab +25 % »). Il
remplace le bruit `hausse` par une cause lisible et donne à Voren quelque
chose à guetter.

### Lot 6. Un rayon qui aide à compléter

- Les cartes manquantes pèsent quatre fois plus dans le tirage du rayon, et
  portent la marque « Manquante ».
- Une **pièce du jour** mise en avant, rare ou légendaire de loin en loin.
  La marge de 2,6 garde le booster plus intéressant.
- Le Conservateur achète enfin des **ensembles** (triptyque, série full art,
  tous les Lieux d'une province), comme sa réplique le promet.

---

## 4. Interface et expérience : constats

Relevés sur la vidéo (1 920 × 1 080, bureau).

| # | Constat | Effet |
|---|---|---|
| U1 | Le premier écran est pris par trois portraits-affiches ; le titre et la date au-dessus, le rayon sous la ligne de flottaison. Ce que veut l'acheteur tient dans une ligne de pied en petit corps. | Aucune décision possible sans défiler. |
| U2 | Aucune carte n'est montrée : dos générique au rayon, dans le tableau, dans le négoce. `FaceCarte` sait pourtant afficher une vignette. | La page d'un jeu de cartes sans cartes : c'est la « fadeur » ressentie. La charte le dit : les cartes sont la lumière de l'écran. |
| U3 | Tableau de 60 lignes, libellés répétés à chaque ligne (Surplus, Acheteur, Son offre, Échoppe), une ligne sur deux « aucun / Attendre ». Ni filtre, ni regroupement. | Illisible à 884 exemplaires, et tronqué sans le dire. |
| U4 | Prix « 63,4 PO » sur la fiche, « 63 PO » dans le négoce, « 8,76 PO » dans le tableau. | Des centièmes de PO n'ont pas de sens et brouillent la comparaison. |
| U5 | « Marché conclu : +36 PO. » s'insère en bandeau pleine largeur au-dessus des acheteurs et y reste. | Décalage de la page, contraire au piège « une interface ne change pas de taille ». Aucune animation de gain vers la bourse. |
| U6 | Négoce : pastilles tronquées (« Éliana, Adminis… »), trois rangs dans un ascenseur étroit, pas d'image de la carte, « Échoppe » ambigu, « Réussite 88 PO » faux (C2). | La fenêtre est propre mais n'apprend rien sur la carte vendue. |
| U7 | Badge « Comptoir 884 » dans la navigation. | Un stock, pas une action : il ne fait que grossir. |
| U8 | La vente rapide affiche 3 984 PO en grand, couleur lampe. | Invite à tout liquider, rainbow comprises (C5). |
| U9 | Une fiche sans intérêt pour vos cartes garde la même taille d'affiche. | Place perdue au premier écran. |
| U10 | Tirets cadratins dans « l'intéresse — 63,4 PO » et dans la vente rapide. | Contraire à la charte, chap. 9. |

---

## 5. Interface proposée

Le principe : **une scène, puis un ballot**. En haut, on rencontre des gens ;
en dessous, on trie ses cartes. Le Comptoir doit ressembler à une échoppe de
quai à la nuit tombée, pas à un relevé de compte.

1. **Bandeau du jour, compact** : la date, la gazette du quai (une phrase),
   la bourse du Comptoir, et l'annonce de demain avec sa vignette, sans
   bouton à ouvrir.
2. **La scène** : les trois acheteurs, découpes posées sur une planche de
   comptoir, à taille moyenne. Au-dessus de chacun, une bulle courte : sa
   commande, « 16 de vos cartes l'intéressent, jusqu'à 612 PO », ses rangs
   de réputation, et « Lui proposer ». Un acheteur sans intérêt se tient en
   retrait, plus petit, sa réplique dit pourquoi. Le Conservateur a sa place
   à part.
3. **Le ballot** : vos cartes en vraies vignettes, regroupées par preneur
   (lot 3), filtrables par palier, type et faction, sélection multiple. Une
   barre de comptoir collée en bas de l'écran récapitule la sélection :
   « 12 cartes, à Dame Sorelle, 486 PO », bouton « Conclure ».
4. **Le rayon** à côté ou dessous : six vraies cartes, les manquantes en
   avant, la pièce du jour plus grande.
5. **Le négoce** garde ses trois zones, mais la carte y est montrée en
   vignette réelle entre l'acheteur et les chiffres ; les trois manières de
   présenter remplacent le bouton unique ; la réplique de l'acheteur change
   selon l'issue (et, si l'on produit les images, son expression).
6. **Les retours** : pièces qui filent vers la bourse du bandeau, réplique de
   remerciement, plus de bandeau d'avis qui pousse la page.
7. **Le badge de navigation** devient un point quand une commande est
   remplissable ou que le Conservateur passe.

Le brief détaillé pour Claude Design est dans
`docs/conception/brief-comptoir-design.md`.

### Images à produire (Sora)

- Trois expressions par acheteur (neutre, satisfait, déçu), découpes sur fond
  transparent, même cadrage que la planche actuelle.
- Une planche de comptoir en bois et un fond de quai nocturne, très sombres,
  pour la scène (palette froide, une lanterne).

---

## 6. Ordre conseillé

| Lot | Branche | Dépend de | Taille |
|---|---|---|---|
| 1. Corrections | `sujet/comptoir-corrections` | rien | petite |
| 2. Goûts lus sur le roster | `sujet/comptoir-gouts` | choix des factions par Clément | moyenne |
| 3. Vente par acheteur et ballot visuel | `sujet/comptoir-ballot` | maquette Claude Design | grande |
| 4. Commandes et réputation | `sujet/comptoir-commandes` | lots 2 et 3 | grande |
| 5. Marchandage à manières, gazette | `sujet/comptoir-marchandage` | lot 2 | moyenne |
| 6. Rayon orienté collection | `sujet/comptoir-rayon` | rien | petite |

## 7. Questions à trancher

1. Full art et cartes PJ : sortent-elles du Comptoir ?
2. Les rainbow en trop : vendables au Comptoir, ou réservées au Donjon par
   défaut ?
3. La faction de coeur de chacun des dix acheteurs.
4. Les acheteurs restent-ils ces dix personnages, ou certains deviennent-ils
   des PNJ de la campagne (une carte du roster qui « tient boutique ») ?
