import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
/* Polices servies par le site : aucune requête vers Google à l'affichage. */
import "@fontsource-variable/fraunces/full.css";
import "@fontsource/archivo/400.css";
import "@fontsource/archivo/500.css";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/site.css";
import "./styles/cards.css";
import "./styles/app.css";
import "./styles/colporteur.css";
import "./styles/compte.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
