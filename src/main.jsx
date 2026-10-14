import React from "react";
import { createRoot } from "react-dom/client";
/* La racine dépend de la phase du site (vite.config.js) : le jeu, ou la seule
   page d'attente quand le site est fermé avant son ouverture. Chacune importe
   ses feuilles de style, dans l'ordre qui fait sa cascade. */
import Racine from "@racine";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Racine />
  </React.StrictMode>
);
