import type { Settings } from "../types";

/** Applies the Light / Dark / Auto choice. CSS reads data-theme; no attribute means follow the system. */
export function applyTheme(theme: Settings["theme"]) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0d0f14" : "#f3f4f8");
}
