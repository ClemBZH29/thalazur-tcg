import { useEffect, useRef, useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import { BOOSTERS } from "../extensions/index.js";
import { COMPETENCES, ETOILE, ROLES, allie, cartesDonjon, roleDe } from "../donjon/regles.js";
import { cleXP, niveauDe, xpDe } from "../donjon/experience.js";
import {
  RANG_MAX, catalogue, competenceDe, coutCompetence, coutRang, etoiles, ficheDe, naturelle, origine, possedee, rainbowEnTrop,
} from "../donjon/fiches.js";

/** Les PNJ alliés : les seules cartes qui descendent au Donjon. */
const COMPAGNONS = new Set(cartesDonjon(BOOSTERS).allies.map(cleXP));
export const estCompagnon = (c) => !!c?.ext && COMPAGNONS.has(cleXP(c));

/** L'étoile, dessinée : le caractère ★ change d'allure d'une police à l'autre. */
export function Etoile({ taille = 12, className = "" }) {
  return (
    <svg className={`etoile ${className}`} width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z" fill="currentColor" />
    </svg>
  );
}

const PLACES = { geste: "Compétence 1 · geste", tech: "Compétence 2 · technique" };
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Des pastilles pour la recharge : une par tour d'attente. */
function Recharge({ cd }) {
  if (!cd) return <span className="fc-recharge muted">sans recharge</span>;
  return (
    <span className="fc-recharge" title={`Recharge : ${pluriel(cd, "tour")}`}>
      {Array.from({ length: cd }, (_, i) => <i key={i} />)}
      <span className="sr">Recharge : {pluriel(cd, "tour")}</span>
    </span>
  );
}

/**
 * La fenêtre de choix d'une compétence. Une `<dialog>` modale : le reste de
 * la page devient inerte, le focus y reste, et Échap ne ferme qu'elle (la
 * loupe écoute aussi Échap, sur la fenêtre).
 */
function ChoixCompetence({ c, place, actuelle, vestiges, onChoisir, onFermer }) {
  const ref = useRef(null);
  const [confirme, setConfirme] = useState(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
    return () => { if (d?.open) d.close(); };
  }, []);
  const fermer = () => { ref.current?.close(); onFermer(); };
  const touche = (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault(); e.stopPropagation();
    fermer();
  };
  const liste = catalogue(c, place);
  const role = ROLES[roleDe(c.rep1)];
  return (
    <dialog ref={ref} className="fc-choix" aria-labelledby="fc-choix-titre" onKeyDown={touche}
      onClick={(e) => { e.stopPropagation(); if (e.target === ref.current) fermer(); }}>
      <div className="fc-choix-corps">
        <header className="fc-choix-tete">
          <div>
            <h2 id="fc-choix-titre">{PLACES[place]}</h2>
            <p className="muted">
              {c.nom}, {role.nom.toLowerCase()} · <b>{vestiges.toLocaleString("fr-FR")}</b> vestiges
            </p>
          </div>
          <button type="button" className="btn quiet sm" onClick={fermer}>Fermer</button>
        </header>
        <p className="muted fc-choix-aide">
          {place === "geste"
            ? "Le geste est ce que la carte fait quand elle ne fait rien d'autre : il n'a pas de recharge."
            : "La technique se recharge entre deux usages."}
          {" "}Celles du rôle coûtent moitié prix ; revenir à celle d'origine est gratuit. Les soins restent le métier des rôles qui soignent.
        </p>
        <ul className="fc-options">
          {liste.map((K) => {
            const cout = coutCompetence(c, K.id);
            const est = K.id === actuelle;
            const fermee = cout == null;
            const manque = !fermee && cout > vestiges;
            const cle = `c-${K.id}`;
            return (
              <li key={K.id} className={`fc-option${est ? " actuelle" : ""}${fermee ? " fermee" : ""}`}>
                <div className="fc-option-tete">
                  <b>{K.nom}</b>
                  {K.id === origine(c, place) && <span className="fc-badge">D'origine</span>}
                  {K.id !== origine(c, place) && naturelle(c, K.id) && <span className="fc-badge role">{role.nom}</span>}
                  {fermee && <span className="fc-badge">{K.roles.map((r) => ROLES[r].nom).join(", ")}</span>}
                  {place === "tech" && <Recharge cd={K.cd} />}
                </div>
                <p>{K.aide}.</p>
                <p className="fc-option-etoile"><Etoile taille={11} /> {K.etoile}.</p>
                <button type="button" className={`btn sm${confirme === cle ? "" : " quiet"}`} disabled={est || fermee || manque}
                  onBlur={() => setConfirme((x) => (x === cle ? null : x))}
                  onClick={() => {
                    if (confirme !== cle && cout > 0) { setConfirme(cle); return; }
                    if (onChoisir(K.id)) fermer();
                  }}>
                  {est ? "Actuelle" : fermee ? "Réservée à ces rôles" : confirme === cle ? `Confirmer · ${cout} vestiges` : cout ? `${cout} vestiges` : "Reprendre · gratuit"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </dialog>
  );
}

/**
 * Le volet « Combat » de la carte agrandie, à gauche de la carte : ce qu'elle
 * vaut au Donjon, et ce qu'on peut y changer (voir src/donjon/fiches.js).
 * Il vaut pour la carte, pas pour une version : la normale et la rainbow
 * montrent la même fiche.
 */
export default function VoletCombat({ c }) {
  const { etat, vestiges, acheterRangCarte, changerCompetenceCarte, etoilerCarte, reliquaireOuvert } = useJeu();
  const [choix, setChoix] = useState(null);
  const [confirme, setConfirme] = useState(null);
  const [annonce, setAnnonce] = useState("");
  if (!estCompagnon(c)) return null;

  const f = ficheDe(etat, c);
  const niveau = niveauDe(xpDe(etat, c));
  const u = allie({ uid: 0 }, c, niveau, f);
  const R = ROLES[u.role];
  const a = possedee(etat, c);
  const rb = rainbowEnTrop(etat, c);
  const nEt = etoiles(f);

  const rang = (ligne) => {
    const nom = ligne === "atq" ? "ATQ" : "INI";
    if (acheterRangCarte(c, ligne)) setAnnonce(`${nom} +1 : rang ${(f[ligne] || 0) + 1} sur ${RANG_MAX}.`);
  };
  const etoiler = (ligne, nom) => {
    const cle = `e-${ligne}`;
    if (confirme !== cle) { setConfirme(cle); return; }
    setConfirme(null);
    if (etoilerCarte(c, ligne)) setAnnonce(`${nom} étoilée. Une rainbow de ${c.nom} a quitté la collection.`);
  };

  // Des fonctions qui rendent du JSX, pas des composants : déclarés dans le
  // rendu, ils seraient remontés à chaque fois, et le bouton armé perdrait
  // son focus entre les deux clics.
  const boutonEtoile = (ligne, nom) => f.etoiles?.[ligne] ? (
    <span className="fc-figee"><Etoile /> Figée</span>
  ) : (
    <button type="button" className={`fc-etoiler${confirme === `e-${ligne}` ? " arme" : ""}`} disabled={!a || rb < 1}
      onBlur={() => setConfirme((x) => (x === `e-${ligne}` ? null : x))}
      title={rb < 1 ? `Il faut une rainbow de ${c.nom} en plus de celle de la collection.` : `Étoiler la ligne ${nom} : elle sera figée.`}
      aria-label={confirme === `e-${ligne}` ? `Confirmer : étoiler ${nom} contre une rainbow` : `Étoiler ${nom}`}
      onClick={() => etoiler(ligne, nom)}>
      <Etoile />{confirme === `e-${ligne}` && <span>1 rainbow ?</span>}
    </button>
  );

  const rangLigne = (ligne, nom, valeur) => {
    const r = f[ligne] || 0;
    const cout = coutRang(f, ligne);
    return (
      <li className={`fc-ligne${f.etoiles?.[ligne] ? " etoilee" : ""}`}>
        <span className="fc-nom">{nom}</span>
        <b className="fc-valeur">{valeur}</b>
        <span className="fc-rangs" title={`Rang ${r} sur ${RANG_MAX}`}>
          {Array.from({ length: RANG_MAX }, (_, i) => <i key={i} className={i < r ? "pris" : ""} />)}
        </span>
        <span className="fc-actions">
          {cout != null && (
            <button type="button" className="btn quiet sm" disabled={!a || cout > vestiges} onClick={() => rang(ligne)}
              aria-label={`${nom} +1 pour ${cout} vestiges`}>+1 · {cout}</button>
          )}
          {boutonEtoile(ligne, nom)}
        </span>
      </li>
    );
  };

  const compLigne = (place) => {
    const K = COMPETENCES[competenceDe(c, f, place)];
    const fig = f.etoiles?.[place];
    return (
      <li className={`fc-ligne fc-comp${fig ? " etoilee" : ""}`}>
        <span className="fc-nom">{place === "geste" ? "Comp. 1" : "Comp. 2"}</span>
        <span className="fc-comp-nom"><b>{K.nom}</b>{place === "tech" && <Recharge cd={Math.max(0, K.cd - (fig ? 1 : 0))} />}</span>
        <span className="fc-actions">
          {!fig && <button type="button" className="btn quiet sm" disabled={!a} onClick={() => setChoix(place)}>Changer</button>}
          {boutonEtoile(place, K.nom)}
        </span>
        {/* L'effet sur toute la largeur, sous le nom et les boutons. */}
        <small className="fc-comp-aide">{fig ? K.etoile : K.aide}</small>
      </li>
    );
  };

  return (
    <aside className="volets volets-gauche" aria-label={`Fiche de combat de ${c.nom}`} onClick={(e) => e.stopPropagation()}>
      <section className={`volet volet-combat${nEt === 4 ? " complete" : ""}`}>
        <header className="fc-tete">
          <h3>Combat</h3>
          <span className="muted">{R.nom} · Niv. {niveau}</span>
        </header>
        <ul className="fc-lignes">
          <li className="fc-ligne">
            <span className="fc-nom">PV</span><b className="fc-valeur">{u.pvMax}</b>
            <span className="fc-passif muted">{R.passif ? `Passif : ${R.passif}` : ""}</span>
          </li>
          {rangLigne("atq", "ATQ", u.atq)}
          {rangLigne("ini", "INI", u.ini)}
          {compLigne("geste")}
          {compLigne("tech")}
        </ul>
        <p className="fc-pied muted">
          <span><b>{vestiges.toLocaleString("fr-FR")}</b> vestiges</span>
          <span><Etoile taille={11} /> {nEt}/4 · {rb} rainbow en trop</span>
        </p>
        {!a && <p className="muted fc-note">Il faut la version normale de la carte pour la modifier.</p>}
        {a && !vestiges && !reliquaireOuvert && <p className="muted fc-note">Les vestiges viennent des doublons dissous, une fois le Reliquaire ouvert.</p>}
        {nEt === 4 && <p className="fc-note fc-complete"><Etoile /> Les quatre lignes sont étoilées : ATQ ×{String(ETOILE.atq).replace(".", ",")}, INI +{ETOILE.ini}, compétences ×{String(ETOILE.puissance).replace(".", ",")}.</p>}
        <p className="sr" role="status" aria-live="polite">{annonce}</p>
        {annonce && <p className="volet-annonce" aria-hidden="true">{annonce}</p>}
      </section>
      {choix && (
        <ChoixCompetence c={c} place={choix} actuelle={competenceDe(c, f, choix)} vestiges={vestiges}
          onFermer={() => setChoix(null)}
          onChoisir={(id) => {
            const ok = changerCompetenceCarte(c, id);
            if (ok) setAnnonce(`${PLACES[choix].split(" · ")[0]} : ${COMPETENCES[id].nom}.`);
            return ok;
          }} />
      )}
    </aside>
  );
}
