/**
 * Le grimoire des Succès, d'après le prototype de Claude Design
 * (`Grimoire-Succes.dc.html` et sa note de conception).
 *
 * Un livre ouvert posé sur la table du camp : le sommaire et l'ex-libris en
 * première double page, puis un chapitre par module et par extension. Au
 * bureau, une double page à l'échelle de l'écran ; au téléphone, une page à
 * la fois. On tourne par les flèches (écran et clavier) et d'un balayage.
 *
 * Le composant ne connaît pas la partie : il reçoit l'évaluation déjà faite
 * (`evaluer()` de `src/succes/regles.js`) et l'adresse (`route`), et rend la
 * main par ses rappels (`onRoute`, `onReclamer`, `onChoisirTitre`,
 * `onClassement`). La mise en page est dans `mise-en-page.js` (pur, testé),
 * les mouvements dans `animations.js`.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icone from "../../components/Icone.jsx";
import { tenirBourse } from "../../lib/bourseAffichee.js";
import * as M from "./mise-en-page.js";
import * as A from "./animations.js";
import "../../styles/grimoire.css";
import { urlDos } from "../../jeu/dos.js";

/** Le dos choisi au profil (src/jeu/dos.js), lu au moment de dessiner. */
const DOS = () => urlDos();

/** Le palier « téléphone ou paysage bas » de la charte (§ 4, paliers d'écran). */
const REQUETE_TEL = "(max-width: 720px), (max-width: 860px) and (max-height: 500px)";

/* ── Pictogrammes ──────────────────────────────────────────────────────── */

/**
 * Tracés propres au grimoire, absents de `Icone.jsx` : mêmes conventions
 * (grille de 20, trait de 1,6, `currentColor`), pour ne pas toucher au
 * fichier partagé.
 */
const TRACES_LOCAUX = {
  gauche: <path d="M12.5 4.5 7 10l5.5 5.5" />,
  droite: <path d="M7.5 4.5 13 10l-5.5 5.5" />,
  bas: <path d="M5 8l5 5 5-5" />,
  ruban: <path d="M2.5 6.5h15l-2.6 3.5 2.6 3.5h-15l2.6-3.5z" />,
  livre: <path d="M6 2.5h9.5v12.5H6a1.5 1.5 0 0 0-1.5 1.5V4A1.5 1.5 0 0 1 6 2.5zM4.5 16.5A1.5 1.5 0 0 0 6 18h9.5v-3M8.5 6.5h4" />,
};

function Picto({ nom, taille = 20, className = "" }) {
  if (!TRACES_LOCAUX[nom]) return <Icone nom={nom} taille={taille} className={className} />;
  return (
    <svg className={`icone ${className}`.trim()} viewBox="0 0 20 20" width={taille} height={taille} fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {TRACES_LOCAUX[nom]}
    </svg>
  );
}

/** La tache d'encre d'un exploit caché : une forme pleine, pas un trait. */
const TRACE_TACHE = "M20 6c5 0 7.5 3 10.5 5.5s5.5 6.5 4.5 11.5-3 8-7 10.5-9 2.5-13 1.5-8-4-9.5-8.5-.5-10 2.5-14S15 6 20 6zM34.5 8.5a2 2 0 1 0 .1 0zM6.5 31a1.6 1.6 0 1 0 .1 0zM31 34a1.2 1.2 0 1 0 .1 0z";
function Tache({ taille }) {
  return (
    <svg className="gm-tache-svg" viewBox="0 0 40 40" width={taille} height={taille} aria-hidden="true" focusable="false">
      <path d={TRACE_TACHE} />
    </svg>
  );
}

/* ── Mémoire des exploits révélés ──────────────────────────────────────── */

/**
 * La révélation d'un exploit se joue une fois. On retient lesquels ont été
 * vus dans le stockage du navigateur : une commodité d'affichage, pas un
 * état de partie. S'il est vide ou refusé (fenêtre privée), la tache se lève
 * de nouveau à la visite suivante, rien de plus.
 */
const CLE_EXPLOITS = "brume-thalazur:grimoire-exploits";
function lireExploits() {
  try { return new Set(JSON.parse(localStorage.getItem(CLE_EXPLOITS) || "[]")); } catch { return new Set(); }
}
function ecrireExploits(ids) {
  try { localStorage.setItem(CLE_EXPLOITS, JSON.stringify([...ids])); } catch { /* stockage refusé */ }
}

const centre = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
const somme = (v) => (typeof v === "number" ? v : Object.values(v || {}).reduce((n, x) => n + (Number(x) || 0), 0));
const cssId = (id) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : String(id).replace(/["\\]/g, "\\$&"));

/* ── Petits éléments ───────────────────────────────────────────────────── */

/** Un trait d'avancement : `role="progressbar"`, le remplissage en `scaleX`. */
function Trait({ label, max, valeur, className = "", attributs }) {
  const frac = max ? Math.max(0, Math.min(1, valeur / max)) : 0;
  return (
    <span className={`gm-trait ${className}`.trim()} role="progressbar" aria-label={label}
      aria-valuemin={0} aria-valuemax={max} aria-valuenow={valeur}>
      <span className="gm-trait-plein" style={{ transform: `scaleX(${frac})` }} {...attributs} />
    </span>
  );
}

/** Un sceau de cire froide (le palier réclamé), avec sa cire chaude pour l'animation. */
function Cire({ children, className = "", attributs }) {
  return (
    <span className={`gm-cire ${className}`.trim()} {...attributs}>
      <span className="gm-cire-froide" />
      <span className="gm-cire-chaude" />
      <span className="gm-cire-contenu">{children}</span>
    </span>
  );
}

/** Le sceau doré d'un chapitre qui porte des paliers à réclamer. */
const SceauAttente = ({ n, className = "" }) => <span className={`gm-sceau-attente ${className}`.trim()}>{n}</span>;

/* ── Le sommaire ───────────────────────────────────────────────────────── */

function LigneSommaire({ c, ctx }) {
  const s = c.stats;
  const froid = ctx.cascade?.chapitres.includes(c.id);
  const aria = `${c.nom}, ${s.reclames} sur ${s.total}${s.attente ? `, ${s.attente} à réclamer` : ""}${s.sourdine ? ", pas encore commencé" : ""}`;
  return (
    <button type="button" className={`gm-ligne${s.sourdine ? " sourdine" : ""}${c.extension ? " ext" : ""}`}
      aria-label={aria} onClick={() => ctx.aller(c.id, 1)}>
      <Picto nom={c.picto} taille={ctx.tel ? 18 : 20} className="gm-ligne-picto" />
      <span className="gm-ligne-corps">
        <span className="gm-ligne-nom">{c.nom}</span>
        {ctx.tel && <Trait label={c.nom} max={s.total} valeur={s.reclames} attributs={{ "data-jauge-som": c.id }} />}
      </span>
      {!ctx.tel && <Trait label={c.nom} max={s.total} valeur={s.reclames} attributs={{ "data-jauge-som": c.id }} />}
      <span className="gm-ligne-compte">{s.reclames} / {s.total}</span>
      <span className="gm-ligne-sceau">
        {s.attente > 0 && !froid && <SceauAttente n={s.attente} />}
        {froid && ctx.tel && <Cire className="petit" attributs={{ "data-som-froid": c.id }}><Picto nom="coche" taille={14} /></Cire>}
        {s.acheve && !froid && <Cire className="petit"><Picto nom="coche" taille={14} /></Cire>}
      </span>
    </button>
  );
}

function ListeSommaire({ ctx }) {
  const lignes = [];
  ctx.chapitres.forEach((c, i) => {
    // Un losange sépare les chapitres du site de ceux des extensions.
    if (c.extension && i > 0 && !ctx.chapitres[i - 1].extension) lignes.push(<div key="sep" className="gm-sep" aria-hidden="true"><span /></div>);
    lignes.push(<LigneSommaire key={c.id} c={c} ctx={ctx} />);
  });
  return <div className="gm-lignes">{lignes}</div>;
}

function PageSommaire({ ctx }) {
  return (
    <div className="gm-sommaire">
      <div className="gm-sommaire-tete">
        <h2 className="gm-h2">Sommaire</h2>
        <div className="gm-filet-losange" aria-hidden="true"><span /><i /><span /></div>
      </div>
      <ListeSommaire ctx={ctx} />
    </div>
  );
}

/* ── L'ex-libris ───────────────────────────────────────────────────────── */

function TitreAffiche({ ctx, compact }) {
  const j = ctx.joueur;
  const titres = j.titres || [];
  // Sans titre gagné, rien à choisir : un libellé, pas un bouton inerte.
  if (!titres.length) return <span className={`gm-titre-bouton vide${compact ? " compact" : ""}`}><span className="gm-titre-affiche">{j.titre || "Sans titre"}</span></span>;
  const aria = `Titre affiché : ${j.titre || "aucun"}. Choisir son titre`;
  return (
    <button type="button" className={`gm-titre-bouton${j.titre ? "" : " vide"}${compact ? " compact" : ""}`}
      aria-expanded={ctx.choix} aria-label={aria}
      onClick={() => ctx.setChoix((v) => !v)}>
      <span className="gm-titre-affiche">{j.titre || "Sans titre"}</span>
      <Picto nom="bas" taille={compact ? 14 : 16} className="gm-titre-fleche" />
    </button>
  );
}

/** Choisir son titre : des puces à bascule, dans la case de l'ex-libris. Rien ne s'ouvre en fenêtre. */
function ChoixTitre({ ctx }) {
  const j = ctx.joueur;
  const titres = j.titres || [];
  return (
    <div className="gm-choix">
      <div className="gm-choix-tete">
        <span className="gm-discret">Titres gagnés · {titres.length}</span>
        <button type="button" className="gm-icone-bouton" aria-label="Fermer" onClick={() => ctx.setChoix(false)}>
          <Picto nom="fermer" taille={16} />
        </button>
      </div>
      <div className="gm-puces">
        <button type="button" className="gm-puce" aria-pressed={!j.titreId} onClick={() => ctx.choisirTitre("")}>Sans titre</button>
        {titres.map((t) => (
          <button key={t.id} type="button" className="gm-puce" aria-pressed={t.id === j.titreId}
            onClick={() => ctx.choisirTitre(t.id)}>{t.titre}</button>
        ))}
      </div>
    </div>
  );
}

function Renommee({ ctx, compact }) {
  const j = ctx.joueur;
  const valeur = ctx.renAffichee ?? j.renommee ?? 0;
  const total = j.renommeeTotale || 0;
  return (
    <div className={`gm-renommee${compact ? " compact" : ""}`}>
      <div className="gm-renommee-ligne">
        <span className="gm-renommee-chiffres">
          <span className="gm-renommee-n">{M.nombre(valeur)}</span>
          <span className="gm-discret"> / {M.nombre(total)}</span>
        </span>
        {!compact && (
          <span className="gm-reclames" aria-label={`${j.reclames} paliers réclamés sur ${j.total}`}>
            <span className="gm-pastille-cire" />{j.reclames} / {j.total}
          </span>
        )}
      </div>
      <Trait label="Renommée" max={total} valeur={valeur} className="gm-trait-rainbow" />
      <span className="gm-discret">Renommée</span>
    </div>
  );
}

function Offerts({ ctx, compact }) {
  const o = ctx.joueur.offerts || { choix: 0, extensions: [] };
  const exts = o.extensions || [];
  const aria = `Boosters offerts : ${o.choix || 0} au choix${exts.map((e) => `, ${e.n} de ${e.titre}`).join("")}. Ouvrir à la boutique`;
  return (
    <a href="#/boutique" className={`gm-offerts${compact ? " compact" : ""}`} aria-label={aria}>
      {!compact && <span className="gm-offerts-titre gm-discret">Boosters offerts</span>}
      <span className="gm-offert">
        <img src={DOS()} alt="" width={compact ? 18 : 28} height={compact ? 27 : 42} />
        <span className="gm-offert-n"><b>{o.choix || 0}</b>{!compact && <span className="gm-discret">au choix</span>}</span>
      </span>
      {exts.map((e) => (
        <span key={e.id} className="gm-offert ext">
          <img src={DOS()} alt="" width={compact ? 18 : 28} height={compact ? 27 : 42} />
          <span className="gm-offert-n"><b>{e.n}</b>{!compact && <span className="gm-discret">{e.titre}</span>}</span>
        </span>
      ))}
      {!compact && <Picto nom="droite" taille={18} className="gm-offerts-fleche" />}
    </a>
  );
}

/**
 * « Tout réclamer · 3 » et les sceaux en attente, un par palier, au
 * pictogramme de leur chapitre. La case garde sa hauteur (84) quand il n'y a
 * plus rien : « Rien à réclamer » s'y écrit à la même place.
 */
function ToutReclamer({ ctx, compact }) {
  const cas = ctx.cascade;
  const items = cas ? cas.items : ctx.attente;
  if (!items.length) return <div className="gm-tout-zone"><span className="gm-discret">Rien à réclamer</span></div>;
  return (
    <div className="gm-tout-zone">
      <button type="button" className="gm-tout" disabled={Boolean(cas)} onClick={ctx.toutReclamer}>
        Tout réclamer · {items.length}
      </button>
      {!compact && (
        <div className="gm-tout-detail">
          <div className="gm-tout-sceaux" aria-hidden="true">
            {items.map((it, i) => (
              <Cire key={it.id} className={`moyen${cas ? "" : " chaud"}${it.extension ? " ext" : ""}`} attributs={{ "data-att": i }}>
                <Picto nom={it.picto} taille={16} />
              </Cire>
            ))}
          </div>
          <span className="gm-tout-legende">{cas ? cas.legende : ctx.legende}</span>
        </div>
      )}
    </div>
  );
}

function PageExLibris({ ctx }) {
  const j = ctx.joueur;
  return (
    <div className="gm-exlibris">
      <div className="gm-exlibris-tete" aria-hidden="true"><span /><em>Ex-libris</em><span /></div>
      <div className="gm-cartouche">
        <div className="gm-cartouche-int">
          <span className="gm-pseudo">{j.pseudo}</span>
          <TitreAffiche ctx={ctx} />
        </div>
      </div>
      <div className="gm-exlibris-bas">
        {ctx.choix ? <ChoixTitre ctx={ctx} /> : (
          <>
            <Renommee ctx={ctx} />
            <div className="gm-filet" />
            <Offerts ctx={ctx} />
            <div className="gm-filet" />
            <ToutReclamer ctx={ctx} />
          </>
        )}
      </div>
    </div>
  );
}

/** Le téléphone : l'ex-libris ramassé au-dessus du sommaire, sur une seule page. */
function PageSommaireTel({ ctx }) {
  const j = ctx.joueur;
  return (
    <div className="gm-sommaire-tel">
      <div className="gm-tel-tete">
        <div className="gm-tel-ident">
          <span className="gm-pseudo">{j.pseudo}</span>
          <TitreAffiche ctx={ctx} compact />
        </div>
        <Renommee ctx={ctx} compact />
      </div>
      <div className="gm-tel-actions">
        <Offerts ctx={ctx} compact />
        <ToutReclamer ctx={ctx} compact />
      </div>
      <div className="gm-tel-liste">
        {ctx.choix ? <ChoixTitre ctx={ctx} /> : <ListeSommaire ctx={ctx} />}
      </div>
    </div>
  );
}

/* ── Un chapitre ───────────────────────────────────────────────────────── */

function Lettrine({ c }) {
  return (
    <div className="gm-lettrine" aria-hidden="true">
      <div className="gm-lettrine-int">{c.lettre}</div>
      <i className="hg" /><i className="hd" /><i className="bg" /><i className="bd" />
    </div>
  );
}

function TeteChapitre({ c }) {
  const s = c.stats;
  return (
    <div className="gm-tete">
      <Lettrine c={c} />
      <div className="gm-tete-texte">
        <h2 className="gm-tete-nom">{c.nom}</h2>
        <div className="gm-tete-ligne">
          <Picto nom={c.picto} taille={18} className="gm-tete-picto" />
          <Trait label={c.nom} max={s.total} valeur={s.reclames} className="gm-tete-trait" />
          <span className="gm-tete-compte">{s.reclames} / {s.total}</span>
          {s.attente > 0 && <SceauAttente n={s.attente} className="petit" />}
          {s.acheve && <span className="gm-acheve">Achevé</span>}
        </div>
      </div>
    </div>
  );
}

/** Un médaillon : le seuil dans un disque, son état en matière (cire, lampe, encre). */
function Medaillon({ m, ctx }) {
  const p = m.palier;
  const voile = M.estVoile(p);
  const quoi = voile ? "Exploit caché" : M.nombresDansTexte(p.quoi);
  const gains = M.libellesRecompense(p.recompense, ctx.chapitreDe(m.famille)).join(", ");
  const aria = m.etat === "pret" ? `Réclamer : ${quoi}, ${gains}`
    : m.etat === "scelle" ? `${quoi}, réclamé`
      : voile ? "Exploit caché"
        : `${quoi}, ${M.nombre(m.famille.valeur)} sur ${M.nombre(p.seuil)}`;
  const ouverte = ctx.note === p.id;
  const exploitNeuf = m.etat === "pret" && p.cache && !ctx.exploitsVus.has(p.id);
  const tache = exploitNeuf && !ctx.reduit;
  const ruban = ctx.rubans[p.id] && p.titre;
  // L'anneau d'un palier proche : la part du chemin faite vers son seuil.
  const r = m.d / 2 - 3.5, tour = 2 * Math.PI * r;
  return (
    <div className="gm-med-place" style={{ left: m.cx - m.b / 2, width: m.b, "--b": `${m.b}px`, "--d": `${m.d}px`, "--fs": `${m.police}px` }}>
      <button type="button" className={`gm-med ${m.etat}${ouverte ? " ouverte" : ""}`} data-pal={p.id}
        data-exploit={exploitNeuf ? p.id : undefined}
        aria-label={aria} aria-expanded={ouverte} onClick={() => ctx.toucher(p.id)}>
        {m.etat === "scelle" && <Cire className="disque"><span className="gm-med-seuil">{m.texte}</span></Cire>}
        {m.etat === "pret" && (
          <span className="gm-disque pret">
            <span className="gm-halo" />
            <span className="gm-med-seuil gm-chiffre">{m.texte}</span>
            {tache && <span className="gm-tache" data-tache={p.id}><Tache taille={m.d} /></span>}
          </span>
        )}
        {m.etat === "proche" && (
          <span className="gm-disque proche">
            <svg className="gm-anneau-avance" viewBox={`0 0 ${m.d} ${m.d}`} width={m.d} height={m.d} aria-hidden="true">
              <circle cx={m.d / 2} cy={m.d / 2} r={r} strokeDasharray={`${(tour * m.avance).toFixed(1)} ${tour.toFixed(1)}`} />
            </svg>
            <span className="gm-med-seuil">{m.texte}</span>
          </span>
        )}
        {m.etat === "loin" && <span className="gm-disque loin"><span className="gm-med-seuil">{m.texte}</span></span>}
        {m.etat === "cache" && <span className="gm-disque cache"><Tache taille={m.d} /></span>}
      </button>
      <div className="gm-med-pied">
        {ruban ? (
          <span className="gm-ruban" data-ruban={p.id}><span className="gm-ruban-texte">{p.titre}</span></span>
        ) : m.label ? (
          <span className="gm-med-label">{m.label}</span>
        ) : m.porteTitre ? (
          <Picto nom="ruban" taille={15} className={`gm-med-glyphe${m.etat === "scelle" ? " fait" : ""}`} />
        ) : null}
      </div>
    </div>
  );
}

function BlocFamille({ bloc, ctx, largeur }) {
  const g = ctx.geo;
  const f = M.disposerFamille(bloc, largeur, g);
  const ch = f.chemin;
  const cy = f.b / 2;
  return (
    <div className="gm-famille">
      <div className="gm-famille-tete" style={{ height: g.nom }}>
        <span className="gm-famille-nom">{f.nom}</span>
        <span className="gm-famille-valeur">{f.valeur}</span>
      </div>
      <div className="gm-rang" style={{ height: f.b }}>
        {ch && (
          <>
            <div className="gm-chemin" aria-hidden="true" style={{ left: ch.x0, top: cy - 0.75, width: ch.longueur }} />
            <div className="gm-chemin-encre" aria-hidden="true" style={{ left: ch.x0, top: cy - 1.25, width: ch.longueur, transform: `scaleX(${ch.frac})` }} />
            <div className="gm-chemin-depart" aria-hidden="true" style={{ left: ch.x0 - 2.5, top: cy - 2.5 }} />
            {ch.marque != null && <div className="gm-chemin-marque" aria-hidden="true" style={{ left: ch.marque - 4, top: cy - 4 }} />}
          </>
        )}
        {f.medaillons.map((m) => <Medaillon key={m.id} m={m} ctx={ctx} />)}
      </div>
    </div>
  );
}

function BlocReplie({ bloc }) {
  const nom = bloc.type === "provinces-repliee" ? "Provinces" : bloc.famille.nom;
  const n = bloc.type === "provinces-repliee" ? bloc.familles.length : bloc.famille.paliers.length;
  return (
    <div className="gm-repliee">
      <Cire className="mini"><Picto nom="coche" taille={12} /></Cire>
      <span className="gm-repliee-nom">{nom}</span>
      <span className="gm-discret">· complète</span>
      <span className="gm-repliee-compte">{n} / {n}</span>
    </div>
  );
}

/** La note en marge : la phrase, les gains, le titre, les points. Jamais une fenêtre. */
function NoteMarge({ info, place, ctx }) {
  const { palier: p, famille: f, chapitre: c } = info;
  const voile = M.estVoile(p);
  const etat = p.reclame ? "Réclamé" : p.atteint ? "À réclamer" : voile ? "Exploit caché"
    : `${M.nombre(f.valeur)} / ${M.nombre(p.seuil)}${f.mesure === "pct" ? "\u202f%" : ""}`;
  const classe = p.reclame ? "fait" : p.atteint ? "pret" : "";
  return (
    <div className={`gm-note${ctx.tel ? " tel" : ""}`} role="note" aria-label="Note du palier" style={place}>
      <div className="gm-note-tete">
        <span className={`gm-note-etat ${classe}`}>{etat}</span>
        <button type="button" className="gm-icone-bouton gm-note-fermer" aria-label="Fermer la note" onClick={() => ctx.setNote(null)}>
          <Picto nom="fermer" taille={14} />
        </button>
      </div>
      <span className="gm-note-quoi">{voile ? "Se révèle le jour où il est atteint." : M.nombresDansTexte(p.quoi)}</span>
      {!voile && M.libellesRecompense(p.recompense, c).map((t, i) => (
        <span key={t} className="gm-note-gain">
          <Picto nom={p.recompense?.po && i === 0 ? "piece" : "boutique"} taille={17} />{t}
        </span>
      ))}
      {!voile && p.titre && (
        <span className="gm-note-titre"><Picto nom="ruban" taille={17} /><span>{p.titre}</span></span>
      )}
      {!voile && <span className="gm-note-points">+{p.points} <span className="gm-discret">renommée</span></span>}
    </div>
  );
}

function PageChapitre({ desc, cote, vivant, ctx }) {
  const c = ctx.chapitres.find((x) => x.id === desc.chapitre);
  if (!c) return null;
  const g = ctx.geo;
  const tx = ctx.tel ? 16 : cote === "L" ? 178 : 36;
  const blocs = M.disposerPage(desc, g);

  let note = null;
  if (vivant && ctx.note) {
    const bloc = blocs.find((b) => (b.famille ? b.famille.paliers : b.familles.map((f) => f.paliers[0])).some((p) => p.id === ctx.note));
    const info = bloc ? M.trouverPalier(ctx.chapitres, ctx.note) : null;
    if (info) {
      let place;
      if (!ctx.tel) place = { left: cote === "L" ? 22 : 428, top: Math.min(bloc.y, g.bas - 290) };
      else if (bloc.y + g.famille / 2 > g.hauteurPage / 2) place = { left: 10, right: 10, top: 12 };
      else place = { left: 10, right: 10, bottom: 56 };
      note = <NoteMarge info={info} place={place} ctx={ctx} />;
    }
  }
  const toutReplie = blocs.length > 0 && blocs.every((b) => b.type === "repliee" || b.type === "provinces-repliee");

  return (
    <div className="gm-chapitre" style={{ "--tx": `${tx}px`, "--tw": `${g.texte}px` }}>
      {!ctx.tel && cote === "L" && (
        <button type="button" className="gm-vers-sommaire" onClick={() => ctx.aller(null, 1)}>
          <Picto nom="lexique" taille={16} />Sommaire
        </button>
      )}
      {desc.premiere && (
        <div className="gm-bloc" style={{ top: g.haut, height: g.tete - 12 }}><TeteChapitre c={c} /></div>
      )}
      {blocs.map((b) => (
        <div key={b.famille?.id || "provinces"} className="gm-bloc" style={{ top: b.y, height: b.h }}>
          {b.type === "famille" || b.type === "provinces"
            ? <BlocFamille bloc={b} ctx={ctx} largeur={g.texte} />
            : <BlocReplie bloc={b} />}
        </div>
      ))}
      {ctx.tel && c.stats.acheve && toutReplie && (
        <div className="gm-sceau-fin-tel"><Cire className="grand"><Picto nom={c.picto} taille={30} /></Cire></div>
      )}
      {note}
      <Folio desc={desc} c={c} ctx={ctx} />
    </div>
  );
}

/** La page de fin d'un chapitre au nombre de pages impair : le sceau s'il est achevé, un cul-de-lampe. */
function PageFin({ desc, ctx }) {
  const c = ctx.chapitres.find((x) => x.id === desc.chapitre);
  if (!c) return null;
  return (
    <div className="gm-fin">
      <div className="gm-fin-centre">
        {c.stats.acheve && (
          <>
            <Cire className="enorme"><Picto nom={c.picto} taille={48} /></Cire>
            <span className="gm-fin-texte">Achevé</span>
          </>
        )}
        <div className="gm-cul-de-lampe" aria-hidden="true">
          <div><i /><i /><i /></div><div><i /><i /></div><div><i className="plein" /></div>
        </div>
      </div>
      <Folio desc={desc} c={c} ctx={ctx} />
    </div>
  );
}

function Folio({ desc, c, ctx }) {
  if (ctx.tel) {
    return (
      <div className="gm-folio">
        <button type="button" className="gm-folio-bouton" aria-label={`Revenir au sommaire, page ${M.folio(desc)}`} onClick={() => ctx.aller(null, 1)}>
          <Picto nom="lexique" taille={16} />{M.folio(desc)}
        </button>
      </div>
    );
  }
  return (
    <div className="gm-folio" aria-label={`Page ${M.folio(desc)}`}>
      <Picto nom={c.picto} taille={15} /><span>{M.folio(desc)}</span>
    </div>
  );
}

/* ── Une face du livre ─────────────────────────────────────────────────── */

function Face({ slot, desc, cote, vivant, idx, transform, origine, ctx }) {
  const dernier = ctx.nbPositions - 1;
  const prec = ctx.tel ? idx > 0 : cote === "L" && idx > 0;
  const suiv = ctx.tel ? idx < dernier : cote === "R" && idx < dernier;
  let contenu = null;
  if (desc?.type === "sommaire") contenu = <PageSommaire ctx={ctx} />;
  else if (desc?.type === "exlibris") contenu = <PageExLibris ctx={ctx} />;
  else if (desc?.type === "sommaire-tel") contenu = <PageSommaireTel ctx={ctx} />;
  else if (desc?.type === "chapitre") contenu = <PageChapitre desc={desc} cote={cote} vivant={vivant} ctx={ctx} />;
  else if (desc?.type === "fin") contenu = <PageFin desc={desc} ctx={ctx} />;
  const ext = desc?.chapitre && ctx.chapitres.find((c) => c.id === desc.chapitre)?.extension;
  return (
    <div className={`gm-face ${cote}${ext ? " ext" : ""}`} data-face={slot} data-vivant={vivant ? "1" : "0"}
      aria-hidden={vivant ? undefined : "true"}
      style={transform ? { transform, transformOrigin: origine, zIndex: 4 } : undefined}>
      {contenu}
      {desc?.type === "exlibris" && (
        <div className="gm-folio">
          <a href="#/succes/classement" className="gm-lien-classement"
            onClick={(e) => { if (ctx.onClassement) { e.preventDefault(); ctx.onClassement(); } }}>
            Classement<Picto nom="droite" taille={15} />
          </a>
        </div>
      )}
      {prec && (
        <button type="button" className="gm-fleche prec" aria-label="Page précédente" onClick={() => ctx.tourner(-1)}>
          <Picto nom="gauche" taille={18} />
        </button>
      )}
      {suiv && (
        <button type="button" className="gm-fleche suiv" aria-label="Page suivante" onClick={() => ctx.tourner(1)}>
          <Picto nom="droite" taille={18} />
        </button>
      )}
      <div className="gm-ombre" />
    </div>
  );
}

/* ── Le grimoire ───────────────────────────────────────────────────────── */

export default function Grimoire(props) {
  const {
    chapitres: catalogue, evaluation, joueur, route, onRoute, onReclamer, onChoisirTitre, onClassement, mouvementReduit,
  } = props;
  const reduit = Boolean(mouvementReduit);

  const racine = useRef(null), livre = useRef(null), couche = useRef(null);
  const [scene] = useState(() => A.creerScene());
  // La scène lit le réglage à chaque appel : on le tient à jour avant les effets.
  useLayoutEffect(() => { scene.reduit = reduit; if (reduit) scene.finirTout(); }, [scene, reduit]);
  useEffect(() => () => scene.annulerTout(), [scene]);

  /* Mesure : la place sous le titre de la page, jusqu'au bas de l'écran. */
  const [dims, setDims] = useState({ w: 1200, h: 760, tel: false, pret: false });
  useLayoutEffect(() => {
    const mesurer = () => {
      const el = racine.current;
      if (!el) return;
      const tel = typeof window.matchMedia === "function" ? window.matchMedia(REQUETE_TEL).matches : window.innerWidth <= 720;
      const haut = el.getBoundingClientRect().top + window.scrollY;
      // Au téléphone, le bouton du menu vit en bas à droite : la vue lui
      // laisse 88 px (site.css), on fait de même.
      const bas = tel ? 88 : 16;
      const h = Math.max(tel ? 480 : 380, Math.round(window.innerHeight - haut - bas));
      const w = Math.round(el.clientWidth);
      setDims((d) => (d.w === w && d.h === h && d.tel === tel && d.pret ? d : { w, h, tel, pret: true }));
    };
    mesurer();
    window.addEventListener("resize", mesurer);
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(mesurer) : null;
    ro?.observe(racine.current);
    return () => { window.removeEventListener("resize", mesurer); ro?.disconnect(); };
  }, []);
  const tel = dims.tel;
  const geo = useMemo(() => (tel ? M.geoTelephone(dims.w - 24, dims.h - 16) : M.GEO_BUREAU), [tel, dims.w, dims.h]);

  const chapitres = useMemo(() => M.construireChapitres(catalogue, evaluation), [catalogue, evaluation]);

  /* Les familles que le joueur vient de finir sous ses yeux restent dépliées
     jusqu'à ce qu'il change de chapitre (voir `blocsChapitre`). On garde
     aussi celles du chapitre qu'on quitte, le temps que sa page tourne. */
  const chapitreCible = route?.chapitre ?? null;
  const [garde, setGarde] = useState(() => ({ chapitre: chapitreCible, ids: M.famillesOuvertes(chapitres, chapitreCible), avant: [] }));
  if (garde.chapitre !== chapitreCible) {
    setGarde({ chapitre: chapitreCible, ids: M.famillesOuvertes(chapitres, chapitreCible), avant: garde.ids });
  }
  const garderOuvertes = useMemo(() => new Set([...garde.ids, ...garde.avant]), [garde]);
  const positions = useMemo(() => M.construirePositions(chapitres, geo, garderOuvertes), [chapitres, geo, garderOuvertes]);

  /* Ce que le livre montre, et le tour de page en cours. */
  const [affiche, setAffiche] = useState(() => ({ chapitre: chapitreCible, page: route?.page || 1 }));
  const [tour, setTour] = useState(null);
  const [note, setNote] = useState(null);
  const [choix, setChoix] = useState(false);
  const [live, setLive] = useState("");
  const [rubans, setRubans] = useState({});
  const [cascade, setCascade] = useState(null);
  const [renAffichee, setRenAffichee] = useState(null);
  const [exploitsVus, setExploitsVus] = useState(lireExploits);

  const iCible = M.indexPosition(positions, route);
  const iAffiche = M.indexPosition(positions, affiche);

  // L'adresse a changé : on tourne vers elle (sans tour si le mouvement est réduit).
  useEffect(() => {
    if (tour || iCible === iAffiche) return;
    setNote(null);
    setChoix(false);
    const vers = positions[iCible].loc;
    if (reduit || !dims.pret) {
      setAffiche(vers);
      if (dims.pret) setLive(M.annoncePosition(chapitres, vers));
    } else {
      setTour({ de: positions[iAffiche].loc, a: vers, avant: iCible > iAffiche, id: Date.now() });
    }
  }, [iCible, iAffiche, tour, reduit, dims.pret, positions, chapitres]);

  const monte = useRef(true);
  useEffect(() => { monte.current = true; return () => { monte.current = false; }; }, []);

  useLayoutEffect(() => {
    if (!tour) return;
    const L = livre.current;
    A.tournerPage(scene, {
      A: L?.querySelector('[data-face="A"]'), B: L?.querySelector('[data-face="B"]'), bureau: !tel, avant: tour.avant,
    }, () => {
      if (!monte.current) return;
      setAffiche(tour.a);
      setTour(null);
      setLive(M.annoncePosition(chapitres, tour.a));
    });
    // Le tour ne se relance que pour un nouveau tour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour?.id]);

  /* Naviguer : on demande l'adresse, la page suit quand elle change. */
  const aller = useCallback((chapitre, page) => { onRoute?.(chapitre, page); }, [onRoute]);
  const tourner = useCallback((dir) => {
    if (tour) { scene.finirTout(); return; }
    const p = positions[iAffiche + dir];
    if (p) aller(p.loc.chapitre, p.loc.page);
  }, [tour, scene, positions, iAffiche, aller]);

  useEffect(() => {
    const touche = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target;
      if (t && (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); tourner(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); tourner(-1); }
      else if (e.key === "Escape") { setNote(null); setChoix(false); }
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [tourner]);

  /* Balayage : horizontal franc, au moins 50 px. Le vertical reste au navigateur (`pan-y`). */
  const geste = useRef(null);
  const surPointeurBas = (e) => { geste.current = { x: e.clientX, y: e.clientY }; };
  const surPointeurHaut = (e) => {
    const g = geste.current;
    geste.current = null;
    if (!g) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) tourner(dx < 0 ? 1 : -1);
  };

  /* Un toucher pendant un mouvement : tout se pose à sa place finale. */
  const surToucher = () => { if (scene.enCours()) scene.finirTout(); };

  /* ── Réclamer ─────────────────────────────────────────────────────── */
  const aJouer = useRef(null);
  const minuteries = useRef([]);
  useEffect(() => () => minuteries.current.forEach(clearTimeout), []);

  const attente = useMemo(() => M.paliersEnAttente(chapitres), [chapitres]);
  const legende = useMemo(() => M.legendeAttente(chapitres), [chapitres]);

  const reclamer = useCallback((ids, source) => {
    scene.finirTout();
    const infos = ids.map((id) => M.trouverPalier(chapitres, id)).filter((r) => r && r.palier.atteint && !r.palier.reclame);
    if (!infos.length) return;
    const valides = infos.map((r) => r.palier.id);
    const points = infos.reduce((n, r) => n + (r.palier.points || 0), 0);
    const titres = infos.filter((r) => r.palier.titre).map((r) => r.palier.titre);
    const poPrevu = infos.reduce((n, r) => n + (r.palier.recompense?.po || 0), 0);
    const n = valides.length;
    const ecart = Math.min(120, 900 / Math.max(1, n));
    const t0 = source === "tout" ? Math.min(1000, (n - 1) * ecart + 260) : 220;
    const origine = source === "tout"
      ? centre(racine.current?.querySelector(".gm-tout"))
      : centre(livre.current?.querySelector(`[data-vivant="1"] [data-pal="${cssId(valides[0])}"]`));
    // Le chiffre de la bourse attend l'arrivée des pièces (comme aux Missions).
    if (!reduit && poPrevu) tenirBourse(t0 + 520);
    const renAvant = joueur?.renommee ?? 0;

    const gains = onReclamer?.(valides) || {};
    const po = gains.po ?? poPrevu;
    const sachets = gains.sachets != null ? somme(gains.sachets)
      : infos.reduce((s, r) => s + (r.palier.recompense?.sachets || 0), 0);

    setRubans((r) => {
      const suite = { ...r };
      infos.forEach((x) => { if (x.palier.titre) suite[x.palier.id] = true; });
      return suite;
    });
    setLive(M.annonceGain({ n, po, sachets, titres, points }));
    if (source !== "tout") setNote(valides[0]);
    if (reduit) return;
    setRenAffichee(renAvant);
    if (source === "tout") {
      setCascade({
        items: infos.map((r) => ({ id: r.palier.id, chapitre: r.chapitre.id, picto: r.chapitre.picto, extension: r.chapitre.extension })),
        legende: M.legendeAttente(chapitres, valides),
        chapitres: [...new Set(infos.map((r) => r.chapitre.id))],
      });
      // La case revient à « Rien à réclamer » à 1 950 ms, dans la même place.
      minuteries.current.push(setTimeout(() => { if (monte.current) setCascade(null); }, 1950));
    }
    aJouer.current = { valides, source, origine, po, sachets, points, t0, ecart, renAvant, renApres: renAvant + points };
  }, [scene, chapitres, reduit, joueur, onReclamer]);

  const toutReclamer = useCallback(() => reclamer(evaluation?.aReclamer || attente.map((a) => a.id), "tout"),
    [reclamer, evaluation, attente]);

  /* ── Exploits ─────────────────────────────────────────────────────── */
  const tachesEnCours = useRef(new Set());
  const marquerVu = useCallback((id) => {
    setExploitsVus((vus) => {
      if (vus.has(id)) return vus;
      const suite = new Set(vus).add(id);
      ecrireExploits(suite);
      return suite;
    });
    const info = M.trouverPalier(chapitres, id);
    if (info) setLive(`Exploit révélé : ${M.nombresDansTexte(info.palier.quoi)}.`);
    setNote(id);
  }, [chapitres]);

  /* ── Titre ────────────────────────────────────────────────────────── */
  const titreAJouer = useRef(false);
  const choisirTitre = useCallback((id) => {
    onChoisirTitre?.(id);
    const t = (joueur?.titres || []).find((x) => x.id === id);
    setLive(`Titre affiché : ${t ? t.titre : "aucun"}.`);
    titreAJouer.current = true;
  }, [onChoisirTitre, joueur]);

  const toucher = useCallback((id) => {
    const r = M.trouverPalier(chapitres, id);
    if (!r) return;
    const tacheLevee = !tachesEnCours.current.has(id);
    if (r.palier.atteint && !r.palier.reclame && tacheLevee) reclamer([id], "palier");
    else setNote((n) => (n === id ? null : id));
  }, [chapitres, reclamer]);

  /* ── Effets après rendu : gains, révélations, jauges du sommaire ──── */
  const vusSommaire = useRef({});
  const retardJauges = useRef(0);
  useLayoutEffect(() => {
    const L = livre.current;
    const q = (s) => L?.querySelector(s);

    // 1. Le gain d'une réclamation, sur ce qui vient d'être rendu.
    const g = aJouer.current;
    if (g && !tour) {
      aJouer.current = null;
      retardJauges.current = g.source === "tout" ? g.t0 : 0;
      if (g.source === "palier") {
        A.sceau(scene, q(`[data-vivant="1"] [data-pal="${cssId(g.valides[0])}"] .gm-cire`));
        A.anneau(scene, couche.current, g.origine, 180);
        A.flotter(scene, couche.current, `+${g.points}`, g.origine, 300);
      } else if (tel) {
        // Au téléphone, un sceau froid par chapitre, sur sa ligne du sommaire.
        const vus = new Set();
        g.valides.forEach((id, i) => {
          const c = M.trouverPalier(chapitres, id)?.chapitre.id;
          if (!c || vus.has(c)) return;
          vus.add(c);
          A.sceau(scene, q(`[data-vivant="1"] [data-som-froid="${cssId(c)}"]`), i * g.ecart);
        });
      } else {
        g.valides.forEach((_, i) => A.sceau(scene, racine.current?.querySelector(`[data-att="${i}"]`), i * g.ecart));
      }
      const nP = A.nombrePieces(g.po);
      A.pieces(scene, couche.current, g.origine, nP, g.t0);
      A.boosters(scene, couche.current, g.origine, g.sachets, g.t0 + 60, DOS());
      g.valides.forEach((id) => A.ruban(scene, q(`[data-vivant="1"] [data-ruban="${cssId(id)}"]`), g.t0 + 260));
      scene.compter(g.renAvant, g.renApres, { duree: 520, retard: g.t0 + 300 }, (v) => { if (monte.current) setRenAffichee(v); },
        () => { if (monte.current) setRenAffichee(null); });
    }

    // 2. Les exploits atteints qu'on n'a pas encore vus : la tache se lève.
    if (!tour && L) {
      L.querySelectorAll('[data-vivant="1"] [data-exploit]').forEach((el) => {
        const id = el.getAttribute("data-exploit");
        if (tachesEnCours.current.has(id)) return;
        if (reduit) { marquerVu(id); return; }
        const tache = el.querySelector(".gm-tache");
        if (!tache) return;
        tachesEnCours.current.add(id);
        A.revelerExploit(scene, tache, el.querySelector(".gm-chiffre"), () => {
          tachesEnCours.current.delete(id);
          if (monte.current) marquerVu(id);
        });
      });
    }

    // 3. Les traits du sommaire montent depuis ce qu'on y avait vu.
    if (!tour && L) {
      L.querySelectorAll('[data-vivant="1"] [data-jauge-som]').forEach((el) => {
        const id = el.getAttribute("data-jauge-som");
        const c = chapitres.find((x) => x.id === id);
        if (!c) return;
        const frac = c.stats.frac, avant = vusSommaire.current[id];
        if (avant != null && avant !== frac) A.jauge(scene, el, avant, frac, retardJauges.current);
        vusSommaire.current[id] = frac;
      });
      retardJauges.current = 0;
    }

    // 4. Le titre choisi remonte en fondu.
    if (titreAJouer.current) {
      titreAJouer.current = false;
      A.titreAffiche(scene, racine.current?.querySelectorAll(".gm-titre-affiche"));
    }
  });

  /* ── Rendu ────────────────────────────────────────────────────────── */
  const ctx = {
    chapitres, geo, tel, joueur: joueur || {}, reduit, note, setNote, choix, setChoix, rubans, cascade,
    renAffichee, exploitsVus, attente, legende, nbPositions: positions.length,
    aller, tourner, toucher, toutReclamer, choisirTitre, onClassement,
    chapitreDe: (f) => chapitres.find((c) => c.id === (f.extension || f.chapitre)),
  };

  const faces = [];
  if (!tour) {
    const p = positions[iAffiche];
    if (tel) faces.push({ slot: "P", desc: p.page, cote: "M", vivant: true, idx: iAffiche });
    else {
      faces.push({ slot: "L", desc: p.gauche, cote: "L", vivant: true, idx: iAffiche });
      faces.push({ slot: "R", desc: p.droite, cote: "R", vivant: true, idx: iAffiche });
    }
  } else {
    // Pendant le tour, les deux pages immobiles restent celles qu'on lit (le
    // focus d'une flèche n'est pas perdu) ; seule la feuille qui tourne, ses
    // deux faces A et B, est cachée aux lecteurs d'écran.
    const iDe = M.indexPosition(positions, tour.de), iA = M.indexPosition(positions, tour.a);
    const pf = positions[iDe], pt = positions[iA];
    if (!tel) {
      const P = "perspective(2600px) ";
      if (tour.avant) {
        faces.push({ slot: "L", desc: pf.gauche, cote: "L", vivant: true, idx: iDe });
        faces.push({ slot: "R", desc: pt.droite, cote: "R", vivant: true, idx: iA });
        faces.push({ slot: "A", desc: pf.droite, cote: "R", vivant: false, idx: iDe, transform: `${P}rotateY(0deg)`, origine: "0% 50%" });
        faces.push({ slot: "B", desc: pt.gauche, cote: "L", vivant: false, idx: iA, transform: `${P}rotateY(180deg)`, origine: "100% 50%" });
      } else {
        faces.push({ slot: "L", desc: pt.gauche, cote: "L", vivant: true, idx: iA });
        faces.push({ slot: "R", desc: pf.droite, cote: "R", vivant: true, idx: iDe });
        faces.push({ slot: "A", desc: pf.gauche, cote: "L", vivant: false, idx: iDe, transform: `${P}rotateY(0deg)`, origine: "100% 50%" });
        faces.push({ slot: "B", desc: pt.droite, cote: "R", vivant: false, idx: iA, transform: `${P}rotateY(-180deg)`, origine: "0% 50%" });
      }
    } else {
      const P = "perspective(1600px) ";
      if (tour.avant) {
        faces.push({ slot: "P", desc: pt.page, cote: "M", vivant: true, idx: iA });
        faces.push({ slot: "A", desc: pf.page, cote: "M", vivant: false, idx: iDe, transform: `${P}rotateY(0deg)`, origine: "0% 50%" });
      } else {
        faces.push({ slot: "P", desc: pf.page, cote: "M", vivant: true, idx: iDe });
        faces.push({ slot: "A", desc: pt.page, cote: "M", vivant: false, idx: iA, transform: `${P}rotateY(-100deg)`, origine: "0% 50%" });
      }
    }
  }

  // Mise à l'échelle du livre (note § 2) : il tient sous le titre de la page.
  const s = tel ? 1 : Math.min((dims.h - 30) / 700, (dims.w - 48) / 1200, 1.12);
  const placeLivre = tel
    ? { left: 0, top: 0, width: dims.w, height: dims.h }
    : {
      left: Math.round((dims.w - 1200 * s) / 2), top: Math.round(Math.max(8, (dims.h - 690 * s) / 2 - 4)),
      width: 1200, height: 690, transform: `scale(${s})`,
    };

  return (
    <div ref={racine} className={`gm${tel ? " tel" : " bureau"}${reduit ? " gm-reduit" : ""}${dims.pret ? "" : " mesure"}`}
      style={{ height: dims.h }} onPointerDownCapture={surToucher}>
      <div className="gm-scene" aria-hidden="true">
        <div className="gm-scene-table" />
        <div className={`gm-lampe${attente.length ? " allumee" : ""}`} />
      </div>
      <div ref={livre} className={`gm-livre${tour ? " tourne" : ""}`} style={placeLivre}
        onPointerDown={surPointeurBas} onPointerUp={surPointeurHaut} onPointerCancel={() => { geste.current = null; }}>
        <div className="gm-reliure" aria-hidden="true" />
        {faces.map((f) => (
          <Face key={f.slot} slot={f.slot} desc={f.desc} cote={f.cote} vivant={f.vivant} idx={f.idx}
            transform={f.transform} origine={f.origine} ctx={ctx} />
        ))}
        <div className="gm-pli" aria-hidden="true" />
      </div>
      <div ref={couche} className="gm-couche" aria-hidden="true" />
      <div className="gm-annonce" aria-live="polite">{live}</div>
    </div>
  );
}
