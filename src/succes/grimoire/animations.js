/**
 * Les mouvements du grimoire, d'après la note de Claude Design (§ 1,
 * « Chronologie des animations »). API Web Animations seule, et seulement
 * `transform`, `opacity` et `filter`.
 *
 * Trois règles tiennent l'ensemble :
 *  - **Moins d'animations** : `scene.reduit` vrai, aucune animation n'est
 *    créée. Les rappels de fin sont appelés aussitôt, et l'état final est
 *    déjà celui du rendu : les images clés partent d'un état de départ en
 *    `fill: backwards`, jamais d'un état final caché (charte § 5).
 *  - **Un toucher pendant un gain** appelle `finirTout()` : chaque animation
 *    suivie saute à sa fin, les compteurs à leur valeur.
 *  - Rien ici ne touche à la partie : le composant réclame, puis demande
 *    l'effet sur ce qu'il vient de rendre.
 */

const maintenant = () => (typeof performance !== "undefined" ? performance.now() : 0);

/** Courbes de la note. */
export const COURBE = {
  page: "cubic-bezier(.45,.05,.25,1)",
  entree: "cubic-bezier(.2,.8,.3,1)",
  chute: "cubic-bezier(.5,0,.7,.4)",
  vol: "cubic-bezier(.45,.1,.6,1)",
  encre: "cubic-bezier(.4,0,.2,1)",
};

/**
 * Une scène par grimoire monté : l'ensemble des animations en cours, pour
 * pouvoir toutes les finir d'un toucher.
 */
export function creerScene() {
  const vivantes = new Set();
  const scene = {
    reduit: false,

    /** Lance une animation et la suit ; rien si le mouvement est réduit. */
    animer(el, images, options) {
      if (!el || scene.reduit || typeof el.animate !== "function") return null;
      const a = el.animate(images, { fill: "backwards", ...options });
      vivantes.add(a);
      const fin = () => vivantes.delete(a);
      a.addEventListener("finish", fin);
      a.addEventListener("cancel", fin);
      return a;
    },

    /**
     * Un nombre qui compte de `de` à `a` (courbe cubique sortante), suivi
     * comme une animation : `finirTout` le pose à sa valeur finale.
     */
    compter(de, a, { duree = 520, retard = 0 } = {}, surValeur, surFin) {
      if (scene.reduit || de === a || typeof requestAnimationFrame !== "function") {
        surValeur?.(a); surFin?.();
        return null;
      }
      const depart = maintenant() + retard;
      let raf = 0, fini = false, dernier = -Infinity;
      const suivi = {
        finish() {
          if (fini) return;
          fini = true;
          cancelAnimationFrame(raf);
          vivantes.delete(suivi);
          surValeur?.(a); surFin?.();
        },
        cancel() { fini = true; cancelAnimationFrame(raf); vivantes.delete(suivi); },
      };
      const pas = (t) => {
        if (fini) return;
        const k = Math.max(0, Math.min(1, (t - depart) / duree));
        // Un rendu tous les 45 ms suffit à l'œil et épargne React.
        if (t - dernier > 45 || k === 1) {
          dernier = t;
          surValeur?.(Math.round(de + (a - de) * (1 - Math.pow(1 - k, 3))));
        }
        if (k < 1) raf = requestAnimationFrame(pas);
        else suivi.finish();
      };
      vivantes.add(suivi);
      raf = requestAnimationFrame(pas);
      return suivi;
    },

    enCours: () => vivantes.size > 0,

    /** Pose tout à l'état final (un toucher pendant une animation). */
    finirTout() {
      [...vivantes].forEach((a) => { try { a.finish(); } catch { /* déjà finie, ou infinie */ } });
    },

    /** Au démontage : on coupe sans jouer les fins. */
    annulerTout() {
      [...vivantes].forEach((a) => { try { a.cancel(); } catch { /* rien */ } });
      vivantes.clear();
    },
  };
  return scene;
}

/* ── Repères ───────────────────────────────────────────────────────────── */

const centre = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/**
 * Le premier élément visible d'une liste de sélecteurs : la bourse du
 * bandeau, l'entrée « Boutique » de la barre, ou le bouton du menu au
 * téléphone, où la barre est repliée.
 */
export function cibleVisible(...selecteurs) {
  if (typeof document === "undefined") return null;
  for (const s of selecteurs) {
    const el = document.querySelector(s);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

export const bourse = () => cibleVisible(".masthead .bourse", ".bourse");
export const entreeBoutique = () => cibleVisible('.nav a[href="#/boutique"]', ".burger");

/** Un objet volant posé dans la couche, retiré à sa fin. */
function lacher(scene, couche, el, images, options) {
  couche.appendChild(el);
  const a = scene.animer(el, images, { fill: "both", ...options });
  const retirer = () => el.remove();
  if (a) { a.addEventListener("finish", retirer); a.addEventListener("cancel", retirer); } else retirer();
  return a;
}

/* ── Tourner la page ───────────────────────────────────────────────────── */

/**
 * Bureau, 420 ms : une seule feuille à deux faces. Vers l'avant, le recto
 * (`A`, l'ancienne page de droite) tourne de 0 à -180° autour du pli, le
 * verso (`B`, la nouvelle page de gauche) de 180° à 0. L'ombre portée monte
 * sur la face qui part et quitte celle qui arrive.
 * Téléphone, 380 ms : la page part de 0 à -100° et s'efface ; vers
 * l'arrière, elle revient de -100° à 0.
 * `surFin` est appelé une fois, quand toutes les faces ont fini (ou ont été
 * finies d'un toucher).
 */
export function tournerPage(scene, { A, B, bureau, avant }, surFin) {
  const duree = bureau ? 420 : 380;
  const P = bureau ? "perspective(2600px) " : "perspective(1600px) ";
  const lancees = [];
  const jouer = (el, de, a, ombre, extra) => {
    if (!el) return;
    const images = [{ transform: P + de }, { transform: P + a }];
    if (extra) { Object.assign(images[0], extra[0]); Object.assign(images[1], extra[1]); }
    const an = scene.animer(el, images, { duration: duree, easing: COURBE.page, fill: "forwards" });
    if (an) lancees.push(an);
    scene.animer(el.querySelector(".gm-ombre"), ombre, { duration: duree, easing: COURBE.page, fill: "forwards" });
  };
  if (bureau) {
    if (avant) {
      jouer(A, "rotateY(0deg)", "rotateY(-180deg)", [{ opacity: 0 }, { opacity: 0.7 }]);
      jouer(B, "rotateY(180deg)", "rotateY(0deg)", [{ opacity: 0.7 }, { opacity: 0 }]);
    } else {
      jouer(A, "rotateY(0deg)", "rotateY(180deg)", [{ opacity: 0 }, { opacity: 0.7 }]);
      jouer(B, "rotateY(-180deg)", "rotateY(0deg)", [{ opacity: 0.7 }, { opacity: 0 }]);
    }
  } else if (avant) {
    jouer(A, "rotateY(0deg)", "rotateY(-100deg)", [{ opacity: 0 }, { opacity: 0.8 }], [{ opacity: 1 }, { opacity: 0 }]);
  } else {
    jouer(A, "rotateY(-100deg)", "rotateY(0deg)", [{ opacity: 0.8 }, { opacity: 0 }], [{ opacity: 0 }, { opacity: 1 }]);
  }
  if (!lancees.length) { surFin(); return; }
  let restantes = lancees.length, appele = false;
  const fin = () => {
    if (--restantes > 0 || appele) return;
    appele = true;
    surFin();
  };
  lancees.forEach((a) => { a.addEventListener("finish", fin); a.addEventListener("cancel", fin); });
}

/* ── Réclamer ──────────────────────────────────────────────────────────── */

const CHUTE = [
  { transform: "translateY(-30px) scale(1.6) rotate(-28deg)", opacity: 0 },
  { offset: 0.55, opacity: 1 },
  { offset: 0.8, transform: "translateY(0) scale(.92) rotate(-8deg)" },
  { transform: "translateY(0) scale(1) rotate(-8deg)", opacity: 1 },
];

/**
 * Le sceau tombe (260 ms, petit écrasement à 80 %) ; la cire, chaude comme
 * la lampe, refroidit en 760 ms avec un palier à 30 %. `el` contient
 * `.gm-cire-chaude` ; `retard` sert à la cascade de « Tout réclamer ».
 */
export function sceau(scene, el, retard = 0) {
  if (!el) return;
  scene.animer(el, CHUTE, { duration: 260, delay: retard, easing: COURBE.chute });
  scene.animer(el.querySelector(".gm-cire-chaude"), [{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }],
    { duration: 760, delay: retard });
}

/** L'anneau de lampe qui s'élargit autour du médaillon (à 180 ms, 520 ms). */
export function anneau(scene, couche, point, retard = 180) {
  if (!couche || !point || scene.reduit) return;
  const el = document.createElement("div");
  el.className = "gm-anneau";
  el.style.left = `${point.x - 30}px`;
  el.style.top = `${point.y - 30}px`;
  lacher(scene, couche, el, [{ transform: "scale(.6)", opacity: 0.8 }, { transform: "scale(1.9)", opacity: 0 }],
    { duration: 520, delay: retard, easing: COURBE.entree });
}

/** « +10 » de renommée, en `--m-rainbow`, qui monte et s'efface (à 300 ms, 900 ms). */
export function flotter(scene, couche, texte, point, retard = 300) {
  if (!couche || !point || scene.reduit) return;
  const el = document.createElement("div");
  el.className = "gm-flottant";
  el.textContent = texte;
  el.style.left = `${point.x + 18}px`;
  el.style.top = `${point.y - 40}px`;
  lacher(scene, couche, el, [
    { transform: "translateY(8px)", opacity: 0 }, { offset: 0.25, opacity: 1 },
    { offset: 0.75, opacity: 1 }, { transform: "translateY(-22px)", opacity: 0 },
  ], { duration: 900, delay: retard, easing: COURBE.entree });
}

/** Nombre de pièces d'un gain : une par 40 PO, de 3 à 8. */
export const nombrePieces = (po) => (po > 0 ? Math.min(8, Math.max(3, Math.round(po / 40))) : 0);

/**
 * Les pièces filent de `depuis` (un point) vers la bourse du bandeau, 45 ms
 * d'écart, sur un arc de 60 px ; la bourse s'éclaire à leur arrivée. Rend
 * l'instant d'arrivée de la dernière, en ms, pour caler le compteur.
 */
export function pieces(scene, couche, depuis, n, retard) {
  const cible = bourse();
  if (!couche || !depuis || !n || scene.reduit) return 0;
  const b = cible ? centre(cible.getBoundingClientRect()) : depuis;
  for (let i = 0; i < n; i++) {
    const el = document.createElement("div");
    el.className = "gm-piece";
    // Un écart pseudo-aléatoire mais reproductible : deux réclamations
    // identiques dessinent le même vol.
    const sx = ((i * 37) % 23) - 11;
    const x0 = depuis.x - 8 + sx, y0 = depuis.y - 8, x1 = b.x - 8, y1 = b.y - 8;
    const mx = (x0 + x1) / 2 + sx * 3, my = Math.min(y0, y1) - 60 - (i % 3) * 18;
    lacher(scene, couche, el, [
      { transform: `translate(${x0}px,${y0}px) scale(.7)`, opacity: 0 },
      { offset: 0.14, opacity: 1 },
      { offset: 0.5, transform: `translate(${mx}px,${my}px) scale(1.05)` },
      { transform: `translate(${x1}px,${y1}px) scale(.6)`, opacity: 0.85 },
    ], { duration: 560, delay: retard + i * 45, easing: COURBE.vol });
  }
  scene.animer(cible, [{ filter: "brightness(1)" }, { filter: "brightness(1.7)" }, { filter: "brightness(1)" }],
    { duration: 320, delay: retard + 520 });
  return retard + 560 + (n - 1) * 45;
}

/** Les dos de booster filent vers « Boutique », 5 au plus, 70 ms d'écart. */
export function boosters(scene, couche, depuis, n, retard, image) {
  const cible = entreeBoutique();
  if (!couche || !depuis || !n || scene.reduit) return;
  const b = cible ? centre(cible.getBoundingClientRect()) : depuis;
  const nb = Math.min(5, n);
  for (let i = 0; i < nb; i++) {
    const el = document.createElement("img");
    el.className = "gm-vol-dos";
    el.src = image;
    el.alt = "";
    const sx = ((i * 37) % 23) - 11, rot = -14 + i * 7;
    const x0 = depuis.x - 14 + sx, y0 = depuis.y - 21, x1 = b.x - 14, y1 = b.y - 21;
    const mx = (x0 + x1) / 2 + sx * 3, my = Math.min(y0, y1) - 60 - (i % 3) * 18;
    lacher(scene, couche, el, [
      { transform: `translate(${x0}px,${y0}px) scale(.7) rotate(0deg)`, opacity: 0 },
      { offset: 0.14, opacity: 1 },
      { offset: 0.5, transform: `translate(${mx}px,${my}px) scale(1.05) rotate(${rot}deg)` },
      { transform: `translate(${x1}px,${y1}px) scale(.45) rotate(${rot * 2}deg)`, opacity: 0.85 },
    ], { duration: 620, delay: retard + i * 70, easing: COURBE.vol });
  }
  scene.animer(cible, [{ filter: "brightness(1)" }, { filter: "brightness(1.8)" }, { filter: "brightness(1)" }],
    { duration: 320, delay: retard + 620 + (nb - 1) * 70 });
}

/** Le ruban du titre se déroule sous le médaillon, son texte en fondu 220 ms plus tard. */
export function ruban(scene, el, retard) {
  if (!el) return;
  scene.animer(el, [{ transform: "translateX(-50%) scaleX(0)" }, { transform: "translateX(-50%) scaleX(1)" }],
    { duration: 380, delay: retard, easing: COURBE.entree });
  scene.animer(el.querySelector(".gm-ruban-texte"), [{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: retard + 220 });
}

/** Un trait d'avancement monte de `de` à `a` (parts de 0 à 1), 700 ms. */
export function jauge(scene, el, de, a, retard = 0) {
  if (!el || de === a) return;
  scene.animer(el, [{ transform: `scaleX(${de})` }, { transform: `scaleX(${a})` }],
    { duration: 700, delay: retard, easing: COURBE.entree });
}

/* ── Exploit, titre ────────────────────────────────────────────────────── */

/**
 * La tache d'encre se lève (900 ms : opacité, flou, échelle) ; le seuil
 * apparaît dessous à +300 sur 700 ms. `surFin` ouvre la note.
 */
export function revelerExploit(scene, tache, chiffre, surFin) {
  scene.animer(chiffre, [{ opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)" }],
    { duration: 700, delay: 300, easing: COURBE.entree });
  const a = scene.animer(tache, [
    { opacity: 1, filter: "blur(0px)", transform: "scale(1)" },
    { opacity: 0, filter: "blur(7px)", transform: "scale(1.4)" },
  ], { duration: 900, easing: COURBE.encre, fill: "forwards" });
  if (!a) { surFin?.(); return; }
  let appele = false;
  const fin = () => { if (!appele) { appele = true; surFin?.(); } };
  a.addEventListener("finish", fin);
  a.addEventListener("cancel", fin);
}

/** Le titre affiché remonte en fondu de 5 px (260 ms). */
export function titreAffiche(scene, elements) {
  for (const el of elements || []) {
    scene.animer(el, [{ opacity: 0, transform: "translateY(5px)" }, { opacity: 1, transform: "none" }],
      { duration: 260, easing: COURBE.entree });
  }
}
