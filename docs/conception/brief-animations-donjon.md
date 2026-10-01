# Brief — Animations des compétences du Donjon

**Projet** : La Brume de Thalazur (site de collection de cartes tiré d'une campagne D&D), module Donjon.
**Demandé par** : Clément, 01/10/2026.
**Pour** : Claude Design.
**Livrable attendu** : un prototype HTML autonome qui montre chaque animation, et le code prêt à brancher (voir § 9).

---

## 1. Le besoin

Le combat du Donjon vient de recevoir **quinze compétences nouvelles** : sept gestes et huit techniques. Elles n'ont aucune animation propre : elles retombent toutes sur l'animation par défaut, une légère impulsion de la carte sur place (`pulser`). Une **Double frappe** ou une **Exécution** ne bouge donc même pas vers sa cible.

Il faut :

1. **une animation unique pour chaque compétence nouvelle**, qu'on reconnaît au premier coup d'œil ;
2. **améliorer les anciennes**, qui sont correctes mais sobres ;
3. **une variante « étoilée »** pour chaque compétence (une carte peut étoiler son geste ou sa technique, ce qui la rend bien plus forte) ;
4. **des visuels d'état persistants** (saignement, marque, voile…), qui ne sont aujourd'hui que des petites étiquettes de texte ;
5. **des animations d'événements** qui n'existent pas : le saignement qui mord, le piège qui fait perdre un tour, le renvoi de coup, l'esquive, la relève.

---

## 2. L'arène, telle qu'elle est

Une scène en deux rangées, adversaires en haut et équipe du joueur en bas :

```
.dj-arene                         (position: relative ; le calque des effets)
├─ .dj-frise                      (ordre d'initiative : jetons ronds)
├─ .dj-rang.ennemis               (2 à 4 cartes)
│   └─ .dj-u[data-uid]            (une unité ; classes : actif, ko, ciblable, boss)
│       ├─ .dj-carte.cardbox      (la carte, ratio 2:3, ~110 à 150 px de large)
│       │   ├─ .dj-face           (le portrait et le cadre)
│       │   └─ .dj-sur            (badges ATQ/INI, étiquettes d'état, barre de PV)
│       └─ .dj-etiquette          (« Frappeur · Exécution ★ »)
├─ .dj-milieu                     (consigne, journal, boutons de gestes)
└─ .dj-rang.equipe                (4 cartes, 5 avec une recrue)
```

- **Mobile** : les cartes descendent à ~60–80 px de large. Les étiquettes d'état et les badges sont masqués sous 720 px, d'où l'intérêt de visuels d'état lisibles sans texte.
- **Couleurs** (tokens CSS du site) : fond `#0f181b` ; encre `--ink #ece3d2`. Ensuite, chaque couleur et son usage :

  | Token | Valeur | Usage |
  |---|---|---|
  | `--lamp` | `#e8a33d` | or, garde |
  | `--ember` | `#e5774b` | feu, dégâts |
  | `--m-chene` | `#4e8c7e` | vert, expérience |
  | `--dj-soin` | `#7fd1b9` | soin |
  | `--m-ebene` | `#b33049` | sang, légendaire |
  | (pas de token) | `#9d7cf0` | brume violette |

- **Dégradé rainbow** des étoiles : `linear-gradient(115deg, #f0a3c7, #f5d77e, #8fe0b4, #8fc3f0, #b49cf0)`.
- **Ton** : fantasy sombre, brume, lanternes. Pas de néon criard, pas de dessin animé. Les effets sont des lumières, des traînées, des particules, des secousses.

---

## 3. Les briques d'animation existantes

Elles sont dans `src/donjon/Donjon.jsx`, toutes en **Web Animations API** (`element.animate`) et en éléments posés quelques centaines de millisecondes dans `.dj-arene`. Les styles sont dans `src/styles/donjon.css`.

| Brique | Ce qu'elle fait |
|---|---|
| `ruer(att, cible, { vite, lourd })` | La carte prend un léger recul, fond vers la cible jusqu'à 62 % de la distance, puis revient. À mi-course, un `eclater` sur la cible. |
| `pulser(u)` | La carte se soulève (-8 px), grossit à 1,07 et retombe. C'est l'animation par défaut. |
| `secouer(force)` | Toute l'arène tremble, de 4 à 11 px. |
| `eclater(el, cls)` | Classe `touche` : la face de la cible tremble, avec un éclat radial (`dj-eclat`, variante `lourd`). |
| `projectile(de, vers, cls, { arc, duree })` | Un élément voyage de A vers B, orienté, avec un arc éventuel. Variantes : `fleche` (trait lumineux) et `orbe` (sphère de soin). |
| `balayer(rang, cls)` | Une bande lumineuse traverse toute une rangée. Variantes : `brume` et `sang`. |
| `anneau(el, cls)` | Un cercle s'agrandit et s'efface autour d'une carte. Variantes : `garde`, `galva` et `soin`. |
| Chiffres flottants `.dj-flottant` | « −7 », « +5 », « Esquive »… montent et s'effacent. Classes : `soin`, `crit` et `info`. |
| `.dj-u.touche`, `.dj-u.soigne` | Tremblement de la carte touchée ; halo vert de la carte soignée. |

**Le déroulé d'une action** est le suivant : `await animerGeste(u, geste, cible)`, puis les règles calculent les dégâts, puis les chiffres flottants s'affichent sur les cartes touchées, puis il y a une pause de 560 ms, puis la main passe.

L'animation joue donc **avant** le calcul, et ne connaît pas encore les dégâts. Elle sait seulement qui agit, avec quel geste, et sur qui.

---

## 4. Contraintes techniques (non négociables)

1. **Vitesse ×1, ×2, ×4.** Le joueur choisit la vitesse du combat. Toute durée est divisée par `vitesseRef.current`.
   - Le budget, à ×1, va de **300 à 700 ms** par geste.
   - Une technique à grosse recharge (Tempête, Exécution) peut aller jusqu'à 900 ms.
   - Un geste joué à chaque tour reste court : 450 ms au plus.
2. **Mouvement réduit.** Si le joueur a choisi « mouvement réduit » (`mouvementReduit`), l'animation ne joue pas, ou se réduit à un fondu d'opacité. Les états persistants restent visibles sans animation.
3. **Rien de tiers.** Aucun script, aucune police, aucune image chargés depuis un autre domaine : la politique de sécurité du contenu (CSP) l'interdit. Sont permis :
   - le CSS ;
   - le SVG en ligne ;
   - la Web Animations API ;
   - un canvas éventuel ;
   - de petites images locales (`public/`) si indispensable, en WebP, de 30 Ko au plus chacune.
4. **Pas de bibliothèque d'animation** (pas de GSAP, pas de Lottie, pas de framer-motion). Le reste du site n'en utilise pas.
5. **Le portrait ne doit pas sauter.** Chrome recale au pixel entier une carte qui a fini une animation `transform`, et le portrait « saute » de 1 à 2 px. Ce bug a déjà été corrigé deux fois sur ce site. Il faut donc que :
   - toute animation sur une carte se termine **exactement sur son état d'origine** (`transform: none`) et soit annulée ensuite (pas de `fill: "forwards"` qui reste) ;
   - les grands effets passent plutôt par des **calques posés dans l'arène**, par-dessus les cartes, que par la transformation des cartes elles-mêmes.
6. **Performance mobile.** Animer seulement `transform`, `opacity` et `filter` (avec modération). Pas plus d'une trentaine de particules à la fois. Tout élément posé est **retiré** à la fin.
7. **Le camp compte.** Les rivaux (PNJ ennemis) utilisent aussi les techniques d'origine, du haut vers le bas. Une animation doit marcher dans les deux sens. `u.camp` vaut `"a"` pour l'équipe et `"e"` pour l'adversaire.
8. **Accessibilité.** Pas de flash plein écran de plus de 3 éclairs par seconde. Pas de rouge vif plein écran.

---

## 5. L'inventaire

### 5.1 Gestes (compétence 1, sans recharge : joués souvent, donc courts)

| id | Nom | Cible | Effet en jeu | Animation actuelle | Direction souhaitée |
|---|---|---|---|---|---|
| `attaque` | Attaquer | un adversaire | dégâts ×1 | `ruer` | À **garder**, c'est la base. Peut-être une traînée légère. |
| `estoc` | Estoc | un adversaire | dégâts ×0,85, **ignore l'armure** | aucune (`pulser`) | Ruée **droite et rapide**, sans recul, finie par une **pointe de lumière** qui traverse la carte : l'armure ne compte pas. |
| `entaille` | Entaille | un adversaire | dégâts ×0,6, la cible **saigne 2 tours** | aucune | Ruée en **arc**, avec une **balafre diagonale** rouge sombre sur la cible, puis quelques gouttes. Lance l'état « saigne » (§ 6). |
| `bouclier` | Coup de bouclier | un adversaire | dégâts ×0,7, **armure +2 sur soi** jusqu'à son prochain tour | aucune | Ruée **courte et lourde** (impact sourd, petite secousse), puis au retour un **pavois** doré qui se pose devant sa carte (état « bouclier », § 6). |
| `double` | Double frappe | un adversaire | **deux coups** ×0,55 | aucune | **Deux ruées enchaînées** très vives, la seconde décalée, avec **deux éclats** distincts sur la cible. |
| `secours` | Main secourable | un adversaire | dégâts ×0,5, et **l'allié le plus blessé** reprend PV | aucune | Ruée légère, puis une **petite orbe verte** qui part de la cible vers l'allié soigné. Inconnu au moment d'animer : prendre l'allié vivant au plus faible ratio de PV. |
| `ripostee` | Garde haute | un adversaire | dégâts ×0,8 ; jusqu'à son prochain tour, **rend des dégâts** à qui le frappe | aucune | Ruée, puis au retour la carte prend une **garde** : contour acéré, lames croisées en filigrane (état « garde haute », § 6). |
| `trait` | Trait de brume | la cible **et un autre** adversaire | dégâts ×0,7 sur les deux | aucune | Un **trait de brume** violet vers la cible, qui **rebondit** vers un autre adversaire. Le second est tiré au sort par les règles : animer le rebond vers le voisin le plus proche suffit. |

### 5.2 Techniques (compétence 2, avec recharge : plus spectaculaires)

**Techniques d'origine** (rôles), à améliorer :

| id | Nom | Rôle | Cible | Effet | Animation actuelle | Piste d'amélioration |
|---|---|---|---|---|---|---|
| `provoc` | Provocation | Garde | soi | attire tous les coups, armure +2 | anneau doré + `pulser` | Un **cri** : onde dorée vers le rang adverse, et les jetons adverses de la frise « regardent » la carte. Puis état « provoque » (§ 6). |
| `lourde` | Frappe lourde | Frappeur | un adversaire | ×1,9 | élan, ruée lourde, secousse 9 | Bonne. Ajouter des **fissures** au sol sous la cible et de la poussière. |
| `vise` | Tir visé | Tireur | un adversaire | ×1,6, ignore l'armure | flèche + éclat | Ajouter le **temps de visée** : un réticule qui se resserre sur la cible, puis la flèche. |
| `soin` | Soin | Soigneur | un allié | rend ATQ + 2 PV | orbe verte + anneau | Une **lumière** qui descend sur l'allié, avec des particules montantes. |
| `vague` | Vague de brume | Mage | tous les adversaires | ×1 sur tous | `balayer` brume + secousse | Bonne. Rendre la vague **volumique** (deux couches, une plus lente). |
| `galva` | Galvaniser | Meneur | toute l'équipe | +3 ATQ, 3 tours | anneaux dorés | Un **étendard** ou un éclat doré qui part du meneur et touche chaque allié l'un après l'autre. |
| `coupbas` | Coup bas | Débrouillard | un adversaire | ×1,4 et vole des PO | ruée rapide | Ruée en **contournement** (passe par le côté), avec **une pièce** qui vole de la cible vers l'équipe. |
| `rempart` | Rempart | Artificier | toute l'équipe | armure +3, 2 tours | anneaux dorés | Des **pans de bois et de métal** qui se dressent devant le rang (état « rempart », § 6). |
| `ravit` | Ravitaillement | Intendant | toute l'équipe | rend ATQ PV à chacun | anneaux verts | Des **paniers et miches** qui volent en arc vers chaque allié ; petits chiffres verts. |
| `balayage` | (Gardien, boss) | — | toute l'équipe | ×0,6 sur tous, tous les 3 tours | élan + `balayer` sang + secousse 11 | Bonne. La rendre plus **menaçante** : la carte du gardien s'assombrit un instant avant. |

**Techniques nouvelles**, à créer :

| id | Nom | Rôles naturels | Cible | Recharge | Effet | Direction souhaitée |
|---|---|---|---|---|---|---|
| `execution` | Exécution | Frappeur, Débrouillard | un adversaire | 3 | ×1,4, **triplé si la cible est sous 35 % de PV** | **Ralenti dramatique** : l'arène s'assombrit, un trait vertical tombe sur la cible. Version « coup de grâce » si la cible est sous 35 % (le savoir avant : `cible.pv / cible.pvMax < 0.35`), plus lourde, avec une secousse forte. |
| `marque` | Marque du chasseur | Tireur, Meneur | un adversaire | 3 | ×1, la cible prend **+60 % de dégâts** 2 tours | Une flèche, puis un **sigle** (cercle et croix de chasse) qui s'imprime sur la cible et y reste (état « marqué », § 6). |
| `souffle` | Second souffle | Soigneur, Intendant (réservé) | soi → un allié | 4 | **relève** le compagnon à terre le plus solide (40 % PV) ; sinon soigne le plus blessé | Si quelqu'un est à terre : une **colonne de lumière** verte sur lui, et la carte se **redresse** (elle sort de son gris). Sinon : une grande orbe. Les règles choisissent la cible ; reproduire le choix : le KO au plus grand `pvMax`, sinon le plus faible ratio de PV. |
| `tempete` | Tempête | Mage | tous les adversaires | 4 | ×1,25 sur tous | Plus grosse que la Vague : **éclairs** brefs sur chaque adversaire l'un après l'autre, un voile sombre sur le rang adverse, une secousse forte. |
| `ralliement` | Cri de ralliement | Meneur | toute l'équipe | 3 | +2 ATQ 2 tours, recharges des autres −2 | **Corne ou cri** : une onde qui part du meneur vers chaque allié. Les **pastilles de recharge** des alliés « fondent » si possible. |
| `piege` | Piège à mâchoires | Artificier, Débrouillard | un adversaire | 3 | ×0,8, la cible **perd son prochain tour** (un gardien résiste) | Des **mâchoires de fer** qui se referment d'en bas sur la carte (calque SVG), avec un claquement visuel. Sur un gardien : les mâchoires se brisent. Puis état « piégé » (§ 6). |
| `voile` | Voile de brume | Mage, Garde | un allié | 3 | l'allié est **intouchable** jusqu'à son prochain tour | Une **brume violette** enveloppe l'allié ; sa carte devient légèrement translucide et ondule (état « voilé », § 6). |
| `drain` | Lame vampire | Frappeur, Mage | un adversaire | 2 | ×1,3, et **rend la moitié des dégâts** en PV | Ruée, puis un **filet rouge sombre** qui remonte de la cible vers l'attaquant, avec un halo vert-rouge à l'arrivée. |

---

## 6. États persistants (nouveaux visuels)

Aujourd'hui, un état n'est qu'une étiquette de texte en haut à droite de la carte (`.dj-statuts`), **masquée au téléphone**. Il faut un **visuel posé sur la carte**, discret, sans texte, qui dure tant que l'état dure. Il disparaît sans heurt.

| État | Champ de l'unité | Durée | Visuel souhaité |
|---|---|---|---|
| Saigne | `u.saigne > 0` | 2 à 3 tours | Gouttes qui perlent au bas du cadre ; teinte rouge sur la barre de PV. |
| Marqué | `u.marque > 0` | 2 tours | Le sigle de chasse en filigrane sur le portrait. |
| Piégé | `u.etourdi > 0` | jusqu'à son tour | Mâchoires fermées au pied de la carte, la carte un peu désaturée. |
| Voilé | `u.voile` | jusqu'à son tour | Brume violette qui ondule autour, carte translucide à 85 %. |
| Garde haute | `u.riposte > 0` | jusqu'à son tour | Contour acéré, deux lames croisées en filigrane. |
| Bouclier levé | `u.parade > 0` | jusqu'à son tour | Pavois doré au pied de la carte. |
| Provoque | `u.provoque` | jusqu'à son tour | Existant (étiquette) : ajouter un contour doré pulsant lentement. |
| Galvanisé | `u.galva > 0` | 2 à 3 tours | Lueur dorée en bas de la carte. |
| Rempart | `u.rempart > 0` | 2 tours | Pans dressés devant le rang (un seul calque pour le rang, pas un par carte). |

Les états sont lus à chaque rendu React : une **classe CSS par état** sur `.dj-u` (par exemple `.dj-u.etat-saigne`) et du CSS pur conviennent très bien. En mouvement réduit, le visuel reste, mais immobile.

---

## 7. Événements entre deux gestes (nouveaux)

Ils arrivent quand la main passe (fonction `prochain`). L'interface reçoit `C.notes = [{ note, effets: [{ uid, txt, cls, anim }] }]`.

| Événement | Quand | Animation souhaitée |
|---|---|---|
| Le saignement mord | au début du tour d'une unité qui saigne | Quelques gouttes, un petit tremblement de la carte, « −3 » rouge sombre. |
| Le piège tient | l'unité piégée perd son tour | Les mâchoires se resserrent une dernière fois et s'ouvrent ; son jeton dans la frise se grise et est barré. |
| Renvoi (garde haute) | l'attaquant prend un retour de coup | Éclat inversé : une étincelle part de la cible vers l'attaquant. |
| Esquive (voile) | un coup sur un allié voilé | La ruée **traverse** la brume sans effet ; « Esquive » en flottant. |
| Relève (second souffle) | un compagnon à terre se relève | La carte sort du gris, se redresse de sa rotation de KO, avec une lumière verte. |
| Mise à terre (KO) | toute unité | Améliorer l'existant (`.dj-u.ko` : gris, rotation -3°, descente) : une courte chute avec poussière avant l'état figé. |

---

## 8. Les versions étoilées ★

Une carte peut **étoiler** son geste et sa technique (au prix d'une rainbow en double). Une compétence étoilée est **×1,45 plus puissante** et se recharge plus vite. On doit voir **au premier coup d'œil** qu'un geste étoilé est joué, sans refaire chaque animation :

- une **surcouche commune** appliquée par-dessus l'animation de base, par exemple :
  - une traînée ou des éclats aux couleurs du dégradé rainbow (§ 2) ;
  - une petite étoile qui jaillit de la carte au lancement ;
  - une légère irisation de l'impact ;
- l'information est disponible : `u.etoiles?.geste` et `u.etoiles?.tech` (booléens) ;
- en mouvement réduit : seulement l'irisation fixe, sans mouvement.

Les cartes étoilées portent déjà un anneau irisé et une pastille « 2/4 » ou « STAR » ; la surcouche doit s'accorder avec ce langage visuel.

---

## 9. Ce qu'on attend de toi

1. **Un prototype HTML autonome** (un seul fichier), qui reproduit une arène simplifiée : 3 adversaires, 4 alliés, cartes factices au bon ratio. Il propose :
   - un bouton par compétence (gestes, techniques, `balayage`) et par événement (§ 7) ;
   - une bascule **normal / étoilé** ;
   - une bascule **vitesse ×1 / ×2 / ×4** ;
   - une bascule **mouvement réduit** ;
   - une bascule **camp** (l'allié agit, ou un rival agit vers le bas) ;
   - une bascule **largeur téléphone** (cartes de 70 px) ;
   - les **états persistants** (§ 6) activables carte par carte.
2. **Le code à brancher**, qui reprend notre contrat :
   - une fonction par compétence, au format de la nôtre :

     ```js
     // dans animerGeste(u, g, cible) — u, cible : unités ; el(uid) rend la .dj-u
     if (g === "estoc" && b) { /* … */ return; }
     ```

     Tu peux t'appuyer sur `ruer`, `projectile`, `anneau`, `balayer`, `secouer`, `eclater` et `poser`, ou proposer de nouvelles briques réutilisables (par exemple `trainee`, `sigle`, `colonne`, `rebond`) ;
   - le **CSS** des calques, des états (`.dj-u.etat-*`) et de la surcouche étoilée ;
   - les noms de classes et de fonctions **en français**, comme le reste du code.
3. **Un tableau récapitulatif** : compétence, durée à ×1, éléments posés, ce qui reste en mouvement réduit.

## 10. Critères d'acceptation

- [ ] Chaque compétence du § 5 a une animation **reconnaissable sans lire le journal**.
- [ ] Aucune animation ne dépasse son budget de durée (§ 4.1). Toutes respectent ×2 et ×4.
- [ ] En mouvement réduit, aucun déplacement : au plus un fondu, et les états restent lisibles.
- [ ] Aucune carte ne garde de `transform` après l'animation (le portrait ne saute pas).
- [ ] Tous les éléments posés sont retirés ; pas de fuite après 50 actions enchaînées.
- [ ] Lisible à 70 px de large (téléphone).
- [ ] Une version étoilée se distingue d'un coup d'œil de la version normale.
- [ ] Aucune ressource tierce ; aucune bibliothèque d'animation.
- [ ] Fonctionne dans les deux sens (équipe → adversaires, rival → équipe).
