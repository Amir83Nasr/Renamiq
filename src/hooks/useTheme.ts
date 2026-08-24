// ── THEME HOOK ───────────────────────────────────────────────

import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "renamiq-theme";

function apply(theme: Exclude<Theme, "system">) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function resolve(theme: Theme): Exclude<Theme, "system"> {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(STORAGE_KEY) as Theme) || "system",
  );

  useEffect(() => {
    apply(resolve(theme));
    if (theme !== "system") return;

    // ponytail: re-apply only on OS scheme change; no reactive store needed.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return { theme, resolved: resolve(theme), setTheme };
}
