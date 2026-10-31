/**
 * Les workers des simulations : un par cœur, chacun joue des descentes
 * (travailleur.mjs) ; `tache` rend une promesse résolue avec leurs résultats.
 */
import { Worker } from "node:worker_threads";

export class Pool {
  constructor(k) {
    this.libres = []; this.file = []; this.attente = new Map(); this.id = 0;
    this.w = Array.from({ length: k }, () => {
      const w = new Worker(new URL("./travailleur.mjs", import.meta.url));
      w.on("message", (m) => { this.attente.get(m.id)(m); this.attente.delete(m.id); this.libres.push(w); this.pomper(); });
      w.on("error", (e) => { console.error(e); process.exit(1); });
      this.libres.push(w);
      return w;
    });
  }
  tache(msg) { return new Promise((res) => { this.file.push({ msg, res }); this.pomper(); }); }
  pomper() {
    while (this.libres.length && this.file.length) {
      const w = this.libres.pop(), { msg, res } = this.file.shift();
      msg.id = ++this.id; this.attente.set(msg.id, res); w.postMessage(msg);
    }
  }
  fermer() { for (const w of this.w) w.terminate(); }
}
