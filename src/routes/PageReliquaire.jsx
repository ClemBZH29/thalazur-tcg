import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import DosCarte from "../components/DosCarte.jsx";
import FaceCarte from "../components/FaceCarte.jsx";
import Icone from "../components/Icone.jsx";
import { Lien } from "../lib/routeur.jsx";
import { RELIQUAIRE } from "../config/reliquaire.js";
import { SLOTS, TAUX_DEFAUT } from "../config/tiers.js";
import { PALIERS, completion, eligible, frequences, jourDe, offreDuJour, offrePrise, offreRevelee } from "../reliquaire/regles.js";
import { chronologie, disposer, evenements, palier } from "../reliquaire/scene.js";
import { Forge, fmt } from "../reliquaire/forge.js";
import { bus, eteindre, jouerFinal, jouerGeste } from "../reliquaire/sons.js";
import "../styles/reliquaire.css";

const IMG = `${import.meta.env.BASE_URL}reliquaire/`;

/** Temps restant jusqu'à minuit, heure locale : la carte change alors. */
function avantMinuit(t) {
  const m = new Date(t); m.setHours(24, 0, 0, 0);
  const min = Math.max(0, Math.ceil((m - t) / 60000));
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

/** Ce que porte la carte tant qu'elle est face cachée : rien de la vraie. */
const CACHEE = { id: "cachee", nom: "", tier: "commun" };

/** Les chances de la carte du jour, lues dans la table du booster. */
function chances() {
  const f = frequences(SLOTS);
  const total = PALIERS.reduce((s, t) => s + f[t], 0);
  const pct = (v) => `${String(v >= 10 ? Math.round(v) : Math.round(v * 10) / 10).replace(".", ",")}\u202f%`;
  return [
    ...PALIERS.map((t) => [t, palier(t).nom, pct((f[t] / total) * 100), palier(t).encre]),
    ["rainbow", "✦ Rainbow", pct(TAUX_DEFAUT.rainbow * 100), "#b9a3f5"],
  ];
}

/** Un montant en vestiges : l'icône et le chiffre, sans le mot. */
function V({ n, taille = 20, refIcone, refNombre, className = "" }) {
  return (
    <span className={`rel-v ${className}`}>
      <img ref={refIcone} src={`${IMG}vestige.webp`} alt="" style={{ width: taille, height: taille }} draggable="false" />
      <span ref={refNombre}>{n != null ? fmt(n) : null}</span>
    </span>
  );
}

function Regles({ L, onFermer }) {
  return (
    <aside className="rel-regles" role="dialog" aria-label="Comment ça marche"
      style={{ width: L.reglesW, maxHeight: L.reglesH }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="rel-regles-tete">
        <b>Comment ça marche</b>
        <button type="button" onClick={onFermer} aria-label="Fermer"><Icone nom="fermer" taille={16} /></button>
      </div>
      <dl>
        <dt>Une par jour</dt><dd>La même carte pour tous, tirée comme dans un booster. Elle change à minuit.</dd>
        <dt>À l'aveugle</dt><dd>Forgée sans la voir, au prix moyen. Perdant sur une commune, gagnant sur une rare ou mieux.</dd>
        <dt>Retourner</dt><dd>Gratuit : montre la carte et son prix, mais le prix à l'aveugle est perdu pour la journée.</dd>
        <dt>Prix</dt>
        <dd className="rel-regles-prix">
          {PALIERS.map((t) => (
            <span key={t}><span style={{ color: palier(t).encre }}>{palier(t).nom}</span> <V n={RELIQUAIRE.forge[t]} taille={14} /></span>
          ))}
          <span><span style={{ color: "#b9a3f5" }}>✦ Rainbow</span> <b>×{RELIQUAIRE.multRainbow}</b></span>
        </dd>
        <dt>Vestiges</dt>
        <dd>Tirés de vos doublons, dans la <Lien vers="/bibliotheque" actif={false} className="lien">bibliothèque</Lien>.
          Cartes de personnage et full art n'y entrent pas.</dd>
      </dl>
    </aside>
  );
}

const REFS = ["scene", "glow", "dark", "bright", "lift", "flip", "flash", "fx", "resIcon", "count", "vLine", "vReal", "vEcart"];

/**
 * Le Reliquaire : une scène, l'autel, la carte du jour (Claude Design,
 * 06/10/2026 ; mise en page et chronologie dans src/reliquaire/scene.js,
 * images dans forge.js, sons dans sons.js).
 *
 * La carte se présente face cachée. Deux gestes, confirmés d'un second
 * toucher : la forger à l'aveugle au prix moyen, ou la retourner (gratuit,
 * mais le prix moyen est perdu pour la journée). Le geste est joué sur le
 * jeu tout de suite — fermer la page pendant l'animation ne perd rien — et
 * l'écran le raconte ensuite : `anim` garde ce qu'il faut montrer pendant la
 * séquence, l'état du jeu reprend la main à la fin.
 */
export default function PageReliquaire() {
  const { etat, boosterId, booster, jeuComplet, vestiges, forgerOffre, revelerOffre, mouvementReduit,
    reliquaireOuvert, cfgImage, fichiers, setLoupe, reglageSon } = useJeu();

  // La scène prend la hauteur de la fenêtre sous le bandeau du site.
  const [dim, setDim] = useState(() => ({ W: typeof window !== "undefined" ? window.innerWidth : 1440, H: 780 }));
  const boite = useRef(null);
  useLayoutEffect(() => {
    const mesurer = () => {
      const el = boite.current;
      if (!el) return;
      const W = el.clientWidth;
      const haut = el.getBoundingClientRect().top + window.scrollY;
      const H = Math.max(W <= 720 ? 600 : 540, Math.round(window.innerHeight - haut));
      setDim((d) => (Math.abs(d.W - W) < 1 && Math.abs(d.H - H) < 1 ? d : { W, H }));
    };
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(boite.current);
    window.addEventListener("resize", mesurer);
    return () => { ro.disconnect(); window.removeEventListener("resize", mesurer); };
  }, []);
  const L = useMemo(() => disposer(dim.W, dim.H), [dim]);

  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setMaintenant(Date.now()), 30000); return () => clearInterval(iv); }, []);
  const jour = jourDe(maintenant);
  const cartes = useMemo(() => jeuComplet.filter(eligible), [jeuComplet]);
  const offre = useMemo(
    () => offreDuJour(boosterId, cartes, jour, { slots: SLOTS, tauxRainbow: TAUX_DEFAUT.rainbow }),
    [boosterId, cartes, jour]);

  const forge = useRef(null);
  if (!forge.current) forge.current = new Forge(`${IMG}vestige.webp`);
  const R = forge.current.R;
  const refs = useMemo(() => Object.fromEntries(REFS.map((k) => [k, (el) => {
    forge.current.R[k] = el;
    if (k === "fx") forge.current.monter(el);
  }])), []);

  const [anim, setAnim] = useState(null);
  const [bilan, setBilan] = useState(null);
  const [confirme, setConfirme] = useState(null);
  const [regles, setRegles] = useState(false);
  const [annonce, setAnnonce] = useState("");
  const lecture = useRef(null);

  const scelle = !reliquaireOuvert || !offre;
  const prise = offrePrise(etat, offre);
  const revelee = offreRevelee(etat, offre);
  const modeJeu = prise ? "forgee" : revelee ? "revelee" : "cachee";
  const P = palier(offre?.c.tier || "commun", !!offre?.rainbow);
  const carte = offre ? { ...offre.c, rainbow: offre.rainbow } : null;
  const ex = offre ? etat.collections?.[boosterId]?.[offre.c.id] : null;
  const detenus = offre ? (offre.rainbow ? ex?.rainbow : ex?.normale) || 0 : 0;

  // Ce que montre l'écran : la séquence en cours, ou l'état du jeu.
  const contenuRevele = anim ? anim.contenuRevele : modeJeu !== "cachee";
  const forgeeLigne = anim ? anim.forgeeLigne : modeJeu === "forgee";
  const modeBoutons = anim ? anim.modeAvant : modeJeu;
  const faceMontee = !!anim || modeJeu !== "cachee";
  const cout = offre ? (modeBoutons === "revelee" ? offre.prix : offre.prixAveugle) : 0;
  const reserve = anim ? anim.v0 : vestiges;
  const possible = reserve >= cout;

  const ctxRepos = { P, face: modeJeu !== "cachee", lueurRepos: modeJeu !== "cachee" ? 0.5 : 0,
    sombreRepos: scelle ? 0.5 : 0, vestiges, verdict: bilan };
  // Au repos, l'image suit l'état à chaque rendu (compteur, lueur, carte).
  useLayoutEffect(() => { if (!anim) forge.current.image(null, 0, ctxRepos); });

  /* ── La séquence ─────────────────────────────────────────────────── */
  const ecartDe = (o) => o.prix - o.prixAveugle;
  const finir = useCallback((saut) => {
    const l = lecture.current;
    if (!l) return;
    cancelAnimationFrame(l.raf);
    if (saut) { eteindre(l.bus); jouerFinal(bus(reglageSon), l.geste, l.son); }
    forge.current.image(l.geste, l.tl.fin, l.ctx);
    lecture.current = null;
    setAnnonce(l.annonce);
    setAnim(null);
  }, [reglageSon]);

  // Une séquence par geste : `anim.tl` est neuf à chaque lancement, et ne
  // change pas quand les évènements de la séquence mettent `anim` à jour.
  useEffect(() => {
    if (!anim) return;
    const { geste, tl } = anim;
    forge.current.preparer(tl, { P, L, rainbow: !!offre.rainbow, tier: offre.c.tier });
    const nom = `${offre.c.nom}, ${P.nom}${offre.rainbow ? " rainbow" : ""}`;
    const l = {
      geste, tl, raf: 0, vus: {},
      ctx: { P, v0: anim.v0, verdict: geste === "aveugle" ? { paye: offre.prixAveugle, vaut: offre.prix } : bilan },
      son: { tier: offre.c.tier, rainbow: !!offre.rainbow, grand: P.grand, ecart: ecartDe(offre) },
      annonce: geste === "aveugle"
        ? `Forgée à l'aveugle : ${nom}. Payée ${fmt(offre.prixAveugle)} vestiges, elle en vaut ${fmt(offre.prix)}.`
        : geste === "reveler" ? `La carte du jour est ${nom}, à ${fmt(offre.prix)} vestiges.`
        : `${offre.c.nom} forgée et rangée dans la bibliothèque.`,
    };
    lecture.current = l;
    if (mouvementReduit) { jouerFinal(bus(reglageSon), geste, l.son); finir(false); return; }
    l.bus = bus(reglageSon);
    jouerGeste(l.bus, geste, tl, l.son);
    const evts = evenements(geste, tl);
    const t0 = performance.now();
    const pas = (now) => {
      if (lecture.current !== l) return;
      const t = now - t0;
      forge.current.image(geste, t, l.ctx);
      evts.forEach(([a, champ], i) => {
        if (t >= a && !l.vus[i]) { l.vus[i] = true; setAnim((x) => (x ? { ...x, [champ]: true } : x)); }
      });
      if (t >= tl.fin) return finir(false);
      l.raf = requestAnimationFrame(pas);
    };
    l.raf = requestAnimationFrame(pas);
  }, [anim?.tl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { const l = lecture.current; if (l) { cancelAnimationFrame(l.raf); eteindre(l.bus); } }, []);

  const lancer = (geste) => {
    if (anim || !offre) return;
    const v0 = vestiges;
    if (geste === "reveler") revelerOffre(offre);
    else if (!forgerOffre(offre, { aveugle: geste === "aveugle" })) return;
    if (geste === "aveugle") setBilan({ paye: offre.prixAveugle, vaut: offre.prix });
    const c = geste === "aveugle" ? offre.prixAveugle : geste === "forger" ? offre.prix : 0;
    setConfirme(null);
    setAnim({ geste, tl: chronologie(geste, P, c), modeAvant: modeJeu, contenuRevele: geste === "forger", forgeeLigne: false, v0 });
  };

  const principal = () => {
    const voulu = modeBoutons === "revelee" ? "forger" : "aveugle";
    if (confirme !== voulu) return setConfirme(voulu);
    lancer(voulu);
  };
  const secondaire = () => {
    if (confirme !== "retourner") return setConfirme("retourner");
    lancer("reveler");
  };
  const passer = () => {
    if (regles) setRegles(false);
    if (lecture.current) finir(true);
  };
  const basculerRegles = (e) => { e.stopPropagation(); setRegles((r) => !r); };

  /* ── Rendu ───────────────────────────────────────────────────────── */
  const pct = completion(etat, boosterId, cartes);
  const armeP = confirme === (modeBoutons === "revelee" ? "forger" : "aveugle");
  const armeS = confirme === "retourner";
  const titre = contenuRevele && offre ? offre.c.nom : "Carte du jour";
  const possession = detenus > 0 ? `×${detenus}` : "Manquante";
  const manque = !forgeeLigne && !possible && !anim ? fmt(cout - reserve) : null;
  const reste = avantMinuit(maintenant);

  // Des éléments, pas des composants : un composant défini dans le rendu
  // serait remonté à chaque rendu, et avec lui les nœuds où la forge écrit.
  const titreEl = (mob) => (
    <h1 className={`rel-titre${!mob && contenuRevele && titre.length > 18 ? " long" : ""}`}>{titre}</h1>
  );
  const sousEl = contenuRevele ? (
    <p className="rel-sous">
      <span style={{ color: P.encre }}>{P.nom}</span>
      {offre.rainbow && <span style={{ color: "#b9a3f5" }}>✦ Rainbow</span>}
      <span aria-hidden="true">·</span>
      <b>{possession}</b>
    </p>
  ) : (
    <ul className="rel-chances" aria-label="Chances">
      {chances().map(([t, nom, p, c]) => <li key={t}>{nom} <b style={{ color: c }}>{p}</b></li>)}
    </ul>
  );
  const verdictEl = (
    <p ref={refs.vLine} className="rel-verdict">
      <V n={bilan?.paye} /> <span aria-hidden="true" className="fleche">→</span>
      <span className="rel-v"><img src={`${IMG}vestige.webp`} alt="" draggable="false" /><span ref={refs.vReal} /></span>
      <b ref={refs.vEcart} className="rel-ecart" />
    </p>
  );
  const actionsEl = (
    forgeeLigne ? (
      <p className="rel-forgee"><Icone nom="fait" taille={18} /> <b>Forgée</b>
        {!L.mob && <><span aria-hidden="true">·</span><span>Nouvelle carte : {reste}</span></>}</p>
    ) : (
      <div className={`rel-actions${modeBoutons === "cachee" ? "" : " seul"}`} style={{ opacity: anim ? 0.4 : 1 }}>
        <button type="button" className={`rel-btn prim${armeP ? " arme" : ""}`} disabled={!possible || !!anim}
          onClick={principal} onBlur={() => setConfirme(null)}>
          <span>{armeP ? "Confirmer" : modeBoutons === "revelee" ? "Forger" : "À l'aveugle"}</span>
          <V n={cout} />
        </button>
        {modeBoutons === "cachee" && (
          <button type="button" className={`rel-btn sec${armeS ? " arme" : ""}`} disabled={!!anim}
            onClick={secondaire} onBlur={() => setConfirme(null)}
            title="Montre la carte et son prix. Le prix à l'aveugle est perdu pour aujourd'hui.">
            {armeS ? "Êtes-vous sûr\u00a0?" : "Retourner"}
          </button>
        )}
      </div>
    )
  );
  const scelleEl = (
    <div className="rel-scelle">
      <h1 className="rel-titre">Reliquaire scellé</h1>
      <span className="rel-pastille">{booster?.titre || "Collection"} <b>{Math.round(pct * 100)}&#8239;%</b></span>
      <div className="rel-jauge" role="img" aria-label={`${Math.round(pct * 100)} % sur ${Math.round(RELIQUAIRE.ouverture * 100)} % requis`}>
        <i style={{ width: `${Math.min(100, pct * 100)}%` }} />
        <b style={{ left: `${RELIQUAIRE.ouverture * 100}%` }} />
      </div>
      <span className="rel-etat">s'ouvre à {Math.round(RELIQUAIRE.ouverture * 100)}&#8239;%</span>
    </div>
  );

  return (
    <main className="rel-page" id="contenu" ref={boite}>
      <div ref={refs.scene} className={`rel-scene${L.mob ? " mob" : ""}${scelle ? " est-scelle" : ""}`}
        style={{ height: dim.H }} onPointerDown={passer}>
        <div className="rel-decor" style={{ left: L.bgX, top: L.bgY, width: L.bgW, height: L.bgH, backgroundImage: `url(${IMG}bandeau.webp)` }} />
        <div className="rel-voile" style={{ background: L.voile }} />
        <div className="rel-voile" style={{ background: L.voile2 }} />

        <div className="rel-gardien-lueur" style={{ left: L.gx, top: L.gy, width: L.gs, height: L.gs }} />
        <img className="rel-gardien" src={`${IMG}gardien.webp`} alt="" draggable="false"
          style={{ left: L.gx, top: L.gy, width: L.gs, height: L.gs }} />

        {!scelle && (
          <>
            <div className="rel-ombre" style={{ left: L.ombreX, top: L.ombreY, width: L.ombreW }} />
            <div ref={refs.glow} className="rel-lueur" style={{ left: L.glX, top: L.glY, width: L.glD, height: L.glD,
              background: `radial-gradient(circle, ${P.lueur}f2 0, ${P.lueur}6b 34%, transparent 64%)` }} />
          </>
        )}
        <div ref={refs.dark} className="rel-sombre" style={{ background: `radial-gradient(ellipse ${L.drW}px ${L.drH}px at ${L.ccx}px ${L.ccy}px, transparent 0, rgba(4,8,10,.55) 45%, rgba(4,8,10,.97) 100%)` }} />

        {!scelle && (
          <div className="cardbox rel-carte" data-palier={offre.rainbow ? "rainbow" : offre.c.tier}
            style={{ left: L.cx, top: L.cy, width: L.cw, height: L.ch }}
            role={contenuRevele && !anim ? "button" : "img"} tabIndex={contenuRevele && !anim ? 0 : undefined}
            aria-label={contenuRevele ? `${offre.c.nom}, ${P.nom}${offre.rainbow ? " rainbow" : ""}` : "Carte du jour, face cachée"}
            onClick={contenuRevele && !anim ? () => setLoupe(carte) : undefined}
            onKeyDown={contenuRevele && !anim ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLoupe(carte); } } : undefined}>
            <div ref={refs.bright} className="rel-carte-eclat">
              <div ref={refs.lift} className="rel-carte-lift">
                <div ref={refs.flip} className="flipper rel-flipper">
                  <DosCarte />
                  <FaceCarte c={faceMontee ? carte : CACHEE} cfgImage={cfgImage} fichiers={fichiers} />
                </div>
              </div>
            </div>
            <div ref={refs.flash} className="rel-flash" style={{ "--lueur": P.lueur }} />
          </div>
        )}

        <div ref={refs.fx} className="rel-fx" aria-hidden="true" />

        {!L.mob ? (
          <div className="rel-panneau" style={{ left: L.px, width: L.pw }}>
            {scelle ? scelleEl : (
              <>
                <div className="rel-zone-titre">{titreEl(false)}</div>
                <div className="rel-zone-sous">{sousEl}</div>
                <div className="rel-reserve" title="Vos vestiges">
                  <img ref={refs.resIcon} src={`${IMG}vestige.webp`} alt="" draggable="false" />
                  <span ref={refs.count} className="rel-compte" />
                  <span className="sr">vestiges</span>
                </div>
                <div className="rel-zone-verdict">
                  {manque && <span className="rel-manque">Manque <img src={`${IMG}vestige.webp`} alt="" /> {manque}</span>}
                  {bilan && verdictEl}
                </div>
                <div className="rel-zone-actions">{actionsEl}</div>
                <div className="rel-pied">
                  {regles && <Regles L={L} onFermer={basculerRegles} />}
                  <span className="rel-etat">{!forgeeLigne && <><Icone nom="horloge" taille={16} />Nouvelle carte : {reste}</>}</span>
                  <button type="button" className="rel-aide" onClick={basculerRegles} onPointerDown={(e) => e.stopPropagation()}
                    aria-expanded={regles}>
                    <Icone nom="aide" taille={16} />{L.pw >= 340 && <span>Comment ça marche</span>}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="rel-panneau-mob">
            {scelle ? scelleEl : (
              <>
                <div className="rel-tete-mob">
                  {titreEl(true)}
                  <span className="rel-reserve petit" title="Vos vestiges">
                    <img ref={refs.resIcon} src={`${IMG}vestige.webp`} alt="" draggable="false" />
                    <span ref={refs.count} className="rel-compte" />
                    <span className="sr">vestiges</span>
                  </span>
                </div>
                <div className="rel-zone-sous">
                  {contenuRevele ? (
                    <div className="rel-sous-mob">
                      {sousEl}
                      <div className="rel-zone-verdict petit">{bilan && verdictEl}</div>
                    </div>
                  ) : sousEl}
                </div>
                <div className="rel-zone-actions">{actionsEl}</div>
                <div className="rel-pied mob">
                  {regles && <Regles L={L} onFermer={basculerRegles} />}
                  {manque && <><b className="rel-manque">Manque {manque}</b><span aria-hidden="true">·</span></>}
                  <span className="rel-etat"><Icone nom="horloge" taille={16} /><span className="sr">Nouvelle carte dans </span>{reste}</span>
                  <button type="button" className="rel-aide rond" onClick={basculerRegles} onPointerDown={(e) => e.stopPropagation()}
                    aria-expanded={regles} aria-label="Comment ça marche">
                    <Icone nom="aide" taille={18} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <p className="sr" role="status" aria-live="polite">{annonce}</p>
    </main>
  );
}
