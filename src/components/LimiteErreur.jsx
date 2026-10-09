import { Component } from "react";

/**
 * Limite d'erreur : une page qui plante, ou un module chargé à la demande qui
 * n'arrive pas (réseau coupé, nouvelle version publiée entre-temps), laissait
 * un écran blanc — React démonte tout l'arbre faute de limite. On montre à la
 * place de quoi repartir : recharger, et d'abord, si l'on veut, emporter sa
 * partie dans un fichier.
 *
 * `chemin` : changer de page efface l'erreur, pour qu'une page cassée
 * n'empêche pas d'aller sur les autres. `exporter` : la fonction d'export de
 * la partie (src/lib/storage.js), absente si l'état du jeu n'est pas lisible.
 */
export default class LimiteErreur extends Component {
  constructor(props) {
    super(props);
    this.state = { erreur: null, chemin: props.chemin };
  }

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  static getDerivedStateFromProps(props, state) {
    return props.chemin !== state.chemin ? { erreur: null, chemin: props.chemin } : null;
  }

  componentDidCatch(erreur, info) {
    console.error("[limite d'erreur]", erreur, info?.componentStack);
  }

  render() {
    if (!this.state.erreur) return this.props.children;
    const { exporter } = this.props;
    return (
      <main className="view introuvable" id="contenu">
        <section className="perdu" role="alert">
          <h1>La brume s'est épaissie</h1>
          <p className="lede">
            Cette page n'a pas pu s'afficher. Votre partie est conservée sur cet
            appareil ; recharger la page suffit le plus souvent.
          </p>
          <div className="hero-actions">
            <button type="button" className="btn" onClick={() => window.location.reload()}>Recharger</button>
            {exporter && (
              <button type="button" className="btn quiet" onClick={() => { try { exporter(); } catch { /* rien à exporter */ } }}>
                Exporter ma partie
              </button>
            )}
          </div>
        </section>
      </main>
    );
  }
}
