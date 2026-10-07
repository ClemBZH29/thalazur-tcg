/**
 * Mines de Kazim — Tafix, le Fossoyeur et la grotte des cristaux.
 *
 * Chaque figure cherche d'abord son image dans le dossier des sprites
 * (`tafix.webp`, `tafix-malicieux.webp`… ; `fossoyeur.webp`,
 * `fossoyeur-eveille.webp` ; `faveur-fond.webp`, `faveur-fond-mobile.webp`),
 * générées à partir des prompts du projet (assets-sora-tafix.json,
 * assets-sora-faveur.json). Tant qu'une image manque, un dessin vectoriel
 * tient sa place : la page reste jouable avant que les portraits arrivent,
 * et ne charge rien d'un domaine tiers.
 */
import { useState } from "react";

const SUFFIXE = { content: "", malicieux: "-malicieux", panique: "-panique", ebloui: "-ebloui" };

/* ── Tafix, en attendant son portrait ──────────────────────────────────── */
function TafixDessin({ expr, id }) {
  const m = "kz-maille-" + id;
  const vis = (...e) => (e.includes(expr) ? undefined : "none");
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={m} width="5" height="4.4" patternUnits="userSpaceOnUse">
          <rect width="5" height="4.4" fill="#5d686c" />
          <circle cx="2.5" cy="2.2" r="1.7" fill="none" stroke="#9aa6aa" strokeWidth=".9" />
          <circle cx="0" cy="0" r="1.7" fill="none" stroke="#7d898d" strokeWidth=".9" />
          <circle cx="5" cy="0" r="1.7" fill="none" stroke="#7d898d" strokeWidth=".9" />
          <circle cx="0" cy="4.4" r="1.7" fill="none" stroke="#7d898d" strokeWidth=".9" />
          <circle cx="5" cy="4.4" r="1.7" fill="none" stroke="#7d898d" strokeWidth=".9" />
        </pattern>
      </defs>
      <path d="M88 112 Q110 104 112 86 Q113 80 108 82 Q106 98 86 104Z" fill="#b8392a" />
      <path d="M26 122 L30 84 Q36 72 60 70 Q86 72 92 86 L98 122 Z" fill={"url(#" + m + ")"} stroke="#3a4346" strokeWidth="1.2" />
      <path d="M30 86 Q22 98 18 118 L32 120 Q34 104 38 94Z" fill={"url(#" + m + ")"} stroke="#3a4346" />
      <path d="M90 88 Q100 98 104 118 L90 120 Q88 104 84 94Z" fill={"url(#" + m + ")"} stroke="#3a4346" />
      <path d="M40 78 Q60 92 82 76" fill="none" stroke="#3a4346" strokeWidth="4" strokeLinecap="round" />
      <path d="M40 78 Q60 92 82 76" fill="none" stroke="#a7b2b6" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M34 82 Q38 76 46 76 Q42 82 40 86Z" fill="#c2412d" />
      <path d="M38 34 L30 22 L44 30Z M82 34 L90 22 L76 30Z" fill="#d9c7a0" />
      <path d="M34 50 L20 44 L34 58Z M86 50 L100 44 L86 58Z" fill="#a8321f" />
      <ellipse cx="60" cy="48" rx="25" ry="22" fill="#c2412d" />
      <ellipse cx="60" cy="63" rx="15" ry="10" fill="#d4573f" />
      <circle cx="55" cy="61" r="1.3" fill="#5a1a10" /><circle cx="65" cy="61" r="1.3" fill="#5a1a10" />
      <path d="M42 36 Q60 26 78 36" fill="none" stroke="#a8321f" strokeWidth="2" />
      <g display={vis("content", "malicieux")}>
        <ellipse cx="50" cy="46" rx="6" ry="6.5" fill="#f2c14e" /><ellipse cx="70" cy="46" rx="6" ry="6.5" fill="#f2c14e" />
        <rect x="49" y="41" width="2" height="10" rx="1" fill="#1a0d08" /><rect x="69" y="41" width="2" height="10" rx="1" fill="#1a0d08" />
      </g>
      <g display={vis("malicieux")}>
        <path d="M43 41 L57 44 L57 39 L43 37Z" fill="#c2412d" />
        <path d="M42 37 L57 42" stroke="#7a2215" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M63 40 L77 36" stroke="#7a2215" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <g display={vis("panique")}>
        <circle cx="50" cy="45" r="8" fill="#f8e3a3" /><circle cx="70" cy="45" r="8" fill="#f8e3a3" />
        <circle cx="50" cy="45" r="2.2" fill="#1a0d08" /><circle cx="70" cy="45" r="2.2" fill="#1a0d08" />
        <path d="M41 34 L56 37 M79 34 L64 37" stroke="#7a2215" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M86 40 q3 5 0 8 q-3-3 0-8z" fill="#9fd0ee" />
      </g>
      <g display={vis("ebloui")}>
        <path d="M50 37 l2.4 6 6.3.4-4.9 4 1.6 6.2-5.4-3.4-5.4 3.4 1.6-6.2-4.9-4 6.3-.4z" fill="#ffe28a" stroke="#e8a33d" />
        <path d="M70 37 l2.4 6 6.3.4-4.9 4 1.6 6.2-5.4-3.4-5.4 3.4 1.6-6.2-4.9-4 6.3-.4z" fill="#ffe28a" stroke="#e8a33d" />
      </g>
      <g display={vis("content")}>
        <path d="M50 67 Q60 74 70 67" fill="none" stroke="#5a1a10" strokeWidth="2" strokeLinecap="round" />
        <path d="M53 68 l1.5 3 1.5-3z M65 68 l1.5 3 1.5-3z" fill="#fff" />
      </g>
      <g display={vis("malicieux")}>
        <path d="M51 68 Q62 72 71 65" fill="none" stroke="#5a1a10" strokeWidth="2" strokeLinecap="round" />
        <path d="M66 67 l1.5 3 1.5-3.4z" fill="#fff" />
      </g>
      <g display={vis("panique")}>
        <ellipse cx="60" cy="69" rx="6" ry="4.5" fill="#5a1a10" />
        <path d="M56 66 l1.4 2.4 1.4-2.4z M61 66 l1.4 2.4 1.4-2.4z" fill="#fff" />
      </g>
      <g display={vis("ebloui")}>
        <path d="M49 66 Q60 78 71 66 Z" fill="#5a1a10" />
        <path d="M52 66.5 l1.5 3 1.5-3z M65 66.5 l1.5 3 1.5-3z" fill="#fff" />
      </g>
    </svg>
  );
}

let compteur = 0;

/** Le portrait de Tafix, dans l'expression demandée. */
export function Tafix({ expr = "content", base, taille }) {
  const [manquantes, setManquantes] = useState(() => new Set());
  const [id] = useState(() => "t" + (++compteur));
  const e = SUFFIXE[expr] !== undefined ? expr : "content";
  return (
    <span className="kz-tafix" style={taille ? { width: taille, height: taille } : undefined}>
      {manquantes.has(e) ? <TafixDessin expr={e} id={id} /> : (
        <img src={base + "tafix" + SUFFIXE[e] + ".webp"} alt=""
             onError={() => setManquantes((m) => new Set(m).add(e))} />
      )}
    </span>
  );
}

/* ── Le Fossoyeur, en attendant son sprite ─────────────────────────────── */
function ColosseDessin({ id }) {
  const fer = "kz-fer-" + id, chene = "kz-chene-" + id, reflet = "kz-reflet-" + id;
  return (
    <svg viewBox="0 0 200 260" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={fer} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a555a" /><stop offset=".55" stopColor="#2a3236" /><stop offset="1" stopColor="#171d20" />
        </linearGradient>
        <linearGradient id={chene} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a6248" /><stop offset="1" stopColor="#4a3a2a" />
        </linearGradient>
        <linearGradient id={reflet} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#dbe8f0" stopOpacity=".55" /><stop offset=".25" stopColor="#dbe8f0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="160" y="40" width="9" height="220" rx="3" fill={`url(#${chene})`} transform="rotate(8 164 150)" />
      <path d="M152 6 L190 2 L194 44 Q176 58 158 48Z" fill={`url(#${fer})`} stroke="#11171a" strokeWidth="2" />
      <path d="M190 2 L194 44" stroke="#dbe8f0" strokeOpacity=".6" strokeWidth="2" />
      <rect x="18" y="98" width="20" height="70" rx="4" fill={`url(#${chene})`} transform="rotate(10 28 130)" />
      <rect x="150" y="96" width="20" height="62" rx="4" fill={`url(#${chene})`} transform="rotate(-14 160 128)" />
      <path d="M8 164 L40 158 L46 226 L14 232Z" fill={`url(#${fer})`} stroke="#11171a" strokeWidth="2" />
      <path d="M148 150 L176 142 L184 196 L156 202Z" fill={`url(#${fer})`} stroke="#11171a" strokeWidth="2" />
      <rect x="152" y="176" width="34" height="22" rx="7" fill="#262e31" stroke="#11171a" strokeWidth="2" />
      <path d="M12 190 h8 M12 202 h8 M12 214 h8" stroke="#6a5a48" strokeWidth="2" />
      <path d="M16 86 Q30 62 64 64 L66 106 Q36 112 16 104Z" fill={`url(#${fer})`} stroke="#11171a" strokeWidth="2" />
      <path d="M184 84 Q170 60 136 62 L134 104 Q164 110 184 102Z" fill={`url(#${fer})`} stroke="#11171a" strokeWidth="2" />
      <path d="M52 70 L148 70 L156 176 Q100 196 44 176Z" fill={`url(#${fer})`} stroke="#11171a" strokeWidth="2" />
      <path d="M72 104 L128 104 L124 160 Q100 168 76 160Z" fill="#0b0f10" />
      <circle className="kz-forge" cx="100" cy="140" r="11" />
      <path d="M70 112 H130 M70 126 H130 M72 140 H128 M74 154 H126" stroke={`url(#${chene})`} strokeWidth="6" />
      <path d="M60 80 Q100 92 140 80" stroke={`url(#${chene})`} strokeWidth="9" fill="none" />
      <path d="M52 96 L148 96" stroke="#1b2124" strokeWidth="5" />
      <g fill="#6b777c">
        <circle cx="58" cy="76" r="2.4" /><circle cx="142" cy="76" r="2.4" /><circle cx="56" cy="170" r="2.4" />
        <circle cx="144" cy="170" r="2.4" /><circle cx="26" cy="92" r="2.4" /><circle cx="174" cy="90" r="2.4" />
      </g>
      <path d="M60 172 q2 10 0 18 M138 172 q-1 8 1 16" stroke="#8a4a24" strokeOpacity=".6" strokeWidth="2" fill="none" />
      <path d="M40 104 Q60 130 52 160" stroke="#545e62" strokeWidth="3" strokeDasharray="4 3" fill="none" />
      <path d="M70 66 Q66 24 100 20 Q134 24 130 66 Q116 76 100 76 Q84 76 70 66Z" fill={`url(#${fer})`} stroke="#11171a" strokeWidth="2" />
      <rect x="98" y="26" width="4" height="16" rx="2" fill="#0b0f10" />
      <circle cx="87" cy="50" r="7" fill="#0b0f10" /><circle cx="113" cy="50" r="7" fill="#0b0f10" />
      <circle className="kz-oeil" cx="87" cy="50" r="4" /><circle className="kz-oeil" cx="113" cy="50" r="4" />
      <path d="M52 70 L148 70 L156 176 Q100 196 44 176Z" fill={`url(#${reflet})`} />
      <path d="M70 66 Q66 24 100 20 Q134 24 130 66 Q116 76 100 76 Q84 76 70 66Z" fill={`url(#${reflet})`} />
    </svg>
  );
}

/** Le Fossoyeur, endormi ou éveillé (il s'éveille quand on lui offre des éclats). */
export function Fossoyeur({ base, eveille }) {
  const [manquant, setManquant] = useState(false);
  const [id] = useState(() => "f" + (++compteur));
  return (
    <span className={"kz-colosse" + (eveille ? " kz-eveille" : "")}>
      {manquant ? <ColosseDessin id={id} /> : (
        <img src={base + (eveille ? "fossoyeur-eveille.webp" : "fossoyeur.webp")} alt=""
             onError={() => setManquant(true)} />
      )}
    </span>
  );
}

/* ── La grotte des cristaux, en attendant son fond ─────────────────────── */
function GrotteDessin() {
  return (
    <svg viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="kz-cr" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f4f8fb" stopOpacity=".85" /><stop offset=".5" stopColor="#cfe0ec" stopOpacity=".55" />
          <stop offset="1" stopColor="#8fb8d8" stopOpacity=".25" />
        </linearGradient>
        <linearGradient id="kz-crl" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#cfe0ec" stopOpacity=".35" /><stop offset="1" stopColor="#8fb8d8" stopOpacity=".08" />
        </linearGradient>
        <radialGradient id="kz-vign" cx="40%" cy="30%" r="80%">
          <stop offset=".35" stopColor="#0d1417" stopOpacity="0" /><stop offset="1" stopColor="#0d1417" stopOpacity="1" />
        </radialGradient>
      </defs>
      <rect width="600" height="700" fill="#0f191c" />
      <g opacity=".55">
        <polygon points="300,120 560,40 572,62 312,146" fill="url(#kz-crl)" />
        <polygon points="380,300 600,250 600,276 386,322" fill="url(#kz-crl)" />
        <polygon points="200,90 260,0 284,10 222,104" fill="url(#kz-crl)" />
      </g>
      <polygon points="-40,40 420,-30 430,10 -30,96" fill="url(#kz-cr)" />
      <polygon points="470,-20 520,-10 640,330 600,350" fill="url(#kz-cr)" />
      <polygon points="160,0 196,-6 70,260 40,250" fill="url(#kz-cr)" opacity=".8" />
      <path d="M0 250 Q90 236 200 246 L210 268 Q100 262 0 274Z" fill="#141f23" />
      <rect width="600" height="700" fill="url(#kz-vign)" />
      <circle cx="470" cy="420" r="2" fill="#e8a33d" />
    </svg>
  );
}

export function Grotte({ base }) {
  const [manquant, setManquant] = useState(false);
  return (
    <div className="kz-grotte" aria-hidden="true">
      {manquant ? <GrotteDessin /> : (
        <picture>
          <source media="(max-width: 900px)" srcSet={base + "faveur-fond-mobile.webp"} />
          <img src={base + "faveur-fond.webp"} alt="" onError={() => setManquant(true)} />
        </picture>
      )}
    </div>
  );
}
