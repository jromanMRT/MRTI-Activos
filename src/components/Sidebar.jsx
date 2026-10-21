import { useModulePermissions } from '../vendor/mrti-platform/permission-ui.js';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme.js';
import { ModuleSidebar, SidebarGroup, SidebarNavIcon } from './layout/ModuleSidebar.jsx';

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

  return (
    <ModuleSidebar
      moduleLabel="Activos"
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      theme={theme}
    >
      {NAV_SECTIONS.map((section) => {
        const visibleItems = section.items.filter((item) => permissions.can(item.to));
        if (visibleItems.length === 0) return null;
        return (
          <SidebarGroup key={section.title} label={section.title}>
            {visibleItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) => `portal-module-nav-item${isActive ? ' is-active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <NavIcon name={item.icon} />
                      <span className="portal-module-nav-label">{item.label}</span>
                      {isActive && <span className="portal-module-nav-dot" />}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </SidebarGroup>
        );
      })}
    </ModuleSidebar>
  );
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
  return <SidebarNavIcon>{paths[name] || paths.catalog}</SidebarNavIcon>;
}
