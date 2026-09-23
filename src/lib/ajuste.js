import { useLayoutEffect } from "react";

/**
 * Réduit la taille de police jusqu'à ce que le texte tienne dans sa plaque.
 * Les plaques du cadre ont une hauteur fixe en pourcentage de la carte ;
 * un nom long doit donc rétrécir plutôt que déborder ou être coupé.
 * Le facteur est appliqué par la variable --fit, multipliée à la taille de base.
 */
export function useAjuste(ref, deps = []) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let occupe = false;

    const ajuste = () => {
      if (occupe) return;
      occupe = true;
      el.style.setProperty("--fit", "1");
      let f = 1;
      for (let i = 0; i < 16; i++) {
        const deborde =
          el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
        if (!deborde) break;
        f -= 0.055;
        el.style.setProperty("--fit", String(f));
      }
      occupe = false;
    };

    ajuste();
    const ro = new ResizeObserver(ajuste);
    ro.observe(el);
    // Les polices Google arrivent après le premier rendu : on repasse ensuite.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajuste);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
