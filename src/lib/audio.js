import { useCallback, useMemo, useRef } from "react";

/**
 * Tout est synthétisé : bruit blanc filtré pour les matières, oscillateurs
 * pour les paliers. Aucun fichier à héberger. Le contexte ne s'ouvre qu'au
 * premier geste de l'utilisateur, ce qui satisfait les règles d'autoplay.
 */
export function useAudio(actifRef) {
  const ctxRef = useRef(null);
  const bufRef = useRef(null);

  const ctx = useCallback(() => {
    if (!actifRef.current) return null;
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const c = new AC();
      const n = Math.floor(c.sampleRate * 1.5);
      const b = c.createBuffer(1, n, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      ctxRef.current = c;
      bufRef.current = b;
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, [actifRef]);

  const bruit = useCallback(
    (duree, o = {}) => {
      const c = ctx();
      if (!c) return;
      const { f0 = 1600, f1 = 600, q = 0.8, gain = 0.14, type = "bandpass", delai = 0 } = o;
      const t = c.currentTime + delai;
      const src = c.createBufferSource();
      src.buffer = bufRef.current;
      src.loop = true;
      const flt = c.createBiquadFilter();
      flt.type = type;
      flt.Q.value = q;
      flt.frequency.setValueAtTime(f0, t);
      flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + duree);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, duree * 0.25));
      g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
      src.connect(flt);
      flt.connect(g);
      g.connect(c.destination);
      src.start(t);
      src.stop(t + duree + 0.05);
    },
    [ctx]
  );

  const ton = useCallback(
    (freq, duree, o = {}) => {
      const c = ctx();
      if (!c) return;
      const { gain = 0.09, type = "triangle", delai = 0, vers = null } = o;
      const t = c.currentTime + delai;
      const osc = c.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (vers) osc.frequency.exponentialRampToValueAtTime(vers, t + duree);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
      osc.connect(g);
      g.connect(c.destination);
      osc.start(t);
      osc.stop(t + duree + 0.05);
    },
    [ctx]
  );

  return useMemo(
    () => ({
      fissure: () => bruit(0.045, { f0: 3400, f1: 1800, q: 2.4, gain: 0.07 }),
      rupture: () => {
        bruit(0.22, { f0: 2600, f1: 260, q: 1.1, gain: 0.2 });
        ton(78, 0.3, { gain: 0.16, type: "sine", vers: 40 });
      },
      deroule: () => bruit(0.75, { f0: 320, f1: 2800, q: 0.5, gain: 0.1, type: "lowpass" }),
      retourne: () => {
        bruit(0.16, { f0: 2200, f1: 900, q: 1.4, gain: 0.07 });
        bruit(0.09, { f0: 700, f1: 300, q: 1, gain: 0.05, delai: 0.1 });
      },
      glisse: () => bruit(0.2, { f0: 1800, f1: 400, q: 0.7, gain: 0.06 }),
      touche: () => bruit(0.06, { f0: 900, f1: 380, q: 1.6, gain: 0.06 }),
      montee: (tier) => {
        if (tier === "rare") ton(300, 0.46, { gain: 0.05, type: "sine", vers: 620 });
        if (tier === "legendaire") {
          ton(180, 0.82, { gain: 0.07, type: "sine", vers: 470 });
          bruit(0.82, { f0: 400, f1: 4200, q: 0.4, gain: 0.05, type: "lowpass" });
        }
      },
      revele: (tier) => {
        if (tier === "peucommun") ton(784, 0.3, { gain: 0.07 });
        if (tier === "rare") {
          ton(659, 0.3, { gain: 0.09 });
          ton(988, 0.42, { gain: 0.08, delai: 0.09 });
        }
        if (tier === "legendaire") {
          [440, 659, 880, 1319].forEach((f, i) =>
            ton(f, 1.5 - i * 0.16, { gain: 0.075, delai: i * 0.075 })
          );
          bruit(1.1, { f0: 5200, f1: 2200, q: 0.6, gain: 0.05, delai: 0.1 });
        }
      },
      rainbow: () => {
        ton(1568, 0.6, { gain: 0.045, type: "sine" });
        ton(2093, 0.7, { gain: 0.035, type: "sine", delai: 0.07 });
      },
      appel: () =>
        [262, 330, 392, 523].forEach((f, i) =>
          ton(f, 1.8, { gain: 0.07, delai: i * 0.11, type: "sawtooth" })
        ),
      /* Le colporteur : la clochette de son ballot, puis les pièces. Une
         quinte à vide plutôt qu'un accord franc — il arrive, il ne triomphe
         pas. */
      clochette: () => {
        ton(1175, 0.5, { gain: 0.05, type: "sine" });
        ton(1760, 0.42, { gain: 0.035, type: "sine", delai: 0.11 });
        ton(880, 0.7, { gain: 0.028, type: "sine", delai: 0.05 });
      },
      pieces: () => {
        [0, 0.045, 0.1, 0.15].forEach((d, i) =>
          bruit(0.07, { f0: 4200 - i * 300, f1: 2400, q: 3.2, gain: 0.045, delai: d })
        );
      },
      /* Il s'éloigne : la clochette descend d'un ton et s'éteint. */
      depart: () => {
        ton(880, 0.55, { gain: 0.035, type: "sine", vers: 660 });
        bruit(0.4, { f0: 900, f1: 220, q: 0.8, gain: 0.035, delai: 0.08 });
      },
    }),
    [bruit, ton]
  );
}
