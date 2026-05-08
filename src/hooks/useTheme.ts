import { useEffect, useState } from "react";

export const THEMES = [
  { id: "default", name: "افتراضي", color: "#22c55e" },
  { id: "ocean", name: "محيط", color: "#0ea5e9" },
  { id: "sunset", name: "غروب", color: "#f97316" },
  { id: "royal", name: "ملكي", color: "#8b5cf6" },
  { id: "rose", name: "وردي", color: "#e11d48" },
  { id: "midnight", name: "منتصف الليل", color: "#3b82f6" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type Mode = "light" | "dark";

const THEME_CLASSES = THEMES.filter((t) => t.id !== "default").map((t) => `theme-${t.id}`);

function applyTheme(theme: ThemeId, mode: Mode) {
  const root = document.documentElement;
  THEME_CLASSES.forEach((c) => root.classList.remove(c));
  if (theme !== "default") root.classList.add(`theme-${theme}`);
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function useTheme() {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("theme-mode");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const [theme, setThemeState] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return "default";
    const stored = localStorage.getItem("theme-name") as ThemeId | null;
    if (stored && THEMES.some((t) => t.id === stored)) return stored;
    return "default";
  });

  useEffect(() => {
    applyTheme(theme, mode);
    localStorage.setItem("theme-mode", mode);
    localStorage.setItem("theme-name", theme);
  }, [theme, mode]);

  return {
    theme,
    mode,
    setTheme: setThemeState,
    toggle: () => setMode((m) => (m === "dark" ? "light" : "dark")),
  };
}
