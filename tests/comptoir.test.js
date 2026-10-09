/** Les acheteurs du Comptoir : calendrier, goûts et promesses de prix. */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import extension from "../src/extensions/troupe-valeran/extension.js";
import { construirePool, deduireGrades } from "../src/lib/roster.js";
import { specialesPour } from "../src/config/speciales.js";
import { TAUX_DEFAUT, TIER_ORDER } from "../src/config/tiers.js";
import { construireMarche, Marche } from "../src/comptoir/marche.js";
import { retirerVente } from "../src/jeu/marche.js";
import {
  CYCLE, PROVINCES, SPECIALISTES, TOUS_ACHETEURS, acheteursDuJour, acheteurDeDemain,
  passageDeGaspard, specialistesDuJour,
} from "../src/comptoir/acheteurs.js";

const roster = JSON.parse(readFileSync(new URL("../src/extensions/troupe-valeran/roster.json", import.meta.url), "utf8"));
const pool = construirePool(roster.lignes, deduireGrades(roster.lignes));
const speciales = specialesPour(extension);
const jeu = [...TIER_ORDER.flatMap((t) => pool[t] || []), ...speciales.fullart, ...speciales.pj];
const articles = construireMarche(jeu, TAUX_DEFAUT);
const JOUR = 300;
const M = new Marche(articles, null, JOUR);
const poids = articles.reduce((s, a) => s + a.p, 0);

describe("le calendrier", () => {
  test("Lise est là tous les jours, avec deux spécialistes différents", () => {
    for (let j = JOUR; j < JOUR + 60; j++) {
      const l = acheteursDuJour(j);
      expect(l[0].id).toBe("lise");
      const s = specialistesDuJour(j);
      expect(s).toHaveLength(2);
      expect(s[0].id).not.toBe(s[1].id);
    }
  });

  test("le cycle passe chaque paire une fois, sans spécialiste deux jours de suite", () => {
    const n = SPECIALISTES.length;
    expect(CYCLE).toHaveLength((n * (n - 1)) / 2);
    expect(new Set(CYCLE.map((p) => p.join("-"))).size).toBe(CYCLE.length);
    for (let j = JOUR; j < JOUR + CYCLE.length * 2; j++) {
      const hier = specialistesDuJour(j - 1).map((b) => b.id);
      specialistesDuJour(j).forEach((b) => expect(hier).not.toContain(b.id));
    }
  });

  test("Gaspard change de province à chaque passage", () => {
    const vus = [];
    for (let j = JOUR; vus.length < PROVINCES.length * 2; j++) {
      const g = specialistesDuJour(j).find((b) => b.id === "gaspard");
      if (g) vus.push({ rang: passageDeGaspard(j), province: g.province.id });
    }
    vus.forEach((v, k) => {
      if (k) expect(v.rang).toBe(vus[k - 1].rang + 1);
      expect(v.province).toBe(PROVINCES[v.rang % PROVINCES.length].id);
    });
  });

  test("l'annonce de demain nomme un spécialiste qui n'est pas déjà là", () => {
    for (let j = JOUR; j < JOUR + 30; j++) {
      const ici = specialistesDuJour(j).map((b) => b.id);
      const d = acheteurDeDemain(j);
      expect(specialistesDuJour(j + 1).map((b) => b.id)).toContain(d.id);
      if (specialistesDuJour(j + 1).some((b) => !ici.includes(b.id))) expect(ici).not.toContain(d.id);
    }
  });
});

describe("les goûts", () => {
  test("chaque spécialiste regarde une part lisible du set", () => {
    for (const b of TOUS_ACHETEURS().filter((x) => !x.habituee && !x.exceptionnel)) {
      const n = articles.filter((a) => M.affinite(a, b) > 0).length;
      expect(n, b.nom).toBeGreaterThanOrEqual(30);
      expect(n, b.nom).toBeLessThanOrEqual(240);
    }
  });

  test("chaque jour, au moins neuf dixièmes du surplus attendu ont preneur", () => {
    for (let j = JOUR; j < JOUR + CYCLE.length; j++) {
      const l = acheteursDuJour(j);
      const ok = articles.filter((a) => l.some((b) => M.affinite(a, b) > 0)).reduce((s, a) => s + a.p, 0);
      expect(ok / poids).toBeGreaterThanOrEqual(0.9);
    }
  });
});

describe("les prix", () => {
  const tous = TOUS_ACHETEURS();

  test("un acheteur ne paie jamais moins que l'échoppe, même après un échec", () => {
    for (const b of tous) {
      for (const a of articles.filter((x) => M.affinite(x, b) > 0)) {
        const { bid } = M.cotation(a);
        expect(M.prixAcheteur(a, b, undefined, 1 - b.down)).toBeGreaterThanOrEqual(bid);
      }
    }
  });

  test("le prix annoncé d'un marchandage réussi est celui qui est payé", () => {
    const N = new Marche(articles, null, JOUR);
    const b = tous.find((x) => x.id === "voren");
    const a = articles.find((x) => x.rainbow && N.affinite(x, b) > 0);
    const annonce = N.offreLot(a, b, 1, 1 + b.up);
    expect(annonce).toBeGreaterThan(N.offreUnitaire(a, b));
    expect(N.payer(a, N.prixAcheteur(a, b, N.stock[a.id], 1 + b.up))).toBe(annonce);
  });

  test("Sorelle et Voren n'offrent plus le même prix pour une même rainbow", () => {
    const sorelle = tous.find((x) => x.id === "sorelle");
    const voren = tous.find((x) => x.id === "voren");
    const rares = articles.filter((x) => x.rainbow && x.tier === "rare");
    const ecarts = rares.filter((a) => M.offreUnitaire(a, voren) !== M.offreUnitaire(a, sorelle));
    expect(ecarts.length).toBe(rares.length);
  });

  test("les prix sont des PO entières", () => {
    for (const a of articles.slice(0, 80)) {
      const { ask, bid } = M.cotation(a);
      expect(Number.isInteger(ask) && Number.isInteger(bid)).toBe(true);
    }
  });

  test("le pire jour du cycle ne fait pas du Comptoir une machine à pièces d'or", () => {
    const conservateur = tous.find((b) => b.exceptionnel);
    for (let j = JOUR; j < JOUR + CYCLE.length; j++) {
      const l = acheteursDuJour(j);
      const avec = l.some((b) => b.exceptionnel) ? l : [...l, conservateur];
      expect(M.gardeFous(avec).liqMax).toBeLessThan(1);
    }
  });
});

describe("la refonte : quota, manières, vitrine", () => {
  const tous = TOUS_ACHETEURS();

  test("chaque acheteur a sa voix complète et un quota", async () => {
    const { VOIX, MANIERES } = await import("../src/comptoir/voix.js");
    const ids = MANIERES.map((m) => m.id);
    for (const b of tous) {
      const v = VOIX[b.id];
      for (const cle of ["quote", "refus", "indice", "ok", "ko", "merci"]) expect(v[cle], `${b.id}.${cle}`).toBeTruthy();
      expect(ids).toContain(v.prefere);
      expect(ids).toContain(v.deteste);
      expect(v.prefere).not.toBe(v.deteste);
      expect(b.quota).toBeGreaterThan(0);
      expect(v.quote).not.toMatch(/—/);
    }
  });

  test("la bonne manière convainc plus que la mauvaise", async () => {
    const { VOIX, chanceDe } = await import("../src/comptoir/voix.js");
    for (const b of tous) {
      const v = VOIX[b.id];
      expect(chanceDe(b, v.prefere)).toBeGreaterThan(chanceDe(b, null));
      expect(chanceDe(b, v.deteste)).toBeLessThan(chanceDe(b, null));
    }
  });

  test("le quota se consomme et repart à zéro le lendemain", () => {
    const lise = tous.find((b) => b.id === "lise");
    const N = new Marche(articles, null, JOUR);
    expect(N.restant(lise)).toBe(lise.quota);
    N.compterAchat(lise, 5);
    expect(N.restant(lise)).toBe(lise.quota - 5);
    const R = new Marche(articles, N.serialiser(), JOUR + 1);
    expect(R.restant(lise)).toBe(lise.quota);
  });

  test("la vitrine est figée pour la journée et chaque case ne se vend qu'une fois", () => {
    const N = new Marche(articles, null, JOUR);
    const v1 = N.vitrineDuJour(() => false);
    expect(v1.rayon.length).toBe(5);
    expect(v1.piece).toBeTruthy();
    // Un autre regard sur la collection ne rebat pas la vitrine du jour.
    const v2 = N.vitrineDuJour(() => true);
    expect(v2.rayon.map((a) => a.id)).toEqual(v1.rayon.map((a) => a.id));
    const a = v1.rayon[0];
    expect(N.vendreAuJoueur(a)).toBeGreaterThan(0);
    expect(N.vendreAuJoueur(a)).toBeNull();
    const R = new Marche(articles, N.serialiser(), JOUR);
    expect(R.dejaAchete(a)).toBe(true);
  });

  test("la pièce du jour est une rare, une légendaire ou une rainbow", () => {
    for (let j = JOUR; j < JOUR + 30; j++) {
      const p = new Marche(articles, null, j).pieceDuJour();
      expect(p.rainbow || p.tier === "rare" || p.tier === "legendaire").toBe(true);
      expect(p.tier === "fullart" || p.tier === "pj").toBe(false);
    }
  });
});

describe("audit du 09/10/2026 : horloge, lots, sauvegarde, inventaire", () => {
  const tous = TOUS_ACHETEURS();
  const lise = tous.find((b) => b.id === "lise");

  test("reculer l'horloge puis la remettre ne rend ni le quota, ni les marchandages, ni la caisse", () => {
    const N = new Marche(articles, null, JOUR);
    N.fonds = 1000;
    N.compterAchat(lise, lise.quota);
    N.marchander(lise, articles[0], null, 0);
    const avant = N.serialiser();
    // La veille : rien ne repart, et le jour enregistré reste le plus grand vu.
    const V = new Marche(articles, avant, JOUR - 1);
    expect(V.jour).toBe(JOUR);
    expect(V.restant(lise)).toBe(0);
    expect(V.fonds).toBe(1000);
    // Retour au jour réel : toujours rien.
    const R = new Marche(articles, V.serialiser(), JOUR);
    expect(R.restant(lise)).toBe(0);
    expect(R.fonds).toBe(1000);
    expect(R.marchandage(lise.id, articles[0].id)).toBeTruthy();
    expect(R.serialiser().stock).toEqual(avant.stock);
    // Le vrai lendemain, lui, remet le quota à zéro.
    expect(new Marche(articles, R.serialiser(), JOUR + 1).restant(lise)).toBe(lise.quota);
  });

  test("le prix annoncé d'un lot à Voren est celui qui est payé, même quand la hausse retombe en cours de lot", () => {
    const N = new Marche(articles, null, JOUR);
    const b = tous.find((x) => x.id === "voren");
    const a = articles.find((x) => x.rainbow && x.tier === "rare" && N.affinite(x, b) > 0);
    // Rayon qui s'est vidé depuis hier : la prime « hausse » est acquise au
    // premier exemplaire, et disparaît dès que la vente regarnit le rayon.
    N.stockPrec[a.id] = 1;
    N.stock[a.id] = 0.5;
    expect(N.traits(a).hausse).toBe(true);
    const annonce = N.offreLot(a, b, 3, 1);
    const r = N.vendreLot(a, b, 3, 1);
    expect(r.vendus).toBe(3);
    expect(r.gain).toBe(annonce);
  });

  test("les prix ne changent pas au rechargement de la sauvegarde", () => {
    const N = new Marche(articles, null, JOUR);
    const b = tous.find((x) => x.id === "sorelle");
    N.vendreLot(articles.find((x) => N.affinite(x, b) > 0), b, 1, 1);
    const R = new Marche(articles, JSON.parse(JSON.stringify(N.serialiser())), JOUR);
    for (const a of articles) {
      expect(R.cotation(a), a.id).toEqual(N.cotation(a));
      expect(R.offreUnitaire(a, b), a.id).toBe(N.offreUnitaire(a, b));
    }
  });

  test("caisse vide : la vente au négoce ne vend rien et le dit", () => {
    const N = new Marche(articles, null, JOUR);
    N.fonds = 0;
    const a = articles.find((x) => N.affinite(x, lise) > 0);
    expect(N.vendreLot(a, lise, 2, 1)).toEqual({ vendus: 0, gain: 0, caisseVide: true });
    expect(N.restant(lise)).toBe(lise.quota);
  });
});

describe("la vente retire de l'inventaire (src/jeu/marche.js)", () => {
  const etat = (normale, rainbow = 0) => ({
    collections: { t: { x: { normale, rainbow, carte: { id: "x" } } } },
    bourse: { po: 0, gagne: 0 },
    stats: {},
  });

  test("on ne vend que des doublons : le dernier exemplaire reste, le prix suit ce qui est vendu", () => {
    const e = retirerVente(etat(3, 1), "t", "x", "normale", 5, 50);
    expect(e.collections.t.x.normale).toBe(1);
    expect(e.bourse.po).toBe(20);
    expect(e.stats.ventes).toBe(2);
  });

  test("une rainbow seule ne se vend pas, une full art ou une PJ non plus", () => {
    const e0 = etat(1, 1);
    expect(retirerVente(e0, "t", "x", "rainbow", 1, 900)).toBe(e0);
    expect(retirerVente(e0, "t", "x", "normale", 1, 900)).toBe(e0);
  });
});

describe("un onglet suit la sauvegarde du marché écrite ailleurs", () => {
  test("sa propre écriture ne remonte pas le marché, celle d'un autre onglet si", async () => {
    const { suiviSauvegardes } = await import("../src/comptoir/suivi.js");
    const lise = TOUS_ACHETEURS().find((b) => b.id === "lise");
    const suivi = suiviSauvegardes();
    const ici = new Marche(articles, null, JOUR);
    const ecrite = suivi.noter(ici.serialiser());
    expect(suivi.etrangere(ecrite)).toBe(false);
    expect(suivi.etrangere(null)).toBe(false);
    // L'autre onglet vend vingt cartes à Lise ; sa sauvegarde arrive relue.
    const autre = new Marche(articles, ecrite, JOUR);
    autre.compterAchat(lise, lise.quota);
    const arrivee = JSON.parse(JSON.stringify(autre.serialiser()));
    expect(suivi.etrangere(arrivee)).toBe(true);
    expect(new Marche(articles, arrivee, JOUR).restant(lise)).toBe(0);
  });
});

test("un jour de marché venu d'une horloge en avance ne bloque pas le Comptoir", () => {
  const N = new Marche(articles, null, JOUR);
  const futur = { ...N.serialiser(), jour: JOUR + 60 };
  const R = new Marche(articles, futur, JOUR);
  expect(R.jour).toBe(JOUR);
  // Le lendemain réel, le marché avance de nouveau (quotas neufs).
  expect(new Marche(articles, R.serialiser(), JOUR + 1).jour).toBe(JOUR + 1);
});
