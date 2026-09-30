/**
 * Le code d'une carte : l'extension en trois lettres et le numéro sur trois
 * chiffres, « TRO-164 ». C'est ce que porte le pied de la carte, et la clé
 * d'une carte dans les fichiers tenus à la main (Base Image/cadrages.json) :
 * un numéro seul ne dit pas de quelle extension il parle, un code si.
 *
 * Module pur, partagé par le site et par les scripts Node.
 */

/** Trois lettres majuscules, déclarées dans l'extension.js de chaque extension. */
export const FORME_CODE_EXTENSION = /^[A-Z]{3}$/;

/** « TRO » et 164 → « TRO-164 » ; null pour une carte sans numéro (PJ, full art). */
export function codeCarte(codeExtension, num) {
  if (!codeExtension || !/^\d+$/.test(String(num ?? ""))) return null;
  return `${codeExtension}-${String(Number(num)).padStart(3, "0")}`;
}

/** « tro-164 », « TRO-0164 », « TRO 164 » → { code: "TRO", num: 164 } ; sinon null. */
export function lireCodeCarte(texte) {
  const m = String(texte ?? "").trim().match(/^([A-Za-z]{3})\s*[-_ ]\s*(\d+)$/);
  return m ? { code: m[1].toUpperCase(), num: Number(m[2]) } : null;
}
