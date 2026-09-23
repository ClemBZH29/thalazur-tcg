import { useRef, useState } from "react";
import { TIER_INFO } from "../config/tiers.js";
import { CADRE, CADRE_PLEIN, ASSET } from "../config/cadre.js";
import { nomComplet } from "../config/speciales.js";
import { reperesDe } from "../config/cartes.js";
import { resoudreImage } from "../lib/images.js";
import { useAjuste } from "../lib/ajuste.js";

const boite = (z) => ({ left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%` });

function Encoches({ n }) {
  return (
    <span className="encoches" aria-label={`Palier ${n} sur 4`}>
      {Array.from({ length: 4 }, (_, i) => <i key={i} className={i < n ? "on" : ""} />)}
    </span>
  );
}

function Monogramme({ nom }) {
  const lettres = nom.split(/\s+/).slice(0, 2).map((m) => m[0] || "").join("").toUpperCase();
  const rot = [...nom].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <div className="monogramme" style={{ "--rot": `${rot}deg` }}>
      <span className="burin" aria-hidden="true" />
      <b>{lettres}</b>
    </div>
  );
}

export default function FaceCarte({ c, cfgImage, fichiers }) {
  const t = TIER_INFO[c.tier];
  const [rate, setRate] = useState(false);
  const src = rate ? null : resoudreImage(c, cfgImage, fichiers);
  const refNom = useRef(null);
  const refDetail = useRef(null);
  useAjuste(refNom, [c.nom]);
  useAjuste(refDetail, [c.rep1, c.race, c.rep3, c.citation]);

  const genre = c.genre === "F" ? "femme" : c.genre === "M" ? "homme" : c.genre;
  const base = import.meta.env.BASE_URL;
  const reperes = reperesDe(c);

  // Full art et PJ : cadre pleine illustration, aucun texte sur la carte.
  if (t.pleine) {
    return (
      <div
        className={`plaque pleine t-${c.tier}`}
        style={{ borderRadius: CADRE_PLEIN.rayon }}
      >
        <div className="fenetre" style={boite(CADRE_PLEIN.art)}>
          {src ? (
            <img
              src={src} alt="" draggable="false" loading="lazy"
              style={{ objectPosition: `50% ${cfgImage.focal ?? 30}%` }}
              onError={() => setRate(true)}
            />
          ) : (
            <Monogramme nom={nomComplet(c)} />
          )}
        </div>
        <img className="cadre" src={`${base}${ASSET.cadreFullart}`} alt="" draggable="false" />
        {t.teinte && (
          <span
            className="teinte"
            style={{ "--tc": t.teinte, "--ta": t.teinteA,
                     maskImage: `url(${base}${ASSET.cadreFullart})`,
                     WebkitMaskImage: `url(${base}${ASSET.cadreFullart})` }}
            aria-hidden="true"
          />
        )}
        <div className="iris" aria-hidden="true" />
        <div className="paillettes" aria-hidden="true" />
        <div className="reflet" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={`plaque t-${c.tier}${c.rainbow ? " rainbow" : ""}`}>
      {/* Le portrait passe sous le cadre, dans la fenêtre transparente du PNG. */}
      <div className="fenetre" style={boite(CADRE.art)}>
        {src ? (
          <img
            src={src} alt="" draggable="false" loading="lazy"
            style={{ objectPosition: `50% ${cfgImage.focal ?? 30}%` }}
            onError={() => setRate(true)}
          />
        ) : (
          <Monogramme nom={c.nom} />
        )}
      </div>

      <img className="cadre" src={`${base}${ASSET.cadre}`} alt="" draggable="false" />

      {/* Teinte de rareté : le cadre lui-même sert de masque, on ne recolore
          que ses traits sans toucher au portrait. */}
      {t.teinte && (
        <span
          className="teinte"
          style={{ "--tc": t.teinte, "--ta": t.teinteA, maskImage: `url(${base}${ASSET.cadre})`,
                   WebkitMaskImage: `url(${base}${ASSET.cadre})` }}
          aria-hidden="true"
        />
      )}

      <div className="zone-nom" style={boite(CADRE.nom)}>
        <span ref={refNom} className="nom">{c.nom}</span>
      </div>

      {/* Une ligne d'emploi, une ligne de références, puis le trait de
          caractère. Le grade et le corps ne sont plus le sujet : ils situent.
          Le genre est retiré, le nom et le portrait le disent déjà. */}
      <div className="zone-detail" style={boite(CADRE.detail)}>
        {/* Le triptyque tient la première ligne, la citation la suit.
            L'occupation ne figure plus ici : elle répétait à demi le grade et
            volait la place au seul texte qui ne soit pas une donnée. */}
        <span ref={refDetail} className="detail">
          {reperes.length > 0 && (
            <i className="reperes">
              {reperes.map((r, i) => <span key={i}>{r}</span>)}
            </i>
          )}
          {c.citation && <em className="citation">{c.citation}</em>}
        </span>
      </div>

      <div className="zone-pied" style={boite(CADRE.pied)}>
        <Encoches n={t.encoches} />
        <span className="palier">{t.nom}{c.rainbow && " · Rainbow"}</span>
      </div>

      {c.rainbow && <div className="iris" aria-hidden="true" />}
      {c.tier === "legendaire" && !c.rainbow && <div className="iris or" aria-hidden="true" />}
      {(c.rainbow || c.tier === "legendaire") && <div className="paillettes" aria-hidden="true" />}
      <div className="reflet" aria-hidden="true" />
    </div>
  );
}
