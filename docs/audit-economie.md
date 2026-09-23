# Audit économique — la mine, le gain passif, le Comptoir et le colporteur

Ce document répond à une question posée avant l'intégration : combien de
boosters par jour, une fois les Mines de Kazim branchées sur la bourse ? Les
chiffres viennent de `scripts/audit-economie.mjs`, à relancer après toute
retouche de `MINE` dans `src/config/tiers.js` :

```bash
node scripts/audit-economie.mjs
```

Le script ne recopie aucune formule. Il lit la tranche pure de
`src/mines/MinesDeKazim.jsx` — celle qui ne dépend ni de React ni du navigateur
— et rejoue la boucle du module : dégâts, filon brisé, récolte, descente. Un
audit qui duplique le code qu'il mesure ne mesure plus rien.

---

## 1. Le point de départ

| Grandeur | Valeur |
|----------|--------|
| Prix d'un booster | 120 PO |
| Gain passif | 15 PO par heure, soit 360 PO par jour |
| Plafond d'accumulation passive | 720 PO, soit 48 h de réserve |
| **Rythme de l'application seule** | **3,0 boosters par jour** |

C'est ce chiffre-là que la mine doit compléter, et c'est lui qui rend la
première mesure embarrassante.

---

## 2. La mine telle qu'elle est livrée : 2 % du gain passif

Mesure faite avec la mine branchée directement, une pièce d'or annoncée par les
kobolds valant une pièce d'or dans la bourse.

| Profil de jeu | PO par jour, mine seule | Total | Boosters/jour |
|---------------|------------------------:|------:|--------------:|
| Ne joue pas la mine | 0 | 360 | 3,0 |
| Trois minutes par jour | 4 | 364 | 3,0 |
| Dix minutes par jour | 8 | 368 | 3,1 |
| Trente minutes par jour | 22 | 382 | 3,2 |
| Deux heures par jour | 110 | 470 | 3,9 |

Dix minutes de jeu quotidien rapportaient huit pièces d'or sur trois cent
soixante-huit. La mine n'était pas un complément, c'était du bruit.

**Pourquoi.** Le cours kobold est divisé par `e` tous les trente-deux PO versés
(`FATIGUE_PO`). Une session de vente est donc bornée à quelques dizaines de PO
avant que le cours ne soit mort, et il ne se reconstitue qu'avec le temps ou par
un effondrement — lequel creuse en échange une dette permanente. Le total qu'une
mine peut verser sur sa vie entière est de l'ordre de `FATIGUE_PO` multiplié par
le nombre d'effondrements. Cette économie a été calibrée pour elle-même, pas
contre un revenu de 360 PO par jour.

---

## 3. Ce qui a été écarté : toucher au levier interne

Le seul levier interne est `FATIGUE_PO`. Balayage sur les mêmes profils, en
boosters par jour :

| `FATIGUE_PO` | 0 min | 3 min | 10 min | 30 min | 2 h |
|-------------:|------:|------:|-------:|-------:|-----:|
| 32 (livré) | 3,0 | 3,0 | 3,1 | 3,2 | 3,9 |
| 90 | 3,0 | 3,0 | 3,1 | 3,6 | 3,7 |
| 150 | 3,0 | 3,0 | 3,3 | 4,0 | 4,4 |
| 220 | 3,0 | 3,1 | 3,2 | 4,3 | **21,3** |
| 320 | 3,0 | 3,1 | **6,8** | 8,8 | 16,4 |
| 450 | 3,0 | 3,1 | 4,7 | 10,5 | 21,0 |
| 650 | 3,0 | 3,2 | **11,7** | 12,9 | **60,4** |

La réponse n'est ni monotone ni continue. Le seuil de fatigue décide du moment
où l'effondrement devient rentable, l'effondrement décide de la profondeur
atteinte, la profondeur décide de l'ancre du cours : trois boucles couplées.
Passer de 220 à 320 fait passer le profil « dix minutes » de 3,2 à 6,8 boosters
par jour, et le profil « deux heures » de 21,3 à 16,4 — dans l'autre sens.

Aucune valeur de ce levier ne produit la courbe voulue. Il a été laissé à 32.

---

## 4. Ce qui a été retenu : une conversion à la frontière

Le module annonce ce que les kobolds ont payé, par `onPO`. L'application décide
ce que cela vaut chez elle. La conversion est donc posée au bord, dans
`src/config/tiers.js` :

```js
export const MINE = {
  multiplicateur: 15, // PO créditées par PO annoncée par les kobolds
  plafondJour: 480,   // quatre boosters de plus par jour, au maximum
};
```

Deux raisons de faire ainsi plutôt que d'entrer dans le module. D'abord la
progression de la mine, le moment où l'on décide de tout effondrer, la sensation
du cours qui s'épuise sont un équilibre cohérent qu'il n'y a aucune raison de
défaire. Ensuite une conversion au bord est linéaire, lisible et se règle au
chiffre près, ce que le levier interne n'est pas.

Le plafond quotidien, lui, borne le seul profil qui échappait à la courbe :
deux heures de frappe rapportaient cinq fois trente minutes, parce que les
frappes se cumulent linéairement là où la production de l'équipe est bornée par
le cours. Il est indexé sur la date locale et remis à zéro à minuit.

---

## 5. Le résultat

| Profil de jeu | PO kobold | × 15 | Créditées | Total/jour | Boosters/jour | × l'app seule |
|---------------|----------:|-----:|----------:|-----------:|--------------:|--------------:|
| Ne joue pas la mine | 0 | 0 | 0 | 360 | 3,0 | × 1,00 |
| Trois minutes par jour | 4 | 56 | 56 | 416 | 3,5 | × 1,16 |
| Dix minutes par jour | 8 | 127 | 127 | 487 | 4,1 | × 1,35 |
| Trente minutes par jour | 22 | 335 | 335 | 695 | 5,8 | × 1,93 |
| Deux heures par jour | 110 | 1 653 | 480 (plafond) | 840 | 7,0 | × 2,33 |

**Ordre de grandeur à retenir : le joueur assidu double son rythme, le joueur
occasionnel gagne un sixième, et le forcené est borné à deux fois et un tiers.**

La montée est lente et en dents de scie, ce qui est le propre du genre : chaque
effondrement remet la production à zéro pour racheter du multiplicateur.

| Profil | Semaines 1 à 12, PO par jour | Fin de course |
|--------|------------------------------|---------------|
| Trois minutes | 2 · 1 · 0 · 0 · 0 · 0 · 9 · 15 · 13 · 2 · 1 · 0 | strate 5, 3 effondrements |
| Dix minutes | 3 · 7 · 7 · 4 · 1 · 9 · 13 · 12 · 3 · 8 · 14 · 11 | strate 5, 9 effondrements |
| Trente minutes | 7 · 7 · 8 · 10 · 13 · 6 · 22 · 20 · 26 · 32 · 31 · 40 | strate 8, 21 effondrements |

Le profil « trois minutes » plafonne : sans présence, la Discipline seule ne
finance pas les compagnons chers. Le profil « trente minutes » continue de
monter au bout de trois mois, mais son plafond quotidien de 480 PO l'attend.

---

## 6. Le Comptoir n'ouvre pas de machine à pièces d'or

Le Comptoir rachète les exemplaires en trop. Le risque, avec un marché, est
qu'un booster liquidé rapporte plus qu'il n'a coûté. Deux garde-fous sont
affichés en permanence dans la Régie de la page.

| Mesure | Valeur | Seuil |
|--------|-------:|------:|
| Booster liquidé au rachat garanti de l'échoppe | 27 % | < 100 % |
| Booster liquidé au meilleur acheteur possible | 58 % | < 100 % |

Le second est le pire cas absolu : le meilleur acheteur du jour, l'affinité
maximale, un marchandage réussi sur chaque carte. Il reste sous les six
dixièmes, et le plafond de paiement de l'échoppe — 1,80 fois l'ancrage d'une
carte — l'empêche de dériver quand les prix montent.

Trois autres freins tiennent l'ensemble :

- **La bourse du Comptoir n'est pas sans fond.** Elle se renfloue chaque nuit des
  boosters ouverts dans la province, et un joueur qui déverse deux cents
  doublons d'un coup l'épuise.
- **Le rayon du jour ne compte que huit pièces.** Sans cette limite, le marché
  complet cassait la collection : une peu commune à vingt-huit PO signifiait
  quatre cartes choisies pour le prix d'un booster, et plus personne n'ouvrait
  de sachet.
- **L'échoppe vend plus cher qu'elle rachète**, d'un facteur 2,60. C'est sa marge
  sur les pièces à l'unité qui garde le booster intéressant.

En sens inverse, le Comptoir paie **environ deux fois** le prix de revente
automatique de l'application. C'est délibéré : sans cet écart, aller au Comptoir
serait une punition, et le module n'aurait aucune raison d'exister.

| Palier | Revente automatique | Rachat de l'échoppe | Meilleur acheteur |
|--------|--------------------:|--------------------:|------------------:|
| Peu commun | 5 PO | ~9 PO | ~18 PO |
| Rare | 15 PO | ~27 PO | ~46 PO |
| Légendaire | 50 PO | ~87 PO | ~124 PO |

---

## 7. Les leviers, et où ils sont

| Ce qu'on veut changer | Où |
|-----------------------|-----|
| Valeur d'un PO de la mine | `MINE.multiplicateur`, `src/config/tiers.js` |
| Plafond quotidien de la mine | `MINE.plafondJour`, même fichier |
| Rythme de base en boosters | `ECONOMIE`, même fichier |
| Prix de revente garantis, qui servent de plancher au marché | `REVENTE`, même fichier |
| Générosité du marché de l'occasion | `CFG.ratio`, `src/comptoir/marche.js` |
| Marge de l'échoppe à la vente | `CFG.margeVente`, même fichier |
| Taille du rayon quotidien | `CFG.rayon`, même fichier |
| Plafond de paiement de l'échoppe | `CFG.plafondRachat`, même fichier |

Après chaque retouche, relancer les scripts :

```bash
node scripts/audit-economie.mjs     # boosters par jour, par profil de jeu
node scripts/audit-marche.mjs       # prix par palier et garde-fous du Comptoir
node scripts/audit-colporteur.mjs   # fréquence et injection du colporteur
```

**Le plafond quotidien de la mine ne s'affiche plus.** Il avait sa jauge et son
compteur en tête de la page des Mines ; ils y mêlaient deux monnaies homonymes
et le gain passif de la boutique à un module de jeu. Le plafond agit toujours,
au même endroit et à la même valeur, mais il ne se signale qu'une fois atteint,
en une phrase. Si l'on retouche `MINE.plafondJour`, c'est donc l'audit qui
répond, plus l'écran.

---

## 8. Le colporteur n'ajoute pas un dixième de booster par jour

Mirko s'arrête au bilan d'une ouverture, rarement, et propose trois affaires
dont une seule peut être prise. Chiffres de `scripts/audit-colporteur.mjs` :

```bash
node scripts/audit-colporteur.mjs
```

### Combien de passages ?

Le tirage est à 8 % par booster, borné à un passage par jour, avec une visite
forcée au dix-huitième booster resté sans rien — sans ce filet, la moitié des
joueurs d'un site de campagne ne le croiseraient jamais.

| Boosters par jour | Passages par an | Un passage tous les |
| --- | --- | --- |
| 1,0 | 38 | 9,5 jours |
| 3,0 | 102 | 3,6 jours |
| 3,6 | 124 | 2,9 jours |
| 7,0 | 209 | 1,7 jours |

Le joueur assidu le voit trois fois plus souvent que l'occasionnel. C'est
voulu : il passe sur la route de qui ouvre des sachets.

### Ce que chaque affaire injecte

| Affaire | PO créées | Pourquoi |
| --- | --- | --- |
| Le lot, doublon vendable au Comptoir | **−4 PO** | il paie ×2,2 la revente, le Comptoir ≈ ×3 |
| Le lot, doublon sans acheteur du jour | +11 PO | l'alternative valait zéro |
| La botte | +50 PO | la remise sur un booster à 70 au lieu de 120 |
| Le pari | +15 PO | 55 PO pour ce que le booster facture 70 |
| Le troc | 0 PO | trois doublons contre une carte manquante |
| L'irisation | **−120 PO** | une dépense pure |

La première ligne est celle qui compte. **Le lot ne remplace jamais le Comptoir
comme source de revenu** : dès qu'une carte trouve un acheteur affine,
la vendre à Mirko fait perdre un quart du prix. Sa valeur n'est pas le tarif,
c'est le volume — vingt doublons partent d'un clic — et l'absence de porte
d'entrée : un commun qu'aucun acheteur du jour ne reconnaît ne se vend nulle
part ailleurs.

### L'effet sur le rythme

En prenant le lot médian observé en session — six doublons, dont la moitié
trouverait preneur au Comptoir — et une affaire acceptée sur deux :

| Boosters par jour | Apport du colporteur | En boosters |
| --- | --- | --- |
| 3,0 | 7,5 PO/jour | **+0,06** |
| 3,6 | 8,7 PO/jour | **+0,07** |
| 7,0 | 15,6 PO/jour | **+0,13** |

Sous le bruit de la variance des boosters. Le plafond théorique — le joueur
prend toujours l'affaire la plus riche *et* son surplus entier est invendable —
monte à +0,5 pour trois boosters par jour et +1,05 pour sept ; mais ce plafond
se mesure contre un joueur qui ne vendrait rien du tout, ce qui n'est pas
l'alternative réelle. Il borne le risque, il ne prédit rien.

### Les leviers

Tout est dans `src/config/colporteur.js` : `VISITE.parBooster` pour la
fréquence, `VISITE.pitie` pour le filet, `TARIFS` pour les trois prix, et
`LOT_RATIO` pour ce qu'il paie un doublon — à garder **sous** le ratio du
Comptoir (`CFG.ratio` dans `src/comptoir/marche.js`, relevé par le
multiplicateur d'acheteur), faute de quoi le Comptoir perdrait sa raison
d'être.

---

## 9. Réserves

Ces chiffres sont un ordre de grandeur, pas une promesse.

- **Le joueur simulé est médiocre.** Il embauche ce qu'il peut, descend dès que
  la strate est nettoyée, vend une fois par jour. Un joueur qui place ses
  talents avec soin et choisit ses moments de vente fera mieux, peut-être de
  moitié. Les chiffres sont un plancher.
- **La récolte est prise en espérance.** Les poches d'étoile pure et les filons
  en éventail multiplient la récolte par douze et par quatre ; le script emploie
  leur moyenne. La variance réelle vécue en jeu est plus forte que ces
  moyennes ne le laissent croire.
- **Le roster de démonstration ne compte que quarante-huit cartes et aucun
  commun.** Les prix du Comptoir mesurés au chapitre 6 valent pour lui. Sur un
  set complet de quatre cents cartes, les rapports entre paliers se conservent
  mais les valeurs absolues bougent : relancer `audit-marche.mjs` avec le vrai
  roster chargé.
- **Rien de tout cela n'est inviolable.** Le porte-monnaie vit dans
  `localStorage` ; quiconque avance l'horloge de sa machine ou édite le stockage
  se donne autant de pièces qu'il veut. Pour un site de campagne entre gens qui
  se connaissent, c'est sans importance.
