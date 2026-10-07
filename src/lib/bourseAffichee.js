import { useEffect, useRef, useState } from "react";

/**
 * Le chiffre de la bourse dans le bandeau, qui compte au lieu de sauter.
 *
 * Une page peut le retenir un instant (`tenirBourse`) : les pièces d'une
 * mission réclamée volent vers la bourse, et le chiffre ne doit monter
 * qu'à leur arrivée. Une baisse (un achat) s'affiche aussitôt ; une hausse
 * compte en 360 ms, courbe cubique sortante. Mouvement réduit : la valeur
 * s'affiche telle quelle.
 */
let tenueJusqua = 0;
export const tenirBourse = (ms) => {
  tenueJusqua = Math.max(tenueJusqua, (typeof performance !== "undefined" ? performance.now() : 0) + ms);
};

export function useBourseAffichee(valeur, reduit = false) {
  const [affiche, setAffiche] = useState(valeur);
  const courante = useRef(valeur);
  useEffect(() => {
    if (reduit || valeur <= courante.current || typeof requestAnimationFrame !== "function") {
      courante.current = valeur;
      setAffiche(valeur);
      return undefined;
    }
    const depart = courante.current;
    let t0 = null, raf = 0;
    const pas = (now) => {
      if (now < tenueJusqua) { raf = requestAnimationFrame(pas); return; }
      if (t0 === null) t0 = now;
      const k = Math.min(1, (now - t0) / 360), e = 1 - Math.pow(1 - k, 3);
      courante.current = depart + (valeur - depart) * e;
      setAffiche(courante.current);
      if (k < 1) raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [valeur, reduit]);
  return affiche;
}
