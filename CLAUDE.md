# Règles de travail — conversations Claude

Ce projet est travaillé dans plusieurs conversations, une par sujet (Mines,
Comptoir, images, comptes…). Elles partagent un seul dépôt : ces règles
évitent qu'une conversation écrase le travail d'une autre.

## Le dépôt est la seule source

- Travailler **directement dans le dossier `C:\Dev\TCG\Base App TCG`**, connecté
  à la conversation. S'il ne l'est pas, demander à Clément de le connecter —
  ne pas travailler sur une copie.
- **Jamais d'archive `.zip`** : ni en livrer une, ni en extraire une par-dessus
  le dossier. Le livrable est un commit sur une branche.
- Ne jamais repartir d'un fichier fourni plus tôt dans la conversation ou
  d'une ancienne archive : relire le fichier dans le dépôt, il a pu changer
  depuis dans une autre conversation.

## Déroulé d'un sujet

1. `git status` : le dossier doit être propre. S'il y a des modifications non
   commitées qui ne viennent pas de cette conversation, **s'arrêter et
   demander** — c'est probablement le travail d'une autre conversation.
2. `git switch main && git pull`, puis `git switch -c sujet/<nom-court>`.
3. Lire `README.md`, puis la page de `docs/conception/` du sujet.
4. Travailler, en petits commits sur la branche.
5. `npm run verifier` (lint, tests, build) doit passer.
6. `git push -u origin sujet/<nom-court>`, puis dire à Clément d'ouvrir la
   pull request. **Ne jamais pousser sur `main`, ni forcer un push.**

Si la branche d'une autre conversation est en cours sur les mêmes fichiers,
le signaler avant de commencer.

## Git depuis Cowork

Git doit pouvoir effacer son fichier de verrou (`.git/index.lock`). Dans
Cowork, cela demande l'autorisation de suppression sur le dossier : la
demander une fois en début de sujet. Refusée, donner à Clément les commandes
PowerShell à lancer lui-même plutôt que de contourner.

Si les dépendances ne s'installent pas dans le shell local (réseau), faire
`npm run verifier` dans l'espace de travail cloud sur une copie identique,
puis appliquer le résultat dans le dépôt local par `git apply` sur la
branche — jamais par une archive.

## Conventions du code

- Code, commentaires, messages et documentation en français. Les
  commentaires expliquent le *pourquoi* ; le raisonnement long va dans
  `docs/conception/`.
- **Sauvegardes** : ajouter un champ = une valeur par défaut dans `etatVide()`
  ou `etatNeuf()`. Changer le sens d'un champ = monter `SCHEMA`, migration dans
  `src/lib/sauvegarde/schema.js`, test dans `tests/sauvegarde.test.js`. Des
  joueurs ont une partie sur leur compte : ne jamais la casser sans migration.
- **Mines** : l'économie est dans `src/mines/regles.js` (formules pures) ; la
  modifier, puis lancer `npm test` et `npm run audit`.
- **Extensions** : un dossier dans `src/extensions/`, rien d'autre à toucher.
- Mettre à jour la page de `docs/conception/` concernée quand le
  comportement change.

## Ne pas faire

- Toucher à la configuration de production (variables GitHub, règles
  Firestore publiées) sans le dire explicitement.
- Ajouter un script, une police ou une image chargés depuis un domaine tiers :
  la page Confidentialité et la CSP (`vite.config.js`) doivent rester vraies.
- Écrire des secrets dans le dépôt (clé de compte de service, `.env.local`).
