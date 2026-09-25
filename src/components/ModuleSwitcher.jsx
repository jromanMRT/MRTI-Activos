import '../header-navigation.css';
import { useEffect, useState } from 'react';

function applicationHref(application) {
  if (application.code !== 'agent-core') return application.url;
  return `${application.url}#token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}&theme=${encodeURIComponent(localStorage.getItem('mrti_theme') || '')}`;
}

// Pestañas visibles directamente en el encabezado, sin nada que abrir; copia
// local del mismo componente en Core.
export function ModuleSwitcher() {
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    fetch('/api/portal/v1/applications', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(({ data }) => setApplications(Array.isArray(data) ? data : []))
      .catch(() => setApplications([]));
  }, []);

  return (
    <nav className="portal-header-navigation module-tabs" aria-label="Navegación de la plataforma">
      <a className="module-tab" href="/dashboard">Dashboard</a>
      {applications.map((application) => {
        const isCurrent = application.code === 'activos';
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
