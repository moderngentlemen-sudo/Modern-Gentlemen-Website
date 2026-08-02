"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

/** Inline script string injected in <head> to set the theme BEFORE paint (no flash). */
export const themeBootScript = `(function(){try{var t=localStorage.getItem('mg-theme')||'light';document.documentElement.setAttribute('data-mgtheme',t);}catch(e){document.documentElement.setAttribute('data-mgtheme','light');}})();`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const t = (localStorage.getItem("mg-theme") as Theme) || "light";
    setTheme(t);
    document.documentElement.setAttribute("data-mgtheme", t);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("mg-theme", next);
    document.documentElement.setAttribute("data-mgtheme", next);
  };

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
