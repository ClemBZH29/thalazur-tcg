import { useMemo, useState } from "react";
import { useJeu } from "../jeu/Jeu.jsx";
import Artwork from "./Artwork.jsx";
import CadrageCarte from "./CadrageCarte.jsx";
import { cartePreferee, carteDuCatalogue } from "../succes/regles.js";

/** L'ordre d'affichage : les plus rares d'abord, c'est ce qu'on veut montrer. */
const ORDRE = ["pj", "fullart", "legendaire", "rare", "peucommun", "commun"];

const FILTRES = [
  { id: "toutes", nom: "Toutes" },
  { id: "rares", nom: "Rares et plus", garde: (x) => ["pj", "fullart", "legendaire", "rare"].includes(x.c.tier) },
  { id: "rainbow", nom: "Rainbow", garde: (x) => x.rainbow },
];

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * La carte préférée, choisie au profil parmi les cartes de la collection.
 * Au classement, c'est son illustration qui s'affiche en fond de la ligne du
 * joueur, pas la carte entière.
 *
 * Le choix s'ouvre dans la page (pas de fenêtre) : une recherche, trois
 * puces, et les illustrations des cartes possédées. Une carte vendue ou
 * dissoute depuis disparaît du classement d'elle-même (`cartePreferee`).
 */
export default function ChoixCartePreferee() {
  const { etat, setEtat, succes } = useJeu();
  const catalogue = succes.catalogue;
  const actuelle = cartePreferee(etat);
  const base = actuelle && { ext: actuelle.ext, id: actuelle.id, rainbow: actuelle.rainbow };
  const [ouvert, setOuvert] = useState(false);
  const [cadrer, setCadrer] = useState(false);
  const [filtre, setFiltre] = useState("toutes");
  const [q, setQ] = useState("");

  const possedees = useMemo(() => {
    const l = [];
    for (const e of catalogue.extensions) {
      const coll = etat.collections?.[e.id] || {};
      for (const c of [...e.roster, ...e.fullart, ...(e.pj || [])]) {
        const x = coll[c.id];
        const rainbow = (x?.rainbow || 0) > 0;
        if ((x?.normale || 0) > 0 || rainbow) l.push({ c, ext: e.id, rainbow });
      }
    }
    return l.sort((a, b) => ORDRE.indexOf(a.c.tier) - ORDRE.indexOf(b.c.tier)
      || String(b.c.num).localeCompare(String(a.c.num), "fr", { numeric: true }));
  }, [catalogue, etat.collections]);

  const f = FILTRES.find((x) => x.id === filtre);
  const visibles = possedees.filter((x) => (!f.garde || f.garde(x)) && (!q || norm(x.c.nom).includes(norm(q))));

  const choisir = (carte) => setEtat((s) => ({ ...s, profil: { ...(s.profil || {}), carte } }));
  const fiche = actuelle ? carteDuCatalogue(catalogue, actuelle.ext, actuelle.id) : null;
  const rainbowDispo = actuelle && (etat.collections?.[actuelle.ext]?.[actuelle.id]?.rainbow || 0) > 0;
  // Le cadrage vit dans le profil avec la carte ; `cartePreferee` l'aplatit pour la publication.
  const cadre = etat.profil?.carte?.cadre || null;
  const titre = succes.titres.find((t) => t.id === etat.profil?.titre)?.titre || "";

  return (
    <div className="carte-preferee">
      <div className="carte-preferee-actuelle">
        {fiche ? (
          <Artwork carte={fiche} ext={actuelle.ext} rainbow={actuelle.rainbow} cadre={cadre} className="carte-preferee-apercu" />
        ) : (
          <span className="artwork sans-image carte-preferee-apercu" aria-hidden="true" />
        )}
        <div>
          <p className="carte-preferee-nom">{fiche ? fiche.nom : "Aucune carte"}</p>
          <div className="cmp-puces">
            <button type="button" className="puce" aria-expanded={ouvert} aria-controls="carte-preferee-choix"
              onClick={() => { setOuvert((o) => !o); setCadrer(false); }}>
              {ouvert ? "Fermer" : fiche ? "Changer" : "Choisir"}
            </button>
            {fiche && (
              <button type="button" className="puce" aria-expanded={cadrer} onClick={() => { setCadrer((o) => !o); setOuvert(false); }}>
                Cadrer
              </button>
            )}
            {rainbowDispo && (
              <button type="button" className="puce" aria-pressed={actuelle.rainbow}
                onClick={() => choisir({ ...base, cadre: cadre || undefined, rainbow: !actuelle.rainbow })}>Version rainbow</button>
            )}
            {fiche && <button type="button" className="puce" onClick={() => choisir(undefined)}>Retirer</button>}
          </div>
        </div>
      </div>

      {cadrer && fiche && (
        <CadrageCarte carte={fiche} ext={actuelle.ext} rainbow={actuelle.rainbow} cadre={cadre}
          pseudo={etat.profil?.pseudo || "Vous"} titre={titre}
          onChange={(c) => choisir({ ...base, cadre: c || undefined })}
          onFermer={() => setCadrer(false)} />
      )}

      {ouvert && (
        <div id="carte-preferee-choix" className="carte-preferee-choix">
          <div className="carte-preferee-filtres">
            <label className="sr" htmlFor="carte-preferee-q">Chercher une carte</label>
            <input id="carte-preferee-q" type="search" value={q} placeholder="Chercher une carte"
              autoComplete="off" spellCheck={false} onChange={(e) => setQ(e.target.value)} />
            <div className="cmp-puces" role="group" aria-label="Filtrer">
              {FILTRES.map((x) => (
                <button key={x.id} type="button" className="puce" aria-pressed={filtre === x.id}
                  onClick={() => setFiltre(x.id)}>{x.nom}</button>
              ))}
            </div>
          </div>
          {visibles.length === 0 ? (
            <p className="muted petit">Aucune carte de votre collection ne correspond.</p>
          ) : (
            <ul className="carte-preferee-grille">
              {visibles.map((x) => {
                const choisie = actuelle?.ext === x.ext && actuelle?.id === x.c.id;
                return (
                  <li key={`${x.ext}:${x.c.id}`}>
                    <button type="button" aria-pressed={choisie} title={x.c.nom} aria-label={x.c.nom}
                      onClick={() => { choisir({ ext: x.ext, id: x.c.id, rainbow: false }); setOuvert(false); setCadrer(true); }}>
                      <Artwork carte={x.c} ext={x.ext} vignette />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
