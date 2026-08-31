import { PortalNotifications } from './PortalNotifications.jsx';

function readProfile() {
  try { return JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { return {}; }
}

export function ModuleHeader({ title, subtitle, mobileMenuOpen, onMenuClick }) {
  const profile = readProfile();
  const name = profile.full_name || 'Usuario';
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return <header className="portal-module-topbar">
    <button type="button" className="portal-module-menu" onClick={onMenuClick} aria-label="Abrir navegación" aria-expanded={mobileMenuOpen}>☰</button>
    <span className="portal-module-context"><strong>{title}</strong><small>{subtitle}</small></span>
    <div className="portal-module-actions">
      <PortalNotifications />
      <a className="portal-module-profile" href="/?view=account" aria-label="Abrir mi perfil">
        <span className="portal-module-avatar" aria-hidden="true">{initials || 'U'}</span>
        <span><strong>{name}</strong><small>{profile.role || 'Sesión activa'}</small></span>
      </a>
    </div>
  </header>;
}
