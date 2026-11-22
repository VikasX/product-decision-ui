"use client";

import { Moon, Sun } from "lucide-react";

// CSS follows the root data-theme attribute; persistence is optional if storage is unavailable.
export function ThemeToggle() {
  // Handle the click in the browser; no API call or account preference update is involved.
  return <button type="button" className="theme-toggle" aria-label="Toggle light and dark theme" onClick={() => {
    // Read the current root theme and choose the opposite light/dark value.
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    // Changing this root attribute activates the matching CSS palette and icon rules.
    document.documentElement.dataset.theme = theme;
    // Save the preference for the next visit. If browser storage is blocked, the current toggle still works.
    try { localStorage.setItem("buywise-theme", theme); } catch { /* Theme still works without storage. */ }
  }}><Moon className="moon-icon" size={19} aria-hidden /><Sun className="sun-icon" size={19} aria-hidden /></button>;
}
