"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  darkReaderDetected: boolean;
};

const THEME_STORAGE_KEY = "driver-station-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

function detectDarkReader() {
  if (typeof document === "undefined") return false;

  return (
    document.documentElement.hasAttribute("data-darkreader-mode") ||
    document.documentElement.hasAttribute("data-darkreader-scheme") ||
    document.querySelector('style.darkreader, style[class*="darkreader"]') !== null
  );
}

function readInitialTheme(): ThemeMode {
  if (typeof document === "undefined") return "dark";

  const appliedTheme = document.documentElement.dataset.theme;
  if (appliedTheme === "light" || appliedTheme === "dark") return appliedTheme;

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(storedTheme)) return storedTheme;
  } catch {
    // Ignore storage errors and fall back to the system preference.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [darkReaderDetected, setDarkReaderDetected] = useState(false);

  useEffect(() => {
    const initialTheme = readInitialTheme();
    // Hydrate the saved theme after SSR so the header toggle stays in sync with localStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(initialTheme);
    applyTheme(initialTheme);
    setDarkReaderDetected(detectDarkReader());

    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateDarkReader = () => setDarkReaderDetected(detectDarkReader());

    const syncDarkReader = () => {
      updateDarkReader();
    };

    const observer = new MutationObserver(syncDarkReader);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-darkreader-mode", "data-darkreader-scheme"],
    });
    observer.observe(document.head, { childList: true, subtree: true });

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== THEME_STORAGE_KEY) return;
      const nextTheme = isThemeMode(event.newValue) ? event.newValue : readInitialTheme();
      setThemeState(nextTheme);
      applyTheme(nextTheme);
    };

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      try {
        if (window.localStorage.getItem(THEME_STORAGE_KEY)) return;
      } catch {
        // Ignore storage errors and keep following system changes.
      }

      const nextTheme: ThemeMode = event.matches ? "dark" : "light";
      setThemeState(nextTheme);
      applyTheme(nextTheme);
    };

    window.addEventListener("storage", handleStorage);
    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", handleStorage);
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage errors and keep the in-memory theme.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((currentTheme) => {
      const nextTheme: ThemeMode = currentTheme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      } catch {
        // Ignore storage errors and keep the in-memory theme.
      }
      return nextTheme;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, darkReaderDetected }),
    [darkReaderDetected, setTheme, theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
