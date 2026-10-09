# La Brume de Thalazur

> Jeu de cartes à collectionner tiré de la campagne D&D *La Brume de Thalazur*.
> En ligne sur **[thalazur.io](https://thalazur.io)**.

On ouvre des boosters, on complète sa collection, et on la fait travailler :
au Donjon, dans les Mines de Kazim, sur les routes des Expéditions. La partie
vit dans le navigateur ; un compte Google **facultatif** la synchronise entre
appareils.

**Vite · React 18 · Firebase (Auth, Firestore, Hosting) · Vitest · GitHub Pages**

---

## Démarrer

```powershell
npm install
npm run dev        # http://localhost:5173, avec la page Réglages MJ
```

Sans configuration Firebase, le site tourne entièrement en local, sans bouton
de connexion. Pour le compte et la synchro : copier `.env.example` en
`.env.local` et le remplir (de préférence avec un projet Firebase de test).

## Travailler sur le projet

Le dépôt Git est la seule source : **une branche par sujet**, jamais d'archive
`.zip` extraite par-dessus le dossier. `main` ne reçoit que du travail vérifié,
et c'est `main` qui est publié.

```powershell
git switch main; git pull
git switch -c sujet/mon-sujet
# … travail …
npm run verifier                   # lint + tests + build : doit passer
git add -A; git commit -m "Module : …"
git push -u origin sujet/mon-sujet # puis pull request vers main sur GitHub
```

Une fois la pull request fusionnée, le workflow GitHub publie le site. Les
règles des conversations Claude sont dans [`CLAUDE.md`](CLAUDE.md).

| Commande | Effet |
|---|---|
| `npm run dev` | Site local, rechargé à chaque modification |
| `npm run verifier` | Lint, tests et build — exigé avant toute fusion |
| `npm test` | Tests Vitest (`tests/`) |
| `npm run audit` | Simulations d'économie : Mines, Comptoir, colporteur, succès, missions, Donjon, Reliquaire |
| `npm run apercu` | Aperçu en ligne d'une branche (voir plus bas) |
| `npm run roster -- <fichier.xlsx> <id>` | Roster d'une extension depuis Excel |
| `npm run portraits` / `portraits:publier` | Portraits en WebP, puis publication sur `images.thalazur.io` |

---

## Le jeu

| Page | Adresse | En une ligne |
|---|---|---|
| Boutique | `#/boutique` | L'étagère des extensions ; le sachet se déchire, les cartes montent une à une |
| Bibliothèque | `#/bibliotheque` | Le set entier, obtenu ou non, et les doublons |
| Comptoir | `#/comptoir` | Vendre ses doublons aux acheteurs du jour, acheter au rayon |
| Mines de Kazim | `#/mines` | Idle : filons, compagnons, commandes de Tafix, Faveur du Fossoyeur |
| Donjon | `#/donjon` | Mode principal : carte de passages, combats à l'initiative avec ses cartes |
| Expéditions | `#/expeditions` | Envoyer le banc sur les routes de ses Lieux, en temps réel |
| Reliquaire | `#/reliquaire` | Dissoudre ses doublons en vestiges, forger les cartes qui manquent |
| Missions | `#/missions` | Trois missions par jour et une par semaine, confiées par Bodégué |
| Succès | `#/succes` | Paliers à réclamer, titres, classement des joueurs connectés |
| Profil | `#/profil` | Compte, pseudo, synchro, export, préférences |

`#/reglages` (outils MJ) n'existe qu'en développement. Le raisonnement de
chaque module est dans [`docs/conception/`](docs/conception/).

---

## Architecture

```
src/
  jeu/          l'état du jeu partagé par les pages (Jeu.jsx) et le compte (Compte.jsx)
  <module>/     donjon, mines, comptoir, expeditions, reliquaire, missions, succes
                — chacun avec ses règles pures (regles.js), testées à nu
  extensions/   une extension par dossier
  lib/          stockage et migrations, synchro (nuage/), tirage, routeur, audio
  routes/       une page par adresse
  components/   cartes, ouverture, bibliothèque, fenêtres partagées
  config/       paliers, économie, mentions légales
tests/          Vitest
scripts/        roster, portraits, audits d'économie, purge des comptes
docs/           conception, charte graphique, audits
```

**Règles pures d'abord.** Tout ce qui calcule (tirage, combats, prix, gains)
vit dans des fonctions sans React ni navigateur, couvertes par `tests/`.
Les composants ne font que les brancher.

**Local d'abord.** La partie est dans le `localStorage` ; le compte en reçoit
une copie. Deux appareils, ou deux onglets, se réconcilient par une fusion à
trois voies (`src/lib/nuage/fusion.js`) : les compteurs s'additionnent, rien
n'est payé deux fois. Détails dans
[comptes et confidentialité](docs/conception/comptes-et-confidentialite.md).

### Sauvegardes

Des joueurs ont une partie sur leur compte : **ne jamais la casser**. Un seul
numéro de format, `SCHEMA` (`src/lib/sauvegarde/schema.js`).

- **Ajouter un champ** : une valeur par défaut dans `etatVide()`
  (`lib/storage.js`) ou `etatNeuf()` (`mines/sauvegarde.js`). Rien d'autre.
- **Changer le sens d'un champ** : monter `SCHEMA`, écrire la migration,
  ajouter un test dans `tests/sauvegarde.test.js`. Un onglet resté sur
  l'ancienne version se fige alors de lui-même et demande de recharger.

### Extensions

```
src/extensions/<id>/
  extension.js   titre, statut ("ouvert" | "bientot"), couleurs, résumé, full art
  sachet.webp
  roster.json    seulement pour une extension ouverte
```

Ajouter le dossier suffit.

---

## Publier

| Quoi | Comment |
|---|---|
| Le site | Automatique à chaque fusion dans `main` (GitHub Actions → GitHub Pages) |
| Un aperçu de branche | `npm run apercu` : canal Firebase Hosting `recette`, valable 7 jours |
| Les portraits | `npm run portraits:publier` (Firebase Hosting, cible `portraits`) |
| Les règles Firestore | À la main, voir ci-dessous |

**Aperçu.** Réunir les branches sur `recette`, avoir un `.env.local` rempli
**sans** `VITE_FIREBASE_MEASUREMENT_ID`, puis `npm run apercu`. La première
fois, ajouter l'adresse de l'aperçu dans Firebase → Authentication →
Domaines autorisés. L'aperçu parle à la **même base** que la production : une
branche qui monte `SCHEMA` ne s'y teste pas sans précaution.

**Règles Firestore** (`firestore.rules`, projet `thalazur-tcg` déjà désigné
par `.firebaserc`) :

```powershell
npx firebase-tools login                                  # première fois seulement
npx firebase-tools deploy --only firestore:rules --dry-run # compile sans publier
npx firebase-tools deploy --only firestore:rules          # publie
```

À publier **après** la mise en ligne du code qui en dépend, et jamais depuis
une branche non fusionnée.

---

## Documentation

- [Conception](docs/conception/) — le pourquoi de chaque module
- [Charte graphique](docs/charte-graphique.md) — palette, typographie, mouvement ; le code fait foi
- Audits : [économie](docs/audit-economie.md) · [Comptoir](docs/audit-comptoir.md) · [Expéditions et Reliquaire](docs/audit-expeditions-reliquaire.md) · [sécurité](docs/audit-securite.md) · [structure](docs/audit-structure.md)
- [Confidentialité](https://thalazur.io/#/confidentialite) — données, stockages, mentions légales
