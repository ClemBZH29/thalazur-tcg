/**
 * La scène du Reliquaire : mise en page et chronologie de la forge.
 *
 * Fonctions pures, reprises du prototype de Claude Design (06/10/2026,
 * « Reliquaire · note de refonte ») : la carte repose sur l'autel du décor,
 * le gardien se tient à sa gauche, le panneau de décision à droite (au
 * téléphone, dessous). Toutes les positions découlent de la taille de la
 * scène, pour que l'écran tienne sans défilement.
 *
 * La chronologie dit, pour chaque geste, quand commence et combien dure
 * chaque étape ; `src/reliquaire/forge.js` en tire l'image à l'instant t.
 * Une même fonction du temps sert à la lecture, au saut vers la fin et au
 * mouvement réduit (t = fin).
 */
import { TIER_INFO } from "../config/tiers.js";

export const clamp = (a, v, b) => Math.min(b, Math.max(a, v));
/** Demi-sinus : 0 aux bords, 1 au milieu. */
export const bosse = (p) => (p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p));

/** Une courbe de Bézier cubique, comme `cubic-bezier()` en CSS. */
export function bezier(x1, y1, x2, y2) {
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const cx = 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t - x;
      const d = 3 * x1 * (1 - t) * (1 - t) + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
      if (Math.abs(d) < 1e-6) break;
      t = clamp(0, t - cx / d, 1);
    }
    return 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t;
  };
}
// Les courbes de la charte (§ 5) : retournement, entrée, ressort ; plus une
// courbe symétrique pour la course des étincelles.
export const E_FLIP = bezier(0.34, 0.85, 0.36, 1);
export const E_IN = bezier(0.2, 0.8, 0.3, 1);
export const E_RESSORT = bezier(0.2, 1.3, 0.4, 1);
export const E_IO = bezier(0.45, 0, 0.55, 1);

/**
 * Ce que la scène ajoute aux paliers de `tiers.js` : l'encre lisible en
 * texte (4,5:1, voir src/comptoir/teintes.js) et l'opacité maximale de la
 * lueur sous la carte.
 */
const SCENE = {
  commun: { encre: "#8fb8d8", gmax: 0.55 },
  peucommun: { encre: "#78c2b0", gmax: 0.7 },
  rare: { encre: "#d19a3c", gmax: 0.85 },
  legendaire: { encre: "#e8899a", gmax: 1 },
};
export const RAINBOW = "#9d7cf0";
/** Les couleurs des particules d'une rainbow. */
export const ARC = ["#9d7cf0", "#e8899a", "#8fb8d8", "#78c2b0", "#d19a3c"];

/** Le palier vu par la scène : tempo de tiers.js, encre et lueur. */
export function palier(tier, rainbow = false) {
  const t = TIER_INFO[tier] || TIER_INFO.commun;
  const s = SCENE[tier] || SCENE.commun;
  return {
    nom: t.nom, tele: t.tele, flip: t.flip, motes: t.motes, ombre: t.ombre,
    lueur: rainbow ? RAINBOW : t.lueur, encre: s.encre, gmax: s.gmax,
    grand: tier === "legendaire" || rainbow,
  };
}

/* ── Mise en page ─────────────────────────────────────────────────────── */

/** Le décor (bandeau.webp, 1 536 × 1 024) : le point d'appui de l'autel. */
const DECOR = { w: 1536, h: 1024, x: 850, y: 745, coffret: 245, droite: 686, sous: 279 };

/** Le seuil du téléphone : celui de la charte (§ 4, « Téléphone »). */
export const TELEPHONE = 720;

/**
 * Les positions de la scène, en pixels, pour une scène de W × H.
 *
 * Bureau : carte centrée à 44 % de la largeur, hauteur bornée par la scène ;
 * le gardien à 64 % de la hauteur, posé au bas du cadre à gauche ; le
 * panneau de 380 px au plus, au moins 64 px à droite de la carte.
 * Téléphone : carte au centre, gardien coupé par le plateau de l'autel, à
 * moitié derrière la carte ; le panneau occupe le bas.
 *
 * Le décor est posé à l'échelle (jamais `cover`) : la plus petite qui couvre
 * la scène en gardant le coffret du décor masqué par la carte.
 */
export function disposer(W, H) {
  const mob = W <= TELEPHONE;
  let L;
  if (!mob) {
    const cw = Math.round(clamp(200, H * 0.39, 306)), ch = Math.round(cw * 1.5);
    const X0 = Math.round(W * 0.44), cy = Math.round((H - ch) / 2 - 4), Yb = cy + ch;
    const s = Math.max((0.75 * cw) / DECOR.coffret, (W - X0) / DECOR.droite, Yb / DECOR.y, (H - Yb) / DECOR.sous);
    const gs = Math.round(H * 0.64);
    const px = Math.round(Math.max(X0 + cw / 2 + 64, W - 420)), pw = Math.min(380, W - px - 32);
    L = {
      mob, cw, ch, X0, cy, Yb, s, gs, gx: Math.round(X0 - cw / 2 - gs - 4), gy: H - gs, px, pw,
      voile: `radial-gradient(ellipse ${Math.round(W * 0.46)}px ${Math.round(H * 0.62)}px at ${X0}px ${Math.round(cy + ch * 0.5)}px, transparent 30%, rgba(13,20,23,.8) 100%)`,
      voile2: `linear-gradient(to right, transparent ${px - 300}px, rgba(13,20,23,.9) ${px - 90}px, #0d1417 ${px + 30}px)`,
      reglesW: Math.max(pw + 16, 380), reglesH: Math.round(H * 0.5 + 120),
    };
  } else {
    const cw = Math.round(Math.min(clamp(228, W * 0.72, 306) * 0.92, (H - 330) / 1.5)), ch = Math.round(cw * 1.5);
    const X0 = Math.round(W / 2), cy = Math.max(20, Math.round((H - 300 - ch) / 2 - 18)), Yb = cy + ch;
    const s = Math.max((0.75 * cw) / DECOR.coffret, X0 / DECOR.x, (W - X0) / DECOR.droite, Yb / DECOR.y);
    const gs = Math.round(cw * 1.08);
    L = {
      mob, cw, ch, X0, cy, Yb, s, gs, gx: Math.round(X0 - cw / 2 - gs * 0.62), gy: Yb + 6 - gs, px: 16, pw: W - 32,
      voile: `radial-gradient(ellipse ${Math.round(W * 0.8)}px ${Math.round(ch * 0.9)}px at ${X0}px ${Math.round(cy + ch * 0.5)}px, transparent 40%, rgba(13,20,23,.7) 100%)`,
      voile2: `linear-gradient(to bottom, rgba(13,20,23,.45) 0, transparent 70px, transparent ${Yb + 14}px, #0d1417 ${Yb + 110}px)`,
      reglesW: W - 32, reglesH: H - 120,
    };
  }
  L.W = W; L.H = H;
  L.bgW = Math.round(DECOR.w * L.s); L.bgH = Math.round(DECOR.h * L.s);
  L.bgX = Math.round(L.X0 - DECOR.x * L.s); L.bgY = Math.round(L.Yb - DECOR.y * L.s);
  L.cx = Math.round(L.X0 - L.cw / 2);
  L.ccx = L.X0; L.ccy = Math.round(L.cy + L.ch / 2);
  L.ombreX = L.cx - 20; L.ombreY = L.Yb - 10; L.ombreW = L.cw + 40;
  L.glD = Math.round(L.cw * 2.4); L.glX = Math.round(L.X0 - L.glD / 2); L.glY = Math.round(L.cy + L.ch * 0.7 - L.glD / 2);
  L.drW = Math.round(L.cw * 1.15); L.drH = Math.round(L.ch * 0.95);
  return L;
}

/* ── Chronologie ──────────────────────────────────────────────────────── */

/**
 * Les étapes d'un geste, en ms depuis le second toucher : `[début, durée]`.
 *
 * - « aveugle » : paiement (0–400), éveil (lueur du palier), retournement,
 *   fissure du cadre puis éclat, compte du prix réel, écart ;
 * - « reveler » : éveil et retournement seulement ;
 * - « forger » (carte déjà retournée) : paiement, fissure, éclat.
 */
export function chronologie(geste, P, cout) {
  const dF = P.grand ? 700 : 520;
  let tl;
  if (geste === "aveugle") {
    const f0 = 400 + P.tele + P.flip, flash = f0 + dF * 0.85;
    tl = { cout, paie: true, glow: [400, P.tele], flip: [400 + P.tele, P.flip], forge: [f0, dF], flash,
      compte: [f0 + 150, 550], ecart: [f0 + 700, 450] };
    tl.fin = Math.max(tl.ecart[0] + 450, flash + (P.grand ? 1050 : 420));
  } else if (geste === "reveler") {
    tl = { glow: [0, P.tele], flip: [P.tele, P.flip] };
    tl.fin = P.tele + P.flip + 500;
  } else {
    const flash = 400 + dF * 0.85;
    tl = { cout, paie: true, forge: [400, dF], flash };
    tl.fin = flash + (P.grand ? 1050 : 500);
  }
  return tl;
}

/** Les instants où l'écran change d'état pendant un geste : [ms, champ]. */
export function evenements(geste, tl) {
  if (geste === "aveugle") return [[tl.flip[0] + tl.flip[1] * 0.2, "contenuRevele"], [tl.ecart[0], "forgeeLigne"]];
  if (geste === "reveler") return [[tl.flip[0] + tl.flip[1] * 0.2, "contenuRevele"]];
  return [[tl.flash, "forgeeLigne"]];
}

/** Générateur pseudo-aléatoire (mulberry32) : les particules sont les mêmes d'une fois sur l'autre. */
export function alea(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
