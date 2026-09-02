const TOKEN_KEY = 'auth_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function goToPortalLogin() {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/?returnTo=${encodeURIComponent(returnTo)}`);
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const response = await fetch(`/activos-api/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (response.status === 401) {
    goToPortalLogin();
    throw new Error('No autenticado');
  }
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Error ${response.status}`);
  return body;
}

export async function apiDownload(path, fallbackName = 'documento.pdf') {
  const token = getToken();
  const response = await fetch(`/activos-api/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (response.status === 401) { goToPortalLogin(); throw new Error('No autenticado'); }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Error ${response.status}`);
  }
  const disposition = response.headers.get('content-disposition') || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const simple = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const filename = encoded ? decodeURIComponent(encoded) : (simple || fallbackName);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

async function obsRequest(path, options = {}) {
  const token = getToken();
  const response = await fetch(`/api/obs/assets${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (response.status === 401) {
    goToPortalLogin();
    throw new Error('No autenticado');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `MRTI Monitor respondió ${response.status}`);
  return body.data;
}

export function obsFetch(assetUid) {
  return obsRequest(`/${encodeURIComponent(assetUid)}`);
}

export function obsUnlinkedDevices() {
  return obsRequest('/unlinked/devices');
}

// Tickets relacionados con un activo -- lectura en vivo de MRTI-Tickets
// (nunca se copian aquí), mismo origen por Nginx que obsFetch. Si el
// usuario no tiene acceso al módulo Tickets, el backend responde 403 y el
// panel lo muestra como "sin acceso" en vez de romper el resto del popup.
export async function ticketsFetch(assetUid) {
  const token = getToken();
  const response = await fetch(`/tickets-api/api/tickets?asset_uid=${encodeURIComponent(assetUid)}&limit=50&sort=newest`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (response.status === 401) {
    goToPortalLogin();
    throw new Error('No autenticado');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || `MRTI Tickets respondió ${response.status}`);
  return body.data?.items || [];
}

export function obsLinkDevice(deviceId, assetUid) {
  return obsRequest(`/links/${encodeURIComponent(deviceId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ asset_id: assetUid }),
  });
}
