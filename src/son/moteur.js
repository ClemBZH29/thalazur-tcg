/**
 * Le moteur du son du Donjon : contexte Web Audio, bus, réverbération,
 * bruitages (recettes de banque.js), brume, nappes de lieu, et la musique
 * orchestrale de musique.js branchée sur le bus musique.
 *
 * Tiré du prototype de Claude Design (son-ecoute.js), sans la musique
 * synthétisée qui y servait de point de comparaison : la musique ne vient
 * plus que de `creerMusique`. Les volumes sont des pourcentages (voir
 * `regler`). Rien ici ne doit faire tomber le jeu : si le contexte audio ne
 * se crée pas, tout devient muet.
 */
import { BANQUE, NAPPES, RARETE, demi, midi } from "./banque.js";
import { creerMusique } from "./musique.js";

export const SON_DEFAUT = { coupe: false, musique: 20, effets: 50 };

/** Un pourcentage borné (0 à 100), ramené au gain d'un bus. */
const gainDe = (pct, defaut) => Math.max(0, Math.min(100, Number.isFinite(+pct) ? +pct : defaut)) / 100;

export function creerMoteur({ dossier } = {}) {
  let ctx = null, maitre, busMus, busOrch, busFx, ducking, revFx, bruitBuf, orchestre = null;
  let vit = 1, derniereFrappe = -1, voix = [];
  let brumeN = null, nappeN = null;
  let reglage = { ...SON_DEFAUT };
  const stats = { ecartes: 0, coupes: 0, maxVoix: 0 };

  function construire() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3; comp.knee.value = 12; comp.attack.value = .01; comp.release.value = .25;
    const doux = ctx.createBiquadFilter(); doux.type = "lowpass"; doux.frequency.value = 9000; // pas d'aigus stridents
    maitre = ctx.createGain(); maitre.connect(comp); comp.connect(doux); doux.connect(ctx.destination);
    // Deux entrées musique, au même volume : la brume (busMus, réverbérée) et l'orchestre (busOrch, qui a sa propre caverne).
    ducking = ctx.createGain(); ducking.connect(maitre);
    busMus = ctx.createGain(); busMus.connect(ducking);
    busOrch = ctx.createGain(); busOrch.connect(ducking);
    busFx = ctx.createGain(); busFx.connect(maitre);
    // Réverbération de caverne : réponse impulsionnelle générée (bruit qui décroît)
    const reverb = ctx.createConvolver();
    const n = ctx.sampleRate * 2.8, ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    reverb.buffer = ir;
    const revSortie = ctx.createGain(); revSortie.gain.value = .5; reverb.connect(revSortie); revSortie.connect(maitre);
    revFx = ctx.createGain(); revFx.connect(reverb);
    const revMus = ctx.createGain(); revMus.gain.value = .35; busMus.connect(revMus); revMus.connect(reverb);
    bruitBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const b = bruitBuf.getChannelData(0); for (let i = 0; i < b.length; i++) b[i] = Math.random() * 2 - 1;
    try { orchestre = creerMusique(ctx, busOrch, dossier ? { dossier } : {}); } catch (e) { orchestre = null; console.warn("Musique indisponible", e); }
    appliquer(true);
    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
  }

  function assurer() {
    try { if (!ctx) construire(); if (ctx.state === "suspended" && !document.hidden) ctx.resume(); } catch (e) { ctx = null; }
    return !!ctx;
  }

  const borne = (f) => Math.min(18000, Math.max(20, f));
  function enveloppe(p, t, a, d, g, mode) {
    p.setValueAtTime(0, t); p.linearRampToValueAtTime(g, t + a);
    if (mode === "tenu") { p.setValueAtTime(g, t + a + (d - a) * .5); p.linearRampToValueAtTime(0, t + d); }
    else p.exponentialRampToValueAtTime(1e-4, t + d);
  }
  function vibrato(o, [vitesse, cents], t, fin) {
    const l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = vitesse; lg.gain.value = cents; l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(fin);
  }
  function developper(couches, densite = 1) {
    const out = [];
    for (const c of couches) {
      let liste = [c];
      if (c.seq) liste = c.seq.map(([s, dt]) => ({ ...c, seq: null, f: c.f * demi(s), f2: c.f2 ? c.f2 * demi(s) : null, t: c.t + dt }));
      if (c.rep) {
        const [n, dt, ap = 0, at = 0] = c.rep, N = Math.max(1, Math.round(n * densite));
        liste = liste.flatMap((x) => Array.from({ length: N }, (_, i) => {
          const j = demi((Math.random() * 2 - 1) * ap);
          return { ...x, rep: null, f: x.f * j, f2: x.f2 ? x.f2 * j : null, t: x.t + i * dt + Math.random() * dt * at };
        }));
      }
      out.push(...liste);
    }
    return out;
  }
  function jouerCouche(c, t0, sortie, P) {
    const t = t0 + c.t * P.d, d = Math.max(.02, c.d * P.d), a = Math.min(c.a ?? .004, d * .6);
    const g = Math.max(1e-4, c.g * P.g), f = c.f * P.p, f2 = c.f2 ? c.f2 * P.p : null, fin = t + d + .05;
    const vca = ctx.createGain(); vca.connect(sortie);
    if (c.k === "cloche") {
      vca.gain.setValueAtTime(g, t);
      (c.part || [[1, 1], [2, .35], [3.01, .18], [4.2, .08]]).forEach(([r, pg], i) => {
        const o = ctx.createOscillator(), pgN = ctx.createGain();
        o.frequency.value = borne(f * r); if (c.vib) vibrato(o, c.vib, t, fin);
        enveloppe(pgN.gain, t, .002, d / (1 + i * .7), pg);
        o.connect(pgN); pgN.connect(vca); o.start(t); o.stop(fin);
      });
      return fin;
    }
    enveloppe(vca.gain, t, a, d, g, c.env);
    if (c.k === "ton" || c.k === "corde") {
      const o = ctx.createOscillator(); o.type = c.forme || (c.k === "corde" ? "sawtooth" : "sine");
      o.frequency.setValueAtTime(borne(f), t); if (f2) o.frequency.exponentialRampToValueAtTime(borne(f2), t + d);
      if (c.vib) vibrato(o, c.vib, t, fin);
      let src = o;
      if (c.k === "corde" || c.pb) {
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
        if (c.k === "corde") { lp.Q.value = 1.2; lp.frequency.setValueAtTime(borne(f * (c.eclat || 8)), t); lp.frequency.exponentialRampToValueAtTime(borne(f * 1.3), t + d * .6); }
        else { lp.frequency.setValueAtTime(c.pb, t); if (c.pb2) lp.frequency.exponentialRampToValueAtTime(c.pb2, t + d); }
        o.connect(lp); src = lp;
      }
      src.connect(vca); o.start(t); o.stop(fin);
    } else if (c.k === "peau") {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(borne(f), t); o.frequency.exponentialRampToValueAtTime(borne(f2 || f * .5), t + Math.min(.15, d));
      o.connect(vca); o.start(t); o.stop(fin);
      const s = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), cg = ctx.createGain();
      s.buffer = bruitBuf; lp.type = "lowpass"; lp.frequency.value = 1500; enveloppe(cg.gain, t, .001, .015, g * .35);
      s.connect(lp); lp.connect(cg); cg.connect(sortie); s.start(t, Math.random()); s.stop(t + .05);
    } else if (c.k === "bruit") {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter();
      s.buffer = bruitBuf; s.loop = true; fl.type = c.filtre || "bandpass"; fl.Q.value = c.q ?? 1;
      fl.frequency.setValueAtTime(borne(f), t); if (f2) fl.frequency.exponentialRampToValueAtTime(borne(f2), t + d);
      s.connect(fl); fl.connect(vca); s.start(t, Math.random() * 1.5); s.stop(fin);
    }
    return fin;
  }
  function couper(v) {
    v.sortie.gain.setTargetAtTime(0, ctx.currentTime, .02);
    voix = voix.filter((x) => x !== v); stats.coupes++;
  }
  function baisserMusique(fin) {
    const now = ctx.currentTime, p = ducking.gain;
    p.cancelScheduledValues(now); p.setTargetAtTime(.55, now, .04); p.setTargetAtTime(1, fin, .35);
  }

  function jouer(id, o = {}) {
    if (!assurer()) return 0;
    const r = BANQUE[id];
    if (!r) { console.warn("Son inconnu :", id); return 0; }
    if (r.special === "brume") return brume(o.tour), 0;
    if (r.nappe) return nappe(o.arret ? null : r.nappe), 0;
    const now = ctx.currentTime;
    if (id === "donjon.combat.frappe") {
      if (now - derniereFrappe < .08) { stats.ecartes++; return 0; } // deux frappes à moins de 80 ms n'en font qu'une
      derniereFrappe = now;
    }
    voix = voix.filter((v) => v.fin > now);
    const max = vit === 4 ? 8 : 16;
    if (voix.length >= max) {
      const victime = voix.filter((v) => v.prio < r.prio).sort((a, b) => a.prio - b.prio)[0];
      if (victime) couper(victime);
      else if (r.prio < 3) { stats.ecartes++; return 0; } // jamais de coupure pour une chute ou un gain
    }
    const echelle = (vit === 4 ? .5 : vit === 2 ? .75 : 1) * (o.dureeX || 1);
    const va = r.chaud ? 0 : 1; // les gains ne varient pas : ils doivent rester identiques
    const P = { p: demi(o.tr || 0) * (1 + va * (Math.random() * .1 - .05)), d: echelle * (1 + va * (Math.random() * .2 - .1)), g: o.gainX || 1 };
    if (o.camp === "adverse") P.p *= demi(-5);
    let couches = [...r.couches];
    if (r.rarete) {
      couches = couches.concat(RARETE[o.rarete || "commune"] || []);
      if (o.rainbow) couches = couches.concat(RARETE.rainbow).map((c) => ({ vib: [3, 14], ...c }));
    }
    if (o.plus) couches = couches.concat(o.plus);
    const sortie = ctx.createGain(); let dest = sortie;
    if (o.camp === "adverse") {
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1300; f.Q.value = .5;
      sortie.connect(f); dest = f;
    }
    dest.connect(busFx);
    const envoi = ctx.createGain(); envoi.gain.value = (r.rev || 0) * (o.revX || 1) * .6; dest.connect(envoi); envoi.connect(revFx);
    const t0 = now + .01; let fin = now;
    for (const c of developper(couches, o.densite || 1)) fin = Math.max(fin, jouerCouche(c, t0, sortie, P));
    voix.push({ fin, prio: r.prio, sortie });
    stats.maxVoix = Math.max(stats.maxVoix, voix.length);
    if (r.duck) baisserMusique(fin);
    return fin - now;
  }

  // Brume : nappe grave sous la musique, un demi-ton plus haut à chaque tour après le dixième
  function brume(tour) {
    if (!assurer()) return;
    const now = ctx.currentTime;
    if (!tour) {
      if (brumeN) { const b = brumeN; brumeN = null; b.g.gain.setTargetAtTime(0, now, .4); setTimeout(() => b.oscs.forEach((o) => o.stop()), 2500); }
      return;
    }
    const f = midi(38 + (tour - 10));
    if (!brumeN) {
      const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 300; g.gain.value = 0;
      const oscs = [0, 7].map((det) => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.detune.value = det; o.frequency.value = f; o.connect(lp); o.start(); return o; });
      lp.connect(g); g.connect(busMus); g.gain.setTargetAtTime(.1, now, .6);
      brumeN = { g, oscs };
    }
    brumeN.oscs.forEach((o) => o.frequency.setTargetAtTime(f, now, .25));
  }

  // Nappe de lieu
  function nappe(milieu) {
    if (!assurer()) return;
    const now = ctx.currentTime;
    if (nappeN) {
      const n = nappeN; nappeN = null; n.actif = false;
      n.g.gain.setTargetAtTime(0, now, .4); setTimeout(() => n.sources.forEach((s) => { try { s.stop(); } catch { /* déjà arrêtée */ } }), 2500);
    }
    if (!milieu || !NAPPES[milieu]) return;
    const def = NAPPES[milieu], g = ctx.createGain(); g.gain.value = 0;
    g.connect(busFx); const envoi = ctx.createGain(); envoi.gain.value = milieu === "souterrain" ? .9 : .5; g.connect(envoi); envoi.connect(revFx);
    g.gain.setTargetAtTime(1, now, .5);
    const n = { g, sources: [], actif: true };
    for (const b of def.bruits) {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), bg = ctx.createGain();
      s.buffer = bruitBuf; s.loop = true; fl.type = b.filtre; fl.frequency.value = b.f; fl.Q.value = b.q ?? .7; bg.gain.value = b.g;
      s.connect(fl); fl.connect(bg); bg.connect(g); s.start(now, Math.random()); n.sources.push(s);
      if (b.lfo) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = b.lfo[0]; lg.gain.value = b.lfo[1]; l.connect(lg); lg.connect(fl.frequency); l.start(); n.sources.push(l); }
      if (b.lfoG) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = b.lfoG[0]; lg.gain.value = b.lfoG[1]; l.connect(lg); lg.connect(bg.gain); l.start(); n.sources.push(l); }
    }
    const ponctuer = (spec, couche) => {
      const suite = () => {
        if (!n.actif) return;
        const r = .8 + Math.random() * .5;
        jouerCouche(couche(spec, r), ctx.currentTime + .01, g, { p: 1, d: 1, g: 1 });
        setTimeout(suite, (spec.int[0] + Math.random() * (spec.int[1] - spec.int[0])) * 1000);
      };
      setTimeout(suite, spec.int[0] * 1000);
    };
    if (def.gouttes) ponctuer(def.gouttes, (s, r) => ({ k: "ton", forme: "sine", f: s.f * r, f2: s.f * r * 1.6, t: 0, d: .08, a: .002, g: s.g }));
    if (def.cloche) ponctuer(def.cloche, (s) => ({ k: "cloche", f: s.f, t: 0, d: 3, g: s.g, part: [[1, 1], [2.4, .3], [3.9, .1]] }));
    nappeN = n;
  }

  /**
   * Les volumes en pourcentage : gain du bus = pourcentage / 100. La
   * réverbération des effets suit le bus effets. La coupure générale passe
   * par le maître. Sans contexte, le réglage attend sa création.
   */
  function appliquer(immediat = false) {
    if (!ctx) return;
    const now = ctx.currentTime, T = immediat ? 0 : .05;
    const m = gainDe(reglage.musique, SON_DEFAUT.musique), f = gainDe(reglage.effets, SON_DEFAUT.effets);
    const poser = (p, v) => { if (T) p.setTargetAtTime(v, now, T); else p.value = v; };
    poser(maitre.gain, reglage.coupe ? 0 : 1);
    poser(busMus.gain, m); poser(busOrch.gain, m);
    poser(busFx.gain, f); poser(revFx.gain, f);
  }
  function regler(r = {}) {
    reglage = { ...reglage, ...r };
    appliquer();
  }

  function musique(cible, o = {}) {
    if (!assurer() || !orchestre) return;
    orchestre.jouer(cible || null, o);
    if (!cible || cible === "carte") brume(0);
  }
  function temoinMusique() { if (assurer() && orchestre) orchestre.temoin(); }

  return {
    assurer, jouer, musique, brume, nappe, regler, temoinMusique,
    actif: () => !!ctx,
    vitesse: (v) => { vit = v; },
    etage: (e) => { orchestre?.etage?.(e); },
    stats: () => ({ ...stats, voix: ctx ? voix.filter((v) => v.fin > ctx.currentTime).length : 0 }),
    arreterTout: () => { if (ctx) { orchestre?.jouer(null); brume(0); nappe(null); } },
  };
}
