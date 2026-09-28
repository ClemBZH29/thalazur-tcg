/**
 * Le catalogue des succès du site, construit une fois à partir des
 * extensions publiées. Séparé de `regles.js` parce que le catalogue des
 * extensions passe par `import.meta.glob`, que Node ne connaît pas : les
 * scripts d'audit construisent le leur à partir des fichiers.
 */
import { BOOSTERS } from "../extensions/index.js";
import { construireCatalogue } from "./regles.js";

export const CATALOGUE = construireCatalogue(BOOSTERS);
