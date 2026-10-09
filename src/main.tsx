import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { handleRedirect } from "./lib/spotify";
import "./styles.css";

const returningFromSpotify = /[?&](code|error)=/.test(location.search);

handleRedirect().then((notice) => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App spotifyReturn={returningFromSpotify ? { notice: notice ?? undefined } : undefined} />
    </StrictMode>,
  );
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
