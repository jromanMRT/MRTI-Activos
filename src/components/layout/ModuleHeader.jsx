// GENERADO desde MRTI-Platform@00d7fb5 (src/layout/ModuleHeader.jsx).
// No editar aquí: cambiar en MRTI-Platform y ejecutar bin/sync.mjs.
import { ModuleSwitcher } from './ModuleSwitcher.jsx';

// La marca pertenece al lateral; el encabezado sólo contiene utilidades globales.
export function ModuleHeader({ moduleCode, mobileMenuOpen, onMenuClick, children }) {
  return (
    <header className="portal-module-topbar mrti-global-header">
      <button type="button" className="portal-module-menu" onClick={onMenuClick} aria-label="Abrir navegación" aria-expanded={mobileMenuOpen}>☰</button>
      <ModuleSwitcher moduleCode={moduleCode} />
      <div className="portal-module-actions">{children}</div>
    </header>
  );
}
