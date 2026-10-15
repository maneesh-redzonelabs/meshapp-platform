import { ApiErrorBody, ApiResponse, ComplianceViolation } from '../types/shared';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './secureStore';

// Expo's built-in env convention: only EXPO_PUBLIC_* vars are inlined into
// client JS. Default matches the iOS simulator; see README for the
// Android-emulator (10.0.2.2) / physical-device (LAN IP) overrides.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/v1';

export class ApiError extends Error {
  code: string;
  fields?: Record<string, string>;
  violations?: ComplianceViolation[];
  scanId?: string;
  status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error?.message ?? 'Request failed');
    this.status = status;
    this.code = body.error?.code ?? 'UNKNOWN_ERROR';
    this.fields = body.error?.fields;
    this.violations = body.error?.violations;
    this.scanId = body.error?.scan_id;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean; // attach bearer token (default true)
  idempotencyKey?: string;
};

let refreshingPromise: Promise<string | null> | null = null;

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(
    path.startsWith('http') ? path : `${API_BASE_URL}${path}`,
  );
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

async function doFetch(path: string, options: RequestOptions, accessToken: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.auth !== false && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }
  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  let json: ApiResponse<unknown> | null = null;
  try {
    json = await res.json();
  } catch {
    // no body / non-JSON
  }
  return { res, json };
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshingPromise) return refreshingPromise;
  refreshingPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return null;
      const { res, json } = await doFetch(
        '/auth/token/refresh',
        { method: 'POST', body: { refresh_token: refreshToken }, auth: false },
        null,
      );
      if (!res.ok || !json || json.success === false) {
        await clearTokens();
        return null;
      }
      const data = json.data as { access_token: string; refresh_token: string };
      await saveTokens(data.access_token, data.refresh_token);
      return data.access_token;
    } finally {
      refreshingPromise = null;
    }
  })();
  return refreshingPromise;
}

/**
 * Typed fetch wrapper around the MeshApp API envelope:
 *   { success: true, data, meta } | { success: false, error }
 * Attaches the bearer token from secure storage and transparently retries
 * once after rotating the refresh token on a 401.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let accessToken = options.auth === false ? null : await getAccessToken();
  let { res, json } = await doFetch(path, options, accessToken);

  if (res.status === 401 && options.auth !== false) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      accessToken = newToken;
      ({ res, json } = await doFetch(path, options, accessToken));
    }
  }

  if (!json) {
    throw new ApiError(res.status, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Request failed with status ${res.status}` },
    });
  }

  if (json.success === false) {
    throw new ApiError(res.status, json);
  }

  return (json.data as T);
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], auth = true) =>
    apiRequest<T>(path, { method: 'GET', query, auth }),
  post: <T>(path: string, body?: unknown, opts: Partial<RequestOptions> = {}) =>
    apiRequest<T>(path, { method: 'POST', body, ...opts }),
  put: <T>(path: string, body?: unknown, opts: Partial<RequestOptions> = {}) =>
    apiRequest<T>(path, { method: 'PUT', body, ...opts }),
  patch: <T>(path: string, body?: unknown, opts: Partial<RequestOptions> = {}) =>
    apiRequest<T>(path, { method: 'PATCH', body, ...opts }),
  delete: <T>(path: string, opts: Partial<RequestOptions> = {}) =>
    apiRequest<T>(path, { method: 'DELETE', ...opts }),
};
