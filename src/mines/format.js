/** Mines de Kazim — mise en forme des nombres et des durées, à la française. */

export const SUFFIXES = ["", " K", " M", " Md", " Bi", " Tri", " Qa", " Qi"];
export function fmt(n) {
  if (!isFinite(n)) return "\u221e";
  if (n < 0) return "\u2212" + fmt(-n);
  if (n < 1000) return String(n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n)).replace(".", ",");
  /* On passe au suffixe suivant tant que le nombre, *arrondi*, atteint mille :
     sinon 999 999 s'affichait « 1000 K ». */
  for (let i = 1; i < SUFFIXES.length; i++) {
    const v = n / Math.pow(1000, i);
    if (v >= 1000) continue;
    const s = arrondi(v);
    if (Number(s) >= 1000) continue;
    return s.replace(".", ",") + SUFFIXES[i];
  }
  /* Au-delà du dernier suffixe, la notation scientifique : les suffixes
     s'arrêtaient, et 1e300 devenait « 1,0000000000000002e+279 Qi ». */
  const [m, e] = n.toExponential(2).split("e");
  return sansZeros(m).replace(".", ",") + "e" + Number(e);
}
// Ne raboter les zéros que derrière la virgule : sinon 100 M devenait 1 M.
const sansZeros = (s) => (s.indexOf(".") >= 0 ? s.replace(/0+$/, "").replace(/\.$/, "") : s);
const arrondi = (v) => sansZeros(v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0));
/* Signe typographique : plus, ou vrai signe moins, jamais le trait d'union. */
export const signe = (n) => (n >= 0 ? "+" + n : "\u2212" + Math.abs(n));
export const fmtEnt = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
export const fmtDuree = (ms) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min";
};
