import { PortalNotifications } from './PortalNotifications.jsx';
import { ModuleSwitcher } from './ModuleSwitcher.jsx';
import { AccountMenu } from './AccountMenu.jsx';

function readProfile() {
  try { return JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { return {}; }
}

export function ModuleHeader({ title, subtitle, mobileMenuOpen, onMenuClick }) {
  const profile = readProfile();

  return <header className="portal-module-topbar">
    <button type="button" className="portal-module-menu" onClick={onMenuClick} aria-label="Abrir navegación" aria-expanded={mobileMenuOpen}>☰</button>
    <ModuleSwitcher />
    <span className="portal-module-context"><strong>{title}</strong><small>{subtitle}</small></span>
    <div className="portal-module-actions">
      <PortalNotifications />
      <AccountMenu profile={profile} />
    </div>
  </header>;
}
