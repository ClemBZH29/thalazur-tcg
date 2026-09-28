import { useCallback, useEffect, useMemo, useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import { useCompte } from "../jeu/Compte.jsx";
import { Lien, useRoute } from "../lib/routeur.jsx";
import { BOOSTER_PAR_ID } from "../extensions/index.js";
import { primautes } from "../succes/regles.js";
import { pseudoValide } from "../succes/classement.js";

const nombre = (n) => Math.floor(n).toLocaleString("fr-FR");

/** « 2 sachets au choix · 240 PO » */
function libelleRecompense(r = {}, famille) {
  const parts = [];
  if (r.sachets) {
    const ou = famille.extension ? "" : " au choix";
    parts.push(`${r.sachets} sachet${r.sachets > 1 ? "s" : ""}${ou}`);
  }
  if (r.po) parts.push(`${nombre(r.po)} PO`);
  return parts.join(" · ");
}

const unite = (f) => (f.mesure === "pct" ? " %" : "");

/* ── Onglet Succès ─────────────────────────────────────────────────────── */

function Famille({ f, onReclamer }) {
  const prochain = f.paliers.find((p) => !p.atteint);
  const base = [...f.paliers].reverse().find((p) => p.atteint)?.seuil || 0;
  const avance = prochain
    ? Math.max(0, Math.min(1, (f.valeur - base) / (prochain.seuil - base)))
    : 1;
  return (
    <article className="succes-famille">
      <header>
        <h3>{f.nom}</h3>
        <span className="succes-valeur">
          {nombre(f.valeur)}{unite(f)}
          {prochain && <span className="muted"> / {nombre(prochain.seuil)}{unite(f)}</span>}
        </span>
      </header>
      <div className="succes-jauge" role="progressbar" aria-label={`${f.nom}, vers le palier suivant`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(avance * 100)}>
        <span style={{ width: `${avance * 100}%` }} />
      </div>
      <ol className="succes-paliers">
        {f.paliers.map((p) => (
          <li key={p.id} className={p.reclame ? "fait" : p.atteint ? "pret" : "verrou"}>
            <span className="succes-quoi">{p.quoi}</span>
            <span className="succes-gain">
              {libelleRecompense(p.recompense, f)}
              {p.titre && <span className="succes-titre">Titre : {p.titre}</span>}
            </span>
            {p.reclame ? (
              <span className="succes-etat" aria-label="Réclamé">✓</span>
            ) : p.atteint ? (
              <button className="btn sm" onClick={() => onReclamer([p.id])}>Réclamer</button>
            ) : (
              <span className="succes-etat muted" aria-label="Pas encore atteint">—</span>
            )}
          </li>
        ))}
      </ol>
    </article>
  );
}

function OngletSucces() {
  const { succes, etat } = useJeu();
  const { evaluation, reclamer } = succes;
  const tous = [...evaluation.global, ...evaluation.extensions.flatMap((e) => e.familles)];
  const total = tous.reduce((n, f) => n + f.paliers.length, 0);
  const faits = tous.reduce((n, f) => n + f.paliers.filter((p) => p.reclame).length, 0);
  const attente = evaluation.aReclamer.length;
  const sachets = Object.entries(etat.sachets || {}).filter(([, n]) => n > 0);

  return (
    <>
      <div className="compteurs succes-resume">
        <span className="compteur">Succès réclamés <b>{faits} / {total}</b></span>
        {attente > 0 && <span className="compteur c-total">À réclamer <b>{attente}</b></span>}
        {sachets.map(([cle, n]) => (
          <span key={cle} className="compteur">
            Sachets offerts {cle === "*" ? "au choix" : `· ${BOOSTER_PAR_ID[cle]?.titre || cle}`} <b>{n}</b>
          </span>
        ))}
      </div>
      <div className="actions gauche">
        {attente > 0 && (
          <button className="btn" onClick={() => reclamer(evaluation.aReclamer)}>
            Tout réclamer ({attente})
          </button>
        )}
        {sachets.length > 0 && (
          <Lien vers="/boutique" className="btn quiet" actif={false}>Ouvrir mes sachets offerts</Lien>
        )}
      </div>

      <div className="section-titre sous-titre"><h2>Global</h2></div>
      <p className="muted succes-intro">Ce que vous faites sur tout le site : boosters, Mines, Comptoir, colporteur.</p>
      <div className="succes-grille">
        {evaluation.global.map((f) => <Famille key={f.id} f={f} onReclamer={reclamer} />)}
      </div>

      {evaluation.extensions.map((e) => (
        <section key={e.id}>
          <div className="section-titre sous-titre">
            <h2>Collection · {e.titre}</h2>
            <span className="muted">{e.mesures.nb} / {e.mesures.total} cartes · {e.mesures.pct} %</span>
          </div>
          <div className="succes-grille">
            {e.familles.map((f) => <Famille key={f.id} f={f} onReclamer={reclamer} />)}
          </div>
        </section>
      ))}

      <p className="muted petit succes-note">
        Un sachet offert s'ouvre sans payer, depuis la boutique : ceux d'une
        collection dans leur extension, ceux « au choix » dans n'importe
        laquelle. Les ventes au Comptoir et les affaires du colporteur se
        comptent depuis la mise en service des succès.
      </p>
    </>
  );
}

/* ── Onglet Classement ─────────────────────────────────────────────────── */

const pourcent = (score) => `${(score / 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

function OngletClassement() {
  const compte = useCompte();
  const { etat, setEtat, succes } = useJeu();
  const { lireClassement, statut, utilisateur, sessionPrete } = compte;
  const [lignes, setLignes] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [vue, setVue] = useState("general");
  const connecte = statut === "connecte" && utilisateur;
  const profil = etat.profil || {};

  const charger = useCallback(() => {
    setErreur(null);
    lireClassement().then(setLignes).catch(() => setErreur("Le classement n'a pas pu être chargé."));
  }, [lireClassement]);

  // Après l'ouverture de session, et après l'envoi de sa propre ligne.
  useEffect(() => { if (connecte && sessionPrete) charger(); }, [connecte, sessionPrete, charger, profil.classement]);

  const exts = succes.catalogue.extensions;
  const prim = useMemo(() => primautes(succes.catalogue, lignes || []), [succes.catalogue, lignes]);
  const badges = (uid) => Object.values(prim).filter((p) => p.uid === uid).map((p) => p.titre);

  const triees = useMemo(() => {
    if (!lignes) return [];
    const l = [...lignes];
    if (vue === "general") {
      l.sort((a, b) => (b.score - a.score) || (b.succes - a.succes) || (b.boosters - a.boosters));
    } else {
      const x = (r) => r.extensions?.[vue] || { pct: 0, irisees: 0 };
      l.sort((a, b) => (x(b).pct - x(a).pct) || (x(b).irisees - x(a).irisees)
        || ((a.premiers?.[vue] ?? Infinity) - (b.premiers?.[vue] ?? Infinity)));
    }
    return l;
  }, [lignes, vue]);

  if (!connecte) {
    return (
      <section className="panneau">
        <div className="bloc">
          <h3>Réservé aux joueurs connectés</h3>
          <p className="muted">
            Le classement réunit les joueurs qui ont un compte et ont choisi d'y
            figurer. <Lien vers="/profil" actif={false} className="lien">Se connecter</Lien> pour le voir.
          </p>
        </div>
      </section>
    );
  }

  const present = profil.classement === true && pseudoValide(profil.pseudo);

  return (
    <>
      {!present && (
        <p className="avis" role="status">
          Vous n'apparaissez pas au classement.{" "}
          {pseudoValide(profil.pseudo) ? (
            <button type="button" className="avis-fermer"
              onClick={() => setEtat((s) => ({ ...s, profil: { ...(s.profil || {}), classement: true } }))}>
              Y apparaître sous le nom « {profil.pseudo} »
            </button>
          ) : (
            <Lien vers="/profil" actif={false} className="lien">Choisir un pseudo</Lien>
          )}
        </p>
      )}

      <div className="barre-classement">
        <div className="segments" role="group" aria-label="Classement">
          <button className={vue === "general" ? "on" : ""} aria-pressed={vue === "general"}
            onClick={() => setVue("general")}>Général</button>
          {exts.map((e) => (
            <button key={e.id} className={vue === e.id ? "on" : ""} aria-pressed={vue === e.id}
              onClick={() => setVue(e.id)}>{e.titre}</button>
          ))}
        </div>
        <button className="btn quiet sm" onClick={charger}>Actualiser</button>
      </div>

      {erreur && <p className="avis ko">{erreur}</p>}
      {!lignes && !erreur && <p className="muted" role="status">Chargement du classement…</p>}
      {lignes && lignes.length === 0 && <p className="muted">Personne n'y figure encore. Soyez le premier.</p>}

      {triees.length > 0 && (
        <table className="table-classement">
          <thead>
            <tr>
              <th scope="col">Rang</th>
              <th scope="col">Joueur</th>
              {vue === "general" ? (
                <>
                  <th scope="col">Score</th>
                  <th scope="col" className="secondaire">Boosters</th>
                  <th scope="col" className="secondaire">Strate</th>
                  <th scope="col" className="secondaire">Succès</th>
                </>
              ) : (
                <>
                  <th scope="col">Complétion</th>
                  <th scope="col" className="secondaire">Irisées</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {triees.map((l, i) => {
              const x = l.extensions?.[vue] || { pct: 0, irisees: 0 };
              return (
                <tr key={l.uid} className={l.uid === utilisateur.uid ? "moi" : ""}>
                  <td className="rang">{i + 1}</td>
                  <td>
                    <span className="joueur">{l.pseudo}</span>
                    {l.titre && <span className="joueur-titre">{l.titre}</span>}
                    {badges(l.uid).map((b) => <span key={b} className="joueur-primaute">★ {b}</span>)}
                  </td>
                  {vue === "general" ? (
                    <>
                      <td className="nb">{pourcent(l.score)}</td>
                      <td className="nb secondaire">{nombre(l.boosters)}</td>
                      <td className="nb secondaire">{l.strate || "—"}</td>
                      <td className="nb secondaire">{l.succes}</td>
                    </>
                  ) : (
                    <>
                      <td className="nb">{x.pct} %</td>
                      <td className="nb secondaire">{x.irisees}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="muted petit succes-note">
        Le score général est la complétion de toutes les extensions ouvertes,
        pondérée par la rareté : une légendaire compte huit communes. Il baisse
        quand une nouvelle extension ouvre, pour tout le monde à la fois. La
        « première complétion » d'une extension revient à qui a réclamé ses
        100 % le premier.
      </p>
    </>
  );
}

/* ── La page ──────────────────────────────────────────────────────────── */

export default function PageSucces({ onglet }) {
  const { aller } = useRoute();
  const classement = onglet === "classement";
  return (
    <main className="view succes" id="contenu">
      <div className="section-titre">
        <h1>{classement ? "Classement" : "Succès"}</h1>
        <div className="segments" role="group" aria-label="Onglets">
          <button className={!classement ? "on" : ""} aria-pressed={!classement}
            onClick={() => aller("/succes")}>Succès</button>
          <button className={classement ? "on" : ""} aria-pressed={classement}
            onClick={() => aller("/succes/classement")}>Classement</button>
        </div>
      </div>
      {classement ? <OngletClassement /> : <OngletSucces />}
    </main>
  );
}
