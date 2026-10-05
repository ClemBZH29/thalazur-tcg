/**
 * Les pièces qui filent vers la bourse.
 *
 * Un gain sans geste passait inaperçu : le chiffre du bandeau changeait en
 * haut de l'écran, loin du bouton. Douze pastilles partent du bouton en arc
 * et rejoignent la bourse, qui pulse ensuite. Avec le mouvement réduit (le
 * réglage du profil, posé sur <html data-mouvement>), rien ne vole : la
 * bourse prend son total tout de suite.
 */
export function volerVersBourse(depuis, n = 12) {
  if (typeof document === "undefined" || !depuis) return;
  if (document.documentElement.dataset.mouvement === "reduit") return;
  const cible = document.querySelector(".bourse");
  if (!cible || !depuis.getBoundingClientRect) return;
  const a = depuis.getBoundingClientRect();
  const b = cible.getBoundingClientRect();
  const x0 = a.left + a.width / 2;
  const y0 = a.top + a.height / 2;
  const dx = b.left + 12 - x0;
  const dy = b.top + b.height / 2 - y0;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span");
    p.className = "piece-volante";
    p.style.left = `${x0 + (Math.random() - 0.5) * a.width * 0.5}px`;
    p.style.top = `${y0}px`;
    document.body.appendChild(p);
    const haut = -60 - Math.random() * 70;
    const anim = p.animate([
      { transform: "translate(-50%, -50%) scale(.6)", opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${dy * 0.45 + haut}px)) scale(1)`, opacity: 1, offset: 0.45 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.5)`, opacity: 0.9 },
    ], { duration: 760, delay: i * 40, easing: "cubic-bezier(.3,.1,.3,1)", fill: "both" });
    anim.onfinish = () => p.remove();
  }
  setTimeout(() => {
    cible.animate([
      { transform: "scale(1)" }, { transform: "scale(1.12)", offset: 0.35 }, { transform: "scale(1)" },
    ], { duration: 420, easing: "cubic-bezier(.2,1.3,.4,1)" });
  }, 760 + n * 40 - 120);
}
