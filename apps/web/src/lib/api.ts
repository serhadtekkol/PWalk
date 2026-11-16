const ACCESS_KEY = 'pmam_access_token';
const REFRESH_KEY = 'pmam_refresh_token';

export function getTokens() {
  return {
    accessToken: localStorage.getItem(ACCESS_KEY),
    refreshToken: localStorage.getItem(REFRESH_KEY),
  };
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const { refreshToken } = getTokens();
    if (!refreshToken) return null;
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        clearTokens();
        return null;
      }
      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      return data.accessToken as string;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const { accessToken } = getTokens();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let res = await fetch(path, { ...init, headers });

  if (res.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      headers.set('Authorization', `Bearer ${newAccess}`);
      res = await fetch(path, { ...init, headers });
    }
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: 'İstek başarısız oldu.' }));
    throw new Error(errBody.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
