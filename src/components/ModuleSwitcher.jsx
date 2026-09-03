import { useEffect, useState } from 'react';

function applicationHref(application) {
  if (application.code !== 'agent-core') return application.url;
  return `${application.url}#token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}&theme=${encodeURIComponent(localStorage.getItem('mrti_theme') || '')}`;
}

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
  function navigate(event) { if (event.target.value) window.location.assign(event.target.value); }
  return <label className="portal-module-switcher"><span>Cambiar módulo</span><select value="" onChange={navigate} aria-label="Cambiar de módulo"><option value="" disabled>MRTI Activos</option><option value="/">Mi espacio</option>{applications.filter((application) => application.code !== 'activos').map((application) => <option key={application.code} value={applicationHref(application)}>{application.name}</option>)}</select></label>;
}
