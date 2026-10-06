/**
 * Préchargement des illustrations du site, pendant que le visiteur lit.
 *
 * Les pages chargées à la demande (Comptoir, Mines, Donjon, Expéditions,
 * Reliquaire) sont déjà préchargées au repos par la coque ; leurs images ne
 * l'étaient pas. Arriver sur une page lançait donc le téléchargement de son
 * bandeau et de ses portraits, puis leur décodage : un court instant sans
 * image, visible surtout sur les bandeaux en fond. GitHub Pages ne garde en
 * cache que dix minutes, si bien que le délai revenait à chaque visite.
 *
 * On les demande donc au repos, par vagues, de la plus visible à la moins
 * visible, et l'on attend leur décodage (`decode()`) pour que le premier
 * affichage n'ait plus rien à faire. Les objets `Image` sont gardés : un
 * navigateur peut jeter une image décodée qu'aucune référence ne retient.
 *
 * La liste est tenue à la main ; tests/prechargement.test.js vérifie que
 * chaque fichier existe et que chaque dossier listé l'est en entier.
 */
export const DOSSIERS = {
  expeditions: ["bandeau", "camp-vide", "maitre-route", "marqueur"],
  reliquaire: ["bandeau", "gardien", "reliquaire", "vestige"],
  comptoir: ["conservateur", "eloi", "gaspard", "hector", "lise", "mirko", "nassim", "oriane", "sorelle", "voren", "ysee"],
  kazim: ["benediction-filon", "contrat-courtage", "elementaire-faille", "etais-renforces", "fanal-huile",
    "foreuse-vapeur", "golem-schiste", "kobold-deserteur", "lentille-quartz", "machine-kazim", "mineur-nain",
    "pioche-acier", "pioche-fer", "pioche-kazim", "pioche-resonante", "porte-fanal", "rails-bascule",
    "serment-rookerie", "sourciere-etoile", "tamis-mailles"],
};

/** Les cadres et le dos des cartes, présents sur presque chaque page. */
export const RACINE = ["carte-cadre", "carte-dos", "carte-cadre-fullart"];

const chemin = (base, dossier, nom) => `${base}${dossier ? `${dossier}/` : ""}${nom}.webp`;

/** Les vagues, dans l'ordre : ce qui se voit en arrivant d'abord, les effets en dernier. */
export function vagues(base, extra = []) {
  const d = (k, noms = DOSSIERS[k]) => noms.map((n) => chemin(base, k, n));
  return [
    [...RACINE.map((n) => chemin(base, "", n)), ...extra],
    [...d("expeditions", ["bandeau", "maitre-route", "camp-vide"]), ...d("reliquaire", ["bandeau", "gardien", "reliquaire", "vestige"])],
    d("comptoir"),
    [...d("kazim"), ...d("expeditions", ["marqueur"])],
  ];
}

const gardees = [];

function charger(url) {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  gardees.push(img);
  return (img.decode ? img.decode() : Promise.resolve()).catch(() => {});
}

/**
 * Lance le préchargement. Une vague attend la précédente, pour ne pas
 * disputer la bande passante à ce que la page en cours demande elle-même.
 * `extra` : d'autres adresses de la première vague (les visuels des sachets).
 */
export async function precharger(base, extra = [], { annule = () => false } = {}) {
  // Données restreintes ou connexion lente : on laisse le navigateur faire à la demande.
  const c = typeof navigator !== "undefined" ? navigator.connection : null;
  if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ""))) return;
  for (const v of vagues(base, extra)) {
    if (annule()) return;
    await Promise.all(v.map(charger));
  }
}
