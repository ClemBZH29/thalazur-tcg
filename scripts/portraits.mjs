#!/usr/bin/env node
/**
 * Prépare les portraits des cartes pour la publication.
 *
 *   npm run portraits                    source par défaut : ../Base Image
 *   npm run portraits -- "D:/Illus"      autre dossier source
 *
 * ── La source ─────────────────────────────────────────────────────────────
 * Un sous-dossier par extension, nommé par son identifiant, plus `pj/` pour
 * les personnages joueurs, communs à toutes :
 *
 *   Base Image/
 *     troupe-valeran/  073-Scarabée des ruines.png   (numéro en tête du nom)
 *                      fa-vyrin.png                  (full art : fa-<nom>)
 *     pj/              pj-<nom>.png
 *
 * Le numéro suffit ; le texte qui suit est libre (nom de la carte, description
 * du prompt…). S'il est le nom d'une autre carte, le script prévient : c'est
 * le signe d'une illustration rangée sous le mauvais numéro. PNG, JPEG ou WebP, au
 * format 2:3 de préférence : la carte recadre, mais une image trop large
 * perd ses bords.
 *
 * ── La sortie ─────────────────────────────────────────────────────────────
 * `public/portraits/` (ignoré par Git), qui est aussi le dossier publié par
 * `npm run portraits:publier` sur le site Firebase des portraits :
 *
 *   <dossier>/<num>.webp     720 × 1080, carte en grand
 *   <dossier>/<num>-v.webp   360 × 540, vignette de bibliothèque
 *   inventaire.json          ce qui existe, avec une empreinte par image,
 *                            et les points focaux forcés
 *
 * ── Le cadrage ────────────────────────────────────────────────────────────
 * La fenêtre d'art du cadre standard est presque carrée : elle ne garde
 * qu'environ 72 % de la hauteur d'une image 2:3. Le point focal (0 = le haut
 * de l'image, 100 = le bas) dit quelle bande est gardée : 30 % pour toutes
 * les cartes, sauf celles forcées dans `<extension>/cadrages.json`, à côté
 * des images :
 *
 *   { "164": 5 }                 la carte 164 montre le haut de son image
 *
 * Un calcul automatique par zone saillante a été essayé et retiré : il
 * poussait la plupart des images aux extrêmes (0 ou 100) et cadrait moins
 * bien que la valeur fixe. Voir docs/conception/roster-et-portraits.md.
 *
 * Le dossier est reconstruit à l'identique de la source : une image retirée
 * de la source disparaît aussi de la publication. Une image inchangée n'est
 * pas réencodée.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SORTIE = join(RACINE, "public", "portraits");
const EXTENSIONS_IMAGE = new Set([".png", ".jpg", ".jpeg", ".webp"]);

/** Tailles de sortie : la carte en grand, et la moitié pour les vignettes. */
export const TAILLES = [
  { suffixe: "", largeur: 720, hauteur: 1080, qualite: 80 },
  { suffixe: "-v", largeur: 360, hauteur: 540, qualite: 75 },
];

/**
 * Les cadrages forcés d'un dossier : `{ "164": 5 }`, clés au numéro de carte
 * (« 164 » ou « 0164 », peu importe), valeurs de 0 à 100.
 */
export function lireCadrages(texte) {
  const brut = JSON.parse(texte);
  const cadrages = new Map();
  const rejets = [];
  for (const [cle, valeur] of Object.entries(brut ?? {})) {
    const num = Number(cle);
    if (!Number.isInteger(num) || typeof valeur !== "number" || valeur < 0 || valeur > 100) {
      rejets.push(`${cle}: ${JSON.stringify(valeur)}`);
      continue;
    }
    cadrages.set(num, Math.round(valeur));
  }
  return { cadrages, rejets };
}

/** Même translittération que src/lib/roster.js, pour comparer les noms. */
export const slug = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Ce qu'un nom de fichier désigne.
 *   « 073-Scarabée des ruines.png » → { num: 73, nom: "scarabee-des-ruines" }
 *   « fa-vyrin.png »                → { special: "fa-vyrin" }
 *   « ChatGPT Image….png »          → null
 */
export function identifier(nomFichier) {
  const tige = nomFichier.slice(0, nomFichier.length - extname(nomFichier).length).trim();
  const special = tige.match(/^(fa|pj)-(.+)$/i);
  if (special) return { special: `${special[1].toLowerCase()}-${slug(special[2])}` };
  const m = tige.match(/^(\d+)\s*[-_ .]?\s*(.*)$/);
  if (!m) return null;
  return { num: Number(m[1]), nom: slug(m[2]) };
}

/** Les cartes d'une extension, indexées par numéro (celui du roster, « 073 »). */
function lireRoster(id) {
  const chemin = join(RACINE, "src", "extensions", id, "roster.json");
  if (!existsSync(chemin)) return null;
  const { lignes } = JSON.parse(readFileSync(chemin, "utf8"));
  const parNum = new Map();
  for (const l of lignes) parNum.set(Number(l[0]), { num: String(l[0]), nom: String(l[1] ?? "") });
  return parNum;
}

/** La carte du roster dont le nom translittéré est `nom`, s'il y en a une. */
export function carteNommee(roster, nom) {
  for (const carte of roster?.values() ?? []) if (slug(carte.nom) === nom) return carte;
  return null;
}

const empreinte = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 10);

async function principal(source) {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("sharp est introuvable : lancer « npm install » une fois, puis recommencer.");
    process.exit(1);
  }
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    console.error(`Dossier source introuvable : ${source}`);
    process.exit(1);
  }

  const extensionsConnues = new Set(readdirSync(join(RACINE, "src", "extensions"), { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name));

  const avertissements = [];
  const inventaire = { genere: new Date().toISOString(), portraits: {} };
  const attendus = new Set();
  let encodees = 0;

  for (const entree of readdirSync(source, { withFileTypes: true })) {
    if (entree.isFile() && EXTENSIONS_IMAGE.has(extname(entree.name).toLowerCase())) {
      avertissements.push(`ignorée, hors de tout dossier d'extension : ${entree.name}`);
    }
  }

  const dossiers = readdirSync(source, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const d of dossiers) {
    const dossier = d.name;
    if (dossier !== "pj" && !extensionsConnues.has(dossier)) {
      avertissements.push(`dossier ignoré, aucune extension « ${dossier} » dans src/extensions/`);
      continue;
    }
    const roster = dossier === "pj" ? null : lireRoster(dossier);
    const vus = new Map();
    let cadrages = new Map();
    const cheminCadrages = join(source, dossier, "cadrages.json");
    if (existsSync(cheminCadrages)) {
      try {
        const lu = lireCadrages(readFileSync(cheminCadrages, "utf8"));
        cadrages = lu.cadrages;
        for (const r of lu.rejets) avertissements.push(`${dossier}/cadrages.json : « ${r} » ignoré, valeur attendue de 0 à 100`);
      } catch (e) {
        avertissements.push(`${dossier}/cadrages.json illisible, ignoré : ${e.message}`);
      }
    }
    const cadragesUtilises = new Set();

    for (const f of readdirSync(join(source, dossier)).sort()) {
      if (!EXTENSIONS_IMAGE.has(extname(f).toLowerCase())) continue;
      const id = identifier(f);
      if (!id) {
        avertissements.push(`${dossier}/${f} : pas de numéro en tête du nom, ignorée`);
        continue;
      }
      let num;
      if (id.special) {
        num = id.special;
        if ((dossier === "pj") !== num.startsWith("pj-")) {
          avertissements.push(`${dossier}/${f} : les PJ vont dans pj/, les full art dans leur extension — ignorée`);
          continue;
        }
      } else {
        const carte = roster?.get(id.num);
        if (roster && !carte) {
          avertissements.push(`${dossier}/${f} : aucune carte n° ${id.num} dans le roster, ignorée`);
          continue;
        }
        num = carte ? carte.num : String(id.num).padStart(3, "0");
        // Le texte qui suit le numéro est libre (nom de la carte, description
        // du prompt…) : on ne prévient que s'il désigne une AUTRE carte, signe
        // d'un numéro décalé, plutôt que d'avertir à chaque fichier.
        const autre = carte && id.nom && id.nom !== slug(carte.nom) ? carteNommee(roster, id.nom) : null;
        if (autre) {
          avertissements.push(`${dossier}/${f} : ce nom est celui de la carte n° ${autre.num} « ${autre.nom} », pas de la n° ${carte.num} — publiée quand même, vérifier le numéro`);
        }
      }
      if (vus.has(num)) {
        avertissements.push(`${dossier}/${f} : n° ${num} déjà fourni par ${vus.get(num)}, ignorée`);
        continue;
      }
      vus.set(num, f);

      const chemin = join(source, dossier, f);
      const tampon = readFileSync(chemin);
      const cible = join(SORTIE, dossier);
      mkdirSync(cible, { recursive: true });
      const sorties = TAILLES.map((t) => join(cible, `${num}${t.suffixe}.webp`));
      sorties.forEach((s) => attendus.add(s));

      // Réencoder seulement ce qui a changé : l'empreinte de la source est
      // gardée dans l'inventaire précédent.
      const signatureSource = empreinte(tampon);
      const aJour = sorties.every((s) => existsSync(s)) && precedent()?.sources?.[dossier]?.[num] === signatureSource;
      if (!aJour) {
        for (const [i, t] of TAILLES.entries()) {
          await sharp(tampon)
            .rotate()
            .resize(t.largeur, t.hauteur, { fit: "cover", position: "centre" })
            .webp({ quality: t.qualite, effort: 6 })
            .toFile(sorties[i]);
        }
        encodees++;
      }
      inventaire.portraits[dossier] ??= {};
      inventaire.portraits[dossier][num] = empreinte(readFileSync(sorties[0]));
      // Seuls les cadrages forcés sont publiés ; les autres cartes gardent
      // le réglage général. Full art et PJ : fenêtre au format de l'image.
      const force = id.special ? undefined : cadrages.get(Number(num));
      if (force !== undefined) {
        cadragesUtilises.add(Number(num));
        inventaire.focal ??= {};
        inventaire.focal[dossier] ??= {};
        inventaire.focal[dossier][num] = force;
      }
      inventaire.sources ??= {};
      inventaire.sources[dossier] ??= {};
      inventaire.sources[dossier][num] = signatureSource;
    }
    for (const num of cadrages.keys()) {
      if (!cadragesUtilises.has(num)) avertissements.push(`${dossier}/cadrages.json : aucune image pour la carte n° ${num}, cadrage inutilisé`);
    }
  }

  // Ce qui n'est plus dans la source ne doit pas rester en ligne.
  let retirees = 0;
  if (existsSync(SORTIE)) {
    for (const d of readdirSync(SORTIE, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      for (const f of readdirSync(join(SORTIE, d.name))) {
        const p = join(SORTIE, d.name, f);
        if (!attendus.has(p)) { rmSync(p); retirees++; }
      }
      if (readdirSync(join(SORTIE, d.name)).length === 0) rmSync(join(SORTIE, d.name), { recursive: true });
    }
  }

  mkdirSync(SORTIE, { recursive: true });
  writeFileSync(join(SORTIE, "inventaire.json"), JSON.stringify(inventaire, null, 1) + "\n");

  const total = Object.values(inventaire.portraits).reduce((n, o) => n + Object.keys(o).length, 0);
  console.log(`${total} portrait(s) dans ${relative(RACINE, SORTIE)} — ${encodees} encodé(s), ${retirees} fichier(s) retiré(s)`);
  for (const [dossier, o] of Object.entries(inventaire.portraits)) {
    const taille = lireRoster(dossier)?.size;
    console.log(`  ${dossier} : ${Object.keys(o).length}${taille ? ` / ${taille} cartes` : ""}`);
  }
  if (avertissements.length) {
    console.log(`\n${avertissements.length} avertissement(s) :`);
    for (const a of avertissements) console.log(`  · ${a}`);
  }
}

let _precedent;
function precedent() {
  if (_precedent === undefined) {
    try {
      _precedent = JSON.parse(readFileSync(join(SORTIE, "inventaire.json"), "utf8"));
    } catch {
      _precedent = null;
    }
  }
  return _precedent;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  await principal(resolve(process.argv[2] || join(RACINE, "..", "Base Image")));
}
