// GENERADO desde MRTI-Platform@cc7ffc2 (src/layout/ModuleHeader.jsx).
// No editar aquí: cambiar en MRTI-Platform y ejecutar bin/sync.mjs.
import { useState, useEffect } from 'react';
import { ModuleSwitcher } from './ModuleSwitcher.jsx';

export function ModuleHeader({ moduleCode, moduleName, mobileMenuOpen, onMenuClick, children }) {
  const [logoUrl, setLogoUrl] = useState('/company-logo.svg');

  useEffect(() => {
    fetch('/api/portal/v1/brand-appearance', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(({ data }) => { if (data?.portal_logo?.content_url) setLogoUrl(data.portal_logo.content_url); })
      .catch(() => {});
  }, []);

  return (
    <header className="portal-module-topbar">
      <button type="button" className="portal-module-menu" onClick={onMenuClick} aria-label="Abrir navegación" aria-expanded={mobileMenuOpen}>☰</button>
      <a href="/" className="portal-topbar-brand" aria-label="Ir al home">
        <span className="portal-topbar-brand-mark"><img src={logoUrl} alt="" /></span>
        <span className="portal-topbar-brand-copy">
          <strong><span>MRTI</span><span className="brand-module">{moduleName}</span></strong>
          <small>Minera Río Tinto</small>
        </span>
      </a>
      <ModuleSwitcher moduleCode={moduleCode} />
      <div className="portal-module-actions">
        {children}
      </div>
    </header>
  );
}
