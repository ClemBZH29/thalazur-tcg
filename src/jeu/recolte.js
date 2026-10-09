import { crediterGain, debiterLibre, valeurRevente } from "../lib/economie.js";
import { compte } from "./marche.js";

/**
 * Le règlement d'une ouverture, relu sur la partie telle qu'elle est au
 * moment d'écrire : `null` si elle n'est pas payable.
 *
 * Le sachet offert passe d'abord, s'il en reste ; sinon c'est le vrai prix
 * qui est dû, même si l'écran annonçait un sachet offert — un autre onglet a
 * pu le consommer entre-temps. Le prix n'est jamais lu comme « 0 parce que
 * l'écran disait offert » : c'était un booster gratuit.
 */
export function reglementOuverture(e, { prix, sachet = null, gratuit = false }) {
  if (gratuit) return { offert: false, cout: 0 };
  if (sachet && ((e.sachets || {})[sachet] || 0) > 0) return { offert: true, cout: 0 };
  if ((e.bourse?.po || 0) < prix) return null;
  return { offert: false, cout: prix };
}

/**
 * Verse un booster ouvert dans la partie : collection, compteur, garantie,
 * bourse, sachet offert, ouverture en cours. Rend la partie inchangée si
 * l'ouverture n'est plus payable — la bourse n'est jamais débitée en
 * dessous de ce qu'elle contient.
 *
 * `botte` : le sachet vient du colporteur. L'affaire compte au moment de
 * l'achat, pas quand on prend la botte : on peut la prendre et repartir.
 */
export function appliquerOuverture(e, { boosterId, booster, prix, sachet = null, gratuit = false,
  reventeAuto = false, botte = false, nouvelles = [] }) {
  const reglement = reglementOuverture(e, { prix, sachet, gratuit });
  if (!reglement) return e;
  const coll = { ...(e.collections[boosterId] || {}) };
  let revente = 0;
  booster.cards.forEach((c) => {
    const { rainbow, slot, ...carte } = c;
    const cle = rainbow ? "rainbow" : "normale";
    const a = coll[c.id];
    const dejaLa = a && a[cle] > 0;
    if (dejaLa && reventeAuto) {
      // Réglage éteint par défaut : le doublon partait à l'échoppe pour
      // deux PO alors qu'il vaut le double au Comptoir.
      revente += valeurRevente(c.tier);
      return;
    }
    coll[c.id] = {
      normale: 0, rainbow: 0, ...(a || {}),
      [cle]: ((a && a[cle]) || 0) + 1,
      carte,
    };
  });
  const leg = booster.cards.some((c) => c.tier === "legendaire");
  const p = e.pity[boosterId] || { depuis: 0, vu: false };
  const sachets = reglement.offert
    ? { ...e.sachets, [sachet]: e.sachets[sachet] - 1 }
    : (e.sachets || {});
  return {
    ...e,
    sachets,
    collections: { ...e.collections, [boosterId]: coll },
    boosters: { ...e.boosters, [boosterId]: (e.boosters[boosterId] || 0) + 1 },
    pity: { ...e.pity, [boosterId]: { depuis: leg ? 0 : p.depuis + 1, vu: p.vu || leg } },
    // `debiterLibre` et non `debiter` : le prix n'est plus une constante
    // depuis que le colporteur vend un sachet sous le manteau.
    bourse: crediterGain(debiterLibre(e.bourse, reglement.cout), revente),
    ...(botte && !gratuit ? { stats: compte(e, "affaires") } : {}),
    enCours: { boosterId, tirage: booster, index: 0, nouvelles: Array.from(nouvelles) },
  };
}
