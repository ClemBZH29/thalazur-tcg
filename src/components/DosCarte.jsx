import { useDos, urlDos } from "../jeu/dos.js";

/**
 * Le dos est identique pour tous les paliers : il ne doit rien trahir. Il
 * change seulement avec le dos choisi au profil (src/config/dos.js).
 */
export default function DosCarte() {
  const d = useDos();
  return (
    <div className="dos" style={{ background: d.fond }} aria-hidden="true">
      <img src={urlDos(d)} alt="" draggable="false" />
    </div>
  );
}
