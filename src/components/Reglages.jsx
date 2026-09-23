import { useRef } from "react";
import { TIERS, ECONOMIE, REVENTE, GARANTIES } from "../config/tiers.js";
import { COL, compterGrades, deduireGrades, urlDansLigne, slug } from "../lib/roster.js";
import { effacer } from "../lib/storage.js";
import { useCompte } from "../jeu/Compte.jsx";
import { Lien } from "../lib/routeur.jsx";

export default function Reglages({
  rows, source, grades, taux, cfgImage, test, bourse, son, reventeAuto, nbImages, avis,
  animations, sobreSysteme,
  onRoster, onGrades, onTaux, onCfgImage, onTest, onSon, onReventeAuto, onAnimations,
  onImages, onAvis,
}) {
  const compte = useCompte();
  const connecte = compte?.statut === "connecte";
  const refXlsx = useRef(null);
  const refImgs = useRef(null);
  const listeGrades = compterGrades(rows);

  const lireXlsx = async (f) => {
    try {
      // Chargé à la demande. read-excel-file et non SheetJS : voir scripts/xlsx-to-json.mjs.
      const { default: lire } = await import("read-excel-file/browser");
      const feuilles = await lire(f);
      const ws = (feuilles.find((s) => s.sheet === "Liste") || feuilles[0]).data;
      let data = ws.filter((r) => r.some((v) => v !== null && v !== ""));
      if (data.length && isNaN(Number(data[0][COL.num]))) data = data.slice(1);
      data = data.filter((r) => String(r[COL.nom] ?? "").trim());
      if (!data.length) return onAvis("Aucune ligne exploitable. La colonne B doit contenir les noms.");
      onRoster(data, f.name);
      onGrades(deduireGrades(data));
      const avecUrl = data.filter(urlDansLigne).length;
      onAvis(`${data.length} membres chargés${avecUrl ? `, dont ${avecUrl} avec une URL d'image` : ""}. Le roster est conservé localement.`);
    } catch {
      onAvis("Fichier illisible. Attendu : .xlsx avec une feuille « Liste ».");
    }
  };

  const lireImages = (files) => {
    const m = new Map();
    Array.from(files).forEach((f) => {
      const base = f.name.replace(/\.[^.]+$/, "");
      const url = URL.createObjectURL(f);
      m.set(base, url);
      m.set(slug(base), url);
      const n = base.match(/\d+/);
      if (n) m.set(String(Number(n[0])), url);
    });
    onImages(m, files.length);
    onAvis(`${files.length} image(s) montées. Elles restent en mémoire jusqu'au rechargement de la page.`);
  };

  return (
    <main className="view" id="contenu">
      <div className="section-titre"><h1>Réglages</h1></div>

      <section className="panneau">
        <div className="bloc">
          <h3>Roster</h3>
          <p className="muted">
            Source actuelle : {source} — {rows.length} entrées. Le fichier attendu est un .xlsx avec
            une feuille « Liste » : colonne B le nom, C la race, D le genre, E le corps, G le grade,
            H l'occupation, I l'anecdote. Toute cellule commençant par http est prise comme URL de portrait.
            Pour un usage permanent, préfère <code>npm run roster</code> qui écrit le JSON dans data/.
          </p>
          <div className="actions" style={{ marginTop: 14, justifyContent: "flex-start" }}>
            <button className="btn quiet sm" onClick={() => refXlsx.current?.click()}>Charger un .xlsx</button>
            <input ref={refXlsx} type="file" accept=".xlsx,.xls" className="cache"
              onChange={(e) => e.target.files?.[0] && lireXlsx(e.target.files[0])} />
          </div>
        </div>

        <div className="bloc">
          <h3>Portraits</h3>
          <p className="muted">
            Trois sources en cascade, la première qui répond gagne : fichiers montés depuis le
            disque, puis URL trouvée dans la ligne du roster, puis motif construit sur une base.
            Sans portrait, la carte retombe sur un monogramme gravé. Le portrait est recadré en
            couvrant la fenêtre du cadre ; le point focal règle la hauteur retenue, ce qui permet
            de garder la tête visible aussi bien sur un buste que sur une illustration pleine.
          </p>
          <div className="champs">
            <label className="champ">
              <span>Point focal vertical — {cfgImage.focal ?? 30} %</span>
              <input
                type="range" min="0" max="100" step="5" value={cfgImage.focal ?? 30}
                onChange={(e) => onCfgImage({ ...cfgImage, focal: Number(e.target.value) })}
              />
            </label>
            <label className="champ large">
              <span>URL de base</span>
              <input type="text" placeholder="./portraits" value={cfgImage.base}
                onChange={(e) => onCfgImage({ ...cfgImage, base: e.target.value })} />
            </label>
            <label className="champ">
              <span>Motif — {"{num}"}, {"{slug}"}, {"{nom}"}</span>
              <input type="text" value={cfgImage.motif}
                onChange={(e) => onCfgImage({ ...cfgImage, motif: e.target.value })} />
            </label>
            <div className="champ">
              <span>Dossier local</span>
              <button className="btn quiet sm" onClick={() => refImgs.current?.click()}>
                {nbImages ? `${nbImages} image(s)` : "Choisir des fichiers"}
              </button>
              <input ref={refImgs} type="file" accept="image/*" multiple className="cache"
                onChange={(e) => e.target.files?.length && lireImages(e.target.files)} />
            </div>
          </div>
        </div>

        <div className="bloc">
          <h3>Taux</h3>
          <p className="muted">
            L'écaille est le levier le plus sensible : au-delà de 8 %, les joueurs cessent de réagir.
          </p>
          <div className="champs">
            <label className="champ large">
              <span>Rainbow — {(taux.rainbow * 100).toFixed(1)} %</span>
              <input type="range" min="0" max="0.2" step="0.005" value={taux.rainbow}
                onChange={(e) => onTaux({ ...taux, rainbow: Number(e.target.value) })} />
            </label>
            <label className="champ large">
              <span>Appel de Valéran — {(taux.appel * 100).toFixed(2)} %</span>
              <input type="range" min="0" max="0.05" step="0.001" value={taux.appel}
                onChange={(e) => onTaux({ ...taux, appel: Number(e.target.value) })} />
            </label>
          </div>
        </div>

        <div className="bloc">
          <h3>Rareté par premier repère</h3>
          <p className="muted">
            Ce tableau ne concerne que les lignes <em>sans</em> palier en colonne D. Pour
            celles-là, la rareté se déduit de la fréquence du premier repère — archétype,
            rareté d'objet ou province — puis se corrige ici. Une ligne portant un palier
            explicite ignore complètement ce réglage.
          </p>
          <div className="table-grades">
            {listeGrades.map(([g, n]) => (
              <div className="ligne-grade" key={g}>
                <span className="g">{g}</span>
                <span className="n">{n}</span>
                <select value={grades[g] || "commun"} onChange={(e) => onGrades({ ...grades, [g]: e.target.value })}>
                  {TIERS.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>


        <div className="bloc">
          <h3>Mode test</h3>
          <p className="muted">
            Pour vérifier le rendu d'un palier ou la mécanique sans attendre le tirage.
            Aucun de ces réglages n'a d'effet tant que le mode est éteint, et les cartes
            obtenues rejoignent la bibliothèque comme les autres.
          </p>
          <div className="champs" style={{ marginTop: 14 }}>
            <div className="champ">
              <span>Mode</span>
              <button
                className={test.actif ? "btn sm" : "btn quiet sm"}
                onClick={() => onTest({ ...test, actif: !test.actif })}
                aria-pressed={test.actif}
              >
                {test.actif ? "Activé" : "Éteint"}
              </button>
            </div>
            <div className="champ">
              <span>Pièces d'or</span>
              <button
                className="btn quiet sm"
                disabled={!test.actif}
                onClick={() => onTest({ ...test, sansPO: !test.sansPO })}
                aria-pressed={test.sansPO}
              >
                {test.sansPO ? "Coût désactivé" : "Coût actif"}
              </button>
            </div>
            <label className="champ">
              <span>Cartes par booster — {test.taille}</span>
              <input
                type="range" min="1" max="10" step="1" value={test.taille} disabled={!test.actif}
                onChange={(e) => onTest({ ...test, taille: Number(e.target.value) })}
              />
            </label>
            <label className="champ">
              <span>Palier forcé</span>
              <select
                value={test.palier} disabled={!test.actif}
                onChange={(e) => onTest({ ...test, palier: e.target.value })}
              >
                <option value="auto">Tables normales</option>
                {TIERS.map((t) => <option key={t.id} value={t.id}>Tout en {t.nom.toLowerCase()}</option>)}
              </select>
            </label>
            <label className="champ">
              <span>Écaille</span>
              <select
                value={test.rainbow} disabled={!test.actif}
                onChange={(e) => onTest({ ...test, rainbow: e.target.value })}
              >
                <option value="auto">Selon le taux</option>
                <option value="toujours">Toujours rainbow</option>
                <option value="jamais">Jamais rainbow</option>
              </select>
            </label>
            <label className="champ">
              <span>Colporteur</span>
              <select
                value={test.colporteur} disabled={!test.actif}
                onChange={(e) => onTest({ ...test, colporteur: e.target.value })}
              >
                <option value="auto">Passage normal</option>
                <option value="toujours">À chaque booster</option>
                <option value="jamais">Jamais</option>
              </select>
            </label>
          </div>
          {test.actif && (
            <p className="avis">
              Mode test actif{test.sansPO && ", les boosters sont gratuits"}
              {test.taille !== 5 && `, ${test.taille} carte${test.taille > 1 ? "s" : ""} par booster`}
              {test.palier !== "auto" && `, tout forcé en ${test.palier}`}
              {test.rainbow !== "auto" && `, écaille ${test.rainbow}`}
              {test.colporteur === "toujours" && ", le colporteur passe à chaque booster"}
              {test.colporteur === "jamais" && ", le colporteur ne passe pas"}.
            </p>
          )}
        </div>

        <div className="bloc">
          <h3>Économie</h3>
          <p className="muted">
            {ECONOMIE.depart} PO au départ, {ECONOMIE.prix} PO le booster, {ECONOMIE.parHeure} PO
            créditées par heure et plafonnées à {ECONOMIE.plafond} — de quoi sauter une journée sans
            rien perdre. Un légendaire est garanti dans les {GARANTIES.premierLegendaire} premiers
            boosters, puis tous les {GARANTIES.intervalle}. Les Mines de Kazim s'ajoutent à ce
            gain passif, hors plafond.
          </p>
          <div className="compteurs" style={{ marginTop: 14 }}>
            <span className="compteur">Solde <b>{Math.floor(bourse.po)} PO</b></span>
            <span className="compteur">Gagné hors gain passif <b>{Math.floor(bourse.gagne || 0)} PO</b></span>
          </div>
        </div>

        <div className="bloc">
          <h3>Animations</h3>
          <p className="muted">
            Le sachet qui se déchire, la lueur qui annonce le palier avant que le
            nom soit lisible, la carte qui se retourne, les éclats du filon : ici
            l'animation porte l'information, elle ne décore pas. Par défaut le
            site suit la préférence de votre système
            {sobreSysteme
              ? " — et il demande actuellement moins d'animations, donc tout est coupé."
              : ", qui ne demande actuellement rien de particulier."}
          </p>
          <div className="segments" role="group" aria-label="Animations" style={{ marginTop: 12 }}>
            {[["systeme", "Suivre le système"], ["pleines", "Toujours animer"],
              ["reduites", "Jamais animer"]].map(([v, libelle]) => (
              <button
                key={v}
                className={animations === v ? "on" : ""}
                aria-pressed={animations === v}
                onClick={() => onAnimations(v)}
              >
                {libelle}
              </button>
            ))}
          </div>
        </div>

        <div className="bloc">
          <h3>Doublons</h3>
          <p className="muted">
            Par défaut, un exemplaire tombant dans une case déjà remplie reste dans
            votre inventaire : c'est la matière première du Comptoir, où un acheteur
            du jour paie sensiblement plus que le rachat garanti. Rallumer la revente
            automatique rend le comportement d'origine de l'application — le doublon
            part sur-le-champ pour {REVENTE.commun} PO un commun, {REVENTE.peucommun} un
            peu commun, {REVENTE.rare} un rare, {REVENTE.legendaire} un légendaire — et
            plus aucun surplus n'atteint le Comptoir.
          </p>
          <label className="bascule" style={{ marginTop: 14 }}>
            <input
              type="checkbox"
              checked={reventeAuto === true}
              onChange={(e) => onReventeAuto(e.target.checked)}
            />
            <span>Revendre les doublons automatiquement à la révélation</span>
          </label>
        </div>

        <div className="bloc">
          <h3>Divers</h3>
          <div className="actions" style={{ marginTop: 0, justifyContent: "flex-start" }}>
            <button className="btn quiet sm" onClick={() => onSon(!son)}>
              {son ? "Couper le son" : "Rétablir le son"}
            </button>
            <button className="btn quiet sm" onClick={() => {
              // Connecté, la partie effacée ici part aussi sur le compte : c'est
              // une remise à zéro de la partie, pas un nettoyage de l'appareil.
              // Pour vider l'appareil seul, il y a la déconnexion.
              const quoi = connecte
                ? "Effacer la bibliothèque, les boosters ouverts, le porte-monnaie et les réglages, sur cet appareil ET sur votre compte ? Cette action est définitive. (Pour vider seulement cet appareil, déconnectez-vous depuis le profil.)"
                : "Effacer la bibliothèque, les boosters ouverts, le porte-monnaie et les réglages ? Cette action est définitive.";
              if (window.confirm(quoi)) {
                effacer();
                window.location.reload();
              }
            }}>Tout effacer</button>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>
            <Lien vers="/profil" actif={false} className="lien">Compte et synchronisation</Lien>
            {" · "}
            <Lien vers="/confidentialite" actif={false} className="lien">Confidentialité et mentions légales</Lien>
          </p>
        </div>

        {avis && <p className="avis">{avis}</p>}
      </section>
    </main>
  );
}
