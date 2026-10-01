import { useEffect, useRef, useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import { BOOSTERS } from "../extensions/index.js";
import { COMPETENCES, ETOILE, ROLES, allie, cartesDonjon, roleDe } from "../donjon/regles.js";
import { cleXP, niveauDe, xpDe } from "../donjon/experience.js";
import { ETOILE_SOURCE, effetsSource, sourceDe, texteEffets } from "../donjon/pouvoirs.js";
import {
  LIGNE_SOURCE, RANG_MAX, catalogue, competenceDe, coutCompetence, coutRang, etoiles, ficheDe, naturelle, origine, possedee, rainbowEnTrop,
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
 * STAR RESET, pour toute carte possédée, étoilée ou non. Trois temps : le
 * bouton, un premier avertissement, un second, puis la suppression.
 */
function StarReset({ c, niveau, onFermer, fiche }) {
  const { etat, resetStarCarte, enExpedition } = useJeu();
  const [reset, setReset] = useState(0); // 0, puis les deux avertissements
  const nNorm = etat.collections?.[c.ext]?.[c.id]?.normale || 0;
  const nRb = etat.collections?.[c.ext]?.[c.id]?.rainbow || 0;
  if (nNorm + nRb < 1) return null;
  return (
        <section className={`volet fc-reset${reset ? ` etape-${reset}` : ""}`}>
          {!reset && (
            <button type="button" className="btn quiet sm fc-reset-bouton" disabled={enExpedition?.(c)}
              title={enExpedition?.(c) ? "La carte est en expédition." : undefined}
              onClick={() => setReset(1)}>
              <Etoile taille={11} /> STAR RESET
            </button>
          )}
          {reset === 1 && (
            <div className="fc-reset-confirme" role="group" aria-label="STAR RESET, avertissement 1 sur 2">
              <p className="fc-reset-etape">Avertissement 1 / 2</p>
              <p>
                La fiche revient à l'origine ({fiche}) et les{" "}
                <b>{pluriel(nNorm + nRb, "exemplaire")}</b> de {c.nom} sont perdus
                ({nNorm} normale{nNorm > 1 ? "s" : ""}, {nRb} rainbow), comme si vous n'aviez jamais eu la carte.
              </p>
              <span className="fc-confirme-boutons">
                <button type="button" className="btn sm fc-reset-ok" onClick={() => setReset(2)}>Confirmer</button>
                <button type="button" className="btn quiet sm" onClick={() => setReset(0)}>Annuler</button>
              </span>
            </div>
          )}
          {reset === 2 && (
            <div className="fc-reset-confirme" role="alertdialog" aria-label="STAR RESET, avertissement 2 sur 2">
              <p className="fc-reset-etape">Avertissement 2 / 2 · dernière confirmation</p>
              <p className="fc-reset-alerte">
                Le niveau de la carte repart à 1 (aujourd'hui niveau {niveau}), paliers compris. Les vestiges
                dépensés ne sont pas rendus. <b>Cette suppression est définitive.</b>
              </p>
              <span className="fc-confirme-boutons">
                <button type="button" className="btn sm fc-reset-ok" onClick={() => {
                  setReset(0);
                  if (resetStarCarte(c)) onFermer?.();
                }}>Supprimer définitivement</button>
                <button type="button" className="btn quiet sm" onClick={() => setReset(0)}>Annuler</button>
              </span>
            </div>
          )}
        </section>
  );
}

/**
 * Le volet « Combat » de la carte agrandie, à gauche de la carte : ce qu'elle
 * vaut au Donjon, et ce qu'on peut y changer (voir src/donjon/fiches.js).
 * Il vaut pour la carte, pas pour une version : la normale et la rainbow
 * montrent la même fiche.
 */
export default function VoletCombat({ c, onFermer }) {
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
    setConfirme(null);
    if (etoilerCarte(c, ligne)) setAnnonce(`${nom} étoilée. Une rainbow de ${c.nom} a quitté la collection.`);
  };

  // Des fonctions qui rendent du JSX, pas des composants : déclarés dans le
  // rendu, ils seraient remontés à chaque fois.
  //
  // Chaque ligne a la même grille et une largeur fixe : un bouton armé ou un
  // nom long ne doit jamais élargir le volet (il débordait sur la carte). La
  // confirmation d'une étoile s'ouvre donc *sous* la ligne, pas dans le bouton.
  const boutonEtoile = (ligne, nom) => f.etoiles?.[ligne] ? (
    <span className="fc-figee" title="Ligne étoilée : elle ne se modifie plus"><Etoile /> Figée</span>
  ) : (
    <button type="button" className={`fc-etoiler${confirme === ligne ? " arme" : ""}`} disabled={!a || rb < 1}
      aria-expanded={confirme === ligne}
      title={rb < 1 ? `Il faut une rainbow de ${c.nom} en plus de celle de la collection.` : `Étoiler ${nom} : la ligne sera figée.`}
      aria-label={`Étoiler ${nom}`}
      onClick={() => setConfirme((x) => (x === ligne ? null : ligne))}>
      <Etoile />
    </button>
  );
  const confirmation = (ligne, nom) => confirme === ligne && (
    <div className="fc-confirme" role="group" aria-label={`Étoiler ${nom}`}>
      <span>Dépensez une de vos Rainbow en double pour améliorer définitivement la ligne.</span>
      <span className="fc-confirme-boutons">
        <button type="button" className="btn sm fc-confirmer" onClick={() => etoiler(ligne, nom)}><Etoile /> Étoiler</button>
        <button type="button" className="btn quiet sm" onClick={() => setConfirme(null)}>Annuler</button>
      </span>
    </div>
  );

  const rangLigne = (ligne, nom, valeur) => {
    const r = f[ligne] || 0;
    const cout = coutRang(f, ligne);
    return (
      <li className={`fc-ligne${f.etoiles?.[ligne] ? " etoilee" : ""}`}>
        <span className="fc-cap">
          {nom}
          <span className="fc-rangs" title={`Rang ${r} sur ${RANG_MAX}`} aria-label={`Rang ${r} sur ${RANG_MAX}`}>
            {Array.from({ length: RANG_MAX }, (_, i) => <i key={i} className={i < r ? "pris" : ""} />)}
          </span>
        </span>
        <b className="fc-valeur">{valeur}</b>
        <span className="fc-actions">
          {cout != null && (
            <button type="button" className="btn quiet sm fc-plus" disabled={!a || cout > vestiges} onClick={() => rang(ligne)}
              aria-label={`${nom} +1 pour ${cout} vestiges`}>+1 · {cout}</button>
          )}
          {boutonEtoile(ligne, nom)}
        </span>
        {confirmation(ligne, nom)}
      </li>
    );
  };

  const compLigne = (place) => {
    const K = COMPETENCES[competenceDe(c, f, place)];
    const fig = f.etoiles?.[place];
    return (
      <li className={`fc-ligne fc-comp${fig ? " etoilee" : ""}`}>
        <span className="fc-cap">
          {place === "geste" ? "Comp. 1" : "Comp. 2"}
          {place === "tech" && <Recharge cd={Math.max(0, K.cd - (fig ? 1 : 0))} />}
        </span>
        <b className="fc-comp-nom">{K.nom}</b>
        <span className="fc-actions">
          {!fig && <button type="button" className="btn quiet sm fc-changer" disabled={!a} onClick={() => setChoix(place)}>Changer</button>}
          {boutonEtoile(place, K.nom)}
        </span>
        <small className="fc-comp-aide">{fig ? K.etoile : K.aide}</small>
        {confirmation(place, K.nom)}
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
            <span className="fc-cap">PV</span>
            <b className="fc-valeur">{u.pvMax}</b>
            {R.passif && <span className="fc-actions fc-passif muted">Passif : {R.passif}</span>}
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
      <StarReset c={c} niveau={niveau} onFermer={onFermer} fiche="rangs, compétences, étoiles" />
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

/**
 * Le volet « Source de pouvoir » d'un Lieu, à gauche de la carte agrandie :
 * le pouvoir que le lieu donne à l'équipe au Donjon, à son niveau, ce qu'il
 * deviendra au niveau 100, et son étoile (une rainbow en trop du lieu).
 */
export function VoletSource({ c, onFermer }) {
  const { etat, etoilerCarte } = useJeu();
  const [confirme, setConfirme] = useState(false);
  const [annonce, setAnnonce] = useState("");
  if (c?.type !== "lieu" || !c.ext) return null;
  const f = ficheDe(etat, c);
  const et = !!f.etoiles?.[LIGNE_SOURCE];
  const niveau = niveauDe(xpDe(etat, c));
  const S = sourceDe(c);
  const ici = effetsSource(c, niveau, et), cent = effetsSource(c, 100, et);
  const rb = rainbowEnTrop(etat, c), a = possedee(etat, c);
  return (
    <aside className="volets volets-gauche" aria-label={`Source de pouvoir de ${c.nom}`} onClick={(e) => e.stopPropagation()}>
      <section className={`volet volet-combat${et ? " complete" : ""}`}>
        <header className="fc-tete">
          <h3>Source de pouvoir</h3>
          <span className="muted">Niv. {niveau}</span>
        </header>
        <div className={`fc-ligne fc-comp${et ? " etoilee" : ""}`}>
          <span className="fc-cap">{et ? <><Etoile taille={10} /> Étoilée · ×{String(ETOILE_SOURCE).replace(".", ",")}</> : "Au Donjon, pour toute l'équipe"}</span>
          <b className="fc-comp-nom">{S.nom}</b>
          <span className="fc-actions">
            {et ? <span className="fc-figee"><Etoile /> Figée</span> : (
              <button type="button" className={`fc-etoiler${confirme ? " arme" : ""}`} disabled={!a || rb < 1} aria-expanded={confirme}
                title={rb < 1 ? `Il faut une rainbow de ${c.nom} en plus de celle de la collection.` : "Étoiler la source"}
                aria-label="Étoiler la source" onClick={() => setConfirme((x) => !x)}><Etoile /></button>
            )}
          </span>
          <ul className="fc-comp-aide fc-effets">{ici.map((e) => <li key={e.mec}>{e.texte}</li>)}</ul>
          {confirme && !et && (
            <div className="fc-confirme" role="group" aria-label="Étoiler la source">
              <span>Dépensez une de vos Rainbow en double pour améliorer définitivement la ligne.</span>
              <span className="fc-confirme-boutons">
                <button type="button" className="btn sm fc-confirmer" onClick={() => {
                  setConfirme(false);
                  if (etoilerCarte(c, LIGNE_SOURCE)) setAnnonce(`Source étoilée. Une rainbow de ${c.nom} a quitté la collection.`);
                }}><Etoile /> Étoiler</button>
                <button type="button" className="btn quiet sm" onClick={() => setConfirme(false)}>Annuler</button>
              </span>
            </div>
          )}
        </div>
        {niveau < 100 && (
          <p className="muted fc-note">Au niveau 100 : {texteEffets(cent)}.</p>
        )}
        <p className="fc-pied muted">
          <span>Rareté {c.tier === "commun" ? "commune" : c.tier === "peucommun" ? "peu commune" : c.tier === "rare" ? "rare" : "légendaire"}</span>
          <span><Etoile taille={11} /> {rb} rainbow en trop</span>
        </p>
        <p className="muted fc-note">Le lieu gagne de l'expérience avec l'équipe qu'il accompagne, et s'entraîne avec ses doublons.</p>
        <p className="sr" role="status" aria-live="polite">{annonce}</p>
        {annonce && <p className="volet-annonce" aria-hidden="true">{annonce}</p>}
      </section>
      <StarReset c={c} niveau={niveau} onFermer={onFermer} fiche="étoile de la source" />
    </aside>
  );
}
