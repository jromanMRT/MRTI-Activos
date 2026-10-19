// GENERADO desde MRTI-Platform@8ce8362 (src/permission-ui.js).
// No editar aquí: cambiar en MRTI-Platform y ejecutar bin/sync.mjs.
import { createElement, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PERMISSION_CATALOG, routeSection, permissionFor, levelAllows, requestAllowed } from './permissions.js';
let snapshot = { profile: null, error: '', loading: true };
let pending = null;
const listeners = new Set();
let interval = null;
async function refresh() {
  if (pending) return pending;
  pending = (async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Inicia sesión para continuar.');
      const response = await fetch('/api/auth/identity', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error(response.status === 401 ? 'Tu sesión expiró.' : 'No fue posible consultar los permisos.');
      const { profile } = await response.json();
      if (!profile?.id || profile.access_policy_version !== 1) throw new Error('No fue posible confirmar los permisos.');
      snapshot = { profile, error: '', loading: false };
    } catch (error) { snapshot = { profile: null, error: error.message, loading: false }; }
    finally { pending = null; listeners.forEach((listener) => listener(snapshot)); }
  })();
  return pending;
}
export function useModulePermissions(code) {
  const [value, setValue] = useState(snapshot);
  useEffect(() => {
    listeners.add(setValue);
    setValue(snapshot);
    if (listeners.size === 1) {
      void refresh();
      interval = setInterval(refresh, 30000);
      window.addEventListener('focus', refresh);
    }
    return () => { listeners.delete(setValue); if (!listeners.size) { clearInterval(interval); window.removeEventListener('focus', refresh); } };
  }, []);
  const module = PERMISSION_CATALOG.find((m) => m.code === code);
  const fullPath = (path) => module.base + (path === '/' ? '' : path);
  const level = (path) => permissionFor(value.profile, code, routeSection(code, fullPath(path), true));
  return { ...value, module, level, sectionLevel: (id) => permissionFor(value.profile, code, id), can: (path, method = 'GET') => levelAllows(level(path), method), canApi: (path, method = 'GET') => requestAllowed(value.profile, code, method, module.api + (path === '/' ? '' : path)), refresh };
}
export function PermissionBoundary({ code, children }) {
  const permissions = useModulePermissions(code);
  const location = useLocation();
  // Mi espacio RH es autoservicio; su servidor conserva el aislamiento por identidad.
  if (code === 'rh' && location.pathname.startsWith('/mi-espacio')) return children;
  if (permissions.loading) return createElement('p', { role: 'status', style: { padding: 24 } }, 'Consultando permisos…');
  if (permissions.error) return createElement('section', { style: { padding: 24 } }, createElement('p', { role: 'alert' }, permissions.error), createElement('button', { onClick: permissions.refresh }, 'Reintentar'));
  if (permissions.can(location.pathname)) return children;
  const options = permissions.module.sections.filter((s) => s.pages.length && permissions.can('/' + s.pages[0]) && !s.pages[0].includes('['));
  return createElement('section', { style: { padding: 24 } },
    createElement('h2', null, 'Sin acceso a esta sección'),
    createElement('p', null, 'Tu cuenta no tiene permiso para abrir esta sección. Puedes elegir una de las secciones habilitadas o volver al Dashboard.'),
    createElement('ul', null, options.map((s) => createElement('li', { key: s.id }, createElement('a', { href: permissions.module.base + '/' + s.pages[0] }, s.name)))),
    createElement('a', { href: '/dashboard' }, 'Volver al Dashboard'));
}
