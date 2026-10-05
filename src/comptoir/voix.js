/**
 * Ce que disent les acheteurs, et comment ils aiment qu'on leur présente une
 * carte.
 *
 * Chaque réplique dit ce que l'acheteur achète vraiment : les anciennes
 * venaient du module d'origine et ne correspondaient plus à leurs goûts
 * (Lise « cherchait les cartes qui lui manquaient », alors qu'elle rachète
 * les communes en double). Une bulle de dialogue ne porte que la voix du
 * personnage ; les faits (ce qu'il achète, combien) se lisent sous son nom.
 *
 * `prefere` / `deteste` : la manière de présenter une carte qui le convainc,
 * et celle qui l'agace. `indice` le laisse deviner, sans le dire : c'est ce
 * qui donne une raison de lire les personnages.
 *
 * `{province}` est remplacé par le chargement de Gaspard du jour.
 */

/** Les trois manières de présenter une carte au marchandage. */
export const MANIERES = [
  { id: "ferme", nom: "Le prix ferme" },
  { id: "histoire", nom: "L'histoire de la carte" },
  { id: "rarete", nom: "Sa rareté" },
];

export const VOIX = {
  lise: {
    quote: "« Des communes en double ? C'est par là que commence une collection. »",
    refus: "« Rien de commun dans votre ballot ? Vous avez de la chance, vous. »",
    indice: "« Dites-moi votre prix, franchement. Je n'aime pas qu'on tourne autour. »",
    ok: "« Bon, d'accord. Vous savez ce que vous voulez, vous. »",
    ko: "« Vous tournez autour du pot. Je baisse un peu mon offre. »",
    merci: "« Merci ! Elles rejoindront mon classeur dès ce soir. »",
    prefere: "ferme", deteste: "rarete",
  },
  sorelle: {
    quote: "« Je ne regarde que l'exceptionnel. Le reste, gardez-le. »",
    refus: "« Rien d'exceptionnel aujourd'hui ? Quel dommage. »",
    indice: "« Dites-moi ce qu'elle a de rare. Le prix viendra après. »",
    ok: "« Vous savez parler aux collectionneuses. J'augmente. »",
    ko: "« Un prix, sans un mot sur la pièce ? Mon offre baisse. »",
    merci: "« Elle sera mieux dans ma vitrine que dans votre ballot. »",
    prefere: "rarete", deteste: "ferme",
  },
  voren: {
    quote: "« Une rainbow vaut toujours plus demain qu'aujourd'hui. »",
    refus: "« Pas une seule rainbow ? Revenez quand vous en aurez. »",
    indice: "« Parlez-moi de sa cote. Le reste, c'est de la littérature. »",
    ok: "« Vous lisez le marché. Je relève. »",
    ko: "« Une histoire ? Je n'achète pas des histoires. Je baisse. »",
    merci: "« Elle vaudra plus demain. Chez moi. »",
    prefere: "rarete", deteste: "histoire",
  },
  oriane: {
    quote: "« Un artéfact se souvient de ce que les gens ont oublié. »",
    refus: "« Pas un seul artéfact dans votre ballot ? Je repasserai. »",
    indice: "« D'où vient cette pièce ? Qui l'a tenue avant vous ? »",
    ok: "« Voilà qui mérite d'être noté. Je relève mon offre. »",
    ko: "« Un prix ferme, pour un objet pareil ? Je baisse. »",
    merci: "« Elle rejoindra les vitrines de Soldestin. »",
    prefere: "histoire", deteste: "ferme",
  },
  nassim: {
    quote: "« Chaque province a ses lieux. Montrez-moi les vôtres. »",
    refus: "« Aucun lieu à me montrer ? La route sera longue. »",
    indice: "« Entre marchands, on se dit les prix. Le reste nous fait perdre du temps. »",
    ok: "« Voilà qui est parler. Marché conclu à ce prix. »",
    ko: "« Rare, rare… tout est rare, à vous entendre. Je baisse. »",
    merci: "« Je la montrerai dans trois provinces avant de la revendre. »",
    prefere: "ferme", deteste: "rarete",
  },
  ysee: {
    quote: "« Je paie pour ce qui gagne au Donjon, pas pour ce qui brille. »",
    refus: "« Personne qui sache se battre, dans votre ballot ? »",
    indice: "« Un chiffre. Je n'ai pas le temps pour les légendes. »",
    ok: "« Efficace. J'aime ça. Je monte. »",
    ko: "« Je vous ai demandé un prix, pas un conte. Je baisse. »",
    merci: "« Elle sera dans mon équipe dès ce soir. »",
    prefere: "ferme", deteste: "histoire",
  },
  hector: {
    quote: "« La Troupe, la GRC, ceux qui ont servi : je reconnais les miens. »",
    refus: "« Personne de la Troupe, dans votre ballot ? Dommage. »",
    indice: "« Racontez-moi où il a servi, soldat. »",
    ok: "« Un camarade, alors. Je paie ce qu'il vaut. »",
    ko: "« On ne marchande pas un soldat comme une babiole. Je baisse. »",
    merci: "« Il sera entre de bonnes mains. »",
    prefere: "histoire", deteste: "rarete",
  },
  gaspard: {
    quote: "« J'arrive de {province}. Tout ce qui vient de là-bas, je le prends ! »",
    refus: "« Rien de {province}, dans votre ballot ? Je repasserai avec un autre chargement. »",
    indice: "« Allez, racontez-moi d'où elle sort. Le quai adore les histoires. »",
    ok: "« Ha ! Celle-là, je la raconterai au quai. Je monte. »",
    ko: "« Rare, rare… sur le quai, tout est rare. Je baisse. »",
    merci: "« Elle repart avec le prochain chargement ! »",
    prefere: "histoire", deteste: "rarete",
  },
  eloi: {
    quote: "« Des bêtes, des monstres, des créatures ! Vous en avez ? »",
    refus: "« Pas une seule bête ? Même pas un petit monstre ? »",
    indice: "« Elle a déjà mangé quelqu'un ? Racontez ! »",
    ok: "« Ouah ! Je vous en donne plus, alors ! »",
    ko: "« C'est tout ? Un prix, c'est ennuyeux. Je donne moins. »",
    merci: "« Je vais la montrer à tout le monde ! »",
    prefere: "histoire", deteste: "ferme",
  },
  conservateur: {
    quote: "« Une collection n'a de valeur que lorsqu'elle raconte quelque chose de complet. »",
    refus: "« Rien qui mérite les Archives aujourd'hui. »",
    indice: "« Racontez-moi d'où elle vient. Une pièce sans histoire ne m'est rien. »",
    ok: "« Voilà une pièce digne des Archives. »",
    ko: "« Je connais sa cote, merci. Mon offre baisse. »",
    merci: "« Les Archives royales vous remercient. »",
    prefere: "histoire", deteste: "ferme",
  },
};

/** Ce qu'il dit quand son quota du jour est atteint. */
export const FIN_DE_JOURNEE = "« J'ai fait ma journée. Revenez demain ! »";

/** Une réplique de l'acheteur, province de Gaspard comprise. */
export const replique = (acheteur, cle) => {
  const v = VOIX[acheteur.id]?.[cle] || acheteur.quote || "";
  return v.replace("{province}", acheteur.province?.nom || "la côte");
};

/**
 * La chance d'un marchandage selon la manière choisie. Bien présentée, la
 * carte convainc presque toujours ; mal présentée, presque jamais ; sans
 * conviction particulière, c'est le tempérament de l'acheteur qui joue.
 * Le pire cas des garde-fous suppose déjà un marchandage réussi : mieux
 * réussir ne peut pas faire du Comptoir une machine à pièces d'or.
 */
export function chanceDe(acheteur, maniere) {
  const v = VOIX[acheteur.id] || {};
  if (maniere === v.prefere) return Math.min(0.9, Math.max(0.8, acheteur.chance + 0.25));
  if (maniere === v.deteste) return Math.max(0.1, acheteur.chance * 0.35);
  return acheteur.chance;
}
