# Audit de sécurité — La Brume de Thalazur

Audit du 23/09/2026, sur le dépôt `thalazur-tcg` (site statique GitHub Pages +
Firebase Authentication / Cloud Firestore / Google Analytics).

## Modèle de menace

Site de loisir entre joueurs qui se connaissent. Aucune donnée de paiement,
aucune donnée partagée entre joueurs. Ce qu'il faut protéger : les données
personnelles des comptes (identité Google, partie), le quota Firebase gratuit,
et l'intégrité du site servi. Tricher sur sa propre partie (horloge, stockage
local) est accepté par conception : l'économie est calculée dans le navigateur.

## Corrigé dans cette version

| Point | Risque | Correction |
|---|---|---|
| Dépendance `xlsx` 0.18.5 | 2 failles connues sans correctif sur npm (pollution de prototype, ReDoS) | Remplacée par `read-excel-file`, et limitée au développement |
| Vite 5 / esbuild | Faille du serveur de développement (lecture de réponses par un site tiers) | Vite 7 ; `npm audit` : 0 vulnérabilité |
| Page Réglages publique | Mode test (ouvrir sans payer), taux de tirage et roster modifiables par n'importe qui | Page réservée à `npm run dev`, absente du build ; valeurs héritées ignorées en production |
| Clés `__proto__` dans un import ou une copie du compte | Pollution de prototype côté navigateur | Clés filtrées à l'import et à la fusion ; test ajouté |
| Aucune politique CSP | Un script injecté pourrait appeler n'importe quel domaine | CSP en `<meta>` au build, origines Firebase/Google listées une à une |
| Traceurs avant consentement | Non-conformité CNIL | Analytics chargé seulement après « Accepter », retrait qui efface les cookies |
| Clés de compte de service | Fuite possible dans le dépôt | Motifs ajoutés au `.gitignore` |
| Règle Firestore sur `mine` | Écriture refusée si le champ manque | Règle rendue tolérante |

## Vérifié, sans changement

- **Règles Firestore** : lecture et écriture limitées au propriétaire du
  document ; champs autorisés listés ; taille bornée (950 Ko) ; révision
  strictement +1, ce qui empêche deux appareils de s'écraser ; horodatage serveur
  imposé ; tout le reste fermé.
- **Injection HTML** : aucun `dangerouslySetInnerHTML`, `innerHTML` ni `eval`
  dans le code du site ; React échappe tout le texte affiché.
- **Secrets** : aucun dans le dépôt. La configuration Firebase du navigateur
  n'est pas un secret ; elle est protégée par les règles et par la restriction de
  clé ci-dessous.
- **Workflow de déploiement** : permissions minimales (`contents: read`,
  `pages: write`, `id-token: write`).

## À faire dans les consoles (non réalisable depuis le code)

1. **Restreindre la clé API** — Google Cloud Console → API et services →
   Identifiants → la clé « Browser key » → Restrictions d'application : *Sites
   web*, avec `https://thalazur.io/*`, `https://www.thalazur.io/*`,
   `http://localhost:5173/*` et `https://<projet>.firebaseapp.com/*`.
2. **Google Analytics** — Admin → Collecte des données : signaux Google
   désactivés ; Conservation des données : 14 mois ; Paramètres de partage des
   données : tout décocher.
3. **Enforce HTTPS** dans GitHub Pages dès que la case est disponible.
4. **Dependabot** — ajouter `.github/dependabot.yml` (fourni à part) pour être
   prévenu des failles des dépendances.
5. **Node 22** dans le workflow : Node 20 n'est plus maintenu depuis avril 2026.

## Risques acceptés

- **Triche sur sa propre partie** (horloge, stockage local, fichier importé) :
  sans effet sur les autres joueurs. À revoir si des échanges entre joueurs
  arrivent : il faudrait alors une autorité côté serveur (Cloud Functions,
  offre Blaze).
- **Abus du quota Firestore** par un script qui créerait des comptes en masse :
  sur l'offre gratuite, le service s'arrête au quota, sans facture. App Check
  (reCAPTCHA) le bloquerait, mais ajoute un script et des cookies Google à
  déclarer ; à envisager si cela arrive.
- **En-têtes HTTP** (`X-Frame-Options`, HSTS) : impossibles à poser sur GitHub
  Pages. Le seul geste sensible (supprimer son compte) exige une
  réauthentification Google, ce qui neutralise le détournement de clic.
