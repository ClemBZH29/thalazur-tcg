import { useEffect, useMemo, useRef, useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import { RELIQUAIRE } from "../config/reliquaire.js";
import { conditionsLegendaire, eligible, peutForger, surplus } from "../reliquaire/regles.js";
import "../styles/expeditions.css";

const IMG = `${import.meta.env.BASE_URL}reliquaire/`;
const ORDRE = ["commun", "peucommun", "rare", "legendaire"];
const NOM_PALIER = { commun: "Commune", peucommun: "Peu commune", rare: "Rare", legendaire: "Légendaire" };
const FILTRES = ["tout", ...ORDRE];
const dateFr = (t) => new Date(t).toLocaleDateString("fr-FR");

/**
 * L'effet joué par-dessus la page : une planche de neuf images, lue en
 * `steps`, au noir rendu transparent. Coupé en mouvement réduit.
 */
function Effet({ genre, onFin }) {
  const fin = useRef(onFin);
  fin.current = onFin;
  useEffect(() => { const t = setTimeout(() => fin.current(), 1300); return () => clearTimeout(t); }, []);
  return <div className={`rel-effet rel-effet-${genre}`} style={{ backgroundImage: `url(${IMG}${genre}.webp)` }} aria-hidden="true" />;
}

const TYPES = { tout: "Tous types", pnj: "PNJ", lieu: "Lieux", artefact: "Artéfacts" };
const cherchable = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function PageReliquaire() {
  const { etat, boosterId, booster, jeuComplet, vestiges, dissoudreCarte, dissoudreSurplus, forgerCarte,
    mouvementReduit, reliquaireOuvert } = useJeu();
  const [filtre, setFiltre] = useState("tout");
  const [type, setType] = useState("tout");
  const [recherche, setRecherche] = useState("");
  const [forgeables, setForgeables] = useState(false);
  const [confirme, setConfirme] = useState(null);
  const [effet, setEffet] = useState(null);
  const [annonce, setAnnonce] = useState("");
  const idEffet = useRef(0);

  const cartes = useMemo(() => jeuComplet.filter(eligible), [jeuComplet]);
  const coll = etat.collections?.[boosterId] || {};
  const n = (c) => coll[c.id]?.normale || 0;
  const L = conditionsLegendaire(etat, boosterId, cartes);

  if (!reliquaireOuvert) {
    return (
      <main className="view large exp-page rel-page" id="contenu">
        <header className="exp-bandeau" style={{ backgroundImage: `url(${IMG}bandeau.webp)` }}>
          <div className="exp-bandeau-texte">
            <h1>Le Reliquaire est scellé</h1>
            <p className="lede">
              Le gardien ouvre sa crypte aux collectionneurs qui ont complété une extension à
              {" "}{Math.round(RELIQUAIRE.ouverture * 100)} % au moins. {booster?.titre || "Cette extension"} : {Math.round(L.completion * 100)} %.
            </p>
          </div>
        </header>
      </main>
    );
  }

  const q = cherchable(recherche.trim());
  const garde = (c) => (type === "tout" || c.type === type) && (!q || cherchable(`${c.nom} ${c.rep1} ${c.rep3}`).includes(q));
  const tri = (a, b) => ORDRE.indexOf(a.tier) - ORDRE.indexOf(b.tier) || a.nom.localeCompare(b.nom);
  const doublons = cartes.filter((c) => n(c) > 1 && garde(c) && (filtre === "tout" || c.tier === filtre)).sort(tri);
  const toutesManquantes = cartes.filter((c) => n(c) === 0 && garde(c));
  const parPalier = Object.fromEntries(ORDRE.map((t) => [t, toutesManquantes.filter((c) => c.tier === t).length]));
  // Ce qui se forge maintenant passe devant : c'est ce qu'on vient chercher.
  const manquantes = toutesManquantes
    .filter((c) => (filtre === "tout" || c.tier === filtre) && (!forgeables || peutForger(etat, boosterId, c, cartes)))
    .sort((a, b) => peutForger(etat, boosterId, b, cartes) - peutForger(etat, boosterId, a, cartes) || tri(a, b));
  const vrac = surplus(etat, boosterId, cartes, ["commun", "peucommun"]);

  const jouer = (genre) => { if (!mouvementReduit) { idEffet.current += 1; setEffet({ genre, id: idEffet.current }); } };
  const demander = (cle, action) => { if (confirme === cle) { setConfirme(null); action(); } else setConfirme(cle); };

  const dissoudre = (c) => {
    const faire = () => { dissoudreCarte(boosterId, c); jouer("dissolution"); setAnnonce(`${c.nom} dissoute : + ${RELIQUAIRE.dissolution[c.tier]} vestiges.`); };
    if (c.tier === "legendaire") demander(`d-${c.id}`, faire); else faire();
  };
  const forger = (c) => demander(`f-${c.id}`, () => {
    if (forgerCarte(boosterId, c, cartes)) {
      jouer(c.tier === "legendaire" ? "forge-legendaire" : "forge");
      setAnnonce(`${c.nom} forgée et rangée dans la bibliothèque.`);
    }
  });

  return (
    <main className="view large exp-page rel-page" id="contenu">
      <header className="exp-bandeau" style={{ backgroundImage: `url(${IMG}bandeau.webp)` }}>
        <div className="exp-bandeau-texte">
          <h1>Reliquaire</h1>
          <p className="lede">
            Le gardien dissout vos exemplaires en trop en vestiges, et forge avec eux les cartes
            qui vous manquent. Il paie un peu moins que le Comptoir, mais il a toujours la carte
            que vous cherchez.
          </p>
        </div>
      </header>

      <div className="rel-comptoir">
        <img className="rel-gardien" src={`${IMG}gardien.webp`} alt="Le gardien du Reliquaire" draggable="false" />
        <div className="rel-reserve">
          <img src={`${IMG}vestige.webp`} alt="" className="rel-vestige" />
          <p><b>{vestiges.toLocaleString("fr-FR")}</b> vestiges</p>
          <p className="muted">{booster?.titre || booster?.nom || "Extension"} · collection à {Math.round(L.completion * 100)} %</p>
        </div>
        <img className="rel-coffre" src={`${IMG}reliquaire.webp`} alt="" draggable="false" />
      </div>
      <p className="muted rel-hors">Les cartes de personnage, les full art et les versions rainbow restent hors du Reliquaire.</p>
      <p className="sr" role="status" aria-live="polite">{annonce}</p>

      {/* Une barre pour les deux colonnes, collée sous le bandeau : on cherche
          une carte par son nom, son archétype ou sa faction plutôt que de la
          chercher des yeux dans deux cents lignes. */}
      <div className="rel-outils" role="search">
        <label className="rel-recherche">
          <span className="sr">Chercher une carte</span>
          <input id="rel-recherche" type="search" placeholder="Chercher une carte, un archétype, une faction…"
            value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </label>
        <div className="rel-filtres" role="group" aria-label="Rareté">
          {FILTRES.map((f) => (
            <button type="button" key={f} className="exp-choix" aria-pressed={filtre === f} onClick={() => setFiltre(f)}>
              {f === "tout" ? "Toutes" : NOM_PALIER[f]}
              {f !== "tout" && <span className="rel-compte">{parPalier[f]}</span>}
            </button>
          ))}
        </div>
        <div className="rel-filtres" role="group" aria-label="Type de carte">
          {Object.entries(TYPES).map(([k, nom]) => (
            <button type="button" key={k} className="exp-choix" aria-pressed={type === k} onClick={() => setType(k)}>{nom}</button>
          ))}
        </div>
      </div>

      <div className="rel-colonnes">
        <section className="rel-volet">
          <div className="section-titre"><h2>Dissoudre</h2><span className="muted">le dernier exemplaire n'est jamais proposé</span></div>
          {vrac.cartes > 0 && (
            <button type="button" className={`btn ${confirme === "vrac" ? "exp-danger" : "quiet"} rel-vrac`}
              onClick={() => demander("vrac", () => { dissoudreSurplus(boosterId, cartes); jouer("dissolution"); setAnnonce(`${vrac.cartes} cartes dissoutes : + ${vrac.vestiges} vestiges.`); })}>
              {confirme === "vrac"
                ? `Confirmer : ${vrac.cartes} cartes pour ${vrac.vestiges} vestiges`
                : `Dissoudre les communes et peu communes en trop (${vrac.vestiges} vestiges)`}
            </button>
          )}
          <ul className="rel-liste">
            {doublons.length ? doublons.map((c) => (
              <li key={c.id} className={`xr-${c.tier}`}>
                <span className="exp-rar" aria-hidden="true" />
                <span className="rel-nom"><strong>{c.nom}</strong><small>{NOM_PALIER[c.tier]} · {n(c)} exemplaires, {n(c) - 1} en trop</small></span>
                <span className="rel-cout"><b>{RELIQUAIRE.dissolution[c.tier]} vestiges</b></span>
                <button type="button" className={`btn sm ${confirme === `d-${c.id}` ? "exp-danger" : "quiet"}`} onClick={() => dissoudre(c)}>
                  {confirme === `d-${c.id}` ? "Confirmer" : "Dissoudre 1"}
                </button>
              </li>
            )) : <li><span className="rel-nom"><small>Aucun exemplaire en trop{q || filtre !== "tout" || type !== "tout" ? " dans ce filtre" : ""}.</small></span></li>}
          </ul>
        </section>

        <section className="rel-volet">
          <div className="section-titre">
            <h2>Forger</h2>
            <label className="rel-forgeables">
              <input type="checkbox" id="rel-forgeables" checked={forgeables} onChange={(e) => setForgeables(e.target.checked)} />
              Seulement ce que je peux forger
            </label>
          </div>
          <div className="rel-legendaire">
            <h3>Forger une légendaire</h3>
            <ul>
              <li className={L.completionOk ? "ok" : "ko"}>Collection à {Math.round(RELIQUAIRE.legendaire.completionMin * 100)} % au moins (vous : {Math.round(L.completion * 100)} %)</li>
              <li className={L.delaiOk ? "ok" : "ko"}>Une par {RELIQUAIRE.legendaire.delaiJours} jours{L.delaiOk ? "" : ` (prochaine le ${dateFr(L.prochaine)})`}</li>
              <li className={L.vestigesOk ? "ok" : "ko"}>{RELIQUAIRE.forge.legendaire} vestiges</li>
            </ul>
          </div>
          <p className="muted rel-nombre">{manquantes.length} carte{manquantes.length > 1 ? "s" : ""}{forgeables ? " à forger maintenant" : " manquante" + (manquantes.length > 1 ? "s" : "")}</p>
          <ul className="rel-liste">
            {manquantes.length ? manquantes.map((c) => {
              const ok = peutForger(etat, boosterId, c, cartes);
              return (
                <li key={c.id} className={`xr-${c.tier}${ok ? "" : " rel-hors-portee"}`}>
                  <span className="exp-rar" aria-hidden="true" />
                  <span className="rel-nom"><strong>{c.nom}</strong><small>{NOM_PALIER[c.tier]} · {c.rep1}{c.rep3 ? ` · ${c.rep3}` : ""}</small></span>
                  <span className="rel-cout"><b>{RELIQUAIRE.forge[c.tier]} vestiges</b></span>
                  <button type="button" className="btn sm" disabled={!ok} onClick={() => forger(c)}>
                    {confirme === `f-${c.id}` ? "Confirmer" : "Forger"}
                  </button>
                </li>
              );
            }) : <li><span className="rel-nom"><small>Aucune carte dans ce filtre.</small></span></li>}
          </ul>
        </section>
      </div>
      {effet && <Effet key={effet.id} genre={effet.genre} onFin={() => setEffet(null)} />}
    </main>
  );
}
