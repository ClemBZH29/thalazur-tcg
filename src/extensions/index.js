/**
 * Le catalogue des extensions, construit à partir des dossiers.
 *
 * Chaque dossier de `src/extensions/` est une extension :
 *
 *   src/extensions/<id>/
 *     extension.js   code, titre, statut, couleurs, résumé, full art (obligatoire)
 *     sachet.webp    le visuel du sachet (obligatoire)
 *     roster.json    les cartes, produit par `npm run roster` (extension ouverte)
 *
 * Ajouter une extension, c'est ajouter un dossier ; l'ouvrir, c'est y déposer
 * le roster et passer `statut` à "ouvert". Aucune autre ligne de code.
 *
 * Une extension « bientôt » n'a pas de roster : ses cartes ne sont pas dans le
 * site publié, ce qui évite d'en dévoiler le contenu avant l'heure.
 */
import { FORME_CODE_EXTENSION } from "../lib/code-carte.js";

const definitions = import.meta.glob("./*/extension.js", { eager: true, import: "default" });
const rosters = import.meta.glob("./*/roster.json", { eager: true, import: "default" });
const sachets = import.meta.glob("./*/sachet.webp", { eager: true, query: "?url", import: "default" });

const dossier = (chemin) => chemin.split("/")[1];

export const BOOSTERS = Object.entries(definitions)
  .map(([chemin, def]) => {
    const id = dossier(chemin);
    if (def.id !== id) {
      throw new Error(`extensions/${id}/extension.js déclare l'identifiant « ${def.id} » : ils doivent être identiques.`);
    }
    if (!FORME_CODE_EXTENSION.test(def.code || "")) {
      throw new Error(`extensions/${id}/extension.js doit déclarer un code de trois lettres majuscules (code: "TRO").`);
    }
    const roster = rosters[`./${id}/roster.json`] || null;
    if (def.statut === "ouvert" && !roster) {
      throw new Error(`L'extension « ${id} » est ouverte mais n'a pas de roster.json.`);
    }
    return { ...def, sachet: sachets[`./${id}/sachet.webp`] || null, roster };
  })
  .sort((a, b) => (a.ordre ?? 999) - (b.ordre ?? 999));

// Deux extensions au même code rendraient ambigus le pied des cartes et les
// clés de cadrages.json.
for (const b of BOOSTERS) {
  const autre = BOOSTERS.find((x) => x !== b && x.code === b.code);
  if (autre) throw new Error(`Les extensions « ${b.id} » et « ${autre.id} » ont le même code « ${b.code} ».`);
}

export const BOOSTER_PAR_ID = Object.fromEntries(BOOSTERS.map((b) => [b.id, b]));

/** L'extension proposée par défaut : la première ouverte. */
export const BOOSTER_DEFAUT = (BOOSTERS.find((b) => b.statut === "ouvert") || BOOSTERS[0]).id;
