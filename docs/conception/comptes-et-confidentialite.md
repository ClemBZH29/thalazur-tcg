# Comptes, synchronisation et confidentialité

Raisonnement de conception : ce que fait cette partie du site, et pourquoi elle le fait ainsi. Pour travailler sur le projet, voir le [README](../../README.md).

## Comptes et synchronisation


- **Firebase Authentication** (Google) pour l'identité, **Cloud Firestore** pour
  la copie de la partie : un document `joueurs/{uid}` par joueur, lisible par
  lui seul (`firestore.rules`).
- **Classement**, sur demande seulement : une ligne `classement/{uid}` (pseudo,
  titre, progression), lisible par les joueurs connectés. Le pseudo est
  demandé à la première connexion, en précisant qu'il n'a pas à être le vrai
  nom. Voir [succès et classement](succes-et-classement.md).
- **Local d'abord.** Le navigateur garde la partie ; le compte en reçoit une
  copie trente secondes après le dernier changement et dès que l'onglet passe
  en arrière-plan. Hors ligne, on joue, l'envoi attend.
- **Deux appareils.** Chaque écriture porte une révision ; les règles refusent
  celle qui ne part pas de la dernière. L'appareil refusé intègre la copie du
  compte par une fusion à trois voies (`src/lib/nuage/fusion.js`, testée par
  `tests/fusion.test.js`) : les exemplaires et boosters des deux côtés
  s'additionnent, le gain passif n'est pas payé deux fois.
- **Première connexion** : la partie jouée sans compte s'ajoute au compte.
  **Déconnexion** : l'appareil est vidé, la partie reste sur le compte.
- **Le SDK n'est chargé qu'au besoin** (clic sur « Se connecter », ou session
  déjà ouverte) : un visiteur sans compte ne contacte jamais Google. Les
  polices sont servies par le site (`@fontsource`), pour la même raison. C'est
  ce qui dispense de bandeau de consentement : aucun traceur hors stockage
  strictement nécessaire.

La configuration passe par `VITE_FIREBASE_*` (voir `.env.example`) :
`.env.local` en développement, variables du dépôt GitHub pour le déploiement.
Sans elles, le build sort un site entièrement local, sans bouton de connexion.
Les mentions légales se tiennent dans `src/config/legal.js`.

**Mesure d'audience.** Google Analytics (via Firebase) ne se charge qu'après
« Accepter » dans le bandeau (`src/lib/mesure.js`) : ni script, ni requête,
ni cookie avant. Refuser est aussi simple qu'accepter, le choix se garde six
mois et se change depuis le pied de page, le profil ou la page
Confidentialité ; retirer l'accord coupe la collecte et efface les cookies
`_ga`. Stockage publicitaire refusé, signaux Google coupés, cookies à 13 mois.
Sans `VITE_FIREBASE_MEASUREMENT_ID`, ni bandeau ni mesure.

**Sécurité.** Politique CSP posée au build dans `index.html`
(`vite.config.js`, GitHub Pages ne permettant pas d'en-têtes HTTP). Règles
Firestore : un document par joueur, lisible et modifiable par lui seul,
forme et taille vérifiées, écriture refusée si elle ne part pas de la
dernière révision. Les leviers de meneur (taux, mode test, roster) sont
ignorés en production. `public/404.html` renvoie `/comptoir` vers
`/#/comptoir` et affiche une page d'erreur pour le reste.

**Conservation : cinq ans sans utilisation.** `scripts/purge-comptes.mjs`,
lancé une fois par an, supprime les comptes sans connexion depuis cinq ans,
partie comprise (simulation par défaut, `--effacer` pour agir). Chaque
écriture porte aussi un champ `expire` (maintenant + cinq ans) : la
suppression automatique par TTL Firestore exige la facturation (offre Blaze)
et n'est pas active ; le jour où elle l'est, une règle TTL sur `joueurs.expire`
suffit, sans toucher au code.

### Incident du 30/09/2026 : collections vidées au passage au format 7

La copie du compte n'était lue que si son numéro de format était exactement
celui du site. Au passage du format 6 au 7 (renumérotation de La Troupe), une
copie encore au 6 — écrite juste avant la mise à jour, ou par un onglet resté
ouvert sur l'ancienne version — se lisait comme une partie vide ; cette partie
vide remplaçait la collection de l'appareil, qui la renvoyait ensuite sur le
compte. Reproduit avec un Firebase simulé : 20 cartes → 0.

Correctifs (`src/jeu/Compte.jsx`) :

- la copie du compte passe par les migrations (`lireCompte`), comme la
  sauvegarde locale et les fichiers importés ; la base de synchronisation
  aussi (`lireBase`) ;
- une copie illisible n'est jamais adoptée ; une copie d'une version plus
  récente du site n'est pas touchée, et le joueur est invité à recharger ;
- une copie à un format ancien est relue à chaque ouverture de session, même
  à la révision connue : si elle porte encore la collection, elle revient ;
- **copie de secours** : avant d'adopter une version qui compte moins
  d'exemplaires que l'appareil, celui-ci garde ce qu'il remplace
  (`brume-thalazur:secours`), que le profil propose de fusionner.

Règle pour la suite : **ne jamais comparer un numéro de format avec `===`** ;
toute lecture passe par `migrer()`.
