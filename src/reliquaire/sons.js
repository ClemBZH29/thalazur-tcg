/**
 * Les sons du Reliquaire (Claude Design, 06/10/2026).
 *
 * Même facture que src/lib/audio.js, celui de l'ouverture des boosters : tout
 * est synthétisé, bruit blanc filtré pour les matières, oscillateurs pour les
 * paliers, aucun fichier. `montee`, `retourne`, `revele` et `rainbow` sont
 * repris de l'ouverture ; `paiement`, `fil`, `frappe` et `verdict` sont
 * nouveaux.
 *
 * Chaque geste joue sur son propre bus, qu'on éteint en 80 ms quand le
 * joueur passe à la fin : seul le son final joue alors. Le volume suit le
 * réglage « effets » du profil (50 % par défaut = gain 1).
 */
let c = null, buf = null;

function ctx() {
  if (!c) {
    const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    c = new AC();
    const n = Math.floor(c.sampleRate * 1.5);
    buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  if (c.state === "suspended") c.resume();
  return c;
}

/** Un bus de sortie, ou null si le son est coupé. `reglage` : lireSon(). */
export function bus(reglage) {
  if (!reglage || reglage.coupe || !reglage.effets) return null;
  const k = ctx();
  if (!k) return null;
  const g = k.createGain();
  g.gain.value = Math.min(2, reglage.effets / 50);
  g.connect(k.destination);
  return g;
}

/** Éteint un bus en 80 ms : la séquence s'arrête net, sans claquement. */
export function eteindre(g) {
  if (!g || !c) return;
  const t = c.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.linearRampToValueAtTime(0, t + 0.08);
  setTimeout(() => g.disconnect(), 200);
}

function bruit(out, duree, o = {}) {
  if (!c || !out) return;
  const { f0 = 1600, f1 = 600, q = 0.8, gain = 0.14, type = "bandpass", delai = 0 } = o, t = c.currentTime + delai;
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + duree);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, duree * 0.25));
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + duree + 0.05);
}

function ton(out, freq, duree, o = {}) {
  if (!c || !out) return;
  const { gain = 0.09, type = "triangle", delai = 0, vers = null } = o, t = c.currentTime + delai;
  const osc = c.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(freq, t);
  if (vers) osc.frequency.exponentialRampToValueAtTime(vers, t + duree);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + duree + 0.05);
}

export const Son = {
  /** Les vestiges quittent la réserve : dix éclats de verre, puis le dos les boit. */
  paiement(o, d = 0) {
    for (let i = 0; i < 10; i++) bruit(o, 0.05, { f0: 5600 - i * 140, f1: 3200, q: 4, gain: 0.032, delai: d + i * 0.018 });
    bruit(o, 0.24, { f0: 500, f1: 1900, q: 0.6, gain: 0.05, type: "lowpass", delai: d + 0.24 });
    ton(o, 196, 0.3, { gain: 0.035, type: "sine", vers: 262, delai: d + 0.26 });
  },
  montee(o, tier, d = 0) {
    if (tier === "peucommun") ton(o, 392, 0.23, { gain: 0.03, type: "sine", vers: 523, delai: d });
    if (tier === "rare") ton(o, 300, 0.46, { gain: 0.05, type: "sine", vers: 620, delai: d });
    if (tier === "legendaire") {
      ton(o, 180, 0.82, { gain: 0.07, type: "sine", vers: 470, delai: d });
      bruit(o, 0.82, { f0: 400, f1: 4200, q: 0.4, gain: 0.05, type: "lowpass", delai: d });
    }
  },
  retourne(o, d = 0) {
    bruit(o, 0.16, { f0: 2200, f1: 900, q: 1.4, gain: 0.07, delai: d });
    bruit(o, 0.09, { f0: 700, f1: 300, q: 1, gain: 0.05, delai: d + 0.1 });
  },
  revele(o, tier, d = 0) {
    if (tier === "peucommun") ton(o, 784, 0.3, { gain: 0.07, delai: d });
    if (tier === "rare") { ton(o, 659, 0.3, { gain: 0.09, delai: d }); ton(o, 988, 0.42, { gain: 0.08, delai: d + 0.09 }); }
    if (tier === "legendaire") {
      [440, 659, 880, 1319].forEach((f, i) => ton(o, f, 1.5 - i * 0.16, { gain: 0.075, delai: d + i * 0.075 }));
      bruit(o, 1.1, { f0: 5200, f1: 2200, q: 0.6, gain: 0.05, delai: d + 0.1 });
    }
  },
  rainbow(o, d = 0) {
    ton(o, 1568, 0.6, { gain: 0.045, type: "sine", delai: d });
    ton(o, 2093, 0.7, { gain: 0.035, type: "sine", delai: d + 0.07 });
  },
  /** La fissure qui court sur le cadre : un grésillement aigu qui monte. */
  fil(o, duree, d = 0) { bruit(o, duree, { f0: 3800, f1: 7200, q: 3.2, gain: 0.022, delai: d }); },
  /** Le coup de forge ; pour une légendaire, un grave et des braises qui crépitent. */
  frappe(o, grand, d = 0) {
    bruit(o, 0.08, { f0: 3000, f1: 800, q: 1.2, gain: 0.13, delai: d });
    ton(o, 1046.5, 0.9, { gain: 0.045, type: "sine", delai: d });
    ton(o, 1661, 0.6, { gain: 0.025, type: "sine", delai: d + 0.005 });
    if (grand) {
      bruit(o, 0.22, { f0: 2600, f1: 260, q: 1.1, gain: 0.2, delai: d });
      ton(o, 78, 0.3, { gain: 0.16, type: "sine", vers: 40, delai: d });
      ton(o, 55, 0.9, { gain: 0.12, type: "sine", vers: 36, delai: d + 0.03 });
      [0.12, 0.21, 0.33, 0.41, 0.56, 0.7, 0.86].forEach((x, i) =>
        bruit(o, 0.045, { f0: 3400 - i * 120, f1: 1800, q: 2.4, gain: 0.05, delai: d + x }));
    }
  },
  /** Gagnant : une quinte qui monte et les pièces ; perdant : une tierce qui retombe ; juste : une note. */
  verdict(o, ecart, d = 0) {
    if (ecart > 0) {
      ton(o, 523.3, 0.35, { gain: 0.07, delai: d }); ton(o, 784, 0.55, { gain: 0.07, delai: d + 0.08 });
      if (ecart >= 900) ton(o, 1046.5, 0.8, { gain: 0.055, delai: d + 0.16 });
      [0, 0.045, 0.1, 0.15].forEach((x, i) => bruit(o, 0.07, { f0: 4200 - i * 300, f1: 2400, q: 3.2, gain: 0.045, delai: d + 0.12 + x }));
    } else if (ecart < 0) {
      ton(o, 392, 0.32, { gain: 0.06, vers: 349, delai: d }); ton(o, 311, 0.5, { gain: 0.05, vers: 262, delai: d + 0.12 });
      bruit(o, 0.12, { f0: 500, f1: 180, q: 1, gain: 0.06, delai: d + 0.12 });
    } else ton(o, 587.3, 0.32, { gain: 0.05, type: "sine", delai: d });
  },
};

/** La bande-son d'un geste, calée sur sa chronologie. */
export function jouerGeste(o, geste, tl, { tier, rainbow, grand, ecart }) {
  if (!o) return;
  const s = (ms) => ms / 1000;
  if (tl.paie) Son.paiement(o, 0);
  if (tl.glow) Son.montee(o, tier, s(tl.glow[0]));
  if (tl.flip) {
    Son.retourne(o, s(tl.flip[0]));
    const face = s(tl.flip[0] + tl.flip[1] * 0.2);
    Son.revele(o, tier, face);
    if (rainbow) Son.rainbow(o, face + 0.12);
  }
  if (tl.forge) { Son.fil(o, s(tl.forge[1] * 0.85), s(tl.forge[0])); Son.frappe(o, grand, s(tl.flash)); }
  if (geste === "aveugle") Son.verdict(o, ecart, s(tl.ecart[0]));
}

/** Le seul son final, quand on passe à la fin ou en mouvement réduit. */
export function jouerFinal(o, geste, { tier, grand, ecart }) {
  if (!o) return;
  if (geste === "aveugle") Son.verdict(o, ecart);
  else if (geste === "forger") Son.frappe(o, grand);
  else Son.revele(o, tier);
}
