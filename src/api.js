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

export function obsLinkDevice(deviceId, assetUid) {
  return obsRequest(`/links/${encodeURIComponent(deviceId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ asset_id: assetUid }),
  });
}
