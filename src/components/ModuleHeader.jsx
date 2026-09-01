import { PortalNotifications } from './PortalNotifications.jsx';

function readProfile() {
  try { return JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { return {}; }
}

export function ModuleHeader({ title, subtitle, mobileMenuOpen, onMenuClick, printable = false }) {
  const profile = readProfile();
  const name = profile.full_name || 'Usuario';
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return <header className="portal-module-topbar">
    <button type="button" className="portal-module-menu" onClick={onMenuClick} aria-label="Abrir navegación" aria-expanded={mobileMenuOpen}>☰</button>
    <span className="portal-module-context"><strong>{title}</strong><small>{subtitle}</small></span>
    <div className="portal-module-actions">
      {printable && <button type="button" className="portal-print-button" onClick={() => window.print()} title="Imprimir reporte de esta vista" aria-label="Imprimir reporte de esta vista"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z" /></svg><span>Imprimir reporte</span></button>}
      <PortalNotifications />
      <a className="portal-module-profile" href="/?view=account" aria-label="Abrir mi perfil">
        <span className="portal-module-avatar" aria-hidden="true">{initials || 'U'}</span>
        <span><strong>{name}</strong><small>{profile.role || 'Sesión activa'}</small></span>
      </a>
    </div>
  </header>;
}
