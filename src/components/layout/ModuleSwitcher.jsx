// GENERADO desde MRTI-Platform@00d7fb5 (src/layout/ModuleSwitcher.jsx).
// No editar aquí: cambiar en MRTI-Platform y ejecutar bin/sync.mjs.
import './header-navigation.css';
import { useEffect, useState } from 'react';

// Compartir únicamente solicitudes en vuelo de la misma sesión, nunca permisos
// indefinidamente ni entre usuarios distintos.
let pending = null;
let pendingToken = null;
function loadApplications(token) {
  if (!token) return Promise.resolve([]);
  if (pending && pendingToken === token) return pending;
  pendingToken = token;
  const request = fetch('/api/portal/v1/applications', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then(({ data }) => (Array.isArray(data) ? data : []))
    .catch(() => [])
    .finally(() => { if (pending === request) pending = null; });
  pending = request;
  return request;
}

function applicationHref(application) {
  if (application.code !== 'agent-core') return application.url;
  return `${application.url}#token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}&theme=${encodeURIComponent(localStorage.getItem('mrti_theme') || '')}`;
}

export function ModuleSwitcher({ moduleCode }) {
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    let active = true;
    let generation = 0;
    let previousToken;
    const refresh = () => {
      const token = localStorage.getItem('auth_token');
      const current = ++generation;
      if (token !== previousToken) setApplications([]);
      previousToken = token;
      loadApplications(token).then((items) => {
        if (active && current === generation && token === localStorage.getItem('auth_token')) setApplications(items);
      });
    };
    const onStorage = (event) => { if (!event.key || ['auth_token', 'auth_profile'].includes(event.key)) refresh(); };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', onStorage);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [moduleCode]);

  return (
    <nav className="portal-header-navigation module-tabs" aria-label="Navegación de la plataforma">
      <a className="module-tab" href="/dashboard">Dashboard</a>
      {applications.map((application) => {
        const isCurrent = application.code === moduleCode || (moduleCode === 'admin' && application.code === 'control-center');
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
