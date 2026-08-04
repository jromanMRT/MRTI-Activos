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
