import { useCallback, useEffect, useRef, useState } from "react";
import { TAUX_DEFAUT } from "../config/tiers.js";
import { CFG_IMAGE_DEFAUT } from "../lib/images.js";
import { useAudio } from "../lib/audio.js";

/** Un motif enregistré avant le rangement par extension (`{num}.jpg`) masquerait
 *  le nouveau : on l'écarte, le meneur garde son point focal. */
function imageSansAnciensDefauts(image) {
  if (!image) return {};
  const { motif, ...reste } = image;
  return motif && motif !== "{num}.jpg" ? { ...reste, motif } : reste;
}

/** Leviers du mode test (outils MJ, développement seulement). */
export const TEST_DEFAUT = {
  actif: false,
  sansPO: false,
  taille: 5,
  palier: "auto",
  rainbow: "auto",
  // Le colporteur passe huit fois sur cent : sans ce levier, le vérifier
  // demandait d'ouvrir une douzaine de boosters à chaque retouche.
  colporteur: "auto", // auto | toujours | jamais
  // Mines : chaque frappe brise le filon, pour traverser les strates en
  // quelques minutes au lieu de quelques jours.
  godPioche: false,
};

/** Les préférences du joueur et les leviers du meneur, lus dans l'état sauvegardé. */
export function useReglages(etat, setEtat) {
  const reglages = etat.reglages || {};
  const son = reglages.son !== false;
  /**
   * Animations : « pleines » (défaut), « systeme » ou « reduites ».
   *
   * Les feuilles de style gardaient leurs animations derrière
   * `prefers-reduced-motion`, ce qui est juste par défaut et malheureux ici :
   * sur ce site l'animation est le contenu — le sachet qui se déchire, la lueur
   * qui annonce le palier, la carte qui se retourne. Un système réglé sur
   * « moins d'animations » vidait donc l'ouverture et la mine de leur
   * substance, sans rien dire et sans recours. Le garde est devenu un attribut
   * de la racine, et ce réglage le gouverne.
   *
   * Le défaut est « toujours animer » : suivre le système coupait l'ouverture
   * des boosters chez tous ceux dont Windows a les effets visuels réduits,
   * souvent sans qu'ils le sachent. Qui a besoin de moins de mouvement le
   * choisit dans le profil, en un clic.
   */
  const animations = reglages.animations || "pleines";
  // La revente automatique était le comportement unique de l'app ; elle est
  // devenue une option, parce que le Comptoir a besoin d'exemplaires à écouler.
  const reventeAuto = reglages.reventeAuto === true;
  /* Les leviers de meneur — taux de tirage, cadrage des portraits, mode test,
     roster chargé à la main — ne se règlent qu'en développement. En
     production, des valeurs laissées par une ancienne version du site (où la
     page Réglages était publique) sont ignorées : tout le monde joue avec les
     mêmes tables, et le mode test ne peut pas servir à ouvrir sans payer. */
  const MJ = import.meta.env.DEV;
  const taux = { ...TAUX_DEFAUT, ...(MJ ? reglages.taux || {} : {}) };
  const cfgImage = { ...CFG_IMAGE_DEFAUT, ...(MJ ? imageSansAnciensDefauts(reglages.image) : {}) };
  const test = { ...TEST_DEFAUT, ...(MJ ? reglages.test || {} : {}) };
  const gratuit = test.actif && test.sansPO;

  /** La préférence du système, suivie en direct : elle peut changer en session. */
  const [sobreSysteme, setSobreSysteme] = useState(
    () => typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const suivre = (e) => setSobreSysteme(e.matches);
    mq.addEventListener("change", suivre);
    return () => mq.removeEventListener("change", suivre);
  }, []);

  const mouvementReduit =
    animations === "reduites" || (animations === "systeme" && sobreSysteme);

  useEffect(() => {
    document.documentElement.dataset.mouvement = mouvementReduit ? "reduit" : "plein";
  }, [mouvementReduit]);

  const sonRef = useRef(son);
  useEffect(() => { sonRef.current = son; }, [son]);
  const sfx = useAudio(sonRef);

  const majReglages = useCallback(
    (patch) => setEtat((e) => ({ ...e, reglages: { ...e.reglages, ...patch } })),
    [setEtat]
  );


  return {
    reglages, son, animations, reventeAuto, MJ, taux, cfgImage, test, gratuit,
    sobreSysteme, mouvementReduit, sfx, majReglages,
  };
}
