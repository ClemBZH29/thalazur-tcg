/**
 * Mines de Kazim — les données : strates, compagnons, équipement,
 * améliorations, talents, onglets et lexique. Rien ici ne calcule : les
 * formules sont dans `regles.js`.
 */

export const STRATES = [
  { nom: "Galerie d'entrée", sous: "Poussière, rails rouillés, un vieux fanal." },
  { nom: "Veines Grises", sous: "Le schiste crisse. L'étoile y perle en grains." },
  { nom: "Faille de Braise", sous: "La roche est tiède. Quelque chose respire dessous." },
  { nom: "Halle des Étais", sous: "Des piliers taillés par des mains oubliées." },
  { nom: "Cœur Résonant", sous: "Chaque coup de pioche revient en écho, deux fois." },
  { nom: "Puits Noyé", sous: "L'eau monte à hauteur de botte et brille par en dessous." },
  { nom: "Rookerie kobolde", sous: "Ils vous regardent creuser. Ils comptent déjà." },
  { nom: "Abîme de Kazim", sous: "Plus de plafond. De l'étoile à perte de vue." },
];

export const COMPAGNONS = [
  { id: "fanal",   sprite: "porte-fanal",        nom: "Porte-fanal",           desc: "Tient la lumière, ramasse les éclats tombés.", base: 15,     dps: 1 },
  { id: "nain",    sprite: "mineur-nain",        nom: "Mineur nain",           desc: "Frappe lentement, ne s'arrête jamais.",        base: 130,    dps: 9 },
  { id: "foreuse", sprite: "foreuse-vapeur",     nom: "Foreuse à vapeur",      desc: "Bruyante, gourmande en charbon, efficace.",    base: 1400,   dps: 52 },
  { id: "golem",   sprite: "golem-schiste",      nom: "Golem de schiste",      desc: "Creuse la roche avec ses propres poings.",     base: 15000,  dps: 290 },
  { id: "deser",   sprite: "kobold-deserteur",   nom: "Kobold déserteur",      desc: "Connaît les filons que sa tribu vous cache.",  base: 170000, dps: 1600 },
  { id: "sourc",   sprite: "sourciere-etoile",   nom: "Sourcière d'étoile",    desc: "Écoute la roche et désigne où frapper.",       base: 2.1e6,  dps: 9000 },
  { id: "elem",    sprite: "elementaire-faille", nom: "Élémentaire de faille", desc: "Fend la strate d'un seul mouvement.",          base: 3.2e7,  dps: 52000 },
  { id: "titan",   sprite: "machine-kazim",      nom: "Machine de Kazim",      desc: "Personne ne sait qui l'a construite.",         base: 5.5e8,  dps: 320000 },
];

export const EQUIPEMENT = [
  { id: "p1", sprite: "pioche-fer",         nom: "Pioche de fer",          desc: "Dégâts de frappe doublés.",                     cout: 90,    type: "clic",    val: 2,    req: 0 },
  { id: "l1", sprite: "fanal-huile",        nom: "Fanal à huile claire",   desc: "Ajoute 4 % de chance de coup critique.",        cout: 400,   type: "crit",    val: 4,    req: 0 },
  { id: "e1", sprite: "etais-renforces",    nom: "Étais renforcés",        desc: "Production des compagnons augmentée de 40 %.",  cout: 1600,  type: "dps",     val: 1.4,  req: 1 },
  { id: "p2", sprite: "pioche-acier",       nom: "Pioche d'acier trempé",  desc: "Dégâts de frappe multipliés par 2,5.",          cout: 7000,  type: "clic",    val: 2.5,  req: 1 },
  { id: "c1", sprite: "contrat-courtage",   nom: "Contrat de courtage",    desc: "Prix de rachat +14 %, et les kobolds se lassent moins vite.",      cout: 20000, type: "taux",    val: 0.88, req: 2 },
  { id: "l2", sprite: "lentille-quartz",    nom: "Lentille de quartz",     desc: "Ajoute 6 % de critique et les rend plus durs.", cout: 65000, type: "crit2",   val: 6,    req: 2 },
  { id: "e2", sprite: "rails-bascule",      nom: "Rails à bascule",        desc: "Production des compagnons doublée.",            cout: 3e5,   type: "dps",     val: 2,    req: 3 },
  { id: "p3", sprite: "pioche-resonante",   nom: "Pioche résonante",       desc: "Dégâts de frappe multipliés par 4.",            cout: 1.4e6, type: "clic",    val: 4,    req: 4 },
  { id: "f1", sprite: "tamis-mailles",      nom: "Tamis à mailles fines",  desc: "Récolte d'étoile augmentée de 60 %.",           cout: 9e6,   type: "recolte", val: 1.6,  req: 4 },
  { id: "c2", sprite: "serment-rookerie",   nom: "Serment de la Rookerie", desc: "Prix de rachat +18 %, et ils se lassent encore moins vite.",          cout: 4e7,   type: "taux",    val: 0.85, req: 6 },
  { id: "p4", sprite: "pioche-kazim",       nom: "Pioche de Kazim",        desc: "Dégâts de frappe multipliés par 6.",            cout: 2.5e8, type: "clic",    val: 6,    req: 7 },
  { id: "f2", sprite: "benediction-filon",  nom: "Bénédiction du filon",   desc: "Récolte d'étoile multipliée par 2,2.",          cout: 1.2e9, type: "recolte", val: 2.2,  req: 7 },
];

/* Les descriptions disent ce que le talent fait, pas comment il est calculé.
   « Une frappe vaut 0,12 s de production de plus par point » était exact et
   illisible : c'est la formule de `secondesParFrappe`, recopiée dans l'interface.
   Le joueur n'a pas à lire le code pour savoir s'il doit dépenser son point. */
/* ── Les améliorations de compagnon ───────────────────────────────────────
   Le prix d'un compagnon monte de 15 % par exemplaire, sa production ne monte
   pas du tout : passé une trentaine de porte-fanaux, un de plus coûtait deux
   mille étoiles pour une seule de production, quand une foreuse en rendait
   cinquante pour dix mille. L'équipe de départ ne mourait pas, elle cessait
   simplement d'exister — et c'est la moitié du roster qui passait au rebut à
   chaque palier franchi.

   Quatre améliorations par compagnon, débloquées au nombre possédé, chacune
   doublant sa production : ×16 pour une équipe complète. Elles ne rendent pas
   un porte-fanal meilleur qu'un golem — avec des paliers de production à ×5,8,
   aucun doublement ne le pourrait, et ce serait d'ailleurs absurde. Elles font
   autre chose, qui est précisément ce qui manquait : elles donnent une raison
   de continuer d'en acheter. À trente-six porte-fanaux avec les rangs I et II,
   le suivant rend quatre fois plus qu'avant, et surtout il rapproche du
   cinquantième, qui double de nouveau toute la ligne.

   Le prix est indexé sur le compagnon lui-même — ce qu'a coûté d'arriver au
   seuil, multiplié par un facteur qui double d'un rang à l'autre, comme
   l'effet. Une seule constante, et chaque ligne suit sa propre courbe sans
   table de prix à tenir à jour.

   Ce que ça donne, en nombre d'exemplaires du compagnon concerné :

     rang I   ≈ 10 exemplaires   pour en gagner 10  → l'entrée, au prix coûtant
     rang II  ≈ 20               pour en gagner 50  → deux fois et demie
     rang III ≈ 40               pour en gagner 200 → cinq fois
     rang IV  ≈ 80               pour en gagner 800 → dix fois

   La pente est voulue : le premier rang se paie au prix d'un achat ordinaire,
   les suivants récompensent d'avoir tenu la ligne. Un rang uniformément cher
   faisait l'inverse — on le prenait au début, où il ne servait à rien, et on
   l'abandonnait à la fin, où il aurait tout changé. */
export const RANGS = ["I", "II", "III", "IV"];
export const SEUILS_AMELIORATION = [10, 25, 50, 100];
export const FACTEUR_AMELIORATION = 1.5;
/* Ce qu'a coûté l'achat des n premiers exemplaires, somme de la géométrique. */
export const coutCumule = (base, n) => (base * (Math.pow(1.15, n) - 1)) / 0.15;

export const AMELIORATIONS = COMPAGNONS.flatMap((c) =>
  SEUILS_AMELIORATION.map((seuil, i) => ({
    id: "a-" + c.id + "-" + i,
    compagnon: c.id,
    sprite: c.sprite,
    nom: c.nom + " " + RANGS[i],
    seuil,
    desc: "Production doublée. Il en faut " + seuil + ".",
    cout: Math.ceil(coutCumule(c.base, seuil) * FACTEUR_AMELIORATION * Math.pow(2, i)),
  }))
);

export const TALENTS = [
  { id: "force",      nom: "Force",
    desc: "Vos coups de pioche font plus mal — et le restent quand vos compagnons pèsent des millions. Le seul talent qui récompense votre présence." },
  { id: "echo",       nom: "Écho",
    desc: "Deux points de chance de coup critique en plus par point. Chaque critique fait aussi monter le prix de votre prochaine vente." },
  { id: "discipline", nom: "Discipline",
    desc: "Vos compagnons creusent 12 % plus vite par point. Le seul talent qui travaille en votre absence." },
  { id: "fortune",    nom: "Fortune",
    desc: "Des filons exceptionnels plus souvent : ceux qui rendent quatre à douze fois plus d'étoile." },
];

/* ── Ce qui s'ouvre, et quand ─────────────────────────────────────────────
   Les cinq onglets étaient tous là à la première seconde. Quatre d'entre eux
   ne voulaient rien dire : l'Échoppe sans étoile à vendre, les Talents sans
   point à placer, l'Effondrement qui exige la profondeur 5. Le joueur arrivait
   devant un tableau de bord d'usine pour un seul geste possible — frapper.

   Chacun s'ouvre maintenant au moment où il devient utile, dans cet ordre,
   qui est aussi celui de l'apprentissage. Le prédicat lit l'état ; rien n'est
   stocké, donc une sauvegarde ancienne retrouve ses onglets au chargement.
   La phrase sert deux fois : à annoncer l'ouverture, et dans le lexique. */
export const ONGLETS = [
  ["compagnons", "Compagnons", () => true,
    "Embauchez qui creusera à votre place, même quand vous n'êtes pas là."],
  ["echoppe", "Échoppe kobolde", (s) => s.brisesTotal >= 1,
    "Les kobolds rachètent votre étoile contre des pièces d'or."],
  ["equipement", "Chantier", (s) => s.brisesTotal >= 4,
    "Pioches, fanaux, étais : du matériel qu'on installe une fois pour toutes."],
  ["talents", "Talents", (s) => s.niveau > 1 || s.points > 0,
    "Un point par niveau, à placer où vous voulez."],
  ["effondrement", "Effondrement", (s) => s.profondeurMax >= 5,
    "Tout faire sauter et recommencer, en plus fort."],
];

/* ── Le lexique ───────────────────────────────────────────────────────────
   Un jeu de mine a son vocabulaire, et il vaut mieux qu'il en ait un : « le
   filon cède » dit quelque chose que « le compteur atteint zéro » ne dit pas.
   Mais un mot d'ambiance qui porte une mécanique doit être définissable en une
   phrase, et cette phrase doit être quelque part. Elle est ici.

   Le lexique ne montre que les mots déjà rencontrés : lire la définition de
   l'effondrement au premier coup de pioche n'apprend rien à personne. */
export const LEXIQUE = [
  { mot: "Étoile", des: () => true,
    def: "Le minerai qu'on sort de la roche. Elle ne sert qu'ici : embaucher, équiper, et se faire payer par les kobolds." },
  { mot: "Filon", des: () => true,
    def: "Un bloc de roche. On le frappe jusqu'à ce qu'il cède, il rend son étoile, un autre prend sa place." },
  { mot: "Résistance", des: () => true,
    def: "Ce qu'il reste à casser sur le filon en cours — la barre sous la roche." },
  { mot: "Profondeur", des: () => true,
    def: "Douze filons par profondeur. Le douzième vous fait descendre, et plus bas l'étoile se vend plus cher." },
  { mot: "Coup critique", des: (s) => s.brisesTotal >= 1,
    def: "Une frappe qui compte cinq fois. Le fanal, la lentille et le talent Écho les rendent plus fréquents." },
  { mot: "Filon exceptionnel", des: (s) => s.brisesTotal >= 1,
    def: "Il arrive qu'un filon rende quatre, voire douze fois plus d'étoile. Le talent Fortune les fait sortir plus souvent." },
  { mot: "PO kobold", des: (s) => s.brisesTotal >= 1,
    def: "Les pièces d'or que les kobolds versent. Elles rejoignent votre bourse, en haut du site." },
  { mot: "Prix de rachat", des: (s) => s.brisesTotal >= 1,
    def: "Ce que les kobolds consentent à payer, en pourcentage. Il monte quand vous vendez gros, il baisse à mesure qu'ils ont déjà payé." },
  { mot: "Éclat de Kazim", des: (s) => s.profondeurMax >= 5,
    def: "Ce qu'on retrouve dans les gravats après un effondrement. Chaque éclat ajoute 3 % de récolte et de dégâts, pour toujours." },
  { mot: "Effondrement", des: (s) => s.profondeurMax >= 5,
    def: "Faire sauter les étais : la mine repart de zéro, mais vos pièces d'or et vos éclats restent." },
];
