/**
 * Deux onglets (ou deux appareils) sur la même descente : la partie a une
 * identité, et seul l'onglet qui tient la partie enregistrée peut la sauver
 * ou la clore. Sans elle, un onglet resté sur une descente terminée ailleurs
 * la rejouait et se faisait payer une seconde fois.
 *
 * `useDonjon` (ici `donjonDe`) est un hook ; ses fonctions ne touchent à React que par
 * `useCallback`, qu'on remplace ici par l'identité pour les appeler à nu.
 */
import { describe, expect, test, vi } from "vitest";

vi.mock("react", () => ({ useCallback: (f) => f }));

const { useDonjon: donjonDe, idPartie } = await import("../src/jeu/donjon.js");
const { etatVide } = await import("../src/lib/storage.js");

const SANS_TEST = { actif: false, sansPO: false };
const jour = new Date().toLocaleDateString("sv");

/** Un stockage partagé : chaque onglet lit son instantané, écrit sur l'état frais. */
function stockage(etat) {
  const s = { etat };
  s.setEtat = (f) => { s.etat = typeof f === "function" ? f(s.etat) : f; };
  s.onglet = () => donjonDe(s.etat, s.setEtat, SANS_TEST);
  return s;
}
const partie = (id, extra = {}) => ({ id, graine: 7, jour, mode: "jour", etage: 1, equipe: [], ...extra });
const resume = (p) => ({ issue: "sortie", etage: 1, gardiens: 1, complete: false, mode: "jour", id: idPartie(p) });

describe("une descente, deux onglets", () => {
  test("la descente terminée dans un onglet n'est pas payée une seconde fois par l'autre", () => {
    const X = partie("x");
    const s = stockage({ ...etatVide(), donjon: { jour, tentatives: 1, partie: X } });
    const A = s.onglet(), B = s.onglet(); // B garde sa vue d'avant la fin
    const po0 = s.etat.bourse.po;
    A.terminerDonjon(100, resume(X));
    const po1 = s.etat.bourse.po;
    expect(po1).toBeGreaterThan(po0);
    expect(s.etat.donjon.partie).toBeNull();
    B.terminerDonjon(100, resume(X), [{ cle: "t:1", jours: 1 }], [{ c: { ext: "t", id: 1 }, xp: 10 }]);
    expect(s.etat.bourse.po).toBe(po1);
    expect(s.etat.stats.descentes).toBe(1);
    expect(s.etat.donjon.convalescence || {}).toEqual({});
  });

  test("une descente remplacée ailleurs ne se clôt ni ne se sauve par-dessus la nouvelle", () => {
    const X = partie("x"), Y = partie("y");
    const s = stockage({ ...etatVide(), donjon: { jour, tentatives: 1, partie: Y } });
    const B = s.onglet();
    const po0 = s.etat.bourse.po;
    B.sauverPartie({ ...X, etage: 3 });
    expect(s.etat.donjon.partie).toEqual(Y);
    B.terminerDonjon(100, resume(X));
    expect(s.etat.bourse.po).toBe(po0);
    expect(s.etat.donjon.partie).toEqual(Y);
  });

  test("une descente terminée ailleurs ne revient pas par une sauvegarde", () => {
    const X = partie("x");
    const s = stockage({ ...etatVide(), donjon: { jour, tentatives: 1, partie: null } });
    s.onglet().sauverPartie({ ...X, etage: 2 });
    expect(s.etat.donjon.partie).toBeNull();
  });

  test("la même descente se sauve normalement", () => {
    const X = partie("x");
    const s = stockage({ ...etatVide(), donjon: { jour, tentatives: 1, partie: X } });
    s.onglet().sauverPartie({ ...X, etage: 2 });
    expect(s.etat.donjon.partie.etage).toBe(2);
  });

  test("on ne commence pas une descente quand une autre est en cours", () => {
    const X = partie("x"), Y = partie("y", { mode: "infini" });
    const s = stockage({ ...etatVide(), donjon: { jour, tentatives: 1, partie: X } });
    // B n'a pas encore vu la descente de A : sa vue dit qu'il n'y a rien en cours.
    const B = donjonDe({ ...s.etat, donjon: { jour, tentatives: 0, partie: null } }, s.setEtat, SANS_TEST);
    const po0 = s.etat.bourse.po;
    B.commencerDonjon(Y);
    expect(s.etat.donjon.partie).toEqual(X);
    expect(s.etat.bourse.po).toBe(po0);
    expect(s.etat.donjon.tentatives).toBe(1);
  });

  test("sans partie en cours, la descente commence et prend sa tentative", () => {
    const X = partie("x");
    const s = stockage({ ...etatVide(), donjon: { jour, tentatives: 0, partie: null } });
    expect(s.onglet().commencerDonjon(X)).toBe(true);
    expect(s.etat.donjon.partie).toEqual(X);
    expect(s.etat.donjon.tentatives).toBe(1);
  });

  test("une partie sauvée avant l'identité garde la sienne : sa graine", () => {
    expect(idPartie({ graine: 12 })).toBe(idPartie({ graine: 12, etage: 3 }));
    expect(idPartie({ graine: 12 })).not.toBe(idPartie({ graine: 13 }));
    expect(idPartie(null)).toBeNull();
  });
});
