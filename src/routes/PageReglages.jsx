import Reglages from "../components/Reglages.jsx";
import { useJeu } from "../jeu/Jeu.jsx";

export default function PageReglages() {
  const jeu = useJeu();
  return (
    <Reglages
      rows={jeu.rows}
      source={jeu.source}
      grades={jeu.grades}
      taux={jeu.taux}
      cfgImage={jeu.cfgImage}
      test={jeu.test}
      bourse={jeu.bourse}
      son={jeu.son}
      animations={jeu.animations}
      sobreSysteme={jeu.sobreSysteme}
      reventeAuto={jeu.reventeAuto}
      nbImages={jeu.nbImages}
      avis={jeu.avis}
      onRoster={(lignes, nom) =>
        jeu.setEtat((e) => ({
          ...e,
          rosters: { ...e.rosters, [jeu.boosterId]: { source: nom, lignes } },
        }))}
      onGrades={(g) =>
        jeu.setEtat((e) => ({ ...e, grades: { ...e.grades, [jeu.boosterId]: g } }))}
      onTaux={(t) => jeu.majReglages({ taux: t })}
      onCfgImage={(c) => jeu.majReglages({ image: c })}
      onTest={(t) => jeu.majReglages({ test: t })}
      onSon={(v) => jeu.majReglages({ son: v })}
      onAnimations={(v) => jeu.majReglages({ animations: v })}
      onReventeAuto={(v) => jeu.majReglages({ reventeAuto: v })}
      onImages={(m, n) => {
        // Les URL du lot précédent ne seraient jamais libérées sans ça.
        new Set(jeu.fichiers.values()).forEach((u) => URL.revokeObjectURL(u));
        jeu.setFichiers(m);
        jeu.setNbImages(n);
      }}
      onAvis={jeu.setAvis}
    />
  );
}
