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
- **Rien d'automatique avant d'avoir lu le compte** (09/10/2026). Un appareil
  qui suit un compte attend la copie du compte (15 s au plus) avant de tirer
  les missions du jour ou d'accueillir les expéditions rentrées (`compteLu`
  dans `src/jeu/Jeu.jsx`). Avant, le téléphone ouvert le lendemain tirait ses
  missions sur une partie en retard ; la fusion y voyait « joué ici », et ce
  tirage vide effaçait les missions réalisées sur l'ordinateur — la session
  la moins avancée prenait le dessus.
- **Missions et expéditions ne sont plus des valeurs** mais ont leur fusion :
  missions par période (la plus récente l'emporte ; même jour, « réclamée »
  d'un côté l'est des deux, et une récompense payée deux fois est reprise) ;
  expéditions comme un ensemble de routes (une route rentrée d'un côté ne
  revient pas, une route partie de l'autre s'ajoute).
- **Donjon, Comptoir, garantie de légendaire** ont aussi leur fusion : les
  tentatives du jour s'additionnent, une descente terminée sur le compte ne
  se rejoue pas ailleurs, les convalescences s'unissent ; le Comptoir se
  fusionne extension par extension, et le même jour les quotas des acheteurs
  s'additionnent (vingt cartes vendues à Lise sur chaque appareil font
  quarante, pas vingt), marchandages et achats au rayon s'unissent, la caisse
  et le rayon reçoivent les ventes des deux côtés ; d'un jour à l'autre, le
  plus récent l'emporte ; les boosters ouverts des deux côtés
  comptent pour la garantie.
- **Les exemplaires ont un plancher** (09/10/2026) : une case présente dans
  la base et des deux côtés ne descend pas sous un exemplaire. Deux appareils
  qui vendaient chacun les deux doublons d'une carte à trois exemplaires
  donnaient 1 + 1 − 3 = 0 : la dernière carte disparaissait. Aucune action ne
  prend le dernier exemplaire d'une case sauf le STAR RESET, qui la vide —
  elle est alors à zéro de ce côté, et le plancher ne joue pas. Restent des valeurs : réglages, profil,
  colporteur, ouverture en cours.
- **Retour sur un onglet resté en arrière-plan plus d'une minute** (le
  téléphone ressorti de la poche) : même attente qu'à l'ouverture, le compte
  est relu avant tout tirage ou retour d'expédition.
- **Plusieurs onglets** partagent le stockage : chacun adopte la partie
  qu'un autre vient d'écrire, et la marque de synchronisation qui va avec.
  Avant, l'onglet oublié réécrivait sa vieille partie toutes les vingt
  secondes (gain passif), et la fusion suivante la lisait comme des cartes
  vendues : le compte les perdait.
- **Onglets de deux versions du site** (après une montée de `SCHEMA`,
  09/10/2026). L'onglet resté sur l'ancienne version ne lit pas ce qu'écrit
  la nouvelle, mais réécrivait sa vieille partie toutes les vingt secondes ;
  l'onglet à jour l'adoptait, migrée, et perdait sa progression. Désormais :
  une écriture d'un format plus ancien n'est pas adoptée (l'onglet à jour
  réécrit la sienne, et remet sa mine) ; un onglet qui voit une partie, une
  base ou une mine d'un format **plus récent** — dans le stockage partagé, au
  chargement, ou sur le compte — se **gèle** (`src/lib/gel.js`) : plus aucune
  écriture locale ni aucun envoi, et un bandeau « Recharger ». Les règles
  Firestore refusent aussi qu'un document redescende de format.
- **Première connexion** : la partie jouée sans compte s'ajoute au compte.
  **Déconnexion** : l'appareil est vidé, la partie reste sur le compte. Un
  envoi en cours est attendu avant de juger s'il reste des changements non
  envoyés. Le vidage ne garde pas de copie de secours : elle appartiendrait
  au joueur qui s'en va.
- **Compte supprimé depuis un autre appareil** : un appareil resté connecté
  (le jeton Firebase survit jusqu'à une heure) recréait le document et la
  ligne du classement. Un document absent alors que l'appareil en
  connaissait une révision vaut maintenant suppression : rien n'est écrit,
  l'appareil est vidé et déconnecté. La suppression elle-même attend la fin
  d'un envoi en cours.
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
dernière révision ou si elle fait reculer le format. L'échéance `expire`
n'est bornée qu'entre un jour et dix ans : calculée sur l'horloge de
l'appareil, des bornes à quelques jours de cinq ans refusaient en boucle
les appareils mal réglés. Les lignes du classement lues chez les autres
joueurs sont assainies côté client (`assainirLigne`), les règles ne sachant
pas typer les valeurs d'une table. Les leviers de meneur (taux, mode test, roster) sont
ignorés en production. `public/404.html` renvoie `/comptoir` (et chaque page de `App.jsx`, vérifié
par `tests/routes.test.js`) vers `/#/comptoir` et affiche une page d'erreur
pour le reste. Une erreur d'affichage ou un module qui ne se charge pas ne
laisse plus d'écran blanc : une limite d'erreur (`LimiteErreur.jsx`) propose
de recharger et d'exporter sa partie.

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
  (`brume-thalazur:secours`), que le profil propose de **restaurer** : la
  copie est une version antérieure de la même partie, chaque compteur garde
  donc le plus grand des deux (la fusionner comme un import additionnait :
  10 et 9 donnaient 19), la mine la plus avancée reste, puis la copie est
  effacée. Elle part aussi avec la partie à la déconnexion (`effacer()`).

Règle pour la suite : **ne jamais comparer un numéro de format avec `===`** ;
toute lecture passe par `migrer()`.
