# Audit de structure — La Brume de Thalazur

Audit du 23/09/2026. Objectif : que chaque future mise à jour (une extension,
un réglage des Mines, un nouveau module) touche peu de fichiers, se vérifie
automatiquement et ne puisse pas écraser le travail précédent.

Un seul joueur à ce jour : on s'autorise à casser le format des sauvegardes.

## État au 23/09/2026

| Point | État |
|---|---|
| § 1 Flux de travail | Fait dans le dépôt (`.gitattributes`, `.editorconfig`, `CLAUDE.md`, `CHARTE.md` retiré, archives ignorées). Reste dans GitHub : protéger `main` |
| § 2 Mines | Fait : `donnees.js`, `regles.js`, `sauvegarde.js`, `format.js`, interface. L'audit d'économie importe les règles (résultats identiques à l'octet). Le découpage de l'interface en sous-composants reste à faire au fil des modifications |
| § 3 Sauvegardes | Fait : schéma commun n° 6, registre de migrations, anciens formats effacés |
| § 4 Extensions | Fait : `src/extensions/<id>/`, catalogue automatique |
| § 5 État du jeu | Fait en partie : `Jeu.jsx` découpé en crochets (`reglages.js`, `marche.js`, `colporteur.js`, `mine.js`) derrière le même `useJeu()`. Correction : le gain de rendu annoncé était surévalué, la coque lit déjà la bourse et redessine tout ; le bénéfice est la lisibilité, pas la vitesse |
| § 6 Outillage | Fait : ESLint, Prettier, EditorConfig, Vitest (36 tests), workflow bloquant sur lint et tests |
| § 7 Documentation | Fait : README réduit, `docs/conception/` |

---

## 0. Incident constaté pendant l'audit

Le dossier local a été écrasé à 15h24 par l'extraction d'un `_maj.zip`
construit sur une base antérieure au dernier push. Seize fichiers étaient
revenus en arrière (plus de CSP, retour de `xlsx` et de Vite 5, bandeau
cookies et page Profil détachés…). Un commit à ce moment aurait annulé ces
changements en ligne sans que rien ne le signale.

**Corrigé** : ces seize fichiers ont été restaurés depuis le dernier commit.
Les trois changements réels de ce zip ont été conservés :
`src/mines/MinesDeKazim.jsx`, `src/styles/kazim.css`,
`docs/charte-graphique.md`.

**Cause** : deux sources de vérité, Git et des archives zip produites séparément.
C'est le premier point à régler (§ 1).

---

## 1. Flux de travail — priorité haute

| Constat | Recommandation |
|---|---|
| Des mises à jour arrivent en `.zip` à extraire par-dessus le dossier | **Git est la seule source.** Toute session de travail (humaine ou Claude) part de `main` à jour, travaille sur une branche, et livre un commit ou un patch — jamais une archive à décompresser |
| `main` n'est pas protégée | GitHub → Settings → Branches → règle sur `main` : interdire le force push et la suppression, exiger que le workflow passe avant fusion |
| Pas de préproduction | Travailler sur une branche avec `npm run dev`, et un projet Firebase de test (`thalazur-dev`) dans `.env.local` |
| `C:\Dev\TCG\Module Comptoir` et `Module Idle Mine` : anciennes copies des modules, désormais intégrés dans `src/` | Les archiver hors de `C:\Dev\TCG` : elles invitent à modifier le mauvais fichier |
| `C:\Dev\TCG\charte-graphique.md` : copie de `docs/charte-graphique.md` ; `CHARTE.md` à la racine du dépôt ne fait que renvoyer vers `docs/` | Une seule charte, dans `docs/` |
| `_a_supprimer/`, `Claude outputs/*.zip` | À supprimer ; ajouter `_a_supprimer/` au `.gitignore` |
| Pas de `.gitattributes` sur un poste Windows | `* text=auto eol=lf` : évite des différences fantômes de fins de ligne |

---

## 2. Le module des Mines — priorité haute

`src/mines/MinesDeKazim.jsx` fait 1 554 lignes et mêle cinq choses : les
données (strates, compagnons, équipement, talents, lexique), les formules
d'économie, la mise en forme des nombres, la sauvegarde, et l'interface.

Conséquence directe : `scripts/audit-economie.mjs` **extrait les formules en
découpant le texte du fichier** entre deux bannières de commentaire. Renommer
une bannière ou déplacer une fonction casse l'audit sans erreur de build.

Découpage proposé :

```
src/mines/
  donnees.js       strates, compagnons, équipement, talents, lexique
  regles.js        formules pures (dps, coûts, cours kobold, PV des filons…)
  sauvegarde.js    etatNeuf(), version du format, migrations
  format.js        fmt, fmtEnt, fmtDuree
  MinesDeKazim.jsx l'interface seule, qui importe les quatre autres
  composants/      Filon, Compagnons, Equipement, Talents, Lexique
```

- `regles.js` devient importable par l'audit d'économie et par des tests : un
  réglage des Mines se vérifie en une commande.
- La prise en charge de `window.storage` et du magasin en mémoire (héritage de
  l'époque où la mine était un artefact autonome) disparaît : le site fournit
  toujours son magasin.

---

## 3. Sauvegardes — priorité haute (on peut repartir de zéro)

Aujourd'hui, trois versions de format coexistent sans lien entre elles :
l'état du jeu (`v5`, avec la migration depuis `v4`), la mine (`v: 1`) et le
document du compte (`schema`).

Proposition, en profitant du fait qu'une remise à zéro ne gêne personne :

- **Une seule version de format**, `SCHEMA = 1`, qui couvre l'état du jeu et la
  mine.
- **Un registre de migrations**, `src/lib/sauvegarde/migrations.js` : une
  fonction par passage de version (`1 → 2`, `2 → 3`…). Le chargement local,
  l'import de fichier et la copie du compte passent tous par la même chaîne.
- **Suppression du code v4** (`ANCIENNES`, `migrerV4`, `normaliser`).
- **Un test par migration** : une sauvegarde d'exemple de l'ancienne version
  doit se charger dans la nouvelle.

C'est ce qui rendra sûre la prochaine modification des Mines qui change la
forme de la sauvegarde.

---

## 4. Extensions — priorité moyenne

Une extension est aujourd'hui répartie sur cinq endroits :
`src/config/boosters.js`, `data/<id>.json`, `src/config/speciales.js`
(full art), `public/sachet-<id>.webp`, et bientôt les portraits.

Proposition : **un dossier par extension**, découvert automatiquement.

```
extensions/
  troupe-valeran/
    extension.js    titre, statut, couleurs, résumé, full art
    roster.json     produit par npm run roster
    sachet.webp
    cartes/         portraits (voir le chantier images)
  nakova/
    extension.js    statut: "bientot"
    sachet.webp
```

Le site charge `extensions/*/extension.js` avec `import.meta.glob` de Vite.
Ouvrir Nakova revient à remplir son dossier et à passer `statut` à
`"ouvert"`, sans toucher au code. Le roster et les images d'une extension non
ouverte ne sont pas publiés, ce qui règle aussi la question de la divulgation.

---

## 5. État du jeu — priorité moyenne

`src/jeu/Jeu.jsx` (435 lignes) est un contexte unique qui porte la bourse, la
collection, le tirage, le Comptoir, le colporteur, la mine et les réglages.
Chaque changement de bourse (toutes les 20 s) redessine tout ce qui lit ce
contexte.

Proposition : garder un seul état sauvegardé, mais l'exposer par des crochets
ciblés — `useBourse()`, `useCollection()`, `useColporteur()`, `useMine()` —
dans `src/jeu/`. Chaque module ne dépend plus que de ce qu'il utilise, et
une modification de l'un ne touche plus l'autre.

---

## 6. Outillage — priorité moyenne

| Manque | Apport |
|---|---|
| Pas de linter | ESLint avec `eslint-plugin-react-hooks` : détecte les dépendances oubliées dans les `useEffect`/`useCallback`, source classique de bugs discrets |
| Pas de formateur | Prettier : des diffs qui ne montrent que les vrais changements |
| Un seul test, lancé à la main | Vitest ; tests sur `mines/regles.js`, `comptoir/marche.js`, `lib/draw.js`, les migrations ; lancés par le workflow avant chaque déploiement (déjà fait pour la fusion) |
| Scripts d'audit isolés | `npm run audit` qui enchaîne économie, marché et colporteur |

---

## 7. Documentation — priorité basse

`README.md` fait 1 074 lignes, dont l'essentiel est le raisonnement de
conception (pourquoi tel seuil, pourquoi telle animation). C'est précieux,
mais noie ce qu'il faut pour travailler.

- `README.md` réduit à : installer, développer, déployer, structure du dépôt,
  liens.
- `docs/conception/` : un fichier par module (boutique, Comptoir, colporteur,
  Mines, comptes), repris du README actuel.
- Les longs commentaires de raisonnement dans le code restent, mais les
  nouveaux vont plutôt dans `docs/conception/`.

---

## Ordre proposé

1. **Flux de travail** (§ 1) : protection de `main`, nettoyage des copies,
   `.gitattributes`. Une demi-heure, surtout dans GitHub.
2. **Mines + sauvegardes** (§ 2 et 3) en une seule branche, avant les prochaines
   modifications des Mines : c'est là que le découpage rapporte tout de suite.
3. **Outillage** (§ 6) : ESLint, Prettier, Vitest dans le workflow.
4. **Extensions** (§ 4), à faire avant d'ouvrir Nakova, en même temps que le
   chantier des images.
5. **État du jeu** et **documentation** (§ 5 et 7), au fil de l'eau.
