# Les Mines de Kazim

Raisonnement de conception : ce que fait cette partie du site, et pourquoi elle le fait ainsi. Pour travailler sur le projet, voir le [README](../../README.md).

## Les Mines de Kazim


Module idle, à `#/mines`. On frappe le filon, on embauche du monde, on descend,
on livre l'étoile aux commandes de Tafix, on fait sauter les étais et l'on offre
ses éclats au Fossoyeur. Le cadre cliquable, les vingt vignettes, les huit
strates, les compagnons, les talents et l'effondrement sont ceux du module
d'origine ; les commandes, la Faveur du Fossoyeur et Tafix datent de la refonte
du 07/10/2026 (section suivante).

## La refonte du 07/10/2026

L'audit du 07/10/2026 (`claude/audit-mines.md` dans le projet) a trouvé quatre
défauts de fond : une conversion en PO à stratégie cachée (le joueur qui
réinvestit touchait 0 à 100 PO par jour, celui qui stockait puis vendait tout
400), un cours qui ne se reconstituait qu'à l'effondrement, une dette qui
punissait l'effondrement, et aucun usage des éclats. Clément a décidé de tout
refondre, et que tout le monde reparte de zéro.

### Les commandes de Tafix

La vente au cours (fatigue, dette, humeur, bonus de volume, résonance, ×15 et
plafond de 480 PO côté application) est supprimée. **Tafix**, kobold rouge dans
une cotte de mailles trop grande pour lui, PNJ de la page, apporte chaque jour
trois commandes à paie fixe (`COMMANDES`, `src/mines/donnees.js`) :

| Commande | Demande | Paie |
|---|---|---:|
| Petite | 20 min de production | 40 PO |
| Moyenne | 60 min de production | 70 PO |
| Grosse | 30 min de production **et 15 min de mine, page ouverte** | 120 PO |

La production est celle de l'équipe plus une frappe toutes les cinq secondes
(`productionNominale`), avec un plancher en filons de la galerie d'entrée. La
paie est en PO du site : l'économie se règle au PO près, sans rien savoir de la
profondeur.

**Modèle hybride** (décision de Clément) : la petite et la moyenne se
remplissent d'une nuit d'absence — la récompense du passage quotidien ; la
grosse demande de l'étoile **fraîche**, c'est-à-dire un quart d'heure de mine
page ouverte et visible depuis son arrivée (`presence`). C'est le principe du
cookie doré de Cookie Clicker. Une première version comptait l'étoile sortie
page ouverte : un joueur qui dépense en arrivant le stock de sa nuit multiplie
sa production par dix en deux minutes, et le simple passage remplissait la
grosse un jour sur cinq. Le temps ne se triche pas ainsi.

Après un effondrement, les commandes pas encore livrées se remettent à la
mesure de la mine neuve (elles ne font que baisser) : tirées le matin sur une
équipe de millions, elles devenaient inatteignables pour qui effondrait à midi.

`scripts/audit-economie.mjs` (refait) : passage de deux minutes 83 PO/j sans
jamais la grosse ; 30 min 212 PO/j, la grosse sept jours sur dix ; 1 h et plus,
environ 260 PO/j. Il échoue si le passage touche la grosse, si une demi-heure ne
la remplit pas un jour sur deux, ou si un profil dépasse 300 PO/j.

### Les éclats comptés en strates, et la Faveur du Fossoyeur

Un effondrement rapporte **un éclat par strate atteinte au-delà de la
quatrième, dans cette mine** (`eclatsDispo`). La racine cubique de l'étoile
cumulée, couplée à une Faveur qui raccourcit chaque mine, rouvrait la boucle
corrigée en septembre : 3 000 éclats en deux semaines. La strate est déjà le
logarithme de l'étoile ; plus de boucle possible, et le gain se lit d'avance.
La dette d'effondrement est supprimée.

Les éclats gardent leurs +3 % de dégâts **et** se dépensent dans **la Faveur du
Fossoyeur** (`src/mines/faveur.js`), sur le modèle de Cookie Clicker : offrir ne
retire rien, `eclatsDepenses` compte ce qui est offert. Quatre branches —
Héritage (ce qu'on garde en rouvrant), Veille (l'absence), Filon (étoile
filante, pioche enchantée, Fortune, critiques), Commandes (une quatrième) —,
douze faveurs, 257 éclats en tout. Le Fossoyeur est un colosse mécanique
antique, trois quarts fer, un quart bois, dans une grotte de cristaux géants.

`scripts/audit-eclats.mjs` (refait, joueur commun dans `joueur-mine.mjs`) : à
une heure par jour, première faveur le premier soir, arbre complet à j36 ; à
vingt minutes, j85 ; à trois heures, j18. Il échoue si l'arbre tombe avant
trois semaines à une heure par jour, ou si les éclats dépassent 5 000 à trois
mois.

### Une salle, pas des onglets

Six onglets à la suite, c'était trop (retour de maquette). L'Échoppe est devenue
**Commandes** ; l'effondrement et la Faveur vivent dans **la salle du
Fossoyeur**, un panneau qui prend la place du front de taille et des onglets,
ouvert par un bouton de l'en-tête dès la cinquième strate. Sa ligne dit ce qu'il
y a à faire (« 4 éclats à offrir », « 6 éclats dans les étais »), un point ambre
qu'il y a quelque chose à faire. La mine continue de tourner pendant ce temps.

**Un onglet ouvert l'est pour le compte** : les onglets se lisaient sur l'état
de la mine, et un effondrement refermait Commandes, Chantier et Talents au
moment même où la salle s'ouvrait. La liste vit dans l'état du jeu
(`etat.tafix.onglets`, union entre appareils).

### Tafix

Une bulle par étape nouvelle (`TAFIX`, `donnees.js`), une seule fois par
compte : arrivée, premier filon, premier compagnon, chantier, talents, filon
riche, Fossoyeur, Faveur. Deux phrases au plus, « Compris » et « Tafix,
tais-toi » ; il remplace la ligne « Frappez la roche » (qui revient si on le fait
taire). Les étapes vues vivent dans l'état du jeu (`etat.tafix.vus`), pas dans
la mine : un effondrement ne les rejoue pas. La bulle et l'écran de remise à
zéro passent par un portail : `.kz` isole son contexte d'empilement, et l'en-tête
du site passait par-dessus.

Les portraits (`tafix*.webp`), le Fossoyeur (`fossoyeur*.webp`) et la grotte
(`faveur-fond*.webp`) se rangent dans `public/kazim/` ; tant qu'ils manquent,
`Personnages.jsx` dessine une silhouette vectorielle à leur place. Prompts :
`assets-sora-tafix.json`, `assets-sora-faveur.json` dans le projet.

### La remise à zéro

Toute partie aux règles antérieures (`regles` < 3) repart de zéro à la lecture
(`relireMine`), **éclats compris** — sinon les anciens joueurs arriveraient avec
l'arbre rempli et le classement de strate ne voudrait plus rien dire. Seul
`poGagnes` est repris. Un écran, dit par Tafix, explique ce qui change et verse
un solde en PO (`remise.js`) : l'étoile en stock au dernier cours kobold (formule
figée, ×15, plafond 240), plus 30 PO par effondrement, plafonné à 480.

Deux pièges : la fusion entre appareils garde d'abord la copie aux règles les
plus récentes (`comparerMines`), sinon une vieille copie plus avancée
l'emporterait et serait remise à zéro à chaque relecture ; et le solde n'est
versé qu'une fois par compte, la marque vivant dans l'état du jeu
(`etat.mine.regles`, et le solde versé `etat.mine.solde`), qu'une vieille
copie de la mine ne peut pas écraser. Le
solde ne compte pas pour les missions.

### Horloge, appareils, versions (audit du 09/10/2026)

Sept défauts relevés par l'audit de synchronisation, tous reproduits par un
test avant d'être corrigés.

- **L'horloge reculée ne rend plus de commandes.** `majCommandes` renouvelait
  dès que le jour *différait* : avancer puis reculer l'horloge de l'appareil
  donnait trois commandes neuves à chaque bascule (2 200 PO pour dix
  aller-retour). Elle ne renouvelle plus que si le jour est *postérieur*
  (les dates AAAA-MM-JJ se comparent comme des chaînes). Même cause pour la
  frénésie de l'étoile filante : sa fin, posée horloge avancée, la faisait
  durer des heures ; `enFrenesie` refuse une fin plus lointaine que sa durée.
- **Un plafond quotidien, en garde-fou.** L'application ne crédite pas plus de
  PO de commandes par jour que n'en paient toutes les commandes d'un jour, la
  quatrième comprise (`PO_COMMANDES_JOUR`, 270 PO ; `crediterLivraison`,
  `src/jeu/mine.js`). Il ferme les autres portes — une vieille copie de la
  mine réimportée avec ses commandes du matin — et ne mord jamais sur le jeu
  normal (l'audit plafonne à 266 PO/j à trois heures par jour). Le compte du
  jour vit dans la marque : `etat.mine.livre = { jour, po }`.
- **Les commandes se fusionnent à part.** La copie la plus avancée l'emporte
  toujours entière, *sauf* ses commandes (`fusionnerCommandes`,
  `src/lib/nuage/fusion.js`) : le même jour, une commande livrée d'un côté
  l'est des deux ; de deux jours, le plus récent. Sinon la bourse additionnait
  une livraison faite sur l'appareil le moins avancé, et la commande se
  livrait une seconde fois sur l'autre.
- **Le solde de remise n'est versé qu'une fois, même payé sur deux appareils
  avant la synchro.** La marque retient le solde versé (`etat.mine = { regles,
  solde }`) ; quand les deux côtés l'ont payé depuis la base, `fusionner3`
  en reprend un, comme un succès réclamé deux fois.
- **Une mine d'une version future fige le module.** Un vieil onglet qui
  adoptait une mine au format plus récent la lisait comme illisible, repartait
  d'une mine neuve et la sauvait par-dessus : partie perdue. `estFuture`
  (`src/mines/sauvegarde.js`) distingue le futur de l'illisible ; sur une
  sauvegarde future, le module ne sauve plus rien et demande de recharger la
  page. Il vérifie aussi avant chaque sauvegarde qu'une version plus récente
  n'a pas écrit entre-temps. Et la remise à zéro ne touche que les règles
  *antérieures* (`regles < REGLES_VERSION`) : des règles futures étaient
  remises à zéro comme des anciennes.
- **L'adoption en attente ne l'emporte plus sur plus avancé.** `magasinKazim`
  servait d'abord la mine adoptée onglet caché, même si un autre onglet avait
  écrit plus avancé depuis ; il rend la plus avancée des deux (`comparerMines`).
- **Les très grands nombres.** `fmt` passe au suffixe suivant quand l'arrondi
  atteint mille (999 999 donnait « 1000 K ») et, au-delà de « Qi », écrit en
  notation scientifique (« 1,23e300 »). Le solde de remise ne paie plus
  240 PO pour une étoile absente : seule une étoile infinie paie le maximum
  (JSON l'écrit `null` : étoile *et* cumul nuls).

### Missions de Bodégué

Le type « Rapporter des PO des Mines » sort du tirage (les missions déjà
confiées se remplissent jusqu'à minuit) ; il est remplacé par « Livrer 3
commandes à Tafix » (15 dans la semaine). Trois, c'est la grosse comprise : la
mission demande de jouer, pas seulement de passer.

Ce qui a changé à l'intégration :

- **Les sprites sont des fichiers.** Le module les portait en base64 dans un
  second fichier : deux cents kilo-octets qui traversaient le bundle à chaque
  chargement de l'application, pour vingt vignettes de sept kilo-octets qu'un
  navigateur met en cache. Elles vivent dans `public/kazim/` et ne se chargent
  que si l'onglet est ouvert. Même traitement pour les onze portraits taillés
  dans la planche — dix acheteurs, le Conservateur, et Mirko qui a quitté le
  Comptoir pour la route : 3,4 Mo de base64 devenus 472 Ko de fichiers.
- **Les styles sont une feuille.** Ils vivaient dans un gabarit injecté par
  `dangerouslySetInnerHTML` à chaque montage ; ils sont dans
  `src/styles/kazim.css`, analysés une fois et mis en cache.
- **Le module ne touche jamais au porte-monnaie.** Il annonce une commande
  livrée par `onCommande`, l'application crédite (`src/jeu/mine.js`).
- **La page ne tient plus de comptabilité.** Elle a porté un temps le quota du
  jour, sa jauge, la pesée et la conversion « une pièce kobolde en vaut quinze
  ici ». L'intention était de ne pas laisser le plafond se découvrir en
  silence ; l'effet était l'inverse — deux monnaies du même nom sur un écran, un
  compteur à zéro tant qu'on n'a rien vendu, et un rapprochement avec le gain
  passif de la boutique, qui n'a rien à faire dans un module de jeu. **La mine
  est du jeu ; les pièces d'or sont l'affaire de la boutique.** Le plafond
  existe toujours et ne s'annonce plus que le jour où il mord, en une phrase.
  Reste un mot : la plaque dit « PO kobold », pas « PO versés », parce que le
  bandeau du site affiche sa propre bourse en PO au même moment.
- **Son titre est un `h2`**, et masqué sur sa page, qui porte déjà le `h1`.
- **Plus un seul sous-titre.** Le journal de cinq lignes était devenu une ligne
  d'état dans l'en-tête ; il n'y a plus rien à l'écran, et la phrase d'ambiance
  de chaque strate — « le schiste grince, l'étoile y perle en grains » — est
  partie avec. Ce qu'elles annonçaient se lit là où on en a besoin : les points
  de talent sur une pastille de leur onglet, l'étoile et l'or sur leurs
  plaques. La région vocale demeure, hors écran, parce qu'un lecteur d'écran n'a
  pas ces plaques sous les yeux.
- **Le module ne pose plus son propre fond.** Il portait un `--ground` opaque
  par-dessus celui de la page, et deux dégradés radiaux par-dessus encore —
  trois couches pour reproduire, à un ton près, ce que la page affichait déjà.
  À un ton près, justement : d'où la couture visible, un rectangle plus clair
  posé sur la page. La mine est une section de la page, pas une fenêtre dans la
  page. (Le voile chaud du coin haut-gauche était parti avant, pour la même
  raison : il lavait le bandeau des plaques d'un jaune pâle sans rien
  signifier. La lumière chaude reste là où elle est produite — le fanal du
  filon, la lueur des ventes.)

### Au téléphone

L'audit mobile du 28/09/2026 trouvait la roche sous le pli à 360 × 780 : le
module ajoutait ses gouttières à celles de la page (le panneau à 34 px du bord
au lieu de 18), les deux plaques, la phrase d'équipe et le Lexique prenaient
chacun leur ligne, et « Descendre » touchait le bord droit du panneau.

- Sur sa page, le module n'a plus de gouttières propres (`.mines .kz-wrap`) : la
  page fournit marges et encoches. Seul, il garde les siennes.
- Sous 720 px, plaques et Lexique tiennent sur une ligne, l'équipe passe
  dessous. La roche commence à 376 px.
- Le libellé de profondeur peut rétrécir (`min-width: 0`) : c'est lui qui
  poussait « Descendre » hors du panneau.
- Les lignes de compagnons, d'équipement et de talents suivent la largeur de
  leur panneau (requête de conteneur) : sous 440 px, bouton et prix passent
  sous la description, qui était sinon comprimée en colonne d'un ou deux mots.

### Ce qui s'ouvre, et quand

Les cinq onglets étaient là dès la première seconde, et quatre d'entre eux ne
voulaient rien dire : l'Échoppe sans étoile à vendre, le Chantier sans étoile
pour acheter, les Talents sans point à placer, l'Effondrement qui exige la
profondeur 5. On arrivait devant un tableau de bord d'usine pour un seul geste
possible — frapper.

| Onglet | S'ouvre | Ce qu'il apporte |
|--------|---------|------------------|
| Compagnons | d'emblée | quelqu'un creuse à votre place |
| Commandes | 1ᵉʳ filon brisé | Tafix achète l'étoile contre des pièces d'or |
| Chantier | 4 filons | du matériel, acheté une fois pour toutes |
| Talents | niveau 2 | un point par niveau |
| *(salle du Fossoyeur)* | profondeur 5 | effondrement et Faveur, par un bouton de l'en-tête |

Le prédicat ouvre l'onglet la première fois ; depuis la refonte, la liste des
onglets ouverts est retenue pour le compte (voir plus haut). Un onglet qui vient de s'ouvrir porte un point
ambre jusqu'à ce qu'on l'ouvre, et son ouverture est annoncée dans la région
vocale. L'ordre du tableau est l'ordre d'ouverture, donc l'ordre d'affichage :
la rangée se lit de gauche à droite comme une progression.

Et parce que rien, dans une roche dessinée, ne dit qu'elle se frappe : **une
ligne « Frappez la roche » le temps du premier filon**, puis plus jamais.

### Le vocabulaire, et le lexique

Un jeu de mine a son vocabulaire, et il vaut mieux qu'il en ait un : « le filon
cède » dit quelque chose que « le compteur atteint zéro » ne dit pas. Mais un
mot d'ambiance qui porte une mécanique doit être définissable en une phrase, et
cette phrase doit être quelque part.

Deux mouvements, donc. D'abord **ce qui n'était pas du vocabulaire mais de la
formule recopiée** a été réécrit. « Une frappe vaut 0,12 s de production de plus
par point » est la définition exacte de `secondesParFrappe` : le joueur n'a pas
à lire le code pour savoir s'il doit dépenser son point. « Poche d'étoile pure »
et « filon en éventail » nommaient deux fois la même chose — un filon qui rend
plus — sans dire combien.

| avant | après |
|-------|-------|
| une frappe vaut 0,12 s de production de plus | vos coups de pioche font plus mal |
| charge la résonance, qui bonifie votre prochaine vente | fait monter le prix de votre prochaine vente |
| poche d'étoile pure · filon en éventail | filon exceptionnel · filon généreux |
| points de roche | résistance du filon |
| cours kobold | prix de rachat |
| Fatigue de la run | Ils se lassent |
| Dette d'effondrement | Mines déjà abandonnées |
| Versé sur cette run | Versé dans cette mine |

Ensuite, **le lexique**, derrière un bouton de l'en-tête. Dix mots, une phrase
chacun, et il ne montre que ceux déjà rencontrés : lire la définition de
l'effondrement au premier coup de pioche n'apprend rien à personne. Il s'ouvre
en surimpression, jamais dans le flux — ouvert ou fermé, la mine garde la même
hauteur, ce qui est la règle de la section suivante.

### Les filons qui rendent plus se voient

Un filon sur trois pouvait rendre quatre ou douze fois plus, et **rien ne le
disait avant qu'il ne cède** : la récompense arrivait après coup, sans cause
visible, et douze points placés dans Fortune ne se voyaient donc nulle part.

Le sort se joue maintenant **à la naissance du bloc** et non à sa rupture — la
probabilité n'a pas bougé d'un millième, mais on voit le filon riche avant de le
casser, et on se jette dessus. La roche prend sa couleur en conséquence :

| rang | roche | éclats | halo | cartouche |
|------|-------|--------|------|-----------|
| ordinaire | schiste froid | étoile bleue | — | — |
| généreux (×4) | teintée | **restent froids** | — | « Filon généreux ×4 » |
| exceptionnel (×12) | saturée | teintés, allumés | respire | « Filon exceptionnel ×12 » |

Le rang 2 n'est pas « le rang 1 en plus saturé » : à douze points de Fortune la
teinte vire au rouge pour les deux, et deux rouges voisins ne se distinguent
pas. Ce sont les éclats — froids sur pierre chaude, allumés sur pierre chargée —
et le souffle du halo qui les séparent.

**La teinte dit jusqu'où on a poussé Fortune.** Une variable, `--kz-teinte`,
posée par le composant : 40° (ambre) sans un point, 0° (rouge franc) à dix. Tout
le bloc CSS en dérive — la pierre, la lueur, le halo, la bordure, le cartouche —
donc une seule ligne de JavaScript déplace l'ensemble. Le talent gouverne la
fréquence ; la couleur dit l'investissement, ce qu'aucun chiffre ne disait. Le
cartouche écrit le multiplicateur, parce qu'une teinte seule ne dit rien à qui
les distingue mal, et l'onglet des talents affiche « un filon sur *n* ».

### La mine ne change plus de taille

Elle mesurait ce que son contenu mesurait. Le premier compagnon embauché
faisait apparaître la rangée de jetons et poussait le panneau de gauche de
vingt-cinq pixels ; un onglet un peu long faisait grandir celui de droite. On
jouait sur une page qui changeait de taille à chaque achat — c'est-à-dire au
moment précis où le regard était ailleurs.

La grille pose sa hauteur une fois, en fonction de la fenêtre et non du
contenu : `height: clamp(560px, 72vh, 780px)`, `align-items: stretch`. Les deux
panneaux la remplissent, et ce qui dépasse défile à l'intérieur — le filon se
dilate pour prendre ce qui reste, la liste d'onglet glisse.

**La rangée de ce qu'on a acheté a déménagé dans l'en-tête.** Elle vivait au
pied de la colonne de gauche, où elle prenait soixante pixels de roche et
poussait le panneau à chaque embauche ; l'en-tête avait, lui, une bande vide de
neuf cents pixels entre les plaques et le lexique. Les deux problèmes se
résolvaient l'un l'autre. Elle tient sur une seule ligne, `flex-wrap: nowrap` :
vingt jetons de quarante pixels entrent dans la bande, et au-delà elle glisse
latéralement plutôt que de passer à la ligne — l'en-tête doit garder la hauteur
des plaques quoi qu'on achète, sinon toute la mine redescend au moment d'un
achat, ce qu'on venait précisément de corriger en bas de colonne.

**Les améliorations de compagnon n'ont plus de jeton.** Quatre rangs par
compagnon, c'étaient jusqu'à vingt-quatre vignettes presque identiques (le même
portrait, un chiffre romain en coin) qui repoussaient le chantier hors de la
bande. Le rang se lit désormais dans la bulle du compagnon — « Porte-fanal ×31 ·
Niv. IV » —, le plus haut tenu et non le nombre d'achats, puisque rien n'oblige
à prendre le I avant le II une fois les deux seuils franchis. À l'achat, c'est
le jeton du compagnon qui salue.

**Et une barre fixe dans une colonne flex doit refuser de rétrécir.** La rangée
d'onglets n'avait pas de `flex` déclaré, donc `flex-shrink: 1` par défaut : dès
qu'un onglet un peu long faisait déborder le corps, elle se laissait comprimer
par ce débordement et se faisait rogner par l'`overflow: hidden` du panneau. On
lisait la moitié basse des libellés, sans qu'aucune règle n'échoue. `flex: 0 0
auto` — c'est la quatrième variété d'échec silencieux de feuille de style
rencontrée sur ce projet, après le sélecteur orphelin, le `[hidden]` battu par
une classe et le `z-index` sous une couche.

Au-dessus de 1024 × 700, la page reprend la main et donne au module toute la
hauteur de la fenêtre (`.mines .kz-grid { flex: 1 }`) : la hauteur fixe ne sert
que sous ce seuil.
- **L'explication du cours kobold est passée derrière un point
  d'interrogation.** Quatre lignes à lire une fois et à subir ensuite,
  au-dessus des boutons de vente.
- **Le semis d'étoile couvre toujours la même part de la roche** (voir la charte
  graphique) : il variait du simple au décuple d'un filon à l'autre.
- **Le cadre du filon répond au clavier.** Il portait `role="button"` et
  n'écoutait que le pointeur, ce que la charte du projet interdit
  explicitement — Entrée et Espace frappent maintenant le filon.

### L'équipe travaille sans vous

La mine ne tourne que sur sa page. Quitter la page, fermer l'onglet ou le
navigateur : au retour, le temps écoulé (huit heures au plus) est **rejoué
avec les mêmes règles qu'en direct** (`simulerAbsence`, `src/mines/regles.js`) —
filons brisés, filons généreux, niveaux, strates descendues — à 35 % du
rendement de l'équipe. Un message du journal en fait le bilan.

L'absence ne donnait auparavant que de l'étoile, calculée d'un bloc : aucun
filon ne cédait, on revenait au même endroit, et l'impression était que rien
ne s'était passé.

Un **onglet resté en arrière-plan** sur la page des Mines n'est pas une
absence : le navigateur suspend l'animation, mais la page est ouverte. Au
retour, ce temps est rejoué à plein rendement. La sauvegarde ne touche plus à
`dernierTick` — l'instant jusqu'où le temps a été joué — : la poser à
« maintenant », comme avant, effaçait chaque minute passée onglet caché.

La mine se sauve localement toutes les cinq secondes, et part sur le compte
dès que l'onglet passe en arrière-plan ou que la page se ferme, sans attendre
le délai d'envoi de trente secondes.

**Plusieurs fenêtres, plusieurs adresses.** Un onglet caché ne sauve plus sa
partie qu'une fois, en se cachant ; au retour, il reprend celle du stockage si
elle est plus avancée. Entre deux copies (onglets, appareils, ou le site et son
aperçu, qui partagent le compte), c'est **la plus avancée** qui l'emporte —
effondrements, puis filons brisés, puis étoile sortie au total
(`comparerMines`, `src/lib/nuage/fusion.js`) — et non plus la plus récemment
sauvée : un vieil onglet oublié effaçait ainsi des talents et des achats.
Les commandes du jour font exception : elles se fusionnent à part (voir
« Horloge, appareils, versions »).

### Les éclats ne s'emballent plus (septembre 2026, remplacé le 07/10/2026)

*Les éclats se comptent désormais en strates (voir « La refonte »). Ce qui suit
reste pour l'histoire de la boucle.*

Au premier jour de jeu réel, un joueur a vendu, effondré, doublé ses éclats en
cinq minutes, effondré de nouveau : 1 814 éclats, et un troisième puits qui en
promettait cinq fois plus. L'audit d'économie ne l'avait pas vu venir, parce
que son joueur simulé ne s'effondre qu'une fois par jour, cours mort.

**Pourquoi.** Un éclat donnait 3 % de dégâts *et* 3 % de récolte. Un filon rend
ce qu'il a coûté à briser, donc l'étoile par seconde est le produit des deux :
elle montait comme le **carré** des éclats. Et les éclats suivaient la racine
carrée de l'étoile cumulée. Les deux exposants s'annulaient : chaque
effondrement doublait les éclats en un temps constant — puis de plus en plus
court, parce que la profondeur gagnée remplit les compagnons plus vite qu'ils
ne coûtent. Rejoué : 2 éclats à 16 minutes, 1 551 à 99, l'infini à 167.

**Deux changements, et il faut les deux** (`src/mines/regles.js`) :

- l'éclat ne touche plus que les **dégâts** — frappes et compagnons. La récolte
  suit déjà les dégâts ; l'étoile par seconde monte désormais comme les
  éclats, et non plus comme leur carré ;
- leur nombre suit la **racine cubique** de l'étoile cumulée
  (`ECLAT_DIVISEUR`) : doubler ses éclats demande huit fois plus d'étoile.

Chacun seul ne suffit pas : racine cubique avec les deux canaux, 660 000 éclats
en dix heures ; dégâts seuls avec la racine carrée, 3,3 millions.

| Même joueur, effondre à × 2 | 16 min | 1 h 40 | 3 h | 6 h 30 | 10 h |
|-----------------------------|-------:|-------:|----:|-------:|-----:|
| Avant | 2 | 1 551 | infini | — | — |
| Après | 2 | 32 | 267 | 1 112 | 1 112 |

Chaque doublement prend plus longtemps que le précédent (15, 19, 21, 24, 25,
36, 64, 150 minutes). `scripts/audit-eclats.mjs` rejoue ce joueur à chaque
`npm run audit` et **échoue** si les effondrements se rapprochent ou si un
nombre sort des flottants.

**Les parties déjà jouées** sont ramenées à la nouvelle règle au chargement
(`relireMine`) : les éclats ne dépassent jamais ce que l'étoile cumulée
autorise — 1 814 éclats pour 1,4 × 10¹³ d'étoile en deviennent 327. C'est un
invariant et non une migration : le sens du champ n'a pas changé, et monter
`SCHEMA` aurait fait lire comme vide toute copie de compte encore au n° 6
(`lireCompte`, `src/jeu/Compte.jsx`, exige l'égalité stricte — à corriger avant
la prochaine vraie migration).

### La pente des strates (retour bêta, 07/10/2026)

*La migration silencieuse décrite à la fin de cette section est remplacée par la
remise à zéro de la refonte. L'accélération n'a plus de plafond à prévoir : avec
des éclats comptés en strates, elle ne fait plus mur.*

Deux parties réelles ont montré que la descente allait beaucoup trop vite : un
nouveau joueur à la strate 12 en vingt-six minutes, sans un seul effondrement ;
Clément à la strate 25 en moins d'une semaine (4 effondrements, 2 228 éclats).
Les huit strates nommées défilaient dans la première heure, et les succès de
strate (3, 5, 8, 12) tombaient tous le premier soir.

**Pourquoi.** Un filon rendait 24 % de ce qu'il avait coûté à briser : un
porte-fanal se remboursait en une minute, la production de l'équipe doublait
toutes les cinq. Face à des points de roche qui ne montaient que de ×3,2 par
strate, chaque strate prenait quelques minutes. `audit-economie.mjs` ne le
voyait pas : son joueur dépense tout, vend une fois par jour et ne mesure que
des PO.

**Ce qui change** (`src/mines/regles.js`) :

- `RECOLTE` passe de 24 % à **7 %** : l'équipe se rembourse trois fois et
  demie moins vite, c'est ce qui freine la première heure ;
- les points de roche suivent `echelle(p)` : **×6 par strate, et 8 % de plus
  à chaque strate franchie** (`PENTE_STRATE`, `ACCELERATION_STRATE`). La
  récolte seule ne freine que le début ; la pente qui s'accentue borne le
  milieu et la fin ;
- l'ancre du cours suit la même échelle et la même part de récolte : un PO
  vaut toujours à peu près quatre filons de la strate 1. Le plancher de
  l'ancre passe de 12 à 3,5 en proportion.

| Strate atteinte | 15 min | 1 h | 4 h | j1 (1 h/j) | j7 (1 h/j) | j60 (1 h/j) |
|-----------------|-------:|----:|----:|-----------:|-----------:|------------:|
| Avant | 10 | 13 | 22 | 13 | 28 | 32 |
| Après | 3 | 7 | 9 | 7 | 13 | 16 |

`scripts/audit-strates.mjs` (lancé par `npm run audit`) rejoue une soirée
continue et trois habitudes sur deux mois, et **échoue** si l'Abîme (strate 8)
redevient l'affaire de la première heure, ou si l'on passe la strate 20 en deux
mois. Son joueur a été recoupé avec les deux parties réelles sous l'ancienne
pente.

**Les parties déjà creusées** remontent à la galerie d'entrée au chargement
(`relireMine`, champ `pente`) : équipe, achats, talents et éclats gardés, la
profondeur seule repart de 1 et l'équipe redescend jusqu'où elle tient. Sans
cela, un filon de la strate 25 sous la nouvelle pente pèserait dix puissances
de plus que tout ce que l'équipe frappe, et le cours ne paierait plus rien.
Les succès de strate déjà réclamés restent acquis.

## Outils MJ

En développement (`npm run dev`), **Réglages MJ → Mode test → Mines de Kazim**
active la **God-Pioche** : chaque frappe inflige exactement ce qui reste au
filon, qui se brise d'un coup. Elle se reconnaît à la pioche de fer passée à
l'or, et « par frappe » affiche « God-Pioche ». Comme tout le mode test, elle
n'existe pas sur le site publié.

La mine n'écrit rien tant qu'elle n'a pas relu sa sauvegarde : un démontage
avant la fin de la lecture (quitter la page aussitôt, ou le double montage de
React en développement) enregistrait sinon la mine neuve par-dessus la partie.
