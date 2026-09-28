import { useEffect, useMemo, useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import { EXPEDITION } from "../config/expeditions.js";
import { PALIER_IRISEE, NIVEAU_MAX, cleXP, xpPourNiveau } from "../donjon/experience.js";
import { affine, capacite, estimer, jourDe, niveau, puissance } from "../expeditions/regles.js";
import { formatDuree } from "../lib/economie.js";
import "../styles/expeditions.css";

const IMG = `${import.meta.env.BASE_URL}expeditions/`;
const ORDRE = ["commun", "peucommun", "rare", "legendaire"];
const NOM_PALIER = { commun: "Commun", peucommun: "Peu commun", rare: "Rare", legendaire: "Légendaire" };
const DUREES = Object.keys(EXPEDITION.durees).map(Number);
const heure = (t) => new Date(t).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" });

/** Où en est un Lieu : niveau, et avancée vers son rainbow ou vers le niveau 100. */
function Progression({ etat, lieu }) {
  const xp = etat.xp?.[cleXP(lieu)]?.xp || 0;
  const n = niveau(etat, lieu);
  const rainbow = !!etat.xp?.[cleXP(lieu)]?.irisee || (etat.collections?.[lieu.ext]?.[lieu.id]?.rainbow || 0) > 0;
  const palier = PALIER_IRISEE[lieu.tier] || 20;
  const vise = rainbow ? NIVEAU_MAX : palier;
  const p = n >= NIVEAU_MAX ? 1 : Math.min(1, xp / xpPourNiveau(vise));
  return (
    <span className={`exp-prog${rainbow ? "" : " arc"}`}>
      <span className="exp-prog-barre" aria-hidden="true"><i style={{ width: `${p * 100}%` }} /></span>
      <span className="exp-prog-meta">
        <span>Niv. {n}{rainbow && <span className="exp-pastille p-arc">rainbow</span>}</span>
        <span>{rainbow ? (n >= NIVEAU_MAX ? "niveau maximal" : "booster au niv. 100") : `rainbow au niv. ${palier}`}</span>
      </span>
    </span>
  );
}

function Route({ r, lieu, noms, maintenant, onRappel }) {
  const [confirme, setConfirme] = useState(false);
  const rentree = maintenant >= r.fin;
  const p = Math.min(1, Math.max(0, (maintenant - r.depart) / (r.fin - r.depart)));
  const equipe = noms.length > 5 ? `${noms.slice(0, 5).join(", ")} et ${noms.length - 5} autres` : noms.join(", ");
  return (
    <article className={`exp-route${rentree ? " rentree" : ""}`}>
      <div className="exp-route-tete">
        <h3>{lieu?.nom || "Lieu inconnu"}</h3>
        <span className="exp-route-reste">{rentree ? "rentrée, le butin arrive" : `retour dans ${formatDuree(r.fin - maintenant)}`}</span>
      </div>
      <div className="exp-piste" role="progressbar" aria-label={`Avancée de l'expédition vers ${lieu?.nom}`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}>
        <span className="exp-piste-fait" style={{ width: `${p * 100}%` }} />
        <img className="exp-piste-ici" src={`${IMG}marqueur.webp`} alt="" style={{ left: `${p * 100}%` }} />
      </div>
      <div className="exp-bornes"><span>{heure(r.depart)}</span><span>{heure(r.fin)}</span></div>
      <p className="exp-equipe">{r.cartes.length} compagnons : {equipe}</p>
      {!rentree && (
        <button type="button" className={`btn sm ${confirme ? "exp-danger" : "quiet"}`}
          onClick={() => (confirme ? onRappel(r.id) : setConfirme(true))} onBlur={() => setConfirme(false)}>
          {confirme ? "Confirmer : rentrer sans rien" : "Rappeler l'expédition"}
        </button>
      )}
    </article>
  );
}

export default function PageExpeditions() {
  const { etat, expeditions, compagnons, lieux, indexCartes, partirExpedition, rappelerExpedition, empechementExpedition } = useJeu();
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => { const iv = setInterval(() => setMaintenant(Date.now()), 20000); return () => clearInterval(iv); }, []);

  const [lieuId, setLieuId] = useState(null);
  const [choix, setChoix] = useState([]);
  const [heures, setHeures] = useState(12);
  const routes = expeditions.routes;
  const pleines = routes.length >= EXPEDITION.simultanees;
  const occupes = new Set(routes.map((r) => r.lieu));

  const lieu = lieux.find((l) => cleXP(l) === lieuId) || null;
  const cap = lieu ? capacite(etat, lieu) : 0;
  const equipe = choix.map((k) => indexCartes[k]).filter(Boolean);
  const est = lieu && equipe.length ? estimer(etat, lieu, equipe, heures) : null;

  const lieuxTries = useMemo(
    () => [...lieux].sort((a, b) => ORDRE.indexOf(a.tier) - ORDRE.indexOf(b.tier) || a.nom.localeCompare(b.nom)),
    [lieux]
  );
  const dispo = useMemo(() => {
    if (!lieu) return [];
    const rang = (c) => (empechementExpedition(c) ? 1 : 0);
    return [...compagnons].sort((a, b) => rang(a) - rang(b)
      || affine(b, lieu) - affine(a, lieu) || puissance(etat, b, lieu) - puissance(etat, a, lieu) || a.nom.localeCompare(b.nom));
  }, [compagnons, lieu, etat, empechementExpedition]);

  const choisirLieu = (l) => {
    const k = cleXP(l);
    if (k === lieuId) { setLieuId(null); return; }
    setLieuId(k);
    setChoix((c) => c.slice(0, capacite(etat, l)));
  };
  const basculer = (c) => {
    const k = cleXP(c);
    setChoix((l) => (l.includes(k) ? l.filter((x) => x !== k) : l.length < cap ? [...l, k] : l));
  };
  // Cartes libres affines d'abord, puis les plus puissantes : ce que rapporte le plus.
  const completer = () => {
    const libres = dispo.filter((c) => !empechementExpedition(c) && !choix.includes(cleXP(c)));
    setChoix((l) => [...l, ...libres.slice(0, cap - l.length).map(cleXP)]);
  };
  const partir = () => {
    if (partirExpedition(lieu, equipe, heures)) { setLieuId(null); setChoix([]); setMaintenant(Date.now()); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };
  const orRestant = EXPEDITION.or.plafondJour - (expeditions.orJour?.jour === jourDe(maintenant) ? expeditions.orJour.credite : 0);

  return (
    <main className="view large exp-page" id="contenu">
      <header className="exp-bandeau" style={{ backgroundImage: `url(${IMG}bandeau.webp)` }}>
        <div className="exp-bandeau-texte">
          <h1>Expéditions</h1>
          <p className="lede">
            Envoyez le banc sur les routes de vos Lieux. Beaucoup de monde, peu par carte :
            les expéditions tournent pendant que vous jouez ailleurs, et chaque Lieu progresse
            jusqu'à sa version rainbow.
          </p>
        </div>
      </header>

      <section>
        <div className="section-titre">
          <h2>En route</h2>
          <span className="muted">{routes.length} sur {EXPEDITION.simultanees} · or d'expédition restant aujourd'hui : {orRestant} PO</span>
        </div>
        {routes.length ? (
          <div className="exp-routes">
            {routes.map((r) => (
              <Route key={r.id} r={r} lieu={indexCartes[r.lieu]} maintenant={maintenant} onRappel={rappelerExpedition}
                noms={r.cartes.map((k) => indexCartes[k]?.nom).filter(Boolean)} />
            ))}
          </div>
        ) : (
          <div className="exp-vide">
            <img src={`${IMG}camp-vide.webp`} alt="" />
            <p>Aucune expédition en route. {lieux.length ? "Choisissez un Lieu ci-dessous et envoyez-y les cartes que le Donjon n'emmène pas." : ""}</p>
          </div>
        )}
      </section>

      <section>
        <div className="section-titre">
          <h2>Préparer une expédition</h2>
        </div>
        {!lieux.length ? (
          <p className="lede">Aucune carte Lieu dans votre collection pour l'instant. Chaque Lieu obtenu en booster ouvre une destination.</p>
        ) : (
          <>
            <p className="muted exp-aide">Les partants ne descendent pas au Donjon avant leur retour. Au retour, une fenêtre s'ouvre d'elle-même, jamais pendant un combat ni une ouverture.</p>
            {pleines && <p className="exp-note">Vos {EXPEDITION.simultanees} expéditions sont en route. Attendez un retour pour en préparer une autre.</p>}

            <h3 className="exp-etape">Destination</h3>
            <div className="exp-lieux">
              {lieuxTries.map((l) => {
                const k = cleXP(l), occ = occupes.has(k);
                const affines = compagnons.filter((c) => affine(c, l)).length;
                return (
                  <button type="button" key={k} className={`exp-choix xr-${l.tier}`} aria-pressed={lieuId === k} disabled={occ} onClick={() => choisirLieu(l)}>
                    <strong>{l.nom}</strong>
                    <span className="exp-meta">{l.rep1} · {l.rep3 || "Lieu"} · {NOM_PALIER[l.tier]}{occ ? " · en expédition" : ""}</span>
                    <span className="exp-meta">{capacite(etat, l)} places · {affines} compagnon{affines > 1 ? "s" : ""} de {l.rep1}</span>
                    <Progression etat={etat} lieu={l} />
                  </button>
                );
              })}
            </div>

            {lieu && (
              <>
                <div className="exp-etape-tete">
                  <h3 className="exp-etape">Compagnons <span className="muted">{equipe.length} / {cap}</span></h3>
                  <div className="exp-outils">
                    <span className="muted">Affines d'abord, puis les plus puissantes</span>
                    <button type="button" className="btn sm" disabled={equipe.length >= cap} onClick={completer}>Compléter l'équipe</button>
                    {equipe.length > 0 && <button type="button" className="btn quiet sm" onClick={() => setChoix([])}>Vider</button>}
                  </div>
                </div>
                <div className="exp-cartes">
                  {dispo.map((c) => {
                    const k = cleXP(c), pris = choix.includes(k), emp = empechementExpedition(c);
                    const bloque = !!emp || (!pris && equipe.length >= cap);
                    return (
                      <button type="button" key={k} className={`exp-choix exp-compagnon xr-${c.tier}`} aria-pressed={pris}
                        disabled={bloque && !pris} onClick={() => basculer(c)}>
                        <span className="exp-rar" aria-hidden="true" />
                        <span>
                          <strong>{c.nom}</strong>
                          <span className="exp-meta">{c.rep1} · {c.rep3} · niv. {niveau(etat, c)}</span>
                          <span className="exp-meta">
                            {affine(c, lieu) && <span className="exp-pastille p-aff">affinité</span>}
                            {emp === "expedition" && <span className="exp-pastille p-exp">en expédition</span>}
                            {emp === "donjon" && <span className="exp-pastille p-exp">au Donjon</span>}
                            {emp === "repos" && <span className="exp-pastille p-repos">au repos</span>}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <h3 className="exp-etape">Durée</h3>
                <div className="exp-segments">
                  {DUREES.map((h) => (
                    <button type="button" key={h} className="exp-choix" aria-pressed={heures === h} onClick={() => setHeures(h)}>
                      <strong>{h} heures</strong>
                      <span className="exp-meta">rendement × {EXPEDITION.durees[h].toLocaleString("fr-FR")} par heure</span>
                    </button>
                  ))}
                </div>

                {est && (
                  <div className="exp-estimation">
                    <strong>Au retour, {heure(maintenant + heures * 3600e3)}</strong>
                    <dl>
                      <dt>Pièces d'or</dt><dd>{est.or} PO, dans la limite de {EXPEDITION.or.plafondJour} PO par jour pour toutes les expéditions</dd>
                      <dt>Vestiges</dt><dd>{est.vestiges}, pour le Reliquaire</dd>
                      <dt>Compagnons</dt><dd>+ {est.xpCarte} XP chacun, quelle que soit leur rareté</dd>
                      <dt>{lieu.nom}</dt><dd>+ {est.xpLieu} XP pour le Lieu{equipe.length < cap ? " (équipe incomplète)" : ""}</dd>
                      <dt>Trouvailles</dt><dd>{est.trouvailles ? `${est.trouvailles} carte${est.trouvailles > 1 ? "s" : ""}, commune à rare` : "aucune sous 12 h"}</dd>
                    </dl>
                  </div>
                )}
              </>
            )}

            <div className="exp-barre">
              <p>{lieu ? `${lieu.nom} · ${equipe.length} / ${cap} · ${heures} h` : "Choisissez une destination"}</p>
              <button type="button" className="btn" disabled={!est || pleines} onClick={partir}>Partir en expédition</button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
