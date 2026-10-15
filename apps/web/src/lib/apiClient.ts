import type { ApiErrorBody } from '@meshapp/shared';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/v1';

const ACCESS_TOKEN_KEY = 'meshapp.access_token';
const REFRESH_TOKEN_KEY = 'meshapp.refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}
export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}
export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  code: string;
  fields?: Record<string, string>;
  violations?: ApiErrorBody['error']['violations'];
  status: number;

  constructor(body: ApiErrorBody, status: number) {
    super(body.error?.message || 'Request failed');
    this.code = body.error?.code || 'UNKNOWN';
    this.fields = body.error?.fields;
    this.violations = body.error?.violations;
    this.status = status;
  }
}

// Network/unreachable-API error, distinct from a well-formed API error response.
export class NetworkError extends Error {
  constructor(message = 'Unable to reach the MeshApp API. Please check your connection and try again.') {
    super(message);
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
  isFormData?: boolean;
  idempotencyKey?: string;
}

let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      clearTokens();
      return false;
    }
    setTokens(json.data.access_token, json.data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, options: RequestOptions = {}, _retried = false): Promise<T> {
  const { body, skipAuth, isFormData, idempotencyKey, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = { ...(headers as Record<string, string>) };
  if (!isFormData) finalHeaders['Content-Type'] = 'application/json';
  if (idempotencyKey) finalHeaders['Idempotency-Key'] = idempotencyKey;

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body === undefined ? undefined : isFormData ? (body as BodyInit) : JSON.stringify(body),
    });
  } catch (err) {
    throw new NetworkError();
  }

  if (res.status === 401 && !skipAuth && !_retried) {
    if (!refreshPromise) {
      refreshPromise = doRefresh().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      return request<T>(path, options, true);
    }
    clearTokens();
    window.dispatchEvent(new CustomEvent('meshapp:unauthenticated'));
  }

  let json: any = null;
  try {
    json = res.status === 204 ? null : await res.json();
  } catch {
    // non-JSON response
  }

  if (!res.ok || json?.success === false) {
    if (json && json.success === false) {
      throw new ApiError(json as ApiErrorBody, res.status);
    }
    throw new ApiError(
      { success: false, error: { code: 'INTERNAL_ERROR', message: `Request failed with status ${res.status}` } },
      res.status,
    );
  }

  return (json?.data ?? json) as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
};

export { BASE_URL };
