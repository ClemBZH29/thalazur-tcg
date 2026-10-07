/**
 * La mise en scène des missions, d'après le prototype de Claude Design
 * (docs/conception/missions.md, « La page »). API Web Animations seule, et
 * seulement `transform`, `opacity` et `filter`. Un toucher pendant une
 * animation appelle `finirTout` : tout se pose à sa place finale.
 *
 * Rien ici ne touche à la partie : la page change l'état, puis demande
 * l'effet. Mouvement réduit : aucune animation n'est créée, l'état final
 * est déjà rendu.
 */
const vivantes = new Set();
let sauterJusqua = 0;
const maintenant = () => (typeof performance !== "undefined" ? performance.now() : 0);

/** Lance une animation et la suit ; rien si le mouvement est réduit. */
export function animer(el, images, options, reduit) {
  if (!el || reduit || !el.animate || maintenant() < sauterJusqua) return null;
  const a = el.animate(images, { fill: "backwards", ...options });
  vivantes.add(a);
  const fin = () => vivantes.delete(a);
  a.addEventListener("finish", fin);
  a.addEventListener("cancel", fin);
  return a;
}

export const enCours = () => vivantes.size > 0;

/** Pose tout à l'état final (un toucher pendant une animation). */
export function finirTout() {
  sauterJusqua = maintenant() + 80;
  [...vivantes].forEach((a) => { try { a.finish(); } catch { /* déjà finie */ } });
}

const centre = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/** Le premier élément visible d'une liste de sélecteurs (la barre, ou le menu au doigt). */
export function cibleVisible(...selecteurs) {
  for (const s of selecteurs) {
    const el = document.querySelector(s);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

/** Le sceau tombe sur le billet, la cire refroidit, le billet se tasse (≈ 1 100 ms). */
export function sceau(article, reduit) {
  if (!article) return;
  animer(article.querySelector(".msn-sceau"), [
    { transform: "translateY(-48px) scale(1.6) rotate(-20deg)", opacity: 0, easing: "cubic-bezier(.55,0,.85,.36)" },
    { transform: "translateY(0) scale(.9) rotate(-8deg)", opacity: 1, offset: 0.72, easing: "cubic-bezier(.2,1.3,.4,1)" },
    { transform: "translateY(0) scale(1) rotate(-8deg)", opacity: 1 },
  ], { duration: 260 }, reduit);
  animer(article.querySelector(".msn-cire-chaude"), [{ opacity: 1 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }],
    { duration: 1100, easing: "ease-in" }, reduit);
  animer(article, [
    { transform: "none" }, { transform: "none", offset: 0.42 },
    { transform: "translateY(3px) scale(.985,.965)", offset: 0.55, easing: "cubic-bezier(.2,1.3,.4,1)" },
    { transform: "none" },
  ], { duration: 440 }, reduit);
}

/** Des pièces jaillissent de `depuis` (un rectangle) et filent vers la bourse du bandeau. */
export function pieces(couche, depuis, nombre, retard, reduit) {
  const bourse = cibleVisible(".masthead .bourse");
  if (!couche || !depuis || !bourse || reduit) return;
  const a = centre(depuis), b = centre(bourse.getBoundingClientRect());
  for (let i = 0; i < nombre; i++) {
    const d = document.createElement("div");
    d.className = "msn-piece";
    d.style.left = `${a.x - 6}px`;
    d.style.top = `${a.y - 6}px`;
    couche.appendChild(d);
    const jx = (i - (nombre - 1) / 2) * 10 + (Math.random() * 8 - 4), jy = -16 - Math.random() * 18;
    const dx = b.x - a.x + Math.random() * 12 - 6, dy = b.y - a.y;
    const mx = jx + (dx - jx) * 0.5, my = jy + (dy - jy) * 0.5 - 46;
    const an = animer(d, [
      { transform: "translate(0,0) scale(.4)", opacity: 0, easing: "cubic-bezier(.2,.8,.3,1)" },
      { transform: `translate(${jx}px,${jy}px) scale(1.1)`, opacity: 1, offset: 0.18, easing: "cubic-bezier(.45,0,.55,1)" },
      { transform: `translate(${mx}px,${my}px) scale(.85)`, opacity: 1, offset: 0.6, easing: "cubic-bezier(.5,0,.75,0)" },
      { transform: `translate(${dx}px,${dy}px) scale(.5)`, opacity: 0.9 },
    ], { duration: 640, delay: retard + i * 45 }, reduit);
    const retirer = () => d.remove();
    if (an) { an.addEventListener("finish", retirer); an.addEventListener("cancel", retirer); } else retirer();
  }
  animer(bourse, [{ transform: "scale(1)" }, { transform: "scale(1.1)", offset: 0.35 }, { transform: "scale(1)" }],
    { duration: 240 + (nombre - 1) * 45, delay: retard + 600, easing: "cubic-bezier(.2,1.3,.4,1)" }, reduit);
}

/** Deux dos de booster sortent du pli et filent vers la boutique (la semaine réclamée). */
export function boosters(couche, depuis, image, reduit) {
  const cible = cibleVisible('#nav-site a[href="#/boutique"]', ".burger");
  if (!couche || !depuis || !cible || reduit) return;
  const a = centre(depuis), b = centre(cible.getBoundingClientRect());
  [0, 1].forEach((i) => {
    const im = document.createElement("img");
    im.src = image;
    im.alt = "";
    im.className = "msn-booster-vol";
    im.style.left = `${a.x - 13 + i * 8}px`;
    im.style.top = `${a.y - 19}px`;
    couche.appendChild(im);
    const s = i ? 1 : -1;
    const an = animer(im, [
      { transform: `translate(0,0) rotate(${s * 8}deg) scale(1)`, opacity: 1, easing: "cubic-bezier(.2,.8,.3,1)" },
      { transform: `translate(${s * 14}px,-48px) rotate(${s * 14}deg) scale(1.3)`, opacity: 1, offset: 0.28, easing: "cubic-bezier(.6,0,.4,1)" },
      { transform: `translate(${b.x - a.x - i * 8}px,${b.y - a.y}px) rotate(${s * 20}deg) scale(.35)`, opacity: 0.6 },
    ], { duration: 760, delay: i * 90 }, reduit);
    const retirer = () => im.remove();
    if (an) { an.addEventListener("finish", retirer); an.addEventListener("cancel", retirer); } else retirer();
  });
  animer(cible, [{ transform: "scale(1)" }, { transform: "scale(1.12)", offset: 0.35 }, { transform: "scale(1)" }],
    { duration: 260, delay: 820, easing: "cubic-bezier(.2,1.3,.4,1)" }, reduit);
}

/** La lampe derrière Bodégué s'avive un instant. */
export const lampe = (el, reduit) =>
  animer(el, [{ opacity: 0.75 }, { opacity: 1, offset: 0.3 }, { opacity: 0.75 }], { duration: 900, easing: "ease-out" }, reduit);

/** Une jauge monte de `de` à `a` (parts de 0 à 1). */
export const jauge = (el, de, a, retard, reduit) =>
  animer(el, [{ transform: `scaleX(${de})` }, { transform: `scaleX(${a})` }],
    { duration: 500, delay: retard || 0, easing: "cubic-bezier(.2,.8,.3,1)" }, reduit);

/** Une mission vient d'être remplie : la mèche s'allume. */
export const allumer = (article, reduit) => {
  animer(article?.querySelector(".msn-lueur-b"), [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0.6, offset: 0.55 }, { opacity: 1 }],
    { duration: 520, delay: 380, easing: "ease-out" }, reduit);
};

/** Le billet est repris : il glisse vers Bodégué et s'efface. */
export function reprendre(article, versX, reduit) {
  return animer(article, [{ transform: "none", opacity: 1 }, { transform: `translate(${versX}px,-46px) rotate(-4deg) scale(.9)`, opacity: 0 }],
    { duration: 260, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }, reduit);
}

/** Un billet neuf est posé. */
export const poser = (article, retard, reduit) =>
  animer(article, [{ transform: "translateY(-20px) rotate(3deg) scale(1.03)", opacity: 0 }, { transform: "none", opacity: 1 }],
    { duration: 340, delay: retard || 0, easing: "cubic-bezier(.2,.8,.3,1)" }, reduit);

/** La semaine remplie : le sceau rainbow se rompt, le rabat s'ouvre, la lueur monte. */
export function ouvrirPli(pli, reduit) {
  if (!pli) return;
  animer(pli.querySelector(".msn-rabat"), [{ transform: "perspective(700px) rotateX(0deg)" }, { transform: "perspective(700px) rotateX(180deg)" }],
    { duration: 520, delay: 420, easing: "cubic-bezier(.34,.85,.36,1)" }, reduit);
  animer(pli.querySelector(".msn-sceau-sem"), [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.35)" }],
    { duration: 220, delay: 380, easing: "cubic-bezier(.2,.8,.3,1)" }, reduit);
  animer(pli.querySelector(".msn-lueur-p"), [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 600, easing: "ease-out" }, reduit);
}

/** Le pli se tasse quand les boosters en sortent. */
export const tasserPli = (pli, reduit) =>
  animer(pli, [{ transform: "none" }, { transform: "translateY(3px) scale(.99,.975)", offset: 0.3, easing: "cubic-bezier(.2,1.3,.4,1)" }, { transform: "none" }],
    { duration: 360 }, reduit);

/** La réplique change : fondu et léger glissement. */
export const repliquer = (el, reduit) =>
  animer(el, [{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }],
    { duration: 220, delay: 120, easing: "cubic-bezier(.2,.8,.3,1)" }, reduit);
