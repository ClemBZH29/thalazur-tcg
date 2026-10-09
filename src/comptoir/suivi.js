/**
 * Les sauvegardes du marché qu'un onglet connaît : celle dont il a monté son
 * `Marche`, et celles qu'il a écrites lui-même.
 *
 * L'objet `Marche` n'était reconstruit qu'au changement d'extension ou de
 * jour. Quand la sauvegarde changeait ailleurs — un autre onglet (adopté par
 * l'événement `storage`), une fusion avec le compte —, l'onglet gardait son
 * marché périmé : le quota de Lise redevenait plein, et sa prochaine écriture
 * effaçait les ventes de l'autre. Une sauvegarde qu'on ne reconnaît pas vient
 * d'ailleurs : il faut remonter le marché depuis elle.
 *
 * On reconnaît les objets eux-mêmes, pas leur contenu : l'état du jeu range
 * tel quel l'objet que l'onglet a écrit, et comparer huit cents prix à chaque
 * rendu coûterait pour rien. Une copie relue à l'identique (synchronisation
 * sans changement) remonte un marché identique : la sauvegarde est sans
 * perte.
 */
export function suiviSauvegardes() {
  const connues = new WeakSet();
  const objet = (s) => !!s && typeof s === "object";
  return {
    noter(s) { if (objet(s)) connues.add(s); return s; },
    etrangere(s) { return objet(s) && !connues.has(s); },
  };
}
