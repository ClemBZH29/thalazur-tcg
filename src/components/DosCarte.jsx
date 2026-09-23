import { ASSET, DOS_FOND } from "../config/cadre.js";

/** Le dos est identique pour tous les paliers : il ne doit rien trahir. */
export default function DosCarte() {
  return (
    <div className="dos" style={{ background: DOS_FOND }} aria-hidden="true">
      <img src={`${import.meta.env.BASE_URL}${ASSET.dos}`} alt="" draggable="false" />
    </div>
  );
}
