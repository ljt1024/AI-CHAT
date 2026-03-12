import { createContext, ReactNode, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';

export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

const getStoredTheme = (): ThemeMode | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : null;
};

export const getPreferredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedTheme = getStoredTheme();
  if (storedTheme) {
    return storedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const applyTheme = (theme: ThemeMode) => {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
};

interface ThemeTransitionOrigin {
  x: number;
  y: number;
}

interface ThemeDocument extends Document {
  startViewTransition?: (update: () => void) => {
    ready: Promise<void>;
    finished: Promise<void>;
    updateCallbackDone: Promise<void>;
  };
}

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: (origin?: ThemeTransitionOrigin) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => getPreferredTheme());

  useLayoutEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (getStoredTheme()) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setThemeState(event.matches ? 'dark' : 'light');
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (nextTheme: ThemeMode) => {
        setThemeState(nextTheme);
      },
      toggleTheme: (origin?: ThemeTransitionOrigin) => {
        const nextTheme = theme === 'dark' ? 'light' : 'dark';
        const themeDocument = document as ThemeDocument;
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (!themeDocument.startViewTransition || prefersReducedMotion) {
          setThemeState(nextTheme);
          return;
        }

        const x = origin?.x ?? window.innerWidth - 32;
        const y = origin?.y ?? 32;
        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );

        const transition = themeDocument.startViewTransition(() => {
          flushSync(() => {
            setThemeState(nextTheme);
          });
        });

        transition.ready
          .then(() => {
            document.documentElement.animate(
              {
                clipPath: [
                  `circle(0px at ${x}px ${y}px)`,
                  `circle(${endRadius}px at ${x}px ${y}px)`
                ]
              },
              {
                duration: 560,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                pseudoElement: '::view-transition-new(root)'
              }
            );
          })
          .catch(() => {
            setThemeState(nextTheme);
          });
      }
    }),
    [theme]
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};
