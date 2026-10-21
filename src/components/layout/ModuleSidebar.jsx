// GENERADO desde MRTI-Platform@abd558b (src/layout/ModuleSidebar.jsx).
// No editar aquí: cambiar en MRTI-Platform y ejecutar bin/sync.mjs.
import './sidebar-navigation.css';
import { useEffect, useState } from 'react';

export function ModuleSidebar({ moduleLabel, collapsed, mobileOpen, onToggleCollapse, onThemeToggle, theme, children }) {
  const [logoUrl, setLogoUrl] = useState('/company-logo.svg');

  useEffect(() => {
    fetch('/api/portal/v1/brand-appearance', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ data }) => { if (data?.portal_logo?.content_url) setLogoUrl(data.portal_logo.content_url); })
      .catch(() => {});
  }, []);

  const cls = [
    'portal-module-sidebar',
    collapsed && 'is-collapsed',
    mobileOpen && 'is-mobile-open',
  ].filter(Boolean).join(' ');

  return (
    <aside className={cls} aria-label={`Navegación de ${moduleLabel}`}>
      <div className="portal-module-brand">
        <a href="/" title="Ir al home" aria-label="Ir al home" className="portal-module-brand-home">
          <span className="portal-module-brand-link">
            <img src={logoUrl} alt="" />
          </span>
          <div className="portal-module-brand-copy">
            <strong><span>MRTI</span><span className="portal-module-brand-name">{moduleLabel}</span></strong>
            <small>Minera Río Tinto</small>
          </div>
        </a>
      </div>

      <nav className="portal-module-nav">
        {children}
      </nav>

      <div className="portal-module-footer">
        <button
          type="button"
          className="portal-module-footer-action"
          onClick={onThemeToggle}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Cambiar tema"
          aria-pressed={theme === 'dark'}
        >
          {theme === 'dark'
            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg>
            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          }
        </button>
        <button
          type="button"
          className="portal-module-footer-action"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expandir' : 'Colapsar'}
          aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={collapsed ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'} />
          </svg>
        </button>
      </div>
    </aside>
  );
}

export function SidebarGroup({ label, children }) {
  if (!children || (Array.isArray(children) && children.filter(Boolean).length === 0)) return null;
  return (
    <div className="portal-module-nav-group">
      {label && <div className="portal-module-nav-group-label">{label}</div>}
      <ul className="portal-module-nav-list">
        {children}
      </ul>
    </div>
  );
}

export function SidebarNavIcon({ children: pathData }) {
  return (
    <span className="portal-module-nav-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {pathData}
      </svg>
    </span>
  );
}
