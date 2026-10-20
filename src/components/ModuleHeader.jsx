import { ModuleHeader as SharedModuleHeader } from './layout/ModuleHeader.jsx';
import { PortalNotifications } from './PortalNotifications.jsx';
import { AccountMenu } from './AccountMenu.jsx';

function readProfile() {
  try { return JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { return {}; }
}

export function ModuleHeader({ mobileMenuOpen, onMenuClick }) {
  const profile = readProfile();

  return (
    <SharedModuleHeader moduleCode="activos" moduleName="Activos" mobileMenuOpen={mobileMenuOpen} onMenuClick={onMenuClick}>
      <PortalNotifications />
      <AccountMenu profile={profile} />
    </SharedModuleHeader>
  );
}
