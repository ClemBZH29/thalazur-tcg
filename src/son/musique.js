// src/son/musique.js : thème orchestral du Donjon, trois arrangements synchronisés (carte, combat, gardien).
//
// Instruments : sélection de VSCO 2 Community Edition, Versilian Studios Chamber Orchestra 2 (Sam Gossner,
// Simon Dalzell, Elan Hickler). Licence CC0 1.0 Universal (domaine public), vérifiée le 06/10/2026 dans le
// fichier LICENSE du dépôt https://github.com/sgossner/VSCO-2-CE. Échantillons convertis en WAV mono
// 22 050 Hz 16 bits (outils/convertir-vsco.js), servis par le site depuis son/orchestre/ (4,2 Mo).

// ---------- Le seul réglage de source ----------
// 'echantillons' (défaut) : le thème est joué note à note avec les échantillons ci-dessous.
// 'fichier' : trois boucles pré-mixées de même longueur, lues en parallèle et synchronisées.
export const SOURCE_MUSIQUE = 'echantillons';
export const DOSSIER = 'son/orchestre/';
export const FICHIERS = {
  carte: { url: 'son/donjon-carte.m4a', loopStart: 0, loopEnd: null },
  combat: { url: 'son/donjon-combat.m4a', loopStart: 0, loopEnd: null },
  gardien: { url: 'son/donjon-gardien.m4a', loopStart: 0, loopEnd: null }
};

export const BPM = 96, MESURES = 16, TEMPS = MESURES * 4, FONDU_MESURES = 2;

// ---------- Instruments : [hauteur MIDI de l'échantillon, fichier] ; les autres notes par transposition ----------
const serie = (nom, hauteurs) => hauteurs.map(h => [h, `${nom}-${h}`]);
export const INSTRUMENTS = {
  violonsTenu: { ech: serie('violons-tenu', [55, 62, 69, 76]), gain: .42, pan: -.3, attaque: .12, relache: .5 },
  violoncellesTenu: { ech: serie('violoncelles-tenu', [43, 50, 57]), gain: .5, pan: .3, attaque: .1, relache: .5 },
  violonsStac: { ech: serie('violons-stac', [55, 62, 69, 76]), gain: .3, pan: -.3 },
  violoncellesStac: { ech: serie('violoncelles-stac', [43, 50, 57]), gain: .38, pan: .3 },
  violonsPizz: { ech: serie('violons-pizz', [62, 69]), gain: .32, pan: -.25 },
  violoncellesPizz: { ech: serie('violoncelles-pizz', [43, 50, 57]), gain: .5, pan: .25 },
  harpe: { ech: serie('harpe', [38, 45, 52, 62, 65, 69, 72]), gain: .5, pan: -.15 },
  piano: { ech: serie('piano', [61, 65, 69, 73, 77, 81]), gain: .55, pan: .1, relache: .45 },
  flute: { ech: serie('flute', [60, 64, 69, 72, 76, 81]), gain: .42, pan: .2, attaque: .04, relache: .3 },
  cor: { ech: serie('cor', [46, 50, 53, 57, 60, 74]), gain: .5, pan: -.05, attaque: .05, relache: .4 },
  // hauteurs des timbales mesurées par autocorrélation sur les échantillons
  timbale: { ech: [[29.7, 'timbale-1'], [37.3, 'timbale-3'], [42.6, 'timbale-5']], gain: .75, pan: 0 },
  caisse: { ech: [[0, 'caisse-ppp'], [0, 'caisse-pp'], [0, 'caisse-mp']], gain: .2, pan: .15, lointain: 1700 },
  tom: { ech: [[0, 'tom-grave'], [0, 'tom-grave-f'], [0, 'tom-aigu']], gain: .45, pan: -.1 }
};

const HUMAIN = { decalage: .008, serre: .004, force: [.85, .3] }; // ±8 ms (±4 ms pour l'ostinato), force 0,85 à 1,15

// ---------- Harmonie : un accord par mesure (15 et 16 : suspension puis résolution) ----------
const ACCORDS = {
  Dm: { basse: 50, voix: [57, 62, 65] }, Bb: { basse: 46, voix: [58, 62, 65] }, F: { basse: 41, voix: [57, 60, 65] },
  C: { basse: 48, voix: [55, 60, 64] }, Gm: { basse: 43, voix: [55, 58, 62] }, G: { basse: 43, voix: [55, 59, 62] },
  Asus4: { basse: 45, voix: [57, 62, 64] }, A: { basse: 45, voix: [57, 61, 64] }, Dsus4: { basse: 50, voix: [57, 62, 67] }
};
// Question : i VI III VII | iv VI Vsus4 V — Réponse : i VI III VII | iv IV(majeur emprunté) Vsus4→V isus4→i
export const GRILLE = [['Dm'], ['Bb'], ['F'], ['C'], ['Gm'], ['Bb'], ['Asus4'], ['A'],
  ['Dm'], ['Bb'], ['F'], ['C'], ['Gm'], ['G'], ['Asus4', 'A'], ['Dsus4', 'Dm']];

// ---------- Mélodie : [temps, MIDI, durée en temps]. Motif : quarte ascendante la–ré ; sommet ré5 mesure 6 ;
// chaque saut suivi d'un pas en sens inverse ; tessiture la3–ré5 (une octave et une quarte).
export const MELODIE = [
  [0, 57, 1], [1, 62, 1.5], [2.5, 60, .5], [3, 62, 1],
  [4, 65, 2], [6, 64, 1], [7, 62, 1],
  [8, 60, 1.5], [9.5, 62, .5], [10, 65, 1.5], [11.5, 64, .5],
  [12, 67, 2], [14, 65, 1], [15, 64, 1],
  [16, 62, 1], [17, 67, 2], [19, 65, 1],
  [20, 70, 1], [21, 69, .5], [21.5, 70, .5], [22, 74, 6],       // sommet, tenu sur Vsus4
  [28, 73, 2], [30, 71, 1], [31, 69, 1],                         // la suspension se résout (do♯)
  [32, 69, 1], [33, 74, 1.5], [34.5, 72, .5], [35, 74, 1],       // réponse : le motif à l'octave
  [36, 70, 1.5], [37.5, 72, .5], [38, 70, 1], [39, 69, 1],
  [40, 65, 2], [42, 67, 1], [43, 69, 1],
  [44, 67, 1.5], [45.5, 64, .5], [46, 65, 1], [47, 67, 1],
  [48, 70, 2], [50, 69, 1], [51, 67, 1],
  [52, 71, 2], [54, 69, 1], [55, 71, 1],                         // si naturel du IV emprunté
  [56, 74, 2], [58, 73, 1.5], [59.5, 71, .5],
  [60, 69, 1], [61, 67, .5], [61.5, 65, .5], [62, 64, .5], [62.5, 62, .5], [63, 60, .5], [63.5, 58, .5]   // descente conjointe vers le la de reprise
];

// ---------- Les trois arrangements, générés depuis la grille : [temps, groupe, instrument, MIDI, durée, force, variante] ----------
function arranger() {
  const ev = [];
  const add = (b, g, inst, m, d, f, v) => ev.push([b, g, inst, m, d, f, v]);
  GRILLE.forEach((segs, mesure) => {
    const b = mesure * 4, len = 4 / segs.length;
    segs.forEach((nom, k) => {
      const A = ACCORDS[nom], s0 = b + k * len, [v0, v1, v2] = A.voix;
      // Carte : cordes tenues, harpe en arpèges, pizz de violoncelles en demi-tempo
      A.voix.forEach(v => add(s0, 'carte', 'violonsTenu', v, len, .7));
      add(s0, 'carte', 'violoncellesPizz', A.basse, null, .8);
      if (len === 4) add(s0 + 2, 'carte', 'violoncellesPizz', A.basse, null, .5);
      const hb = A.basse - 12 >= 36 ? A.basse - 12 : A.basse, tons = [hb, v0, v1, v2, v0 + 12];
      (len === 4 ? [0, 1, 2, 3, 4, 3, 2, 1] : [0, 1, 2, 3]).forEach((ix, i) => add(s0 + i * .5, 'carte', 'harpe', tons[ix], null, i ? .55 : .85));
      if (mesure >= 8) { add(s0 + 1, 'carte', 'violonsPizz', v2, null, .45); if (len === 4) add(s0 + 3, 'carte', 'violonsPizz', v1 + 12 > 72 ? v1 : v1 + 12, null, .35); }
      // Combat : ostinato de violons en doubles croches (accents 3+3+2), violoncelles en croches, accents staccato, timbales
      const pat = [0, 1, 2, 1];
      for (let i = 0; i < len * 4; i++) add(s0 + i * .25, 'combat', 'violonsStac', A.voix[pat[i % 4]], null, i % 16 === 0 || i % 16 === 6 || i % 16 === 12 ? .9 : .45);
      for (let i = 0; i < len * 2; i++) add(s0 + i * .5, 'combat', 'violoncellesStac', A.basse, null, i % 4 === 0 ? 1 : .6);
      [0, len === 4 ? 2.5 : null].forEach(o => { if (o !== null) [A.basse, ...A.voix].forEach(v => add(s0 + o, 'combat', v < 52 ? 'violoncellesStac' : 'violonsStac', v, null, 1)); });
      const tb = 36 + ((A.basse - 36) % 12 + 12) % 12;
      add(s0, 'combat', 'timbale', tb, null, 1); if (len === 4) add(s0 + 2, 'combat', 'timbale', tb, null, .65);
      // Gardien : cordes graves à l'octave, timbales doublées
      add(s0, 'gardien', 'violoncellesTenu', A.basse, len, .85);
      add(s0, 'gardien', 'violonsTenu', A.basse + 12, len, .6);
      [1, 3, 3.5].filter(o => o < len).forEach(o => add(s0 + o, 'gardien', 'timbale', tb, null, o === 3.5 ? .55 : .8));
    });
    // Carte : caisse claire lointaine, marche en demi-tempo
    add(b, 'carte', 'caisse', null, null, .6, 0); add(b + 2, 'carte', 'caisse', null, null, 1, 1);
    add(b + 3.5, 'carte', 'caisse', null, null, .5, 0); add(b + 3.75, 'carte', 'caisse', null, null, .45, 0);
    // Combat : toms, avec relance en fin de phrase
    add(b + 1.5, 'combat', 'tom', null, null, .6, 0); add(b + 2.75, 'combat', 'tom', null, null, .5, 2);
    add(b + 3, 'combat', 'tom', null, null, .7, 0); add(b + 3.5, 'combat', 'tom', null, null, .8, 1);
    if (mesure % 8 === 7) { add(b + 3.25, 'combat', 'tom', null, null, .6, 2); add(b + 3.75, 'combat', 'tom', null, null, .75, 2); }
  });
  for (const [b, m, d] of MELODIE) {
    add(b, 'carte', 'melodieCarte', m, d, .8);   // piano, puis reprise à la flûte au passage suivant
    add(b, 'combat', 'cor', m - 12, d, .85);    // le cor à l'octave grave
    add(b, 'gardien', 'cor', m, d, .7);         // cor plus présent : doublure à l'octave
  }
  return ev.sort((a, b) => a[0] - b[0]);
}
export const EVENEMENTS = arranger();

// ---------- Réponse de caverne générée (inchangée) ----------
function caverne(ctx, duree = 4.4) {
  const sr = ctx.sampleRate, n = Math.floor(sr * duree), pre = Math.floor(.024 * sr), ir = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let k = 0; k < 16; k++) d[pre + Math.floor(Math.random() * .1 * sr)] += (Math.random() * 2 - 1) * .7 * (1 - k / 16);
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr, alpha = .5 - .44 * Math.min(1, t / 2.5);
      lp += alpha * ((Math.random() * 2 - 1) - lp);
      d[i] += lp * Math.exp(-t * 1.6) * Math.min(1, t / .07) / Math.sqrt(alpha) * .5;
    }
    for (let i = n - Math.floor(.2 * sr); i < n; i++) d[i] *= (n - i) / (.2 * sr);
  }
  return ir;
}

// ---------- Fabrique ----------
export function creerMusique(ctx, sortie, { source = SOURCE_MUSIQUE, dossier = DOSSIER } = {}) {
  const comp = ctx.createDynamicsCompressor(); // compresseur inchangé
  comp.threshold.value = -22; comp.ratio.value = 2.5; comp.knee.value = 18; comp.attack.value = .02; comp.release.value = .4;
  const pbGeneral = ctx.createBiquadFilter(); pbGeneral.type = 'lowpass'; pbGeneral.frequency.value = 5500; pbGeneral.Q.value = .5;
  comp.connect(pbGeneral); pbGeneral.connect(sortie);
  const mix = ctx.createGain(); mix.gain.value = .9; mix.connect(comp);
  const reverb = ctx.createConvolver(); reverb.buffer = caverne(ctx);
  const envoi = ctx.createGain(); envoi.gain.value = .42; const retour = ctx.createGain(); retour.gain.value = .7;
  mix.connect(envoi); envoi.connect(reverb); reverb.connect(retour); retour.connect(comp);

  const groupes = {};
  for (const g of ['carte', 'combat', 'gardien']) { groupes[g] = ctx.createGain(); groupes[g].gain.value = 0; groupes[g].connect(mix); }
  const CIBLES = { carte: { carte: 1, combat: 0, gardien: 0 }, combat: { carte: 0, combat: 1, gardien: 0 }, gardien: { carte: 0, combat: 1, gardien: 1 } };

  // --- Chargement unique, à la première entrée dans le Donjon ---
  const tampons = {}; let chargement = null, pret = false;
  function decoder(ab) { return new Promise((ok, ko) => { const p = ctx.decodeAudioData(ab, ok, ko); if (p && p.then) p.then(ok, ko); }); }
  function precharger() {
    if (chargement) return chargement;
    const noms = [...new Set(Object.values(INSTRUMENTS).flatMap(I => I.ech.map(e => e[1])))];
    chargement = Promise.all(noms.map(async nom => {
      try {
        const url = new URL(dossier + nom + '.wav', document.baseURI);
        if (url.origin !== location.origin) throw new Error('hors du site');
        const rep = await fetch(url); if (!rep.ok) throw new Error('HTTP ' + rep.status);
        tampons[nom] = await decoder(await rep.arrayBuffer());
      } catch (e) { console.warn('Échantillon « ' + nom + ' » indisponible : ' + e.message); }
    })).then(() => { pret = true; });
    return chargement;
  }

  // --- Lecture d'une note ---
  const sorties = new Map();
  function sortieInstrument(inst, groupe) {
    const cle = inst + ':' + groupe;
    if (sorties.has(cle)) return sorties.get(cle);
    const I = INSTRUMENTS[inst], p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (p.pan) p.pan.value = I.pan;
    let entree = p;
    if (I.lointain) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = I.lointain; lp.connect(p); entree = lp; }
    p.connect(groupes[groupe]); sorties.set(cle, entree);
    return entree;
  }
  function note(inst, m, t, duree, force, groupe, variante) {
    const I = INSTRUMENTS[inst];
    let ref, nom;
    if (m == null) [ref, nom] = I.ech[Math.min(I.ech.length - 1, variante || 0)];
    else [ref, nom] = I.ech.reduce((a, e) => Math.abs(e[0] - m) < Math.abs(a[0] - m) ? e : a);
    const buf = tampons[nom]; if (!buf) return;
    const src = ctx.createBufferSource(), g = ctx.createGain(), v = I.gain * force, a = I.attaque || .004;
    src.buffer = buf; src.playbackRate.value = (m == null ? 1 : Math.pow(2, (m - ref) / 12)) * (1 + (Math.random() - .5) * .002);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a);
    if (duree && I.relache) {
      g.gain.setValueAtTime(v, t + Math.max(a, duree)); g.gain.linearRampToValueAtTime(0, t + duree + I.relache);
      src.start(t); src.stop(t + duree + I.relache + .05); // start avant stop : sinon InvalidStateError
    } else src.start(t);
    src.connect(g); g.connect(sortieInstrument(inst, groupe));
  }

  // --- Séquenceur unique : les trois arrangements partagent la même horloge ---
  const spb = 60 / BPM;
  let t0 = 0, i = 0, n = 0, dyn = 1, timer = null, actif = null;
  function planifier() {
    const now = ctx.currentTime, lim = now + .2;
    for (let k = 0; k < 400; k++) {
      const e = EVENEMENTS[i], t = t0 + e[0] * spb;
      if (t > lim) break;
      const [b, g, inst0, m, d, f, v] = e;
      const audible = groupes[g].gain.value > .001 || (actif && CIBLES[actif][g] > 0);
      if (audible && t >= now - .02) {
        const inst = inst0 === 'melodieCarte' ? (n % 2 ? 'flute' : 'piano') : inst0;
        const serre = inst === 'violonsStac' || inst === 'violoncellesStac';
        const tt = Math.max(now + .005, t + (Math.random() + Math.random() - 1) * (serre ? HUMAIN.serre : HUMAIN.decalage));
        const force = f * dyn * (HUMAIN.force[0] + Math.random() * HUMAIN.force[1]);
        note(inst, m, tt, d ? d * spb : null, force, g, v);
      }
      if (++i >= EVENEMENTS.length) { i = 0; n++; t0 += TEMPS * spb; dyn = .92 + Math.random() * .14; }
    }
  }
  // Bascule au temps suivant, fondu de deux mesures : les arrangements restent alignés
  function basculer(cible, delai) {
    const now = ctx.currentTime, pos = (now - t0) / spb, debut = t0 + Math.ceil(pos + delai / spb) * spb, F = FONDU_MESURES * 4 * spb;
    for (const g in groupes) {
      const p = groupes[g].gain, v = cible ? CIBLES[cible][g] : 0;
      p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); p.setValueAtTime(p.value, debut);
      p.linearRampToValueAtTime(v, debut + (cible ? F : 1.5));
    }
  }
  function jouerEchantillons(cible, { delai = 0 } = {}) {
    if (!cible) {
      if (!timer) return;
      basculer(null, delai); actif = null;
      setTimeout(() => { if (actif === null && timer) { clearInterval(timer); timer = null; } }, (delai + 2.5) * 1000);
      return;
    }
    actif = cible;
    precharger().then(() => {
      if (actif !== cible) return;
      if (!timer) {
        t0 = ctx.currentTime + .1; i = 0; n = 0;
        for (const g in groupes) { groupes[g].gain.cancelScheduledValues(0); groupes[g].gain.value = 0; }
        const p = groupes, c = CIBLES[cible];
        for (const g in p) { p[g].gain.setValueAtTime(0, t0); p[g].gain.linearRampToValueAtTime(c[g], t0 + 1.2); }
        timer = setInterval(planifier, 25);
      } else basculer(cible, delai);
    });
  }

  // --- Source fichier : trois boucles lancées ensemble, bouclage sans blanc ---
  const lectures = {}; let actifF = null;
  async function jouerFichiers(cible, { delai = 0 } = {}) {
    const now = ctx.currentTime;
    if (!cible) {
      for (const g in groupes) { const p = groupes[g].gain; p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); p.linearRampToValueAtTime(0, now + delai + 1.5); }
      actifF = null;
      setTimeout(() => { if (actifF) return; for (const k in lectures) { lectures[k].stop(); delete lectures[k]; } }, (delai + 2) * 1000);
      return;
    }
    actifF = cible;
    if (!lectures.carte) {
      const bufs = await Promise.all(Object.entries(FICHIERS).map(async ([k, spec]) => {
        try { const url = new URL(spec.url, document.baseURI); if (url.origin !== location.origin) throw new Error('hors du site'); return [k, await decoder(await (await fetch(url)).arrayBuffer())]; }
        catch (e) { console.warn('Boucle « ' + k + ' » indisponible : ' + e.message); return [k, null]; }
      }));
      if (actifF !== cible || lectures.carte) return;
      const t = ctx.currentTime + .1;
      for (const [k, b] of bufs) {
        if (!b) continue;
        const spec = FICHIERS[k], s = ctx.createBufferSource();
        s.buffer = b; s.loop = true; s.loopStart = spec.loopStart || 0; s.loopEnd = spec.loopEnd || b.duration;
        s.connect(groupes[k]); s.start(t); lectures[k] = s;
      }
    }
    const c = { carte: cible === 'carte' ? 1 : 0, combat: cible === 'combat' ? 1 : 0, gardien: cible === 'gardien' ? 1 : 0 }; // en fichier, gardien est une boucle complète
    const t = ctx.currentTime, F = FONDU_MESURES * 4 * spb;
    for (const g in groupes) { const p = groupes[g].gain; p.cancelScheduledValues(t); p.setValueAtTime(p.value, t + delai); p.linearRampToValueAtTime(c[g], t + delai + F); }
  }

  function jouer(cible, o) {
    try { (source === 'fichier' ? jouerFichiers : jouerEchantillons)(cible, o); } catch (e) { console.warn('Musique indisponible', e); }
  }
  function temoin() {
    precharger().then(() => {
      const t = ctx.currentTime + .05;
      MELODIE.slice(0, 4).forEach(([b, m, d]) => note('piano', m, t + b * spb, d * spb, .8, 'carte'));
      ACCORDS.Dm.voix.forEach(v => note('violonsTenu', v, t, 4 * spb, .6, 'carte'));
      const g = groupes.carte.gain; if (!timer) { g.cancelScheduledValues(t); g.setValueAtTime(1, t); g.setValueAtTime(1, t + 3); g.linearRampToValueAtTime(0, t + 3.6); }
    });
  }

  return { jouer, temoin, precharger, source, etage: () => {}, pret: () => pret, arreter: () => jouer(null) };
}
