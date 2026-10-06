/**
 * Le réglage du son, dans `etat.reglages.son` (schéma 9) : la coupure
 * générale et deux volumes en pourcentage. Défauts discrets : la musique
 * accompagne, les effets informent.
 */
export const SON_DEFAUT = { coupe: false, musique: 20, effets: 50 };

/** Un réglage lu dans une sauvegarde, complété et borné. */
export function lireSon(s) {
  const r = { ...SON_DEFAUT, ...(s && typeof s === "object" ? s : {}) };
  const pct = (v, d) => (Number.isFinite(+v) ? Math.max(0, Math.min(100, Math.round(+v))) : d);
  return { coupe: !!r.coupe, musique: pct(r.musique, SON_DEFAUT.musique), effets: pct(r.effets, SON_DEFAUT.effets) };
}
