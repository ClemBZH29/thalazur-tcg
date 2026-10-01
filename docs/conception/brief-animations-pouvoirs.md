# Brief — Animations des pouvoirs (sources et reliques) du Donjon

**Projet** : La Brume de Thalazur, module Donjon.
**Demandé par** : Clément, 01/10/2026.
**Pour** : Claude Design.
**Suite de** : [brief-animations-donjon.md](brief-animations-donjon.md). Ce brief
complète le module que tu as livré, `src/donjon/animations.js` : mêmes
briques, mêmes règles, même façon de livrer.

---

## 1. Le besoin

Le Donjon a reçu deux nouveautés, qui n'ont **aucune animation** :

1. **La source de pouvoir.** Avant de descendre, le joueur choisit un de ses
   **Lieux**. Ce lieu donne à toute l'équipe un pouvoir passif, unique à ce
   lieu : coups critiques, vol de vie, épines, première salve, relève…
2. **Les reliques.** Chaque artéfact a maintenant un pouvoir. Une élite ou un
   gardien **porte** une relique et s'en sert contre l'équipe ; la victoire
   la fait changer de camp.

Les pouvoirs jouent sans qu'on les voie. Un critique, une esquive, un vol de
vie se lisent seulement au journal. Il faut que le joueur **voie son lieu
travailler**, et qu'il sente la relique que l'ennemi tourne contre lui.

Il faut :

- **une animation par mécanique** (§ 4), courte, déclenchée à l'instant où le
  pouvoir joue ;
- **deux familles visuelles selon l'origine** : `source` (le lieu de
  l'équipe) et `relique` (un artéfact, de l'équipe ou de l'adversaire) ;
- **l'annonce de la source** au début de chaque combat ;
- **la relique portée** par les adversaires (une aura sur eux tant qu'ils la
  portent) et **sa prise** à la victoire (elle passe à l'équipe).

---

## 2. Le contrat (déjà branché, il ne manque que tes fonctions)

Le jeu appelle déjà trois fonctions de ton module **si elles existent**.
Absentes, rien ne se passe. Ajoute-les à l'objet que rend
`creerAnimationsDonjon` :

```js
animerPouvoir(ev, { unite })   // un pouvoir vient de jouer
animerSource(source, C)        // début de combat : la source s'annonce
animerRelique(relique, o)      // relique portée (début de combat) ou prise (victoire)
```

**`ev`, un événement de pouvoir** :

```js
{
  mec: "crit",            // la mécanique (§ 4)
  camp: "a",              // "a" l'équipe, "e" l'adversaire
  origine: "source",      // "source" (le lieu de l'équipe) ou "relique"
  uid: 12,                // l'unité qui porte le pouvoir (celle qui frappe, qui esquive, qui se soigne…)
  cible: 31,              // facultatif : l'autre unité concernée
  valeur: 4,              // facultatif : PV rendus, dégâts renvoyés…
  cibles: [31, 32, 33],   // première salve seulement : toutes les cibles
}
```

`unite(uid)` rend l'unité (`{ uid, camp, ko, pv, pvMax, c: { nom, tier, … } }`).
`el(uid)`, que tu as déjà, rend son élément `.dj-u`.

**`source`**, figée pour toute la descente :
`{ c: { nom, tier, rep1, rep3 }, niveau, etoile, effets: [{ mec, val, texte }] }`.
Elle vaut `null` si l'équipe descend sans source. `C` est le combat :
`C.ennemis`, `C.relique`.

**`animerRelique(relique, o)`**, avec `relique = { nom, tier }` :

- `o.moment = "porte"` au début du combat, et `o.porteurs` = les adversaires vivants ;
- `o.moment = "prise"` à la victoire, et `o.equipe` = les compagnons debout ;
- `o.moment = "vendue"` à la victoire, quand l'équipe a déjà huit reliques :
  la relique part au sac, en pièces.

**Quand c'est appelé** :

- `animerPouvoir` est appelé sans `await` : il ne retarde jamais le combat
  et peut se superposer à une animation de geste ;
- les événements d'un geste arrivent juste après que les règles l'ont
  résolu, avant les chiffres flottants ;
- ceux d'un début de tour (régénération, recharge) arrivent entre deux
  mains.

Les chiffres (dégâts, soins) sont déjà affichés par le jeu : **ne les
redessine pas**.

---

## 3. Contraintes (les mêmes, et quelques-unes de plus)

1. **Vitesse ×1, ×2, ×4** : les durées sont divisées par `vitesse()`.
2. **Mouvement réduit** (`reduit()`) : un fondu au plus, ou rien.
3. **Rien de tiers, pas de bibliothèque.** Web Animations API, CSS, SVG en ligne.
4. **Aucune carte ne garde de `transform`** : passe par des calques dans
   l'arène (`poser`, `jouer`), comme dans ta première livraison.
5. **Fréquence.** Certains pouvoirs jouent à presque chaque coup : `crit`,
   `drain`, `saignement`, `rempartDebut`, `soin`. Pour eux : **250 ms au
   plus**, discret, jamais de secousse d'arène. Les rares (`ouverture`,
   `releve`, `vengeance`, `execution`, la source, la relique prise) peuvent
   aller jusqu'à 700 ms.
6. **Non bloquant** : plusieurs pouvoirs peuvent arriver dans le même
   geste. Respecte le plafond de 30 particules (`MAX_PARTICULES`).
7. **Deux sens.** Un adversaire qui porte une relique déclenche les mêmes
   événements (`camp: "e"`, `origine: "relique"`), du haut vers le bas.

---

## 4. Les mécaniques

| `mec` | Nom | Effet (exemple) |
|---|---|---|
| `atq` | Force | +1 ATQ |
| `pv` | Endurance | +2 PV max |
| `ini` | Vivacité | +1 INI |
| `armure` | Cuirasse | armure +1 |
| `crit` | Coup critique | 10 % de coups critiques (dégâts ×2) |
| `soin` | Bénédiction | soins +25 % |
| `drain` | Soif de sang | rend 6 % des dégâts infligés en PV |
| `epines` | Épines | renvoie 30 % des dégâts reçus |
| `execution` | Coup de grâce | +100 % de dégâts sur une cible sous 35 % de PV |
| `chasseur` | Chasse au gros | +25 % de dégâts sur les élites et les gardiens |
| `regen` | Régénération | rend 2 % des PV max à chaque tour |
| `finCombat` | Bivouac | rend 5 % des PV max après chaque victoire |
| `releve` | Relève | après une victoire, les tombés se relèvent à 7 % de leurs PV |
| `butin` | Contrebande | butin +10 % |
| `xp` | Apprentissage | expérience +15 % |
| `ouverture` | Première salve | en début de combat, 2 dégâts à chaque adversaire |
| `rempartDebut` | Retranchement | armure +1 au premier tour de chaque combat |
| `brume` | Brume familière | la brume se referme 3 tours plus tard |
| `saignement` | Lames ébréchées | 20 % de chances de faire saigner (2 tours) |
| `esquive` | Mirage | 8 % de chances d'esquiver un coup |
| `recharge` | Second souffle | les recharges baissent 50 % plus vite |
| `marque` | Repérage | le premier coup de chaque combat marque sa cible (+60 % de dégâts, 2 tours) |
| `vengeance` | Vengeance | +1 ATQ aux autres chaque fois qu'un des leurs tombe |
| `dernierRempart` | Dernier carré | le dernier debout frappe +120 % plus fort |
| `tempo` | Charge | +25 % de dégâts au premier tour de chaque combat |
| `fortune` | Bonne fortune | +10 % de chances de trouver une relique |
| `soinRepos` | Bonne table | les repos soignent +40 % |
| `gardien` | Défi | −20 % de dégâts reçus des gardiens |
| `resistance` | Endurci | −5 % de dégâts reçus |

Quand chacune joue (`ev.uid` est toujours le porteur du pouvoir) :

| `mec` | Moment | `uid` → `cible` | Direction souhaitée |
|---|---|---|---|
| `crit` | un coup double ses dégâts | frappeur → cible | éclat bref, étincelle à l'impact |
| `esquive` | un coup est évité | esquiveur → attaquant | mirage : la carte se dédouble un instant |
| `drain` | une part des dégâts revient en PV | frappeur → cible | filet de la cible vers le frappeur (fin, pas celui de Lame vampire) |
| `epines` | des dégâts sont renvoyés | frappé → attaquant | ronces ou pointes qui jaillissent vers l'attaquant |
| `saignement` | le coup fait saigner | frappeur → cible | trait rouge, gouttes (l'état « saigne » existe déjà) |
| `marque` | le premier coup du combat marque | frappeur → cible | le sigle de chasse que tu as fait pour Marque du chasseur, plus petit |
| `tempo` | bonus au premier tour | frappeur → cible | élan : traînée de vitesse |
| `chasseur` | bonus contre élite ou gardien | frappeur → gardien/élite | cor de chasse, éclat doré |
| `execution` | bonus sous 35 % de PV | frappeur → cible | couperet plus fin que celui d'Exécution |
| `dernierRempart` | le dernier debout frappe plus fort | frappeur → cible | flamme autour du dernier |
| `gardien` | dégâts du gardien réduits | frappé → gardien | bouclier qui encaisse |
| `rempartDebut` | armure au premier tour | frappé | éclat métallique sur la carte |
| `vengeance` | un allié tombe, les autres +ATQ | chaque vengeur → le tombé | braise rouge qui monte sur les vengeurs |
| `soin` | un soin est renforcé | soigneur → soigné | lueur supplémentaire sur le soin |
| `regen` | début de tour : PV rendus | l'unité | respiration verte, discrète |
| `recharge` | début de tour : une recharge tombe | l'unité | rouage ou sablier qui saute |
| `ouverture` | début de combat : dégâts à chaque adversaire | camp → `cibles` | salve : une volée qui frappe tout un rang |
| `releve` | après la victoire : un tombé se relève | l'unité | colonne de lumière (l'événement `releve` existe ; adapte-le) |
| `finCombat` | après la victoire : PV rendus | l'unité | feu de camp, lueur chaude |

Les mécaniques `butin`, `xp`, `fortune`, `soinRepos`, `brume`, `ini`, `atq`,
`pv` et `armure` (sauf au premier tour) n'ont pas d'instant. Elles se voient
dans `animerSource` (§ 5), qui les annonce toutes.

---

## 5. Les deux familles visuelles

**`origine: "source"`, le lieu de l'équipe.** Le pouvoir vient d'un endroit
de Thalazur. Je propose une teinte et un motif par **type de lieu** (`rep3`
de la carte), pour que deux lieux à la même mécanique ne se ressemblent pas
tout à fait. Par exemple :

- Taverne : ambre, mousse ;
- Militaire, Camp Cotier : acier, étendard ;
- Biome : feuillage, eau ou sable selon le lieu ;
- Temple : or pâle, rayons ;
- Coutume : fumée colorée ;
- Clan : sang, peinture de guerre ;
- Ruines, Capitale : pierre, lumière dorée ;
- Dis (Palais de Dispater) : braise infernale.

C'est une proposition : à toi de trouver mieux. La teinte se lit dans
`source.c.rep3`. Un lieu étoilé (`source.etoile`) ajoute l'irisation des
étoiles.

**`origine: "relique"`, un artéfact.** Métal, or, éclat de joyau, quel que
soit l'artéfact. Chez l'adversaire (`camp: "e"`), la même relique dans une
teinte plus sombre, menaçante.

**`animerSource(source, C)`** : au premier tour de chaque combat, le nom du
pouvoir apparaît brièvement au-dessus du rang de l'équipe, dans la teinte du
lieu, avec un souffle qui traverse le rang. 600 ms au plus. Le joueur doit
reconnaître son lieu. Si `source` vaut `null`, rien.

**`animerRelique`** :

- `porte` : une aura sombre sur les porteurs, puis un calque d'état
  persistant tant qu'ils sont debout. Propose une classe, par exemple
  `.dj-rang.porte-relique` ; je la poserai ;
- `prise` : la relique quitte le rang adverse et vole vers l'équipe ;
- `vendue` : elle file vers le sac (la pastille « Sac » de l'en-tête,
  `.dj-entete .pastille.or`).

---

## 6. Les 37 sources de pouvoir

| Lieu | Rareté | Type (rep3) | Pouvoir | Mécaniques |
|---|---|---|---|---|
| Le squale gris | commune | Tarverne | Cale de contrebande | `butin` |
| Tente militaire | commune | Camp Cotier | Retranchement | `rempartDebut` |
| Restaurant militaire | commune | Camp Cotier | Gamelle chaude | `finCombat` |
| Yourte de la steppe | commune | Village | Hospitalité des steppes | `soinRepos` |
| Camp de mercenaires | commune | Village | Lames à louer | `atq` |
| Forêt rongée | commune | Rencontre | Épines rongées | `saignement` |
| Port du nord | commune | Militaire | Vent du large | `ini` |
| Ruelle Sombre | commune | Rencontre | Coup dans le dos | `crit` |
| Chez Trabin | commune | Taverne | Tournée de Brazuk | `pv` |
| Poste de garde du désert | commune | Militaire | Boucliers du poste | `armure` |
| Collines des géants | commune | Biome | Chasse aux géants | `chasseur` |
| Plage de l'arrivée | commune | Biome | Rescapés | `releve` |
| Mines d'Azar | commune | Biome | Filon de reliques | `fortune` |
| Arène de Riddobo | commune | Coutume | Clameur de l'arène | `tempo` |
| Fumerie de Kramach | commune | Coutume | Volutes apaisantes | `regen` |
| Désert des cauchemars | commune | Biome | Cauchemars | `ouverture` |
| Poste frontière du col | commune | Village | Vétérans du col | `resistance` |
| Lac Süurin | commune | Biome | Eaux du Süurin | `soin` |
| Salle de jeux Kobold | commune | Coutume | Coups de dés | `xp` |
| Observatoire Sud | peu commune | Militaire | Lunettes de l'observatoire | `marque` |
| Bastion de l'Ordre | peu commune | Palais | Discipline de Vorsak | `gardien` |
| Triple-Socle | peu commune | Rencontre | Trois appuis | `recharge` |
| Grand Marais | peu commune | Biome | Enfants du marais | `brume` |
| Forêt de Nakova | peu commune | Biome | La forêt est la forêt | `esquive` |
| Site en construction | peu commune | Temple | Fondations | `dernierRempart` |
| Cabinet du Dr Deutenik | peu commune | Service | Transfusion | `drain` |
| Azar | peu commune | Clan | Sang d'Azar | `vengeance` |
| Olionde | peu commune | Clan | Ronces d'Olionde | `epines` |
| Tente du Haut Commandement | peu commune | Camp Cotier | Ordre d'achever | `execution` |
| Prison Secrète | rare | Camp Cotier | Interrogatoire | `saignement`, `execution` |
| Soldestin | rare | Biome | Soleil de Soldestin | `regen`, `soin` |
| Éklénor | rare | Capitale | Garde d'Éklénor | `atq`, `ini` |
| Grandes Ruines Centrales | rare | Ruines | Mémoire des ruines | `fortune`, `xp` |
| Temple de la Paix | rare | Temple | Paix du temple | `finCombat`, `releve` |
| Valkarth | rare | Capitale | Remparts de Valkarth | `armure`, `epines` |
| Temple Panthéonique | légendaire | Temple | Tous les cultes | `soin`, `resistance`, `releve` |
| Palais de Dispater | légendaire | Dis | Faveur de Dispater | `crit`, `drain`, `ouverture` |

## 7. Les 18 artéfacts

| Artéfact | Rareté | Mécaniques |
|---|---|---|
| Sacoche de bille | commune | `butin` |
| Poignée de Skarn | commune | `crit` |
| Brazûk ai Kazûk | commune | `regen` |
| Pochon de Kramach | commune | `esquive` |
| Tian | commune | `resistance` |
| Rune Goliath | commune | `armure` |
| Écaille de Ver Pourpre | commune | `epines` |
| Sceau de Valéran | peu commune | `ini` |
| Carte de Thalazur | peu commune | `fortune` |
| Coutille de géant du feu | peu commune | `ouverture` |
| Médaille de dompteur d'auroch | peu commune | `chasseur` |
| Relique des profondeurs | peu commune | `drain` |
| Marque de Vorsak | peu commune | `marque` |
| Laelsíleth | rare | `execution` |
| Tête Mécanique | rare | `rempartDebut` |
| Vif Écaille | rare | `tempo` |
| Duo de larme | légendaire | `soin`, `releve` |
| Hakaihane | légendaire | `saignement`, `crit` |

---

## 8. Ce qu'on attend de toi

1. **La mise à jour de `animations.js`**, dans le même style que ta première
   livraison : `animerPouvoir`, `animerSource`, `animerRelique`, et les
   briques nouvelles qu'il faut. Garde le même nommage en français et le
   même découpage.
2. **Le CSS** des nouveaux calques, à ajouter à `donjon-animations.css`.
3. **Le prototype HTML**, repris de la première fois, avec :
   - un bouton par mécanique ;
   - des bascules **origine** (source / relique), **camp** (équipe /
     adversaire), **type de lieu** (les `rep3` du § 5) et **étoile** ;
   - un bouton « début de combat » (source et relique portée), « victoire,
     relique prise » et « victoire, relique vendue » ;
   - un bouton **rafale**, qui envoie cinq pouvoirs dans le même geste, pour
     vérifier qu'ils ne se marchent pas dessus ;
   - les bascules vitesse, mouvement réduit et téléphone.
4. **Le tableau récapitulatif** : mécanique, durée à ×1, ce qui reste en
   mouvement réduit.

## 9. Critères d'acceptation

- [ ] Chaque mécanique du § 4 est reconnaissable sans lire le journal.
- [ ] Les pouvoirs fréquents durent 250 ms au plus et ne secouent pas l'arène.
- [ ] Une rafale de cinq pouvoirs reste lisible et sous 30 particules.
- [ ] Un pouvoir de source et un pouvoir de relique se distinguent d'un coup d'œil.
- [ ] Deux lieux de types différents, à la même mécanique, ne sont pas identiques.
- [ ] Aucune carte ne garde de `transform` ; tous les calques sont retirés.
- [ ] ×2, ×4, mouvement réduit et 70 px de large tenus.
- [ ] Aucune ressource tierce, aucune bibliothèque.
