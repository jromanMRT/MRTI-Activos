import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getToken, goToPortalLogin } from '../api.js';
import { Sidebar } from './Sidebar.jsx';

export function Layout({ children }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mrti_activos_sidebar_collapsed') === '1');

  useEffect(() => {
    if (!getToken()) goToPortalLogin();
  }, []);

  function toggleCollapse() {
    setCollapsed((prev) => {
      localStorage.setItem('mrti_activos_sidebar_collapsed', prev ? '0' : '1');
      return !prev;
    });
  }

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
      )}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-y-0 left-0 w-64 z-40">
          <Sidebar collapsed={false} onToggleCollapse={() => setMobileMenuOpen(false)} onNavigate={() => setMobileMenuOpen(false)} />
        </div>
      )}

      <header className="md:hidden sticky top-0 z-20 flex items-center justify-between border-b border-slate-800 bg-slate-900/80 backdrop-blur px-4 py-3">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 -ml-2 rounded-lg text-slate-300 hover:bg-slate-800"
          aria-label="Abrir menú"
        >
          ☰
        </button>
        <span className="font-bold">MRTI Activos</span>
        <span className="w-8" />
      </header>

      <main className={`min-h-screen transition-all duration-300 ${collapsed ? 'md:pl-16' : 'md:pl-64'}`}>
        <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
