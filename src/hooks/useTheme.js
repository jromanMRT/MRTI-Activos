import { useEffect, useState } from 'react';

// Misma key ('mrti_theme') que MRTI Core y el resto de módulos: como todos
// viven bajo el mismo origen, elegir tema en cualquiera se recuerda en
// todos. Sin preferencia guardada, se sigue la del sistema en vez de forzar
// un tema fijo (ver MRTI/src/main.js `preferredTheme`).
function preferredTheme() {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

async function persistSharedTheme(theme) {
  const token = window.localStorage.getItem('auth_token');
  if (!token) return;
  try {
    await fetch('/api/auth/profile/preferences/theme', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ theme }),
    });
  } catch { /* el estado local se conserva si Core no responde */ }
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

  useEffect(() => {
    const syncTheme = (event) => {
      if (event.key === 'mrti_theme' && (event.newValue === 'light' || event.newValue === 'dark')) setTheme(event.newValue);
    };
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, []);

  const setSharedTheme = (nextTheme) => {
    setTheme(nextTheme);
    void persistSharedTheme(nextTheme);
  };

  return [theme, setSharedTheme];
}
