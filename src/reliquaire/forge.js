/**
 * La forge, image par image.
 *
 * Reprise du prototype de Claude Design : chaque élément animé (carte, lueur,
 * voile, éclats de vestige, particules, braises, anneaux, étincelles du
 * cadre, compteur, verdict) a sa position calculée en fonction du temps.
 * `image(geste, t)` pose l'instant t ; la lecture appelle cette fonction à
 * chaque `requestAnimationFrame`, le saut vers la fin et le mouvement réduit
 * l'appellent une fois avec t = fin.
 *
 * On écrit directement dans le DOM (refs) plutôt que par l'état React : soixante
 * rendus par seconde de toute la page pour déplacer des points n'apporteraient
 * rien. Seuls `transform`, `opacity` et `filter` sont animés. Les particules
 * sont créées une fois et réutilisées : au plus 10 éclats, 28 particules,
 * 26 braises, 2 anneaux et 14 étincelles.
 */
import { ARC, E_FLIP, E_IN, E_IO, E_RESSORT, alea, bosse, clamp } from "./scene.js";

export const VERT = "#78c2b0"; // --vert-encre du Comptoir
const EMBER = "#e5774b", INK = "#ece3d2";

/** « 1 000 » : espace fine insécable, la même partout (toLocaleString varie d'un moteur à l'autre). */
export const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");

export class Forge {
  constructor(vestigeSrc) {
    this.src = vestigeSrc;
    this.R = {};
    this.pool = null;
    this.tl = null;
  }

  /** Les particules, créées une fois dans le calque d'effets. */
  monter(el) {
    if (!el || (this.pool && this.pool.el === el)) return;
    el.textContent = "";
    const mk = (css) => {
      const d = document.createElement("div");
      d.style.cssText = "position:absolute;left:0;top:0;opacity:0;will-change:transform,opacity;" + css;
      el.appendChild(d);
      return d;
    };
    const eclats = Array.from({ length: 10 }, () => {
      const i = document.createElement("img");
      i.src = this.src; i.alt = ""; i.draggable = false;
      i.style.cssText = "position:absolute;left:-10px;top:-10px;width:20px;height:20px;opacity:0;will-change:transform,opacity;filter:drop-shadow(0 0 6px rgba(229,119,75,.8))";
      el.appendChild(i);
      return i;
    });
    this.pool = {
      el, eclats,
      motes: Array.from({ length: 28 }, () => mk("width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%")),
      braises: Array.from({ length: 26 }, () => mk("width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%")),
      anneaux: [0, 1].map(() => mk("border-radius:50%")),
      etincelles: Array.from({ length: 14 }, () => mk("width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;background:#fff")),
    };
  }

  /**
   * Prépare un geste : la chronologie, les trajectoires (tirées d'une graine
   * fixe par palier) et les couleurs des particules.
   */
  preparer(tl, { P, L, rainbow, tier }) {
    this.tl = tl;
    this.P = P;
    const rect = { x: L.cx, y: L.cy, w: L.cw, h: L.ch };
    // Les éclats partent de l'icône de la réserve, où qu'elle soit.
    let A = { x: L.px + 30, y: L.H / 2 };
    const sc = this.R.scene, ic = this.R.resIcon;
    if (sc && ic) {
      const sr = sc.getBoundingClientRect(), ir = ic.getBoundingClientRect();
      A = { x: ir.left + ir.width / 2 - sr.left, y: ir.top + ir.height / 2 - sr.top };
    }
    const B = { x: L.ccx, y: L.ccy };
    const r = alea({ commun: 11, peucommun: 23, rare: 37, legendaire: 51 }[tier] + (rainbow ? 7 : 0));
    const bord = () => {
      const u = r(), cote = Math.floor(r() * 4);
      if (cote === 0) return { x: rect.x + u * rect.w, y: rect.y, nx: 0, ny: -1 };
      if (cote === 1) return { x: rect.x + rect.w, y: rect.y + u * rect.h, nx: 1, ny: 0 };
      if (cote === 2) return { x: rect.x + u * rect.w, y: rect.y + rect.h * 0.85, nx: 0, ny: -1 };
      return { x: rect.x, y: rect.y + u * rect.h, nx: -1, ny: 0 };
    };
    const col = (i) => (rainbow ? ARC[i % ARC.length] : i % 3 === 0 ? P.encre : P.lueur);
    this.geo = { A, B, rect };
    this.parts = {
      eclats: Array.from({ length: 10 }, () => ({ bx: B.x + (r() - 0.5) * rect.w * 0.5, by: B.y + (r() - 0.5) * rect.h * 0.4, lift: 90 + r() * 70 })),
      motes: Array.from({ length: P.motes }, (_, i) => {
        const p = bord(), d = 40 + r() * 110;
        return { x0: p.x, y0: p.y, dx: (p.nx + (r() - 0.5) * 0.6) * d, dy: (p.ny + (r() - 0.5) * 0.6) * d - 30,
          vie: 900 + r() * 450, delai: r() * 220, s: 0.5 + r() * 0.5, col: col(i) };
      }),
      braises: P.grand ? Array.from({ length: 26 }, (_, i) => {
        const p = bord(), v = 0.14 + r() * 0.26;
        return { x0: p.x, y0: p.y, vx: (p.nx + (r() - 0.5)) * v, vy: (p.ny - 0.6 - r() * 0.4) * v,
          vie: 1000 + r() * 500, delai: r() * 120, s: 0.6 + r() * 0.7,
          col: rainbow ? ARC[i % ARC.length] : i % 2 ? P.encre : "#f0b9c3" };
      }) : [],
    };
    const Q = this.pool;
    if (!Q) return;
    Q.motes.forEach((d, i) => { const m = this.parts.motes[i]; if (m) { d.style.background = m.col; d.style.boxShadow = `0 0 8px 1px ${m.col}`; } d.style.opacity = 0; });
    Q.braises.forEach((d, i) => { const m = this.parts.braises[i]; if (m) { d.style.background = m.col; d.style.boxShadow = `0 0 6px 1px ${m.col}`; } d.style.opacity = 0; });
    const D = Math.round(L.ch * 0.95);
    Q.anneaux.forEach((d, j) => {
      const c = rainbow ? ARC[j] : j ? P.encre : P.lueur;
      Object.assign(d.style, { width: D + "px", height: D + "px", marginLeft: -D / 2 + "px", marginTop: -D / 2 + "px",
        border: `2px solid ${c}`, boxShadow: `0 0 26px ${c}, inset 0 0 20px ${c}`, opacity: 0 });
    });
    Q.etincelles.forEach((d) => { d.style.boxShadow = `0 0 10px 3px ${P.lueur}, 0 0 24px 7px ${P.lueur}`; d.style.opacity = 0; });
  }

  /**
   * L'image à l'instant t d'un geste, ou au repos (`geste` nul).
   * `ctx` : { P, face, lueurRepos, sombreRepos, v0, vestiges, verdict }.
   */
  image(geste, t, ctx) {
    const R = this.R, P = ctx.P, tl = geste ? this.tl : {};
    const pr = (s, d) => clamp(0, (t - s) / d, 1);

    // La carte : rotation, bascule de face à 90°, montée en demi-sinus.
    if (R.flip) {
      const r = !geste ? (ctx.face ? 0 : 180) : tl.flip ? 180 * (1 - E_FLIP(pr(tl.flip[0], tl.flip[1]))) : 0;
      R.flip.style.transform = `rotateY(${r.toFixed(2)}deg)`;
      const vue = r <= 90;
      const dos = R.flip.querySelector(":scope > .dos"), face = R.flip.querySelector(":scope > .plaque");
      if (dos) dos.style.opacity = vue ? 0 : 1;
      if (face) face.style.opacity = vue ? 1 : 0;
      const lb = geste && tl.flip ? bosse(pr(tl.flip[0], tl.flip[1])) : 0;
      if (R.lift) R.lift.style.transform = `translateY(${(-16 * lb).toFixed(2)}px) scale(${(1 + 0.04 * lb).toFixed(4)})`;
    }

    // La lueur du palier sous la carte : montée à l'éveil, retombée à 50 %.
    let gv;
    if (!geste) gv = ctx.lueurRepos;
    else {
      gv = geste === "forger" ? 0.5 + 0.5 * E_IN(pr(tl.forge[0] - 200, 200)) : E_IN(pr(tl.glow[0], tl.glow[1]));
      if (tl.flash != null) gv += (0.5 - gv) * E_IN(pr(tl.flash, 700));
      else gv += (0.5 - gv) * E_IN(pr(tl.flip[0] + tl.flip[1], 500));
    }
    if (R.glow) { R.glow.style.opacity = (gv * P.gmax).toFixed(3); R.glow.style.transform = `scale(${(0.6 + 0.4 * gv).toFixed(3)})`; }

    // Le voile : la scène s'assombrit autour de l'autel pour une rare ou mieux.
    let dv = ctx.sombreRepos || 0;
    if (geste) {
      const monte = tl.glow ? E_IN(pr(tl.glow[0], tl.glow[1])) : E_IN(pr(tl.forge[0] - 200, 200));
      const descend = tl.flash != null ? E_IN(pr(tl.flash + 100, 800)) : E_IN(pr(tl.flip[0] + tl.flip[1], 500));
      dv = P.ombre * monte * (1 - descend);
    }
    if (R.dark) R.dark.style.opacity = dv.toFixed(3);

    // L'éclat de la carte : quand le dos boit les vestiges, puis à la frappe.
    let br = 1;
    if (geste) {
      if (tl.paie) br += 0.35 * bosse(pr(250, 280));
      if (tl.flash != null) br += (P.grand ? 0.7 : 0.5) * bosse(pr(tl.flash - 80, 380));
    }
    if (R.bright) R.bright.style.filter = br === 1 ? "none" : `brightness(${br.toFixed(3)})`;
    if (R.flash) R.flash.style.opacity = geste && tl.flash != null ? bosse(pr(tl.flash - 60, 460)).toFixed(3) : 0;

    // Le compteur de la réserve.
    const vv = geste && tl.paie ? ctx.v0 - tl.cout * E_IN(pr(0, 400)) : geste ? ctx.v0 : ctx.vestiges;
    if (R.count) R.count.textContent = fmt(vv);

    this.particules(geste, t, pr);
    this.verdict(geste, pr, ctx.verdict);
  }

  particules(geste, t, pr) {
    const Q = this.pool;
    if (!Q) return;
    const tl = this.tl || {}, g = this.geo, pa = this.parts;
    const montrer = (d, x, y, s, o, rot) => {
      d.style.opacity = o.toFixed(3);
      d.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s.toFixed(3)})${rot != null ? ` rotate(${rot.toFixed(1)}deg)` : ""}`;
    };
    const cacher = (d) => { if (d.style.opacity !== "0") d.style.opacity = "0"; };
    if (!geste || !g) { [...Q.eclats, ...Q.motes, ...Q.braises, ...Q.anneaux, ...Q.etincelles].forEach(cacher); return; }

    // Paiement : dix éclats de vestige en arc, de la réserve au dos de la carte.
    Q.eclats.forEach((d, i) => {
      const p = tl.paie ? pr(i * 18, 260) : 0;
      if (p <= 0 || p >= 1) return cacher(d);
      const e = E_IN(p), s = pa.eclats[i], ax = g.A.x, ay = g.A.y;
      const cx = (ax + s.bx) / 2, cy = Math.min(ay, s.by) - s.lift;
      const x = (1 - e) * (1 - e) * ax + 2 * (1 - e) * e * cx + e * e * s.bx;
      const y = (1 - e) * (1 - e) * ay + 2 * (1 - e) * e * cy + e * e * s.by;
      montrer(d, x, y, 1 - 0.55 * e, p < 0.8 ? 1 : (1 - p) / 0.2, i * 37 + e * 220);
    });

    // Particules du palier, au passage de la face (20 % du retournement).
    const emission = tl.flip ? tl.flip[0] + tl.flip[1] * 0.2 : null;
    Q.motes.forEach((d, i) => {
      const m = pa.motes[i];
      if (!m || emission == null) return cacher(d);
      const p = pr(emission + m.delai, m.vie);
      if (p <= 0 || p >= 1) return cacher(d);
      const e = E_IN(p);
      montrer(d, m.x0 + m.dx * e, m.y0 + m.dy * e, m.s * (1 - 0.4 * p), p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85);
    });

    // Braises qui retombent (légendaire et rainbow).
    Q.braises.forEach((d, i) => {
      const m = pa.braises[i];
      if (!m || tl.flash == null) return cacher(d);
      const tt = t - (tl.flash + m.delai);
      if (tt <= 0 || tt >= m.vie) return cacher(d);
      const p = tt / m.vie;
      montrer(d, m.x0 + m.vx * tt, m.y0 + m.vy * tt + 0.5 * 0.0007 * tt * tt, m.s * (1 - 0.5 * p), p < 0.6 ? 1 : (1 - p) / 0.4);
    });

    // Deux anneaux d'onde, à 150 ms d'écart (légendaire et rainbow).
    Q.anneaux.forEach((d, j) => {
      if (!this.P?.grand || tl.flash == null) return cacher(d);
      const p = pr(tl.flash + j * 150, 900);
      if (p <= 0 || p >= 1) return cacher(d);
      montrer(d, g.B.x, g.B.y, 0.45 + 2.1 * E_IN(p), 0.85 * (1 - p));
    });

    // La fissure : deux étincelles partent du bas du cadre et se rejoignent en haut.
    const rc = g.rect, ins = { x: rc.x + rc.w * 0.035, y: rc.y + rc.h * 0.024, w: rc.w * 0.93, h: rc.h * 0.952 };
    const cxm = ins.x + ins.w / 2, yb = ins.y + ins.h;
    const perim = (u) => {
      const dd = u * (ins.w + ins.h);
      if (dd < ins.w / 2) return [cxm - dd, yb];
      if (dd < ins.w / 2 + ins.h) return [ins.x, yb - (dd - ins.w / 2)];
      return [ins.x + (dd - ins.w / 2 - ins.h), ins.y];
    };
    Q.etincelles.forEach((d, i) => {
      if (!tl.forge) return cacher(d);
      const p = pr(tl.forge[0], tl.forge[1]);
      if (p <= 0 || p >= 1) return cacher(d);
      const cote = i < 7 ? 0 : 1, k = i % 7, e = E_IO(p);
      let [x, y] = perim(Math.max(0, e - k * 0.03));
      if (cote) x = 2 * cxm - x;
      montrer(d, x, y, 1 - k * 0.11, (1 - k / 7) * (p > 0.92 ? (1 - p) / 0.08 : 1));
    });
  }

  /** « 100 → 1 000 +900 » : le prix réel compte, puis l'écart éclate ou tressaille. */
  verdict(geste, pr, v) {
    const R = this.R;
    if (!R.vLine || !R.vReal) return;
    if (!v) { R.vLine.style.opacity = 0; return; }
    const ec = v.vaut - v.paye, col = ec > 0 ? VERT : ec < 0 ? EMBER : INK;
    const txt = ec === 0 ? "" : (ec > 0 ? "+" : "−") + fmt(Math.abs(ec));
    const E = R.vEcart;
    const tl = this.tl;
    if (geste === "aveugle" && tl?.compte) {
      R.vLine.style.opacity = pr(tl.compte[0], 150).toFixed(3);
      R.vReal.textContent = fmt(v.paye + (v.vaut - v.paye) * E_IN(pr(tl.compte[0], tl.compte[1])));
      const pe = pr(tl.ecart[0], tl.ecart[1]);
      R.vReal.style.color = pe > 0 ? col : INK;
      if (E) {
        E.textContent = txt; E.style.color = col;
        E.style.opacity = pe > 0 ? Math.min(1, pe * 4).toFixed(3) : 0;
        if (ec > 0) {
          E.style.transform = `scale(${(1.6 - 0.6 * E_RESSORT(pe)).toFixed(3)})`;
          E.style.filter = pe > 0 && pe < 1 ? `drop-shadow(0 0 ${(14 * (1 - pe)).toFixed(1)}px ${VERT})` : "none";
        } else {
          E.style.transform = `translateX(${(5 * Math.sin(pe * Math.PI * 8) * (1 - pe)).toFixed(2)}px)`;
          E.style.filter = "none";
        }
      }
    } else {
      R.vLine.style.opacity = 1; R.vReal.textContent = fmt(v.vaut); R.vReal.style.color = col;
      if (E) { E.textContent = txt; E.style.color = col; E.style.opacity = 1; E.style.transform = "none"; E.style.filter = "none"; }
    }
  }
}
