# Le lancement du site

Raisonnement de conception : ce que fait cette partie du site, et pourquoi elle le fait ainsi. Pour travailler sur le projet, voir le [README](../../README.md).

## Le déroulé

| Quand | Ce qu'on voit | Ce qui est publié |
|---|---|---|
| Jusqu'au 24/10/2026 à 23 h 59 | Le site de la bêta | Build `beta` (format 10) |
| 25/10/2026, 00 h 00 (Paris) | Bodégué endormi sur son comptoir, « La Brume de Thalazur », « Le site arrive bientôt » | Build `beta` qui bascule de lui-même, puis build `ferme` (cron) |
| Action « Ouverture du site » | Le site ouvert ; un bêta-testeur voit d'abord l'avis de remise à zéro | Build `ouvert` (format 11) |

La phase n'est jamais choisie à la main dans un fichier : `scripts/etat-site.mjs`
la déduit, à chaque déploiement, de l'étiquette Git `lancement` et de la date
(`src/config/phases.js`). Un push sur `main` pendant la fermeture republie donc
la page d'attente, et après l'ouverture le site ouvert.

## Minuit pile

Le cron de GitHub prend souvent du retard (jusqu'à une heure les jours chargés).
Le build de la bêta connaît l'heure de fermeture : à minuit, un onglet ouvert
démonte le jeu et affiche la page d'attente (`RacineJeu.jsx`, vérifié toutes les
quinze secondes). Plus rien n'est envoyé au compte. Le déploiement planifié
(22 h 00 et 22 h 30 UTC le 24/10) ne fait ensuite que retirer le jeu du paquet
publié.

## Une page d'attente qui ne cache rien

Le build `ferme` monte `src/lancement/RacineAttente.jsx` à la place du jeu
(alias `@racine` de `vite.config.js`). Le paquet publié ne contient que la page
d'attente : pas de jeu à réveiller depuis la console, pas de Firebase, pas de
mesure d'audience, pas de bandeau cookies.

La page relit `index.html` toutes les minutes (et au retour sur l'onglet) et
compare sa balise `<meta name="phase-site">` à la sienne : quand la version
publiée change, elle se recharge. Les joueurs qui attendent devant arrivent sur
le site ouvert sans rien faire (au délai du cache de GitHub Pages près, dix
minutes au plus).

Illustration : `public/lancement/bodegue-endormi.webp` (16:9) et
`bodegue-endormi-tel.webp` (9:16), prompts Sora dans le projet
(`claude/assets-sora-lancement.json`). Tant qu'elles manquent, la page compose
le décor des Missions et Bodégué serein, les yeux clos.

## Ouvrir le site

GitHub → **Actions** → **Ouverture du site** → *Run workflow*, taper `OUVRIR`.
Le workflow pose l'étiquette `lancement` sur `main`, puis appelle le déploiement.
La date de l'étiquette devient l'heure d'ouverture (`VITE_SITE_OUVERTURE`).

Pour refermer : supprimer l'étiquette (Code → Tags), relancer « Déploiement
GitHub Pages ». Attention : les parties déjà passées au format 11 le restent ;
un site refermé puis rouvert ne les remet pas une seconde fois à zéro.

## La remise à zéro des bêta-testeurs

Décision de Clément : au lancement, toutes les parties de la bêta repartent de
zéro ; en contrepartie, chaque bêta-testeur reçoit un dos de carte exclusif, le
**Dos de l'Éclaireur**. L'avis est obligatoire : on ne doit pas pouvoir le
fermer depuis l'inspecteur et garder sa partie.

**La remise est une migration, pas une fenêtre.** Le build ouvert passe au
format 11 ; `MIGRATIONS[11]` (`src/lib/sauvegarde/lancement.js`) remet la partie à
zéro. Toutes les lectures passent par `migrer()` — stockage local, copie du
compte, base de synchronisation, fichier importé, copie de secours, autre
onglet — : aucune porte ne laisse entrer une partie de la bêta. C'est le
modèle de la remise des Mines du 07/10/2026, faite elle aussi à la lecture.

- **Ce qui part** : collection, boosters, bourse, Mines, Donjon, expéditions,
  Reliquaire, missions, succès, titre, carte préférée.
- **Ce qui reste** : pseudo, choix de figurer au classement, préférences (son,
  animations, revente), conseils de Tafix déjà lus.
- **Le dos** : seulement pour une partie *jouée* (un booster ouvert ou une
  carte). Il est gagné et aussitôt choisi.
- **L'avis** (`src/lancement/AvisLancement.jsx`) : `lancement.avis = "a-lire"`
  dans la partie remise. Tant qu'il n'est pas validé, `App.jsx` ne monte pas la
  coque du site : l'avis *est* la page. Retiré avec l'inspecteur, il laisse un
  écran vide ; et de toute façon la partie est déjà remise quand il s'affiche.
- **À côté de la partie** : au premier chargement du format 11, la mine et la
  copie de secours de la bêta sont effacées du navigateur (`nettoyerBeta`,
  `storage.js`). La base de synchronisation reste : relue migrée, c'est elle
  qui permet à un avis lu ailleurs de ne pas revenir. La mine stockée se compare en texte
  brut ; `comparerMines` fait passer toute mine du format 11 devant une mine de
  la bêta, si avancée soit-elle.
- **Deux appareils** : le dos se fusionne en union, l'avis comme une valeur :
  lu sur l'ordinateur, il ne revient pas sur le téléphone.
- **Classement** : les lignes écrites avant l'heure d'ouverture sont celles de
  joueurs pas encore revenus ; elles ne s'affichent plus (`lireClassement`,
  `Compte.jsx`). Rien à changer dans les règles Firestore.

**Pourquoi le format 11 n'existe que dans le build ouvert.** `SCHEMA` vaut 10
dans les builds `beta` et `ferme`. Fusionner cette branche avant le 25/10 ne
touche donc à rien : la remise attend l'ouverture. Les tests tournent toujours
en bêta (`vite.config.js`) ; `tests/lancement.test.js` passe lui-même en phase
ouverte.

**Ce qui n'est pas protégé** : un joueur peut fabriquer à la main une partie au
format 10 dans son stockage pour obtenir le dos. Comme pour le reste de la
partie (voir `storage.js`), c'est accepté : le jeu vit dans le navigateur.

### Tester la remise en local

`npm run dev`, **sans être connecté**, puis Réglages MJ (`#/reglages`) →
« Simuler le lancement » :

- **Simuler la remise à zéro** applique à la partie du navigateur ce que fera
  la migration 11 (`src/lancement/simulation.js`), sans changer de format.
  Une partie qui n'a rien ouvert est traitée comme celle d'un bêta-testeur.
  L'avis s'affiche ; une fois validé, le profil montre le Dos de l'Éclaireur.
- **Restaurer** remet la partie, la mine et la copie de secours d'avant
  (gardées dans `brume-thalazur:simulation-lancement`).
- **Voir la page d'attente** ouvre `?attente` ; retirer `?attente` de
  l'adresse pour revenir au jeu.

Les boutons sont bloqués quand un compte est connecté : `.env.local` pointe sur
la base de production. L'outil n'existe pas en production (la page des
réglages MJ n'y est pas compilée).

### Prudence avec l'aperçu

L'aperçu (`npm run apercu`) parle à la base de production. Sans
`VITE_SITE_ETAT` dans `.env.local`, sa phase suit la date : construit après le
25/10, il est au format 11, et s'y connecter remet votre compte à zéro. Pour
tester l'ouverture avant l'heure, mettre `VITE_SITE_ETAT=ouvert` **sans se
connecter**, ou avec un projet Firebase de test.

## Les dos de carte

`src/config/dos.js` : le catalogue. Le dos choisi habille toutes les cartes
face cachée (ouverture, bibliothèque, Reliquaire, Comptoir, Missions,
grimoire) ; il est tenu hors de l'état React (`src/jeu/dos.js`) pour les scènes
animées qui n'ont pas le jeu sous la main.

Dans la partie : `dos: { gagnes: [id…], choisi }`. Le dos commun (Brumes) n'a
pas à être gagné. Pour en ajouter un : une entrée au catalogue, son image dans
`public/dos/`, et `gagnerDos(etat, id)` là où il se gagne (un succès, un
événement). Chaque dos suit la charte des dos (grille, pas de texte, pas de
rouge ni d'arc-en-ciel) : il ne doit jamais trahir le palier d'une carte.

« Tout effacer » garde les dos gagnés : celui des bêta-testeurs ne se regagne
pas. La suppression du compte, elle, emporte tout.

L'image du Dos de l'Éclaireur livrée avec la branche est provisoire (le dos
actuel teinté) ; le prompt Sora est dans `claude/assets-sora-lancement.json`.

## Le profil

Le profil était une longue page de blocs de texte. Il passe en quatre onglets,
chacun à son adresse : **Profil** (`#/profil` : pseudo, classement, titre,
carte préférée), **Dos de cartes** (`#/profil/dos`), **Préférences**,
**Compte et données** (synchronisation, fichiers, suppression). Un en-tête
commun montre le nom, le titre, trois compteurs et le dos choisi en vignette.
Les fenêtres `confirm` du navigateur (import, « Tout effacer ») sont remplacées
par des choix dans la page.
