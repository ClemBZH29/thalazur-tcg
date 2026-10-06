/**
 * La banque des bruitages du Donjon : des recettes de synthèse (Web Audio),
 * aucun fichier. Livrée par Claude Design (table d'écoute du 06/10/2026) et
 * validée à l'oreille : les valeurs ne se retouchent pas ici sans réécoute.
 *
 * Une recette : `prio` (0 tics d'interface, 1 frappes et socle, 2 capacités,
 * objets, rencontres, 3 gains et chutes : jamais coupés), `rev` (envoi de
 * réverbération), `duck` (baisse la musique), `chaud` (pas de variation
 * aléatoire), `rarete` (reçoit la couche de RARETE), et ses `couches`.
 * Le moteur qui les joue est dans moteur.js ; l'API, dans index.js.
 */


export const demi = s => Math.pow(2, s / 12);
export const midi = m => 440 * Math.pow(2, (m - 69) / 12);

// ---------- Fragments de recettes (données) ----------
const pas = (t, g = .4, f = 550) => [
  { k: 'bruit', filtre: 'lowpass', f, f2: f * .4, q: .7, t, d: .13, a: .004, g },
  { k: 'peau', f: 95, f2: 60, t, d: .09, g: g * .5 }
];
const coupBouclier = t => [
  { k: 'peau', f: 190, f2: 130, t, d: .12, g: .55 },
  { k: 'ton', forme: 'sine', f: 430, t, d: .32, g: .09 },
  { k: 'ton', forme: 'sine', f: 647, t, d: .24, g: .05 }
];
const enclume = t => [
  { k: 'ton', forme: 'sine', f: 1046, t, d: .55, g: .08 },
  { k: 'ton', forme: 'sine', f: 1497, t, d: .4, g: .05 },
  { k: 'bruit', filtre: 'bandpass', f: 3000, q: 4, t, d: .04, g: .35 },
  { k: 'peau', f: 240, f2: 160, t, d: .05, g: .3 }
];
const piece = { part: [[1, 1], [1.37, .5], [2.1, .25]] };

// prio : 0 tics d'interface, 1 frappes et socle, 2 capacités / objets / rencontres, 3 gains et chutes
export const BANQUE = {
  // 5.1 Carte
  'donjon.carte.survol': { prio: 0, rev: .15, couches: [
    { k: 'bruit', filtre: 'bandpass', f: 2200, q: 9, t: 0, d: .04, g: .22 },
    { k: 'ton', forme: 'triangle', f: 820, t: 0, d: .035, g: .05 }] },
  'donjon.carte.choisir': { prio: 1, rev: .3, couches: [...pas(0, .45), ...pas(.17, .38, 500)] },
  'donjon.carte.reveler': { prio: 1, rev: .55, couches: [
    { k: 'bruit', filtre: 'bandpass', f: 380, f2: 1300, q: 1.1, t: 0, d: .62, a: .28, g: .32, env: 'tenu' },
    { k: 'bruit', filtre: 'lowpass', f: 220, t: 0, d: .6, a: .2, g: .12, env: 'tenu' }] },
  'donjon.carte.combat': { prio: 2, rev: .45, couches: [
    { k: 'peau', f: 62, f2: 34, t: 0, d: 1, g: 1 },
    { k: 'bruit', filtre: 'lowpass', f: 320, f2: 120, t: 0, d: .35, g: .3 }] },
  'donjon.carte.gardien': { prio: 2, rev: .8, couches: [
    { k: 'ton', forme: 'sawtooth', f: 73.4, f2: 71, t: 0, d: 1.15, a: .3, g: .28, env: 'tenu', pb: 480, vib: [4.5, 8] },
    { k: 'ton', forme: 'sawtooth', f: 110, f2: 107, t: .05, d: 1.05, a: .3, g: .14, env: 'tenu', pb: 420 },
    { k: 'peau', f: 52, f2: 30, t: 1.12, d: .55, g: 1 },
    { k: 'bruit', filtre: 'lowpass', f: 260, t: 1.12, d: .3, g: .3 }] },
  'donjon.carte.etage': { prio: 2, rev: 1, couches: [
    { k: 'ton', forme: 'sine', f: 146.8, f2: 140, t: 0, d: 1.8, a: .04, g: .28 },
    { k: 'ton', forme: 'triangle', f: 73.4, t: 0, d: 1.8, a: .08, g: .14, pb: 400 },
    { k: 'bruit', filtre: 'lowpass', f: 320, f2: 110, t: 0, d: 1.5, a: .15, g: .25 }] },
  'donjon.carte.remonter': { prio: 2, rev: .55, couches: [
    { k: 'corde', forme: 'triangle', f: 146.8, eclat: 9, t: 0, d: .7, g: .3, seq: [[0, 0], [7, .3], [12, .6]] },
    { k: 'bruit', filtre: 'bandpass', f: 500, f2: 1400, q: .9, t: .1, d: .9, a: .4, g: .1, env: 'tenu' }] },
  'donjon.carte.confirmer': { prio: 0, rev: .15, couches: [
    { k: 'bruit', filtre: 'bandpass', f: 1700, q: 6, t: 0, d: .055, g: .5 },
    { k: 'ton', forme: 'triangle', f: 560, t: 0, d: .05, g: .12 }] },

  // 5.2 Rencontres
  'donjon.rencontre.autel': { prio: 2, rev: .65, duck: true, couches: [
    { k: 'ton', forme: 'sine', f: 220, t: 0, d: 2.4, a: .03, g: .2 },
    { k: 'ton', forme: 'sine', f: 221.6, t: 0, d: 2.4, a: .03, g: .14 },
    { k: 'ton', forme: 'sine', f: 597, t: 0, d: 1.6, a: .03, g: .05 },
    { k: 'peau', f: 58, f2: 40, t: .95, d: .35, g: .8 },
    { k: 'peau', f: 52, f2: 38, t: 1.27, d: .4, g: .65 }] },
  'donjon.rencontre.repos': { prio: 2, rev: .4, couches: [
    { k: 'bruit', filtre: 'bandpass', f: 2600, q: 3, t: 0, d: .025, g: .3, rep: [9, .075, 4, .6] },
    { k: 'bruit', filtre: 'lowpass', f: 700, t: 0, d: .7, a: .05, g: .08 },
    { k: 'ton', forme: 'triangle', f: 146.8, t: .25, d: 1.2, a: .25, g: .09, pb: 900, seq: [[0, 0], [3, .04], [7, .08]] }] },
  'donjon.rencontre.recrue': { prio: 2, rev: .4, couches: [
    ...pas(0, .15, 420), ...pas(.24, .25, 480), ...pas(.48, .38, 540),
    { k: 'corde', forme: 'triangle', f: 220, eclat: 8, t: .8, d: .7, g: .28 },
    { k: 'corde', forme: 'triangle', f: 293.7, eclat: 8, t: 1.02, d: .9, g: .28 }] },
  'donjon.rencontre.rival': { prio: 2, rev: .5, couches: [
    { k: 'ton', forme: 'sawtooth', f: 146.8, t: 0, d: 1.7, a: .45, g: .09, env: 'tenu', pb: 850, vib: [5, 6] },
    { k: 'ton', forme: 'sawtooth', f: 155.6, t: .08, d: 1.62, a: .45, g: .08, env: 'tenu', pb: 850, vib: [5.6, 6] },
    { k: 'ton', forme: 'sawtooth', f: 207.7, t: .3, d: 1.4, a: .4, g: .06, env: 'tenu', pb: 900 }] },
  'donjon.rencontre.autre': { prio: 2, rev: .35, couches: [
    { k: 'bruit', filtre: 'bandpass', f: 2800, f2: 1500, q: .8, t: 0, d: .32, a: .04, g: .25 },
    { k: 'ton', forme: 'triangle', f: 196, t: .15, d: 1.1, a: .2, g: .1, env: 'tenu', pb: 700 }] },

  // 5.3 Combat : le socle
  'donjon.combat.debut': { prio: 1, rev: .35, couches: [
    { k: 'bruit', filtre: 'bandpass', f: 2200, f2: 4200, q: 3, t: 0, d: .32, a: .1, g: .2 },
    { k: 'bruit', filtre: 'bandpass', f: 2600, f2: 4600, q: 3, t: .08, d: .3, a: .1, g: .16 },
    { k: 'ton', forme: 'sine', f: 1180, t: .3, d: .25, g: .03 },
    { k: 'ton', forme: 'sine', f: 1240, t: .36, d: .2, g: .025 }] },
  'donjon.combat.tour': { prio: 0, rev: .1, couches: [
    { k: 'bruit', filtre: 'bandpass', f: 1100, q: 10, t: 0, d: .025, g: .14 }] },
  'donjon.combat.cibler': { prio: 0, rev: .15, couches: [
    { k: 'bruit', filtre: 'bandpass', f: 3100, q: 12, t: 0, d: .03, g: .32 },
    { k: 'ton', forme: 'sine', f: 2200, t: 0, d: .05, g: .04 }] },
  'donjon.combat.frappe': { prio: 1, rev: .25, couches: [
    { k: 'bruit', filtre: 'bandpass', f: 600, f2: 1600, q: 1.5, t: 0, d: .14, a: .08, g: .28 },
    { k: 'peau', f: 150, f2: 72, t: .12, d: .16, g: .7 },
    { k: 'bruit', filtre: 'lowpass', f: 1600, t: .12, d: .06, g: .45 }] },
  'donjon.combat.encaisser': { prio: 1, rev: .2, couches: [
    { k: 'peau', f: 92, f2: 50, t: 0, d: .22, g: .85 },
    { k: 'bruit', filtre: 'lowpass', f: 650, t: 0, d: .09, g: .5 }] },
  'donjon.combat.armure': { prio: 1, rev: .25, couches: [
    { k: 'bruit', filtre: 'bandpass', f: 3800, q: 5, t: 0, d: .03, g: .3 },
    { k: 'ton', forme: 'sine', f: 1240, t: 0, d: .22, g: .1 },
    { k: 'ton', forme: 'sine', f: 1710, t: 0, d: .16, g: .06 }] },
  'donjon.combat.chute.adverse': { prio: 3, rev: .5, couches: [
    { k: 'peau', f: 72, f2: 36, t: 0, d: .42, g: .9 },
    { k: 'bruit', filtre: 'lowpass', f: 420, t: 0, d: .25, g: .4 },
    { k: 'bruit', filtre: 'bandpass', f: 1200, f2: 240, q: 1, t: .22, d: .95, a: .2, g: .22 }] },
  'donjon.combat.chute.allie': { prio: 3, rev: .4, couches: [
    { k: 'peau', f: 82, f2: 40, t: 0, d: .38, g: .85 },
    { k: 'bruit', filtre: 'lowpass', f: 500, t: 0, d: .2, g: .35 },
    { k: 'ton', forme: 'triangle', f: 196, f2: 131, t: .15, d: .75, a: .05, g: .15, pb: 600 }] },
  'donjon.combat.fuite': { prio: 1, rev: .3, couches: [0, 1, 2, 3, 4, 5].flatMap(i => pas(i * .11, .45 - i * .065, 600 - i * 60)) },
  'donjon.combat.brume': { prio: 1, special: 'brume', couches: [] },
  'donjon.combat.victoire': { prio: 2, rev: .5, couches: [
    { k: 'corde', forme: 'triangle', f: 146.8, eclat: 7, t: 0, d: 1.3, g: .26, seq: [[0, 0], [7, .035], [12, .07], [15, .105]] },
    { k: 'ton', forme: 'sine', f: 73.4, t: 0, d: 1.3, g: .15 }] },
  'donjon.combat.gardien.vaincu': { prio: 3, rev: .75, duck: true, chaud: true, couches: [
    { k: 'peau', f: 52, f2: 24, t: 0, d: 1, g: 1 },
    { k: 'bruit', filtre: 'lowpass', f: 320, f2: 90, t: 0, d: .7, g: .55 },
    { k: 'ton', forme: 'triangle', f: 146.8, t: 1.25, d: 2.3, a: .12, g: .13, pb: 2200, seq: [[0, 0], [4, .06], [7, .12], [12, .18]] },
    { k: 'cloche', f: 587.3, t: 1.3, d: 2.6, g: .08 },
    { k: 'ton', forme: 'sine', f: 73.4, t: 1.25, d: 2.3, a: .2, g: .18 }] },
  'donjon.combat.defaite': { prio: 3, rev: .5, couches: [
    { k: 'ton', forme: 'sawtooth', f: 73.4, f2: 66, t: 0, d: 2.1, a: .1, g: .22, pb: 420, pb2: 110 },
    { k: 'ton', forme: 'sine', f: 36.7, f2: 33, t: 0, d: 2.1, a: .1, g: .3 }] },

  // 5.4 Capacités
  'donjon.capacite.frappeur': { prio: 2, rev: .35, couches: [
    { k: 'bruit', filtre: 'bandpass', f: 280, f2: 900, q: 1, t: 0, d: .26, a: .16, g: .45 },
    { k: 'peau', f: 105, f2: 44, t: .22, d: .32, g: 1 },
    { k: 'bruit', filtre: 'lowpass', f: 900, t: .22, d: .08, g: .5 },
    { k: 'ton', forme: 'sine', f: 55, t: .22, d: .95, a: .01, g: .45 }] },
  'donjon.capacite.tireur': { prio: 2, rev: .55, couches: [
    { k: 'corde', forme: 'sawtooth', f: 174.6, eclat: 14, t: 0, d: .28, g: .22 },
    { k: 'bruit', filtre: 'bandpass', f: 1900, f2: 1100, q: 6, t: .04, d: .36, a: .08, g: .13 },
    { k: 'peau', f: 210, f2: 120, t: .42, d: .07, g: .32 },
    { k: 'bruit', filtre: 'lowpass', f: 1800, t: .42, d: .04, g: .25 }] },
  'donjon.capacite.garde': { prio: 2, rev: .4, couches: [
    ...coupBouclier(0), ...coupBouclier(.19),
    { k: 'ton', forme: 'triangle', f: 330, t: .42, d: .5, a: .04, g: .07, pb: 1500, vib: [5, 10] }] },
  'donjon.capacite.soigneur': { prio: 2, rev: .6, couches: [
    { k: 'ton', forme: 'sine', f: 293.7, t: 0, d: .55, a: .02, g: .14, seq: [[0, 0], [3, .12], [7, .24]] },
    { k: 'ton', forme: 'triangle', f: 587.3, t: .36, d: .7, a: .08, g: .03, vib: [6, 12] },
    { k: 'bruit', filtre: 'bandpass', f: 3200, q: 4, t: .3, d: .5, a: .15, g: .025 }] },
  'donjon.capacite.mage': { prio: 2, rev: .55, duck: true, couches: [
    { k: 'bruit', filtre: 'bandpass', f: 300, f2: 2400, q: 4, t: 0, d: .62, a: .4, g: .28, env: 'tenu' },
    { k: 'ton', forme: 'sawtooth', f: 146.8, t: .05, d: .52, a: .3, g: .05, env: 'tenu', pb: 1100, seq: [[0, 0], [6, 0], [11, 0]] },
    { k: 'peau', f: 92, f2: 44, t: .56, d: .42, g: .85 },
    { k: 'ton', forme: 'triangle', f: 146.8, t: .56, d: .8, g: .1, pb: 1000, seq: [[0, 0], [7, 0]] }] },
  'donjon.capacite.meneur': { prio: 2, rev: .5, couches: [
    { k: 'ton', forme: 'sawtooth', f: 146.8, t: 0, d: .26, a: .04, g: .13, env: 'tenu', pb: 900, vib: [5, 6] },
    { k: 'ton', forme: 'sawtooth', f: 220, t: .22, d: .5, a: .04, g: .13, env: 'tenu', pb: 950, vib: [5, 6] }] },
  'donjon.capacite.debrouillard': { prio: 2, rev: .25, couches: [
    { k: 'corde', forme: 'sawtooth', f: 349.2, eclat: 9, t: 0, d: .12, g: .17, seq: [[0, 0], [-2, .055], [-5, .11]] },
    { k: 'bruit', filtre: 'bandpass', f: 1400, f2: 2200, q: 2, t: .05, d: .13, a: .05, g: .17 },
    { k: 'peau', f: 170, f2: 95, t: .2, d: .07, g: .42 }] },
  'donjon.capacite.artificier': { prio: 2, rev: .4, couches: [
    ...enclume(0), ...enclume(.24),
    { k: 'bruit', filtre: 'highpass', f: 2200, t: .52, d: .02, g: .35 },
    { k: 'ton', forme: 'sine', f: 1760, t: .52, d: .07, g: .04 }] },
  'donjon.capacite.intendant': { prio: 2, rev: .45, couches: [
    { k: 'ton', forme: 'sine', f: 1580, t: 0, d: .35, g: .05 },
    { k: 'ton', forme: 'sine', f: 2240, t: 0, d: .25, g: .03 },
    { k: 'ton', forme: 'sine', f: 1690, t: .09, d: .35, g: .05 },
    { k: 'ton', forme: 'sine', f: 2390, t: .09, d: .25, g: .03 },
    { k: 'bruit', filtre: 'bandpass', f: 3400, q: 5, t: 0, d: .02, g: .2, rep: [2, .09] },
    { k: 'ton', forme: 'triangle', f: 146.8, t: .3, d: 1, a: .2, g: .07, pb: 900, seq: [[0, 0], [3, .03], [7, .06]] }] },
  'donjon.capacite.prete': { prio: 0, rev: .3, couches: [
    { k: 'ton', forme: 'sine', f: 1318, t: 0, d: .3, g: .045 },
    { k: 'ton', forme: 'sine', f: 1976, t: 0, d: .2, g: .02 }] },

  // 5.5 Artéfacts
  'donjon.artefact.eveil': { prio: 2, rev: .6, duck: true, rarete: true, couches: [
    { k: 'ton', forme: 'sine', f: 1046.5, t: 0, d: .55, a: .09, g: .07 },
    { k: 'ton', forme: 'sine', f: 1570, t: .02, d: .4, a: .09, g: .035 },
    { k: 'bruit', filtre: 'bandpass', f: 3000, q: 2.5, t: 0, d: .45, a: .18, g: .035 }] },
  'donjon.artefact.offensif': { prio: 2, rev: .45, couches: [
    { k: 'ton', forme: 'sine', f: 1760, t: 0, d: .16, g: .06, seq: [[0, 0], [-5, .04], [-7, .08]] },
    { k: 'bruit', filtre: 'highpass', f: 2400, t: 0, d: .22, a: .003, g: .16 },
    { k: 'bruit', filtre: 'bandpass', f: 1100, f2: 380, q: 1.2, t: .12, d: .3, a: .06, g: .15 },
    { k: 'peau', f: 130, f2: 70, t: .4, d: .12, g: .4 }] },
  'donjon.artefact.protecteur': { prio: 2, rev: .5, couches: [
    { k: 'ton', forme: 'sine', f: 98, t: 0, d: 1.25, a: .3, g: .24, env: 'tenu' },
    { k: 'ton', forme: 'triangle', f: 146.8, t: 0, d: 1.25, a: .35, g: .1, env: 'tenu', pb: 500 },
    { k: 'bruit', filtre: 'lowpass', f: 260, t: 0, d: 1.2, a: .35, g: .1, env: 'tenu' }] },
  'donjon.artefact.soin': { prio: 2, rev: .9, couches: [
    { k: 'ton', forme: 'sine', f: 587.3, t: 0, d: .75, a: .04, g: .06, seq: [[0, 0], [3, .1], [7, .2], [12, .3]] },
    { k: 'bruit', filtre: 'bandpass', f: 2400, f2: 3400, q: 3, t: .1, d: .7, a: .3, g: .02, env: 'tenu' }] },
  'donjon.artefact.utilitaire': { prio: 2, rev: .25, couches: [
    { k: 'bruit', filtre: 'bandpass', f: 2700, q: 12, t: 0, d: .022, g: .3, rep: [6, .07, 1] },
    { k: 'ton', forme: 'sine', f: 1900, t: 0, d: .025, g: .03, rep: [6, .07] },
    { k: 'bruit', filtre: 'bandpass', f: 1300, q: 4, t: .45, d: .09, g: .3 },
    { k: 'peau', f: 300, f2: 220, t: .45, d: .05, g: .2 }] },

  // 5.6 Lieux
  'donjon.lieu.pose': { prio: 2, rev: 1, duck: true, rarete: true, couches: [
    { k: 'ton', forme: 'sine', f: 82.4, t: 0, d: 1.5, a: .01, g: .38 },
    { k: 'ton', forme: 'sine', f: 122, t: 0, d: 1.1, a: .01, g: .14 },
    { k: 'ton', forme: 'sine', f: 173, t: 0, d: .7, a: .01, g: .07 },
    { k: 'bruit', filtre: 'lowpass', f: 280, t: 0, d: .12, g: .35 }] },
  'donjon.lieu.desert': { prio: 1, nappe: 'desert', couches: [] },
  'donjon.lieu.cote': { prio: 1, nappe: 'cote', couches: [] },
  'donjon.lieu.foret': { prio: 1, nappe: 'foret', couches: [] },
  'donjon.lieu.souterrain': { prio: 1, nappe: 'souterrain', couches: [] },
  'donjon.lieu.cite': { prio: 1, nappe: 'cite', couches: [] },
  'donjon.lieu.neutre': { prio: 1, nappe: 'neutre', couches: [] },

  // 5.7 Fin de descente et progression
  'donjon.butin.pieces': { prio: 2, rev: .35, couches: [
    { k: 'cloche', ...piece, f: 2000, t: 0, d: .14, g: .05, rep: [4, .06, 3, .5] },
    { k: 'bruit', filtre: 'bandpass', f: 4000, q: 3, t: 0, d: .02, g: .1, rep: [4, .06, 0, .5] }] },
  'donjon.butin.po': { prio: 3, rev: .45, chaud: true, couches: [
    { k: 'cloche', ...piece, f: 2100, t: 0, d: .1, g: .04, rep: [10, .045, 2, .2] },
    { k: 'bruit', filtre: 'lowpass', f: 500, t: .55, d: .12, g: .35 },
    { k: 'peau', f: 160, f2: 100, t: .55, d: .1, g: .35 },
    { k: 'cloche', f: 1318.5, t: .6, d: .9, g: .05 },
    { k: 'ton', forme: 'triangle', f: 659.3, t: .6, d: .8, a: .02, g: .05 }] },
  'donjon.xp.compteur': { prio: 1, rev: .2, couches: [
    { k: 'ton', forme: 'triangle', f: 660, t: 0, d: .04, g: .08, seq: [[0, 0], [1, .2], [2, .37], [3, .51], [4, .62], [5, .71], [6, .78], [7, .84]] },
    { k: 'bruit', filtre: 'bandpass', f: 2000, q: 8, t: 0, d: .02, g: .1, seq: [[0, 0], [1, .2], [2, .37], [3, .51], [4, .62], [5, .71], [6, .78], [7, .84]] }] },
  'donjon.xp.niveau': { prio: 3, rev: .55, chaud: true, duck: true, couches: [
    { k: 'ton', forme: 'triangle', f: 293.7, t: 0, d: .75, a: .02, g: .11, pb: 2600, seq: [[0, 0], [4, .07], [7, .14], [12, .21]] },
    { k: 'cloche', f: 1174.7, t: .21, d: .8, g: .04 },
    { k: 'ton', forme: 'sine', f: 146.8, t: 0, d: .75, a: .05, g: .12 }] },
  'donjon.xp.rainbow': { prio: 3, rev: .85, chaud: true, duck: true, couches: [
    { k: 'cloche', f: 587.3, t: 0, d: 1.6, g: .05, seq: [[0, 0], [4, .13], [7, .26], [12, .39], [16, .55]] },
    { k: 'corde', forme: 'triangle', f: 146.8, eclat: 10, t: 0, d: 1.2, g: .16, seq: [[0, 0], [7, .09], [12, .18], [16, .27], [19, .36], [24, .45]] },
    { k: 'ton', forme: 'sine', f: 293.7, t: .3, d: 1.6, a: .5, g: .06, env: 'tenu', vib: [3, 14], seq: [[0, 0], [4, 0], [7, 0]] },
    { k: 'ton', forme: 'sine', f: 73.4, t: 0, d: 1.8, a: .1, g: .14 }] },

  // 5.8 Interface
  'donjon.ui.pilote': { prio: 0, rev: .2, couches: [
    { k: 'bruit', filtre: 'bandpass', f: 800, q: 3, t: 0, d: .05, g: .4 },
    { k: 'peau', f: 260, f2: 180, t: 0, d: .05, g: .25 },
    { k: 'bruit', filtre: 'bandpass', f: 1100, q: 3, t: .09, d: .04, g: .3 }] },
  'donjon.ui.vitesse': { prio: 0, rev: .15, couches: [
    { k: 'bruit', filtre: 'bandpass', f: 1900, q: 8, t: 0, d: .025, g: .32, rep: [1, .06] },
    { k: 'ton', forme: 'triangle', f: 700, t: 0, d: .02, g: .05, rep: [1, .06] }] },
  'donjon.ui.dialogue': { prio: 0, rev: .15, couches: [
    { k: 'bruit', filtre: 'bandpass', f: 2400, f2: 1700, q: .7, t: 0, d: .18, a: .03, g: .11 }] }
};

// Couche de rareté ajoutée à l'éveil des artéfacts et à la pose des lieux
export const RARETE = {
  commune: [],
  rare: [{ k: 'ton', forme: 'sine', f: 2093, t: .05, d: .55, a: .1, g: .035 }],
  legendaire: [
    { k: 'ton', forme: 'sine', f: 2093, t: .05, d: .55, a: .1, g: .035 },
    { k: 'ton', forme: 'triangle', f: 784, t: .1, d: 1.5, a: .25, g: .06, env: 'tenu', pb: 2400 }],
  rainbow: [{ k: 'ton', forme: 'sine', f: 1574, t: .1, d: 1.4, a: .3, g: .025, env: 'tenu', vib: [3, 25] }]
};

export const FORCES = {
  legere: { tr: 3, gainX: .6, dureeX: .85 },
  moyenne: {},
  lourde: { tr: -4, gainX: 1.2, dureeX: 1.2, plus: [{ k: 'ton', forme: 'sine', f: 60, t: .12, d: .5, g: .35 }] }
};

// Nappes de lieu : bruits filtrés modulés lentement (lfo : fréquence ; lfoG : amplitude)
export const NAPPES = {
  desert: { bruits: [{ filtre: 'bandpass', f: 650, q: .7, g: .14, lfo: [.09, 350] }, { filtre: 'bandpass', f: 4200, q: 1.2, g: .025, lfoG: [.23, .02] }] },
  cote: { bruits: [{ filtre: 'lowpass', f: 480, q: .5, g: .16, lfoG: [.11, .14] }, { filtre: 'bandpass', f: 1800, q: .6, g: .02, lfoG: [.11, .018] }] },
  foret: { bruits: [{ filtre: 'bandpass', f: 1900, q: .5, g: .035, lfoG: [.31, .025] }, { filtre: 'lowpass', f: 300, g: .05 }], gouttes: { f: 1500, int: [.4, 1.6], g: .035 } },
  souterrain: { bruits: [{ filtre: 'lowpass', f: 160, g: .07 }], gouttes: { f: 1000, int: [.7, 2.2], g: .06 } },
  cite: { bruits: [{ filtre: 'bandpass', f: 420, q: .6, g: .07, lfoG: [.17, .03] }], cloche: { f: 392, int: [6, 10], g: .035 } },
  neutre: { bruits: [{ filtre: 'bandpass', f: 340, q: .6, g: .1, lfo: [.07, 140], lfoG: [.13, .05] }] }
};
