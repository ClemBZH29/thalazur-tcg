/**
 * Le cadrage de la carte préférée dans sa bannière du classement.
 *
 * Un cadrage est `{ x, y, z }` : le point de l'illustration (en % de sa
 * largeur et de sa hauteur) qui reste sous le même point de la bannière, et
 * un zoom en % (100 à 300). L'affichage n'a besoin que de CSS :
 *   object-fit: cover; object-position: x% y%;
 *   transform: scale(z/100); transform-origin: x% y%;
 * Les deux réglages laissent le point (x, y) de l'image au point (x, y) de
 * la boîte : la fenêtre visible commence donc à x × (1 − part visible) de
 * l'image, quelle que soit la largeur de la bannière (bureau ou téléphone).
 * C'est ce qui permet au profil de montrer, sur l'illustration entière, la
 * fenêtre exacte que verront les autres joueurs.
 */

export const ZOOM_MIN = 100;
export const ZOOM_MAX = 300;

/** Les proportions de la bannière : bureau (520 × 72) et téléphone (≈ 260 × 72). */
export const BANNIERES = { bureau: 520 / 72, telephone: 260 / 72 };

const borne = (v, min, max) => Math.min(max, Math.max(min, v));

/** Un cadrage lisible, ou null : nombres entiers bornés, rien d'autre. */
export function cadrageValide(c) {
  if (!c || typeof c !== "object") return null;
  const n = (v) => typeof v === "number" && Number.isFinite(v);
  if (!n(c.x) || !n(c.y)) return null;
  return {
    x: Math.round(borne(c.x, 0, 100)),
    y: Math.round(borne(c.y, 0, 100)),
    z: Math.round(borne(n(c.z) ? c.z : ZOOM_MIN, ZOOM_MIN, ZOOM_MAX)),
  };
}

/**
 * La part de l'image visible dans une boîte de proportions `A` (largeur sur
 * hauteur), pour une image de proportions `a`, au zoom `z` (%).
 */
export function partVisible(a, A, z = ZOOM_MIN) {
  const s = Math.max(A / a, 1) * (z / 100); // échelle, l'image mesurant a × 1
  return { l: Math.min(1, A / (a * s)), h: Math.min(1, 1 / s) };
}

/** La fenêtre visible, en fractions de l'image : { gauche, haut, l, h }. */
export function fenetre(a, A, { x, y, z }) {
  const { l, h } = partVisible(a, A, z);
  return { gauche: (x / 100) * (1 - l), haut: (y / 100) * (1 - h), l, h };
}

/** Le point (x, y) qui place la fenêtre à `gauche`, `haut` (fractions de l'image). */
export function depuisFenetre(a, A, z, gauche, haut) {
  const { l, h } = partVisible(a, A, z);
  const p = (pos, part) => (part >= 1 ? 50 : borne((pos / (1 - part)) * 100, 0, 100));
  return { x: Math.round(p(gauche, l)), y: Math.round(p(haut, h)), z };
}

/** Le style CSS d'une illustration cadrée. */
export const styleCadrage = ({ x, y, z }) => ({
  objectPosition: `${x}% ${y}%`,
  transform: z > ZOOM_MIN ? `scale(${z / 100})` : undefined,
  transformOrigin: `${x}% ${y}%`,
});
