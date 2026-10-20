// GENERADO desde MRTI-Platform@cc7ffc2 (src/layout/ModuleSwitcher.jsx).
// No editar aquí: cambiar en MRTI-Platform y ejecutar bin/sync.mjs.
import './header-navigation.css';
import { useEffect, useState } from 'react';

let _request = null;
function loadApplications() {
  const token = localStorage.getItem('auth_token');
  if (!token) return Promise.resolve([]);
  if (!_request) {
    _request = fetch('/api/portal/v1/applications', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ data }) => (Array.isArray(data) ? data : []))
      .catch(() => { _request = null; return []; });
  }
  return _request;
}

function applicationHref(application) {
  if (application.code !== 'agent-core') return application.url;
  return `${application.url}#token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}&theme=${encodeURIComponent(localStorage.getItem('mrti_theme') || '')}`;
}

export function ModuleSwitcher({ moduleCode }) {
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    loadApplications().then(setApplications);
  }, []);

  return (
    <nav className="portal-header-navigation module-tabs" aria-label="Navegación de la plataforma">
      <a className="module-tab" href="/dashboard">Dashboard</a>
      {applications.map((application) => {
        const isCurrent = application.code === moduleCode;
        return (
          <a
            key={application.code}
            className={`module-tab${isCurrent ? ' is-current' : ''}`}
            href={applicationHref(application)}
            aria-current={isCurrent ? 'page' : undefined}
          >
            {application.name.replace(/^MRTI\s*/i, '')}
          </a>
        );
      })}
    </nav>
  );
}
