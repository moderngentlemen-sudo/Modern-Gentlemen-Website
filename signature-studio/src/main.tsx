import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FONTS, googleFontsHref } from "./core/fonts";
import { App } from "./App";
import "./styles.css";
import { setupPwa } from "./pwa";
import { startAccount } from "./cloud/account";

setupPwa();
startAccount();

// Template webfonts, so the editor previews them as designed.
const href = googleFontsHref(FONTS.map((f) => f.id));
if (href) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
