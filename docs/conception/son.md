# Le son du Donjon

Bruitages, nappes et musique du Donjon (06/10/2026). Conçus par Claude Design
(table d'écoute, archive `Donjon_de_Thalazur__audio.zip`), intégrés sans
retoucher les valeurs validées à l'oreille.

## Architecture (`src/son/`)

| Fichier | Rôle |
|---|---|
| `banque.js` | Les recettes des bruitages, des données : `BANQUE` (un identifiant `donjon.…` par évènement, sa priorité, sa réverbération, ses couches), `RARETE` (couche ajoutée à l'éveil des artéfacts et à la pose des lieux), `FORCES` (frappe légère, moyenne, lourde), `NAPPES` (ambiances de lieu). Reprises du prototype `son-ecoute.js` **sans aucune valeur modifiée**. |
| `moteur.js` | `creerMoteur` : le contexte Web Audio, le maître (compresseur, coupe des aigus), les bus musique et effets, la réverbération de caverne, la lecture des recettes (polyphonie bornée, priorités, frappes rapprochées fusionnées, durées raccourcies en ×2 et ×4), la brume, les nappes. La musique synthétisée du prototype n'y est plus : la musique vient de `musique.js`, branchée sur le bus musique. |
| `musique.js` | Le thème orchestral, trois arrangements synchronisés (carte, combat, gardien), joué note à note avec les échantillons (`SOURCE_MUSIQUE = 'echantillons'`). Fichier livré **tel quel**, à une retouche près (voir plus bas). |
| `index.js` | L'API pour le reste du site, une seule instance du moteur : `jouer(identifiant, options)`, `musique('carte' \| 'combat' \| 'gardien' \| null)`, `vitesse`, `etage`, `brume`, `nappe`, `regler`, `arreterTout`, plus `activer` (premier geste) et les témoins du profil. Quelques traducteurs du jeu vers la banque : `forceDe(dégâts)`, `rareteDe(palier)`, `familleArtefact(effets)`, `milieuDe(lieu)`. |

Le contexte audio ne naît qu'au **premier geste dans le Donjon** (clic ou
touche, `activer`) : avant, `jouer` et `musique` ne font rien, et la musique
demandée attend ce geste. Toute erreur audio est rattrapée : si le son ne
démarre pas, le jeu continue, muet.

Les échantillons sont chargés depuis `import.meta.env.BASE_URL + son/orchestre/`,
sur la même origine que le site (`connect-src 'self'` de la CSP suffit : elle
n'a pas été touchée). `musique.js` refuse de lui-même toute URL d'une autre
origine.

**Retouche à `musique.js`** : une note tenue programmait son `stop()` avant
son `start()`, ce que Chrome refuse (InvalidStateError) ; le séquenceur
s'arrêtait à la première note de cordes. L'ordre est inversé, rien d'autre.

## Volumes

Le réglage vit dans `etat.reglages.son` (schéma 9, `src/config/son.js`) :

```js
son: { coupe: false, musique: 20, effets: 50 }
```

- **musique 20 %, effets 50 %** par défaut ; gain du bus = pourcentage / 100 ;
- la réverbération des effets suit le bus effets ;
- `coupe` ferme le maître (et coupe aussi les sons de l'ouverture des boosters,
  `lib/audio.js`) ;
- le réglage s'applique tout de suite s'il y a un contexte, sinon à sa création.

Migration (schéma 8 → 9) : l'ancien booléen `reglages.son` devient l'objet ;
un ancien « son coupé » reste coupé, les volumes prennent leurs défauts.

Dans le profil, section **Son** : la bascule « Couper le son », puis deux
curseurs **Musique** et **Effets** (0 à 100 %, pas de 5, valeur affichée), chacun
avec **Écouter** (témoin de la musique ; `donjon.capacite.soigneur` pour les
effets). Le curseur (`components/Curseur.jsx`) est un `role="slider"` complet :
flèches, Pg préc./suiv., Début, Fin ; cible de 44 px au doigt.

## Branchement dans le Donjon

| Où | Sons |
|---|---|
| Carte | `carte.survol` (survol d'une salle), `carte.choisir`, `carte.reveler` (salle sans combat), `carte.combat` / `carte.gardien`, `carte.etage` (descendre, plus grave d'étage en étage, plafonné au troisième), `carte.confirmer` (premier appui sur Remonter), `carte.remonter` |
| Salles | `rencontre.repos` (repos), `rencontre.autel` (autel), `rencontre.recrue` (voyageur blessé), `rencontre.autre` (les autres), `rencontre.rival` (un PNJ rival parmi les adversaires) |
| Combat | `combat.debut`, `combat.tour` (la main passe), `combat.cibler`, `combat.frappe` (force selon les dégâts : ≤ 2 légère, ≤ 4 moyenne, au-delà lourde), `combat.encaisser` (un allié touché), `combat.armure` (l'armure a arrêté des dégâts), `combat.chute.adverse` / `.allie`, `combat.fuite`, brume (au-delà du tour de brume, un demi-ton par tour), `combat.victoire`, `combat.gardien.vaincu`, `combat.defaite` |
| Capacités | `capacite.<rôle>` à la technique de chaque rôle (plus grave et filtrée pour un rival), `capacite.prete` quand une recharge revient à zéro |
| Artéfacts | `artefact.eveil` (rareté du palier) puis sa famille (`offensif`, `protecteur`, `soin`, `utilitaire`, d'après sa première mécanique) quand une relique est gagnée ; l'éveil, filtré, quand des adversaires en portent une |
| Lieux | `lieu.pose` à l'annonce de la source (rareté, étoile = rainbow) ; nappe du lieu de la salle courante, d'après son type et son nom (désert, côte, forêt, souterrain, cité ; sinon neutre) |
| Butin et progression | `butin.pieces` (plus dense à partir de 20 pièces), `butin.po` au bilan, `xp.compteur`, `xp.niveau`, `xp.rainbow` |
| Interface | `ui.pilote` (Auto, plus grave en coupant), `ui.vitesse` (un cran par vitesse), `ui.dialogue` (lexique, feuille d'équipe) |
| Musique | carte sur la carte (rencontres et résultats compris), combat en combat, gardien chez le gardien, rien à la préparation ni au bilan, arrêt en quittant la page |

`tests/son.test.js` vérifie que chaque identifiant appelé dans `src/donjon/`
existe dans la banque, de même que les identifiants composés (rôles, familles,
milieux).

## Échantillons

`public/son/orchestre/` : 53 fichiers WAV (mono, 22 050 Hz, 16 bits, 4,2 Mo)
et `LICENCE.txt`. Source : **VSCO 2 Community Edition** (Versilian Studios
Chamber Orchestra 2, Sam Gossner, Simon Dalzell, Elan Hickler),
<https://github.com/sgossner/VSCO-2-CE>, licence **CC0 1.0 Universal**
(domaine public), vérifiée le 06/10/2026. La conversion (outil de
l'environnement de Claude Design, non versionné) est décrite dans
`LICENCE.txt`. Les bruitages, eux, n'utilisent aucun fichier : ils sont
synthétisés.
