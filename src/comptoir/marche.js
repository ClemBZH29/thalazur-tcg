import { SLOTS, REVENTE, ECONOMIE, TIER_INFO } from "../config/tiers.js";
import { affinite, norm } from "./acheteurs.js";

/**
 * LE COMPTOIR — marché de l'occasion.
 *
 * Le module d'origine cotait un set inventé de cent cinquante-huit cartes et
 * simulait cent vingt collectionneurs pour faire bouger les prix. Ici le
 * marché cote la vraie collection, et la foule de collectionneurs a été
 * remplacée par un flux agrégé : chaque carte a un stock d'équilibre déduit de
 * sa probabilité de tirage, vers lequel le rayon dérive jour après jour, avec
 * un bruit tiré d'une graine.
 *
 * Ce n'est pas un raccourci de paresse. Cent vingt collectionneurs, il fallait
 * les écrire dans le stockage local et les rejouer à chaque jour écoulé ; le
 * flux agrégé tient en deux tableaux, se rattrape en une passe, et produit à
 * l'écran exactement ce que le joueur percevait — des prix qui montent, des
 * rayons qui se vident, une bourse qui s'épuise.
 *
 * ── Le prix d'une carte ───────────────────────────────────────────────────
 * L'ancrage part du prix de revente garanti par l'app, pas d'une échelle
 * inventée. Une carte vaut `REVENTE[palier] × RATIO`, corrigé de sa rareté
 * propre à l'intérieur du palier et de sa désirabilité. La conséquence tient
 * en une phrase : le Comptoir paie toujours au moins ce que l'échoppe
 * automatique payait, sinon y aller serait une punition.
 */

export const CFG = {
  ratio: 2.4,          // ce que le marché paie, en multiple de la revente garantie
  alphaIntra: 0.55,    // compression de la rareté à l'intérieur d'un palier
  beta: 0.75,          // sensibilité du prix au remplissage du rayon
  tension: 0.75,       // rayon visé, en fraction du rayon d'équilibre
  plafond: 3,          // prix maximal, en multiple de l'ancrage
  margeVente: 2.6,     // marge de l'échoppe quand c'est elle qui vend
  rayon: 6,            // cartes proposées à la vente chaque jour
  spreadBase: 0.06,
  spreadIlliquide: 0.30,
  frais: 0.05,         // commission de l'échoppe sur un rachat
  plafondRachat: 1.80, // ce que l'échoppe accepte de payer, en multiple d'ancrage
  boostersJour: 90,    // boosters ouverts chaque jour dans la province
  partSurplus: 0.42,   // part des cartes tirées qui finissent en surplus
  appetit: 0.09,       // fraction du rayon écoulée chaque jour
  derive: 0.28,        // vitesse de retour du rayon vers son équilibre
  bruit: 0.22,         // amplitude du bruit quotidien
  partRachat: 0.35,    // part du prix d'un booster qui alimente la bourse
  fondsMax: 26000,
};

/** Journée de référence. Le jour 14 du module reste le premier jour du site. */
const EPOCH = Date.UTC(2026, 0, 1);
const JOUR_UN = 14;

/**
 * Le jour, indexé sur la date réelle et non sur un bouton. Les acheteurs
 * tournent avec le calendrier : on revient demain, on ne rejoue pas la journée.
 * Minuit local plutôt qu'UTC, parce qu'un joueur change de jour quand il
 * change de jour.
 */
export function jourCourant(maintenant = new Date()) {
  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const decalage = minuit.getTimezoneOffset() * 60000;
  return JOUR_UN + Math.floor((minuit.getTime() - decalage - EPOCH) / 86400000);
}

/** Générateur à graine : deux visiteurs du même jour voient le même marché. */
function alea(graine) {
  let s = (graine >>> 0) || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 1e6) / 1e6;
  };
}

/** Espérance de cartes par palier et par booster, lue sur les tables. */
export function esperances(taux) {
  const e = {};
  SLOTS.forEach((table) => {
    for (const [tier, p] of Object.entries(table)) e[tier] = (e[tier] || 0) + p;
  });
  e.fullart = taux.fullart;
  e.pj = taux.pj;
  return e;
}

/** Les mots sur lesquels les acheteurs reconnaissent une carte. */
function motsDe(carte) {
  const m = new Set();
  const ajouter = (v) => {
    const n = norm(v);
    if (!n) return;
    m.add(n);
    n.split(/[^a-z0-9]+/).forEach((w) => { if (w.length > 2) m.add(w); });
  };
  ajouter(carte.rep1);
  ajouter(carte.rep3);
  ajouter(carte.race);
  ajouter(carte.nom);
  return m;
}

/**
 * Désirabilité : stable pour une carte donnée, dérivée de son identifiant.
 * Une valeur tirée à chaque chargement ferait danser les prix sans raison.
 */
function desirabilite(carte) {
  let h = 2166136261;
  const s = String(carte.id);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  const r = alea(h >>> 0);
  const g = (r() + r() + r() - 1.5) * 0.7;   // somme de trois tirages : cloche
  return Math.exp(g * 0.35);
}

/**
 * Construit le marché d'une extension : un article par case de la
 * bibliothèque, donc deux par carte — normale et rainbow sont deux objets de
 * collection distincts, et la rainbow est trente-trois fois plus rare.
 */
export function construireMarche(jeuComplet, taux) {
  const esp = esperances(taux);
  const parPalier = {};
  jeuComplet.forEach((c) => { parPalier[c.tier] = (parPalier[c.tier] || 0) + 1; });

  const multRainbow = Math.pow(1 / Math.max(0.0005, taux.rainbow), CFG.alphaIntra);
  const articles = [];

  for (const carte of jeuComplet) {
    const n = parPalier[carte.tier] || 1;
    const espPalier = esp[carte.tier] || 0.001;
    const pPalier = espPalier / n;                 // probabilité de la carte, toutes versions
    const mots = motsDe(carte);
    const des = desirabilite(carte);
    const socle = REVENTE[carte.tier] || 2;

    for (const version of ["normale", "rainbow"]) {
      const estRainbow = version === "rainbow";
      const p = pPalier * (estRainbow ? taux.rainbow : 1 - taux.rainbow);
      const eq = Math.max(0.3, (p * CFG.boostersJour * CFG.partSurplus) / CFG.appetit);
      // La rainbow tombe une fois sur trente-trois : l'exposant de compression
      // en fait sept fois le prix de la normale, pas trente-trois.
      const ancrage = socle * CFG.ratio * des * (estRainbow ? multRainbow : 1);
      articles.push({
        id: `${carte.id}#${estRainbow ? "r" : "n"}`,
        carteId: carte.id,
        version, rainbow: estRainbow, carte,
        tier: carte.tier,
        p: Math.max(p, 1e-9),
        ancrage,
        plancher: socle,      // l'échoppe ne paiera jamais moins que la revente garantie
        des,
        mots,
        meta: des > 1.12,
        // Équilibre du rayon : proportionnel à ce que la province déverse.
        equilibre: eq,
        // Ce que l'échoppe cherche à tenir : une échoppe stocke beaucoup de
        // communes et une seule légendaire. Un rayon visé constant écrasait
        // tous les paliers sur le plancher de revente garantie.
        cible: Math.max(0.6, eq * CFG.tension),
      });
    }
  }
  return articles;
}

/* ── Le marché ─────────────────────────────────────────────────────────────── */

export class Marche {
  constructor(articles, sauve, jour) {
    this.articles = articles;
    this.parId = Object.fromEntries(articles.map((a) => [a.id, a]));
    this.jour = jour;
    this.stock = {};
    this.stockPrec = {};
    this.fonds = CFG.fondsMax * 0.7;
    this.verses = 0;
    this.encaisses = 0;
    this.marchandages = {};
    this.journal = [];

    if (sauve && sauve.jour) {
      this.stock = sauve.stock || {};
      this.stockPrec = sauve.stockPrec || {};
      this.fonds = typeof sauve.fonds === "number" ? sauve.fonds : this.fonds;
      this.verses = sauve.verses || 0;
      this.encaisses = sauve.encaisses || 0;
      this.marchandages = sauve.marchandages || {};
      this.journal = sauve.journal || [];
      const ecoules = jour - sauve.jour;
      if (ecoules > 0) this.avancer(sauve.jour, Math.min(ecoules, 21));
      else if (ecoules < 0) this.avancer(jour, 1);  // horloge reculée : on repart
    } else {
      // Première visite : le rayon est déjà garni, on n'ouvre pas une échoppe vide.
      articles.forEach((a) => { this.stock[a.id] = a.equilibre; });
      this.avancer(jour - 3, 3);
    }
    this.jour = jour;
  }

  /** Rejoue les journées écoulées : dérive du rayon, bourse renflouée. */
  avancer(depuis, nombre) {
    for (let k = 0; k < nombre; k++) {
      const j = depuis + k;
      const r = alea((j * 2654435761) >>> 0);
      this.stockPrec = { ...this.stock };
      for (const a of this.articles) {
        const s = this.stock[a.id] ?? a.equilibre;
        const bruit = 1 + (r() * 2 - 1) * CFG.bruit;
        const cible = a.equilibre * bruit;
        this.stock[a.id] = Math.max(0, s + (cible - s) * CFG.derive);
      }
      this.fonds = Math.min(
        CFG.fondsMax,
        this.fonds + CFG.boostersJour * ECONOMIE.prix * CFG.partRachat
      );
      // Un marchandage ne survit pas à la nuit : c'est ce qui empêche de
      // relancer un dé jusqu'à obtenir la bonne offre.
      this.marchandages = {};
    }
  }

  /* ── Cotation ───────────────────────────────────────────────────────────── */

  mid(a, stock) {
    const s = Math.max(stock === undefined ? this.stock[a.id] ?? a.equilibre : stock, 0.25);
    const brut = a.ancrage * Math.pow(a.cible / s, CFG.beta);
    return Math.min(CFG.plafond * a.ancrage, Math.max(a.plancher, brut));
  }

  cotation(a, stock) {
    const s = stock === undefined ? this.stock[a.id] ?? a.equilibre : stock;
    const m = this.mid(a, s);
    const sp = CFG.spreadBase + CFG.spreadIlliquide / (1 + s);
    const brut = Math.min(m * (1 - sp / 2), CFG.plafondRachat * a.ancrage) * (1 - CFG.frais);
    return {
      // L'échoppe ne revend pas au prix où elle rachète : sa marge sur les
      // pièces à l'unité est ce qui garde le booster intéressant. Sans elle,
      // cent vingt PO achetaient douze cartes choisies et personne n'ouvrait
      // plus rien.
      ask: m * (1 + sp / 2) * CFG.margeVente,
      // Le plancher est une promesse de l'app : la revente garantie du palier.
      bid: Math.max(a.plancher, brut),
    };
  }

  /** Le rayon s'est-il vidé depuis hier ? Un rayon qui se vide fait un prix qui monte. */
  hausse(a) {
    const p = this.stockPrec[a.id];
    const s = this.stock[a.id];
    return typeof p === "number" && typeof s === "number" && p > 0.4 && s < p * 0.94;
  }

  traits(a) {
    return {
      tier: a.tier, type: a.carte.type, race: a.carte.race, mots: a.mots,
      meta: a.meta, rainbow: a.rainbow, hausse: this.hausse(a),
      citation: !!a.carte.citation,
    };
  }

  affinite(a, acheteur) { return affinite(this.traits(a), acheteur); }

  offreUnitaire(a, acheteur, stock) {
    const aff = this.affinite(a, acheteur);
    if (!aff) return 0;
    const { bid } = this.cotation(a, stock);
    return Math.min(bid * acheteur.mult * aff, CFG.plafondRachat * a.ancrage);
  }

  /**
   * Un lot ne se paie pas au prix unitaire : chaque exemplaire supplémentaire
   * garnit le rayon, donc fait baisser le suivant. Vendre gros a un coût.
   */
  offreLot(a, acheteur, qte, facteur = 1) {
    const base = this.stock[a.id] ?? a.equilibre;
    let total = 0;
    for (let k = 0; k < qte; k++) total += this.offreUnitaire(a, acheteur, base + k) * facteur;
    return total;
  }

  meilleurAcheteur(a, acheteurs) {
    const candidats = acheteurs.filter((b) => this.affinite(a, b) > 0);
    if (!candidats.length) return null;
    return candidats.sort((x, y) => this.offreUnitaire(a, y) - this.offreUnitaire(a, x))[0];
  }

  /* ── Transactions ───────────────────────────────────────────────────────── */

  /** L'échoppe paie. Renvoie le montant, ou null si la bourse est à sec. */
  payer(a, prix) {
    const net = Math.min(prix, CFG.plafondRachat * a.ancrage);
    if (this.fonds < net) return null;
    this.fonds -= net;
    this.verses += net;
    this.stock[a.id] = (this.stock[a.id] ?? a.equilibre) + 1;
    return net;
  }

  /** L'échoppe vend. Renvoie le prix, ou null si le rayon est vide. */
  vendreAuJoueur(a) {
    const s = this.stock[a.id] ?? a.equilibre;
    if (s < 1) return null;
    const { ask } = this.cotation(a);
    this.stock[a.id] = s - 1;
    this.fonds += ask;
    this.encaisses += ask;
    return ask;
  }

  cleMarchandage(acheteurId, articleId) { return `${acheteurId}|${articleId}`; }

  marchandage(acheteurId, articleId) {
    return this.marchandages[this.cleMarchandage(acheteurId, articleId)] || null;
  }

  marchander(acheteur, a, tirage = Math.random()) {
    const cle = this.cleMarchandage(acheteur.id, a.id);
    if (this.marchandages[cle]) return this.marchandages[cle];
    const ok = tirage < acheteur.chance;
    this.marchandages[cle] = { ok, facteur: ok ? 1 + acheteur.up : 1 - acheteur.down };
    return this.marchandages[cle];
  }

  noter(texte, po = 0) {
    this.journal.unshift({ jour: this.jour, texte, po });
    if (this.journal.length > 60) this.journal.pop();
  }

  /**
   * Garde-fous de calibration. Le second est le pire cas : meilleur acheteur
   * possible, affinité maximale, marchandage réussi. C'est lui qui dit si le
   * Comptoir ouvre une machine à pièces d'or.
   */
  gardeFous(acheteurs) {
    let liq = 0;
    let liqMax = 0;
    const meilleurMult = acheteurs.reduce((m, b) => Math.max(m, b.mult * (1 + b.up)), 1) * 1.15;
    for (const a of this.articles) {
      const { bid } = this.cotation(a);
      liq += a.p * bid;
      liqMax += a.p * Math.min(bid * meilleurMult, CFG.plafondRachat * a.ancrage);
    }
    // Cinq cartes par booster, et l'espérance est déjà par booster : la somme
    // des p vaut le contenu d'un booster, pas d'une carte.
    return { liq: liq / ECONOMIE.prix, liqMax: liqMax / ECONOMIE.prix };
  }

  /**
   * Le rayon du jour. L'échoppe ne déballe pas ses huit cents cases : elle
   * sort une poignée de pièces, tirée de la graine du jour et pondérée par le
   * rayon, donc surtout des cartes courantes et une légendaire de loin en
   * loin. On revient demain pour voir ce qui est arrivé.
   *
   * Sans cette limite le marché complet cassait la collection : une peu
   * commune à vingt-huit PO signifiait quatre cartes choisies pour le prix
   * d'un booster, et plus personne n'ouvrait de sachet.
   */
  rayonDuJour() {
    const r = alea(((this.jour + 1) * 40503) >>> 0);
    const dispo = this.articles.filter((a) => (this.stock[a.id] ?? 0) >= 1);
    if (!dispo.length) return [];
    // Tirage sans remise, pondéré par le rayon : ce qui abonde se présente
    // souvent, ce qui manque presque jamais.
    const restants = dispo.slice();
    const poids = restants.map((a) => Math.pow(this.stock[a.id], 0.6));
    const sortie = [];
    let total = poids.reduce((s, p) => s + p, 0);
    while (sortie.length < Math.min(CFG.rayon, restants.length) && total > 0) {
      let seuil = r() * total;
      let i = 0;
      while (i < restants.length - 1 && (seuil -= poids[i]) > 0) i++;
      sortie.push(restants[i]);
      total -= poids[i];
      restants.splice(i, 1);
      poids.splice(i, 1);
    }
    return sortie;
  }

  medianeAsk(tier) {
    const v = this.articles.filter((a) => a.tier === tier && !a.rainbow)
      .map((a) => this.cotation(a).ask).sort((x, y) => x - y);
    return v.length ? v[Math.floor(v.length / 2)] : 0;
  }

  /** Ce qui part dans le stockage local : deux tableaux et quatre nombres. */
  serialiser() {
    const arrondir = (o) => {
      const out = {};
      for (const [k, v] of Object.entries(o)) out[k] = Math.round(v * 100) / 100;
      return out;
    };
    return {
      jour: this.jour,
      stock: arrondir(this.stock),
      stockPrec: arrondir(this.stockPrec),
      fonds: Math.round(this.fonds),
      verses: Math.round(this.verses),
      encaisses: Math.round(this.encaisses),
      marchandages: this.marchandages,
      journal: this.journal,
    };
  }
}

export const PALIER_NOM = (tier) => TIER_INFO[tier]?.nom || tier;
