import { SLOTS, TABLE_APPEL, TIER_ORDER } from "../config/tiers.js";

function tirerPalier(table, rng) {
  const entries = Object.entries(table);
  let x = rng() * entries.reduce((s, e) => s + e[1], 0);
  for (const [tier, poids] of entries) {
    x -= poids;
    if (x <= 0) return tier;
  }
  return entries[entries.length - 1][0];
}

/** Si un palier est vide dans le roster chargé, on glisse vers le plus proche. */
function palierDisponible(pool, tier) {
  if (pool[tier] && pool[tier].length) return tier;
  const i = TIER_ORDER.indexOf(tier);
  for (let d = 1; d < TIER_ORDER.length; d++) {
    const bas = TIER_ORDER[i - d];
    if (bas && pool[bas].length) return bas;
    const haut = TIER_ORDER[i + d];
    if (haut && pool[haut].length) return haut;
  }
  return null;
}

/**
 * Adapte la structure d'emplacements à une taille arbitraire, en gardant la
 * montée : un plancher de communs, puis l'avant-dernier et le dernier enrichis.
 */
function tablesPourTaille(n) {
  if (n <= 2) return SLOTS.slice(SLOTS.length - n);
  return [...Array.from({ length: n - 2 }, () => SLOTS[0]), SLOTS[3], SLOTS[4]];
}

/**
 * Ouvre un booster. Pas de doublon à l'intérieur d'un même booster.
 *
 * options :
 *   taille              nombre de cartes (5 par défaut)
 *   speciales           { fullart: [], pj: [] } — cartes hors roster
 *   palierForce         force tous les emplacements sur un palier — mode test
 *   rainbowForce        "auto" | "toujours" | "jamais" — mode test
 *   garantirLegendaire  remplace l'avant-dernière carte si aucun légendaire n'est sorti
 *
 * Ordre de résolution : la carte spéciale est décidée pour le booster entier
 * avant tout le reste et occupe le dernier emplacement. La garantie de
 * légendaire se replie alors sur l'avant-dernier, pour que les deux puissent
 * coexister sans que l'une annule l'autre.
 */
export function ouvrirBooster(pool, taux, options = {}) {
  const {
    taille = 5,
    speciales = { fullart: [], pj: [] },
    palierForce = null,
    rainbowForce = "auto",
    garantirLegendaire = false,
    rng = Math.random,
  } = options;

  // Tirage du booster entier, avant les emplacements.
  let speciale = null;
  if (!palierForce) {
    if (speciales.pj?.length && rng() < taux.pj) speciale = "pj";
    else if (speciales.fullart?.length && rng() < taux.fullart) speciale = "fullart";
  } else if (palierForce === "pj" || palierForce === "fullart") {
    speciale = palierForce;
  }

  const appel = !palierForce && !speciale && rng() < taux.appel;
  const tables = palierForce && !speciale
    ? Array.from({ length: taille }, () => ({ [palierForce]: 1 }))
    : appel
      ? Array.from({ length: taille }, () => TABLE_APPEL)
      : tablesPourTaille(taille);

  const pris = new Set();
  const cards = [];

  const piocher = (tierDemande, slot) => {
    const tier = palierDisponible(pool, tierDemande);
    if (!tier) return null;
    let cand = pool[tier].filter((c) => !pris.has(c.id));
    if (!cand.length) cand = pool[tier];
    const choisi = cand[Math.floor(rng() * cand.length)];
    pris.add(choisi.id);
    const rainbow =
      rainbowForce === "toujours" ? true
      : rainbowForce === "jamais" ? false
      : rng() < taux.rainbow;
    return { ...choisi, rainbow, slot };
  };

  const tablesUtiles = speciale && palierForce ? [] : tables;
  for (let s = 0; s < tablesUtiles.length; s++) {
    const carte = piocher(tirerPalier(tablesUtiles[s], rng), s);
    if (carte) cards.push(carte);
  }

  // Le mode test « tout en full art » remplit tout le booster.
  if (speciale && palierForce) {
    const liste = speciales[speciale];
    for (let s = 0; s < taille && liste.length; s++) {
      cards.push({ ...liste[Math.floor(rng() * liste.length)], rainbow: false, slot: s });
    }
  } else if (speciale && cards.length) {
    const liste = speciales[speciale];
    const tiree = liste[Math.floor(rng() * liste.length)];
    cards[cards.length - 1] = { ...tiree, rainbow: false, slot: cards.length - 1 };
  }

  // Filet de sécurité : on remplace la dernière carte plutôt que d'en ajouter un,
  // pour que la taille du booster reste celle annoncée.
  let garanti = false;
  if (garantirLegendaire && cards.length && !cards.some((c) => c.tier === "legendaire")) {
    const cible = speciale ? cards.length - 2 : cards.length - 1;
    if (cible >= 0) {
      pris.delete(cards[cible].id);
      const force = piocher("legendaire", cible);
      if (force) {
        cards[cible] = force;
        garanti = force.tier === "legendaire";
      }
    }
  }

  return { cards, appel, garanti, speciale };
}
