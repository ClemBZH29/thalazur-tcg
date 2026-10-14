import { SLOTS, TABLE_APPEL, TIERS_ROSTER } from "../config/tiers.js";

/** Les paliers que le pool peut contenir ; les full art et les PJ n'y sont jamais. */
const ORDRE = TIERS_ROSTER.map((t) => t.id);

function tirerPalier(table, rng) {
  const entries = Object.entries(table);
  let x = rng() * entries.reduce((s, e) => s + e[1], 0);
  for (const [tier, poids] of entries) {
    x -= poids;
    if (x <= 0) return tier;
  }
  return entries[entries.length - 1][0];
}

/**
 * Si un palier est vide dans le roster chargé, on glisse vers le plus proche.
 * La recherche reste dans les paliers du roster : elle montait jusqu'aux full
 * art, absents du pool, et un roster sans rare ni légendaire plantait
 * l'ouverture.
 */
function palierDisponible(pool, tier) {
  const a = (t) => (pool[t] || []).length > 0;
  if (a(tier)) return tier;
  const i = ORDRE.indexOf(tier);
  if (i < 0) return ORDRE.find(a) || null;
  for (let d = 1; d < ORDRE.length; d++) {
    const bas = ORDRE[i - d];
    if (bas && a(bas)) return bas;
    const haut = ORDRE[i + d];
    if (haut && a(haut)) return haut;
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
 * Les places où une full art peut sortir : les deux dernières, celles qui
 * portent la montée (14/10/2026). Avant, la full art était décidée pour le
 * booster entier et prenait toujours la cinquième — la carte la plus
 * prometteuse. Sur la quatrième, elle laisse la cinquième jouer : une full art
 * et une légendaire peuvent sortir ensemble.
 *
 * Chaque place tente sa full art à `taux.fullart` (1/4096), sauf la dernière
 * quand une carte PJ l'a déjà prise : la quatrième tente toujours. Décision de
 * Clément du 14/10/2026 : 1/4096 **par tentative**, ce qui fait environ une
 * full art pour 2 048 boosters, deux fois plus qu'avant.
 */
export const PLACES_FULLART = 2;

/** Full art attendues par booster : la quatrième tente toujours, la cinquième sans PJ. */
export const fullartParBooster = (taux) => taux.fullart * (PLACES_FULLART - taux.pj);

/**
 * Ouvre un booster. Pas de doublon à l'intérieur d'un même booster.
 *
 * options :
 *   taille              nombre de cartes (5 par défaut)
 *   speciales           { fullart: [], pj: [] } — cartes hors roster
 *   palierForce         force tous les emplacements sur un palier — mode test
 *   rainbowForce        "auto" | "toujours" | "jamais" — mode test
 *   garantirLegendaire  remplace la dernière carte ordinaire si aucune légendaire n'est sortie
 *
 * Ordre de résolution, avant les emplacements : la cinquième place tente
 * d'abord la carte PJ (1/8192), puis, sans elle, une full art (1/4096) ; la
 * quatrième tente toujours sa full art (1/4096). Deux full art sorties sont
 * deux cartes différentes. Un booster à carte spéciale n'est jamais un Appel.
 * La garantie de légendaire prend la dernière place restée ordinaire, pour que
 * les deux coexistent sans que l'une annule l'autre.
 *
 * `speciale` rend la plus prestigieuse des cartes hors roster sorties (la PJ
 * avant la full art), pour le bandeau de l'ouverture.
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

  // Cartes hors roster, avant les emplacements : la dernière place tente la
  // PJ puis, sans elle, la full art ; les autres places de `PLACES_FULLART`
  // tentent toujours la full art.
  let speciale = null;
  let pj = false;
  const placesFullart = [];
  if (!palierForce) {
    const derniere = taille - 1;
    pj = !!speciales.pj?.length && rng() < taux.pj;
    if (speciales.fullart?.length) {
      for (let s = Math.max(0, taille - PLACES_FULLART); s < taille; s++) {
        if (s === derniere && pj) continue;
        if (rng() < taux.fullart) placesFullart.push(s);
      }
    }
    speciale = pj ? "pj" : placesFullart.length ? "fullart" : null;
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
  } else if (speciale) {
    if (pj && cards.length) {
      const liste = speciales.pj;
      const tiree = liste[Math.floor(rng() * liste.length)];
      cards[cards.length - 1] = { ...tiree, rainbow: false, slot: cards.length - 1 };
    }
    const sorties = new Set();
    for (const s of placesFullart) {
      if (s >= cards.length) continue;
      let liste = speciales.fullart.filter((c) => !sorties.has(c.id));
      if (!liste.length) liste = speciales.fullart;
      const tiree = liste[Math.floor(rng() * liste.length)];
      sorties.add(tiree.id);
      cards[s] = { ...tiree, rainbow: false, slot: s };
    }
  }

  // Filet de sécurité : on remplace la dernière carte plutôt que d'en ajouter un,
  // pour que la taille du booster reste celle annoncée.
  let garanti = false;
  if (garantirLegendaire && cards.length && !cards.some((c) => c.tier === "legendaire")) {
    let cible = cards.length - 1;
    while (cible >= 0 && (cards[cible].tier === "fullart" || cards[cible].tier === "pj")) cible--;
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
