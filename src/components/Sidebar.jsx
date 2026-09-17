import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme.js';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/inventario', label: 'Inventario', icon: 'inventory' },
  { to: '/notas-tecnicas', label: 'Notas técnicas', icon: 'notes' },
  { to: '/alertas', label: 'Alertas', icon: 'alert' },
  { to: '/bajas-personal', label: 'Bajas de personal', icon: 'offboarding' },
  { to: '/catalogos/credenciales', label: 'Credenciales', icon: 'catalog' },
  { to: '/catalogos/componentes', label: 'Componentes', icon: 'catalog' },
  { to: '/catalogos/impresoras', label: 'Impresoras', icon: 'catalog' },
  { to: '/catalogos/nvr', label: 'NVR / CCTV', icon: 'catalog' },
  { to: '/catalogos/passwords', label: 'Contraseñas de red', icon: 'catalog' },
  { to: '/catalogos/starlink', label: 'Starlink', icon: 'catalog' },
  { to: '/catalogos/fortigate', label: 'FortiGate', icon: 'catalog' },
  { to: '/catalogos/dominios', label: 'Dominios', icon: 'catalog' },
  { to: '/catalogos/mantenimientos', label: 'Mantenimientos', icon: 'catalog' },
  { to: '/catalogos/documentos', label: 'Documentos', icon: 'catalog' },
  { to: '/catalogos/config-alertas', label: 'Configurar alertas', icon: 'catalog' },
];

export function Sidebar({ collapsed, onToggleCollapse, onNavigate }) {
  const [theme, setTheme] = useTheme();
  const [logoUrl, setLogoUrl] = useState('/company-logo.svg');

  // El logo lo administra Core (Centro de control → Recursos de marca); se
  // consulta en vivo para que un cambio ahí se refleje aquí sin tocar código.
  useEffect(() => {
    fetch('/api/portal/v1/brand-appearance', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(({ data }) => { if (data?.portal_logo?.content_url) setLogoUrl(data.portal_logo.content_url); })
      .catch(() => {});
  }, []);

  return (
    <aside
      className={`portal-module-sidebar activos-sidebar fixed left-0 top-0 h-full bg-slate-900 border-r border-slate-800 transition-all duration-300 z-40 flex flex-col ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className={`portal-module-brand portal-module-brand-row flex items-center gap-3 p-4 border-b border-slate-800 ${collapsed ? 'justify-center' : ''}`}>
        <a href="/" title="Ir a MRTI Core" aria-label="Ir a MRTI Core" className={`portal-module-brand-home flex w-full items-center gap-3 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
          <span className="portal-module-brand-link grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl">
          <img src={logoUrl} alt="" className="h-[34px] w-[34px]" />
          </span>
        {!collapsed && (
          <div className="portal-module-brand-copy">
            <strong><span>MRTI</span><span className="portal-module-brand-name">Activos</span></strong>
            <small>Minera Río Tinto</small>
          </div>
        )}
        </a>
      </div>

      <nav className="portal-module-nav flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive ? 'border-l-2 border-sky-400 bg-sky-500/15 text-sky-400' : 'border-l-2 border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  } ${collapsed ? 'justify-center' : ''}`
                }
                title={collapsed ? item.label : undefined}
              >
                <NavIcon name={item.icon} />
                {!collapsed && <span className="font-medium">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className={`portal-module-footer border-t border-slate-800 p-4 flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between'}`}>
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="portal-sidebar-collapse-action p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Cambiar tema"
          aria-pressed={theme === 'dark'}
        >
          <ThemeIcon theme={theme} />
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          title={collapsed ? 'Expandir' : 'Colapsar'}
          aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
      </div>
    </aside>
  );
}

function ThemeIcon({ theme }) {
  return theme === 'dark'
    ? <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg>
    : <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
}

function CollapseIcon({ collapsed }) {
  return <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={collapsed ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'} /></svg>;
}

function NavIcon({ name }) {
  const paths = {
    notes: <><path d="M14 3H5v18h14V8Z" /><path d="M14 3v5h5M8 12h8M8 16h6" /></>,
    inventory: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
    people: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5.8M17 15a5 5 0 0 1 4 5" /></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    alert: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    catalog: <><path d="M4 5h16M4 12h16M4 19h16" /><circle cx="7" cy="5" r="1" /><circle cx="7" cy="12" r="1" /><circle cx="7" cy="19" r="1" /></>,
    offboarding: <><path d="M15 3h5v18h-5M10 17l5-5-5-5M15 12H3" /><circle cx="6" cy="5" r="2" /></>,
  };
  return <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.catalog}</svg>;
}
