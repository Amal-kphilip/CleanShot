'use client';

import React, { useEffect } from 'react';

/** StripMeta uses a single dark theme so colors stay consistent across devices. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
    // Remove a theme preference saved by older versions; it must not reactivate light mode.
    try {
      localStorage.removeItem('cleanshot_theme');
    } catch {
      // Storage may be blocked; the app remains dark regardless.
    }
  }, []);

  return <div className="dark">{children}</div>;
}
