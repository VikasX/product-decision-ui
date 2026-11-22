"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  return <button type="button" className="theme-toggle" aria-label="Toggle light and dark theme" onClick={() => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("buywise-theme", theme); } catch { /* Theme still works without storage. */ }
  }}><Moon className="moon-icon" size={19} aria-hidden /><Sun className="sun-icon" size={19} aria-hidden /></button>;
}
