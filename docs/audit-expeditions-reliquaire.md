# Audit — Expéditions V2 et Reliquaire V2

Audit du 28/09/2026, fait sur un prototype avant l'écriture des modules. Le
comportement retenu est décrit dans [la conception](conception/expeditions-et-reliquaire.md).

Chiffres des modes existants : `audit-economie`, `audit-donjon` (branche
`sujet/donjon-equilibre`), `audit-marche`. Reliquaire : course simulée sur le vrai
roster de La Troupe (220 cartes : 110 C, 66 PC, 33 R, 11 L), 100 joueurs par cas,
tirage de `src/lib/draw.js` avec garanties de légendaire :

```bash
node scripts/audit-reliquaire.mjs 100
```

## 1. Ce que rapporte chaque mode

| Source | PO/jour | Boosters |
|---|---:|---:|
| Gain passif | 360 | 3,0 |
| Donjon, 2 descentes | 204 | 1,7 |
| Mines, 10 min à 2 h | 80 à 190 | 0,7 à 1,6 |
| Colporteur | ~9 | 0,07 |
| Expéditions V1 | jusqu'à 120 | 1,0 |
| **Expéditions V2** | **81 à 91 (plafond 100)** | **0,7** |

Profils : occasionnel 462 PO (3,9 boosters/j), régulier 714 PO (6,0), assidu 854 PO (7,1).

## 2. Reliquaire

Le vrai concurrent de la dissolution est le Comptoir. Mesure : le « détour » =
(dissolution / forge × prix de vente du Comptoir) / prix de rachat du Comptoir.
Comptoir (audit-marche) : rachat C 3,6 · PC 8,7 · R 25,8 · L 84,3 ; vente 10,6 · 25,9 · 80,8 · 271,2.

| Palier | V1 dissout / forge | Détour V1 | V2 dissout / forge | Détour V2 |
|---|---:|---:|---:|---:|
| Commune | 2 / 20 | 29 % | 5 / 20 | 74 % |
| Peu commune | 5 / 50 | 30 % | 10 / 40 | 74 % |
| Rare | 15 / 150 | 31 % | 25 / 100 | 78 % |
| Légendaire | 1 cœur / 3 cœurs + 400 | 29 % | 100 / 400 | 80 % |

V1 : dissoudre rendait moins du tiers du Comptoir, donc personne ne dissolvait avant 95 %.
V2 : un vestige ≈ une PO de rachat, rapport 1:4 partout, cœurs de relique supprimés.
Pouvoir d'achat d'un doublon ×2,5 à ×4.

| Joueur régulier | 90 % | 100 % | Vestiges/j | L forgées |
|---|---:|---:|---:|---:|
| Boosters seuls | 23 j | 100 j | — | — |
| Doublons vendus au Comptoir | 20 j | 73 j | — | — |
| V1, tout dissous | 17 j | 44 j | 78 | 1,9 |
| **V2, tout dissous** | **13 j** | **36 j** | **155** | **3,3** |
| V2 + vestiges d'expédition | 13 j | 35 j | 185 | 3,5 |

Occasionnel 154 / 65 / 51 jours ; assidu 84 / 37 / 32 jours (sans, V1, V2).
Risque : complétion en 5 semaines pour un régulier. Levier : `RELIQUAIRE.forge`.

## 3. Expéditions V2

- 6 à 12 places (+1 tous les 20 niveaux du Lieu, +5 max), 3 simultanées, un Lieu à la fois.
- 4, 12 ou 24 h en temps réel, rendement horaire ×1,0 / ×0,9 / ×0,8. Plus d'objectif : butin mêlé.
- Effort = puissance × heures × rendement × Lieu. PO 0,1/effort (plafond 100/j toutes expéditions, remis à minuit), vestiges 0,05/effort (~40/j), XP carte 0,5/h égale pour tous (~10/j contre ~58 par descente au Donjon), 1 trouvaille (C 70, PC 25, R 5) par 12 h.
- PO par carte et par jour : ~14 en V1, ~2,7 en V2.
- Lieu : 2 XP/h × (0,5 + 0,5 × remplissage), courbe et paliers de `src/donjon/experience.js`. Rainbow du Lieu au palier (C 20 : 6 j, PC 30 : 13 j, R 40 : 21 j, L 50 : 31 j à 24 h/jour), PO si déjà rainbow, booster au niveau 100 (114 j). +0,5 % de rendement par niveau.
- Retour : fenêtre automatique, différée pendant un combat du Donjon, une ouverture ou le colporteur. Dans le dépôt : `occupe` calculé par la coque (`etat.enCours`, page d'ouverture, page du Donjon avec une descente) et guetteur dans `RetourExpeditions` (30 s et `visibilitychange`). Crédit une seule fois à l'annonce, butin tiré au départ avec graine. Bouton « Renvoyer la même équipe ».
- « Compléter l'équipe » : cartes affines, puis les plus puissantes. Aucune réservation d'office pour le Donjon (retirée le 28/09/2026 : critère illisible).

## 4. Tranché à l'écriture

1. Cartes de personnage : hors des expéditions, puisqu'elles ne sont pas des alliés
   du Donjon ; hors du Reliquaire.
2. Affinités : pas de colonne à ajouter au classeur. La faction d'un PNJ est
   comparée à la province du Lieu.
3. Vestiges : affichés au Reliquaire et au retour d'expédition, jamais dans le bandeau.
4. Leviers : `src/config/expeditions.js`, `src/config/reliquaire.js`, `scripts/audit-reliquaire.mjs`.

