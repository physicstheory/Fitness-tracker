import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { handleRedirect } from "./lib/spotify";
import "./styles.css";

const returningFromSpotify = /[?&](code|error)=/.test(location.search);

// Keep the startup animation on screen long enough to finish, then fade it out.
const SPLASH_MS = matchMedia("(prefers-reduced-motion: reduce)").matches ? 300 : 1700;
function hideSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  setTimeout(() => {
    splash.classList.add("hide");
    splash.addEventListener("transitionend", () => splash.remove(), { once: true });
    setTimeout(() => splash.remove(), 800);
  }, Math.max(0, SPLASH_MS - performance.now()));
}

handleRedirect().then((notice) => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App spotifyReturn={returningFromSpotify ? { notice: notice ?? undefined } : undefined} />
    </StrictMode>,
  );
  hideSplash();
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
