/** Mines de Kazim — mise en forme des nombres et des durées, à la française. */

export const SUFFIXES = ["", " K", " M", " Md", " Bi", " Tri", " Qa", " Qi"];
export function fmt(n) {
  if (!isFinite(n)) return "\u221e";
  if (n < 0) return "\u2212" + fmt(-n);
  if (n < 1000) return String(n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n)).replace(".", ",");
  let i = 0;
  while (n >= 1000 && i < SUFFIXES.length - 1) { n /= 1000; i++; }
  let s = n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : n.toFixed(0);
  // Ne raboter les zéros que derrière la virgule : sinon 100 M devenait 1 M.
  if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s.replace(".", ",") + SUFFIXES[i];
}
/* Signe typographique : plus, ou vrai signe moins, jamais le trait d'union. */
export const signe = (n) => (n >= 0 ? "+" + n : "\u2212" + Math.abs(n));
export const fmtEnt = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
export const fmtDuree = (ms) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min";
};
