import Constants from 'expo-constants';
import { useAuth } from '../store/auth';
import { ApiError } from './errors';
import { setOnline } from '../store/network';

/** API base URL: EXPO_PUBLIC_API_URL env var, else app.json `extra.apiUrl`. */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:4000/api/v1';

export { ApiError } from './errors';

type Body = Record<string, unknown> | FormData | undefined;

export async function api<T>(path: string, options: { method?: string; body?: Body } = {}): Promise<T> {
  const token = useAuth.getState().token;
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.body && !isForm ? { 'Content-Type': 'application/json' } : {}),
      },
      body: isForm ? (options.body as FormData) : options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    setOnline(false);
    throw new ApiError(0, 'Cannot reach the Optimas server. Check your internet connection.', 'NETWORK');
  }
  setOnline(true);

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) useAuth.getState().logout();
    const err = json?.error ?? {};
    const detail = Array.isArray(err.details) && err.details[0]?.message;
    throw new ApiError(res.status, detail || err.message || 'Request failed', err.code, err.details);
  }
  return json as T;
}

/** Proof photos are served by the API (signed-in, permission-checked). */
export const photoUrl = (id: string) => `${API_URL}/capture/photos/${id}`;
export const authHeader = (): Record<string, string> => {
  const token = useAuth.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};
