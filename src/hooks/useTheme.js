import { useEffect, useState } from 'react';

// Misma key ('mrti_theme') que MRTI Core y el resto de módulos: como todos
// viven bajo el mismo origen, elegir tema en cualquiera se recuerda en
// todos. Sin preferencia guardada, se sigue la del sistema en vez de forzar
// un tema fijo (ver MRTI/src/main.js `preferredTheme`).
function preferredTheme() {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = window.localStorage.getItem('mrti_theme');
    return stored === 'light' || stored === 'dark' ? stored : preferredTheme();
  });

  useEffect(() => {
    window.localStorage.setItem('mrti_theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return [theme, setTheme];
}
