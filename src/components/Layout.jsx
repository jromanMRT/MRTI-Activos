import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getToken, goToPortalLogin } from '../api.js';
import { Sidebar } from './Sidebar.jsx';
import { ModuleHeader } from './ModuleHeader.jsx';

function currentRouteLabel(pathname) {
  if (pathname === '/terceros') return 'Terceros externos';
  if (pathname === '/nuevo') return 'Nuevo activo';
  if (pathname !== '/') return 'Detalle del activo';
  return 'Inventario';
}

function reportTitleForPath(pathname) {
  if (pathname === '/') return 'Inventario de activos';
  if (pathname === '/terceros') return 'Terceros externos';
  if (pathname !== '/nuevo' && /^\/[^/]+$/.test(pathname)) return 'Ficha del activo';
  return '';
}

export function Layout({ children }) {
  const location = useLocation();
  const routeTitle = currentRouteLabel(location.pathname);
  const reportTitle = reportTitleForPath(location.pathname);
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
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

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

      <div className={`portal-module-workspace transition-all duration-300 ${collapsed ? 'md:pl-16' : 'md:pl-64'}`}>
        <ModuleHeader title={routeTitle} subtitle="MRTI Activos" mobileMenuOpen={mobileMenuOpen} onMenuClick={() => setMobileMenuOpen(true)} printable={Boolean(reportTitle)} />
        <main className="min-h-[calc(100vh-72px)]">
          {reportTitle && <div className="portal-print-header" aria-hidden="true"><div><strong>MRTI</strong><span>MRTI Activos · {reportTitle}</span></div><small>Generado {new Date().toLocaleString('es-MX')}</small></div>}
          <div className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
