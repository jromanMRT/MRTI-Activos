import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme.js';

const NAV_ITEMS = [
  { to: '/', label: 'Inventario', icon: 'inventory' },
  { to: '/terceros', label: 'Terceros externos', icon: 'people' },
  { to: '/operacion', label: 'Resumen operativo', icon: 'dashboard' },
  { to: '/alertas', label: 'Alertas', icon: 'alert' },
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
  { to: '/catalogos/unidades', label: 'Unidades', icon: 'catalog' },
  { to: '/catalogos/config-alertas', label: 'Configurar alertas', icon: 'catalog' },
];

// Core deja el perfil en localStorage al iniciar sesión (mismo origen que
// todos los módulos), así que aquí se lee directo en lugar de pedirlo de
// nuevo -- ver /var/www/mrt/MRTI/MRTI/src/main.js.
function readAuthProfile() {
  try { return JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { return {}; }
}

async function handleLogout() {
  try {
    const token = localStorage.getItem('auth_token');
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' });
  } catch { /* cierre local garantizado aunque el aviso a Core falle */ }
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_profile');
  window.location.replace('/');
}

export function Sidebar({ collapsed, onToggleCollapse, onNavigate }) {
  const [theme, setTheme] = useTheme();
  const [applications, setApplications] = useState([]);
  const [logoUrl, setLogoUrl] = useState('/company-logo.svg');
  const profile = readAuthProfile();
  const isAdministrator = profile.role === 'administrator';

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    fetch('/api/portal/v1/applications', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(({ data }) => setApplications(Array.isArray(data) ? data : []))
      .catch(() => setApplications([]));
  }, []);

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
        <a href="/" title="Ir a Mi espacio" aria-label="Ir a Mi espacio" className="portal-module-brand-link grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl">
          <img src={logoUrl} alt="" className="h-[34px] w-[34px]" />
        </a>
        {!collapsed && (
          <div className="portal-module-brand-copy">
            <strong>MRTI</strong>
            <small>Minera Río Tinto</small>
          </div>
        )}
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
        <div className="portal-module-section mt-5 border-t border-slate-800 pt-4">
          {!collapsed && <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Cambiar módulo</p>}
          <div className="space-y-1 px-2">
            <ModuleLink href="/" label="Mi espacio" collapsed={collapsed} onNavigate={onNavigate} icon="⌂" />
            {applications.filter((application) => application.code !== 'activos').map((application) => <ModuleLink key={application.code} href={application.code === 'agent-core' ? `${application.url}#token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}&theme=${encodeURIComponent(localStorage.getItem('mrti_theme') || '')}` : application.url} label={application.name} collapsed={collapsed} onNavigate={onNavigate} icon="◆" />)}
          </div>
        </div>

        <div className="portal-module-section mt-5 border-t border-slate-800 pt-4">
          {!collapsed && <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Mi cuenta</p>}
          <div className="space-y-1 px-2">
            <ModuleLink href="/?view=account" label="Perfil" collapsed={collapsed} onNavigate={onNavigate} icon="○" />
            {isAdministrator && <ModuleLink href="/?view=brand-assets" label="Recursos de marca" collapsed={collapsed} onNavigate={onNavigate} icon="◆" />}
            {isAdministrator && <ModuleLink href="/?view=control-center" label="Centro de control" collapsed={collapsed} onNavigate={onNavigate} icon="⚙" />}
          </div>
        </div>
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
        <button
          type="button"
          onClick={handleLogout}
          className="p-2 rounded-lg text-slate-400 hover:bg-red-500/15 hover:text-red-400 transition-colors"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogoutIcon />
        </button>
      </div>
    </aside>
  );
}

function ModuleLink({ href, label, collapsed, onNavigate, icon }) {
  return <a href={href} onClick={onNavigate} title={label} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 ${collapsed ? 'justify-center' : ''}`}><span className="grid h-5 w-5 place-items-center text-xs" aria-hidden="true">{icon}</span>{!collapsed && <span className="truncate text-sm">{label}</span>}</a>;
}

function ThemeIcon({ theme }) {
  return theme === 'dark'
    ? <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg>
    : <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
}

function CollapseIcon({ collapsed }) {
  return <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={collapsed ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'} /></svg>;
}

function LogoutIcon() {
  return <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>;
}

function NavIcon({ name }) {
  const paths = {
    inventory: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
    people: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5.8M17 15a5 5 0 0 1 4 5" /></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    alert: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    catalog: <><path d="M4 5h16M4 12h16M4 19h16" /><circle cx="7" cy="5" r="1" /><circle cx="7" cy="12" r="1" /><circle cx="7" cy="19" r="1" /></>,
  };
  return <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.catalog}</svg>;
}
