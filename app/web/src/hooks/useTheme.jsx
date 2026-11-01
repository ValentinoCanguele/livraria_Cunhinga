import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  storageKey = 'livraria-theme',
  attribute = 'class'
}) {
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored || defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (attribute === 'class') {
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
    } else {
      root.setAttribute(attribute, theme);
    }
    try {
      localStorage.setItem(storageKey, theme);
    } catch (e) {
      // ignore
    }
  }, [theme, storageKey, attribute]);

  const value = useMemo(() => ({
    theme,
    setTheme: (t) => setThemeState(t),
  }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
