import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'prymal-theme';
const ThemeContext = createContext(null);

function readStoredTheme() {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return 'dark';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
      setTheme,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error('useTheme must be used inside ThemeProvider.');
  }

  return value;
}

export function getClerkAppearance(theme) {
  const isDark = theme === 'dark';

  return {
    variables: {
      colorPrimary: isDark ? '#68f5d0' : '#1e63ff',
      colorBackground: isDark ? '#0d1320' : '#f7f9ff',
      colorText: isDark ? '#edf3ff' : '#182033',
      colorInputBackground: isDark ? '#111b2d' : '#ffffff',
      colorInputText: isDark ? '#edf3ff' : '#182033',
      colorNeutral: isDark ? '#95a3c2' : '#6a7791',
      borderRadius: '22px',
      fontFamily: '"Space Grotesk", sans-serif',
    },
    elements: {
      rootBox: {
        width: '100%',
      },
      card: {
        background: isDark
          ? 'linear-gradient(180deg, rgba(14, 20, 34, 0.94), rgba(10, 14, 24, 0.98))'
          : 'linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(241, 246, 255, 0.98))',
        border: isDark ? '1px solid rgba(129, 150, 189, 0.18)' : '1px solid rgba(30, 54, 105, 0.1)',
        boxShadow: isDark
          ? '0 28px 90px rgba(0, 0, 0, 0.34)'
          : '0 30px 80px rgba(126, 149, 201, 0.22)',
      },
      headerTitle: {
        fontFamily: '"Space Grotesk", sans-serif',
        fontWeight: 700,
      },
      formButtonPrimary: {
        background: isDark
          ? 'linear-gradient(135deg, #68f5d0, #7f8cff)'
          : 'linear-gradient(135deg, #2e6bff, #4ecdc4)',
        color: isDark ? '#04121d' : '#f8fbff',
      },
      footerActionLink: {
        color: isDark ? '#9bdcf2' : '#2856e7',
      },
    },
  };
}
