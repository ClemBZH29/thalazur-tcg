# Notes de conception

Raisonnement de conception : ce que fait cette partie du site, et pourquoi elle le fait ainsi. Pour travailler sur le projet, voir le [README](../../README.md).

## Notes de conception


Le sol de l'interface est froid — brume de nuit sur l'eau — et la lumière est
chaude, celle d'une lampe à huile de camp. Les cartes sont la seule source
lumineuse de l'écran ; c'est aussi ce qui permet aux modes de fusion `color-dodge`
et `screen` de l'irisation de fonctionner, ce qu'un fond clair rendait impossible.
Le bleu du cadre trouve naturellement sa place sur ce sol.

Les deux faces sont dessinées au même format, 1024 × 1536, et leurs angles
peints ont un rayon voisin — 33 px pour le cadre, 35 px pour le dos, soit un peu
plus de 3,2 % de la largeur. Le `border-radius` CSS est réglé à 3,7 % / 2,47 %,
juste au-dessus, pour découper sans laisser passer les angles noirs des PNG et
sans arrondir davantage que le dessin.

Typographie : Fraunces pour l'affichage, avec l'axe `WONK` activé qui donne sa
coupe légèrement gravée, et Archivo pour l'interface.

Le son est intégralement synthétisé — bruit blanc filtré pour les matières,
oscillateurs pour les paliers. Le contexte audio ne s'ouvre qu'au premier geste,
ce qui satisfait les règles d'autoplay des navigateurs.

Les préférences `prefers-reduced-motion` sont respectées : les animations
d'ambiance et de révélation sont coupées, la lueur reste affichée en statique
pour ne pas perdre l'information de rareté.

## Routage et chargement

**Le routage passe par le fragment**, pas par l'historique. Le site est publié
sur GitHub Pages en fichiers statiques : une adresse comme `/brume/comptoir`
renverrait un 404 au rechargement, faute de serveur pour réécrire vers
`index.html`. Le fragment ne quitte jamais `index.html`. Le routeur tient en
soixante lignes dans `src/lib/routeur.jsx` — aucune dépendance ajoutée.

Le Comptoir et les Mines sont **chargés à la demande**, puis **préchargés dès
que le navigateur est libre**. Le chargement à la demande seul avait un défaut :
le clic sur « Mines » déclenchait le téléchargement du module, de sa feuille de
style et, en développement, sa compilation — plusieurs secondes d'attente sur
une machine modeste, au moment précis où l'on demandait quelque chose. Le
travail se fait maintenant pendant qu'on lit l'accueil (`requestIdleCallback`,
repli à deux secondes), et le clic ne trouve qu'un module déjà en cache. Mesuré
sur le site construit : 142 ms avant, 82 ms après — et l'écart est bien plus
large là où la compilation compte.

L'accueil et la boutique tiennent chacun sur un écran et ne défilent pas
au-dessus de 1024 × 680 ; les Mines font de même au-dessus de 1024 × 700.
