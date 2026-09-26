# La Brume de Thalazur

Jeu de cartes à collectionner tiré de la campagne **La Brume de Thalazur** :
on ouvre des boosters, on écoule ses doublons au Comptoir, on creuse les Mines
de Kazim pour financer la suite. En ligne sur [thalazur.io](https://thalazur.io).

La partie est conservée dans le navigateur ; un compte Google **facultatif** la
recopie sur Firebase pour la retrouver d'un appareil à l'autre.

---

## Travailler sur le projet

**Le dépôt Git est la seule source.** Jamais d'archive `.zip` extraite
par-dessus le dossier : c'est ce qui a déjà fait revenir en arrière une
dizaine de fichiers sans que rien ne le signale. Chaque sujet se traite sur
sa propre branche, et `main` ne reçoit que du travail vérifié — c'est `main`
qui est publié.

```powershell
git switch main
git pull                          # partir de la dernière version
git switch -c sujet/mines-talents # une branche par sujet
npm install                       # si package.json a changé
npm run dev                       # site local, rechargé à chaque modification
# … travail …
npm run verifier                  # lint + tests + build : doit passer
git add -A
git commit -m "Mines : …"
git push -u origin sujet/mines-talents
```

Puis sur GitHub : **Pull request** vers `main`. Le workflow relance la
vérification ; une fois fusionnée, la branche part en ligne.

Les règles communes aux conversations Claude sont dans
[`CLAUDE.md`](CLAUDE.md).

### Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Site local sur `http://localhost:5173`, avec la page Réglages MJ |
| `npm run verifier` | Lint, tests, build : ce que le workflow exige avant de publier |
| `npm test` | Tests (Vitest), dossier `tests/` |
| `npm run lint` | ESLint, avec les règles des hooks React |
| `npm run format -- <fichiers>` | Prettier sur les fichiers indiqués |
| `npm run audit` | Audits d'économie, du Comptoir, du colporteur et des succès |
| `npm run roster -- <fichier.xlsx> <id>` | Roster d'une extension, voir [roster et portraits](docs/conception/roster-et-portraits.md) |
| `npm run portraits` | Convertit `../Base Image/<extension>/` en WebP dans `public/portraits/` |
| `npm run portraits:publier` | Idem, puis publie sur le site Firebase des portraits (voir [roster et portraits](docs/conception/roster-et-portraits.md#publier-des-portraits)) |

### Configuration

Firebase (comptes, sauvegardes, mesure d'audience) se configure par les
variables `VITE_FIREBASE_*` : voir `.env.example`. En local, `.env.local`
(de préférence vers un projet Firebase de test) ; en production, les
variables du dépôt GitHub. Sans elles, le site tourne entièrement en local.

Les portraits des cartes ne sont pas dans le dépôt : ils sont publiés à part,
sur `images.thalazur.io` (`VITE_PORTRAITS_BASE`), par `npm run portraits:publier`.

---

## Les pages

| Adresse | Page | Ce qu'on y fait |
|---------|------|-----------------|
| `#/` | Accueil | Écran de présentation de la campagne, et par où entrer |
| `#/boutique` | Boutique | L'étagère des extensions |
| `#/boutique/<id>` | Ouverture | Le sachet se déchire, les cartes montent une par une |
| `#/bibliotheque` | Bibliothèque | Le set entier, obtenu ou non, et les exemplaires en trop |
| `#/comptoir` | Le Comptoir | Marché de l'occasion : vendre ses doublons, acheter au rayon du jour |
| `#/mines` | Les Mines de Kazim | Module idle : frapper le filon, embaucher, vendre l'étoile |
| `#/succes` | Succès | Paliers Global et Collection à réclamer contre des PO et des sachets offerts ; titres |
| `#/succes/classement` | Classement | Progression des joueurs connectés qui ont choisi d'y figurer, générale et par extension |
| `#/profil` | Profil | Connexion Google, pseudo, classement et titre, synchronisation, export et suppression du compte, préférences (animations, doublons, son, cookies) |
| `#/reglages` | Réglages MJ | **Développement seulement** (`npm run dev`) : roster, portraits, taux, mode test. Absente du site publié ; l'ancienne adresse renvoie au profil |
| `#/confidentialite` | Confidentialité | Données, stockages, droits, mentions légales |

---

## Structure

```
src/
  App.jsx              coque : bandeau, navigation, aiguillage, pied de page
  main.jsx             point d'entrée, polices et feuilles de style
  extensions/          une extension par dossier (voir plus bas)
    index.js           catalogue construit à partir des dossiers
  jeu/
    Jeu.jsx            l'état du jeu, partagé par les pages
    reglages.js        préférences du joueur, leviers MJ
    marche.js          ventes, achats et échanges sur la collection
    colporteur.js      passage de Mirko
    mine.js            crédit des PO de la mine
    Compte.jsx         compte Google et synchronisation
  mines/
    donnees.js         strates, compagnons, équipement, talents, lexique
    regles.js          économie de la mine : formules pures, testées
    sauvegarde.js      la partie de mine et sa relecture
    format.js          nombres et durées à la française
    MinesDeKazim.jsx   l'interface
  comptoir/            marché, acheteurs, négoce
  succes/              succès et classement : catalogue, règles pures, ligne publique
  routes/              une page par adresse
  components/          cartes, sachet, ouverture, bibliothèque, bandeau cookies…
  config/              paliers, économie, colporteur, cadre, PJ, mentions légales
  lib/
    sauvegarde/schema.js  format des sauvegardes et migrations
    storage.js         stockage local, export, import
    nuage/             Firebase (chargé à la demande) et fusion entre appareils
    mesure.js          mesure d'audience, après consentement
    …                  routeur, tirage, roster, audio, images
  styles/              jetons, coque, cartes, modules
tests/                 Vitest
scripts/               roster, audits, purge annuelle des comptes
public/                cadre et dos de carte, portraits du Comptoir, vignettes de la mine, 404
                       (portraits/ : portraits des cartes, hors Git, rempli par npm run portraits)
docs/
  conception/          le pourquoi de chaque partie du jeu
  charte-graphique.md  palette, typographie, mouvement — le code fait foi
  audit-*.md           audits d'économie, de sécurité et de structure
```

### Les sauvegardes

Un seul numéro de format, `SCHEMA`, pour l'état du jeu, la mine, le compte et
les fichiers exportés (`src/lib/sauvegarde/schema.js`).

- **Ajouter un champ** : lui donner une valeur par défaut dans `etatVide()`
  (`lib/storage.js`) ou `etatNeuf()` (`mines/sauvegarde.js`). Rien d'autre.
- **Changer le sens d'un champ** : monter `SCHEMA`, écrire la migration dans
  `MIGRATIONS`, ajouter un test dans `tests/sauvegarde.test.js`.

### Les extensions

```
src/extensions/<id>/
  extension.js   titre, statut ("ouvert" | "bientot"), couleurs, résumé, full art
  sachet.webp
  roster.json    seulement pour une extension ouverte
```

Ajouter un dossier suffit : aucune autre ligne de code.

---

## Documentation

- [Conception](docs/conception/) : boutique et tirage, bibliothèque, Comptoir
  et colporteur, Mines, succès et classement, comptes, accessibilité, roster
  et portraits, notes.
- [Charte graphique](docs/charte-graphique.md)
- Audits : [économie](docs/audit-economie.md), [sécurité](docs/audit-securite.md),
  [structure](docs/audit-structure.md)

## Aperçu en ligne avant `main`

La production (thalazur.io) ne se déploie que depuis `main`. Pour voir des
branches en ligne avant de les y fusionner :

1. Réunir les branches sur `recette` (`git switch -c recette …`, puis `git merge`).
2. Avoir un `.env.local` rempli (voir `.env.example`), **sans**
   `VITE_FIREBASE_MEASUREMENT_ID` pour ne pas mêler l'aperçu aux statistiques.
3. `npm run apercu` : vérifie, construit, et publie sur un canal d'aperçu
   Firebase Hosting, à une adresse `…--recette-….web.app` valable 7 jours.

Première fois seulement : `npx firebase-tools login` (le projet `thalazur-tcg`
est déjà désigné par `.firebaserc`), puis ajouter l'adresse de l'aperçu dans Firebase →
Authentication → Paramètres → Domaines autorisés, sinon la connexion Google
est refusée.

L'aperçu parle à la **même base Firestore** que la production : on y joue avec
son vrai compte. Une branche qui monte `SCHEMA` ne se teste donc pas ainsi
sans précaution.
