import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getToken, goToPortalLogin } from '../api.js';

export function Shell({ children }) {
  useEffect(() => {
    if (!getToken()) goToPortalLogin();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-gradient-to-br from-sky-400 to-emerald-400" />
            MRTI Activos
          </Link>
          <a href="/" className="text-sm text-slate-400 hover:text-slate-200">← Volver al portal</a>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
