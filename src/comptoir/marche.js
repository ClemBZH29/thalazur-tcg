import { SLOTS, REVENTE, ECONOMIE, TIER_INFO } from "../config/tiers.js";
import { affinite, norm, factionDe, roleCarte } from "./acheteurs.js";
import { chanceDe } from "./voix.js";

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
  rayon: 5,            // cartes courantes du rayon, en plus de la pièce du jour
  poidsManque: 4,      // une carte qui manque au joueur se présente quatre fois plus
  spreadBase: 0.06,
  spreadIlliquide: 0.30,
  frais: 0.05,         // commission de l'échoppe sur un rachat
  plafondRachat: 1.80, // ce que l'échoppe accepte de payer, en multiple d'ancrage ;
                       // un acheteur a le sien, multiplié par son `mult`
  plafondMult: 1.6,    // … borné ici : sans quoi le Conservateur, à ×1,92, faisait
                       // passer le pire jour au-dessus de 100 % (voir audit-marche)
  boostersJour: 90,    // boosters ouverts chaque jour dans la province
  partSurplus: 0.42,   // part des cartes tirées qui finissent en surplus
  appetit: 0.09,       // fraction du rayon écoulée chaque jour
  derive: 0.28,        // vitesse de retour du rayon vers son équilibre
  bruit: 0.22,         // amplitude du bruit quotidien
  partRachat: 0.35,    // part du prix d'un booster qui alimente la bourse
  fondsMax: 26000,
};

// Le jour vit dans jour.js, que le bandeau du site lit sans charger le marché.
export { jourCourant } from "./jour.js";

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
    const des = desirabilite(carte);
    const socle = REVENTE[carte.tier] || 2;

    // Full art et cartes PJ sont rainbow par nature : le tirage les range
    // toujours en case normale. Leur « version rainbow » était un article
    // fantôme, coté vingt mille PO et jamais vendable.
    const versions = carte.tier === "fullart" || carte.tier === "pj" ? ["normale"] : ["normale", "rainbow"];
    for (const version of versions) {
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
        faction: factionDe(carte),
        role: roleCarte(carte),
        archetype: norm(carte.rep1),
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
    this.achats = {};       // acheteurId -> exemplaires rachetés aujourd'hui
    this.achatsJoueur = {}; // articleId -> true, ce que le joueur a pris au rayon aujourd'hui
    this.vitrine = null;    // { jour, rayon: [ids], piece: id } : la vitrine figée du jour
    this.journal = [];

    if (sauve && sauve.jour) {
      // Les articles retirés du catalogue (la fausse rainbow d'une full art)
      // ne traînent pas dans la sauvegarde.
      const connus = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => k in this.parId));
      this.stock = connus(sauve.stock);
      this.stockPrec = connus(sauve.stockPrec);
      this.fonds = typeof sauve.fonds === "number" ? sauve.fonds : this.fonds;
      this.verses = sauve.verses || 0;
      this.encaisses = sauve.encaisses || 0;
      // Copiés pour la même raison qu'à `serialiser` : ne jamais modifier
      // sur place les objets de la sauvegarde.
      this.marchandages = { ...(sauve.marchandages || {}) };
      this.achats = { ...(sauve.achats || {}) };
      this.achatsJoueur = { ...(sauve.achatsJoueur || {}) };
      this.vitrine = sauve.vitrine || null;
      this.journal = [...(sauve.journal || [])];
      // Jour enregistré à plus d'un jour dans le futur : horloge fausse, ici
      // ou sur un autre appareil du compte. On le tient pour aujourd'hui, sans
      // rien remettre à zéro : le marché ne reste pas bloqué jusqu'à cette
      // date, et l'aller-retour d'horloge ne rend toujours rien.
      if (sauve.jour > jour + 1) sauve = { ...sauve, jour };
      const ecoules = jour - sauve.jour;
      if (ecoules > 0) this.avancer(sauve.jour, Math.min(ecoules, 21));
      // Horloge reculée (ou voyage vers l'ouest) : on ne touche à rien. Le
      // marché « repartait » d'un jour, et l'aller-retour suffisait à rendre
      // quotas, marchandages et pièce du jour, et à regarnir la caisse — sans
      // limite. Seul un jour plus grand que le plus grand déjà vu avance.
    } else {
      // Première visite : le rayon est déjà garni, on n'ouvre pas une échoppe vide.
      articles.forEach((a) => { this.stock[a.id] = a.equilibre; });
      this.avancer(jour - 3, 3);
    }
    this.jour = sauve && sauve.jour ? Math.max(jour, sauve.jour) : jour;
    // L'état en mémoire est celui que relira le prochain chargement : sans
    // cela, le stock arrondi à l'écriture changeait les prix au rechargement
    // (jusqu'à cent PO sur une carte PJ, dont le rayon tient sous l'unité).
    this.arrondir();
  }

  /** Stock au millième, en place : ce qui est affiché est ce qui est sauvé. */
  arrondir() {
    for (const o of [this.stock, this.stockPrec]) {
      for (const [k, v] of Object.entries(o)) o[k] = Math.round(v * 1000) / 1000;
    }
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
      // Le quota repart à zéro avec les acheteurs du lendemain.
      this.achats = {};
      this.achatsJoueur = {};
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
      // Des PO entières : un prix à 8,76 PO ne se compare à rien.
      ask: Math.round(m * (1 + sp / 2) * CFG.margeVente),
      // Le plancher est une promesse de l'app : la revente garantie du palier.
      bid: Math.round(Math.max(a.plancher, brut)),
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
      tier: a.tier, type: a.carte.type, race: a.carte.race,
      faction: a.faction, role: a.role, archetype: a.archetype,
      rainbow: a.rainbow, hausse: this.hausse(a),
      citation: !!a.carte.citation,
    };
  }

  affinite(a, acheteur) { return affinite(this.traits(a), acheteur); }

  /**
   * Le plafond d'un acheteur. Il était le même pour tous, celui de l'échoppe :
   * or le rachat de l'échoppe monte déjà à 1,71 fois l'ancrage quand le rayon
   * est maigre — le cas de toutes les rainbow —, et il ne restait que 5 % pour
   * la prime de l'acheteur. Sorelle et Voren payaient le même prix au
   * centime. Chacun a maintenant le sien, à proportion de son `mult`.
   */
  plafondDe(a, acheteur) {
    return CFG.plafondRachat * Math.min(acheteur.mult, CFG.plafondMult) * a.ancrage;
  }

  /**
   * Ce que l'acheteur paie pour un exemplaire, marchandage compris. Deux
   * promesses, tenues ici et nulle part ailleurs :
   * - le prix affiché est le prix payé (le succès d'un marchandage était
   *   annoncé, puis raboté au paiement par le plafond de l'échoppe) ;
   * - un acheteur ne paie jamais moins que l'échoppe, même après un échec.
   */
  prixAcheteur(a, acheteur, stock, facteur = 1, aff = this.affinite(a, acheteur)) {
    if (!aff) return 0;
    const { bid } = this.cotation(a, stock);
    const offre = Math.min(bid * acheteur.mult * aff, this.plafondDe(a, acheteur));
    return Math.max(bid, Math.round(offre * facteur));
  }

  offreUnitaire(a, acheteur, stock) { return this.prixAcheteur(a, acheteur, stock, 1); }

  /**
   * Un lot ne se paie pas au prix unitaire : chaque exemplaire supplémentaire
   * garnit le rayon, donc fait baisser le suivant. Vendre gros a un coût.
   *
   * L'affinité est figée au début du lot, ici comme dans `vendreLot` : la
   * prime « hausse » d'Ysée et de Voren tombe dès que la vente regarnit le
   * rayon, et le lot se payait jusqu'à 10 % de moins que son annonce. Le prix
   * annoncé est le prix payé.
   */
  offreLot(a, acheteur, qte, facteur = 1) {
    const base = this.stock[a.id] ?? a.equilibre;
    const aff = this.affinite(a, acheteur);
    let total = 0;
    for (let k = 0; k < qte; k++) total += this.prixAcheteur(a, acheteur, base + k, facteur, aff);
    return total;
  }

  /**
   * Vend un lot à un acheteur, au prix de `offreLot`, et le compte sur son
   * quota. S'arrête quand la caisse est à sec : `caisseVide` le dit, pour que
   * la page l'annonce au lieu de ne rien faire.
   */
  vendreLot(a, acheteur, qte, facteur = 1) {
    const aff = this.affinite(a, acheteur);
    let gain = 0;
    let vendus = 0;
    for (let k = 0; k < qte; k++) {
      const paye = this.payer(a, this.prixAcheteur(a, acheteur, this.stock[a.id] ?? a.equilibre, facteur, aff));
      if (paye === null) break;
      gain += paye;
      vendus++;
    }
    if (!vendus) return qte > 0 ? { vendus: 0, gain: 0, caisseVide: true } : { vendus: 0, gain: 0 };
    this.compterAchat(acheteur, vendus);
    return { vendus, gain };
  }

  /** Ce que l'échoppe paierait pour le même lot, à la même pente. */
  rachatLot(a, qte) {
    const base = this.stock[a.id] ?? a.equilibre;
    let total = 0;
    for (let k = 0; k < qte; k++) total += this.cotation(a, base + k).bid;
    return total;
  }

  meilleurAcheteur(a, acheteurs) {
    const candidats = acheteurs.filter((b) => this.affinite(a, b) > 0);
    if (!candidats.length) return null;
    return candidats.sort((x, y) => this.offreUnitaire(a, y) - this.offreUnitaire(a, x))[0];
  }

  /* ── Transactions ───────────────────────────────────────────────────────── */

  /**
   * Le Comptoir paie un montant déjà calculé (`cotation` ou `prixAcheteur`,
   * qui portent chacun leur plafond). Renvoie le montant, ou null si la
   * bourse est à sec. Il ne rabote plus rien : c'est ce rabotage qui
   * faisait mentir l'annonce d'un marchandage réussi.
   */
  payer(a, prix) {
    const net = Math.round(prix);
    if (this.fonds < net) return null;
    this.fonds -= net;
    this.verses += net;
    this.stock[a.id] = (this.stock[a.id] ?? a.equilibre) + 1;
    return net;
  }

  /**
   * L'échoppe vend une case du rayon ou la pièce du jour. Une case ne se
   * vend qu'une fois par jour : c'est une vitrine, pas un stock à vider.
   * Renvoie le prix, ou null si la pièce est déjà partie.
   */
  vendreAuJoueur(a) {
    if (this.achatsJoueur[a.id]) return null;
    const { ask } = this.cotation(a);
    this.stock[a.id] = Math.max(0, (this.stock[a.id] ?? a.equilibre) - 1);
    this.achatsJoueur[a.id] = true;
    this.fonds += ask;
    this.encaisses += ask;
    return ask;
  }

  cleMarchandage(acheteurId, articleId) { return `${acheteurId}|${articleId}`; }

  marchandage(acheteurId, articleId) {
    return this.marchandages[this.cleMarchandage(acheteurId, articleId)] || null;
  }

  /**
   * Un marchandage, un seul par carte et par acheteur dans la journée. La
   * manière de présenter la carte fait la chance (voir `chanceDe`) : c'est
   * ce qui en fait une décision et non plus un pile ou face à espérance
   * connue d'avance.
   */
  marchander(acheteur, a, maniere = null, tirage = Math.random()) {
    const cle = this.cleMarchandage(acheteur.id, a.id);
    if (this.marchandages[cle]) return this.marchandages[cle];
    const ok = tirage < chanceDe(acheteur, maniere);
    this.marchandages[cle] = { ok, maniere, facteur: ok ? 1 + acheteur.up : 1 - acheteur.down };
    return this.marchandages[cle];
  }

  /* ── Le quota du jour ───────────────────────────────────────────────────── */

  /** Exemplaires que l'acheteur rachète encore aujourd'hui. */
  restant(acheteur) {
    return Math.max(0, (acheteur.quota ?? Infinity) - (this.achats[acheteur.id] || 0));
  }

  /** Note une vente sur le quota de l'acheteur. */
  compterAchat(acheteur, n) {
    this.achats[acheteur.id] = (this.achats[acheteur.id] || 0) + n;
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
    // Pire cas : pour chaque article, le meilleur acheteur présent, affinité
    // maximale, marchandage réussi. Le plafond de chacun s'applique avant le
    // marchandage, exactement comme à la vente.
    for (const a of this.articles) {
      const { bid } = this.cotation(a);
      liq += a.p * bid;
      let meilleur = bid;
      for (const b of acheteurs) {
        if (!this.affinite(a, b)) continue;
        const offre = Math.min(bid * b.mult * 1.15, this.plafondDe(a, b)) * (1 + b.up);
        if (offre > meilleur) meilleur = offre;
      }
      liqMax += a.p * meilleur;
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
  rayonDuJour(manque = () => false) {
    const r = alea(((this.jour + 1) * 40503) >>> 0);
    const dispo = this.articles.filter((a) => (this.stock[a.id] ?? 0) >= 1);
    if (!dispo.length) return [];
    // Tirage sans remise, pondéré par le rayon : ce qui abonde se présente
    // souvent, ce qui manque presque jamais. Une carte qui manque au joueur
    // pèse quatre fois plus : à deux cents cartes possédées, le rayon ne
    // montrait plus que des cartes déjà en collection.
    const restants = dispo.slice();
    const poids = restants.map((a) => Math.pow(this.stock[a.id], 0.6) * (manque(a) ? CFG.poidsManque : 1));
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

  /**
   * La pièce du jour : une rare, une légendaire ou une rainbow, tirée de la
   * graine du jour et pondérée par sa rareté, qui ne passerait jamais par le
   * rayon ordinaire (une rainbow n'a qu'un tiers d'exemplaire en rayon). Elle
   * se vend à son prix de marché, sans remise : une rare rainbow vaut une
   * dizaine de boosters, et c'est ce qui en fait une pièce qu'on guette.
   */
  pieceDuJour(manque = () => false) {
    const r = alea(((this.jour + 7) * 2246822519) >>> 0);
    const eligibles = this.articles.filter((a) =>
      (a.rainbow && a.tier !== "fullart" && a.tier !== "pj") || (!a.rainbow && (a.tier === "rare" || a.tier === "legendaire")));
    if (!eligibles.length) return null;
    const poids = eligibles.map((a) => Math.sqrt(a.p) * (manque(a) ? CFG.poidsManque : 1));
    let seuil = r() * poids.reduce((s, p) => s + p, 0);
    let i = 0;
    while (i < eligibles.length - 1 && (seuil -= poids[i]) > 0) i++;
    return eligibles[i];
  }

  /**
   * La vitrine du jour, figée à la première visite : une vente au Comptoir
   * garnit le rayon et un achat complète la collection, et sans ce gel les
   * cases changeaient sous les doigts du joueur. Elle se renouvelle avec le
   * jour.
   */
  vitrineDuJour(manque = () => false) {
    if (!this.vitrine || this.vitrine.jour !== this.jour
        || !this.vitrine.rayon.every((id) => this.parId[id])) {
      const piece = this.pieceDuJour(manque);
      this.vitrine = {
        jour: this.jour,
        rayon: this.rayonDuJour(manque).filter((a) => a !== piece).map((a) => a.id),
        piece: piece ? piece.id : null,
      };
    }
    return {
      piece: this.vitrine.piece ? this.parId[this.vitrine.piece] || null : null,
      rayon: this.vitrine.rayon.map((id) => this.parId[id]).filter(Boolean),
    };
  }

  /** Ce que le joueur a déjà acheté au rayon aujourd'hui : une pièce par case. */
  dejaAchete(a) { return !!this.achatsJoueur[a.id]; }

  medianeAsk(tier) {
    const v = this.articles.filter((a) => a.tier === tier && !a.rainbow)
      .map((a) => this.cotation(a).ask).sort((x, y) => x - y);
    return v.length ? v[Math.floor(v.length / 2)] : 0;
  }

  /**
   * Ce qui part dans le stockage local : deux tableaux et quatre nombres. Le
   * stock est arrondi au millième et l'objet relit cet arrondi (`arrondir`) :
   * les prix d'après le rechargement sont ceux d'avant.
   */
  serialiser() {
    this.arrondir();
    return {
      jour: this.jour,
      stock: { ...this.stock },
      stockPrec: { ...this.stockPrec },
      fonds: Math.round(this.fonds),
      verses: Math.round(this.verses),
      encaisses: Math.round(this.encaisses),
      // Des copies : l'objet Marche modifie ces tables sur place, et l'état
      // React (ainsi que la base de synchronisation) gardait sinon les mêmes
      // objets — la fusion n'y voyait plus aucune vente (09/10/2026).
      marchandages: { ...this.marchandages },
      achats: { ...this.achats },
      achatsJoueur: { ...this.achatsJoueur },
      vitrine: this.vitrine,
      journal: [...this.journal],
    };
  }
}

export const PALIER_NOM = (tier) => TIER_INFO[tier]?.nom || tier;
