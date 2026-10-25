import { PermissionBoundary } from '../vendor/mrti-platform/permission-ui.js';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getToken, goToPortalLogin } from '../api.js';
import { Sidebar } from './Sidebar.jsx';
import { ModuleHeader } from './ModuleHeader.jsx';

export function Layout({ children }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mrti_sidebar_collapsed') === '1');

  useEffect(() => {
    if (!getToken()) goToPortalLogin();
  }, []);

  function toggleCollapse() {
    setCollapsed((prev) => {
      localStorage.setItem('mrti_sidebar_collapsed', prev ? '0' : '1');
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
    <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-900 dark:text-stone-100">
      <div className="hidden min-[901px]:block">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 min-[901px]:hidden" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
      )}
      {mobileMenuOpen && (
        <div className="min-[901px]:hidden fixed inset-y-0 left-0 w-64 z-40">
          <Sidebar collapsed={false} onToggleCollapse={() => setMobileMenuOpen(false)} onNavigate={() => setMobileMenuOpen(false)} />
        </div>
      )}

      <div className={`portal-module-workspace transition-all duration-300 ${collapsed ? 'min-[901px]:pl-16' : 'min-[901px]:pl-64'}`}>
        <ModuleHeader mobileMenuOpen={mobileMenuOpen} onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="min-h-[calc(100vh-72px)]">
          <div className="w-full px-4 py-6 sm:px-6 lg:px-8"><PermissionBoundary code="activos">{children}</PermissionBoundary></div>
        </main>
      </div>
    </div>
  );
}
