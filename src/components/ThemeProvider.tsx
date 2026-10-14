'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    let saved: Theme | null = null;
    try {
      const value = localStorage.getItem('cleanshot_theme');
      if (value === 'light' || value === 'dark') saved = value;
    } catch {
      // Storage can be unavailable in strict privacy modes; keep the dark default.
    }
    const selected: Theme = saved || 'dark';
    setThemeState(selected);
    document.documentElement.classList.toggle('dark', selected === 'dark');
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem('cleanshot_theme', t); } catch { /* Theme still works for this session. */ }
    document.documentElement.classList.toggle('dark', t === 'dark');
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      <div className={theme === 'dark' ? 'dark' : ''}>{children}</div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
