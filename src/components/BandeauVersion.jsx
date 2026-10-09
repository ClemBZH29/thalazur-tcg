import { useGel } from "../lib/gel.js";

/**
 * Bandeau de l'onglet gelé (voir src/lib/gel.js) : une version plus récente du
 * site a écrit la partie, cet onglet ne la lit plus et n'écrit plus rien. Il
 * ne se ferme pas : la seule issue utile est de recharger.
 */
export default function BandeauVersion() {
  const gel = useGel();
  if (!gel) return null;
  const texte = gel === "compte"
    ? "Votre partie a été enregistrée par une version plus récente du site."
    : "Une nouvelle version du site est ouverte dans un autre onglet.";
  return (
    <section className="bandeau-cookies" role="alert" style={{ zIndex: 70 }}>
      <div className="bandeau-cookies-texte">
        <p>{texte} Cet onglet ne sauvegarde plus rien en attendant d'être rechargé.</p>
      </div>
      <div className="bandeau-cookies-actions">
        <button type="button" className="btn sm" onClick={() => window.location.reload()}>Recharger</button>
      </div>
    </section>
  );
}
