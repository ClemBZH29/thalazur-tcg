/**
 * Un worker : il joue des descentes et renvoie leurs résultats bruts.
 * Message reçu : { id, cfg, profil, opts, debut, n } (`opts.journal` : renvoyer
 * aussi le journal de chaque descente) ; les graines vont de
 * `debut` à `debut + n - 1`.
 */
import { parentPort } from "node:worker_threads";
import { descente } from "./moteur.mjs";

parentPort.on("message", ({ id, cfg, profil, opts, debut, n }) => {
  const gardiens = [], po = [], journaux = [];
  let blocages = 0;
  for (let g = debut; g < debut + n; g++) {
    const d = descente(g, cfg, profil, opts);
    gardiens.push(d.gardiens); po.push(d.po);
    if (d.journal) journaux.push(d.journal);
    if (d.blocage) blocages++;
  }
  parentPort.postMessage({ id, gardiens, po, blocages, journaux });
});
