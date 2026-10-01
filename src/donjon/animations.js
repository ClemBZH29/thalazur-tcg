/**
 * Le Donjon : les animations des compétences et des événements de combat.
 *
 * Livrées par Claude Design le 01/10/2026, d'après le brief
 * docs/conception/brief-animations-donjon.md, et branchées telles quelles sur
 * Donjon.jsx. Web Animations API seule, aucune bibliothèque, aucune
 * ressource tierce. Styles : src/styles/donjon-animations.css.
 *
 * Règles tenues : toute animation d'une carte finit sur `transform: none`
 * puis est annulée (aucun `fill` ne reste : le portrait ne saute pas) ; tout
 * calque posé est retiré ; trente particules au plus ; durées divisées par la
 * vitesse du combat. En mouvement réduit : un fondu, rien d'autre.
 *
 * Adaptations au site : l'éclat posé dans l'arène s'appelle `fx-eclat` (le
 * `.dj-eclat` existant se pose dans la carte), et les chiffres flottants sont
 * coupés (`flottants: false`) : les vrais chiffres viennent des règles, après
 * coup, par `montrer`.
 */

const IRIS = ['#f0a3c7', '#f5d77e', '#8fe0b4', '#8fc3f0', '#b49cf0'];
const GESTES = ['attaque', 'estoc', 'entaille', 'bouclier', 'double', 'secours', 'ripostee', 'trait'];
const MAX_PARTICULES = 30;

export function creerAnimationsDonjon({ arene, el, vitesse = () => 1, reduit = () => false, unites = () => [], flottants = true }) {
  let etoile = false, nbParticules = 0;
  const poses = new Set();
  const D = ms => ms / (vitesse() || 1);
  const attendre = ms => new Promise(r => setTimeout(r, D(ms)));
  const deuxImages = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const T = (x, y, r = '') => `translate(-50%,-50%) translate(${x}px,${y}px) ${r}`;
  const carteDe = u => el(u.uid)?.querySelector('.dj-carte');
  const faceDe = u => el(u.uid)?.querySelector('.dj-face');
  const autre = camp => (camp === 'a' ? 'e' : 'a');
  const rang = camp => arene().querySelector(camp === 'e' ? '.dj-rang.ennemis' : '.dj-rang.equipe');
  const vivants = camp => unites().filter(x => x.camp === camp && !x.ko);

  function centre(n) {
    const a = arene().getBoundingClientRect(), r = n.getBoundingClientRect();
    return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2, w: r.width, h: r.height, gauche: r.left - a.left };
  }
  function pt(x) {
    if (!x) return null;
    if (typeof x.x === 'number') return x;
    if (x.uid) { const c = carteDe(x); return c ? centre(c) : null; }
    return centre(x);
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function plusBlesse(camp, sauf) {
    return vivants(camp).filter(x => x.uid !== sauf).sort((a, b) => a.pv / a.pvMax - b.pv / b.pvMax)[0];
  }
  function choisirSouffle(u) {
    const ko = unites().filter(x => x.camp === u.camp && x.ko).sort((a, b) => b.pvMax - a.pvMax)[0];
    return ko || plusBlesse(u.camp);
  }
  function voisin(c) {
    const b = pt(c);
    return vivants(c.camp).filter(x => x.uid !== c.uid).sort((p, q) => dist(pt(p), b) - dist(pt(q), b))[0];
  }
  const fractionX = (u, r) => { const rr = centre(r), b = pt(u); return Math.min(1, Math.max(0, (b.x - rr.gauche) / rr.w)); };

  /* ---------- Briques de base ---------- */
  function poser(cls, x, y, style) {
    const n = document.createElement('div');
    n.className = 'dj-fx ' + cls + (etoile ? ' etoile' : '');
    n.style.left = x + 'px'; n.style.top = y + 'px';
    if (style) Object.assign(n.style, style);
    arene().appendChild(n); poses.add(n);
    return n;
  }
  function retirer(n) { n.remove(); poses.delete(n); }
  function jouer(n, kf, ms, o = {}) {
    const a = n.animate(kf, { duration: D(ms), delay: D(o.delai || 0), easing: o.easing || 'ease-out', fill: 'both' });
    return a.finished.catch(() => {}).then(() => retirer(n));
  }
  // Sur une carte ou un élément du site : finit sur l'état d'origine, puis annulée.
  function bouger(n, kf, ms, o = {}) {
    if (!n) return Promise.resolve();
    const a = n.animate(kf, { duration: D(ms), delay: D(o.delai || 0), easing: o.easing || 'ease-in-out', fill: 'both' });
    return a.finished.catch(() => {}).then(() => a.cancel());
  }

  function pulser(u, o = {}) {
    return bouger(carteDe(u), [{ transform: 'none' }, { transform: 'translateY(-8px) scale(1.07)', offset: .4 }, { transform: 'none' }], o.ms ?? 360);
  }
  function secouer(force = 6, ms = 320) {
    const kf = [{ transform: 'none' }];
    for (let i = 1; i < 6; i++) { const k = force * (1 - i / 6); kf.push({ transform: `translate(${(i % 2 ? 1 : -1) * k}px,${(Math.random() - .5) * k}px)` }); }
    kf.push({ transform: 'none' });
    return bouger(arene(), kf, ms, { easing: 'linear' });
  }
  function eclater(u, cls = '', o = {}) {
    const b = pt(u); if (!b) return Promise.resolve();
    const lourd = /lourd|grace/.test(cls);
    const s = poser('fx-eclat ' + cls, b.x + (o.dx || 0), b.y + (o.dy || 0));
    const fo = lourd ? 5 : 3;
    bouger(faceDe(u), [{ transform: 'none', filter: 'none' }, { transform: `translateX(${-fo}px)`, filter: 'brightness(1.6)', offset: .15 },
      { transform: `translateX(${fo}px)`, filter: 'brightness(1.2)', offset: .4 }, { transform: `translateX(${-fo / 2}px)`, offset: .7 }, { transform: 'none', filter: 'none' }], 280);
    if (etoile) anneau(u, 'irise', { ms: 420, de: .5, a: 1.2 });
    return jouer(s, [{ transform: T(0, 0, 'scale(.3)'), opacity: 1 }, { transform: T(0, 0, 'scale(1.25)'), opacity: 0 }], lourd ? 380 : 280);
  }
  function anneau(u, cls = '', o = {}) {
    const b = pt(u); if (!b) return Promise.resolve();
    const t = (o.taille ?? 1.05) * b.w;
    const n = poser('fx-anneau ' + cls, b.x, b.y, { width: t + 'px', height: t + 'px' });
    return jouer(n, [{ transform: T(0, 0, `scale(${o.de ?? .55})`), opacity: o.opacite ?? .95 }, { transform: T(0, 0, `scale(${o.a ?? 1.45})`), opacity: 0 }], o.ms ?? 520, { delai: o.delai });
  }
  function projectile(de, vers, cls, o = {}) {
    const a = pt(de), b = pt(vers); if (!a || !b) return Promise.resolve();
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, px = -dy / len, py = dx / len;
    let arc = o.arc || 0;
    if (o.haut) arc = (py > 0 ? -1 : 1) * Math.abs(arc);
    const N = arc ? 10 : 1, kf = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, h = 4 * arc * t * (1 - t);
      const tx = dx + px * arc * 4 * (1 - 2 * t), ty = dy + py * arc * 4 * (1 - 2 * t);
      const ang = o.oriente === false ? 0 : Math.atan2(ty, tx) * 180 / Math.PI;
      kf.push({ transform: T(dx * t + px * h, dy * t + py * h, `rotate(${ang}deg)`), offset: t, ...(i === 0 ? { opacity: 0 } : i === N ? { opacity: 1 } : {}) });
    }
    kf.splice(1, 0, { opacity: 1, offset: .1 });
    kf.sort((p, q) => p.offset - q.offset);
    const n = poser('fx-proj ' + cls, a.x, a.y, o.style);
    return jouer(n, kf, o.ms ?? 260, { easing: o.easing || 'cubic-bezier(.4,0,.6,1)', delai: o.delai });
  }
  // Trait étiré de A vers B (traînée, pointe, balafre). o.reste : reste visible puis s'efface.
  function trainee(de, vers, cls = 'fx-trainee', ms = 220, o = {}) {
    const a = pt(de), b = pt(vers);
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
    const n = poser('fx-trait ' + cls, a.x, a.y, { width: L + 'px' });
    const R = s => `translate(0,-50%) rotate(${ang}deg) ${s}`;
    const kf = o.reste
      ? [{ transform: R('scaleX(0)'), opacity: 1 }, { transform: R('scaleX(1)'), opacity: 1, offset: .25 }, { transform: R('scaleX(1)'), opacity: .9, offset: .6 }, { transform: R('scaleX(1) scaleY(.4)'), opacity: 0 }]
      : [{ transform: R('scaleX(0)'), opacity: 1 }, { transform: R('scaleX(1)'), opacity: 1, offset: .5 }, { transform: R(`translateX(${L}px) scaleX(0)`), opacity: .5 }];
    return jouer(n, kf, ms, { easing: 'cubic-bezier(.3,0,.4,1)', delai: o.delai });
  }
  function balayer(r, cls, o = {}) {
    const rr = centre(r), w = rr.w * (o.largeur ?? .45), h = rr.h * (o.hauteur ?? 1.15);
    const x0 = rr.gauche - w / 2, x1 = rr.gauche + rr.w + w / 2;
    const n = poser('fx-bande ' + cls, x0, rr.y, { width: w + 'px', height: h + 'px' });
    const op = o.opacite ?? .95;
    return jouer(n, [{ transform: T(0, 0, 'skewX(-14deg)'), opacity: 0 }, { opacity: op, offset: .2 }, { opacity: op, offset: .75 }, { transform: T(x1 - x0, 0, 'skewX(-14deg)'), opacity: 0 }],
      o.ms ?? 520, { easing: 'cubic-bezier(.45,0,.55,1)', delai: o.delai });
  }
  function particules(x, y, n, cls, o = {}) {
    n = Math.min(n, MAX_PARTICULES - nbParticules);
    if (n <= 0) return Promise.resolve();
    const { angle = -90, ecart = 360, dist: dd = [18, 46], ms = 520, gravite = 0, couleurs, delai = 0, xEcart = 0 } = o;
    const ps = [];
    for (let i = 0; i < n; i++) {
      const t = (angle + (Math.random() - .5) * ecart) * Math.PI / 180, d = dd[0] + Math.random() * (dd[1] - dd[0]);
      const p = poser('fx-part ' + cls, x + (Math.random() - .5) * xEcart, y, couleurs ? { background: couleurs[i % couleurs.length], color: couleurs[i % couleurs.length] } : null);
      nbParticules++;
      ps.push(jouer(p, [{ transform: T(0, 0), opacity: 1 }, { transform: T(Math.cos(t) * d * .7, Math.sin(t) * d * .7, 'scale(.9)'), opacity: 1, offset: .55 },
        { transform: T(Math.cos(t) * d, Math.sin(t) * d + gravite, 'scale(.35)'), opacity: 0 }], ms * (.8 + Math.random() * .4), { delai: delai + Math.random() * 60 }).then(() => nbParticules--));
    }
    return Promise.all(ps);
  }

  /* ---------- Briques nouvelles ---------- */
  // Ruée paramétrable : recul, arc (contournement), fraction, impact personnalisé, traînée.
  async function ruer(att, cible, o = {}) {
    const c = carteDe(att), tc = carteDe(cible); if (!c || !tc) return;
    const a = centre(c), b = centre(tc);
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const v = { dx, dy, ux: dx / len, uy: dy / len, px: -dy / len, py: dx / len };
    const f = o.frac ?? .62, ms = o.ms ?? (o.lourd ? 520 : o.vite ? 320 : 400);
    const recul = o.sansRecul ? 0 : (o.recul ?? (o.lourd ? .1 : .05)), arc = o.arc || 0;
    const kf = [{ transform: 'none', offset: 0, easing: 'ease-out' }];
    if (recul) kf.push({ transform: `translate(${-dx * recul}px,${-dy * recul}px) scale(${o.lourd ? 1.04 : 1})`, offset: o.lourd ? .32 : .2, easing: 'cubic-bezier(.6,0,.9,.6)' });
    if (arc) kf.push({ transform: `translate(${dx * f * .45 + v.px * arc}px,${dy * f * .45 + v.py * arc}px) rotate(${arc > 0 ? 5 : -5}deg)`, offset: .36 });
    kf.push({ transform: `translate(${dx * f}px,${dy * f}px)${o.lourd ? ' scale(1.06)' : ''}`, offset: .5, easing: 'cubic-bezier(.2,.7,.3,1)' });
    kf.push({ transform: 'none', offset: 1 });
    if (o.trainee) attendre(ms * (recul ? .22 : .05)).then(() => trainee(a, { x: a.x + dx * f, y: a.y + dy * f }, 'fx-trainee', ms * .4));
    attendre(ms * .5).then(() => { o.impact ? o.impact(b, v) : eclater(cible, o.lourd ? 'lourd' : ''); });
    await bouger(c, kf, ms, { easing: 'linear' });
  }
  function colonne(u, cls, ms = 560, o = {}) {
    const b = pt(u), H = b.y + b.h * .5;
    const n = poser('fx-colonne ' + cls, b.x, 0, { width: b.w * (o.largeur ?? .9) + 'px', height: H + 'px' });
    return jouer(n, [{ transform: 'translateX(-50%) scaleY(0)', opacity: 0 }, { transform: 'translateX(-50%) scaleY(1)', opacity: 1, offset: .35 },
      { transform: 'translateX(-50%) scaleY(1)', opacity: .9, offset: .7 }, { transform: 'translateX(-50%) scaleY(1)', opacity: 0 }], ms, { delai: o.delai });
  }
  function sigle(u, ms = 900) {
    const b = pt(u), t = b.w * .78;
    const s = poser('fx-sigle', b.x, b.y - b.h * .06, { width: t + 'px', height: t + 'px' });
    return jouer(s, [{ transform: T(0, 0, 'scale(1.9) rotate(-45deg)'), opacity: 0 }, { transform: T(0, 0, 'scale(.94) rotate(0deg)'), opacity: 1, offset: .4 },
      { transform: T(0, 0, 'scale(1)'), opacity: 1, offset: .55 }, { transform: T(0, 0, 'scale(1)'), opacity: 0 }], ms);
  }
  function fissures(b) {
    const n = poser('fx-fissure', b.x, b.y + b.h * .44, { width: b.w * 1.6 + 'px', height: b.w * .5 + 'px' });
    let d = '';
    [165, 130, 95, 60, 18].forEach(a0 => {
      let x = 50, y = 2; d += `M${x} ${y}`;
      for (let i = 0; i < 4; i++) { const a = (a0 + (Math.random() - .5) * 36) * Math.PI / 180, l = 6 + Math.random() * 6; x += Math.cos(a) * l; y += Math.sin(a) * l * .45; d += `L${x.toFixed(1)} ${y.toFixed(1)}`; }
    });
    n.innerHTML = `<svg viewBox="0 0 100 32" width="100%" height="100%" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="#e5774b" stroke-opacity=".35" stroke-width="3.5" vector-effect="non-scaling-stroke"/><path d="${d}" fill="none" stroke="#050809" stroke-width="1.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
    return jouer(n, [{ transform: 'translate(-50%,0) scaleX(.2)', opacity: 0 }, { transform: 'translate(-50%,0) scaleX(1)', opacity: 1, offset: .15 }, { opacity: 1, offset: .6 }, { transform: 'translate(-50%,0) scaleX(1)', opacity: 0 }], 900);
  }
  function eclair(u) {
    const b = pt(u), H = b.h * 1.5, W = b.w * .5;
    const n = poser('fx-eclair', b.x, b.y - H / 2 + b.h * .1, { width: W + 'px', height: H + 'px' });
    const p = [];
    for (let i = 0; i <= 7; i++) p.push(`${(20 + (i === 0 || i === 7 ? 0 : (Math.random() - .5) * 28)).toFixed(1)},${(i * 100 / 7).toFixed(1)}`);
    const s = p.join(' ');
    n.innerHTML = `<svg viewBox="0 0 40 100" width="100%" height="100%" preserveAspectRatio="none"><polyline points="${s}" fill="none" stroke="#9d7cf0" stroke-opacity=".6" stroke-width="7" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><polyline points="${s}" fill="none" stroke="#f4efff" stroke-width="2.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
    return jouer(n, [{ opacity: 0 }, { opacity: 1, offset: .12 }, { opacity: .4, offset: .32 }, { opacity: 1, offset: .46 }, { opacity: 0 }], 280, { easing: 'linear' });
  }
  function machoires(b) {
    const w = b.w * .5, h = b.w * .6, top = b.y + b.h * .5 - h + b.h * .05;
    return [poser('fx-machoire g', b.x - w, top, { width: w + 'px', height: h + 'px' }), poser('fx-machoire d', b.x, top, { width: w + 'px', height: h + 'px' })];
  }
  function volutes(u, n = 7, ms = 640, o = {}) {
    const b = pt(u), R = b.h * (o.rayon ?? .75), ps = [];
    for (let i = 0; i < n; i++) {
      const t0 = i / n * Math.PI * 2, t1 = t0 + 1.4;
      const v = poser('fx-volute', b.x, b.y, { width: b.w * .8 + 'px', height: b.w * .8 + 'px' });
      ps.push(jouer(v, [{ transform: T(Math.cos(t0) * R, Math.sin(t0) * R, 'scale(.5)'), opacity: 0 },
        { transform: T(Math.cos(t0 + .7) * R * .6, Math.sin(t0 + .7) * R * .6, 'scale(1)'), opacity: .75, offset: .45 },
        { transform: T(Math.cos(t1) * R * .22, Math.sin(t1) * R * .22, 'scale(1.3)'), opacity: 0 }], ms, { delai: i * 20, easing: 'ease-in-out' }));
    }
    return Promise.all(ps);
  }
  function flottant(u, txt, cls = '', o = {}) {
    if (!flottants) return Promise.resolve();
    const b = pt(u); if (!b) return Promise.resolve();
    const n = poser('fx-flottant ' + cls, b.x + (o.dx || 0), b.y - b.h * .28);
    n.textContent = txt;
    const mv = reduit() ? 0 : -34;
    return jouer(n, [{ transform: T(0, mv ? 6 : 0, mv ? 'scale(.8)' : ''), opacity: 0 }, { transform: T(0, 0), opacity: 1, offset: .18 }, { opacity: 1, offset: .65 }, { transform: T(0, mv), opacity: 0 }], o.ms ?? 900, { delai: o.delai });
  }
  function surcoucheEtoile(u) {
    const b = pt(u); if (!b) return;
    const y = b.y - b.h / 2, t = b.w * .34;
    const s = poser('fx-etoile', b.x, y, { width: t + 'px', height: t + 'px' });
    jouer(s, [{ transform: T(0, 0, 'scale(0) rotate(0deg)'), opacity: 1 }, { transform: T(0, -b.h * .22, 'scale(1.15) rotate(90deg)'), opacity: 1, offset: .45 },
      { transform: T(0, -b.h * .32, 'scale(.3) rotate(200deg)'), opacity: 0 }], 520, { easing: 'cubic-bezier(.2,.8,.3,1)' });
    particules(b.x, y, 8, 'fx-etincelle', { couleurs: IRIS, dist: [16, 40], ms: 480 });
    anneau(u, 'irise', { ms: 460, de: .9, a: 1.25 });
  }
  function fondu(u, cible, st) {
    const c = carteDe(u);
    if (cible && cible.uid !== u.uid) bouger(carteDe(cible), [{ opacity: 1 }, { opacity: .6 }, { opacity: 1 }], 260, { delai: 120 });
    if (st) {
      const b = pt(u);
      const n = poser('fx-irise-fixe', b.x, b.y, { width: b.w + 8 + 'px', height: b.h + 8 + 'px', transform: 'translate(-50%,-50%)' });
      jouer(n, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 1, offset: .7 }, { opacity: 0 }], 500);
    }
    return bouger(c, [{ opacity: 1 }, { opacity: .55 }, { opacity: 1 }], 260);
  }

  /* ---------- Compétences ---------- */
  const ANIM = {
    attaque: (u, c) => ruer(u, c, { trainee: true }),

    estoc: (u, c) => ruer(u, c, { sansRecul: true, ms: 300, frac: .72, impact: (b, v) => {
      const L = b.h * .75;
      trainee({ x: b.x - v.ux * L, y: b.y - v.uy * L }, { x: b.x + v.ux * L, y: b.y + v.uy * L }, 'fx-pointe', 220);
      eclater(c, 'vif');
    } }),

    entaille: (u, c) => ruer(u, c, { arc: 28, ms: 420, impact: b => {
      const L = b.w * .62, a = (u.camp === 'a' ? -32 : 32) * Math.PI / 180;
      trainee({ x: b.x - Math.cos(a) * L, y: b.y - Math.sin(a) * L }, { x: b.x + Math.cos(a) * L, y: b.y + Math.sin(a) * L }, 'fx-balafre', 460, { reste: true });
      eclater(c, 'sang');
      particules(b.x, b.y + b.h * .1, 5, 'fx-goutte', { angle: 90, ecart: 80, dist: [10, 28], gravite: 22, ms: 560, xEcart: b.w * .3 });
    } }),

    bouclier: async (u, c) => {
      const a0 = pt(u);
      const r = ruer(u, c, { frac: .45, ms: 340, recul: .08, impact: () => { eclater(c, 'lourd'); secouer(4, 220); } });
      await attendre(230);
      const p = poser('fx-pavois', a0.x, a0.y + a0.h * .58 - a0.w * .245, { width: a0.w * .42 + 'px', height: a0.w * .49 + 'px' });
      jouer(p, [{ transform: T(0, 14, 'scale(.4)'), opacity: 0 }, { transform: T(0, -3, 'scale(1.08)'), opacity: 1, offset: .35 }, { transform: T(0, 0), opacity: 1, offset: .6 }, { transform: T(0, 0), opacity: 0 }], 560);
      anneau(a0, 'garde', { ms: 360, de: .8, a: 1.15, delai: 60, taille: 1 });
      await r; await attendre(80);
    },

    double: async (u, c) => {
      await ruer(u, c, { ms: 200, frac: .55, sansRecul: true, trainee: true, impact: (b, v) => eclater(c, 'vif', { dx: -v.px * 12, dy: -v.py * 12 }) });
      await ruer(u, c, { ms: 210, frac: .6, sansRecul: true, arc: 16, trainee: true, impact: (b, v) => eclater(c, 'vif', { dx: v.px * 12, dy: v.py * 12 }) });
    },

    secours: async (u, c) => {
      const r = ruer(u, c, { ms: 300, frac: .5, impact: () => eclater(c, 'leger') });
      await attendre(200);
      const al = plusBlesse(u.camp);
      if (al) { await projectile(c, al, 'fx-orbe', { arc: 36, haut: true, ms: 220 }); anneau(al, 'soin', { ms: 420 }); }
      await r;
    },

    ripostee: async (u, c) => {
      const a0 = pt(u);
      const r = ruer(u, c, { ms: 320, frac: .58 });
      await attendre(250);
      const l = poser('fx-lames', a0.x, a0.y, { width: a0.w * .9 + 'px', height: a0.w * .9 + 'px' });
      jouer(l, [{ transform: T(0, 0, 'scale(1.5) rotate(-25deg)'), opacity: 0 }, { transform: T(0, 0, 'scale(1) rotate(0deg)'), opacity: .95, offset: .35 }, { opacity: .8, offset: .6 }, { transform: T(0, 0, 'scale(.95)'), opacity: 0 }], 520);
      const k = poser('fx-contour', a0.x, a0.y, { width: a0.w + 10 + 'px', height: a0.h + 10 + 'px' });
      jouer(k, [{ opacity: 0, transform: T(0, 0, 'scale(1.08)') }, { opacity: 1, transform: T(0, 0), offset: .3 }, { opacity: 0, transform: T(0, 0) }], 480);
      await r; await attendre(110);
    },

    trait: async (u, c) => {
      anneau(u, 'brume', { ms: 300, de: .7, a: 1.1 });
      await projectile(u, c, 'fx-brume', { ms: 190 });
      eclater(c, 'brume');
      const v = voisin(c);
      if (v) { await projectile(c, v, 'fx-brume', { ms: 170, arc: 26 }); eclater(v, 'brume'); }
      await attendre(60);
    },

    provoc: async u => {
      const b = pt(u), adv = autre(u.camp), rr = centre(rang(adv)), ty = rr.y - b.y;
      anneau(u, 'garde', { ms: 480 });
      bouger(carteDe(u), [{ transform: 'none' }, { transform: 'scale(1.06)', offset: .3 }, { transform: 'none' }], 420);
      const onde = d => {
        const o = poser('fx-onde', b.x, b.y, { width: b.w * 1.6 + 'px', height: b.w * .8 + 'px' });
        return jouer(o, [{ transform: T(0, 0, 'scale(.4)'), opacity: .9 }, { transform: T(0, ty * .6, 'scale(2.4,1.8)'), opacity: .55, offset: .6 }, { transform: T(0, ty, 'scale(3.4,2.2)'), opacity: 0 }], 520, { easing: 'cubic-bezier(.2,.6,.4,1)', delai: d });
      };
      const p = onde(0); onde(90);
      arene().querySelectorAll('.dj-jeton').forEach((j, i) => {
        if (j.dataset.camp !== adv) return;
        const s = Math.sign(b.x - centre(j).x) || 1, regard = { transform: `translateX(${s * 4}px) rotate(${s * 14}deg) scale(1.15)`, filter: 'drop-shadow(0 0 4px #e8a33d)' };
        bouger(j, [{ transform: 'none', filter: 'none' }, { ...regard, offset: .3 }, { ...regard, offset: .75 }, { transform: 'none', filter: 'none' }], 520, { delai: 100 + i * 15 });
      });
      await p; await attendre(80);
    },

    lourde: (u, c) => ruer(u, c, { lourd: true, ms: 600, recul: .14, impact: b => {
      eclater(c, 'lourd'); secouer(9, 340); fissures(b);
      particules(b.x, b.y + b.h * .5, 9, 'fx-poussiere', { angle: -90, ecart: 160, dist: [16, 40], ms: 640, xEcart: b.w * .5 });
    } }),

    vise: async (u, c) => {
      const b = pt(c), t = b.w * 1.15, a0 = pt(u), dir = Math.sign(b.y - a0.y);
      const r = poser('fx-reticule', b.x, b.y, { width: t + 'px', height: t + 'px' });
      jouer(r, [{ transform: T(0, 0, 'scale(2) rotate(60deg)'), opacity: 0 }, { transform: T(0, 0, 'scale(1) rotate(0deg)'), opacity: 1, offset: .55 }, { transform: T(0, 0, 'scale(.9)'), opacity: 1, offset: .8 }, { transform: T(0, 0, 'scale(.5)'), opacity: 0 }], 600);
      bouger(carteDe(u), [{ transform: 'none' }, { transform: `translateY(${-dir * 6}px)`, offset: .8 }, { transform: 'none' }], 400);
      await attendre(340);
      await projectile(u, c, 'fx-fleche', { ms: 160 });
      eclater(c, 'vif'); await attendre(60);
    },

    soin: async (u, c) => {
      pulser(u, { ms: 300 });
      const b = pt(c);
      colonne(c, 'soin', 600);
      particules(b.x, b.y + b.h * .35, 10, 'fx-mote', { angle: -90, ecart: 30, dist: [30, 70], ms: 640, delai: 120, xEcart: b.w * .7 });
      await attendre(200);
      anneau(c, 'soin', { ms: 420 });
      bouger(faceDe(c), [{ filter: 'none' }, { filter: 'brightness(1.3) saturate(1.2)', offset: .4 }, { filter: 'none' }], 420);
      await attendre(400);
    },

    vague: async u => {
      const adv = autre(u.camp), r = rang(adv);
      const p1 = balayer(r, 'brume', { ms: 520 });
      const p2 = balayer(r, 'brume lente', { ms: 680, largeur: .6, hauteur: 1.35, opacite: .6 });
      vivants(adv).forEach(x => attendre(80 + fractionX(x, r) * 400).then(() => eclater(x, 'brume')));
      attendre(260).then(() => secouer(5, 300));
      await Promise.all([p1, p2]);
    },

    galva: async u => {
      const a0 = pt(u);
      anneau(u, 'galva', { ms: 420 });
      particules(a0.x, a0.y, 8, 'fx-braise', { dist: [20, 44], ms: 420 });
      const al = vivants(u.camp).filter(x => x.uid !== u.uid).sort((p, q) => dist(pt(p), a0) - dist(pt(q), a0));
      al.forEach((x, i) => projectile(a0, x, 'fx-eclat-or', { ms: 240, arc: 30, haut: true, delai: 80 + i * 90 }).then(() => anneau(x, 'galva', { ms: 380 })));
      await attendre(80 + Math.max(0, al.length - 1) * 90 + 240 + 120);
    },

    coupbas: async (u, c) => {
      const a0 = pt(u);
      const r = ruer(u, c, { ms: 460, frac: .7, arc: a0.w * .6 * (u.camp === 'a' ? 1 : -1), sansRecul: true, impact: () => eclater(c, 'vif') });
      await attendre(260);
      await Promise.all([r, projectile(c, a0, 'fx-piece', { arc: 50, haut: true, ms: 320, oriente: false })]);
    },

    // Quatre coins de métal qui se referment autour du rang, puis le calque d'état prend le relais.
    rempart: async u => {
      const r = rang(u.camp), rr = centre(r), tel = arene().classList.contains('telephone');
      const mx = tel ? 6 : 12, my = tel ? 6 : 10, l = pt(u).w * .3, loin = l * 1.4;
      const g = rr.gauche - mx, d = rr.gauche + rr.w + mx, h = rr.y - rr.h / 2 - my, b = rr.y + rr.h / 2 + my;
      anneau(u, 'garde', { ms: 420, de: .8, a: 1.25 });
      const coins = [['hg', g, h, -1, -1], ['hd', d - l, h, 1, -1], ['bg', g, b - l, -1, 1], ['bd', d - l, b - l, 1, 1]];
      coins.forEach(([c, x, y, sx, sy], i) => {
        const n = poser('fx-coin ' + c, x, y, { width: l + 'px', height: l + 'px' });
        return jouer(n, [{ transform: `translate(${sx * loin}px,${sy * loin}px) scale(1.3)`, opacity: 0 }, { transform: 'none', opacity: 1, offset: .42, easing: 'cubic-bezier(.3,1.4,.6,1)' },
          { transform: 'none', opacity: 1, offset: .7 }, { transform: 'none', opacity: 0 }], 640, { delai: i * 50, easing: 'linear' }).then(() => null);
      });
      await attendre(320);
      coins.forEach(([, x, y, sx, sy]) => particules(sx < 0 ? x : x + l, sy < 0 ? y : y + l, 4, 'fx-braise', { dist: [8, 20], ms: 320 }));
      secouer(3, 200);
      await attendre(220);
    },

    ravit: async u => {
      const a0 = pt(u), team = vivants(u.camp);
      team.forEach((x, i) => {
        const d = 40 + i * 70, cls = 'fx-miche' + (i % 2 ? ' panier' : '');
        const de = x.uid === u.uid ? { x: a0.x, y: a0.y - a0.h * .8 } : a0;
        projectile(de, x, cls, { arc: a0.h * .5, haut: true, ms: 320, delai: d, oriente: false }).then(() => {
          anneau(x, 'soin', { ms: 360, de: .7, a: 1.15 });
          flottant(x, '+' + (u.atq ?? 3), 'soin petit');
        });
      });
      await attendre(40 + Math.max(0, team.length - 1) * 70 + 320 + 80);
    },

    balayage: async u => {
      const adv = autre(u.camp), r = rang(adv), b = pt(u), dy = Math.sign(centre(r).y - b.y);
      bouger(faceDe(u), [{ filter: 'none' }, { filter: 'brightness(.35) saturate(.5) contrast(1.2)', offset: .3 }, { filter: 'brightness(.35) saturate(.5)', offset: .75 }, { filter: 'none' }], 460);
      anneau(u, 'menace', { de: 1.6, a: .95, ms: 380, opacite: .9 });
      await attendre(300);
      const e = bouger(carteDe(u), [{ transform: 'none' }, { transform: `translateY(${-dy * 14}px) scale(1.05)`, offset: .35 }, { transform: `translateY(${dy * 18}px) scale(1.08)`, offset: .6 }, { transform: 'none' }], 480);
      await attendre(150);
      const p = balayer(r, 'sang', { ms: 400 });
      vivants(adv).forEach(x => attendre(60 + fractionX(x, r) * 280).then(() => eclater(x, 'sang')));
      attendre(140).then(() => secouer(11, 380));
      await Promise.all([p, e]);
    },

    execution: async (u, c) => {
      const grace = c.pv / c.pvMax < .35, ms = grace ? 880 : 640;
      const ec = el(c.uid), eu = el(u.uid);
      ec.style.zIndex = 22; eu.style.zIndex = 22;
      const b = pt(c), a0 = pt(u), dir = Math.sign(b.y - a0.y) || 1;
      const pv = jouer(poser('fx-assombrir', 0, 0), [{ opacity: 0 }, { opacity: grace ? .78 : .58, offset: .25 }, { opacity: grace ? .78 : .58, offset: .72 }, { opacity: 0 }], ms);
      bouger(carteDe(u), [{ transform: 'none' }, { transform: `translateY(${-dir * 10}px) scale(1.05)`, offset: .5, easing: 'cubic-bezier(.7,0,1,.5)' }, { transform: `translateY(${dir * 8}px) scale(1.02)`, offset: .6 }, { transform: 'none' }], ms * .85);
      await attendre(ms * .48);
      const k = poser('fx-couperet' + (grace ? ' grace' : ''), b.x, 0, { height: b.y + b.h * .5 + 'px' });
      jouer(k, [{ transform: 'translateX(-50%) scaleY(0)', opacity: 1 }, { transform: 'translateX(-50%) scaleY(1)', opacity: 1, offset: .25 }, { transform: 'translateX(-50%) scaleY(1) scaleX(.3)', opacity: 0 }], grace ? 420 : 320);
      await attendre(grace ? 80 : 60);
      eclater(c, grace ? 'grace' : 'lourd');
      if (grace) {
        secouer(11, 380);
        anneau(c, 'grace', { ms: 460, a: 1.8 }); anneau(c, 'grace', { ms: 520, a: 1.3, delai: 90 });
        particules(b.x, b.y, 12, 'fx-braise', { dist: [24, 60], ms: 600 });
      } else secouer(5, 240);
      await pv;
      ec.style.zIndex = ''; eu.style.zIndex = '';
    },

    marque: async (u, c) => {
      await projectile(u, c, 'fx-fleche', { ms: 190 });
      eclater(c, 'vif'); sigle(c);
      await attendre(200); anneau(c, 'braise', { ms: 380, de: .6, a: 1.1 }); await attendre(160);
    },

    souffle: async u => {
      const t = choisirSouffle(u); if (!t) return pulser(u);
      anneau(u, 'soin', { ms: 380, de: .8, a: 1.2 });
      const b = pt(t);
      if (t.ko) {
        colonne(t, 'releve', 720, { largeur: 1.1 });
        particules(b.x, b.y + b.h * .4, 12, 'fx-mote', { angle: -90, ecart: 30, dist: [40, 90], ms: 700, xEcart: b.w * .7, delai: 100 });
        await attendre(260);
        anneau(t, 'soin', { ms: 480, a: 1.6 });
        bouger(faceDe(t), [{ filter: 'none' }, { filter: 'brightness(1.7) saturate(1.3)', offset: .5 }, { filter: 'none' }], 420);
        await attendre(420);
      } else {
        await projectile(u, t, 'fx-orbe grande', { arc: b.h * .5, haut: true, ms: 340 });
        anneau(t, 'soin', { ms: 460, a: 1.6 });
        particules(b.x, b.y + b.h * .3, 8, 'fx-mote', { angle: -90, ecart: 30, dist: [30, 60], ms: 520, xEcart: b.w * .6 });
        await attendre(220);
      }
    },

    tempete: async u => {
      const adv = autre(u.camp), rr = centre(rang(adv)), cibles = vivants(adv);
      const pv = jouer(poser('fx-voile-rang', rr.x, rr.y, { width: rr.w * 1.2 + 'px', height: rr.h * 1.3 + 'px' }), [{ opacity: 0 }, { opacity: .85, offset: .2 }, { opacity: .85, offset: .8 }, { opacity: 0 }], 860);
      anneau(u, 'brume', { ms: 400 });
      await attendre(170);
      const pas = Math.min(140, 420 / Math.max(1, cibles.length));
      cibles.forEach((x, i) => attendre(i * pas).then(() => { eclair(x); eclater(x, 'foudre'); if (i === 0) secouer(10, 420); }));
      await pv;
    },

    ralliement: async u => {
      const a0 = pt(u);
      bouger(carteDe(u), [{ transform: 'none' }, { transform: 'translateY(-6px) rotate(-2deg) scale(1.04)', offset: .3 }, { transform: 'none' }], 380);
      anneau(u, 'galva', { ms: 460, a: 1.7 });
      const al = vivants(u.camp).filter(x => x.uid !== u.uid).sort((p, q) => dist(pt(p), a0) - dist(pt(q), a0));
      al.forEach((x, i) => projectile(a0, x, 'fx-onde-or', { ms: 220, delai: 90 + i * 80 }).then(() => {
        anneau(x, 'galva', { ms: 360, de: .7, a: 1.2 });
        bouger(el(x.uid)?.querySelector('.dj-recharge'), [{ transform: 'none', opacity: 1, filter: 'none' }, { transform: 'translateY(4px) scale(.55,.35)', opacity: .3, filter: 'blur(1.5px)', offset: .5 }, { transform: 'none', opacity: 1, filter: 'none' }], 360);
      }));
      await attendre(90 + Math.max(0, al.length - 1) * 80 + 220 + 200);
    },

    piege: async (u, c) => {
      const b = pt(c), gardien = !!c.boss, ms = gardien ? 640 : 560;
      const kf = s => gardien
        ? [{ transform: `rotate(${s * 78}deg)`, opacity: 0 }, { transform: `rotate(${s * 72}deg)`, opacity: 1, offset: .1 }, { transform: `rotate(${-s * 5}deg)`, offset: .4 }, { transform: 'rotate(0deg)', opacity: 1, offset: .55 }, { transform: `translate(${s * 18}px,10px) rotate(${s * 55}deg)`, opacity: 0 }]
        : [{ transform: `rotate(${s * 78}deg)`, opacity: 0 }, { transform: `rotate(${s * 72}deg)`, opacity: 1, offset: .1 }, { transform: `rotate(${-s * 5}deg)`, offset: .42 }, { transform: 'rotate(0deg)', opacity: 1, offset: .5 }, { transform: 'rotate(0deg)', opacity: 1, offset: .78 }, { transform: 'rotate(0deg)', opacity: 0 }];
      const [g, d] = machoires(b);
      const pg = jouer(g, kf(-1), ms, { easing: 'linear' }); jouer(d, kf(1), ms, { easing: 'linear' });
      await attendre(ms * .42);
      eclater(c, 'acier'); secouer(5, 200);
      if (gardien) {
        await attendre(ms * .14);
        particules(b.x, b.y + b.h * .4, 8, 'fx-fer', { angle: -90, ecart: 200, dist: [16, 40], ms: 480 });
        flottant(c, 'Résiste', 'info');
      }
      await pg;
    },

    voile: async (u, c) => {
      anneau(u, 'brume', { ms: 360, de: .8, a: 1.2 });
      volutes(c, 7, 640);
      bouger(carteDe(c), [{ opacity: 1 }, { opacity: .6, offset: .5 }, { opacity: 1 }], 600);
      await attendre(620);
    },

    drain: async (u, c) => {
      const a0 = pt(u);
      const r = ruer(u, c, { ms: 340, frac: .55, impact: () => eclater(c, 'sang') });
      await attendre(250);
      const g = [];
      for (let i = 0; i < 7; i++) g.push(projectile(c, a0, 'fx-sang', { ms: 220, arc: (i % 2 ? 1 : -1) * (8 + i * 3), delai: i * 24 }));
      await Promise.all([r, ...g]);
      anneau(a0, 'drain', { ms: 440 });
      await attendre(60);
    },
  };

  async function animerGeste(u, g, cible) {
    const st = GESTES.includes(g) ? !!u.etoiles?.geste : !!u.etoiles?.tech;
    if (reduit()) return fondu(u, cible, st);
    const eu = el(u.uid);
    etoile = st;
    if (eu) eu.style.zIndex = 6;
    try {
      if (st) surcoucheEtoile(u);
      await (ANIM[g] || pulser)(u, cible || u);
    } finally {
      etoile = false;
      if (eu) eu.style.zIndex = '';
    }
  }

  /* ---------- Événements entre deux gestes ---------- */
  const EVT = {
    saignement: async (u, o) => {
      const b = pt(u);
      particules(b.x, b.y + b.h * .3, 6, 'fx-goutte', { angle: 90, ecart: 60, dist: [10, 26], gravite: 20, ms: 560, xEcart: b.w * .6 });
      bouger(carteDe(u), [{ transform: 'none' }, { transform: 'translateX(-2px) rotate(-.6deg)', offset: .25 }, { transform: 'translateX(2px) rotate(.6deg)', offset: .5 }, { transform: 'none' }], 300);
      anneau(u, 'grace', { ms: 360, de: .8, a: 1.05, opacite: .6 });
      flottant(u, o.txt || '−3', 'saigne');
      await attendre(420);
    },
    piege: async u => {
      const b = pt(u), [g, d] = machoires(b);
      const kf = s => [{ transform: 'rotate(0deg)', opacity: 0 }, { transform: 'rotate(0deg)', opacity: 1, offset: .1 }, { transform: `rotate(${-s * 4}deg) scaleY(.94)`, offset: .3 },
        { transform: 'rotate(0deg)', offset: .45 }, { transform: `rotate(${s * 40}deg)`, opacity: .8, offset: .8 }, { transform: `rotate(${s * 55}deg)`, opacity: 0 }];
      const p = jouer(g, kf(-1), 620, { easing: 'ease-in-out' }); jouer(d, kf(1), 620, { easing: 'ease-in-out' });
      const j = arene().querySelector(`.dj-jeton[data-uid="${u.uid}"]`);
      bouger(j, [{ transform: 'none', filter: 'none' }, { transform: 'scale(.82)', filter: 'grayscale(1) brightness(.6)', offset: .4 }, { transform: 'none', filter: 'grayscale(1) brightness(.6)' }], 420, { delai: 120 });
      attendre(190).then(() => eclater(u, 'acier'));
      flottant(u, 'Perd son tour', 'info', { delai: 150 });
      await p;
    },
    renvoi: async (u, o) => {
      const a = o.attaquant, b = pt(u);
      const l = poser('fx-lames', b.x, b.y, { width: b.w * .8 + 'px', height: b.w * .8 + 'px' });
      jouer(l, [{ transform: T(0, 0, 'scale(1.2)'), opacity: 0 }, { transform: T(0, 0), opacity: 1, offset: .3 }, { transform: T(0, 0), opacity: 0 }], 360);
      for (let i = 0; i < 3; i++) projectile(u, a, 'fx-fleche etincelle', { ms: 220, arc: (i - 1) * 18, delai: 60 + i * 30 });
      await attendre(290);
      eclater(a, 'vif'); flottant(a, o.txt || '−2', 'renvoi');
      await attendre(110);
    },
    esquive: async (u, o) => {
      const b = pt(u);
      const r = ruer(o.attaquant, u, { ms: 400, frac: .95, sansRecul: true, impact: () => {} });
      await attendre(130);
      bouger(carteDe(u), [{ transform: 'none', opacity: 1 }, { transform: `translateX(${b.w * .28}px)`, opacity: .45, offset: .35 }, { transform: `translateX(${b.w * .28}px)`, opacity: .45, offset: .6 }, { transform: 'none', opacity: 1 }], 380);
      volutes(u, 4, 420, { rayon: .3 });
      flottant(u, 'Esquive', 'info', { delai: 60 });
      await r;
    },
    releve: async (u, o) => {
      const c = carteDe(u), b = pt(u);
      const p = bouger(c, [{ transform: 'translateY(6px) rotate(-3deg)', filter: 'grayscale(1) brightness(.55)' }, { transform: 'translateY(6px) rotate(-3deg)', filter: 'grayscale(.6) brightness(.9)', offset: .3 },
        { transform: 'translateY(-6px) rotate(.8deg)', filter: 'grayscale(0) brightness(1.25)', offset: .75 }, { transform: 'none', filter: 'none' }], 560, { easing: 'ease-out' });
      o.appliquer?.();
      colonne(u, 'releve', 620, { largeur: 1 });
      particules(b.x, b.y + b.h * .4, 10, 'fx-mote', { angle: -90, ecart: 30, dist: [30, 70], ms: 600, xEcart: b.w * .7 });
      anneau(u, 'soin', { ms: 480, delai: 200 });
      await p;
    },
    ko: async (u, o) => {
      const c = carteDe(u), b = pt(u);
      const a = c.animate([{ transform: 'none', filter: 'none' }, { transform: 'translateY(-5px) rotate(1.5deg)', offset: .25 },
        { transform: 'translateY(9px) rotate(-4deg)', filter: 'grayscale(.8) brightness(.6)', offset: .65 }, { transform: 'translateY(6px) rotate(-3deg)', filter: 'grayscale(1) brightness(.55)' }],
        { duration: D(460), easing: 'cubic-bezier(.5,0,.7,1)', fill: 'forwards' });
      attendre(290).then(() => { secouer(3, 180); particules(b.x, b.y + b.h * .5, 10, 'fx-poussiere', { angle: -90, ecart: 170, dist: [14, 36], ms: 600, xEcart: b.w * .8 }); });
      await a.finished.catch(() => {});
      o.appliquer?.();             // la classe .ko prend le relais à l'identique…
      await deuxImages(); a.cancel(); // …puis l'animation est annulée : aucun fill ne reste.
    },
  };

  async function animerEvenement(type, u, o = {}) {
    if (reduit()) {
      if (type === 'ko' || type === 'releve') { o.appliquer?.(); return; }
      const txt = { saignement: o.txt || '−3', piege: 'Perd son tour', esquive: 'Esquive' }[type];
      if (txt) flottant(u, txt, type === 'saignement' ? 'saigne' : 'info');
      if (type === 'renvoi' && o.attaquant) flottant(o.attaquant, o.txt || '−2', 'renvoi');
      return fondu(type === 'renvoi' ? o.attaquant : u);
    }
    if (EVT[type]) await EVT[type](u, o);
  }

  function nettoyer() { poses.forEach(retirer); }

  return {
    animerGeste, animerEvenement, choisirSouffle, plusBlesse, voisin, nettoyer,
    nbPoses: () => poses.size,
    briques: { ruer, pulser, secouer, eclater, projectile, balayer, anneau, flottant, poser, trainee, colonne, sigle, fissures, eclair, machoires, volutes, particules, surcoucheEtoile },
  };
}

export const GESTES_DONJON = GESTES;
