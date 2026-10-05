/**
 * Cérémonies d'ouverture des deux paliers au-delà du légendaire : la full art
 * et la carte PJ.
 *
 * Les deux partagent une même grammaire, que le joueur doit reconnaître dès la
 * deuxième fois sans rien lire :
 *
 *   montée        la lumière dessine le contour de la carte, du losange du
 *                 haut vers celui du bas, puis fuit par ses quatre bords ;
 *   retournement  le contour lâche la carte, l'illustration apparaît sans
 *                 cadre et déborde derrière elle, puis le cadre se referme ;
 *   face          le nom s'écrit à la lumière, puis la série, puis le palier.
 *
 * La légendaire ne connaît que la lueur ronde et les particules qui
 * convergent : rien de ce vocabulaire ne lui appartient. La full art joue la
 * partition en or sur cramoisi ; la PJ la joue plus lentement, en argent et
 * lumière de lune, dans un noir presque total.
 *
 * Ouverture.jsx garde le tempo (brief, § 5) : ce module ne fait que peindre
 * par-dessus. Ses calques sont décoratifs, `aria-hidden`, et ne prennent aucun
 * pointeur (ceremonies.css). Les animations posées sur la carte elle-même
 * (.cardbox, .fenetre, .cadre, .teinte) n'ont jamais de `fill` : elles rendent
 * la carte intacte en finissant, et `nettoyer()` les annule sur-le-champ.
 */

const PALETTES = {
  fullart: {
    classe: "cer-fullart",
    palier: null,         // pas de mention de palier : le nom et la série suffisent
    voile: 0.82,          // assombrissement pendant la montée
    voileFace: 0.5,       // … et une fois la carte de face
    trace: [0.1, 0.5],    // début et durée du contour, en fractions de la montée
    fentes: [0.5, 0.5],   // début et durée de la lumière qui fuit par les bords
    debord: 0.9,          // opacité maximale de l'illustration hors du cadre
    rangement: 450,       // ms au-delà du retournement pour que le cadre se referme
    eclat: 760,           // passage de lumière sur la face
    lettre: { pas: 38, duree: 520, chaude: "#fff4d6", encre: "#f4c974" },
  },
  pj: {
    classe: "cer-pj",
    palier: "Carte PJ",
    voile: 0.95,
    voileFace: 0.7,
    trace: [0.26, 0.46],  // un temps de silence dans le noir avant le contour
    fentes: [0.6, 0.4],
    debord: 0.62,
    rangement: 600,
    eclat: 1000,
    lettre: { pas: 56, duree: 720, chaude: "#ffffff", encre: "#e6edf5" },
  },
};

/** Le contour d'une carte 2/3 à coins arrondis (3,7 % de la largeur), en deux
 *  moitiés qui partent du losange du haut et se rejoignent à celui du bas. */
const NS = "http://www.w3.org/2000/svg";
const BORD_DROIT = "M100 0H192.6A7.4 7.4 0 0 1 200 7.4V292.6A7.4 7.4 0 0 1 192.6 300H100";
const BORD_GAUCHE = "M100 0H7.4A7.4 7.4 0 0 0 0 7.4V292.6A7.4 7.4 0 0 0 7.4 300H100";
const OMBRE_TEXTE = "0 1px 2px rgba(0,0,0,.6)";

const memeCarte = (a, b) =>
  Boolean(a && b) && a.tier === b.tier && a.nom === b.nom && (a.serie ?? null) === (b.serie ?? null);

/** Une promesse qu'on tient de l'extérieur. Tenue deux fois, elle ne bouge plus. */
function promesse() {
  let tenir;
  const p = new Promise((r) => { tenir = r; });
  return { promesse: p, tenir: () => tenir() };
}

export function creerCeremonie({ scene, carte, reduit = () => false }) {
  const calques = new Set();
  const anims = new Set();
  const minuteurs = new Set();

  let courante = null;      // la carte en cérémonie
  let pal = null;           // sa palette
  let cq = {};              // calques nommés : voile, aura, trace, fentes
  let cartouche = null;
  let nomDemande = false;
  let nom = null;           // promesse tenue quand le nom est lisible

  const pile = () => carte()?.parentElement ?? null;
  const boite = () => carte()?.querySelector(".cardbox") ?? null;
  const estReduit = () => {
    if (reduit()) return true;
    const s = scene();
    return Boolean(s && s.closest('[data-mouvement="reduit"]'));
  };
  const classes = (c) => `${PALETTES[c.tier].classe}${c.rainbow ? " cer-arc" : ""}`;

  function animer(el, images, options) {
    if (!el || typeof el.animate !== "function") return Promise.resolve();
    const a = el.animate(images, options);
    anims.add(a);
    return a.finished.then(() => {}, () => {}).finally(() => anims.delete(a));
  }

  function attendre(fn, ms) {
    const id = setTimeout(() => { minuteurs.delete(id); fn(); }, ms);
    minuteurs.add(id);
  }

  function calque(parent, cls, devant = false) {
    const el = document.createElement("div");
    el.className = cls;
    el.setAttribute("aria-hidden", "true");
    if (devant) parent.insertBefore(el, parent.firstChild);
    else parent.appendChild(el);
    calques.add(el);
    return el;
  }

  function retirer(el) {
    el.remove();
    calques.delete(el);
  }

  const opacite = (el) => Number(getComputedStyle(el).opacity) || 0;

  function dessinerTrace(el) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 200 300");
    svg.setAttribute("preserveAspectRatio", "none");
    for (const cls of ["halo", "coeur"]) {
      for (const d of [BORD_DROIT, BORD_GAUCHE]) {
        const t = document.createElementNS(NS, "path");
        t.setAttribute("d", d);
        t.setAttribute("pathLength", "1");
        t.setAttribute("class", cls);
        svg.appendChild(t);
      }
    }
    el.appendChild(svg);
  }

  /** Calques de base, posés d'emblée. Sert quand on arrive au retournement ou
   *  à la face sans être passé par la montée (reprise, appel isolé). */
  function assurer(c) {
    if (!PALETTES[c?.tier]) return false;
    if (memeCarte(courante, c) && cq.voile) return true;
    nettoyer();
    const sc = scene(), pl = pile();
    if (!sc || !pl) return false;
    courante = c;
    pal = PALETTES[c.tier];
    const cls = classes(c);
    cq.voile = calque(sc, `cer-voile ${cls}`, true);
    cq.voile.style.opacity = String(pal.voile);
    cq.aura = calque(pl, `cer-aura ${cls}`, true);
    cq.trace = calque(pl, `cer-trace cer-reduit ${cls}`);
    dessinerTrace(cq.trace);
    return true;
  }

  /* --- Montée --------------------------------------------------------- */

  function montee(c, ms) {
    nettoyer();
    const sc = scene(), pl = pile();
    if (!PALETTES[c?.tier] || !sc || !pl) return Promise.resolve();
    courante = c;
    pal = PALETTES[c.tier];
    const red = estReduit();
    const cls = classes(c);
    const fin = [];

    cq.voile = calque(sc, `cer-voile ${cls}`, true);
    cq.aura = calque(pl, `cer-aura ${cls}`, true);
    cq.trace = calque(pl, `cer-trace ${cls}${red ? " cer-reduit" : ""}`);
    dessinerTrace(cq.trace);

    fin.push(animer(cq.voile, [{ opacity: 0 }, { opacity: pal.voile }],
      { duration: ms * (red ? 0.5 : 0.4), easing: "ease-out", fill: "forwards" }));

    if (red) {
      // Un fondu seul : le contour apparaît déjà tracé.
      fin.push(animer(cq.trace, [{ opacity: 0 }, { opacity: 1 }],
        { duration: ms * 0.5, delay: ms * 0.3, easing: "ease-in-out", fill: "both" }));
      return Promise.all(fin);
    }

    // 1. La lumière dessine le contour, des deux côtés à la fois.
    const [t0, td] = pal.trace;
    cq.trace.querySelectorAll("path").forEach((t) => {
      fin.push(animer(t, [
        { strokeDashoffset: 1, opacity: 0 },
        { opacity: 1, offset: 0.06 },
        { strokeDashoffset: 0, opacity: 1 },
      ], { duration: ms * td, delay: ms * t0, easing: "cubic-bezier(.5,0,.25,1)", fill: "both" }));
    });

    // 2. Puis elle fuit par les quatre bords : la carte est trop pleine pour
    //    son propre contour.
    const [f0, fd] = pal.fentes;
    cq.fentes = calque(pl, `cer-fentes ${cls}`);
    for (const [cote, axe] of [["h", "scaleY"], ["b", "scaleY"], ["g", "scaleX"], ["d", "scaleX"]]) {
      const i = document.createElement("i");
      i.className = cote;
      cq.fentes.appendChild(i);
      fin.push(animer(i, [
        { opacity: 0, transform: `${axe}(0)` },
        { opacity: 0.8, transform: `${axe}(.5)`, offset: 0.6 },
        { opacity: 1, transform: `${axe}(1)` },
      ], { duration: ms * fd, delay: ms * f0, easing: "cubic-bezier(.5,0,.75,.5)", fill: "both" }));
    }

    // 3. La carte retient son souffle, puis se contracte juste avant de tourner.
    fin.push(animer(boite(), [
      { transform: "none", easing: "ease-in-out" },
      { transform: "scale(1.035)", offset: 0.8, easing: "ease-in" },
      { transform: "scale(.982)", offset: 0.95, easing: "ease-out" },
      { transform: "none" },
    ], { duration: ms }));

    return Promise.all(fin);
  }

  /* --- Retournement ---------------------------------------------------- */

  function retournement(c, ms) {
    if (!assurer(c)) return Promise.resolve();
    const red = estReduit();
    const pl = pile();
    const cls = classes(c);

    // Le contour lâche la carte : il s'élargit et s'éteint.
    animer(cq.trace,
      red ? [{ opacity: 1 }, { opacity: 0 }]
          : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(1.1)" }],
      { duration: red ? 300 : 520, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" });
    if (cq.fentes) {
      animer(cq.fentes, [{ opacity: 1 }, { opacity: 0 }],
        { duration: 360, easing: "ease-out", fill: "forwards" });
    }
    animer(cq.aura, [{ opacity: 0 }, { opacity: 1 }],
      { duration: red ? 400 : 800, delay: red ? 0 : ms * 0.3, easing: "ease-out", fill: "both" });

    if (!red && pl) deborder(ms, pl, cls);

    demanderNom(c, red ? 0 : ms * 0.6);
    return nom.promesse;
  }

  /** L'illustration sans marges : elle remplit d'abord toute la carte et
   *  déborde derrière elle, puis le cadre se referme dessus. */
  function deborder(ms, pl, cls) {
    const av = carte();
    const fen = av?.querySelector(".plaque .fenetre");
    const cad = av?.querySelector(".plaque .cadre");
    const tei = av?.querySelector(".plaque .teinte");
    const img = fen?.querySelector("img");
    const D = ms + pal.rangement;
    const tenue = 0.36; // la face devient visible vers 20 % du flip : ~200 ms à pleine illustration

    animer(fen, [
      { transform: "scale(1.2)" },
      { transform: "scale(1.2)", offset: tenue, easing: "cubic-bezier(.55,0,.15,1)" },
      { transform: "none" },
    ], { duration: D });
    const fermer = (cible) => [
      { opacity: 0, transform: "scale(1.07)" },
      { opacity: 0, transform: "scale(1.07)", offset: tenue + 0.04, easing: "cubic-bezier(.3,.6,.2,1)" },
      { opacity: cible, transform: "none" },
    ];
    animer(cad, fermer(1), { duration: D });
    if (tei) animer(tei, fermer(opacite(tei)), { duration: D });

    if (img && (img.currentSrc || img.src)) {
      const d = calque(pl, `cer-debord ${cls}`);
      const copie = document.createElement("img");
      copie.src = img.currentSrc || img.src;
      copie.alt = "";
      copie.draggable = false;
      copie.style.objectPosition = img.style.objectPosition;
      d.appendChild(copie);
      animer(d, [
        { opacity: 0, transform: "scale(1.3)" },
        { opacity: pal.debord, transform: "scale(1.18)", offset: 0.3 },
        { opacity: 0, transform: "scale(1.02)" },
      ], { duration: ms + 700, delay: ms * 0.2, easing: "cubic-bezier(.3,.6,.3,1)", fill: "both" });
    }

    const e = calque(pl, `cer-eclat ${cls}`);
    const bande = document.createElement("i");
    e.appendChild(bande);
    animer(bande, [
      { transform: "translateX(-130%) skewX(-16deg)" },
      { transform: "translateX(340%) skewX(-16deg)" },
    ], { duration: pal.eclat, delay: D * 0.42, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" });
  }

  /* --- Face ------------------------------------------------------------ */

  function face(c) {
    if (!assurer(c)) return Promise.resolve();
    animer(cq.voile, [{ opacity: opacite(cq.voile) }, { opacity: pal.voileFace }],
      { duration: 900, easing: "ease-in-out", fill: "forwards" });
    demanderNom(c, 0);
    return nom.promesse;
  }

  function demanderNom(c, delai) {
    if (nomDemande) return;
    nomDemande = true;
    nom = promesse();
    const tenue = nom;
    const ecrire = () => { ecrireNom(c).then(tenue.tenir); };
    if (delai > 0) attendre(ecrire, delai);
    else ecrire();
  }

  function construireCartouche(c) {
    const el = document.createElement("div");
    el.className = `cer-cartouche ${classes(c)}`;
    el.setAttribute("aria-hidden", "true");
    const corps = document.createElement("div");
    corps.className = "cer-cart-corps";
    const voile = document.createElement("div");
    voile.className = "cer-cart-voile";
    const texte = document.createElement("div");
    texte.className = "cer-cart-texte";

    const nomEl = document.createElement("p");
    nomEl.className = "cer-nom";
    const lettres = [];
    String(c.nom || "").normalize("NFC").trim().split(/\s+/).forEach((mot, i) => {
      if (i) nomEl.appendChild(document.createTextNode(" "));
      const m = document.createElement("span");
      m.className = "cer-mot";
      for (const ch of mot) {
        const l = document.createElement("span");
        l.className = "cer-l";
        l.textContent = ch;
        m.appendChild(l);
        lettres.push(l);
      }
      nomEl.appendChild(m);
    });
    texte.appendChild(nomEl);

    let serie = null;
    if (c.serie) {
      serie = document.createElement("p");
      serie.className = "cer-serie";
      serie.textContent = c.serie;
      texte.appendChild(serie);
    }

    let palier = null;
    let filets = [];
    if (PALETTES[c.tier].palier) {
      palier = document.createElement("p");
      palier.className = "cer-palier";
      filets = [document.createElement("i"), document.createElement("i")];
      const mention = document.createElement("span");
      mention.textContent = PALETTES[c.tier].palier;
      palier.append(filets[0], mention, filets[1]);
      texte.appendChild(palier);
    }

    corps.append(voile, texte);
    el.appendChild(corps);
    return { el, corps, voile, lettres, serie, palier, filets };
  }

  /** Écrit le nom à la lumière. Résout quand la dernière lettre est posée. */
  function ecrireNom(c) {
    if (cartouche) return Promise.resolve();
    const bx = boite();
    if (!bx || !pal) return Promise.resolve();
    cartouche = construireCartouche(c);
    bx.appendChild(cartouche.el);
    calques.add(cartouche.el);
    const { corps, voile, lettres, serie, palier, filets } = cartouche;

    // Mouvement réduit : le nom est une information, il apparaît quand même,
    // d'un seul fondu.
    if (estReduit()) {
      return animer(corps, [{ opacity: 0 }, { opacity: 1 }],
        { duration: 420, easing: "ease-out", fill: "both" });
    }

    const L = pal.lettre;
    animer(voile, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: "ease-out", fill: "both" });
    const lisible = lettres.map((l, k) => animer(l, [
      { opacity: 0, transform: "translateY(.24em) scale(1.06)", color: L.chaude, textShadow: `0 0 .6em ${L.chaude}` },
      { opacity: 1, color: L.chaude, textShadow: `0 0 .45em ${L.chaude}`, offset: 0.3 },
      { opacity: 1, transform: "none", color: L.encre, textShadow: OMBRE_TEXTE },
    ], { duration: L.duree, delay: k * L.pas, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" }));

    const apres = lettres.length * L.pas + L.duree * 0.5;
    if (serie) {
      animer(serie, [{ opacity: 0, transform: "translateY(.35em)" }, { opacity: 1, transform: "none" }],
        { duration: 560, delay: apres, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" });
    }
    const apresPalier = apres + (serie ? 220 : 0);
    if (palier) animer(palier, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: apresPalier, fill: "both" });
    filets.forEach((f) => animer(f, [{ transform: "scaleX(0)" }, { transform: "none" }],
      { duration: 640, delay: apresPalier, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" }));

    return Promise.all(lisible);
  }

  /* --- Sortie ---------------------------------------------------------- */

  /** Le joueur glisse la carte (ou touche « Suivante ») : tout s'éteint avec
   *  elle. Pendant le geste, le cartouche suit déjà `--swipe` en CSS. */
  function degager() {
    minuteurs.forEach(clearTimeout);
    minuteurs.clear();
    nom?.tenir();
    const partants = [...calques];
    courante = null; pal = null; cq = {}; cartouche = null; nomDemande = false; nom = null;
    if (!partants.length) return Promise.resolve();
    const fondus = partants.map((el) => {
      const cible = el.classList.contains("cer-cartouche") ? el.firstChild : el;
      return animer(cible, [{ opacity: opacite(cible) }, { opacity: 0 }],
        { duration: 240, easing: "ease-out", fill: "forwards" });
    });
    return Promise.all(fondus).then(() => partants.forEach(retirer));
  }

  /** « Tout ouvrir », départ de la page : rien ne reste, sur-le-champ. */
  function nettoyer() {
    minuteurs.forEach(clearTimeout);
    minuteurs.clear();
    [...anims].forEach((a) => a.cancel());
    anims.clear();
    [...calques].forEach(retirer);
    nom?.tenir();
    courante = null; pal = null; cq = {}; cartouche = null; nomDemande = false; nom = null;
  }

  return { montee, retournement, face, degager, nettoyer };
}
