import { useModulePermissions } from '../vendor/mrti-platform/permission-ui.js';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme.js';

const NAV_SECTIONS = [
  {
    title: 'Supervisión',
    items: [
      { to: '/', label: 'Dashboard', icon: 'dashboard' },
      { to: '/alertas', label: 'Alertas', icon: 'alert' },
    ],
  },
  {
    title: 'Equipos y Dispositivos',
    items: [
      { to: '/inventario', label: 'Equipos de cómputo', icon: 'inventory' },
      { to: '/catalogos/celulares', label: 'Teléfonos celulares', icon: 'phone' },
      { to: '/catalogos/impresoras', label: 'Impresoras', icon: 'printer' },
      { to: '/catalogos/nvr', label: 'NVR / CCTV', icon: 'cctv' },
      { to: '/catalogos/componentes', label: 'Componentes y partes', icon: 'cpu' },
    ],
  },
  {
    title: 'Redes y Comunicaciones',
    items: [
      { to: '/catalogos/starlink', label: 'Enlaces Starlink', icon: 'network' },
      { to: '/catalogos/fortigate', label: 'FortiGate', icon: 'shield' },
      { to: '/catalogos/dominios', label: 'Dominios', icon: 'globe' },
      { to: '/catalogos/passwords', label: 'Contraseñas de red', icon: 'key' },
    ],
  },
  {
    title: 'Procesos y Operación',
    items: [
      { to: '/checklist-equipos', label: 'Checklist de equipos', icon: 'checklist' },
      { to: '/bajas-personal', label: 'Bajas de personal', icon: 'offboarding' },
      { to: '/catalogos/mantenimientos', label: 'Mantenimientos', icon: 'wrench' },
    ],
  },
  {
    title: 'Seguridad y Control',
    items: [
      { to: '/seguridad-acceso', label: 'Seguridad y acceso', icon: 'shield' },
      { to: '/catalogos/credenciales', label: 'Credenciales', icon: 'key' },
      { to: '/catalogos/documentos', label: 'Documentos', icon: 'fileText' },
      { to: '/referencias-tecnicas', label: 'Referencias técnicas', icon: 'notes' },
      { to: '/catalogos/config-alertas', label: 'Configurar alertas', icon: 'alert' },
    ],
  },
];

export function Sidebar({ collapsed, onToggleCollapse, onNavigate }) {
  const permissions = useModulePermissions('activos');
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
      className={`portal-module-sidebar activos-sidebar fixed left-0 top-0 h-full bg-stone-800 border-r border-stone-700 transition-all duration-300 z-40 flex flex-col ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className={`portal-module-brand portal-module-brand-row flex items-center gap-3 p-4 border-b border-stone-700 ${collapsed ? 'justify-center' : ''}`}>
        <a href="/" title="Ir al home" aria-label="Ir al home" className={`portal-module-brand-home flex w-full items-center gap-3 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
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

      <nav className="portal-module-nav flex-1 py-3 overflow-y-auto">
        <div className="space-y-4 px-2">
          {NAV_SECTIONS.map((section, sectionIndex) => {
            const visibleItems = section.items.filter((item) => permissions.can(item.to));
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title} className="space-y-1">
                {sectionIndex > 0 && collapsed && (
                  <div className="my-2 border-t border-stone-700/60" />
                )}
                {!collapsed && (
                  <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                    {section.title}
                  </div>
                )}
                <ul className="space-y-1">
                  {visibleItems.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? 'border-l-2 border-ore-300 bg-ore-500/15 text-ore-300 font-medium'
                              : 'border-l-2 border-transparent text-stone-400 hover:bg-stone-700 hover:text-stone-100'
                          } ${collapsed ? 'justify-center' : ''}`
                        }
                        title={collapsed ? item.label : undefined}
                      >
                        <NavIcon name={item.icon} />
                        {!collapsed && <span>{item.label}</span>}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </nav>

      <div className={`portal-module-footer border-t border-stone-700 p-4 flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between'}`}>
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="portal-sidebar-collapse-action p-2 rounded-lg text-stone-400 hover:bg-stone-700 hover:text-stone-100 transition-colors"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Cambiar tema"
          aria-pressed={theme === 'dark'}
        >
          <ThemeIcon theme={theme} />
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-2 rounded-lg text-stone-400 hover:bg-stone-700 hover:text-stone-100 transition-colors"
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
    printer: <><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" rx="1" /></>,
    cctv: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></>,
    cpu: <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M15 2v2M9 2v2M20 15h2M20 9h2M9 20v2M15 20v2M2 9h2M2 15h2" /></>,
    network: <><circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" /><path d="M12 8v4M5 16l5-4M19 16l-5-4" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></>,
    globe: <><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20M12 2a14.5 14.5 0 0 1 0 20M2 12h20" /></>,
    key: <><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6M15.5 7.5l3 3M18.5 4.5l3 3" /></>,
    wrench: <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></>,
    checklist: <><path d="m9 11 3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
    fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></>,
    phone: <><rect x="6" y="2" width="12" height="20" rx="2" ry="2" /><path d="M12 18h.01" /></>,
  };
  return <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.catalog}</svg>;
}
