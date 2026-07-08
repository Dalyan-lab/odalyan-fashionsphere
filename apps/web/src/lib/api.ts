/**
 * Client API minimal pour le backend NestJS.
 * Gère le token d'accès (stocké en localStorage côté client).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('odalyan_access_token');
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('odalyan_access_token', token);
  else localStorage.removeItem('odalyan_access_token');
}

/** Lit l'état d'auth persisté par zustand (clé 'odalyan-auth'). */
function getStoredAuth(): { user?: unknown; refreshToken?: string | null } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('odalyan-auth');
    return raw ? (JSON.parse(raw).state ?? null) : null;
  } catch {
    return null;
  }
}

function setStoredAuth(user: unknown, refreshToken: string) {
  try {
    const raw = localStorage.getItem('odalyan-auth');
    const obj = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    obj.state = { ...obj.state, user, refreshToken };
    localStorage.setItem('odalyan-auth', JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}

function clearStoredAuth() {
  setToken(null);
  try {
    localStorage.removeItem('odalyan-auth');
  } catch {
    /* ignore */
  }
}

let refreshPromise: Promise<boolean> | null = null;

/** Renouvelle le jeton d'accès via le refresh token (rotation). Déduplique les appels concurrents. */
async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const auth = getStoredAuth();
    const refreshToken = auth?.refreshToken;
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as {
        user: unknown;
        tokens: { accessToken: string; refreshToken: string };
      };
      setToken(data.tokens.accessToken);
      setStoredAuth(data.user, data.tokens.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean; _retried?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, _retried, ...rest } = options;
  const token = auth ? getToken() : null;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      cache: 'no-store',
    });
  } catch {
    // Erreur réseau (serveur injoignable, CORS, hors-ligne)
    throw new ApiError(
      'Impossible de joindre le serveur. Vérifiez votre connexion et que l’API est démarrée.',
      0,
    );
  }

  // Jeton expiré : on tente un renouvellement transparent puis on rejoue la requête
  if (res.status === 401 && auth && !_retried && path !== '/auth/refresh') {
    const ok = await refreshAccessToken();
    if (ok) {
      return apiFetch<T>(path, { ...options, _retried: true });
    }
    // Renouvellement impossible → session expirée, on déconnecte
    clearStoredAuth();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login?expired=1';
    }
    throw new ApiError('Session expirée, veuillez vous reconnecter.', 401);
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    const b = body as { message?: string | string[]; errors?: Record<string, string[]> };
    let message = b?.message ?? `Erreur API (${res.status})`;
    if (Array.isArray(message)) message = message.join(', ');
    // Détaille les erreurs de validation par champ (Zod)
    if (b?.errors) {
      const fields = Object.values(b.errors).flat().filter(Boolean);
      if (fields.length) message = fields.join(' · ');
    }
    throw new ApiError(message, res.status, body);
  }

  // Corps potentiellement vide (204, ou handler renvoyant null/undefined)
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** Upload d'un fichier image vers /uploads. Renvoie l'URL publique. */
export async function uploadImage(file: File): Promise<{ url: string }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('odalyan_access_token') : null;
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    let msg = `Échec de l'upload (${res.status})`;
    try {
      const b = (await res.json()) as { message?: string };
      if (b?.message) msg = b.message;
    } catch {
      /* ignore */
    }
    throw new ApiError(msg, res.status);
  }
  return res.json() as Promise<{ url: string }>;
}
